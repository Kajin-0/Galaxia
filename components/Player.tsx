


import React from 'react';
import { PLAYER_MAX_SPEED } from '../constants';
import type { HeroType, GeneralUpgrades, PowerUpInfusionEffect, PowerUpType } from '../types';

interface LightingInfo {
    intensity: number;
    color: string;
    offsetX: number;
    offsetY: number;
}

interface PlayerProps {
  x: number;
  y: number;
  shieldActive: boolean;
  shieldHp?: number;
  maxShieldHp?: number;
  lastShotTime: number;
  now: number;
  vx: number;
  hero: HeroType;
  shieldBreaking: boolean;
  lighting: LightingInfo | null;
  generalUpgrades: GeneralUpgrades;
  lastTridentShotTime: number;
  infusions: PowerUpInfusionEffect[];
}

// A top-down muzzle flash, shaped like a cone of energy.
const MuzzleFlash: React.FC = () => (
    <div 
        className="absolute top-[-20%] left-[50%] w-[30%] h-[40%]" 
        style={{ 
            transform: 'translateX(-50%)',
            filter: 'blur(2px)',
            transformStyle: 'preserve-3d',
        }}
    >
        <div className="w-full h-full bg-yellow-300" style={{
            transform: 'translateZ(20px)', // Make sure it's on top
            clipPath: 'polygon(50% 0, 100% 100%, 0 100%)',
            boxShadow: '0 0 20px 10px #fef08a'
        }} />
    </div>
);

const CommonShipParts: React.FC = () => (
  <>
    {/* Engine Glows - furthest back/bottom */}
    <div className="absolute bottom-[0%] left-[30%] w-[15%] h-[25%] bg-orange-500 rounded-b-full blur" style={{ transform: 'translateZ(-10px)' }}/>
    <div className="absolute bottom-[0%] right-[30%] w-[15%] h-[25%] bg-orange-500 rounded-b-full blur" style={{ transform: 'translateZ(-10px)' }}/>
    {/* Cockpit */}
    <div 
        className="absolute top-[15%] left-[50%] w-[25%] h-[30%] bg-slate-600"
        style={{ 
            transform: 'translateX(-50%) translateZ(1px)',
            clipPath: 'polygon(50% 0, 100% 100%, 0 100%)' 
        }}
    />
    <div 
        className="absolute top-[20%] left-[50%] w-[15%] h-[20%] bg-cyan-300"
        style={{ 
            transform: 'translateX(-50%) translateZ(2px)',
            clipPath: 'polygon(50% 0, 100% 100%, 0 100%)',
            boxShadow: '0 0 8px #0ff, 0 0 15px #0ff'
        }}
    />
  </>
)

// The original player ship. Balanced design.
const HeroAlpha: React.FC<{ recoilActive: boolean }> = ({ recoilActive }) => (
    <div 
        className="relative w-full h-full transition-transform duration-75" 
        style={{ 
            transform: recoilActive ? 'translateY(3px)' : 'translateY(0)',
            transformStyle: 'preserve-3d' 
        }}
    >
        {/* Main Hull */}
        <div 
            className="absolute inset-0 bg-slate-700" 
            style={{ clipPath: 'polygon(50% 0, 100% 75%, 80% 100%, 20% 100%, 0 75%)' }}
        />
        <CommonShipParts />
        {/* Wing Details */}
        <div className="absolute top-[40%] left-[10%] w-[80%] h-[20%] bg-slate-500" style={{ 
            transform: 'translateZ(1px)',
            clipPath: 'polygon(0 0, 100% 0, 95% 100%, 5% 100%)'
        }} />
    </div>
);

// "The Needle". Sleek and aggressive.
const HeroBeta: React.FC<{ recoilActive: boolean }> = ({ recoilActive }) => (
    <div 
        className="relative w-full h-full transition-transform duration-75" 
        style={{ 
            transform: recoilActive ? 'translateY(3px)' : 'translateY(0)',
            transformStyle: 'preserve-3d' 
        }}
    >
        {/* Main Hull */}
        <div 
            className="absolute inset-0 bg-slate-700" 
            style={{ clipPath: 'polygon(50% 0, 70% 90%, 50% 100%, 30% 90%)' }}
        />
        <CommonShipParts />
         {/* Stabilizers */}
        <div className="absolute top-[60%] left-[20%] w-[20%] h-[30%] bg-slate-500" style={{ clipPath: 'polygon(0 0, 100% 50%, 0 100%)' }} />
        <div className="absolute top-[60%] right-[20%] w-[20%] h-[30%] bg-slate-500" style={{ clipPath: 'polygon(100% 0, 0 50%, 100% 100%)' }} />
    </div>
);


// "The Bruiser". Wide and heavy.
const HeroGamma: React.FC<{ recoilActive: boolean }> = ({ recoilActive }) => (
    <div 
        className="relative w-full h-full transition-transform duration-75" 
        style={{ 
            transform: recoilActive ? 'translateY(3px)' : 'translateY(0)',
            transformStyle: 'preserve-3d' 
        }}
    >
        {/* Main Hull */}
        <div 
            className="absolute inset-0 bg-slate-700" 
            style={{ clipPath: 'polygon(50% 0, 100% 40%, 85% 100%, 15% 100%, 0 40%)' }}
        />
        <CommonShipParts />
        {/* Heavy Wing Details */}
        <div className="absolute top-[30%] left-0 w-[30%] h-[50%] bg-slate-600" style={{ clipPath: 'polygon(0 0, 100% 30%, 100% 70%, 0 100%)' }} />
        <div className="absolute top-[30%] right-0 w-[30%] h-[50%] bg-slate-600" style={{ clipPath: 'polygon(100% 0, 0 30%, 0 70%, 100% 100%)' }} />
    </div>
);


const DroneMuzzleFlash: React.FC = () => (
    <div 
        className="absolute top-[-15%] left-[50%] w-[50%] h-[30%]" 
        style={{ 
            transform: 'translateX(-50%)',
            filter: 'blur(1px)',
        }}
    >
        <div className="w-full h-full bg-orange-300" style={{
            clipPath: 'polygon(50% 0, 100% 100%, 0 100%)',
            boxShadow: '0 0 10px 5px #fdba74' // orange-300
        }} />
    </div>
);


// A top-down view of the flanking gun drones.
const GunDrone: React.FC<{ muzzleFlashActive: boolean; level: number; }> = ({ muzzleFlashActive, level }) => {
    const droneRecoil = muzzleFlashActive ? 'translateY(2px)' : 'translateY(0)';
    const isUpgraded = level > 0;

    // Define colors and effects based on upgrade status
    const eyeColorClass = isUpgraded ? 'bg-orange-400' : 'bg-cyan-400';
    const eyeBoxShadow = isUpgraded ? '0 0 5px #fb923c' : '0 0 5px #22d3ee'; // orange vs cyan shadow
    
    // Level 2+ drones get a subtle visual enhancement
    const level2Glow = level >= 2 ? 'drop-shadow(0 0 6px #fb923c)' : 'none';

    return (
        <div className="relative w-full h-full transition-transform duration-75" style={{ transform: droneRecoil, filter: level2Glow, transformStyle: 'preserve-3d' }}>
            {/* Drone Body */}
            <div className="absolute inset-0 bg-slate-600" style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)' }}/>
            {/* Drone 'Eye' - changes color based on upgrade status */}
            <div className={`absolute top-[50%] left-[50%] w-[40%] h-[40%] ${eyeColorClass} rounded-full`} style={{ 
                transform: 'translate(-50%, -50%) translateZ(2px)',
                boxShadow: eyeBoxShadow
            }}/>
            {muzzleFlashActive && <DroneMuzzleFlash />}
        </div>
    );
};

const ShieldHpIndicator: React.FC<{ hp: number, maxHp: number }> = ({ hp, maxHp }) => {
    const radius = 45;
    const strokeWidth = 5;
    const circumference = 2 * Math.PI * radius;
    const progress = hp / maxHp;
    const offset = circumference * (1 - progress);

    return (
        <svg className="absolute -inset-8 w-[calc(100%+4rem)] h-[calc(100%+4rem)]" style={{ transform: 'translateZ(-12px)' }} viewBox="0 0 100 100">
            <defs>
                <filter id="shieldGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                    <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>
            {/* Background of the circle */}
            <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(0, 255, 255, 0.15)" strokeWidth={strokeWidth} />
            {/* Foreground (progress) of the circle */}
            <circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke="#0ff"
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
                style={{ transition: 'stroke-dashoffset 0.3s ease', filter: 'url(#shieldGlow)' }}
            />
        </svg>
    )
};

const ShieldShatterEffect: React.FC = React.memo(() => {
    const fragments = React.useMemo(() => Array.from({ length: 20 }, (_, i) => ({
        size: Math.random() * 15 + 5,
        tx: `${(Math.random() - 0.5) * 200}px`,
        ty: `${(Math.random() - 0.5) * 200}px`,
        rStart: `${Math.random() * 360}deg`,
        rEnd: `${Math.random() * 720 - 360}deg`,
        delay: `${Math.random() * 100}ms`
    })), []);

    return (
        <div className="absolute -inset-4 w-[calc(100%+2rem)] h-[calc(100%+2rem)] pointer-events-none">
            {fragments.map((f, i) => (
                <div
                    key={i}
                    className="absolute top-1/2 left-1/2 bg-cyan-300 animate-shield-shatter-fragment"
                    style={{
                        width: f.size,
                        height: f.size,
                        clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)', // Diamond shape
                        // @ts-ignore
                        '--tx': f.tx,
                        '--ty': f.ty,
                        '--r-start': f.rStart,
                        '--r-end': f.rEnd,
                        animationDelay: f.delay,
                    }}
                />
            ))}
        </div>
    );
});

const powerUpColorMap: Record<PowerUpType, string> = {
    RapidFire:  '#ef4444', // red-500
    SpreadShot: '#a855f7', // purple-500
    Shield:     '#22d3ee', // cyan-400
    ExtendedMag:'#3b82f6', // blue-500
    AutoReload: '#22c55e', // green-500
    CritBoost:  '#f97316', // orange-500
    ReloadBoost:'#facc15', // yellow-400
};

const heroClipPaths: Record<HeroType, string> = {
    alpha: 'polygon(50% 0, 100% 75%, 80% 100%, 20% 100%, 0 75%)',
    beta: 'polygon(50% 0, 70% 90%, 50% 100%, 30% 90%)',
    gamma: 'polygon(50% 0, 100% 40%, 85% 100%, 15% 100%, 0 40%)',
};

const InfusionEffect: React.FC<{ infusion: PowerUpInfusionEffect; hero: HeroType }> = React.memo(({ infusion, hero }) => {
    const color = powerUpColorMap[infusion.powerUpType];

    return (
        <div 
            className="absolute inset-0 overflow-hidden pointer-events-none" 
            style={{ 
                clipPath: heroClipPaths[hero],
                transform: 'translateZ(10px)' // Render on top of the ship
            }}>
            <div 
                className="absolute w-full h-full animate-power-up-infuse"
                style={{
                    background: `linear-gradient(to bottom, transparent 0%, ${color} 40%, ${color} 60%, transparent 100%)`,
                    filter: `blur(4px) brightness(2.0)`,
                }}
            />
        </div>
    );
});


const Player: React.FC<PlayerProps> = ({ x, y, shieldActive, shieldHp, maxShieldHp, lastShotTime, now, vx, hero, shieldBreaking, lighting, generalUpgrades, lastTridentShotTime, infusions }) => {
  const recoilActive = now - lastShotTime < 80; // Recoil is visible for 80ms
  const muzzleFlashActive = now - lastShotTime < 50; // Muzzle flash is visible for 50ms

  // Calculate a banking/tilt effect based on horizontal velocity
  const maxTilt = 15; // degrees
  const tilt = (vx / PLAYER_MAX_SPEED) * maxTilt;
  
  const tridentLevel = generalUpgrades.trident_shot_level;
  const showDrones = true;
  const tridentMuzzleFlashActive = now - lastTridentShotTime < 50;

  const renderHero = () => {
    switch (hero) {
        case 'beta': return <HeroBeta recoilActive={recoilActive} />;
        case 'gamma': return <HeroGamma recoilActive={recoilActive} />;
        case 'alpha':
        default:
            return <HeroAlpha recoilActive={recoilActive} />;
    }
  }

  return (
    <div
      className="absolute"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        transform: `translateX(-50%) rotateZ(${tilt}deg)`,
        width: '8%', // Adjusted for a more ship-like ratio
        height: '10%',
        filter: shieldActive ? 'none' : 'drop-shadow(0 0 10px #0ff) drop-shadow(0 0 20px #0ff)',
        willChange: 'left, transform',
        transformStyle: 'preserve-3d', // Establish 3D context for children
      }}
    >
      {shieldBreaking ? (
          <ShieldShatterEffect />
      ) : shieldActive && (
          <div className="absolute -inset-4 animate-shield-form">
            <div 
              className="w-full h-full rounded-full bg-cyan-400/20 border-2 border-cyan-300" 
              style={{
                  transform: 'translateZ(-10px)',
                  boxShadow: 'inset 0 0 10px #0ff, 0 0 20px #0ff',
              }}
            />
            {hero === 'gamma' && typeof shieldHp === 'number' && typeof maxShieldHp === 'number' && maxShieldHp > 1 && (
                <ShieldHpIndicator hp={shieldHp} maxHp={maxShieldHp} />
            )}
          </div>
      )}
      <div className="relative w-full h-full" style={{ transformStyle: 'preserve-3d' }}>
         {/* Main player ship sprite */}
         <div className="absolute w-full h-full" style={{ transform: 'translateZ(0px)' }}>
            {renderHero()}
         </div>
         {/* Drones floating to the sides */}
         {showDrones && (
            <>
                <div className="absolute left-[-80%] top-[30%] w-[60%] h-[60%]" style={{ transform: 'translateZ(5px)'}}>
                    <GunDrone muzzleFlashActive={tridentLevel > 0 && tridentMuzzleFlashActive} level={tridentLevel} />
                </div>
                <div className="absolute right-[-80%] top-[30%] w-[60%] h-[60%]" style={{ transform: 'translateZ(5px)'}}>
                    <GunDrone muzzleFlashActive={tridentLevel > 0 && tridentMuzzleFlashActive} level={tridentLevel} />
                </div>
            </>
         )}
         
         {muzzleFlashActive && <MuzzleFlash />}

         {/* Dynamic lighting overlay */}
         {lighting && (
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background: `radial-gradient(circle at ${lighting.offsetX}% ${lighting.offsetY}%, ${lighting.color} 0%, transparent 70%)`,
                    opacity: lighting.intensity * 0.7,
                    mixBlendMode: 'color-dodge',
                    transition: 'opacity 100ms linear',
                }}
            />
        )}
        {infusions.map(infusion => (
            <InfusionEffect key={infusion.id} infusion={infusion} hero={hero} />
        ))}
      </div>
    </div>
  );
};

export default Player;