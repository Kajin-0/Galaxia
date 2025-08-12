
import React from 'react';
import type { Boss as BossType, BossType as BT } from '../types';
import * as C from '../constants';
import { WARDEN_WIDTH, WARDEN_HEIGHT, PUNISHER_WIDTH, PUNISHER_HEIGHT, BOSS_ENTER_DURATION, BOSS_DEFEATED_DURATION, OVERMIND_WIDTH, OVERMIND_HEIGHT } from '../constants';

interface BossProps {
  boss: BossType;
  wasHit: boolean;
}

const WardenVisual: React.FC = () => (
    <div className="relative w-full h-full" style={{ transformStyle: 'preserve-3d' }}>
        {/* Main Hull */}
        <div className="absolute inset-0 bg-slate-800" style={{
            clipPath: 'polygon(50% 0%, 80% 20%, 100% 50%, 80% 80%, 50% 100%, 20% 80%, 0% 50%, 20% 20%)'
        }} />
        {/* Cockpit */}
        <div className="absolute top-[5%] left-[40%] w-[20%] h-[30%] bg-pink-500 rounded-t-lg" style={{ transform: 'translateZ(5px)', boxShadow: '0 0 10px #f0f' }}/>
        {/* Side Cannons */}
        <div className="absolute top-[30%] left-[-10%] w-[20%] h-[40%] bg-slate-600" style={{ transform: 'translateZ(-5px)', clipPath: 'polygon(0 0, 100% 25%, 100% 75%, 0 100%)' }}/>
        <div className="absolute top-[30%] right-[-10%] w-[20%] h-[40%] bg-slate-600" style={{ transform: 'translateZ(-5px)', clipPath: 'polygon(100% 0, 0 25%, 0 75%, 100% 100%)' }}/>
        {/* Engine Glow */}
        <div className="absolute bottom-0 left-[35%] w-[30%] h-[20%] bg-purple-600 blur-md rounded-b-full" style={{ transform: 'translateZ(-10px)', animation: 'pulse 1s infinite alternate' }}/>
    </div>
);

const PunisherVisual: React.FC = () => (
    <div className="relative w-full h-full" style={{ transformStyle: 'preserve-3d' }}>
        {/* Main Hull - More aggressive and angular */}
        <div className="absolute inset-0 bg-gray-900" style={{
            clipPath: 'polygon(50% 0, 100% 35%, 85% 100%, 15% 100%, 0 35%)'
        }} />
        {/* Red armor plating */}
        <div className="absolute top-[5%] left-[5%] w-[90%] h-[50%] bg-red-800" style={{
             transform: 'translateZ(2px)',
             clipPath: 'polygon(50% 0, 95% 40%, 80% 100%, 20% 100%, 5% 40%)'
        }}/>
        {/* Central 'Eye' / Laser emitter */}
        <div className="absolute top-[10%] left-[45%] w-[10%] h-[20%] bg-red-500" style={{ transform: 'translateZ(5px)', boxShadow: '0 0 15px #f00' }}/>
        {/* Huge side weapon pods */}
        <div className="absolute top-[20%] left-[-15%] w-[30%] h-[70%] bg-gray-700" style={{ transform: 'translateZ(-5px)', clipPath: 'polygon(50% 0, 100% 10%, 100% 90%, 50% 100%, 0 50%)' }}/>
        <div className="absolute top-[20%] right-[-15%] w-[30%] h-[70%] bg-gray-700" style={{ transform: 'translateZ(-5px)', clipPath: 'polygon(50% 0, 0 10%, 0 90%, 50% 100%, 100% 50%)' }}/>
        {/* Engine Glow (intense red) */}
        <div className="absolute bottom-0 left-[30%] w-[40%] h-[15%] bg-red-600 blur-lg rounded-b-full" style={{ transform: 'translateZ(-10px)', animation: 'pulse 0.5s infinite alternate' }}/>
    </div>
);

const OvermindVisual: React.FC<{ phase: BossType['phase'], isInvulnerable?: boolean }> = ({ phase, isInvulnerable }) => {
    const isFury = phase === 'fury' || phase === 'beam';
    const isDormant = isInvulnerable && phase === 'spawning_fragments';

    return (
        <div className="relative w-full h-full" style={{ transformStyle: 'preserve-3d' }}>
            {/* Core Energy - always visible but changes */}
            <div className={`absolute inset-[25%] rounded-full transition-all duration-500 ${isFury ? 'bg-cyan-300 animate-pulse' : 'bg-purple-500'}`} style={{
                boxShadow: isFury ? '0 0 40px #0ff, 0 0 80px #0ff' : '0 0 20px #a855f7',
                transform: `scale(${isDormant ? 0.8 : 1})`,
            }} />
            
            {/* Crystalline Armor Pieces - break away for fury phase */}
            {['0deg', '90deg', '180deg', '270deg'].map(rot => (
                <div key={rot} className="absolute inset-0 transition-transform duration-1000" style={{ transform: `rotate(${rot}) ${isFury ? 'translateY(-80%) scale(0.5)' : 'translateY(0) scale(1)'}`, opacity: isFury ? 0 : 1 }}>
                    <div className="absolute top-[-15%] left-[35%] w-[30%] h-[60%] bg-slate-700" style={{
                        clipPath: 'polygon(50% 0, 100% 100%, 0 100%)'
                    }}/>
                </div>
            ))}
             {['45deg', '135deg', '225deg', '315deg'].map(rot => (
                <div key={rot} className="absolute inset-[10%] transition-transform duration-1000" style={{ transform: `rotate(${rot}) ${isFury ? 'translateY(-60%) scale(0.5)' : 'translateY(0) scale(1)'}`, opacity: isFury ? 0 : 1 }}>
                    <div className="absolute top-[0%] left-[40%] w-[20%] h-[40%] bg-slate-600" style={{
                        clipPath: 'polygon(50% 0, 100% 100%, 0 100%)'
                    }}/>
                </div>
            ))}
        </div>
    );
};

const Boss: React.FC<BossProps> = ({ boss, wasHit }) => {
  const now = performance.now();
  let opacity = 1;

  const bossMap: Record<BT, { width: number; height: number; component: React.FC<any>; shadow: string }> = {
      warden: { width: WARDEN_WIDTH, height: WARDEN_HEIGHT, component: WardenVisual, shadow: 'drop-shadow(0 0 15px #f0f) drop-shadow(0 0 30px #f0f)' },
      punisher: { width: PUNISHER_WIDTH, height: PUNISHER_HEIGHT, component: PunisherVisual, shadow: 'drop-shadow(0 0 15px #f00) drop-shadow(0 0 30px #f00)' },
      overmind: { width: OVERMIND_WIDTH, height: OVERMIND_HEIGHT, component: OvermindVisual, shadow: 'drop-shadow(0 0 20px #0ff) drop-shadow(0 0 40px #a855f7)'}
  };

  const currentBoss = bossMap[boss.bossType];
  const VisualComponent = currentBoss.component;

  let filter = currentBoss.shadow;
  let transform = `translateX(-50%)`;
  
  const phaseTime = now - boss.phaseStartTime;

  if (boss.phase === 'entering') {
    opacity = Math.min(1, phaseTime / BOSS_ENTER_DURATION);
  }
  
  if (boss.phase === 'defeated') {
    const defeatProgress = Math.min(1, phaseTime / BOSS_DEFEATED_DURATION);
    opacity = 1 - defeatProgress;
    const shakeX = (Math.random() - 0.5) * 10 * defeatProgress;
    const shakeY = (Math.random() - 0.5) * 10 * defeatProgress;
    transform += ` translate(${shakeX}px, ${shakeY}px)`;
  }
  
  if (wasHit && !boss.isInvulnerable) {
      filter = 'drop-shadow(0 0 15px #fff) drop-shadow(0 0 30px #fff) brightness(2)';
      transform += ' scale(1.03)';
  }
  
  return (
    <div
      className="absolute"
      style={{
        left: `${boss.x}px`,
        top: `${boss.y}px`,
        width: `${currentBoss.width}px`,
        height: `${currentBoss.height}px`,
        transform: transform,
        willChange: 'transform, top, left, opacity, filter',
        transformStyle: 'preserve-3d',
        opacity,
        filter,
        transition: `filter 100ms ease-in-out, transform 100ms ease-in-out, opacity 200ms linear`,
      }}
    >
        <VisualComponent phase={boss.phase} isInvulnerable={boss.isInvulnerable} />
        {boss.phase === 'defeated' && (
            <>
                <div className="absolute top-1/4 left-1/4 w-1/2 h-1/2 bg-yellow-400/50 rounded-full animate-ping"/>
                <div className="absolute top-1/2 left-1/2 w-1/4 h-1/4 bg-white/50 rounded-full animate-ping" style={{animationDelay: '200ms'}}/>
            </>
        )}
    </div>
  );
};

export const OvermindBeamVisual: React.FC<{ boss: BossType, now: number }> = ({ boss, now }) => {
    if (!boss.beamChargeStartTime) return null;

    const chargeProgress = Math.min(1, (now - boss.beamChargeStartTime) / C.OVERMIND_BEAM_CHARGE_TIME);
    
    if (now < (boss.beamFireStartTime ?? Infinity)) {
        // Charging visual
        return (
            <div className="absolute top-0 h-full w-full pointer-events-none z-20">
                {/* Safe Zone Indicator */}
                <div className="absolute top-0 h-full bg-green-500/20" style={{ left: boss.safeSpotX, width: C.OVERMIND_BEAM_SAFE_ZONE_WIDTH }}/>
                {/* Danger Zone Charge-up */}
                <div className="absolute top-0 h-full bg-red-500/20" style={{ left: 0, width: boss.safeSpotX, opacity: chargeProgress }} />
                <div className="absolute top-0 h-full bg-red-500/20" style={{ left: (boss.safeSpotX ?? 0) + C.OVERMIND_BEAM_SAFE_ZONE_WIDTH, right: 0, opacity: chargeProgress }} />
            </div>
        )
    }

    // Firing visual
    return (
        <div className="absolute top-0 h-full w-full pointer-events-none z-20 animate-pulse">
            {/* The beam itself */}
            <div className="absolute top-0 h-full bg-gradient-to-r from-red-600 via-yellow-300 to-red-600" style={{ left: 0, width: boss.safeSpotX, filter: 'blur(5px)' }} />
            <div className="absolute top-0 h-full bg-gradient-to-r from-red-600 via-yellow-300 to-red-600" style={{ left: (boss.safeSpotX ?? 0) + C.OVERMIND_BEAM_SAFE_ZONE_WIDTH, right: 0, filter: 'blur(5px)' }} />
            {/* White hot core */}
            <div className="absolute top-0 h-full bg-white" style={{ left: 0, width: boss.safeSpotX, transform: 'scaleX(0.5)', transformOrigin: 'right', filter: 'blur(2px)' }} />
            <div className="absolute top-0 h-full bg-white" style={{ left: (boss.safeSpotX ?? 0) + C.OVERMIND_BEAM_SAFE_ZONE_WIDTH, right: 0, transform: 'scaleX(0.5)', transformOrigin: 'left', filter: 'blur(2px)' }} />
        </div>
    )
}

export default Boss;
