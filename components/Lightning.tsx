import React from 'react';
import type { LightningBolt } from '../types';
import * as C from '../constants';

interface LightningProps {
  bolt: LightningBolt;
}

const Lightning: React.FC<LightningProps> = ({ bolt }) => {
  const animationStyle = {
    animation: `fade-out ${C.LIGHTNING_DURATION}ms linear forwards`,
  };

  return (
    <>
      {/* Background flash */}
      <div 
        className="absolute inset-0 bg-cyan-200"
        style={{
          ...animationStyle,
          // @ts-ignore
          '--start-opacity': C.LIGHTNING_BG_FLASH_OPACITY,
        }}
      />
      {/* Bolt */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{
          ...animationStyle,
          filter: `drop-shadow(${C.LIGHTNING_GLOW})`,
        }}
      >
        <polyline
          points={bolt.segments}
          fill="none"
          stroke={C.LIGHTNING_COLOR}
          strokeWidth={C.LIGHTNING_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </>
  );
};

export default Lightning;