import type { GameState, GameAction } from '../types';
import { gameReducer as uiReducer } from './uiReducer';
import { gameReducer as economyReducer } from './economyReducer';
import { gameReducer as encounterReducer } from './encounterReducer';
import { gameReducer as lifecycleReducer } from './lifecycleReducer';
import { gameReducer as inputReducer } from './inputReducer';
import { gameReducer as engineReducer } from './engineReducer';

// ============================================================================
// MAIN REDUCER
// ============================================================================

export function gameReducer(state: GameState, action: GameAction): GameState {
    // Fast-path hot simulation actions to avoid running unrelated reducers every tick.
    if (action.type === 'GAME_TICK_BATCH') {
        return engineReducer(state, action);
    }

    let nextState = uiReducer(state, action);
    if (nextState !== state) return nextState;

    nextState = economyReducer(state, action);
    if (nextState !== state) return nextState;

    nextState = encounterReducer(state, action);
    if (nextState !== state) return nextState;

    nextState = lifecycleReducer(state, action);
    if (nextState !== state) return nextState;

    nextState = inputReducer(state, action);
    if (nextState !== state) return nextState;
    
    nextState = engineReducer(state, action);
    if (nextState !== state) return nextState;

    return state;
}
