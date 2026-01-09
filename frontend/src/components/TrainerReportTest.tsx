import React, { useState } from 'react';
import {
  CheckCircle, AlertTriangle, Activity, Clock, Moon, Brain, Heart,
  Target, Dumbbell, Flame, Zap, ChevronDown, FileText, TrendingUp,
  User, Calendar, Utensils
} from 'lucide-react';

// ============================================================
// NEW TRAINER REPORT COMPONENT - Built from scratch
// Designed to parse the actual agent output format
// ============================================================

// --- TYPES ---

interface WellnessContext {
  calorieState: string;
  sleepHours: number;
  stressLevel: string;
  hrv: string;
  timeSlot: string;
  duration: string;
  rawText: string;
}

interface FormReport {
  exerciseType: string;
  totalReps: number;
  issues: string[];
  goodReps: number;
  badReps: number;
  rawText: string;
}

interface ExerciseItem {
  name: string;
  details: string;
  sets?: string;
  reps?: string;
  tempo?: string;
  rest?: string;
}

interface WorkoutSection {
  title: string;
  duration: string;
  exercises: ExerciseItem[];
  notes: string[];
}

interface ParsedReport {
  title: string;
  contextAnalysis: WellnessContext | null;
  formReport: FormReport | null;
  goal: string;
  duration: string;
  warmup: WorkoutSection | null;
  mainWorkout: WorkoutSection | null;
  cooldown: WorkoutSection | null;
  postWorkoutNotes: string;
  saveConfirmation: string;
  rawText: string;
}

// --- PARSER ---

const parseAgentReport = (text: string): ParsedReport => {
  const result: ParsedReport = {
    title: '',
    contextAnalysis: null,
    formReport: null,
    goal: '',
    duration: '',
    warmup: null,
    mainWorkout: null,
    cooldown: null,
    postWorkoutNotes: '',
    saveConfirmation: '',
    rawText: text,
  };

  if (!text) return result;

  // --- Extract Title ---
  // Matches: "## Hyper-Personalized Pushup Session" or "### 1. Title"
  const titleMatch = text.match(/^##\s*(.+?)(?:\n|$)/m) ||
    text.match(/^###?\s*\d*\.?\s*(.+?)(?:\n|$)/m);
  if (titleMatch) {
    result.title = titleMatch[1].replace(/\*\*/g, '').trim();
  }

  // --- Extract Context Analysis ---
  const contextMatch = text.match(/\*?\*?Context Analysis\*?\*?:?\s*([\s\S]*?)(?=\*?\*?Form Report|$)/i);
  if (contextMatch) {
    const ctx = contextMatch[1];

    // Extract sleep hours
    const sleepMatch = ctx.match(/(\d+)\s*hours?/i) || ctx.match(/sleep\s*\((\d+)/i);

    // Extract time slot
    const timeMatch = ctx.match(/(\d+)-minute\s*free\s*slot/i) ||
      ctx.match(/(\d+:\d+)\s*-\s*(\d+:\d+)/);

    result.contextAnalysis = {
      calorieState: ctx.toLowerCase().includes('fasted') ? 'Fasted' :
        ctx.toLowerCase().includes('deficit') ? 'Deficit' : 'Fed',
      sleepHours: sleepMatch ? parseInt(sleepMatch[1]) : 7,
      stressLevel: ctx.toLowerCase().includes('high') && ctx.toLowerCase().includes('stress') ? 'High' : 'Moderate',
      hrv: ctx.toLowerCase().includes('low hrv') ? 'Low' : 'Normal',
      timeSlot: timeMatch ? (timeMatch[2] ? `${timeMatch[1]} - ${timeMatch[2]}` : `${timeMatch[1]} min`) : 'Available',
      duration: '',
      rawText: ctx.trim(),
    };
  }

  // --- Extract Form Report ---
  const formMatch = text.match(/\*?\*?Form Report\*?\*?:?\s*([\s\S]*?)(?=\*?\*?The Prescribed Session|$)/i);
  if (formMatch) {
    const formText = formMatch[1];

    // Extract reps - multiple patterns
    const repsPatterns = [
      /performed\s+(\d+)\s+(pushups?|squats?|reps?)/i,
      /completed\s+\*?\*?(\d+)\s+\*?\*?(pushups?|squats?|reps?)/i,
      /You\s+(?:did|performed|completed)\s+(\d+)/i,
      /(\d+)\s+(pushups?|squats?)/i,
    ];

    let totalReps = 0;
    let exerciseType = 'Exercise';

    for (const pattern of repsPatterns) {
      const match = formText.match(pattern);
      if (match) {
        totalReps = parseInt(match[1]);
        if (match[2]) exerciseType = match[2].replace(/s$/, '');
        break;
      }
    }

    // Count issues
    const issues: string[] = [];
    if (formText.toLowerCase().includes('hip sag') || formText.toLowerCase().includes('sagging')) {
      issues.push('Hip Sagging');
    }
    if (formText.toLowerCase().includes('valgus')) {
      issues.push('Knee Valgus');
    }
    if (formText.toLowerCase().includes('forward lean')) {
      issues.push('Forward Lean');
    }
    if (formText.toLowerCase().includes('shallow')) {
      issues.push('Shallow Depth');
    }

    // Count good/bad reps mentioned
    const goodRepsMatch = formText.match(/Reps?\s*(\d+(?:,\s*\d+)*(?:\s*and\s*\d+)?)\s*showed\s*(?:improved|good)/i);
    const badRepsMatch = formText.match(/Reps?\s*(\d+(?:\s*and\s*\d+)?)\s*showed\s*(?:hip\s*sag|issues)/i);

    result.formReport = {
      exerciseType: exerciseType.charAt(0).toUpperCase() + exerciseType.slice(1),
      totalReps,
      issues,
      goodReps: goodRepsMatch ? goodRepsMatch[1].split(/,|\s+and\s+/).length : totalReps - (badRepsMatch ? badRepsMatch[1].split(/,|\s+and\s+/).length : 0),
      badReps: badRepsMatch ? badRepsMatch[1].split(/,|\s+and\s+/).length : 0,
      rawText: formText.trim(),
    };
  }

  // --- Extract Goal ---
  const goalMatch = text.match(/\*?\*?Goal\*?\*?:?\s*([^\n]+)/i);
  if (goalMatch) {
    result.goal = goalMatch[1].replace(/\*\*/g, '').trim();
  }

  // --- Extract Duration ---
  const durationMatch = text.match(/\*?\*?Duration\*?\*?:?\s*([^\n]+)/i);
  if (durationMatch) {
    result.duration = durationMatch[1].replace(/\*\*/g, '').trim();
  }

  // --- Extract Warm-up ---
  const warmupMatch = text.match(/###?\s*\*?\*?Warm-?up\s*\([^)]*\)\*?\*?\s*([\s\S]*?)(?=###?\s*\*?\*?(?:Workout|Main|Cool)|$)/i);
  if (warmupMatch) {
    result.warmup = parseWorkoutSection('Warm-up', warmupMatch[1]);
  }

  // --- Extract Main Workout ---
  const workoutMatch = text.match(/###?\s*\*?\*?(?:Workout|Main\s*(?:Session|Workout))\s*\([^)]*\)\*?\*?\s*([\s\S]*?)(?=###?\s*\*?\*?Cool|$)/i);
  if (workoutMatch) {
    result.mainWorkout = parseWorkoutSection('Workout', workoutMatch[1]);
  }

  // --- Extract Cool-down ---
  const cooldownMatch = text.match(/###?\s*\*?\*?Cool-?down\s*\([^)]*\)\*?\*?\s*([\s\S]*?)(?=\*?\*?Post-?Workout|\*?\*?Save\s*Confirmation|$)/i);
  if (cooldownMatch) {
    result.cooldown = parseWorkoutSection('Cool-down', cooldownMatch[1]);
  }

  // --- Extract Post-Workout Notes ---
  const postMatch = text.match(/\*?\*?Post-?Workout\s*(?:Nutrition)?\*?\*?:?\s*([^\n]+(?:\n(?!\*\*)[^\n]+)*)/i);
  if (postMatch) {
    result.postWorkoutNotes = postMatch[1].replace(/\*\*/g, '').trim();
  }

  // --- Extract Save Confirmation ---
  const saveMatch = text.match(/\*?\*?Save Confirmation\*?\*?:?\s*([\s\S]*?)$/i);
  if (saveMatch) {
    result.saveConfirmation = saveMatch[1].replace(/\*\*/g, '').trim();
  }

  return result;
};

const parseWorkoutSection = (title: string, text: string): WorkoutSection => {
  const exercises: ExerciseItem[] = [];
  const notes: string[] = [];

  // Extract exercise items (lines starting with *)
  const exerciseMatches = text.matchAll(/\*\s*\*?\*?([^:*\n]+)\*?\*?:?\s*([^\n]*)/g);

  for (const match of exerciseMatches) {
    const name = match[1].replace(/\*\*/g, '').trim();
    const details = match[2].replace(/\*\*/g, '').trim();

    // Skip sub-items (indented) for now
    if (name && !name.startsWith(' ')) {
      exercises.push({ name, details });
    }
  }

  // Extract duration from title if present
  const durationMatch = title.match(/\(([^)]+)\)/);

  return {
    title: title.replace(/\([^)]*\)/, '').trim(),
    duration: durationMatch ? durationMatch[1] : '',
    exercises,
    notes,
  };
};

// --- UI COMPONENTS ---

interface StatusBadgeProps {
  status: 'good' | 'warning' | 'bad';
  text: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, text }) => {
  const colors = {
    good: 'bg-emerald-950/50 text-emerald-400 border-emerald-800',
    warning: 'bg-amber-950/50 text-amber-400 border-amber-800',
    bad: 'bg-red-950/50 text-red-400 border-red-800',
  };

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${colors[status]}`}>
      {text}
    </span>
  );
};

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  status?: 'good' | 'warning' | 'bad';
}

const MetricCard: React.FC<MetricCardProps> = ({ icon, label, value, status = 'good' }) => {
  const colors = {
    good: 'bg-emerald-950/50 border-emerald-800 text-emerald-400',
    warning: 'bg-amber-950/50 border-amber-800 text-amber-400',
    bad: 'bg-red-950/50 border-red-800 text-red-400',
  };

  return (
    <div className={`p-4 rounded-xl border ${colors[status]}`}>
      <div className="flex items-center gap-2 mb-1 opacity-75">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
};

interface CollapsibleProps {
  title: string;
  icon: React.ReactNode;
  badge?: string;
  badgeStatus?: 'good' | 'warning' | 'bad';
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const Collapsible: React.FC<CollapsibleProps> = ({
  title, icon, badge, badgeStatus = 'good', defaultOpen = false, children
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
          {badge && <StatusBadge status={badgeStatus} text={badge} />}
        </div>
        <ChevronDown className={`text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} size={20} />
      </button>
      {isOpen && (
        <div className="px-5 pb-5 border-t border-border">
          {children}
        </div>
      )}
    </div>
  );
};

// --- MAIN COMPONENT ---

interface TrainerReportProps {
  plan: string;
  totalReps: number;
  detectedIssues: string[];
  formRating: number;
  saveStatus: string;
}

const TrainerReport: React.FC<TrainerReportProps> = ({
  plan, totalReps, detectedIssues, formRating, saveStatus
}) => {
  const parsed = parseAgentReport(plan);

  // Use server-provided totalReps if available, otherwise use parsed
  const displayReps = totalReps > 0 ? totalReps : (parsed.formReport?.totalReps ?? 0);

  // If nothing was parsed, show fallback
  if (!parsed.title && !parsed.contextAnalysis && !parsed.formReport) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="font-bold text-lg mb-4 text-foreground">Trainer Report</h3>
        <pre className="whitespace-pre-wrap text-muted-foreground text-sm leading-relaxed">
          {plan}
        </pre>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in slide-in-from-bottom-10 duration-500">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-xl p-6 text-white border border-slate-700">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center border border-white/20">
            <Dumbbell className="text-white" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold">{parsed.title || 'Your Personalized Session'}</h2>
            {parsed.duration && (
              <p className="text-slate-400 text-sm flex items-center gap-1">
                <Clock size={14} /> {parsed.duration}
              </p>
            )}
          </div>
        </div>

        {parsed.goal && (
          <div className="mt-4 p-4 bg-white/5 rounded-lg border border-white/10">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold mb-1">
              <Target size={14} />
              SESSION GOAL
            </div>
            <p className="text-white/90">{parsed.goal}</p>
          </div>
        )}
      </div>

      {/* Wellness Metrics Grid */}
      {parsed.contextAnalysis && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <MetricCard
            icon={<Moon size={16} />}
            label="Sleep"
            value={`${parsed.contextAnalysis.sleepHours}h`}
            status={parsed.contextAnalysis.sleepHours >= 7 ? 'good' : parsed.contextAnalysis.sleepHours >= 5 ? 'warning' : 'bad'}
          />
          <MetricCard
            icon={<Brain size={16} />}
            label="Stress"
            value={parsed.contextAnalysis.stressLevel}
            status={parsed.contextAnalysis.stressLevel === 'Low' ? 'good' : parsed.contextAnalysis.stressLevel === 'Moderate' ? 'warning' : 'bad'}
          />
          <MetricCard
            icon={<Heart size={16} />}
            label="HRV"
            value={parsed.contextAnalysis.hrv}
            status={parsed.contextAnalysis.hrv === 'Normal' ? 'good' : 'warning'}
          />
          <MetricCard
            icon={<Utensils size={16} />}
            label="State"
            value={parsed.contextAnalysis.calorieState}
            status={parsed.contextAnalysis.calorieState === 'Fed' ? 'good' : 'warning'}
          />
          <MetricCard
            icon={<Clock size={16} />}
            label="Available"
            value={parsed.contextAnalysis.timeSlot}
            status="good"
          />
        </div>
      )}

      {/* Form Report Card */}
      {parsed.formReport && (
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-950/50 flex items-center justify-center border border-blue-800">
                <TrendingUp className="text-blue-400" size={20} />
              </div>
              <div>
                <h3 className="font-bold text-foreground">Form Analysis</h3>
                <p className="text-sm text-muted-foreground">{parsed.formReport.exerciseType}</p>
              </div>
            </div>
            <StatusBadge
              status={parsed.formReport.issues.length === 0 ? 'good' : 'warning'}
              text={parsed.formReport.issues.length === 0 ? 'Excellent' : 'Needs Work'}
            />
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-4 bg-secondary rounded-xl border border-border">
              <p className="text-3xl font-bold text-foreground">{displayReps}</p>
              <p className="text-xs text-muted-foreground mt-1">Total Reps</p>
            </div>
            <div className="text-center p-4 bg-emerald-950/50 rounded-xl border border-emerald-800">
              <p className="text-3xl font-bold text-emerald-400">{parsed.formReport.goodReps}</p>
              <p className="text-xs text-muted-foreground mt-1">Good Form</p>
            </div>
            <div className="text-center p-4 bg-amber-950/50 rounded-xl border border-amber-800">
              <p className="text-3xl font-bold text-amber-400">{parsed.formReport.badReps}</p>
              <p className="text-xs text-muted-foreground mt-1">Needs Work</p>
            </div>
          </div>

          {parsed.formReport.issues.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {parsed.formReport.issues.map((issue, idx) => (
                <span key={idx} className="px-3 py-1 bg-amber-950/50 text-amber-400 rounded-full text-sm border border-amber-800">
                  {issue}
                </span>
              ))}
            </div>
          )}

          {/* Detailed form analysis */}
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground leading-relaxed">{parsed.formReport.rawText}</p>
          </div>
        </div>
      )}

      {/* Workout Sections */}
      <div className="space-y-3">
        {/* Warm-up */}
        {parsed.warmup && parsed.warmup.exercises.length > 0 && (
          <Collapsible
            title="Warm-up"
            icon={<Flame className="text-amber-400" size={18} />}
            badge={parsed.warmup.duration || `${parsed.warmup.exercises.length} exercises`}
            badgeStatus="warning"
          >
            <div className="pt-4 space-y-3">
              {parsed.warmup.exercises.map((ex, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-secondary rounded-lg border border-border">
                  <div className="w-6 h-6 rounded-full bg-amber-950/50 text-amber-400 flex items-center justify-center text-sm font-bold flex-shrink-0 border border-amber-800">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{ex.name}</p>
                    {ex.details && <p className="text-sm text-muted-foreground">{ex.details}</p>}
                  </div>
                </div>
              ))}
            </div>
          </Collapsible>
        )}

        {/* Main Workout */}
        {parsed.mainWorkout && parsed.mainWorkout.exercises.length > 0 && (
          <Collapsible
            title="Main Workout"
            icon={<Dumbbell className="text-blue-400" size={18} />}
            badge={parsed.mainWorkout.duration || `${parsed.mainWorkout.exercises.length} exercises`}
            badgeStatus="good"
            defaultOpen={true}
          >
            <div className="pt-4 space-y-3">
              {parsed.mainWorkout.exercises.map((ex, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-blue-950/30 rounded-lg border border-blue-800">
                  <div className="w-6 h-6 rounded-full bg-blue-950/50 text-blue-400 flex items-center justify-center text-sm font-bold flex-shrink-0 border border-blue-800">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{ex.name}</p>
                    {ex.details && <p className="text-sm text-muted-foreground">{ex.details}</p>}
                  </div>
                </div>
              ))}
            </div>
          </Collapsible>
        )}

        {/* Cool-down */}
        {parsed.cooldown && parsed.cooldown.exercises.length > 0 && (
          <Collapsible
            title="Cool-down"
            icon={<Zap className="text-teal-400" size={18} />}
            badge={parsed.cooldown.duration || `${parsed.cooldown.exercises.length} exercises`}
            badgeStatus="good"
          >
            <div className="pt-4 space-y-3">
              {parsed.cooldown.exercises.map((ex, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-teal-950/30 rounded-lg border border-teal-800">
                  <div className="w-6 h-6 rounded-full bg-teal-950/50 text-teal-400 flex items-center justify-center text-sm font-bold flex-shrink-0 border border-teal-800">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{ex.name}</p>
                    {ex.details && <p className="text-sm text-muted-foreground">{ex.details}</p>}
                  </div>
                </div>
              ))}
            </div>
          </Collapsible>
        )}

        {/* Context Analysis */}
        {parsed.contextAnalysis?.rawText && (
          <Collapsible
            title="AI Analysis"
            icon={<FileText className="text-slate-400" size={18} />}
            badge="Context"
            badgeStatus="good"
          >
            <div className="pt-4">
              <p className="text-muted-foreground leading-relaxed">{parsed.contextAnalysis.rawText}</p>
            </div>
          </Collapsible>
        )}
      </div>

      {/* Post-Workout Notes */}
      {parsed.postWorkoutNotes && (
        <div className="bg-emerald-950/30 border border-emerald-800 rounded-xl p-5">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-2">
            <Utensils size={18} />
            Post-Workout Nutrition
          </div>
          <p className="text-emerald-400/80">{parsed.postWorkoutNotes}</p>
        </div>
      )}

      {/* Save Confirmation */}
      {saveStatus === 'success' && (
        <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-950/50 px-4 py-2 rounded-lg border border-emerald-800">
          <CheckCircle size={16} />
          <span>Session saved to cloud</span>
        </div>
      )}
    </div>
  );
};

export default TrainerReport;
