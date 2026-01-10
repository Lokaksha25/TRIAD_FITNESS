import React, { useState, useEffect } from 'react';
import { Activity, Utensils, Pill, FileText, Zap, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getOnboardingData, computeUserMetrics } from '../services/userDataService';

interface WellnessData {
  sleep_hours: number;
  stress_score: number;
  readiness_score: number;
  hrv: number;
  rhr: number;
}

interface UserData {
  name: string;
  status: string;
  bmi: number;
  resting_hr: number;
  phase: string;
  calories: number;
  weight?: number;
  height?: number;
  age?: number;
  goal?: string;
}

interface AgentLog {
  type: 'trainer' | 'nutritionist' | 'wellness' | 'manager';
  message: string;
  severity: 'info' | 'warning' | 'success';
}

const Dashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [wellness, setWellness] = useState<WellnessData | null>(null);
  const [agentLogs, setAgentLogs] = useState<AgentLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Get current date and time
  const now = new Date();
  const formattedDate = now.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const formattedTime = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  // Load user data from onboarding cache
  useEffect(() => {
    const loadUserData = () => {
      if (!currentUser) return;

      // Get onboarding data from local storage
      const onboardingData = getOnboardingData();

      if (onboardingData) {
        console.log('📦 Loading user data from onboarding cache');
        const metrics = computeUserMetrics(onboardingData);

        setUserData({
          name: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
          status: metrics.status,
          bmi: metrics.bmi,
          resting_hr: 65, // Default value
          phase: metrics.phase,
          calories: metrics.calories,
          weight: onboardingData.weight,
          height: onboardingData.height,
          age: onboardingData.age,
          goal: onboardingData.goal,
        });

        // Set default wellness data (can be enhanced with wearable data later)
        setWellness({
          sleep_hours: 7.5,
          stress_score: 35,
          readiness_score: 78,
          hrv: 55,
          rhr: 65,
        });

        // Set contextual agent logs based on goal
        const goal = onboardingData.goal;
        setAgentLogs([
          {
            type: 'trainer',
            message: goal === 'lose' ? 'Cardio-focused training plan active' :
              goal === 'gain' ? 'Strength training plan active' :
                'Balanced training plan active',
            severity: 'info'
          },
          {
            type: 'nutritionist',
            message: `Daily target: ${metrics.calories} kcal, ${metrics.proteinTarget}g protein`,
            severity: 'info'
          },
          {
            type: 'wellness',
            message: 'Monitoring biometric data',
            severity: 'success'
          },
        ]);
      } else {
        // No onboarding data found - set defaults
        console.log('⚠️ No onboarding data found, using defaults');
        setUserData({
          name: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
          status: 'New User',
          bmi: 22.0,
          resting_hr: 65,
          phase: 'Getting Started',
          calories: 2000,
        });
      }

      setLoading(false);
    };

    loadUserData();
  }, [currentUser]);

  // Get icon and colors for agent logs
  const getAgentLogConfig = (log: AgentLog) => {
    const configs = {
      trainer: { icon: Zap, color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
      nutritionist: { icon: Utensils, color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
      wellness: { icon: Pill, color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
      manager: { icon: FileText, color: 'text-zinc-400', bgColor: 'bg-zinc-500/20' }
    };
    return configs[log.type] || configs.manager;
  };

  // Calculate stress level label
  const getStressLabel = (score: number) => {
    if (score <= 30) return { label: 'Low', color: 'text-emerald-400' };
    if (score <= 55) return { label: 'Moderate', color: 'text-amber-400' };
    if (score <= 75) return { label: 'Elevated', color: 'text-orange-400' };
    return { label: 'High', color: 'text-red-400' };
  };

  // Calculate sleep status
  const getSleepStatus = (hours: number) => {
    if (hours >= 7) return { label: 'Optimal', color: 'text-emerald-400 bg-emerald-500/15' };
    if (hours >= 6) return { label: 'Adequate', color: 'text-amber-400 bg-amber-500/15' };
    return { label: 'Low', color: 'text-red-400 bg-red-500/15' };
  };

  // Calculate readiness status
  const getReadinessStatus = (score: number) => {
    if (score >= 80) return 'Ready for activity';
    if (score >= 60) return 'Moderate activity';
    return 'Rest recommended';
  };

  const stressInfo = wellness ? getStressLabel(wellness.stress_score) : null;
  const sleepStatus = wellness ? getSleepStatus(wellness.sleep_hours) : null;

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm animate-pulse">
          <div className="flex items-center justify-center h-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            <span className="ml-3 text-muted-foreground">Loading dashboard data...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Patient Summary Header */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Left: User Info */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="h-14 w-14 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center overflow-hidden border-2 border-border shadow-inner">
                {currentUser?.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser?.displayName || 'User'}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <img
                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser?.uid || 'default'}`}
                    alt={currentUser?.displayName || 'User'}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
            </div>
            <div>
              <h2 className="text-sm text-muted-foreground font-medium">Patient Summary</h2>
              <h1 className="text-lg font-bold text-foreground">{userData?.name || 'User'}</h1>
            </div>
          </div>

          {/* Center: Status Badges */}
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Status:</span>
              <span className="font-semibold text-foreground">{userData?.status || 'Stable'}</span>
            </div>
            <div className="hidden md:block w-px h-4 bg-border"></div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">BMI:</span>
              <span className="font-semibold text-foreground">{userData?.bmi || 22.0}</span>
            </div>
            <div className="hidden md:block w-px h-4 bg-border"></div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Phase:</span>
              <span className="font-semibold text-foreground">{userData?.phase || 'Maintenance'}</span>
            </div>
          </div>

          {/* Right: Date & Time */}
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Current Date & Time</p>
            <p className="text-lg font-bold text-foreground">{formattedDate}, {formattedTime}</p>
          </div>
        </div>
      </div>

      {/* Quick Stats Row */}
      {userData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Daily Calories</p>
            <p className="text-2xl font-bold text-foreground">{userData.calories} <span className="text-sm font-normal text-muted-foreground">kcal</span></p>
          </div>
          {userData.weight && (
            <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Weight</p>
              <p className="text-2xl font-bold text-foreground">{userData.weight} <span className="text-sm font-normal text-muted-foreground">kg</span></p>
            </div>
          )}
          {userData.height && (
            <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Height</p>
              <p className="text-2xl font-bold text-foreground">{userData.height} <span className="text-sm font-normal text-muted-foreground">cm</span></p>
            </div>
          )}
          {userData.age && (
            <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Age</p>
              <p className="text-2xl font-bold text-foreground">{userData.age} <span className="text-sm font-normal text-muted-foreground">years</span></p>
            </div>
          )}
        </div>
      )}

      {/* Core Health Metrics */}
      <div>
        <h2 className="text-lg font-bold text-foreground mb-4">Core Health Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Sleep Quality Card */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Sleep Quality</h3>

            {wellness && sleepStatus ? (
              <>
                {/* Area Chart Visualization */}
                <div className="h-16 mb-4 relative">
                  <svg viewBox="0 0 200 60" className="w-full h-full" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="sleepGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.05" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M0,50 Q20,45 40,40 T80,35 T120,25 T160,20 T200,15 L200,60 L0,60 Z"
                      fill="url(#sleepGradient)"
                    />
                    <path
                      d="M0,50 Q20,45 40,40 T80,35 T120,25 T160,20 T200,15"
                      fill="none"
                      stroke="#14b8a6"
                      strokeWidth="2"
                    />
                  </svg>
                </div>

                <div className="flex items-end justify-between">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-foreground">{wellness.sleep_hours.toFixed(1)}</span>
                    <span className="text-lg text-muted-foreground">hrs</span>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${sleepStatus.color}`}>
                    {sleepStatus.label}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-28 text-muted-foreground">
                <Activity className="w-8 h-8 mb-2 opacity-30" />
                <span className="text-sm font-medium">Connect wearable</span>
              </div>
            )}
          </div>

          {/* Stress Level Card */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Stress Level</h3>

            {wellness && stressInfo ? (
              <>
                {/* Bar Chart Visualization */}
                <div className="h-16 mb-4 flex items-end justify-between gap-1">
                  {Array.from({ length: 12 }, (_, i) => {
                    const baseHeight = 30 + (wellness.stress_score / 100) * 50;
                    const variation = Math.sin(i * 0.8) * 20;
                    return (
                      <div
                        key={i}
                        className="flex-1 bg-gradient-to-t from-amber-500 to-orange-400 rounded-sm"
                        style={{ height: `${Math.max(20, Math.min(95, baseHeight + variation))}%` }}
                      />
                    );
                  })}
                </div>

                <div className="flex items-end justify-between">
                  <span className={`text-xl font-bold ${stressInfo.color}`}>{stressInfo.label}</span>
                  <span className="text-sm text-muted-foreground">Score: {wellness.stress_score}/100</span>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-28 text-muted-foreground">
                <Activity className="w-8 h-8 mb-2 opacity-30" />
                <span className="text-sm font-medium">Connect wearable</span>
              </div>
            )}
          </div>

          {/* Readiness Card */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Readiness</h3>

            {wellness ? (
              <>
                {/* Circular Gauge Visualization */}
                <div className="h-16 mb-4 flex items-center justify-start">
                  <div className="relative w-16 h-16">
                    <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                      <circle
                        cx="18"
                        cy="18"
                        r="14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        className="text-secondary"
                      />
                      <circle
                        cx="18"
                        cy="18"
                        r="14"
                        fill="none"
                        stroke="url(#readinessGradient)"
                        strokeWidth="3"
                        strokeDasharray="88"
                        strokeDashoffset={88 - (88 * wellness.readiness_score / 100)}
                        strokeLinecap="round"
                      />
                      <defs>
                        <linearGradient id="readinessGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#22c55e" />
                          <stop offset="100%" stopColor="#14b8a6" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Activity className="w-5 h-5 text-emerald-400" />
                    </div>
                  </div>
                </div>

                <div className="flex items-end justify-between">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-foreground">{wellness.readiness_score}</span>
                    <span className="text-lg text-muted-foreground">/100</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{getReadinessStatus(wellness.readiness_score)}</span>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-28 text-muted-foreground">
                <Activity className="w-8 h-8 mb-2 opacity-30" />
                <span className="text-sm font-medium">Connect wearable</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Agent Status & System Logs */}
      <div>
        <h2 className="text-lg font-bold text-foreground mb-4">Agent Status & System Logs</h2>
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="space-y-3">
            {agentLogs.length > 0 ? (
              agentLogs.map((log, index) => {
                const config = getAgentLogConfig(log);
                const IconComponent = config.icon;
                return (
                  <div key={index} className="flex items-center gap-3 py-2">
                    <div className={`h-8 w-8 rounded-lg ${config.bgColor} flex items-center justify-center shrink-0`}>
                      <IconComponent size={16} className={config.color} />
                    </div>
                    <span className="text-sm text-foreground">{log.message}</span>
                  </div>
                );
              })
            ) : (
              <>
                <div className="flex items-center gap-3 py-2">
                  <div className="h-8 w-8 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                    <Zap size={16} className="text-blue-400" />
                  </div>
                  <span className="text-sm text-foreground">Training load adjustment in progress</span>
                </div>
                <div className="flex items-center gap-3 py-2">
                  <div className="h-8 w-8 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0">
                    <Utensils size={16} className="text-orange-400" />
                  </div>
                  <span className="text-sm text-foreground">Reviewing dietary plan</span>
                </div>
                <div className="flex items-center gap-3 py-2">
                  <div className="h-8 w-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <Pill size={16} className="text-emerald-400" />
                  </div>
                  <span className="text-sm text-foreground">Monitoring biometric data</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
