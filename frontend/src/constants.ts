import { AgentStatus, AgentType, ConflictData, LogEntry, UserStats, AgentState, AgentResponse } from './types';

export const USER_STATS: UserStats = {
  name: "Alex Chen",
  primaryGoal: "Fat Loss & Hypertrophy",
  sleepScore: 42,
  stressLevel: "High",
  workoutReadiness: "Compromised"
};

// Updated Colors:
// Trainer: Muted Steel Blue (slate/blue)
// Nutritionist: Earthy Olive (emerald/stone)
// Wellness: Warm Sand/Amber (amber/orange)
// Manager: Dark Slate (slate-800)

export const AGENT_STATES: AgentState[] = [
  {
    id: AgentType.NUTRITIONIST,
    status: AgentStatus.IDLE,
    lastAction: "10 mins ago",
    description: "Holding calorie deficit plan pending review.",
    colorTheme: "text-emerald-800 border-emerald-200 bg-emerald-50"
  },
  {
    id: AgentType.TRAINER,
    status: AgentStatus.WARNING,
    lastAction: "2 mins ago",
    description: "Flagged form breakdown in recent squat set.",
    colorTheme: "text-slate-700 border-slate-300 bg-slate-100"
  },
  {
    id: AgentType.WELLNESS,
    status: AgentStatus.WARNING,
    lastAction: "5 mins ago",
    description: "Detected low HRV and high cortisol markers.",
    colorTheme: "text-amber-700 border-amber-200 bg-amber-50"
  },
  {
    id: AgentType.MANAGER,
    status: AgentStatus.RESOLVING,
    lastAction: "Just now",
    description: "Resolving conflict: Recovery vs. Calorie Deficit.",
    colorTheme: "text-stone-800 border-stone-300 bg-stone-100"
  }
];

export const TIMELINE_LOGS: LogEntry[] = [
  {
    id: '1',
    agent: AgentType.TRAINER,
    action: 'Analyzed Squat Form: Knee Valgus detected on Set 3 (85% 1RM).',
    timestamp: '08:45 AM',
    type: 'warning'
  },
  {
    id: '2',
    agent: AgentType.WELLNESS,
    action: 'Correlated form breakdown with 4h 12m sleep duration.',
    timestamp: '08:46 AM',
    type: 'warning'
  },
  {
    id: '3',
    agent: AgentType.NUTRITIONIST,
    action: 'Proposed maintenance of 500kcal deficit for goal "Fat Loss".',
    timestamp: '08:47 AM',
    type: 'info'
  },
  {
    id: '4',
    agent: AgentType.MANAGER,
    action: 'CONFLICT DETECTED: High injury risk vs. Deficit goal.',
    timestamp: '08:48 AM',
    type: 'critical'
  },
  {
    id: '5',
    agent: AgentType.MANAGER,
    action: 'OVERRIDE: Switched to "Recovery Protocol". Deficit paused.',
    timestamp: '08:48 AM',
    type: 'success'
  }
];

export const ACTIVE_CONFLICT: ConflictData = {
  id: 'c-101',
  detectedAt: '08:48 AM',
  sources: [
    {
      agent: AgentType.NUTRITIONIST,
      recommendation: "Maintain 500 kcal deficit (Goal: Fat Loss)",
      priority: 'Medium'
    },
    {
      agent: AgentType.WELLNESS,
      recommendation: "User under-recovered (Sleep: 4h, HRV: 32ms)",
      priority: 'High'
    },
    {
      agent: AgentType.TRAINER,
      recommendation: "Form breakdown observed. Risk of injury.",
      priority: 'High'
    }
  ],
  resolution: {
    decision: "Override Deficit. Switch to Maintenance & Mobility.",
    reasoning: "Injury risk from accumulated fatigue outweighs daily caloric deficit benefit. Prioritizing CNS recovery.",
    impact: [
      "Calories: Increased to 2400 (Maintenance)",
      "Workout: Heavy Squats -> Mobility Flow",
      "Goal: Rescheduled Fat Loss for tomorrow"
    ]
  }
};

// Mock Data for Chat Demo
export const MOCK_AGENT_RESPONSES: AgentResponse[] = [
  {
    agentType: AgentType.TRAINER,
    content: "Knee valgus detected in previous set indicates glute medius fatigue. Given the reported instability, continuing with heavy loading presents a high risk of ligament strain.",
    summary: "Recommendation: Cessation of heavy loading immediately."
  },
  {
    agentType: AgentType.NUTRITIONIST,
    content: "Current caloric deficit (-500kcal) will impair acute tissue repair. To support connective tissue recovery, glycogen stores need to be replenished.",
    summary: "Recommendation: Increase intake to maintenance level (2400kcal)."
  },
  {
    agentType: AgentType.WELLNESS,
    content: "HRV is 32ms (Critical). Sleep data (4h 12m) suggests CNS is unable to handle high-intensity stress today. Cortisol markers are likely elevated.",
    summary: "Recommendation: Prioritize parasympathetic activation (Sleep/Rest)."
  }
];

export const MOCK_MANAGER_DECISION = "Based on recovery status and injury risk, training intensity is reduced and nutrition is adjusted to maintenance calories. The immediate priority is CNS recovery to prevent injury.";