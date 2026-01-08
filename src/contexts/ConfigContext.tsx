import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import {
  NginxConfig,
  ServerConfig,
  LocationConfig,
  UpstreamConfig,
  GlobalConfig,
  EventsConfig,
  HttpConfig,
  defaultNginxConfig,
  createDefaultServer,
  createDefaultLocation,
  createDefaultUpstream,
} from '@/types/nginx';

interface ConfigContextType {
  config: NginxConfig;
  selectedNodeId: string | null;
  selectedNodeType: 'server' | 'location' | 'upstream' | null;
  
  // Selection
  selectNode: (id: string | null, type: 'server' | 'location' | 'upstream' | null) => void;
  
  // Import
  importConfig: (newConfig: NginxConfig) => void;
  
  // Global/Events/HTTP
  updateGlobal: (updates: Partial<GlobalConfig>) => void;
  updateEvents: (updates: Partial<EventsConfig>) => void;
  updateHttp: (updates: Partial<HttpConfig>) => void;
  
  // Servers
  addServer: () => ServerConfig;
  updateServer: (id: string, updates: Partial<ServerConfig>) => void;
  deleteServer: (id: string) => void;
  
  // Locations
  addLocation: (serverId: string) => LocationConfig;
  updateLocation: (id: string, updates: Partial<LocationConfig>) => void;
  deleteLocation: (id: string) => void;
  
  // Upstreams
  addUpstream: () => UpstreamConfig;
  updateUpstream: (id: string, updates: Partial<UpstreamConfig>) => void;
  deleteUpstream: (id: string) => void;
  
  // Helpers
  getServerById: (id: string) => ServerConfig | undefined;
  getLocationById: (id: string) => LocationConfig | undefined;
  getUpstreamById: (id: string) => UpstreamConfig | undefined;
  getLocationsByServerId: (serverId: string) => LocationConfig[];
}

const ConfigContext = createContext<ConfigContextType | null>(null);

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
};

interface ConfigProviderProps {
  children: ReactNode;
}

export const ConfigProvider: React.FC<ConfigProviderProps> = ({ children }) => {
  const [config, setConfig] = useState<NginxConfig>(defaultNginxConfig);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeType, setSelectedNodeType] = useState<'server' | 'location' | 'upstream' | null>(null);

  const selectNode = useCallback((id: string | null, type: 'server' | 'location' | 'upstream' | null) => {
    setSelectedNodeId(id);
    setSelectedNodeType(type);
  }, []);

  const importConfig = useCallback((newConfig: NginxConfig) => {
    setConfig(newConfig);
    setSelectedNodeId(null);
    setSelectedNodeType(null);
  }, []);

  // Helper to clear rawConfig when user makes any edits (so generator produces new config)
  const clearRawConfig = useCallback(() => {
    setConfig(prev => {
      if (prev.rawConfig) {
        const { rawConfig, ...rest } = prev;
        return rest as NginxConfig;
      }
      return prev;
    });
  }, []);

  const updateGlobal = useCallback((updates: Partial<GlobalConfig>) => {
    setConfig(prev => {
      const { rawConfig, ...rest } = prev;
      return {
        ...rest,
        global: { ...prev.global, ...updates },
      } as NginxConfig;
    });
  }, []);

  const updateEvents = useCallback((updates: Partial<EventsConfig>) => {
    setConfig(prev => {
      const { rawConfig, ...rest } = prev;
      return {
        ...rest,
        events: { ...prev.events, ...updates },
      } as NginxConfig;
    });
  }, []);

  const updateHttp = useCallback((updates: Partial<HttpConfig>) => {
    setConfig(prev => {
      const { rawConfig, ...rest } = prev;
      return {
        ...rest,
        http: { ...prev.http, ...updates },
      } as NginxConfig;
    });
  }, []);

  const addServer = useCallback(() => {
    const newServer = createDefaultServer();
    setConfig(prev => {
      const { rawConfig, ...rest } = prev;
      return {
        ...rest,
        servers: [...prev.servers, newServer],
      } as NginxConfig;
    });
    return newServer;
  }, []);

  const updateServer = useCallback((id: string, updates: Partial<ServerConfig>) => {
    setConfig(prev => {
      const { rawConfig, ...rest } = prev;
      return {
        ...rest,
        servers: prev.servers.map(s => s.id === id ? { ...s, ...updates } : s),
      } as NginxConfig;
    });
  }, []);

  const deleteServer = useCallback((id: string) => {
    setConfig(prev => {
      const { rawConfig, ...rest } = prev;
      return {
        ...rest,
        servers: prev.servers.filter(s => s.id !== id),
        locations: prev.locations.filter(l => l.serverId !== id),
      } as NginxConfig;
    });
    if (selectedNodeId === id) {
      setSelectedNodeId(null);
      setSelectedNodeType(null);
    }
  }, [selectedNodeId]);

  const addLocation = useCallback((serverId: string) => {
    const newLocation = createDefaultLocation(serverId);
    setConfig(prev => {
      const { rawConfig, ...rest } = prev;
      return {
        ...rest,
        locations: [...prev.locations, newLocation],
      } as NginxConfig;
    });
    return newLocation;
  }, []);

  const updateLocation = useCallback((id: string, updates: Partial<LocationConfig>) => {
    setConfig(prev => {
      const { rawConfig, ...rest } = prev;
      return {
        ...rest,
        locations: prev.locations.map(l => l.id === id ? { ...l, ...updates } : l),
      } as NginxConfig;
    });
  }, []);

  const deleteLocation = useCallback((id: string) => {
    setConfig(prev => {
      const { rawConfig, ...rest } = prev;
      return {
        ...rest,
        locations: prev.locations.filter(l => l.id !== id),
      } as NginxConfig;
    });
    if (selectedNodeId === id) {
      setSelectedNodeId(null);
      setSelectedNodeType(null);
    }
  }, [selectedNodeId]);

  const addUpstream = useCallback(() => {
    const newUpstream = createDefaultUpstream();
    setConfig(prev => {
      const { rawConfig, ...rest } = prev;
      return {
        ...rest,
        upstreams: [...prev.upstreams, newUpstream],
      } as NginxConfig;
    });
    return newUpstream;
  }, []);

  const updateUpstream = useCallback((id: string, updates: Partial<UpstreamConfig>) => {
    setConfig(prev => {
      const { rawConfig, ...rest } = prev;
      return {
        ...rest,
        upstreams: prev.upstreams.map(u => u.id === id ? { ...u, ...updates } : u),
      } as NginxConfig;
    });
  }, []);

  const deleteUpstream = useCallback((id: string) => {
    setConfig(prev => {
      const { rawConfig, ...rest } = prev;
      return {
        ...rest,
        upstreams: prev.upstreams.filter(u => u.id !== id),
        locations: prev.locations.map(l => 
          l.upstreamId === id ? { ...l, upstreamId: null, proxyPass: '' } : l
        ),
      } as NginxConfig;
    });
    if (selectedNodeId === id) {
      setSelectedNodeId(null);
      setSelectedNodeType(null);
    }
  }, [selectedNodeId]);

  const getServerById = useCallback((id: string) => {
    return config.servers.find(s => s.id === id);
  }, [config.servers]);

  const getLocationById = useCallback((id: string) => {
    return config.locations.find(l => l.id === id);
  }, [config.locations]);

  const getUpstreamById = useCallback((id: string) => {
    return config.upstreams.find(u => u.id === id);
  }, [config.upstreams]);

  const getLocationsByServerId = useCallback((serverId: string) => {
    return config.locations.filter(l => l.serverId === serverId);
  }, [config.locations]);

  return (
    <ConfigContext.Provider
      value={{
        config,
        selectedNodeId,
        selectedNodeType,
        selectNode,
        importConfig,
        updateGlobal,
        updateEvents,
        updateHttp,
        addServer,
        updateServer,
        deleteServer,
        addLocation,
        updateLocation,
        deleteLocation,
        addUpstream,
        updateUpstream,
        deleteUpstream,
        getServerById,
        getLocationById,
        getUpstreamById,
        getLocationsByServerId,
      }}
    >
      {children}
    </ConfigContext.Provider>
  );
};
