"""
Manager Agent - The Head Coach

Orchestrates wellness, trainer, and nutritionist agents to generate a cohesive Daily Briefing.
Implements the hierarchical "Hub and Spoke" workflow from README.md.
"""

import os
import json
import hashlib
from datetime import datetime
import google.generativeai as genai
from typing import Dict, Any
from dotenv import load_dotenv

load_dotenv()

# Configure Gemini API
api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)

# Import existing functions
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Cache for daily briefings (in-memory, per-process)
_briefing_cache = {}


def _get_cache_key(user_id: str, wellness_data: dict, profile: dict) -> str:
    """Generate cache key based on user_id, date, and data state."""
    today = datetime.now().strftime("%Y-%m-%d")
    
    # Create hash of wellness + profile data
    data_str = f"{wellness_data}{profile}"
    data_hash = hashlib.md5(data_str.encode()).hexdigest()[:8]
    
    return f"{user_id}_{today}_{data_hash}"



def generate_daily_briefing(user_id: str, force_regenerate: bool = False) -> Dict[str, Any]:
    """
    Main Manager Agent workflow:
    1. Collect data from wellness logs and user profile
    2. Check cache for existing briefing
    3. Generate workout and nutrition recommendations if needed
    4. Detect conflicts and create unified briefing
    5. Save decisions back to profile
    """
    global _briefing_cache
    
    from backend.server import get_user_profile
    from backend.tools.memory_store import get_wellness_memory, _get_index, _get_embeddings
    import time
    
    # STEP 1: Collect Wellness Data
    wellness_logs = get_wellness_memory(query="recent wellness readiness biometrics", top_k=1, user_id=user_id)
    
    wellness_data = {}
    if wellness_logs and len(wellness_logs) > 0:
        latest = wellness_logs[0]
        readiness_score = latest.get('readiness_score', 70)
        sleep_hours = latest.get('sleep_hours', 7.0)
        hrv = latest.get('hrv', 50)
        rhr = latest.get('rhr', 65)
        wellness_data = {'readiness_score': readiness_score, 'sleep_hours': sleep_hours, 'hrv': hrv, 'rhr': rhr}
    else:
        # No wellness data - use defaults
        readiness_score = 70
        sleep_hours = 7.0
        hrv = 50
        rhr = 65
        wellness_data = {'readiness_score': readiness_score, 'sleep_hours': sleep_hours, 'hrv': hrv, 'rhr': rhr}
    
    # STEP 2: Get User Profile
    profile = get_user_profile(user_id=user_id) or {}
    calories = profile.get('calories', 2000)
    phase = profile.get('phase', 'maintenance')
    protein_target = profile.get('protein_target', 150)
    
    # STEP 3: Check Cache
    cache_key = _get_cache_key(user_id, wellness_data, profile)
    
    if not force_regenerate and cache_key in _briefing_cache:
        print(f"📦 Using cached manager briefing for {user_id} (key: {cache_key})")
        return _briefing_cache[cache_key]
    
    print(f"🔄 Generating new manager briefing for {user_id}")
    
    # Use the same model as other agents
    model = genai.GenerativeModel('gemini-2.5-flash')
    
    # STEP 4: Generate Unified Daily Plan using Manager Agent
    prompt = f"""You are the Manager Agent (Head Coach) coordinating a team of specialist agents.

**WELLNESS AGENT REPORT:**
- Readiness Score: {readiness_score}/100
- Sleep: {sleep_hours}h
- HRV: {hrv} ms
- RHR: {rhr} bpm

**USER PROFILE:**
- Goal Phase: {phase}
- Daily Calories: {calories} kcal
- Protein Target: {protein_target}g

**YOUR TASK:**
As the Manager, synthesize a Daily Briefing that coordinates:
1. Workout recommendation (adjust intensity based on readiness)
2. Nutrition plan (aligned with workout and phase)
3. Conflict detection (if readiness conflicts with phase goals)

**RULES:**
- If readiness < 60: OVERRIDE to active recovery regardless of phase
- If readiness 60-79: Moderate intensity
- If readiness >= 80: High intensity allowed
- Nutrition stays at base calories ± 200 based on workout

**OUTPUT (strict JSON, no markdown):**
{{
  "workout": "Specific workout name (e.g., 'Upper Body Hypertrophy' or 'Active Recovery Walk')",
  "intensity": "Low/Medium/High",
  "duration": "X minutes",
  "workout_rationale": "Brief reasoning for this workout choice",
  "calories": "Total daily calories as integer",
  "protein": "Protein grams as integer",
  "carbs": "Carbs grams as integer",
  "fat": "Fat grams as integer",
  "pre_workout_meal": "Specific meal suggestion",
  "post_workout_meal": "Specific meal suggestion",
  "conflict_detected": true/false,
  "conflict_description": "Description if conflict exists, otherwise empty string",
  "final_decision": "One sentence summary of the unified plan"
}}
"""
    
    try:
        response = model.generate_content(prompt)
        clean_text = response.text.replace("```json", "").replace("```", "").strip()
        plan = json.loads(clean_text)
        
        # Categorize readiness
        if readiness_score >= 80:
            readiness_state = "Optimal - Ready for high intensity"
        elif readiness_score >= 60:
            readiness_state = "Moderate - Recommended medium intensity"
        else:
            readiness_state = "Low - Active recovery only"
        
        # Calculate stress and HRV categories
        if rhr <= 58:
            stress_level = "Low"
        elif rhr <= 68:
            stress_level = "Moderate"
        else:
            stress_level = "High"
        
        if hrv >= 65:
            hrv_category = "High"
        elif hrv >= 45:
            hrv_category = "Normal"
        else:
            hrv_category = "Low"
        
        # Build conflicts list
        conflicts = []
        if plan.get('conflict_detected', False):
            conflicts.append({
                "type": "Safety Override",
                "source_agents": ["Wellness Agent", "Physical Trainer"],
                "issue": plan.get('conflict_description', ''),
                "resolution": "Manager adjusted plan to respect readiness"
            })
        
        # Create Daily Briefing
        briefing = {
            "status": "success",
            "briefing_date": "today",
            "wellness_assessment": {
                "readiness_score": readiness_score,
                "sleep_hours": sleep_hours,
                "state": readiness_state,
                "hrv": hrv_category,
                "stress_level": stress_level
            },
            "workout_plan": {
                "workout": plan.get('workout', 'Active Recovery'),
                "intensity": plan.get('intensity', 'Low'),
                "duration": plan.get('duration', '30 minutes'),
                "rationale": plan.get('workout_rationale', 'Respecting current readiness')
            },
            "nutrition_plan": {
                "total_calories": f"{plan.get('calories', calories)} kcal",
                "protein": f"{plan.get('protein', protein_target)}g",
                "carbs": f"{plan.get('carbs', 'N/A')}g",
                "fat": f"{plan.get('fat', 'N/A')}g",
                "pre_workout": plan.get('pre_workout_meal', 'Light meal 2h before'),
                "post_workout": plan.get('post_workout_meal', 'Protein-rich meal')
            },
            "conflicts": conflicts,
            "final_decision": {
                "summary": plan.get('final_decision', f"{plan.get('workout', 'Recovery')} + {plan.get('calories', calories)} kcal"),
                "priority": "Safety first - Respecting wellness data"
            }
        }
        
        # STEP 5: Persist Manager Decisions to Profile
        # Update user profile if manager adjusted calories/protein
        manager_calories = plan.get('calories', calories)
        manager_protein = plan.get('protein', protein_target)
        
        if manager_calories != calories or manager_protein != protein_target:
            try:
                print(f"💾 Manager updating profile: calories={manager_calories}, protein={manager_protein}")
                
                # Create updated profile document
                profile_text = f"""User Fitness Profile (Manager Updated):
Daily Calorie Target: {manager_calories} kcal
Current Phase: {phase}
Protein Target: {manager_protein}g per day

Manager adjusted nutrition based on today's readiness and workout plan.
"""
                
                # Get embedding
                embeddings = _get_embeddings()
                profile_vector = embeddings.embed_query(profile_text)
                
                # Prepare metadata
                profile_metadata = {
                    "type": "user_profile",
                    "calories": int(manager_calories),
                    "phase": phase,
                    "protein_target": int(manager_protein),
                    "notes": f"Manager-adjusted on {datetime.now().strftime('%Y-%m-%d')}",
                    "created_timestamp": int(time.time()),
                    "text": profile_text
                }
                
                # Store in Pinecone
                index = _get_index()
                profile_vector_id = f"profile_{user_id}_{int(time.time())}"
                
                index.upsert(
                    vectors=[(profile_vector_id, profile_vector, profile_metadata)],
                    namespace=user_id
                )
                
                print(f"✅ Profile updated by Manager Agent")
            except Exception as e:
                print(f"⚠️ Failed to update profile: {e}")
        
        # STEP 6: Cache the briefing
        _briefing_cache[cache_key] = briefing
        print(f"📦 Cached manager briefing with key: {cache_key}")
        
        return briefing
        
    except Exception as e:
        print(f"❌ Manager Agent error: {e}")
        # Fallback to safe defaults
        return {
            "status": "success",
            "briefing_date": "today",
            "wellness_assessment": {
                "readiness_score": readiness_score,
                "sleep_hours": sleep_hours,
                "state": "Moderate",
                "hrv": "Normal",
                "stress_level": "Moderate"
            },
            "workout_plan": {
                "workout": "Moderate Strength Training",
                "intensity": "Medium",
                "duration": "45 minutes",
                "rationale": "Balanced approach for current state"
            },
            "nutrition_plan": {
                "total_calories": f"{calories} kcal",
                "protein": f"{protein_target}g",
                "carbs": "N/A",
                "fat": "N/A",
                "pre_workout": "Light meal 2h before",
                "post_workout": "Protein-rich meal"
            },
            "conflicts": [],
            "final_decision": {
                "summary": f"Moderate Training + {calories} kcal",
                "priority": "Balanced approach"
            }
        }
