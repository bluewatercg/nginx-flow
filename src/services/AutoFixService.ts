/**
 * AutoFixService - 严格的“破坏性修复”服务（Destructive Repair）
 *
 * 目标：
 * - 禁止 append：必须先清洗旧指令，再写入 UI 状态
 * - 解决 listen 80 冲突：劫持并改造现有 80 Server（兼容端口为 number/string）
 * - 全局正则清洗：server_tokens / user / ssl_protocols / autoindex 等必须被彻底抹除
 */

import { v4 as uuidv4 } from 'uuid';
import { NginxConfig, ServerConfig } from '@/types/nginx';

type CleanKey = 'user' | 'server_tokens' | 'ssl_protocols' | 'autoindex';

const getPortAsString = (server: ServerConfig): string => {
  // 兼容：listen.port（number）、listen（string）或意外的 any 结构
  const anyServer = server as any;
  const port = anyServer?.listen?.port ?? anyServer?.listen ?? anyServer?.port;
  return String(port ?? '');
};

/**
 * Step 3：全局正则清洗（逐行匹配，兼容换行）
 * - 匹配行首 key，直到分号结束
 */
export const cleanRegex = (text: string, key: string): string => {
  if (!text || !text.trim()) return '';
  const regex = new RegExp(`^\\s*${key}\\s+[^;]+;?(\\r?\\n)?`, 'gm');
  return text.replace(regex, '').replace(/\n{3,}/g, '\n\n').trim();
};

export const cleanDirectives = (configText: string, targets: CleanKey[]): string => {
  let newText = configText || '';

  if (targets.includes('user')) newText = cleanRegex(newText, 'user');
  if (targets.includes('server_tokens')) newText = cleanRegex(newText, 'server_tokens');
  if (targets.includes('ssl_protocols')) newText = cleanRegex(newText, 'ssl_protocols');
  if (targets.includes('autoindex')) newText = cleanRegex(newText, 'autoindex');

  return newText;
};

const convertToPureRedirectHttpServer = (server: ServerConfig, serverName: string): ServerConfig => {
  return {
    ...server,
    name: `${serverName} (HTTP Redirect)`,
    listen: {
      ...server.listen,
      port: 80,
      http2: false,
      defaultServer: false,
    },
    serverName,
    ssl: {
      ...server.ssl,
      enabled: false,
      forceRedirect: false,
      certificate: '',
      certificateKey: '',
      protocols: [],
      ciphers: '',
    },
    // 关键：清空冲突字段
    root: '',
    index: [],
    customDirectives: 'return 301 https://$host$request_uri;',
  };
};

export class AutoFixService {
  // Step 1：更健壮的节点查找（端口兼容 number/string）
  static findHttpNode(config: NginxConfig, serverName: string, excludeServerId?: string): ServerConfig | undefined {
    return config.servers.find((s) =>
      s.id !== excludeServerId &&
      String(getPortAsString(s)) === '80' &&
      s.serverName === serverName
    );
  }

  static fixRootUser(config: NginxConfig): NginxConfig {
    const cleaned = cleanDirectives(config.global.customDirectives, ['user']);
    return {
      ...config,
      global: {
        ...config.global,
        customDirectives: cleaned,
        user: 'nginx',
      },
    };
  }

  static fixServerTokens(config: NginxConfig): NginxConfig {
    return {
      ...config,
      // 关键：global/http/server 三层都清
      global: {
        ...config.global,
        customDirectives: cleanDirectives(config.global.customDirectives, ['server_tokens']),
      },
      http: {
        ...config.http,
        serverTokens: false,
        customDirectives: cleanDirectives(config.http.customDirectives, ['server_tokens']),
      },
      servers: config.servers.map((s) => ({
        ...s,
        customDirectives: cleanDirectives(s.customDirectives, ['server_tokens']),
      })),
    };
  }

  static fixSslProtocols(config: NginxConfig): NginxConfig {
    return {
      ...config,
      servers: config.servers.map((s) => {
        if (!s.ssl.enabled) return s;
        return {
          ...s,
          ssl: {
            ...s.ssl,
            // 强制覆盖
            protocols: ['TLSv1.2', 'TLSv1.3'],
          },
          customDirectives: cleanDirectives(s.customDirectives, ['ssl_protocols']),
        };
      }),
    };
  }

  static fixAutoindex(config: NginxConfig): NginxConfig {
    return {
      ...config,
      servers: config.servers.map((s) => ({
        ...s,
        customDirectives: cleanDirectives(s.customDirectives, ['autoindex']),
      })),
      locations: config.locations.map((l) => ({
        ...l,
        customDirectives: cleanDirectives(l.customDirectives, ['autoindex']),
      })),
    };
  }

  // Step 2：节点劫持与转换（解决 80 端口冲突）
  static applyForceHttps(config: NginxConfig, httpsServerId: string): NginxConfig {
    const httpsServer = config.servers.find((s) => s.id === httpsServerId);
    if (!httpsServer) return config;

    const serverName = httpsServer.serverName;

    // 1) 找到现有 80 Server（端口类型兼容）
    const existingHttp = this.findHttpNode(config, serverName, httpsServerId);

    let nextServers = [...config.servers];
    let nextLocations = [...config.locations];

    if (existingHttp) {
      // 2) 方案 A：劫持旧节点 -> 掏空（Lobotomy）
      console.log('Fixing existing HTTP node:', existingHttp.id);

      // 删除该 server 下属所有 locations（等价断开 edges）
      nextLocations = nextLocations.filter((l) => l.serverId !== existingHttp.id);

      // 改造为纯跳转 server
      nextServers = nextServers.map((s) =>
        s.id === existingHttp.id ? convertToPureRedirectHttpServer(s, serverName) : s
      );

      // 额外保险：如果同域名下已存在多个 80 server，删除其余（防止生成两个 listen 80）
      const redirectId = existingHttp.id;
      const extraHttpServers = nextServers.filter(
        (s) => s.id !== redirectId && String(getPortAsString(s)) === '80' && s.serverName === serverName
      );
      if (extraHttpServers.length > 0) {
        const extraIds = new Set(extraHttpServers.map((s) => s.id));
        nextServers = nextServers.filter((s) => !extraIds.has(s.id));
        nextLocations = nextLocations.filter((l) => !extraIds.has(l.serverId));
      }
    } else {
      // 3) 方案 B：没找到 -> 新建（仅在确实不存在时）
      console.log('Creating new HTTP node');
      const redirectServer: ServerConfig = convertToPureRedirectHttpServer(
        {
          id: uuidv4(),
          name: `${serverName} (HTTP Redirect)`,
          listen: { port: 80, defaultServer: false, http2: false },
          serverName,
          ssl: { ...httpsServer.ssl, enabled: false, forceRedirect: false, protocols: [], ciphers: '', certificate: '', certificateKey: '' },
          root: '',
          index: [],
          customDirectives: '',
        },
        serverName
      );
      nextServers = [...nextServers, redirectServer];
    }

    // 4) 关闭 https server 的 forceRedirect，避免 configGenerator 再额外生成一个 80 block
    nextServers = nextServers.map((s) =>
      s.id === httpsServerId
        ? { ...s, ssl: { ...s.ssl, enabled: true, forceRedirect: false } }
        : s
    );

    return {
      ...config,
      servers: nextServers,
      locations: nextLocations,
    };
  }

  /** 一键修复：只做“清洗 + 重组”，不做字符串 append */
  static applyAllFixes(config: NginxConfig): { config: NginxConfig; warnings: string[] } {
    let current = config;
    const warnings: string[] = [];

    current = this.fixRootUser(current);

    current = this.fixServerTokens(current);

    current = this.fixAutoindex(current);

    current = this.fixSslProtocols(current);

    // 若用户开启了 forceRedirect，则执行“节点劫持”确保只有一个 80 server
    for (const s of current.servers) {
      if (s.ssl.enabled && s.ssl.forceRedirect) {
        current = this.applyForceHttps(current, s.id);
        warnings.push(`已为 ${s.serverName} 执行 80 端口节点劫持（Force HTTPS）`);
      }
    }

    return { config: current, warnings };
  }
}

export default AutoFixService;
