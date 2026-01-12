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
  // UPDATE: Added 'folder' so 3D graph handles directories correctly
  type: 'file' | 'class' | 'function' | 'module' | 'folder';
  val?: number;   // Visual size
  group?: string; // Visual color group
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

// NEW: Interface for progress bar status
export interface IngestStatusResponse {
  state: 'idle' | 'running' | 'completed' | 'error';
  progress: number; // 0 to 100
  step: string;     // Description of current step
}

// --- The Singleton Client ---
class DexClient {
  private client: AxiosInstance;
  private baseURL: string = 'http://localhost:8000';

  constructor() {
    this.client = axios.create({
      baseURL: `${this.baseURL}/api/v1`,
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000, // 60s timeout for deep queries
    });
  }

  // 1. Health Check
  public async checkHealth(): Promise<boolean> {
    try {
      const res = await axios.get(`${this.baseURL}/health`, {
        timeout: 5000,
        headers: { 'Content-Type': 'application/json' }
      });
      return res.status === 200;
    } catch (error) {
      return false;
    }
  }

  // 2. Code Architect (Hybrid RAG) Mode
  public async queryRAG(query: string): Promise<RAGResponse> {
    try {
      const res: AxiosResponse<RAGResponse> = await this.client.post('/query/hybrid', { query });
      return res.data;
    } catch (error: any) {
      console.error("RAG Engine Failure:", error);
      throw new Error(error.response?.data?.detail || "AI Analysis Failed");
    }
  }

  // 3. Ingestion Trigger
  public async triggerIngestion(repoUrl: string): Promise<IngestResponse> {
    try {
      const res: AxiosResponse<IngestResponse> = await this.client.post('/ingest', { repo_path: repoUrl });
      return res.data;
    } catch (error: any) {
      console.error("Ingestion Trigger Failure:", error);
      throw new Error(error.response?.data?.detail || "Failed to start ingestion");
    }
  }

  // 4. Get Ingestion Progress (Polling)
  public async getIngestStatus(): Promise<IngestStatusResponse> {
    try {
      const res: AxiosResponse<IngestStatusResponse> = await this.client.get('/ingest/status');
      return res.data;
    } catch (error: any) {
      console.error("Failed to get ingestion status:", error);
      // Return a safe error state so UI doesn't crash
      return { state: 'error', progress: 0, step: "Failed to fetch status" };
    }
  }

  // 5. Get Knowledge Graph Data
  public async getGraphData(): Promise<GraphData> {
    try {
      const res: AxiosResponse<GraphData> = await this.client.get('/graph/structure');
      
      // Validation
      if (!res.data || !Array.isArray(res.data.nodes)) {
        return { nodes: [], links: [] };
      }
      
      return res.data;
    } catch (error: any) {
      console.error("Graph Load Failure:", error);
      
      if (error.code === 'ECONNREFUSED' || error.message === 'Network Error') {
        throw new Error("Backend unavailable. Is the server running on port 8000?");
      }
      
      return { nodes: [], links: [] };
    }
  }
}

export const dexApi = new DexClient();