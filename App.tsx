

import React, { useReducer, useEffect, useCallback, useRef } from 'react';
import type { GameState, GameAction, Consumables, PossibleOutcome } from './types';
import { GameStatus } from './types';
import * as C from './constants';
import { playSound, playMusic, stopMusic } from './sounds';
import Player from './components/Player';
import GameCanvas from './components/GameCanvas';
import Lightning from './components/Lightning';
import { StartScreen } from './components/ui/StartScreen';
import { GameOverScreen } from './components/ui/GameOverScreen';
import { ArmoryScreen } from './components/ui/ArmoryScreen';
import { HangarScreen } from './components/ui/HangarScreen';
import { StoryScreen } from './components/ui/StoryScreen';
import { PauseScreen } from './components/ui/PauseScreen';
import { RandomEncounterScreen } from './components/ui/RandomEncounterScreen';
import { EncounterOutcomeScreen } from './components/ui/EncounterOutcomeScreen';
import { EncounterProcessingScreen } from './components/ui/EncounterProcessingScreen';
import { BossHealthBar } from './components/ui/BossHealthBar';
import { SurvivalTimerBar } from './components/ui/SurvivalTimerBar';
import { InGameMessageOverlay } from './components/ui/InGameMessageOverlay';
import BossComponent, { OvermindBeamVisual } from './components/Boss';
import BossLaserComponent from './components/BossLaser';
import TrainingTargetComponent from './components/TrainingTarget';
import EmpArcComponent from './components/EmpArc';
import WeaverBeamComponent from './components/WeaverBeam';
import { RockImpactExplosion, CriticalHitExplosionComponent, ConduitLinkBeam, UpgradePartCollect } from './components/GameEffects';
import { NebulaBackground } from './components/NebulaBackground';
import { getInitialState } from './utils/progression';
import { gameReducer } from './state/reducer';


interface LightingInfo {
    intensity: number;
    color: string;
    offsetX: number; // percentage
    offsetY: number; // percentage
}

// This type is available in modern TypeScript DOM libraries but is included here for robustness.
interface WakeLockSentinel extends EventTarget {
  readonly released: boolean;
  readonly type: 'screen';
  release(): Promise<void>;
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


function App() {
    const [state, dispatch] = useReducer(gameReducer, getInitialState());
    const pressedKeys = useRef(new Set<string>());
    const gameAreaRef = useRef<HTMLDivElement>(null);
    const asteroidsHitThisTick = useRef(new Set<number>());
    const wakeLockRef = useRef<WakeLockSentinel | null>(null);

    useEffect(() => {
        asteroidsHitThisTick.current.clear();
    });

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        pressedKeys.current.add(e.code);
        if (e.code === 'Space' && (state.status === GameStatus.Playing || state.status === GameStatus.BossBattle || state.status === GameStatus.AsteroidField || state.status === GameStatus.TrainingSim)) {
            e.preventDefault(); // Prevent page scroll
            dispatch({ type: 'RELOAD_GUN' });
        }
        const pausableStates = [GameStatus.Playing, GameStatus.BossBattle, GameStatus.Paused, GameStatus.AsteroidField, GameStatus.TrainingSim];
        if (e.key.toLowerCase() === 'p' && pausableStates.includes(state.status)) {
            e.preventDefault();
            dispatch({ type: 'TOGGLE_PAUSE', timestamp: performance.now() });
        }
    }, [state.status]);

    useEffect(() => {
        const handleKeyUp = (e: KeyboardEvent) => pressedKeys.current.delete(e.code);
        
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [handleKeyDown]);
    
    useEffect(() => {
        const activeStates = [GameStatus.Playing, GameStatus.BossBattle, GameStatus.PlayerDying, GameStatus.EncounterProcessing, GameStatus.AsteroidField, GameStatus.TrainingSim];
        if (activeStates.includes(state.status)) return;
        
        let lastTimestamp = performance.now();
        const loop = (timestamp: number) => {
            if (timestamp - lastTimestamp > 100) {
                // To prevent UI from becoming stale in menus, we still need a tick source.
                // We use GAME_TICK for this, but the reducer won't run the main game logic.
                dispatch({ type: 'GAME_TICK', timestamp, pressedKeys: pressedKeys.current });
                lastTimestamp = timestamp;
            }
            animationFrameId = requestAnimationFrame(loop);
        };
        let animationFrameId = requestAnimationFrame(loop);

        return () => cancelAnimationFrame(animationFrameId);
    }, [state.status]);

    useEffect(() => {
        const activeStates = [GameStatus.Playing, GameStatus.BossBattle, GameStatus.PlayerDying, GameStatus.EncounterProcessing, GameStatus.AsteroidField, GameStatus.TrainingSim];
        if (!activeStates.includes(state.status)) return;
        
        let animationFrameId: number;
        const loop = (timestamp: number) => {
            dispatch({ type: 'GAME_TICK', timestamp, pressedKeys: pressedKeys.current });
            animationFrameId = requestAnimationFrame(loop);
        };
        animationFrameId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(animationFrameId);
    }, [state.status]);

    // Manages the Screen Wake Lock API and pausing on visibility change.
    useEffect(() => {
        const activeStates = [GameStatus.Playing, GameStatus.BossBattle, GameStatus.AsteroidField, GameStatus.TrainingSim];
        const shouldBeActive = activeStates.includes(state.status);

        const manageWakeLock = async () => {
            if (!('wakeLock' in navigator)) {
                return;
            }

            try {
                if (shouldBeActive && document.visibilityState === 'visible') {
                    if (wakeLockRef.current === null) { // Only request if we don't have one
                        wakeLockRef.current = await navigator.wakeLock.request('screen');
                        wakeLockRef.current.addEventListener('release', () => {
                            // This handles cases where the lock is released by the system (e.g. battery low)
                            wakeLockRef.current = null;
                        });
                    }
                } else {
                    if (wakeLockRef.current) {
                        await wakeLockRef.current.release();
                        // The 'release' event listener above will set the ref to null.
                    }
                }
            } catch (err: any) {
                console.error(`Could not manage wake lock: ${err.name}, ${err.message}`);
            }
        };
    
        manageWakeLock(); // Call on status change to acquire/release lock

        const handleVisibilityChange = () => {
            // Pause the game if it's active and the tab is hidden
            if (document.hidden && activeStates.includes(state.status)) {
                dispatch({ type: 'TOGGLE_PAUSE', timestamp: performance.now() });
            }
            // Re-evaluate the wake lock state on any visibility change
            manageWakeLock();
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            // Ensure the lock is released on component unmount
            if (wakeLockRef.current) {
                wakeLockRef.current.release();
            }
        };
    }, [state.status]); // Re-run this logic whenever game status changes.


    useEffect(() => {
        switch (state.status) {
            case GameStatus.StartScreen:
            case GameStatus.Hangar:
                playMusic('music/Title_Screen.mp3');
                break;
            case GameStatus.Armory:
            case GameStatus.Intermission:
                playMusic('music/Armory_BGM.mp3');
                break;
            case GameStatus.Playing:
            case GameStatus.BossBattle:
            case GameStatus.AsteroidField:
            case GameStatus.TrainingSim:
                playMusic('music/Battle_BGM.mp3');
                break;
            
            case GameStatus.GameOver:
            case GameStatus.Story:
            case GameStatus.Victory:
            case GameStatus.PlayerDying:
            case GameStatus.RandomEncounter:
            case GameStatus.EncounterOutcome:
            case GameStatus.EncounterProcessing:
                 stopMusic();
                 break;
            
            case GameStatus.Paused:
                // Music continues playing during pause
                break;
        }
    }, [state.status]);

    const getGameCoordX = (e: React.TouchEvent<HTMLDivElement>): number | null => {
        if (gameAreaRef.current) {
            const rect = gameAreaRef.current.getBoundingClientRect();
            const relativeX = e.touches[0].clientX - rect.left;
            return (relativeX / rect.width) * C.GAME_WIDTH;
        }
        return null;
    }
    
    const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
        e.preventDefault();
        const gameCoordX = getGameCoordX(e);
        if (gameCoordX !== null) {
            dispatch({ type: 'TOUCH_START', x: gameCoordX });
        }
    }, []);
    
    const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
        e.preventDefault();
        const gameCoordX = getGameCoordX(e);
        if (gameCoordX !== null) {
            dispatch({ type: 'TOUCH_MOVE', x: gameCoordX });
        }
    }, []);
    
    const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
        e.preventDefault();
        dispatch({ type: 'TOUCH_END' });
    }, []);

    let shakeX = 0;
    let shakeY = 0;
    if (state.screenShake.magnitude > 0 && state.status !== GameStatus.Paused) {
        const { magnitude, duration, startTime } = state.screenShake;
        const elapsed = state.lastTick - startTime;
        if (elapsed < duration) {
            const progress = elapsed / duration;
            const currentMagnitude = magnitude * (1 - progress * progress);
            shakeX = (Math.random() - 0.5) * 2 * currentMagnitude;
            shakeY = (Math.random() - 0.5) * 2 * currentMagnitude;
        }
    }

    const getProjectileColor = () => {
        if (state.generalUpgrades.trident_shot_level > 0) return C.PROJECTILE_COLOR_DEFAULT;
        if (state.activePowerUps.RapidFire || state.hasPermanentRapidFire) return C.PROJECTILE_COLOR_RAPID_FIRE;
        if (state.activePowerUps.SpreadShot) return C.PROJECTILE_COLOR_SPREAD_SHOT;
        return C.PROJECTILE_COLOR_DEFAULT;
    };
    const projectileColor = getProjectileColor();

    let screenFlashOpacity = 0;
    if (state.screenFlashStartTime > 0) {
        const elapsed = state.lastTick - state.screenFlashStartTime;
        if (elapsed < C.SCREEN_FLASH_DURATION) {
            screenFlashOpacity = 0.6 * (1 - elapsed / C.SCREEN_FLASH_DURATION);
        }
    }
    
    const isInvulnerable = state.reviveTriggerTime > 0 && (state.lastTick - state.reviveTriggerTime < C.REVIVE_INVULNERABILITY_DURATION);

    const isNebulaActive = state.level >= 75 && state.level < 99;
    const baseBgColor = isNebulaActive ? '#0c0a1a' : '#0f172a'; // Nebula vs slate-900

    const lightCasters = [
        ...state.projectiles.map(p => ({ x: p.x, y: p.y, color: projectileColor })),
        ...state.enemyProjectiles.map(p => ({ x: p.x, y: p.y, color: '#22c55e' }))
    ];

    const MAX_LIGHT_DISTANCE = 250;
    const getLightingForObject = (objX: number, objY: number, sources: typeof lightCasters): LightingInfo | null => {
        let closestLight = null;
        let minDistanceSq = MAX_LIGHT_DISTANCE * MAX_LIGHT_DISTANCE;

        for (const light of sources) {
            const dx = light.x - objX;
            const dy = light.y - objY;
            const distanceSq = dx * dx + dy * dy;

            if (distanceSq < minDistanceSq) {
                minDistanceSq = distanceSq;
                closestLight = { ...light, distance: Math.sqrt(distanceSq), dx, dy };
            }
        }

        if (closestLight) {
            const intensity = 1 - (closestLight.distance / MAX_LIGHT_DISTANCE);
            return {
                intensity: Math.pow(intensity, 2),
                color: closestLight.color,
                offsetX: 50 + (closestLight.dx / closestLight.distance) * 50,
                offsetY: 50 + (closestLight.dy / closestLight.distance) * 50,
            };
        }
        return null;
    };


    const renderUI = () => {
        switch (state.status) {
            case GameStatus.StartScreen:
                return <StartScreen 
                    onStart={(consumables, isHardMode) => dispatch({ type: 'START_GAME', consumables, isHardMode })}
                    onGoToArmory={() => dispatch({ type: 'GO_TO_ARMORY' })}
                    onGoToHangar={() => dispatch({ type: 'GO_TO_HANGAR' })}
                    highScore={state.highScore}
                    unlockedHeroes={state.unlockedHeroes}
                    cumulativeScore={state.cumulativeScore}
                    cumulativeLevels={state.cumulativeLevels}
                    ownedRevives={state.ownedRevives}
                    ownedFastReloads={state.ownedFastReloads}
                    ownedRapidFires={state.ownedRapidFires}
                    ownedSpeedBoosts={state.ownedSpeedBoosts}
                    selectedHero={state.selectedHeroForMenu}
                    onSelectHero={(hero) => dispatch({ type: 'SELECT_HERO', hero })}
                    bossesDefeated={state.bossesDefeated}
                    hardModeUnlocked={state.hardModeUnlocked}
                />;
            case GameStatus.Armory:
            case GameStatus.Intermission:
                return <ArmoryScreen
                    onBuyRevive={() => dispatch({ type: 'BUY_REVIVE' })}
                    onBuyFastReload={() => dispatch({ type: 'BUY_FAST_RELOAD' })}
                    onBuyRapidFire={() => dispatch({ type: 'BUY_RAPID_FIRE' })}
                    onBuySpeedBoost={() => dispatch({ type: 'BUY_SPEED_BOOST' })}
                    onReturnToMenu={() => dispatch({ type: 'RETURN_TO_MENU' })}
                    onContinue={(consumables) => dispatch({ type: 'CONTINUE_GAME', consumables })}
                    gameStatus={state.status}
                    totalCurrency={state.status === GameStatus.Intermission ? state.totalCurrency + state.currencyEarnedThisRun : state.totalCurrency}
                    currencyEarnedThisRun={state.currencyEarnedThisRun}
                    ownedRevives={state.ownedRevives}
                    ownedFastReloads={state.ownedFastReloads}
                    ownedRapidFires={state.ownedRapidFires}
                    ownedSpeedBoosts={state.ownedSpeedBoosts}
                    intermissionReward={state.intermissionReward}
                    hasPermanentRapidFire={state.hasPermanentRapidFire}
                    hasRevive={state.hasRevive}
                />;
            case GameStatus.Hangar:
                return <HangarScreen
                    onReturnToMenu={() => dispatch({ type: 'RETURN_TO_MENU' })}
                    onStartUpgrade={(target, upgradeKey, level) => dispatch({ type: 'START_UPGRADE', target, upgradeKey, level })}
                    onCollectUpgrade={() => dispatch({ type: 'COLLECT_UPGRADE' })}
                    totalCurrency={state.totalCurrency}
                    upgradeParts={state.upgradeParts}
                    heroUpgrades={state.heroUpgrades}
                    generalUpgrades={state.generalUpgrades}
                    ongoingUpgrade={state.ongoingUpgrade}
                    unlockedHeroes={state.unlockedHeroes}
                    unlockedTier2Upgrades={state.unlockedTier2Upgrades}
                />;
            case GameStatus.GameOver:
                 return <GameOverScreen 
                    onRestart={() => dispatch({ type: 'RESTART_GAME' })} 
                    onReturnToMenu={() => dispatch({ type: 'RETURN_TO_MENU' })}
                    score={state.score} 
                />;
            case GameStatus.Story:
                if (!state.currentStoryMessage) return null;
                return <StoryScreen
                    title={state.currentStoryMessage.title}
                    text={state.currentStoryMessage.text}
                    onDismiss={() => dispatch({ type: 'DISMISS_STORY' })}
                />;
            case GameStatus.Victory:
                return <StoryScreen
                    title="VICTORY"
                    text={`You have shattered the Overmind, the nexus of the invasion fleet.\n\nIts psychic scream echoes into silence, and across the galaxy, the armada falters and falls into disarray.\n\nYour name will be remembered for eternity, hero.\n\nFinal Score: ${state.score.toLocaleString()}`}
                    onDismiss={() => dispatch({ type: 'RETURN_TO_MENU' })}
                />;
            case GameStatus.EncounterOutcome:
                if (!state.encounterOutcome) return null;
                return <EncounterOutcomeScreen
                    outcome={state.encounterOutcome}
                    onDismiss={() => dispatch({ type: 'DISMISS_ENCOUNTER_OUTCOME' })}
                />;
             case GameStatus.RandomEncounter:
                if (!state.currentEncounter) return null;
                return <RandomEncounterScreen
                    encounter={state.currentEncounter}
                    onChoose={(outcomes) => dispatch({ type: 'CHOOSE_ENCOUNTER_OPTION', choiceOutcomes: outcomes })}
                    totalCurrency={state.totalCurrency}
                    ownedRevives={state.ownedRevives}
                    ownedFastReloads={state.ownedFastReloads}
                    ownedRapidFires={state.ownedRapidFires}
                    ownedSpeedBoosts={state.ownedSpeedBoosts}
                />;
            case GameStatus.EncounterProcessing:
                return <EncounterProcessingScreen />;
            case GameStatus.Paused:
                return <PauseScreen 
                    onResume={() => dispatch({ type: 'TOGGLE_PAUSE', timestamp: performance.now() })}
                    onToggleLayout={() => dispatch({ type: 'TOGGLE_CONTROL_LAYOUT' })}
                    currentLayout={state.controlLayout}
                />;
            default:
                return null;
        }
    }

    const gameActive = state.status === GameStatus.Playing || state.status === GameStatus.BossBattle || state.status === GameStatus.AsteroidField || state.status === GameStatus.TrainingSim;
    const nowForOverlay = state.lastTick > 0 ? state.lastTick : performance.now();

    return (
        <div className="w-full h-full flex justify-center items-center bg-slate-950 select-none">
            <div
                ref={gameAreaRef}
                className={`relative overflow-hidden border-2 border-cyan-500/30 shadow-2xl shadow-cyan-500/20 transition-transform duration-75 ${state.status === GameStatus.Paused ? 'game-paused' : ''}`}
                style={{
                    width: '100%',
                    height: '100%',
                    maxWidth: `calc(100vh * (${C.GAME_WIDTH} / ${C.GAME_HEIGHT}))`,
                    maxHeight: `calc(100vw * (${C.GAME_HEIGHT} / ${C.GAME_WIDTH}))`,
                    aspectRatio: `${C.GAME_WIDTH} / ${C.GAME_HEIGHT}`,
                    perspective: '900px',
                    transform: `translate(${shakeX}px, ${shakeY}px)`,
                    backgroundColor: baseBgColor,
                    transition: 'background-color 1s ease-in-out, transform 75ms linear'
                }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {/* BACKGROUNDS (2D) */}
                <div 
                    className="directional-light"
                    style={{
                        opacity: isNebulaActive ? 1 : 0,
                        transition: 'opacity 1s ease-in-out'
                    }}
                />
                
                {/* 3D Game World */}
                <div 
                  className="absolute inset-0"
                  style={{ transformStyle: 'preserve-3d', transform: 'rotateX(55deg)' }}
                >
                    {/* Background grid */}
                    <div 
                        className="absolute inset-0 perspective-bg"
                        style={{ 
                            transform: 'translateZ(0px)',
                            opacity: isNebulaActive ? 0 : 1,
                            transition: 'opacity 1s ease-in-out'
                        }}
                    ></div>
                    
                    {/* Nebula Background */}
                    <div style={{
                        opacity: isNebulaActive ? 1 : 0,
                        transition: 'opacity 1s ease-in-out',
                        pointerEvents: isNebulaActive ? 'auto' : 'none',
                        position: 'absolute',
                        inset: 0,
                        transformStyle: 'preserve-3d'
                    }}>
                        <NebulaBackground />
                    </div>
                    
                    {/* Lightning effect */}
                    {state.lightning && <Lightning bolt={state.lightning} />}

                    {/* Game Objects Container */}
                    <div className="relative w-full h-full" style={{ transformStyle: 'preserve-3d' }}>
                        <ConduitLinkBeam conduits={state.enemies.filter(e => e.type === 'conduit')} allTargets={[...state.enemies, ...state.asteroids]}/>

                        {state.boss && <BossComponent boss={state.boss} wasHit={state.wasBossHit} />}
                        {state.boss && state.boss.bossType === 'overmind' && <OvermindBeamVisual boss={state.boss} now={state.lastTick} />}
                        {state.bossLasers.map(laser => <BossLaserComponent key={laser.id} laser={laser} now={state.lastTick} />)}
                        
                        {(gameActive || state.status === GameStatus.PlayerDying) && (
                            <GameCanvas
                                now={state.lastTick}
                                enemies={state.enemies}
                                asteroids={state.asteroids}
                                powerUps={state.powerUps}
                                projectiles={state.projectiles}
                                enemyProjectiles={state.enemyProjectiles}
                                shellCasings={state.shellCasings}
                                gibs={state.gibs}
                                damageNumbers={state.damageNumbers}
                                explosions={state.explosions}
                                projectileColor={projectileColor}
                                reviveTriggerTime={state.reviveTriggerTime}
                                width={C.GAME_WIDTH}
                                height={C.GAME_HEIGHT}
                            />
                        )}

                        {gameActive && (
                            <Player 
                                x={state.playerX} 
                                y={C.PLAYER_Y_POSITION} 
                                shieldActive={!!state.activePowerUps.Shield || isInvulnerable}
                                shieldHp={state.activePowerUps.Shield?.hp}
                                maxShieldHp={state.selectedHero === 'gamma' && state.heroUpgrades.gamma_shield_hp_level > 0 ? C.HANGAR_GAMMA_UPGRADE_CONFIG[state.heroUpgrades.gamma_shield_hp_level - 1].effect : 1}
                                lastShotTime={state.lastPlayerShotTime}
                                now={state.lastTick}
                                vx={state.playerVx}
                                hero={state.selectedHero}
                                shieldBreaking={state.shieldBreakingUntil > 0}
                                lighting={getLightingForObject(state.playerX, C.PLAYER_Y_POSITION, lightCasters)}
                                generalUpgrades={state.generalUpgrades}
                                lastTridentShotTime={state.lastTridentShotTime}
                                infusions={state.powerUpInfusions}
                            />
                        )}
                        
                        {state.trainingSimState?.targets.map(target => <TrainingTargetComponent key={target.id} target={target} now={state.lastTick} />)}
                        {state.rockImpacts.map(imp => <RockImpactExplosion key={imp.id} x={imp.x} y={imp.y} />)}
                        {state.criticalHits.map(c => <CriticalHitExplosionComponent key={c.id} x={c.x} y={c.y} radius={c.radius} level={c.isBossDeath ? 1 : (state.selectedHero === 'alpha' ? state.heroUpgrades.alpha_aoe_level : 0)} />)}
                        {state.upgradePartCollects.map(p => <UpgradePartCollect key={p.id} part={p} now={state.lastTick} />)}
                        {state.empArcs.map(arc => <EmpArcComponent key={arc.id} arc={arc} />)}
                        {state.weaverBeams.map(beam => <WeaverBeamComponent key={beam.id} beam={beam} now={state.lastTick} />)}

                        {/* Global Dynamic Lights */}
                        {state.explosions.map(exp => (
                            <div
                                key={`exp-light-${exp.id}`}
                                className="absolute animate-light-flash pointer-events-none"
                                style={{
                                    left: exp.x,
                                    top: exp.y,
                                    width: 300,
                                    height: 300,
                                    background: 'radial-gradient(circle, rgba(255,255,224,0.7) 0%, transparent 70%)',
                                    zIndex: 14,
                                    // @ts-ignore
                                    '--start-opacity': 0.7,
                                }}
                            />
                        ))}
                        {state.criticalHits.map(crit => (
                            <div
                                key={`crit-light-${crit.id}`}
                                className="absolute animate-light-flash pointer-events-none"
                                style={{
                                    left: crit.x,
                                    top: crit.y,
                                    width: crit.radius * 3.5,
                                    height: crit.radius * 3.5,
                                    background: 'radial-gradient(circle, rgba(173, 216, 230, 0.6) 0%, transparent 70%)',
                                    zIndex: 14,
                                    animationDuration: '450ms',
                                    // @ts-ignore
                                    '--start-opacity': 0.6,
                                }}
                            />
                        ))}
                    </div>
                </div>

                {/* Flat Screen Flash Overlay */}
                {screenFlashOpacity > 0 && (
                    <div 
                        className="absolute inset-0 bg-white pointer-events-none"
                        style={{
                            opacity: screenFlashOpacity,
                            zIndex: 19, // Below UI popups (z-20)
                            willChange: 'opacity',
                        }}
                    />
                )}

                {/* Flat UI Overlay */}
                <div
                    className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none"
                    style={{
                        paddingTop: 'env(safe-area-inset-top, 0px)',
                        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                        paddingLeft: 'env(safe-area-inset-left, 0px)',
                        paddingRight: 'env(safe-area-inset-right, 0px)',
                    }}
                >
                    {/* Pause Button */}
                    {(gameActive || state.status === GameStatus.Paused) && (
                        <button
                            onClick={() => dispatch({ type: 'TOGGLE_PAUSE', timestamp: performance.now() })}
                            className="absolute top-4 right-1/2 translate-x-1/2 z-40 p-2 bg-slate-700/50 text-white rounded-full hover:bg-slate-600 pointer-events-auto"
                            aria-label="Pause"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                {state.status === GameStatus.Paused ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
                                )}
                            </svg>
                        </button>
                    )}

                    {/* Reload Button for Mobile */}
                    {gameActive && (
                        <button
                            onTouchStart={(e) => {
                                e.preventDefault(); // Prevent focus and click events
                                dispatch({ type: 'RELOAD_GUN' });
                            }}
                            onClick={(e) => { // Fallback for mouse users
                                 e.preventDefault();
                                 dispatch({ type: 'RELOAD_GUN' });
                            }}
                            className={`absolute bottom-20 z-40 w-20 h-20 bg-slate-700/50 text-white rounded-full border-2 border-slate-400/50 flex items-center justify-center pointer-events-auto transition-transform active:scale-95 active:bg-slate-700/80 ${state.controlLayout === 'right' ? 'left-4' : 'right-4'}`}
                            aria-label="Reload"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 9a9 9 0 0114.13-4.13M20 15a9 9 0 01-14.13 4.13" />
                            </svg>
                        </button>
                    )}
                    
                    {/* Countdown Timer for Training Sim */}
                    {state.status === GameStatus.TrainingSim && state.trainingSimState && state.lastTick < state.trainingSimState.startTime && (
                        <TrainingCountdown startTime={state.trainingSimState.startTime} now={state.lastTick} />
                    )}

                    {/* Survival Timer */}
                    {state.status === GameStatus.AsteroidField && state.asteroidFieldEndTime && (
                        <SurvivalTimerBar endTime={state.asteroidFieldEndTime} now={state.lastTick} duration={C.ASTEROID_FIELD_DURATION} title="SURVIVAL" />
                    )}
                    {state.status === GameStatus.TrainingSim && state.trainingSimState && state.lastTick >= state.trainingSimState.startTime && (
                        <SurvivalTimerBar endTime={state.trainingSimState.endTime} now={state.lastTick} duration={C.TRAINING_SIM_DURATION} title="CALIBRATION" />
                    )}

                    {/* Boss Health Bar */}
                    {state.status === GameStatus.BossBattle && state.boss && <BossHealthBar boss={state.boss} />}

                     <div className="absolute top-4 left-4 text-2xl font-bold text-cyan-300 z-20" style={{ textShadow: '0 0 5px #0ff' }}>
                        SCORE: {state.score.toLocaleString()}
                    </div>
                    <div className="absolute top-4 right-4 text-xl font-bold text-slate-400 z-20">
                        HI: {state.highScore.toLocaleString()}
                    </div>

                    {/* Level Indicator */}
                    {state.status !== GameStatus.TrainingSim && (
                        <div className="absolute top-12 left-1/2 -translate-x-1/2 w-1/3 text-center text-white z-20">
                            <div className="font-bold text-lg text-cyan-300" style={{ textShadow: '0 0 5px #0ff' }}>
                                LEVEL {state.level}
                            </div>
                            <div className="h-2 bg-slate-700 rounded-full overflow-hidden mt-1 border border-cyan-500/50">
                                <div 
                                    className="h-full bg-cyan-400 transition-all duration-300"
                                    style={{ width: `${(state.enemiesDefeatedInLevel / C.ENEMIES_PER_LEVEL) * 100}%` }}
                                />
                            </div>
                        </div>
                    )}
                    
                    {state.isHardMode && (
                         <div className="absolute top-12 right-4 text-lg font-black text-pink-500 uppercase z-20" style={{ textShadow: '0 0 5px #f0f' }}>
                            Hard Mode
                        </div>
                    )}

                    {state.status === GameStatus.TrainingSim && (
                        <div className="absolute top-12 left-1/2 -translate-x-1/2 w-2/3 text-center text-white z-20">
                            <div className="font-black text-2xl text-yellow-300 uppercase tracking-widest" style={{ textShadow: '0 0 8px #f59e0b' }}>
                                Datacron Calibration
                            </div>
                            <p className="text-sm text-slate-300 mt-1">Hit targets the required number of times. Don't overshoot!</p>
                        </div>
                    )}


                    {/* In-Game Messages */}
                    <InGameMessageOverlay messages={state.inGameMessages} now={nowForOverlay} />

                    {/* Level Up Announcer */}
                    {state.levelUpAnnounceTime > 0 && state.lastTick - state.levelUpAnnounceTime < C.LEVEL_UP_ANNOUNCE_DURATION && !state.pendingEncounter && (
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 animate-level-up pointer-events-none">
                            <h2 className="text-7xl font-black text-yellow-400 uppercase" style={{ textShadow: '0 0 10px #ff0, 0 0 20px #f90' }}>
                                Level Up!
                            </h2>
                        </div>
                    )}

                    <div className="absolute bottom-4 left-4 text-2xl font-bold text-cyan-300 z-20" style={{ textShadow: '0 0 5px #0ff' }}>
                        {state.reloadCompleteTime > state.lastTick ? (
                            <span className="text-yellow-400 animate-pulse">RELOADING...</span>
                        ) : (
                            <span>
                                AMMO: <span className={state.ammo === 0 ? 'text-red-500 font-black' : ''}>{state.ammo}</span> / {state.maxAmmo}
                            </span>
                        )}
                    </div>
                    
                    <div className="absolute bottom-4 right-4 flex flex-col items-end gap-1 z-20">
                         {state.levelStreakThisRun > 0 && state.status !== GameStatus.TrainingSim && (
                            <span className="text-sm font-bold text-cyan-300" style={{ textShadow: '0 0 5px #0ff' }}>
                                x{(1 + state.levelStreakThisRun * C.CURRENCY_STREAK_BONUS_PER_LEVEL).toFixed(2)} Streak
                            </span>
                        )}
                         {state.currencyEarnedThisRun > 0 && (
                            <span className="text-lg font-bold text-yellow-300" style={{ textShadow: '0 0 5px #ff0' }}>
                                +{state.currencyEarnedThisRun.toLocaleString()}
                            </span>
                        )}
                         {state.partsEarnedThisRun > 0 && (
                            <span className="text-lg font-bold text-orange-400 flex items-center gap-1" style={{ textShadow: '0 0 5px #f97316' }}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0L8 7.05H4.26c-1.56.38-2.22 2.36-1.05 3.53l2.92 2.92c.38.38.38 1 0 1.4l-2.92 2.92c-1.18 1.18-.52 3.15 1.05 3.53H8l.51 3.88c.38 1.56 2.6 1.56 2.98 0l.51-3.88h3.74c1.56-.38-2.22-2.36 1.05-3.53l-2.92-2.92a.996.996 0 010-1.4l2.92-2.92c-1.18-1.18.52-3.15-1.05-3.53H12l-.51-3.88z" clipRule="evenodd" /></svg>
                                +{state.partsEarnedThisRun.toLocaleString()}
                            </span>
                        )}
                    </div>
                </div>

                {renderUI()}
            </div>
        </div>
    );
}

export default App;
