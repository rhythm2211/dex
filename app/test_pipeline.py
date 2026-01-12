import os
import time
import shutil
import json
import requests
from git import Repo

# Configuration
API_URL = "http://localhost:8000/api/v1"
TEST_REPO_URL = "https://github.com/rhythm2211/ai-analyst"
LOCAL_REPO_PATH = "/tmp/test_ingestion_repo"

def print_header(title):
    print("\n" + "=" * 60)
    print(f" {title}")
    print("=" * 60)

def step_1_prepare_data():
    print_header("[1/4] Preparing Data Source")
    
    if os.path.exists(LOCAL_REPO_PATH):
        print(f"Cleaning up existing directory: {LOCAL_REPO_PATH}")
        shutil.rmtree(LOCAL_REPO_PATH)
        
    print(f"Cloning {TEST_REPO_URL}...")
    try:
        Repo.clone_from(TEST_REPO_URL, LOCAL_REPO_PATH)
        print("✅ Clone complete.")
    except Exception as e:
        print(f"❌ Clone failed: {e}")
        exit(1)

def step_2_ingestion():
    print_header("[2/4] Testing Ingestion API (/ingest)")
    
    payload = {"repo_path": LOCAL_REPO_PATH}
    try:
        response = requests.post(f"{API_URL}/ingest", json=payload)
        response.raise_for_status()
        
        print("Response:")
        print(json.dumps(response.json(), indent=2))
        
        print("\n⏳ Waiting 15 seconds for background graph construction...")
        time.sleep(15)
        print("✅ Wait complete.")
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Ingestion request failed: {e}")
        exit(1)

def step_3_sql_engine():
    print_header("[3/4] Testing SQL Engine (/query/sql)")
    
    query = "Show me the average salary by department"
    print(f"Query: '{query}'")
    
    payload = {"text": query}
    try:
        response = requests.post(f"{API_URL}/query/sql", json=payload)
        response.raise_for_status()
        
        data = response.json()
        print("\nResult:")
        print(json.dumps(data, indent=2))
        
        if data.get("status") == "success":
            print("✅ SQL Execution Successful.")
        else:
            print("⚠️ SQL Execution returned non-success status.")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ SQL request failed: {e}")

def step_4_hybrid_rag():
    print_header("[4/4] Testing Hybrid Retrieval (/query/hybrid)")
    
    query = "How is data validated in the application?"
    print(f"Query: '{query}'")
    
    payload = {"query": query}
    try:
        response = requests.post(f"{API_URL}/query/hybrid", json=payload)
        response.raise_for_status()
        
        data = response.json()
        print("\nResult:")
        print(json.dumps(data, indent=2))
        
        if data.get("answer"):
            print("✅ RAG Retrieval Successful.")
        else:
            print("⚠️ RAG returned empty answer.")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ RAG request failed: {e}")

if __name__ == "__main__":
    print("Starting End-to-End System Test...")
    
    # Check if backend is reachable first
    try:
        requests.get(f"{API_URL}/../health")
    except requests.exceptions.ConnectionError:
        print(f"❌ Error: Backend is not running at {API_URL}")
        print("Please start the server in a separate terminal: 'python3 backend/app/main.py'")
        exit(1)

    step_1_prepare_data()
    step_2_ingestion()
    step_3_sql_engine()
    step_4_hybrid_rag()
    
    print_header("TEST COMPLETE")