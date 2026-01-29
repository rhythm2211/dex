"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  MarkerType,
  NodeTypes,
  EdgeTypes,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { dexApi } from '@/lib/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  Info, X, Loader2, File, Code, Box, Database, AlertTriangle, CheckCircle2, 
  User, MessageSquare, AlertCircle, Bot, Send, Filter, ZoomIn, Search,
  ChevronDown, ChevronUp, Shield, Server, Package, Lock, AlertOctagon
} from 'lucide-react';

// Define nodeTypes and edgeTypes outside component to avoid React Flow warning
const nodeTypes: NodeTypes = {};

const edgeTypes: EdgeTypes = {};

// Node type icons mapping
const NODE_ICONS: Record<string, any> = {
  file: File,
  function: Code,
  class: Box,
  module: Database,
};

interface BlastRadiusGraphProps {
  nodeId: string;
  onClose?: () => void;
}

interface NodeDetails {
  id: string;
  name: string;
  type: string;
  impactType: 'source' | 'direct' | 'indirect' | 'dependency';
  last_author?: string;
  last_modified?: string;
  commit_count?: number;
  bus_risk_score?: number;
  top_owner?: string;
  risk_score?: number;
  volatility_score?: number;
  has_tests?: boolean;
  centrality_score?: number;
  node_role?: 'INFRASTRUCTURE' | 'DEPENDENCY_MANIFEST' | 'TERRAFORM' | 'CODE';
  sensitivity?: string[];
  api_route?: boolean;
  infrastructure?: boolean;
  dependency_manifest_impact?: boolean;
  [key: string]: any;
}

interface ImpactCategories {
  breaking_api_changes: Array<{id: string; name: string; risk_score: number; is_source?: boolean}>;
  data_compliance_risk: Array<{id: string; name: string; sensitivity: string[]; risk_score: number; is_source?: boolean}>;
  infrastructure_reset: Array<{id: string; name: string; risk_score: number; is_source?: boolean}>;
  logic_breakage: Array<{id: string; name: string; risk_score: number}>;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function BlastRadiusGraph({ nodeId, onClose }: BlastRadiusGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<NodeDetails | null>(null);
  const [totalRiskScore, setTotalRiskScore] = useState(0);
  const [testFiles, setTestFiles] = useState<Array<{id: string; name: string}>>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [expertRecommendations, setExpertRecommendations] = useState<Array<{name: string; files: string[]; confidence: number}>>([]);
  const [impactCategories, setImpactCategories] = useState<ImpactCategories>({
    breaking_api_changes: [],
    data_compliance_risk: [],
    infrastructure_reset: [],
    logic_breakage: []
  });
  
  // RAG Chat State
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Filter State
  const [riskFilter, setRiskFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [highlightedPath, setHighlightedPath] = useState<string[]>([]);
  const reactFlowInstance = useRef<any>(null);

  // Fetch blast radius data
  useEffect(() => {
    const fetchBlastRadius = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const data = await dexApi.getBlastRadius(nodeId);
        
        console.log('Blast radius data received:', { 
          nodeCount: data.nodes?.length || 0, 
          edgeCount: data.edges?.length || 0,
          firstNode: data.nodes?.[0],
          firstEdge: data.edges?.[0],
          fullData: data
        });
        
        if (!data.nodes || data.nodes.length === 0) {
          console.warn('No nodes found for nodeId:', nodeId);
          setError(`No dependencies found for "${nodeId}". Make sure this file exists in the codebase and has been ingested.`);
          setLoading(false);
          return;
        }
        
        // [LAYER 3] Extract risk analysis data
        setTotalRiskScore(data.total_risk_score || 0);
        setTestFiles(data.test_files || []);
        setWarnings(data.warnings || []);
        setExpertRecommendations(data.expert_recommendations || []);
        setImpactCategories(data.impact_categories || {
          breaking_api_changes: [],
          data_compliance_risk: [],
          infrastructure_reset: [],
          logic_breakage: []
        });

        // Transform API data to React Flow format with dagre layout
        // Backend already returns React Flow compatible structure, but we need to enhance it
        const transformedNodes: Node[] = data.nodes.map((node: any) => {
          // Backend returns: { id, data: { label, type, impactType, ... }, style }
          const nodeType = node.data?.type || 'file';
          const Icon = NODE_ICONS[nodeType] || File;

          const riskScore = node.data?.risk_score as number | undefined;
          let riskBg = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
          if (typeof riskScore === 'number') {
            if (riskScore >= 75) {
              riskBg = 'bg-red-500/20 text-red-300 border-red-500/40';
            } else if (riskScore >= 40) {
              riskBg = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
            }
          }
          
          // Extract new properties
          const nodeRole = node.data?.node_role as string | undefined;
          const sensitivity = node.data?.sensitivity as string[] | undefined;
          const isInfrastructure = node.data?.infrastructure || node.data?.node_role === 'INFRASTRUCTURE' || node.data?.node_role === 'DEPENDENCY_MANIFEST' || node.data?.node_role === 'TERRAFORM';
          const isDependencyManifest = node.data?.node_role === 'DEPENDENCY_MANIFEST' || node.data?.dependency_manifest_impact;
          const isApiRoute = node.data?.api_route;
          
          // Create enhanced label with icon, badges, and risk score
          const enhancedLabel = (
            <div className="flex flex-col gap-1.5 w-full">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="font-medium truncate text-sm">{node.data?.label || node.id}</span>
                </div>
                {typeof riskScore === 'number' && (
                  <span
                    className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold border flex-shrink-0 ${riskBg}`}
                  >
                    {riskScore}
                  </span>
                )}
              </div>
              
              {/* Badges for node role and sensitivity */}
              <div className="flex flex-wrap gap-1 items-center">
                {isDependencyManifest && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-red-500/30 text-red-300 border border-red-500/50 flex items-center gap-1">
                    <Package className="w-2.5 h-2.5" />
                    DEPENDENCY
                  </span>
                )}
                {isInfrastructure && !isDependencyManifest && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-orange-500/30 text-orange-300 border border-orange-500/50 flex items-center gap-1">
                    <Server className="w-2.5 h-2.5" />
                    INFRA
                  </span>
                )}
                {isApiRoute && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-purple-500/30 text-purple-300 border border-purple-500/50 flex items-center gap-1">
                    <Code className="w-2.5 h-2.5" />
                    API
                  </span>
                )}
                {sensitivity && sensitivity.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-yellow-500/30 text-yellow-300 border border-yellow-500/50 flex items-center gap-1">
                    <Shield className="w-2.5 h-2.5" />
                    {sensitivity.join(', ')}
                  </span>
                )}
              </div>
            </div>
          );
          
          // Enhanced styling for infrastructure and dependency manifest files
          let nodeStyle = { ...node.style };
          if (isDependencyManifest) {
            nodeStyle = {
              ...nodeStyle,
              border: '3px solid #ef4444',
              boxShadow: '0 0 15px rgba(239, 68, 68, 0.5)',
              background: nodeStyle.background || '#1a1a1a',
            };
          } else if (isInfrastructure) {
            nodeStyle = {
              ...nodeStyle,
              border: '2px solid #f59e0b',
              boxShadow: '0 0 10px rgba(245, 158, 11, 0.3)',
              background: nodeStyle.background || '#1a1a1a',
            };
          }
          
          // Enhanced border for high-risk sensitive files
          if (sensitivity && sensitivity.length > 0 && riskScore && riskScore >= 75) {
            nodeStyle = {
              ...nodeStyle,
              border: nodeStyle.border || '2px solid #fbbf24',
              boxShadow: '0 0 20px rgba(251, 191, 36, 0.6)',
            };
          }
          
          return {
            id: node.id || String(node.id),
            type: node.type || 'default',
            data: {
              ...node.data,
              label: enhancedLabel,
              node_role: nodeRole,
              sensitivity: sensitivity,
              api_route: isApiRoute,
              infrastructure: isInfrastructure,
              dependency_manifest_impact: isDependencyManifest,
            },
            position: node.position || { x: 0, y: 0 }, // Will be set by dagre
            style: {
              ...nodeStyle,
              width: nodeStyle?.width || 220,
              minHeight: nodeStyle?.minHeight || 60,
            },
          };
        });

        const transformedEdges: Edge[] = data.edges.map((edge: any, index: number) => ({
          id: edge.id || `edge-${index}-${edge.source}-${edge.target}`,
          source: String(edge.source),
          target: String(edge.target),
          type: edge.type || 'smoothstep',
          style: edge.style || { stroke: '#999', strokeWidth: 1.5 },
          label: edge.label ? (
            <div className="bg-amber-500/20 text-amber-300 px-2 py-1 rounded text-xs border border-amber-500/40">
              {edge.label}
            </div>
          ) : undefined,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: edge.style?.stroke || '#999',
          },
          animated: edge.animated || false,
        }));

        console.log('Transformed nodes:', transformedNodes.length, 'edges:', transformedEdges.length);
        console.log('Sample transformed node:', transformedNodes[0]);
        console.log('Sample transformed edge:', transformedEdges[0]);
        
        if (transformedNodes.length === 0) {
          console.error('No nodes after transformation!');
          setError('Failed to process graph data. Check console for details.');
          setLoading(false);
          return;
        }
        
        // Apply enhanced dagre layout
        const layouted = getLayoutedElements(transformedNodes, transformedEdges);
        
        console.log('Layouted nodes:', layouted.nodes.length, 'edges:', layouted.edges.length);
        console.log('Sample layouted node:', layouted.nodes[0]);
        
        if (layouted.nodes.length === 0) {
          console.error('No nodes after layout!');
          setError('Failed to layout graph. Check console for details.');
          setLoading(false);
          return;
        }
        
        // Even if there are no edges, we should still show the node(s)
        if (layouted.edges.length === 0 && layouted.nodes.length > 0) {
          console.warn('No edges found, but nodes exist. This might be a single isolated node or the source node with no dependencies.');
        }
        
        setNodes(layouted.nodes);
        setEdges(layouted.edges);
        
        // Force a re-render to ensure ReactFlow updates
        setTimeout(() => {
          if (reactFlowInstance.current && layouted.nodes.length > 0) {
            // Center the view on the node(s) even without edges
            reactFlowInstance.current.fitView({ 
              padding: 0.3, 
              duration: 500,
              includeHiddenNodes: false
            });
          }
        }, 1000);
        
        // Auto-fit view after layout
        setTimeout(() => {
          if (reactFlowInstance.current) {
            reactFlowInstance.current.fitView({ padding: 0.2, duration: 500 });
          }
        }, 500);
      } catch (err: any) {
        console.error('Blast radius fetch error:', err);
        setError(err.message || 'Failed to load blast radius data.');
      } finally {
        setLoading(false);
      }
    };

    if (nodeId) {
      fetchBlastRadius();
    }
  }, [nodeId]);

  // Enhanced Dagre layout with better clustering
  const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
    if (nodes.length === 0) {
      console.warn('No nodes to layout');
      return { nodes: [], edges: [] };
    }

    // Special case: single node with no edges - center it
    if (nodes.length === 1 && edges.length === 0) {
      console.log('Single node layout - centering node');
      return {
        nodes: nodes.map((node) => ({
          ...node,
          position: { x: 400, y: 300 }, // Center position
        })),
        edges: [],
      };
    }

    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    
    // Improved layout configuration
    dagreGraph.setGraph({ 
      rankdir: 'TB', // Top to Bottom (source at top, dependents below)
      nodesep: 120,  // Increased spacing
      ranksep: 180,  // Increased vertical spacing
      align: 'UL',
      ranker: 'tight-tree', // Better clustering
    });

    // Set node dimensions
    nodes.forEach((node) => {
      dagreGraph.setNode(node.id, { 
        width: node.style?.width || 220, 
        height: node.style?.minHeight || 60 
      });
    });

    // Add edges (only if both source and target exist)
    edges.forEach((edge) => {
      const sourceExists = nodes.some(n => n.id === edge.source);
      const targetExists = nodes.some(n => n.id === edge.target);
      if (sourceExists && targetExists) {
        dagreGraph.setEdge(edge.source, edge.target);
      } else {
        console.warn('Edge references missing node:', { 
          edge: edge.id, 
          source: edge.source, 
          target: edge.target,
          sourceExists,
          targetExists
        });
      }
    });

    try {
      dagre.layout(dagreGraph);

      // Apply positions
      const layoutedNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        if (!nodeWithPosition) {
          console.warn('No position found for node:', node.id);
          // Center fallback for nodes without position
          return {
            ...node,
            position: { x: 400, y: 300 },
          };
        }
        return {
          ...node,
          position: {
            x: nodeWithPosition.x - ((node.style?.width as number) || 220) / 2,
            y: nodeWithPosition.y - ((node.style?.minHeight as number) || 60) / 2,
          },
        };
      });

      return { nodes: layoutedNodes, edges };
    } catch (err) {
      console.error('Dagre layout error:', err);
      // Fallback: center nodes
      return {
        nodes: nodes.map((node, idx) => ({
          ...node,
          position: { 
            x: 400 + (idx % 3) * 250 - 250, 
            y: 300 + Math.floor(idx / 3) * 200 - 200
          },
        })),
        edges,
      };
    }
  };

  // Handle node click to show details and highlight path
  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    const nodeData = node.data as NodeDetails;
    // Extract name from label (could be string or React element)
    let nodeName = node.id;
    if (nodeData.label) {
      if (typeof nodeData.label === 'string') {
        nodeName = nodeData.label;
      } else if (nodeData.label?.props?.children) {
        const children = nodeData.label.props.children;
        if (Array.isArray(children)) {
          const textChild = children.find((c: any) => typeof c === 'string' || (c?.props?.children && typeof c.props.children === 'string'));
          nodeName = typeof textChild === 'string' ? textChild : textChild?.props?.children || node.id;
        }
      }
    }
    
    setSelectedNode({
      ...nodeData,
      id: node.id,
      name: nodeName,
      type: nodeData.type || 'file',
      impactType: nodeData.impactType || 'source',
      node_role: nodeData.node_role,
      sensitivity: nodeData.sensitivity,
      api_route: nodeData.api_route,
      infrastructure: nodeData.infrastructure,
      dependency_manifest_impact: nodeData.dependency_manifest_impact,
    });
    
    // Highlight path from source to clicked node
    if (node.id !== nodeId) {
      // Find path from source to this node
      const path = findPath(nodeId, node.id);
      setHighlightedPath(path);
    } else {
      setHighlightedPath([]);
    }
    
    // Zoom to node
    setTimeout(() => {
      if (reactFlowInstance.current) {
        reactFlowInstance.current.fitView({ 
          nodes: [{ id: node.id }], 
          padding: 0.3, 
          duration: 500 
        });
      }
    }, 100);
  }, [nodeId]);

  // Find path between two nodes using BFS
  const findPath = (startId: string, endId: string): string[] => {
    const visited = new Set<string>();
    const queue: Array<{ id: string; path: string[] }> = [{ id: startId, path: [startId] }];
    
    while (queue.length > 0) {
      const { id, path } = queue.shift()!;
      
      if (id === endId) {
        return path;
      }
      
      if (visited.has(id)) continue;
      visited.add(id);
      
      // Find neighbors
      const neighbors = edges
        .filter(e => e.source === id || e.target === id)
        .map(e => e.source === id ? e.target : e.source);
      
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          queue.push({ id: neighbor, path: [...path, neighbor] });
        }
      }
    }
    
    return [];
  };

  // Filter nodes by risk level
  const filteredNodes = useMemo(() => {
    if (riskFilter === 'all') return nodes;
    
    return nodes.filter(node => {
      const riskScore = (node.data as any)?.risk_score as number | undefined;
      if (typeof riskScore !== 'number') return riskFilter === 'low';
      
      if (riskFilter === 'high') return riskScore >= 75;
      if (riskFilter === 'medium') return riskScore >= 40 && riskScore < 75;
      if (riskFilter === 'low') return riskScore < 40;
      return true;
    });
  }, [nodes, riskFilter]);

  // Filter edges to only show connections between filtered nodes
  const filteredEdges = useMemo(() => {
    const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
    return edges.filter(e => 
      filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target)
    );
  }, [edges, filteredNodes]);

  // Handle RAG chat submission
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: chatInput,
      timestamp: new Date(),
    };
    
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setChatLoading(true);
    
    try {
      const response = await dexApi.analyzeImpact(chatInput, nodeId);
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.answer,
        timestamp: new Date(),
      };
      
      setChatMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Error: ${err.message || 'Failed to analyze impact'}`,
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setChatLoading(false);
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  // Scroll chat to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Debug: Log current state (must be before any conditional returns)
  useEffect(() => {
    console.log('Current graph state:', {
      filteredNodes: filteredNodes.length,
      filteredEdges: filteredEdges.length,
      allNodes: nodes.length,
      allEdges: edges.length,
    });
  }, [filteredNodes, filteredEdges, nodes, edges]);

  // Dynamic color legend based on risk scores
  const legendItems = [
    { color: '#000000', label: 'Source Node', bg: 'bg-black' },
    { color: '#ef4444', label: 'High Risk (75+)', bg: 'bg-red-500' },
    { color: '#f59e0b', label: 'Medium Risk (40-74)', bg: 'bg-amber-500' },
    { color: '#3b82f6', label: 'Moderate Risk (15-39)', bg: 'bg-blue-500' },
    { color: '#10b981', label: 'Low Risk (<15)', bg: 'bg-emerald-500' },
  ];

  const riskLegend = [
    { label: 'Low Risk (0-39)', bg: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' },
    { label: 'Medium Risk (40-74)', bg: 'bg-amber-500/20 border-amber-500/40 text-amber-300' },
    { label: 'High Risk (75-100)', bg: 'bg-red-500/20 border-red-500/40 text-red-300' },
  ];

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#0a0a0a]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-gray-400">Loading blast radius...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#0a0a0a]">
        <div className="flex flex-col items-center gap-4 p-6 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-red-400">{error}</p>
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <div className="w-full h-full relative bg-[#0a0a0a]" style={{ minHeight: '600px', width: '100%', height: '100%' }}>
        {filteredNodes.length === 0 && !loading && !error && nodes.length > 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]/80 z-10">
            <div className="text-center p-6 bg-[#1a1a1a] border border-white/10 rounded-lg">
              <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
              <p className="text-white mb-2">No nodes match the current filter</p>
              <p className="text-gray-400 text-sm">
                Try adjusting the risk filter in the top-left panel.
              </p>
            </div>
          </div>
        )}
        {filteredNodes.length === 0 && !loading && !error && nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]/80 z-10">
            <div className="text-center p-6 bg-[#1a1a1a] border border-white/10 rounded-lg">
              <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
              <p className="text-white mb-2">No graph data available</p>
              <p className="text-gray-400 text-sm">
                Check the browser console for debug information.
              </p>
            </div>
          </div>
        )}
        {/* Show info when we have nodes but no edges */}
        {filteredNodes.length > 0 && filteredEdges.length === 0 && !loading && !error && (
          <Panel position="top-center" className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-3 max-w-md z-20">
            <div className="flex items-center gap-2 text-blue-300 text-sm">
              <Info className="w-4 h-4" />
              <span>Found {filteredNodes.length} node(s) but no relationships. This might be an isolated file with no dependencies.</span>
            </div>
          </Panel>
        )}
        <ReactFlow
        nodes={filteredNodes}
        edges={filteredEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        connectionMode={ConnectionMode.Loose}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={(instance) => {
          reactFlowInstance.current = instance;
          // Fit view after initialization
          setTimeout(() => {
            if (filteredNodes.length > 0) {
              instance.fitView({ padding: 0.2, duration: 500 });
            }
          }, 800);
        }}
        style={{ width: '100%', height: '100%' }}
      >
        <Background color="#1a1a1a" gap={16} />
        <Controls />
        <MiniMap 
          nodeColor={(node) => {
            // Use the actual color from node style (dynamic risk-based)
            const nodeStyle = (node as any)?.style;
            if (nodeStyle?.background) {
              return nodeStyle.background;
            }
            // Fallback to risk score if color not available
            const riskScore = (node.data as any)?.risk_score;
            if (typeof riskScore === 'number') {
              if (riskScore >= 75) return '#ef4444';
              if (riskScore >= 40) return '#f59e0b';
              if (riskScore >= 15) return '#3b82f6';
              return '#10b981';
            }
            return '#6b7280'; // Default gray
          }}
          maskColor="rgba(0, 0, 0, 0.6)"
        />
        
        {/* Legend Panel */}
        <Panel position="top-left" className="bg-[#1a1a1a]/90 backdrop-blur-sm border border-white/10 rounded-lg p-4 max-w-xs">
          <div className="flex flex-col gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white mb-2">Impact Types</h3>
              {legendItems.map((item) => (
                <div key={item.color} className="flex items-center gap-2 mb-1">
                  <div className={`w-4 h-4 ${item.bg} rounded border border-white/20`} />
                  <span className="text-xs text-gray-300">{item.label}</span>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-white/10">
              <h3 className="text-sm font-semibold text-white mb-2">Risk Score</h3>
              <div className="space-y-1">
                {riskLegend.map((item) => (
                  <div
                    key={item.label}
                    className={`px-2 py-1 rounded-full text-[10px] font-medium border ${item.bg} inline-block`}
                  >
                    {item.label}
                  </div>
                ))}
              </div>
            </div>
            
            {/* Risk Filter */}
            <div className="pt-2 border-t border-white/10">
              <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                <Filter className="w-3 h-3" />
                Filter by Risk
              </h3>
              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value as any)}
                className="w-full bg-[#0a0a0a] border border-white/10 rounded px-2 py-1 text-xs text-white"
              >
                <option value="all">All Nodes</option>
                <option value="high">High Risk (75+)</option>
                <option value="medium">Medium Risk (40-74)</option>
                <option value="low">Low Risk (0-39)</option>
              </select>
            </div>
          </div>
        </Panel>

        {/* Impact Categories Panel */}
        {(impactCategories.breaking_api_changes.length > 0 || 
          impactCategories.data_compliance_risk.length > 0 || 
          impactCategories.infrastructure_reset.length > 0 || 
          impactCategories.logic_breakage.length > 0) && (
          <Panel position="top-right" className="bg-[#1a1a1a]/90 backdrop-blur-sm border border-white/10 rounded-lg p-4 max-w-sm pointer-events-auto" style={{ marginTop: '80px' }}>
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <AlertOctagon className="w-4 h-4" />
              Impact Categories
            </h3>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {impactCategories.breaking_api_changes.length > 0 && (
                <div className="bg-purple-500/10 border border-purple-500/30 rounded p-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Code className="w-3 h-3 text-purple-400" />
                    <span className="text-xs font-semibold text-purple-300">Breaking API Changes</span>
                    <span className="ml-auto text-xs text-purple-400">{impactCategories.breaking_api_changes.length}</span>
                  </div>
                  <ul className="space-y-1 mt-2">
                    {impactCategories.breaking_api_changes.slice(0, 3).map((item) => (
                      <li key={item.id} className="text-xs text-purple-200 truncate">
                        {item.name}
                        {item.is_source && <span className="ml-1 text-purple-400">(source)</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {impactCategories.data_compliance_risk.length > 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="w-3 h-3 text-yellow-400" />
                    <span className="text-xs font-semibold text-yellow-300">Data Compliance Risk</span>
                    <span className="ml-auto text-xs text-yellow-400">{impactCategories.data_compliance_risk.length}</span>
                  </div>
                  <ul className="space-y-1 mt-2">
                    {impactCategories.data_compliance_risk.slice(0, 3).map((item) => (
                      <li key={item.id} className="text-xs text-yellow-200">
                        <div className="truncate">{item.name}</div>
                        <div className="text-[10px] text-yellow-400/80 mt-0.5">
                          {item.sensitivity.join(', ')}
                          {item.is_source && <span className="ml-1">(source)</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {impactCategories.infrastructure_reset.length > 0 && (
                <div className="bg-orange-500/10 border border-orange-500/30 rounded p-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Server className="w-3 h-3 text-orange-400" />
                    <span className="text-xs font-semibold text-orange-300">Infrastructure Reset</span>
                    <span className="ml-auto text-xs text-orange-400">{impactCategories.infrastructure_reset.length}</span>
                  </div>
                  <ul className="space-y-1 mt-2">
                    {impactCategories.infrastructure_reset.slice(0, 3).map((item) => (
                      <li key={item.id} className="text-xs text-orange-200 truncate">
                        {item.name}
                        {item.is_source && <span className="ml-1 text-orange-400">(source)</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {impactCategories.logic_breakage.length > 0 && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded p-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Code className="w-3 h-3 text-blue-400" />
                    <span className="text-xs font-semibold text-blue-300">Logic Breakage</span>
                    <span className="ml-auto text-xs text-blue-400">{impactCategories.logic_breakage.length}</span>
                  </div>
                  <ul className="space-y-1 mt-2">
                    {impactCategories.logic_breakage.slice(0, 3).map((item) => (
                      <li key={item.id} className="text-xs text-blue-200 truncate">
                        {item.name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Panel>
        )}

        {/* Critical Warnings Panel - Show prominently for dependency manifests */}
        {(warnings.some(w => w.includes('DEPENDENCY_MANIFEST') || w.includes('ENTIRE repository')) || 
          impactCategories.infrastructure_reset.length > 0 || 
          impactCategories.data_compliance_risk.length > 0) && (
          <Panel position="top-center" className="bg-red-500/20 border-2 border-red-500/50 rounded-lg p-4 max-w-2xl z-30">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-red-300 mb-2">Critical Impact Warning</h3>
                <div className="space-y-2 text-xs text-red-200">
                  {warnings.filter(w => w.includes('DEPENDENCY_MANIFEST') || w.includes('ENTIRE repository')).map((warning, idx) => (
                    <p key={idx} className="flex items-start gap-2">
                      <span className="text-red-400 mt-0.5">•</span>
                      <span>{warning}</span>
                    </p>
                  ))}
                  {impactCategories.infrastructure_reset.length > 0 && (
                    <p className="flex items-start gap-2">
                      <span className="text-red-400 mt-0.5">•</span>
                      <span>Infrastructure changes detected: {impactCategories.infrastructure_reset.length} file(s) will require infrastructure updates.</span>
                    </p>
                  )}
                  {impactCategories.data_compliance_risk.length > 0 && (
                    <p className="flex items-start gap-2">
                      <span className="text-red-400 mt-0.5">•</span>
                      <span>Data compliance risk: {impactCategories.data_compliance_risk.length} file(s) handle sensitive data (PII/AUTH/FINANCE).</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          </Panel>
        )}

        {/* [LAYER 3] Smart CI Checklist */}
        {(testFiles.length > 0 || warnings.length > 0) && (
          <Panel position="bottom-left" className="bg-[#1a1a1a]/90 backdrop-blur-sm border border-white/10 rounded-lg p-4 max-w-md">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Smart CI Checklist
            </h3>
            <div className="space-y-3">
              {testFiles.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-2">Run these test files:</p>
                  <ul className="space-y-1">
                    {testFiles.slice(0, 5).map((test) => (
                      <li key={test.id} className="text-xs text-green-300 flex items-center gap-2">
                        <CheckCircle2 className="w-3 h-3" />
                        <code className="bg-green-500/10 px-2 py-0.5 rounded">{test.name}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {warnings.filter(w => !w.includes('DEPENDENCY_MANIFEST') && !w.includes('ENTIRE repository')).length > 0 && (
                <div>
                  <p className="text-xs text-amber-400 mb-2 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Warnings:
                  </p>
                  <ul className="space-y-1">
                    {warnings.filter(w => !w.includes('DEPENDENCY_MANIFEST') && !w.includes('ENTIRE repository')).map((warning, idx) => (
                      <li key={idx} className="text-xs text-amber-300">
                        {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Panel>
        )}

        {/* [LAYER 3] Human Routing Sidebar */}
        {expertRecommendations.length > 0 && (
          <Panel position="bottom-right" className="bg-[#1a1a1a]/90 backdrop-blur-sm border border-white/10 rounded-lg p-4 max-w-sm">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <User className="w-4 h-4" />
              Human Routing
            </h3>
            <div className="space-y-3">
              {expertRecommendations.map((expert, idx) => (
                <div key={idx} className="bg-blue-500/10 border border-blue-500/20 rounded p-2">
                  <p className="text-xs text-gray-400 mb-1">
                    You are changing <code className="text-blue-300">{nodeId.split('/').pop()}</code>
                  </p>
                  <p className="text-xs text-amber-300 mb-2">
                    ⚠️ You have never edited this file.
                  </p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">{expert.name}</p>
                      <p className="text-xs text-gray-400">Expert ({Math.round(expert.confidence)}% ownership)</p>
                    </div>
                    <button className="px-3 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded text-xs flex items-center gap-1 transition-colors">
                      <MessageSquare className="w-3 h-3" />
                      Slack
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {/* RAG Chat Toggle Button */}
        <Panel position="top-right" className="pointer-events-none">
          <button
            onClick={() => setChatOpen(!chatOpen)}
            className="pointer-events-auto bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition-all font-medium flex items-center gap-2 shadow-lg"
          >
            <Bot className="w-4 h-4" />
            {chatOpen ? 'Hide' : 'Ask AI'} Impact Analysis
          </button>
        </Panel>

        {/* Node Details Side Panel */}
        {selectedNode && (
          <Panel position="top-right" className="bg-[#1a1a1a]/90 backdrop-blur-sm border border-white/10 rounded-lg p-4 max-w-sm pointer-events-auto">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Info className="w-4 h-4" />
                Node Details
              </h3>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-gray-400">Name:</span>
                <p className="text-white font-medium mt-1">{selectedNode.name}</p>
              </div>
              
              <div>
                <span className="text-gray-400">Type:</span>
                <p className="text-white mt-1 capitalize">{selectedNode.type}</p>
              </div>
              
              <div>
                <span className="text-gray-400">Impact Type:</span>
                <p className="text-white mt-1 capitalize">
                  <span className={`px-2 py-1 rounded ${
                    selectedNode.impactType === 'source' ? 'bg-black text-white' :
                    selectedNode.impactType === 'direct' ? 'bg-red-500/20 text-red-400' :
                    selectedNode.impactType === 'dependency' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-orange-500/20 text-orange-400'
                  }`}>
                    {selectedNode.impactType}
                  </span>
                </p>
              </div>
              
              {selectedNode.hop_distance !== undefined && (
                <div>
                  <span className="text-gray-400">Hop Distance:</span>
                  <p className="text-white mt-1">{selectedNode.hop_distance}</p>
                </div>
              )}
              
              {selectedNode.last_author && (
                <div>
                  <span className="text-gray-400">Last Author:</span>
                  <p className="text-white mt-1">{selectedNode.last_author}</p>
                </div>
              )}
              
              {selectedNode.node_role && (
                <div>
                  <span className="text-gray-400">Node Role:</span>
                  <p className="text-white mt-1">
                    <span className={`px-2 py-1 rounded text-xs ${
                      selectedNode.node_role === 'DEPENDENCY_MANIFEST' ? 'bg-red-500/20 text-red-300 border border-red-500/40' :
                      selectedNode.node_role === 'INFRASTRUCTURE' ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40' :
                      selectedNode.node_role === 'TERRAFORM' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                      'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                    }`}>
                      {selectedNode.node_role}
                    </span>
                  </p>
                </div>
              )}

              {selectedNode.sensitivity && selectedNode.sensitivity.length > 0 && (
                <div>
                  <span className="text-gray-400">Sensitivity Tags:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedNode.sensitivity.map((tag: string) => (
                      <span key={tag} className="px-2 py-0.5 rounded text-xs bg-yellow-500/20 text-yellow-300 border border-yellow-500/40">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedNode.api_route && (
                <div>
                  <span className="text-gray-400">API Route:</span>
                  <p className="text-white mt-1">
                    <span className="px-2 py-1 rounded text-xs bg-purple-500/20 text-purple-300 border border-purple-500/40">
                      Yes - Breaking API Change Risk
                    </span>
                  </p>
                </div>
              )}

              {selectedNode.infrastructure && (
                <div>
                  <span className="text-gray-400">Infrastructure:</span>
                  <p className="text-white mt-1">
                    <span className="px-2 py-1 rounded text-xs bg-orange-500/20 text-orange-300 border border-orange-500/40">
                      Infrastructure File - High Impact
                    </span>
                  </p>
                </div>
              )}

              {selectedNode.risk_score !== undefined && (
                <div>
                  <span className="text-gray-400">Impact Risk Score:</span>
                  <p className="text-white mt-1">{selectedNode.risk_score} / 100</p>
                </div>
              )}

              {selectedNode.volatility_score !== undefined && (
                <div>
                  <span className="text-gray-400">Volatility (6m):</span>
                  <p className="text-white mt-1">{(selectedNode.volatility_score * 100).toFixed(0)}%</p>
                </div>
              )}

              {selectedNode.has_tests !== undefined && (
                <div>
                  <span className="text-gray-400">Test Coverage:</span>
                  <p className="text-white mt-1">
                    {selectedNode.has_tests ? 'Has associated tests' : 'No tests linked to this node'}
                  </p>
                </div>
              )}
              
              {selectedNode.top_owner && (
                <div>
                  <span className="text-gray-400">Top Owner:</span>
                  <p className="text-white mt-1">{selectedNode.top_owner}</p>
                </div>
              )}
            </div>
          </Panel>
        )}
      </ReactFlow>

      {/* RAG Chat Panel */}
      {chatOpen && (
        <div className="absolute bottom-4 right-4 w-96 h-[500px] bg-[#1a1a1a]/95 backdrop-blur-sm border border-white/10 rounded-lg shadow-2xl flex flex-col z-50">
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Bot className="w-4 h-4" />
              AI Impact Analysis
            </h3>
            <button
              onClick={() => setChatOpen(false)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {chatMessages.length === 0 && (
              <div className="text-center text-gray-400 text-sm py-8">
                <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Ask me about code changes and their impact!</p>
                <div className="mt-4 space-y-2 text-xs text-left">
                  <p className="text-gray-500">Try asking:</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-400">
                    <li>"If I change lines 10-20, how would other files get impacted?"</li>
                    <li>"What would break if I modify this file?"</li>
                    <li>"Which test files should I run?"</li>
                  </ul>
                </div>
              </div>
            )}
            
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-[#0a0a0a] border border-white/10 text-gray-300'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-invert prose-sm max-w-none text-gray-300">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}
            
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-[#0a0a0a] border border-white/10 rounded-lg p-3">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                </div>
              </div>
            )}
            
            <div ref={chatEndRef} />
          </div>
          
          <form onSubmit={handleChatSubmit} className="p-4 border-t border-white/10">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about code changes and impact..."
                className="flex-1 bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                disabled={chatLoading}
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || chatLoading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      )}

        {/* Close button */}
        {onClose && (
          <div className="absolute top-4 right-4 z-10">
            <button
              onClick={onClose}
              className="p-2 bg-[#1a1a1a]/90 hover:bg-[#2a2a2a] border border-white/10 rounded-lg text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </ReactFlowProvider>
  );
}
