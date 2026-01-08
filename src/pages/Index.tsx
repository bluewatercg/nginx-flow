import { ConfigProvider } from '@/contexts/ConfigContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import ConfigSidebar from '@/components/sidebar/ConfigSidebar';
import ConfigCanvas from '@/components/canvas/ConfigCanvas';
import PropertyPanel from '@/components/panels/PropertyPanel';
import ConfigPreview from '@/components/preview/ConfigPreview';
import { Github } from 'lucide-react';

const Index = () => {
  return (
    <LanguageProvider>
      <ConfigProvider>
        <div className="h-screen flex flex-col overflow-hidden relative">
          {/* GitHub Link */}
          <a
            href="https://github.com/Anarkh-Lee/nginx-flow"
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-3 right-3 z-50 p-2 rounded-lg bg-background/80 backdrop-blur-sm border border-border hover:bg-accent transition-colors"
            title="View on GitHub"
          >
            <Github className="h-5 w-5 text-foreground" />
          </a>
          {/* Main Content */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left Sidebar */}
            <ConfigSidebar />
            
            {/* Center Canvas */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 relative">
                <ConfigCanvas />
              </div>
            </div>
            
            {/* Right Property Panel */}
            <PropertyPanel />
          </div>
          
          {/* Bottom Preview */}
          <ConfigPreview />
        </div>
      </ConfigProvider>
    </LanguageProvider>
  );
};

export default Index;
