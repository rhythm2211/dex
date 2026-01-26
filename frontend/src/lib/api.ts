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
  
  // [NEW] Social & Risk Metadata (Populated by Ingestion)
  top_owner?: string;        // The "Live Blame" owner
  bus_risk_score?: number;   // 0.0 to 1.0 (Bus Factor)
  collaborators?: string[];  // List of people who touch this file

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
  state: 'idle' | 'running' | 'completed' | 'error' | 'cancelled';
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

// [NEW] Onboarding Interfaces
export interface TeamNode {
  id: string;      // Developer Name
  group: 'person';
  radius: number;
}

export interface TeamLink {
  source: string; // Developer Name A
  target: string; // Developer Name B
  value: number;  // Collaboration strength (co-edits)
}

export interface TeamTopologyResponse {
  nodes: TeamNode[];
  links: TeamLink[];
}

export interface ZoneData {
  name: string;      // Folder path (e.g., "backend/services")
  value: number;     // Commit count
  intensity: 'High' | 'Low';
}

export interface ActiveZonesResponse {
  zones: ZoneData[];
  msg?: string;
}

// [NEW] Health Dashboard Interfaces
export interface CycleDetected {
  cycle_path: string[];
  depth: number;
}

export interface GodObject {
  name: string;
  fan_in: number;
  fan_out: number;
  complexity_score: number;
  type?: string;
  bus_risk_score?: number;
}

export interface OrphanNode {
  name: string;
  path?: string;
  last_modified?: string;
  type?: string;
}

export interface HealthSummary {
  score: number; // 0-100
  total_files: number;
  critical_issues: number;
  cycles_count: number;
  god_objects_count: number;
  orphans_count: number;
  bus_factor_risk: number; // Average bus risk score
}

// --- The Singleton Client ---
class DexClient {
  private client: AxiosInstance;
  private baseURL: string;
  private getUserSession: (() => Promise<{ user?: { email?: string; id?: string } | null }>) | null = null;

  constructor() {
    // --- DOCKER / LOCAL NETWORKING ---
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

    // Add request interceptor to include user context
    this.client.interceptors.request.use(async (config) => {
      // Try to get user session if available (client-side only)
      if (typeof window !== 'undefined') {
        try {
          // Retry logic: wait for session getter to be set (with timeout)
          let retries = 3;
          while (!this.getUserSession && retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 50));
            retries--;
          }
          
          if (this.getUserSession) {
            const session = await this.getUserSession();
            if (session?.user) {
              // Add user email or ID to headers
              if (session.user.email) {
                config.headers['X-User-Email'] = session.user.email;
              }
              if (session.user.id) {
                config.headers['X-User-Id'] = session.user.id;
              }
            } else {
              // Session is null - user might not be logged in
              // This is okay for some endpoints, backend will handle auth requirements
              console.debug('No user session available for request:', config.url);
            }
          } else {
            // Session getter not set yet - might be initializing
            console.debug('Session getter not initialized yet for request:', config.url);
          }
        } catch (error) {
          // Log error but don't block the request
          // The backend will return 401 if auth is required
          console.debug('Could not get user session for API request:', error);
        }
      }
      return config;
    });
  }

  /**
   * Set the function to get the current user session.
   * This should be called from components that have access to useSession.
   */
  setUserSessionGetter(getter: () => Promise<{ user?: { email?: string; id?: string } | null }>) {
    this.getUserSession = getter;
  }

  // Helper to check if error is an aborted/cancelled request (expected behavior)
  private isAbortError(error: any): boolean {
    return (
      error?.code === 'ERR_CANCELED' ||
      error?.message === 'Request aborted' ||
      error?.message?.includes('aborted') ||
      error?.name === 'CanceledError' ||
      axios.isCancel(error)
    );
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
      // Log the base URL being used for debugging
      console.log(`[Ingestion] Using API URL: ${this.baseURL}`);
      console.log(`[Ingestion] Full endpoint: ${this.baseURL}/api/v1/ingest`);
      
      // Ingestion should return immediately (uses background tasks)
      // Increased timeout to handle any initialization delays
      const res: AxiosResponse<IngestResponse> = await this.client.post('/ingest', { repo_path: repoUrl }, {
        timeout: 120000, // 120 seconds to handle service initialization if needed
      });
      return res.data;
    } catch (error: any) {
      console.error("Ingestion Trigger Failure:", error?.message);
      console.error("Full error:", error);
      console.error("Error details:", {
        message: error?.message,
        code: error?.code,
        response: error?.response?.data,
        status: error?.response?.status,
        baseURL: this.baseURL,
        endpoint: `${this.baseURL}/api/v1/ingest`
      });
      
      // Provide more detailed error information
      let errorMessage = "Failed to start ingestion";
      
      // Check for ERR_BLOCKED_BY_CLIENT (browser extension blocking)
      if (error?.code === 'ERR_BLOCKED_BY_CLIENT' || 
          error?.message?.includes('ERR_BLOCKED_BY_CLIENT') ||
          error?.message?.includes('blocked by client')) {
        errorMessage = `Request was blocked by browser extension (ad blocker/privacy tool). Please disable extensions for this site or try in incognito mode.`;
        console.error("🚫 Request blocked by browser extension. Try disabling ad blockers or privacy extensions.");
      } else if (error?.code === 'ECONNREFUSED' || error?.code === 'ERR_NETWORK' || error?.message?.includes('Network Error')) {
        errorMessage = `Cannot connect to backend at ${this.baseURL}. Please check if the backend is running and accessible.`;
      } else if (error?.response?.status === 400) {
        errorMessage = error.response.data?.detail || "Invalid request. Please check the repository URL.";
      } else if (error?.response?.status === 409) {
        errorMessage = error.response.data?.detail || "An ingestion task is already running.";
      } else if (error?.response?.status === 401) {
        errorMessage = "Authentication required. Please log in again.";
      } else if (error?.response?.status === 403) {
        errorMessage = "Access forbidden. Please check your permissions.";
      } else if (error?.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      throw new Error(errorMessage);
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

  // 5. Cancel Ingestion
  public async cancelIngestion(): Promise<void> {
    try {
      await this.client.post('/ingest/cancel');
    } catch (error: any) {
      console.error("Failed to cancel ingestion:", error?.message);
      throw new Error(error.response?.data?.detail || "Failed to cancel ingestion");
    }
  }

  // 6. Reset Ingestion Status (for stuck ingestion)
  public async resetIngestionStatus(): Promise<void> {
    try {
      await this.client.post('/ingest/reset');
    } catch (error: any) {
      console.error("Failed to reset ingestion status:", error?.message);
      throw new Error(error.response?.data?.detail || "Failed to reset ingestion status");
    }
  }

  // 6. Get Knowledge Graph Data
  public async getGraphData(): Promise<GraphData> {
    try {
      // Graph queries can take longer, especially for large codebases
      const res: AxiosResponse<GraphData> = await this.client.get('/graph/structure', {
        timeout: 120000, // 2 minutes for large graphs
      });
      if (!res.data || !Array.isArray(res.data.nodes)) {
        return { nodes: [], links: [] };
      }
      return res.data;
    } catch (error: any) {
      console.error("Graph Load Failure:", error?.message);
      // Return empty graph instead of throwing to prevent UI crashes
      return { nodes: [], links: [] };
    }
  }

  // 6. Get Impact Radar
  public async getImpactGraph(fileId: string): Promise<GraphData> {
    try {
      const res: AxiosResponse<GraphData> = await this.client.get('/graph/impact', {
        params: { file_id: fileId },
        timeout: 60000, // 1 minute for impact analysis
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
        params: { node_id: nodeId },
        timeout: 60000, // 1 minute for node expansion
      });
      return res.data;
    } catch (error: any) {
      console.error("Graph Expansion Failure:", error?.message);
      return { nodes: [], links: [] };
    }
  }

  // [NEW] 9. Get Team Topology (Who works with whom?)
  public async getTeamTopology(): Promise<TeamTopologyResponse> {
    try {
      const res: AxiosResponse<TeamTopologyResponse> = await this.client.get('/onboarding/team-topology');
      return res.data;
    } catch (error: any) {
      // Don't log abort errors - they're expected when components unmount or requests are cancelled
      if (!this.isAbortError(error)) {
        console.error("Team Topology Failure:", error?.message);
      }
      return { nodes: [], links: [] };
    }
  }

  // [NEW] 10. Get Active Zones (Heatmap)
  public async getActiveZones(days: number = 30): Promise<ActiveZonesResponse> {
    try {
      const res: AxiosResponse<ActiveZonesResponse> = await this.client.get('/onboarding/active-zones', {
        params: { days }
      });
      return res.data;
    } catch (error: any) {
      // Don't log abort errors - they're expected when components unmount or requests are cancelled
      if (!this.isAbortError(error)) {
        console.error("Active Zones Failure:", error?.message);
      }
      return { zones: [] };
    }
  }

  // [NEW] 11. Health Dashboard APIs
  public async getHealthSummary(): Promise<HealthSummary> {
    try {
      const res: AxiosResponse<HealthSummary> = await this.client.get('/health/summary', {
        timeout: 60000, // 60 seconds for health analysis (optimized queries should be faster)
      });
      return res.data;
    } catch (error: any) {
      console.error("Health Summary Failure:", error?.message);
      // Return default values on error
      return {
        score: 0,
        total_files: 0,
        critical_issues: 0,
        cycles_count: 0,
        god_objects_count: 0,
        orphans_count: 0,
        bus_factor_risk: 0.0,
      };
    }
  }

  public async getCircularDependencies(): Promise<CycleDetected[]> {
    try {
      const res: AxiosResponse<CycleDetected[]> = await this.client.get('/health/cycles', {
        timeout: 60000,
      });
      return res.data;
    } catch (error: any) {
      console.error("Circular Dependencies Failure:", error?.message);
      return [];
    }
  }

  public async getGodObjects(): Promise<GodObject[]> {
    try {
      const res: AxiosResponse<GodObject[]> = await this.client.get('/health/risks', {
        timeout: 60000,
      });
      return res.data;
    } catch (error: any) {
      console.error("God Objects Failure:", error?.message);
      return [];
    }
  }

  public async getOrphanNodes(): Promise<OrphanNode[]> {
    try {
      const res: AxiosResponse<OrphanNode[]> = await this.client.get('/health/orphans', {
        timeout: 60000,
      });
      return res.data;
    } catch (error: any) {
      console.error("Orphan Nodes Failure:", error?.message);
      return [];
    }
  }
}

export const dexApi = new DexClient();