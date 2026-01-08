import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useConfig } from '@/contexts/ConfigContext';
import { useLanguage } from '@/contexts/LanguageContext';
import ServerNode from '@/components/nodes/ServerNode';
import LocationNode from '@/components/nodes/LocationNode';
import UpstreamNode from '@/components/nodes/UpstreamNode';
import TrafficSimulator from '@/components/toolbar/TrafficSimulator';
import { matchLocation } from '@/utils/locationMatcher';
import { getLayoutedElements } from '@/utils/autoLayout';

const nodeTypes = {
  server: ServerNode,
  location: LocationNode,
  upstream: UpstreamNode,
};

interface SimulationState {
  isActive: boolean;
  matchedLocationId: string | null;
  matchedServerId: string | null;
  priorityLabel: string;
  matchReason: string;
}

const ConfigCanvasInner: React.FC = () => {
  const { config, selectNode, updateLocation, getLocationsByServerId } = useConfig();
  const { language, t } = useLanguage();
  const { fitView } = useReactFlow();
  const prevConfigRef = useRef(config);
  
  const [simulation, setSimulation] = useState<SimulationState>({
    isActive: false,
    matchedLocationId: null,
    matchedServerId: null,
    priorityLabel: '',
    matchReason: '',
  });

  const initialNodes = useMemo(() => {
    const nodes: Node[] = [];
    let serverY = 50;

    // Add server nodes
    config.servers.forEach((server, idx) => {
      nodes.push({
        id: server.id,
        type: 'server',
        position: { x: 100 + idx * 300, y: serverY },
        data: {
          label: server.name,
          serverName: server.serverName,
          port: server.listen.port,
          sslEnabled: server.ssl.enabled,
        },
      });
    });

    // Add location nodes
    config.locations.forEach((location, idx) => {
      const serverIdx = config.servers.findIndex(s => s.id === location.serverId);
      nodes.push({
        id: location.id,
        type: 'location',
        position: { x: 100 + serverIdx * 300, y: 200 + (idx % 3) * 100 },
        data: {
          label: location.path,
          path: location.path,
          modifier: location.modifier,
          hasProxy: !!location.proxyPass || !!location.upstreamId,
        },
      });
    });

    // Add upstream nodes
    config.upstreams.forEach((upstream, idx) => {
      nodes.push({
        id: upstream.id,
        type: 'upstream',
        position: { x: 500 + idx * 250, y: 400 },
        data: {
          label: upstream.name,
          serverCount: upstream.servers.length,
          strategy: upstream.strategy,
        },
      });
    });

    return nodes;
  }, [config.servers, config.locations, config.upstreams]);

  const initialEdges = useMemo(() => {
    const edges: Edge[] = [];

    // Server -> Location edges
    config.locations.forEach(location => {
      edges.push({
        id: `${location.serverId}-${location.id}`,
        source: location.serverId,
        target: location.id,
        style: { stroke: 'hsl(160, 84%, 39%)', strokeWidth: 2 },
        animated: true,
      });

      // Location -> Upstream edges
      if (location.upstreamId) {
        edges.push({
          id: `${location.id}-${location.upstreamId}`,
          source: location.id,
          target: location.upstreamId,
          style: { stroke: 'hsl(38, 92%, 50%)', strokeWidth: 2 },
          animated: true,
        });
      }
    });

    return edges;
  }, [config.locations]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Auto-layout and fit view when config structure changes significantly (import)
  useEffect(() => {
    const prevServers = prevConfigRef.current.servers;
    const prevLocations = prevConfigRef.current.locations;
    
    // Detect if this is an import (multiple items changed at once)
    const serversChanged = config.servers.length !== prevServers.length || 
      config.servers.some(s => !prevServers.find(ps => ps.id === s.id));
    const locationsChanged = config.locations.length !== prevLocations.length ||
      config.locations.some(l => !prevLocations.find(pl => pl.id === l.id));
    
    if (serversChanged && locationsChanged && config.servers.length > 0) {
      // This looks like an import - apply auto-layout
      const rawNodes: Node[] = [];
      const rawEdges: Edge[] = [];
      
      config.servers.forEach((server) => {
        rawNodes.push({
          id: server.id,
          type: 'server',
          position: { x: 0, y: 0 },
          data: { label: server.name, serverName: server.serverName, port: server.listen.port, sslEnabled: server.ssl.enabled },
        });
      });
      
      config.locations.forEach((location) => {
        rawNodes.push({
          id: location.id,
          type: 'location',
          position: { x: 0, y: 0 },
          data: { label: location.path, path: location.path, modifier: location.modifier, hasProxy: !!location.proxyPass },
        });
        rawEdges.push({ id: `e-${location.serverId}-${location.id}`, source: location.serverId, target: location.id });
        if (location.upstreamId) {
          rawEdges.push({ id: `e-${location.id}-${location.upstreamId}`, source: location.id, target: location.upstreamId });
        }
      });
      
      config.upstreams.forEach((upstream) => {
        rawNodes.push({
          id: upstream.id,
          type: 'upstream',
          position: { x: 0, y: 0 },
          data: { label: upstream.name, serverCount: upstream.servers.length, strategy: upstream.strategy },
        });
      });
      
      const { nodes: layoutedNodes } = getLayoutedElements(rawNodes, rawEdges, { direction: 'TB', rankSep: 120, nodeSep: 60 });
      setNodes(layoutedNodes);
      
      setTimeout(() => fitView({ padding: 0.2 }), 100);
    }
    
    prevConfigRef.current = config;
  }, [config, setNodes, fitView]);

  // Sync nodes when config changes
  useEffect(() => {
    setNodes(prevNodes => {
      const newNodes: Node[] = [];
      
      config.servers.forEach((server, idx) => {
        const existing = prevNodes.find(n => n.id === server.id);
        const isSimulationSource = simulation.isActive && simulation.matchedServerId === server.id;
        
        newNodes.push({
          id: server.id,
          type: 'server',
          position: existing?.position || { x: 100 + idx * 300, y: 50 },
          data: {
            label: server.name,
            serverName: server.serverName,
            port: server.listen.port,
            sslEnabled: server.ssl.enabled,
            isSimulationSource,
          },
        });
      });

      config.locations.forEach((location, idx) => {
        const existing = prevNodes.find(n => n.id === location.id);
        const serverIdx = config.servers.findIndex(s => s.id === location.serverId);
        const isMatched = simulation.isActive && simulation.matchedLocationId === location.id;
        
        newNodes.push({
          id: location.id,
          type: 'location',
          position: existing?.position || { x: 100 + serverIdx * 300, y: 200 + (idx % 3) * 100 },
          data: {
            label: location.path,
            path: location.path,
            modifier: location.modifier,
            hasProxy: !!location.proxyPass || !!location.upstreamId,
            isMatched,
            priorityLabel: isMatched ? simulation.priorityLabel : '',
            matchReason: isMatched ? simulation.matchReason : '',
          },
        });
      });

      config.upstreams.forEach((upstream, idx) => {
        const existing = prevNodes.find(n => n.id === upstream.id);
        newNodes.push({
          id: upstream.id,
          type: 'upstream',
          position: existing?.position || { x: 500 + idx * 250, y: 400 },
          data: {
            label: upstream.name,
            serverCount: upstream.servers.length,
            strategy: upstream.strategy,
          },
        });
      });

      return newNodes;
    });
  }, [config.servers, config.locations, config.upstreams, setNodes, simulation]);

  // Sync edges when config or simulation changes
  useEffect(() => {
    const newEdges: Edge[] = [];

    config.locations.forEach(location => {
      const isMatchedEdge = simulation.isActive && 
        simulation.matchedLocationId === location.id &&
        simulation.matchedServerId === location.serverId;

      newEdges.push({
        id: `${location.serverId}-${location.id}`,
        source: location.serverId,
        target: location.id,
        style: { 
          stroke: isMatchedEdge ? 'hsl(45, 100%, 50%)' : 'hsl(160, 84%, 39%)', 
          strokeWidth: isMatchedEdge ? 4 : 2,
        },
        animated: true,
        className: isMatchedEdge ? 'simulation-edge' : '',
      });

      if (location.upstreamId) {
        newEdges.push({
          id: `${location.id}-${location.upstreamId}`,
          source: location.id,
          target: location.upstreamId,
          style: { stroke: 'hsl(38, 92%, 50%)', strokeWidth: 2 },
          animated: true,
        });
      }
    });

    setEdges(newEdges);
  }, [config.locations, setEdges, simulation]);

  const handleSimulate = useCallback((method: string, path: string) => {
    // For simplicity, we test against the first server's locations
    // In a real scenario, you might want to select a server first
    if (config.servers.length === 0) {
      setSimulation({
        isActive: true,
        matchedLocationId: null,
        matchedServerId: null,
        priorityLabel: t('simulator.noMatch'),
        matchReason: language === 'zh' ? '❌ 无 Server 配置' : '❌ No Server configured',
      });
      return;
    }

    const serverId = config.servers[0].id;
    const serverLocations = getLocationsByServerId(serverId);
    
    const result = matchLocation(path, serverLocations, language);
    
    setSimulation({
      isActive: true,
      matchedLocationId: result.matchedLocation?.id || null,
      matchedServerId: result.matchedLocation ? serverId : null,
      priorityLabel: result.priorityLabel,
      matchReason: result.matchReason,
    });

    // Auto-clear simulation after 5 seconds
    setTimeout(() => {
      setSimulation({
        isActive: false,
        matchedLocationId: null,
        matchedServerId: null,
        priorityLabel: '',
        matchReason: '',
      });
    }, 5000);
  }, [config.servers, getLocationsByServerId, language, t]);

  const onConnect = useCallback(
    (params: Connection) => {
      const sourceNode = nodes.find(n => n.id === params.source);
      const targetNode = nodes.find(n => n.id === params.target);

      // Server -> Location connection
      if (sourceNode?.type === 'server' && targetNode?.type === 'location') {
        updateLocation(params.target!, { serverId: params.source });
        // Don't manually add edge - it will be created from config sync
        return;
      }

      // Location -> Upstream connection
      if (sourceNode?.type === 'location' && targetNode?.type === 'upstream') {
        updateLocation(params.source!, { upstreamId: params.target });
        return;
      }

      // Generic edge add for other cases
      setEdges(eds => addEdge({
        ...params,
        style: { stroke: 'hsl(38, 92%, 50%)', strokeWidth: 2 },
        animated: true,
      }, eds));
    },
    [nodes, updateLocation, setEdges]
  );

  const onPaneClick = useCallback(() => {
    selectNode(null, null);
  }, [selectNode]);

  return (
    <div className="w-full h-full flex flex-col">
      <TrafficSimulator 
        onSimulate={handleSimulate}
        isSimulating={simulation.isActive}
      />
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          className="bg-canvas-background"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="hsl(222, 47%, 15%)"
          />
          <Controls />
          <MiniMap
            nodeColor={(node) => {
              switch (node.type) {
                case 'server':
                  return 'hsl(217, 91%, 60%)';
                case 'location':
                  return 'hsl(160, 84%, 39%)';
                case 'upstream':
                  return 'hsl(38, 92%, 50%)';
                default:
                  return '#666';
              }
            }}
            maskColor="hsla(222, 47%, 6%, 0.8)"
          />
        </ReactFlow>
      </div>
      
      {/* Custom CSS for simulation edge animation */}
      <style>{`
        .simulation-edge .react-flow__edge-path {
          stroke-dasharray: 10;
          animation: flowAnimation 0.5s linear infinite;
        }
        
        @keyframes flowAnimation {
          0% {
            stroke-dashoffset: 20;
          }
          100% {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </div>
  );
};

const ConfigCanvas: React.FC = () => (
  <ReactFlowProvider>
    <ConfigCanvasInner />
  </ReactFlowProvider>
);

export default ConfigCanvas;
