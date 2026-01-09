import React, { useState, useEffect } from 'react';
import { Activity, Utensils, Pill, FileText, Zap, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

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
}

interface AgentLog {
  type: 'trainer' | 'nutritionist' | 'wellness' | 'manager';
  message: string;
  severity: 'info' | 'warning' | 'success';
}

interface DashboardMetrics {
  status: string;
  wellness: WellnessData;
  user: UserData;
  agent_logs: AgentLog[];
}

const Dashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Cache configuration
  const CACHE_KEY = 'dashboard_metrics_cache';
  const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  // Fetch dashboard metrics with caching
  useEffect(() => {
    const fetchMetrics = async () => {
      if (!currentUser) return;

      // Check cache first
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data, timestamp, userId } = JSON.parse(cached);
          const isValid = Date.now() - timestamp < CACHE_TTL_MS;
          const isSameUser = userId === currentUser.uid;

          if (isValid && isSameUser) {
            console.log('📦 Using cached dashboard data');
            setMetrics(data);
            setLoading(false);
            return;
          }
        }
      } catch (e) {
        console.error('Cache read error:', e);
      }

      // Fetch fresh data
      try {
        setLoading(true);
        const response = await fetch(`/api/dashboard/metrics?user_id=${currentUser.uid}`);
        const data = await response.json();
        setMetrics(data);
        setError(null);

        // Save to cache
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          data,
          timestamp: Date.now(),
          userId: currentUser.uid
        }));
        console.log('✅ Dashboard data cached');
      } catch (err) {
        console.error('Error fetching dashboard metrics:', err);
        setError('Failed to load dashboard data');
        // Set default values on error
        setMetrics({
          status: 'error',
          wellness: {
            sleep_hours: 7.0,
            stress_score: 50,
            readiness_score: 70,
            hrv: 50,
            rhr: 65
          },
          user: {
            name: 'Dr. A. Sharma',
            status: 'Stable',
            bmi: 22.4,
            resting_hr: 65,
            phase: 'maintenance',
            calories: 2000
          },
          agent_logs: []
        });
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
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

  // Extract data - use null if wellness data not available
  const hasWellnessData = metrics?.wellness && metrics.status !== 'error';
  const wellness = hasWellnessData ? metrics.wellness : null;
  const user = metrics?.user || { name: 'Dr. A. Sharma', status: 'Stable', bmi: 22.4, resting_hr: 65, phase: 'maintenance', calories: 2000 };
  const agentLogs = metrics?.agent_logs || [];

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
              <h1 className="text-lg font-bold text-foreground">{currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User'}</h1>
            </div>
          </div>

          {/* Center: Status Badges */}
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Status:</span>
              <span className="font-semibold text-foreground">{user.status}</span>
            </div>
            <div className="hidden md:block w-px h-4 bg-border"></div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">BMI:</span>
              <span className="font-semibold text-foreground">{user.bmi}</span>
            </div>
            <div className="hidden md:block w-px h-4 bg-border"></div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Resting HR:</span>
              <span className="font-semibold text-foreground">{wellness?.rhr || user.resting_hr} bpm</span>
            </div>
          </div>

          {/* Right: Date & Time */}
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Current Date & Time</p>
            <p className="text-lg font-bold text-foreground">{formattedDate}, {formattedTime}</p>
          </div>
        </div>
      </div>

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
                <span className="text-sm font-medium">Insufficient data</span>
              </div>
            )}
          </div>

          {/* Stress Level Card */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Stress Level</h3>

            {wellness && stressInfo ? (
              <>
                {/* Bar Chart Visualization - dynamic based on stress score */}
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
                <span className="text-sm font-medium">Insufficient data</span>
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
                <span className="text-sm font-medium">Insufficient data</span>
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
              // Fallback static logs if none from API
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

      {/* Error message if any */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
          {error} - Displaying cached data
        </div>
      )}
    </div>
  );
};

export default Dashboard;
