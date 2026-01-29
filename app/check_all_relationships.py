#!/usr/bin/env python3
"""Check all relationship types in Neo4j"""
import os
from neo4j import GraphDatabase
from dotenv import load_dotenv

load_dotenv()

NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USERNAME = os.getenv("NEO4J_USERNAME")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")

driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USERNAME, NEO4J_PASSWORD))

try:
    with driver.session() as session:
        # Check all relationship types
        print("Checking all relationship types in database...")
        result = session.run("""
            MATCH ()-[r]->()
            RETURN DISTINCT type(r) as rel_type, count(*) as count
            ORDER BY count DESC
        """)
        
        for record in result:
            print(f"  {record['rel_type']}: {record['count']} relationships")
        
        # Check for DEPENDS_ON specifically
        print("\nChecking DEPENDS_ON relationships...")
        result = session.run("""
            MATCH (a:CodeNode)-[r:DEPENDS_ON]->(b:CodeNode)
            WHERE NOT a.id CONTAINS '::' AND NOT b.id CONTAINS '::'
            RETURN a.id as source, b.id as target
            LIMIT 10
        """)
        
        deps = []
        for record in result:
            deps.append((record["source"], record["target"]))
            print(f"  {record['source']} -[DEPENDS_ON]-> {record['target']}")
        
        if not deps:
            print("  [WARNING] No file-to-file DEPENDS_ON relationships found!")
            print("  This means imports weren't converted to DEPENDS_ON during ingestion.")
        
        # Check for IMPORTS
        print("\nChecking IMPORTS relationships...")
        result = session.run("""
            MATCH (a:CodeNode)-[r:IMPORTS]->(b:CodeNode)
            WHERE NOT a.id CONTAINS '::' AND NOT b.id CONTAINS '::'
            RETURN a.id as source, b.id as target
            LIMIT 10
        """)
        
        imports = []
        for record in result:
            imports.append((record["source"], record["target"]))
            print(f"  {record['source']} -[IMPORTS]-> {record['target']}")
        
        if not imports:
            print("  [WARNING] No IMPORTS relationships found either!")

finally:
    driver.close()
