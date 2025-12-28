<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Triad Fitness 

Current fitness and wellness solutions are fragmented. Training apps, nutrition trackers, and sleep monitors live in silos, leading to conflicting advice (e.g., a heavy leg day prescribed after 4 hours of sleep) and eventual burnout or injury. 

**Triad Fitness** solves this by synthesizing physiological stress (training) with psychological recovery (wellness) into a single, cohesive daily strategy.

##  Key Features
* *👁️ Real-Time Form Analysis:* Uses *Computer Vision (MediaPipe)* to count reps and analyze squat depth/form via webcam in real-time.
* *🧠 Context-Aware Memory:* Uses *Vector RAG (Pinecone)* to remember your past workouts, injuries, and nutrition status (e.g., "Fasted" or "Low Sleep").
* *🛡️ Dynamic Regression:* The Agent automatically *downgrades* workout intensity if the user is stressed or sleep-deprived to prevent injury.
* *🤖 Multi-Agent Orchestration:* A team of specialized AI agents (Trainer, Nutritionist, Wellness) debate and agree on the best plan for today.


##  Key Features
* *👁️ Real-Time Form Analysis:* Uses *Computer Vision (MediaPipe)* to count reps and analyze squat depth/form via webcam in real-time.
* *🧠 Context-Aware Memory:* Uses *Vector RAG (Pinecone)* to remember your past workouts, injuries, and nutrition status (e.g., "Fasted" or "Low Sleep").
* *🛡️ Dynamic Regression:* The Agent automatically *downgrades* workout intensity if the user is stressed or sleep-deprived to prevent injury.
* *🤖 Multi-Agent Orchestration:* A team of specialized AI agents (Trainer, Nutritionist, Wellness) debate and agree on the best plan for today.

##  Target Audience / TAM : 

- **The High-Performance Professional:** Needs peak cognitive function and a plan that adapts instantly to limited sleep or high stress.
- **The Amateur Athletes , Students , Working Professionals :** Needs nutrition and recovery that dynamically adjusts to training intensity.
- **The Biohackers :** Demands granular, data-driven micro-interventions based on HRV, RHR, and REM sleep.


## 🧠 Agentic Architecture

We use a **Hierarchical "Hub and Spoke" Agentic Workflow** to mimic a team of specialized human coaches debating your needs.

### The Agents
1.  **Manager Agent (The Head Coach):** Interfaces with the user and resolves conflicts. It synthesizes inputs from all specialists into one cohesive Daily Briefing.
2.  **Wellness Agent (Recovery Specialist):** Analyzes biometrics (Sleep, HRV, RHR) to determine a "Readiness Score" and set intensity caps (the safety brake).
3.  **Physical Trainer Agent (Strength Coach):** Designs specific workout protocols (Hypertrophy/Endurance) tailored to the user's goals but strictly adhering to the Wellness Agent's intensity caps.
4.  **Nutrition Agent (Dietician/Chef):** Calculates dynamic caloric/macro needs based *specifically* on the workout assigned by the Trainer.

### The Workflow
1.  **wellness_check**: Manager calls Wellness Agent → Returns **Readiness State**.
2.  **workout_design**: Manager passes Readiness to Trainer → Returns **Scaled Workout**.
3.  **fuel_calc**: Manager passes Workout to Nutritionist → Returns **Precision Meal Plan**.
4.  **synthesis**: Manager aggregates all three into a JSON response for the **Daily Briefing**.

---

## Quick Start Guide

### Prerequisites
- **Python 3.10+**
- **Node.js 18+**

### 1. Backend Setup (FastAPI)

1.  Navigate to the project root (`triad-fitness`).
2.  Create and activate a virtual environment:
    ```bash
    python -m venv .venv
    # Windows:
    .\.venv\Scripts\activate
    # Mac/Linux:
    source .venv/bin/activate
    ```
3.  Install dependencies:
    ```bash
    pip install -r backend/requirements.txt
    ```
4.  Set up environment variables in `backend/.env` (Gemini API Key, Pinecone API Key).
5.  Start the server:
    ```bash
    python -m uvicorn backend.server:app --reload --host 127.0.0.1 --port 8000
    ```

### 2. Frontend Setup (React)

1.  Navigate to the `frontend` directory:
    ```bash
    cd frontend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the development server:
    ```bash
    npm run dev
    ```
4.  Open **[http://localhost:3000](http://localhost:3000)** to view the app.

