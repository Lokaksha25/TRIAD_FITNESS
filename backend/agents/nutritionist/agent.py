import os
import sys
import json
import random
from dotenv import load_dotenv

# Add backend directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../..")))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from tools.memory_store import save_agent_memory

load_dotenv()

# Protein booster products
PROTEIN_BOOSTERS = [
    {"name": "Boiled Eggs (6 pack)", "protein": 36, "price": 50, "blinkit": "https://blinkit.com/s/?q=eggs"},
    {"name": "Greek Yogurt (High Protein)", "protein": 20, "price": 120, "blinkit": "https://blinkit.com/s/?q=greek%20yogurt"},
    {"name": "Peanut Butter", "protein": 25, "price": 180, "blinkit": "https://blinkit.com/s/?q=peanut%20butter"},
    {"name": "Protein Bar", "protein": 20, "price": 100, "blinkit": "https://blinkit.com/s/?q=protien%20bar"}
]

class NutritionistAgent:
    def __init__(self, data_loader, retriever):
        self.retriever = retriever
        self.data_loader = data_loader

    def generate_plan(self, user_profile, wellness_data, fitness_coach_plan=None, user_id: str = "user_123"):
        
        # 1. Determine Targets
        goal = user_profile.get("goal", "General Health")
        budget = user_profile.get("budget", 500)
        
        if 'Muscle' in goal or 'Gain' in goal:
            protein_target = 150
        elif 'Loss' in goal or 'Cut' in goal:
            protein_target = 120
        else:
            protein_target = 100
        
        # 2. Retrieve Data
        criteria = {
            "diet_type": user_profile.get("diet_type", "Vegetarian"),
            "budget": budget,
            "goal": goal
        }
        retrieved_items = self.retriever.retrieve(criteria)
        
        if not retrieved_items:
            return json.dumps({"intro": "No suitable foods found.", "meals": {}, "totalDailyCost": 0})

        # 3. Categorize by Meal Type
        # We look for exact matches in the 'meal_type' column of the dataset
        breakfast_pool = [m for m in retrieved_items if m.get('meal_type') == 'breakfast']
        lunch_pool = [m for m in retrieved_items if m.get('meal_type') == 'lunch']
        dinner_pool = [m for m in retrieved_items if m.get('meal_type') == 'dinner']
        snack_pool = [m for m in retrieved_items if m.get('meal_type') == 'snack']
        
        # Fallback: If strict mapping fails, use the general pool but try to avoid duplicates
        general_pool = retrieved_items.copy()
        
        # 4. Selection Logic (Enforce Variety)
        used_names = set()

        def select_meal(pool, fallback_pool, meal_name_debug):
            selected = None
            
            # Try specific pool first (Unique)
            for item in pool:
                if item.get('name') not in used_names:
                    selected = item
                    break
            
            # Try fallback pool (Unique)
            if not selected:
                for item in fallback_pool:
                    if item.get('name') not in used_names:
                        selected = item
                        break
            
            # Last Resort: Pick anything from specific pool (Duplicate allowed)
            if not selected and pool:
                selected = random.choice(pool)
            
            # Absolute Last Resort: Pick anything
            if not selected and fallback_pool:
                selected = random.choice(fallback_pool)
                
            if selected:
                used_names.add(selected.get('name'))
                
            return selected

        breakfast = select_meal(breakfast_pool, general_pool, "Breakfast")
        lunch = select_meal(lunch_pool, general_pool, "Lunch")
        
        # Smart Snack Selection: If no snack found, find low calorie item from general
        if not snack_pool:
            snack_pool = [m for m in general_pool if m.get('calories', 0) < 300]
        snacks = select_meal(snack_pool, general_pool, "Snacks")
        
        dinner = select_meal(dinner_pool, general_pool, "Dinner")

        # 5. Build Response Helper
        def format_meal(meal_data, type_label):
            if not meal_data: return None
            
            # Handle JSON strings in dataset
            def parse_json(field):
                if isinstance(meal_data.get(field), str):
                    try: return json.loads(meal_data[field])
                    except: return []
                return meal_data.get(field, [])

            return {
                "mealName": meal_data.get('name', 'Meal'),
                "mainDish": {
                    "name": meal_data.get('name'),
                    "price": meal_data.get('price_inr', 0),
                    "description": f"Best {type_label} option for {goal}",
                    "type": "main"
                },
                "totalCost": meal_data.get('price_inr', 0),
                "nutrients": {
                    "protein": meal_data.get('protein', 0),
                    "carbs": meal_data.get('carbs', 0),
                    "fat": meal_data.get('fats', 0),
                    "calories": meal_data.get('calories', 0)
                },
                "recipe": parse_json('recipe'),
                "ingredients": parse_json('ingredients'),
                "youtubeLink": meal_data.get('youtube_link', '')
            }

        final_plan = {
            "breakfast": format_meal(breakfast, 'breakfast'),
            "lunch": format_meal(lunch, 'lunch'),
            "snacks": format_meal(snacks, 'snacks'),
            "dinner": format_meal(dinner, 'dinner')
        }

        # 6. Calculate Totals & Boosters
        valid_meals = [m for m in final_plan.values() if m]
        total_protein = sum(m['nutrients']['protein'] for m in valid_meals)
        # Base daily cost is just the fresh meals
        total_cost = sum(m['totalCost'] for m in valid_meals)
        total_cals = sum(m['nutrients']['calories'] for m in valid_meals)

        protein_gap = protein_target - total_protein
        boosters_needed = []
        
        if protein_gap > 5: # Only suggest if gap is significant
            for booster in PROTEIN_BOOSTERS:
                if protein_gap <= 0: break
                
                # Add booster
                boosters_needed.append(booster)
                protein_gap -= booster['protein']
                
                # Update Cost Logic:
                # ONLY add cost for fresh daily items (Eggs, Yogurt).
                # Exclude bulk items (Peanut Butter, Protein Bars) from DAILY cost tally.
                if "Eggs" in booster['name'] or "Yogurt" in booster['name']:
                    total_cost += booster['price']
                # Peanut Butter/Bars are one-time purchases, so we don't add to daily sum

        # Detailed Explanation Generation
        explanation = f"This plan is designed for {goal}. "
        if 'Muscle' in goal or 'Gain' in goal:
            explanation += f"It prioritizes high protein ({total_protein}g) to support muscle hypertrophy while providing {total_cals} kcals for energy. "
        elif 'Loss' in goal or 'Cut' in goal:
            explanation += f"It maintains a calorie deficit ({total_cals} kcals) for fat loss while keeping protein high ({total_protein}g) to preserve lean muscle. "
        else:
            explanation += f"It provides a balanced macro split ({total_protein}g Protein) for sustained energy and overall wellness. "
            
        explanation += "Carbs and Fats are balanced to ensure satiety and hormonal health."

        result = {
            "intro": f"Here is your optimized nutrition plan for {goal}.",
            "meals": final_plan,
            "totalMacros": {
                "protein": total_protein,
                "carbs": sum(m['nutrients']['carbs'] for m in valid_meals),
                "fat": sum(m['nutrients']['fat'] for m in valid_meals),
                "calories": total_cals
            },
            "proteinTarget": protein_target,
            "totalDailyCost": total_cost,
            "proteinBoosters": boosters_needed,
            "whyItWorks": explanation
        }

        # Memory Save (Safe Wrap)
        try:
             save_agent_memory("nutritionist", f"Plan: {total_cals}kcal", result, user_id)
        except: pass
        
        return json.dumps(result)