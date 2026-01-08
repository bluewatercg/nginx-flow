import React, { useMemo, useState } from 'react';
import { useConfig } from '@/contexts/ConfigContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { generateNginxConfig } from '@/utils/configGenerator';
import { generateDockerfile } from '@/utils/dockerfileGenerator';
import { Button } from '@/components/ui/button';
import { Copy, Check, ChevronUp, ChevronDown, Download, Container } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const ConfigPreview: React.FC = () => {
  const { config } = useConfig();
  const { language, t } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const configText = useMemo(() => generateNginxConfig(config), [config]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(configText);
    setCopied(true);
    toast({
      title: language === 'zh' ? "已复制到剪贴板" : "Copied to clipboard",
      description: language === 'zh' ? "nginx.conf 已复制到剪贴板" : "nginx.conf copied to clipboard",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([configText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nginx.conf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: language === 'zh' ? "下载成功" : "Download complete",
      description: language === 'zh' ? "nginx.conf 已下载" : "nginx.conf downloaded",
    });
  };

  const handleDownloadDockerfile = () => {
    const dockerfileContent = generateDockerfile(config);
    const blob = new Blob([dockerfileContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Dockerfile';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: t('preview.dockerfileDownloaded'),
      description: language === 'zh' ? "Dockerfile 已下载，请与 nginx.conf 放在同一目录" : "Dockerfile downloaded. Place it in the same directory as nginx.conf",
    });
  };

  const highlightedConfig = useMemo(() => {
    return configText.split('\n').map((line, idx) => {
      let highlighted = line;
      
      // Comments
      if (line.trim().startsWith('#')) {
        return <span key={idx} className="text-code-comment">{line}</span>;
      }
      
      // Keywords
      const keywords = ['server', 'location', 'upstream', 'http', 'events', 'user', 'worker_processes', 'error_log', 'pid', 'include', 'listen', 'server_name', 'root', 'index', 'proxy_pass', 'proxy_set_header', 'proxy_http_version', 'ssl_certificate', 'ssl_certificate_key', 'ssl_protocols', 'ssl_ciphers', 'gzip', 'sendfile', 'tcp_nopush', 'tcp_nodelay', 'keepalive_timeout', 'return', 'rewrite', 'allow', 'deny', 'auth_basic', 'add_header', 'try_files'];
      
      keywords.forEach(keyword => {
        const regex = new RegExp(`\\b(${keyword})\\b`, 'g');
        highlighted = highlighted.toString().replace(regex, `<span class="text-code-keyword">${keyword}</span>`);
      });
      
      // Strings (single quotes)
      highlighted = highlighted.toString().replace(/'([^']+)'/g, "<span class=\"text-code-string\">'$1'</span>");
      
      // Variables
      highlighted = highlighted.toString().replace(/(\$\w+)/g, '<span class="text-code-variable">$1</span>');
      
      return <span key={idx} dangerouslySetInnerHTML={{ __html: highlighted }} />;
    });
  }, [configText]);

  const linesLabel = language === 'zh' ? '行' : 'lines';

  return (
    <div className={`bg-code-background border-t border-border transition-all duration-300 ${isExpanded ? 'h-64' : 'h-10'}`}>
      {/* Header */}
      <div className="h-10 px-4 flex items-center justify-between border-b border-border bg-card">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          <span className="font-mono">nginx.conf</span>
          <span className="text-xs text-muted-foreground">
            ({configText.split('\n').length} {linesLabel})
          </span>
        </button>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-7 px-2 gap-1 text-xs"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? (language === 'zh' ? '已复制' : 'Copied') : (language === 'zh' ? '复制' : 'Copy')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            className="h-7 px-2 gap-1 text-xs"
          >
            <Download className="w-3 h-3" />
            {language === 'zh' ? '下载' : 'Download'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadDockerfile}
            className="h-7 px-2 gap-1 text-xs border-accent/30 hover:border-accent hover:bg-accent/10 text-accent"
          >
            <Container className="w-3 h-3" />
            {t('preview.downloadDockerfile')}
          </Button>
        </div>
      </div>

      {/* Code */}
      {isExpanded && (
        <div className="h-[calc(100%-2.5rem)] overflow-auto">
          <pre className="p-4 text-xs font-mono leading-relaxed">
            <code className="block">
              {highlightedConfig.map((line, idx) => (
                <div key={idx} className="flex">
                  <span className="w-8 text-right pr-4 text-muted-foreground/50 select-none">
                    {idx + 1}
                  </span>
                  {line}
                </div>
              ))}
            </code>
          </pre>
        </div>
      )}
    </div>
  );
};

export default ConfigPreview;
