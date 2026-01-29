#!/usr/bin/env python3
"""Test script to check blast radius endpoint and see logs"""
import requests
import json
import sys

node_id = sys.argv[1] if len(sys.argv) > 1 else "pageindex\\page_index.py"
url = f"http://127.0.0.1:8000/api/v1/blast-radius/{requests.utils.quote(node_id)}"

print(f"Testing blast radius for: {node_id}")
print(f"URL: {url}")
print("-" * 80)

try:
    response = requests.get(url, timeout=30)
    print(f"Status Code: {response.status_code}")
    print(f"Response Headers: {dict(response.headers)}")
    print("-" * 80)
    
    if response.status_code == 200:
        data = response.json()
        print(f"Nodes found: {len(data.get('nodes', []))}")
        print(f"Edges found: {len(data.get('edges', []))}")
        print(f"Total Risk Score: {data.get('total_risk_score', 0)}")
        print(f"Kill Switch: {data.get('kill_switch', False)}")
        print("-" * 80)
        
        if data.get('nodes'):
            print(f"\nFirst node: {json.dumps(data['nodes'][0], indent=2)}")
        if data.get('edges'):
            print(f"\nFirst edge: {json.dumps(data['edges'][0], indent=2)}")
        else:
            print("\nWARNING: NO EDGES FOUND!")
            print(f"Node IDs in response: {[n.get('id') for n in data.get('nodes', [])]}")
    else:
        print(f"Error Response: {response.text}")
        
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
