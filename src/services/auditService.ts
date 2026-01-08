import { v4 as uuidv4 } from 'uuid';
import { NginxConfig, LocationConfig, ServerConfig } from '@/types/nginx';
import { isRedirectServer, cleanCustomDirectives } from '@/utils/configGenerator';
import { ConfigCleaner } from '@/utils/configCleaner';
import AutoFixService from './AutoFixService';

export type AuditSeverity = 'critical' | 'warning' | 'info';
export type AuditCategory = 'security' | 'performance' | 'config';

export interface AuditIssue {
  id: string;
  ruleId: string;
  severity: AuditSeverity;
  category: AuditCategory;
  title: string;
  titleZh: string;
  description: string;
  descriptionZh: string;
  affectedNodeId: string | null;
  affectedNodeType: 'global' | 'http' | 'events' | 'server' | 'location' | 'upstream' | null;
  canAutoFix: boolean;
  fixLabel?: string;
  fixLabelZh?: string;
}

export interface AuditRule {
  id: string;
  severity: AuditSeverity;
  category: AuditCategory;
  title: string;
  titleZh: string;
  description: string;
  descriptionZh: string;
  check: (config: NginxConfig) => AuditIssue[];
  fix?: (config: NginxConfig, affectedNodeId: string) => Partial<NginxConfig>;
}

export interface AuditResult {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  issues: AuditIssue[];
  passedRules: number;
  totalRules: number;
}

// ============================================================
// 工具函数：上下文感知检查
// ============================================================

/**
 * 检查服务器是否需要安全头
 * 跳转服务器不需要 X-Frame-Options 等安全头
 */
function serverNeedsSecurityHeaders(server: ServerConfig): boolean {
  return !isRedirectServer(server);
}

/**
 * 智能添加自定义指令，避免重复
 * 使用 ConfigCleaner 确保先清理再添加
 */
function smartAddDirective(existingDirectives: string, newDirective: string, directiveKey: string): string {
  return ConfigCleaner.smartAddDirective(existingDirectives, newDirective, directiveKey);
}

/**
 * 检查自定义指令中是否包含特定指令
 */
function hasDirective(customDirectives: string, directiveName: string): boolean {
  const regex = new RegExp(`^\\s*${directiveName}\\s+`, 'im');
  return regex.test(customDirectives);
}

/**
 * 检查自定义指令中是否包含特定 header
 */
function hasAddHeader(customDirectives: string, headerName: string): boolean {
  const regex = new RegExp(`add_header\\s+['"]?${headerName}['"]?\\s+`, 'i');
  return regex.test(customDirectives);
}

// ============================================================
// Audit Rules Definition
// ============================================================

const auditRules: AuditRule[] = [
  // ==================== SECURITY RULES ====================
  
  // Rule 1: Server Tokens (Version Hiding)
  {
    id: 'security-server-tokens',
    severity: 'critical',
    category: 'security',
    title: 'Nginx Version Exposed',
    titleZh: '暴露 Nginx 版本号',
    description: 'server_tokens is not set to off. Exposing version info helps attackers identify vulnerabilities.',
    descriptionZh: '未设置 server_tokens off。暴露版本号可能导致攻击者针对性利用已知漏洞。',
    check: (config) => {
      if (config.http.serverTokens !== false) {
        return [{
          id: uuidv4(),
          ruleId: 'security-server-tokens',
          severity: 'critical',
          category: 'security',
          title: 'Nginx Version Exposed',
          titleZh: '暴露 Nginx 版本号',
          description: 'server_tokens is not set to off. Exposing version info helps attackers identify vulnerabilities.',
          descriptionZh: '未设置 server_tokens off。暴露版本号可能导致攻击者针对性利用已知漏洞。',
          affectedNodeId: null,
          affectedNodeType: 'http',
          canAutoFix: true,
          fixLabel: 'Set server_tokens off',
          fixLabelZh: '设置 server_tokens off',
        }];
      }
      return [];
    },
    fix: (config) => ({
      http: { 
        ...config.http, 
        serverTokens: false,
        // 使用 ConfigCleaner 清理自定义指令中的 server_tokens
        customDirectives: ConfigCleaner.removeDirective(config.http.customDirectives, 'server_tokens'),
      },
    }),
  },

  // Rule 2: Hidden Files Protection
  {
    id: 'security-hidden-files',
    severity: 'critical',
    category: 'security',
    title: 'Hidden Files Not Protected',
    titleZh: '未保护隐藏文件',
    description: 'No rule blocks access to hidden files like .git, .env, .htaccess which may contain sensitive data.',
    descriptionZh: '缺少阻止访问隐藏文件（如 .git、.env）的规则，可能泄露敏感数据。',
    check: (config) => {
      const issues: AuditIssue[] = [];
      
      config.servers.forEach(server => {
        // 跳转服务器不需要检查
        if (isRedirectServer(server)) return;
        
        const serverLocations = config.locations.filter(l => l.serverId === server.id);
        const hasHiddenFileRule = serverLocations.some(l => 
          l.path.includes('\\.') || l.path.includes('/\\.') || l.path === '~ /\\.'
        );
        
        if (!hasHiddenFileRule && serverLocations.length > 0) {
          issues.push({
            id: uuidv4(),
            ruleId: 'security-hidden-files',
            severity: 'critical',
            category: 'security',
            title: 'Hidden Files Not Protected',
            titleZh: '未保护隐藏文件',
            description: `Server "${server.serverName}" has no rule blocking access to hidden files (.git, .env).`,
            descriptionZh: `服务器 "${server.serverName}" 缺少拦截隐藏文件的规则。`,
            affectedNodeId: server.id,
            affectedNodeType: 'server',
            canAutoFix: true,
            fixLabel: 'Add hidden file protection',
            fixLabelZh: '添加隐藏文件保护规则',
          });
        }
      });
      
      return issues;
    },
    fix: (config, affectedNodeId) => {
      if (!affectedNodeId) return {};
      
      // 检查是否已存在隐藏文件保护规则
      const existingHiddenRule = config.locations.find(
        l => l.serverId === affectedNodeId && (l.path.includes('\\.') || l.path === '~ /\\.')
      );
      if (existingHiddenRule) return {};
      
      // 创建新的隐藏文件保护 Location
      // 只使用 return 403，不同时使用 deny all（冗余代码优化）
      const newLocation: LocationConfig = {
        id: uuidv4(),
        serverId: affectedNodeId,
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
        customDirectives: '# 拦截所有隐藏文件访问（.git, .env 等）',
      };
      
      return {
        locations: [...config.locations, newLocation],
      };
    },
  },

  // Rule 3: X-Frame-Options (Clickjacking Protection)
  {
    id: 'security-x-frame-options',
    severity: 'warning',
    category: 'security',
    title: 'Missing Clickjacking Protection',
    titleZh: '缺少点击劫持防护',
    description: 'X-Frame-Options header not configured. Your site may be vulnerable to clickjacking attacks.',
    descriptionZh: '未配置 X-Frame-Options 响应头，网站可能遭受点击劫持攻击。',
    check: (config) => {
      const issues: AuditIssue[] = [];
      
      config.servers.forEach(server => {
        // 跳转服务器不需要安全头
        if (!serverNeedsSecurityHeaders(server)) return;
        
        const hasXFrameOptions = hasAddHeader(server.customDirectives, 'X-Frame-Options');
        
        if (!hasXFrameOptions) {
          issues.push({
            id: uuidv4(),
            ruleId: 'security-x-frame-options',
            severity: 'warning',
            category: 'security',
            title: 'Missing Clickjacking Protection',
            titleZh: '缺少点击劫持防护',
            description: `Server "${server.serverName}" is missing X-Frame-Options header.`,
            descriptionZh: `服务器 "${server.serverName}" 未配置 X-Frame-Options。`,
            affectedNodeId: server.id,
            affectedNodeType: 'server',
            canAutoFix: true,
            fixLabel: 'Add X-Frame-Options: SAMEORIGIN',
            fixLabelZh: '添加 X-Frame-Options 头',
          });
        }
      });
      
      return issues;
    },
    fix: (config, affectedNodeId) => {
      if (!affectedNodeId) return {};
      
      const server = config.servers.find(s => s.id === affectedNodeId);
      // 跳转服务器不需要安全头
      if (server && !serverNeedsSecurityHeaders(server)) return {};
      
      const updatedServers = config.servers.map(s => {
        if (s.id === affectedNodeId) {
          // 使用 ConfigCleaner 智能添加 header
          const newDirectives = ConfigCleaner.smartAddHeader(
            s.customDirectives, 
            'X-Frame-Options', 
            'SAMEORIGIN', 
            true
          );
          return { ...s, customDirectives: newDirectives };
        }
        return s;
      });
      
      return { servers: updatedServers };
    },
  },

  // Rule 4: X-Content-Type-Options (MIME Sniffing Protection)
  {
    id: 'security-x-content-type',
    severity: 'warning',
    category: 'security',
    title: 'Missing MIME Sniffing Protection',
    titleZh: '缺少 MIME 嗅探防护',
    description: 'X-Content-Type-Options header not configured. Browsers may incorrectly interpret file types.',
    descriptionZh: '未配置 X-Content-Type-Options 响应头，浏览器可能错误解析文件类型。',
    check: (config) => {
      const issues: AuditIssue[] = [];
      
      config.servers.forEach(server => {
        // 跳转服务器不需要安全头
        if (!serverNeedsSecurityHeaders(server)) return;
        
        const hasXContentType = hasAddHeader(server.customDirectives, 'X-Content-Type-Options');
        
        if (!hasXContentType) {
          issues.push({
            id: uuidv4(),
            ruleId: 'security-x-content-type',
            severity: 'warning',
            category: 'security',
            title: 'Missing MIME Sniffing Protection',
            titleZh: '缺少 MIME 嗅探防护',
            description: `Server "${server.serverName}" is missing X-Content-Type-Options header.`,
            descriptionZh: `服务器 "${server.serverName}" 未配置 X-Content-Type-Options。`,
            affectedNodeId: server.id,
            affectedNodeType: 'server',
            canAutoFix: true,
            fixLabel: 'Add X-Content-Type-Options: nosniff',
            fixLabelZh: '添加 X-Content-Type-Options 头',
          });
        }
      });
      
      return issues;
    },
    fix: (config, affectedNodeId) => {
      if (!affectedNodeId) return {};
      
      const server = config.servers.find(s => s.id === affectedNodeId);
      // 跳转服务器不需要安全头
      if (server && !serverNeedsSecurityHeaders(server)) return {};
      
      const updatedServers = config.servers.map(s => {
        if (s.id === affectedNodeId) {
          // 使用 ConfigCleaner 智能添加 header
          const newDirectives = ConfigCleaner.smartAddHeader(
            s.customDirectives, 
            'X-Content-Type-Options', 
            'nosniff', 
            true
          );
          return { ...s, customDirectives: newDirectives };
        }
        return s;
      });
      
      return { servers: updatedServers };
    },
  },

  // Rule 5: HSTS for SSL Servers
  {
    id: 'security-hsts',
    severity: 'critical',
    category: 'security',
    title: 'HSTS Not Enabled for HTTPS',
    titleZh: 'HTTPS 未启用 HSTS',
    description: 'HTTPS server without Strict-Transport-Security header. Users may be vulnerable to downgrade attacks.',
    descriptionZh: 'HTTPS 服务器未配置 HSTS，用户可能遭受降级攻击。',
    check: (config) => {
      const issues: AuditIssue[] = [];
      
      config.servers.forEach(server => {
        // 跳转服务器不需要 HSTS
        if (!serverNeedsSecurityHeaders(server)) return;
        
        if (server.ssl.enabled && server.listen.port === 443) {
          const hasHSTS = hasAddHeader(server.customDirectives, 'Strict-Transport-Security');
          
          if (!hasHSTS) {
            issues.push({
              id: uuidv4(),
              ruleId: 'security-hsts',
              severity: 'critical',
              category: 'security',
              title: 'HSTS Not Enabled for HTTPS',
              titleZh: 'HTTPS 未启用 HSTS',
              description: `HTTPS server "${server.serverName}" should enable HSTS to prevent downgrade attacks.`,
              descriptionZh: `HTTPS 服务器 "${server.serverName}" 应启用 HSTS 防止降级攻击。`,
              affectedNodeId: server.id,
              affectedNodeType: 'server',
              canAutoFix: true,
              fixLabel: 'Enable HSTS',
              fixLabelZh: '启用 HSTS',
            });
          }
        }
      });
      
      return issues;
    },
    fix: (config, affectedNodeId) => {
      if (!affectedNodeId) return {};
      
      const server = config.servers.find(s => s.id === affectedNodeId);
      // 跳转服务器不需要 HSTS
      if (server && !serverNeedsSecurityHeaders(server)) return {};
      
      const updatedServers = config.servers.map(s => {
        if (s.id === affectedNodeId) {
          // 使用 ConfigCleaner 智能添加 HSTS header
          const newDirectives = ConfigCleaner.smartAddHeader(
            s.customDirectives, 
            'Strict-Transport-Security', 
            'max-age=31536000; includeSubDomains', 
            true
          );
          return { ...s, customDirectives: newDirectives };
        }
        return s;
      });
      
      return { servers: updatedServers };
    },
  },

  // ==================== PERFORMANCE RULES ====================

  // Rule 6: Gzip Compression
  {
    id: 'perf-gzip',
    severity: 'warning',
    category: 'performance',
    title: 'Gzip Compression Disabled',
    titleZh: 'Gzip 压缩未启用',
    description: 'Gzip compression is disabled. Enabling it can reduce bandwidth by 70%+ for text content.',
    descriptionZh: 'Gzip 压缩未开启，启用后可减少 70%+ 的文本内容带宽。',
    check: (config) => {
      if (!config.http.gzip.enabled) {
        return [{
          id: uuidv4(),
          ruleId: 'perf-gzip',
          severity: 'warning',
          category: 'performance',
          title: 'Gzip Compression Disabled',
          titleZh: 'Gzip 压缩未启用',
          description: 'Gzip compression is disabled. Enabling it can reduce bandwidth by 70%+ for text content.',
          descriptionZh: 'Gzip 压缩未开启，启用后可减少 70%+ 的文本内容带宽。',
          affectedNodeId: null,
          affectedNodeType: 'http',
          canAutoFix: true,
          fixLabel: 'Enable Gzip',
          fixLabelZh: '启用 Gzip',
        }];
      }
      return [];
    },
    fix: (config) => ({
      http: {
        ...config.http,
        gzip: {
          ...config.http.gzip,
          enabled: true,
          compLevel: config.http.gzip.compLevel || 6,
          types: config.http.gzip.types.length > 0 ? config.http.gzip.types : [
            'text/plain', 'text/css', 'application/json', 'application/javascript',
            'text/xml', 'application/xml', 'image/svg+xml'
          ],
        },
        // 使用 ConfigCleaner 批量清理 gzip 相关指令
        customDirectives: ConfigCleaner.removeDirectives(config.http.customDirectives, [
          'gzip', 'gzip_comp_level', 'gzip_types', 'gzip_min_length'
        ]),
      },
    }),
  },

  // Rule 7: Sendfile
  {
    id: 'perf-sendfile',
    severity: 'info',
    category: 'performance',
    title: 'Sendfile Not Enabled',
    titleZh: '未启用 Sendfile',
    description: 'sendfile off. Enabling it allows kernel-level file transfer, improving static file performance.',
    descriptionZh: 'sendfile 未开启，启用后可利用内核级文件传输提升静态文件性能。',
    check: (config) => {
      if (!config.http.sendfile) {
        return [{
          id: uuidv4(),
          ruleId: 'perf-sendfile',
          severity: 'info',
          category: 'performance',
          title: 'Sendfile Not Enabled',
          titleZh: '未启用 Sendfile',
          description: 'sendfile off. Enabling it allows kernel-level file transfer, improving static file performance.',
          descriptionZh: 'sendfile 未开启，启用后可利用内核级文件传输提升静态文件性能。',
          affectedNodeId: null,
          affectedNodeType: 'http',
          canAutoFix: true,
          fixLabel: 'Enable sendfile',
          fixLabelZh: '启用 sendfile',
        }];
      }
      return [];
    },
    fix: (config) => ({
      http: { 
        ...config.http, 
        sendfile: true,
        // 使用 ConfigCleaner 清理 sendfile 指令
        customDirectives: ConfigCleaner.removeDirective(config.http.customDirectives, 'sendfile'),
      },
    }),
  },

  // Rule 8: TCP Nodelay
  {
    id: 'perf-tcp-nodelay',
    severity: 'info',
    category: 'performance',
    title: 'TCP Nodelay Not Enabled',
    titleZh: '未启用 TCP Nodelay',
    description: 'tcp_nodelay off. Enabling it reduces latency for small packets.',
    descriptionZh: 'tcp_nodelay 未开启，启用后可减少小数据包延迟。',
    check: (config) => {
      if (!config.http.tcpNodelay) {
        return [{
          id: uuidv4(),
          ruleId: 'perf-tcp-nodelay',
          severity: 'info',
          category: 'performance',
          title: 'TCP Nodelay Not Enabled',
          titleZh: '未启用 TCP Nodelay',
          description: 'tcp_nodelay off. Enabling it reduces latency for small packets.',
          descriptionZh: 'tcp_nodelay 未开启，启用后可减少小数据包延迟。',
          affectedNodeId: null,
          affectedNodeType: 'http',
          canAutoFix: true,
          fixLabel: 'Enable tcp_nodelay',
          fixLabelZh: '启用 tcp_nodelay',
        }];
      }
      return [];
    },
    fix: (config) => ({
      http: { 
        ...config.http, 
        tcpNodelay: true,
        // 使用 ConfigCleaner 清理 tcp_nodelay 指令
        customDirectives: ConfigCleaner.removeDirective(config.http.customDirectives, 'tcp_nodelay'),
      },
    }),
  },

  // Rule 9: Worker Processes
  {
    id: 'perf-worker-processes',
    severity: 'info',
    category: 'performance',
    title: 'Worker Processes Not Auto',
    titleZh: '工作进程未设为 Auto',
    description: 'worker_processes is not set to "auto". Using auto optimizes for available CPU cores.',
    descriptionZh: 'worker_processes 未设为 auto，设为 auto 可自动匹配 CPU 核心数。',
    check: (config) => {
      if (config.global.workerProcesses !== 'auto') {
        return [{
          id: uuidv4(),
          ruleId: 'perf-worker-processes',
          severity: 'info',
          category: 'performance',
          title: 'Worker Processes Not Auto',
          titleZh: '工作进程未设为 Auto',
          description: `worker_processes is "${config.global.workerProcesses}". Using "auto" optimizes for CPU cores.`,
          descriptionZh: `worker_processes 当前为 "${config.global.workerProcesses}"，建议设为 auto。`,
          affectedNodeId: null,
          affectedNodeType: 'global',
          canAutoFix: true,
          fixLabel: 'Set to auto',
          fixLabelZh: '设为 auto',
        }];
      }
      return [];
    },
    fix: (config) => ({
      global: { 
        ...config.global, 
        workerProcesses: 'auto',
        // 使用 ConfigCleaner 清理 worker_processes 指令
        customDirectives: ConfigCleaner.removeDirective(config.global.customDirectives, 'worker_processes'),
      },
    }),
  },

  // Rule 10: Keepalive Timeout
  {
    id: 'perf-keepalive',
    severity: 'info',
    category: 'performance',
    title: 'Keepalive Timeout Too Low',
    titleZh: 'Keepalive 超时过短',
    description: 'keepalive_timeout is below recommended 65s. Low values increase connection overhead.',
    descriptionZh: 'keepalive_timeout 低于建议的 65 秒，过短会增加连接开销。',
    check: (config) => {
      if (config.http.keepaliveTimeout < 60) {
        return [{
          id: uuidv4(),
          ruleId: 'perf-keepalive',
          severity: 'info',
          category: 'performance',
          title: 'Keepalive Timeout Too Low',
          titleZh: 'Keepalive 超时过短',
          description: `keepalive_timeout is ${config.http.keepaliveTimeout}s. Recommended: 65s.`,
          descriptionZh: `keepalive_timeout 当前为 ${config.http.keepaliveTimeout}s，建议设为 65s。`,
          affectedNodeId: null,
          affectedNodeType: 'http',
          canAutoFix: true,
          fixLabel: 'Set to 65s',
          fixLabelZh: '设为 65 秒',
        }];
      }
      return [];
    },
    fix: (config) => ({
      http: { 
        ...config.http, 
        keepaliveTimeout: 65,
        // 使用 ConfigCleaner 清理 keepalive_timeout 指令
        customDirectives: ConfigCleaner.removeDirective(config.http.customDirectives, 'keepalive_timeout'),
      },
    }),
  },

  // ==================== CONFIG LOGIC RULES ====================

  // Rule 11: Empty Upstream
  {
    id: 'config-empty-upstream',
    severity: 'critical',
    category: 'config',
    title: 'Empty Upstream Pool',
    titleZh: 'Upstream 服务器列表为空',
    description: 'Upstream has no backend servers configured. Requests will fail.',
    descriptionZh: 'Upstream 未配置后端服务器，请求将失败。',
    check: (config) => {
      const issues: AuditIssue[] = [];
      
      config.upstreams.forEach(upstream => {
        if (upstream.servers.length === 0) {
          issues.push({
            id: uuidv4(),
            ruleId: 'config-empty-upstream',
            severity: 'critical',
            category: 'config',
            title: 'Empty Upstream Pool',
            titleZh: 'Upstream 服务器列表为空',
            description: `Upstream "${upstream.name}" has no backend servers.`,
            descriptionZh: `Upstream "${upstream.name}" 没有后端服务器。`,
            affectedNodeId: upstream.id,
            affectedNodeType: 'upstream',
            canAutoFix: false,
          });
        }
      });
      
      return issues;
    },
  },

  // Rule 12: Missing Server Name
  {
    id: 'config-missing-server-name',
    severity: 'warning',
    category: 'config',
    title: 'Missing Server Name',
    titleZh: '缺少 Server Name',
    description: 'Server has no server_name configured. It may catch unintended requests.',
    descriptionZh: 'Server 未配置 server_name，可能接收到非预期请求。',
    check: (config) => {
      const issues: AuditIssue[] = [];
      
      config.servers.forEach(server => {
        if (!server.serverName || server.serverName === '' || server.serverName === '_') {
          issues.push({
            id: uuidv4(),
            ruleId: 'config-missing-server-name',
            severity: 'warning',
            category: 'config',
            title: 'Missing Server Name',
            titleZh: '缺少 Server Name',
            description: `Server on port ${server.listen.port} has no specific server_name.`,
            descriptionZh: `监听端口 ${server.listen.port} 的服务器未配置 server_name。`,
            affectedNodeId: server.id,
            affectedNodeType: 'server',
            canAutoFix: false,
          });
        }
      });
      
      return issues;
    },
  },
];

// ============================================================
// Audit Runner
// ============================================================

export function runAudit(config: NginxConfig): AuditResult {
  const issues: AuditIssue[] = [];
  let passedRules = 0;
  
  auditRules.forEach(rule => {
    const ruleIssues = rule.check(config);
    if (ruleIssues.length === 0) {
      passedRules++;
    } else {
      issues.push(...ruleIssues);
    }
  });
  
  // Sort by severity: critical first, then warning, then info
  const severityOrder: Record<AuditSeverity, number> = { critical: 0, warning: 1, info: 2 };
  issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  
  // Calculate score (100 - deductions)
  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const infoCount = issues.filter(i => i.severity === 'info').length;
  
  const score = Math.max(0, 100 - (criticalCount * 20) - (warningCount * 10) - (infoCount * 3));
  
  let grade: AuditResult['grade'];
  if (score >= 90) grade = 'A';
  else if (score >= 75) grade = 'B';
  else if (score >= 60) grade = 'C';
  else if (score >= 40) grade = 'D';
  else grade = 'F';
  
  return {
    score,
    grade,
    issues,
    passedRules,
    totalRules: auditRules.length,
  };
}

export function applyFix(config: NginxConfig, ruleId: string, affectedNodeId?: string | null): Partial<NginxConfig> | null {
  // Find the rule directly by ruleId
  const rule = auditRules.find(r => r.id === ruleId);
  if (!rule || !rule.fix) return null;
  
  return rule.fix(config, affectedNodeId || '');
}

export function applyAllFixes(config: NginxConfig): NginxConfig {
  // Step 1: 使用 AutoFixService 进行破坏性清洗（移除冲突指令、处理端口劫持）
  const cleanResult = AutoFixService.applyAllFixes(config);
  let currentConfig = cleanResult.config;

  if (cleanResult.warnings.length > 0) {
    console.log('[AutoFixService] 修复警告:', cleanResult.warnings);
  }

  // Step 2: 遍历所有审计规则，逐个应用可自动修复的规则
  // 使用循环而非递归，确保每次修复都基于最新状态
  let hasChanges = true;
  let iterations = 0;
  const maxIterations = 10; // 防止无限循环

  while (hasChanges && iterations < maxIterations) {
    hasChanges = false;
    iterations++;

    // 重新运行审计以获取当前问题列表
    const currentIssues = runAudit(currentConfig);

    for (const issue of currentIssues.issues) {
      if (!issue.canAutoFix) continue;

      const rule = auditRules.find(r => r.id === issue.ruleId);
      if (!rule || !rule.fix) continue;

      const fix = rule.fix(currentConfig, issue.affectedNodeId || '');
      if (fix && Object.keys(fix).length > 0) {
        currentConfig = { ...currentConfig, ...fix };
        hasChanges = true;
      }
    }
  }

  if (iterations >= maxIterations) {
    console.warn('[applyAllFixes] 达到最大迭代次数，可能存在无法修复的循环问题');
  }

  return currentConfig;
}

export function getAuditRules() {
  return auditRules;
}

// 导出工具类供外部使用
export { ConfigCleaner };
export { AutoFixService } from './AutoFixService';
export { FixService } from './fixService';
