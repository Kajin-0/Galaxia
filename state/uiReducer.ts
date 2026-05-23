import type { GameState, GameAction } from '../types';
import { GameStatus } from '../types';
import { setMusicVolume, setSoundVolume } from '../sounds';
import { getProgressionFromState, saveProgression, type ProgressionData } from '../utils/progression';
import { handleResumeClock } from '../utils/stateTransitions';

export function gameReducer(state: GameState, action: GameAction): GameState {
    switch (action.type) {
        case 'TOGGLE_PAUSE': {
            const pausableStates = [GameStatus.Playing, GameStatus.BossBattle, GameStatus.AsteroidField, GameStatus.TrainingSim];
            const canBePaused = pausableStates.includes(state.status);
            const isPaused = state.status === GameStatus.Paused;

            if (!canBePaused && !isPaused) {
                return state;
            }

            if (isPaused) {
                if (!state.prePauseStatus) return state;

                return {
                    ...state,
                    ...handleResumeClock(state, action.timestamp),
                    status: state.prePauseStatus,
                    prePauseStatus: null,
                };
            } else {
                return {
                    ...state,
                    status: GameStatus.Paused,
                    prePauseStatus: state.status,
                    pauseStartTime: action.timestamp
                };
            }
        }
        case 'GO_TO_ARMORY': {
            return { ...state, status: GameStatus.Armory };
        }
        case 'GO_TO_HANGAR': {
            return { ...state, status: GameStatus.Hangar };
        }
        case 'GO_TO_STORE': {
            return { ...state, status: GameStatus.Store };
        }
        case 'SELECT_HERO': {
            return { ...state, selectedHeroForMenu: action.hero };
        }
        case 'TOGGLE_CONTROL_LAYOUT': {
            const newLayout = state.controlLayout === 'right' ? 'left' : 'right';
            const newProgression: ProgressionData = {
                ...getProgressionFromState(state),
                controlLayout: newLayout,
            };
            saveProgression(newProgression);
            return { ...state, controlLayout: newLayout };
        }
        case 'TOGGLE_HAPTICS': {
            const newHapticsState = !state.hapticsEnabled;
            const newProgression: ProgressionData = {
                ...getProgressionFromState(state),
                hapticsEnabled: newHapticsState,
            };
            saveProgression(newProgression);
            return { ...state, hapticsEnabled: newHapticsState };
        }
        case 'SET_VOLUME': {
            let newProgression: ProgressionData;
            let newState = { ...state };
            
            if (action.volumeType === 'music') {
                setMusicVolume(action.level);
                newState.musicVolume = action.level;
                newProgression = { ...getProgressionFromState(state), musicVolume: action.level };
            } else {
                setSoundVolume(action.level);
                newState.sfxVolume = action.level;
                newProgression = { ...getProgressionFromState(state), sfxVolume: action.level };
            }

            saveProgression(newProgression);
            return newState;
        }
        case 'SET_HARD_MODE_PREFERENCE': {
            const newProgression = {
                ...getProgressionFromState(state),
                hardModePreference: action.value,
            };
            saveProgression(newProgression);
            return { ...state, hardModePreference: action.value };
        }
        default:
            return state;
    }
}
