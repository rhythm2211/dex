"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { dexApi, GraphData } from '@/lib/api';
import {
  RefreshCw, Terminal,
  Folder, File, Box, Code, Database, FileCode,
  ChevronRight, ChevronDown, ChevronLeft, Move, LayoutTemplate,
  LogOut, User, X, HelpCircle, Download, Settings,
  Sparkles, GitBranch
} from 'lucide-react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import * as d3 from 'd3';
import { jsPDF } from 'jspdf';
import dynamic from 'next/dynamic';
import MobileWarning from '@/components/MobileWarning';
import { PromptInputBox } from '@/components/ui/ai-prompt-box';

const FocusedGraphPanel = dynamic(
  () => import('@/components/focused-graph/FocusedGraphPanel'),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-full text-[12px]" style={{ color: 'var(--text-muted)' }}>Loading…</div> }
);

// -----------------------------------------------------------------------------
// Visual Config & Color Palette
// -----------------------------------------------------------------------------
const BRANCH_COLORS = [
  '#ef4444', // Red (Server/Core)
  '#f59e0b', // Amber (Client/UI)
  '#8b5cf6', // Violet (Config/Scripts)
  '#ec4899', // Pink
  '#10b981', // Emerald
  '#3b82f6', // Blue
];

const NODE_CONFIG: any = {
  folder:   { icon: Folder,   label: 'Directory', color: '#f59e0b' }, // Amber
  file:     { icon: File,     label: 'File',      color: '#3b82f6' }, // Blue
  class:    { icon: Box,      label: 'Class',     color: '#8b5cf6' }, // Violet
  function: { icon: Code,     label: 'Function',  color: '#10b981' }, // Emerald
  module:   { icon: Database, label: 'Module',    color: '#ec4899' }, // Pink
  default:  { icon: FileCode, label: 'Asset',     color: '#64748b' }  // Slate
};

/** Match root layout Geist stack so D3/SVG text isn’t a different system face */
const FONT_UI_SANS =
  'var(--font-geist-sans), ui-sans-serif, system-ui, -apple-system, sans-serif';

// -----------------------------------------------------------------------------
// Data Helpers (Graph -> Tree Conversion)
// -----------------------------------------------------------------------------

const assignBranchColors = (node: any, colorIndex = 0, depth = 0) => {
    if (depth === 0 && node.children) {
        node.children.forEach((child: any, index: number) => {
            const color = BRANCH_COLORS[index % BRANCH_COLORS.length];
            child.attributes.branchColor = color;
            assignBranchColors(child, 0, depth + 1);
        });
        return;
    }

    if (node.children) {
        node.children.forEach((child: any) => {
            child.attributes.branchColor = node.attributes.branchColor;
            assignBranchColors(child, 0, depth + 1);
        });
    }
};

// Build a strict filesystem-style hierarchy:
// ROOT (repository)
//   -> Folder (top-level, from first path segment)
//     -> File (code file, e.g. .py / .ts)
//       -> Function/Class (defined in that file)
const buildHierarchy = (nodes: any[], _links: any[]) => {
    if (!nodes.length) return null;

    const root: any = {
        name: 'Repository',
        attributes: { type: 'root', id: 'root' },
        children: [] as any[],
    };

    const folderMap = new Map<string, any>();
    const fileNodeMap = new Map<string, any>(); // fileId -> tree node

    const allNodes = nodes || [];

    // 1) Attach files under their top-level folder (no folder->folder links)
    allNodes
        .filter((n: any) => (n.type || '').toLowerCase() === 'file')
        .forEach((file: any) => {
            const rawId = String(file.id || '');
            const pathSepIndex = Math.max(rawId.indexOf('/'), rawId.indexOf('\\'));

            const folderName =
                pathSepIndex > 0 ? rawId.slice(0, pathSepIndex) : '__root__';

            let folderNode = folderMap.get(folderName);
            if (!folderNode) {
                folderNode = {
                    name: folderName === '__root__' ? 'root_files' : folderName,
                    attributes: {
                        id: `folder:${folderName}`,
                        type: 'folder',
                    },
                    children: [] as any[],
                };
                folderMap.set(folderName, folderNode);
                root.children.push(folderNode);
            }

            const fileTreeNode: any = {
                name: file.name || rawId,
                attributes: {
                    ...file,
                    id: file.id,
                    type: 'file',
                },
                children: [] as any[],
            };

            folderNode.children.push(fileTreeNode);
            fileNodeMap.set(file.id, fileTreeNode);
        });

    // 2) Attach functions/classes strictly under their defining file
    allNodes
        .filter((n: any) => {
            const t = (n.type || '').toLowerCase();
            return t === 'function' || t === 'class';
        })
        .forEach((fnNode: any) => {
            const rawId = String(fnNode.id || '');
            const fileId = rawId.split('::')[0]; // our ingestion uses file_path::something

            const parentFileTreeNode = fileNodeMap.get(fileId);
            if (!parentFileTreeNode) return; // if we can't find the file, skip to avoid illegal edges

            const childTreeNode: any = {
                name: fnNode.name || rawId,
                attributes: {
                    ...fnNode,
                    id: fnNode.id,
                    type: (fnNode.type || '').toLowerCase(),
                },
                children: [] as any[],
            };

            parentFileTreeNode.children.push(childTreeNode);
        });

    assignBranchColors(root);
    return root;
};

const buildParentMapFromHierarchy = (root: any | null) => {
    const map = new Map<string, string>();
    if (!root) return map;

    const walk = (node: any, parentId: string | null) => {
        const nodeId = node.attributes?.id;
        if (nodeId && parentId) {
            map.set(nodeId, parentId);
        }
        if (Array.isArray(node.children)) {
            node.children.forEach((child: any) => walk(child, nodeId || parentId));
        }
    };

    walk(root, null);
    return map;
};

export default function Dashboard() {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const { data: session, status } = useSession();
  const router = useRouter();

  // ---------------------------------------------------------------------------
  // Authentication Check - Redirect if not authenticated
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?redirect=/app');
    }
  }, [status, router]);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [ragResult, setRagResult] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<Array<{query: string, answer: string, timestamp: Date}>>([]);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [repoUrl, setRepoUrl] = useState('');
  const [ingesting, setIngesting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState('');
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [graphViewMode, setGraphViewMode] = useState<'full' | 'focused'>('full');
  const graphReady = !ingesting && graphData.nodes.length > 0;

  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'assistant' | 'details'>('assistant');
  const [showHelpGuide, setShowHelpGuide] = useState(false);
  const [showFocusChat, setShowFocusChat] = useState(false);
  // ── Theme & panel state
  type Theme = 'graphite' | 'obsidian' | 'midnight';
  const [theme, setTheme] = useState<Theme>('graphite');
  const [leftOpen, setLeftOpen] = useState(true);
  const leftExpandedW = 360;
  const leftCollapsedW = 48;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const s = localStorage.getItem('dex-theme') as Theme|null; if(s && ['graphite','obsidian','midnight'].includes(s)) setTheme(s); }, []);
  useEffect(() => { localStorage.setItem('dex-theme', theme); }, [theme]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const s = localStorage.getItem('dex-left-open'); if(s === 'false') setLeftOpen(false); }, []);
  const toggleLeft = () => setLeftOpen(o => { const n = !o; localStorage.setItem('dex-left-open', String(n)); return n; });


  const [pathSet, setPathSet] = useState<Set<string>>(new Set());
  const [treeOrientation, setTreeOrientation] = useState<'vertical' | 'horizontal'>('horizontal');

  const handleGraphViewMode = useCallback((mode: 'full' | 'focused') => {
    if (mode === 'full' && graphViewMode === 'focused') {
      setTreeOrientation('vertical');
    }
    setGraphViewMode(mode);
  }, [graphViewMode]);

  // Lazy loading state
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [loadedChildren, setLoadedChildren] = useState<Map<string, GraphData>>(new Map());
  const [loadingNodes, setLoadingNodes] = useState<Set<string>>(new Set());
  const [nodeChildCounts, setNodeChildCounts] = useState<Map<string, number>>(new Map());
  const [hasAutoExpanded, setHasAutoExpanded] = useState(false);
  
  // Refs for synchronous checks in event handlers
  const loadedChildrenRef = useRef<Map<string, GraphData>>(new Map());
  const loadingNodesRef = useRef<Set<string>>(new Set());

  // Keep refs in sync with state
  useEffect(() => {
    loadedChildrenRef.current = loadedChildren;
  }, [loadedChildren]);
  
  useEffect(() => {
    loadingNodesRef.current = loadingNodes;
  }, [loadingNodes]);

  // D3 Refs
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<SVGGElement>(null);
  // FIX: Define treeContainer ref
  const treeContainer = useRef<HTMLDivElement>(null);

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------
  useEffect(() => { setMounted(true); }, []);

  // Build hierarchy with lazy loading support
  const hierarchyData = useMemo(() => {
    // Merge lazy-loaded nodes into main graph data
    const allNodes = [...graphData.nodes];
    const allLinks = [...graphData.links];
    
    // Add lazy-loaded nodes and links
    loadedChildren.forEach((childrenData, nodeId) => {
      // Add children nodes that aren't already in the graph
      childrenData.nodes.forEach((childNode: any) => {
        if (!allNodes.find((n: any) => n.id === childNode.id)) {
          allNodes.push(childNode);
        }
      });
      // Add children links
      childrenData.links.forEach((link: any) => {
        if (!allLinks.find((l: any) => l.source === link.source && l.target === link.target)) {
          allLinks.push(link);
        }
      });
    });
    
    const hierarchy = buildHierarchy(allNodes, allLinks);
    
    // Return early if hierarchy is null/undefined
    if (!hierarchy) {
      return null;
    }
    
    // Enhance hierarchy with child counts and mark collapsed nodes
    const enhanceNode = (node: any): any => {
      // Handle null/undefined nodes
      if (!node) return null;
      
      // Handle both d3.hierarchy structure (node.data) and our custom structure (node.attributes)
      const nodeData = node.data || node;
      const nodeId = nodeData?.attributes?.id || nodeData?.id;
      if (!nodeId) return node;
      
      // Ensure node.data exists for d3.hierarchy structure
      if (!node.data) {
        node.data = nodeData;
      }
      
      // Mark as collapsed if not expanded (but has children)
      // Special case: root node is always expanded
      if (nodeId !== 'root' && !expandedNodes.has(nodeId) && node.children && node.children.length > 0) {
        node._children = node.children;
        node.children = null;
      }
      
      // Add child count metadata
      const childCount = nodeChildCounts.get(nodeId);
      if (childCount !== undefined) {
        node.data._childCount = childCount;
      } else if (node.children) {
        node.data._childCount = node.children.length;
      } else if (node._children) {
        node.data._childCount = node._children.length;
      }
      
      // Recursively enhance children (filter out nulls)
      if (node.children && Array.isArray(node.children)) {
        node.children = node.children
          .map(enhanceNode)
          .filter((n: any) => n !== null && n !== undefined);
      }
      if (node._children && Array.isArray(node._children)) {
        node._children = node._children
          .map(enhanceNode)
          .filter((n: any) => n !== null && n !== undefined);
      }
      
      return node;
    };
    
    return enhanceNode(hierarchy);
  }, [graphData, expandedNodes, loadedChildren, nodeChildCounts]);
  
  const parentMap = useMemo(
    () => buildParentMapFromHierarchy(hierarchyData),
    [hierarchyData]
  );
  
  // Load children for a node
  const loadNodeChildren = useCallback(async (nodeId: string) => {
    // Check if already loading or loaded (using refs for synchronous check)
    if (loadingNodesRef.current.has(nodeId) || loadedChildrenRef.current.has(nodeId)) {
      return; // Already loading or loaded
    }
    
    // Mark as loading
    setLoadingNodes(prev => new Set(prev).add(nodeId));
    loadingNodesRef.current.add(nodeId);
    
    try {
      const childrenData = await dexApi.expandGraphNode(nodeId);
      setLoadedChildren(prev => {
        const newMap = new Map(prev);
        newMap.set(nodeId, childrenData);
        loadedChildrenRef.current = newMap; // Update ref
        return newMap;
      });
      
      // Update child count
      if (childrenData.nodes.length > 0) {
        setNodeChildCounts(prev => {
          const newMap = new Map(prev);
          newMap.set(nodeId, childrenData.nodes.length);
          return newMap;
        });
      }
    } catch (error) {
      console.error(`Failed to load children for node ${nodeId}:`, error);
    } finally {
      setLoadingNodes(prev => {
        const newSet = new Set(prev);
        newSet.delete(nodeId);
        loadingNodesRef.current = newSet; // Update ref
        return newSet;
      });
    }
  }, []); // No dependencies needed - using functional updates

  // Store loadNodeChildren in ref to avoid dependency issues
  const loadNodeChildrenRef = useRef(loadNodeChildren);
  useEffect(() => {
    loadNodeChildrenRef.current = loadNodeChildren;
  }, [loadNodeChildren]);

  // Auto-expand root node and first 3-5 children on initial load
  useEffect(() => {
    if (!hierarchyData || hasAutoExpanded || graphData.nodes.length === 0) return; // Only run once when hierarchy is first built
    
    // Get the root node - it could be in different structures
    const rootNode = hierarchyData;
    if (!rootNode) {
      setHasAutoExpanded(true);
      return;
    }
    
    // Expand root node first (always)
    const nodesToExpand = new Set<string>(['root']);
    
    // Get children - check both children and _children (collapsed)
    // The hierarchy might have children in _children if they were collapsed
    const rootChildren = (rootNode.children || rootNode._children || []);
    
    if (rootChildren.length === 0) {
      setHasAutoExpanded(true);
      setExpandedNodes(nodesToExpand);
      return;
    }
    
    // Expand first 3-5 children of root (folders)
    const numToExpand = Math.min(5, Math.max(3, rootChildren.length));
    const childrenToExpand = rootChildren.slice(0, numToExpand);
    
    childrenToExpand.forEach((child: any) => {
      // Try multiple ways to get the node ID
      const childId = child.attributes?.id || 
                     child.data?.attributes?.id || 
                     child.data?.id ||
                     (child.data && typeof child.data === 'object' && 'id' in child.data ? child.data.id : null);
      
      if (childId) {
        nodesToExpand.add(String(childId));
        console.log('[Auto-expand] Adding node to expand:', childId, 'name:', child.name || child.data?.name);
      } else {
        console.warn('[Auto-expand] Could not find ID for child:', child);
      }
    });
    
    console.log('[Auto-expand] Expanding nodes:', Array.from(nodesToExpand), 'from', rootChildren.length, 'total children');
    setExpandedNodes(nodesToExpand);
    setHasAutoExpanded(true);
    
    // Load children for expanded nodes if they have lazy-loaded children
    // Use ref to avoid dependency issues
    childrenToExpand.forEach((child: any) => {
      const childId = child.attributes?.id || 
                     child.data?.attributes?.id || 
                     child.data?.id ||
                     (child.data && typeof child.data === 'object' && 'id' in child.data ? child.data.id : null);
      
      if (childId) {
        const childCount = child.data?._childCount || child._childCount || (child.children?.length) || (child._children?.length) || 0;
        if (childCount > 0) {
          console.log('[Auto-expand] Loading children for:', childId, 'count:', childCount);
          loadNodeChildrenRef.current(String(childId));
        }
      }
    });
  }, [hierarchyData, hasAutoExpanded, graphData.nodes.length, loadNodeChildren]);

  // ---------------------------------------------------------------------------
  // API
  // ---------------------------------------------------------------------------
  const loadGraph = useCallback(async () => { 
    const data = await dexApi.getGraphData(); 
    if(data?.nodes?.length) {
      setGraphData(data);
      // Reset auto-expand flag when new graph data loads
      setHasAutoExpanded(false);
      setExpandedNodes(new Set()); // Clear previous expansions
    }
  }, []);

  // Store callbacks in refs to avoid dependency issues
  const loadGraphRef = useRef(loadGraph);
  useEffect(() => {
    loadGraphRef.current = loadGraph;
  }, [loadGraph]);

  const pollIngestion = useCallback(() => {
    const i = setInterval(async () => {
        try {
            const s = await dexApi.getIngestStatus();
            if (!s) return;
            setProgress(s.progress);
            setStep(s.step);
            if (s.state === 'completed') {
                clearInterval(i);
                setIngesting(false);
                setPollInterval(null);
                pollIntervalRef.current = null;
                loadGraphRef.current();
            }
            if (s.state === 'cancelled') {
                clearInterval(i);
                setIngesting(false);
                setPollInterval(null);
                pollIntervalRef.current = null;
            }
            if (s.state === 'error') {
                clearInterval(i);
                setIngesting(false);
                setPollInterval(null);
                pollIntervalRef.current = null;
            }
        } catch(e) {}
    }, 1000);
    return i; // Return interval ID so we can clear it
  }, []);

  // Store pollIngestion in ref
  const pollIngestionRef = useRef(pollIngestion);
  useEffect(() => {
    pollIngestionRef.current = pollIngestion;
  }, [pollIngestion]);

  useEffect(() => {
    if (status !== 'authenticated') return;

    let alive = true;

    dexApi.getIngestStatus().then(s => {
        if (!alive || !s) return;
        if (s.state === 'running') {
            setIngesting(true);
            const interval = pollIngestionRef.current();
            setPollInterval(interval);
            pollIntervalRef.current = interval;
        } else if (s.state === 'completed') {
            loadGraphRef.current();
        }
    }).catch(() => {});
    loadGraphRef.current();

    return () => {
        alive = false;
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }
    };
  }, [status]);

  const handleIngest = async () => {
      setIngesting(true); setGraphData({ nodes: [], links: [] });
      try { 
          await dexApi.triggerIngestion(repoUrl); 
          const interval = pollIngestion();
          setPollInterval(interval);
          pollIntervalRef.current = interval;
      } catch (err: any) { 
          console.error("Ingestion error:", err);
          // 409 means an ingestion task is already running for this user.
          // Treat this as a resumable state: attach UI polling to the running job.
          if (err?.message?.toLowerCase?.().includes("already running") || err?.response?.status === 409) {
              setIngesting(true);
              setStep("Ingestion already running. Reattaching...");
              const interval = pollIngestion();
              setPollInterval(interval);
              pollIntervalRef.current = interval;
          } else {
              setIngesting(false);
              alert(`Ingestion failed: ${err?.message || "Unknown error"}`);
          }
      }
  };

  const handleCancel = async () => {
      try {
          await dexApi.cancelIngestion();
          if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
          }
          if (pollInterval) {
              clearInterval(pollInterval);
          }
          setPollInterval(null);
          setIngesting(false);
          setStep("Cancelled");
      } catch (err: any) {
          console.error("Cancel error:", err);
          alert(`Failed to cancel ingestion: ${err?.message || "Unknown error"}`);
      }
  };

  const handleExecute = async (manualQuery?: string) => {
      const text = manualQuery || query;
      if(!text) return;
      if(manualQuery) setQuery(manualQuery);

      setLoading(true);
      try {
        const res = await dexApi.queryRAG(text);
        const timestamp = new Date();
        
        // Add to chat history
        setChatHistory(prev => [...prev, {
          query: text,
          answer: res.answer,
          timestamp
        }]);
        
        setRagResult(res.answer);
        setQuery(''); // Clear input after successful query
      } catch (error) {
        console.error('Query failed:', error);
      } finally {
        setLoading(false);
        setActiveTab('assistant');
      }
  };

  // ---------------------------------------------------------------------------
  // Interaction
  // ---------------------------------------------------------------------------
  const handleNodeClick = useCallback((nodeAttributes: any) => {
      setSelectedNode(nodeAttributes);

      const newPath = new Set<string>();
      let currentId = nodeAttributes.id;
      newPath.add(currentId);
      while (currentId && parentMap.has(currentId)) {
          const parentId = parentMap.get(currentId);
          if (parentId) { newPath.add(parentId); currentId = parentId; }
          else break;
      }
      setPathSet(newPath);
  }, [parentMap]);

  const handleNodeChat = useCallback((nodeAttributes: any) => {
      handleNodeClick(nodeAttributes);
      const prompt = `Explain more about the path to the selected node: "${nodeAttributes.name}"`;
      handleExecute(prompt);
  }, [handleNodeClick]);

  const handleDownloadChat = () => {
    if (chatHistory.length === 0) {
      alert('No chat history to download');
      return;
    }

    const sessionDate = new Date().toISOString().split('T')[0];
    
    // Create PDF with logo matching the app design
    const createPDF = () => {
      const doc = new jsPDF();
      
      // Dark theme colors matching the app
      const darkBg = [10, 10, 10]; // #0A0A0A
      const darkerBg = [5, 5, 5]; // #050505
      const indigoColor = [99, 102, 241]; // Indigo-500
      const indigoLight = [129, 140, 248]; // Indigo-400
      const emeraldColor = [16, 185, 129]; // Emerald-500
      const slateColor = [148, 163, 184]; // Slate-400
      const slateDark = [100, 116, 139]; // Slate-500
      const whiteColor = [255, 255, 255];
      const borderColor = [255, 255, 255, 0.1]; // white/10
      
      // Get username from session
      const userName = session?.user?.name || session?.user?.email?.split('@')[0] || 'User';
      
      // Helper function to strip markdown and convert to plain text
      const stripMarkdown = (text: string): string => {
      return text
        .replace(/#{1,6}\s+/g, '') // Remove headers
        .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
        .replace(/\*(.*?)\*/g, '$1') // Remove italic
        .replace(/`([^`]+)`/g, '$1') // Remove inline code
        .replace(/```[\s\S]*?```/g, (match) => {
          // Preserve code blocks but format them
          return match.replace(/```[\w]*\n?/g, '').trim();
        })
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Remove links, keep text
        .replace(/\n{3,}/g, '\n\n') // Remove excessive newlines
        .trim();
      };

      // Helper function to split text into lines that fit the page width
      const splitText = (text: string, maxWidth: number): string[] => {
      const lines: string[] = [];
      const paragraphs = text.split('\n\n');
      
      paragraphs.forEach((paragraph, pIndex) => {
        if (paragraph.trim() === '') {
          if (pIndex < paragraphs.length - 1) {
            lines.push('');
          }
          return;
        }
        
        const words = paragraph.trim().split(/\s+/);
        let currentLine = '';

        words.forEach(word => {
          const testLine = currentLine + (currentLine ? ' ' : '') + word;
          const testWidth = doc.getTextWidth(testLine);
          
          if (testWidth > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        });
        
        if (currentLine) {
          lines.push(currentLine);
        }
        
        // Add spacing between paragraphs (except last)
        if (pIndex < paragraphs.length - 1 && paragraph.trim()) {
          lines.push('');
        }
      });
      
      return lines;
    };

    // Page dimensions
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    const lineHeight = 6;
    const sectionSpacing = 8;
    let yPosition = margin;

    // Set dark background for entire page
    doc.setFillColor(darkBg[0], darkBg[1], darkBg[2]);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    // Header section with logo area
    const headerHeight = 60;
    doc.setFillColor(darkerBg[0], darkerBg[1], darkerBg[2]);
    doc.rect(0, 0, pageWidth, headerHeight, 'F');
    
    // DEX text logo
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(whiteColor[0], whiteColor[1], whiteColor[2]);
    doc.text('DEX', margin, 32);
    
    // Personalized greeting
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(slateColor[0], slateColor[1], slateColor[2]);
    doc.text(`Hi ${userName},`, margin + 35, 42);
    
    doc.setFontSize(9);
    doc.text('here is the transcript from your last session', margin + 35, 48);
    
    // Session info on the right
    doc.setFontSize(8);
    doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
    doc.text(`Session: ${sessionDate}`, pageWidth - margin, 25, { align: 'right' });
    const messageCountText = `${chatHistory.length} ${chatHistory.length === 1 ? 'message' : 'messages'}`;
    doc.text(messageCountText, pageWidth - margin, 32, { align: 'right' });
    
    yPosition = 70;

    // Content
    chatHistory.forEach((entry, index) => {
      const queryText = stripMarkdown(entry.query);
      const answerText = stripMarkdown(entry.answer);
      const timestamp = entry.timestamp.toLocaleString();

      // Check if we need a new page before starting a new message
      if (yPosition > pageHeight - 80) {
        doc.addPage();
        // Set dark background for new page
        doc.setFillColor(darkBg[0], darkBg[1], darkBg[2]);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
        yPosition = margin;
      }

      // Message number and timestamp header
      doc.setFontSize(8);
      doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
      doc.setFont('helvetica', 'italic');
      const headerText = `Message ${index + 1} • ${timestamp}`;
      doc.text(headerText, margin, yPosition);
      yPosition += sectionSpacing;

      // Question section with dark theme styling
      if (yPosition > pageHeight - 60) {
        doc.addPage();
        doc.setFillColor(darkBg[0], darkBg[1], darkBg[2]);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
        yPosition = margin;
      }

      const questionHeaderHeight = 8;
      // Dark background with indigo border
      doc.setFillColor(darkerBg[0], darkerBg[1], darkerBg[2]);
      doc.setGState(doc.GState({ opacity: 0.6 }));
      doc.roundedRect(margin, yPosition - 2, contentWidth, questionHeaderHeight, 2, 2, 'F');
      doc.setGState(doc.GState({ opacity: 1 }));
      
      // Indigo border
      doc.setDrawColor(indigoColor[0], indigoColor[1], indigoColor[2]);
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, yPosition - 2, contentWidth, questionHeaderHeight, 2, 2);
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(indigoLight[0], indigoLight[1], indigoLight[2]);
      doc.text('Question', margin + 4, yPosition + 4);
      
      yPosition += questionHeaderHeight + 2;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(whiteColor[0], whiteColor[1], whiteColor[2]);
      
      const queryLines = splitText(queryText, contentWidth - 8);
      queryLines.forEach(line => {
        if (yPosition > pageHeight - 50) {
          doc.addPage();
          doc.setFillColor(darkBg[0], darkBg[1], darkBg[2]);
          doc.rect(0, 0, pageWidth, pageHeight, 'F');
          yPosition = margin;
        }
        if (line.trim() || line === '') {
          doc.text(line || ' ', margin + 4, yPosition);
          yPosition += lineHeight;
        }
      });

      yPosition += sectionSpacing;

      // Answer section with dark theme styling
      if (yPosition > pageHeight - 60) {
        doc.addPage();
        doc.setFillColor(darkBg[0], darkBg[1], darkBg[2]);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
        yPosition = margin;
      }

      const answerHeaderHeight = 8;
      // Dark background with emerald border
      doc.setFillColor(darkerBg[0], darkerBg[1], darkerBg[2]);
      doc.setGState(doc.GState({ opacity: 0.6 }));
      doc.roundedRect(margin, yPosition - 2, contentWidth, answerHeaderHeight, 2, 2, 'F');
      doc.setGState(doc.GState({ opacity: 1 }));
      
      // Emerald border
      doc.setDrawColor(emeraldColor[0], emeraldColor[1], emeraldColor[2]);
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, yPosition - 2, contentWidth, answerHeaderHeight, 2, 2);
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(emeraldColor[0], emeraldColor[1], emeraldColor[2]);
      doc.text('Answer', margin + 4, yPosition + 4);
      
      yPosition += answerHeaderHeight + 2;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(slateColor[0], slateColor[1], slateColor[2]);
      
      const answerLines = splitText(answerText, contentWidth - 8);
      answerLines.forEach(line => {
        if (yPosition > pageHeight - 50) {
          doc.addPage();
          doc.setFillColor(darkBg[0], darkBg[1], darkBg[2]);
          doc.rect(0, 0, pageWidth, pageHeight, 'F');
          yPosition = margin;
        }
        if (line.trim() || line === '') {
          doc.text(line || ' ', margin + 4, yPosition);
          yPosition += lineHeight;
        }
      });

      // Separator line with subtle styling
      yPosition += sectionSpacing;
      if (yPosition > pageHeight - 50) {
        doc.addPage();
        doc.setFillColor(darkBg[0], darkBg[1], darkBg[2]);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
        yPosition = margin;
      } else {
        doc.setDrawColor(slateDark[0], slateDark[1], slateDark[2]);
        doc.setLineWidth(0.2);
        doc.setGState(doc.GState({ opacity: 0.3 }));
        doc.line(margin, yPosition, pageWidth - margin, yPosition);
        doc.setGState(doc.GState({ opacity: 1 }));
        yPosition += sectionSpacing;
      }
    });

      // Footer on all pages with dark theme
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        
        // Footer background
        doc.setFillColor(darkerBg[0], darkerBg[1], darkerBg[2]);
        doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');
        
        // Footer text
        doc.setFontSize(7);
        doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
        doc.setFont('helvetica', 'normal');
        doc.text(
          `Page ${i} of ${pageCount} • Generated by DEX`,
          pageWidth / 2,
          pageHeight - 8,
          { align: 'center' }
        );
      }

      // Save the PDF
      doc.save(`dex-chat-history-${sessionDate}.pdf`);
    };
    
    // Execute the PDF creation
    try {
      createPDF();
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  // ---------------------------------------------------------------------------
  // Custom D3 Implementation
  // ---------------------------------------------------------------------------

  const centerTree = useCallback(() => {
    if (svgRef.current) {
        const svg = d3.select(svgRef.current);
        const { width, height } = svgRef.current.getBoundingClientRect();

        const transform = d3.zoomIdentity.translate(width / 4, height / 2).scale(0.8);
        svg.transition().duration(750).call(d3.zoom().transform as any, transform);
    }
  }, []);

  useEffect(() => {
    if (graphViewMode !== 'full') return;
    if (!hierarchyData || !svgRef.current || !wrapperRef.current) return;

    const isLightGraph = false;
    const graphTextColor = isLightGraph ? '#64748b' : '#94a3b8';
    const graphTextHighlight = isLightGraph ? '#0f172a' : '#fff';
    const graphLinkFallback = isLightGraph ? '#cbd5e1' : '#333';
    const graphSelectionStroke = isLightGraph ? '#18181b' : '#fff';

    const svg = d3.select(svgRef.current);
    const g = d3.select(wrapperRef.current);
    const { width, height } = svgRef.current.getBoundingClientRect();
    void width; void height;

    // Track spacebar state for panning
    let isSpacePressed = false;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        isSpacePressed = true;
        svg.style("cursor", "grab");
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressed = false;
        svg.style("cursor", "default");
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // 1. Setup Zoom - Only allow panning on right-click, middle mouse button, or spacebar+drag
    const zoom = d3.zoom()
        .scaleExtent([0.1, 3])
        .filter((event) => {
            // Allow zoom with wheel
            if (event.type === 'wheel') return true;
            
            // For mouse events, allow panning with:
            // - Right-click (button 2)
            // - Middle mouse button (button 1)
            // - Left-click (button 0) when spacebar is pressed
            if (event.sourceEvent) {
                const mouseEvent = event.sourceEvent as MouseEvent;
                if (mouseEvent.type === 'mousedown' || mouseEvent.type === 'mousemove') {
                    // button: 0 = left, 1 = middle, 2 = right
                    return mouseEvent.button === 2 || mouseEvent.button === 1 || (mouseEvent.button === 0 && isSpacePressed);
                }
            }
            
            // Allow other events (like touch events) by default
            return true;
        })
        .on("zoom", (event) => {
            g.attr("transform", event.transform);
        })
        .on("start", () => {
            // Change cursor when panning starts
            svg.style("cursor", "grabbing");
        })
        .on("end", () => {
            // Reset cursor when panning ends (or show grab if spacebar is still pressed)
            svg.style("cursor", isSpacePressed ? "grab" : "default");
        });

    svg.call(zoom as any);
    
    // Update cursor on mouse enter/leave based on spacebar state
    svg.on("mouseenter", () => {
        if (isSpacePressed) {
            svg.style("cursor", "grab");
        }
    });
    
    svg.on("mouseleave", () => {
        if (!isSpacePressed) {
            svg.style("cursor", "default");
        }
    });
    
    // Prevent context menu on right-click since we use it for panning
    svg.on("contextmenu", (event) => {
        event.preventDefault();
    });
    // Clicking on empty space should clear selection & lineage
    svg.on("click", () => {
        setSelectedNode(null);
        setPathSet(new Set());
    });

    // 2. Setup Tree Layout
    const root = d3.hierarchy(hierarchyData);

    // Node size: [height, width] for horizontal
    const nodeWidth = 220;
    const nodeHeight = 50;

    const treeLayout = d3.tree().nodeSize(
        treeOrientation === 'horizontal'
        ? [nodeHeight, nodeWidth]
        : [nodeWidth, nodeHeight]
    );

    // 3. Update Function
    const update = (source: any) => {
        const treeData = treeLayout(root);
        const nodes = treeData.descendants();
        const links = treeData.links();

        // --- Nodes ---
        const nodeGroup = g.selectAll(".node")
            .data(nodes, (d: any) => d.data.attributes?.id || d.data.id || d.id);

        // Helper function to handle expand/collapse
        const handleNodeExpandCollapse = async (d: any) => {
            const nodeId = d.data.attributes?.id || d.data.id;
            
            if (d.children) {
                // Collapse: hide children
                d._children = d.children;
                d.children = null;
                setExpandedNodes(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(nodeId);
                    return newSet;
                });
            } else {
                // Expand: show children
                d.children = d._children;
                d._children = null;
                
                // Mark as expanded
                setExpandedNodes(prev => {
                    const newSet = new Set(prev);
                    newSet.add(nodeId);
                    return newSet;
                });
                
                // Lazy load children if not already loaded
                if (nodeId) {
                    loadNodeChildrenRef.current(nodeId);
                }
            }
            update(d);
        };

        const nodeEnter = nodeGroup.enter().append("g")
            .attr("class", "node cursor-pointer")
            .attr("transform", (d: any) => {
                const x = source.y0 || source.y;
                const y = source.x0 || source.x;
                return treeOrientation === 'horizontal'
                    ? `translate(${y},${x})`
                    : `translate(${x},${y})`;
            })
            .on("click", async (event, d: any) => {
                event.stopPropagation();
                await handleNodeExpandCollapse(d);
            });

        // Add Circle (colored strictly by node type)
        nodeEnter.append("circle")
            .attr("r", 0)
            .attr("fill", (d: any) => {
                const t = d.data.attributes.type;
                if (t === 'root') return '#e5e7eb';
                const cfg = NODE_CONFIG[t] || NODE_CONFIG.default;
                return cfg.color;
            })
            .attr("stroke", (d: any) => d.data.attributes.type === 'root' ? '#000' : 'none')
            .transition().duration(500)
            .attr("r", (d: any) => d.data.attributes.type === 'root' ? 8 : 5);

        // Add Expand/Collapse Indicator (Chevron)
        const hasChildren = (d: any) => d.children || d._children || d.data._childCount > 0;
        const isExpanded = (d: any) => d.children && d.children.length > 0;
        
        const expandIndicator = nodeEnter.filter(hasChildren)
            .append("text")
            .attr("class", "expand-indicator cursor-pointer")
            .attr("dy", "0.31em")
            .attr("x", (d: any) => {
                const offset = treeOrientation === 'horizontal' ? -25 : -15;
                return offset;
            })
            .attr("text-anchor", "middle")
            .text((d: any) => isExpanded(d) ? "▼" : "▶")
            .style("fill", "#64748b")
            .style("font-size", "10px")
            .style("font-family", FONT_UI_SANS)
            .style("fill-opacity", 0)
            .on("click", async (event, d: any) => {
                event.stopPropagation(); // Prevent triggering node click
                await handleNodeExpandCollapse(d);
            })
            .transition().duration(500)
            .style("fill-opacity", 1);
        
        // Add Child Count Badge for nodes with many children
        nodeEnter.filter((d: any) => {
            const count = d.data._childCount || (d.children ? d.children.length : 0);
            return count > 5; // Show badge if more than 5 children
        })
            .append("circle")
            .attr("class", "child-count-badge")
            .attr("r", 8)
            .attr("cx", (d: any) => {
                const offset = treeOrientation === 'horizontal' ? -35 : -25;
                return offset;
            })
            .attr("cy", 0)
            .attr("fill", "#3b82f6")
            .attr("stroke", "#1e40af")
            .attr("stroke-width", 1)
            .style("opacity", 0)
            .transition().duration(500)
            .style("opacity", 0.8);
        
        nodeEnter.filter((d: any) => {
            const count = d.data._childCount || (d.children ? d.children.length : 0);
            return count > 5;
        })
            .append("text")
            .attr("class", "child-count-text")
            .attr("x", (d: any) => {
                const offset = treeOrientation === 'horizontal' ? -35 : -25;
                return offset;
            })
            .attr("y", 4)
            .attr("text-anchor", "middle")
            .text((d: any) => {
                const count = d.data._childCount || (d.children ? d.children.length : 0);
                return count > 99 ? "99+" : count.toString();
            })
            .style("fill", "#fff")
            .style("font-size", "8px")
            .style("font-weight", "700")
            .style("font-family", FONT_UI_SANS)
            .style("pointer-events", "none")
            .style("opacity", 0)
            .transition().duration(500)
            .style("opacity", 1);
        
        // Add Loading Indicator
        nodeEnter.filter((d: any) => {
            const nodeId = d.data.attributes?.id || d.data.id;
            return loadingNodes.has(nodeId);
        })
            .append("circle")
            .attr("class", "loading-indicator")
            .attr("r", 3)
            .attr("cx", (d: any) => {
                const offset = treeOrientation === 'horizontal' ? -25 : -15;
                return offset;
            })
            .attr("cy", 0)
            .attr("fill", "#10b981")
            .style("opacity", 0.6);
        
        // Update loading indicators for existing nodes
        nodeGroup.merge(nodeEnter as any).selectAll(".loading-indicator")
            .style("opacity", (d: any) => {
                const nodeId = d.data.attributes?.id || d.data.id;
                return loadingNodes.has(nodeId) ? 0.6 : 0;
            });
        
        // Add Text
        nodeEnter.append("text")
            .attr("dy", "0.31em")
            .attr("x", (d: any) => {
                if (hasChildren(d)) {
                    return treeOrientation === 'horizontal' ? 10 : 15;
                }
                return treeOrientation === 'horizontal' ? 10 : 15;
            })
            .attr("text-anchor", "start")
            .text((d: any) => d.data.name)
            .style("fill-opacity", 0)
            .style("font-size", "12px")
            .style("fill", graphTextColor)
            .style("font-family", FONT_UI_SANS)
            .style("letter-spacing", "-0.01em")
            .transition().duration(500)
            .style("fill-opacity", 1);

        // Add "Chat" Action Icon
        nodeEnter.append("circle")
            .attr("r", 15)
            .attr("fill", "transparent")
            .on("click", (e, d: any) => {
                e.stopPropagation();
                // Only select + highlight lineage on node click;
                // chat is triggered explicitly from the sidebar.
                handleNodeClick(d.data.attributes);
            });

        // UPDATE (Transition to new position)
        nodeGroup.merge(nodeEnter as any).transition().duration(500)
            .attr("transform", (d: any) =>
                treeOrientation === 'horizontal'
                ? `translate(${d.y},${d.x})`
                : `translate(${d.x},${d.y})`
            );

        nodeGroup.merge(nodeEnter as any).select("circle")
             .attr("stroke", (d: any) => selectedNode?.id === (d.data.attributes?.id || d.data.id) ? graphSelectionStroke : "none")
             .attr("stroke-width", (d: any) => selectedNode?.id === (d.data.attributes?.id || d.data.id) ? 2 : 0)
             .style("filter", (d: any) => {
                const nodeId = d.data.attributes?.id || d.data.id;
                return pathSet.has(nodeId) ? `drop-shadow(0 0 6px ${d.data.attributes.branchColor})` : "none";
             })
             .style("opacity", (d: any) => {
                const nodeId = d.data.attributes?.id || d.data.id;
                return (pathSet.size > 0 && !pathSet.has(nodeId)) ? 0.3 : 1;
             });

        nodeGroup.merge(nodeEnter as any).select("text")
             .style("fill", (d: any) => {
                const nodeId = d.data.attributes?.id || d.data.id;
                return pathSet.has(nodeId) ? graphTextHighlight : graphTextColor;
             })
             .style("font-weight", (d: any) => {
                const nodeId = d.data.attributes?.id || d.data.id;
                return pathSet.has(nodeId) ? "bold" : "normal";
             })
             .style("opacity", (d: any) => {
                const nodeId = d.data.attributes?.id || d.data.id;
                return (pathSet.size > 0 && !pathSet.has(nodeId)) ? 0.3 : 1;
             });

        // Update expand indicator for existing nodes (text and click handler)
        nodeGroup.merge(nodeEnter as any).each(function(d: any) {
            const node = d3.select(this);
            const indicator = node.select(".expand-indicator");
            if (!indicator.empty()) {
                indicator
                    .text(isExpanded(d) ? "▼" : "▶")
                    .on("click", async (event: any) => {
                        event.stopPropagation(); // Prevent triggering node click
                        await handleNodeExpandCollapse(d);
                    });
            }
        });

        // EXIT
        nodeGroup.exit().transition().duration(500)
            .attr("transform", (d: any) =>
                treeOrientation === 'horizontal'
                ? `translate(${source.y},${source.x})`
                : `translate(${source.x},${source.y})`
            )
            .remove();

        // --- Links ---
        const linkGroup = g.selectAll(".link")
            .data(links, (d: any) => d.target.data?.attributes?.id || d.target.id);

        const linkEnter = linkGroup.enter().insert("path", "g")
            .attr("class", "link")
            .attr("fill", "none")
            .attr("stroke", graphLinkFallback)
            .attr("stroke-width", 1.5)
            .attr("d", (d: any) => {
                const o = { x: source.x0 || source.x, y: source.y0 || source.y };
                return diagonal(o, o);
            });

        const linkUpdate = linkGroup.merge(linkEnter as any);

        linkUpdate.transition().duration(500)
            .attr("d", (d: any) => diagonal(d.source, d.target))
            .attr("stroke", (d: any) => d.target.data.attributes.branchColor || graphLinkFallback)
            .attr("class", (d: any) => {
                const targetId = d.target.data.attributes?.id || d.target.data.id;
                return pathSet.has(targetId) ? "link link-active" : "link link-base";
            });

        linkGroup.exit().transition().duration(500)
            .attr("d", (d: any) => {
                const o = { x: source.x, y: source.y };
                return diagonal(o, o);
            })
            .remove();

        // Stash the old positions for transition.
        nodes.forEach((d: any) => {
            d.x0 = d.x;
            d.y0 = d.y;
        });
    };

    // Helper for Diagonal Paths
    const diagonal = (s: any, d: any) => {
        if (treeOrientation === 'horizontal') {
            return `M ${s.y} ${s.x}
                    C ${(s.y + d.y) / 2} ${s.x},
                      ${(s.y + d.y) / 2} ${d.x},
                      ${d.y} ${d.x}`;
        } else {
            return `M ${s.x} ${s.y}
                    C ${s.x} ${(s.y + d.y) / 2},
                      ${d.x} ${(s.y + d.y) / 2},
                      ${d.x} ${d.y}`;
        }
    };

    // Initial Update (only if root exists and is valid)
    if(root && root.data) {
        centerTree();
        update(root);
    }

    // Cleanup: remove event listeners
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    };
  }, [graphViewMode, hierarchyData, treeOrientation, pathSet, selectedNode, handleNodeClick, centerTree, loadingNodes, theme]);



  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
      </div>
    );
  }
  if (status === 'unauthenticated') return null;
  if (!mounted) return null;

  const leftW = leftOpen ? leftExpandedW : leftCollapsedW;
  const FONT_SANS = 'var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif';
  const themes: Theme[] = ['graphite', 'obsidian', 'midnight'];
  // bottom clearance for the floating dock (approx 80px)
  const DOCK_H = 80;

  return (
    <div
      data-theme={theme}
      className="fixed inset-0 overflow-hidden antialiased"
      style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}
    >
      <MobileWarning />

      {/* Ambient glow */}
      <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
        <div className="absolute rounded-full blur-[200px]"
          style={{ top: '20%', left: '35%', width: 700, height: 500, transform: 'translate(-50%,-50%)',
            background: 'radial-gradient(ellipse, rgba(var(--accent-primary-rgb),0.07) 0%, rgba(var(--accent-secondary-rgb),0.04) 50%, transparent 70%)' }} />
        <div className="absolute rounded-full blur-[140px]"
          style={{ bottom: '25%', right: '18%', width: 380, height: 280,
            background: 'radial-gradient(ellipse, rgba(var(--accent-secondary-rgb),0.05) 0%, transparent 70%)' }} />
      </div>

      {/* D3 CSS */}
      <style dangerouslySetInnerHTML={{__html: `
        .link-base  { fill:none; stroke-width:1.5px; opacity:0.38; transition:stroke .5s,opacity .5s; }
        .link-active{ fill:none; stroke-width:2.5px; opacity:1; stroke-dasharray:8; animation:flow 1s linear infinite; }
        @keyframes flow{ from{stroke-dashoffset:16} to{stroke-dashoffset:0} }
        .node text,.expand-indicator,.child-count-text{ font-family:${FONT_SANS}; -webkit-font-smoothing:antialiased; }
        .node text{ text-shadow:0 1px 4px rgba(0,0,0,.95); font-size:12px; font-weight:500; letter-spacing:.01em; }
      `}} />

      {/* ── TOP BAR ── */}
      <header className="topbar absolute top-0 inset-x-0 z-50 h-12 flex items-center px-4 gap-3">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0 hover:opacity-85 transition-opacity">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(var(--accent-primary-rgb),0.12)', border: '1px solid rgba(var(--accent-primary-rgb),0.2)' }}>
            <Terminal size={13} style={{ color: 'var(--accent-primary)' }} />
          </div>
          <span className="text-[13px] font-bold tracking-[0.16em] hidden sm:block"
            style={{ background: 'linear-gradient(90deg, var(--text-primary), var(--text-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            DEX
          </span>
        </Link>

        <div className="w-px h-5 shrink-0" style={{ background: 'var(--border)' }} />

        {/* Repo input row */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <GitBranch size={11} className="shrink-0" style={{ color: 'var(--text-muted)' }} />
          <input
            value={repoUrl}
            onChange={e => setRepoUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleIngest(); }}
            className="flex-1 min-w-0 bg-transparent text-[12px] font-mono focus:outline-none"
            style={{ color: 'var(--text-secondary)' }}
            placeholder="github.com/user/repo"
          />
          <button onClick={handleIngest} disabled={ingesting}
            className="shrink-0 px-3 py-1 rounded-lg text-[11px] font-semibold transition-all disabled:opacity-40"
            style={ingesting
              ? { background: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }
              : { background: 'var(--accent-primary)', color: '#0a0a0a' }}>
            {ingesting
              ? <span className="flex items-center gap-1.5"><RefreshCw size={10} className="animate-spin" /> Indexing…</span>
              : 'Ingest'}
          </button>
          {ingesting && (
            <button onClick={handleCancel}
              className="shrink-0 px-2 py-1 rounded-lg text-[11px] transition-all"
              style={{ background: 'rgba(248,113,113,0.1)', color: 'var(--accent-danger)', border: '1px solid rgba(248,113,113,0.2)' }}>
              Cancel
            </button>
          )}
        </div>

        {ingesting && (
          <>
            <div className="w-px h-5 shrink-0" style={{ background: 'var(--border)' }} />
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <div className="w-20 h-1.5 rounded-full overflow-hidden ingest-track">
                <div className="ingest-fill" style={{ width: `${Math.min(100,Math.max(0,progress))}%` }} />
              </div>
              <span className="text-[11px] tabular-nums font-semibold" style={{ color: 'var(--accent-primary)' }}>
                {Math.min(100,Math.max(0,progress))}%
              </span>
            </div>
          </>
        )}

        <div className="w-px h-5 shrink-0" style={{ background: 'var(--border)' }} />

        {/* View mode */}
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg shrink-0" style={{ background: 'var(--bg-surface)' }}>
          {(['full','focused'] as const).map(m => (
            <button key={m} onClick={() => handleGraphViewMode(m)}
              disabled={m === 'full' && !graphReady && !ingesting}
              className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-all disabled:opacity-30"
              style={graphViewMode === m
                ? { background: 'var(--accent-primary)', color: '#0a0a0a' }
                : { color: 'var(--text-muted)' }}>
              {m === 'full' ? 'Graph' : 'Focused'}
            </button>
          ))}
        </div>

        {/* Orientation controls */}
        {graphViewMode === 'full' && graphReady && (
          <div className="flex items-center gap-0.5 shrink-0">
            <button onClick={() => setTreeOrientation('horizontal')} title="Horizontal"
              className="p-1.5 rounded-md transition-all"
              style={{ color: treeOrientation==='horizontal' ? 'var(--accent-primary)' : 'var(--text-muted)', background: treeOrientation==='horizontal' ? 'var(--bg-surface-active)' : 'transparent' }}>
              <ChevronRight size={13} />
            </button>
            <button onClick={() => setTreeOrientation('vertical')} title="Vertical"
              className="p-1.5 rounded-md transition-all"
              style={{ color: treeOrientation==='vertical' ? 'var(--accent-primary)' : 'var(--text-muted)', background: treeOrientation==='vertical' ? 'var(--bg-surface-active)' : 'transparent' }}>
              <ChevronDown size={13} />
            </button>
            <button onClick={centerTree} title="Center" className="p-1.5 rounded-md transition-all hover:opacity-80" style={{ color: 'var(--text-muted)' }}>
              <Move size={13} />
            </button>
          </div>
        )}

        <div className="w-px h-5 shrink-0" style={{ background: 'var(--border)' }} />

        {/* Theme switcher */}
        <div className="flex items-center gap-0.5 shrink-0">
          {themes.map(t => (
            <button key={t} onClick={() => setTheme(t)}
              className="px-2 py-0.5 rounded-md text-[10px] font-medium transition-all"
              style={theme === t
                ? { background: 'rgba(var(--accent-primary-rgb),0.18)', color: 'var(--accent-primary)', border: '1px solid rgba(var(--accent-primary-rgb),0.3)' }
                : { color: 'var(--text-muted)', border: '1px solid transparent' }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div className="w-px h-5 shrink-0" style={{ background: 'var(--border)' }} />

        {/* Status + user */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.15)' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent-green)', boxShadow: '0 0 5px rgba(52,211,153,0.6)' }} />
            <span className="text-[10px] font-medium" style={{ color: 'var(--accent-green)' }}>Live</span>
          </div>
          {session?.user && (
            <>
              <Link href="/profile" className="p-1.5 rounded-lg transition-all hover:opacity-80" style={{ color: 'var(--text-muted)' }} title="Profile">
                <User size={13} />
              </Link>
              <Link href="/settings" className="p-1.5 rounded-lg transition-all hover:opacity-80" style={{ color: 'var(--text-muted)' }} title="Settings">
                <Settings size={13} />
              </Link>
              <button onClick={() => signOut({ callbackUrl: '/' })} className="p-1.5 rounded-lg transition-all hover:text-red-400" style={{ color: 'var(--text-muted)' }} title="Log out">
                <LogOut size={13} />
              </button>
            </>
          )}
          <button onClick={() => setShowHelpGuide(true)} className="p-1.5 rounded-lg transition-all hover:opacity-80" style={{ color: 'var(--text-muted)' }} title="Help">
            <HelpCircle size={13} />
          </button>
        </div>
      </header>

      {/* ── LEFT ASSISTANT SIDEBAR ── */}
      <aside
        className="glass-panel absolute left-0 z-40 flex flex-col overflow-hidden"
        style={{
          top: 48,
          bottom: DOCK_H,
          width: leftW,
          transition: 'width 0.28s cubic-bezier(0.16,1,0.3,1)',
          borderRight: '1px solid var(--border)',
          borderTop: 'none',
          borderBottom: 'none',
          borderLeft: 'none',
          borderRadius: 0,
          boxShadow: 'none',
          background: 'var(--bg-base)',
        }}
      >
        {/* Sidebar header */}
        <div className="flex items-center gap-2.5 px-3 shrink-0"
          style={{ height: 44, borderBottom: '1px solid var(--border)' }}>
          {leftOpen && (
            <>
              <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                style={{ background: 'rgba(var(--accent-primary-rgb),0.12)', border: '1px solid rgba(var(--accent-primary-rgb),0.2)' }}>
                <Sparkles size={10} style={{ color: 'var(--accent-primary)' }} />
              </div>
              <span className="text-[12px] font-semibold flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>
                DEX Assistant
              </span>
              {chatHistory.length > 0 && (
                <>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0"
                    style={{ background: 'rgba(var(--accent-primary-rgb),0.1)', color: 'var(--accent-primary)' }}>
                    {chatHistory.length}
                  </span>
                  <button onClick={handleDownloadChat} className="p-1 rounded-md shrink-0 hover:opacity-70 transition-opacity" style={{ color: 'var(--text-muted)' }} title="Download chat">
                    <Download size={11} />
                  </button>
                </>
              )}
            </>
          )}
          <button
            onClick={toggleLeft}
            className="p-1 rounded-md transition-all hover:opacity-70 shrink-0 ml-auto"
            style={{ color: 'var(--text-muted)' }}
            title={leftOpen ? 'Collapse' : 'Expand assistant'}
          >
            {leftOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          </button>
        </div>

        {leftOpen && (
          <>
            {/* Repo input */}
            <div className="px-3 py-3 shrink-0 space-y-2" style={{ borderBottom: '1px solid var(--border)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Repository</p>
              <div className="flex gap-1.5">
                <input
                  value={repoUrl}
                  onChange={e => setRepoUrl(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleIngest(); }}
                  className="input-base flex-1 min-w-0 rounded-lg px-2.5 py-1.5 text-[12px] font-mono"
                  placeholder="github.com/user/repo"
                />
                <button onClick={handleIngest} disabled={ingesting}
                  className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-40"
                  style={ingesting ? { background: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' } : { background: 'var(--accent-primary)', color: '#0a0a0a' }}>
                  <RefreshCw size={11} className={ingesting ? 'animate-spin' : ''} />
                </button>
              </div>
              {ingesting && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px]">
                    <span className="flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                      <span className="w-1 h-1 rounded-full animate-pulse inline-block" style={{ background: 'var(--accent-primary)' }} />
                      {step || 'Indexing…'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="tabular-nums font-semibold" style={{ color: 'var(--accent-primary)' }}>{Math.min(100,Math.max(0,progress))}%</span>
                      <button onClick={handleCancel} className="text-[10px] px-1 rounded transition-colors hover:opacity-80" style={{ color: 'var(--accent-danger)' }}>Cancel</button>
                    </div>
                  </div>
                  <div className="h-1 rounded-full ingest-track">
                    <div className="ingest-fill h-full" style={{ width: `${Math.min(100,Math.max(0,progress))}%` }} />
                  </div>
                </div>
              )}
            </div>

            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 min-h-0">
              {chatHistory.length === 0 && !loading ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 py-6">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(var(--accent-primary-rgb),0.08)', border: '1px solid rgba(var(--accent-primary-rgb),0.16)' }}>
                    <Sparkles size={18} style={{ color: 'var(--accent-primary)' }} />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-[12px] font-semibold" style={{ color: 'var(--text-secondary)' }}>Ask anything</p>
                    <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>about your repository's structure, logic, or dependencies.</p>
                  </div>
                  <div className="flex flex-col gap-1.5 w-full">
                    {['What is the main entry point?', 'List all API endpoints', 'Explain the architecture'].map(s => (
                      <button key={s} onClick={() => handleExecute(s)}
                        className="text-left text-[11px] px-3 py-2 rounded-lg transition-all hover:opacity-80"
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {chatHistory.map((entry, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex justify-end">
                        <div className="px-3 py-2 rounded-xl rounded-tr-sm max-w-[90%] text-[12px] leading-relaxed"
                          style={{ background: 'rgba(var(--accent-primary-rgb),0.1)', border: '1px solid rgba(var(--accent-primary-rgb),0.18)', color: 'var(--text-primary)' }}>
                          {entry.query}
                          <p className="text-[9px] mt-1 text-right opacity-40" style={{ color: 'var(--text-muted)' }}>
                            {entry.timestamp.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                          style={{ background: 'rgba(var(--accent-primary-rgb),0.1)', border: '1px solid rgba(var(--accent-primary-rgb),0.18)' }}>
                          <Sparkles size={9} style={{ color: 'var(--accent-primary)' }} />
                        </div>
                        <div className="flex-1 min-w-0 rounded-xl rounded-tl-sm px-3 py-2.5"
                          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                          <div className="chat-prose text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.answer}</ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex gap-2 items-start">
                      <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: 'rgba(var(--accent-primary-rgb),0.1)', border: '1px solid rgba(var(--accent-primary-rgb),0.18)' }}>
                        <Sparkles size={9} className="animate-pulse" style={{ color: 'var(--accent-primary)' }} />
                      </div>
                      <div className="px-3 py-2.5 rounded-xl rounded-tl-sm" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                        <div className="flex items-center gap-1.5">
                          {[0,120,240].map(d => (
                            <div key={d} className="w-1.5 h-1.5 rounded-full animate-bounce"
                              style={{ background: 'var(--accent-primary)', opacity: 0.6, animationDelay: `${d}ms` }} />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Input */}
            <div className="px-3 py-3 shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
              <PromptInputBox
                onSend={(message) => handleExecute(message)}
                isLoading={loading}
                placeholder="Ask about structure, dependencies…"
              />
            </div>
          </>
        )}
      </aside>

      {/* ── GRAPH CANVAS ── */}
      <main
        ref={treeContainer}
        className="absolute z-0"
        style={{
          top: 48,
          left: leftW,
          right: (selectedNode && graphViewMode === 'full') ? 272 : 0,
          bottom: DOCK_H,
          transition: 'left 0.28s cubic-bezier(0.16,1,0.3,1), right 0.28s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* Dot grid */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.03 }} aria-hidden="true">
          <defs>
            <pattern id="dex-dot" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="currentColor" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dex-dot)" style={{ color: 'var(--text-primary)' }} />
        </svg>

        <div className="w-full h-full relative">
          {graphViewMode === 'focused' ? (
            <FocusedGraphPanel repoReady={graphReady} ingesting={ingesting} />
          ) : graphReady ? (
            <svg ref={svgRef} className="w-full h-full block" viewBox="0 0 1000 800">
              <g ref={wrapperRef} />
            </svg>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-6">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(var(--accent-primary-rgb),0.07)', border: '1px solid rgba(var(--accent-primary-rgb),0.14)' }}>
                <LayoutTemplate size={28} strokeWidth={1.25} style={{ color: 'var(--text-muted)' }} />
              </div>
              <div className="text-center space-y-2 max-w-sm px-8">
                <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {ingesting ? 'Indexing repository…' : 'No repository loaded'}
                </h2>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {ingesting ? (step || 'Processing files and building the graph…') : 'Paste a GitHub URL in the top bar and click Ingest, or use the assistant on the left.'}
                </p>
              </div>
              {ingesting && (
                <div className="w-full max-w-xs space-y-2 px-4">
                  <div className="flex justify-between text-[11px]">
                    <span style={{ color: 'var(--text-muted)' }}>{step || 'Working…'}</span>
                    <span className="tabular-nums font-semibold" style={{ color: 'var(--accent-primary)' }}>{Math.min(100,Math.max(0,progress))}%</span>
                  </div>
                  <div className="h-1.5 rounded-full ingest-track">
                    <div className="ingest-fill" style={{ width: `${Math.min(100,Math.max(0,progress))}%` }} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ── RIGHT INSPECTOR ── */}
      {selectedNode && graphViewMode === 'full' && (
        <aside
          className="inspector-panel absolute right-0 z-40 animate-slide-right flex flex-col"
          style={{ top: 48, bottom: DOCK_H, width: 272 }}
        >
          <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Inspector</span>
            <button onClick={() => { setSelectedNode(null); setPathSet(new Set()); }}
              className="p-1 rounded-md transition-all hover:opacity-75" style={{ color: 'var(--text-muted)' }}>
              <X size={13} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            <div className="rounded-xl p-4 space-y-2.5"
              style={{ background: 'rgba(var(--accent-primary-rgb),0.05)', border: '1px solid rgba(var(--accent-primary-rgb),0.12)' }}>
              <span className="tag"
                style={{ color: NODE_CONFIG[selectedNode.type]?.color||NODE_CONFIG.default.color,
                  background: `${NODE_CONFIG[selectedNode.type]?.color||NODE_CONFIG.default.color}18`,
                  border: `1px solid ${NODE_CONFIG[selectedNode.type]?.color||NODE_CONFIG.default.color}30` }}>
                {selectedNode.type}
              </span>
              <div className="text-[18px] font-bold font-mono leading-snug break-all" style={{ color: 'var(--text-primary)' }}>
                {selectedNode.name || selectedNode.id}
              </div>
              {selectedNode.id && (
                <div className="flex items-start gap-1.5">
                  <FileCode size={10} className="shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }} />
                  <span className="text-[11px] font-mono break-all leading-tight" style={{ color: 'var(--text-muted)' }}>{selectedNode.id}</span>
                </div>
              )}
            </div>

            <button onClick={() => handleNodeChat(selectedNode)}
              className="w-full py-2.5 rounded-xl text-[12px] font-semibold transition-all hover:opacity-88"
              style={{ background: 'var(--accent-primary)', color: '#0a0a0a' }}>
              Ask DEX about this
            </button>
            <button
              onClick={() => { const id=selectedNode.id||selectedNode.name; if(id) router.push(`/blast-radius?node=${encodeURIComponent(id)}`); }}
              disabled={!selectedNode.id && !selectedNode.name}
              className="w-full py-2.5 rounded-xl text-[12px] font-medium transition-all disabled:opacity-40 hover:opacity-80"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
              Blast Radius →
            </button>
          </div>

          <div className="px-4 py-4 shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2.5" style={{ color: 'var(--text-muted)' }}>Node types</p>
            <div className="grid grid-cols-2 gap-y-1.5 gap-x-2">
              {Object.entries(NODE_CONFIG).map(([key, cfg]: any) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cfg.color }} />
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{cfg.label}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      )}

      {/* ── HELP MODAL ── */}
      {showHelpGuide && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/65 backdrop-blur-xl animate-fade-in"
          onClick={() => setShowHelpGuide(false)}>
          <div className="relative w-full max-w-md rounded-2xl overflow-hidden animate-fade-in-scale glass-card"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>How to use DEX</span>
              <button onClick={() => setShowHelpGuide(false)} className="p-1.5 rounded-lg transition-all hover:opacity-75" style={{ color: 'var(--text-muted)' }}>
                <X size={14} />
              </button>
            </div>
            <div className="p-5 space-y-2.5 max-h-[60vh] overflow-y-auto">
              {[
                ['Expand nodes', 'Click any node in the graph to expand or collapse its children.'],
                ['Inspect', 'Selecting a node opens the Inspector panel on the right.'],
                ['Pan', 'Hold Space + drag, or right-click drag to pan the graph.'],
                ['Zoom', 'Scroll wheel zooms in and out.'],
                ['Chat', 'Use the assistant panel on the left to ask about the repository.'],
              ].map(([title, desc]) => (
                <div key={title} className="rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                  <p className="text-[13px] font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{title}</p>
                  <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>{desc}</p>
                </div>
              ))}
            </div>
            <div className="px-5 py-4" style={{ borderTop: '1px solid var(--border)' }}>
              <button onClick={() => setShowHelpGuide(false)}
                className="w-full py-2 rounded-xl text-[13px] font-semibold transition-all hover:opacity-88"
                style={{ background: 'var(--accent-primary)', color: '#0a0a0a' }}>
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
