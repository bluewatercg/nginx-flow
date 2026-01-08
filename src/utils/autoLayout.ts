import dagre from 'dagre';
import { Node, Edge } from '@xyflow/react';

interface LayoutOptions {
  direction?: 'TB' | 'LR' | 'BT' | 'RL';
  nodeWidth?: number;
  nodeHeight?: number;
  rankSep?: number;
  nodeSep?: number;
}

export function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
): { nodes: Node[]; edges: Edge[] } {
  const {
    direction = 'TB',
    nodeWidth = 200,
    nodeHeight = 80,
    rankSep = 100,
    nodeSep = 50,
  } = options;

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ 
    rankdir: direction,
    ranksep: rankSep,
    nodesep: nodeSep,
  });

  // Add nodes to dagre graph
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { 
      width: node.type === 'server' ? 220 : node.type === 'upstream' ? 200 : nodeWidth, 
      height: node.type === 'server' ? 90 : nodeHeight,
    });
  });

  // Add edges to dagre graph
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Run layout algorithm
  dagre.layout(dagreGraph);

  // Apply positions to nodes
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const width = node.type === 'server' ? 220 : node.type === 'upstream' ? 200 : nodeWidth;
    const height = node.type === 'server' ? 90 : nodeHeight;

    return {
      ...node,
      position: {
        x: nodeWithPosition.x - width / 2,
        y: nodeWithPosition.y - height / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

// Generate nodes and edges from NginxConfig for React Flow
import { NginxConfig } from '@/types/nginx';

export function configToFlowElements(config: NginxConfig): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Create Server nodes
  config.servers.forEach((server, index) => {
    nodes.push({
      id: server.id,
      type: 'server',
      position: { x: 0, y: 0 }, // Will be calculated by layout
      data: {
        label: server.name,
        serverName: server.serverName,
        port: server.listen.port,
        sslEnabled: server.ssl.enabled,
      },
    });
  });

  // Create Location nodes and edges
  config.locations.forEach((location) => {
    nodes.push({
      id: location.id,
      type: 'location',
      position: { x: 0, y: 0 },
      data: {
        label: `${location.modifier || ''} ${location.path}`.trim(),
        path: location.path,
        modifier: location.modifier,
        isProxy: !!location.proxyPass || !!location.upstreamId,
      },
    });

    // Edge from server to location
    edges.push({
      id: `e-${location.serverId}-${location.id}`,
      source: location.serverId,
      target: location.id,
      type: 'smoothstep',
      animated: false,
    });

    // Edge from location to upstream if connected
    if (location.upstreamId) {
      edges.push({
        id: `e-${location.id}-${location.upstreamId}`,
        source: location.id,
        target: location.upstreamId,
        type: 'smoothstep',
        animated: true,
        style: { stroke: 'hsl(var(--node-upstream))' },
      });
    }
  });

  // Create Upstream nodes
  config.upstreams.forEach((upstream) => {
    nodes.push({
      id: upstream.id,
      type: 'upstream',
      position: { x: 0, y: 0 },
      data: {
        label: upstream.name,
        serverCount: upstream.servers.length,
        strategy: upstream.strategy,
      },
    });
  });

  // Apply auto layout
  return getLayoutedElements(nodes, edges, { 
    direction: 'TB',
    rankSep: 120,
    nodeSep: 60,
  });
}
