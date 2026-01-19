import os
import shutil
import logging
import tempfile
import json
import threading
from datetime import datetime
from collections import Counter
from git import Repo, RemoteProgress
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
        
        # Progress callback for git clone
        self._clone_progress = None

    def get_current_status(self):
        return self._status

    def _update_status(self, state: str, progress: int, step: str):
        self._status = {"state": state, "progress": progress, "step": step}
        logger.info(f"Ingestion Status: [{progress}%] {step}")
    
    class _CloneProgress(RemoteProgress):
        """Progress callback for git clone operations"""
        def __init__(self, status_callback):
            super().__init__()
            self.status_callback = status_callback
            self.last_update = 0
            
        def update(self, op_code, cur_count, max_count=None, message=''):
            # Update every 5% or when max_count changes
            if max_count and max_count > 0:
                progress_pct = int((cur_count / max_count) * 10)  # 0-10% of total 15% progress
                if progress_pct != self.last_update:
                    self.status_callback("running", 15 + progress_pct, 
                                       f"Cloning... ({cur_count}/{max_count} objects)" if max_count else "Cloning...")
                    self.last_update = progress_pct

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

    def _get_file_blame(self, repo_path: str, relative_file_path: str):
        """
        Runs 'git blame' to map every line number to an author.
        Returns: { 1: "Alice", 2: "Alice", 3: "Bob" }
        Used to determine Function-Level Ownership.
        """
        try:
            repo = Repo(repo_path)
            blame_map = {}
            
            # Use porcelain for easy parsing
            # '--line-porcelain' outputs full commit info for every line
            val = repo.git.blame('--line-porcelain', relative_file_path)
            
            current_author = "Unknown"
            current_line = 0
            
            for line in val.splitlines():
                if line.startswith("author "):
                    current_author = line[7:] # Remove "author "
                elif line.startswith("\t"):
                    # This is the actual code line (starts with tab in porcelain)
                    current_line += 1
                    blame_map[current_line] = current_author
                        
            return blame_map
            
        except Exception as e:
            # If file is new/uncommitted or binary, blame might fail.
            # logger.warning(f"Blame failed for {relative_file_path}: {e}")
            return {}

    def _analyze_git_history(self, repo_path: str):
        """
        Extracts commit history from ALL branches (main + features).
        Calculates 'Bus Factor' risk by tracking author dominance per file.
        """
        timeline = []
        file_stats = {}
        seen_commits = set()  # CRITICAL: Deduplication set
        
        try:
            repo = Repo(repo_path)
            
            # 1. Identify all refs to scan (Local + Remote)
            # We filter for 'origin/' to capture remote branches even if not checked out locally
            all_refs = [r.name for r in repo.references if 'origin/' in r.name or r.name in ['main', 'master', 'HEAD']]
            
            # Dedup ref names and sort so 'main' is processed first (optimization)
            branches = sorted(list(set(all_refs)), key=lambda x: 0 if 'main' in x or 'master' in x else 1)
            
            logger.info(f"📊 Analyzing history across refs: {len(branches)} found")

            for branch in branches:
                try:
                    # Limit per branch to prevent timeouts on massive repos
                    # 100 commits per branch is usually enough to capture active dev
                    for commit in repo.iter_commits(branch, max_count=100):
                        
                        if commit.hexsha in seen_commits:
                            continue # Skip if we already processed this via another branch
                        
                        seen_commits.add(commit.hexsha)
                        
                        # --- Build Timeline Entry ---
                        commit_data = {
                            "hash": commit.hexsha,
                            "msg": commit.message.strip(),
                            "author": commit.author.name,
                            "date": datetime.fromtimestamp(commit.committed_date).isoformat(),
                            "files": list(commit.stats.files.keys()),
                            "branch": branch
                        }
                        timeline.append(commit_data)
                        
                        # --- Accumulate File Stats (Heatmap & Blame) ---
                        for file_path in commit.stats.files.keys():
                            if file_path not in file_stats:
                                file_stats[file_path] = {
                                    "created_at": commit_data["date"],
                                    "commit_count": 0,
                                    "author_counts": Counter(), # Changed from set to Counter
                                    "active_branches": set()
                                }
                            
                            stats = file_stats[file_path]
                            
                            # Only update "last_modified" if this commit is newer
                            if commit_data["date"] > stats.get("last_modified", ""):
                                stats["last_modified"] = commit_data["date"]
                                stats["last_author"] = commit_data["author"]
                            
                            stats["commit_count"] += 1
                            stats["author_counts"][commit_data["author"]] += 1
                            stats["active_branches"].add(branch)

                except Exception as e:
                    # Some refs might be HEAD pointers or tags that fail iter_commits
                    logger.debug(f"Skipping ref {branch}: {e}")
                    continue

            # Sort timeline by date
            timeline.sort(key=lambda x: x['date'], reverse=True)

            # --- POST-PROCESSING: Calculate Bus Factor / Risk Score ---
            for f_path, stats in file_stats.items():
                total_commits = stats["commit_count"]
                
                # Default values
                stats["bus_risk_score"] = 0.0
                stats["top_owner"] = "None"
                
                if total_commits > 0:
                    # Find who owns the most commits
                    top_author, top_count = stats["author_counts"].most_common(1)[0]
                    
                    # Risk Calculation: (Top Author Commits / Total Commits)
                    # Example: 9/10 commits by Bob = 0.9 Risk
                    risk_score = round(top_count / total_commits, 2)
                    
                    stats["bus_risk_score"] = risk_score
                    stats["top_owner"] = top_author
                
                # Cleanup: Convert sets/counters to JSON-serializable formats
                stats["authors"] = list(stats["author_counts"].keys()) # List of unique names
                del stats["author_counts"] # Remove the counter object
                stats["active_branches"] = list(stats["active_branches"])
                
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
                
                # Create progress callback
                progress_callback = self._CloneProgress(self._update_status)
                
                # Clone with progress reporting and timeout handling
                try:
                    # Use threading to implement timeout
                    clone_result = {"success": False, "error": None}
                    
                    def clone_worker():
                        try:
                            Repo.clone_from(repo_path, temp_dir, progress=progress_callback)
                            clone_result["success"] = True
                        except Exception as e:
                            clone_result["error"] = e
                    
                    clone_thread = threading.Thread(target=clone_worker, daemon=True)
                    clone_thread.start()
                    clone_thread.join(timeout=600)  # 10 minute timeout
                    
                    if clone_thread.is_alive():
                        # Thread is still running, timeout occurred
                        raise TimeoutError(f"Git clone timed out after 10 minutes. The repository may be too large or network is slow.")
                    
                    if not clone_result["success"]:
                        if clone_result["error"]:
                            raise clone_result["error"]
                        else:
                            raise RuntimeError("Git clone failed for unknown reason")
                    
                    actual_path = temp_dir
                    self._update_status("running", 25, "Clone completed successfully")
                    
                except GitCommandError as e:
                    error_msg = str(e)
                    if "Connection reset" in error_msg or "Connection aborted" in error_msg:
                        logger.error(f"Git clone connection reset - network issue: {e}")
                        raise RuntimeError(f"Network connection was reset while cloning. This may be due to:\n"
                                         f"- Unstable network connection\n"
                                         f"- Repository server (GitHub) temporarily unavailable\n"
                                         f"- Firewall/proxy blocking the connection\n"
                                         f"Please check your network and try again.")
                    else:
                        logger.error(f"Git clone command failed: {e}")
                        raise RuntimeError(f"Failed to clone repository: {e}")
                except TimeoutError as e:
                    logger.error(f"Git clone timeout: {e}")
                    raise
                except (ConnectionError, OSError) as e:
                    error_msg = str(e)
                    if "Connection reset" in error_msg or "Connection aborted" in error_msg or "104" in error_msg:
                        logger.error(f"Git clone connection reset: {e}")
                        raise RuntimeError(f"Network connection was reset while cloning repository.\n"
                                         f"Error: {error_msg}\n"
                                         f"This usually indicates a network issue. Please check:\n"
                                         f"- Your internet connection\n"
                                         f"- GitHub accessibility\n"
                                         f"- Firewall settings\n"
                                         f"Try again in a few moments.")
                    else:
                        logger.error(f"Network error during clone: {e}")
                        raise RuntimeError(f"Network error while cloning: {e}")
                except Exception as e:
                    error_msg = str(e)
                    if "Connection reset" in error_msg or "Connection aborted" in error_msg:
                        logger.error(f"Connection reset error during clone: {e}")
                        raise RuntimeError(f"Connection was reset during repository clone. Please try again.")
                    else:
                        logger.error(f"Unexpected error during clone: {e}")
                        raise RuntimeError(f"Repository cloning failed: {e}")
            
            # 2. Git History Extraction (Multi-Branch + Risk Calc)
            self._update_status("running", 30, "Analyzing Git Timeline & Bus Factor...")
            timeline, file_stats = self._analyze_git_history(actual_path)
            
            # Save Timeline Locally
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
            
            for i, doc in enumerate(raw_docs):
                # Update progress bar
                if i % 5 == 0:
                    progress = 40 + int((i / total_docs) * 35) # 40% -> 75%
                    self._update_status("running", progress, f"Streaming Nodes to Cloud ({i}/{total_docs})...")
                
                file_path = doc.metadata.get('source', 'unknown')
                relative_path = os.path.relpath(file_path, actual_path)
                
                # Get extracted Git Metadata (Now includes bus_risk_score)
                git_meta = file_stats.get(relative_path, {})
                
                # [NEW] Get Line-Level Blame (Ownership)
                # We calculate this ON THE FLY for the current file
                blame_map = self._get_file_blame(actual_path, relative_path)
                
                # PUSH TO NEO4J (Streaming)
                # Pass the blame_map so GraphEngine can assign function owners
                self.graph_engine.extract_and_build(
                    file_content=doc.page_content, 
                    file_path=relative_path, 
                    repo_root=actual_path,
                    git_metadata=git_meta,
                    blame_map=blame_map
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
                try:
                    PineconeVectorStore.from_documents(
                        batch, 
                        self.embeddings, 
                        index_name=settings.PINECONE_INDEX_NAME, 
                        pinecone_api_key=settings.PINECONE_API_KEY
                    )
                except (ConnectionError, OSError) as e:
                    error_msg = str(e)
                    if "Connection reset" in error_msg or "Connection aborted" in error_msg:
                        logger.warning(f"Pinecone connection reset during batch {i}, retrying...")
                        # Retry once
                        try:
                            PineconeVectorStore.from_documents(
                                batch, 
                                self.embeddings, 
                                index_name=settings.PINECONE_INDEX_NAME, 
                                pinecone_api_key=settings.PINECONE_API_KEY
                            )
                        except Exception as retry_e:
                            logger.error(f"Pinecone retry failed: {retry_e}")
                            raise RuntimeError(f"Failed to index vectors to Pinecone after retry. Connection issue: {retry_e}")
                    else:
                        raise
                except Exception as e:
                    logger.error(f"Pinecone indexing error: {e}")
                    raise RuntimeError(f"Failed to index vectors to Pinecone: {e}")

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