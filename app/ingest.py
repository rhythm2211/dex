import os
import sys
import shutil
import tempfile
import logging
from typing import List
from git import Repo, RemoteProgress
from git.exc import GitCommandError
from dotenv import load_dotenv
from tqdm import tqdm

try:
    from langchain_community.document_loaders.generic import GenericLoader
    from langchain_community.document_loaders.parsers import LanguageParser
    from langchain.text_splitter import RecursiveCharacterTextSplitter
    from langchain_huggingface import HuggingFaceEmbeddings
    from langchain_pinecone import PineconeVectorStore
    from langchain_core.documents import Document
    from pinecone import Pinecone, ServerlessSpec
except ImportError as error:
    sys.exit(f"Critical Dependency Error: {error}")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

load_dotenv()

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
INDEX_NAME = os.getenv("PINECONE_INDEX_NAME")
EMBEDDING_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
EMBEDDING_DIMENSION = 384
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200
BATCH_SIZE = 100
SUPPORTED_EXTENSIONS = [".py", ".js", ".ts", ".tsx", ".jsx", ".md", ".java", ".cpp", ".html", ".css"]

class GitProgress(RemoteProgress):
    def __init__(self):
        super().__init__()
        self.pbar = tqdm(desc="Cloning Repository", unit="obj")

    def update(self, op_code, cur_count, max_count=None, message=''):
        self.pbar.total = max_count
        self.pbar.n = cur_count
        self.pbar.refresh()

def validate_environment():
    if not PINECONE_API_KEY:
        sys.exit("Error: PINECONE_API_KEY is missing.")
    if not INDEX_NAME:
        sys.exit("Error: PINECONE_INDEX_NAME is missing.")
    
    try:
        import esprima
    except ImportError:
        sys.exit("Error: Missing 'esprima'. Install via 'pip install esprima'.")

def clone_repository(repo_url: str, target_dir: str) -> None:
    try:
        Repo.clone_from(repo_url, target_dir, progress=GitProgress())
    except GitCommandError as error:
        raise RuntimeError(f"Git clone failed: {error}")

def load_documents(source_dir: str) -> List[Document]:
    logger.info(f"Scanning directory: {source_dir}")
    try:
        loader = GenericLoader.from_filesystem(
            source_dir,
            glob="**/*",
            suffixes=SUPPORTED_EXTENSIONS,
            parser=LanguageParser()
        )
        documents = loader.load()
        logger.info(f"Loaded {len(documents)} documents.")
        return documents
    except Exception as error:
        raise RuntimeError(f"Document loading failed: {error}")

def split_documents(documents: List[Document]) -> List[Document]:
    text_splitter = RecursiveCharacterTextSplitter.from_language(
        language="python",
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP
    )
    chunks = text_splitter.split_documents(documents)
    logger.info(f"Generated {len(chunks)} chunks.")
    return chunks

def index_to_pinecone(chunks: List[Document]) -> None:
    if not chunks:
        return

    logger.info("Initializing embedding model...")
    embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL_NAME)

    try:
        pc = Pinecone(api_key=PINECONE_API_KEY)
        existing_indexes = [i.name for i in pc.list_indexes()]
        
        if INDEX_NAME not in existing_indexes:
            logger.info(f"Creating index: {INDEX_NAME}")
            pc.create_index(
                name=INDEX_NAME,
                dimension=EMBEDDING_DIMENSION,
                metric="cosine",
                spec=ServerlessSpec(cloud="aws", region="us-east-1")
            )

        docsearch = PineconeVectorStore(index_name=INDEX_NAME, embedding=embeddings)
        
        logger.info("Uploading vectors...")
        for i in tqdm(range(0, len(chunks), BATCH_SIZE), desc="Indexing Batches", unit="batch"):
            batch = chunks[i:i + BATCH_SIZE]
            docsearch.add_documents(batch)
            
        logger.info("Indexing completed.")

    except Exception as error:
        raise RuntimeError(f"Indexing failed: {error}")

def main():
    validate_environment()
    
    repo_url = input("Enter GitHub Repo URL: ").strip()
    if not repo_url:
        logger.error("Invalid URL.")
        return

    with tempfile.TemporaryDirectory() as temp_dir:
        try:
            clone_repository(repo_url, temp_dir)
            documents = load_documents(temp_dir)
            chunks = split_documents(documents)
            index_to_pinecone(chunks)
        except Exception as error:
            logger.critical(f"Pipeline Execution Failed: {error}")
            sys.exit(1)

if __name__ == "__main__":
    main()