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
    const queuedTouchMoves = useRef(new Map<number, number>());
    const touchMoveRafId = useRef<number | null>(null);

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

    useEffect(() => {
        const queuedMovesAtMount = queuedTouchMoves.current;
        return () => {
            if (touchMoveRafId.current !== null) {
                cancelAnimationFrame(touchMoveRafId.current);
                touchMoveRafId.current = null;
            }
            queuedMovesAtMount.clear();
        };
    }, []);

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

    const flushQueuedTouchMove = useCallback(() => {
        touchMoveRafId.current = null;
        if (queuedTouchMoves.current.size === 0) return;
        queuedTouchMoves.current.forEach((x, identifier) => {
            dispatch({ type: 'TOUCH_MOVE', x, identifier });
        });
        queuedTouchMoves.current.clear();
    }, [dispatch]);

    const queueTouchMove = useCallback((x: number, identifier: number) => {
        queuedTouchMoves.current.set(identifier, x);
        if (touchMoveRafId.current !== null) return;
        touchMoveRafId.current = requestAnimationFrame(flushQueuedTouchMove);
    }, [flushQueuedTouchMove]);

    const clearQueuedTouchMoveFor = useCallback((identifier: number) => {
        queuedTouchMoves.current.delete(identifier);
        if (queuedTouchMoves.current.size === 0 && touchMoveRafId.current !== null) {
            cancelAnimationFrame(touchMoveRafId.current);
            touchMoveRafId.current = null;
        }
    }, []);
    
    const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
        const gameActive = status === GameStatus.Playing || status === GameStatus.BossBattle || status === GameStatus.AsteroidField || status === GameStatus.TrainingSim;
        if (!gameActive) return;

        e.preventDefault();
        queuedTouchMoves.current.clear();
        if (touchMoveRafId.current !== null) {
            cancelAnimationFrame(touchMoveRafId.current);
            touchMoveRafId.current = null;
        }
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
                queueTouchMove(gameCoordX, touch.identifier);
            }
        }
    }, [status, getGameCoordXForTouch, queueTouchMove]);
    
    const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
        const gameActive = status === GameStatus.Playing || status === GameStatus.BossBattle || status === GameStatus.AsteroidField || status === GameStatus.TrainingSim;
        if (!gameActive) return;

        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches.item(i);
            if (!touch) continue;
            clearQueuedTouchMoveFor(touch.identifier);
            dispatch({ type: 'TOUCH_END', identifier: touch.identifier });
        }
    }, [status, dispatch, clearQueuedTouchMoveFor]);

    const handleTouchCancel = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
        const gameActive = status === GameStatus.Playing || status === GameStatus.BossBattle || status === GameStatus.AsteroidField || status === GameStatus.TrainingSim;
        if (!gameActive) return;

        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches.item(i);
            if (!touch) continue;
            clearQueuedTouchMoveFor(touch.identifier);
            dispatch({ type: 'TOUCH_END', identifier: touch.identifier });
        }
    }, [status, dispatch, clearQueuedTouchMoveFor]);
    
    return {
        pressedKeys,
        onTouchStart: handleTouchStart,
        onTouchMove: handleTouchMove,
        onTouchEnd: handleTouchEnd,
        onTouchCancel: handleTouchCancel,
    };
};
