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
            # 1. Load CSV (Nutrition Data)
            if not os.path.exists(self.csv_path):
                raise FileNotFoundError(f"CSV not found at {self.csv_path}")
            
            df_nutrition = pd.read_csv(self.csv_path)
            # Clean column names (strip spaces)
            df_nutrition.columns = [c.strip() for c in df_nutrition.columns]
            
            # 2. Load JSON (Price & Tags Data)
            if not os.path.exists(self.json_path):
                raise FileNotFoundError(f"JSON not found at {self.json_path}")
                
            with open(self.json_path, 'r') as f:
                json_data = json.load(f)
            df_pricing = pd.DataFrame(json_data)

            # 3. Merge: We use an inner join to keep only items where we have BOTH price and nutrition
            # 'name' in JSON matches 'Dish Name' in CSV
            merged_df = pd.merge(
                df_pricing, 
                df_nutrition, 
                left_on='name', 
                right_on='Dish Name', 
                how='inner'
            )

            print(f"✅ Data Loaded Successfully. {len(merged_df)} items available.")
            return merged_df
            
        except Exception as e:
            print(f"❌ Error loading data: {e}")
            return pd.DataFrame() # Return empty on failure

    def get_data(self):
        return self.data