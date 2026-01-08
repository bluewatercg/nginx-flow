import React, { createContext, useContext, useState, ReactNode } from 'react';

type Language = 'zh' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  zh: {
    // 侧边栏
    'sidebar.title': 'Nginx 配置',
    'sidebar.global': '全局设置',
    'sidebar.events': 'Events 事件',
    'sidebar.http': 'HTTP 配置',
    'sidebar.canvas': '画布组件',
    'sidebar.addServer': '添加 Server',
    'sidebar.addLocation': '添加 Location',
    'sidebar.addUpstream': '添加 Upstream',
    
    // 全局设置
    'global.user': '运行用户',
    'global.workerProcesses': '工作进程数',
    'global.errorLog': '错误日志路径',
    'global.errorLogLevel': '日志级别',
    'global.pid': 'PID 文件路径',
    'global.custom': '自定义指令',
    'global.customPlaceholder': '# 输入自定义全局指令...',
    
    // Events
    'events.workerConnections': '最大连接数',
    'events.use': '事件模型',
    'events.multiAccept': '多连接接受',
    'events.custom': '自定义指令',
    'events.customPlaceholder': '# 输入自定义 events 指令...',
    
    // HTTP 配置
    'http.basic': '基础设置',
    'http.gzip': 'Gzip 压缩',
    'http.security': '安全设置',
    'http.logging': '日志设置',
    'http.custom': '自定义',
    'http.sendfile': 'Sendfile',
    'http.tcpNopush': 'TCP Nopush',
    'http.tcpNodelay': 'TCP Nodelay',
    'http.keepaliveTimeout': 'Keepalive 超时 (秒)',
    'http.typesHashMaxSize': 'Types Hash 最大值',
    'http.includeMimeTypes': '包含 MIME 类型',
    'http.defaultType': '默认类型',
    'http.gzipEnabled': '启用 Gzip',
    'http.gzipCompLevel': '压缩级别 (1-9)',
    'http.gzipMinLength': '最小压缩长度',
    'http.gzipTypes': 'Gzip 类型',
    'http.serverTokens': '隐藏版本号',
    'http.clientMaxBodySize': '最大上传大小',
    'http.logFormat': '日志格式名称',
    'http.logFormatString': '日志格式字符串',
    'http.accessLog': '访问日志路径',
    'http.customDirectives': '自定义指令',
    'http.customPlaceholder': '# 输入自定义 HTTP 指令...',
    
    // Server 节点
    'server.title': 'Server 虚拟主机',
    'server.listen': '监听配置',
    'server.ssl': 'SSL/TLS',
    'server.files': '文件设置',
    'server.custom': '自定义',
    'server.port': '监听端口',
    'server.defaultServer': '默认服务器',
    'server.http2': '启用 HTTP/2',
    'server.serverName': '域名',
    'server.serverNamePlaceholder': 'example.com www.example.com',
    'server.sslEnabled': '启用 SSL',
    'server.sslCertificate': 'SSL 证书路径',
    'server.sslCertificateKey': 'SSL 密钥路径',
    'server.sslProtocols': 'SSL 协议',
    'server.sslCiphers': 'SSL 加密套件',
    'server.sslCiphersPlaceholder': 'Mozilla 推荐套件',
    'server.forceHttps': '强制 HTTPS 跳转',
    'server.root': '根目录',
    'server.index': '默认文件',
    'server.customDirectives': '自定义指令',
    'server.customPlaceholder': '# 输入自定义 server 指令...',
    'server.delete': '删除',
    
    // Location 节点
    'location.title': 'Location 路径规则',
    'location.basic': '基础配置',
    'location.proxy': '代理设置',
    'location.headers': '请求头',
    'location.cors': 'CORS 跨域',
    'location.access': '访问控制',
    'location.custom': '自定义',
    'location.modifier': '匹配修饰符',
    'location.modifierNone': '(无) 前缀匹配',
    'location.modifierExact': '= 精确匹配',
    'location.modifierRegex': '~ 正则 (区分大小写)',
    'location.modifierRegexInsensitive': '~* 正则 (不区分大小写)',
    'location.modifierPrefix': '^~ 前缀优先',
    'location.path': '路径',
    'location.pathPlaceholder': '/api/',
    'location.root': '根目录',
    'location.alias': 'Alias 别名',
    'location.tryFiles': 'Try Files',
    'location.tryFilesPlaceholder': '$uri $uri/ /index.html',
    'location.return': 'Return 返回',
    'location.returnPlaceholder': '301 https://$host$request_uri',
    'location.proxyPass': 'Proxy Pass',
    'location.proxyPassPlaceholder': 'http://backend 或选择 Upstream',
    'location.selectUpstream': '选择 Upstream',
    'location.headersDesc': '代理请求头设置',
    'location.host': 'Host',
    'location.xRealIp': 'X-Real-IP',
    'location.xForwardedFor': 'X-Forwarded-For',
    'location.xForwardedProto': 'X-Forwarded-Proto',
    'location.upgrade': 'Upgrade (WebSocket)',
    'location.connection': 'Connection (WebSocket)',
    'location.corsEnabled': '启用 CORS',
    'location.corsOrigin': 'Allow-Origin',
    'location.corsMethods': 'Allow-Methods',
    'location.corsHeaders': 'Allow-Headers',
    'location.corsCredentials': '允许凭证',
    'location.allowIps': '允许 IP (每行一个)',
    'location.allowIpsPlaceholder': '192.168.1.0/24\n10.0.0.1',
    'location.denyIps': '拒绝 IP (每行一个)',
    'location.denyIpsPlaceholder': 'all',
    'location.authBasic': 'Basic 认证提示',
    'location.authBasicUserFile': '密码文件路径',
    'location.customDirectives': '自定义指令',
    'location.customPlaceholder': '# 输入自定义 location 指令...',
    'location.delete': '删除',
    
    // Upstream 节点
    'upstream.title': 'Upstream 负载均衡',
    'upstream.name': 'Upstream 名称',
    'upstream.strategy': '负载均衡策略',
    'upstream.strategyRoundRobin': '轮询 (默认)',
    'upstream.strategyLeastConn': '最少连接',
    'upstream.strategyIpHash': 'IP Hash',
    'upstream.servers': '后端服务器',
    'upstream.addServer': '添加服务器',
    'upstream.address': '地址',
    'upstream.addressPlaceholder': '127.0.0.1:8080',
    'upstream.weight': '权重',
    'upstream.maxFails': '最大失败次数',
    'upstream.failTimeout': '失败超时 (秒)',
    'upstream.backup': '备用',
    'upstream.down': '下线',
    'upstream.removeServer': '移除',
    'upstream.custom': '自定义指令',
    'upstream.customPlaceholder': '# 输入自定义 upstream 指令...',
    'upstream.delete': '删除',
    
    // 属性面板
    'panel.title': '属性配置',
    'panel.selectNode': '选择左侧菜单项或画布中的节点以编辑属性',
    'panel.server': 'Server 配置',
    'panel.location': 'Location 配置',
    'panel.upstream': 'Upstream 配置',
    
    // 预览
    'preview.title': '配置预览',
    'preview.expand': '展开',
    'preview.collapse': '收起',
    'preview.copy': '复制',
    'preview.copied': '已复制',
    'preview.download': '下载',
    'preview.downloadDockerfile': '下载 Dockerfile',
    'preview.dockerfileDownloaded': 'Dockerfile 已下载',
    
    // 一键配置
    'quickConfig.spaMode': '应用 SPA 模式 (React/Vue)',
    'quickConfig.spaModeDesc': '自动配置 try_files 解决 SPA 路由刷新 404 问题',
    'quickConfig.spaApplied': 'SPA 模式已应用',
    'quickConfig.websocket': '开启 WebSocket 支持',
    'quickConfig.websocketDesc': '自动添加 WebSocket 代理所需的请求头',
    
    // 模拟器
    'simulator.title': '请求路径模拟器',
    'simulator.simulate': '测试',
    'simulator.matched': '已匹配',
    'simulator.noMatch': '无匹配',
    'simulator.priority': '优先级',
    
    // 通用
    'common.enabled': '启用',
    'common.disabled': '禁用',
    'common.on': '开',
    'common.off': '关',
  },
  en: {
    // Sidebar
    'sidebar.title': 'Nginx Config',
    'sidebar.global': 'Global Settings',
    'sidebar.events': 'Events',
    'sidebar.http': 'HTTP Config',
    'sidebar.canvas': 'Canvas Components',
    'sidebar.addServer': 'Add Server',
    'sidebar.addLocation': 'Add Location',
    'sidebar.addUpstream': 'Add Upstream',
    
    // Global Settings
    'global.user': 'Run User',
    'global.workerProcesses': 'Worker Processes',
    'global.errorLog': 'Error Log Path',
    'global.errorLogLevel': 'Log Level',
    'global.pid': 'PID File Path',
    'global.custom': 'Custom Directives',
    'global.customPlaceholder': '# Enter custom global directives...',
    
    // Events
    'events.workerConnections': 'Max Connections',
    'events.use': 'Event Model',
    'events.multiAccept': 'Multi Accept',
    'events.custom': 'Custom Directives',
    'events.customPlaceholder': '# Enter custom events directives...',
    
    // HTTP Config
    'http.basic': 'Basic Settings',
    'http.gzip': 'Gzip Compression',
    'http.security': 'Security',
    'http.logging': 'Logging',
    'http.custom': 'Custom',
    'http.sendfile': 'Sendfile',
    'http.tcpNopush': 'TCP Nopush',
    'http.tcpNodelay': 'TCP Nodelay',
    'http.keepaliveTimeout': 'Keepalive Timeout (sec)',
    'http.typesHashMaxSize': 'Types Hash Max Size',
    'http.includeMimeTypes': 'Include MIME Types',
    'http.defaultType': 'Default Type',
    'http.gzipEnabled': 'Enable Gzip',
    'http.gzipCompLevel': 'Compression Level (1-9)',
    'http.gzipMinLength': 'Min Compression Length',
    'http.gzipTypes': 'Gzip Types',
    'http.serverTokens': 'Hide Version',
    'http.clientMaxBodySize': 'Max Upload Size',
    'http.logFormat': 'Log Format Name',
    'http.logFormatString': 'Log Format String',
    'http.accessLog': 'Access Log Path',
    'http.customDirectives': 'Custom Directives',
    'http.customPlaceholder': '# Enter custom HTTP directives...',
    
    // Server Node
    'server.title': 'Server Virtual Host',
    'server.listen': 'Listen Config',
    'server.ssl': 'SSL/TLS',
    'server.files': 'File Settings',
    'server.custom': 'Custom',
    'server.port': 'Listen Port',
    'server.defaultServer': 'Default Server',
    'server.http2': 'Enable HTTP/2',
    'server.serverName': 'Domain',
    'server.serverNamePlaceholder': 'example.com www.example.com',
    'server.sslEnabled': 'Enable SSL',
    'server.sslCertificate': 'SSL Certificate Path',
    'server.sslCertificateKey': 'SSL Key Path',
    'server.sslProtocols': 'SSL Protocols',
    'server.sslCiphers': 'SSL Ciphers',
    'server.sslCiphersPlaceholder': 'Mozilla recommended ciphers',
    'server.forceHttps': 'Force HTTPS Redirect',
    'server.root': 'Root Directory',
    'server.index': 'Index Files',
    'server.customDirectives': 'Custom Directives',
    'server.customPlaceholder': '# Enter custom server directives...',
    'server.delete': 'Delete',
    
    // Location Node
    'location.title': 'Location Path Rules',
    'location.basic': 'Basic Config',
    'location.proxy': 'Proxy Settings',
    'location.headers': 'Headers',
    'location.cors': 'CORS',
    'location.access': 'Access Control',
    'location.custom': 'Custom',
    'location.modifier': 'Match Modifier',
    'location.modifierNone': '(None) Prefix Match',
    'location.modifierExact': '= Exact Match',
    'location.modifierRegex': '~ Regex (Case Sensitive)',
    'location.modifierRegexInsensitive': '~* Regex (Case Insensitive)',
    'location.modifierPrefix': '^~ Prefix Priority',
    'location.path': 'Path',
    'location.pathPlaceholder': '/api/',
    'location.root': 'Root Directory',
    'location.alias': 'Alias',
    'location.tryFiles': 'Try Files',
    'location.tryFilesPlaceholder': '$uri $uri/ /index.html',
    'location.return': 'Return',
    'location.returnPlaceholder': '301 https://$host$request_uri',
    'location.proxyPass': 'Proxy Pass',
    'location.proxyPassPlaceholder': 'http://backend or select Upstream',
    'location.selectUpstream': 'Select Upstream',
    'location.headersDesc': 'Proxy Header Settings',
    'location.host': 'Host',
    'location.xRealIp': 'X-Real-IP',
    'location.xForwardedFor': 'X-Forwarded-For',
    'location.xForwardedProto': 'X-Forwarded-Proto',
    'location.upgrade': 'Upgrade (WebSocket)',
    'location.connection': 'Connection (WebSocket)',
    'location.corsEnabled': 'Enable CORS',
    'location.corsOrigin': 'Allow-Origin',
    'location.corsMethods': 'Allow-Methods',
    'location.corsHeaders': 'Allow-Headers',
    'location.corsCredentials': 'Allow Credentials',
    'location.allowIps': 'Allow IPs (one per line)',
    'location.allowIpsPlaceholder': '192.168.1.0/24\n10.0.0.1',
    'location.denyIps': 'Deny IPs (one per line)',
    'location.denyIpsPlaceholder': 'all',
    'location.authBasic': 'Basic Auth Prompt',
    'location.authBasicUserFile': 'Password File Path',
    'location.customDirectives': 'Custom Directives',
    'location.customPlaceholder': '# Enter custom location directives...',
    'location.delete': 'Delete',
    
    // Upstream Node
    'upstream.title': 'Upstream Load Balancer',
    'upstream.name': 'Upstream Name',
    'upstream.strategy': 'Load Balance Strategy',
    'upstream.strategyRoundRobin': 'Round Robin (Default)',
    'upstream.strategyLeastConn': 'Least Connections',
    'upstream.strategyIpHash': 'IP Hash',
    'upstream.servers': 'Backend Servers',
    'upstream.addServer': 'Add Server',
    'upstream.address': 'Address',
    'upstream.addressPlaceholder': '127.0.0.1:8080',
    'upstream.weight': 'Weight',
    'upstream.maxFails': 'Max Fails',
    'upstream.failTimeout': 'Fail Timeout (sec)',
    'upstream.backup': 'Backup',
    'upstream.down': 'Down',
    'upstream.removeServer': 'Remove',
    'upstream.custom': 'Custom Directives',
    'upstream.customPlaceholder': '# Enter custom upstream directives...',
    'upstream.delete': 'Delete',
    
    // Property Panel
    'panel.title': 'Properties',
    'panel.selectNode': 'Select a menu item or canvas node to edit properties',
    'panel.server': 'Server Config',
    'panel.location': 'Location Config',
    'panel.upstream': 'Upstream Config',
    
    // Preview
    'preview.title': 'Config Preview',
    'preview.expand': 'Expand',
    'preview.collapse': 'Collapse',
    'preview.copy': 'Copy',
    'preview.copied': 'Copied',
    'preview.download': 'Download',
    'preview.downloadDockerfile': 'Download Dockerfile',
    'preview.dockerfileDownloaded': 'Dockerfile downloaded',
    
    // Quick Config
    'quickConfig.spaMode': 'Apply SPA Mode (React/Vue)',
    'quickConfig.spaModeDesc': 'Auto-configure try_files to fix SPA route refresh 404',
    'quickConfig.spaApplied': 'SPA Mode Applied',
    'quickConfig.websocket': 'Enable WebSocket Support',
    'quickConfig.websocketDesc': 'Auto-add headers for WebSocket proxy',
    
    // Simulator
    'simulator.title': 'Traffic Simulator',
    'simulator.simulate': 'Simulate',
    'simulator.matched': 'Matched',
    'simulator.noMatch': 'No Match',
    'simulator.priority': 'Priority',
    
    // Common
    'common.enabled': 'Enabled',
    'common.disabled': 'Disabled',
    'common.on': 'On',
    'common.off': 'Off',
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('zh');

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
