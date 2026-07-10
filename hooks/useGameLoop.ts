import React, { useEffect, useRef } from 'react';
import type { GameAction, GameState } from '../types';
import { GameStatus } from '../types';
import * as C from '../constants';
import { drawUnifiedFrame } from '../components/canvas/drawUnifiedFrame';

// ✅ MOBILE OPTIMIZATION: Cache container size to avoid expensive getBoundingClientRect() calls
// Container size rarely changes during gameplay, so we only check it periodically
// This reduces layout recalculations from 60/second to ~10/second
let cachedContainerSize: { width: number; height: number } | null = null;
let lastContainerSizeCheck = 0;
const CONTAINER_SIZE_CACHE_MS = 100; // Update every 100ms (10 times per second instead of 60)
const FIXED_TIMESTEP_S = 1 / 60;
const MAX_SIMULATION_STEPS_PER_FRAME = C.IS_MOBILE ? C.MOBILE_MAX_SIMULATION_STEPS_PER_FRAME : 5;
const MAX_FRAME_DELTA_S = C.IS_MOBILE ? C.MOBILE_MAX_FRAME_DELTA_S : 0.25;
const SIMULATION_STATES = new Set<GameStatus>([
    GameStatus.Playing,
    GameStatus.BossBattle,
    GameStatus.PlayerDying,
    GameStatus.AsteroidField,
    GameStatus.TrainingSim,
]);

interface UseGameLoopProps {
    dispatch: React.Dispatch<GameAction>;
    status: GameStatus;
    pressedKeys: React.MutableRefObject<Set<string>>;
    gameAreaRef: React.RefObject<HTMLDivElement>;
    engineStateRef: React.RefObject<GameState>;
    // Props for the unified render loop refs
    gridCtxRef: React.RefObject<CanvasRenderingContext2D | null>;
    gameCtxRef: React.RefObject<CanvasRenderingContext2D | null>;
    effectsCtxRef: React.RefObject<CanvasRenderingContext2D | null>;
    noiseCanvasRef: React.RefObject<HTMLCanvasElement | null>;
    contextsReady: boolean;
}

export const useGameLoop = ({ 
    dispatch, status, pressedKeys, gameAreaRef, engineStateRef,
    gridCtxRef, gameCtxRef, effectsCtxRef, noiseCanvasRef, contextsReady 
}: UseGameLoopProps) => {
    const lastTimestampRef = useRef(0);
    const accumulator = useRef(0);

    useEffect(() => {
        let animationFrameId: number;

        const loop = (timestamp: number) => {
            animationFrameId = requestAnimationFrame(loop);

            if (!contextsReady) {
                return;
            }

            if (lastTimestampRef.current === 0) {
                lastTimestampRef.current = timestamp;
                return;
            }

            const delta = (timestamp - lastTimestampRef.current) / 1000;
            lastTimestampRef.current = timestamp;
            
            // Read the LATEST status from the ref on every frame to avoid using a stale value from a previous render.
            const currentStatus = engineStateRef.current?.status ?? status;
            const isActive = SIMULATION_STATES.has(currentStatus);
            
            // --- SIMULATION STEP ---
            if (isActive) {
                // ✅ CRITICAL OPTIMIZATION: Cache getBoundingClientRect() to avoid layout thrashing
                // The container size rarely changes during gameplay, so we only check it periodically
                // This reduces expensive layout recalculations from 60/second to ~10/second
                const now = timestamp;
                if (!cachedContainerSize || (now - lastContainerSizeCheck) > CONTAINER_SIZE_CACHE_MS) {
                    const rect = gameAreaRef.current?.getBoundingClientRect();
                    if (rect) {
                        cachedContainerSize = { width: rect.width, height: rect.height };
                        lastContainerSizeCheck = now;
                    }
                }
                
                // Cap the delta to prevent the "spiral of death" on long pauses or tab-out.
                // Mobile path uses a conservative cap for older hardware stability.
                accumulator.current += Math.min(delta, MAX_FRAME_DELTA_S);

                let simulationSteps = 0;
                while (accumulator.current >= FIXED_TIMESTEP_S && simulationSteps < MAX_SIMULATION_STEPS_PER_FRAME) {
                    accumulator.current -= FIXED_TIMESTEP_S;
                    simulationSteps++;
                }

                if (simulationSteps > 0) {
                    dispatch({
                        type: 'GAME_TICK_BATCH',
                        steps: simulationSteps,
                        delta: FIXED_TIMESTEP_S,
                        timestamp,
                        pressedKeys: pressedKeys.current,
                        containerSize: cachedContainerSize,
                    });
                }

                // Drop excess debt to avoid large catch-up spikes on mobile.
                // Keeping at most one fixed step preserves smoothness without runaway loops.
                if (accumulator.current >= FIXED_TIMESTEP_S) {
                    accumulator.current = FIXED_TIMESTEP_S;
                }
            } else {
                // When not actively simulating, reset the accumulator.
                // This is the CRITICAL FIX: it prevents a "time debt" from building up,
                // which would cause a massive simulation spike (a freeze) when the game resumes.
                accumulator.current = 0;
            }

            // Preserve the last rendered pixels while paused and avoid drawing hidden menu scenes.
            if (!isActive) {
                return;
            }

            // --- UNIFIED RENDER STEP ---
            // This runs once per frame, after all simulation steps are complete.
            // It draws the latest state from the engineStateRef.
            
            const gridCtx = gridCtxRef.current;
            const gameCtx = gameCtxRef.current;
            const effectsCtx = effectsCtxRef.current;
            
            // Comprehensive validation before rendering
            if (gridCtx && gameCtx && effectsCtx && engineStateRef.current) {
                // Additional validation: check if contexts are still valid
                const isGridCtxValid = gridCtx.canvas && gridCtx.canvas.width > 0 && gridCtx.canvas.height > 0;
                const isGameCtxValid = gameCtx.canvas && gameCtx.canvas.width > 0 && gameCtx.canvas.height > 0;
                const isEffectsCtxValid = effectsCtx.canvas && effectsCtx.canvas.width > 0 && effectsCtx.canvas.height > 0;
                
                if (isGridCtxValid && isGameCtxValid && isEffectsCtxValid) {
                    try {
                        drawUnifiedFrame(
                            gridCtx,
                            gameCtx,
                            effectsCtx,
                            engineStateRef.current,
                            noiseCanvasRef.current
                        );
                    } catch (error) {
                        // Optional: Attempt to recover by reinitializing contexts
                        // This prevents the game from completely breaking
                    }
                }
            }
        };

        animationFrameId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(animationFrameId);
    // The dependency array is now much cleaner. The ref objects are stable and don't need to be listed.
    }, [dispatch, status, pressedKeys, gameAreaRef, engineStateRef, gridCtxRef, gameCtxRef, effectsCtxRef, noiseCanvasRef, contextsReady]);


    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden && SIMULATION_STATES.has(status)) {
                dispatch({ type: 'TOGGLE_PAUSE', timestamp: performance.now() });
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [status, dispatch]);
};
