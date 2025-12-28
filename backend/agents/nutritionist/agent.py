import os
import sys
import json
from groq import Groq
from dotenv import load_dotenv

# Add backend directory to path so we can import tools
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../..")))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from tools.memory_store import get_exercise_memory, save_agent_memory, format_exercise_context

load_dotenv()

class NutritionistAgent:
    def __init__(self, data_loader, retriever):
        self.client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        self.retriever = retriever
        self.data_loader = data_loader

    def generate_plan(self, user_profile, wellness_data, fitness_coach_plan=None):
        
        # 1. Fetch real exercise data from Pinecone (cross-agent memory)
        exercise_memories = get_exercise_memory(
            query=f"workout session for {user_profile.get('goal', 'general fitness')}",
            top_k=3
        )
        
        # Format exercise context from Pinecone data
        if exercise_memories:
            fitness_coach_plan = format_exercise_context(exercise_memories)
            print(f"✅ Retrieved {len(exercise_memories)} exercise records from Pinecone")
        else:
            # Fallback if no exercise data in Pinecone
            fitness_coach_plan = fitness_coach_plan or "No recent workout data available. Recommend balanced nutrition."
            print("ℹ️ No exercise data found in Pinecone, using fallback")
        
        # 2. Define Search Criteria based on inputs
        criteria = {
            "diet_type": user_profile.get("diet_type"),
            "budget": user_profile.get("budget"),
            "goal": user_profile.get("goal")
        }

        # 2. Retrieve Relevant Foods
        retrieved_items = self.retriever.retrieve(criteria)
        
        if not retrieved_items:
            return "⚠️ I couldn't find any foods matching your strict budget and diet constraints. Please increase the budget or switch diet types."

        # 3. Prepare Prompt for Llama-3-70b
        # We serialize the retrieved items into JSON string
        context_str = json.dumps(retrieved_items, indent=2)

        system_prompt = f"""You are an expert Indian Nutritionist Agent.

**Your Role:**
Analyze the user's goal, wellness data, and fitness plan to create ONE perfect meal using the 'AVAILABLE_FOODS'.

**STRICT DATA USAGE:**
- Use ONLY items from the provided 'AVAILABLE_FOODS' JSON.
- DO NOT invent dishes or prices.
- Combine 1 Main Dish + 1-2 Accompaniments to form a complete meal.
- Ensure the total cost is within ₹{criteria['budget']}.

**OUTPUT FORMAT:**
You must output a SINGLE VALID JSON object. Do not include any markdown formatting (like ```json).
The JSON must have this exact structure:

{{
  "intro": "Brief explanation of why this meal fits the goal/sleep/workout data...",
  "mainDish": {{
    "name": "Exact Name from Data",
    "price": 150,
    "description": "Why this main dish is chosen...",
    "type": "main"
  }},
  "accompaniments": [
    {{
      "name": "Exact Name from Data",
      "price": 30,
      "description": "Why this side...",
      "type": "accompaniment"
    }}
  ],
  "totalCost": 180,
  "nutrients": {{
    "protein": {{ "total": 25.5, "breakdown": "Paneer (18g), Roti (7.5g)" }},
    "calcium": {{ "total": 400, "breakdown": "Paneer (350mg), Roti (50mg)" }},
    "iron": {{ "total": 4.2, "breakdown": "Spinach (3.0mg), Roti (1.2mg)" }}
  }},
  "whyItWorks": "Conclusion summarizing the benefits..."
}}
"""

        user_message = f"""**User Profile:**
- Goal: {user_profile['goal']}
- Diet: {user_profile.get('diet_type', 'Vegetarian')}
- Budget: ₹{user_profile['budget']}

**Wellness Data:**
{json.dumps(wellness_data)}

**Fitness Plan:**
"{fitness_coach_plan}"

**AVAILABLE_FOODS (Select from here):**
{context_str}
"""

        try:
            chat_completion = self.client.chat.completions.create(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message}
                ],
                # Using a model capable of good JSON generation
                model="llama-3.1-8b-instant",
                temperature=0.3, # Lower temperature for consistency
                max_tokens=1000,
                response_format={"type": "json_object"} # Enforce JSON mode if supported, or via prompt
            )
            result_text = chat_completion.choices[0].message.content
            
            # Save nutrition plan to Pinecone for cross-agent memory
            try:
                log_id = save_agent_memory(
                    agent_type="nutritionist",
                    content=str(result_text)[:1000], # Save JSON string or summary
                    metadata={
                        "goal": user_profile.get('goal', ''),
                        "diet_type": user_profile.get('diet_type', ''),
                        "budget": user_profile.get('budget', 0)
                    }
                )
                print(f"✅ Saved nutrition plan to Pinecone: {log_id}")
            except Exception as save_err:
                print(f"⚠️ Failed to save nutrition plan to Pinecone: {save_err}")
            
            return result_text
            
        except Exception as e:
            # Log the full error for debugging
            print(f"❌ Nutritionist Agent Error: {type(e).__name__}: {str(e)[:500]}")
            
            return json.dumps({
                "intro": "Unable to generate meal plan. Please try again.",
                "mainDish": {"name": "Error", "price": 0, "description": "The AI service encountered an issue.", "type": "main"},
                "accompaniments": [],
                "totalCost": 0,
                "nutrients": {"protein": {"total": 0, "breakdown": ""}, "calcium": {"total": 0, "breakdown": ""}, "iron": {"total": 0, "breakdown": ""}},
                "whyItWorks": f"Error: {type(e).__name__}"
            })
