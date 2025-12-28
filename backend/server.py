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

class ChatRequest(BaseModel):
    message: str

class NutritionRequest(BaseModel):
    goal: str
    diet_type: str = "Vegetarian"
    budget: int = 500
    wellness_data: dict = {}
    fitness_coach_plan: str = ""

class UserProfileRequest(BaseModel):
    """User fitness profile for personalized AI advice"""
    calories: int = 2000  # Daily calorie target
    phase: str = "maintenance"  # cutting, bulking, or maintenance
    protein_target: int = 150  # grams
    notes: str = ""  # Any additional context

class WellnessRequest(BaseModel):
    """Biometric data for wellness analysis"""
    user_id: str = "user_123"
    date: str = ""
    sleep_hours: float = 7.0
    hrv: int = 50  # Heart Rate Variability in ms
    rhr: int = 65  # Resting Heart Rate in bpm

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

def generate_trainer_chat_response(user_message: str, user_profile: dict = None) -> dict:
    """
    Generate a trainer response using AI based on Pinecone exercise memory.
    """
    try:
        # Fetch exercise context from Pinecone
        exercise_memories = get_exercise_memory(query=user_message, top_k=3)
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

def generate_nutritionist_chat_response(user_message: str, user_profile: dict = None) -> dict:
    """
    Generate a nutritionist response using AI based on Pinecone memory.
    """
    try:
        # Fetch both exercise and nutrition context
        exercise_memories = get_exercise_memory(query=user_message, top_k=2)
        nutrition_memories = get_nutrition_memory(query=user_message, top_k=2)
        
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
    user_profile = get_user_profile()
    if user_profile:
        print(f"📋 User profile loaded: {user_profile.get('calories')} cal, phase: {user_profile.get('phase')}")
    else:
        print("ℹ️ No user profile found, using defaults")
    
    # Generate responses from all agents in parallel-ish fashion
    agent_responses = []
    
    # 1. Physical Trainer (AI-powered with Pinecone context + user profile)
    try:
        trainer_response = generate_trainer_chat_response(request.message, user_profile)
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
        nutritionist_response = generate_nutritionist_chat_response(request.message, user_profile)
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
        wellness_response = generate_wellness_chat_response(request.message, user_profile=user_profile)
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

def get_user_profile() -> dict:
    """Fetch the latest user profile from Pinecone."""
    try:
        from tools.memory_store import _get_index, _get_embeddings
        
        index = _get_index()
        embeddings = _get_embeddings()
        
        # Query for user profile
        query_vector = embeddings.embed_query("user fitness profile calories cutting bulking")
        
        results = index.query(
            vector=query_vector,
            top_k=5,
            include_metadata=True
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

def get_wellness_data() -> dict:
    """Fetch the latest wellness data from Pinecone (stored by wellness agent)."""
    try:
        from tools.memory_store import _get_index, _get_embeddings
        
        index = _get_index()
        embeddings = _get_embeddings()
        
        # Query for wellness data
        query_vector = embeddings.embed_query("wellness health sleep stress HRV cortisol biometrics")
        
        results = index.query(
            vector=query_vector,
            top_k=3,
            include_metadata=True
        )
        
        wellness_data = {
            "sleep_score": 70,  # defaults
            "stress_level": "Moderate",
            "hrv": "Normal",
            "readiness": "Good"
        }
        
        # Find wellness type entries
        for match in results.get('matches', []):
            meta = match.get('metadata', {})
            text = meta.get('text', '').lower()
            
            # Extract sleep score
            if 'sleep' in text:
                import re
                sleep_match = re.search(r'sleep[:\s]*(\d+)', text, re.IGNORECASE)
                if sleep_match:
                    wellness_data["sleep_score"] = int(sleep_match.group(1))
            
            # Extract stress level
            if 'stress' in text.lower():
                if 'high' in text.lower():
                    wellness_data["stress_level"] = "High"
                elif 'low' in text.lower():
                    wellness_data["stress_level"] = "Low"
            
            # Extract HRV
            if 'hrv' in text.lower():
                if 'low' in text.lower():
                    wellness_data["hrv"] = "Low"
                    
            # Check readiness
            if 'compromised' in text.lower() or 'poor' in text.lower():
                wellness_data["readiness"] = "Compromised"
        
        print(f"📊 Fetched wellness data: {wellness_data}")
        return wellness_data
        
    except Exception as e:
        print(f"Error fetching wellness data: {e}")
        return {"sleep_score": 70, "stress_level": "Moderate", "hrv": "Normal", "readiness": "Good"}

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
async def get_profile():
    """Get the current user profile."""
    profile = get_user_profile()
    if profile:
        return {"status": "success", "profile": profile}
    return {"status": "not_found", "profile": None}

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
        json_path = os.path.join(data_dir, "indian_food_rag_dataset_delivery_pricing.json")
        
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
async def get_manager_conflicts():
    """
    Fetch active conflicts and resolutions from the Manager Agent.
    (Currently mocked/heuristic-based, but served from backend)
    """
    try:
        # In a real system, this would come from a dedicated Manager Agent analyzing the logs.
        # For now, we simulate a check based on recent memory.
        
        # Mock Response matching the frontend structure
        response = {
    "sources": [
        {
            "agent": "Physical Trainer",
            "priority": "High",
            "recommendation": "High Intensity Interval Training (HIIT) protocol recommended for max hypertrophy."
        },
        {
            "agent": "Wellness Manager",
            "priority": "High",
            "recommendation": "Sleep score critical (4.5h). Recommend cancelling high-intensity load to prevent injury."
        }
    ],
    "resolution": {
        "decision": "Override: Active Recovery Protocol",
        "reasoning": "Wellness data indicates critical fatigue state. High intensity workload poses 85% injury risk. Prioritizing CNS recovery.",
        "impact": [
            "Trainer Agent: Downgraded to 'Mobility Flow'",
            "Nutrition Agent: Added Magnesium-rich post-workout meal",
            "User Notification: Sleep schedule adjustment sent"
        ]
    }
}
        return response
    except Exception as e:
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
