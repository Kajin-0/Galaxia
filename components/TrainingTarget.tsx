
import React from 'react';
import type { TrainingTarget as TrainingTargetType } from '../types';
import { GAME_HEIGHT } from '../constants';

interface TrainingTargetProps {
  target: TrainingTargetType;
  now: number;
}

const TrainingTargetComponent: React.FC<TrainingTargetProps> = ({ target, now }) => {
  const scale = 0.4 + (target.y / GAME_HEIGHT) * 0.6;
  const wasHit = now - (target.lastHitTime ?? 0) < 100;
  
  let borderColor = 'border-cyan-400';
  let bgColor = 'bg-cyan-900/50';
  let textColor = 'text-cyan-300';
  let shadowColor = '#22d3ee'; // cyan-400

  if (target.isComplete && !target.isFailed) {
    borderColor = 'border-green-400';
    bgColor = 'bg-green-900/50';
    textColor = 'text-green-300';
    shadowColor = '#4ade80'; // green-400
  } else if (target.isFailed) {
    borderColor = 'border-red-400';
    bgColor = 'bg-red-900/50';
    textColor = 'text-red-300';
    shadowColor = '#f87171'; // red-400
  }

  const transitionClass = 'transition-all duration-300';

  return (
    <div
      className="absolute flex items-center justify-center rounded-full pointer-events-none"
      style={{
        left: `${target.x}px`,
        top: `${target.y}px`,
        width: '80px',
        height: '80px',
        transform: `translateX(-50%) scale(${scale * (wasHit ? 1.15 : 1)}) translateZ(8px)`,
        filter: wasHit ? 'brightness(2)' : 'none',
        transition: 'transform 100ms ease-out, filter 100ms ease-out',
        willChange: 'transform, top, left, border-color, background-color, filter',
        transformStyle: 'preserve-3d',
      }}
    >
      <div 
        className={`absolute inset-0 rounded-full border-4 ${borderColor} ${bgColor} ${transitionClass}`}
        style={{ boxShadow: `0 0 15px ${shadowColor}, inset 0 0 10px ${shadowColor}` }}
      />
      <div className="relative z-10 text-center flex items-center justify-center w-full h-full">
        {target.isFailed ? (
            <span className="font-black text-7xl text-red-500" style={{ textShadow: '0 0 8px #f00' }}>X</span>
        ) : target.isComplete ? (
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-12 w-12 ${textColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
        ) : (
            <span className={`font-black text-5xl ${textColor} ${transitionClass}`} style={{ textShadow: '0 0 8px #000' }}>
                {target.remainingHits}
            </span>
        )}
      </div>
    </div>
  );
};

export default React.memo(TrainingTargetComponent);