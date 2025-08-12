import React from 'react';
import type { Enemy as EnemyType, Asteroid as AsteroidType, UpgradePart } from '../types';
import * as C from '../constants';

export const RockImpactExplosion: React.FC<{ x: number; y: number }> = React.memo(({ x, y }) => {
    const particles = React.useMemo(() => Array.from({ length: 15 }, () => ({
      angle: Math.random() * 2 * Math.PI,
      distance: Math.random() * 20 + 10,
      size: Math.random() * 5 + 2,
      color: ['#f59e0b', '#d97706', '#fef3c7'][Math.floor(Math.random() * 3)],
    })), []);
  
    return (
      <div className="absolute pointer-events-none" style={{ left: x, top: y, willChange: 'transform', transform: 'translateZ(6px)' }}>
        {particles.map((p, i) => (
          <div
            key={i}
            className="absolute rounded-full animate-splatter-particle"
            style={{
              background: p.color,
              width: p.size,
              height: p.size,
              animationDuration: '0.3s',
              // @ts-ignore
              '--angle': `${p.angle}rad`,
              '--distance': `${p.distance}px`,
            }}
          />
        ))}
      </div>
    );
});

export const CriticalHitExplosionComponent: React.FC<{ x: number, y: number, radius: number, level: number }> = React.memo(({ x, y, radius, level }) => {
    return (
        <div 
            className="absolute pointer-events-none animate-crit-hit"
            style={{
                left: x,
                top: y,
                width: radius * 2,
                height: radius * 2,
                zIndex: 15,
                willChange: 'transform, opacity',
            }}
        >
             {/* Main expanding ring */}
            <div className="absolute inset-0 rounded-full border-4 border-cyan-300" style={{
                boxShadow: '0 0 10px #fff, 0 0 20px #0ff, 0 0 30px #0ff',
            }}/>
            {/* If upgraded, add a second, faster, thinner ring */}
            {level > 0 && (
                <div className="absolute inset-0 rounded-full border-2 border-white" style={{
                    animation: `crit-hit-expand 250ms ease-out forwards`,
                    opacity: 0.7,
                }}/>
            )}
            {/* If upgraded, add a central flash */}
            {level > 0 && (
                <div className="absolute top-1/2 left-1/2 w-1/4 h-1/4 bg-white rounded-full" style={{
                    animation: `crit-flash 150ms ease-out forwards`,
                }}/>
            )}
        </div>
    )
});

export const ConduitLinkBeam: React.FC<{ conduits: EnemyType[], allTargets: (EnemyType | AsteroidType)[] }> = React.memo(({ conduits, allTargets }) => {
    return (
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 3, transform: 'translateZ(3px)' }}>
            <defs>
                <filter id="conduitGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                    <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>
            {conduits.map(conduit => {
                if (!conduit.linkedEnemyId) return null;
                const target = allTargets.find(t => t.id === conduit.linkedEnemyId);
                if (!target) return null;

                return (
                    <line
                        key={conduit.id}
                        x1={conduit.x}
                        y1={conduit.y}
                        x2={target.x}
                        y2={target.y}
                        stroke="url(#conduitGradient)"
                        strokeWidth="2"
                        filter="url(#conduitGlow)"
                        strokeDasharray="4 4"
                    >
                         <animate
                            attributeName="stroke-dashoffset"
                            from="8"
                            to="0"
                            dur="0.5s"
                            repeatCount="indefinite"
                        />
                    </line>
                );
            })}
             <linearGradient id="conduitGradient">
                <stop offset="0%" stopColor="#0891b2" />
                <stop offset="100%" stopColor="#67e8f9" />
            </linearGradient>
        </svg>
    );
});


export const UpgradePartCollect: React.FC<{ part: UpgradePart, now: number }> = React.memo(({ part, now }) => {
    const elapsed = now - part.createdAt;
    const progress = Math.min(1, elapsed / C.UPGRADE_PART_ANIMATION_DURATION);
    
    const scale = 1 - progress * 0.5;
    const opacity = 1 - progress;

    return (
        <div
            className="absolute pointer-events-none text-orange-400"
            style={{
                left: part.x,
                top: part.y,
                transform: `scale(${scale})`,
                opacity,
                filter: 'drop-shadow(0 0 5px #f97316)',
                willChange: 'transform, left, top, opacity',
                zIndex: 100,
            }}
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0L8 7.05H4.26c-1.56.38-2.22 2.36-1.05 3.53l2.92 2.92c.38.38.38 1 0 1.4l-2.92 2.92c-1.18 1.18-.52 3.15 1.05 3.53H8l.51 3.88c.38 1.56 2.6 1.56 2.98 0l.51-3.88h3.74c1.56-.38-2.22-2.36 1.05-3.53l-2.92-2.92a.996.996 0 010-1.4l2.92-2.92c-1.18-1.18.52-3.15-1.05-3.53H12l-.51-3.88z" clipRule="evenodd" /></svg>
        </div>
    );
});