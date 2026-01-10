import os
from crewai.tools import BaseTool
from pinecone import Pinecone
from langchain_google_genai import GoogleGenerativeAIEmbeddings

class FitnessHistoryTool(BaseTool):
    name: str = "FitnessHistoryRAG"
    description: str = (
        "Semantic Search Engine. Retrieves historical data, nutrition, and wellness context "
        "from the Cloud Database. Use this to check for 'Fasted' status or 'Previous Injuries'."
    )
    user_id: str = "user_123"

    def _run(self, query: str) -> str:
        print(f"📊 [FitnessHistoryTool] Called with query: '{query[:50]}...'", flush=True)
        print(f"📊 [FitnessHistoryTool] User ID (namespace): {self.user_id}", flush=True)
        try:
            # 1. Setup Connection
            pc = Pinecone(api_key=os.environ["PINECONE_API_KEY"])
            index = pc.Index(os.environ["PINECONE_INDEX_NAME"])
            
            # 2. Convert Query -> Vector
            api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
            embeddings = GoogleGenerativeAIEmbeddings(
                model="models/text-embedding-004",
                google_api_key=api_key
            )
            query_vector = embeddings.embed_query(query)
            
            # 3. Search Cloud DB
            print(f"📊 [FitnessHistoryTool] Querying Pinecone with namespace='{self.user_id}'", flush=True)
            search_response = index.query(
                vector=query_vector,
                top_k=3,
                include_metadata=True,
                namespace=self.user_id
            )
            
            # 4. Format Results - FILTER OUT workout_log entries
            # Workout logs contain the agent's previous output which may have incorrect context
            matches = search_response.get('matches', [])
            # Only keep wellness/nutrition entries, not workout logs
            filtered_matches = [
                m for m in matches 
                if m.get('metadata', {}).get('type') != 'workout_log'
            ]
            print(f"📊 [FitnessHistoryTool] Found {len(matches)} matches, {len(filtered_matches)} after filtering out workout_logs", flush=True)
            
            if not filtered_matches:
                print(f"🆕 [FitnessHistoryTool] No wellness/nutrition data found for user {self.user_id}, returning baseline defaults", flush=True)
                return (
                    "## IMPORTANT: NO WELLNESS DATA FOUND ##\n"
                    "**DATABASE QUERY RESULT: EMPTY - No previous wellness or nutrition records exist for this user.**\n\n"
                    "MANDATORY: Since no data exists, you MUST assume HEALTHY BASELINE CONDITIONS:\n"
                    "- Energy Level: NORMAL (user is NOT fasted, NOT tired)\n"
                    "- Sleep Quality: GOOD (assume 7-8 hours)\n"
                    "- Stress Level: LOW\n"
                    "- Physical State: HEALTHY (no injuries, no pain, no discomfort)\n\n"
                    "DO NOT fabricate or assume any negative conditions like 'fasted', 'stressed', 'tired', or 'knee pain'.\n"
                    "Prescribe a STANDARD workout appropriate for a healthy user."
                )
            
            formatted_results = "\n".join([f"- {match['metadata']['text']}" for match in filtered_matches])
            return f"## RETRIEVED CONTEXT FROM CLOUD ##\n{formatted_results}"

        except Exception as e:
            return f"Error querying cloud database: {str(e)}"

class UserCalendarTool(BaseTool):
    name: str = "GoogleCalendarTool"
    description: str = "Fetches the user's daily schedule."

    def _run(self, query: str) -> str:
        # Simulation
        return (
            "## LIVE CALENDAR ##\n"
            "18:00 - 18:45: **FREE SLOT (45 mins)**\n"
            "19:00 - 20:00: Dinner Meeting"
        )
