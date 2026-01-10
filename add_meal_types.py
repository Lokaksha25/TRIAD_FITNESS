import json

# Load data
with open('backend/data/indian_gym_friendly_nutrition_rag_dataset_TOP_NOTCH_v5.1.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

meals = data.get('meals', [])

# Get unique lunch items as base for dinner
lunch_meals = [m for m in meals if m.get('meal_type') == 'lunch']

# Create dinner versions from lunch items
dinner_meals = []
dinner_id = 200
for m in lunch_meals[:10]:
    dm = dict(m)
    dm['meal_type'] = 'dinner'
    dm['meal_id'] = f'TOP_MEAL_{dinner_id}'
    dinner_id += 1
    dinner_meals.append(dm)

# Create snack items
snack_meals = [
    {
        'meal_name': 'Mixed Nuts and Seeds',
        'meal_type': 'snack',
        'diet_type': 'veg',
        'region': 'Pan Indian',
        'ingredients': [
            {'name': 'Almonds', 'qty': '20g', 'cost_inr': 30, 'blinkit': 'https://blinkit.com/s/?q=almonds'},
            {'name': 'Walnuts', 'qty': '10g', 'cost_inr': 25, 'blinkit': 'https://blinkit.com/s/?q=walnuts'},
            {'name': 'Pumpkin Seeds', 'qty': '10g', 'cost_inr': 15, 'blinkit': 'https://blinkit.com/s/?q=pumpkin+seeds'}
        ],
        'recipe': ['Mix all nuts together', 'Store in airtight container', 'Portion 40g per serving'],
        'nutrition': {'cal': 250, 'protein': 8, 'carbs': 10, 'fat': 20, 'fiber': 3},
        'meal_id': 'TOP_MEAL_300',
        'recommended_for': ['muscle_gain', 'fat_loss', 'maintenance'],
        'total_cost_inr': 70,
        'youtube_recipe_link': 'https://www.youtube.com/results?search_query=healthy+nuts+snack+gym'
    },
    {
        'meal_name': 'Banana Peanut Butter',
        'meal_type': 'snack',
        'diet_type': 'veg',
        'region': 'Pan Indian',
        'ingredients': [
            {'name': 'Banana', 'qty': '1 medium', 'cost_inr': 8, 'blinkit': 'https://blinkit.com/s/?q=banana'},
            {'name': 'Peanut Butter', 'qty': '2 tbsp', 'cost_inr': 25, 'blinkit': 'https://blinkit.com/s/?q=peanut+butter'}
        ],
        'recipe': ['Slice banana', 'Spread peanut butter on slices', 'Enjoy as quick protein snack'],
        'nutrition': {'cal': 280, 'protein': 10, 'carbs': 30, 'fat': 14, 'fiber': 4},
        'meal_id': 'TOP_MEAL_301',
        'recommended_for': ['muscle_gain', 'maintenance'],
        'total_cost_inr': 33,
        'youtube_recipe_link': 'https://www.youtube.com/results?search_query=banana+peanut+butter+snack'
    },
    {
        'meal_name': 'Greek Yogurt with Honey',
        'meal_type': 'snack',
        'diet_type': 'veg',
        'region': 'Pan Indian',
        'ingredients': [
            {'name': 'Greek Yogurt', 'qty': '150g', 'cost_inr': 50, 'blinkit': 'https://blinkit.com/s/?q=greek+yogurt'},
            {'name': 'Honey', 'qty': '1 tbsp', 'cost_inr': 10, 'blinkit': 'https://blinkit.com/s/?q=honey'}
        ],
        'recipe': ['Add yogurt to bowl', 'Drizzle honey on top', 'Enjoy cold'],
        'nutrition': {'cal': 180, 'protein': 15, 'carbs': 20, 'fat': 4, 'fiber': 0},
        'meal_id': 'TOP_MEAL_302',
        'recommended_for': ['muscle_gain', 'fat_loss', 'maintenance'],
        'total_cost_inr': 60,
        'youtube_recipe_link': 'https://www.youtube.com/results?search_query=greek+yogurt+honey+snack'
    },
    {
        'meal_name': 'Boiled Eggs',
        'meal_type': 'snack',
        'diet_type': 'non-veg',
        'region': 'Pan Indian',
        'ingredients': [
            {'name': 'Eggs', 'qty': '2', 'cost_inr': 18, 'blinkit': 'https://blinkit.com/s/?q=eggs'}
        ],
        'recipe': ['Boil eggs for 10 minutes', 'Cool and peel', 'Add salt if desired'],
        'nutrition': {'cal': 140, 'protein': 12, 'carbs': 1, 'fat': 10, 'fiber': 0},
        'meal_id': 'TOP_MEAL_303',
        'recommended_for': ['muscle_gain', 'fat_loss', 'maintenance'],
        'total_cost_inr': 18,
        'youtube_recipe_link': 'https://www.youtube.com/results?search_query=boiled+eggs+snack'
    }
]

# Add new meals to data
data['meals'].extend(dinner_meals)
data['meals'].extend(snack_meals)

# Save updated data
with open('backend/data/indian_gym_friendly_nutrition_rag_dataset_TOP_NOTCH_v5.1.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

# Verify
types = set(m.get('meal_type') for m in data['meals'])
print(f'Updated meal types: {types}')
print(f'Total meals now: {len(data["meals"])}')
print(f'Added {len(dinner_meals)} dinners and {len(snack_meals)} snacks.')
