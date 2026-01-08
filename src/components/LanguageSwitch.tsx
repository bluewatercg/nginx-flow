import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Globe } from 'lucide-react';

export const LanguageSwitch: React.FC = () => {
  const { language, setLanguage } = useLanguage();

  return (
    <button
      onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
      className="flex items-center gap-1.5 px-2 py-1 rounded bg-muted/50 hover:bg-muted text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
    >
      <Globe className="w-3.5 h-3.5" />
      <span>{language === 'zh' ? 'EN' : '中文'}</span>
    </button>
  );
};
