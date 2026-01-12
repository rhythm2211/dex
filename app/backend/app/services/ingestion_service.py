import os
import shutil
import logging
import tempfile
import requests
from git import Repo
from git.exc import GitCommandError
from langchain_community.document_loaders import DirectoryLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter, Language
from langchain_pinecone import PineconeVectorStore
from langchain_huggingface import HuggingFaceEmbeddings
from pinecone import Pinecone
from backend.app.core.config import settings
from backend.app.domain.graph_engine import GraphEngine

# Setup Logging
logger = logging.getLogger("dex-core")

class IngestionService:
    def __init__(self):
        self.splitter = RecursiveCharacterTextSplitter.from_language(
            language=Language.PYTHON, 
            chunk_size=1000, 
            chunk_overlap=100
        )
        self.graph_engine = GraphEngine()
        self.embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        
        # Paths
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        data_dir = os.path.join(base_dir, "backend", "data")
        os.makedirs(data_dir, exist_ok=True)
        self.graph_path = os.path.join(data_dir, "repo_graph.json")

        # Internal status for polling
        self._status = {"state": "idle", "progress": 0, "step": "Ready"}

    def get_current_status(self):
        """Read-only access to current progress."""
        return self._status

    def _update_status(self, state: str, progress: int, step: str):
        """Helper to update internal state."""
        self._status = {"state": state, "progress": progress, "step": step}
        logger.info(f"Ingestion Status: [{progress}%] {step}")

    def _wipe_knowledge_base(self):
        """
        Atomic Wipe: Clears Vector DB.
        NOTE: We do NOT delete the local graph file immediately here, 
        because Phase 1 might have just created it.
        """
        try:
            pc = Pinecone(api_key=settings.PINECONE_API_KEY)
            index = pc.Index(settings.PINECONE_INDEX_NAME)
            index.delete(delete_all=True)
            logger.info("Pinecone index cleared.")
        except Exception as e:
            logger.error(f"Pinecone wipe failed: {e}")

    def _fetch_github_tree(self, repo_url: str):
        """
        PHASE 1 (FAST): Uses GitHub API to build the 3D Tree structure instantly.
        """
        try:
            # Parse Owner/Repo from URL
            parts = repo_url.rstrip("/").split("/")
            if len(parts) < 2: return False
            owner, repo = parts[-2], parts[-1]
            
            # Prepare API Request
            api_url = f"https://api.github.com/repos/{owner}/{repo}/git/trees/main?recursive=1"
            headers = {"Authorization": f"Bearer {settings.GITHUB_TOKEN}"} if settings.GITHUB_TOKEN else {}
            
            # Try 'main', fallback to 'master'
            response = requests.get(api_url, headers=headers)
            if response.status_code == 404:
                api_url = f"https://api.github.com/repos/{owner}/{repo}/git/trees/master?recursive=1"
                response = requests.get(api_url, headers=headers)
            
            if response.status_code != 200:
                logger.warning(f"GitHub API failed ({response.status_code}). Skipping fast map.")
                return False

            tree_data = response.json().get("tree", [])
            
            # Build & Save Skeleton Graph
            self.graph_engine = GraphEngine() # Reset engine
            self.graph_engine.build_from_github_tree(tree_data)
            self.graph_engine.save_graph(self.graph_path)
            return True

        except Exception as e:
            logger.error(f"Fast Tree Build Error: {e}")
            return False

    def process_repository(self, repo_path: str):
        """
        Orchestrates the Dual-Speed Ingestion Pipeline.
        """
        self._update_status("running", 0, "Initializing pipeline...")
        
        # Step 0: Clean Vector DB
        self._wipe_knowledge_base()
        
        # --- PHASE 1: INSTANT MAP (The Hook) ---
        if "github.com" in repo_path and settings.GITHUB_TOKEN:
            self._update_status("running", 5, "Fetching visual structure (GitHub API)...")
            success = self._fetch_github_tree(repo_path)
            if success:
                self._update_status("running", 15, "3D Map Live. Starting Deep Analysis...")
            else:
                self._update_status("running", 10, "GitHub API unavailable. Switching to Clone...")

        # --- PHASE 2: DEEP ANALYSIS (The Brain) ---
        temp_dir = None
        actual_path = repo_path
        
        try:
            # 1. Clone
            if any(repo_path.startswith(p) for p in ["http://", "https://", "git@"]):
                self._update_status("running", 20, "Cloning source code for deep analysis...")
                temp_dir = tempfile.mkdtemp(prefix="dex_repo_")
                Repo.clone_from(repo_path, temp_dir, depth=1)
                actual_path = temp_dir
            
            # 2. Load Source Files
            self._update_status("running", 30, "Scanning source files...")
            loader = DirectoryLoader(actual_path, glob="**/*.py", loader_cls=TextLoader)
            try:
                raw_docs = loader.load()
            except Exception:
                raw_docs = [] # Handle empty or non-python repos gracefully

            if not raw_docs:
                logger.warning("No Python files found for deep analysis.")
                # We still return success if the Graph Map (Phase 1) worked
                self._update_status("completed", 100, "Analysis Complete (No Python files).")
                return {"status": "success"}

            # 3. AST Enrichment (Adding Intelligence)
            # We iterate through files and ENRICH the existing graph nodes
            total_docs = len(raw_docs)
            for i, doc in enumerate(raw_docs):
                # Update progress incrementally
                if i % 5 == 0:
                    progress = 35 + int((i / total_docs) * 35) # 35% to 70%
                    self._update_status("running", progress, f"Analyzing Syntax ({i}/{total_docs} files)...")
                
                file_path = doc.metadata.get('source', 'unknown')
                relative_path = os.path.relpath(file_path, actual_path)
                
                # This adds 'Class' and 'Function' nodes to the file structure
                self.graph_engine.extract_and_build(doc.page_content, relative_path)
            
            self._update_status("running", 75, "Saving enriched knowledge graph...")
            self.graph_engine.save_graph(self.graph_path)

            # 4. Vector Embeddings (Search Index)
            self._update_status("running", 80, "Generating semantic vectors...")
            vector_chunks = self.splitter.split_documents(raw_docs)
            
            # Link chunks to the Graph via metadata
            for chunk in vector_chunks:
                full_path = chunk.metadata.get('source', '')
                chunk.metadata['file_name'] = os.path.relpath(full_path, actual_path)
                chunk.page_content = f"File: {chunk.metadata['file_name']}\n{chunk.page_content}"

            # Batched Upload to Pinecone
            batch_size = 100
            total_chunks = len(vector_chunks)
            for i in range(0, total_chunks, batch_size):
                batch_progress = 80 + int((i / total_chunks) * 15) # 80% to 95%
                self._update_status("running", batch_progress, f"Indexing vectors ({i}/{total_chunks})...")
                
                batch = vector_chunks[i:i + batch_size]
                PineconeVectorStore.from_documents(
                    batch, 
                    self.embeddings, 
                    index_name=settings.PINECONE_INDEX_NAME, 
                    pinecone_api_key=settings.PINECONE_API_KEY
                )

            self._update_status("completed", 100, "Analysis Complete.")
            logger.info("✅ Ingestion Pipeline Finished.")
            return {
                "status": "success",
                "chunks_processed": total_chunks,
                "graph_nodes": self.graph_engine.graph.number_of_nodes()
            }

        except Exception as e:
            logger.error(f"Ingestion Failed: {e}")
            self._update_status("error", 0, f"Error: {str(e)}")
            return {"status": "failed", "error": str(e)}
        finally:
            if temp_dir and os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)