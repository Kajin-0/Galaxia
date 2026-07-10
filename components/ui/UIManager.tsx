import React, { useEffect } from 'react';
import type { GameState, GameAction, Consumables } from '../../types';
import { GameStatus } from '../../types';
import { performComprehensiveCleanup } from '../../utils/stateTransitions';

// Import all UI screens
import { StartScreen } from './StartScreen';
import { GameOverScreen } from './GameOverScreen';
import { ArmoryScreen } from './ArmoryScreen';
import { HangarScreen } from './HangarScreen';
import { StoreScreen } from './StoreScreen';
import { StoryScreen } from './StoryScreen';
import { PauseScreen } from './PauseScreen';
import { RandomEncounterScreen } from './RandomEncounterScreen';
import { EncounterOutcomeScreen } from './EncounterOutcomeScreen';
import { EncounterProcessingScreen } from './EncounterProcessingScreen';
import { VictoryScreen } from './VictoryScreen';
import { TransitionDirector } from './TransitionDirector';

interface UIManagerProps {
    gameState: GameState;
    dispatch: React.Dispatch<GameAction>;
    handleStartGame: (consumables: Consumables, isHardMode: boolean) => void;
}

// This component encapsulates the timed wait for encounter processing.
// By moving it outside the UIManager component, we prevent it from being
// recreated on every render, which was causing its timer to reset indefinitely.
const EncounterProcessor: React.FC<{ dispatch: React.Dispatch<GameAction> }> = ({ dispatch }) => {
    useEffect(() => {
        // Perform a comprehensive cleanup during the processing screen to prevent
        // memory leaks and performance degradation during long play sessions.
        performComprehensiveCleanup();

        const PROCESSING_DURATION = 1500;
        const timerId = setTimeout(() => {
            dispatch({ type: 'FINISH_ENCOUNTER_PROCESSING' });
        }, PROCESSING_DURATION);

        // Cleanup function to prevent the action from being dispatched if the component unmounts early.
        return () => clearTimeout(timerId);
    }, [dispatch]); // dispatch is stable, so this effect runs only once on mount.

    return <EncounterProcessingScreen />;
};


export const UIManager: React.FC<UIManagerProps> = ({ gameState, dispatch, handleStartGame }) => {
    const screen = (() => {
      switch (gameState.status) {
        case GameStatus.StartScreen:
            return <StartScreen 
                onStart={handleStartGame}
                dispatch={dispatch}
                highScore={gameState.highScore}
                unlockedHeroes={gameState.unlockedHeroes}
                cumulativeScore={gameState.cumulativeScore}
                cumulativeLevels={gameState.cumulativeLevels}
                ownedRevives={gameState.ownedRevives}
                ownedFastReloads={gameState.ownedFastReloads}
                ownedRapidFires={gameState.ownedRapidFires}
                ownedSpeedBoosts={gameState.ownedSpeedBoosts}
                selectedHero={gameState.selectedHeroForMenu}
                onSelectHero={(hero) => dispatch({ type: 'SELECT_HERO', hero })}
                bossesDefeated={gameState.bossesDefeated}
                hardModeUnlocked={gameState.hardModeUnlocked}
                hardModePreference={gameState.hardModePreference}
                onSetHardModePreference={(value) => dispatch({ type: 'SET_HARD_MODE_PREFERENCE', value })}
                hapticsEnabled={gameState.hapticsEnabled}
            />;
        case GameStatus.Armory:
        case GameStatus.Intermission:
            return <ArmoryScreen
                dispatch={dispatch}
                gameStatus={gameState.status}
                totalCurrency={gameState.status === GameStatus.Intermission ? gameState.totalCurrency + gameState.currencyEarnedThisRun : gameState.totalCurrency}
                crystalite={gameState.crystalite}
                currencyEarnedThisRun={gameState.currencyEarnedThisRun}
                partsEarnedThisRun={gameState.partsEarnedThisRun}
                ownedRevives={gameState.ownedRevives}
                ownedFastReloads={gameState.ownedFastReloads}
                ownedRapidFires={gameState.ownedRapidFires}
                ownedSpeedBoosts={gameState.ownedSpeedBoosts}
                intermissionReward={gameState.intermissionReward}
                hasPermanentRapidFire={gameState.hasPermanentRapidFire}
                hasRevive={gameState.hasRevive}
            />;
        case GameStatus.Hangar:
            return <HangarScreen
                dispatch={dispatch}
                totalCurrency={gameState.totalCurrency}
                crystalite={gameState.crystalite}
                upgradeParts={gameState.upgradeParts}
                heroUpgrades={gameState.heroUpgrades}
                generalUpgrades={gameState.generalUpgrades}
                ongoingUpgrade={gameState.ongoingUpgrade}
                unlockedHeroes={gameState.unlockedHeroes}
                unlockedTier2Upgrades={gameState.unlockedTier2Upgrades}
            />;
        case GameStatus.Store:
            return <StoreScreen
                dispatch={dispatch}
                crystalite={gameState.crystalite}
                iapState={gameState.iap}
            />;
        case GameStatus.GameOver:
             return <GameOverScreen 
                dispatch={dispatch}
                score={gameState.score} 
            />;
        case GameStatus.Story:
            if (!gameState.currentStoryMessage) return null;
            return <StoryScreen
                title={gameState.currentStoryMessage.title}
                text={gameState.currentStoryMessage.text}
                onDismiss={() => dispatch({ type: 'DISMISS_STORY' })}
            />;
        case GameStatus.Victory:
            return <VictoryScreen
                dispatch={dispatch}
                score={gameState.score}
            />;
        case GameStatus.EncounterOutcome:
            if (!gameState.encounterOutcome) return null;
            return <EncounterOutcomeScreen
                outcome={gameState.encounterOutcome}
                onDismiss={() => dispatch({ type: 'DISMISS_ENCOUNTER_OUTCOME' })}
            />;
         case GameStatus.RandomEncounter:
            if (!gameState.currentEncounter) return null;
            return <RandomEncounterScreen
                encounter={gameState.currentEncounter}
                onChoose={(outcomes) => dispatch({ type: 'CHOOSE_ENCOUNTER_OPTION', choiceOutcomes: outcomes })}
                totalCurrency={gameState.totalCurrency}
                currencyEarnedThisRun={gameState.currencyEarnedThisRun}
                ownedRevives={gameState.ownedRevives}
                ownedFastReloads={gameState.ownedFastReloads}
                ownedRapidFires={gameState.ownedRapidFires}
                ownedSpeedBoosts={gameState.ownedSpeedBoosts}
            />;
        case GameStatus.Loading:
            return <EncounterProcessor dispatch={dispatch} />;
        case GameStatus.Paused:
            return <PauseScreen 
                dispatch={dispatch}
                currentLayout={gameState.controlLayout}
                musicVolume={gameState.musicVolume}
                sfxVolume={gameState.sfxVolume}
                hapticsEnabled={gameState.hapticsEnabled}
            />;
        default:
            return null;
      }
    })();

    return <TransitionDirector status={gameState.status}>{screen}</TransitionDirector>;
};
