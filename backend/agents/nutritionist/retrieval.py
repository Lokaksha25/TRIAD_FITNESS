import pandas as pd

class DietRetriever:
    def __init__(self, data_frame):
        self.df = data_frame

    def retrieve(self, criteria):
        """
        Filters data based on:
        - Budget (Hard Constraint - daily budget divided among meals)
        - Diet Type (Veg/Non-Veg)
        - Goal (Muscle Gain = High Protein Sort, Weight Loss = Low Calorie Sort)
        """
        if self.df.empty:
            print("⚠️ DataFrame is empty, no data to filter")
            return []

        # 1. Start with full data
        filtered = self.df.copy()
        
        print(f"📊 Starting filter with {len(filtered)} meals")
        print(f"   Criteria: {criteria}")

        # 2. Diet Filter (Veg / Non-Veg)
        user_diet = criteria.get('diet_type', 'Vegetarian')
        if user_diet.lower() in ['vegetarian', 'veg']:
            filtered = filtered[filtered['type'] == 'Veg']
            print(f"   After Veg filter: {len(filtered)} meals")
        elif user_diet.lower() in ['non-vegetarian', 'non-veg', 'nonveg']:
            # Non-veg users can eat both veg and non-veg
            pass
            print(f"   No diet filter (Non-Veg can eat all): {len(filtered)} meals")

        # 3. Budget Filter
        # Budget is per-day, individual meals typically cost 30-150 INR
        # Filter meals that cost <= half the daily budget (to allow multiple meals)
        budget = criteria.get('budget', 500)
        
        # For a 500 INR daily budget, we want meals up to ~250 INR each
        # For a 950 INR budget, allow meals up to ~475 INR each
        per_meal_budget = budget / 2
        
        # Apply budget filter - include meals that cost less than per-meal budget
        filtered = filtered[filtered['price_inr'] <= per_meal_budget]
        print(f"   After budget filter (meals <= ₹{per_meal_budget}): {len(filtered)} meals")
        
        # If no results, try with full daily budget
        if len(filtered) == 0:
            print(f"   ⚠️ No meals under ₹{per_meal_budget}, trying full budget ₹{budget}")
            filtered = self.df.copy()
            if user_diet.lower() in ['vegetarian', 'veg']:
                filtered = filtered[filtered['type'] == 'Veg']
            filtered = filtered[filtered['price_inr'] <= budget]
            print(f"   After retry with full budget: {len(filtered)} meals")

        # 4. Sorting based on Goal
        goal = criteria.get('goal', 'General Health')
        
        if 'Muscle' in goal or 'Hypertrophy' in goal or 'Gain' in goal:
            # Sort by Protein (Descending)
            filtered = filtered.sort_values(by='protein', ascending=False)
        elif 'Loss' in goal or 'Fat' in goal or 'Cut' in goal:
            # Sort by Calories (Ascending)
            filtered = filtered.sort_values(by='calories', ascending=True)
        else:
            # Balanced: Sort by protein
            filtered = filtered.sort_values(by='protein', ascending=False)

        # 5. Return top 20 candidates
        result = filtered.head(20).to_dict(orient='records')
        print(f"   ✅ Returning {len(result)} meals")
        return result
