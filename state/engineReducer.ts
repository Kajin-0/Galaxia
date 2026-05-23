import type { GameState, GameAction } from '../types';
import { GameStatus } from '../types';
import { runGameTick, type GameTickStep } from '../gameLogic/engine';
import {
    transitionToGameOver,
    transitionToLevelUp,
    setupIntermissionState,
    transitionToAsteroidFieldComplete,
    transitionToTrainingSimComplete,
    transitionToMontezumaComplete
} from '../utils/stateTransitions';

const SIMULATION_STATES = new Set<GameStatus>([
    GameStatus.Playing,
    GameStatus.BossBattle,
    GameStatus.PlayerDying,
    GameStatus.AsteroidField,
    GameStatus.TrainingSim,
]);

// ============================================================================
// REDUCER HELPER FUNCTIONS (HANDLERS)
// ============================================================================

// --- GAME TICK HANDLER ---

function handleGameTick(state: GameState, action: GameTickStep): GameState {
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

function handleGameTickBatch(state: GameState, action: Extract<GameAction, { type: 'GAME_TICK_BATCH' }>): GameState {
    const steps = Math.max(1, Math.floor(action.steps));
    const stepDurationMs = action.delta * 1000;
    // Reconstruct monotonic step timestamps so transition timing remains stable.
    let stepTimestamp = action.timestamp - ((steps - 1) * stepDurationMs);
    let nextState = state;

    for (let i = 0; i < steps; i++) {
        nextState = handleGameTick(nextState, {
            delta: action.delta,
            timestamp: stepTimestamp,
            pressedKeys: action.pressedKeys,
            containerSize: action.containerSize,
        });
        stepTimestamp += stepDurationMs;

        // Stop early if simulation is no longer active (pause/menu/game-over transitions).
        if (!SIMULATION_STATES.has(nextState.status)) {
            break;
        }
    }

    return nextState;
}


// ============================================================================
// ENGINE REDUCER
// ============================================================================

export function gameReducer(state: GameState, action: GameAction): GameState {
    switch (action.type) {
        case 'GAME_TICK_BATCH':
            return handleGameTickBatch(state, action);
        
        default:
            return state;
    }
}
