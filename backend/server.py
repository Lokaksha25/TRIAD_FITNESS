from dotenv import load_dotenv
import os

# Load environment variables
from pathlib import Path
# Robustly load .env from the backend directory
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)
# Also try loading from root if not found or for overrides
load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env")

from fastapi.middleware.cors import CORSMiddleware

from fastapi import FastAPI, HTTPException, UploadFile, File
from pydantic import BaseModel
from crewai import Crew, Process

# Updated Imports
from backend.agents.physical_trainer.agent import PhysicalTrainerAgent
from backend.agents.physical_trainer.tasks import PhysicalTrainerTasks
from backend.agents.nutritionist.agent import NutritionistAgent
from backend.agents.nutritionist.data_loader import FoodDataLoader
from backend.agents.nutritionist.retrieval import DietRetriever
from backend.agents.nutritionist.scanner import analyze_food_image
from backend.agents.wellness.brain import analyze_wellness, generate_wellness_chat_response

import threading
import re
import time
import json
from pinecone import Pinecone
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from groq import Groq
from groq import Groq
from backend.tools.memory_store import get_exercise_memory, get_nutrition_memory, get_wellness_memory, format_exercise_context, format_wellness_context
import backend.session_state as session_state

def extract_json(text):
    """
    Robustly extract JSON from a string, handling markdown code blocks and extra text.
    """
    try:
        # First try direct parse
        return json.loads(text)
    except:
        pass
    
    # Try cleaning markdown
    try:
        clean = text.replace("```json", "").replace("```", "").strip()
        return json.loads(clean)
    except:
        pass

    # Try finding the first { and last }
    try:
        start = text.find('{')
        end = text.rfind('}') + 1
        if start != -1 and end != -1:
             return json.loads(text[start:end])
    except:
        pass
        
    return None

app = FastAPI()

# Input Validation: Allow all origins for development to fix CORS issues
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SessionRequest(BaseModel):
    exercise_type: str
    user_id: str

class SignupRequest(BaseModel):
    user_id: str
    email: str
    name: str

class ChatRequest(BaseModel):
    message: str
    user_id: str 

class NutritionRequest(BaseModel):
    goal: str
    diet_type: str = "Vegetarian"
    budget: int = 500
    wellness_data: dict = {}
    fitness_coach_plan: str = ""
    user_id: str

class UserProfileRequest(BaseModel):
    """User fitness profile for personalized AI advice"""
    calories: int = 2000  # Daily calorie target
    phase: str = "maintenance"  # cutting, bulking, or maintenance
    protein_target: int = 150  # grams
    notes: str = ""  # Any additional context
    user_id: str

class WellnessRequest(BaseModel):
    """Biometric data for wellness analysis"""
    user_id: str
    date: str = ""
    sleep_hours: float = 7.0
    hrv: int = 50  # Heart Rate Variability in ms
    rhr: int = 65  # Resting Heart Rate in bpm

class WeeklyPlanRequest(BaseModel):
    """Request for weekly training plan generation"""
    user_id: str
    force_regenerate: bool = False  # Override cache and force new plan generation

class OnboardingRequest(BaseModel):
    """User onboarding data from initial setup"""
    user_id: str
    gender: str
    age: int
    weight: float  # in kg
    height: float  # in cm
    goal: str  # 'lose', 'maintain', 'gain'
    activity_level: str  # 'sedentary', 'light', 'moderate', 'very', 'extreme'
    calculated_calories: int


def format_trainer_chat_response(trainer_data, log_id):
    """
    Wrapper to format the trainer's raw output into a chat-friendly JSON object.
    
    Args:
        trainer_data (dict): The raw dictionary returned by the trainer agent.
        log_id (str): The ID of the log saved to Pinecone.
        
    Returns:
        dict: The formatted chat object conforming to the schema.
    """
    # Extract fields with defaults
    summary = trainer_data.get("summary", "No summary provided.")
    detected_issues = trainer_data.get("detected_issues", [])
    recommendations = trainer_data.get("recommendations", "No specific recommendations.")
    total_reps = trainer_data.get("total_reps", 0)
    form_rating = trainer_data.get("form_rating", 0)

    # Ensure details is a list of strings and format them
    if isinstance(detected_issues, list):
        details = [issue.replace('_', ' ').capitalize() for issue in detected_issues]
    else:
        details = [str(detected_issues)]
        
    # If no issues, provide a positive detail
    if not details:
        details = ["Good form maintained"]

    return {
        "agent": "physical_trainer",
        "summary": summary,
        "details": details,
        "recommendation": recommendations,
        "reps": total_reps,
        "form_rating": form_rating,
        "source_log_id": log_id
    }

def detect_exercise_intent(text: str):
    """
    Simple keyword detection for exercise intent.
    Returns 'Pushup', 'Squat', or None.
    """
    t = text.lower()
    if "pushup" in t or "push-ups" in t or "push up" in t:
        return "Pushup"
    if "squat" in t:
        return "Squat"
    return None

def default_multiagent_orchestrator(message: str):
    """
    Fallback for queries not related to specific exercises.
    """
    return {
        "agent": "orchestrator",
        "summary": "I am the NeuroHealth Orchestrator.",
        "details": [
            "I can help you analyze your workout performance.",
            "Ask me about your 'Pushups' or 'Squats' to see your latest results.",
            "I can also connect you with the Nutritionist or Wellness manager."
        ],
        "recommendation": "Try asking: 'How were my squats?'",
        "reps": 0,
        "form_rating": 0,
        "source_log_id": None
    }

def generate_trainer_chat_response(user_message: str, user_profile: dict = None, user_id: str = None) -> dict:
    """
    Generate a trainer response using AI based on Pinecone exercise memory.
    """
    try:
        # Fetch exercise context from Pinecone
        exercise_memories = get_exercise_memory(query=user_message, top_k=3, user_id=user_id)
        context = format_exercise_context(exercise_memories) if exercise_memories else "No recent workout data available."
        
        # Build user profile context
        profile_context = ""
        if user_profile:
            profile_context = f"\n**User Profile:**\n- Daily Calories: {user_profile.get('calories', 'Not set')} kcal\n- Phase: {user_profile.get('phase', 'Not set')}\n- Protein Target: {user_profile.get('protein_target', 'Not set')}g\n"
        
        client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        
        system_prompt = """You are an expert Physical Trainer AI assistant. You analyze workout performance and provide personalized advice.

Based on the user's message, workout history, and profile (calories/phase), provide:
1. A brief analysis of their current fitness status
2. Specific recommendations based on any issues detected and their goals (cutting/bulking/maintenance)

Keep responses concise (2-3 sentences for summary, 1-2 for recommendation).
Format your response as JSON with keys: "summary" (string), "recommendation" (string)"""

        user_prompt = f"""User says: "{user_message}"
{profile_context}
**Workout History from Memory:**
{context}

Provide your analysis as the Physical Trainer."""

        response = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            model="llama-3.1-8b-instant",
            temperature=0.5,
            max_tokens=300,
        )
        
        result = response.choices[0].message.content
        
        # Try to parse as JSON
        data = extract_json(result)
        if data:
            return {
                "agentType": "Physical Trainer",
                "content": data.get("summary", result),
                "summary": data.get("recommendation", "Focus on form and consistency.")
            }
        else:
             # Fallback if no JSON found
             return {
                "agentType": "Physical Trainer",
                "content": result,
                "summary": "Continue training mindfully."
            }
            
    except Exception as e:
        print(f"Trainer AI error: {e}")
        return {
            "agentType": "Physical Trainer",
            "content": "Unable to analyze workout data at this time.",
            "summary": "Please check trainer connection."
        }

def generate_nutritionist_chat_response(user_message: str, user_profile: dict = None, user_id: str = None) -> dict:
    """
    Generate a nutritionist response using AI based on Pinecone memory.
    """
    try:
        # Fetch both exercise and nutrition context
        exercise_memories = get_exercise_memory(query=user_message, top_k=2, user_id=user_id)
        nutrition_memories = get_nutrition_memory(query=user_message, top_k=2, user_id=user_id)
        
        exercise_context = format_exercise_context(exercise_memories) if exercise_memories else "No recent workout data."
        nutrition_context = ""
        if nutrition_memories:
            nutrition_context = "\n".join([f"- {m.get('text', '')[:200]}" for m in nutrition_memories])
        else:
            nutrition_context = "No recent nutrition plans."
        
        # Build user profile context
        profile_context = ""
        if user_profile:
            profile_context = f"\n**User Profile:**\n- Daily Calories: {user_profile.get('calories', 'Not set')} kcal\n- Phase: {user_profile.get('phase', 'Not set')} (cutting/bulking/maintenance)\n- Protein Target: {user_profile.get('protein_target', 'Not set')}g\n"
        
        client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        
        system_prompt = """You are an expert Indian Nutritionist AI assistant. You provide personalized nutrition advice based on the user's fitness goals, workout history, and calorie phase (cutting/bulking/maintenance).

Based on the context and user's phase, provide:
1. A brief nutrition analysis or recommendation tailored to their calorie goals
2. A specific actionable suggestion for their current phase

Keep responses concise (2-3 sentences for summary, 1-2 for recommendation).
Format your response as JSON with keys: "summary" (string), "recommendation" (string)"""

        user_prompt = f"""User says: "{user_message}"
{profile_context}
**Recent Workout Data:**
{exercise_context}

**Recent Nutrition Plans:**
{nutrition_context}

Provide your nutrition advice based on their cutting/bulking/maintenance phase."""

        response = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            model="llama-3.1-8b-instant",
            temperature=0.5,
            max_tokens=300,
        )
        
        result = response.choices[0].message.content
        
        # Try to parse as JSON
        data = extract_json(result)
        if data:
            return {
                "agentType": "Nutritionist",
                "content": data.get("summary", result),
                "summary": data.get("recommendation", "Maintain balanced nutrition.")
            }
        else:
             return {
                "agentType": "Nutritionist",
                "content": result,
                "summary": "Focus on protein and hydration."
            }
            
    except Exception as e:
        print(f"Nutritionist AI error: {e}")
        return {
            "agentType": "Nutritionist",
            "content": "Unable to provide nutrition advice at this time.",
            "summary": "Please check nutritionist connection."
        }

def get_latest_trainer_log(exercise: str, query: str, api_key: str, pinecone_key: str):
    try:
        pc = Pinecone(api_key=pinecone_key)
        index_name = os.environ.get("PINECONE_INDEX_NAME")
        if not index_name:
            print("⚠️ PINECONE_INDEX_NAME not set.")
            return None
            
        index = pc.Index(index_name)
        
        embeddings = GoogleGenerativeAIEmbeddings(
            model="models/text-embedding-004",
            google_api_key=api_key
        )
        
        # Embed the user query to find semantically relevant logs
        vector_values = embeddings.embed_query(query)
        
        # Query Pinecone with filter
        # We fetch top_k=10 to ensure we find the most recent one among relevant matches
        results = index.query(
            vector=vector_values,
            top_k=10,
            filter={"exercise": exercise},
            include_metadata=True
        )
        
        if not results['matches']:
            return None
            
        # Sort by timestamp in ID (format: log_{timestamp})
        # We assume IDs are reliable.
        sorted_matches = sorted(
            results['matches'], 
            key=lambda x: int(x['id'].split('_')[1]) if '_' in x['id'] else 0, 
            reverse=True
        )
        
        return sorted_matches[0]
        
    except Exception as e:
        print(f"Error querying Pinecone: {e}")
        return None

@app.post("/api/auth/signup")
async def signup_handler(request: SignupRequest):
    """
    Handle user signup: Just acknowledge the signup.
    Namespace initialization will happen during onboarding for better performance.
    """
    print(f"📝 Signup request for: {request.name} ({request.email})")
    
    # Skip initialize_user_namespace - will be done during onboarding
    # This saves ~400-500ms per signup
    
    return {"status": "success", "message": "User registered"}


@app.post("/api/user/onboarding")
async def onboarding_handler(request: OnboardingRequest):
    """
    Store user onboarding data as user settings in Pinecone.
    This includes physical stats and calculated calorie targets.
    Also creates a user_profile record for the profile page.
    """
    from backend.tools.memory_store import _get_index, _get_embeddings
    import time
    
    print(f"📋 Onboarding data received for user: {request.user_id}")
    
    try:
        index = _get_index()
        embeddings = _get_embeddings()
        
        # Create onboarding settings document
        onboarding_text = f"""User Onboarding Settings:
Gender: {request.gender}
Age: {request.age} years
Weight: {request.weight} kg
Height: {request.height} cm
Fitness Goal: {request.goal}
Activity Level: {request.activity_level}
Calculated Daily Calories: {request.calculated_calories} kcal

This user is aiming to {request.goal} weight with a {request.activity_level} activity level.
"""
        
        # Embed the settings
        vector = embeddings.embed_query(onboarding_text)
        
        # Prepare metadata for user_settings
        settings_metadata = {
            "type": "user_settings",
            "gender": request.gender,
            "age": request.age,
            "weight": request.weight,
            "height": request.height,
            "goal": request.goal,
            "activity_level": request.activity_level,
            "calculated_calories": request.calculated_calories,
            "created_timestamp": int(time.time()),
            "text": onboarding_text
        }
        
        # Store user_settings in Pinecone under user's namespace
        settings_vector_id = f"onboarding_{request.user_id}_{int(time.time())}"
        
        index.upsert(
            vectors=[(settings_vector_id, vector, settings_metadata)],
            namespace=request.user_id
        )
        
        # NOW ALSO CREATE user_profile record for profile page
        # Map onboarding data to profile format
        goal_to_phase_map = {
            "lose": "cutting",
            "maintain": "maintenance",
            "gain": "bulking"
        }
        phase = goal_to_phase_map.get(request.goal, "maintenance")
        
        # Calculate protein target: 2g per kg body weight (standard recommendation)
        protein_target = int(request.weight * 2)
        
        # Create profile document
        profile_text = f"""User Fitness Profile:
Daily Calorie Target: {request.calculated_calories} kcal
Current Phase: {phase}
Protein Target: {protein_target}g per day

This profile was automatically created from onboarding data.
"""
        
        # Embed the profile
        profile_vector = embeddings.embed_query(profile_text)
        
        # Prepare metadata for user_profile
        profile_metadata = {
            "type": "user_profile",
            "calories": request.calculated_calories,
            "phase": phase,
            "protein_target": protein_target,
            "notes": f"Auto-generated from onboarding: {request.goal} weight, {request.activity_level} activity level",
            "created_timestamp": int(time.time()),
            "text": profile_text
        }
        
        # Store user_profile in Pinecone
        profile_vector_id = f"profile_{request.user_id}_{int(time.time())}"
        
        index.upsert(
            vectors=[(profile_vector_id, profile_vector, profile_metadata)],
            namespace=request.user_id
        )
        
        print(f"✅ Onboarding data saved for user {request.user_id}")
        print(f"   Calories: {request.calculated_calories} kcal, Goal: {request.goal} → Phase: {phase}")
        print(f"   Protein Target: {protein_target}g")
        
        return {
            "status": "success",
            "message": "Onboarding data saved successfully",
            "calories": request.calculated_calories,
            "phase": phase,
            "protein_target": protein_target
        }
        
    except Exception as e:
        print(f"❌ Error saving onboarding data: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save onboarding data: {str(e)}")

@app.post("/api/chat")
async def chat_handler(request: ChatRequest):
    """
    Multi-agent chat endpoint.
    Returns responses from: Physical Trainer (AI), Nutritionist (AI), Wellness (Mocked)
    """
    # Check keys
    api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    pinecone_key = os.environ.get("PINECONE_API_KEY")
    groq_key = os.environ.get("GROQ_API_KEY")
    
    if not api_key or not pinecone_key:
        raise HTTPException(status_code=500, detail="Missing API Keys in environment.")

    print(f"Chat request received: {request.message[:50]}...")
    
    # Fetch user profile for personalized responses
    user_profile = get_user_profile(user_id=request.user_id)
    if user_profile:
        print(f"📋 User profile loaded: {user_profile.get('calories')} cal, phase: {user_profile.get('phase')}")
    else:
        print("ℹ️ No user profile found, using defaults")
    
    # Generate responses from all agents in parallel-ish fashion
    agent_responses = []
    
    # 1. Physical Trainer (AI-powered with Pinecone context + user profile)
    try:
        trainer_response = generate_trainer_chat_response(request.message, user_profile, user_id=request.user_id)
        agent_responses.append(trainer_response)
        print(f"✅ Trainer response generated")
    except Exception as e:
        print(f"❌ Trainer error: {e}")
        agent_responses.append({
            "agentType": "Physical Trainer",
            "content": "Unable to process trainer analysis.",
            "summary": "Service temporarily unavailable."
        })
    
    # 2. Nutritionist (AI-powered with Pinecone context + user profile)
    try:
        nutritionist_response = generate_nutritionist_chat_response(request.message, user_profile, user_id=request.user_id)
        agent_responses.append(nutritionist_response)
        print(f"✅ Nutritionist response generated")
    except Exception as e:
        print(f"❌ Nutritionist error: {e}")
        agent_responses.append({
            "agentType": "Nutritionist",
            "content": "Unable to process nutrition analysis.",
            "summary": "Service temporarily unavailable."
        })
    
    # 3. Wellness Agent (AI-powered with biometric analysis)
    try:
        wellness_response = generate_wellness_chat_response(request.message, user_profile=user_profile, user_id=request.user_id)
        agent_responses.append(wellness_response)
        print(f"✅ Wellness response generated")
    except Exception as e:
        print(f"❌ Wellness error: {e}")
        agent_responses.append({
            "agentType": "Wellness Coach",
            "content": "Unable to process wellness analysis.",
            "summary": "Service temporarily unavailable."
        })
    
    # Return multi-agent response
    return {
        "agents": agent_responses,
        "manager_decision": "Based on all agent inputs, the recommended action has been synthesized. Please review individual agent recommendations above."
    }

def get_user_profile(user_id: str = None) -> dict:
    """Fetch the latest user profile from Pinecone."""
    try:
        from tools.memory_store import _get_index, get_profile_query_vector
        
        index = _get_index()
        
        # Use cached query vector (avoids embedding API call)
        query_vector = get_profile_query_vector()
        
        results = index.query(
            vector=query_vector,
            top_k=5,
            include_metadata=True,
            namespace=user_id
        )
        
        # Find user_profile type
        for match in results.get('matches', []):
            meta = match.get('metadata', {})
            if meta.get('type') == 'user_profile':
                return {
                    "calories": meta.get('calories', 2000),
                    "phase": meta.get('phase', 'maintenance'),
                    "protein_target": meta.get('protein_target', 150),
                    "notes": meta.get('notes', '')
                }
        
        return None
    except Exception as e:
        print(f"Error fetching user profile: {e}")
        return None

def get_wellness_data(user_id: str = None) -> dict:
    """Fetch the latest wellness data from Pinecone (stored by wellness agent)."""
    try:
        from tools.memory_store import get_wellness_memory
        
        # Use the proper wellness memory retrieval function
        wellness_logs = get_wellness_memory(query="recent wellness readiness", top_k=1, user_id=user_id)
        
        # Default values
        wellness_data = {
            "sleep_score": 70,
            "stress_level": "Moderate",
            "hrv": "Normal",
            "readiness": "Good"
        }
        
        if wellness_logs and len(wellness_logs) > 0:
            latest = wellness_logs[0]
            
            # Convert sleep hours to score (0-10h -> 0-100 score)
            sleep_hours = latest.get('sleep_hours', 7.0)
            wellness_data["sleep_score"] = int(min(100, (sleep_hours / 10) * 100))
            
            # Convert HRV to category
            hrv_value = latest.get('hrv', 50)
            if hrv_value >= 65:
                wellness_data["hrv"] = "High"
            elif hrv_value >= 45:
                wellness_data["hrv"] = "Normal"
            else:
                wellness_data["hrv"] = "Low"
            
            # Convert RHR to stress level (inverse relationship)
            rhr_value = latest.get('rhr', 65)
            if rhr_value <= 58:
                wellness_data["stress_level"] = "Low"
            elif rhr_value <= 68:
                wellness_data["stress_level"] = "Moderate"
            else:
                wellness_data["stress_level"] = "High"
            
            # Convert readiness score to category
            readiness_score = latest.get('readiness_score', 70)
            if readiness_score >= 80:
                wellness_data["readiness"] = "Good"
            elif readiness_score >= 60:
                wellness_data["readiness"] = "Moderate"
            else:
                wellness_data["readiness"] = "Compromised"
            
            print(f"📊 Fetched wellness data from latest log:")
            print(f"   Sleep: {sleep_hours}h (score: {wellness_data['sleep_score']})")
            print(f"   HRV: {hrv_value}ms ({wellness_data['hrv']})")
            print(f"   RHR: {rhr_value}bpm (stress: {wellness_data['stress_level']})")
            print(f"   Readiness: {readiness_score}/100 ({wellness_data['readiness']})")
        else:
            print(f"⚠️ No wellness logs found, using defaults: {wellness_data}")
        
        return wellness_data
        
    except Exception as e:
        print(f"❌ Error fetching wellness data: {e}")
        return {"sleep_score": 70, "stress_level": "Moderate", "hrv": "Normal", "readiness": "Good"}


def detect_injury_from_history(user_id: str = None) -> bool:
    """
    Detect if user has an injury based on wellness and exercise history.
    
    Checks for:
    - Low readiness scores (<40) for 3+ consecutive analyses
    - Poor form ratings (<5) with recurring issues
    - Keywords like 'injury' or 'pain' in wellness metadata
    
    Returns:
        True if injury detected, False otherwise
    """
    try:
        from tools.memory_store import get_wellness_memory, get_exercise_memory
        
        # Check wellness data for low readiness
        wellness_logs = get_wellness_memory(query="recent wellness readiness", top_k=5, user_id=user_id)
        low_readiness_count = 0
        
        for log in wellness_logs:
            readiness = log.get('readiness_score', 100)
            if readiness < 40:
                low_readiness_count += 1
            
            # Check for injury keywords in summary
            summary = log.get('executive_summary', '').lower()
            text = log.get('text', '').lower()
            if 'injury' in summary or 'injury' in text or 'pain' in summary or 'pain' in text:
                print(f"🚨 Injury keyword detected in wellness log")
                return True
        
        if low_readiness_count >= 3:
            print(f"🚨 Critical fatigue detected: {low_readiness_count} low readiness scores")
            return True
        
        # Check exercise data for form issues
        exercise_logs = get_exercise_memory(query="recent workout form", top_k=5, user_id=user_id)
        poor_form_count = 0
        
        for log in exercise_logs:
            rating = log.get('rating', 10)
            issues = log.get('issues', [])
            
            if rating < 5 and len(issues) > 0:
                poor_form_count += 1
        
        if poor_form_count >= 3:
            print(f"⚠️ Recurring form issues detected: {poor_form_count} poor ratings")
            return True
        
        print(f"✅ No injuries detected")
        return False
        
    except Exception as e:
        print(f"❌ Error detecting injury: {e}")
        return False


def is_plan_valid(plan_metadata: dict) -> bool:
    """
    Check if a cached training plan is still valid.
    
    Plan is valid if:
    - Created less than 5 weeks ago (35 days)
    - No injury was detected when checking history
    
    Returns:
        True if plan is valid and can be reused, False otherwise
    """
    if not plan_metadata:
        return False
    
    try:
        import time
        from datetime import datetime, timedelta
        
        created_timestamp = plan_metadata.get('created_timestamp', 0)
        current_timestamp = int(time.time())
        
        # Calculate age in days
        age_seconds = current_timestamp - created_timestamp
        age_days = age_seconds / (60 * 60 * 24)
        
        # Check if plan is older than 5 weeks (35 days)
        if age_days > 35:
            print(f"📅 Plan expired: {age_days:.1f} days old (>35 days)")
            return False
        
        # Check for injuries
        if detect_injury_from_history():
            print(f"🚨 Plan invalid: Injury detected")
            return False
        
        print(f"✅ Plan valid: {age_days:.1f} days old, no injuries")
        return True
        
    except Exception as e:
        print(f"❌ Error validating plan: {e}")
        return False


def generate_weekly_training_plan(user_profile: dict = None, wellness_data: dict = None, nutrition_data: dict = None) -> dict:
    """
    Generate a new weekly training plan using AI (Groq).
    
    Args:
        user_profile: User fitness profile (calories, phase, etc.)
        wellness_data: Current wellness/biometric data
        nutrition_data: Current nutrition status
        
    Returns:
        Dictionary with weekly plan including exercises, sets, reps for each day
    """
    try:
        client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        
        # Build context from user data
        profile_context = ""
        calories = 2000
        phase = "maintenance"
        protein = 150
        user_notes = ""
        
        if user_profile:
            calories = user_profile.get('calories', 2000)
            phase = user_profile.get('phase', 'maintenance')
            protein = user_profile.get('protein_target', 150)
            user_notes = user_profile.get('notes', '')
            
            profile_context = f"""
USER PROFILE (CRITICAL - MUST REFERENCE IN ALL DECISIONS):
- Daily Caloric Target: {calories} kcal/day
- Training Phase: {phase.upper()}
- Protein Target: {protein}g/day
- User Preferences/Notes: {user_notes if user_notes else 'None specified'}
"""
        
        wellness_context = ""
        readiness = "Good"
        sleep_score = 70
        
        if wellness_data:
            readiness = wellness_data.get('readiness', 'Good')
            sleep_score = wellness_data.get('sleep_score', 70)
            wellness_context = f"""
CURRENT WELLNESS STATUS:
- Recovery Readiness: {readiness}
- Sleep Quality: {sleep_score}/100
- Stress Level: {wellness_data.get('stress_level', 'Moderate')}
- HRV Status: {wellness_data.get('hrv', 'Normal')}
"""
        
        # Determine training approach based on phase
        phase_specific_instructions = ""
        if phase == "bulking":
            phase_specific_instructions = """
BULKING PHASE REQUIREMENTS:
- Focus: Hypertrophy (muscle growth) and progressive overload
- Volume: HIGHER volume (4-5 sets per exercise, 8-12 rep range for main lifts)
- Exercise Selection: Compound movements + isolation work for volume
- Rep Ranges: 6-12 for compounds, 10-15 for accessories
- Training Days: 4-5 days recommended (Push/Pull/Legs or Upper/Lower split)
- Rest Periods: 2-3 min for compounds, 60-90s for accessories
- Intensity: 70-85% of 1RM, focus on time under tension
- Example: Squat 4x10, Leg Press 4x12, Leg Curls 3x15
"""
        elif phase == "cutting":
            phase_specific_instructions = """
CUTTING PHASE REQUIREMENTS:
- Focus: Maintain strength and muscle mass while in caloric deficit
- Volume: MODERATE volume (3-4 sets, lower reps to preserve CNS)
- Exercise Selection: Prioritize compound movements, minimize isolation
- Rep Ranges: 5-8 for main lifts (strength focus), 8-12 for accessories
- Training Days: 3-4 days (avoid overtraining in deficit)
- Rest Periods: 3-4 min for compounds (full recovery), 90s for accessories
- Intensity: 75-90% of 1RM, focus on maintaining load
- Include: 1-2 HIIT/conditioning sessions
- Example: Squat 4x6, Romanian Deadlift 3x8, skip high-volume accessories
"""
        else:  # maintenance
            phase_specific_instructions = """
MAINTENANCE PHASE REQUIREMENTS:
- Focus: Balanced strength and conditioning
- Volume: MODERATE volume (3-4 sets per exercise)
- Exercise Selection: Mix of compound and isolation
- Rep Ranges: 6-10 for compounds, 10-12 for accessories
- Training Days: 3-4 days (sustainable long-term)
- Rest Periods: 2-3 min for compounds, 60-90s for accessories
- Intensity: 70-80% of 1RM
- Example: Squat 4x8, Bench Press 4x8, Rows 3x10
"""
        
        system_prompt = f"""You are an ELITE strength and conditioning coach with 15+ years of experience training athletes and bodybuilders. You specialize in evidence-based, periodized programming.

CRITICAL RULES:
0. **HIGHEST PRIORITY - USER PREFERENCES**: If the user's notes specify a preferred workout split (e.g., "Upper Lower", "Push Pull Legs", "Full Body", etc.) or training frequency (e.g., "5 times a week"), you MUST use that split and frequency. This overrides all default recommendations.
   - User Notes: "{user_notes}"
   - Parse for: split type (Upper/Lower, PPL, Full Body, etc.) and frequency (X days/week)
   - If notes mention a specific split: USE IT, DO NOT default to PPL or any other split
1. You MUST explicitly reference the user's profile in your program design
2. Training MUST align with their caloric phase (cutting/bulking/maintenance)
3. Every exercise selection must have a clear rationale
4. Programs must follow the USER'S PREFERRED split if specified, otherwise use proven routines (Push/Pull/Legs, Upper/Lower, or Full Body)
5. Include specific load prescriptions (% of 1RM or RPE)
6. Exercise names must be SPECIFIC (e.g., "Barbell Back Squat" not just "Squat")

PROGRAM STRUCTURE REQUIREMENTS:
- Total Days: 3-5 training days per week (based on phase and recovery)
- Rest Days: Must include at least 2 full rest days
- Progressive Overload: Specify how to progress each week
- Deload Strategy: Built into week 4-5

EXERCISE QUALITY STANDARDS:
✓ GOOD: "Barbell Back Squat (Low Bar)", "Dumbbell Bench Press (Incline 30°)"
✗ BAD: "Squats", "Bench", "Curls"

✓ GOOD: Compound movements first, then isolation
✗ BAD: Random exercise order

FORMAT REQUIREMENTS:
{{
  "weekly_schedule": [
    {{
      "day": "Monday",
      "focus": "PUSH - Chest/Shoulders/Triceps (Hypertrophy Focus)",
      "exercises": [
        {{
          "name": "Barbell Bench Press (Flat)",
          "sets": 4,
          "reps": 8,
          "rest": "3 min",
          "notes": "Main compound, 80% 1RM, focus on controlled eccentric"
        }},
        {{
          "name": "Dumbbell Overhead Press (Seated)",
          "sets": 3,
          "reps": 10,
          "rest": "90s",
          "notes": "Vertical press variation, RPE 7-8"
        }}
      ]
    }}
  ],
  "program_notes": "Explain WHY this program fits the user's {phase} phase at {calories} kcal. Reference specific adaptations expected.",
  "progression_strategy": "Specific week-to-week progression plan (e.g., 'Week 1-3: Add 2.5kg per session, Week 4: Deload 20%, Week 5: Test new maxes')"
}}

{phase_specific_instructions}

WELLNESS-BASED ADJUSTMENTS:
- If Readiness is "Good" and Sleep > 80: Can push higher volume/intensity
- If Readiness is "Compromised" or Sleep < 60: Reduce volume by 20-30%, focus on technique
- If HRV is "Low": Avoid CNS-intensive lifts (heavy deadlifts, max effort work)
"""
        
        user_prompt = f"""Design a 5-week training program for this user:

{profile_context}
{wellness_context}

SPECIFIC REQUIREMENTS FOR THIS USER:
0. **WORKOUT SPLIT (MANDATORY)**: {'User explicitly requested: ' + user_notes + ' - YOU MUST follow this split and frequency exactly' if user_notes and any(keyword in user_notes.lower() for keyword in ['upper', 'lower', 'push', 'pull', 'leg', 'full body', 'times', 'days']) else f'Design an appropriate {phase}-optimized split (PPL, Upper/Lower, or Full Body)'}
1. Their {phase} phase at {calories} kcal means you must prioritize {'hypertrophy volume' if phase == 'bulking' else 'strength maintenance' if phase == 'cutting' else 'balanced training'}
2. Current recovery status ({readiness}, {sleep_score}/100 sleep) indicates {'higher volume tolerance' if readiness == 'Good' and sleep_score > 80 else 'moderate volume' if readiness == 'Good' else 'volume reduction needed'}
3. Protein intake of {protein}g supports {'aggressive muscle building' if phase == 'bulking' else 'muscle preservation' if phase == 'cutting' else 'maintenance'}

DELIVERABLES:
- 7-day schedule (including rest days explicitly marked)
- 3-5 training days with COMPLETE exercise details
- Exercise names must be specific with equipment and variation
- Sets, reps, rest, AND detailed notes for each exercise
- Program notes explaining WHY this fits their {phase} phase
- 5-week progression strategy with deload week

EXAMPLE QUALITY LEVEL:
Day: "Monday - PUSH (Chest/Shoulders/Triceps)"
Exercise: "Barbell Bench Press (Flat, Competition Grip)"
Sets: 4, Reps: 8, Rest: "3 min"
Notes: "Main horizontal press, 80% 1RM, controlled 2s eccentric, explosive concentric"

Now create the program in valid JSON format."""
        
        response = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            model="llama-3.3-70b-versatile",  # Updated from deprecated 3.1 to 3.3
            temperature=0.6,  # Slightly lower for more consistent quality
            max_tokens=3000,  # Increased for detailed programs
        )
        
        result = response.choices[0].message.content
        
        # Parse JSON
        plan_data = extract_json(result)
        
        if plan_data:
            print(f"✅ Generated new weekly plan with {len(plan_data.get('weekly_schedule', []))} days")
            return plan_data
        else:
            raise ValueError("Failed to parse plan JSON")
            
    except Exception as e:
        print(f"❌ Error generating plan: {e}")
        # Improved fallback plan that adapts to user phase
        phase = user_profile.get('phase', 'maintenance') if user_profile else 'maintenance'
        calories = user_profile.get('calories', 2000) if user_profile else 2000
        
        # Adjust volume based on phase
        if phase == "bulking":
            sets_main = 5
            reps_main = 10
            sets_acc = 4
            reps_acc = 12
        elif phase == "cutting":
            sets_main = 4
            reps_main = 6
            sets_acc = 3
            reps_acc = 10
        else:  # maintenance
            sets_main = 4
            reps_main = 8
            sets_acc = 3
            reps_acc = 10
        
        return {
            "weekly_schedule": [
                {
                    "day": "Monday",
                    "focus": f"PUSH - Chest/Shoulders/Triceps ({phase.capitalize()} Phase)",
                    "exercises": [
                        {"name": "Barbell Bench Press (Flat)", "sets": sets_main, "reps": reps_main, "rest": "3 min", "notes": "Main horizontal press, compound movement"},
                        {"name": "Dumbbell Overhead Press (Seated)", "sets": sets_acc, "reps": reps_acc, "rest": "90s", "notes": "Shoulder development"},
                        {"name": "Dumbbell Incline Press (30°)", "sets": sets_acc, "reps": reps_acc, "rest": "90s", "notes": "Upper chest focus"},
                        {"name": "Cable Tricep Pushdowns", "sets": 3, "reps": 15, "rest": "60s", "notes": "Tricep isolation"}
                    ]
                },
                {
                    "day": "Tuesday",
                    "focus": "Rest Day",
                    "exercises": []
                },
                {
                    "day": "Wednesday",
                    "focus": f"PULL - Back/Biceps ({phase.capitalize()} Phase)",
                    "exercises": [
                        {"name": "Barbell Deadlift (Conventional)", "sets": sets_main, "reps": reps_main - 2, "rest": "3 min", "notes": "Main posterior chain, compound"},
                        {"name": "Barbell Bent-Over Rows", "sets": sets_acc, "reps": reps_acc, "rest": "2 min", "notes": "Horizontal pull, back thickness"},
                        {"name": "Pull-Ups (Weighted if possible)", "sets": sets_acc, "reps": reps_main, "rest": "2 min", "notes": "Vertical pull, lat width"},
                        {"name": "Barbell Curls", "sets": 3, "reps": 12, "rest": "60s", "notes": "Bicep isolation"}
                    ]
                },
                {
                    "day": "Thursday",
                    "focus": "Rest Day",
                    "exercises": []
                },
                {
                    "day": "Friday",
                    "focus": f"LEGS - Quads/Hamstrings/Glutes ({phase.capitalize()} Phase)",
                    "exercises": [
                        {"name": "Barbell Back Squat (Low Bar)", "sets": sets_main, "reps": reps_main, "rest": "3 min", "notes": "Main quad/glute compound"},
                        {"name": "Romanian Deadlifts", "sets": sets_acc, "reps": reps_acc, "rest": "2 min", "notes": "Hamstring and glute development"},
                        {"name": "Leg Press (45° Sled)", "sets": sets_acc, "reps": reps_acc + 2, "rest": "90s", "notes": "Volume work for quads"},
                        {"name": "Walking Lunges", "sets": 3, "reps": 12, "rest": "60s", "notes": "Unilateral leg work"}
                    ]
                },
                {
                    "day": "Saturday",
                    "focus": "Rest Day or Active Recovery",
                    "exercises": []
                },
                {
                    "day": "Sunday",
                    "focus": "Rest Day",
                    "exercises": []
                }
            ],
            "program_notes": f"Fallback {phase} program at {calories} kcal/day. This is a proven Push/Pull/Legs split with appropriate volume for your phase. For {phase} phase: {'focus on progressive overload and volume' if phase == 'bulking' else 'maintain strength while managing fatigue' if phase == 'cutting' else 'balanced training for long-term sustainability'}. REST DAYS ARE CRITICAL for recovery.",
            "progression_strategy": f"Week 1-3: {'Add 2.5-5kg per session and/or add 1-2 reps' if phase == 'bulking' else 'Maintain current loads, focus on bar speed' if phase == 'cutting' else 'Add 2.5kg every other week'}, Week 4: Deload 20% volume, Week 5: Resume with increased loads"
        }


def adjust_plan_volume(plan: dict, wellness_data: dict = None, nutrition_data: dict = None) -> tuple:
    """
    Adjust sets/reps in an existing plan based on current wellness and nutrition.
    Does NOT change the exercises themselves, only the volume.
    
    Args:
        plan: Existing weekly plan dictionary
        wellness_data: Current wellness metrics
        nutrition_data: Current nutrition status
        
    Returns:
        Tuple of (adjusted_plan, adjustment_reason)
    """
    try:
        import copy
        adjusted_plan = copy.deepcopy(plan)
        adjustment_reason = "Volume maintained"
        
        # Determine adjustment factor based on wellness
        volume_multiplier = 1.0
        
        if wellness_data:
            readiness = wellness_data.get('readiness', 'Good')
            sleep_score = wellness_data.get('sleep_score', 70)
            stress = wellness_data.get('stress_level', 'Moderate')
            hrv = wellness_data.get('hrv', 'Normal')
            
            # Reduce volume if compromised
            if readiness == 'Compromised' or sleep_score < 50 or stress == 'High' or hrv == 'Low':
                volume_multiplier = 0.75
                adjustment_reason = "Volume reduced 25% due to low readiness/poor recovery"
            elif sleep_score < 65 or stress == 'Moderate':
                volume_multiplier = 0.9
                adjustment_reason = "Volume reduced 10% for recovery optimization"
            elif sleep_score >= 85 and readiness == 'Good' and hrv == 'High':  # Fixed: >= instead of >
                volume_multiplier = 1.1
                adjustment_reason = "Volume increased 10% - excellent recovery status"
        
        # Apply adjustments to all exercises
        if 'weekly_schedule' in adjusted_plan:
            for day in adjusted_plan['weekly_schedule']:
                if 'exercises' in day:
                    for exercise in day['exercises']:
                        # Adjust sets (round to nearest integer, min 1)
                        original_sets = exercise.get('sets', 3)
                        exercise['sets'] = max(1, round(original_sets * volume_multiplier))
                        
                        # Optionally adjust reps slightly (for high/low volume days)
                        if volume_multiplier < 0.9:
                            # If reducing volume significantly, keep reps the same or increase slightly
                            pass
                        elif volume_multiplier > 1.05:
                            # If increasing volume, might reduce reps slightly
                            original_reps = exercise.get('reps', 10)
                            exercise['reps'] = max(5, round(original_reps * 0.95))
        
        print(f"📊 Volume adjusted: {volume_multiplier}x - {adjustment_reason}")
        return adjusted_plan, adjustment_reason
        
    except Exception as e:
        print(f"❌ Error adjusting volume: {e}")
        return plan, "No adjustments applied (error)"


@app.post("/api/profile/save")
async def save_user_profile(request: UserProfileRequest):
    """Save user's fitness profile (calories, cutting/bulking) to Pinecone."""
    try:
        from tools.memory_store import save_agent_memory
        
        profile_text = f"User profile: {request.calories} calories/day, phase: {request.phase}, protein target: {request.protein_target}g. Notes: {request.notes}"
        
        log_id = save_agent_memory(
            agent_type="user_profile",
            content=profile_text,
            metadata={
                "type": "user_profile",
                "calories": request.calories,
                "phase": request.phase,
                "protein_target": request.protein_target,
                "notes": request.notes
            }
        )
        
        print(f"✅ Saved user profile: {request.calories} cal, {request.phase}")
        
        return {
            "status": "success",
            "message": f"Profile saved! Calories: {request.calories}, Phase: {request.phase}",
            "log_id": log_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/profile")
async def get_profile(user_id: str):
    """Get the current user profile."""
    profile = get_user_profile(user_id=user_id)
    if profile:
        return {"status": "success", "profile": profile}
    return {"status": "not_found", "profile": None}


@app.get("/api/dashboard/metrics")
async def get_dashboard_metrics(user_id: str):
    """
    Fetch dashboard metrics from Pinecone (parallelized for performance).
    Returns wellness data, user profile, and recent agent activity logs.
    """
    import asyncio
    
    try:
        from tools.memory_store import get_wellness_memory, get_exercise_memory, get_nutrition_memory
        
        # Parallelize all Pinecone queries using asyncio.gather
        wellness_task = asyncio.to_thread(get_wellness_memory, query="recent wellness readiness biometrics", top_k=1, user_id=user_id)
        profile_task = asyncio.to_thread(get_user_profile, user_id=user_id)
        exercise_task = asyncio.to_thread(get_exercise_memory, query="recent workout session", top_k=2, user_id=user_id)
        nutrition_task = asyncio.to_thread(get_nutrition_memory, query="recent meal plan", top_k=2, user_id=user_id)
        
        # Execute all queries in parallel
        wellness_logs, user_profile, exercise_logs, nutrition_logs = await asyncio.gather(
            wellness_task, profile_task, exercise_task, nutrition_task
        )
        
        # 1. Process wellness data
        wellness_data = None
        has_wellness_data = wellness_logs and len(wellness_logs) > 0
        
        if has_wellness_data:
            latest = wellness_logs[0]
            wellness_data = {
                "sleep_hours": latest.get("sleep_hours", 7.0),
                "hrv": latest.get("hrv", 50),
                "rhr": latest.get("rhr", 65),
                "readiness_score": latest.get("readiness_score", 70),
                "stress_score": 50  # Will be calculated below
            }
            
            # Calculate stress score from RHR (inverse relationship: lower RHR = lower stress)
            rhr = latest.get("rhr", 65)
            if rhr <= 55:
                wellness_data["stress_score"] = 25  # Low stress
            elif rhr <= 65:
                wellness_data["stress_score"] = 45  # Moderate stress
            elif rhr <= 75:
                wellness_data["stress_score"] = 65  # Elevated stress
            else:
                wellness_data["stress_score"] = 80  # High stress
        else:
            print("⚠️ No wellness logs found for user", user_id)

        # 2. Process user profile
        user_data = {
            "name": "Dr. A. Sharma",
            "status": "Stable",
            "bmi": 22.4,
            "resting_hr": wellness_data["rhr"] if wellness_data else 65,
            "phase": "maintenance",
            "calories": 2000
        }
        
        if user_profile:
            user_data["phase"] = user_profile.get("phase", "maintenance")
            user_data["calories"] = user_profile.get("calories", 2000)
        
        # 3. Process agent logs
        agent_logs = []
        
        # Add trainer logs
        if exercise_logs:
            for log in exercise_logs[:1]:  # Latest only
                issues = log.get("issues", [])
                if issues:
                    agent_logs.append({
                        "type": "trainer",
                        "message": f"Form issue detected: {', '.join(issues[:2])}",
                        "severity": "warning"
                    })
                else:
                    agent_logs.append({
                        "type": "trainer",
                        "message": f"Training load adjustment in progress ({log.get('reps', 0)} reps logged)",
                        "severity": "info"
                    })
        
        # Add nutritionist logs
        if nutrition_logs:
            for log in nutrition_logs[:1]:
                agent_logs.append({
                    "type": "nutritionist",
                    "message": f"Reviewing dietary plan - {log.get('goal', 'General wellness')}",
                    "severity": "info"
                })
        
        # Add wellness log
        if has_wellness_data:
            readiness = wellness_data["readiness_score"]
            if readiness >= 80:
                agent_logs.append({
                    "type": "wellness",
                    "message": "Recovery status optimal - ready for training",
                    "severity": "success"
                })
            elif readiness >= 60:
                agent_logs.append({
                    "type": "wellness",
                    "message": "Moderate recovery - consider reduced intensity",
                    "severity": "info"
                })
            else:
                agent_logs.append({
                    "type": "wellness",
                    "message": "Low recovery detected - rest recommended",
                    "severity": "warning"
                })
        
        # Default logs if none available
        if not agent_logs:
            agent_logs = [
                {"type": "trainer", "message": "Training load adjustment in progress", "severity": "info"},
                {"type": "nutritionist", "message": "Reviewing dietary plan", "severity": "info"},
                {"type": "wellness", "message": "Monitoring biometric data", "severity": "info"}
            ]
        
        if wellness_data:
            print(f"📊 Dashboard metrics fetched: sleep={wellness_data['sleep_hours']}h, readiness={wellness_data['readiness_score']}")
        else:
            print(f"📊 Dashboard metrics fetched: No wellness data available")
        
        return {
            "status": "success",
            "wellness": wellness_data,  # Will be None if no data
            "user": user_data,
            "agent_logs": agent_logs
        }
        
    except Exception as e:
        print(f"❌ Error fetching dashboard metrics: {e}")
        # Return reasonable defaults on error
        return {
            "status": "error",
            "message": str(e),
            "wellness": {
                "sleep_hours": 7.0,
                "stress_score": 50,
                "readiness_score": 70,
                "hrv": 50,
                "rhr": 65
            },
            "user": {
                "name": "Dr. A. Sharma",
                "status": "Stable",
                "bmi": 22.4,
                "resting_hr": 65,
                "phase": "maintenance",
                "calories": 2000
            },
            "agent_logs": [
                {"type": "trainer", "message": "Training load adjustment in progress", "severity": "info"},
                {"type": "nutritionist", "message": "Reviewing dietary plan", "severity": "info"},
                {"type": "wellness", "message": "Monitoring biometric data", "severity": "info"}
            ]
        }


@app.post("/api/wellness/analyze")
async def analyze_wellness_data(request: WellnessRequest):
    """
    Analyze biometric data (sleep, HRV, RHR) using Gemini-powered wellness brain.
    Saves analysis to Pinecone for cross-agent memory sharing.
    """
    try:
        from tools.memory_store import save_agent_memory
        import time
        
        # Prepare data dict for analysis
        wellness_data = {
            "sleep_hours": request.sleep_hours,
            "hrv": request.hrv,
            "rhr": request.rhr
        }
        
        print(f"🧠 Analyzing wellness data: Sleep={request.sleep_hours}h, HRV={request.hrv}, RHR={request.rhr}")
        
        # Run analysis using wellness brain
        analysis = analyze_wellness(wellness_data)
        
        # Save to shared Pinecone memory
        text_content = f"""
        Wellness Analysis for {request.user_id} on {request.date or time.strftime('%Y-%m-%d')}:
        Executive Summary: {analysis.get('executive_summary')}
        Readiness Score: {analysis.get('readiness_score')}/100
        Micro-Intervention: {analysis.get('micro_intervention')}
        Training Protocol: {analysis.get('training_protocol')}
        Cognitive Framing: {analysis.get('cognitive_framing')}
        Nutritional Strategy: {analysis.get('nutritional_strategy')}
        """
        
        log_id = save_agent_memory(
            agent_type="wellness",
            content=text_content,
            metadata={
                "type": "wellness",
                "user_id": request.user_id,
                "sleep_hours": request.sleep_hours,
                "hrv": request.hrv,
                "rhr": request.rhr,
                "readiness_score": analysis.get('readiness_score', 0),
                "executive_summary": analysis.get('executive_summary', '')[:500]
            }
        )
        
        print(f"✅ Wellness analysis saved: {log_id}")
        
        return {
            "status": "success",
            "log_id": log_id,
            "analysis": analysis
        }
        
    except Exception as e:
        print(f"❌ Wellness analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/trainer/weekly-plan")
async def get_weekly_training_plan(request: WeeklyPlanRequest):
    """
    Generate or retrieve weekly training plan with intelligent caching.
    
    Logic:
    1. Check for existing plan in Pinecone
    2. If plan exists and is < 5 weeks old AND no injuries detected:
       - Return cached plan with volume adjusted for current wellness/nutrition
    3. If no plan, plan expired, or injury detected:
       - Generate new plan using AI
       - Save to Pinecone
    4. If force_regenerate is True, skip cache and generate new plan
    """
    try:
        from tools.memory_store import get_training_plan_memory, save_training_plan
        import time
        from datetime import datetime, timedelta
        
        print(f"🏋️ Weekly plan request for user {request.user_id}, force_regenerate={request.force_regenerate}")
        
        # Fetch user profile and wellness data for context
        user_profile = get_user_profile(user_id=request.user_id)
        wellness_data = get_wellness_data(user_id=request.user_id)
        
        # Check for existing plan
        cached_plan = get_training_plan_memory(user_id=request.user_id)
        
        should_use_cache = False
        plan_status = "new"
        
        if cached_plan and not request.force_regenerate:
            # Validate cache
            if is_plan_valid(cached_plan):
                should_use_cache = True
                plan_status = "cached"
                print(f"✅ Using cached plan from {cached_plan.get('created_date')}")
            else:
                print(f"⚠️ Cached plan invalid, generating new plan")
        
        # Generate or retrieve plan
        if should_use_cache:
            # Parse cached plan data
            try:
                plan_json = extract_json(cached_plan.get('plan_data', '{}'))
                if not plan_json:
                    raise ValueError("Failed to parse cached plan")
                
                # Adjust volume based on current wellness/nutrition
                adjusted_plan, adjustment_reason = adjust_plan_volume(
                    plan_json, 
                    wellness_data=wellness_data,
                    nutrition_data=user_profile
                )
                
                # Calculate expiration info
                created_timestamp = cached_plan.get('created_timestamp', int(time.time()))
                age_days = (int(time.time()) - created_timestamp) / (60 * 60 * 24)
                weeks_remaining = max(0, round((35 - age_days) / 7, 1))
                expires_date = datetime.fromtimestamp(created_timestamp + (35 * 24 * 60 * 60)).strftime('%Y-%m-%d')
                
                return {
                    "status": plan_status,
                    "plan": {
                        "created_date": cached_plan.get('created_date'),
                        "expires_date": expires_date,
                        "weeks_remaining": weeks_remaining,
                        "weekly_schedule": adjusted_plan.get('weekly_schedule', []),
                        "program_notes": adjusted_plan.get('program_notes', ''),
                        "progression_strategy": adjusted_plan.get('progression_strategy', '')
                    },
                    "adjustment_reason": adjustment_reason,
                    "log_id": cached_plan.get('id')
                }
                
            except Exception as e:
                print(f"❌ Error using cached plan: {e}, generating new")
                should_use_cache = False
        
        # Generate new plan
        if not should_use_cache:
            print(f"🤖 Generating new weekly plan using AI...")
            
            # Check if injury was detected (for metadata)
            injury_detected = detect_injury_from_history(request.user_id)
            
            # Generate plan with AI
            new_plan = generate_weekly_training_plan(
                user_profile=user_profile,
                wellness_data=wellness_data,
                nutrition_data=None
            )
            
            # Save to Pinecone
            exercises = []
            if 'weekly_schedule' in new_plan:
                for day in new_plan['weekly_schedule']:
                    if 'exercises' in day:
                        exercises.extend([ex.get('name', '') for ex in day['exercises']])
            
            plan_data_str = json.dumps(new_plan)
            log_id = save_training_plan(
                user_id=request.user_id,
                plan_data=plan_data_str,
                exercises=exercises,
                injury_detected=injury_detected
            )
            
            # Calculate dates
            created_date = time.strftime('%Y-%m-%d')
            expires_date = (datetime.now() + timedelta(days=35)).strftime('%Y-%m-%d')
            
            return {
                "status": "new",
                "plan": {
                    "created_date": created_date,
                    "expires_date": expires_date,
                    "weeks_remaining": 5.0,
                    "weekly_schedule": new_plan.get('weekly_schedule', []),
                    "program_notes": new_plan.get('program_notes', ''),
                    "progression_strategy": new_plan.get('progression_strategy', '')
                },
                "adjustment_reason": "New plan generated" + (" (injury recovery focus)" if injury_detected else ""),
                "log_id": log_id
            }
        
    except Exception as e:
        print(f"❌ Weekly plan error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate weekly plan: {str(e)}")


@app.post("/api/nutrition/start")
async def start_nutrition_session(request: NutritionRequest):
    goal = request.goal
    diet_type = request.diet_type
    budget = request.budget
    wellness_data = request.wellness_data
    fitness_coach_plan = request.fitness_coach_plan
    
    # Check if Groq API key is set
    if not os.environ.get("GROQ_API_KEY"):
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not found.")

    try:
        print(f"Starting Nutritionist Agent (Groq) for goal: {goal}, diet: {diet_type}, budget: {budget}...")
        
        # Initialize data loader and retriever with CORRECT PATHS (backend/data)
        data_dir = os.path.join(os.path.dirname(__file__), "data")
        csv_path = os.path.join(data_dir, "Indian_Food_Nutrition_Processed.csv")
        json_path = os.path.join(data_dir, "indian_gym_friendly_nutrition_rag_dataset_TOP_NOTCH_v5.1.json")
        
        # Load Data
        data_loader = FoodDataLoader(csv_path, json_path)
        retriever = DietRetriever(data_loader.get_data())
        
        # Initialize Agent
        nutri_agent = NutritionistAgent(data_loader, retriever)

        # Build user profile for the agent
        user_profile = {
            "name": "User",
            "goal": goal,
            "diet_type": diet_type,
            "budget": budget
        }
        
        # Generate the meal plan using Groq
        result_text = nutri_agent.generate_plan(user_profile, wellness_data, fitness_coach_plan)

        return {
            "status": "success", 
            "result": result_text
        }

    except Exception as e:
        print(f"Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/timeline")
async def get_timeline():
    """
    Fetch consolidated timeline logs from all agents via Pinecone memory.
    """
    try:
        from backend.tools.memory_store import get_exercise_memory, get_nutrition_memory, get_wellness_memory
        # Fetch recent logs from each agent category
        trainer_logs = get_exercise_memory(query="", top_k=5)
        nutrition_logs = get_nutrition_memory(query="", top_k=5)
        wellness_logs = get_wellness_memory(query="", top_k=5)
        
        timeline_events = []
        
        # Process Trainer Logs
        for log in trainer_logs:
            timeline_events.append({
                "id": log.get("id"),
                "agent": "Physical Trainer",
                "action": f"Completed {log.get('exercise', 'Workout')} - {log.get('reps', 0)} reps. Rating: {log.get('rating', '?')}/10",
                "timestamp": log.get("date", "Today"),
                "type": "success" if log.get("rating", 0) > 7 else "warning"
            })
            
        # Process Nutrition Logs
        for log in nutrition_logs:
            timeline_events.append({
                "id": log.get("id"),
                "agent": "Nutritionist",
                "action": f"Generated {log.get('diet_type', '')} meal plan for {log.get('goal', '')}",
                "timestamp": log.get("date", "Today"),
                "type": "info"
            })
            
        # Process Wellness Logs
        for log in wellness_logs:
            score = log.get("readiness_score", 0)
            timeline_events.append({
                "id": log.get("id"),
                "agent": "Wellness Coach",
                "action": f"Wellness Check: Readiness {score}/100. HRV: {log.get('hrv', '?')}ms",
                "timestamp": log.get("date", "Today"),
                "type": "critical" if score < 40 else "success" if score > 80 else "info"
            })
            
        # Mock Manager Event (if empty) to show something
        if not timeline_events:
             timeline_events.append({
                "id": "mock_init",
                "agent": "Manager",
                "action": "System initialized. Waiting for agent activity...",
                "timestamp": "Now",
                "type": "info"
            })
            
        return {"logs": timeline_events}
        
    except Exception as e:
        print(f"Timeline Error: {e}")
        return {"logs": []}

@app.post("/api/trainer/start")
def start_training_session(request: SessionRequest):
    exercise_choice = request.exercise_type
    user_id = request.user_id
    
    # Check if API keys are set
    api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY or GOOGLE_API_KEY not found in environment variables.")

    if not os.environ.get("PINECONE_API_KEY"):
        raise HTTPException(status_code=500, detail="PINECONE_API_KEY not found in environment variables.")

    # reset stop signal
    session_state.clear_stop_signal()
        
    try:
        # 1. Initialize Agents & Tasks
        print(f"🚀 Starting session for {exercise_choice}...")
        print(f"📋 API Key found: {'Yes' if api_key else 'No'}")
        
        try:
            pt_agent_manager = PhysicalTrainerAgent()
            print("✅ PhysicalTrainerAgent instantiated")
        except Exception as e:
            print(f"❌ Failed to create PhysicalTrainerAgent: {e}")
            raise HTTPException(status_code=500, detail=f"Agent creation failed: {e}")
            
        try:
            pt_tasks_manager = PhysicalTrainerTasks()
            print("✅ PhysicalTrainerTasks instantiated")
        except Exception as e:
            print(f"❌ Failed to create PhysicalTrainerTasks: {e}")
            raise HTTPException(status_code=500, detail=f"Task creation failed: {e}")

        try:
            pt_agent = pt_agent_manager.create()
            print("✅ Agent created successfully")
        except Exception as e:
            print(f"❌ Failed to call create(): {e}")
            raise HTTPException(status_code=500, detail=f"Agent.create() failed: {e}")
            
        task = pt_tasks_manager.technical_workout_task(pt_agent, exercise_choice)
        print("✅ Task created successfully")

        crew = Crew(
            agents=[pt_agent],
            tasks=[task],
            process=Process.sequential,
            verbose=True
        )

        # Kickoff the crew (This blocks until the CV window is closed by the user pressing 'q')
        result_obj = crew.kickoff()
        result_text = str(result_obj)

        # 2. Parse JSON Output
        data = {}
        try:
            
            # Extract fields
            data = extract_json(result_text) or {}
            
            if not data:
                raise ValueError("No JSON found in agent output")

            total_reps = data.get("total_reps", 0)
            detected_issues = data.get("detected_issues", [])
            summary = data.get("summary", result_text)
            recommendations = data.get("recommendations", "")
            form_rating = data.get("form_rating", 0)
            
            # Save to Pinecone via Memory Store
            from backend.tools.memory_store import save_agent_memory
            
            # Create a rich text representation for the memory
            memory_text = f"Completed {exercise_choice} session. Total Reps: {total_reps}. Rating: {form_rating}/10. Issues: {', '.join(detected_issues)}. Summary: {summary}"
            
            log_id = save_agent_memory(
                agent_type="physical_trainer",
                content=memory_text,
                metadata={
                    "type": "exercise_log",
                    "user_id": user_id,
                    "exercise": exercise_choice,
                    "reps": total_reps, 
                    "rating": form_rating,
                    "issues": detected_issues
                }
            )
            
            return {
                "status": "success",
                "plan": result_text,
                "detected_issues": detected_issues,
                "total_reps": total_reps,
                "save_status": "success",
                "log_id": log_id
            }

            
        except (json.JSONDecodeError, ValueError):
            print("⚠️ Warning: Agent output was not valid JSON. Falling back to text parsing.")
            print(f"📝 Agent output preview: {result_text[:500]}...")  # Debug: show first 500 chars
            summary = result_text
            total_reps = 0
            detected_issues = []
            recommendations = ""
            form_rating = 5  # Default to neutral rating
            
            # Improved regex for finding reps in various formats:
            # - "TOTAL REPS: 5" (from squat/pushup tool)
            # - "performed 5 squats" (from agent prose)
            # - "You completed 4 pushups"
            reps_patterns = [
                r"TOTAL REPS:\s*(\d+)",                                   # Tool output format
                r"performed\s+(\d+)\s+(squats?|pushups?|reps?)",          # "performed 5 squats"
                r"completed\s+\*?\*?(\d+)\s*\*?\*?\s*(squats?|pushups?|reps?)",  # "completed **5 squats**" or "completed 5 squats"
                r"You\s+(?:did|performed|completed)\s+(\d+)",             # "You performed 5"
                r"(\d+)\s+(squats?|pushups?)\s+with",                     # "5 squats with excellent form"
                r"(\d+)\s+reps?\s+completed",                             # "5 reps completed"
                r"completed\s+(\d+)\s+reps?",                             # "completed 5 reps"
                r"Rep\s*count:\s*(\d+)",                                  # "Rep count: 5"
                r"(\d+)\s+total\s+reps?",                                 # "5 total reps"
                r"did\s+(\d+)\s+(squats?|pushups?|reps?)",                # "did 5 squats"
            ]
            
            for pattern in reps_patterns:
                reps_match = re.search(pattern, result_text, re.IGNORECASE)
                if reps_match:
                    total_reps = int(reps_match.group(1))
                    print(f"📊 Extracted reps: {total_reps} (pattern: {pattern})")
                    break
            
            # Check for common issues in the text
            if "valgus" in result_text.lower(): detected_issues.append("knee_valgus")
            if "sag" in result_text.lower() or "sagging" in result_text.lower(): detected_issues.append("hip_sag")
            if "shallow" in result_text.lower(): detected_issues.append("shallow_depth")
            if "lean" in result_text.lower() or "forward lean" in result_text.lower(): detected_issues.append("forward_lean")
            
            # Simple form rating heuristic
            if "good" in result_text.lower() and ("form" in result_text.lower() or "depth" in result_text.lower()):
                form_rating = 8
            if len(detected_issues) > 0:
                form_rating = max(3, 7 - len(detected_issues))

        # 4. Save Session Log to Pinecone
        save_status = "skipped"
        save_error = None
        log_id = "" # Initialize log_id
        
        try:
            print("... Saving session log to Pinecone Cloud ...")
            pc = Pinecone(api_key=os.environ["PINECONE_API_KEY"])
            index = pc.Index(os.environ["PINECONE_INDEX_NAME"])
            
            embeddings = GoogleGenerativeAIEmbeddings(
                model="models/text-embedding-004",
                google_api_key=api_key
            )
            
            # Create a log entry
            timestamp = int(time.time())
            log_id = f"log_{timestamp}"
            
            # Structured Metadata
            metadata = {
                "agent_type": "trainer",  # For cross-agent memory filtering
                "text": summary, # Used for RAG retrieval
                "exercise": exercise_choice,
                "reps": total_reps,
                "issues": detected_issues, # List[str] supported by Pinecone
                "rating": form_rating,
                "date": time.strftime('%Y-%m-%d'),
                "raw_json": json.dumps(data) # Store full object for later retrieval if needed
            }
            
            vector_values = embeddings.embed_query(summary)
            
            index.upsert(vectors=[{
                "id": log_id,
                "values": vector_values,
                "metadata": metadata
            }])
            print(f"✅ Successfully saved log {log_id} to Pinecone.")
            save_status = "success"
            
        except Exception as db_err:
            print(f"⚠️ Warning: Failed to save log to Pinecone: {str(db_err)}")
            save_status = "failed"
            save_error = str(db_err)

        # Prepare normalized data for chat wrapper
        trainer_output_normalized = {
            "summary": summary,
            "detected_issues": detected_issues,
            "recommendations": recommendations,
            "total_reps": total_reps,
            "form_rating": form_rating
        }

        # Generate chat object
        chat_response = format_trainer_chat_response(trainer_output_normalized, log_id)

        # Original log object (kept for backward compatibility and "log" field)
        log_response = {
            "status": "success", 
            "plan": summary, # Frontend expects 'plan' as the main text
            "detected_issues": detected_issues,
            "total_reps": total_reps,
            "form_rating": form_rating,
            "recommendations": recommendations,
            "save_status": save_status,
            "save_error": save_error
        }

        # Return hybrid response: Root fields for backward compatibility, + log/chat objects
        return {
            **log_response,
            "log": log_response,
            "chat": chat_response
        }

    except Exception as e:
        print(f"Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/scan")
async def scan_food(file: UploadFile = File(...)):
    """
    Endpoint for the NutriScan Image feature.
    """
    try:
        contents = await file.read()
        
        # Fetch user profile from Pinecone
        base_profile = get_user_profile() or {"diet_type": "Vegetarian", "goal": "Health", "allergens": []}
        
        # Fetch wellness data from Pinecone (stored by wellness agent)
        wellness_data = get_wellness_data()
        
        # Combine profile with wellness data for more personalized analysis
        user_profile = {
            **base_profile,
            "sleep_score": wellness_data.get("sleep_score", 70),
            "stress_level": wellness_data.get("stress_level", "Moderate"),
            "hrv": wellness_data.get("hrv", "Normal"),
            "readiness": wellness_data.get("readiness", "Good"),
        }
        
        print(f"📋 NutriScan using profile: {user_profile}")
        
        # Call the function from your uploaded scanner.py
        analysis = analyze_food_image(contents, user_profile)
        
        # [INTEGRATION] Save scan result to agent memory so Nutritionist can recall it
        try:
            from tools.memory_store import save_agent_memory
            
            # Create a summary string for the memory
            product_name = analysis.get('productName', 'Unknown Food')
            nutrition = analysis.get('nutrition', {})
            health_score = analysis.get('healthScore', 'N/A')
            
            memory_text = f"User scanned food: {product_name}. Health Score: {health_score}. Nutrition: {nutrition}. Analysis: {json.dumps(analysis)}"
            
            save_agent_memory(
                agent_type="nutritionist", # Save as nutritionist memory
                content=memory_text,
                metadata={
                    "type": "food_scan",
                    "product": product_name,
                    "score": health_score
                }
            )
            print(f"✅ Saved scanned food '{product_name}' to memory.")
        except Exception as mem_err:
            print(f"⚠️ Could not save scan to memory: {mem_err}")

        return analysis
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/timeline")
async def get_timeline():
    """
    Fetch recent decisions/actions from all agents for the Timeline View.
    """
    try:
        from tools.memory_store import get_recent_logs
        logs = get_recent_logs(limit=20)
        return {"logs": logs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/manager/conflicts")
async def get_manager_conflicts(user_id: str):
    """
    Generate Daily Briefing using Manager Agent orchestration.
    Coordinates wellness, trainer, and nutritionist agents.
    """
    try:
        from backend.agents.manager_agent import generate_daily_briefing
        
        print(f"🎯 Manager Agent generating daily briefing for user: {user_id}")
        
        # Generate real briefing using agent orchestration
        briefing = generate_daily_briefing(user_id)
        
        # Transform to frontend format (conflicts view)
        if briefing.get('conflicts') and len(briefing['conflicts']) > 0:
            # If there are conflicts, show conflict resolution view
            sources = []
            
            # Wellness input
            wellness = briefing['wellness_assessment']
            sources.append({
                "agent": "Wellness Agent",
                "priority": "High" if wellness['readiness_score'] < 60 else "Medium",
                "recommendation": f"Readiness score: {wellness['readiness_score']}/100. Sleep: {wellness['sleep_hours']}h. Status: {wellness['state']}"
            })
            
            # Trainer input
            workout = briefing['workout_plan']
            sources.append({
                "agent": "Physical Trainer",
                "priority": "High",
                "recommendation": f"Recommends: {workout['workout']} ({workout['intensity']} intensity, {workout['duration']})"
            })
            
            # Build conflict resolution
            conflict = briefing['conflicts'][0]
            response = {
                "sources": sources,
                "resolution": {
                    "decision": f"Override: {workout['workout']}",
                    "reasoning": conflict['issue'] + ". " + conflict['resolution'],
                    "impact": [
                        f"Trainer: Adjusted to {workout['workout']}",
                        f"Nutrition: {briefing['nutrition_plan']['total_calories']} with {briefing['nutrition_plan']['protein']} protein",
                        f"Safety: {briefing['final_decision']['priority']}"
                    ]
                }
            }
        else:
            # No conflicts - show harmonious plan
            wellness = briefing['wellness_assessment']
            workout = briefing['workout_plan']
            nutrition = briefing['nutrition_plan']
            
            response = {
                "sources": [
                    {
                        "agent": "Wellness Agent",
                        "priority": "Medium",
                        "recommendation": f"Readiness: {wellness['readiness_score']}/100. {wellness['state']}"
                    },
                    {
                        "agent": "Physical Trainer",
                        "priority": "Medium",
                        "recommendation": f"{workout['workout']} - {workout['intensity']} intensity for {workout['duration']}"
                    },
                    {
                        "agent": "Nutritionist",
                        "priority": "Medium",
                        "recommendation": f"{nutrition['total_calories']} with {nutrition['protein']} protein"
                    }
                ],
                "resolution": {
                    "decision": "Unified Daily Plan",
                    "reasoning": f"All agents aligned. {workout['rationale']}",
                    "impact": [
                        f"Workout: {workout['workout']}",
                        f"Nutrition: {nutrition['total_calories']}",
                        f"Pre-workout: {nutrition.get('pre_workout', 'N/A')}",
                        f"Post-workout: {nutrition.get('post_workout', 'N/A')}"
                    ]
                }
            }
        
        print(f"✅ Daily briefing generated: {briefing['final_decision']['summary']}")
        return response
        
    except Exception as e:
        print(f"❌ Error generating daily briefing: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))



@app.post("/api/trainer/stop")
async def stop_training_session():
    """Signals the running trainer session to stop."""
    session_state.set_stop_signal()
    print("🛑 Stop signal sent to trainer session.")
    return {"status": "success", "message": "Stop signal sent"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
