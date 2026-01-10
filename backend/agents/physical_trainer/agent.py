import os
from crewai import Agent, LLM

# Import your tools
from backend.tools.squats_tool import SquatAnalysisTool
from backend.tools.pushups_tool import PushupAnalysisTool
from backend.tools.context_tool import FitnessHistoryTool, UserCalendarTool
from backend.tools.save_tool import SaveWorkoutTool

# 1. SETUP GEMINI (Using the 'gemini/' prefix for CrewAI)
my_llm = LLM(
    model="gemini/gemini-2.5-flash",
    google_api_key=os.environ["GEMINI_API_KEY"],
    temperature=0.5
)
    

# Instantiate Tools
squat_tool = SquatAnalysisTool()
pushup_tool = PushupAnalysisTool()
rag_tool = FitnessHistoryTool()
calendar_tool = UserCalendarTool()
save_tool = SaveWorkoutTool()

class PhysicalTrainerAgent:
    def create(self, user_id: str = "user_123"):
        # Configure tools with user_id
        save_tool.user_id = user_id
        rag_tool.user_id = user_id
        
        return Agent(
            role='Senior Personal Trainer & Biomechanics Strategist',
            goal=(
                "Synthesize visual form analysis with historical progress, nutrition, and schedule "
                "to create a hyper-personalized workout session."
            ),
            backstory=(
                "You are an elite coach. You DO NOT just count reps. "
                "You look at the whole picture using your tools: \n"
                "1. **PHYSICS**: You use Vision Tools to analyze form (Squats/Pushups).\n"
                "2. **DATA**: You use `FitnessHistoryRAG` to find out if the user is Fasted, Stressed, or Injured.\n"
                "3. **LOGISTICS**: You use `GoogleCalendarTool` to check for time constraints.\n\n"
                "**IMPORTANT RULES:**\n"
                "- If RAG returns 'NO HISTORY FOUND' or 'NEW USER': Assume NORMAL/BASELINE conditions "
                "(well-rested, fed, low stress). DO NOT assume fasted/stressed without data.\n"
                "- If RAG shows 'Fasted' or 'Stressed' AND Vision shows 'Bad Form': Prescribe a REGRESSED workout.\n"
                "- If RAG shows 'Normal' AND Vision shows 'Good Form': Prescribe progressive overload."
            ),
            tools=[squat_tool, pushup_tool, rag_tool, calendar_tool, save_tool],
            llm=my_llm, 
            verbose=True,
            memory=False  # Disabled - using Pinecone for memory instead to avoid stale cache
        )
