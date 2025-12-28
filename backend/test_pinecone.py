import os
import time
from pinecone import Pinecone
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from dotenv import load_dotenv

# Load env vars same way server does
load_dotenv(dotenv_path='../.env.local')
load_dotenv()

def test_pinecone():
    print("Testing Pinecone Connection...")
    
    api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    pinecone_key = os.environ.get("PINECONE_API_KEY")
    index_name = os.environ.get("PINECONE_INDEX_NAME")

    print(f"Gemini Key Present: {bool(api_key)}")
    print(f"Pinecone Key Present: {bool(pinecone_key)}")
    print(f"Index Name: {index_name}")

    if not api_key or not pinecone_key or not index_name:
        print("❌ Missing Environment Variables!")
        return

    try:
        # 1. Connect
        pc = Pinecone(api_key=pinecone_key)
        indexes = pc.list_indexes()
        print(f"Existing Indexes: {[i.name for i in indexes]}")
        
        if index_name not in [i.name for i in indexes]:
            print(f"❌ Index '{index_name}' not found!")
            return

        index = pc.Index(index_name)
        print(f"✅ Connected to Index '{index_name}'")

        # 2. Embed
        print("Testing Embeddings...")
        embeddings = GoogleGenerativeAIEmbeddings(
            model="models/text-embedding-004",
            google_api_key=api_key
        )
        test_text = "Test log entry for verification."
        vector = embeddings.embed_query(test_text)
        print(f"✅ Generated Vector (len={len(vector)})")

        # 3. Upsert
        print("Testing Upsert...")
        log_id = f"test_log_{int(time.time())}"
        index.upsert(vectors=[{
            "id": log_id,
            "values": vector,
            "metadata": {"text": test_text}
        }])
        print(f"✅ Successfully Upserted ID: {log_id}")
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    test_pinecone()
