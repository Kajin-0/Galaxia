
import React from 'react';
import type { EmpArc } from '../types';
import * as C from '../constants';

interface EmpArcProps {
  arc: EmpArc;
}

const EmpArcComponent: React.FC<EmpArcProps> = ({ arc }) => {
  const animationStyle = {
    animation: `fade-out ${C.EMP_ARC_DURATION}ms linear forwards`,
  };

  const midX = arc.startX + (arc.endX - arc.startX) / 2 + (Math.random() - 0.5) * 60;
  const midY = arc.startY + (arc.endY - arc.startY) / 2 + (Math.random() - 0.5) * 60;
  
  const points = `${arc.startX},${arc.startY} ${midX},${midY} ${arc.endX},${arc.endY}`;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{
        ...animationStyle,
        filter: `drop-shadow(${C.LIGHTNING_GLOW})`,
        transform: 'translateZ(20px)', // Make sure it's on top
        zIndex: 20
      }}
    >
      <polyline
        points={points}
        fill="none"
        stroke={C.LIGHTNING_COLOR}
        strokeWidth={C.LIGHTNING_WIDTH - 1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default React.memo(EmpArcComponent);
