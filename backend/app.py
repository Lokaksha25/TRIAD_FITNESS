import streamlit as st
import os
from crewai import Crew, Process
from agents import FitnessAgents
from tasks import FitnessTasks
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
load_dotenv(".env.local") # Explicitly load .env.local if present in parent or current dir

st.set_page_config(page_title="Personal Trainer Agent", layout="wide")

st.title("🏋️ Personal Trainer AI Agent")
st.markdown("""
This agent acts as an elite coach. It analyzes your form (via camera), 
checks your history/nutrition (via RAG), and schedule to create a personalized workout.
""")

# Sidebar for Setup Checks
with st.sidebar:
    st.header("System Status")
    
    api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if api_key:
        st.success("✅ Gemini API Key Detected")
    else:
        st.error("❌ Gemini API Key Missing")
        st.info("Set GEMINI_API_KEY in .env.local")

    if os.environ.get("PINECONE_API_KEY"):
        st.success("✅ Pinecone API Key Detected")
    else:
        st.error("❌ Pinecone API Key Missing")
        
    st.info("Make sure you have run `python seed_db.py` to initialize the database.")

# Main Interface
col1, col2 = st.columns([1, 2])

with col1:
    st.subheader("Session Setup")
    exercise_choice = st.selectbox(
        "Select Exercise",
        ["Squat", "Pushup"],
        index=0
    )
    
    start_btn = st.button("Start Training Session", type="primary")

with col2:
    st.subheader("Agent Output")
    
    if start_btn:
        if not api_key:
            st.error("Please configure your API Keys first.")
        else:
            with st.status("Initializing AI Crew...", expanded=True) as status:
                st.write("Initializing Agents...")
                try:
                    # 1. Initialize
                    agents = FitnessAgents()
                    tasks = FitnessTasks()

                    pt_agent = agents.personal_trainer_agent()
                    task = tasks.technical_workout_task(pt_agent, exercise_choice)

                    # 2. Create Crew
                    crew = Crew(
                        agents=[pt_agent],
                        tasks=[task],
                        process=Process.sequential,


                        
                        verbose=True
                    )

                    st.write(f"🚀 Connecting to Cloud DB & initializing {exercise_choice} Tool...")
                    st.warning("A separate window may open for the camera analysis. Please perform the exercise there, then press 'q' to close it.")
                    
                    # 3. Run
                    result = crew.kickoff()
                    
                    status.update(label="Session Plan Generated!", state="complete", expanded=False)
                    
                    st.markdown("### 📋 Final Personalized Session Plan")
                    st.markdown(result)
                    
                except Exception as e:
                    status.update(label="Error Occurred", state="error")
                    st.error(f"An error occurred: {str(e)}")

st.markdown("---")
st.caption("Powered by CrewAI, Gemini 1.5, MediaPipe, and Pinecone")
