import type { GameState, GameAction } from '../types';
import { GameStatus } from '../types';
import * as C from '../constants';
import { playSound, stopMusic } from '../sounds';
import { 
    loadProgression, 
    saveProgression, 
    getInitialState, 
    updateAndSaveEndOfRunProgression, 
    getProgressionFromState, 
    checkAndQueueUnlockMessages, 
    prepareNewRun,
    type ProgressionData
} from '../utils/progression';
import { handleResumeClock, setupIntermissionState, performComprehensiveCleanup } from '../utils/stateTransitions';

// ============================================================================
// REDUCER HELPER FUNCTIONS (HANDLERS)
// ============================================================================

function handlePrepareNewGame(state: GameState, action: Extract<GameAction, { type: 'PREPARE_NEW_GAME' }>): GameState {
    performComprehensiveCleanup();
    const { consumables, isHardMode } = action.payload;
    const newGameState = prepareNewRun(state, consumables, isHardMode, false);
    return newGameState;
}

function handleContinueGame(state: GameState, action: Extract<GameAction, { type: 'CONTINUE_GAME' }>): GameState {
    if (state.status !== GameStatus.Intermission) return state;

    const { useRevive, useFastReload, useRapidFire, useSpeedBoost } = action.consumables;

    let newState = { ...state };
    
    const currentProgression = getProgressionFromState(state); // Use current state
    let progressionChanged = false;

    if (useRevive && currentProgression.ownedRevives > 0 && !newState.hasRevive) {
        newState.hasRevive = true;
        currentProgression.ownedRevives--;
        progressionChanged = true;
    }
    if (useFastReload && currentProgression.ownedFastReloads > 0) {
        newState.reloadBoosts += C.FAST_RELOAD_STACKS;
        currentProgression.ownedFastReloads--;
        progressionChanged = true;
    }
    if (useRapidFire && currentProgression.ownedRapidFires > 0 && !newState.hasPermanentRapidFire) {
        newState.hasPermanentRapidFire = true;
        currentProgression.ownedRapidFires--;
        progressionChanged = true;
    }
    if (useSpeedBoost && currentProgression.ownedSpeedBoosts > 0 && !newState.hasPermanentSpeedBoost) {
        newState.hasPermanentSpeedBoost = true;
        currentProgression.ownedSpeedBoosts--;
        progressionChanged = true;
    }
    
    if (progressionChanged) {
        saveProgression(currentProgression);
        // Prevent overwriting in-run upgrades when applying new consumable state.
        const { seenEnemies, ...progressionToApply } = currentProgression;
        newState = { ...newState, ...progressionToApply };
    }

    // Explicitly stop the current (armory) music before transitioning to a battle state.
    // This prevents a race condition where the old and new tracks could play simultaneously.
    stopMusic();

    const now = performance.now();
    
    // This is the final state object we will return.
    let finalState = {
        ...newState,
        ...handleResumeClock(state, now),
        status: GameStatus.Playing, // Explicitly set to Playing
        prePauseStatus: null,
        intermissionReward: null,
        ammo: newState.maxAmmo, // Refill ammo
        reloadCompleteTime: 0,   // Cancel any ongoing reload
    };

    return finalState;
}

function handleRestartGame(state: GameState): GameState {
    performComprehensiveCleanup();

    const newGameState = prepareNewRun(
        state, 
        { useRevive: false, useFastReload: false, useRapidFire: false, useSpeedBoost: false }, // No consumables on restart
        state.hardModePreference, // Use the user's saved preference
        true // This is a restart
    );

    return newGameState;
}

function handleExitRunAndSave(state: GameState): GameState {
    const currentProgression = loadProgression();
    
    // Add earned currency and parts
    currentProgression.totalCurrency += state.currencyEarnedThisRun;
    currentProgression.upgradeParts += state.partsEarnedThisRun;
    
    // Persist any collected rare consumables
    currentProgression.activeRareConsumable = state.activeRareConsumable;

    saveProgression(currentProgression);
    
    performComprehensiveCleanup();
    
    const newInitialState = getInitialState();
    
    return {
        ...newInitialState,
        status: GameStatus.StartScreen,
        selectedHeroForMenu: state.selectedHero, // Keep the hero selection
    };
}

function handleReturnToMenu(state: GameState): GameState {
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        // Defer expensive cleanup to avoid blocking UI update
    setTimeout(() => {
        performComprehensiveCleanup();
    }, 0);
    
    let progressionData: ProgressionData;
    // Only update progression if returning from an active run or post-run screen.
    if ([GameStatus.GameOver, GameStatus.Intermission, GameStatus.Victory].includes(state.status)) {
        progressionData = updateAndSaveEndOfRunProgression(state, state.status === GameStatus.Victory);
    } else {
        // For other screens like Armory, Hangar, Store, just load the latest saved data.
        progressionData = loadProgression();
    }
    
    const currentSelectedHero = state.selectedHeroForMenu;
    
    const { messages: unlockMessages, updatedProgression, didUnlock } = checkAndQueueUnlockMessages(progressionData, performance.now());
    if (updatedProgression) {
        saveProgression(updatedProgression);
    }
    
    if (didUnlock) {
        playSound('secretFound');
    }

    // OPTIMIZATION: Pass the progression data we already have to avoid redundant localStorage read
    // Use updatedProgression if it exists (has unlock notifications), otherwise use progressionData
    const finalProgression = updatedProgression ?? progressionData;
    const newInitialState = getInitialState(finalProgression);
    
    return {
        ...newInitialState,
        status: GameStatus.StartScreen,
        // Persist the user's hero selection from the menu.
        selectedHeroForMenu: currentSelectedHero,
        // Display any newly triggered unlock messages.
        inGameMessages: unlockMessages,
    };
}

function handleContinueAfterVictory(state: GameState): GameState {
    if (state.status !== GameStatus.Victory) return state;

    // This is essentially the same flow as a regular boss defeat now.
    // We run setupIntermissionState to get rewards and update progression.
    const intermissionStateChanges = setupIntermissionState(state);
    
    return {
        ...state,
        ...intermissionStateChanges,
        status: GameStatus.Intermission,
        // The pauseStartTime was set when entering Victory, so it's correct for Intermission.
    };
}


// ============================================================================
// REDUCER
// ============================================================================

export function gameReducer(state: GameState, action: GameAction): GameState {
    switch (action.type) {
        case 'PREPARE_NEW_GAME':
            return handlePrepareNewGame(state, action);
        case 'START_GAME_READY': {
            return action.payload;
        }
        case 'CONTINUE_GAME':
            return handleContinueGame(state, action);
        case 'RESTART_GAME':
            return handleRestartGame(state);
        case 'EXIT_RUN_AND_SAVE':
            return handleExitRunAndSave(state);
        case 'RETURN_TO_MENU':
            return handleReturnToMenu(state);
        case 'CONTINUE_AFTER_VICTORY':
            return handleContinueAfterVictory(state);
        default:
            return state;
    }
}