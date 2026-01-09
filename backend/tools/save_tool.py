import os
import datetime
import uuid
from crewai.tools import BaseTool
from pinecone import Pinecone
from langchain_google_genai import GoogleGenerativeAIEmbeddings

class SaveWorkoutTool(BaseTool):
    name: str = "SaveWorkoutToCloud"
    description: str = (
        "Saves the completed workout details to the Cloud Database. "
        "Input should be a summary string like: 'Squats: 15 reps. Good depth.'"
    )
    user_id: str = "user_123"

    def _run(self, workout_summary: str) -> str:
        try:
            # 1. Init Pinecone
            pc = Pinecone(api_key=os.environ["PINECONE_API_KEY"])
            index = pc.Index(os.environ.get("PINECONE_INDEX_NAME", "fitness-memory"))

            # 2. Init Embeddings (Must match your reading tool)
            # Use GEMINI_API_KEY as fallback if GOOGLE_API_KEY not set
            api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
            embeddings = GoogleGenerativeAIEmbeddings(
                model="models/text-embedding-004",
                google_api_key=api_key
            )

            # 3. Prepare Data
            timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
            text_to_save = f"Workout Log {timestamp}: {workout_summary}"
            
            # 4. Generate Vector
            vector_values = embeddings.embed_query(text_to_save)
            
            # 5. Upload (Upsert)
            unique_id = f"log_{uuid.uuid4()}"
            index.upsert(vectors=[{
                "id": unique_id,
                "values": vector_values,
                "metadata": {"text": text_to_save, "type": "workout_log"}
            }],
            namespace=self.user_id)

            return f"SUCCESS: Saved to Cloud Memory (ID: {unique_id})"

        except Exception as e:
            return f"ERROR saving to cloud: {str(e)}"
