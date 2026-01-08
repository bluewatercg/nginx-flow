/**
 * ConfigCleaner - Nginx 配置清洗工具类
 * 
 * 实现 4 大清洗规则：
 * 1. 强力清洗旧配置 (Aggressive Cleaning)
 * 2. 智能 Server 合并 (Smart Server Merging)  
 * 3. 协议升级 (Protocol Upgrade)
 * 4. 冗余代码优化
 */

import { ServerConfig, NginxConfig } from '@/types/nginx';

// ============================================================
// 正则库：用于移除各类指令
// ============================================================

const DIRECTIVE_PATTERNS: Record<string, RegExp> = {
  // 全局指令
  user: /^\s*user\s+[^;]+;?\s*$/gm,
  worker_processes: /^\s*worker_processes\s+[^;]+;?\s*$/gm,
  error_log: /^\s*error_log\s+[^;]+;?\s*$/gm,
  pid: /^\s*pid\s+[^;]+;?\s*$/gm,
  
  // 安全相关
  autoindex: /^\s*autoindex\s+[^;]+;?\s*$/gm,
  server_tokens: /^\s*server_tokens\s+[^;]+;?\s*$/gm,
  
  // SSL 相关
  ssl_protocols: /^\s*ssl_protocols\s+[^;]+;?\s*$/gm,
  ssl_ciphers: /^\s*ssl_ciphers\s+[^;]+;?\s*$/gm,
  ssl_prefer_server_ciphers: /^\s*ssl_prefer_server_ciphers\s+[^;]+;?\s*$/gm,
  ssl_certificate: /^\s*ssl_certificate\s+[^;]+;?\s*$/gm,
  ssl_certificate_key: /^\s*ssl_certificate_key\s+[^;]+;?\s*$/gm,
  
  // HTTP 相关
  sendfile: /^\s*sendfile\s+[^;]+;?\s*$/gm,
  tcp_nopush: /^\s*tcp_nopush\s+[^;]+;?\s*$/gm,
  tcp_nodelay: /^\s*tcp_nodelay\s+[^;]+;?\s*$/gm,
  keepalive_timeout: /^\s*keepalive_timeout\s+[^;]+;?\s*$/gm,
  client_max_body_size: /^\s*client_max_body_size\s+[^;]+;?\s*$/gm,
  
  // Gzip 相关
  gzip: /^\s*gzip\s+[^;]+;?\s*$/gm,
  gzip_comp_level: /^\s*gzip_comp_level\s+[^;]+;?\s*$/gm,
  gzip_min_length: /^\s*gzip_min_length\s+[^;]+;?\s*$/gm,
  gzip_types: /^\s*gzip_types\s+[^;]+;?\s*$/gm,
  
  // Location 相关
  root: /^\s*root\s+[^;]+;?\s*$/gm,
  index: /^\s*index\s+[^;]+;?\s*$/gm,
  try_files: /^\s*try_files\s+[^;]+;?\s*$/gm,
  alias: /^\s*alias\s+[^;]+;?\s*$/gm,
  
  // 代理相关
  proxy_pass: /^\s*proxy_pass\s+[^;]+;?\s*$/gm,
  proxy_http_version: /^\s*proxy_http_version\s+[^;]+;?\s*$/gm,
  
  // 返回/重写
  return: /^\s*return\s+[^;]+;?\s*$/gm,
  rewrite: /^\s*rewrite\s+[^;]+;?\s*$/gm,
};

// 特殊的 add_header 模式 - 需要匹配 header 名称
function createAddHeaderPattern(headerName: string): RegExp {
  // 匹配 add_header X-Frame-Options ... 或 add_header 'X-Frame-Options' ...
  return new RegExp(`^\\s*add_header\\s+['"]?${escapeRegex(headerName)}['"]?\\s+[^;]+;?\\s*$`, 'gim');
}

// 特殊的 proxy_set_header 模式
function createProxySetHeaderPattern(headerName: string): RegExp {
  return new RegExp(`^\\s*proxy_set_header\\s+${escapeRegex(headerName)}\\s+[^;]+;?\\s*$`, 'gim');
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================
// ConfigCleaner 类
// ============================================================

export class ConfigCleaner {
  
  /**
   * 移除指定指令 - 核心清洗方法
   * 
   * @param text - 原始自定义指令文本
   * @param directiveName - 要移除的指令名（如 'ssl_protocols', 'server_tokens'）
   * @returns 清洗后的文本
   */
  static removeDirective(text: string, directiveName: string): string {
    if (!text.trim()) return '';
    
    // 检查是否是 add_header 特殊格式
    if (directiveName.startsWith('add_header ')) {
      const headerName = directiveName.replace('add_header ', '').trim();
      const pattern = createAddHeaderPattern(headerName);
      return this.cleanAndFormat(text.replace(pattern, ''));
    }
    
    // 检查是否是 proxy_set_header 特殊格式
    if (directiveName.startsWith('proxy_set_header ')) {
      const headerName = directiveName.replace('proxy_set_header ', '').trim();
      const pattern = createProxySetHeaderPattern(headerName);
      return this.cleanAndFormat(text.replace(pattern, ''));
    }
    
    // 使用预定义的正则库
    const pattern = DIRECTIVE_PATTERNS[directiveName];
    if (pattern) {
      // 重置正则的 lastIndex
      pattern.lastIndex = 0;
      return this.cleanAndFormat(text.replace(pattern, ''));
    }
    
    // 通用正则：匹配 directiveName 后跟空白和值
    const genericPattern = new RegExp(`^\\s*${escapeRegex(directiveName)}\\s+[^;]+;?\\s*$`, 'gim');
    return this.cleanAndFormat(text.replace(genericPattern, ''));
  }
  
  /**
   * 批量移除多个指令
   */
  static removeDirectives(text: string, directiveNames: string[]): string {
    let result = text;
    for (const name of directiveNames) {
      result = this.removeDirective(result, name);
    }
    return result;
  }
  
  /**
   * 清理并格式化文本
   * - 移除多余空行
   * - 移除行首行尾空白
   */
  private static cleanAndFormat(text: string): string {
    return text
      .split('\n')
      .filter((line, index, arr) => {
        // 保留非空行
        if (line.trim()) return true;
        // 保留单个空行（不是连续空行）
        if (index === 0) return false;
        return arr[index - 1]?.trim() !== '';
      })
      .join('\n')
      .trim();
  }
  
  /**
   * 修复 user root 安全问题
   * 
   * @param globalCustomDirectives - 全局自定义指令
   * @returns 新指令和警告信息
   */
  static fixRootUser(globalCustomDirectives: string): { newDirectives: string; warning: string } {
    // 检查自定义指令中是否有 user root
    const rootUserPattern = /^\s*user\s+root\s*;?\s*$/gm;
    const hasRootUser = rootUserPattern.test(globalCustomDirectives);
    
    if (!hasRootUser) {
      return { 
        newDirectives: globalCustomDirectives, 
        warning: '' 
      };
    }
    
    // 移除 user root 指令
    const cleaned = this.removeDirective(globalCustomDirectives, 'user');
    
    return {
      newDirectives: cleaned,
      warning: '已移除危险的 "user root" 配置，建议使用 "nginx" 或 "www-data" 用户运行 Nginx。'
    };
  }
  
  /**
   * 智能合并重复的 Server
   * 检测并合并监听相同端口和 server_name 的 Server
   * 
   * @param servers - 服务器列表
   * @returns 合并后的服务器列表和操作日志
   */
  static mergeDuplicateServers(servers: ServerConfig[]): {
    servers: ServerConfig[];
    merged: Array<{ from: string; to: string; reason: string }>;
    conflicts: Array<{ serverName: string; port: number; reason: string }>;
  } {
    const merged: Array<{ from: string; to: string; reason: string }> = [];
    const conflicts: Array<{ serverName: string; port: number; reason: string }> = [];
    
    // 按 port + serverName 分组
    const serverMap = new Map<string, ServerConfig[]>();
    
    for (const server of servers) {
      const key = `${server.listen.port}:${server.serverName}`;
      if (!serverMap.has(key)) {
        serverMap.set(key, []);
      }
      serverMap.get(key)!.push(server);
    }
    
    const resultServers: ServerConfig[] = [];
    
    for (const [key, group] of serverMap) {
      if (group.length === 1) {
        // 无重复
        resultServers.push(group[0]);
        continue;
      }
      
      // 有重复 - 尝试合并
      const [port, serverName] = key.split(':');
      
      // 检查是否有一个是跳转服务器
      const redirectServer = group.find(s => this.isRedirectServer(s));
      const normalServers = group.filter(s => !this.isRedirectServer(s));
      
      if (redirectServer && normalServers.length === 0) {
        // 全是跳转服务器 - 保留第一个
        resultServers.push(redirectServer);
        for (let i = 1; i < group.length; i++) {
          merged.push({
            from: group[i].id,
            to: redirectServer.id,
            reason: `合并重复的跳转服务器 (${serverName}:${port})`
          });
        }
      } else if (redirectServer && normalServers.length > 0) {
        // 跳转服务器与正常服务器冲突
        // 方案 A: 将跳转服务器转换（删除），保留正常服务器
        for (const normal of normalServers) {
          resultServers.push(normal);
        }
        merged.push({
          from: redirectServer.id,
          to: normalServers[0].id,
          reason: `跳转服务器与正常服务器冲突，保留正常服务器 (${serverName}:${port})`
        });
      } else {
        // 全是正常服务器 - 报告冲突
        resultServers.push(group[0]);
        for (let i = 1; i < group.length; i++) {
          conflicts.push({
            serverName,
            port: parseInt(port),
            reason: `存在多个监听 ${port} 端口的服务器 "${serverName}"，请手动合并`
          });
        }
      }
    }
    
    return { servers: resultServers, merged, conflicts };
  }
  
  /**
   * 检测 Server 是否为跳转服务器
   */
  private static isRedirectServer(server: ServerConfig): boolean {
    const redirectPattern = /^\s*return\s+(301|302|307|308)\s+/m;
    return redirectPattern.test(server.customDirectives);
  }
  
  /**
   * 强制升级 SSL 协议到安全版本
   * 不读取旧值，直接覆盖
   */
  static forceUpgradeSSLProtocols(): string[] {
    return ['TLSv1.2', 'TLSv1.3'];
  }
  
  /**
   * 清理隐藏文件保护规则的冗余
   * 只保留 deny all 或 return 403，不同时存在
   */
  static cleanHiddenFileProtection(customDirectives: string): string {
    // 检查是否同时存在 deny all 和 return 403
    const hasDenyAll = /^\s*deny\s+all\s*;?\s*$/m.test(customDirectives);
    const hasReturn403 = /^\s*return\s+403\s*;?\s*$/m.test(customDirectives);
    
    if (hasDenyAll && hasReturn403) {
      // 移除 deny all，保留 return 403（性能稍好）
      return this.removeDirective(customDirectives, 'deny');
    }
    
    return customDirectives;
  }
  
  /**
   * 智能添加指令：先清理再添加
   * 防止重复添加相同指令
   */
  static smartAddDirective(existingText: string, newDirective: string, directiveName: string): string {
    // 先移除现有的同名指令
    const cleaned = this.removeDirective(existingText, directiveName);
    
    // 添加新指令
    if (cleaned.trim()) {
      return `${cleaned}\n${newDirective}`;
    }
    return newDirective;
  }
  
  /**
   * 智能添加 add_header
   */
  static smartAddHeader(existingText: string, headerName: string, headerValue: string, always: boolean = true): string {
    const alwaysSuffix = always ? ' always' : '';
    const newDirective = `add_header ${headerName} "${headerValue}"${alwaysSuffix};`;
    return this.smartAddDirective(existingText, newDirective, `add_header ${headerName}`);
  }
  
  /**
   * 批量清理配置 - 用于一键修复前的预处理
   */
  static preCleanConfig(config: NginxConfig): {
    config: NginxConfig;
    warnings: string[];
  } {
    const warnings: string[] = [];
    let newConfig = { ...config };
    
    // 1. 检查并修复 user root
    const rootFix = this.fixRootUser(config.global.customDirectives);
    if (rootFix.warning) {
      warnings.push(rootFix.warning);
      newConfig = {
        ...newConfig,
        global: {
          ...newConfig.global,
          customDirectives: rootFix.newDirectives
        }
      };
    }
    
    // 2. 合并重复服务器
    const mergeResult = this.mergeDuplicateServers(config.servers);
    if (mergeResult.merged.length > 0 || mergeResult.conflicts.length > 0) {
      newConfig = {
        ...newConfig,
        servers: mergeResult.servers
      };
      
      for (const m of mergeResult.merged) {
        warnings.push(m.reason);
      }
      for (const c of mergeResult.conflicts) {
        warnings.push(c.reason);
      }
    }
    
    // 3. 清理每个服务器的自定义指令中的危险配置
    const cleanedServers = newConfig.servers.map(server => {
      let customDirectives = server.customDirectives;
      
      // 移除 autoindex on
      if (/^\s*autoindex\s+on\s*;?\s*$/m.test(customDirectives)) {
        customDirectives = this.removeDirective(customDirectives, 'autoindex');
        warnings.push(`服务器 "${server.serverName}" 已移除 autoindex on（目录列表可能泄露敏感信息）`);
      }
      
      return { ...server, customDirectives };
    });
    
    newConfig = { ...newConfig, servers: cleanedServers };
    
    return { config: newConfig, warnings };
  }
}

export default ConfigCleaner;
