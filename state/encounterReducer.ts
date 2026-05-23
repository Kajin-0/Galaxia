import type { GameState, GameAction, PossibleOutcome, OutcomeResult, ConsumableItem, StashedSimState, HeroUpgrades, GeneralUpgrades, TrainingTarget, Enemy } from '../types';
import { GameStatus } from '../types';
import * as C from '../constants';
import { getProgressionFromState, saveProgression, loadProgression } from '../utils/progression';
import { processOutcomeResult } from '../utils/creators';
import { getNextId } from '../gameLogic/engine';
import { pools } from './pools';
import { handleResumeClock, transitionFromStory, createEnemiesForEncounter, performMidRunCleanup } from '../utils/stateTransitions';

function handleChooseEncounterOption(state: GameState, action: Extract<GameAction, { type: 'CHOOSE_ENCOUNTER_OPTION' }>): GameState {
    const playerHasShield = !!state.activePowerUps.Shield;

    const possibleOutcomes = action.choiceOutcomes.filter(outcome => {
        if (!outcome.conditions) {
            return true; // No conditions, always possible
        }
        if (outcome.conditions.hasShield !== undefined) {
            return outcome.conditions.hasShield === playerHasShield;
        }
        return true; // No recognized condition, so it's possible
    });
    
    const totalProbability = possibleOutcomes.reduce((sum, o) => sum + o.probability, 0);
    let chosenOutcome: PossibleOutcome | null = null;
    
    if (totalProbability > 0) {
        const normalizedOutcomes = possibleOutcomes.map(o => ({
            ...o,
            normalizedProb: o.probability / totalProbability
        }));

        let roll = Math.random();
        for (const outcome of normalizedOutcomes) {
            if (roll < outcome.normalizedProb) {
                chosenOutcome = outcome;
                break;
            }
            roll -= outcome.normalizedProb;
        }
        if (!chosenOutcome) {
            chosenOutcome = normalizedOutcomes[normalizedOutcomes.length - 1];
        }
    } else if (possibleOutcomes.length > 0) {
        // If all probabilities are 0, pick one at random.
        chosenOutcome = possibleOutcomes[Math.floor(Math.random() * possibleOutcomes.length)];
    }

    if (chosenOutcome) {
        const isTradingBeforeHangar =
            state.currentEncounter?.id === 'black_market_trader' &&
            chosenOutcome.result.type === 'trade' &&
            state.bossesDefeated === 0;

        if (isTradingBeforeHangar) {
            const specialOutcome: OutcomeResult = {
                type: 'nothing',
                title: "A Calculated Refusal",
                text: "You examine the trader's wares, but it's all alien tech of a type you can't yet integrate. You decline the offer for now, saving your currency for another time.",
            };
            
            const now = performance.now();
            return {
                ...state,
                status: GameStatus.EncounterOutcome,
                prePauseStatus: GameStatus.RandomEncounter,
                pauseStartTime: now,
                encounterOutcome: specialOutcome,
                postEncounterStatus: GameStatus.Intermission,
                currentEncounter: null,
                screenShake: { magnitude: 0, duration: 0, startTime: 0 },
            };
        }

        const result = processOutcomeResult(chosenOutcome.result, state.bossesDefeated);
        let currentProgression = getProgressionFromState(state);
        let progressionChanged = false;
        let finalCurrencyEarnedThisRun = state.currencyEarnedThisRun;
        let finalPartsEarnedThisRun = state.partsEarnedThisRun;
        let newActiveRareConsumable: GameState['activeRareConsumable'] = state.activeRareConsumable;

        // Handle costs
        let canAfford = true;
        if (result.cost && (currentProgression.totalCurrency + state.currencyEarnedThisRun) < result.cost) {
            canAfford = false;
        }
        if (result.costConsumableType) {
            const type = result.costConsumableType;
            const qty = result.costConsumableQuantity || 1;
            if (type === 'revive' && currentProgression.ownedRevives < qty) canAfford = false;
            else if (type === 'fastReload' && currentProgression.ownedFastReloads < qty) canAfford = false;
            else if (type === 'rapidFire' && currentProgression.ownedRapidFires < qty) canAfford = false;
            else if (type === 'speedBoost' && currentProgression.ownedSpeedBoosts < qty) canAfford = false;
        }
        
        if (!canAfford) {
             return { ...state, status: GameStatus.Intermission, currentEncounter: null };
        }
        
        if (result.cost) {
            const cost = result.cost;
            const currencyLostFromRun = Math.min(cost, state.currencyEarnedThisRun);
            finalCurrencyEarnedThisRun -= currencyLostFromRun;

            const remainingCost = cost - currencyLostFromRun;
            currentProgression.totalCurrency -= remainingCost;
            progressionChanged = true;
        }
        if (result.costConsumableType) {
            const type = result.costConsumableType;
            const qty = result.costConsumableQuantity || 1;
            if (type === 'revive') currentProgression.ownedRevives -= qty;
            else if (type === 'fastReload') currentProgression.ownedFastReloads -= qty;
            else if (type === 'rapidFire') currentProgression.ownedRapidFires -= qty;
            else if (type === 'speedBoost') currentProgression.ownedSpeedBoosts -= qty;
            progressionChanged = true;
        }
        
        // Handle currency changes (gains and losses)
        if (result.currency) {
            if (result.currency > 0) { // Gain
                finalCurrencyEarnedThisRun += result.currency;
            } else { // Loss (from damage, etc.)
                const cost = Math.abs(result.currency);
                const totalPlayerCurrency = finalCurrencyEarnedThisRun + currentProgression.totalCurrency;
                const cappedCost = Math.min(cost, totalPlayerCurrency);
                result.currency = -cappedCost; // Update result for accurate UI display

                const currencyLostFromRun = Math.min(cappedCost, finalCurrencyEarnedThisRun);
                finalCurrencyEarnedThisRun -= currencyLostFromRun;

                const remainingCost = cappedCost - currencyLostFromRun;
                currentProgression.totalCurrency -= remainingCost;
                progressionChanged = true;
            }
        }

        // Handle other item gains/losses
        if (result.parts && state.bossesDefeated > 0) {
            finalPartsEarnedThisRun += result.parts;
        }
        if (result.consumableType && result.consumableQuantity) {
            const type = result.consumableType;
            const qty = result.consumableQuantity;
            if (type === 'revive') currentProgression.ownedRevives += qty;
            else if (type === 'fastReload') currentProgression.ownedFastReloads += qty;
            else if (type === 'rapidFire') currentProgression.ownedRapidFires += qty;
            else if (type === 'speedBoost') currentProgression.ownedSpeedBoosts += qty;
            progressionChanged = true;
        }
        if (result.type === 'gain_rare_consumable' && result.rareConsumableType && result.rareConsumableShots) {
            newActiveRareConsumable = {
                type: result.rareConsumableType,
                shotsLeft: result.rareConsumableShots,
            };
        }
        if (result.type === 'lose_all_items') {
            currentProgression.ownedRevives = 0;
            currentProgression.ownedFastReloads = 0;
            currentProgression.ownedRapidFires = 0;
            currentProgression.ownedSpeedBoosts = 0;
            progressionChanged = true;
        } else if (result.type === 'lose_random_items') {
            const allConsumables: ConsumableItem[] = [
                ...Array(currentProgression.ownedRevives).fill('revive'),
                ...Array(currentProgression.ownedFastReloads).fill('fastReload'),
                ...Array(currentProgression.ownedRapidFires).fill('rapidFire'),
                ...Array(currentProgression.ownedSpeedBoosts).fill('speedBoost'),
            ];

            if (allConsumables.length > 0) {
                // Weighted roll for number of items to steal: 1 (50%), 2 (25%), 3 (15%), 4 (7%), 5 (3%)
                const roll = Math.random();
                let itemsToSteal = 1;
                if (roll < 0.03) itemsToSteal = 5;
                else if (roll < 0.10) itemsToSteal = 4;
                else if (roll < 0.25) itemsToSteal = 3;
                else if (roll < 0.50) itemsToSteal = 2;

                const actualItemsToSteal = Math.min(itemsToSteal, allConsumables.length);

                // Fisher-Yates shuffle
                for (let i = allConsumables.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [allConsumables[i], allConsumables[j]] = [allConsumables[j], allConsumables[i]];
                }
                
                const stolenItems = allConsumables.slice(0, actualItemsToSteal);
                
                // Count stolen items and update progression
                const stolenCounts: { [key in ConsumableItem]?: number } = {};
                stolenItems.forEach(item => {
                    stolenCounts[item] = (stolenCounts[item] || 0) + 1;
                    if (item === 'revive') currentProgression.ownedRevives--;
                    else if (item === 'fastReload') currentProgression.ownedFastReloads--;
                    else if (item === 'rapidFire') currentProgression.ownedRapidFires--;
                    else if (item === 'speedBoost') currentProgression.ownedSpeedBoosts--;
                });
                
                const lostItemsList = Object.entries(stolenCounts)
                    .map(([type, quantity]) => {
                        const name = C.CONSUMABLE_NAMES[type as ConsumableItem] || type;
                        return `${quantity}x ${name}`;
                    })
                    .join(', ');

                result.text = `The thief jettisons an escape pod, taking some of your consumables with them! You lost: ${lostItemsList}.`;

                result.lostItems = Object.entries(stolenCounts).map(([type, quantity]) => ({
                    type: type as ConsumableItem,
                    quantity: quantity as number,
                }));
                progressionChanged = true;
            } else {
                // Player had nothing to steal, so we change the outcome to be more narrative.
                result.title = "Empty-Handed";
                result.text = "The thief makes a run for your consumables, but finds your stores empty. They escape with nothing but disappointment.";
            }
        }

        if (progressionChanged) {
            saveProgression(currentProgression);
        }

        if (result.type === 'fight' || (result.type === 'trade' && result.parts === 0)) { // Scammed trade is a fight
            performMidRunCleanup(state);

            // FIX: Create enemies for the encounter fight. This was missing, causing an empty fight.
            const newEnemies = createEnemiesForEncounter(result, state, state.lastTick - state.totalPauseDuration);

            let fightState = {
                ...state,
                status: GameStatus.Playing,
                enemies: newEnemies, // Add the spawned enemies to the state.
                currentEncounter: null,
                encounterFightPrepareTime: (state.lastTick - state.totalPauseDuration) + 1000,
                pendingPostFightOutcome: result,
                pendingFollowupOutcomes: result.followupOutcomes || null,
                playerX: C.GAME_WIDTH / 2, // Reset player position
                playerVx: 0,
                // Reset temporary invulnerability states to prevent them from
                // carrying over into the new fight.
                playerHitInvulnerableUntil: 0,
                shieldBreakingUntil: 0,
                reviveTriggerTime: 0,
                totalCurrency: currentProgression.totalCurrency,
                upgradeParts: currentProgression.upgradeParts,
                ownedRevives: currentProgression.ownedRevives,
                ownedFastReloads: currentProgression.ownedFastReloads,
                ownedRapidFires: currentProgression.ownedRapidFires,
                ownedSpeedBoosts: currentProgression.ownedSpeedBoosts,
                currencyEarnedThisRun: finalCurrencyEarnedThisRun,
                partsEarnedThisRun: finalPartsEarnedThisRun,
                seenEnemies: new Set(currentProgression.seenEnemies),
            };

            return fightState;
        } else if (result.type === 'special_event') {
            const effectiveNow = state.lastTick - state.totalPauseDuration;
            if (result.eventType === 'montezuma_encounter') {
                const loadedProgression = loadProgression(); // Need fresh data for Montezuma
                if (loadedProgression.montezuma_defeated) {
                    const now = performance.now();
                    return { ...state, status: GameStatus.EncounterOutcome, prePauseStatus: GameStatus.RandomEncounter, pauseStartTime: now, currentEncounter: null, encounterOutcome: { type: 'nothing', title: 'Empty Space', text: 'You arrive at the coordinates, but find nothing but empty space. The behemoth is long gone.' }, postEncounterStatus: GameStatus.Intermission };
                }
                const health = loadedProgression.montezuma_health ?? C.MONTEZUMA_INITIAL_HEALTH;
                const maxHealth = loadedProgression.montezuma_max_health ?? C.MONTEZUMA_INITIAL_HEALTH;
                const montezumaAsteroid = pools.asteroids.get();
                const rightPadding = C.GAME_WIDTH / state.laneCount;
                const playableWidth = C.GAME_WIDTH - rightPadding;
                const centerX = playableWidth / 2;
                Object.assign(montezumaAsteroid, {
                    id: -999,
                    x: centerX,
                    y: -300,
                    health,
                    maxHealth,
                    vx: 0,
                    vy: C.MONTEZUMA_SPEED_Y,
                    size: C.GAME_WIDTH * 0.33,
                    rotation: 0,
                    rotationSpeed: 2,
                });
                performMidRunCleanup(state);
                return { ...state, status: GameStatus.Playing, currentEncounter: null, isMontezumaActive: true, asteroids: [montezumaAsteroid], enemies: [] };
            }
            if (result.eventType === 'asteroid_field_survival') {
                return { ...state, status: GameStatus.AsteroidField, asteroidFieldEndTime: effectiveNow + C.ASTEROID_FIELD_DURATION, currentEncounter: null };
            }
            if (result.eventType === 'training_sim_challenge') {
                const difficulty = state.trainingSimCompletions;
                const targetCount = C.TRAINING_SIM_BASE_TARGET_COUNT + difficulty;
            
                // 1. Generate proto-targets (just hit counts)
                let protoTargets = [];
                for (let i = 0; i < targetCount; i++) {
                    const hits = C.TRAINING_SIM_BASE_HITS_MIN + Math.floor(Math.random() * (C.TRAINING_SIM_BASE_HITS_MAX - C.TRAINING_SIM_BASE_HITS_MIN + 1)) + Math.floor(difficulty / 2);
                    protoTargets.push({ requiredHits: hits, remainingHits: hits });
                }
            
                // 2. Sort by hits, descending. High-hit targets are placed in the foreground.
                protoTargets.sort((a, b) => b.requiredHits - a.requiredHits);
            
                const targets: TrainingTarget[] = [];
                const targetVisualRadius = 40;
                const minHorizontalSeparation = targetVisualRadius; // Guarantees a clear shot to the center
            
                // 3. Define placement depth bands (Near, Mid, Far)
                const yBands = [
                    { min: 460, max: C.PLAYER_Y_POSITION - 350 }, // Near
                    { min: 280, max: 430 }, // Mid
                    { min: 100, max: 250 }  // Far
                ];

                const rightPadding = C.GAME_WIDTH / state.laneCount;
                const playableWidth = C.GAME_WIDTH - rightPadding;
            
                // 4. Place targets intelligently, ensuring no vertical overlap for different-value targets
                protoTargets.forEach((proto, index) => {
                    let x, y;
                    let isPositionValid = false;
                    let attempts = 0;
            
                    // The highest-hit targets go in the nearest band, and so on.
                    const bandIndex = Math.min(yBands.length - 1, Math.floor((index / targetCount) * yBands.length));
                    const band = yBands[bandIndex];
            
                    while (!isPositionValid && attempts < 50) {
                        attempts++;
                        x = Math.random() * (playableWidth - targetVisualRadius * 2) + targetVisualRadius;
                        y = Math.random() * (band.max - band.min) + band.min;
                        
                        isPositionValid = true;
                        // Check against already placed targets
                        for (const placedTarget of targets) {
                            // A. Check for physical overlap with ANY target (don't let them touch)
                            const physicalDistance = Math.sqrt(Math.pow(x! - placedTarget.x, 2) + Math.pow(y! - placedTarget.y, 2));
                            if (physicalDistance < targetVisualRadius * 2) {
                                isPositionValid = false;
                                break;
                            }
                
                            // B. If hit counts differ, ensure they are horizontally separated
                            // This prevents a foreground target from perfectly blocking a background target
                            if (placedTarget.requiredHits !== proto.requiredHits) {
                                const horizontalDistance = Math.abs(x! - placedTarget.x);
                                if (horizontalDistance < minHorizontalSeparation) {
                                    isPositionValid = false;
                                    break;
                                }
                            }
                        }
                    }
                    
                    // If we failed to find a valid spot (very unlikely), place it randomly anyway
                    if (!isPositionValid) {
                        x = Math.random() * (playableWidth - targetVisualRadius * 2) + targetVisualRadius;
                        y = Math.random() * (band.max - band.min) + band.min;
                    }
                
                    targets.push({
                        id: getNextId(),
                        x: x!,
                        y: y!,
                        ...proto,
                        isComplete: false,
                        isFailed: false,
                    });
                });
                
                const simStartTime = effectiveNow + C.TRAINING_SIM_COUNTDOWN_DURATION;
                const simEndTime = simStartTime + C.TRAINING_SIM_DURATION;
                
                performMidRunCleanup(state);

                const stashedState: StashedSimState = {
                    activePowerUps: { ...state.activePowerUps },
                    generalUpgrades: { ...state.generalUpgrades },
                    heroUpgrades: { ...state.heroUpgrades },
                    reloadBoosts: state.reloadBoosts,
                    hasPermanentRapidFire: state.hasPermanentRapidFire,
                    hasPermanentSpeedBoost: state.hasPermanentSpeedBoost,
                    activeRareConsumable: state.activeRareConsumable,
                    ammo: state.ammo,
                    maxAmmo: state.maxAmmo,
                };

                const defaultHeroUpgrades: HeroUpgrades = { alpha_aoe_level: 0, beta_homing_level: 0, gamma_shield_hp_level: 0 };
                const simGeneralUpgrades: GeneralUpgrades = {
                    ...state.generalUpgrades, // Keep non-combat upgrades
                    movement_speed_level: 0,
                    reload_speed_level: 0,
                    ammo_capacity_level: 0,
                    trident_shot_level: 0,
                };
                
                return {
                    ...state,
                    status: GameStatus.TrainingSim,
                    stashedSimState: stashedState,
                    trainingSimState: { targets, startTime: simStartTime, endTime: simEndTime },
                    currentEncounter: null,
                    // Apply vanilla state for the sim
                    heroUpgrades: defaultHeroUpgrades,
                    generalUpgrades: simGeneralUpgrades,
                    activePowerUps: {},
                    reloadBoosts: 0,
                    hasPermanentRapidFire: false,
                    hasPermanentSpeedBoost: false,
                    activeRareConsumable: null,
                    // Reset gameplay state for a clean sim
                    ammo: C.PLAYER_INITIAL_AMMO,
                    maxAmmo: C.PLAYER_INITIAL_AMMO,
                    reloadCompleteTime: 0,
                    inGameMessages: [],
                    screenFlashStartTime: 0,
                    lightning: null,
                    explosions: [],
                    criticalHits: [],
                    rockImpacts: [],
                    projectileImpacts: [],
                    empArcs: [],
                    powerUpInfusions: [],
                    enemies: [],
                    asteroids: [],
                    enemyProjectiles: [],
                    powerUps: [],
                    weaverBeams: [],
                };
            }
        }
        
        // For direct outcomes that don't involve a fight
        const now = performance.now();
        const oldLevel = state.level;
        const newLevel = Math.max(1, state.level + (result.levels || 0));
        const inGameMessages = [...state.inGameMessages];

        if (result.type === 'level_skip' && oldLevel < 10 && newLevel >= 10) {
            const msg = pools.inGameMessages.get();
            msg.id = getNextId();
            msg.text = "Wormhole trajectory... bypassed the Warden? Well, that's one problem solved.";
            msg.createdAt = performance.now();
            msg.duration = 5000;
            msg.style = 'achievement';
            inGameMessages.push(msg);
        }
        
        return {
            ...state,
            status: GameStatus.Loading,
            isProcessingEncounter: true,
            pendingOutcomeToProcess: result,
            postEncounterStatus: (result.type === 'level_skip' && (result.levels || 0) < 0) ? GameStatus.Playing : GameStatus.Intermission,
            currentEncounter: null,
            level: newLevel,
            inGameMessages,
            totalCurrency: currentProgression.totalCurrency,
            upgradeParts: currentProgression.upgradeParts,
            ownedRevives: currentProgression.ownedRevives,
            ownedFastReloads: currentProgression.ownedFastReloads,
            ownedRapidFires: currentProgression.ownedRapidFires,
            ownedSpeedBoosts: currentProgression.ownedSpeedBoosts,
            currencyEarnedThisRun: finalCurrencyEarnedThisRun,
            partsEarnedThisRun: finalPartsEarnedThisRun,
            activeRareConsumable: newActiveRareConsumable,
        };
    }

    return state;
}

export function gameReducer(state: GameState, action: GameAction): GameState {
    switch (action.type) {
        case 'DISMISS_STORY': {
            if (!state.currentStoryMessage) return state;
            const now = performance.now();
            // Do not treat story screen as a pause. The game loop handles the time gap correctly.
            const effectiveNow = now - state.totalPauseDuration;
            return transitionFromStory(state, now, effectiveNow);
        }
        case 'DISMISS_ENCOUNTER_OUTCOME': {
            const now = performance.now();
            const clockState = handleResumeClock(state, now);
            const effectiveNow = now - clockState.totalPauseDuration;

            let newState: GameState = { 
                ...state, 
                ...clockState,
                encounterOutcome: null,
                prePauseStatus: null,
            };

            // If the outcome we just dismissed was a fight setup, start the fight now.
            if (state.encounterOutcome?.type === 'fight') {
                const newEnemies = createEnemiesForEncounter(state.encounterOutcome, state, effectiveNow);
                
                newState = {
                    ...newState,
                    status: GameStatus.Playing,
                    enemies: newEnemies,
                    // pendingPostFightOutcome and pendingFollowupOutcomes are already set correctly from the previous step
                    encounterFightPrepareTime: effectiveNow + 1000,
                };
                return newState;
            }
            
            if (state.postEncounterStatus) {
                newState.status = state.postEncounterStatus;
            } else {
                // Default fallback
                newState.status = GameStatus.Intermission;
            }

            if (newState.status === GameStatus.Intermission) {
                newState.prePauseStatus = GameStatus.EncounterOutcome;
                newState.pauseStartTime = now;
            }
            
            const nonShakingStates = [
                GameStatus.Intermission,
                GameStatus.EncounterOutcome
            ];
            if (nonShakingStates.includes(newState.status)) {
                newState.screenShake = { magnitude: 0, duration: 0, startTime: 0 };
            }

            newState.pendingPostFightOutcome = null;
            newState.pendingFollowupOutcomes = null;
            return newState;
        }
        case 'CHOOSE_ENCOUNTER_OPTION':
            return handleChooseEncounterOption(state, action);
        case 'FINISH_ENCOUNTER_PROCESSING': {
            const effectiveNow = state.lastTick - state.totalPauseDuration;
            const performanceTimestamp = state.lastTick;
        
            // --- Path 1: Post-Fight Outcome Processing ---
            if (state.pendingPostFightOutcome) {
                let finalOutcomeResult = state.pendingPostFightOutcome;
                let isFollowupFight = false;
                let newEnemiesForFollowup: Enemy[] = [];
        
                if (state.pendingFollowupOutcomes && state.pendingFollowupOutcomes.length > 0) {
                    const totalProbability = state.pendingFollowupOutcomes.reduce((sum, o) => sum + o.probability, 0);
                    let chosenOutcome: PossibleOutcome | null = null;
                    if (totalProbability > 0) {
                        const normalizedOutcomes = state.pendingFollowupOutcomes.map(o => ({...o, normalizedProb: o.probability / totalProbability}));
                        let roll = Math.random();
                        for (const outcome of normalizedOutcomes) { if (roll < outcome.normalizedProb) { chosenOutcome = outcome; break; } roll -= outcome.normalizedProb; }
                        if (!chosenOutcome) chosenOutcome = normalizedOutcomes[normalizedOutcomes.length - 1];
                    } else if (state.pendingFollowupOutcomes.length > 0) {
                        chosenOutcome = state.pendingFollowupOutcomes[Math.floor(Math.random() * state.pendingFollowupOutcomes.length)];
                    }
                    if (chosenOutcome) {
                        finalOutcomeResult = chosenOutcome.result;
                        if (finalOutcomeResult && finalOutcomeResult.type === 'fight') {
                            isFollowupFight = true;
                            if (!finalOutcomeResult.showDialogue) {
                                newEnemiesForFollowup = createEnemiesForEncounter(finalOutcomeResult, state, effectiveNow);
                            }
                        }
                    }
                }
                
                if (isFollowupFight && finalOutcomeResult) {
                    if (finalOutcomeResult.showDialogue) {
                        const processedResult = processOutcomeResult(finalOutcomeResult, state.bossesDefeated);
                        return { ...state, status: GameStatus.EncounterOutcome, prePauseStatus: state.status, pauseStartTime: performanceTimestamp, encounterOutcome: processedResult, pendingPostFightOutcome: processedResult, pendingFollowupOutcomes: processedResult.followupOutcomes || null, isProcessingEncounter: false, };
                    } else {
                        const newMessages = [...state.inGameMessages];
                        const ambushMessage = pools.inGameMessages.get();
                        ambushMessage.id = getNextId(); ambushMessage.text = finalOutcomeResult.title; ambushMessage.createdAt = effectiveNow; ambushMessage.duration = 4000; ambushMessage.style = 'warning';
                        newMessages.push(ambushMessage);
                        return { ...state, status: GameStatus.Playing, enemies: [...state.enemies, ...newEnemiesForFollowup], pendingPostFightOutcome: finalOutcomeResult, pendingFollowupOutcomes: finalOutcomeResult.followupOutcomes || null, encounterFightPrepareTime: effectiveNow + 1000, isProcessingEncounter: false, inGameMessages: newMessages, };
                    }
                } else if (finalOutcomeResult) {
                    const processedResult = processOutcomeResult(finalOutcomeResult, state.bossesDefeated);
                    const currentProgression = getProgressionFromState(state);
                    let progressionChanged = false;
                    let newCurrencyEarnedThisRun = state.currencyEarnedThisRun;
                    let newPartsEarnedThisRun = state.partsEarnedThisRun;
        
                    if (processedResult.type === 'fight_reward' || processedResult.type === 'gain_items' || processedResult.type === 'gain_consumables') {
                        if (processedResult.currency) { newCurrencyEarnedThisRun += processedResult.currency; }
                        if (processedResult.parts) { newPartsEarnedThisRun += processedResult.parts; }
                        if (processedResult.consumableType && processedResult.consumableQuantity) {
                            const type = processedResult.consumableType; const qty = processedResult.consumableQuantity;
                            if (type === 'revive') currentProgression.ownedRevives += qty; else if (type === 'fastReload') currentProgression.ownedFastReloads += qty; else if (type === 'rapidFire') currentProgression.ownedRapidFires += qty; else if (type === 'speedBoost') currentProgression.ownedSpeedBoosts += qty;
                            progressionChanged = true;
                        }
                    }
                    if (progressionChanged) saveProgression(currentProgression);
                    const { seenEnemies, ...progressionToApply } = currentProgression;
        
                    return { ...state, ...progressionToApply, status: GameStatus.EncounterOutcome, prePauseStatus: state.status, pauseStartTime: performanceTimestamp, encounterOutcome: processedResult, pendingPostFightOutcome: null, pendingFollowupOutcomes: null, postEncounterStatus: GameStatus.Intermission, isProcessingEncounter: false, currencyEarnedThisRun: newCurrencyEarnedThisRun, partsEarnedThisRun: newPartsEarnedThisRun, seenEnemies: new Set(currentProgression.seenEnemies), };
                }
            }
        
            // --- Path 2: Non-Fight Outcome Processing ---
            if (state.pendingOutcomeToProcess) {
                const outcome = state.pendingOutcomeToProcess;
                performMidRunCleanup(state);
                return {
                    ...state,
                    status: GameStatus.EncounterOutcome,
                    encounterOutcome: outcome,
                    isProcessingEncounter: false,
                    pendingOutcomeToProcess: null,
                    prePauseStatus: state.postEncounterStatus,
                    pauseStartTime: performance.now(),
                };
            }
            
            // Fallback if called incorrectly
            return { ...state, status: state.postEncounterStatus ?? GameStatus.Intermission, isProcessingEncounter: false };
        }
        case 'UPDATE_GRID_OFFSET': {
            return {
                ...state,
                gridYOffset: (state.gridYOffset + action.delta) % C.GRID_CELL_HEIGHT,
            };
        }
        default:
            return state;
    }
}