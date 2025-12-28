import os
import json
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

# Configure Gemini
# Ensure GEMINI_API_KEY or GOOGLE_API_KEY is set in your .env
api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
genai.configure(api_key=api_key)

# Use the model version consistent with your scanner.py
MODEL_NAME = 'gemini-1.5-flash' 

def get_gemini_response(prompt, json_mode=False):
    model = genai.GenerativeModel(MODEL_NAME)
    generation_config = {"response_mime_type": "application/json"} if json_mode else {}
    
    try:
        response = model.generate_content(prompt, generation_config=generation_config)
        return response.text
    except Exception as e:
        print(f"Gemini Error: {e}")
        return "{}" if json_mode else "System is currently overloaded."

# --- 1. MANAGER (ROUTER) ---
def plan_agent_execution(user_query):
    """Decides which agents are needed based on the user's query."""
    prompt = f"""
    ROLE: You are the Manager of a holistic health team.
    USER QUERY: "{user_query}"
    
    AVAILABLE AGENTS:
    - Nutritionist: Food, diet, recipes, ingredients, meal plans, pricing.
    - Physical Trainer: Workouts, exercises, injuries, muscle gain logic.
    - Wellness Coach: Sleep, stress, motivation, mindset, lifestyle.

    TASK: Return a JSON list of the agents strictly required to answer this query.
    EXAMPLE: ["Nutritionist", "Wellness Coach"]
    OUTPUT (JSON ONLY):
    """
    try:
        response_text = get_gemini_response(prompt, json_mode=True)
        return json.loads(response_text)
    except:
        return ["Manager"] 

# --- 2. NUTRITIONIST AGENT (Integrates NutriScan Retrieval) ---
def extract_nutrition_params(user_query):
    """Extracts structured data for the DietRetriever."""
    prompt = f"""
    Extract search parameters from the query for a food database.
    Query: "{user_query}"
    
    Output JSON with these fields (use sensible defaults if not mentioned):
    - diet_type: "Vegetarian" or "Non-Vegetarian" (Default: "Vegetarian")
    - budget: integer in INR (Default: 500)
    - goal: "Muscle Gain", "Weight Loss", "General Health" (Default: "General Health")
    """
    try:
        res = get_gemini_response(prompt, json_mode=True)
        return json.loads(res)
    except:
        return {"diet_type": "Vegetarian", "budget": 500, "goal": "General Health"}

def run_nutritionist(user_query, diet_retriever):
    # 1. Extract Search Criteria
    criteria = extract_nutrition_params(user_query)
    
    # 2. Retrieve Data (NutriScan Logic)
    retrieved_items = diet_retriever.retrieve(criteria)
    
    if not retrieved_items:
        return {
            "content": f"I couldn't find meals within a ₹{criteria['budget']} budget for a {criteria['diet_type']} diet. Try increasing your budget!",
            "summary": "Constraint Unmet"
        }

    # 3. Generate Advice
    # Convert top 5 items to string context
    items_context = json.dumps(retrieved_items[:5], indent=2)
    
    prompt = f"""
    ROLE: Expert Indian Nutritionist.
    USER GOAL: {criteria['goal']}
    DIET: {criteria['diet_type']}
    BUDGET: ₹{criteria['budget']}
    
    AVAILABLE FOODS (From Database):
    {items_context}
    
    TASK: Recommend a meal plan using the database matches above. 
    - Mention the 'price_inr' and 'protein' content.
    - Explain WHY they fit the goal.
    - Keep it conversational.
    """
    content = get_gemini_response(prompt)
    
    return {
        "content": content,
        "summary": f"Found {len(retrieved_items)} options for {criteria['goal']}"
    }

# --- 3. PHYSICAL TRAINER ---
def run_trainer(user_query):
    prompt = f"""
    ROLE: Elite Strength & Conditioning Coach.
    QUERY: "{user_query}"
    
    Provide specific, actionable workout advice. Use terminology like 'Hypertrophy', 'Progressive Overload', or 'Active Recovery'.
    Keep it concise (under 100 words).
    """
    content = get_gemini_response(prompt)
    return {
        "content": content,
        "summary": "Workout Protocol Generated"
    }

# --- 4. WELLNESS COACH ---
def run_wellness(user_query):
    prompt = f"""
    ROLE: Holistic Wellness Coach (Sleep & Stress expert).
    QUERY: "{user_query}"
    
    Provide advice on mental state, sleep hygiene, or stress management.
    Keep it warm, empathetic, but scientific.
    """
    content = get_gemini_response(prompt)
    return {
        "content": content,
        "summary": "Wellness Strategy Generated"
    }

# --- 5. OVERALL MANAGER (SYNTHESIS) ---
def run_manager_synthesis(user_query, agent_responses):
    prompt = f"""
    ROLE: Lead Health Manager.
    USER QUERY: "{user_query}"
    
    TEAM REPORTS:
    {json.dumps(agent_responses, indent=2)}
    
    TASK: 
    1. Resolve any conflicts (e.g., if Trainer says "Push Hard" but Wellness says "Rest").
    2. Provide a final, cohesive recommendation to the user.
    3. Be authoritative but encouraging.
    """
    content = get_gemini_response(prompt)
    return content