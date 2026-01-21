#!/bin/bash

# Script to view live backend logs with filtering options

LOG_FILE="/tmp/backend.log"

if [ ! -f "$LOG_FILE" ]; then
    echo "❌ Log file not found: $LOG_FILE"
    echo "Backend may not be running or logging is not configured."
    exit 1
fi

echo "📊 Viewing live backend logs from: $LOG_FILE"
echo "Press Ctrl+C to stop"
echo ""
echo "Filtering for: Cloning, Neo4j, PostgreSQL, Streaming, Ingestion operations"
echo "---"
echo ""

# Tail with filtering for important operations
tail -f "$LOG_FILE" | grep --line-buffered -E '(Cloning|Neo4j|PostgreSQL|Streaming|Ingestion|🚀|✅|❌|📊|ERROR|WARNING|Failed|Success|completed|Starting)' || tail -f "$LOG_FILE"
