import os
import requests
from dotenv import load_dotenv

# 1. Debugging Paths
current_dir = os.getcwd()
print(f"📂 Current Working Directory: {current_dir}")

# We try to find backend/.env relative to where you are running the command
target_env = os.path.join(current_dir, "backend", ".env")
print(f"🔍 Looking for .env at: {target_env}")

if os.path.exists(target_env):
    print("✅ File FOUND!")
    # Load it
    load_dotenv(target_env)
else:
    print("❌ File NOT FOUND at that location.")
    # Try one level deeper just in case
    target_env_alt = os.path.join(current_dir, "app", "backend", ".env")
    print(f"🔍 Trying alternative: {target_env_alt}")
    if os.path.exists(target_env_alt):
        print("✅ File FOUND at alternative location!")
        load_dotenv(target_env_alt)
    else:
        print("❌ Still not found. Please check your folder structure.")
        exit()

# 2. Check Token
token = os.getenv("GITHUB_TOKEN")

if not token:
    print("\n❌ ERROR: .env file was found, but GITHUB_TOKEN is missing inside it.")
    print("Please open backend/.env and ensure it has this line:")
    print("GITHUB_TOKEN=ghp_yourtokenhere...")
    exit()

print(f"\n🔑 Token loaded successfully: {token[:4]}...****")

# 3. Test Connection
repo = "rhythm2211/ai-analyst" 
url = f"https://api.github.com/repos/{repo}/git/trees/main?recursive=1"
headers = {"Authorization": f"Bearer {token}"}

print(f"📡 Testing GitHub API connection...")
response = requests.get(url, headers=headers)

if response.status_code == 200:
    data = response.json()
    print(f"✅ SUCCESS! GitHub API is working. Found {len(data.get('tree', []))} files.")
    print("🚀 You can now restart your backend: uvicorn backend.app.main:app --reload")
else:
    print(f"❌ API FAILED: {response.status_code}")
    print(f"Reason: {response.text}")