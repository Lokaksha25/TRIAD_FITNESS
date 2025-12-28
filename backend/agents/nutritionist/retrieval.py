import pandas as pd

class DietRetriever:
    def __init__(self, data_frame):
        self.df = data_frame

    def retrieve(self, criteria):
        """
        Filters data based on:
        - Budget (Hard Constraint)
        - Diet Type (Veg/Non-Veg)
        - Goal (Muscle Gain = High Protein Sort, Weight Loss = Low Calorie Sort)
        """
        if self.df.empty:
            return []

        # 1. Start with full data
        filtered = self.df.copy()

        # 2. Diet Filter (Veg / Non-Veg)
        # Assuming user input is "Vegetarian" or "Non-Vegetarian", map to dataset "Veg"/"Non-Veg"
        user_diet = criteria.get('diet_type', 'Veg')
        if user_diet == 'Vegetarian':
            filtered = filtered[filtered['type'] == 'Veg']
        elif user_diet == 'Non-Vegetarian':
            # If user is Non-Veg, they can eat Veg too, so we might not filter strictly, 
            # but usually they prefer meat. Let's keep both or filter strict based on preference.
            # For this hackathon, let's allow all if Non-Veg, but prioritize meat later.
            pass 

        # 3. Budget Filter (Price <= Budget)
        budget = criteria.get('budget', 500)
        filtered = filtered[filtered['price_inr'] <= budget]

        # 4. Sorting based on Goal
        goal = criteria.get('goal', 'General Health')
        
        if 'Muscle' in goal or 'Hypertrophy' in goal:
            # Sort by Protein (Descending)
            filtered = filtered.sort_values(by='protein', ascending=False)
        elif 'Loss' in goal or 'Fat' in goal:
            # Sort by Calories (Ascending)
            filtered = filtered.sort_values(by='calories', ascending=True)
        else:
            # Balanced: Sort by protein just to be safe
            filtered = filtered.sort_values(by='protein', ascending=False)

        # 5. Return top 15 candidates as a dictionary context
        # We limit to 15 to fit into the Llama context window cleanly
        return filtered.head(15).to_dict(orient='records')