

import React from 'react';
import type { BossLaser as BossLaserType } from '../types';
import { GAME_WIDTH, PUNISHER_LASER_LANE_WIDTH_PERCENT, PUNISHER_LASER_CHARGE_TIME } from '../constants';

interface BossLaserProps {
  laser: BossLaserType;
  now: number;
}

const BossLaser: React.FC<BossLaserProps> = ({ laser, now }) => {
    const laneWidth = GAME_WIDTH * PUNISHER_LASER_LANE_WIDTH_PERCENT;
    const laneX = (GAME_WIDTH / 5) * laser.lane + (GAME_WIDTH / 10) - (laneWidth / 2);

    const isCharging = now < laser.fireStartTime;
    const isFiring = now >= laser.fireStartTime;
    const elapsedChargeTime = now - laser.chargeStartTime;
    const chargeProgress = Math.min(1, elapsedChargeTime / PUNISHER_LASER_CHARGE_TIME);

    if (isCharging) {
        return (
            <div
                className="absolute top-0 h-full pointer-events-none"
                style={{
                    left: `${laneX}px`,
                    width: `${laneWidth}px`,
                    background: `rgba(255, 0, 0, ${0.4 * chargeProgress})`,
                    boxShadow: `inset 0 0 15px rgba(255, 100, 100, ${0.7 * chargeProgress})`,
                    zIndex: 20,
                }}
            />
        );
    }

    if (isFiring) {
        return (
            <div
                className="absolute top-0 h-full pointer-events-none"
                style={{
                    left: `${laneX}px`,
                    width: `${laneWidth}px`,
                    background: 'radial-gradient(ellipse at center, rgba(255, 150, 150, 0.8) 0%, rgba(255, 0, 0, 0.5) 40%, transparent 70%)',
                    boxShadow: '0 0 30px #fff, 0 0 50px #f00, 0 0 80px #f00',
                    zIndex: 20,
                    animation: 'flicker 150ms infinite',
                }}
            >
                 {/* Core beam */}
                <div className="absolute top-0 left-1/4 w-1/2 h-full bg-white" style={{ filter: 'blur(2px)' }} />
                {/* Side particles/static */}
                <div className="absolute inset-0 w-full h-full overflow-hidden">
                    {Array.from({ length: 20 }).map((_, i) => (
                        <div key={i} className="absolute bg-red-300" style={{
                            width: '2px',
                            height: '10%',
                            left: `${Math.random() * 100}%`,
                            top: '-10%',
                            animation: `laser-particle-anim ${0.2 + Math.random() * 0.3}s linear infinite`,
                            animationDelay: `${Math.random() * 0.3}s`
                        }} />
                    ))}
                </div>
                <style>
                    {`
                        @keyframes flicker {
                            0% { opacity: 1; transform: scaleX(1.05); }
                            50% { opacity: 0.85; transform: scaleX(1); }
                            100% { opacity: 1; transform: scaleX(1.05); }
                        }
                        @keyframes laser-particle-anim {
                            from { transform: translateY(0%); }
                            to { transform: translateY(1000%); }
                        }
                    `}
                </style>
            </div>
        );
    }
    
    return null;
};

export default React.memo(BossLaser);