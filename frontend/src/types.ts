export enum AgentStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  WARNING = 'WARNING',
  RESOLVING = 'RESOLVING',
  OPTIMAL = 'OPTIMAL'
}

export enum AgentType {
  NUTRITIONIST = 'Nutritionist',
  TRAINER = 'Physical Trainer',
  WELLNESS = 'Wellness Coach',
  MANAGER = 'Manager'
}

export interface AgentState {
  id: AgentType;
  status: AgentStatus;
  lastAction: string;
  description: string;
  colorTheme: string; // Tailwind class prefix for text/border
}

export interface UserStats {
  name: string;
  primaryGoal: string;
  sleepScore: number; // 0-100
  stressLevel: 'Low' | 'Moderate' | 'High';
  workoutReadiness: 'Ready' | 'Compromised' | 'Not Ready';
}

export interface LogEntry {
  id: string;
  agent: AgentType;
  action: string;
  timestamp: string;
  type: 'info' | 'warning' | 'critical' | 'success';
}

export interface ConflictData {
  id: string;
  detectedAt: string;
  sources: {
    agent: AgentType;
    recommendation: string;
    priority: 'Low' | 'Medium' | 'High';
  }[];
  resolution: {
    decision: string;
    reasoning: string;
    impact: string[];
  };
}

// Chat Specific Types
export interface AgentResponse {
  agentType: AgentType;
  content: string;
  summary: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'system' | 'agents' | 'manager';
  text?: string;
  agentResponses?: AgentResponse[];
  timestamp: Date;
}