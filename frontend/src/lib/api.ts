import axios, { AxiosInstance, AxiosResponse } from 'axios';

// --- Domain Interfaces (The Contract) ---

export interface SQLResponse {
  status: string;
  sql_generated: string;
  data: Record<string, any>[];
  columns: string[];
  error: string | null;
}

export interface RAGResponse {
  answer: string;
  context_used: string;
}

// Strict typing for the visualization engine
export interface GraphNode {
  id: string;
  name: string;
  type: 'file' | 'class' | 'function' | 'module' | 'folder';
  val?: number;   // Visual size
  group?: string; // Visual color group
  
  // Git Metadata
  last_author?: string;
  last_modified?: string;
  commit_count?: number;
  
  [key: string]: any;
}

export interface GraphLink {
  source: string;
  target: string;
  relation: string;
  [key: string]: any;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface IngestResponse {
  status: string;
  message: string;
}

export interface IngestStatusResponse {
  state: 'idle' | 'running' | 'completed' | 'error';
  progress: number; // 0 to 100
  step: string;     // Description of current step
}

export interface CommitNode {
  hash: string;
  msg: string;
  author: string;
  date: string;
  files: string[];
}

// --- The Singleton Client ---
class DexClient {
  private client: AxiosInstance;
  private baseURL: string;

  constructor() {
    // --- DOCKER / LOCAL NETWORKING ---
    // - SERVER (SSR): Use INTERNAL_API_URL (Docker: dex-backend:8000) or NEXT_PUBLIC_API_URL or localhost:8000.
    // - BROWSER: Use NEXT_PUBLIC_API_URL or localhost:8000 (backend default). With Docker, set NEXT_PUBLIC_API_URL=http://localhost:8001.
    const defaultLocal = 'http://localhost:8000';
    if (typeof window === 'undefined') {
      this.baseURL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || defaultLocal;
    } else {
      this.baseURL = process.env.NEXT_PUBLIC_API_URL || defaultLocal;
    }

    // Set up Axios with the determined URL
    this.client = axios.create({
      baseURL: `${this.baseURL}/api/v1`, // Ensure your Python backend uses this prefix
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000, 
    });
  }

  // 1. Health Check (Note: Hits root /health, not /api/v1/health)
  public async checkHealth(): Promise<boolean> {
    try {
      const res = await axios.get(`${this.baseURL}/health`, {
        timeout: 5000,
        headers: { 'Content-Type': 'application/json' }
      });
      return res.status === 200;
    } catch (error) {
      console.warn("Health check failed:", error);
      return false;
    }
  }

  // 2. Code Architect (Hybrid RAG) Mode
  public async queryRAG(query: string): Promise<RAGResponse> {
    try {
      const res: AxiosResponse<RAGResponse> = await this.client.post('/query/hybrid', { query });
      return res.data;
    } catch (error: any) {
      console.error("RAG Engine Failure:", error?.message);
      throw new Error(error.response?.data?.detail || "AI Analysis Failed");
    }
  }

  // 3. Ingestion Trigger
  public async triggerIngestion(repoUrl: string): Promise<IngestResponse> {
    try {
      const res: AxiosResponse<IngestResponse> = await this.client.post('/ingest', { repo_path: repoUrl });
      return res.data;
    } catch (error: any) {
      console.error("Ingestion Trigger Failure:", error?.message);
      throw new Error(error.response?.data?.detail || "Failed to start ingestion");
    }
  }

  // 4. Get Ingestion Progress
  public async getIngestStatus(): Promise<IngestStatusResponse> {
    try {
      const res: AxiosResponse<IngestStatusResponse> = await this.client.get('/ingest/status');
      return res.data;
    } catch (error: any) {
      // Don't spam console if just polling
      return { state: 'error', progress: 0, step: "Failed to fetch status" };
    }
  }

  // 5. Get Knowledge Graph Data
  public async getGraphData(): Promise<GraphData> {
    try {
      const res: AxiosResponse<GraphData> = await this.client.get('/graph/structure');
      if (!res.data || !Array.isArray(res.data.nodes)) {
        return { nodes: [], links: [] };
      }
      return res.data;
    } catch (error: any) {
      console.error("Graph Load Failure:", error?.message);
      return { nodes: [], links: [] };
    }
  }

  // 6. Get Impact Radar
  public async getImpactGraph(fileId: string): Promise<GraphData> {
    try {
      const res: AxiosResponse<GraphData> = await this.client.get('/graph/impact', {
        params: { file_id: fileId }
      });
      return res.data;
    } catch (error: any) {
      console.error("Impact Graph Failure:", error?.message);
      return { nodes: [], links: [] };
    }
  }

  // 7. Get Time Travel History
  public async getGitHistory(): Promise<CommitNode[]> {
    try {
      const res: AxiosResponse<CommitNode[]> = await this.client.get('/git/history');
      return Array.isArray(res.data) ? res.data : [];
    } catch (error: any) {
      console.error("Git History Failure:", error?.message);
      return [];
    }
  }

  // 8. Lazy Load Graph Node
  public async expandGraphNode(nodeId: string): Promise<GraphData> {
    try {
      const res: AxiosResponse<GraphData> = await this.client.get('/graph/expand', {
        params: { node_id: nodeId }
      });
      return res.data;
    } catch (error: any) {
      console.error("Graph Expansion Failure:", error?.message);
      return { nodes: [], links: [] };
    }
  }
}

export const dexApi = new DexClient();