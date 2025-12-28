import google.generativeai as genai
import os
import json
import typing_extensions as typing

# Configure Gemini
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# Define the exact schema from your TypeScript code for strict JSON output
class Ingredient(typing.TypedDict):
    name: str
    tag: str
    riskLevel: str
    description: str

class Nutrition(typing.TypedDict):
    calories: float
    protein: float
    carbs: float
    fat: float
    sugar: float

class Alternative(typing.TypedDict):
    name: str
    reason: str

class ScanResult(typing.TypedDict):
    productName: str
    brandName: str
    healthScore: int
    processingLevel: int
    processingLabel: str
    nutrition: Nutrition
    ingredients: list[Ingredient]
    isExpired: bool
    warnings: list[str]
    alternatives: list[Alternative]

def analyze_food_image(image_bytes, user_profile):
    """
    Analyzes an image using Gemini Flash 1.5 to extract nutrition info
    based on the user's specific diet profile.
    """
    # Prefer env key if set in configure, but explicit key passing is also fine if logic changes
    # Here we rely on genai.configure being called with a valid key.
    # Initialize Gemini
    model = genai.GenerativeModel(
        "gemini-2.5-flash",
        generation_config={
            "response_mime_type": "application/json", 
            "response_schema": ScanResult
        }
    )

    prompt = f"""
    You are an expert AI Nutritionist using computer vision.
    Analyze this food product image packaging or meal.
    
    User Profile Context:
    - Diet: {user_profile.get('diet_type', 'General')}
    - Allergens: {', '.join(user_profile.get('allergens', []))}
    - Goals: {user_profile.get('goal', 'Health')}
    
    User Wellness Context (from Wellness Agent):
    - Sleep Score: {user_profile.get('sleep_score', 'N/A')}
    - Stress Level: {user_profile.get('stress_level', 'Moderate')}
    - HRV: {user_profile.get('hrv', 'Normal')}
    - Readiness: {user_profile.get('readiness', 'Good')}

    Tasks:
    1. Identify Product Name and Brand.
    2. Extract Nutrition Facts.
    3. Analyze Ingredients (Flag allergens, additives).
    4. Calculate Health Score (0-100) & Processing Score (NOVA).
    5. Check dates for expiry.
    6. Generate specific warnings if ingredients conflict with User Profile.
    7. If user has LOW sleep or HIGH stress, factor this into recommendations (e.g., avoid high sugar/caffeine).
    8. Suggest 3 healthier alternatives tailored to the user's wellness state.
    
    CRITICAL: Verify the image actually contains food or packaging. If not, return valid JSON with "productName": "Unrecognized Image" and healthScore 0.
    DO NOT output your internal model name or identity. Output ONLY valid JSON matching the schema.
    """

    try:
        response = model.generate_content([
            {'mime_type': 'image/jpeg', 'data': image_bytes},
            prompt
        ])
        print(f"DEBUG: Scanner Raw Response: {response.text}")
        
        # Clean response text if it contains markdown code blocks
        text = response.text.replace("```json", "").replace("```", "").strip()
        
        data = json.loads(text)
        
        # Validate data structure (basic check)
        if "nutrition" not in data:
            data["nutrition"] = {"calories": 0, "protein": 0, "carbs": 0, "fat": 0, "sugar": 0}
            
        return data
    except Exception as e:
        print(f"❌ Scanner Error: {e}")
        return {
            "productName": "Error Analyzing Image",
            "brandName": "System Error",
            "healthScore": 0,
            "nutrition": {"calories": 0, "protein": 0, "carbs": 0, "fat": 0, "sugar": 0},
            "ingredients": [],
            "warnings": [f"Analysis failed: {str(e)}"],
            "alternatives": []
        }
    except Exception as e:
        return {"error": str(e)}
