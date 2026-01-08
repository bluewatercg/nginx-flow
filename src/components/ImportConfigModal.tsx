import React, { useState } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useConfig } from '@/contexts/ConfigContext';
import { parseNginxConfig, ParseError } from '@/utils/nginxParser';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const EXAMPLE_CONFIG = `# Example Nginx Configuration
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    sendfile on;
    tcp_nopush on;
    keepalive_timeout 65;
    server_tokens off;
    
    gzip on;
    gzip_comp_level 6;
    
    upstream backend {
        ip_hash;
        server 127.0.0.1:3000 weight=5;
        server 127.0.0.1:3001;
        server 127.0.0.1:3002 backup;
    }
    
    server {
        listen 80 default_server;
        server_name example.com www.example.com;
        root /var/www/html;
        index index.html;
        
        location = /health {
            return 200 'OK';
        }
        
        location ^~ /static/ {
            alias /var/www/static/;
            expires 30d;
        }
        
        location ~ \\.php$ {
            proxy_pass http://127.0.0.1:9000;
        }
        
        location /api {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
        
        location / {
            try_files $uri $uri/ /index.html;
        }
    }
    
    server {
        listen 443 ssl http2;
        server_name secure.example.com;
        
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        
        location / {
            proxy_pass http://backend;
        }
    }
}`;

interface ImportConfigModalProps {
  children?: React.ReactNode;
  onImportComplete?: () => void;
}

const ImportConfigModal: React.FC<ImportConfigModalProps> = ({ children, onImportComplete }) => {
  const { language } = useLanguage();
  const { importConfig } = useConfig();
  const { toast } = useToast();
  
  const [open, setOpen] = useState(false);
  const [configText, setConfigText] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseSuccess, setParseSuccess] = useState(false);

  const t = {
    title: language === 'zh' ? '导入 Nginx 配置' : 'Import Nginx Config',
    description: language === 'zh' 
      ? '粘贴您的 nginx.conf 文件内容，系统将自动解析并可视化' 
      : 'Paste your nginx.conf content, and the system will parse and visualize it',
    placeholder: language === 'zh' 
      ? '在此粘贴 nginx.conf 内容...' 
      : 'Paste nginx.conf content here...',
    loadExample: language === 'zh' ? '加载示例配置' : 'Load Example',
    parse: language === 'zh' ? '解析并导入' : 'Parse & Import',
    cancel: language === 'zh' ? '取消' : 'Cancel',
    errorTitle: language === 'zh' ? '解析错误' : 'Parse Error',
    successTitle: language === 'zh' ? '解析成功' : 'Parse Successful',
    successMsg: language === 'zh' ? '配置已成功导入并可视化' : 'Configuration imported and visualized',
    emptyError: language === 'zh' ? '请输入配置内容' : 'Please enter configuration content',
  };

  const handleLoadExample = () => {
    setConfigText(EXAMPLE_CONFIG);
    setParseError(null);
    setParseSuccess(false);
  };

  const handleParse = () => {
    if (!configText.trim()) {
      setParseError(t.emptyError);
      return;
    }

    try {
      setParseError(null);
      const config = parseNginxConfig(configText);
      
      // Import the parsed config
      importConfig(config);
      
      setParseSuccess(true);
      toast({
        title: t.successTitle,
        description: `${config.servers.length} servers, ${config.locations.length} locations, ${config.upstreams.length} upstreams`,
      });
      
      setTimeout(() => {
        setOpen(false);
        setConfigText('');
        setParseSuccess(false);
        onImportComplete?.();
      }, 500);
      
    } catch (error) {
      if (error instanceof ParseError) {
        setParseError(`Line ${error.line}: ${error.message}`);
      } else if (error instanceof Error) {
        setParseError(error.message);
      } else {
        setParseError('Unknown error occurred');
      }
      setParseSuccess(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) {
        setParseError(null);
        setParseSuccess(false);
      }
    }}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm" className="gap-2">
            <Upload className="w-4 h-4" />
            {language === 'zh' ? '导入配置' : 'Import Config'}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col bg-background border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            {t.title}
          </DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 space-y-4 overflow-hidden">
          <div className="flex justify-end">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleLoadExample}
              className="text-xs"
            >
              {t.loadExample}
            </Button>
          </div>
          
          <Textarea
            value={configText}
            onChange={(e) => {
              setConfigText(e.target.value);
              setParseError(null);
              setParseSuccess(false);
            }}
            placeholder={t.placeholder}
            className="min-h-[350px] font-mono text-sm bg-muted/50 border-border resize-none"
            spellCheck={false}
          />
          
          {parseError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t.errorTitle}</AlertTitle>
              <AlertDescription className="font-mono text-xs">
                {parseError}
              </AlertDescription>
            </Alert>
          )}
          
          {parseSuccess && (
            <Alert className="border-green-500/50 bg-green-500/10">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertTitle className="text-green-500">{t.successTitle}</AlertTitle>
              <AlertDescription className="text-green-500/80">
                {t.successMsg}
              </AlertDescription>
            </Alert>
          )}
        </div>
        
        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t.cancel}
          </Button>
          <Button onClick={handleParse} className="gap-2">
            <Upload className="w-4 h-4" />
            {t.parse}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImportConfigModal;
