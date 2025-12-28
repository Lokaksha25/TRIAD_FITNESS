from fastapi import FastAPI, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import os
import shutil

# --- Import New Tools ---
from data_loader import FoodDataLoader
from retrieval import DietRetriever
from scanner import analyze_food_image  # Import the image scanner function

# --- Import Brain Logic ---
from brain import (
    plan_agent_execution, 
    run_nutritionist, 
    run_trainer, 
    run_wellness, 
    run_manager_synthesis
)

app = FastAPI()

# --- INITIALIZE NUTRISCAN DATA ---
# Ensure these files exist in your 'data' folder
CSV_PATH = "data/Indian_Food_Nutrition_Processed.csv"
JSON_PATH = "data/indian_food_rag_dataset_delivery_pricing.json"

print("⏳ Initializing NutriScan Database...")
try:
    data_loader = FoodDataLoader(CSV_PATH, JSON_PATH)
    diet_retriever = DietRetriever(data_loader.get_data())
    print("✅ NutriScan Data Loaded.")
except Exception as e:
    print(f"❌ NutriScan Load Failed: {e}")
    diet_retriever = None

# --- MODELS ---
class ChatRequest(BaseModel):
    message: str
    user_id: Optional[str] = "user_default"

class AgentResponseModel(BaseModel):
    agentType: str
    content: str
    summary: str

class ChatResponse(BaseModel):
    agents: List[AgentResponseModel]
    manager_decision: str

@app.get("/")
def home():
    return {"status": "active", "message": "Multi-Agent System + NutriScan Ready"}

# --- CHAT ENDPOINT (Orchestrator) ---
@app.post("/api/chat", response_model=ChatResponse)
async def chat_handler(request: ChatRequest):
    user_query = request.message
    print(f"📩 Query: {user_query}")

    # 1. Manager Plans: Which agents do we need?
    required_agents = plan_agent_execution(user_query)
    print(f"📋 Agents Selected: {required_agents}")

    agent_results = []

    # 2. Execute Selected Agents
    
    # -> Nutritionist
    if "Nutritionist" in required_agents or "food" in user_query.lower() or "diet" in user_query.lower():
        if diet_retriever:
            print("🍎 Calling Nutritionist...")
            nutri_res = run_nutritionist(user_query, diet_retriever)
            agent_results.append({
                "agentType": "Nutritionist",
                "content": nutri_res["content"],
                "summary": nutri_res["summary"]
            })
        else:
            agent_results.append({
                "agentType": "Nutritionist",
                "content": "Database unavailable.",
                "summary": "Error"
            })

    # -> Physical Trainer
    if "Physical Trainer" in required_agents or "workout" in user_query.lower():
        print("💪 Calling Trainer...")
        trainer_res = run_trainer(user_query)
        agent_results.append({
            "agentType": "Physical Trainer",
            "content": trainer_res["content"],
            "summary": trainer_res["summary"]
        })

    # -> Wellness Coach
    if "Wellness Coach" in required_agents or "sleep" in user_query.lower():
        print("🧘 Calling Wellness Coach...")
        well_res = run_wellness(user_query)
        agent_results.append({
            "agentType": "Wellness Coach",
            "content": well_res["content"],
            "summary": well_res["summary"]
        })

    # Fallback if no specific agent was selected
    if not agent_results:
        well_res = run_wellness(user_query)
        agent_results.append({"agentType": "Wellness Coach", "content": well_res["content"], "summary": "General Advice"})

    # 3. Manager Synthesis
    print("🛡️ Manager Synthesizing...")
    final_decision = run_manager_synthesis(user_query, agent_results)

    return {
        "agents": agent_results,
        "manager_decision": final_decision
    }

# --- SCANNER ENDPOINT (Image Analysis) ---
@app.post("/api/scan")
async def scan_food(file: UploadFile = File(...)):
    """
    Endpoint for the NutriScan Image feature.
    """
    try:
        contents = await file.read()
        
        # Mock User Profile for scanning context
        user_profile = {"diet_type": "Vegetarian", "goal": "Health", "allergens": []}
        
        # Call the function from your uploaded scanner.py
        analysis = analyze_food_image(contents, user_profile)
        
        return analysis
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))