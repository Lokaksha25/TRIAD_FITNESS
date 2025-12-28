import React from 'react';
import { USER_STATS, AGENT_STATES } from '../constants';
import StatusBadge from './StatusBadge';
import { Activity, Moon, Battery, Zap, Brain, User, AlertTriangle } from 'lucide-react';

const Dashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header / User Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center space-x-4 mb-6">
            <div className="h-16 w-16 rounded-full bg-stone-200 flex items-center justify-center text-2xl font-bold text-stone-600 shadow-inner">
              AC
            </div>
            <div>
              <h1 className="text-2xl font-bold text-stone-900">{USER_STATS.name}</h1>
              <p className="text-stone-500">Current Focus: <span className="text-stone-800 font-semibold">{USER_STATS.primaryGoal}</span></p>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-stone-50 rounded-lg p-4 border border-stone-100">
              <div className="flex items-center space-x-2 text-stone-500 mb-2">
                <Moon size={16} />
                <span className="text-xs uppercase tracking-wider font-semibold">Sleep</span>
              </div>
              <div className="flex items-end space-x-2">
                <span className="text-3xl font-bold text-stone-800">{USER_STATS.sleepScore}</span>
                <span className="text-xs font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded mb-1">POOR</span>
              </div>
            </div>
            <div className="bg-stone-50 rounded-lg p-4 border border-stone-100">
               <div className="flex items-center space-x-2 text-stone-500 mb-2">
                <Brain size={16} />
                <span className="text-xs uppercase tracking-wider font-semibold">Stress</span>
              </div>
              <div className="flex items-end space-x-2">
                <span className="text-3xl font-bold text-red-700">{USER_STATS.stressLevel}</span>
              </div>
            </div>
            <div className="bg-stone-50 rounded-lg p-4 border border-stone-100">
               <div className="flex items-center space-x-2 text-stone-500 mb-2">
                <Zap size={16} />
                <span className="text-xs uppercase tracking-wider font-semibold">Readiness</span>
              </div>
              <div className="flex items-end space-x-2">
                <span className="text-xl font-bold text-orange-700">{USER_STATS.workoutReadiness}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions / System Status */}
        <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 opacity-5">
            <Activity size={100} className="text-stone-900"/>
          </div>
          <div>
            <h3 className="text-stone-400 text-xs font-bold uppercase tracking-wider mb-2">System Status</h3>
            <div className="flex items-center space-x-2 text-emerald-700">
              <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
              <span className="font-semibold text-sm">All Agents Online</span>
            </div>
          </div>
          <div className="mt-4">
             <div className="bg-red-50 border border-red-100 rounded-lg p-3 flex items-start space-x-3">
                <AlertTriangle className="text-red-700 shrink-0 mt-0.5" size={18} />
                <div>
                  <h4 className="text-red-900 text-sm font-bold">Action Required</h4>
                  <p className="text-red-800 text-xs mt-1">Manager is mediating a conflict. Check Chat for details.</p>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {AGENT_STATES.map((agent) => (
          <div key={agent.id} className="bg-white border border-stone-200 rounded-xl p-5 hover:border-stone-300 transition-colors shadow-sm flex flex-col h-full group">
            <div className="flex justify-between items-start mb-4">
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center shadow-sm ${agent.colorTheme.split(' ').filter(c => c.startsWith('bg') || c.startsWith('text')).join(' ')}`}>
                {agent.id === 'Nutritionist' && <Activity size={20} />}
                {agent.id === 'Physical Trainer' && <User size={20} />}
                {agent.id === 'Wellness Coach' && <Battery size={20} />}
                {agent.id === 'Manager' && <Brain size={20} />}
              </div>
              <StatusBadge status={agent.status} />
            </div>
            
            <h3 className="text-lg font-bold text-stone-900 mb-1">{agent.id}</h3>
            <p className="text-stone-400 text-xs mb-4 flex items-center">
              Last active: {agent.lastAction}
            </p>
            
            <div className="mt-auto pt-4 border-t border-stone-100">
              <p className="text-sm text-stone-600 leading-relaxed">
                {agent.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;