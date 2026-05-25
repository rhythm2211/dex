"""
DEX MCP server — exposes code search, subgraph, blast-radius tools for AI agents.
Run: python -m backend.app.mcp.server
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
from typing import Any

logger = logging.getLogger("dex-mcp")

TOOLS = [
    {
        "name": "search_code",
        "description": "Hybrid semantic + keyword search over indexed codebase chunks",
        "inputSchema": {
            "type": "object",
            "properties": {
                "user_id": {"type": "string"},
                "query": {"type": "string"},
                "k": {"type": "integer", "default": 10},
            },
            "required": ["user_id", "query"],
        },
    },
    {
        "name": "get_subgraph",
        "description": "Natural-language focused dependency subgraph",
        "inputSchema": {
            "type": "object",
            "properties": {
                "user_id": {"type": "string"},
                "query": {"type": "string"},
            },
            "required": ["user_id", "query"],
        },
    },
    {
        "name": "blast_radius",
        "description": "Impact analysis for a file or symbol",
        "inputSchema": {
            "type": "object",
            "properties": {
                "user_id": {"type": "string"},
                "node_id": {"type": "string"},
            },
            "required": ["user_id", "node_id"],
        },
    },
    {
        "name": "find_references",
        "description": "Find references to a symbol in the knowledge graph",
        "inputSchema": {
            "type": "object",
            "properties": {
                "user_id": {"type": "string"},
                "symbol_id": {"type": "string"},
            },
            "required": ["user_id", "symbol_id"],
        },
    },
    {
        "name": "ask_dex",
        "description": "Full RAG Q&A with citations",
        "inputSchema": {
            "type": "object",
            "properties": {
                "user_id": {"type": "string"},
                "query": {"type": "string"},
            },
            "required": ["user_id", "query"],
        },
    },
]


def _call_tool(name: str, arguments: dict) -> Any:
    user_id = arguments.get("user_id", "")
    if not user_id:
        return {"error": "user_id required"}

    if name == "search_code":
        from backend.app.services.rag_service import RAGService
        from backend.app.domain.sparse_retriever import sparse_search
        from backend.app.domain.hybrid_retriever import HybridRetriever
        from langchain_community.vectorstores import PGVector
        from backend.app.core.config import settings
        from backend.app.utils.embedding_utils import get_embeddings

        vs = PGVector(
            connection_string=settings.POSTGRES_CONNECTION_STRING,
            embedding_function=get_embeddings(),
            collection_name=settings.POSTGRES_VECTOR_TABLE,
            use_jsonb=True,
        )
        hr = HybridRetriever(vs, user_id=user_id)
        dense = hr._dense_search(arguments["query"], arguments.get("k", 10), set())
        sparse = sparse_search(arguments["query"], user_id, k=arguments.get("k", 10))
        return {
            "dense": [{"file": c.file_name, "preview": c.content[:300]} for c in dense],
            "sparse": [{"file": c.file_name, "preview": c.content[:300]} for c in sparse],
        }

    if name == "get_subgraph":
        from backend.app.domain.subgraph_extractor import SubgraphExtractor
        from backend.app.services.rag_service import RAGService
        from backend.app.api.v1.router import get_ingestion_service
        from backend.app.schemas.graph_subgraph import SubgraphRequest

        ingestion = get_ingestion_service(user_id)
        rag = RAGService(user_id=user_id)
        ext = SubgraphExtractor(ingestion, rag)
        return ext.extract(SubgraphRequest(query=arguments["query"], seed_k=15))

    if name == "ask_dex":
        from backend.app.services.rag_service import RAGService
        return RAGService(user_id=user_id).answer_query(arguments["query"])

    if name == "find_references":
        from backend.app.api.v1.endpoints.symbol_navigation import get_references
        return get_references(arguments["symbol_id"], user_id=user_id).model_dump()

    if name == "blast_radius":
        from backend.app.domain.graph_engine import GraphEngine
        ge = GraphEngine(user_id=user_id)
        return ge.get_blast_radius(arguments["node_id"]) if hasattr(ge, "get_blast_radius") else {"node_id": arguments["node_id"]}

    return {"error": f"Unknown tool: {name}"}


async def _stdio_loop():
    """Minimal JSON-RPC loop for MCP-compatible clients."""
    reader = asyncio.StreamReader()
    protocol = asyncio.StreamReaderProtocol(reader)
    await asyncio.get_event_loop().connect_read_pipe(lambda: protocol, sys.stdin)

    writer_transport, writer_protocol = await asyncio.get_event_loop().connect_write_pipe(
        asyncio.streams.FlowControlMixin, sys.stdout
    )
    writer = asyncio.StreamWriter(writer_transport, writer_protocol, reader, asyncio.get_event_loop())

    while True:
        line = await reader.readline()
        if not line:
            break
        try:
            req = json.loads(line.decode())
        except json.JSONDecodeError:
            continue
        method = req.get("method", "")
        req_id = req.get("id")
        resp: dict = {"jsonrpc": "2.0", "id": req_id}

        if method == "initialize":
            resp["result"] = {
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "dex-mcp", "version": "1.0.0"},
            }
        elif method == "tools/list":
            resp["result"] = {"tools": TOOLS}
        elif method == "tools/call":
            params = req.get("params") or {}
            name = params.get("name", "")
            args = params.get("arguments") or {}
            try:
                result = _call_tool(name, args)
                resp["result"] = {"content": [{"type": "text", "text": json.dumps(result, default=str)}]}
            except Exception as e:
                resp["result"] = {"content": [{"type": "text", "text": json.dumps({"error": str(e)})}], "isError": True}
        else:
            resp["result"] = {}

        writer.write((json.dumps(resp) + "\n").encode())
        await writer.drain()


def main():
    logging.basicConfig(level=logging.INFO)
    asyncio.run(_stdio_loop())


if __name__ == "__main__":
    main()
