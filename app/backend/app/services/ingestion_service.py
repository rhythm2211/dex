import os
import shutil
import logging
import tempfile
import json
import requests
from datetime import datetime
from git import Repo
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
        self.data_dir = os.path.join(base_dir, "backend", "data")
        os.makedirs(self.data_dir, exist_ok=True)
        
        self.graph_path = os.path.join(self.data_dir, "repo_graph.json")
        self.history_path = os.path.join(self.data_dir, "repo_history.json") # NEW: Stores commit log

        # Internal status for polling
        self._status = {"state": "idle", "progress": 0, "step": "Ready"}

    def get_current_status(self):
        return self._status

    def _update_status(self, state: str, progress: int, step: str):
        self._status = {"state": state, "progress": progress, "step": step}
        logger.info(f"Ingestion Status: [{progress}%] {step}")

    def _wipe_knowledge_base(self):
        """Atomic Wipe: Clears Vector DB."""
        try:
            pc = Pinecone(api_key=settings.PINECONE_API_KEY)
            index = pc.Index(settings.PINECONE_INDEX_NAME)
            index.delete(delete_all=True)
            logger.info("Pinecone index cleared.")
        except Exception as e:
            logger.error(f"Pinecone wipe failed: {e}")

    def _analyze_git_history(self, repo_path: str):
        """
        Extracts commit history for the Time-Travel feature.
        Returns:
            1. timeline: List of commits for the UI Slider
            2. file_stats: Dict of {file_path: {last_author, churn_score, etc.}}
        """
        timeline = []
        file_stats = {}
        
        try:
            repo = Repo(repo_path)
            
            # Iterate over commits (limit to last 100 for performance if needed)
            for commit in repo.iter_commits('main', max_count=200):
                
                # 1. Build Timeline Entry
                commit_data = {
                    "hash": commit.hexsha,
                    "msg": commit.message.strip(),
                    "author": commit.author.name,
                    "date": datetime.fromtimestamp(commit.committed_date).isoformat(),
                    "files": list(commit.stats.files.keys()) # Files changed in this commit
                }
                timeline.append(commit_data)
                
                # 2. Accumulate File Stats (Heatmap & Blame)
                for file_path in commit.stats.files.keys():
                    if file_path not in file_stats:
                        file_stats[file_path] = {
                            "created_at": commit_data["date"],
                            "commit_count": 0,
                            "authors": set()
                        }
                    
                    stats = file_stats[file_path]
                    stats["last_modified"] = commit_data["date"]
                    stats["last_author"] = commit_data["author"]
                    stats["commit_count"] += 1
                    stats["authors"].add(commit_data["author"])

            # Post-process sets to lists for JSON serialization
            for f, stats in file_stats.items():
                stats["authors"] = list(stats["authors"])
                
            return timeline, file_stats

        except Exception as e:
            logger.warning(f"Git History Extraction Failed: {e}")
            return [], {}

    def process_repository(self, repo_path: str):
        self._update_status("running", 0, "Initializing pipeline...")
        self._wipe_knowledge_base()
        
        # --- PHASE 1: INSTANT MAP (Skipped for brevity in this snippet, logic remains same) ---

        # --- PHASE 2: DEEP ANALYSIS ---
        temp_dir = None
        actual_path = repo_path
        
        try:
            # 1. Clone (Full History)
            if any(repo_path.startswith(p) for p in ["http://", "https://", "git@"]):
                self._update_status("running", 15, "Cloning with full history...")
                temp_dir = tempfile.mkdtemp(prefix="dex_repo_")
                # REMOVED depth=1 to allow Time Travel analysis
                Repo.clone_from(repo_path, temp_dir) 
                actual_path = temp_dir
            
            # 2. Git History Extraction (The Time Machine)
            self._update_status("running", 30, "Analyzing Git Timeline & Blame...")
            timeline, file_stats = self._analyze_git_history(actual_path)
            
            # Save Timeline for Frontend (Time Travel Slider)
            with open(self.history_path, 'w') as f:
                json.dump(timeline, f)

            # 3. Load Source Files
            self._update_status("running", 40, "Scanning source files...")
            loader = DirectoryLoader(actual_path, glob="**/*.py", loader_cls=TextLoader)
            try:
                raw_docs = loader.load()
            except Exception:
                raw_docs = []

            # 4. AST Enrichment + Git Data Injection
            total_docs = len(raw_docs)
            self.graph_engine = GraphEngine() # Reset engine

            for i, doc in enumerate(raw_docs):
                if i % 5 == 0:
                    progress = 40 + int((i / total_docs) * 30)
                    self._update_status("running", progress, f"Mapping Code Structure ({i}/{total_docs})...")
                
                file_path = doc.metadata.get('source', 'unknown')
                relative_path = os.path.relpath(file_path, actual_path)
                
                # Build Graph (Nodes & Imports)
                self.graph_engine.extract_and_build(doc.page_content, relative_path, repo_root=actual_path)
                
                # INJECT GIT METADATA into the Graph Node
                if relative_path in self.graph_engine.graph.nodes:
                    git_info = file_stats.get(relative_path, {})
                    # We add these attributes to the node so the frontend can see them
                    nx_node = self.graph_engine.graph.nodes[relative_path]
                    nx_node["last_author"] = git_info.get("last_author", "Unknown")
                    nx_node["commit_count"] = git_info.get("commit_count", 0)
                    nx_node["last_modified"] = git_info.get("last_modified", "")

            self._update_status("running", 75, "Saving enriched knowledge graph...")
            self.graph_engine.save_graph(self.graph_path)

            # 5. Vector Embeddings (Pinecone)
            self._update_status("running", 80, "Generating semantic vectors...")
            vector_chunks = self.splitter.split_documents(raw_docs)
            
            for chunk in vector_chunks:
                full_path = chunk.metadata.get('source', '')
                chunk.metadata['file_name'] = os.path.relpath(full_path, actual_path)
                chunk.page_content = f"File: {chunk.metadata['file_name']}\n{chunk.page_content}"

            batch_size = 100
            total_chunks = len(vector_chunks)
            for i in range(0, total_chunks, batch_size):
                batch_progress = 80 + int((i / total_chunks) * 15)
                self._update_status("running", batch_progress, f"Indexing vectors ({i}/{total_chunks})...")
                
                batch = vector_chunks[i:i + batch_size]
                PineconeVectorStore.from_documents(
                    batch, 
                    self.embeddings, 
                    index_name=settings.PINECONE_INDEX_NAME, 
                    pinecone_api_key=settings.PINECONE_API_KEY
                )

            self._update_status("completed", 100, "Analysis Complete.")
            return {"status": "success", "chunks_processed": total_chunks}

        except Exception as e:
            logger.error(f"Ingestion Failed: {e}")
            self._update_status("error", 0, f"Error: {str(e)}")
            return {"status": "failed", "error": str(e)}
        finally:
            if temp_dir and os.path.exists(temp_dir):
                # Only delete if we are using a temp dir (cloned repo)
                try:
                    # Windows sometimes locks git files; ignore errors here to prevent crashing
                    shutil.rmtree(temp_dir, ignore_errors=True) 
                except:
                    pass