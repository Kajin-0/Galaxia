
import React, { useRef, useEffect, useCallback, useState } from 'react';
import type { GameState, GameAction } from '../types';
import { GameStatus } from '../types';
import * as C from '../constants';
import GameCanvas from './GameCanvas';
import GridCanvas from './GridCanvas';
import EffectsCanvas from './EffectsCanvas';
import { InGameHUD } from './ui/InGameHUD';
import { useInputHandler } from '../hooks/useInputHandler';
import { useGameLoop } from '../hooks/useGameLoop';
import { NebulaBackground } from './NebulaBackground';
import { cacheManager } from '../utils/cacheManager';
import { performCacheCleanup, initializeCacheManager } from './canvas/drawUnifiedFrame';
import { easeOutQuadAlt } from '../utils/easing';

interface GameViewProps {
  gameState: GameState;
  dispatch: React.Dispatch<GameAction>;
}

export const GameView: React.FC<GameViewProps> = ({ gameState, dispatch }) => {
    const gameAreaRef = useRef<HTMLDivElement>(null);
    const lastPauseToggle = useRef(0);
    const { pressedKeys, onTouchStart, onTouchMove, onTouchEnd, onTouchCancel } = useInputHandler(dispatch, gameAreaRef, gameState.status);

    const engineStateRef = useRef(gameState);
    // Synchronous update so the render loop always sees the latest state this frame
    engineStateRef.current = gameState;

    const [contextsReady, setContextsReady] = useState(false);

    // Refs for all canvas elements
    const gridCanvasRef = useRef<HTMLCanvasElement>(null);
    const gameCanvasRef = useRef<HTMLCanvasElement>(null);
    const effectsCanvasRef = useRef<HTMLCanvasElement>(null);
    const noiseCanvasRef = useRef<HTMLCanvasElement | null>(null);

    // Refs for the rendering contexts for stability across re-renders
    const gridCtxRef = useRef<CanvasRenderingContext2D | null>(null);
    const gameCtxRef = useRef<CanvasRenderingContext2D | null>(null);
    const effectsCtxRef = useRef<CanvasRenderingContext2D | null>(null);

    // Effect to create the noise pattern once
    useEffect(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            const imageData = ctx.createImageData(64, 64);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                const val = Math.floor(Math.random() * 255);
                data[i] = val; data[i + 1] = val; data[i + 2] = val; data[i + 3] = 255;
            }
            ctx.putImageData(imageData, 0, 0);
            noiseCanvasRef.current = canvas;
        }
    }, []);

    // Initialize Cache Manager once
    useEffect(() => {
        initializeCacheManager();
    }, []);

    // Mobile-specific memory management
    useEffect(() => {
      const handleMemoryWarning = () => {
        performCacheCleanup(true); // Aggressive cleanup
      };
      
      const handleVisibilityChange = () => {
        if (!document.hidden) {
          // App came to foreground - check if cleanup is needed
          setTimeout(() => {
            const stats = cacheManager.getStats();
            const totalMemory = stats.reduce((sum, stat) => sum + stat.memoryEstimate, 0);
            
            if (totalMemory > 2000) { // More than 2MB
              performCacheCleanup(true);
            }
          }, 100);
        }
      };
      
      // Mobile-specific event listeners
      window.addEventListener('memorywarning', handleMemoryWarning);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      return () => {
        window.removeEventListener('memorywarning', handleMemoryWarning);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }, []);

    const recoverMobileContexts = useCallback(() => {
        // Mobile-optimized canvas setup
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        
        const setupMobileCanvas = (canvas: HTMLCanvasElement | null, ctxRef: React.MutableRefObject<CanvasRenderingContext2D | null>, logicalWidth: number, logicalHeight: number) => {
            if (!canvas) return false;
            
            try {
                const ctx = canvas.getContext('2d', { 
                    alpha: true,
                    desynchronized: true,
                    willReadFrequently: false
                });
                
                if (ctx) {
                    ctxRef.current = ctx;
                    canvas.width = logicalWidth * ratio;
                    canvas.height = logicalHeight * ratio;
                    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
                    
                    // CRITICAL: Clear the canvas to prevent grey bars
                    ctx.clearRect(0, 0, logicalWidth, logicalHeight);
                    ctx.fillStyle = 'transparent';
                    ctx.fillRect(0, 0, logicalWidth, logicalHeight);
                    
                    return true;
                }
            } catch (error) {
                // Mobile canvas setup failed
            }
            return false;
        };
    
        // CRITICAL: Retry logic with exponential backoff for mobile
        let retries = 0;
        const maxRetries = 5;
        
        const attemptSetup = () => {
            const success = setupMobileCanvas(gridCanvasRef.current, gridCtxRef, C.GAME_WIDTH, C.GAME_GRID_HEIGHT) &&
                           setupMobileCanvas(gameCanvasRef.current, gameCtxRef, C.GAME_WIDTH, C.GAME_GRID_HEIGHT + C.GAME_HEIGHT_BUFFER) &&
                           setupMobileCanvas(effectsCanvasRef.current, effectsCtxRef, C.GAME_WIDTH, C.GAME_GRID_HEIGHT + C.EFFECTS_CANVAS_TOP_BUFFER + C.GAME_HEIGHT_BUFFER);
            
            if (success) {
                setContextsReady(true);
            } else if (retries < maxRetries) {
                retries++;
                setTimeout(attemptSetup, 100 * retries); // Exponential backoff
            } else {
                setContextsReady(false);
            }
        };
        
        attemptSetup();
    }, []);

    // Effect to get contexts on mount.
    useEffect(() => {
        recoverMobileContexts();
    }, [recoverMobileContexts]);
    
    // Ensure contexts are ready if the game starts before they are initialized.
    useEffect(() => {
        if (gameState.status === GameStatus.Playing && !contextsReady) {
            recoverMobileContexts();
        }
    }, [gameState.status, contextsReady, recoverMobileContexts]);

    // Simplified Mobile Event Listeners for context recovery
    useEffect(() => {
        // Only handle background/foreground switching (very common on mobile)
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                // App came to foreground - check contexts
                setTimeout(() => {
                    if (!gridCtxRef.current || !gameCtxRef.current || !effectsCtxRef.current) {
                        recoverMobileContexts();
                    }
                }, 200);
            }
        };
    
        // Memory pressure handling (mobile browsers kill contexts aggressively)
        const handleMemoryWarning = () => {
            recoverMobileContexts();
        };
    
        // Add only essential listeners
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('beforeunload', handleMemoryWarning);
        
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('beforeunload', handleMemoryWarning);
        };
    }, [recoverMobileContexts]);

    useGameLoop({
        dispatch,
        status: gameState.status,
        pressedKeys,
        gameAreaRef,
        engineStateRef,
        gridCtxRef,
        gameCtxRef,
        effectsCtxRef,
        noiseCanvasRef,
        contextsReady,
    });

    let shakeX = 0;
    let shakeY = 0;
    if (gameState.screenShake.magnitude > 0 && gameState.status !== GameStatus.Paused) {
        const { magnitude, duration, startTime } = gameState.screenShake;
        const elapsed = gameState.lastTick - startTime;
        if (elapsed < duration) {
            const progress = elapsed / duration;
            const currentMagnitude = magnitude * (1 - progress * progress);
            shakeX = (Math.random() - 0.5) * 2 * currentMagnitude;
            shakeY = (Math.random() - 0.5) * 2 * currentMagnitude;
        }
    }

    let screenFlashOpacity = 0;
    if (gameState.screenFlashStartTime > 0) {
        const elapsed = gameState.lastTick - gameState.screenFlashStartTime;
        if (elapsed < C.SCREEN_FLASH_DURATION) {
            const progress = elapsed / C.SCREEN_FLASH_DURATION;
            screenFlashOpacity = 0.8 * (1 - easeOutQuadAlt(progress));
        }
    }

    const isIonStorm = gameState.pendingPostFightOutcome?.environment === 'ion_storm';
    const isNebulaActive = (gameState.level >= 75 && gameState.level < 100) || isIonStorm;
    const baseBgColor = isNebulaActive ? '#0c0a1a' : '#0f172a';
    const animatedBgStates = [GameStatus.Playing, GameStatus.BossBattle, GameStatus.PlayerDying, GameStatus.AsteroidField, GameStatus.TrainingSim];
    const isBgPaused = !animatedBgStates.includes(gameState.status) || gameState.status === GameStatus.Paused;

    // The UI uses a smooth, high-resolution timer. When the game loop is active, this is driven by
    // gameState.lastTick. When the game is paused or in menus, we fall back to performance.now()
    // to keep UI animations (like timers in the Hangar) running smoothly.
    const effectiveNowForOverlay = gameState.lastTick > 0 
        ? gameState.lastTick - gameState.totalPauseDuration 
        : performance.now() - gameState.totalPauseDuration;
    
    // Determine if we're in active gameplay to disable browser gestures
    const isActiveGameplay = gameState.status === GameStatus.Playing || 
                            gameState.status === GameStatus.BossBattle || 
                            gameState.status === GameStatus.AsteroidField || 
                            gameState.status === GameStatus.TrainingSim;

    return (
        <div
            ref={gameAreaRef}
            className={`relative overflow-hidden border-2 border-cyan-500/30 shadow-2xl shadow-cyan-500/20 transition-transform duration-75 ${isBgPaused ? 'game-paused' : ''}`}
            style={{
                width: '100%',
                height: '100%',
                perspective: '1200px',
                perspectiveOrigin: 'center 60.0%',
                transform: `translate(${shakeX}px, ${shakeY}px)`,
                backgroundColor: baseBgColor,
                transition: 'background-color 1s ease-in-out, transform 75ms linear',
                // CRITICAL: Disable all browser gestures during active gameplay
                // This prevents backswipe and other system gestures from interfering
                touchAction: isActiveGameplay ? 'none' : 'auto'
            }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onTouchCancel={onTouchCancel}
        >
            {/* BACKGROUNDS (2D) */}
            <div 
                className="directional-light"
                style={{
                    opacity: isNebulaActive ? 1 : 0,
                    transition: 'opacity 1s ease-in-out'
                }}
            />
            
            <div style={{
                position: 'absolute',
                inset: 0,
                opacity: isNebulaActive ? 1 : 0,
                transition: 'opacity 1s ease-in-out',
                pointerEvents: 'none'
            }}>
                <NebulaBackground variant={isIonStorm ? 'ion_storm' : 'default'} />
            </div>

            {/* Simplified 3D Game World - Mobile Optimized */}
            <div 
              className="absolute top-0 left-0 w-full"
              style={{
                height: `${((C.GAME_GRID_HEIGHT + C.GAME_HEIGHT_BUFFER) / C.GAME_HEIGHT) * 100}%`,
                transform: 'rotateX(52deg) translateY(-30px) translateZ(160px)',
                transformStyle: 'preserve-3d'
              }}
            >
              {/* Single container for all canvases */}
              <div className="relative w-full h-full">
                <GridCanvas ref={gridCanvasRef} />
                <GameCanvas ref={gameCanvasRef} />
                <EffectsCanvas ref={effectsCanvasRef} />
              </div>
            </div>

            {screenFlashOpacity > 0 && (
                <div 
                    className="absolute inset-0 bg-white pointer-events-none"
                    style={{ opacity: screenFlashOpacity, zIndex: 19, willChange: 'opacity' }}
                />
            )}

            <InGameHUD 
                status={gameState.status}
                pauseStartTime={gameState.pauseStartTime}
                lastTick={gameState.lastTick}
                totalPauseDuration={gameState.totalPauseDuration}
                reloadCompleteTime={gameState.reloadCompleteTime}
                generalUpgrades={gameState.generalUpgrades}
                reloadBoosts={gameState.reloadBoosts}
                controlLayout={gameState.controlLayout}
                trainingSimState={gameState.trainingSimState}
                asteroidFieldEndTime={gameState.asteroidFieldEndTime}
                boss={gameState.boss}
                score={gameState.score}
                highScore={gameState.highScore}
                hasRevive={gameState.hasRevive}
                activeRareConsumable={gameState.activeRareConsumable}
                hasHereticalInsight={gameState.hasHereticalInsight}
                level={gameState.level}
                pendingPostFightOutcome={gameState.pendingPostFightOutcome}
                enemiesDefeatedInLevel={gameState.enemiesDefeatedInLevel}
                isHardMode={gameState.isHardMode}
                inGameMessages={gameState.inGameMessages}
                levelUpAnnounceTime={gameState.levelUpAnnounceTime}
                pendingEncounter={gameState.pendingEncounter}
                ammo={gameState.ammo}
                maxAmmo={gameState.maxAmmo}
                levelStreakThisRun={gameState.levelStreakThisRun}
                currencyEarnedThisRun={gameState.currencyEarnedThisRun}
                partsEarnedThisRun={gameState.partsEarnedThisRun}
                isMontezumaActive={gameState.isMontezumaActive}
                asteroids={gameState.asteroids}
                hapticsEnabled={gameState.hapticsEnabled}
                dispatch={dispatch}
                effectiveNowForOverlay={effectiveNowForOverlay}
                lastPauseToggle={lastPauseToggle}
            />
        </div>
    );
};
