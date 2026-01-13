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
        # Initialize the Neo4j-backed Graph Engine
        self.graph_engine = GraphEngine()
        self.embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        
        # Paths
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        self.data_dir = os.path.join(base_dir, "backend", "data")
        os.makedirs(self.data_dir, exist_ok=True)
        
        # We still keep history locally for the timeline slider (it's small & sequential)
        self.history_path = os.path.join(self.data_dir, "repo_history.json") 

        # Internal status for polling
        self._status = {"state": "idle", "progress": 0, "step": "Ready"}

    def get_current_status(self):
        return self._status

    def _update_status(self, state: str, progress: int, step: str):
        self._status = {"state": state, "progress": progress, "step": step}
        logger.info(f"Ingestion Status: [{progress}%] {step}")

    def _wipe_knowledge_base(self):
        """
        Atomic Wipe: Clears Vector DB (Pinecone) AND Graph DB (Neo4j).
        """
        # 1. Clear Pinecone
        try:
            pc = Pinecone(api_key=settings.PINECONE_API_KEY)
            index = pc.Index(settings.PINECONE_INDEX_NAME)
            index.delete(delete_all=True)
            logger.info("✅ Pinecone index cleared.")
        except Exception as e:
            logger.error(f"Pinecone wipe failed: {e}")

        # 2. Clear Neo4j
        try:
            self.graph_engine.wipe_graph()
            logger.info("✅ Neo4j database wiped.")
        except Exception as e:
            logger.error(f"Neo4j wipe failed: {e}")

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
            
            # Iterate over commits (limit to last 200 for performance)
            # You can increase this if you want deeper history
            for commit in repo.iter_commits('main', max_count=200):
                
                # 1. Build Timeline Entry
                commit_data = {
                    "hash": commit.hexsha,
                    "msg": commit.message.strip(),
                    "author": commit.author.name,
                    "date": datetime.fromtimestamp(commit.committed_date).isoformat(),
                    "files": list(commit.stats.files.keys()) 
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
        
        # Step 0: Clean Slate
        self._wipe_knowledge_base()
        
        # --- PHASE 1: CLONING & HISTORY ---
        temp_dir = None
        actual_path = repo_path
        
        try:
            # 1. Clone (Full History)
            if any(repo_path.startswith(p) for p in ["http://", "https://", "git@"]):
                self._update_status("running", 15, "Cloning with full history...")
                temp_dir = tempfile.mkdtemp(prefix="dex_repo_")
                Repo.clone_from(repo_path, temp_dir) 
                actual_path = temp_dir
            
            # 2. Git History Extraction
            self._update_status("running", 30, "Analyzing Git Timeline & Blame...")
            timeline, file_stats = self._analyze_git_history(actual_path)
            
            # Save Timeline Locally (It's small and purely sequential)
            with open(self.history_path, 'w') as f:
                json.dump(timeline, f)

            # 3. Load Source Files
            self._update_status("running", 40, "Scanning source files...")
            loader = DirectoryLoader(actual_path, glob="**/*.py", loader_cls=TextLoader)
            try:
                raw_docs = loader.load()
            except Exception:
                raw_docs = []

            # --- PHASE 2: STREAM TO CLOUD (NEO4J) ---
            total_docs = len(raw_docs)
            
            # Note: We already wiped the graph in _wipe_knowledge_base
            
            for i, doc in enumerate(raw_docs):
                # Update progress bar
                if i % 5 == 0:
                    progress = 40 + int((i / total_docs) * 35) # 40% -> 75%
                    self._update_status("running", progress, f"Streaming Nodes to Cloud ({i}/{total_docs})...")
                
                file_path = doc.metadata.get('source', 'unknown')
                relative_path = os.path.relpath(file_path, actual_path)
                
                # Get extracted Git Metadata
                git_meta = file_stats.get(relative_path, {})
                
                # PUSH TO NEO4J (Streaming)
                # This replaces the old local 'extract_and_build' + 'save_graph' pattern
                self.graph_engine.extract_and_build(
                    file_content=doc.page_content, 
                    file_path=relative_path, 
                    repo_root=actual_path,
                    git_metadata=git_meta
                )

            # --- PHASE 3: VECTOR EMBEDDINGS (PINECONE) ---
            self._update_status("running", 80, "Generating semantic vectors...")
            vector_chunks = self.splitter.split_documents(raw_docs)
            
            # Enhance chunks with filenames
            for chunk in vector_chunks:
                full_path = chunk.metadata.get('source', '')
                chunk.metadata['file_name'] = os.path.relpath(full_path, actual_path)
                chunk.page_content = f"File: {chunk.metadata['file_name']}\n{chunk.page_content}"

            batch_size = 100
            total_chunks = len(vector_chunks)
            for i in range(0, total_chunks, batch_size):
                batch_progress = 80 + int((i / total_chunks) * 15) # 80% -> 95%
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
                try:
                    shutil.rmtree(temp_dir, ignore_errors=True) 
                except:
                    pass