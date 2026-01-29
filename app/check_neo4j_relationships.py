#!/usr/bin/env python3
"""Check Neo4j for relationships for a given node"""
import os
import sys
from neo4j import GraphDatabase
from dotenv import load_dotenv

load_dotenv()

NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USERNAME = os.getenv("NEO4J_USERNAME")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")

if not all([NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD]):
    print("ERROR: Neo4j credentials not found in .env")
    sys.exit(1)

node_id = sys.argv[1] if len(sys.argv) > 1 else "pageindex\\page_index.py"
normalized_id = node_id.replace("\\", "/")
alt_id = node_id.replace("/", "\\")

print(f"Checking relationships for node: {node_id}")
print(f"  Normalized: {normalized_id}")
print(f"  Alt format: {alt_id}")
print("-" * 80)

driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USERNAME, NEO4J_PASSWORD))

try:
    with driver.session() as session:
        # First, find the node
        print("\n1. Finding the node...")
        result = session.run("""
            MATCH (n:CodeNode)
            WHERE n.id = $node_id 
               OR n.id = $normalized_id
               OR n.id = $alt_id
            RETURN n.id, n.name, labels(n)
            LIMIT 5
        """, node_id=node_id, normalized_id=normalized_id, alt_id=alt_id)
        
        found_nodes = []
        for record in result:
            found_nodes.append(record["n.id"])
            print(f"   Found: {record['n.id']} (name: {record.get('n.name', 'N/A')})")
        
        if not found_nodes:
            print("   [ERROR] Node not found! Trying to find similar...")
            result = session.run("""
                MATCH (n:CodeNode)
                WHERE n.id CONTAINS $search OR n.name CONTAINS $search
                RETURN n.id, n.name
                LIMIT 10
            """, search=node_id.split("\\")[-1].split("/")[-1])
            for record in result:
                print(f"   Similar: {record['n.id']}")
        
        if not found_nodes:
            print("\n[ERROR] Cannot proceed - node not found")
            sys.exit(1)
        
        actual_node_id = found_nodes[0]
        print(f"\n[OK] Using node ID: {actual_node_id}")
        
        # Check outgoing relationships (what this node depends on)
        print("\n2. Checking OUTGOING relationships (what this node depends on)...")
        result = session.run("""
            MATCH (source:CodeNode {id: $node_id})-[r]->(target:CodeNode)
            RETURN type(r) as rel_type, target.id as target_id, target.name as target_name
            ORDER BY rel_type, target_id
            LIMIT 20
        """, node_id=actual_node_id)
        
        outgoing = []
        for record in result:
            outgoing.append((record["rel_type"], record["target_id"], record.get("target_name", "N/A")))
            print(f"   {actual_node_id} -[{record['rel_type']}]-> {record['target_id']}")
        
        if not outgoing:
            print("   [WARNING] No outgoing relationships found")
        
        # Check incoming relationships (what depends on this node)
        print("\n3. Checking INCOMING relationships (what depends on this node)...")
        result = session.run("""
            MATCH (source:CodeNode)-[r]->(target:CodeNode {id: $node_id})
            RETURN type(r) as rel_type, source.id as source_id, source.name as source_name
            ORDER BY rel_type, source_id
            LIMIT 20
        """, node_id=actual_node_id)
        
        incoming = []
        for record in result:
            incoming.append((record["rel_type"], record["source_id"], record.get("source_name", "N/A")))
            print(f"   {record['source_id']} -[{record['rel_type']}]-> {actual_node_id}")
        
        if not incoming:
            print("   [WARNING] No incoming relationships found")
        
        # Summary
        print("\n" + "=" * 80)
        print(f"SUMMARY:")
        print(f"  Node ID: {actual_node_id}")
        print(f"  Outgoing relationships: {len(outgoing)}")
        print(f"  Incoming relationships: {len(incoming)}")
        print(f"  Total relationships: {len(outgoing) + len(incoming)}")
        
        if len(outgoing) == 0 and len(incoming) == 0:
            print("\n[WARNING] No relationships found at all!")
            print("   This could mean:")
            print("   1. The file has no dependencies (isolated)")
            print("   2. Relationships weren't created during ingestion")
            print("   3. The node ID format doesn't match stored relationships")
            
            # Check if there are ANY relationships in the database
            result = session.run("""
                MATCH ()-[r]->()
                RETURN count(r) as total_rels
            """)
            total = result.single()["total_rels"]
            print(f"\n   Total relationships in database: {total}")
            
            if total > 0:
                print("   [WARNING] Database has relationships, but none connected to this node!")
                print("   Checking what relationship types exist...")
                result = session.run("""
                    MATCH ()-[r]->()
                    RETURN DISTINCT type(r) as rel_type, count(*) as count
                    ORDER BY count DESC
                    LIMIT 10
                """)
                for record in result:
                    print(f"      {record['rel_type']}: {record['count']} relationships")

finally:
    driver.close()
