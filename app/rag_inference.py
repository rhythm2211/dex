import os
import sys
import logging
from dotenv import load_dotenv
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_pinecone import PineconeVectorStore
from langchain_groq import ChatGroq
from langchain.chains import RetrievalQA

logging.basicConfig(level=logging.ERROR, format='%(message)s')
logger = logging.getLogger(__name__)

load_dotenv()

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
INDEX_NAME = os.getenv("PINECONE_INDEX_NAME")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

def validate_credentials():
    if not PINECONE_API_KEY:
        sys.exit("Error: PINECONE_API_KEY is missing.")
    if not INDEX_NAME:
        sys.exit("Error: PINECONE_INDEX_NAME is missing.")
    if not GROQ_API_KEY:
        sys.exit("Error: GROQ_API_KEY is missing.")

def initialize_rag_pipeline():
    embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    
    vector_store = PineconeVectorStore(
        index_name=INDEX_NAME,
        embedding=embeddings,
        pinecone_api_key=PINECONE_API_KEY
    )
    
    llm = ChatGroq(
        model_name="llama-3.3-70b-versatile",
        temperature=0,
        groq_api_key=GROQ_API_KEY
    )
    
    # Increased k to 60 to encompass ~75% of the codebase in the context window
    qa_chain = RetrievalQA.from_chain_type(
        llm=llm,
        chain_type="stuff",
        retriever=vector_store.as_retriever(search_kwargs={"k": 60}),
        return_source_documents=True
    )
    
    return qa_chain

def main():
    validate_credentials()
    
    if len(sys.argv) > 1:
        query = " ".join(sys.argv[1:])
    else:
        query = input("Enter your question: ").strip()
    
    if not query:
        sys.exit("Error: No query provided.")

    print(f"\nProcessing Query with High-Context Retrieval (k=60): {query}...\n")
    
    try:
        pipeline = initialize_rag_pipeline()
        response = pipeline.invoke(query)
        
        print("=" * 60)
        print("GENERATED ANSWER")
        print("=" * 60)
        print(response['result'])
        print("\n" + "=" * 60)
        print("KEY SOURCE FILES REFERENCED")
        print("=" * 60)
        
        # Deduplicate and sort source files for clarity
        sources = sorted(list(set([doc.metadata.get('source', 'Unknown') for doc in response['source_documents']])))
        for source in sources:
            print(f"- {source}")
            
    except Exception as error:
        sys.exit(f"Inference failed: {error}")

if __name__ == "__main__":
    main()