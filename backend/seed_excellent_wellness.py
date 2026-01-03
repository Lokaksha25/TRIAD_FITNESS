"""
QUICK DEMO DATA SCRIPT - Excellent Wellness

Run this with: python -m backend.seed_excellent_wellness

This creates demo data showing EXCELLENT wellness metrics.
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import time
from backend.tools.memory_store import save_agent_memory
from backend.agents.wellness.brain import analyze_wellness

def main():
    print("\n🌟 Creating EXCELLENT Wellness Demo Data")
    print("=" * 60)
    
    # 1. Create excellent wellness entries (last 5 days)
    print("\n📊 Creating Wellness Logs with EXCELLENT metrics...")
    for i in range(5):
        wellness_data = {
            "sleep_hours": 8.0 + (i * 0.2),  # 8.0 to 8.8 hours
            "hrv": 65 + i,  # 65-69 ms (excellent)
            "rhr": 58 - i   # 58-54 bpm (low, excellent)
        }
        
        analysis = analyze_wellness(wellness_data)
        date_str = time.strftime('%Y-%m-%d', time.localtime(time.time() - (i * 86400)))
        
        text_content = f"""Wellness ({date_str}): {analysis.get('executive_summary')}
Readiness: {analysis.get('readiness_score')}/100
Sleep: {wellness_data['sleep_hours']}h, HRV: {wellness_data['hrv']}ms, RHR: {wellness_data['rhr']}bpm
Status: EXCELLENT - Ready for volume increase"""
        
        log_id = save_agent_memory(
            agent_type="wellness",
            content=text_content,
            metadata={
                "type": "wellness",
                "user_id": "user_123",
                "sleep_hours": wellness_data["sleep_hours"],
                "hrv": wellness_data["hrv"],
                "rhr": wellness_data["rhr"],
                "readiness_score": analysis.get('readiness_score', 95),
                "executive_summary": analysis.get('executive_summary', '')[:500],
                "date": date_str
            }
        )
        print(f"   ✅ Day {i+1}: Sleep {wellness_data['sleep_hours']:.1f}h, HRV {wellness_data['hrv']}, Readiness {analysis.get('readiness_score')}/100 - {log_id}")
    
    # 2. Create excellent workout logs (no injuries, good form)
    print("\n🏋️ Creating Excellent Workout Logs...")
    workouts = [
        {"exercise": "Squat", "reps": 12, "rating": 9, "issues": []},
        {"exercise": "Pushup", "reps": 20, "rating": 9, "issues": []},
        {"exercise": "Squat", "reps": 10, "rating": 8, "issues": []}
    ]
    
    for i, workout in enumerate(workouts):
        date_str = time.strftime('%Y-%m-%d', time.localtime(time.time() - (i * 86400)))
        
        text_content = f"""Exercise ({date_str}): {workout['exercise']}
Reps: {workout['reps']}, Rating: {workout['rating']}/10
Issues: None - Excellent form maintained
Status: READY FOR PROGRESSION"""
        
        log_id = save_agent_memory(
            agent_type="trainer",
            content=text_content,
            metadata={
                "type": "exercise",
                "exercise": workout["exercise"],
                "reps": workout["reps"],
                "rating": workout["rating"],
                "issues": workout["issues"],
                "date": date_str
            }
        )
        print(f"   ✅ {workout['exercise']}: {workout['reps']} reps, Rating {workout['rating']}/10 - {log_id}")
    
    # 3. Create user profile
    print("\n👤 Creating User Profile...")
    profile_id = save_agent_memory(
        agent_type="user_profile",
        content="User: 2500 cal/day, bulking phase, 180g protein. Excellent recovery capacity.",
        metadata={
            "type": "user_profile",
            "calories": 2500,
            "phase": "bulking",
            "protein_target": 180,
            "notes": "Excellent recovery capacity"
        }
    )
    print(f"   ✅ Profile: 2500 cal, Bulking, 180g protein - {profile_id}")
    
    print("\n" + "=" * 60)
    print("✨ DEMO DATA CREATED SUCCESSFULLY!")
    print("\n🎯 Expected Result:")
    print("   - Weekly plan will show VOLUME INCREASE (+10%)")
    print("   - Adjustment reason: 'Volume increased 10% - excellent recovery status'")
    print("   - No injury warnings")
    print("=" * 60)

if __name__ == "__main__":
    main()
