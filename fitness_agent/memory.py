import os
from pinecone import Pinecone
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv

load_dotenv()

# --- CONFIGURATION ---
pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
index = pc.Index(os.getenv("PINECONE_INDEX_NAME"))

# --- CRITICAL FIX: Initialize model globally here ---
print("⏳ Loading local embedding model...")
embed_model = SentenceTransformer('all-mpnet-base-v2')
print("✅ Local model loaded.")

def store_memory(user_id, date, analysis_json):
    print(f"🧠 Storing memory for {user_id} on {date}...")
    
    text_content = f"""
    Date: {date}
    User: {user_id}
    Summary: {analysis_json.get('executive_summary')}
    Score: {analysis_json.get('readiness_score')}
    Bio-Hack: {analysis_json.get('micro_intervention')}
    Mindset: {analysis_json.get('cognitive_framing')}
    Workout: {analysis_json.get('training_protocol')}
    Nutrition: {analysis_json.get('nutritional_strategy')}
    """
    
    try:
        # Create Vector
        vector = embed_model.encode(text_content).tolist()
        
        # Save to Pinecone
        index.upsert(
            vectors=[{
                "id": f"{user_id}_{date}",
                "values": vector,
                "metadata": {
                    "user_id": user_id,
                    "date": date,
                    "text_content": text_content
                }
            }]
        )
        print("✅ Elite performance memory stored.")
        
    except Exception as e:
        print(f"❌ Failed to store memory: {e}")