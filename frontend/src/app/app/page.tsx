"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { dexApi, GraphData } from '@/lib/api';
import {
  RefreshCw, Zap, Search, Terminal, MessageSquare,
  Info, Folder, File, Box, Code, Database, FileCode,
  ChevronRight, ChevronDown, Move, LayoutTemplate,
  Play, LogOut, User, X, HelpCircle, MousePointerClick, Network, Download
} from 'lucide-react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import * as d3 from 'd3';
import { jsPDF } from 'jspdf';

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
  const { data: session } = useSession();
  const router = useRouter();
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

  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'assistant' | 'details'>('assistant');
  const [showHelpGuide, setShowHelpGuide] = useState(false);

  const [pathSet, setPathSet] = useState<Set<string>>(new Set());
  const [treeOrientation, setTreeOrientation] = useState<'vertical' | 'horizontal'>('horizontal');
  
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
    // Note: loadNodeChildren is stable (useCallback with no deps), so it's safe to call
    childrenToExpand.forEach((child: any) => {
      const childId = child.attributes?.id || 
                     child.data?.attributes?.id || 
                     child.data?.id ||
                     (child.data && typeof child.data === 'object' && 'id' in child.data ? child.data.id : null);
      
      if (childId) {
        const childCount = child.data?._childCount || child._childCount || (child.children?.length) || (child._children?.length) || 0;
        if (childCount > 0) {
          console.log('[Auto-expand] Loading children for:', childId, 'count:', childCount);
          loadNodeChildren(String(childId));
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hierarchyData, hasAutoExpanded, graphData.nodes.length]); // loadNodeChildren is stable, no need in deps

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

  const pollIngestion = useCallback(() => {
    const i = setInterval(async () => {
        try {
            const s = await dexApi.getIngestStatus();
            setProgress(s.progress);
            setStep(s.step);
            if (s.state === 'completed') { 
                clearInterval(i); 
                setIngesting(false); 
                setPollInterval(null);
                loadGraph(); 
            }
            if (s.state === 'cancelled') { 
                clearInterval(i); 
                setIngesting(false); 
                setPollInterval(null);
            }
            if (s.state === 'error') { 
                clearInterval(i); 
                setIngesting(false); 
                setPollInterval(null);
            }
        } catch(e) {}
    }, 1000);
    return i; // Return interval ID so we can clear it
  }, [loadGraph]);

  useEffect(() => {
    dexApi.getIngestStatus().then(s => {
        if(s.state === 'running') {
            setIngesting(true); 
            const interval = pollIngestion();
            setPollInterval(interval);
        } else if(s.state === 'completed') {
            // Load graph data if ingestion is already completed
            loadGraph();
        }
    }).catch(() => {});
    // Also try to load graph data on mount in case there's existing data
    loadGraph();
    
    // Cleanup interval on unmount
    return () => {
        if (pollInterval) {
            clearInterval(pollInterval);
        }
    };
  }, [pollIngestion, loadGraph]);

  const handleIngest = async () => {
      setIngesting(true); setGraphData({ nodes: [], links: [] });
      try { 
          await dexApi.triggerIngestion(repoUrl); 
          const interval = pollIngestion();
          setPollInterval(interval);
      } catch (err: any) { 
          console.error("Ingestion error:", err);
          // If error is 409 (already running), try to reset and retry
          if (err?.message?.includes("already running") || err?.response?.status === 409) {
              try {
                  console.log("Resetting stuck ingestion and retrying...");
                  await dexApi.resetIngestionStatus();
                  // Small delay before retry
                  await new Promise(resolve => setTimeout(resolve, 500));
                  await dexApi.triggerIngestion(repoUrl);
                  const interval = pollIngestion();
                  setPollInterval(interval);
              } catch (retryErr: any) {
                  console.error("Retry failed:", retryErr);
                  setIngesting(false);
                  alert(`Ingestion failed: ${retryErr?.message || "Unknown error"}`);
              }
          } else {
              setIngesting(false);
              alert(`Ingestion failed: ${err?.message || "Unknown error"}`);
          }
      }
  };

  const handleCancel = async () => {
      try {
          await dexApi.cancelIngestion();
          if (pollInterval) {
              clearInterval(pollInterval);
              setPollInterval(null);
          }
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
    if (!hierarchyData || !svgRef.current || !wrapperRef.current) return;

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
                    loadNodeChildren(nodeId);
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
            .style("font-family", "system-ui")
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
            .style("font-weight", "bold")
            .style("font-family", "system-ui")
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
            .style("fill", "#94a3b8")
            .style("font-family", "system-ui")
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
             .attr("stroke", (d: any) => selectedNode?.id === (d.data.attributes?.id || d.data.id) ? "#fff" : "none")
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
                return pathSet.has(nodeId) ? "#fff" : "#94a3b8";
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
            .attr("stroke", "#333")
            .attr("stroke-width", 1.5)
            .attr("d", (d: any) => {
                const o = { x: source.x0 || source.x, y: source.y0 || source.y };
                return diagonal(o, o);
            });

        const linkUpdate = linkGroup.merge(linkEnter as any);

        linkUpdate.transition().duration(500)
            .attr("d", (d: any) => diagonal(d.source, d.target))
            .attr("stroke", (d: any) => d.target.data.attributes.branchColor || "#333")
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
  }, [hierarchyData, treeOrientation, pathSet, selectedNode, handleNodeClick, centerTree, loadNodeChildren, loadingNodes]);


  if (!mounted) return null;

  return (
    <div className="flex h-screen w-full bg-[#050505] text-slate-200 font-sans overflow-hidden relative">
      {/* Dynamic Background Effects */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/10 blur-[150px] rounded-full mix-blend-screen opacity-50"></div>
        <div className="absolute top-[40%] right-[-10%] w-[40%] h-[40%] bg-emerald-900/5 blur-[120px] rounded-full mix-blend-screen opacity-40"></div>
        <div className="absolute bottom-[-20%] left-[20%] w-[60%] h-[40%] bg-violet-900/10 blur-[150px] rounded-full mix-blend-screen opacity-30"></div>
        <div className="absolute inset-0 cyber-grid"></div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .link-base {
            fill: none;
            stroke-width: 1.5px;
            transition: stroke 0.5s ease, opacity 0.5s ease;
            opacity: 0.4;
        }
        .link-active {
            fill: none;
            stroke-width: 2px;
            stroke-dasharray: 8;
            animation: flow 1s linear infinite;
            opacity: 1;
        }
        @keyframes flow {
            from { stroke-dashoffset: 16; }
            to { stroke-dashoffset: 0; }
        }
        .node text {
            text-shadow: 0 1px 3px rgba(0,0,0,0.8);
        }
        
        /* Custom Scrollbar - Matching Home Page Theme */
        ::-webkit-scrollbar {
            width: 8px;
        }
        ::-webkit-scrollbar-track {
            background: #050505;
        }
        ::-webkit-scrollbar-thumb {
            background: #333;
            border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
            background: #444;
        }
        
        /* Firefox Scrollbar */
        * {
            scrollbar-width: thin;
            scrollbar-color: #333 #050505;
        }
        
        /* Glass Effects */
        .glass-panel {
            background: rgba(10, 10, 10, 0.6);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.08);
        }
        
        /* Cyber Grid Background */
        .cyber-grid {
            background-size: 50px 50px;
            background-image: linear-gradient(to right, rgba(99, 102, 241, 0.03) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(99, 102, 241, 0.03) 1px, transparent 1px);
            mask-image: radial-gradient(ellipse at center, black 30%, transparent 70%);
        }
        
        /* Help Guide Animations */
        @keyframes fade-in {
            0% { opacity: 0; }
            100% { opacity: 1; }
        }
        @keyframes fade-in-scale {
            0% { opacity: 0; transform: scale(0.95); }
            100% { opacity: 1; transform: scale(1); }
        }
        @keyframes pulse-glow {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 0.6; }
        }
        .animate-fade-in {
            animation: fade-in 0.3s ease-out forwards;
        }
        .animate-fade-in-scale {
            animation: fade-in-scale 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .animate-pulse-glow {
            animation: pulse-glow 3s ease-in-out infinite;
        }
      `}} />

      {/* --- SIDEBAR --- */}
      <aside className="w-[400px] min-w-[400px] flex flex-col border-r border-white/5 bg-[#0a0a0a]/80 backdrop-blur-xl z-20 shadow-2xl relative">
        <div className="h-14 flex items-center justify-between px-6 border-b border-white/5 bg-black/20 shrink-0 backdrop-blur-md">
            <Link href="/" className="flex items-center gap-3 group hover:opacity-80 transition-opacity" title="Go to Homepage">
                <div className="p-1.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.2)] group-hover:border-indigo-500/40 transition-colors"><Terminal className="text-indigo-500" size={16} /></div>
                <h1 className="text-sm font-bold text-white tracking-widest leading-none">DEX</h1>
            </Link>
            <div className="flex items-center gap-2">
                {session?.user && (
                    <Link
                        href="/profile"
                        className="flex items-center gap-2 px-2 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all cursor-pointer"
                        title="View Profile"
                    >
                        <User size={12} className="text-indigo-400" />
                        <span className="text-[10px] text-indigo-300 font-medium max-w-[100px] truncate">
                            {session.user.name || session.user.email}
                        </span>
                    </Link>
                )}
                <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-emerald-500/5 border border-emerald-500/10">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
                    <span className="text-[10px] text-emerald-500 font-medium uppercase tracking-wider">Online</span>
                </div>
                {session?.user && (
                    <button
                        onClick={() => signOut({ callbackUrl: '/' })}
                        className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-red-500/10 hover:border-red-500/30 text-slate-400 hover:text-red-400 transition-all"
                        title="Log out"
                    >
                        <LogOut size={14} />
                    </button>
                )}
            </div>
        </div>

        <div className="flex border-b border-white/5 bg-[#0a0a0a]/50 backdrop-blur-sm">
            <button onClick={() => setActiveTab('assistant')} className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2 relative ${activeTab === 'assistant' ? 'border-indigo-500 text-white bg-white/5' : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/2'}`}>
                <div className="flex items-center justify-center gap-2">
                    <MessageSquare size={12} /> Assistant
                </div>
            </button>
            <button onClick={() => setActiveTab('details')} className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2 relative ${activeTab === 'details' ? 'border-emerald-500 text-white bg-white/5' : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/2'}`}>
                <div className="flex items-center justify-center gap-2">
                    <Info size={12} /> Details
                </div>
            </button>
        </div>

        {activeTab === 'assistant' && (
            <div className="flex-1 flex flex-col min-h-0 animate-in fade-in slide-in-from-left-4 duration-300">
                <div className="p-5 border-b border-white/5 bg-[#0a0a0a]/50 backdrop-blur-sm shrink-0 space-y-3">
                    <div className="flex justify-between items-baseline">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Repository URL</label>
                        {step && ingesting && <span className="text-[10px] text-indigo-400 animate-pulse font-mono">{step}</span>}
                    </div>
                    <div className="flex gap-2">
                        <input 
                            value={repoUrl} 
                            onChange={(e) => setRepoUrl(e.target.value)} 
                            className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-300 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all font-mono shadow-inner" 
                            placeholder="Enter GitHub repository URL"
                        />
                        <button 
                            onClick={handleIngest} 
                            disabled={ingesting} 
                            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3 rounded-lg transition-all flex items-center justify-center shrink-0 shadow-lg hover:shadow-indigo-500/50"
                        >
                            {ingesting ? <RefreshCw className="animate-spin" size={14}/> : <RefreshCw size={14}/>}
                        </button>
                    </div>
                    {/* Enhanced progress bar */}
                    {ingesting && (
                      <div className="space-y-1">
                        <div className="flex justify-between items-center gap-2">
                          <div className="flex-1">
                            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                              <span>Ingesting…</span>
                              <span>{Math.min(100, Math.max(0, progress))}%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden shadow-inner mt-1">
                              <div 
                                  className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-300 shadow-[0_0_8px_rgba(99,102,241,0.5)]" 
                                  style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} 
                              />
                            </div>
                          </div>
                          <button
                            onClick={handleCancel}
                            className="bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 px-2 py-1.5 rounded-lg transition-all flex items-center justify-center shrink-0 border border-red-500/30 hover:border-red-500/50"
                            title="Cancel ingestion"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    )}
                </div>
                {/* Enhanced Chat Space - Inspired by Home Page */}
                <div className="flex-1 flex flex-col min-h-0 bg-[#080808] border-b border-white/5">
                    {/* Chat Header */}
                    <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between bg-white/[0.02] shrink-0 backdrop-blur-sm">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse"></div>
                            <span className="text-xs font-bold text-slate-300 tracking-wide">DEX ASSISTANT</span>
                            {chatHistory.length > 0 && (
                                <span className="text-[9px] text-slate-500 ml-2">({chatHistory.length} messages)</span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {chatHistory.length > 0 && (
                                <button
                                    onClick={handleDownloadChat}
                                    className="p-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 hover:border-indigo-500/50 text-indigo-300 hover:text-indigo-200 transition-all"
                                    title="Download chat history"
                                >
                                    <Download size={12} />
                                </button>
                            )}
                            <Terminal size={12} className="text-slate-600" />
                        </div>
                    </div>
                    
                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                        {chatHistory.length > 0 ? (
                            <div className="space-y-4">
                                {chatHistory.map((entry, index) => (
                                    <div key={index} className="space-y-3">
                                        {/* User Message */}
                                        <div className="flex justify-end">
                                            <div className="bg-indigo-600/20 border border-indigo-500/30 text-indigo-100 px-3 py-2 rounded-l-lg rounded-tr-lg max-w-[85%] shadow-lg">
                                                <p className="text-xs font-medium">{entry.query}</p>
                                                <p className="text-[9px] text-indigo-300/60 mt-1">
                                                    {entry.timestamp.toLocaleTimeString()}
                                                </p>
                                            </div>
                                        </div>
                                        
                                        {/* AI Response */}
                                        <div className="flex justify-start relative">
                                            <div className="absolute -left-2 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 to-transparent opacity-50"></div>
                                            <div className="pl-3 text-slate-300 max-w-[90%] space-y-2">
                                                <div className="prose prose-invert prose-sm max-w-none text-slate-300 leading-relaxed font-light text-xs">
                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.answer}</ReactMarkdown>
                                                </div>
                                                <p className="text-[9px] text-slate-500 mt-1">
                                                    {entry.timestamp.toLocaleTimeString()}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                
                                {/* Show loading indicator if currently processing */}
                                {loading && (
                                    <div className="flex justify-end">
                                        <div className="bg-indigo-600/20 border border-indigo-500/30 text-indigo-100 px-3 py-2 rounded-l-lg rounded-tr-lg max-w-[85%] shadow-lg">
                                            <div className="flex items-center gap-2">
                                                <RefreshCw className="animate-spin" size={12} />
                                                <p className="text-xs font-medium">{query}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-700 gap-3 opacity-60">
                                <MessageSquare size={32} className="text-slate-600" />
                                <p className="text-[10px] uppercase tracking-widest font-medium">Ready to analyze</p>
                                <p className="text-[9px] text-slate-600 text-center max-w-[200px]">Ask questions about your codebase structure, dependencies, or specific files</p>
                            </div>
                        )}
                    </div>
                </div>
                
                {/* Enhanced Input Area */}
                <div className="p-5 border-t border-white/5 bg-[#0a0a0a]/80 backdrop-blur-sm shrink-0">
                    <div className="relative group">
                        <textarea 
                            value={query} 
                            onChange={(e) => setQuery(e.target.value)} 
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    if (query && !loading) handleExecute();
                                }
                            }}
                            placeholder="Ask about structure, dependencies, or code..." 
                            className="w-full bg-[#111] border border-white/10 rounded-xl p-4 pr-12 text-xs text-white focus:border-indigo-500/50 outline-none resize-none h-24 shadow-inner transition-all focus:bg-[#151515] focus:ring-1 focus:ring-indigo-500/20" 
                        />
                        <button 
                            onClick={() => handleExecute()} 
                            disabled={loading || !query} 
                            className="absolute right-3 bottom-3 p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all shadow-lg hover:shadow-indigo-500/50"
                        >
                            {loading ? <RefreshCw className="animate-spin" size={14}/> : <Play size={14} fill="currentColor"/>}
                        </button>
                    </div>
                    {loading && (
                        <div className="mt-2 flex items-center gap-2 text-[10px] text-indigo-400">
                            <RefreshCw className="animate-spin" size={10} />
                            <span>Analyzing codebase...</span>
                        </div>
                    )}
                </div>
            </div>
        )}

        {activeTab === 'details' && (
            <div className="flex-1 flex flex-col min-h-0 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex-1 p-5 overflow-y-auto border-b border-white/5">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><Search size={12}/> Inspector</div>
                    {selectedNode ? (
                        <div className="space-y-4">
                            <div className="p-4 rounded-xl bg-gradient-to-br from-white/5 to-white/0 border border-white/10 shadow-lg backdrop-blur-sm glass-panel">
                                <div className="text-[9px] text-indigo-400 font-bold mb-2 uppercase tracking-wider">Active Node</div>
                                <div className="text-sm font-mono text-white break-all">{selectedNode.name || selectedNode.id}</div>
                            </div>
                            <div className="p-3 rounded-lg bg-[#111] border border-white/5 backdrop-blur-sm">
                                <div className="text-[9px] text-slate-500 mb-1 uppercase">Node Type</div>
                                <div className="text-xs font-bold text-white capitalize flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full shadow-[0_0_4px_currentColor]" style={{backgroundColor: (NODE_CONFIG[selectedNode.type]?.color || NODE_CONFIG.default.color)}}></div>
                                    {selectedNode.type}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                  onClick={() => handleNodeChat(selectedNode)}
                                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-indigo-500/20"
                                >
                                    <Zap size={12} className="text-yellow-400" fill="currentColor"/> Chat About Node
                                </button>
                                <button
                                  onClick={() => { setSelectedNode(null); setPathSet(new Set()); }}
                                  className="px-3 py-3 bg-[#111] hover:bg-[#1f2933] border border-white/10 text-slate-400 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all hover:border-white/20"
                                >
                                    Clear
                                </button>
                            </div>
                            <button
                              onClick={() => {
                                const nodeId = selectedNode.id || selectedNode.name || selectedNode.path;
                                if (nodeId) {
                                  router.push(`/blast-radius?node=${encodeURIComponent(nodeId)}`);
                                }
                              }}
                              disabled={!selectedNode.id && !selectedNode.name && !selectedNode.path}
                              className="w-full py-3 bg-indigo-600/20 hover:bg-indigo-600/30 disabled:opacity-50 disabled:cursor-not-allowed border border-indigo-500/50 text-indigo-300 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-indigo-500/30 hover:border-indigo-400/70"
                            >
                                <Network size={12} className="text-indigo-400"/> View Blast Radius
                            </button>
                        </div>
                    ) : (
                        <div className="py-10 flex flex-col items-center justify-center text-slate-700 gap-3 opacity-60">
                            <Search size={28} />
                            <p className="text-[10px] uppercase tracking-widest">Select a node</p>
                        </div>
                    )}
                </div>

                <div className="h-[20%] flex flex-col bg-[#0a0a0a]/80 backdrop-blur-sm border-t border-white/5 p-4">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <LayoutTemplate size={12} />
                        Structure Key
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {Object.entries(NODE_CONFIG).map(([key, config]: any) => (
                             <div key={key} className="flex items-center gap-2 text-[11px] text-slate-400 hover:text-slate-300 transition-colors p-1.5 rounded hover:bg-white/5">
                                 <span
                                   className="w-2 h-2 rounded-full shadow-[0_0_4px_currentColor]"
                                   style={{ backgroundColor: config.color }}
                                 />
                                 <config.icon size={10} className="text-slate-500" />
                                 <span className="font-medium">{config.label}</span>
                             </div>
                        ))}
                    </div>
                </div>
            </div>
        )}
      </aside>

      {/* Help Guide Button - Floating */}
      <button
        onClick={() => setShowHelpGuide(true)}
        className="fixed bottom-6 right-6 z-50 group"
        title="Show Help Guide"
      >
        <div className="relative">
          {/* Glow effect */}
          <div className="absolute inset-0 bg-indigo-500/30 rounded-full blur-xl group-hover:bg-indigo-500/50 transition-all animate-pulse-glow"></div>
          {/* Button */}
          <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-indigo-600/90 to-purple-600/90 border-2 border-indigo-400/50 shadow-[0_0_20px_rgba(99,102,241,0.5)] flex items-center justify-center hover:scale-110 transition-all duration-300 hover:shadow-[0_0_30px_rgba(99,102,241,0.8)] backdrop-blur-sm">
            <HelpCircle size={24} className="text-white group-hover:rotate-12 transition-transform" />
          </div>
          {/* Pulse ring */}
          <div className="absolute inset-0 rounded-full border-2 border-indigo-400/30 animate-ping"></div>
        </div>
      </button>

      {/* Help Guide Modal */}
      {showHelpGuide && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowHelpGuide(false)}
        >
          <div 
            className="relative w-full max-w-2xl rounded-2xl border border-indigo-500/30 bg-[#0a0a0a]/95 backdrop-blur-xl shadow-2xl overflow-hidden animate-fade-in-scale"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative px-6 py-4 border-b border-indigo-500/20 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 backdrop-blur-sm">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-transparent"></div>
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                    <HelpCircle size={20} className="text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Interactive Guide</h2>
                    <p className="text-xs text-slate-400">Learn how to navigate the codebase</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowHelpGuide(false)}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white transition-all"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Expand/Collapse Section */}
              <div className="p-5 rounded-xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/5 to-transparent hover:border-indigo-500/40 transition-all group">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30 group-hover:scale-110 transition-transform flex-shrink-0">
                    <ChevronRight size={24} className="text-indigo-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                      <MousePointerClick size={16} className="text-indigo-400" />
                      Expand & Collapse Nodes
                    </h3>
                    <p className="text-sm text-slate-300 leading-relaxed mb-3">
                      Click on any node in the dependency tree to expand or collapse it. Nodes with children show a chevron indicator (▶ for collapsed, ▼ for expanded).
                    </p>
                    <div className="mt-3 p-3 rounded-lg bg-black/40 border border-white/5 font-mono text-xs text-slate-400">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-indigo-400">▶</span>
                        <span>Collapsed node (click to expand)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-indigo-400">▼</span>
                        <span>Expanded node (click to collapse)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Inspect Node Section */}
              <div className="p-5 rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent hover:border-purple-500/40 transition-all group">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center border border-purple-500/30 group-hover:scale-110 transition-transform flex-shrink-0">
                    <Network size={24} className="text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                      <Search size={16} className="text-purple-400" />
                      Inspect Node & View Path
                    </h3>
                    <p className="text-sm text-slate-300 leading-relaxed mb-3">
                      Click on any node to select it and view its details. The selected node will be highlighted, and its complete path from the root will be displayed in the dependency tree.
                    </p>
                    <div className="mt-3 space-y-2">
                      <div className="p-3 rounded-lg bg-black/40 border border-white/5">
                        <div className="text-xs text-slate-400 mb-1">What happens when you click:</div>
                        <ul className="text-xs text-slate-300 space-y-1 ml-4 list-disc">
                          <li>Node is highlighted with a white border</li>
                          <li>Path to root is illuminated in the tree</li>
                          <li>Node details appear in the "Details" tab</li>
                          <li>You can chat about the node using "Chat About Node"</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Tips */}
              <div className="p-5 rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent">
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Zap size={14} className="text-emerald-400" />
                  Pro Tips
                </h3>
                <div className="space-y-2 text-xs text-slate-300">
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5">•</span>
                    <span>Use the <span className="text-white font-mono">Center</span> button to reset the tree view</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5">•</span>
                    <span>Switch between <span className="text-white font-mono">Vertical</span> and <span className="text-white font-mono">Horizontal</span> tree orientations</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5">•</span>
                    <span>Click on empty space to deselect nodes and clear the path</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5">•</span>
                    <span>Use the <span className="text-white font-mono">Assistant</span> tab to ask questions about your codebase</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-indigo-500/20 bg-[#0a0a0a]/50 backdrop-blur-sm">
              <button
                onClick={() => setShowHelpGuide(false)}
                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold uppercase tracking-wider transition-all shadow-lg hover:shadow-indigo-500/50"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- GRAPH AREA --- */}
      <main className="flex-1 min-w-0 relative bg-[#050505] overflow-hidden" ref={treeContainer}>
        {/* Graph Controls */}
        <div className="absolute top-6 left-6 z-10 flex gap-3">
            <div className="p-1 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 shadow-xl flex gap-1 glass-panel">
                <button onClick={() => setTreeOrientation('vertical')} className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${treeOrientation === 'vertical' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}><ChevronDown size={12} /> Vert</button>
                <button onClick={() => setTreeOrientation('horizontal')} className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${treeOrientation === 'horizontal' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}><ChevronRight size={12} /> Horz</button>
                <div className="w-px h-full bg-white/10 mx-1"></div>
                <button onClick={centerTree} className="px-3 py-1.5 text-slate-400 hover:text-white hover:bg-white/5 transition-all rounded-md flex items-center gap-2" title="Center Tree"><Move size={12} /> Center</button>
            </div>
        </div>

        {/* The D3 Tree */}
        <div className="w-full h-full relative">
            {graphData.nodes.length > 0 ? (
                <svg
                    ref={svgRef}
                    className="w-full h-full block"
                    viewBox="0 0 1000 800"
                >
                    <g ref={wrapperRef} />
                </svg>
            ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-700 gap-4 relative">
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl"></div>
                    </div>
                    <div className="relative z-10 flex flex-col items-center gap-4">
                        <div className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                            <LayoutTemplate size={48} strokeWidth={1} className="text-slate-600" />
                        </div>
                        <span className="uppercase tracking-widest text-xs text-slate-500 font-medium">Waiting for Repository...</span>
                        <p className="text-[10px] text-slate-600 text-center max-w-xs">Enter a repository URL above to begin visualization</p>
                    </div>
                </div>
            )}
        </div>
      </main>
    </div>
  );
}

