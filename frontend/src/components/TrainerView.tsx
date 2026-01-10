import React, { useState } from 'react';
import { AlertTriangle, Activity, Play, CheckCircle, Terminal, FileText, BarChart3, ChevronDown, ChevronUp, Moon, Brain, Zap, Target, Dumbbell, Clock, Flame, Heart, TrendingUp } from 'lucide-react';
import TrainerReport from './TrainerReportTest';
import { useAuth } from '../context/AuthContext';
import CustomSelect from './ui/CustomSelect';

// --- VISUALIZATION COMPONENTS (SVG) ---

interface SkeletonProps {
  issues: string[];
}

const SquatSkeleton: React.FC<SkeletonProps> = ({ issues }) => {
  const hasValgus = issues.includes('knee_valgus');
  const color = hasValgus ? '#ef4444' : '#22c55e'; // Red vs Green

  // Knee X positions: Normal vs Valgus (caving in)
  const leftKneeX = hasValgus ? 110 : 90;
  const rightKneeX = hasValgus ? 130 : 150;

  return (
    <div className="relative w-full h-full flex items-center justify-center opacity-90">
      <svg width="240" height="360" viewBox="0 0 240 360" className="drop-shadow-lg">
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Grid Lines (Optional style) */}
        <line x1="120" y1="0" x2="120" y2="360" stroke="#333" strokeWidth="1" strokeDasharray="4 4" />

        {/* Head */}
        <circle cx="120" cy="40" r="20" stroke="#94a3b8" strokeWidth="4" fill="#0f172a" />

        {/* Torso */}
        <line x1="120" y1="60" x2="120" y2="160" stroke="#94a3b8" strokeWidth="6" strokeLinecap="round" />

        {/* Hips */}
        <line x1="90" y1="160" x2="150" y2="160" stroke="#94a3b8" strokeWidth="6" strokeLinecap="round" />

        {/* Left Leg */}
        <line x1="90" y1="160" x2={leftKneeX} y2="240" stroke={color} strokeWidth="6" strokeLinecap="round" />
        <line x1={leftKneeX} y1="240" x2="90" y2="320" stroke={color} strokeWidth="6" strokeLinecap="round" />

        {/* Right Leg */}
        <line x1="150" y1="160" x2={rightKneeX} y2="240" stroke={color} strokeWidth="6" strokeLinecap="round" />
        <line x1={rightKneeX} y1="240" x2="150" y2="320" stroke={color} strokeWidth="6" strokeLinecap="round" />

        {/* Joints (Knees) */}
        <circle cx={leftKneeX} cy="240" r="6" fill={color} filter="url(#glow)" />
        <circle cx={rightKneeX} cy="240" r="6" fill={color} filter="url(#glow)" />

        {/* Feet */}
        <line x1="90" y1="320" x2="70" y2="330" stroke="#94a3b8" strokeWidth="4" strokeLinecap="round" />
        <line x1="150" y1="320" x2="170" y2="330" stroke="#94a3b8" strokeWidth="4" strokeLinecap="round" />

        {/* Annotation */}
        {hasValgus && (
          <g transform="translate(160, 230)">
            <rect x="0" y="0" width="100" height="30" rx="4" fill="#1c1917" stroke="#7f1d1d" />
            <text x="10" y="20" fill="#ef4444" fontSize="12" fontWeight="bold">Knee Valgus</text>
            <line x1="-10" y1="10" x2="0" y2="15" stroke="#ef4444" />
          </g>
        )}
      </svg>
    </div>
  );
};

const PushupSkeleton: React.FC<SkeletonProps> = ({ issues }) => {
  const hasSag = issues.includes('hip_sag');
  const color = hasSag ? '#ef4444' : '#22c55e';

  // Hip Y position: Normal (straight) vs Sag (drop)
  const hipY = hasSag ? 200 : 160;

  return (
    <div className="relative w-full h-full flex items-center justify-center opacity-90">
      <svg width="360" height="240" viewBox="0 0 360 240" className="drop-shadow-lg">
        <defs>
          <filter id="glowP" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Floor */}
        <line x1="20" y1="230" x2="340" y2="230" stroke="#444" strokeWidth="2" />

        {/* Head */}
        <circle cx="60" cy="140" r="15" stroke="#94a3b8" strokeWidth="4" fill="#0f172a" />

        {/* Arms */}
        <line x1="80" y1="150" x2="80" y2="230" stroke="#94a3b8" strokeWidth="5" strokeLinecap="round" />

        {/* Torso (Shoulder to Hip) */}
        {/* Shoulder approx at 80,140 */}
        <line x1="80" y1="150" x2="180" y2={hipY} stroke={color} strokeWidth="5" strokeLinecap="round" />

        {/* Legs (Hip to Feet) */}
        <line x1="180" y1={hipY} x2="300" y2="220" stroke={color} strokeWidth="5" strokeLinecap="round" />

        {/* Hip Joint */}
        <circle cx="180" cy={hipY} r="6" fill={color} filter="url(#glowP)" />

        {/* Feet */}
        <circle cx="300" cy="220" r="5" fill="#94a3b8" />

        {/* Annotation */}
        {hasSag && (
          <g transform="translate(180, 240)">
            {/* Centered text tweak */}
            <text x="-30" y="-20" fill="#ef4444" fontSize="12" fontWeight="bold">Hip Sag Detected</text>
            <path d="M 0 -10 L 0 -30" stroke="#ef4444" strokeDasharray="2 2" />
          </g>
        )}
      </svg>
    </div>
  );
};

// --- PARSED WORKOUT PLAN TYPES ---

interface WellnessContext {
  calorieState: string;
  sleepHours: number;
  stressLevel: string;
  hrv: string;
  timeSlot: string;
}

interface FormReport {
  reps: number;
  depthRange: string;
  posture: string;
  issues: string[];
}

interface Exercise {
  name: string;
  reps: string;
  isCompleted?: boolean;
}

interface ParsedWorkoutPlan {
  title: string;
  contextAnalysis: WellnessContext | null;
  formReport: FormReport | null;
  prescribedSession: string;
  goal: string;
  warmupExercises: Exercise[];
  mainWorkout: Exercise[];
  cooldown: Exercise[];
}

// Parser function to extract structured data
const parseWorkoutPlan = (text: string): ParsedWorkoutPlan | null => {
  if (!text) return null;

  const result: ParsedWorkoutPlan = {
    title: '',
    contextAnalysis: null,
    formReport: null,
    prescribedSession: '',
    goal: '',
    warmupExercises: [],
    mainWorkout: [],
    cooldown: [],
  };

  try {
    // Extract title
    const titleMatch = text.match(/###\s*(.+)/);
    if (titleMatch) {
      result.title = titleMatch[1].trim();
    }

    // Extract Context Analysis (handles "### 1. Context Analysis:" format)
    const contextMatch = text.match(/(?:###?\s*\d*\.?\s*)?\*?\*?Context Analysis\*?\*?:?\s*\n([\s\S]*?)(?=(?:###?\s*\d*\.?\s*)?\*?\*?Form Report|(?:###?\s*\d*\.?\s*)?\*?\*?The Prescribed)/i);
    if (contextMatch) {
      const contextText = contextMatch[1];
      result.contextAnalysis = {
        calorieState: contextText.includes('caloric deficit') ? 'Deficit' : contextText.includes('surplus') ? 'Surplus' : 'Maintenance',
        sleepHours: parseFloat(contextText.match(/(\d+)\s*hours?\s*(sleep|of sleep)/i)?.[1] || '7'),
        stressLevel: contextText.includes('high') && contextText.includes('stress') ? 'High' : 'Moderate',
        hrv: contextText.includes('low') && contextText.includes('HRV') ? 'Low' : 'Normal',
        timeSlot: (contextText.match(/(\d+)-minute\s*free\s*slot/i)?.[1] ?? '45') + ' min',
      };
    }

    // Extract Form Report (handles "### 2. Form Report:" format)
    const formMatch = text.match(/(?:###?\s*\d*\.?\s*)?\*?\*?Form Report\*?\*?:?\s*\n([\s\S]*?)(?=(?:###?\s*\d*\.?\s*)?\*?\*?The Prescribed|$)/i);
    if (formMatch) {
      const formText = formMatch[1];
      // Match various reps formats: "5 reps", "**5 squats**", "completed 5 squats"
      const repsMatch = formText.match(/(?:completed\s+)?\*?\*?(\d+)\s*\*?\*?\s*(squats?|pushups?|reps?)/i);
      const depthMatch = formText.match(/(\d+-\d+)\s*deg/i) || formText.match(/Depth\s+(\d+)\s*deg/i);

      result.formReport = {
        reps: repsMatch ? parseInt(repsMatch[1]) : 0,
        depthRange: depthMatch ? depthMatch[1] + '°' : 'Good',
        posture: formText.toLowerCase().includes('excellent') || formText.toLowerCase().includes('good form') || formText.toLowerCase().includes('solid technique') ? 'Good' : 'Needs work',
        issues: formText.toLowerCase().includes('no issues') || formText.toLowerCase().includes('excellent') ? [] : ['Minor form adjustments needed'],
      };
    }

    // Extract Prescribed Session (handles "### 3. The Prescribed Session:" format)
    const sessionMatch = text.match(/(?:###?\s*\d*\.?\s*)?\*?\*?The Prescribed Session\*?\*?:?\s*\n([\s\S]*?)(?=(?:###?\s*\d*\.?\s*)?\*?\*?(?:Goal|Save Confirmation|\d+\.)\*?\*?|$)/i);
    if (sessionMatch) {
      result.prescribedSession = sessionMatch[1].trim();
    }

    // Extract Goal
    const goalMatch = text.match(/\*?\*?Goal\*?\*?:\s*([^\n]+)/i);
    if (goalMatch) {
      result.goal = goalMatch[1].trim();
    }

    // Extract Warm-up exercises
    const warmupMatch = text.match(/\*?\*?Warm-up\s*\([^)]+\)\*?\*?:\s*\n([\s\S]*?)(?=\*?\*?Main|$)/i);
    if (warmupMatch) {
      const exercises = warmupMatch[1].matchAll(/\*\s*([^:]+):\s*([^\n]+)/g);
      for (const ex of exercises) {
        result.warmupExercises.push({
          name: ex[1].replace(/\*\*/g, '').trim(),
          reps: ex[2].trim(),
        });
      }
    }

    // Extract Main workout
    const mainMatch = text.match(/\*?\*?Main\s*Workout\*?\*?:\s*\n([\s\S]*?)(?=\*?\*?Cool|$)/i);
    if (mainMatch) {
      const exercises = mainMatch[1].matchAll(/\*\s*([^:]+):\s*([^\n]+)/g);
      for (const ex of exercises) {
        result.mainWorkout.push({
          name: ex[1].replace(/\*\*/g, '').trim(),
          reps: ex[2].trim(),
        });
      }
    }

    // Extract Cooldown
    const coolMatch = text.match(/\*?\*?Cool-?down\*?\*?:\s*\n([\s\S]*?)$/i);
    if (coolMatch) {
      const exercises = coolMatch[1].matchAll(/\*\s*([^:]+):\s*([^\n]+)/g);
      for (const ex of exercises) {
        result.cooldown.push({
          name: ex[1].replace(/\*\*/g, '').trim(),
          reps: ex[2].trim(),
        });
      }
    }

    // IMPORTANT: Return null if no meaningful structured content was found
    // This allows the raw text fallback to display instead of empty structured UI
    const hasMeaningfulContent =
      result.title ||
      result.contextAnalysis ||
      result.formReport ||
      result.prescribedSession ||
      result.goal ||
      result.warmupExercises.length > 0 ||
      result.mainWorkout.length > 0 ||
      result.cooldown.length > 0;

    if (!hasMeaningfulContent) {
      return null;
    }

    return result;
  } catch (e) {
    console.error('Failed to parse workout plan:', e);
    return null;
  }
};

// --- INTERACTIVE COMPONENTS ---

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string;
  badgeColor?: string;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title, icon, children, defaultOpen = false, badge, badgeColor = 'bg-secondary text-muted-foreground'
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-secondary transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center border border-border">
            {icon}
          </div>
          <span className="font-semibold text-foreground">{title}</span>
          {badge && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badgeColor}`}>
              {badge}
            </span>
          )}
        </div>
        <div className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
          <ChevronDown className="text-muted-foreground" size={20} />
        </div>
      </button>
      <div className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
        <div className="px-5 pb-5 border-t border-border">
          {children}
        </div>
      </div>
    </div>
  );
};

interface ExerciseCardProps {
  exercise: Exercise;
  index: number;
  onToggle?: () => void;
}

const ExerciseCard: React.FC<ExerciseCardProps> = ({ exercise, index, onToggle }) => {
  const [completed, setCompleted] = useState(false);

  return (
    <div
      onClick={() => { setCompleted(!completed); onToggle?.(); }}
      className={`group cursor-pointer p-4 rounded-xl border transition-all duration-300
        ${completed
          ? 'bg-emerald-950/50 border-emerald-800'
          : 'bg-card border-border hover:border-muted'
        }`}
    >
      <div className="flex items-center gap-4">
        {/* Checkbox */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all
          ${completed
            ? 'bg-emerald-500 text-white'
            : 'bg-secondary text-muted-foreground group-hover:bg-muted border border-border'
          }`}
        >
          {completed ? <CheckCircle size={18} /> : <span className="text-sm font-bold">{index + 1}</span>}
        </div>

        {/* Exercise Info */}
        <div className="flex-1 min-w-0">
          <p className={`font-medium truncate ${completed ? 'text-emerald-400 line-through' : 'text-foreground'}`}>
            {exercise.name}
          </p>
          <p className={`text-sm ${completed ? 'text-emerald-400/70' : 'text-muted-foreground'}`}>
            {exercise.reps}
          </p>
        </div>

        {/* Visual Indicator */}
        <div className="flex gap-1">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all
                ${completed ? 'bg-emerald-400' : 'bg-muted'}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

interface WellnessIndicatorProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  status: 'good' | 'warning' | 'bad';
}

const WellnessIndicator: React.FC<WellnessIndicatorProps> = ({ icon, label, value, status }) => {
  const colors = {
    good: 'bg-emerald-950/50 border-emerald-800 text-emerald-400',
    warning: 'bg-amber-950/50 border-amber-800 text-amber-400',
    bad: 'bg-red-950/50 border-red-800 text-red-400',
  };

  return (
    <div className={`p-3 rounded-xl border ${colors[status]}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs font-medium opacity-75">{label}</span>
      </div>
      <p className="font-bold text-lg">{value}</p>
    </div>
  );
};

// --- MAIN VIEW ---

const TrainerView: React.FC = () => {
  const { currentUser } = useAuth();
  const [exerciseType, setExerciseType] = useState<string>('Squat');
  const [sessionActive, setSessionActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [workoutPlan, setWorkoutPlan] = useState<string | null>(null);
  const [totalReps, setTotalReps] = useState<number | null>(null);
  const [detectedIssues, setDetectedIssues] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<'success' | 'failed' | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Weekly Plan State
  const [weeklyPlan, setWeeklyPlan] = useState<any>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planStatus, setPlanStatus] = useState<string>('new');
  const [adjustmentReason, setAdjustmentReason] = useState<string>('');

  // General Error State
  const [error, setError] = useState<string | null>(null);

  const stopSession = async () => {
    try {
      // Call backend to signal the CV tools to stop
      await fetch('/api/trainer/stop', { method: 'POST' });
      console.log('🛑 Stop signal sent to backend');
    } catch (err) {
      console.error('Failed to stop session:', err);
    }
    setSessionActive(false);
    setLoading(false);
  };

  const startSession = async () => {
    setLoading(true);
    setSessionActive(true);
    setSaveStatus(null);
    setSaveError(null);
    setDetectedIssues([]);
    setTotalReps(null);

    try {
      const response = await fetch('/api/trainer/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exercise_type: exerciseType,
          user_id: currentUser?.uid || "user_123"
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to start session');
      }

      const data = await response.json();

      setTotalReps(data.total_reps);
      setDetectedIssues(data.detected_issues || []);
      setSaveStatus('success');

    } catch (err: any) {
      console.error('Session error:', err);
      setSaveStatus('failed');
      setSaveError(err.message);
      setSessionActive(false);
      setError(err.message); // Set general error for the visualizer
    } finally {
      setLoading(false);
    }
  };

  // ...

  const fetchWeeklyPlan = async (forceRegenerate: boolean = false) => {
    setPlanLoading(true);
    setPlanError(null);

    try {
      const response = await fetch('/api/trainer/weekly-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser?.uid || "user_123",
          force_regenerate: forceRegenerate
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to fetch weekly plan');
      }

      const data = await response.json();
      setWeeklyPlan(data.plan);
      setPlanStatus(data.status);
      setAdjustmentReason(data.adjustment_reason || '');
      console.log('Weekly plan loaded:', data);
    } catch (err: any) {
      setPlanError(err.message);
      console.error('Weekly plan error:', err);
    } finally {
      setPlanLoading(false);
    }
  };

  // Parse the workout plan
  const parsedPlan = workoutPlan ? parseWorkoutPlan(workoutPlan) : null;

  return (
    <div className="flex flex-col gap-6 h-full pb-12">

      {/* TOP ROW: Controls & Visuals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[500px]">

        {/* Left Col: Live Stats & Monitoring */}
        <div className="lg:col-span-1 space-y-6">
          {/* Stats Card */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm h-full flex flex-col">
            <div className="flex items-center gap-2 mb-6">
              <BarChart3 className="text-muted-foreground" size={20} />
              <h3 className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Session Monitoring</h3>
            </div>

            {!sessionActive ? (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground space-y-4">
                <Activity size={48} className="opacity-20" />
                <p className="text-sm font-medium">Ready to start session</p>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in duration-500">
                <div className="bg-secondary p-4 rounded-lg border border-border">
                  <span className="block text-xs text-muted-foreground uppercase font-bold mb-1">Target Exercise</span>
                  <span className="text-lg font-bold text-foreground">{exerciseType}</span>
                </div>

                {totalReps !== null && (
                  <div className="bg-secondary p-4 rounded-lg border border-border">
                    <span className="block text-xs text-muted-foreground uppercase font-bold mb-1">Total Reps</span>
                    <span className="text-lg font-bold text-foreground">{totalReps}</span>
                  </div>
                )}

                <div className="bg-secondary p-4 rounded-lg border border-border">
                  <span className="block text-xs text-muted-foreground uppercase font-bold mb-1">Status</span>
                  {loading ? (
                    <span className="flex items-center gap-2 text-blue-400 font-bold text-sm">
                      <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
                      Analyzing Form...
                    </span>
                  ) : (
                    <div className="space-y-2">
                      <span className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                        <CheckCircle size={14} />
                        Analysis Complete
                      </span>

                      {/* Save Status Indicator */}
                      {saveStatus === 'success' && (
                        <span className="flex items-center gap-2 text-muted-foreground text-xs">
                          <CheckCircle size={12} />
                          Log Saved to Cloud
                        </span>
                      )}
                      {saveStatus === 'failed' && (
                        <div className="text-red-400 text-xs">
                          <div className="flex items-center gap-2 font-bold">
                            <AlertTriangle size={12} />
                            Save Failed
                          </div>
                          <p className="mt-1 opacity-75">{saveError}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {!loading && detectedIssues.length > 0 && (
                  <div className="bg-red-950/50 p-4 rounded-lg border border-red-800">
                    <div className="flex items-center gap-2 text-red-400 font-bold text-sm mb-2">
                      <AlertTriangle size={16} />
                      <span>Issues Detected</span>
                    </div>
                    <ul className="list-disc list-inside text-xs text-red-400/80 space-y-1">
                      {detectedIssues.map((issue, idx) => (
                        <li key={idx} className="capitalize">{issue.replace('_', ' ')}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {!loading && detectedIssues.length === 0 && workoutPlan && (
                  <div className="bg-emerald-950/50 p-4 rounded-lg border border-emerald-800">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                      <CheckCircle size={16} />
                      <span>Good Form</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Center/Right Col: Agent Visualizer */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Control Header */}
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground">AI Trainer Vision</h2>
              <p className="text-muted-foreground text-xs">Powered by Gemini 1.5 & MediaPipe</p>
            </div>
            <div className="flex items-center gap-3">
              <CustomSelect
                value={exerciseType}
                onChange={setExerciseType}
                disabled={loading}
                options={[
                  { value: 'Squat', label: 'Squat' },
                  { value: 'Pushup', label: 'Pushup' }
                ]}
                className="w-32"
              />
              {loading ? (
                <button
                  onClick={stopSession}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold text-white transition-colors bg-red-600 hover:bg-red-700 animate-pulse"
                >
                  <div className="w-3 h-3 bg-white rounded-sm"></div>
                  <span>End Session</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={startSession}
                    className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold text-white transition-colors bg-slate-700 hover:bg-slate-600"
                  >
                    <Play size={16} fill="currentColor" />
                    <span>Start Session</span>
                  </button>
                  <button
                    onClick={() => fetchWeeklyPlan(false)}
                    disabled={planLoading}
                    className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold text-white transition-colors bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {planLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <Dumbbell size={16} />
                        <span>Weekly Plan</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Visualizer Canvas */}
          <div className="flex-1 bg-card border border-border rounded-xl relative flex flex-col items-center justify-center min-h-[400px] shadow-inner overflow-hidden">
            {/* Background Grid */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px]"></div>

            {error && (
              <div className="z-20 bg-red-950/80 border border-red-800 text-white px-6 py-4 rounded-xl max-w-md text-center backdrop-blur-sm">
                <AlertTriangle className="mx-auto mb-2" />
                <p>{error}</p>
              </div>
            )}

            {loading && (
              <div className="z-20 text-center space-y-4">
                <div className="relative w-24 h-24 mx-auto">
                  <div className="absolute inset-0 border-4 border-border rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-t-blue-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                </div>
                <div>
                  <h3 className="text-foreground font-mono text-lg animate-pulse">Processing Vision Stream...</h3>
                  <p className="text-muted-foreground text-sm mt-2">Look for the popup window to perform {exerciseType}</p>
                </div>
              </div>
            )}

            {/* Skeletons */}
            <div className={`transition-all duration-700 ${loading ? 'opacity-20 blur-sm scale-95' : 'opacity-100 scale-100'}`}>
              {exerciseType === 'Squat' ? (
                <SquatSkeleton issues={detectedIssues} />
              ) : (
                <PushupSkeleton issues={detectedIssues} />
              )}
            </div>

            {/* Metadata Footer */}
            <div className="absolute bottom-4 w-full px-6 pointer-events-none">
              <div className="flex justify-between items-center text-xs text-muted-foreground font-mono border-t border-border pt-3">
                <span>MODE: {loading ? 'LIVE_INFERENCE' : 'RESULT_VIEW'}</span>
                <span>{exerciseType.toUpperCase()}_MODEL_V4</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM ROW: New Agent Report Component */}
      {workoutPlan && (
        <TrainerReport
          plan={workoutPlan}
          totalReps={totalReps ?? 0}
          detectedIssues={detectedIssues}
          formRating={0}
          saveStatus={saveStatus ?? ''}
        />
      )}

      {/* WEEKLY TRAINING PLAN DISPLAY */}
      {weeklyPlan && (
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                  <Dumbbell className="text-white" size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Weekly Training Plan</h3>
                  <p className="text-xs text-muted-foreground">
                    {planStatus === 'cached' ? '📦 Cached Plan' : '✨ Freshly Generated'} ·
                    Expires: {weeklyPlan.expires_date} ·
                    {weeklyPlan.weeks_remaining} weeks remaining
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={() => fetchWeeklyPlan(true)}
              disabled={planLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-foreground bg-secondary hover:bg-muted transition-colors disabled:opacity-50 border border-border"
            >
              <Zap size={14} />
              <span>Force Regenerate</span>
            </button>
          </div>

          {/* Adjustment Reason Badge */}
          {adjustmentReason && (
            <div className="mb-4 p-3 bg-amber-950/50 border border-amber-800 rounded-lg flex items-start gap-2">
              <Target className="text-amber-400 flex-shrink-0 mt-0.5" size={16} />
              <div>
                <p className="text-sm font-medium text-amber-400">Volume Adjustment</p>
                <p className="text-xs text-amber-400/70">{adjustmentReason}</p>
              </div>
            </div>
          )}

          {/* Weekly Schedule Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {weeklyPlan.weekly_schedule?.map((day: any, idx: number) => (
              <div key={idx} className="bg-secondary border border-border rounded-xl p-4 hover:border-muted transition-all">
                {/* Day Header */}
                <div className="mb-3 pb-3 border-b border-border">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-foreground">{day.day}</h4>
                    <Clock className="text-muted-foreground" size={14} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{day.focus}</p>
                </div>

                {/* Exercises */}
                <div className="space-y-2">
                  {day.exercises?.map((exercise: any, exIdx: number) => (
                    <div key={exIdx} className="bg-card p-3 rounded-lg border border-border">
                      <p className="font-medium text-sm text-foreground mb-1">{exercise.name}</p>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="px-2 py-1 bg-blue-950/50 text-blue-400 rounded font-medium border border-blue-800">
                          {exercise.sets} sets
                        </span>
                        <span className="px-2 py-1 bg-emerald-950/50 text-emerald-400 rounded font-medium border border-emerald-800">
                          {exercise.reps} reps
                        </span>
                        {exercise.rest && (
                          <span className="text-muted-foreground">• {exercise.rest}</span>
                        )}
                      </div>
                      {exercise.notes && (
                        <p className="text-xs text-muted-foreground mt-2">{exercise.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Program Notes */}
          {weeklyPlan.program_notes && (
            <div className="mt-6 p-4 bg-secondary border border-border rounded-lg">
              <h4 className="font-bold text-foreground mb-2 flex items-center gap-2">
                <Flame size={16} className="text-orange-400" />
                Program Notes
              </h4>
              <p className="text-sm text-muted-foreground">{weeklyPlan.program_notes}</p>
            </div>
          )}

          {/* Progression Strategy */}
          {weeklyPlan.progression_strategy && (
            <div className="mt-4 p-4 bg-emerald-950/30 border border-emerald-800 rounded-lg">
              <h4 className="font-bold text-emerald-400 mb-2 flex items-center gap-2">
                <TrendingUp size={16} className="text-emerald-400" />
                Progression Strategy
              </h4>
              <p className="text-sm text-emerald-400/70">{weeklyPlan.progression_strategy}</p>
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {planError && (
        <div className="bg-red-950/50 border border-red-800 rounded-xl p-6">
          <div className="flex items-center gap-2 text-red-400 font-bold mb-2">
            <AlertTriangle size={20} />
            <span>Failed to Load Weekly Plan</span>
          </div>
          <p className="text-red-400/70 text-sm">{planError}</p>
          <button
            onClick={() => fetchWeeklyPlan(false)}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

    </div>
  );
};

export default TrainerView;
