import cv2
import mediapipe as mp
import numpy as np
import time
from collections import deque
from crewai.tools import BaseTool

from mediapipe.tasks import python
from mediapipe.tasks.python import vision

class SquatAnalysisTool(BaseTool):
    name: str = "Squat Analysis Tool"
    description: str = "Analyzes squat form with lunge filtering, rep counting, and posture logging."

    def _calculate_angle(self, a, b, c):
        """Calculates 2D angle between three points."""
        a = np.array(a) 
        b = np.array(b) 
        c = np.array(c) 
        
        radians = np.arctan2(c[1]-b[1], c[0]-b[0]) - np.arctan2(a[1]-b[1], a[0]-b[0])
        angle = np.abs(radians*180.0/np.pi)
        
        if angle > 180.0:
            angle = 360-angle
        return angle

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
        
        # --- DATA LOGGING ---
        rep_history = []  
        current_rep_issues = set() 
        min_depth_angle_detected = 180
        max_back_angle_detected = 0
        
        # Smoothing & Logic
        angle_buffer = deque(maxlen=5)
        start_hip_y = 0 
        
        # THRESHOLDS
        SQ_DEPTH_THRESHOLD = 110  
        SQ_UP_THRESHOLD = 160     
        MIN_VERTICAL_TRAVEL = 0.05 
        MAX_BACK_LEAN = 45 
        
        # LUNGE FILTERS
        # If ankles are this far apart (in X) during side view -> LUNGE
        MAX_ANKLE_SPREAD_X = 0.15 
        # If knees are this far apart (in Y) -> LUNGE (one knee dropped)
        MAX_KNEE_HEIGHT_DIFF = 0.15

        start_time = time.time()

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            
            rgb_image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_image)
            timestamp_ms = int((time.time() - start_time) * 1000)
            
            detection_result = detector.detect_for_video(mp_image, timestamp_ms)
            status_msg = "Stand Up"
            status_color = (255, 255, 0)
            
            if detection_result.pose_landmarks:
                landmarks = detection_result.pose_landmarks[0]
                
                # Check Visibility to determine View and Side
                l_vis = landmarks[23].visibility
                r_vis = landmarks[24].visibility
                
                # Heuristic: Large visibility diff = Side View. Similar vis = Front View.
                is_side_view = abs(l_vis - r_vis) > 0.2
                
                if l_vis > r_vis:
                    side = "LEFT"
                    hip = [landmarks[23].x, landmarks[23].y]
                    knee = [landmarks[25].x, landmarks[25].y]
                    ankle = [landmarks[27].x, landmarks[27].y]
                    shoulder = [landmarks[11].x, landmarks[11].y]
                else:
                    side = "RIGHT"
                    hip = [landmarks[24].x, landmarks[24].y]
                    knee = [landmarks[26].x, landmarks[26].y]
                    ankle = [landmarks[28].x, landmarks[28].y]
                    shoulder = [landmarks[12].x, landmarks[12].y]
                
                # --- METRICS ---
                raw_angle = self._calculate_angle(hip, knee, ankle)
                angle_buffer.append(raw_angle)
                avg_angle = sum(angle_buffer) / len(angle_buffer)
                
                # Back Angle
                vertical_point = [hip[0], hip[1] - 0.5]
                back_angle = self._calculate_angle(vertical_point, hip, shoulder)

                # Vertical Travel
                if stage == "up":
                    if start_hip_y == 0: start_hip_y = hip[1]
                    else: start_hip_y = (start_hip_y * 0.9) + (hip[1] * 0.1)
                current_vertical_dist = hip[1] - start_hip_y

                # --- LUNGE DETECTION LOGIC ---
                is_lunge = False
                
                # Check 1: Stance Width (X-axis Spread) - Critical for Side View
                l_ankle_x = landmarks[27].x
                r_ankle_x = landmarks[28].x
                ankle_spread = abs(l_ankle_x - r_ankle_x)
                
                # Check 2: Knee Level (Y-axis Symmetry)
                l_knee_y = landmarks[25].y
                r_knee_y = landmarks[26].y
                knee_height_diff = abs(l_knee_y - r_knee_y)
                
                # If side view and feet are far apart -> LUNGE
                if is_side_view and ankle_spread > MAX_ANKLE_SPREAD_X:
                    is_lunge = True
                    cv2.putText(frame, "SPLIT STANCE (LUNGE?)", (10, 160), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 165, 255), 2)
                
                # If knees are uneven (one dropping much lower) -> LUNGE
                if knee_height_diff > MAX_KNEE_HEIGHT_DIFF:
                    is_lunge = True
                    cv2.putText(frame, "UNEVEN KNEES (LUNGE?)", (10, 185), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 165, 255), 2)

                # --- SQUAT STATE MACHINE ---
                if is_lunge:
                    status_msg = "LUNGE DETECTED - IGNORED"
                    status_color = (0, 0, 255) # Red
                
                elif avg_angle < SQ_DEPTH_THRESHOLD:
                    if current_vertical_dist > MIN_VERTICAL_TRAVEL:
                        if stage == "up":
                            stage = "down"
                            min_depth_angle_detected = 180
                            max_back_angle_detected = 0
                            current_rep_issues = set()
                        
                        status_msg = "DOWN"
                        status_color = (0, 255, 0) # Green
                        
                        # Track Metrics
                        if avg_angle < min_depth_angle_detected:
                            min_depth_angle_detected = int(avg_angle)
                        if back_angle > max_back_angle_detected:
                            max_back_angle_detected = int(back_angle)
                        
                        # Live Form Check
                        if back_angle > MAX_BACK_LEAN:
                            current_rep_issues.add("Excessive Forward Lean")
                            cv2.putText(frame, "KEEP CHEST UP!", (10, 220), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,0,255), 2)

                elif avg_angle > SQ_UP_THRESHOLD:
                    if stage == "down":
                        reps += 1
                        stage = "up"
                        start_hip_y = hip[1]
                        
                        # Log Data
                        depth_status = "Good Depth"
                        if min_depth_angle_detected > 90:
                            depth_status = "Shallow"
                            current_rep_issues.add("Did not hit parallel")
                        
                        issue_str = ", ".join(current_rep_issues) if current_rep_issues else "None"
                        log_entry = (f"Rep {reps}: Depth {min_depth_angle_detected} deg ({depth_status}), "
                                     f"Max Lean {max_back_angle_detected} deg. Issues: {issue_str}")
                        rep_history.append(log_entry)
                    
                    status_msg = "UP"
                    status_color = (255, 255, 0)

                # Drawing
                cv2.rectangle(frame, (0,0), (450, 130), (245,117,16), -1)
                cv2.putText(frame, f"REPS: {reps}", (10,40), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (255,255,255), 2)
                cv2.putText(frame, f"Angle: {int(avg_angle)}", (10,80), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255,255,255), 1)
                cv2.putText(frame, status_msg, (10, 120), cv2.FONT_HERSHEY_SIMPLEX, 0.6, status_color, 2)
                
                # Debug info for lunge
                # cv2.putText(frame, f"Sprd: {ankle_spread:.2f} KnDiff: {knee_height_diff:.2f}", (200, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255,255,255), 1)

            cv2.imshow('Squat Analysis', frame)
            if cv2.waitKey(10) & 0xFF == ord('q'): break

        cap.release()
        cv2.destroyAllWindows()
        detector.close() 
        
        report = f"EXERCISE: SQUAT\nTOTAL REPS: {reps}\n\nDETAILED REP HISTORY:\n"
        if not rep_history:
            report += "No completed reps detected."
        else:
            report += "\n".join(rep_history)
            
        return report

if __name__ == "__main__":
    tool = SquatAnalysisTool()
    print(tool._run())