import os
import sys
import logging
from typing import List, Tuple
from dotenv import load_dotenv
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_pinecone import PineconeVectorStore
from pinecone import Pinecone

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

def validate_config():
    if not PINECONE_API_KEY:
        sys.exit("Error: PINECONE_API_KEY is missing.")
    if not INDEX_NAME:
        sys.exit("Error: PINECONE_INDEX_NAME is missing.")

def initialize_vector_store():
    logger.info("Initializing embedding model...")
    embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL_NAME)
    
    logger.info(f"Connecting to Pinecone index: {INDEX_NAME}")
    return PineconeVectorStore(
        index_name=INDEX_NAME,
        embedding=embeddings,
        pinecone_api_key=PINECONE_API_KEY
    )

def perform_search(vector_store, query: str, k: int = 3):
    logger.info(f"Searching for: '{query}'")
    results = vector_store.similarity_search_with_score(query, k=k)
    return results

def display_results(results: List[Tuple]):
    print("\n" + "="*50)
    print(f"RETRIEVAL RESULTS ({len(results)} matches)")
    print("="*50)
    
    for i, (doc, score) in enumerate(results, 1):
        print(f"\nResult {i} (Similarity Score: {score:.4f})")
        print(f"Source: {doc.metadata.get('source', 'Unknown')}")
        print("-" * 50)
        print(doc.page_content)
        print("-" * 50)

def main():
    validate_config()
    
    if len(sys.argv) > 1:
        query_text = " ".join(sys.argv[1:])
    else:
        query_text = input("Enter your search query: ").strip()
    
    if not query_text:
        logger.error("Empty query provided.")
        sys.exit(1)

    try:
        vector_store = initialize_vector_store()
        results = perform_search(vector_store, query_text)
        display_results(results)
    except Exception as error:
        logger.critical(f"Search failed: {error}")
        sys.exit(1)

if __name__ == "__main__":
    main()