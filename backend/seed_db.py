import os
import time
from pinecone import Pinecone, ServerlessSpec
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from dotenv import load_dotenv

# Load environment variables
# Look for .env.local in the parent directory (project root)
load_dotenv(dotenv_path='../.env.local')
load_dotenv() # Also load any .env in current directory if it exists

def seed_cloud_db():
    print("... Connecting to Pinecone Cloud")
    
    # 1. Initialize Pinecone
    pc = Pinecone(api_key=os.environ["PINECONE_API_KEY"])
    index_name = os.environ["PINECONE_INDEX_NAME"]
    
    # Check if index exists, if not create it (Serverless)
    existing_indexes = [index.name for index in pc.list_indexes()]
    if index_name not in existing_indexes:
        print(f"Creating index '{index_name}'...")
        pc.create_index(
            name=index_name,
            dimension=768, # Dimension for Google's embedding-001
            metric='cosine',
            spec=ServerlessSpec(cloud='aws', region='us-east-1') # Adjust region if needed
        )
        time.sleep(1) # Wait for init

    index = pc.Index(index_name)

    # 2. Initialize Embeddings
    api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("API Key not found. Please set GOOGLE_API_KEY or GEMINI_API_KEY.")

    embeddings = GoogleGenerativeAIEmbeddings(
        model="models/text-embedding-004",
        google_api_key=api_key
    )

    # 3. The Data (Context for the PT)
    documents = [
        "Workout Log 2023-10-25: Squat 3x5 @ 100kg. Form breakdown on last set. RPE 9.",
        "Workout Log 2023-10-27: Pushups 3x15. Good form. RPE 7.",
        "Nutrition Report: Phase is Aggressive Cut. Caloric Deficit 500kcal. Fuel Status: Low Glycogen (Low Carbs). Timing: Fasted.",
        "Wellness Log: Sleep was poor (5 hours). High stress from work. HRV is low. Recommendation: Reduce CNS fatigue."
    ]
    ids = ["log_001", "log_002", "nutri_latest", "well_latest"]
    
    print("... Generating Embeddings & Uploading")
    vectors_to_upsert = []
    
    for i, doc in enumerate(documents):
        vector_values = embeddings.embed_query(doc)
        vectors_to_upsert.append({
            "id": ids[i],
            "values": vector_values,
            "metadata": {"text": doc} # Important: Store text to retrieve it later
        })

    index.upsert(vectors=vectors_to_upsert)
    print("✅ Success! Memory is now in the Cloud.")

if __name__ == "__main__":
    seed_cloud_db()