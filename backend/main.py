
import os
from crewai import Crew, Process
from agents import FitnessAgents
from tasks import FitnessTasks
from dotenv import load_dotenv

load_dotenv()

def main():
    print("## BOOTING PERSONAL TRAINER (Independent Mode) ##")
    
    exercise_choice = input("What are we training today? (Squat/Pushup): ")

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

    # 3. Run
    print(f"\n... Agent connecting to Cloud DB & initializing {exercise_choice} Tool...")
    result = crew.kickoff()

    print("\n\n################################################")
    print("##   FINAL PERSONALIZED SESSION PLAN         ##")
    print("################################################\n")
    print(result)

if __name__ == "__main__":
    main()
