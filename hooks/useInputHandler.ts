import React, { useCallback, useEffect, useRef } from 'react';
import type { GameAction } from '../types';
import { GameStatus } from '../types';
import * as C from '../constants';

// ✅ MOBILE OPTIMIZATION: Cache touch rect to avoid expensive getBoundingClientRect() calls
// Touch rect rarely changes during gameplay, so we only check it periodically
// This reduces layout recalculations during rapid touch movements
let cachedTouchRect: { left: number; width: number } | null = null;
let lastTouchRectCheck = 0;
const TOUCH_RECT_CACHE_MS = 100; // Update every 100ms (10 times per second instead of potentially 60+)

export const useInputHandler = (
    dispatch: React.Dispatch<GameAction>,
    gameAreaRef: React.RefObject<HTMLDivElement>,
    status: GameStatus
) => {
    const pressedKeys = useRef(new Set<string>());

    // --- Keyboard Handling ---
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        pressedKeys.current.add(e.code);
        if (e.code === 'Space' && (status === GameStatus.Playing || status === GameStatus.BossBattle || status === GameStatus.AsteroidField || status === GameStatus.TrainingSim)) {
            e.preventDefault(); // Prevent page scroll
            dispatch({ type: 'RELOAD_GUN' });
        }
        const pausableStates = [GameStatus.Playing, GameStatus.BossBattle, GameStatus.Paused, GameStatus.AsteroidField, GameStatus.TrainingSim];
        if (e.key.toLowerCase() === 'p' && pausableStates.includes(status)) {
            e.preventDefault();
            dispatch({ type: 'TOGGLE_PAUSE', timestamp: performance.now() });
        }
    }, [status, dispatch]);

    useEffect(() => {
        const handleKeyUp = (e: KeyboardEvent) => pressedKeys.current.delete(e.code);
        
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [handleKeyDown]);

    // --- Touch Handling ---
    const getGameCoordXForTouch = useCallback((touch: React.Touch | globalThis.Touch): number | null => {
        if (gameAreaRef.current) {
            const now = performance.now();
            if (!cachedTouchRect || (now - lastTouchRectCheck) > TOUCH_RECT_CACHE_MS) {
                const rect = gameAreaRef.current.getBoundingClientRect();
                cachedTouchRect = { left: rect.left, width: rect.width };
                lastTouchRectCheck = now;
            }
            const relativeX = touch.clientX - cachedTouchRect.left;
            return (relativeX / cachedTouchRect.width) * C.GAME_WIDTH;
        }
        return null;
    }, [gameAreaRef]);
    
    const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
        const gameActive = status === GameStatus.Playing || status === GameStatus.BossBattle || status === GameStatus.AsteroidField || status === GameStatus.TrainingSim;
        if (!gameActive) return;

        e.preventDefault();
        // Handle multiple touches starting at once, reducer will pick the first one.
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches.item(i);
            if (!touch) continue;

            const gameCoordX = getGameCoordXForTouch(touch);
            if (gameCoordX !== null) {
                dispatch({ type: 'TOUCH_START', x: gameCoordX, identifier: touch.identifier });
            }
        }
    }, [status, getGameCoordXForTouch, dispatch]);
    
    const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
        const gameActive = status === GameStatus.Playing || status === GameStatus.BossBattle || status === GameStatus.AsteroidField || status === GameStatus.TrainingSim;
        if (!gameActive) return;

        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches.item(i);
            if (!touch) continue;
            
            const gameCoordX = getGameCoordXForTouch(touch);
            if (gameCoordX !== null) {
                dispatch({ type: 'TOUCH_MOVE', x: gameCoordX, identifier: touch.identifier });
            }
        }
    }, [status, getGameCoordXForTouch, dispatch]);
    
    const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
        const gameActive = status === GameStatus.Playing || status === GameStatus.BossBattle || status === GameStatus.AsteroidField || status === GameStatus.TrainingSim;
        if (!gameActive) return;

        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches.item(i);
            if (!touch) continue;
            dispatch({ type: 'TOUCH_END', identifier: touch.identifier });
        }
    }, [status, dispatch]);

    const handleTouchCancel = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
        const gameActive = status === GameStatus.Playing || status === GameStatus.BossBattle || status === GameStatus.AsteroidField || status === GameStatus.TrainingSim;
        if (!gameActive) return;

        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches.item(i);
            if (!touch) continue;
            dispatch({ type: 'TOUCH_END', identifier: touch.identifier });
        }
    }, [status, dispatch]);
    
    return {
        pressedKeys,
        onTouchStart: handleTouchStart,
        onTouchMove: handleTouchMove,
        onTouchEnd: handleTouchEnd,
        onTouchCancel: handleTouchCancel,
    };
};
