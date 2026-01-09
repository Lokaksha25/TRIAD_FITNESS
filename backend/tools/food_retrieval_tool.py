import os
from crewai.tools import BaseTool
from pydantic import Field
from nutrition.data_loader import FoodDataLoader
from nutrition.retrieval import DietRetriever

# Define paths relative to this file or absolute
# backend/tools/food_retrieval_tool.py -> ... -> backend/
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(BASE_DIR, "data", "Indian_Food_Nutrition_Processed.csv")
JSON_PATH = os.path.join(BASE_DIR, "data", "indian_gym_friendly_nutrition_rag_dataset_TOP_NOTCH_v5.1.json")

# Initialize globally to load once
# This will run when the module is imported
loader = FoodDataLoader(CSV_PATH, JSON_PATH)
retriever = DietRetriever(loader.get_data())

class FoodRetrievalTool(BaseTool):
    name: str = "Search Indian Food Database"
    description: str = (
        "Search for Indian food items based on diet type, budget, and fitness goal. "
        "Returns a list of food items with nutrition and price info. "
        "Useful for generating meal plans with real data. "
        "Args: diet_type ('Veg'/'Non-Veg'), budget (int), goal ('Muscle Gain'/'Weight Loss')."
    )

    def _run(self, diet_type: str = "Vegetarian", budget: int = 500, goal: str = "General Health") -> str:
        # Normalize diet_type for DietRetriever
        if diet_type.lower() in ["veg", "vegetarian"]:
             diet_type = "Vegetarian"
        elif diet_type.lower() in ["non-veg", "non-vegetarian", "non vegetarian"]:
             diet_type = "Non-Vegetarian"

        try:
            criteria = {
                "diet_type": diet_type,
                "budget": budget,
                "goal": goal
            }
            
            results = retriever.retrieve(criteria)
            
            if not results:
                return "No food items found matching criteria."
                
            # Format results as a string
            output = f"Found {len(results)} options matching diet={diet_type}, budget=₹{budget}, goal={goal}:\n"
            for item in results:
                output += (
                    f"- {item['name']} ({item['type']}): ₹{item['price_inr']} | "
                    f"Cal: {item['calories']}, P: {item['protein']}g, C: {item['carbs']}g, F: {item['fats']}g\n"
                )
                
            return output
        except Exception as e:
            return f"Error retrieving food: {str(e)}"
