import cv2
import mediapipe as mp
import numpy as np
import time
from collections import deque
from crewai.tools import BaseTool

from mediapipe.tasks import python
from mediapipe.tasks.python import vision

class PushupAnalysisTool(BaseTool):
    name: str = "Pushup Analysis Tool"
    description: str = "Analyzes pushup form, logging elbow depth and body alignment (hip sag) for the Agent."

    def _calculate_angle(self, a, b, c):
        """Calculates the angle between three points."""
        a = np.array(a) 
        b = np.array(b) 
        c = np.array(c) 
        
        radians = np.arctan2(c[1]-b[1], c[0]-b[0]) - np.arctan2(a[1]-b[1], a[0]-b[0])
        angle = np.abs(radians*180.0/np.pi)
        
        if angle > 180.0:
            angle = 360-angle
        return angle

    def _draw_progress_bar(self, image, angle, down_thresh, up_thresh):
        """Draws a visual bar showing rep progress (Restored Feature)."""
        # Map 170deg (Straight) -> 0%, 80deg (Bent) -> 100%
        percentage = np.interp(angle, (80, 170), (100, 0))
        
        bar_x, bar_y = 550, 100
        bar_w, bar_h = 35, 300
        
        # Color Coding
        if angle <= down_thresh:
            color = (0, 255, 0) # Green (Good)
        elif angle <= down_thresh + 20:
            color = (0, 255, 255) # Yellow (Close)
        else:
            color = (0, 0, 255) # Red (Far)

        # Draw Background
        cv2.rectangle(image, (bar_x, bar_y), (bar_x+bar_w, bar_y+bar_h), (200, 200, 200), -1)
        # Draw Fill
        fill_h = int(bar_h * (percentage / 100))
        cv2.rectangle(image, (bar_x, bar_y + bar_h - fill_h), (bar_x+bar_w, bar_y+bar_h), color, -1)
        
        # Draw Target Line
        target_y = int(np.interp(down_thresh, (80, 170), (bar_y + bar_h, bar_y)))
        cv2.line(image, (bar_x-10, target_y), (bar_x+bar_w+10, target_y), (0,0,0), 3)

    def _run(self, video_path: str = None) -> str:
        # 1. SETUP MODEL - Use absolute path relative to this file's location
        import os
        model_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'pose_landmarker_lite.task')
        base_options = python.BaseOptions(model_asset_path=model_path)
        options = vision.PoseLandmarkerOptions(
            base_options=base_options,
            running_mode=vision.RunningMode.VIDEO
        )
        detector = vision.PoseLandmarker.create_from_options(options)

        cap = cv2.VideoCapture(0)
        
        reps = 0
        stage = "up"
        
        # --- DATA LOGGING & LOGIC ---
        rep_history = []
        current_rep_issues = set()
        min_elbow_angle = 180
        min_body_alignment = 180 
        
        angle_buffer = deque(maxlen=5)
        start_shoulder_y = 0 
        
        # THRESHOLDS
        PUSH_DOWN_THRESHOLD = 110
        PUSH_UP_THRESHOLD = 160
        MIN_VERTICAL_TRAVEL = 0.05
        SAG_THRESHOLD = 150 # Body alignment limit
        
        start_time = time.time()

        # CRITICAL: Create the window explicitly before the loop
        # This is required when running through FastAPI/uvicorn
        WINDOW_NAME = 'Pushup Analysis'
        cv2.namedWindow(WINDOW_NAME, cv2.WINDOW_AUTOSIZE)
        cv2.startWindowThread()
        print("💪 [PushupTool] Window created, starting capture loop...", flush=True)

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            
            rgb_image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_image)
            timestamp_ms = int((time.time() - start_time) * 1000)
            
            detection_result = detector.detect_for_video(mp_image, timestamp_ms)
            
            status_msg = "SEARCHING"
            status_color = (100, 100, 100)
            
            if detection_result.pose_landmarks:
                landmarks = detection_result.pose_landmarks[0]
                
                # Auto-detect Side
                if landmarks[11].visibility > landmarks[12].visibility:
                    # LEFT
                    shoulder = [landmarks[11].x, landmarks[11].y]
                    elbow = [landmarks[13].x, landmarks[13].y]
                    wrist = [landmarks[15].x, landmarks[15].y]
                    hip = [landmarks[23].x, landmarks[23].y]
                    ankle = [landmarks[27].x, landmarks[27].y]
                else:
                    # RIGHT
                    shoulder = [landmarks[12].x, landmarks[12].y]
                    elbow = [landmarks[14].x, landmarks[14].y]
                    wrist = [landmarks[16].x, landmarks[16].y]
                    hip = [landmarks[24].x, landmarks[24].y]
                    ankle = [landmarks[28].x, landmarks[28].y]

                # --- CALCULATIONS ---
                # 1. Elbow Angle (Smoothed)
                raw_angle = self._calculate_angle(shoulder, elbow, wrist)
                angle_buffer.append(raw_angle)
                avg_angle = sum(angle_buffer) / len(angle_buffer)
                
                # 2. Body Alignment (Hip Sag check)
                body_line_angle = self._calculate_angle(shoulder, hip, ankle)

                # 3. Vertical Travel (Anti-Cheat)
                if stage == "up":
                    if start_shoulder_y == 0: start_shoulder_y = shoulder[1]
                    else: start_shoulder_y = (start_shoulder_y * 0.9) + (shoulder[1] * 0.1)
                current_vertical_dist = shoulder[1] - start_shoulder_y

                # --- STATE MACHINE ---
                if avg_angle < PUSH_DOWN_THRESHOLD:
                    # Valid Rep Check: Did shoulder drop?
                    if current_vertical_dist > MIN_VERTICAL_TRAVEL:
                        if stage == "up":
                            stage = "down"
                            # Reset rep metrics
                            min_elbow_angle = 180
                            min_body_alignment = 180
                            current_rep_issues = set()
                        
                        status_msg = "DOWN (Good)"
                        status_color = (0, 255, 0)
                        
                        # Track Metrics
                        if avg_angle < min_elbow_angle:
                            min_elbow_angle = int(avg_angle)
                        if body_line_angle < min_body_alignment:
                            min_body_alignment = int(body_line_angle)
                        
                        # Live Form Feedback (Sagging)
                        if body_line_angle < SAG_THRESHOLD:
                            current_rep_issues.add("Hips Sagging")
                            cv2.putText(frame, "LIFT HIPS!", (10, 200), cv2.FONT_HERSHEY_SIMPLEX, 1, (0,0,255), 3)

                    else:
                        status_msg = "FAKE (Shoulder Static)"
                        status_color = (0, 0, 255)
                            
                elif avg_angle > PUSH_UP_THRESHOLD:
                    if stage == "down":
                        reps += 1
                        stage = "up"
                        start_shoulder_y = shoulder[1] # Reset height
                        
                        # --- COMPILE REP REPORT ---
                        issue_str = ", ".join(current_rep_issues) if current_rep_issues else "None"
                        log_entry = (f"Rep {reps}: Depth {min_elbow_angle} deg, "
                                     f"Alignment {min_body_alignment} deg. Issues: {issue_str}")
                        rep_history.append(log_entry)
                    
                    status_msg = "UP"
                    status_color = (255, 255, 0)

                # --- DRAWING ---
                # 1. Info Box
                cv2.rectangle(frame, (0,0), (380, 130), (245,117,16), -1)
                
                cv2.putText(frame, f"REPS: {reps}", (10,40), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (255,255,255), 2)
                cv2.putText(frame, f"ANGLE: {int(avg_angle)}", (10,80), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255,255,255), 1)
                cv2.putText(frame, status_msg, (10, 120), cv2.FONT_HERSHEY_SIMPLEX, 0.6, status_color, 2)
                
                # 2. Debug Overlay (Restored Feature)
                cv2.putText(frame, f"Vert Dist: {current_vertical_dist:.3f}", (400, 30), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 0), 1)
                
                if current_vertical_dist > MIN_VERTICAL_TRAVEL:
                    cv2.circle(frame, (380, 30), 5, (0, 255, 0), -1) # Green Dot
                else:
                    cv2.circle(frame, (380, 30), 5, (0, 0, 255), -1) # Red Dot

                # 3. Progress Bar (Restored Feature)
                self._draw_progress_bar(frame, avg_angle, PUSH_DOWN_THRESHOLD, PUSH_UP_THRESHOLD)

            cv2.imshow(WINDOW_NAME, frame)
            
            # Check shared stop signal + 'q' key
            import backend.session_state as session_state
            if session_state.should_stop():
                print("🛑 Stop signal received in Pushup Tool.")
                break

            if cv2.waitKey(10) & 0xFF == ord('q'): break

        cap.release()
        cv2.destroyAllWindows()
        detector.close() 

        # --- GENERATE AGENT REPORT ---
        report = f"EXERCISE: PUSHUP\nTOTAL REPS: {reps}\n\nDETAILED REP HISTORY:\n"
        if not rep_history:
            report += "No completed reps detected."
        else:
            report += "\n".join(rep_history)
            
        return report

if __name__ == "__main__":
    tool = PushupAnalysisTool()
    print(tool._run())
