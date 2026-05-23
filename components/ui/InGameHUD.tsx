
import React, { useMemo } from 'react';
import type { GameState, GameAction } from '../../types';
import { GameStatus } from '../../types';
import * as C from '../../constants';
import { SurvivalTimerBar } from './SurvivalTimerBar';
import { InGameMessageOverlay } from './InGameMessageOverlay';
import { getStreakBonus } from '../../utils/progression';

interface InGameHUDProps {
    status: GameStatus;
    pauseStartTime?: number;
    lastTick: number;
    totalPauseDuration: number;
    reloadCompleteTime: number;
    generalUpgrades: GameState['generalUpgrades'];
    reloadBoosts: number;
    controlLayout: 'right' | 'left';
    trainingSimState: GameState['trainingSimState'];
    asteroidFieldEndTime: GameState['asteroidFieldEndTime'];
    boss: GameState['boss'];
    score: number;
    highScore: number;
    hasRevive: boolean;
    activeRareConsumable: GameState['activeRareConsumable'];
    hasHereticalInsight: boolean;
    level: number;
    pendingPostFightOutcome: GameState['pendingPostFightOutcome'];
    enemiesDefeatedInLevel: number;
    isHardMode: boolean;
    inGameMessages: GameState['inGameMessages'];
    levelUpAnnounceTime: number;
    pendingEncounter: GameState['pendingEncounter'];
    ammo: number;
    maxAmmo: number;
    levelStreakThisRun: number;
    currencyEarnedThisRun: number;
    partsEarnedThisRun: number;
    isMontezumaActive: boolean;
    asteroids: GameState['asteroids'];
    dispatch: React.Dispatch<GameAction>;
    effectiveNowForOverlay: number;
    lastPauseToggle: React.RefObject<number>;
}

const TrainingCountdown: React.FC<{ startTime: number, now: number }> = ({ startTime, now }) => {
    const remainingMs = startTime - now;
    if (remainingMs <= -500) return null; // Disappears 500ms after "GO!"

    let text = '';
    let key = '';

    if (remainingMs > 2000) {
        text = '3';
        key = '3';
    } else if (remainingMs > 1000) {
        text = '2';
        key = '2';
    } else if (remainingMs > 0) {
        text = '1';
        key = '1';
    } else {
        text = 'GO!';
        key = 'go';
    }

    return (
        <div key={key} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 animate-level-up pointer-events-none">
            <h2 className="text-9xl font-black text-yellow-400 uppercase" style={{ textShadow: '0 0 10px #ff0, 0 0 20px #f90, 0 0 30px #f00' }}>
                {text}
            </h2>
        </div>
    );
};

const InGameHUDComponent: React.FC<InGameHUDProps> = ({ 
    status, pauseStartTime, lastTick, totalPauseDuration, reloadCompleteTime, 
    generalUpgrades, reloadBoosts, controlLayout, trainingSimState, asteroidFieldEndTime, 
    boss, score, highScore, hasRevive, activeRareConsumable, hasHereticalInsight, level, pendingPostFightOutcome, 
    enemiesDefeatedInLevel, isHardMode, inGameMessages, levelUpAnnounceTime, 
    pendingEncounter, ammo, maxAmmo, levelStreakThisRun, currencyEarnedThisRun, 
    partsEarnedThisRun, isMontezumaActive, asteroids, dispatch, effectiveNowForOverlay, lastPauseToggle 
}) => {
    
    const gameActive = status === GameStatus.Playing || status === GameStatus.BossBattle || status === GameStatus.AsteroidField || status === GameStatus.TrainingSim;
    const isBossFight = status === GameStatus.BossBattle && boss;
    const showLevelBar = (status === GameStatus.Playing && !pendingPostFightOutcome && !isMontezumaActive);

    // Logic for the continuous reload button animation
    const { reloadAnimationStyle, reloadAnimationKey, isReloading } = useMemo(() => {
        const isGamePaused = status === GameStatus.Paused;
        
        // If the game is paused, we need to use a "frozen" timestamp to check the reload status.
        // We use the time the pause began. Otherwise, we use the latest game tick.
        const tickToUse = isGamePaused ? (pauseStartTime || lastTick) : lastTick;

        // Calculate the effective timestamp, which is pause-aware.
        // When paused, this correctly uses the time *at the moment of pausing*.
        // When running, this uses the current time, adjusted for total pause duration.
        const effectiveLastTick = tickToUse > 0 ? tickToUse - totalPauseDuration : 0;
        
        // The reload completion time is also in the pause-aware "effective" time domain.
        const isReloading = reloadCompleteTime > effectiveLastTick && lastTick > 0;
        
        if (isReloading) {
            let reloadBonus = 0;
            if (C.HANGAR_GENERAL_UPGRADE_CONFIG?.reload_speed_level && generalUpgrades.reload_speed_level > 0) {
                reloadBonus = C.HANGAR_GENERAL_UPGRADE_CONFIG.reload_speed_level[generalUpgrades.reload_speed_level - 1].effect;
            }
            const totalReloadReduction = Math.min((reloadBoosts * C.RELOAD_TIME_REDUCTION_PER_STACK) + reloadBonus, 0.9);
            const currentReloadTime = C.RELOAD_TIME * (1 - totalReloadReduction);
            
            // The number of rotations decreases as reload speed increases, but the rate of rotation is constant.
            // Base time (1.5s) = 4 spins (1440deg).
            const totalDegreesToRotate = 1440 * (1 - totalReloadReduction);

            const reloadAnimationStyle: React.CSSProperties = {
                // @ts-ignore
                '--reload-duration': `${currentReloadTime / 1000}s`,
                '--reload-degrees': `${totalDegreesToRotate}deg`,
            };
            const reloadAnimationKey = reloadCompleteTime;
            
            return { reloadAnimationStyle, reloadAnimationKey, isReloading };
        }

        return { reloadAnimationStyle: {}, reloadAnimationKey: 0, isReloading: false };

    }, [status, pauseStartTime, reloadCompleteTime, lastTick, totalPauseDuration, generalUpgrades, reloadBoosts]);
    
    const montezuma = useMemo(() => {
        if (!isMontezumaActive) return null;
        return asteroids.find(a => a.id === -999) ?? null;
    }, [isMontezumaActive, asteroids]);

    const showTopBar = showLevelBar || isBossFight;

    return (
        <div className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none z-20">
            
            {/* Main Top Bar (Left & Right aligned elements) */}
            <div 
              className="absolute top-0 left-0 right-0 z-30 p-2 sm:p-4 flex justify-between items-start"
              style={{ paddingTop: `calc(0.5rem + env(safe-area-inset-top, 0px))` }}
            >
              {/* LEFT SECTION: Score */}
              <div className="flex flex-col items-start">
                <div className="text-base font-bold text-cyan-300" style={{ textShadow: '0 0 5px #0ff' }}>
                    SCORE: {score.toLocaleString()}
                </div>
                <div className="text-sm font-bold text-slate-400">
                    HI: {highScore.toLocaleString()}
                </div>
              </div>

              {/* RIGHT SECTION: Pause & Hard Mode */}
              <div className="flex flex-col items-end gap-2">
                {(gameActive || status === GameStatus.Paused) && (
                    <button
                        onTouchStart={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const now = performance.now();
                            if (now - lastPauseToggle.current < 300) return;
                            lastPauseToggle.current = now;
                            dispatch({ type: 'TOGGLE_PAUSE', timestamp: now });
                        }}
                        onClick={(e) => {
                            e.preventDefault();
                            const now = performance.now();
                            if (now - lastPauseToggle.current < 300) return;
                            lastPauseToggle.current = now;
                            dispatch({ type: 'TOGGLE_PAUSE', timestamp: now });
                        }}
                        className="p-2 bg-slate-700/50 text-white rounded-full hover:bg-slate-600 pointer-events-auto"
                        aria-label="Pause"
                    >
                        {status === GameStatus.Paused ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                            </svg>
                        )}
                    </button>
                )}
                {isHardMode && (
                     <div className="text-base font-black text-pink-500 uppercase" style={{ textShadow: '0 0 5px #f0f' }}>
                        Hard Mode
                    </div>
                )}
              </div>
            </div>
            
            {/* CENTERED TOP BAR: LEVEL or BOSS HEALTH */}
            {showTopBar && (() => {
                const label = isBossFight ? boss.bossType.toUpperCase().replace('_', ' ') : `LEVEL ${level}`;
                const progressPercent = isBossFight
                    ? (boss.health / boss.maxHealth) * 100
                    : (enemiesDefeatedInLevel / C.ENEMIES_PER_LEVEL) * 100;
                
                const barColorClass = isBossFight ? 'bg-pink-500' : 'bg-cyan-400';
                const borderColorClass = isBossFight ? 'border-pink-500/50' : 'border-cyan-500/50';
                const textColorClass = isBossFight ? 'text-pink-300' : 'text-cyan-300';
                const textShadow = isBossFight ? '0 0 5px #f0f' : '0 0 5px #0ff';

                return (
                    <div 
                        className="absolute left-1/2 -translate-x-1/2 w-full max-w-[160px] text-center text-white"
                        style={{ top: `calc(0.5rem + env(safe-area-inset-top, 0px))` }}
                    >
                        <div className={`font-bold text-lg ${textColorClass}`} style={{ textShadow }}>
                            {label}
                        </div>
                        <div className={`h-2 bg-slate-700 rounded-full overflow-hidden mt-1 border ${borderColorClass}`}>
                            <div 
                                className={`h-full ${barColorClass} transition-all duration-300`}
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                    </div>
                );
            })()}
            
            {/* STATUS INDICATORS (Absolutely Positioned) */}
            {gameActive && (hasRevive || activeRareConsumable || hasHereticalInsight) && (
                <div 
                    className="absolute left-2 sm:left-4 flex flex-col items-start gap-2"
                    style={{ top: `calc(4.5rem + env(safe-area-inset-top, 0px))` }}
                >
                    {hasRevive && (
                        <div className="flex items-center gap-2 text-pink-400 animate-pulse" title="Revive Equipped">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor" style={{ filter: 'drop-shadow(0 0 5px #f472b6)' }}>
                                <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                            </svg>
                            <span className="font-bold text-base">REVIVE</span>
                        </div>
                    )}
                    {activeRareConsumable?.type === 'corrosive' && (
                        <div className="flex items-center gap-1 text-lime-400 animate-pulse p-1 bg-lime-900/50 border border-lime-500 rounded-md" title="Corrosive Rounds Active">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" style={{ filter: 'drop-shadow(0 0 5px #a3e635)' }}>
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            <span className="font-bold text-sm">CORROSIVE</span>
                            <span className="font-mono text-sm bg-slate-800 px-1.5 rounded">{activeRareConsumable.shotsLeft}</span>
                        </div>
                    )}
                    {hasHereticalInsight && (
                        <div className="flex items-center gap-2 text-purple-400" title="Heretical Insight: Double damage vs. The Overmind">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor" style={{ filter: 'drop-shadow(0 0 5px #c084fc)' }}>
                                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                <path fillRule="evenodd" d="M.458 10C3.732 4.943 9.522 3 10 3s6.268 1.943 9.542 7c-3.274 5.057-9.064 7-9.542 7S3.732 15.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                <path d="M9 7L10 10L11 7" stroke="#0f172a" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <span className="font-bold text-base">INSIGHT</span>
                        </div>
                    )}
                </div>
            )}

            {/* Ammo Empty Indicator */}
            {gameActive && ammo === 0 && !isReloading && (
                <div
                    className={`absolute z-30 w-20 flex flex-col items-center justify-center animate-bounce transition-opacity duration-300 ${
                        controlLayout === 'right' ? 'left-4' : 'right-4'
                    }`}
                    style={{ bottom: `calc(10.5rem + env(safe-area-inset-bottom, 0px))` }}
                >
                    <div className="text-red-400 font-bold text-[10px] sm:text-xs tracking-widest uppercase bg-slate-900/90 px-2 py-1 rounded border border-red-500/60 shadow-[0_0_15px_rgba(239,68,68,0.4)] backdrop-blur-sm">
                        RELOAD
                    </div>
                    {/* Professional Arrow (Double Chevron) */}
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6 text-red-400 -mt-1 drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                    >
                        <path d="M12 16L7 11H17L12 16Z" />
                        <path d="M12 9L7 4H17L12 9Z" opacity="0.5" />
                    </svg>
                </div>
            )}

            {/* Reload Button for Mobile */}
            {gameActive && (
                <button
                    onTouchStart={(e) => {
                        e.preventDefault(); // Prevent default browser actions
                        e.stopPropagation(); // Stops the event from reaching the game area
                        dispatch({ type: 'RELOAD_GUN' });
                    }}
                    onClick={(e) => { // Fallback for mouse users
                         e.preventDefault();
                         dispatch({ type: 'RELOAD_GUN' });
                    }}
                    className={`absolute z-40 w-20 h-20 bg-slate-700/50 text-white rounded-full border-2 border-slate-400/50 flex items-center justify-center pointer-events-auto transition-transform active:scale-95 active:bg-slate-700/80 ${controlLayout === 'right' ? 'left-4' : 'right-4'}`}
                    style={{ bottom: `calc(5rem + env(safe-area-inset-bottom, 0px))` }}
                    aria-label="Reload"
                >
                    <svg 
                        key={reloadAnimationKey}
                        xmlns="http://www.w3.org/2000/svg" 
                        className={`h-10 w-10 ${isReloading ? 'animate-reloading-spin' : ''}`}
                        style={isReloading ? reloadAnimationStyle : {}}
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 9a9 9 0 0114.13-4.13M20 15a9 9 0 01-14.13 4.13" />
                    </svg>
                </button>
            )}
            
            {/* Countdown Timer for Training Sim */}
            {status === GameStatus.TrainingSim && trainingSimState && effectiveNowForOverlay < trainingSimState.startTime && (
                <TrainingCountdown startTime={trainingSimState.startTime} now={effectiveNowForOverlay} />
            )}

            {/* Survival Timer */}
            {status === GameStatus.AsteroidField && asteroidFieldEndTime && (
                <SurvivalTimerBar endTime={asteroidFieldEndTime} now={effectiveNowForOverlay} duration={C.ASTEROID_FIELD_DURATION} title="SURVIVAL" />
            )}
            {status === GameStatus.TrainingSim && trainingSimState && effectiveNowForOverlay >= trainingSimState.startTime && (
                <>
                    <div className="absolute top-32 left-1/2 -translate-x-1/2 w-2/3 z-30 pointer-events-none text-center text-cyan-300 font-semibold" style={{ textShadow: '0 0 5px #0ff' }}>
                        Don't overshoot!
                    </div>
                    <SurvivalTimerBar endTime={trainingSimState.endTime} now={effectiveNowForOverlay} duration={C.TRAINING_SIM_DURATION} title="TIME REMAINING" />
                </>
            )}

            {/* Montezuma Health Bar (repurposed SurvivalTimerBar) */}
            {isMontezumaActive && montezuma && (
                <div className="absolute top-12 left-1/2 -translate-x-1/2 w-3/5 z-10 pointer-events-none">
                    <div className="text-center font-bold text-lg uppercase text-yellow-300 mb-1" style={{ textShadow: '0 0 5px #f59e0b' }}>MONTEZUMA</div>
                    <div className="h-4 bg-slate-700 rounded-full overflow-hidden border-2 border-yellow-500/50 shadow-lg">
                        <div 
                            className="h-full bg-yellow-400 transition-all duration-200 ease-linear"
                            style={{ width: `${(montezuma.health / montezuma.maxHealth) * 100}%`, boxShadow: `0 0 10px #facc15` }}
                        />
                    </div>
                </div>
            )}

            {/* In-Game Messages */}
            <InGameMessageOverlay messages={inGameMessages} now={effectiveNowForOverlay} />

            {/* Level Up Announcer */}
            {levelUpAnnounceTime > 0 && effectiveNowForOverlay - levelUpAnnounceTime < C.LEVEL_UP_ANNOUNCE_DURATION && !pendingEncounter && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 animate-level-up pointer-events-none">
                    <h2 className="text-7xl font-black text-yellow-400 uppercase" style={{ textShadow: '0 0 10px #ff0, 0 0 20px #f90' }}>
                        Level Up!
                    </h2>
                </div>
            )}

            <div className="absolute left-4 text-2xl font-bold text-cyan-300 z-20" style={{ textShadow: '0 0 5px #0ff', bottom: `calc(1rem + env(safe-area-inset-bottom, 0px))` }}>
                {isReloading ? (
                    <span className={`text-yellow-400 ${status !== GameStatus.Paused ? 'animate-pulse' : ''}`}>RELOADING...</span>
                ) : (
                    <span>
                        AMMO: <span className={ammo === 0 ? 'text-red-500 font-black' : ''}>{ammo}</span> / {maxAmmo}
                    </span>
                )}
            </div>
            
            <div className="absolute right-4 flex flex-col items-end gap-1 z-20" style={{ bottom: `calc(1rem + env(safe-area-inset-bottom, 0px))` }}>
                 {levelStreakThisRun > 0 && status !== GameStatus.TrainingSim && (
                    <span className="text-sm font-bold text-cyan-300" style={{ textShadow: '0 0 5px #0ff' }}>
                        x{(1 + levelStreakThisRun * getStreakBonus(isHardMode)).toFixed(2)} Streak
                    </span>
                )}
                 {currencyEarnedThisRun > 0 && (
                    <span className="text-lg font-bold text-yellow-300" style={{ textShadow: '0 0 5px #ff0' }}>
                        +{currencyEarnedThisRun.toLocaleString()}
                    </span>
                )}
                 {partsEarnedThisRun > 0 && (
                    <span className="text-lg font-bold text-orange-400 flex items-center gap-1" style={{ textShadow: '0 0 5px #f97316' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0L8 7.05H4.26c-1.56.38-2.22 2.36-1.05 3.53l2.92 2.92c.38.38.38 1 0 1.4l-2.92 2.92c-1.18 1.18-.52 3.15 1.05 3.53H8l.51 3.88c.38 1.56 2.6 1.56 2.98 0l.51-3.88h3.74c1.56-.38-2.22-2.36 1.05-3.53l-2.92-2.92a.996.996 0 010-1.4l2.92-2.92c-1.18-1.18.52-3.15-1.05-3.53H12l-.51-3.88z" clipRule="evenodd" /></svg>
                        +{partsEarnedThisRun.toLocaleString()}
                    </span>
                )}
            </div>
        </div>
    );
};

// Wrap in React.memo with a custom comparator to throttle updates
export const InGameHUD = React.memo(InGameHUDComponent, (prev, next) => {
    // Always re-render if critical state changes
    if (prev.status !== next.status) return false;
    if (prev.pauseStartTime !== next.pauseStartTime) return false;
    if (prev.hasRevive !== next.hasRevive) return false;
    if (prev.activeRareConsumable?.type !== next.activeRareConsumable?.type) return false;
    if (prev.activeRareConsumable?.shotsLeft !== next.activeRareConsumable?.shotsLeft) return false;
    
    // Throttle time-based updates to ~15 FPS (every 66ms)
    const timeDelta = next.effectiveNowForOverlay - prev.effectiveNowForOverlay;
    if (timeDelta < 66) {
        // Only skip if other visual props haven't changed significantly
        // Note: We deliberately ignore 'asteroids' array ref changes here, relying on efficient
        // recalculation inside the component if it does render.
        // Check if score or ammo changed, as we want those to be somewhat responsive
        // but 15fps is totally fine for text counters.
        return true; 
    }
    
    return false;
});
