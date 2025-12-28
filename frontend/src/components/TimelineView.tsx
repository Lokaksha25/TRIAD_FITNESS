import React from 'react';
import { TIMELINE_LOGS } from '../constants';
import { AgentType } from '../types';
import { Clock, Info, AlertTriangle, ShieldAlert, Check } from 'lucide-react';

const TimelineView: React.FC = () => {
  const [logs, setLogs] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/timeline');
      const data = await res.json();
      if (data.logs) {
        setLogs(data.logs);
      }
    } catch (e) {
      console.error("Failed to fetch timeline", e);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'warning': return <AlertTriangle size={16} className="text-amber-600" />;
      case 'critical': return <ShieldAlert size={16} className="text-red-600" />;
      case 'success': return <Check size={16} className="text-emerald-600" />;
      default: return <Info size={16} className="text-sky-600" />;
    }
  };

  const getAgentColor = (agent: AgentType | string) => {
    const a = agent.toString().toLowerCase();
    if (a.includes('nutrition')) return 'text-emerald-800';
    if (a.includes('trainer')) return 'text-slate-700';
    if (a.includes('wellness')) return 'text-amber-700';
    if (a.includes('manager')) return 'text-stone-800';
    return 'text-stone-500';
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8 flex items-center space-x-3">
        <Clock className="text-stone-400" />
        <h2 className="text-xl font-bold text-stone-900">Decision Timeline</h2>
        <button onClick={fetchLogs} className="text-xs text-blue-500 hover:underline px-2">Refresh</button>
      </div>

      <div className="relative border-l border-stone-200 ml-3 md:ml-6 space-y-8 pb-12">
        {loading ? (
          <p className="pl-8 text-stone-400">Loading timeline...</p>
        ) : logs.length === 0 ? (
          <p className="pl-8 text-stone-400">No recent activity logged.</p>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="relative pl-8 md:pl-12 group">
              {/* Dot on timeline */}
              <div className={`absolute -left-[9px] top-1 w-5 h-5 rounded-full border-4 border-stone-50 shadow-sm ${log.type === 'critical' ? 'bg-red-600' :
                  log.type === 'success' ? 'bg-emerald-600' :
                    log.type === 'warning' ? 'bg-amber-500' : 'bg-stone-400'
                }`}></div>

              <div className="bg-white border border-stone-200 rounded-lg p-5 hover:border-stone-300 transition-colors shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2">
                  <div className="flex items-center space-x-2 mb-2 md:mb-0">
                    <span className={`text-sm font-bold ${getAgentColor(log.agent)}`}>{log.agent}</span>
                    <span className="text-stone-400 text-xs">•</span>
                    <span className="text-stone-500 text-xs font-mono">{log.timestamp}</span>
                  </div>
                  <div className={`self-start px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${log.type === 'critical' ? 'bg-red-50 text-red-700 border-red-200' :
                      log.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        log.type === 'warning' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-sky-50 text-sky-700 border-sky-200'
                    }`}>
                    {log.type}
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="mt-1 shrink-0 bg-stone-50 p-1.5 rounded-md border border-stone-100">
                    {getIcon(log.type)}
                  </div>
                  <p className="text-stone-700 text-sm leading-relaxed">{log.action}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TimelineView;