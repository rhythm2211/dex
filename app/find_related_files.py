#!/usr/bin/env python3
"""Find files related to a given node"""
import os
from neo4j import GraphDatabase
from dotenv import load_dotenv

load_dotenv()

NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USERNAME = os.getenv("NEO4J_USERNAME")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")

node_id = "pageindex\\page_index.py"
driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USERNAME, NEO4J_PASSWORD))

try:
    with driver.session() as session:
        print(f"Finding files related to: {node_id}\n")
        
        # Find files in same directory
        print("1. Files in same directory:")
        result = session.run("""
            MATCH (source:CodeNode {id: $node_id})
            WITH source, 
                 CASE 
                   WHEN source.id CONTAINS '\\' THEN split(source.id, '\\')
                   ELSE split(source.id, '/')
                 END as source_parts
            WITH source, source_parts[0..-1] as dir_parts
            MATCH (sibling:CodeNode)
            WHERE sibling <> source
            AND NOT sibling.id CONTAINS '::'
            WITH source, sibling, dir_parts,
                 CASE 
                   WHEN sibling.id CONTAINS '\\' THEN split(sibling.id, '\\')
                   ELSE split(sibling.id, '/')
                 END as sibling_parts
            WHERE sibling_parts[0..-1] = dir_parts
            RETURN sibling.id
            LIMIT 10
        """, node_id=node_id)
        
        siblings = [r["sibling.id"] for r in result]
        if siblings:
            for s in siblings:
                print(f"   {s}")
        else:
            print("   None found")
        
        # Find files that might import this package
        print("\n2. Files that might import this package:")
        package = node_id.split("\\")[0] if "\\" in node_id else node_id.split("/")[0]
        result = session.run("""
            MATCH (n:CodeNode)
            WHERE NOT n.id CONTAINS '::'
            AND (n.id CONTAINS $package OR n.name CONTAINS $package)
            AND n.id <> $node_id
            RETURN n.id
            LIMIT 10
        """, package=package, node_id=node_id)
        
        related = [r["n.id"] for r in result]
        if related:
            for r in related:
                print(f"   {r}")
        else:
            print("   None found")
        
        print(f"\nTotal related files: {len(siblings) + len(related)}")

finally:
    driver.close()
