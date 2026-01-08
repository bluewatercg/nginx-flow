import React from 'react';
import { MapPin, Plus, Trash2, Sparkles, Wifi } from 'lucide-react';
import { useConfig } from '@/contexts/ConfigContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { LocationConfig } from '@/types/nginx';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface LocationPropertyPanelProps {
  location: LocationConfig;
}

const LocationPropertyPanel: React.FC<LocationPropertyPanelProps> = ({ location }) => {
  const { updateLocation, config } = useConfig();
  const { t, language } = useLanguage();

  const addAllowIp = () => {
    updateLocation(location.id, {
      accessControl: {
        ...location.accessControl,
        allow: [...location.accessControl.allow, ''],
      },
    });
  };

  const addDenyIp = () => {
    updateLocation(location.id, {
      accessControl: {
        ...location.accessControl,
        deny: [...location.accessControl.deny, ''],
      },
    });
  };

  const applySpaMode = () => {
    updateLocation(location.id, { tryFiles: '$uri $uri/ /index.html' });
    toast({
      title: t('quickConfig.spaApplied'),
      description: t('quickConfig.spaModeDesc'),
    });
  };

  const handleWebsocketToggle = (enabled: boolean) => {
    updateLocation(location.id, { websocket: enabled });
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-border">
        <div className="p-2 rounded-lg bg-node-location/20">
          <MapPin className="w-5 h-5 text-node-location" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Select
              value={location.modifier || 'none'}
              onValueChange={(value) => updateLocation(location.id, { modifier: value === 'none' ? '' : value as any })}
            >
              <SelectTrigger className="h-7 w-16 text-xs bg-muted border-border">
                <SelectValue placeholder={language === 'zh' ? '无' : 'None'} />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="none">{language === 'zh' ? '无' : 'None'}</SelectItem>
                <SelectItem value="=">=</SelectItem>
                <SelectItem value="~">~</SelectItem>
                <SelectItem value="~*">~*</SelectItem>
                <SelectItem value="^~">^~</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={location.path}
              onChange={(e) => updateLocation(location.id, { path: e.target.value })}
              className="h-7 flex-1 font-mono text-sm bg-transparent border-none p-0 focus-visible:ring-0"
              placeholder="/"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">Location</p>
        </div>
      </div>

      <Tabs defaultValue="proxy" className="w-full">
        <TabsList className="w-full grid grid-cols-5 bg-muted">
          <TabsTrigger value="static" className="text-xs">{language === 'zh' ? '静态' : 'Static'}</TabsTrigger>
          <TabsTrigger value="proxy" className="text-xs">{t('location.proxy')}</TabsTrigger>
          <TabsTrigger value="headers" className="text-xs">{t('location.headers')}</TabsTrigger>
          <TabsTrigger value="cors" className="text-xs">{t('location.cors')}</TabsTrigger>
          <TabsTrigger value="access" className="text-xs">{t('location.access')}</TabsTrigger>
        </TabsList>

        {/* Static/General Tab with SPA Mode */}
        <TabsContent value="static" className="space-y-3 mt-4">
          {/* SPA Mode Button */}
          <div className="p-3 rounded-lg bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20">
            <Button
              onClick={applySpaMode}
              variant="outline"
              size="sm"
              className="w-full justify-center gap-2 border-primary/30 hover:border-primary hover:bg-primary/10 text-primary"
            >
              <Sparkles className="w-4 h-4" />
              {t('quickConfig.spaMode')}
            </Button>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              {t('quickConfig.spaModeDesc')}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t('location.tryFiles')}</Label>
            <Input
              value={location.tryFiles}
              onChange={(e) => updateLocation(location.id, { tryFiles: e.target.value })}
              className="h-8 text-sm bg-input border-border font-mono"
              placeholder={t('location.tryFilesPlaceholder')}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t('location.alias')}</Label>
            <Input
              value={location.alias}
              onChange={(e) => updateLocation(location.id, { alias: e.target.value })}
              className="h-8 text-sm bg-input border-border font-mono"
              placeholder="/path/to/files"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t('location.return')}</Label>
              <Input
                type="number"
                value={location.returnCode || ''}
                onChange={(e) => updateLocation(location.id, { returnCode: parseInt(e.target.value) || null })}
                className="h-8 text-sm bg-input border-border"
                placeholder="301"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">URL</Label>
              <Input
                value={location.returnUrl}
                onChange={(e) => updateLocation(location.id, { returnUrl: e.target.value })}
                className="h-8 text-sm bg-input border-border"
                placeholder="https://..."
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t('location.customDirectives')}</Label>
            <Textarea
              value={location.customDirectives}
              onChange={(e) => updateLocation(location.id, { customDirectives: e.target.value })}
              className="min-h-[80px] text-xs font-mono bg-input border-border"
              placeholder={t('location.customPlaceholder')}
            />
          </div>
        </TabsContent>

        <TabsContent value="proxy" className="space-y-3 mt-4">
          {/* WebSocket Support Toggle */}
          <div className="p-3 rounded-lg bg-gradient-to-r from-accent/10 to-node-upstream/10 border border-accent/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-accent" />
                <Label className="text-sm font-medium">{t('quickConfig.websocket')}</Label>
              </div>
              <Switch
                checked={location.websocket}
                onCheckedChange={handleWebsocketToggle}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {t('quickConfig.websocketDesc')}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t('location.selectUpstream')}</Label>
            <Select
              value={location.upstreamId || 'none'}
              onValueChange={(value) => updateLocation(location.id, { 
                upstreamId: value === 'none' ? null : value,
                proxyPass: value !== 'none' ? '' : location.proxyPass 
              })}
            >
              <SelectTrigger className="h-8 text-sm bg-input border-border">
                <SelectValue placeholder={language === 'zh' ? '选择 Upstream 或在下方输入 URL' : 'Select Upstream or enter URL below'} />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="none">{language === 'zh' ? '无 (使用 proxy_pass URL)' : 'None (use proxy_pass URL)'}</SelectItem>
                {config.upstreams.map(upstream => (
                  <SelectItem key={upstream.id} value={upstream.id}>
                    {upstream.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!location.upstreamId && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t('location.proxyPass')}</Label>
              <Input
                value={location.proxyPass}
                onChange={(e) => updateLocation(location.id, { proxyPass: e.target.value })}
                className="h-8 text-sm bg-input border-border font-mono"
                placeholder="http://127.0.0.1:3000"
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="headers" className="space-y-3 mt-4">
          <Label className="text-xs text-muted-foreground">{t('location.headersDesc')}</Label>
          {location.headers.map((header, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Switch
                checked={header.enabled}
                onCheckedChange={(checked) => {
                  const newHeaders = [...location.headers];
                  newHeaders[idx] = { ...header, enabled: checked };
                  updateLocation(location.id, { headers: newHeaders });
                }}
              />
              <div className="flex-1 grid grid-cols-2 gap-2">
                <Input
                  value={header.name}
                  onChange={(e) => {
                    const newHeaders = [...location.headers];
                    newHeaders[idx] = { ...header, name: e.target.value };
                    updateLocation(location.id, { headers: newHeaders });
                  }}
                  className="h-7 text-xs bg-input border-border"
                  placeholder={language === 'zh' ? '请求头名称' : 'Header name'}
                />
                <Input
                  value={header.value}
                  onChange={(e) => {
                    const newHeaders = [...location.headers];
                    newHeaders[idx] = { ...header, value: e.target.value };
                    updateLocation(location.id, { headers: newHeaders });
                  }}
                  className="h-7 text-xs bg-input border-border font-mono"
                  placeholder="$value"
                />
              </div>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              updateLocation(location.id, {
                headers: [...location.headers, { name: '', value: '', enabled: true }],
              });
            }}
            className="w-full"
          >
            <Plus className="w-3 h-3 mr-1" /> {language === 'zh' ? '添加请求头' : 'Add Header'}
          </Button>
        </TabsContent>

        <TabsContent value="cors" className="space-y-3 mt-4">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">{t('location.corsEnabled')}</Label>
            <Switch
              checked={location.cors.enabled}
              onCheckedChange={(checked) => updateLocation(location.id, { cors: { ...location.cors, enabled: checked } })}
            />
          </div>

          {location.cors.enabled && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('location.corsOrigin')}</Label>
                <Input
                  value={location.cors.allowOrigin}
                  onChange={(e) => updateLocation(location.id, { cors: { ...location.cors, allowOrigin: e.target.value } })}
                  className="h-8 text-sm bg-input border-border"
                  placeholder="*"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('location.corsMethods')}</Label>
                <div className="flex flex-wrap gap-1">
                  {['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'].map(method => (
                    <Button
                      key={method}
                      variant={location.cors.allowMethods.includes(method) ? 'default' : 'outline'}
                      size="sm"
                      className="h-6 text-xs px-2"
                      onClick={() => {
                        const methods = location.cors.allowMethods.includes(method)
                          ? location.cors.allowMethods.filter(m => m !== method)
                          : [...location.cors.allowMethods, method];
                        updateLocation(location.id, { cors: { ...location.cors, allowMethods: methods } });
                      }}
                    >
                      {method}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">{t('location.corsCredentials')}</Label>
                <Switch
                  checked={location.cors.allowCredentials}
                  onCheckedChange={(checked) => updateLocation(location.id, { cors: { ...location.cors, allowCredentials: checked } })}
                />
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="access" className="space-y-3 mt-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">{language === 'zh' ? '允许 IP' : 'Allow IPs'}</Label>
              <Button variant="ghost" size="sm" onClick={addAllowIp} className="h-6 px-2">
                <Plus className="w-3 h-3" />
              </Button>
            </div>
            {location.accessControl.allow.map((ip, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  value={ip}
                  onChange={(e) => {
                    const newAllow = [...location.accessControl.allow];
                    newAllow[idx] = e.target.value;
                    updateLocation(location.id, { accessControl: { ...location.accessControl, allow: newAllow } });
                  }}
                  className="h-7 text-xs bg-input border-border font-mono"
                  placeholder="192.168.1.0/24"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const newAllow = location.accessControl.allow.filter((_, i) => i !== idx);
                    updateLocation(location.id, { accessControl: { ...location.accessControl, allow: newAllow } });
                  }}
                  className="h-7 px-2 text-destructive"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">{language === 'zh' ? '拒绝 IP' : 'Deny IPs'}</Label>
              <Button variant="ghost" size="sm" onClick={addDenyIp} className="h-6 px-2">
                <Plus className="w-3 h-3" />
              </Button>
            </div>
            {location.accessControl.deny.map((ip, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  value={ip}
                  onChange={(e) => {
                    const newDeny = [...location.accessControl.deny];
                    newDeny[idx] = e.target.value;
                    updateLocation(location.id, { accessControl: { ...location.accessControl, deny: newDeny } });
                  }}
                  className="h-7 text-xs bg-input border-border font-mono"
                  placeholder="all"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const newDeny = location.accessControl.deny.filter((_, i) => i !== idx);
                    updateLocation(location.id, { accessControl: { ...location.accessControl, deny: newDeny } });
                  }}
                  className="h-7 px-2 text-destructive"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-border space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">{language === 'zh' ? 'HTTP 基本认证' : 'HTTP Basic Auth'}</Label>
              <Switch
                checked={location.accessControl.authBasic.enabled}
                onCheckedChange={(checked) => updateLocation(location.id, {
                  accessControl: {
                    ...location.accessControl,
                    authBasic: { ...location.accessControl.authBasic, enabled: checked },
                  },
                })}
              />
            </div>
            {location.accessControl.authBasic.enabled && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{language === 'zh' ? '认证域' : 'Realm'}</Label>
                  <Input
                    value={location.accessControl.authBasic.realm}
                    onChange={(e) => updateLocation(location.id, {
                      accessControl: {
                        ...location.accessControl,
                        authBasic: { ...location.accessControl.authBasic, realm: e.target.value },
                      },
                    })}
                    className="h-7 text-xs bg-input border-border"
                    placeholder="Restricted"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{language === 'zh' ? '用户文件路径' : 'User File Path'}</Label>
                  <Input
                    value={location.accessControl.authBasic.userFile}
                    onChange={(e) => updateLocation(location.id, {
                      accessControl: {
                        ...location.accessControl,
                        authBasic: { ...location.accessControl.authBasic, userFile: e.target.value },
                      },
                    })}
                    className="h-7 text-xs bg-input border-border font-mono"
                    placeholder="/etc/nginx/.htpasswd"
                  />
                </div>
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LocationPropertyPanel;
