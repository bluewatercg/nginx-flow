/**
 * FixApplicator - 破坏性修复服务类
 * 
 * 实现"先清洗后修复"的逻辑，直接操作 NginxConfig JSON 对象
 * 确保不会产生重复指令或端口冲突
 */

import { v4 as uuidv4 } from 'uuid';
import {
  NginxConfig,
  ServerConfig,
  LocationConfig,
  GlobalConfig,
  HttpConfig,
  createDefaultLocation,
} from '@/types/nginx';

// ============================================================
// 正则库：用于暴力清洗各类指令
// ============================================================

const CLEAN_PATTERNS = {
  // 全局指令
  user: /^\s*user\s+[^;]*;?\s*$/gm,
  worker_processes: /^\s*worker_processes\s+[^;]*;?\s*$/gm,
  error_log: /^\s*error_log\s+[^;]*;?\s*$/gm,
  pid: /^\s*pid\s+[^;]*;?\s*$/gm,
  
  // 安全指令
  autoindex: /^\s*autoindex\s+[^;]*;?\s*$/gm,
  server_tokens: /^\s*server_tokens\s+[^;]*;?\s*$/gm,
  
  // SSL 指令
  ssl_protocols: /^\s*ssl_protocols\s+[^;]*;?\s*$/gm,
  ssl_ciphers: /^\s*ssl_ciphers\s+[^;]*;?\s*$/gm,
  ssl_prefer_server_ciphers: /^\s*ssl_prefer_server_ciphers\s+[^;]*;?\s*$/gm,
  ssl_certificate: /^\s*ssl_certificate\s+[^;]*;?\s*$/gm,
  ssl_certificate_key: /^\s*ssl_certificate_key\s+[^;]*;?\s*$/gm,
  ssl_session_cache: /^\s*ssl_session_cache\s+[^;]*;?\s*$/gm,
  ssl_session_timeout: /^\s*ssl_session_timeout\s+[^;]*;?\s*$/gm,
  
  // HTTP 指令
  sendfile: /^\s*sendfile\s+[^;]*;?\s*$/gm,
  tcp_nopush: /^\s*tcp_nopush\s+[^;]*;?\s*$/gm,
  tcp_nodelay: /^\s*tcp_nodelay\s+[^;]*;?\s*$/gm,
  keepalive_timeout: /^\s*keepalive_timeout\s+[^;]*;?\s*$/gm,
  client_max_body_size: /^\s*client_max_body_size\s+[^;]*;?\s*$/gm,
  
  // Gzip 指令
  gzip: /^\s*gzip\s+[^;]*;?\s*$/gm,
  gzip_comp_level: /^\s*gzip_comp_level\s+[^;]*;?\s*$/gm,
  gzip_min_length: /^\s*gzip_min_length\s+[^;]*;?\s*$/gm,
  gzip_types: /^\s*gzip_types\s+[^;]*;?\s*$/gm,
  
  // Location 指令
  root: /^\s*root\s+[^;]*;?\s*$/gm,
  index: /^\s*index\s+[^;]*;?\s*$/gm,
  try_files: /^\s*try_files\s+[^;]*;?\s*$/gm,
  alias: /^\s*alias\s+[^;]*;?\s*$/gm,
  
  // 返回/重定向
  return: /^\s*return\s+[^;]*;?\s*$/gm,
  rewrite: /^\s*rewrite\s+[^;]*;?\s*$/gm,
} as const;

// add_header 特殊模式
function createAddHeaderPattern(headerName: string): RegExp {
  const escaped = headerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^\\s*add_header\\s+['"]?${escaped}['"]?\\s+[^;]*;?\\s*$`, 'gim');
}

// ============================================================
// 修复类型定义
// ============================================================

export type FixType =
  | 'FIX_ROOT_USER'
  | 'FIX_WORKER_PROCESSES'
  | 'FIX_SERVER_TOKENS'
  | 'FIX_AUTOINDEX'
  | 'FIX_SSL_PROTOCOLS'
  | 'FIX_GZIP'
  | 'FIX_SENDFILE'
  | 'FIX_TCP_NODELAY'
  | 'FIX_KEEPALIVE'
  | 'FIX_HIDDEN_FILES'
  | 'FIX_X_FRAME_OPTIONS'
  | 'FIX_X_CONTENT_TYPE'
  | 'FIX_HSTS'
  | 'FORCE_HTTPS_REDIRECT';

export interface FixResult {
  success: boolean;
  config: NginxConfig;
  message: string;
  warnings: string[];
  removedNodes?: string[];
}

// ============================================================
// FixApplicator 主类
// ============================================================

export class FixApplicator {
  
  /**
   * 暴力清洗：从文本中移除指定指令
   * 使用全局匹配确保移除所有实例
   */
  static cleanDirective(text: string, directive: keyof typeof CLEAN_PATTERNS): string {
    if (!text.trim()) return '';
    
    const pattern = CLEAN_PATTERNS[directive];
    // 重置 lastIndex 防止正则状态问题
    pattern.lastIndex = 0;
    
    return this.formatCleanedText(text.replace(pattern, ''));
  }
  
  /**
   * 批量清洗多个指令
   */
  static cleanDirectives(text: string, directives: (keyof typeof CLEAN_PATTERNS)[]): string {
    let result = text;
    for (const directive of directives) {
      result = this.cleanDirective(result, directive);
    }
    return result;
  }
  
  /**
   * 清洗 add_header 指令
   */
  static cleanAddHeader(text: string, headerName: string): string {
    if (!text.trim()) return '';
    
    const pattern = createAddHeaderPattern(headerName);
    return this.formatCleanedText(text.replace(pattern, ''));
  }
  
  /**
   * 格式化清洗后的文本
   */
  private static formatCleanedText(text: string): string {
    return text
      .split('\n')
      .filter((line, i, arr) => {
        if (line.trim()) return true;
        // 移除连续空行
        return i > 0 && arr[i - 1]?.trim() !== '';
      })
      .join('\n')
      .trim();
  }
  
  // ============================================================
  // 核心修复方法
  // ============================================================
  
  /**
   * 修复 Root User 问题
   * 1. 设置 global.user = 'nginx'
   * 2. 从 customDirectives 中移除所有 user 指令
   */
  static fixRootUser(config: NginxConfig): FixResult {
    const warnings: string[] = [];
    
    // 检查当前是否是 root
    if (config.global.user === 'root') {
      warnings.push('检测到危险的 "user root" 配置，已自动修改为 "nginx"');
    }
    
    // 清洗自定义指令
    const cleanedDirectives = this.cleanDirective(config.global.customDirectives, 'user');
    
    const newConfig: NginxConfig = {
      ...config,
      global: {
        ...config.global,
        user: 'nginx', // 强制设置安全用户
        customDirectives: cleanedDirectives,
      },
    };
    
    return {
      success: true,
      config: newConfig,
      message: '已将运行用户从 root 修改为 nginx',
      warnings,
    };
  }
  
  /**
   * 修复 Worker Processes
   */
  static fixWorkerProcesses(config: NginxConfig): FixResult {
    const cleanedDirectives = this.cleanDirective(config.global.customDirectives, 'worker_processes');
    
    const newConfig: NginxConfig = {
      ...config,
      global: {
        ...config.global,
        workerProcesses: 'auto',
        customDirectives: cleanedDirectives,
      },
    };
    
    return {
      success: true,
      config: newConfig,
      message: '已将 worker_processes 设置为 auto',
      warnings: [],
    };
  }
  
  /**
   * 修复 Server Tokens
   * 1. 设置 http.serverTokens = false
   * 2. 清洗所有相关自定义指令
   */
  static fixServerTokens(config: NginxConfig): FixResult {
    // 清洗 HTTP 级别的自定义指令
    let cleanedHttpDirectives = this.cleanDirective(config.http.customDirectives, 'server_tokens');
    
    // 同时清洗所有 Server 级别的自定义指令
    const cleanedServers = config.servers.map(server => ({
      ...server,
      customDirectives: this.cleanDirective(server.customDirectives, 'server_tokens'),
    }));
    
    const newConfig: NginxConfig = {
      ...config,
      http: {
        ...config.http,
        serverTokens: false,
        customDirectives: cleanedHttpDirectives,
      },
      servers: cleanedServers,
    };
    
    return {
      success: true,
      config: newConfig,
      message: '已关闭 server_tokens，隐藏 Nginx 版本信息',
      warnings: [],
    };
  }
  
  /**
   * 修复 Autoindex (目录列表)
   */
  static fixAutoindex(config: NginxConfig): FixResult {
    const warnings: string[] = [];
    
    // 清洗所有 Server 的自定义指令
    const cleanedServers = config.servers.map(server => {
      const hasAutoindex = /^\s*autoindex\s+on/m.test(server.customDirectives);
      if (hasAutoindex) {
        warnings.push(`服务器 "${server.serverName}" 中移除了 autoindex on`);
      }
      return {
        ...server,
        customDirectives: this.cleanDirective(server.customDirectives, 'autoindex'),
      };
    });
    
    // 清洗所有 Location 的自定义指令
    const cleanedLocations = config.locations.map(location => ({
      ...location,
      customDirectives: this.cleanDirective(location.customDirectives, 'autoindex'),
    }));
    
    const newConfig: NginxConfig = {
      ...config,
      servers: cleanedServers,
      locations: cleanedLocations,
    };
    
    return {
      success: true,
      config: newConfig,
      message: '已移除所有 autoindex 指令',
      warnings,
    };
  }
  
  /**
   * 修复 SSL Protocols - 强制协议升级
   * 不读取旧值，直接覆盖为安全协议
   */
  static fixSSLProtocols(config: NginxConfig, targetServerId?: string): FixResult {
    const secureProtocols = ['TLSv1.2', 'TLSv1.3'];
    const warnings: string[] = [];
    
    const cleanedServers = config.servers.map(server => {
      // 如果指定了目标服务器，只修改该服务器
      if (targetServerId && server.id !== targetServerId) {
        return server;
      }
      
      // 只处理启用了 SSL 的服务器
      if (!server.ssl.enabled) {
        return server;
      }
      
      // 检查是否有旧的不安全协议
      const oldProtocols = server.ssl.protocols;
      const hasInsecure = oldProtocols.some(p => 
        p === 'SSLv2' || p === 'SSLv3' || p === 'TLSv1' || p === 'TLSv1.1'
      );
      
      if (hasInsecure) {
        warnings.push(`服务器 "${server.serverName}" 已升级 SSL 协议，移除不安全的旧协议`);
      }
      
      // 清洗自定义指令中的 ssl_protocols
      const cleanedDirectives = this.cleanDirective(server.customDirectives, 'ssl_protocols');
      
      return {
        ...server,
        ssl: {
          ...server.ssl,
          protocols: secureProtocols, // 强制覆盖
        },
        customDirectives: cleanedDirectives,
      };
    });
    
    const newConfig: NginxConfig = {
      ...config,
      servers: cleanedServers,
    };
    
    return {
      success: true,
      config: newConfig,
      message: '已强制升级 SSL 协议至 TLSv1.2 TLSv1.3',
      warnings,
    };
  }
  
  /**
   * 修复 Gzip 压缩
   */
  static fixGzip(config: NginxConfig): FixResult {
    // 清洗所有 gzip 相关指令
    const cleanedDirectives = this.cleanDirectives(config.http.customDirectives, [
      'gzip', 'gzip_comp_level', 'gzip_min_length', 'gzip_types'
    ]);
    
    const newConfig: NginxConfig = {
      ...config,
      http: {
        ...config.http,
        gzip: {
          enabled: true,
          compLevel: 6,
          minLength: 1024,
          types: [
            'text/plain', 'text/css', 'application/json', 'application/javascript',
            'text/xml', 'application/xml', 'image/svg+xml'
          ],
        },
        customDirectives: cleanedDirectives,
      },
    };
    
    return {
      success: true,
      config: newConfig,
      message: '已启用 Gzip 压缩',
      warnings: [],
    };
  }
  
  /**
   * 修复 Sendfile
   */
  static fixSendfile(config: NginxConfig): FixResult {
    const cleanedDirectives = this.cleanDirective(config.http.customDirectives, 'sendfile');
    
    const newConfig: NginxConfig = {
      ...config,
      http: {
        ...config.http,
        sendfile: true,
        customDirectives: cleanedDirectives,
      },
    };
    
    return {
      success: true,
      config: newConfig,
      message: '已启用 sendfile',
      warnings: [],
    };
  }
  
  /**
   * 修复 TCP Nodelay
   */
  static fixTcpNodelay(config: NginxConfig): FixResult {
    const cleanedDirectives = this.cleanDirective(config.http.customDirectives, 'tcp_nodelay');
    
    const newConfig: NginxConfig = {
      ...config,
      http: {
        ...config.http,
        tcpNodelay: true,
        customDirectives: cleanedDirectives,
      },
    };
    
    return {
      success: true,
      config: newConfig,
      message: '已启用 tcp_nodelay',
      warnings: [],
    };
  }
  
  /**
   * 修复 Keepalive Timeout
   */
  static fixKeepalive(config: NginxConfig): FixResult {
    const cleanedDirectives = this.cleanDirective(config.http.customDirectives, 'keepalive_timeout');
    
    const newConfig: NginxConfig = {
      ...config,
      http: {
        ...config.http,
        keepaliveTimeout: 65,
        customDirectives: cleanedDirectives,
      },
    };
    
    return {
      success: true,
      config: newConfig,
      message: '已将 keepalive_timeout 设置为 65 秒',
      warnings: [],
    };
  }
  
  /**
   * 添加隐藏文件保护
   * 只使用 return 403，不同时使用 deny all（冗余代码优化）
   */
  static fixHiddenFiles(config: NginxConfig, targetServerId: string): FixResult {
    // 检查是否已存在隐藏文件保护规则
    const existingRule = config.locations.find(
      l => l.serverId === targetServerId && (l.path.includes('\\.') || l.path === '~ /\\.')
    );
    
    if (existingRule) {
      return {
        success: true,
        config,
        message: '隐藏文件保护规则已存在',
        warnings: [],
      };
    }
    
    // 创建新的保护规则 - 只用 return 403
    const newLocation: LocationConfig = {
      id: uuidv4(),
      serverId: targetServerId,
      modifier: '~',
      path: '/\\.',
      proxyPass: '',
      upstreamId: null,
      headers: [],
      cors: { enabled: false, allowOrigin: '', allowMethods: [], allowHeaders: [], allowCredentials: false },
      websocket: false,
      alias: '',
      tryFiles: '',
      returnCode: 403,
      returnUrl: '',
      rewrite: null,
      accessControl: { allow: [], deny: [], authBasic: { enabled: false, realm: '', userFile: '' } },
      customDirectives: '# Block access to hidden files (.git, .env, etc.)',
    };
    
    const newConfig: NginxConfig = {
      ...config,
      locations: [...config.locations, newLocation],
    };
    
    return {
      success: true,
      config: newConfig,
      message: '已添加隐藏文件保护规则',
      warnings: [],
    };
  }
  
  /**
   * 添加安全 Header (通用方法)
   */
  private static addSecurityHeader(
    config: NginxConfig, 
    targetServerId: string, 
    headerName: string, 
    headerValue: string
  ): FixResult {
    const server = config.servers.find(s => s.id === targetServerId);
    if (!server) {
      return {
        success: false,
        config,
        message: `找不到目标服务器: ${targetServerId}`,
        warnings: [],
      };
    }
    
    // 检查是否是跳转服务器（不需要安全头）
    if (/^\s*return\s+(301|302|307|308)\s+/m.test(server.customDirectives)) {
      return {
        success: true,
        config,
        message: '跳转服务器不需要安全头',
        warnings: [],
      };
    }
    
    // 先清洗现有的同名 header
    let cleanedDirectives = this.cleanAddHeader(server.customDirectives, headerName);
    
    // 添加新 header
    const newDirective = `add_header ${headerName} "${headerValue}" always;`;
    cleanedDirectives = cleanedDirectives.trim() 
      ? `${cleanedDirectives}\n${newDirective}`
      : newDirective;
    
    const newServers = config.servers.map(s => 
      s.id === targetServerId 
        ? { ...s, customDirectives: cleanedDirectives }
        : s
    );
    
    const newConfig: NginxConfig = {
      ...config,
      servers: newServers,
    };
    
    return {
      success: true,
      config: newConfig,
      message: `已添加 ${headerName} 安全头`,
      warnings: [],
    };
  }
  
  /**
   * 修复 X-Frame-Options
   */
  static fixXFrameOptions(config: NginxConfig, targetServerId: string): FixResult {
    return this.addSecurityHeader(config, targetServerId, 'X-Frame-Options', 'SAMEORIGIN');
  }
  
  /**
   * 修复 X-Content-Type-Options
   */
  static fixXContentType(config: NginxConfig, targetServerId: string): FixResult {
    return this.addSecurityHeader(config, targetServerId, 'X-Content-Type-Options', 'nosniff');
  }
  
  /**
   * 修复 HSTS
   */
  static fixHSTS(config: NginxConfig, targetServerId: string): FixResult {
    return this.addSecurityHeader(
      config, 
      targetServerId, 
      'Strict-Transport-Security', 
      'max-age=31536000; includeSubDomains'
    );
  }
  
  // ============================================================
  // 端口冲突处理 - 智能 Server 合并
  // ============================================================
  
  /**
   * 强制 HTTPS 跳转 - 处理端口 80 冲突
   * 
   * 方案 A (优先): 如果存在同 serverName 的 80 端口服务器，直接改造它
   * 方案 B: 如果不存在，创建新的跳转服务器
   */
  static forceHttpsRedirect(config: NginxConfig, targetServerId: string): FixResult {
    const targetServer = config.servers.find(s => s.id === targetServerId);
    if (!targetServer) {
      return {
        success: false,
        config,
        message: '找不到目标服务器',
        warnings: [],
      };
    }
    
    const serverName = targetServer.serverName;
    const warnings: string[] = [];
    const removedNodes: string[] = [];
    
    // 查找现有的 80 端口同名服务器
    const existingHttpServer = config.servers.find(s => 
      s.id !== targetServerId &&
      s.listen.port === 80 && 
      s.serverName === serverName
    );
    
    let newServers: ServerConfig[];
    let newLocations = [...config.locations];
    
    if (existingHttpServer) {
      // ========== 方案 A: 改造现有服务器 ==========
      warnings.push(`已将现有的 ${serverName}:80 服务器改造为 HTTPS 跳转服务器`);
      
      // 移除该服务器下的所有 Location
      const locationsToRemove = config.locations.filter(l => l.serverId === existingHttpServer.id);
      removedNodes.push(...locationsToRemove.map(l => l.id));
      newLocations = config.locations.filter(l => l.serverId !== existingHttpServer.id);
      
      // 改造服务器配置
      const convertedServer: ServerConfig = {
        ...existingHttpServer,
        name: `${serverName} (HTTPS Redirect)`,
        root: '', // 清空 root
        index: [], // 清空 index
        ssl: {
          ...existingHttpServer.ssl,
          enabled: false, // 80 端口不需要 SSL
          forceRedirect: false,
        },
        customDirectives: `# HTTPS redirect - auto generated\nreturn 301 https://$host$request_uri;`,
      };
      
      newServers = config.servers.map(s => 
        s.id === existingHttpServer.id ? convertedServer : s
      );
    } else {
      // ========== 方案 B: 创建新的跳转服务器 ==========
      const redirectServer: ServerConfig = {
        id: uuidv4(),
        name: `${serverName} (HTTPS Redirect)`,
        listen: {
          port: 80,
          defaultServer: false,
          http2: false,
        },
        serverName: serverName,
        ssl: {
          enabled: false,
          certificate: '',
          certificateKey: '',
          protocols: [],
          ciphers: '',
          forceRedirect: false,
        },
        root: '',
        index: [],
        customDirectives: `# HTTPS redirect - auto generated\nreturn 301 https://$host$request_uri;`,
      };
      
      newServers = [...config.servers, redirectServer];
      warnings.push(`已为 ${serverName} 创建 HTTPS 跳转服务器`);
    }
    
    // 确保目标服务器启用了 SSL
    newServers = newServers.map(s => {
      if (s.id === targetServerId) {
        return {
          ...s,
          ssl: {
            ...s.ssl,
            enabled: true,
            forceRedirect: false, // 我们已经手动创建了跳转服务器
          },
        };
      }
      return s;
    });
    
    const newConfig: NginxConfig = {
      ...config,
      servers: newServers,
      locations: newLocations,
    };
    
    return {
      success: true,
      config: newConfig,
      message: '已配置强制 HTTPS 跳转',
      warnings,
      removedNodes,
    };
  }
  
  // ============================================================
  // 统一修复入口
  // ============================================================
  
  /**
   * 执行修复
   * @param config 当前配置
   * @param fixType 修复类型
   * @param targetNodeId 目标节点 ID（可选）
   */
  static executeFix(config: NginxConfig, fixType: FixType, targetNodeId?: string): FixResult {
    switch (fixType) {
      case 'FIX_ROOT_USER':
        return this.fixRootUser(config);
      
      case 'FIX_WORKER_PROCESSES':
        return this.fixWorkerProcesses(config);
      
      case 'FIX_SERVER_TOKENS':
        return this.fixServerTokens(config);
      
      case 'FIX_AUTOINDEX':
        return this.fixAutoindex(config);
      
      case 'FIX_SSL_PROTOCOLS':
        return this.fixSSLProtocols(config, targetNodeId);
      
      case 'FIX_GZIP':
        return this.fixGzip(config);
      
      case 'FIX_SENDFILE':
        return this.fixSendfile(config);
      
      case 'FIX_TCP_NODELAY':
        return this.fixTcpNodelay(config);
      
      case 'FIX_KEEPALIVE':
        return this.fixKeepalive(config);
      
      case 'FIX_HIDDEN_FILES':
        if (!targetNodeId) {
          return { success: false, config, message: '需要指定目标服务器', warnings: [] };
        }
        return this.fixHiddenFiles(config, targetNodeId);
      
      case 'FIX_X_FRAME_OPTIONS':
        if (!targetNodeId) {
          return { success: false, config, message: '需要指定目标服务器', warnings: [] };
        }
        return this.fixXFrameOptions(config, targetNodeId);
      
      case 'FIX_X_CONTENT_TYPE':
        if (!targetNodeId) {
          return { success: false, config, message: '需要指定目标服务器', warnings: [] };
        }
        return this.fixXContentType(config, targetNodeId);
      
      case 'FIX_HSTS':
        if (!targetNodeId) {
          return { success: false, config, message: '需要指定目标服务器', warnings: [] };
        }
        return this.fixHSTS(config, targetNodeId);
      
      case 'FORCE_HTTPS_REDIRECT':
        if (!targetNodeId) {
          return { success: false, config, message: '需要指定目标服务器', warnings: [] };
        }
        return this.forceHttpsRedirect(config, targetNodeId);
      
      default:
        return { success: false, config, message: `未知的修复类型: ${fixType}`, warnings: [] };
    }
  }
  
  /**
   * 批量执行修复
   */
  static executeMultipleFixes(
    config: NginxConfig, 
    fixes: Array<{ type: FixType; targetNodeId?: string }>
  ): FixResult {
    let currentConfig = config;
    const allWarnings: string[] = [];
    const allRemovedNodes: string[] = [];
    const messages: string[] = [];
    
    for (const fix of fixes) {
      const result = this.executeFix(currentConfig, fix.type, fix.targetNodeId);
      
      if (!result.success) {
        return {
          success: false,
          config: currentConfig,
          message: `修复失败: ${result.message}`,
          warnings: allWarnings,
          removedNodes: allRemovedNodes,
        };
      }
      
      currentConfig = result.config;
      allWarnings.push(...result.warnings);
      messages.push(result.message);
      
      if (result.removedNodes) {
        allRemovedNodes.push(...result.removedNodes);
      }
    }
    
    return {
      success: true,
      config: currentConfig,
      message: `已完成 ${fixes.length} 项修复`,
      warnings: allWarnings,
      removedNodes: allRemovedNodes,
    };
  }
}

export default FixApplicator;
