"""
Wellness Brain Module - Biometric Analysis Engine

This module integrates the fitness_agent brain logic into the backend,
enabling the Wellness Coach agent to provide AI-powered biometric analysis
based on sleep, HRV, and resting heart rate data.

Adapted from: fitness_agent/brain.py
"""

import os
import json
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv(dotenv_path='../.env.local')
load_dotenv()

# Add backend directory to path so we can import tools
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../..")))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))


# Get API key from environment (support both GOOGLE_API_KEY and GEMINI_API_KEY)
api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)


def analyze_wellness(data: dict) -> dict:
    """
    Analyze biometric data and generate personalized wellness recommendations.
    
    Args:
        data: Dictionary containing:
            - sleep_hours (float): Hours of sleep
            - hrv (int): Heart Rate Variability in ms
            - rhr (int): Resting Heart Rate in bpm
            
    Returns:
        Dictionary with wellness analysis including readiness score,
        interventions, and recommendations.
    """
    # Use the stable model
    model = genai.GenerativeModel('gemini-2.0-flash-exp')
    
    # Extract data with defaults
    sleep_hours = data.get('sleep_hours', 7)
    hrv = data.get('hrv', 50)
    rhr = data.get('rhr', 65)
    
    # --- PROMPT ENGINEERING: CHAIN OF THOUGHT & PERSONA ---
    prompt = f"""
    ROLE:
    You are an Elite Human Performance Architect (Psychology + Physiology). 
    Your client is a high-performer (athlete/founder). Your job is to optimize their day based on biometrics.

    DATA INPUT:
    - Sleep Duration: {sleep_hours} hours
    - HRV (Heart Rate Variability): {hrv} ms (Higher is better, indicative of recovery)
    - Resting Heart Rate (RHR): {rhr} bpm (Lower is better)

    ANALYSIS INSTRUCTIONS:
    1. **Correlate the metrics**: 
       - Low Sleep + Low HRV = Acute Fatigue (Needs rest).
       - High Sleep + Low HRV = Potential Sickness or Maladaptation (Needs immune support).
       - High Sleep + High HRV = Prime State (Push limits).
    2. **Prioritize Mental State**: If HRV is low, the nervous system is stressed. Prescribe mental regulation tools (breathwork, nature exposure) over physical intensity.

    OUTPUT FORMAT (Strict JSON, no markdown):
    {{
      "executive_summary": "One punchy sentence describing their current biological state (e.g., 'Sympathetic Overdrive detected' or 'Prime Physiological Readiness').",
      "readiness_score": (integer 0-100),
      "micro_intervention": "A specific, immediate 2-minute bio-hack to shift state (e.g., 'View morning sunlight', 'Box breathing', 'Cold water face splash').",
      "training_protocol": "Precise workout instruction using terms like 'Zone 2 Cardio', 'CNS Priming', or 'Active Recovery'.",
      "cognitive_framing": "A psychological anchor, stoic quote, or mental model to handle the day's stress.",
      "nutritional_strategy": "Specific dietary focus (e.g., 'High antioxidants', 'Complex carbs for cortisol management', 'Fasted morning')."
    }}
    """
    
    try:
        response = model.generate_content(prompt)
        clean_text = response.text.replace("```json", "").replace("```", "").strip()
        return json.loads(clean_text)
    except Exception as e:
        print(f"Error generating wellness content: {e}")
        # Robust Fallback for Demo Safety
        return {
            "executive_summary": "Data processing error, assuming baseline recovery.",
            "readiness_score": 70,
            "micro_intervention": "Take 5 deep breaths.",
            "training_protocol": "Maintenance volume training.",
            "cognitive_framing": "Focus on what you can control.",
            "nutritional_strategy": "Eat whole foods."
        }


def generate_wellness_chat_response(user_message: str, wellness_data: dict = None, user_profile: dict = None, user_id: str = "user_123") -> dict:
    """
    Generate a wellness coach chat response using AI.
    
    Args:
        user_message: The user's message/question
        wellness_data: Optional biometric data for context
        user_profile: Optional user profile (calories, phase, etc.)
        
    Returns:
        Dict with agentType, content, and summary
    """
    try:
        from groq import Groq
        from backend.tools.memory_store import get_wellness_memory, format_wellness_context
        
        # Fetch wellness context from Pinecone
        wellness_memories = get_wellness_memory(query=user_message, top_k=3, user_id=user_id)
        context = format_wellness_context(wellness_memories) if wellness_memories else "No recent wellness data available."
        
        # Build biometric context if available
        biometric_context = ""
        if wellness_data:
            biometric_context = f"\n**Current Biometrics:**\n- Sleep: {wellness_data.get('sleep_hours', 'N/A')} hours\n- HRV: {wellness_data.get('hrv', 'N/A')} ms\n- RHR: {wellness_data.get('rhr', 'N/A')} bpm\n"
        
        # Build user profile context
        profile_context = ""
        if user_profile:
            profile_context = f"\n**User Profile:**\n- Daily Calories: {user_profile.get('calories', 'Not set')} kcal\n- Phase: {user_profile.get('phase', 'Not set')}\n"
        
        client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        
        system_prompt = """You are an expert Wellness Coach AI assistant specializing in recovery, stress management, and biometric optimization.

Based on the user's message, biometric history, and wellness data, provide:
1. A brief analysis of their current wellness/recovery status
2. Specific recommendations for stress management, sleep, or recovery

Keep responses concise (2-3 sentences for summary, 1-2 for recommendation).
Format your response as JSON with keys: "summary" (string), "recommendation" (string)"""

        user_prompt = f"""User says: "{user_message}"
{biometric_context}
{profile_context}
**Wellness History from Memory:**
{context}

Provide your analysis as the Wellness Coach."""

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
        # Try to parse as JSON
        try:
            # Find JSON object boundaries
            start = result.find('{')
            end = result.rfind('}') + 1
            if start != -1 and end != -1:
                clean = result[start:end]
                data = json.loads(clean)
                return {
                    "agentType": "Wellness Coach",
                    "content": data.get("summary", result), # Use summary as main content
                    "summary": data.get("recommendation", "Prioritize recovery.")
                }
            else:
                raise ValueError("No JSON found")
        except Exception as e:
            # If parsing fails, just return the text but clean it up
            print(f"Wellness JSON Parse Error: {e}. Raw content: {result}")
            clean_text = result.replace("```json", "").replace("```", "").strip()
            return {
                "agentType": "Wellness Coach",
                "content": clean_text,
                "summary": "Wellness Check Logged"
            }
            
    except Exception as e:
        print(f"Wellness AI error: {e}")
        return {
            "agentType": "Wellness Coach",
            "content": "Unable to analyze wellness data at this time.",
            "summary": "Please check wellness connection."
        }
