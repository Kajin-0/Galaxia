import type { GameState, GameAction } from '../types';
import { GameStatus } from '../types';
import { runGameTick } from '../gameLogic/engine';
import {
    transitionToGameOver,
    transitionToLevelUp,
    setupIntermissionState,
    transitionToAsteroidFieldComplete,
    transitionToTrainingSimComplete,
    transitionToMontezumaComplete
} from '../utils/stateTransitions';

// ============================================================================
// REDUCER HELPER FUNCTIONS (HANDLERS)
// ============================================================================

// --- GAME TICK HANDLER ---

function handleGameTick(state: GameState, action: Extract<GameAction, { type: 'GAME_TICK' }>): GameState {
    const nextState = runGameTick(state, action);

    if (nextState.pendingTransition) {
        const { type, payload } = nextState.pendingTransition;
        const transitionState: GameState = { ...nextState, pendingTransition: undefined }; // Clear the flag
        
        const performanceTimestamp = action.timestamp;
        const now = transitionState.lastTick;
        const effectiveNow = now - transitionState.totalPauseDuration;

        switch (type) {
            case 'level_up':
                return transitionToLevelUp(transitionState, payload.now, payload.effectiveNow, performanceTimestamp);
            case 'boss_defeat': {
                const intermissionStateChanges = setupIntermissionState(transitionState);
                return {
                    ...transitionState,
                    ...intermissionStateChanges,
                    status: GameStatus.Intermission, 
                    prePauseStatus: state.status, // The status *before* this tick
                    pauseStartTime: performanceTimestamp,
                };
            }
            case 'game_over':
                return transitionToGameOver(transitionState, now);
            case 'asteroid_field_complete':
                return transitionToAsteroidFieldComplete(transitionState, now, effectiveNow, performanceTimestamp);
            case 'training_sim_complete':
                return transitionToTrainingSimComplete(transitionState, now, effectiveNow, performanceTimestamp);
            case 'montezuma_complete':
                return transitionToMontezumaComplete(transitionState, now, effectiveNow, performanceTimestamp);
        }
    }
    
    return nextState;
}


// ============================================================================
// ENGINE REDUCER
// ============================================================================

export function gameReducer(state: GameState, action: GameAction): GameState {
    switch (action.type) {
        case 'GAME_TICK':
            return handleGameTick(state, action);
        
        default:
            return state;
    }
}
