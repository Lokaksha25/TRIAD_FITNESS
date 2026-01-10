import pandas as pd
import json
import os

class FoodDataLoader:
    def __init__(self, csv_path, json_path):
        self.csv_path = csv_path
        self.json_path = json_path
        self.data = self._load_and_merge()

    def _load_and_merge(self):
        try:
            # 1. Load JSON (Meal data with nutrition, ingredients, pricing)
            if not os.path.exists(self.json_path):
                raise FileNotFoundError(f"JSON not found at {self.json_path}")
                
            with open(self.json_path, 'r') as f:
                json_data = json.load(f)
            
            # Handle new v5.1 format with "meals" array
            if isinstance(json_data, dict) and 'meals' in json_data:
                meals = json_data['meals']
            elif isinstance(json_data, list):
                meals = json_data
            else:
                raise ValueError("Unexpected JSON format")
            
            # Flatten meal data for DataFrame
            flat_data = []
            for meal in meals:
                flat_meal = {
                    'name': meal.get('meal_name', ''),
                    'meal_type': meal.get('meal_type', 'general'),
                    'type': meal.get('diet_type', 'veg').capitalize(),  # 'veg' -> 'Veg', 'non-veg' -> 'Non-veg'
                    'region': meal.get('region', ''),
                    'price_inr': meal.get('total_cost_inr', 0),
                    'meal_id': meal.get('meal_id', ''),
                    'youtube_link': meal.get('youtube_recipe_link', ''),
                    'recommended_for': meal.get('recommended_for', []),
                }
                
                # Extract nutrition
                nutrition = meal.get('nutrition', {})
                flat_meal['calories'] = nutrition.get('cal', 0)
                flat_meal['protein'] = nutrition.get('protein', 0)
                flat_meal['carbs'] = nutrition.get('carbs', 0)
                flat_meal['fats'] = nutrition.get('fat', 0)
                flat_meal['fiber'] = nutrition.get('fiber', 0)
                
                # Store recipe as JSON array string (preserve steps)
                recipe_steps = meal.get('recipe', [])
                flat_meal['recipe'] = json.dumps(recipe_steps)  # Store as JSON string
                
                # Store ingredients with blinkit links as JSON string
                ingredients = meal.get('ingredients', [])
                flat_meal['ingredients'] = json.dumps(ingredients)  # Full ingredient data with blinkit
                flat_meal['ingredients_str'] = ', '.join([ing.get('name', '') for ing in ingredients])
                
                flat_data.append(flat_meal)
            
            df = pd.DataFrame(flat_data)
            
            # Normalize diet type to match expected values
            # "veg" -> "Veg", "non-veg" -> "Non-Veg"
            df['type'] = df['type'].apply(lambda x: 'Non-Veg' if 'non' in x.lower() else 'Veg')
            
            print(f"✅ Data Loaded Successfully. {len(df)} meals available.")
            print(f"   Diet types: {df['type'].unique()}")
            print(f"   Price range: ₹{df['price_inr'].min()} - ₹{df['price_inr'].max()}")
            
            return df
            
        except Exception as e:
            print(f"❌ Error loading data: {e}")
            import traceback
            traceback.print_exc()
            return pd.DataFrame()  # Return empty on failure

    def get_data(self):
        return self.data
