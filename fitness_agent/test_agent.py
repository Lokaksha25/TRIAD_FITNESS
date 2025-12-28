import requests
import json

# --- CONFIGURATION ---
# Make sure this matches the @app.post line in main.py
URL = "http://127.0.0.1:8000/webhook/vital" 

def test_scenario(name, sleep, hrv, rhr):
    print(f"\n--- TESTING SCENARIO: {name} ---")
    
    # 1. Create Fake Data
    payload = {
        "user_id": "user_123",
        "date": "2023-10-27",
        "sleep_hours": sleep,
        "hrv": hrv,
        "rhr": rhr
    }
    
    print(f"Sending Watch Data: Sleep {sleep}h | HRV {hrv} | RHR {rhr}")

    try:
        # 2. Send to Agent
        response = requests.post(URL, json=payload)
        
        if response.status_code == 200:
            print("✅ SUCCESS! Agent Response:")
            print(json.dumps(response.json(), indent=2))
        else:
            print(f"❌ FAILED: {response.text}")
            
    except Exception as e:
        print(f"❌ ERROR: {e}")

if __name__ == "__main__":
    # Scenario 1: Good Day
    test_scenario("High Performance", sleep=8.5, hrv=75, rhr=52)
    
    # Scenario 2: Bad Day
    test_scenario("Critical Fatigue", sleep=4.5, hrv=25, rhr=85)