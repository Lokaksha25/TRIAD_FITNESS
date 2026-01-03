"""
Weekly Training Plan Feature - Documentation
=============================================

This module implements intelligent weekly training plan generation with:
- 5-week caching with automatic expiration
- Injury detection and plan regeneration
- Dynamic volume adjustment based on wellness metrics
- User profile-aware programming (bulking/cutting/maintenance)
- AI-powered plan generation using Groq (Llama 3.3)

API Endpoints
-------------
POST /api/trainer/weekly-plan
    Generate or retrieve weekly training plan
    
    Request Body:
        {
            "user_id": "user_123",
            "force_regenerate": false  // Optional: bypass cache
        }
    
    Response:
        {
            "status": "cached" | "new",
            "plan": {
                "created_date": "2026-01-03",
                "expires_date": "2026-02-07",
                "weeks_remaining": 5.0,
                "weekly_schedule": [...],  // 7-day schedule
                "program_notes": "...",
                "progression_strategy": "..."
            },
            "adjustment_reason": "Volume increased 10% - excellent recovery status",
            "log_id": "training_plan_1234567890"
        }

Key Functions
-------------
1. get_wellness_data() -> dict
   Retrieves latest wellness metrics from Pinecone
   Returns: sleep_score, stress_level, hrv, readiness

2. detect_injury_from_history(user_id: str) -> bool
   Checks wellness and exercise logs for injury indicators
   - Low readiness (<40) for 3+ consecutive days
   - Poor form ratings (<5) with recurring issues
   - Injury/pain keywords in logs

3. is_plan_valid(plan_metadata: dict) -> bool
   Validates if cached plan is still usable
   - Age < 35 days (5 weeks)
   - No injuries detected

4. generate_weekly_training_plan(...) -> dict
   Generates new plan using Groq AI
   - Respects user's preferred split from profile notes
   - Adjusts volume based on phase (bulking/cutting/maintenance)
   - Phase-specific set/rep ranges

5. adjust_plan_volume(plan, wellness_data, nutrition_data) -> tuple
   Dynamically adjusts sets/reps without changing exercises
   - Volume multipliers: 0.75x (compromised), 0.9x (moderate), 1.0x (good), 1.1x (excellent)
   - Preserves exercise selection

Caching Logic
-------------
Flow:
1. Check Pinecone for existing plan (type='training_plan')
2. If found:
   - Validate age (<35 days) AND no injuries detected
   - If valid: Return cached plan with volume adjusted for current wellness
   - If invalid: Generate new plan
3. If not found or force_regenerate=True:
   - Generate new plan with AI
   - Save to Pinecone with metadata

Cache Invalidation Triggers:
- Plan age > 35 days (5 weeks)
- Injury detected (readiness <40 for 3+ days, poor form, pain keywords)
- User clicks "Force Regenerate"

Volume Adjustment Rules
-----------------------
Based on wellness data:

Reduce 25% (0.75x):
- Readiness = 'Compromised'
- Sleep score < 50
- Stress = 'High'
- HRV = 'Low'

Reduce 10% (0.9x):
- Sleep score < 65
- Stress = 'Moderate'

Maintain 1.0x:
- Default good recovery

Increase 10% (1.1x):
- Sleep score >= 85
- Readiness = 'Good'
- HRV = 'High'

AI Prompt Engineering
----------------------
The system uses detailed prompts to ensure quality:

1. **Rule #0 (HIGHEST PRIORITY)**: User's preferred split from profile notes
   - Detects keywords: "upper", "lower", "push", "pull", "leg", "full body"
   - Overrides all default recommendations

2. **Phase-Specific Programming**:
   - Bulking: 4-5 sets, 8-12 reps, higher volume
   - Cutting: 3-4 sets, 5-8 reps, maintain strength
   - Maintenance: 3-4 sets, 6-10 reps, balanced

3. **Exercise Quality Standards**:
   - Specific names: "Barbell Back Squat (Low Bar)" not "Squats"
   - Equipment and variation specified
   - Detailed notes with RPE/intensity guidance

Models Used
-----------
- Groq: llama-3.3-70b-versatile (plan generation)
- Google: text-embedding-004 (Pinecone embeddings)

Database Schema (Pinecone)
--------------------------
Training Plan Metadata:
{
    "type": "training_plan",
    "agent_type": "trainer",
    "created_timestamp": 1735934387,
    "created_date": "2026-01-03",
    "exercises": ["Barbell Bench Press", "Squats", ...],
    "user_id": "user_123",
    "injury_detected": false,
    "plan_version": 1,
    "plan_data": "{...}"  // JSON stringified plan
}

Testing
-------
See walkthrough.md for detailed testing instructions.

Quick test:
```bash
# Seed excellent wellness data
python -m backend.seed_excellent_wellness

# Start server
python -m uvicorn backend.server:app --reload

# Test endpoint
curl -X POST http://localhost:8000/api/trainer/weekly-plan \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user_123", "force_regenerate": false}'
```

Troubleshooting
---------------
Issue: Volume not increasing despite excellent wellness
Fix: Check sleep_score threshold (must be >= 85, not > 85)

Issue: AI not following user's preferred split
Fix: Ensure profile notes contain split keywords
      Example: "Upper Lower Push Pull Legs, 5 times a week"

Issue: Model decommissioned error
Fix: Update to latest Groq model (currently llama-3.3-70b-versatile)

Issue: Plan not adjusting
Fix: Verify get_wellness_data() is reading metadata correctly
      Should read sleep_hours, hrv, rhr, readiness_score from metadata
"""
