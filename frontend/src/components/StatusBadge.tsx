import React from 'react';
import { AgentStatus } from '../types';

interface StatusBadgeProps {
  status: AgentStatus;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getStyles = () => {
    switch (status) {
      case AgentStatus.IDLE:
        return 'bg-stone-100 text-stone-500 border-stone-200';
      case AgentStatus.ANALYZING:
        return 'bg-sky-50 text-sky-700 border-sky-100';
      case AgentStatus.WARNING:
        return 'bg-amber-50 text-amber-700 border-amber-100';
      case AgentStatus.RESOLVING:
        return 'bg-purple-50 text-purple-700 border-purple-100';
      case AgentStatus.OPTIMAL:
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      default:
        return 'bg-gray-100 text-gray-500';
    }
  };

  return (
    <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold border ${getStyles()}`}>
      {status}
    </span>
  );
};

export default StatusBadge;