import os
import shutil
import tempfile
from typing import List, Optional

from git import Repo
from dotenv import load_dotenv

from langchain_community.document_loaders.generic import GenericLoader
from langchain_community.document_loaders.parsers import LanguageParser
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_pinecone import PineconeVectorStore
from langchain_core.documents import Document
from pinecone import Pinecone, ServerlessSpec

# Load environment variables
load_dotenv()

# Constants
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
INDEX_NAME = os.getenv("PINECONE_INDEX_NAME")
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
EMBEDDING_DIMENSION = 384
SUPPORTED_EXTENSIONS = [".py", ".js", ".ts", ".tsx", ".jsx", ".md", ".java", ".cpp"]

def clone_repository(repo_url: str, target_dir: str) -> None:
    """Clones a remote GitHub repository to a local directory."""
    print(f"Cloning repository: {repo_url}...")
    try:
        Repo.clone_from(repo_url, target_dir)
    except Exception as e:
        raise RuntimeError(f"Failed to clone repository: {e}")

def load_and_split_documents(source_dir: str) -> List[Document]:
    """Loads code files and splits them into context-aware chunks."""
    print("Loading and processing documents...")
    
    loader = GenericLoader.from_filesystem(
        source_dir,
        glob="**/*",
        suffixes=SUPPORTED_EXTENSIONS,
        parser=LanguageParser()
    )
    documents = loader.load()
    
    # Text splitter optimized for code (large chunks, overlap for context)
    text_splitter = RecursiveCharacterTextSplitter.from_language(
        language="python",  # Defaulting to python splitter logic for generic usage
        chunk_size=2000,
        chunk_overlap=200
    )
    
    chunks = text_splitter.split_documents(documents)
    print(f"Processed {len(documents)} files into {len(chunks)} chunks.")
    return chunks

def index_documents(chunks: List[Document]) -> None:
    """Generates embeddings and uploads vectors to Pinecone."""
    print("Initializing embedding model (Local CPU)...")
    embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)

    print("Connecting to Pinecone...")
    pc = Pinecone(api_key=PINECONE_API_KEY)

    # Check if index exists, create if necessary
    existing_indexes = [i.name for i in pc.list_indexes()]
    if INDEX_NAME not in existing_indexes:
        print(f"Index '{INDEX_NAME}' not found. Creating new index...")
        pc.create_index(
            name=INDEX_NAME,
            dimension=EMBEDDING_DIMENSION,
            metric="cosine",
            spec=ServerlessSpec(cloud="aws", region="us-east-1")
        )

    print("Uploading vectors to database...")
    PineconeVectorStore.from_documents(
        chunks,
        embeddings,
        index_name=INDEX_NAME
    )
    print("Indexing complete.")

def main():
    repo_url = input("Enter GitHub Repo URL: ").strip()
    if not repo_url:
        print("Error: Repository URL is required.")
        return

    # Create a temporary directory for the clone to avoid file system clutter
    with tempfile.TemporaryDirectory() as temp_dir:
        try:
            clone_repository(repo_url, temp_dir)
            chunks = load_and_split_documents(temp_dir)
            index_documents(chunks)
        except Exception as e:
            print(f"An error occurred during pipeline execution: {e}")

if __name__ == "__main__":
    main()