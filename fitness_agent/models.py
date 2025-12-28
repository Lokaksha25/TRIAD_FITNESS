from pydantic import BaseModel, Field
from typing import Optional

# This acts as the "Universal Watch Translator"
class UserHealthData(BaseModel):
    user_id: str
    date: str
    # Sleep Data
    total_sleep_hours: float = Field(..., description="Total sleep duration in hours")
    deep_sleep_minutes: Optional[int] = 0
    rem_sleep_minutes: Optional[int] = 0
    # Heart Data
    resting_heart_rate: int = Field(..., description="Avg RHR in BPM")
    hrv_score: Optional[int] = Field(None, description="Heart Rate Variability (ms)")
    # Activity
    steps: int
    active_calories: int

    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "user_123",
                "date": "2024-05-20",
                "total_sleep_hours": 5.5,
                "deep_sleep_minutes": 45,
                "rem_sleep_minutes": 60,
                "resting_heart_rate": 65,
                "hrv_score": 30,
                "steps": 4500,
                "active_calories": 300
            }
        }