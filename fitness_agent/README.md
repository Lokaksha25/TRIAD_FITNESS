# ⚙️ Setup Instructions

Follow these steps exactly to run the agent on your computer.

### 1. Unzip and Open Terminal
1. Extract the zip file.
2. Open your terminal (Command Prompt or PowerShell).
3. Navigate into the folder:
   ```powershell
   cd path\to\fitness_agent



   # Create the environment
python -m venv .venv

# Activate it
.\.venv\Scripts\Activate


pip install -r requirements.txt   



GOOGLE_API_KEY="YOUR_KEY_HERE"
PINECONE_API_KEY="YOUR_KEY_HERE"
PINECONE_INDEX_NAME="fitness-memory"




uvicorn main:app --reload 




# Activate the environment again
.\.venv\Scripts\Activate

# Run the test script
python test_agent.py 



