import type { GameState, GameAction } from '../types';
import { GameStatus } from '../types';

export function gameReducer(state: GameState, action: GameAction): GameState {
    switch (action.type) {
        case 'RELOAD_GUN': {
            const activeStates = [GameStatus.Playing, GameStatus.BossBattle, GameStatus.AsteroidField, GameStatus.TrainingSim];
            if (!activeStates.includes(state.status)) {
                return state;
            }

            if (state.reloadCompleteTime > 0 || state.wantsToReload) {
                return state; // Already reloading, do nothing.
            }

            // NEW LOGIC: Always allow reload if in an active state.
            return {
                ...state,
                wantsToReload: true,
            };
        }

        case 'TOUCH_START': {
            if (state.touchState.isActive) {
                return state; // Already tracking a touch, ignore new ones
            }
            
            const relativeX = action.x - state.playerX;
            return {
                ...state,
                touchState: {
                    isActive: true,
                    currentX: action.x,
                    offsetX: relativeX,
                    identifier: action.identifier,
                }
            };
        }

        case 'TOUCH_MOVE': {
            if (state.touchState.isActive && state.touchState.identifier === action.identifier) {
                if (state.touchState.currentX === action.x) {
                    return state;
                }
                return {
                    ...state,
                    touchState: {
                        ...state.touchState,
                        currentX: action.x,
                    }
                };
            }
            return state;
        }

        case 'TOUCH_END': {
            if (state.touchState.isActive && state.touchState.identifier === action.identifier) {
                return {
                    ...state,
                    touchState: {
                        isActive: false,
                        currentX: null,
                        offsetX: 0,
                        identifier: null,
                    }
                };
            }
            return state;
        }

        default:
            return state;
    }
}