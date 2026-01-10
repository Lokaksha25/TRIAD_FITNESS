import pandas as pd

class DietRetriever:
    def __init__(self, data_frame):
        self.df = data_frame

    def retrieve(self, criteria):
        """
        Filters data based on:
        - Budget (Hard Constraint)
        - Diet Type (Veg/Non-Veg)
        - Goal (Sorting)
        """
        if self.df.empty:
            print("⚠️ DataFrame is empty, no data to filter")
            return []

        # 1. Start with full data
        filtered = self.df.copy()
        
        # 2. Diet Filter
        user_diet = criteria.get('diet_type', 'Vegetarian')
        if user_diet.lower() in ['vegetarian', 'veg']:
            filtered = filtered[filtered['type'] == 'Veg']
        # Non-veg users see everything (Veg + Non-Veg)

        # 3. Budget Filter
        budget = criteria.get('budget', 500)
        per_meal_budget = budget / 2  # Allow buffer
        
        filtered = filtered[filtered['price_inr'] <= per_meal_budget]
        
        # Retry with full budget if too strict
        if len(filtered) == 0:
            filtered = self.df.copy()
            if user_diet.lower() in ['vegetarian', 'veg']:
                filtered = filtered[filtered['type'] == 'Veg']
            filtered = filtered[filtered['price_inr'] <= budget]

        # 4. Sorting based on Goal
        goal = criteria.get('goal', 'General Health')
        
        if 'Muscle' in goal or 'Gain' in goal:
            filtered = filtered.sort_values(by='protein', ascending=False)
        elif 'Loss' in goal or 'Cut' in goal:
            filtered = filtered.sort_values(by='calories', ascending=True)
        else:
            filtered = filtered.sort_values(by='protein', ascending=False)

        # --- CRITICAL FIX: DEDUPLICATION ---
        # The dataset has many duplicates. We must remove them based on name
        # before taking the top N, otherwise we get 20 copies of the same meal.
        filtered = filtered.drop_duplicates(subset=['name'])

        # 5. Return top 50 candidates (Increased from 20 to ensure variety across meal types)
        result = filtered.head(50).to_dict(orient='records')
        
        print(f"✅ Retriever found {len(result)} unique meals after filtering.")
        return result