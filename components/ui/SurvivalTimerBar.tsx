import React from 'react';
import { Clock3 } from 'lucide-react';
import { StatBar } from './primitives';

interface SurvivalTimerBarProps {
    endTime: number;
    now: number;
    duration: number;
    title: string;
}

export const SurvivalTimerBar: React.FC<SurvivalTimerBarProps> = ({ endTime, now, duration, title }) => {
    const remainingTime = Math.max(0, endTime - now);

    return (
        <div
            className="pointer-events-none absolute left-1/2 z-20 w-[min(58%,18rem)] -translate-x-1/2"
            style={{ top: 'calc(7rem + env(safe-area-inset-top, 0px))' }}
        >
            <div className="mb-1 flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-yellow-200">
                <Clock3 size={12} aria-hidden="true" />
                {title}
            </div>
            <StatBar
                value={remainingTime}
                max={duration}
                valueLabel={`${Math.ceil(remainingTime / 1000)}s`}
                tone="gold"
                segments={10}
                compact
            />
        </div>
    );
};
