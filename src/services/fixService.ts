/**
 * FixService - 破坏性修复服务
 * 
 * 核心算法：
 * 1. 暴力字符串清洗 (The Regex Cleaner) - 在修改前先清洗旧配置
 * 2. 节点劫持与转换 (Node Hijacking) - 直接改造旧节点而非创建新节点
 */

import { v4 as uuidv4 } from 'uuid';
import { NginxConfig, ServerConfig, LocationConfig } from '@/types/nginx';

// ============================================================
// 算法 1：暴力字符串清洗 (The Regex Cleaner)
// ============================================================

/**
 * 从配置文本中彻底移除指定的指令
 * 使用全局多行匹配确保所有实例都被移除
 */
export const cleanDirectives = (configText: string, targets: string[]): string => {
  if (!configText || !configText.trim()) return '';
  
  let newText = configText;
  
  if (targets.includes('user')) {
    // 移除 user root; 或 user nginx; 等
    newText = newText.replace(/^\s*user\s+.*?;(\r?\n)?/gm, '');
  }
  
  if (targets.includes('worker_processes')) {
    newText = newText.replace(/^\s*worker_processes\s+.*?;(\r?\n)?/gm, '');
  }
  
  if (targets.includes('server_tokens')) {
    // 移除 server_tokens on/off;
    newText = newText.replace(/^\s*server_tokens\s+.*?;(\r?\n)?/gm, '');
  }
  
  if (targets.includes('ssl_protocols')) {
    // 移除 ssl_protocols ...;
    newText = newText.replace(/^\s*ssl_protocols\s+.*?;(\r?\n)?/gm, '');
  }
  
  if (targets.includes('ssl_ciphers')) {
    newText = newText.replace(/^\s*ssl_ciphers\s+.*?;(\r?\n)?/gm, '');
  }
  
  if (targets.includes('ssl_prefer_server_ciphers')) {
    newText = newText.replace(/^\s*ssl_prefer_server_ciphers\s+.*?;(\r?\n)?/gm, '');
  }
  
  if (targets.includes('autoindex')) {
    // 移除 autoindex on/off;
    newText = newText.replace(/^\s*autoindex\s+.*?;(\r?\n)?/gm, '');
  }
  
  if (targets.includes('sendfile')) {
    newText = newText.replace(/^\s*sendfile\s+.*?;(\r?\n)?/gm, '');
  }
  
  if (targets.includes('tcp_nodelay')) {
    newText = newText.replace(/^\s*tcp_nodelay\s+.*?;(\r?\n)?/gm, '');
  }
  
  if (targets.includes('tcp_nopush')) {
    newText = newText.replace(/^\s*tcp_nopush\s+.*?;(\r?\n)?/gm, '');
  }
  
  if (targets.includes('keepalive_timeout')) {
    newText = newText.replace(/^\s*keepalive_timeout\s+.*?;(\r?\n)?/gm, '');
  }
  
  if (targets.includes('gzip')) {
    newText = newText.replace(/^\s*gzip\s+.*?;(\r?\n)?/gm, '');
    newText = newText.replace(/^\s*gzip_comp_level\s+.*?;(\r?\n)?/gm, '');
    newText = newText.replace(/^\s*gzip_min_length\s+.*?;(\r?\n)?/gm, '');
    newText = newText.replace(/^\s*gzip_types\s+.*?;(\r?\n)?/gm, '');
  }
  
  if (targets.includes('root')) {
    newText = newText.replace(/^\s*root\s+.*?;(\r?\n)?/gm, '');
  }
  
  if (targets.includes('index')) {
    newText = newText.replace(/^\s*index\s+.*?;(\r?\n)?/gm, '');
  }
  
  if (targets.includes('try_files')) {
    newText = newText.replace(/^\s*try_files\s+.*?;(\r?\n)?/gm, '');
  }
  
  if (targets.includes('return')) {
    newText = newText.replace(/^\s*return\s+.*?;(\r?\n)?/gm, '');
  }
  
  // 清理 add_header 系列
  if (targets.includes('add_header X-Frame-Options')) {
    newText = newText.replace(/^\s*add_header\s+['"]?X-Frame-Options['"]?\s+.*?;(\r?\n)?/gim, '');
  }
  
  if (targets.includes('add_header X-Content-Type-Options')) {
    newText = newText.replace(/^\s*add_header\s+['"]?X-Content-Type-Options['"]?\s+.*?;(\r?\n)?/gim, '');
  }
  
  if (targets.includes('add_header Strict-Transport-Security')) {
    newText = newText.replace(/^\s*add_header\s+['"]?Strict-Transport-Security['"]?\s+.*?;(\r?\n)?/gim, '');
  }
  
  // 清理多余的空行
  newText = newText.replace(/\n{3,}/g, '\n\n').trim();
  
  return newText;
};

/**
 * 清洗所有危险/冲突指令
 */
export const cleanAllDangerousDirectives = (text: string): string => {
  return cleanDirectives(text, [
    'user', 'autoindex', 'server_tokens', 'root', 'index', 'try_files', 'return'
  ]);
};

// ============================================================
// 算法 2：节点劫持与转换 (Node Hijacking)
// ============================================================

export interface FixResult {
  success: boolean;
  config: NginxConfig;
  message: string;
  warnings: string[];
  removedLocationIds: string[];
}

/**
 * 检查服务器是否为纯跳转服务器
 */
const isRedirectOnlyServer = (server: ServerConfig): boolean => {
  return /^\s*return\s+(301|302|307|308)\s+/m.test(server.customDirectives);
};

/**
 * 将一个普通 Server 转换为纯净的 HTTPS 跳转 Server
 * "脑叶切除手术" - 清空所有内容，只保留跳转逻辑
 */
const convertToRedirectServer = (server: ServerConfig, targetUrl: string): ServerConfig => {
  return {
    ...server,
    name: `${server.serverName} (HTTPS Redirect)`,
    listen: {
      port: 80,
      defaultServer: false,
      http2: false,
    },
    // 清空 SSL（80 端口不需要）
    ssl: {
      enabled: false,
      certificate: '',
      certificateKey: '',
      protocols: [],
      ciphers: '',
      forceRedirect: false,
    },
    // 彻底清空这些字段
    root: '',
    index: [],
    // 只保留跳转指令
    customDirectives: `# Auto-generated HTTPS redirect\nreturn 301 ${targetUrl};`,
  };
};

// ============================================================
// FixService 主类
// ============================================================

export class FixService {
  
  /**
   * 修复 Root User - 彻底消除 user root
   */
  static fixRootUser(config: NginxConfig): FixResult {
    // Step 1: 暴力清洗 customDirectives 中的 user 指令
    const cleanedDirectives = cleanDirectives(config.global.customDirectives, ['user']);
    
    // Step 2: 强制设置 UI 状态
    const newConfig: NginxConfig = {
      ...config,
      global: {
        ...config.global,
        user: 'nginx', // 强制覆盖
        customDirectives: cleanedDirectives,
      },
    };
    
    return {
      success: true,
      config: newConfig,
      message: '已将 user 从 root 修改为 nginx',
      warnings: config.global.user === 'root' ? ['检测并移除了危险的 user root 配置'] : [],
      removedLocationIds: [],
    };
  }
  
  /**
   * 修复 Worker Processes
   */
  static fixWorkerProcesses(config: NginxConfig): FixResult {
    const cleanedDirectives = cleanDirectives(config.global.customDirectives, ['worker_processes']);
    
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
      removedLocationIds: [],
    };
  }
  
  /**
   * 修复 Server Tokens - 在所有层级清洗
   */
  static fixServerTokens(config: NginxConfig): FixResult {
    // 清洗 HTTP 层级
    const cleanedHttpDirectives = cleanDirectives(config.http.customDirectives, ['server_tokens']);
    
    // 清洗所有 Server 层级
    const cleanedServers = config.servers.map(server => ({
      ...server,
      customDirectives: cleanDirectives(server.customDirectives, ['server_tokens']),
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
      message: '已关闭 server_tokens',
      warnings: [],
      removedLocationIds: [],
    };
  }
  
  /**
   * 修复 Autoindex - 在所有层级移除
   */
  static fixAutoindex(config: NginxConfig): FixResult {
    const warnings: string[] = [];
    
    const cleanedServers = config.servers.map(server => {
      if (/autoindex\s+on/i.test(server.customDirectives)) {
        warnings.push(`服务器 ${server.serverName} 中移除了 autoindex on`);
      }
      return {
        ...server,
        customDirectives: cleanDirectives(server.customDirectives, ['autoindex']),
      };
    });
    
    const cleanedLocations = config.locations.map(location => ({
      ...location,
      customDirectives: cleanDirectives(location.customDirectives, ['autoindex']),
    }));
    
    const newConfig: NginxConfig = {
      ...config,
      servers: cleanedServers,
      locations: cleanedLocations,
    };
    
    return {
      success: true,
      config: newConfig,
      message: '已移除所有 autoindex 配置',
      warnings,
      removedLocationIds: [],
    };
  }
  
  /**
   * 修复 SSL Protocols - 强制升级，不读取旧值
   */
  static fixSSLProtocols(config: NginxConfig, targetServerId?: string): FixResult {
    const SECURE_PROTOCOLS = ['TLSv1.2', 'TLSv1.3'];
    const warnings: string[] = [];
    
    const cleanedServers = config.servers.map(server => {
      // 如果指定了目标，只处理目标服务器
      if (targetServerId && server.id !== targetServerId) return server;
      
      // 只处理 SSL 服务器
      if (!server.ssl.enabled) return server;
      
      // 检查是否有不安全协议
      const hasInsecure = server.ssl.protocols.some(p => 
        ['SSLv2', 'SSLv3', 'TLSv1', 'TLSv1.1'].includes(p)
      );
      
      if (hasInsecure) {
        warnings.push(`服务器 ${server.serverName} 已移除不安全的 SSL 协议`);
      }
      
      // 清洗 customDirectives 中的 ssl_protocols
      const cleanedDirectives = cleanDirectives(server.customDirectives, ['ssl_protocols']);
      
      return {
        ...server,
        ssl: {
          ...server.ssl,
          protocols: SECURE_PROTOCOLS, // 强制覆盖
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
      message: '已升级 SSL 协议至 TLSv1.2/TLSv1.3',
      warnings,
      removedLocationIds: [],
    };
  }
  
  /**
   * 修复 Gzip
   */
  static fixGzip(config: NginxConfig): FixResult {
    const cleanedDirectives = cleanDirectives(config.http.customDirectives, ['gzip']);
    
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
      removedLocationIds: [],
    };
  }
  
  /**
   * 修复 Sendfile
   */
  static fixSendfile(config: NginxConfig): FixResult {
    const cleanedDirectives = cleanDirectives(config.http.customDirectives, ['sendfile']);
    
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
      removedLocationIds: [],
    };
  }
  
  /**
   * 修复 TCP Nodelay
   */
  static fixTcpNodelay(config: NginxConfig): FixResult {
    const cleanedDirectives = cleanDirectives(config.http.customDirectives, ['tcp_nodelay']);
    
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
      removedLocationIds: [],
    };
  }
  
  /**
   * 修复 Keepalive Timeout
   */
  static fixKeepalive(config: NginxConfig): FixResult {
    const cleanedDirectives = cleanDirectives(config.http.customDirectives, ['keepalive_timeout']);
    
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
      message: '已将 keepalive_timeout 设置为 65s',
      warnings: [],
      removedLocationIds: [],
    };
  }
  
  /**
   * 添加隐藏文件保护
   * 只使用 return 403，不使用 deny all（避免冗余）
   */
  static fixHiddenFiles(config: NginxConfig, targetServerId: string): FixResult {
    // 检查是否已存在
    const existingRule = config.locations.find(
      l => l.serverId === targetServerId && l.path.includes('\\.')
    );
    
    if (existingRule) {
      return {
        success: true,
        config,
        message: '隐藏文件保护规则已存在',
        warnings: [],
        removedLocationIds: [],
      };
    }
    
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
      returnCode: 403, // 只用 return 403
      returnUrl: '',
      rewrite: null,
      accessControl: { allow: [], deny: [], authBasic: { enabled: false, realm: '', userFile: '' } },
      customDirectives: '# Block hidden files',
    };
    
    const newConfig: NginxConfig = {
      ...config,
      locations: [...config.locations, newLocation],
    };
    
    return {
      success: true,
      config: newConfig,
      message: '已添加隐藏文件保护',
      warnings: [],
      removedLocationIds: [],
    };
  }
  
  /**
   * 添加安全 Header
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
        message: '找不到目标服务器',
        warnings: [],
        removedLocationIds: [],
      };
    }
    
    // 跳转服务器不需要安全头
    if (isRedirectOnlyServer(server)) {
      return {
        success: true,
        config,
        message: '跳转服务器不需要安全头',
        warnings: [],
        removedLocationIds: [],
      };
    }
    
    // 先清洗现有的同名 header
    const cleanKey = `add_header ${headerName}`;
    let cleanedDirectives = cleanDirectives(server.customDirectives, [cleanKey]);
    
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
      message: `已添加 ${headerName}`,
      warnings: [],
      removedLocationIds: [],
    };
  }
  
  static fixXFrameOptions(config: NginxConfig, targetServerId: string): FixResult {
    return this.addSecurityHeader(config, targetServerId, 'X-Frame-Options', 'SAMEORIGIN');
  }
  
  static fixXContentType(config: NginxConfig, targetServerId: string): FixResult {
    return this.addSecurityHeader(config, targetServerId, 'X-Content-Type-Options', 'nosniff');
  }
  
  static fixHSTS(config: NginxConfig, targetServerId: string): FixResult {
    return this.addSecurityHeader(config, targetServerId, 'Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  // ============================================================
  // 核心：强制 HTTPS 跳转（节点劫持）
  // ============================================================
  
  /**
   * 强制 HTTPS 跳转 - 使用节点劫持算法
   * 
   * CASE A: 如果存在同 serverName 的 80 端口服务器 -> 劫持并转换
   * CASE B: 如果不存在 -> 创建新的跳转服务器
   */
  static forceHttpsRedirect(config: NginxConfig, targetServerId: string): FixResult {
    const targetServer = config.servers.find(s => s.id === targetServerId);
    if (!targetServer) {
      return {
        success: false,
        config,
        message: '找不到目标 HTTPS 服务器',
        warnings: [],
        removedLocationIds: [],
      };
    }
    
    const serverName = targetServer.serverName;
    const warnings: string[] = [];
    const removedLocationIds: string[] = [];
    
    // 查找现有的 80 端口同名服务器
    const existingHttpServer = config.servers.find(s =>
      s.id !== targetServerId &&
      s.listen.port === 80 &&
      s.serverName === serverName
    );
    
    let newServers: ServerConfig[];
    let newLocations = [...config.locations];
    
    if (existingHttpServer) {
      // ========== CASE A: 节点劫持 ==========
      warnings.push(`已劫持现有的 ${serverName}:80 服务器，转换为 HTTPS 跳转`);
      
      // 1. 移除该服务器下的所有 Locations（断开连线）
      const locationsToRemove = config.locations.filter(l => l.serverId === existingHttpServer.id);
      removedLocationIds.push(...locationsToRemove.map(l => l.id));
      newLocations = config.locations.filter(l => l.serverId !== existingHttpServer.id);
      
      // 2. 执行"脑叶切除手术"- 转换为纯净的跳转服务器
      const hijackedServer = convertToRedirectServer(existingHttpServer, 'https://$host$request_uri');
      
      newServers = config.servers.map(s =>
        s.id === existingHttpServer.id ? hijackedServer : s
      );
    } else {
      // ========== CASE B: 创建新节点 ==========
      const newRedirectServer: ServerConfig = {
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
        customDirectives: `# Auto-generated HTTPS redirect\nreturn 301 https://$host$request_uri;`,
      };
      
      newServers = [...config.servers, newRedirectServer];
      warnings.push(`已为 ${serverName} 创建 HTTPS 跳转服务器`);
    }
    
    // 确保目标 HTTPS 服务器配置正确
    newServers = newServers.map(s => {
      if (s.id === targetServerId) {
        return {
          ...s,
          ssl: {
            ...s.ssl,
            enabled: true,
            forceRedirect: false, // 我们已经手动创建了跳转
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
      removedLocationIds,
    };
  }
  
  // ============================================================
  // 一键全部修复
  // ============================================================
  
  /**
   * 应用所有修复 - 按正确顺序执行
   */
  static applyAllFixes(config: NginxConfig): FixResult {
    let currentConfig = config;
    const allWarnings: string[] = [];
    const allRemovedLocationIds: string[] = [];
    
    // 1. 先修复全局配置
    let result = this.fixRootUser(currentConfig);
    currentConfig = result.config;
    allWarnings.push(...result.warnings);
    
    result = this.fixWorkerProcesses(currentConfig);
    currentConfig = result.config;
    
    // 2. 修复 HTTP 层配置
    result = this.fixServerTokens(currentConfig);
    currentConfig = result.config;
    
    result = this.fixAutoindex(currentConfig);
    currentConfig = result.config;
    allWarnings.push(...result.warnings);
    
    result = this.fixGzip(currentConfig);
    currentConfig = result.config;
    
    result = this.fixSendfile(currentConfig);
    currentConfig = result.config;
    
    result = this.fixTcpNodelay(currentConfig);
    currentConfig = result.config;
    
    result = this.fixKeepalive(currentConfig);
    currentConfig = result.config;
    
    // 3. 修复每个服务器
    for (const server of currentConfig.servers) {
      // 跳过跳转服务器
      if (isRedirectOnlyServer(server)) continue;
      
      // SSL 协议升级
      if (server.ssl.enabled) {
        result = this.fixSSLProtocols(currentConfig, server.id);
        currentConfig = result.config;
        allWarnings.push(...result.warnings);
        
        // HSTS
        result = this.fixHSTS(currentConfig, server.id);
        currentConfig = result.config;
      }
      
      // 安全头
      result = this.fixXFrameOptions(currentConfig, server.id);
      currentConfig = result.config;
      
      result = this.fixXContentType(currentConfig, server.id);
      currentConfig = result.config;
      
      // 隐藏文件保护
      result = this.fixHiddenFiles(currentConfig, server.id);
      currentConfig = result.config;
    }
    
    return {
      success: true,
      config: currentConfig,
      message: '已完成所有修复',
      warnings: allWarnings,
      removedLocationIds: allRemovedLocationIds,
    };
  }
}

export default FixService;
