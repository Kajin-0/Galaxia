import React from 'react';

interface Particle {
  id: number;
  angle: number;
  distance: number;
  size: number;
  delay: number;
  duration: number;
  color: string;
}

const colors = ['#fde047', '#facc15', '#fbbf24', '#f59e0b']; // yellow-300 to amber-500

const generateParticles = (count: number): Particle[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    angle: Math.random() * 360,
    distance: Math.random() * 60 + 40, // 40px to 100px
    size: Math.random() * 6 + 4, // 4px to 10px
    delay: Math.random() * 200, // 0 to 200ms
    duration: Math.random() * 400 + 400, // 400ms to 800ms
    color: colors[Math.floor(Math.random() * colors.length)],
  }));
};

export const HangarUpgradeAnimation: React.FC<{ x: number, y: number }> = ({ x, y }) => {
  const particles = React.useMemo(() => generateParticles(30), []);

  return (
    <div
      className="fixed inset-0 pointer-events-none z-50"
      style={{
        transformStyle: 'preserve-3d', // Needed for 3D transforms on children
      }}
    >
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute"
          style={{
            left: x,
            top: y,
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: '50%',
            animation: `upgrade-particle-anim ${p.duration}ms ease-out forwards`,
            animationDelay: `${p.delay}ms`,
            // @ts-ignore
            '--angle': `${p.angle}deg`,
            '--distance': `${p.distance}px`,
          }}
        />
      ))}
      <style>{`
        @keyframes upgrade-particle-anim {
          0% {
            transform: translate(-50%, -50%) rotate(0deg) translateX(0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) rotate(var(--angle)) translateX(var(--distance)) scale(0);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};
