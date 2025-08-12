import React from 'react';

interface SurvivalTimerBarProps {
  endTime: number;
  now: number;
  duration: number;
  title: string;
}

export const SurvivalTimerBar: React.FC<SurvivalTimerBarProps> = ({ endTime, now, duration, title }) => {
    const remainingTime = Math.max(0, endTime - now);
    const progressPercent = Math.max(0, (remainingTime / duration) * 100);

    return (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 w-2/3 z-30 pointer-events-none">
            <div className="text-center font-bold text-lg uppercase text-yellow-300 mb-1" style={{ textShadow: '0 0 5px #f59e0b' }}>
                {title}
            </div>
            <div className="h-4 bg-slate-700 rounded-full overflow-hidden border-2 border-yellow-500/50 shadow-lg">
                <div 
                    className="h-full bg-yellow-400 transition-all duration-200 ease-linear"
                    style={{ width: `${progressPercent}%`, boxShadow: `0 0 10px #facc15` }}
                />
            </div>
        </div>
    );
};