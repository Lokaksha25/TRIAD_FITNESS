import os
import time
from crewai.tools import BaseTool
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from pinecone import Pinecone
from pydantic import Field

class SaveNutritionTool(BaseTool):
    name: str = "Save Nutrition Plan"
    description: str = (
        "Saves a nutrition plan or log to the user's long-term memory (Pinecone). "
        "Useful for storing daily targets, meal plans, or dietary restrictions. "
        "Input should be a summary string and integer values for calories and macros."
    )

    def _run(self, plan_summary: str, calories: int, protein: int, carbs: int, fat: int) -> str:
        try:
            # 1. Connect to Pinecone
            pc = Pinecone(api_key=os.environ["PINECONE_API_KEY"])
            index = pc.Index(os.environ["PINECONE_INDEX_NAME"])

            # 2. Embed the Text
            embeddings = GoogleGenerativeAIEmbeddings(
                model="models/text-embedding-004",
                google_api_key=os.environ["GOOGLE_API_KEY"]
            )
            vector_values = embeddings.embed_query(plan_summary)

            # 3. Create Record
            timestamp = int(time.time())
            log_id = f"nutrition_{timestamp}"

            metadata = {
                "type": "nutrition",  # Tagging it as nutrition data
                "text": plan_summary,
                "calories": calories,
                "protein": protein,
                "carbs": carbs,
                "fat": fat,
                "date": time.strftime('%Y-%m-%d')
            }

            # 4. Upsert
            index.upsert(vectors=[{
                "id": log_id,
                "values": vector_values,
                "metadata": metadata
            }])

            return f"Successfully saved nutrition plan {log_id} to memory."

        except Exception as e:
            return f"Error saving to Pinecone: {str(e)}"