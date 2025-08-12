

import type { GameState, GameAction, Consumables, PossibleOutcome, Enemy as EnemyType, TrainingTarget, GeneralUpgradeKey, HeroUpgradeKey, Asteroid } from '../types';
import { GameStatus } from '../types';
import * as C from '../constants';
import { playSound } from '../sounds';
import { loadProgression, saveProgression, getInitialState, updateAndSaveEndOfRunProgression, ProgressionData } from '../utils/progression';
import { createNewBoss, generateDynamicEncounter, processOutcomeResult } from '../utils/creators';
import { runGameTick } from '../gameLogic';
import { pools } from './pools';

let nextId = 30000; // Start high to avoid collision with other files

function checkAndQueueUnlockMessages(progressionData: ProgressionData): { messages: GameState['inGameMessages'], updatedProgression: ProgressionData | null, didUnlock: boolean } {
    const now = performance.now();
    let messagesToShow: GameState['inGameMessages'] = [];
    let updatedNotified = { ...(progressionData.unlocksNotified || { beta: false, gamma: false, hangar: false }) };
    let changed = false;
    let didUnlock = false;

    if (progressionData.unlockedHeroes.beta && !updatedNotified.beta) {
        const msg = pools.inGameMessages.get();
        msg.id = nextId++; msg.text = 'Hero: Beta Unlocked!'; msg.createdAt = now; msg.duration = 4000; msg.style = 'achievement';
        messagesToShow.push(msg);
        updatedNotified.beta = true;
        changed = true;
        didUnlock = true;
    }
    if (progressionData.unlockedHeroes.gamma && !updatedNotified.gamma) {
        const msg = pools.inGameMessages.get();
        msg.id = nextId++; msg.text = 'Hero: Gamma Unlocked!'; msg.createdAt = now; msg.duration = 4000; msg.style = 'achievement';
        messagesToShow.push(msg);
        updatedNotified.gamma = true;
        changed = true;
        didUnlock = true;
    }
    if (progressionData.bossesDefeated > 0 && !updatedNotified.hangar) {
        const msg = pools.inGameMessages.get();
        msg.id = nextId++; msg.text = 'Hangar Unlocked!'; msg.createdAt = now; msg.duration = 4000; msg.style = 'achievement';
        messagesToShow.push(msg);
        updatedNotified.hangar = true;
        changed = true;
        didUnlock = true;
    }
    
    if (changed) {
        const updatedProgressionData: ProgressionData = {
            ...progressionData,
            unlocksNotified: updatedNotified,
        };
        return {
            messages: messagesToShow,
            updatedProgression: updatedProgressionData,
            didUnlock,
        };
    }

    return {
        messages: messagesToShow,
        updatedProgression: null,
        didUnlock,
    };
}


export function gameReducer(state: GameState, action: GameAction): GameState {
    switch (action.type) {
        case 'SELECT_HERO': {
            return { ...state, selectedHeroForMenu: action.hero };
        }
        case 'START_GAME': {
            const heroToStart = state.selectedHeroForMenu;
            if (
                (heroToStart === 'beta' && !state.unlockedHeroes.beta) ||
                (heroToStart === 'gamma' && !state.unlockedHeroes.gamma)
            ) {
                return state; // Don't start if hero is locked
            }
        
            const now = performance.now();
            let progressionToSave = loadProgression();
            let progressionChanged = false;
            
            let hasRevive = false;
            let reloadBoosts = 0;
            let hasPermanentRapidFire = false;
            let hasPermanentSpeedBoost = false;

            const { useRevive, useFastReload, useRapidFire, useSpeedBoost } = action.consumables;

            if (useRevive && progressionToSave.ownedRevives > 0) {
                hasRevive = true;
                progressionToSave.ownedRevives--;
                progressionChanged = true;
            }
            if (useFastReload && progressionToSave.ownedFastReloads > 0) {
                reloadBoosts = C.FAST_RELOAD_STACKS;
                progressionToSave.ownedFastReloads--;
                progressionChanged = true;
            }
            if (useRapidFire && progressionToSave.ownedRapidFires > 0) {
                hasPermanentRapidFire = true;
                progressionToSave.ownedRapidFires--;
                progressionChanged = true;
            }
            if (useSpeedBoost && progressionToSave.ownedSpeedBoosts > 0) {
                hasPermanentSpeedBoost = true;
                progressionToSave.ownedSpeedBoosts--;
                progressionChanged = true;
            }

            const { messages: unlockMessages, updatedProgression, didUnlock } = checkAndQueueUnlockMessages(progressionToSave);
            if (updatedProgression) {
                progressionToSave = updatedProgression;
                progressionChanged = true;
            }
            if (didUnlock) {
                playSound('secretFound');
            }

            if (progressionChanged) {
                saveProgression(progressionToSave);
            }


            const storyMilestone = C.STORY_MILESTONES.find(m => m.level === 1 && !progressionToSave.displayedStoryLevels.includes(1));

            const newGameState = getInitialState();

            // Persist the seen enemies from the loaded progression into the new game state
            const seenEnemies = new Set(progressionToSave.seenEnemies);

            return {
                ...newGameState,
                status: storyMilestone ? GameStatus.Story : GameStatus.Playing,
                isHardMode: action.isHardMode,
                currentStoryMessage: storyMilestone ? { ...storyMilestone, level: 1 } : null,
                selectedHero: heroToStart,
                selectedHeroForMenu: heroToStart,
                lastTick: now,
                lastSpawnTime: now,
                lastPlayerShotTime: now,
                lastTridentShotTime: now,
                // Carry over the decision to use a revive
                hasRevive,
                reloadBoosts,
                hasPermanentRapidFire,
                hasPermanentSpeedBoost,
                seenEnemies, // Carry over the persistent set
                inGameMessages: unlockMessages,
            };
        }
        case 'CONTINUE_GAME': {
            if (state.status !== GameStatus.Intermission) return state;

            const now = performance.now();
            const { useRevive, useFastReload, useRapidFire, useSpeedBoost } = action.consumables;

            let newState = { ...state };
            
            const currentProgression = loadProgression();
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
                const { generalUpgrades, seenEnemies, ...progressionToApply } = currentProgression;
                newState = { ...newState, ...progressionToApply };
            }

            return {
                ...newState,
                status: GameStatus.Playing,
                intermissionReward: null,
                lastTick: now,
                lastSpawnTime: now,
                ammo: newState.maxAmmo, // Refill ammo
                reloadCompleteTime: 0,   // Cancel any ongoing reload
            };
        }
        case 'RESTART_GAME': {
            updateAndSaveEndOfRunProgression(state);
            const now = performance.now();
            let progressionData = loadProgression();
            
            const { messages: unlockMessages, updatedProgression, didUnlock } = checkAndQueueUnlockMessages(progressionData);
            if (updatedProgression) {
                progressionData = updatedProgression;
                saveProgression(progressionData);
            }

            if (didUnlock) {
                playSound('secretFound');
            }

            const newInitialState = getInitialState(); // this will load the saved data

            // Check for level 1 story, just like in START_GAME
            const storyMilestone = C.STORY_MILESTONES.find(m => m.level === 1 && !newInitialState.displayedStoryLevels.includes(1));

            return {
                ...newInitialState,
                status: storyMilestone ? GameStatus.Story : GameStatus.Playing,
                isHardMode: state.isHardMode, // Keep the same difficulty setting
                currentStoryMessage: storyMilestone ? { ...storyMilestone, level: 1 } : null,
                selectedHero: state.selectedHero, // Keep the same hero
                selectedHeroForMenu: state.selectedHeroForMenu,
                lastTick: now,
                lastSpawnTime: now,
                lastPlayerShotTime: now,
                lastTridentShotTime: now,
                inGameMessages: unlockMessages,
            };
        }
        case 'GO_TO_ARMORY': {
            return { ...state, status: GameStatus.Armory };
        }
        case 'GO_TO_HANGAR': {
            return { ...state, status: GameStatus.Hangar };
        }
        case 'RETURN_TO_MENU': {
            let progressionData: ProgressionData;
            if (state.status === GameStatus.GameOver || state.status === GameStatus.Intermission || state.status === GameStatus.Victory) {
                progressionData = updateAndSaveEndOfRunProgression(state, state.status === GameStatus.Victory);
            } else {
                progressionData = loadProgression();
            }
            
            const currentSelectedHero = state.selectedHeroForMenu;
            
            const { messages: unlockMessages, updatedProgression, didUnlock } = checkAndQueueUnlockMessages(progressionData);
            if (updatedProgression) {
                saveProgression(updatedProgression);
            }
            
            if (didUnlock) {
                playSound('secretFound');
            }
        
            const newInitialState = getInitialState(); // This re-loads the saved progression
            
            return {
                ...newInitialState,
                status: GameStatus.StartScreen,
                selectedHeroForMenu: currentSelectedHero,
                inGameMessages: unlockMessages,
            };
        }
        case 'TOGGLE_CONTROL_LAYOUT': {
            const newLayout = state.controlLayout === 'right' ? 'left' : 'right';
            const newProgression: ProgressionData = {
                ...loadProgression(),
                controlLayout: newLayout,
            };
            saveProgression(newProgression);
            return { ...state, controlLayout: newLayout };
        }
        case 'TOGGLE_PAUSE': {
            const pausableStates = [GameStatus.Playing, GameStatus.BossBattle, GameStatus.AsteroidField, GameStatus.TrainingSim];
            if (pausableStates.includes(state.status)) {
                return {
                    ...state,
                    status: GameStatus.Paused,
                    prePauseStatus: state.status,
                    pauseStartTime: action.timestamp // Set pause start time
                };
            }
            if (state.status === GameStatus.Paused && state.prePauseStatus) {
                const pauseDuration = action.timestamp - (state.pauseStartTime || action.timestamp);
                
                const shiftTime = (time: number | undefined | null) => time ? time + pauseDuration : time;
                const shiftTimeForZeroables = (time: number) => time > 0 ? time + pauseDuration : 0;
                
                const newActivePowerUps = { ...state.activePowerUps };
                for (const key in newActivePowerUps) {
                    const powerUpKey = key as keyof typeof newActivePowerUps;
                    const powerUp = newActivePowerUps[powerUpKey];
                    if (powerUp && powerUp.expiresAt !== Infinity) {
                        powerUp.expiresAt += pauseDuration;
                    }
                }

                return {
                    ...state,
                    status: state.prePauseStatus,
                    prePauseStatus: null,
                    pauseStartTime: undefined,
                    lastTick: action.timestamp,
                    // Shift all relevant timestamps
                    lastSpawnTime: state.lastSpawnTime + pauseDuration,
                    lastPlayerShotTime: state.lastPlayerShotTime + pauseDuration,
                    lastTridentShotTime: state.lastTridentShotTime + pauseDuration,
                    reloadCompleteTime: shiftTimeForZeroables(state.reloadCompleteTime),
                    levelUpAnnounceTime: shiftTimeForZeroables(state.levelUpAnnounceTime),
                    reviveTriggerTime: shiftTimeForZeroables(state.reviveTriggerTime),
                    shieldBreakingUntil: shiftTimeForZeroables(state.shieldBreakingUntil),
                    playerDeathTime: shiftTimeForZeroables(state.playerDeathTime),
                    screenShake: {
                        ...state.screenShake,
                        startTime: shiftTimeForZeroables(state.screenShake.startTime),
                    },
                    screenFlashStartTime: shiftTimeForZeroables(state.screenFlashStartTime),
                    lastEmpFireTime: shiftTimeForZeroables(state.lastEmpFireTime),
                    activePowerUps: newActivePowerUps,

                    // Shift effect creation times
                    explosions: state.explosions.map(e => ({ ...e, createdAt: e.createdAt + pauseDuration })),
                    damageNumbers: state.damageNumbers.map(d => ({ ...d, createdAt: d.createdAt + pauseDuration })),
                    rockImpacts: state.rockImpacts.map(r => ({ ...r, createdAt: r.createdAt + pauseDuration })),
                    criticalHits: state.criticalHits.map(c => ({ ...c, createdAt: c.createdAt + pauseDuration })),
                    shellCasings: state.shellCasings.map(s => ({ ...s, createdAt: s.createdAt + pauseDuration })),
                    gibs: state.gibs.map(g => ({ ...g, createdAt: g.createdAt + pauseDuration })),
                    lightning: state.lightning ? { ...state.lightning, createdAt: state.lightning.createdAt + pauseDuration } : null,
                    empArcs: state.empArcs.map(a => ({ ...a, createdAt: a.createdAt + pauseDuration })),
                    weaverBeams: state.weaverBeams.map(b => ({ ...b, createdAt: b.createdAt + pauseDuration })),
                    upgradePartCollects: state.upgradePartCollects.map(p => ({ ...p, createdAt: p.createdAt + pauseDuration })),
                    powerUpInfusions: state.powerUpInfusions.map(p => ({ ...p, createdAt: p.createdAt + pauseDuration })),
                    inGameMessages: state.inGameMessages.map(m => ({ ...m, createdAt: m.createdAt + pauseDuration })),

                    // Shift encounter/mode timers
                    encounterProcessingCompleteTime: shiftTime(state.encounterProcessingCompleteTime),
                    encounterFightPrepareTime: shiftTime(state.encounterFightPrepareTime),
                    pendingOutcomeProcessTime: shiftTime(state.pendingOutcomeProcessTime),
                    asteroidFieldEndTime: shiftTime(state.asteroidFieldEndTime),
                    trainingSimState: state.trainingSimState ? {
                        ...state.trainingSimState,
                        startTime: state.trainingSimState.startTime + pauseDuration,
                        endTime: state.trainingSimState.endTime + pauseDuration,
                        targets: state.trainingSimState.targets.map(t => ({...t, lastHitTime: shiftTime(t.lastHitTime)}))
                    } : null,

                    // Shift boss timers
                    boss: state.boss ? {
                        ...state.boss,
                        phaseStartTime: state.boss.phaseStartTime + pauseDuration,
                        lastAttackTime: state.boss.lastAttackTime + pauseDuration,
                        attackPatternStartTime: state.boss.attackPatternStartTime + pauseDuration,
                        lastSweepWaveTime: shiftTime(state.boss.lastSweepWaveTime),
                        beamChargeStartTime: shiftTime(state.boss.beamChargeStartTime),
                        beamFireStartTime: shiftTime(state.boss.beamFireStartTime),
                        lastExplosionTime: shiftTime(state.boss.lastExplosionTime),
                    } : null,
                    bossLasers: state.bossLasers.map(l => ({
                        ...l,
                        chargeStartTime: l.chargeStartTime + pauseDuration,
                        fireStartTime: l.fireStartTime + pauseDuration,
                    })),

                    // Shift enemy AI timers
                    enemies: state.enemies.map(e => ({
                        ...e,
                        lastShotTime: e.lastShotTime + pauseDuration,
                        dodgeCooldownUntil: shiftTime(e.dodgeCooldownUntil),
                        pauseEndTime: shiftTime(e.pauseEndTime),
                        lastBeamTime: shiftTime(e.lastBeamTime),
                        shieldRegenTime: shiftTime(e.shieldRegenTime),
                    })),
                };
            }
            return state;
        }
        case 'BUY_REVIVE':
        case 'BUY_FAST_RELOAD':
        case 'BUY_RAPID_FIRE':
        case 'BUY_SPEED_BOOST': {
            let cost = 0;
            if (action.type === 'BUY_REVIVE') cost = C.REVIVE_COST;
            else if (action.type === 'BUY_FAST_RELOAD') cost = C.FAST_RELOAD_COST;
            else if (action.type === 'BUY_RAPID_FIRE') cost = C.RAPID_FIRE_COST;
            else if (action.type === 'BUY_SPEED_BOOST') cost = C.SPEED_BOOST_COST;
            
            const availableCurrency = (state.status === GameStatus.Intermission ? state.currencyEarnedThisRun : 0) + state.totalCurrency;
            if (availableCurrency < cost) return state;

            let newCurrencyEarnedThisRun = state.currencyEarnedThisRun;
            let newTotalCurrency = state.totalCurrency;

            if (state.status === GameStatus.Intermission) {
                if (newCurrencyEarnedThisRun >= cost) {
                    newCurrencyEarnedThisRun -= cost;
                } else {
                    const remainingCost = cost - newCurrencyEarnedThisRun;
                    newCurrencyEarnedThisRun = 0;
                    newTotalCurrency -= remainingCost;
                }
            } else {
                newTotalCurrency -= cost;
            }

            const currentProgression = loadProgression();
            currentProgression.totalCurrency = newTotalCurrency;

            let updatedState = { ...state, totalCurrency: newTotalCurrency, currencyEarnedThisRun: newCurrencyEarnedThisRun };
            
            if (action.type === 'BUY_REVIVE') {
                updatedState.ownedRevives++;
                currentProgression.ownedRevives++;
            } else if (action.type === 'BUY_FAST_RELOAD') {
                updatedState.ownedFastReloads++;
                currentProgression.ownedFastReloads++;
            } else if (action.type === 'BUY_RAPID_FIRE') {
                updatedState.ownedRapidFires++;
                currentProgression.ownedRapidFires++;
            } else if (action.type === 'BUY_SPEED_BOOST') {
                updatedState.ownedSpeedBoosts++;
                currentProgression.ownedSpeedBoosts++;
            }
            
            saveProgression(currentProgression);
            return updatedState;
        }
        case 'START_UPGRADE': {
            if (state.ongoingUpgrade) return state; // Already upgrading something

            let config;
            if (action.target === 'general') {
                config = C.HANGAR_GENERAL_UPGRADE_CONFIG[action.upgradeKey as GeneralUpgradeKey][action.level - 1];
            } else {
                switch(action.upgradeKey as HeroUpgradeKey) {
                    case 'alpha_aoe_level': config = C.HANGAR_ALPHA_UPGRADE_CONFIG[action.level - 1]; break;
                    case 'beta_homing_level': config = C.HANGAR_BETA_UPGRADE_CONFIG[action.level - 1]; break;
                    case 'gamma_shield_hp_level': config = C.HANGAR_GAMMA_UPGRADE_CONFIG[action.level - 1]; break;
                    default: return state; // Should not happen
                }
            }

            if (!config || state.totalCurrency < config.currency || state.upgradeParts < config.parts) {
                return state; // Cannot afford
            }

            const newProgression: ProgressionData = {
                ...loadProgression(),
                totalCurrency: state.totalCurrency - config.currency,
                upgradeParts: state.upgradeParts - config.parts,
                ongoingUpgrade: {
                    target: action.target,
                    upgradeKey: action.upgradeKey,
                    level: action.level,
                    completionTime: Date.now() + config.time,
                }
            };

            saveProgression(newProgression);
            const { seenEnemies, ...progressionToApply } = newProgression;
            return { ...state, ...progressionToApply };
        }
        case 'COLLECT_UPGRADE': {
            if (!state.ongoingUpgrade || Date.now() < state.ongoingUpgrade.completionTime) {
                return state; // Not finished yet
            }
            
            const { target, upgradeKey, level } = state.ongoingUpgrade;
            const newHeroUpgrades = { ...state.heroUpgrades };
            const newGeneralUpgrades = { ...state.generalUpgrades };

            if (target === 'general') {
                 (newGeneralUpgrades as any)[upgradeKey] = level;
            } else {
                (newHeroUpgrades as any)[upgradeKey] = level;
            }

            const newProgression: ProgressionData = {
                ...loadProgression(),
                heroUpgrades: newHeroUpgrades,
                generalUpgrades: newGeneralUpgrades,
                ongoingUpgrade: null,
            };

            saveProgression(newProgression);
            const { seenEnemies, ...progressionToApply } = newProgression;
            return { ...state, ...progressionToApply };
        }
        case 'RELOAD_GUN': {
            if (state.status !== GameStatus.Playing && state.status !== GameStatus.BossBattle && state.status !== GameStatus.AsteroidField && state.status !== GameStatus.TrainingSim) return state;
            if (state.reloadCompleteTime > performance.now() || state.ammo === state.maxAmmo) {
                return state;
            }
            
            let reloadBonus = 0;
            if (state.generalUpgrades.reload_speed_level > 0) {
                reloadBonus = C.HANGAR_GENERAL_UPGRADE_CONFIG.reload_speed_level[state.generalUpgrades.reload_speed_level - 1].effect;
            }
            const reloadBoostReduction = Math.min(state.reloadBoosts * C.RELOAD_TIME_REDUCTION_PER_STACK, C.RELOAD_TIME_REDUCTION_MAX);
            const totalReloadReduction = Math.min(reloadBoostReduction + reloadBonus, C.RELOAD_TIME_REDUCTION_MAX);
            const currentReloadTime = C.RELOAD_TIME * (1 - totalReloadReduction);
            
            playSound('reload');
            return {
                ...state,
                reloadCompleteTime: performance.now() + currentReloadTime,
                playedEmptyClipSound: false,
            };
        }
        case 'DISMISS_STORY': {
            if (!state.currentStoryMessage) return state; // Should not happen, but safeguard

            // Mark the story as seen
            const newProgression = {
                ...loadProgression(),
                // Use a Set to avoid duplicates just in case
                displayedStoryLevels: [...new Set([...state.displayedStoryLevels, state.currentStoryMessage.level])]
            };
            saveProgression(newProgression);

            const updatedStateForTransition = {
                ...state,
                displayedStoryLevels: newProgression.displayedStoryLevels,
                currentStoryMessage: null,
                lastTick: performance.now()
            };

            const isBossLevel = (state.level % C.BOSS_LEVEL_INTERVAL === 0) || state.level === 100;
            if (isBossLevel) {
                const newBoss = createNewBoss(state.level, state.bossDefeatCount, performance.now());
                const msg = pools.inGameMessages.get();
                msg.id = nextId++; msg.text = newBoss.bossType.replace(/_/g, ' '); msg.createdAt = performance.now(); msg.duration = 4000; msg.style = 'boss';
                const bossMessage = msg;
                playSound('encounterBad');
                return { ...updatedStateForTransition, status: GameStatus.BossBattle, boss: newBoss, inGameMessages: [...state.inGameMessages, bossMessage] };
            }
            return { ...updatedStateForTransition, status: GameStatus.Playing };
        }
        case 'DISMISS_BLUEPRINT_UNLOCK': {
            // Deprecated, but keep for safety. Handled by encounter outcome now.
            return { ...state, status: GameStatus.Intermission, lastTick: performance.now() };
        }
        case 'DISMISS_ENCOUNTER_OUTCOME': {
            let newState: GameState = { ...state, encounterOutcome: null, lastTick: performance.now() };

            // Check if the outcome being dismissed grants the special insight
            if (state.encounterOutcome?.gainHereticalInsight) {
                newState.hasHereticalInsight = true;
                const msg = pools.inGameMessages.get();
                msg.id = nextId++; msg.text = 'HERETICAL INSIGHT GAINED'; msg.createdAt = performance.now(); msg.duration = 4000; msg.style = 'achievement';
                newState.inGameMessages = [...newState.inGameMessages, msg];
            }
            
            if (state.pendingPostFightOutcome && state.pendingFollowupOutcomes) {
                const totalProbability = state.pendingFollowupOutcomes.reduce((sum, o) => sum + o.probability, 0);
                let chosenOutcome = null;
                if (totalProbability > 0) {
                    const normalizedOutcomes = state.pendingFollowupOutcomes.map(o => ({ ...o, normalizedProb: o.probability / totalProbability }));
                    let roll = Math.random();
                    for (const outcome of normalizedOutcomes) {
                        if (roll < outcome.normalizedProb) {
                            chosenOutcome = outcome;
                            break;
                        }
                        roll -= outcome.normalizedProb;
                    }
                    if (!chosenOutcome) chosenOutcome = normalizedOutcomes[normalizedOutcomes.length - 1];
                } else if (state.pendingFollowupOutcomes.length > 0) {
                    chosenOutcome = state.pendingFollowupOutcomes[Math.floor(Math.random() * state.pendingFollowupOutcomes.length)];
                }
                
                if (chosenOutcome) {
                    newState.pendingPostFightOutcome = chosenOutcome.result;
                    newState.pendingFollowupOutcomes = chosenOutcome.result.followupOutcomes || null;
                    const result = processOutcomeResult(chosenOutcome.result, state.bossesDefeated);
                    if (result.type === 'fight' || result.type === 'fight_reward') {
                        newState.encounterFightPrepareTime = performance.now() + 1000;
                        newState.status = GameStatus.Playing;
                        newState.postEncounterStatus = null;
                        newState.encounterOutcome = result;
                        return newState;
                    } else {
                        newState.encounterOutcome = result;
                        newState.status = GameStatus.EncounterProcessing;
                        newState.encounterProcessingCompleteTime = performance.now() + 1500;
                    }
                }
            } else if (state.postEncounterStatus) {
                if (state.postEncounterStatus === GameStatus.Playing && newState.pendingPostFightOutcome?.type === 'fight_reward') {
                    // This case handles winning a fight, then immediately getting the reward screen
                    const result = processOutcomeResult(newState.pendingPostFightOutcome, state.bossesDefeated);
                    newState.encounterOutcome = result;
                    newState.status = GameStatus.EncounterProcessing;
                    newState.encounterProcessingCompleteTime = performance.now() + 1500;
                    newState.postEncounterStatus = GameStatus.Intermission;
                } else {
                    newState.status = state.postEncounterStatus;
                }
            } else {
                newState.status = GameStatus.Intermission;
            }
            
            // Reset shake if the final status is a menu screen.
            const nonShakingStates = [
                GameStatus.Intermission,
                GameStatus.EncounterProcessing,
                GameStatus.EncounterOutcome
            ];
            if (nonShakingStates.includes(newState.status)) {
                newState.screenShake = { magnitude: 0, duration: 0, startTime: 0 };
            }

            newState.pendingPostFightOutcome = null;
            newState.pendingFollowupOutcomes = null;
            return newState;
        }
        case 'CHOOSE_ENCOUNTER_OPTION': {
            const totalProbability = action.choiceOutcomes.reduce((sum, o) => sum + o.probability, 0);
            let chosenOutcome: PossibleOutcome | null = null;
            
            if (totalProbability > 0) {
                const normalizedOutcomes = action.choiceOutcomes.map(o => ({
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
            } else if (action.choiceOutcomes.length > 0) {
                // If all probabilities are 0, pick one at random.
                chosenOutcome = action.choiceOutcomes[Math.floor(Math.random() * action.choiceOutcomes.length)];
            }

            if (chosenOutcome) {
                const result = processOutcomeResult(chosenOutcome.result, state.bossesDefeated);
                let currentProgression = loadProgression();
                let progressionChanged = false;
                let finalCurrencyEarnedThisRun = state.currencyEarnedThisRun;

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
                        currentProgression.totalCurrency += result.currency;
                    } else { // Loss (from damage, etc.)
                        const cost = Math.abs(result.currency);
                        const totalPlayerCurrency = finalCurrencyEarnedThisRun + currentProgression.totalCurrency;
                        const cappedCost = Math.min(cost, totalPlayerCurrency);
                        result.currency = -cappedCost; // Update result for accurate UI display

                        const currencyLostFromRun = Math.min(cappedCost, finalCurrencyEarnedThisRun);
                        finalCurrencyEarnedThisRun -= currencyLostFromRun;

                        const remainingCost = cappedCost - currencyLostFromRun;
                        currentProgression.totalCurrency -= remainingCost;
                    }
                    progressionChanged = true;
                }

                // Handle other item gains/losses
                if (result.parts && state.bossesDefeated > 0) {
                    currentProgression.upgradeParts += result.parts;
                    progressionChanged = true;
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
                if (result.type === 'lose_all_items') {
                    currentProgression.ownedRevives = 0;
                    currentProgression.ownedFastReloads = 0;
                    currentProgression.ownedRapidFires = 0;
                    currentProgression.ownedSpeedBoosts = 0;
                    progressionChanged = true;
                }

                if (progressionChanged) {
                    saveProgression(currentProgression);
                }

                if (result.type === 'fight' || (result.type === 'trade' && result.parts === 0)) { // Scammed trade is a fight
                    return {
                        ...state,
                        status: GameStatus.Playing,
                        currentEncounter: null,
                        encounterFightPrepareTime: performance.now() + 1000,
                        pendingPostFightOutcome: result,
                        pendingFollowupOutcomes: result.followupOutcomes || null,
                        playerX: C.GAME_WIDTH / 2, // Reset player position
                        playerVx: 0,
                        totalCurrency: currentProgression.totalCurrency,
                        upgradeParts: currentProgression.upgradeParts,
                        ownedRevives: currentProgression.ownedRevives,
                        ownedFastReloads: currentProgression.ownedFastReloads,
                        ownedRapidFires: currentProgression.ownedRapidFires,
                        ownedSpeedBoosts: currentProgression.ownedSpeedBoosts,
                        currencyEarnedThisRun: finalCurrencyEarnedThisRun,
                        seenEnemies: new Set(currentProgression.seenEnemies),
                    };
                } else if (result.type === 'special_event') {
                    if (result.eventType === 'montezuma_encounter') {
                        if (currentProgression.montezuma_defeated) {
                            return { ...state, status: GameStatus.EncounterProcessing, currentEncounter: null, encounterOutcome: { type: 'nothing', title: 'Empty Space', text: 'You arrive at the coordinates, but find nothing but empty space. The behemoth is long gone.' }, encounterProcessingCompleteTime: performance.now() + 1500, postEncounterStatus: GameStatus.Intermission };
                        }
                        const health = currentProgression.montezuma_health ?? C.MONTEZUMA_INITIAL_HEALTH;
                        const maxHealth = currentProgression.montezuma_max_health ?? C.MONTEZUMA_INITIAL_HEALTH;
                        const montezumaAsteroid: Asteroid = {
                            id: -999,
                            x: C.GAME_WIDTH / 2,
                            y: -300,
                            health,
                            maxHealth,
                            vx: 0,
                            vy: C.MONTEZUMA_SPEED_Y,
                            size: C.GAME_WIDTH * 0.45,
                            rotation: 0,
                            rotationSpeed: 2,
                        };
                        return { ...state, status: GameStatus.Playing, currentEncounter: null, isMontezumaActive: true, asteroids: [montezumaAsteroid], enemies: [] };
                    }
                    if (result.eventType === 'asteroid_field_survival') {
                        return { ...state, status: GameStatus.AsteroidField, asteroidFieldEndTime: performance.now() + C.ASTEROID_FIELD_DURATION, currentEncounter: null };
                    }
                    if (result.eventType === 'training_sim_challenge') {
                        const now = performance.now();
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
                                x = Math.random() * (C.GAME_WIDTH - targetVisualRadius * 2) + targetVisualRadius;
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
                                x = Math.random() * (C.GAME_WIDTH - targetVisualRadius * 2) + targetVisualRadius;
                                y = Math.random() * (band.max - band.min) + band.min;
                            }
                        
                            targets.push({
                                id: nextId++,
                                x: x!,
                                y: y!,
                                ...proto,
                                isComplete: false,
                                isFailed: false,
                            });
                        });
                        
                        const simStartTime = now + C.TRAINING_SIM_COUNTDOWN_DURATION;
                        const simEndTime = simStartTime + C.TRAINING_SIM_DURATION;
                        
                        return { 
                            ...state, 
                            status: GameStatus.TrainingSim, 
                            trainingSimState: { targets, startTime: simStartTime, endTime: simEndTime }, 
                            currentEncounter: null,
                            ammo: state.maxAmmo, // Start with full ammo
                            reloadCompleteTime: 0, // Cancel any reload
                        };
                    }
                }
                
                // For direct outcomes that don't involve a fight
                const oldLevel = state.level;
                const newLevel = Math.max(1, state.level + (result.levels || 0));
                const inGameMessages = [...state.inGameMessages];

                if (result.type === 'level_skip' && oldLevel < 10 && newLevel >= 10) {
                    const msg = pools.inGameMessages.get();
                    msg.id = nextId++;
                    msg.text = "Wormhole trajectory... bypassed the Warden? Well, that's one problem solved.";
                    msg.createdAt = performance.now();
                    msg.duration = 5000;
                    msg.style = 'achievement';
                    inGameMessages.push(msg);
                }
                
                return {
                    ...state,
                    status: GameStatus.EncounterProcessing,
                    screenShake: { magnitude: 0, duration: 0, startTime: 0 },
                    encounterOutcome: result,
                    encounterProcessingCompleteTime: performance.now() + 1500,
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
                    seenEnemies: new Set(currentProgression.seenEnemies),
                };
            }
            return state;
        }
        case 'TOUCH_START':
            return {
                ...state,
                touchState: {
                    isActive: true,
                    currentX: action.x,
                    offsetX: action.x - state.playerX,
                }
            };
        case 'TOUCH_MOVE':
            // Only update if touch is already active to prevent weird states
            if (!state.touchState.isActive) return state;
            return {
                ...state,
                touchState: {
                    ...state.touchState,
                    currentX: action.x,
                }
            };
        case 'TOUCH_END':
            return {
                ...state,
                touchState: {
                    isActive: false,
                    currentX: null,
                    offsetX: 0,
                }
            };
        case 'GAME_TICK':
            if (state.lastTick === 0 && action.timestamp > 0) {
                return { ...state, lastTick: action.timestamp }
            }
            const activeStates = [GameStatus.Playing, GameStatus.BossBattle, GameStatus.PlayerDying, GameStatus.EncounterProcessing, GameStatus.AsteroidField, GameStatus.TrainingSim];
            if (!activeStates.includes(state.status)) {
                // For non-gameplay states, just update the timestamp so UI animations can use it.
                return { ...state, lastTick: action.timestamp };
            }
            return runGameTick(state, action);
        default:
            return state;
    }
}