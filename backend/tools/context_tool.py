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
            search_response = index.query(
                vector=query_vector,
                top_k=3,
                include_metadata=True,
                namespace=self.user_id
            )
            
            # 4. Format Results
            matches = search_response.get('matches', [])
            if not matches:
                return "No relevant records found in the cloud database."
            
            formatted_results = "\n".join([f"- {match['metadata']['text']}" for match in matches])
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
