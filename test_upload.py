import requests
import json

url = "http://localhost:8000/api/wellness/upload"
data = {
    "user_id": "test_debug_user",
    "data": [
        {"date": "2026-01-10", "sleep_hours": 8, "hrv": 60, "rhr": 60, "activity_calories": 500}
    ]
}

try:
    print(f"Sending to {url}...")
    response = requests.post(url, json=data)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
