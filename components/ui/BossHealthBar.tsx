import React from 'react';
import type { Boss } from '../../types';

export const BossHealthBar: React.FC<{ boss: Boss }> = ({ boss }) => {
  const healthPercent = Math.max(0, (boss.health / boss.maxHealth) * 100);
  const bossStyles = {
    warden: { color: 'bg-pink-500', shadow: '#ec4899' },
    punisher: { color: 'bg-red-500', shadow: '#ef4444' },
    overmind: { color: 'bg-cyan-400', shadow: '#22d3ee' },
  };
  const { color, shadow } = bossStyles[boss.bossType];

  return (
    <div className="absolute top-24 left-1/2 -translate-x-1/2 w-2/3 z-30 pointer-events-none">
      <div className="h-5 bg-slate-700 rounded-full overflow-hidden border-2 border-slate-500 shadow-lg">
        <div 
          className={`h-full ${color} transition-all duration-500 ease-in-out`}
          style={{ width: `${healthPercent}%`, boxShadow: `0 0 10px ${shadow}` }}
        />
      </div>
      <div className="text-center font-mono text-white text-sm mt-1" style={{ textShadow: '1px 1px 3px #000' }}>
        {Math.ceil(boss.health).toLocaleString()} / {boss.maxHealth.toLocaleString()}
      </div>
    </div>
  );
};