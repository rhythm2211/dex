# Troubleshooting Guide

## Network Error: Cannot Connect to Backend

### Symptoms
- Console shows "Network Error" or "ECONNREFUSED"
- Graph doesn't load
- UI shows "Backend Offline" status

### Solutions

#### 1. Check if Backend is Running
```bash
# Navigate to backend directory
cd app/backend

# Start the FastAPI server
uvicorn app.main:app --reload --port 8000
```

You should see output like:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete.
```

#### 2. Verify Backend is Accessible
Open your browser and visit:
- http://localhost:8000/health
- http://localhost:8000/api/v1/docs (Swagger UI)

If these don't load, the backend isn't running or there's a port conflict.

#### 3. Check Port Conflicts
If port 8000 is already in use:
```bash
# Find what's using port 8000
lsof -i :8000

# Or use a different port
uvicorn app.main:app --reload --port 8001
```

Then update `frontend/src/lib/api.ts`:
```typescript
baseURL: 'http://localhost:8001/api/v1',
```

#### 4. Check CORS Configuration
The backend should allow requests from `http://localhost:3000`. Verify in `app/backend/app/main.py`:
```python
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
```

#### 5. Check Environment Variables
Ensure `.env` file exists in `app/backend/` with:
```
PINECONE_API_KEY=your_key
PINECONE_INDEX_NAME=your_index
GROQ_API_KEY=your_key
```

#### 6. Check Python Dependencies
```bash
cd app/backend
pip install -r ../requirements.txt
```

Key dependencies:
- fastapi
- uvicorn
- langchain
- pinecone-client
- gitpython
- networkx

## Graph Not Rendering

### Symptoms
- Backend is connected
- Graph shows "No graph data available"
- Console shows empty nodes/links

### Solutions

#### 1. Run Ingestion First
The graph is built during ingestion. Make sure you:
1. Enter a GitHub repository URL
2. Click the refresh button to trigger ingestion
3. Wait for ingestion to complete (check backend logs)

#### 2. Check Graph File Exists
```bash
# Check if graph file was created
ls -la app/backend/data/repo_graph.json

# View graph data
cat app/backend/data/repo_graph.json | jq .
```

#### 3. Check Backend Logs
Look for errors during ingestion:
```bash
# Backend logs will show:
# - Repository cloning status
# - Document loading progress
# - Graph construction progress
# - Vector embedding status
```

#### 4. Verify Repository URL
Ensure the GitHub URL is:
- Publicly accessible
- Valid format: `https://github.com/username/repo`
- Not a private repo (unless you have credentials configured)

## Ingestion Fails

### Symptoms
- Ingestion button doesn't respond
- Error message appears
- Backend logs show errors

### Solutions

#### 1. Check GitPython Installation
```bash
pip install gitpython
```

#### 2. Check Repository Access
- Verify the repository URL is correct
- Ensure it's a public repository
- Check your internet connection

#### 3. Check Disk Space
Ingestion creates temporary directories. Ensure you have enough space:
```bash
df -h
```

#### 4. Check Pinecone Configuration
Verify your Pinecone credentials:
```bash
# Test Pinecone connection
python -c "from pinecone import Pinecone; pc = Pinecone(api_key='YOUR_KEY'); print(pc.list_indexes())"
```

## Graph Data Format Issues

### Symptoms
- Graph loads but nodes don't display
- Console shows "Invalid link" warnings
- Graph appears empty despite data existing

### Solutions

#### 1. Check Graph File Format
The graph file should have this structure:
```json
{
  "nodes": [
    {"id": "string_id", "name": "node_name"}
  ],
  "links": [
    {"source": "string_id", "target": "string_id"}
  ]
}
```

#### 2. Verify Node IDs are Strings
All node IDs must be strings, not numbers. The graph engine should handle this automatically, but if issues persist, check `app/backend/app/domain/graph_engine.py`.

#### 3. Check Browser Console
Open browser DevTools (F12) and check:
- Network tab: Verify API responses
- Console tab: Look for JavaScript errors
- React DevTools: Check component state

## Memory Not Refreshing

### Symptoms
- Old graph data persists after switching repositories
- Graph shows data from previous repository

### Solutions

#### 1. Verify Wipe Functionality
The ingestion service should:
- Delete old graph file
- Clear Pinecone index
- Reset graph engine

Check backend logs for:
```
🧹 Wiping previous knowledge base...
Deleted local graph file.
Pinecone index cleared.
```

#### 2. Manual Cleanup
If automatic cleanup fails:
```bash
# Delete graph file
rm app/backend/data/repo_graph.json

# Clear Pinecone index (via Python)
python -c "
from pinecone import Pinecone
pc = Pinecone(api_key='YOUR_KEY')
index = pc.Index('YOUR_INDEX')
index.delete(delete_all=True)
"
```

#### 3. Restart Backend
Sometimes a backend restart helps:
```bash
# Stop backend (Ctrl+C)
# Start again
uvicorn app.main:app --reload
```

## Common Error Messages

### "Failed to load graph data"
- Backend is not running
- Graph file doesn't exist (run ingestion first)
- Network/CORS issue

### "Cannot connect to backend server"
- Backend is not running on port 8000
- Port conflict
- Firewall blocking connection

### "Graph data corrupted"
- Graph file is malformed JSON
- Delete and re-run ingestion

### "No documents found in repo"
- Repository is empty
- No Python/Markdown files
- Wrong repository URL

## Still Having Issues?

1. **Check Backend Logs**: Look for detailed error messages
2. **Check Browser Console**: Look for frontend errors
3. **Verify Versions**: Ensure Python 3.8+ and Node.js 18+
4. **Check Dependencies**: Run `pip install -r requirements.txt` and `npm install`
5. **Test Endpoints**: Use curl or Postman to test API endpoints directly

## Quick Health Check

Run these commands to verify everything is set up:

```bash
# 1. Check backend health
curl http://localhost:8000/health

# 2. Check graph endpoint
curl http://localhost:8000/api/v1/graph/structure

# 3. Check frontend
curl http://localhost:3000

# 4. Check Python dependencies
python -c "import fastapi, uvicorn, langchain, pinecone, git; print('All imports OK')"

# 5. Check Node dependencies
cd frontend && npm list --depth=0
```
