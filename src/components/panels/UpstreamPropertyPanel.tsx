import React from 'react';
import { Layers, Plus, Trash2 } from 'lucide-react';
import { useConfig } from '@/contexts/ConfigContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { UpstreamConfig, UpstreamServer } from '@/types/nginx';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { v4 as uuidv4 } from 'uuid';

interface UpstreamPropertyPanelProps {
  upstream: UpstreamConfig;
}

const UpstreamPropertyPanel: React.FC<UpstreamPropertyPanelProps> = ({ upstream }) => {
  const { updateUpstream } = useConfig();
  const { t, language } = useLanguage();

  const addServer = () => {
    const newServer: UpstreamServer = {
      id: uuidv4(),
      address: '127.0.0.1',
      port: 3000,
      weight: 1,
      maxFails: 3,
      failTimeout: 30,
      backup: false,
      down: false,
    };
    updateUpstream(upstream.id, {
      servers: [...upstream.servers, newServer],
    });
  };

  const updateServer = (serverId: string, updates: Partial<UpstreamServer>) => {
    updateUpstream(upstream.id, {
      servers: upstream.servers.map(s => s.id === serverId ? { ...s, ...updates } : s),
    });
  };

  const removeServer = (serverId: string) => {
    updateUpstream(upstream.id, {
      servers: upstream.servers.filter(s => s.id !== serverId),
    });
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-border">
        <div className="p-2 rounded-lg bg-node-upstream/20">
          <Layers className="w-5 h-5 text-node-upstream" />
        </div>
        <div className="flex-1">
          <Input
            value={upstream.name}
            onChange={(e) => updateUpstream(upstream.id, { name: e.target.value })}
            className="h-8 font-mono font-medium bg-transparent border-none p-0 text-foreground focus-visible:ring-0"
          />
          <p className="text-xs text-muted-foreground">Upstream</p>
        </div>
      </div>

      {/* Strategy */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{t('upstream.strategy')}</Label>
        <Select
          value={upstream.strategy}
          onValueChange={(value) => updateUpstream(upstream.id, { strategy: value as any })}
        >
          <SelectTrigger className="h-8 text-sm bg-input border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="round_robin">{t('upstream.strategyRoundRobin')}</SelectItem>
            <SelectItem value="least_conn">{t('upstream.strategyLeastConn')}</SelectItem>
            <SelectItem value="ip_hash">{t('upstream.strategyIpHash')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Servers */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">{t('upstream.servers')}</Label>
          <Button variant="ghost" size="sm" onClick={addServer} className="h-6 px-2">
            <Plus className="w-3 h-3 mr-1" /> {language === 'zh' ? '添加' : 'Add'}
          </Button>
        </div>

        {upstream.servers.map((server, idx) => (
          <div key={server.id} className="p-3 rounded-lg bg-muted/50 border border-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {language === 'zh' ? `服务器 ${idx + 1}` : `Server ${idx + 1}`}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeServer(server.id)}
                className="h-6 px-2 text-destructive hover:text-destructive"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs text-muted-foreground">{t('upstream.address')}</Label>
                <Input
                  value={server.address}
                  onChange={(e) => updateServer(server.id, { address: e.target.value })}
                  className="h-7 text-xs bg-input border-border font-mono"
                  placeholder="127.0.0.1"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{language === 'zh' ? '端口' : 'Port'}</Label>
                <Input
                  type="number"
                  value={server.port}
                  onChange={(e) => updateServer(server.id, { port: parseInt(e.target.value) || 80 })}
                  className="h-7 text-xs bg-input border-border"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t('upstream.weight')}</Label>
                <Input
                  type="number"
                  value={server.weight}
                  onChange={(e) => updateServer(server.id, { weight: parseInt(e.target.value) || 1 })}
                  className="h-7 text-xs bg-input border-border"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t('upstream.maxFails')}</Label>
                <Input
                  type="number"
                  value={server.maxFails}
                  onChange={(e) => updateServer(server.id, { maxFails: parseInt(e.target.value) || 1 })}
                  className="h-7 text-xs bg-input border-border"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t('upstream.failTimeout')}</Label>
                <Input
                  type="number"
                  value={server.failTimeout}
                  onChange={(e) => updateServer(server.id, { failTimeout: parseInt(e.target.value) || 10 })}
                  className="h-7 text-xs bg-input border-border"
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={server.backup}
                  onCheckedChange={(checked) => updateServer(server.id, { backup: checked })}
                  className="scale-75"
                />
                <Label className="text-xs text-muted-foreground">{t('upstream.backup')}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={server.down}
                  onCheckedChange={(checked) => updateServer(server.id, { down: checked })}
                  className="scale-75"
                />
                <Label className="text-xs text-muted-foreground">{t('upstream.down')}</Label>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Custom Directives */}
      <div className="space-y-1.5 pt-2 border-t border-border">
        <Label className="text-xs text-muted-foreground">{t('upstream.custom')}</Label>
        <Textarea
          value={upstream.customDirectives}
          onChange={(e) => updateUpstream(upstream.id, { customDirectives: e.target.value })}
          className="min-h-[80px] text-xs font-mono bg-input border-border"
          placeholder={t('upstream.customPlaceholder')}
        />
      </div>
    </div>
  );
};

export default UpstreamPropertyPanel;
