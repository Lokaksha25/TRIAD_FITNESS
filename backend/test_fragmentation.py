
import os
import time
import sys
from dotenv import load_dotenv

# Load env vars
load_dotenv()
load_dotenv(dotenv_path='../.env.local')

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), ".")))

from tools.memory_store import save_agent_memory, get_exercise_memory
from pinecone import Pinecone

def test_fragmentation():
    print("🧪 Starting Data Fragmentation Verification...")
    
    user_a = "user_A_test"
    user_b = "user_B_test"
    
    # 1. Clean up potential previous test data (optional, or just use new unique IDs)
    # For this test, we rely on the fact that if isolation works, we won't see cross-contamination.
    
    print(f"\n📝 Saving data for {user_a}...")
    save_agent_memory(
        agent_type="trainer", 
        content=f"Squat session for {user_a}", 
        metadata={"exercise": "Squats", "reps": 10},
        user_id=user_a
    )
    
    print(f"📝 Saving data for {user_b}...")
    save_agent_memory(
        agent_type="trainer", 
        content=f"Pushup session for {user_b}", 
        metadata={"exercise": "Pushups", "reps": 20},
        user_id=user_b
    )
    
    # Allow some time for eventual consistency (Pinecone can be slightly delayed)
    time.sleep(2)
    
    print(f"\n🔍 Querying data for {user_a}...")
    results_a = get_exercise_memory(query="session", top_k=10, user_id=user_a)
    print(f"   Found {len(results_a)} records.")
    
    # Verify User A only sees User A's data
    cross_contamination_a = [r for r in results_a if user_b in r.get('text', '')]
    if cross_contamination_a:
        print(f"❌ FAIL: {user_a} saw {user_b}'s data!")
    else:
        print(f"✅ PASS: {user_a} sees clear data.")
        
    print(f"\n🔍 Querying data for {user_b}...")
    results_b = get_exercise_memory(query="session", top_k=10, user_id=user_b)
    print(f"   Found {len(results_b)} records.")
    
    # Verify User B only sees User B's data
    cross_contamination_b = [r for r in results_b if user_a in r.get('text', '')]
    if cross_contamination_b:
        print(f"❌ FAIL: {user_b} saw {user_a}'s data!")
    else:
        print(f"✅ PASS: {user_b} sees clear data.")

    # Verify filtering worked
    found_a_in_a = any(user_a in r.get('text', '') for r in results_a)
    found_b_in_b = any(user_b in r.get('text', '') for r in results_b)
    
    if found_a_in_a and found_b_in_b:
        print("\n✅ SUCCESS: Data is correctly saved and retrieved per user namespace.")
    else:
        print("\n⚠️ WARNING: Could not find explicitly saved data. Check Pinecone formatting or delay.")

if __name__ == "__main__":
    test_fragmentation()
