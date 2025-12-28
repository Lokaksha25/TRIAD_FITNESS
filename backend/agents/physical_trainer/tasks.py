from crewai import Task

class PhysicalTrainerTasks:
    def technical_workout_task(self, agent, exercise_choice):
        return Task(
            description=(
                f"The user wants to perform **{exercise_choice}**.\n\n"
                
                "**STEP 1: GATHER CONTEXT (Use RAG Tool)**\n"
                "- Query the database for 'current nutrition status' and 'wellness report'.\n"
                "- Look for keywords like 'Fasted', 'Low Carbs', 'Poor Sleep', or 'Stress'.\n\n"
                
                "**STEP 2: CHECK SCHEDULE (Use Calendar Tool)**\n"
                "- Find out exactly how much free time is available right now.\n\n"
                
                "**STEP 3: ANALYZE FORM (Use Vision Tool)**\n"
                "- Activate the `{exercise_choice}AnalysisTool`.\n"
                "- WAIT for the user to complete reps and for the tool to return the report.\n\n"
                
                "**STEP 4: SYNTHESIZE & PRESCRIBE**\n"
                "- Create a session plan. \n"
                "- IF Context says 'Low Energy' OR Form says 'Bad Technique' -> Reduce Intensity/Weight.\n"
                "- IF Context says 'High Energy' AND Form says 'Good' -> Suggest Progressive Overload.\n\n"

                # --- NEW STEP ADDED HERE ---
                "**STEP 5: RECORD SESSION (Use Save Tool)**\n"
                "- Use `SaveWorkoutToCloud` to save the results.\n"
                "- Input should include: Reps count, Form Feedback, and the Session Plan."
            ),
            expected_output=(
                "A Markdown Workout Plan containing:\n"
                "1. **Context Analysis**: (e.g., 'Noted you are fasted and sleep-deprived').\n"
                "2. **Form Report**: (e.g., 'Rep 3 depth was shallow').\n"
                "3. **The Prescribed Session**: Specific Warmup, Sets, Reps, and Cooldown tailored to the data.\n"
                "4. **Save Confirmation**: Verification that the session was saved to the Cloud DB."
            ),
            agent=agent
        )