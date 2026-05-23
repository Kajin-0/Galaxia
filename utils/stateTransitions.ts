
import type { GameState, Boss, ConsumableItem, OutcomeResult, Enemy } from '../types';
import { GameStatus } from '../types';
import * as C from '../constants';
import { pools } from '../state/pools';
import { createNewBoss, processOutcomeResult } from './creators';
import { playSound } from '../sounds';
import { getNextId, resetNextId } from '../gameLogic/engine';
import { getStreakBonus, loadProgression, saveProgression, getProgressionFromState } from './progression';
import { HARD_MODE_MULTIPLIERS } from '../gameLogic/config';
import { populateExplosionParticles, clearCollisionCaches } from '../gameLogic/collision';
import { triggerHaptic } from './haptics';
import { getPlayableGridBoundsAtY } from '../gameLogic/positioning';
import { clearAllRenderCaches } from '../components/canvas/drawUnifiedFrame';

export interface BossPhaseTransitionPayload {
    newPhase: Boss['phase'];
    fragments?: Enemy[];
    isInvulnerable?: boolean;
    attackPattern?: Boss['attackPattern'];
    beamChargeStartTime?: number;
    beamFireStartTime?: number;
    beamDuration?: number;
    safeSpotX?: number;
    [key: string]: unknown; // Allow additional properties to be spread
}

/**
 * Calculates the new clock state when resuming from a pause.
 * @param state The current game state.
 * @param timestamp The current `performance.now()` timestamp.
 * @returns A state fragment with updated `totalPauseDuration` and a resynchronized `lastTick`.
 */
export function handleResumeClock(state: GameState, timestamp: number): Pick<GameState, 'totalPauseDuration' | 'pauseStartTime' | 'lastTick'> {
    const pauseDuration = timestamp - (state.pauseStartTime || timestamp);
    const newTotalPauseDuration = state.totalPauseDuration + pauseDuration;
    const newLastTick = state.lastTick + pauseDuration;

    return {
        totalPauseDuration: newTotalPauseDuration,
        pauseStartTime: undefined,
        lastTick: newLastTick,
    };
}

export function performMidRunCleanup(state: GameState) {
    pools.enemies.releaseAll(state.enemies); state.enemies.length = 0;
    pools.asteroids.releaseAll(state.asteroids); state.asteroids.length = 0;
    pools.projectiles.releaseAll(state.projectiles); state.projectiles.length = 0;
    pools.enemyProjectiles.releaseAll(state.enemyProjectiles); state.enemyProjectiles.length = 0;
    state.explosions.forEach(exp => {
        if (exp.particles.length > 0) {
            pools.splatterParticles.releaseAll(exp.particles);
            exp.particles.length = 0;
        }
    });
    pools.explosions.releaseAll(state.explosions); state.explosions.length = 0;
    pools.damageNumbers.releaseAll(state.damageNumbers); state.damageNumbers.length = 0;
    pools.rockImpacts.releaseAll(state.rockImpacts); state.rockImpacts.length = 0;
    pools.projectileImpacts.releaseAll(state.projectileImpacts); state.projectileImpacts.length = 0;
    pools.criticalHits.releaseAll(state.criticalHits); state.criticalHits.length = 0;
    pools.shellCasings.releaseAll(state.shellCasings); state.shellCasings.length = 0;
    pools.gibs.releaseAll(state.gibs); state.gibs.length = 0;
    if (state.lightning) pools.lightning.release(state.lightning);
    pools.empArcs.releaseAll(state.empArcs); state.empArcs.length = 0;
    pools.weaverBeams.releaseAll(state.weaverBeams); state.weaverBeams.length = 0;
    pools.weaverSurges.releaseAll(state.weaverSurges); state.weaverSurges.length = 0;
    pools.upgradeParts.releaseAll(state.upgradePartCollects); state.upgradePartCollects.length = 0;
    pools.powerUps.releaseAll(state.powerUps); state.powerUps.length = 0;
    pools.powerUpInfusions.releaseAll(state.powerUpInfusions); state.powerUpInfusions.length = 0;
    
    state.sortedRenderables.length = 0;

    // Clear logic caches
    clearCollisionCaches();
    // Clear all rendering caches
    clearAllRenderCaches();
}

export function performComprehensiveCleanup() {
    // This function operates on global state (pools and caches) and doesn't need the game state object.
    
    // 1. Clear all module-level caches and globals
    clearCollisionCaches();
    resetNextId();
    
    // 2. Clear all rendering caches (including aggressive cacheManager clear)
    clearAllRenderCaches();
    
    // NOTE: Object pools are cleared via the releaseAll methods when a new run starts
    // or when this is called from the lifecycle reducer.
    // It's safer to release objects from the state arrays than to blindly clear the pools.
}

function syncTimers(state: Partial<GameState>, effectiveNow: number): Partial<GameState> {
    // BUG FIX: Resynchronize player shooting timers to prevent a "catch-up" shot
    // after a state transition that involved a pause (e.g., story screen -> boss fight).
    // This was the root cause of the projectile desync bug.
    // FIX: Set lastShotTime to a value that ensures muzzle flash is OFF during transition
    // by subtracting 100ms to ensure now - lastShotTime > 50ms threshold (muzzle flash duration)
    state.lastPlayerShotTime = effectiveNow - 100;
    state.lastTridentShotTime = effectiveNow - 100;
    
    // Reset other combat-related timers
    state.reloadCompleteTime = 0;
    state.lastEmpFireTime = 0;
    state.lastShieldClankTime = 0;

    if (state.boss) {
        state.boss = {
            ...state.boss,
            phaseStartTime: effectiveNow,
            attackPatternStartTime: effectiveNow,
            lastAttackTime: effectiveNow,
        };
    }
    return state;
}

function resetPlayerCombatState(state: GameState): Partial<GameState> {
    return {
        ammo: state.maxAmmo,
        reloadCompleteTime: 0,
        playedEmptyClipSound: false,
        playerDebuffs: {},
        reviveTriggerTime: 0,
        playerHitInvulnerableUntil: 0,
        shieldBreakingUntil: 0,
    };
}

/**
 * Prepares a state fragment for a boss battle.
 * This function is responsible for clearing all existing game entities and setting up the boss.
 * It does NOT handle status or clock changes.
 */
export function setupBossBattleState(state: GameState, effectiveNow: number): Partial<GameState> {
    performMidRunCleanup(state);

    const newBoss = createNewBoss(state.level, state.bossDefeatCount, effectiveNow, state.isHardMode, state.laneCount);

    const bossStateFragment: Partial<GameState> = {
        boss: newBoss,
        bossLasers: [],
        ...resetPlayerCombatState(state),
        levelUpAnnounceTime: 0,
        pendingEncounter: null,
        currentEncounter: null,
        postEncounterStatus: null,
        pendingPostFightOutcome: null,
        // FIX: Reset screen effects to prevent visual artifacts from carrying over.
        screenShake: { magnitude: 0, duration: 0, startTime: 0 },
        screenFlashStartTime: 0,
    };
    
    return syncTimers(bossStateFragment, effectiveNow);
}

/**
 * Prepares a state fragment for an intermission screen.
 * This function calculates rewards and clears gameplay entities.
 * It does NOT handle status or clock changes.
 */
export function setupIntermissionState(state: GameState): Partial<GameState> {
    performMidRunCleanup(state);

    const currentProgression = getProgressionFromState(state);
    const wasHangarLocked = currentProgression.bossesDefeated === 0;

    currentProgression.bossesDefeated++;
    currentProgression.bossDefeatCount[state.boss!.bossType] = (currentProgression.bossDefeatCount[state.boss!.bossType] || 0) + 1;

    const isHangarNowUnlocked = wasHangarLocked && currentProgression.bossesDefeated > 0;
    
    let newMessages = [...state.inGameMessages];
    if (isHangarNowUnlocked && !currentProgression.unlocksNotified?.hangar) {
        const msg = pools.inGameMessages.get();
        msg.id = getNextId(); msg.text = 'Hangar Unlocked!'; msg.createdAt = 0; msg.duration = 4000; msg.style = 'achievement';
        newMessages.push(msg);
        if (!currentProgression.unlocksNotified) currentProgression.unlocksNotified = { beta: false, gamma: false, hangar: false };
        currentProgression.unlocksNotified.hangar = true;
    }

    const consumableTypes: ConsumableItem[] = ['revive', 'fastReload', 'rapidFire', 'speedBoost'];
    const randomType = consumableTypes[Math.floor(Math.random() * consumableTypes.length)];
    const randomRewardName = C.CONSUMABLE_NAMES[randomType];

    switch(randomType) {
        case 'revive': currentProgression.ownedRevives++; break;
        case 'fastReload': currentProgression.ownedFastReloads++; break;
        case 'rapidFire': currentProgression.ownedRapidFires++; break;
        case 'speedBoost': currentProgression.ownedSpeedBoosts++; break;
    }
    
    let newPartsEarned = state.partsEarnedThisRun;
    if (!wasHangarLocked) {
        newPartsEarned += C.UPGRADE_PART_REWARD_BOSS + (Math.random() < C.UPGRADE_PART_DROP_CHANCE_BOSS ? 1 : 0);
    }
    saveProgression(currentProgression);

    const streakMultiplierOnDefeat = 1 + state.levelStreakThisRun * getStreakBonus(state.isHardMode);
    
    const { seenEnemies, ...progressionToApply } = currentProgression;
    
    // Set createdAt time for newly added messages now that we know it
    newMessages.forEach(msg => { if (msg.createdAt === 0) msg.createdAt = state.lastTick - state.totalPauseDuration; });
    
    return {
        ...progressionToApply,
        boss: null,
        score: state.score + C.BOSS_DEFEAT_SCORE,
        currencyEarnedThisRun: state.currencyEarnedThisRun + Math.floor(C.BOSS_DEFEAT_CURRENCY * streakMultiplierOnDefeat),
        partsEarnedThisRun: newPartsEarned,
        intermissionReward: { name: randomRewardName },
        inGameMessages: newMessages,
        screenShake: { magnitude: 0, duration: 0, startTime: 0 },
        touchState: { isActive: false, currentX: null, offsetX: 0, identifier: null },
    };
}


export function transitionToGameOver(state: GameState, now: number): GameState {
    return { 
        ...state, 
        status: GameStatus.GameOver, 
        screenShake: { magnitude: 0, duration: 0, startTime: 0 }, 
        touchState: { isActive: false, currentX: null, offsetX: 0, identifier: null }, 
        lastTick: now 
    };
}

export function transitionToPlayerDying(state: GameState, now: number, effectiveNow: number, deathPosition: {x: number, y: number}): GameState {
    
    const exp = pools.explosions.get();
    exp.id = getNextId();
    exp.x = deathPosition.x;
    exp.y = deathPosition.y;
    exp.createdAt = effectiveNow;
    populateExplosionParticles(exp.particles);

    playSound('explosion');
    playSound('gameOver');
    triggerHaptic('explosion', state.hapticsEnabled);

    // Release all hostile entities to prevent re-triggering death.
    // Also release particles from any existing explosions.
    state.explosions.forEach(e => {
        if (e.particles.length > 0) {
            pools.splatterParticles.releaseAll(e.particles);
            e.particles.length = 0;
        }
    });
    pools.explosions.releaseAll(state.explosions);
    
    pools.projectiles.releaseAll(state.projectiles);
    pools.enemyProjectiles.releaseAll(state.enemyProjectiles);
    pools.weaverBeams.releaseAll(state.weaverBeams);
    pools.enemies.releaseAll(state.enemies);
    pools.asteroids.releaseAll(state.asteroids);
    pools.weaverSurges.releaseAll(state.weaverSurges);

    // Construct a clean state for the death animation.
    // Spread the original state to keep score, level, settings etc.
    // Then, explicitly overwrite all gameplay entities to be empty or null.
    return {
        ...state,
        
        status: GameStatus.PlayerDying,
        playerDeathTime: effectiveNow,
        playerDeathPosition: deathPosition,
        
        // Entities to clear
        enemies: [],
        asteroids: [],
        projectiles: [],
        enemyProjectiles: [],
        weaverBeams: [],
        weaverSurges: [],
        boss: null,
        bossLasers: [],

        // Effects to keep/add for the death animation
        explosions: [exp],
        
        // Reset any other state that could interfere
        pendingEncounter: null,
        encounterFightPrepareTime: null,
        asteroidFieldEndTime: null,
        isMontezumaActive: false,
        
        touchState: { isActive: false, currentX: null, offsetX: 0, identifier: null },
        screenShake: { magnitude: C.SCREEN_SHAKE_MAGNITUDE_EXPLOSION, duration: C.SCREEN_SHAKE_DURATION_EXPLOSION, startTime: now },
    };
}


export function transitionToLevelUp(state: GameState, now: number, effectiveNow: number, performanceTimestamp: number): GameState {
    let newState = {
        ...state,
        level: state.level + 1,
        enemiesDefeatedInLevel: 0,
        levelStreakThisRun: state.levelStreakThisRun + 1,
        levelUpAnnounceTime: effectiveNow,
    };
    playSound('levelUp');

    if (!newState.unlockedTier2Upgrades && newState.levelStreakThisRun >= C.TIER_2_UNLOCK_LEVEL_STREAK) {
        newState.unlockedTier2Upgrades = true; 
        saveProgression({ ...loadProgression(), unlockedTier2Upgrades: true }); 
        playSound('secretFound');
        const msg = pools.inGameMessages.get();
        msg.id = getNextId(); msg.text = 'Upgrade: Tier II Unlocked!'; msg.createdAt = effectiveNow; msg.duration = 4000; msg.style = 'achievement';
        newState.inGameMessages.push(msg);
    }

    const storyMilestone = C.STORY_MILESTONES.find(m => newState.level === m.level && !newState.displayedStoryLevels.includes(m.level));
    if (storyMilestone) {
        return { 
            ...newState, 
            status: GameStatus.Story,
            prePauseStatus: newState.status,
            currentStoryMessage: { ...storyMilestone, level: storyMilestone.level },
            screenShake: { magnitude: 0, duration: 0, startTime: 0 }, 
            screenFlashStartTime: 0,
        };
    }
    
    if (Math.random() < C.ENCOUNTER_CHANCE_ON_LEVEL_UP) {
        // BUG FIX: The previous change to randomize encounters had a subtle bug where it could
        // accidentally modify the original C.ENCOUNTERS array if not handled carefully.
        // By creating an explicit shallow copy with .filter() (which returns a new array), we guarantee
        // that all subsequent operations (like shuffling) are performed on a temporary,
        // disposable array, preserving the integrity of the constant data.
        const availableEncounters = C.ENCOUNTERS.filter(e => newState.level >= (e.minLevel || 0));
        
        if (availableEncounters.length > 0) {
            // --- PROVABLY FAIR SELECTION ---
            // 1. Shuffle the list of available encounters to remove any ordering bias.
            // Fisher-Yates algorithm for an unbiased shuffle.
            for (let i = availableEncounters.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [availableEncounters[i], availableEncounters[j]] = [availableEncounters[j], availableEncounters[i]];
            }

            // 2. Perform weighted random selection on the shuffled list.
            const totalWeight = availableEncounters.reduce((s, e) => s + e.weight, 0);
            if (totalWeight > 0) {
                let roll = Math.random() * totalWeight;
                let chosenEncounter = null;
                let cumulativeWeight = 0;

                for (const encounter of availableEncounters) {
                    cumulativeWeight += encounter.weight;
                    if (roll <= cumulativeWeight) {
                        chosenEncounter = encounter;
                        break;
                    }
                }
                
                // 3. Add a fallback to handle potential floating-point inaccuracies,
                // guaranteeing an encounter is always chosen if available.
                if (!chosenEncounter) {
                    chosenEncounter = availableEncounters[availableEncounters.length - 1];
                }
                newState.pendingEncounter = chosenEncounter;
            }
        }
    }

    if (!newState.activePowerUps.Shield && Math.random() < (C.SHIELD_CHANCE_ON_LEVEL_UP_BASE + (newState.selectedHero === 'gamma' ? C.GAMMA_SHIELD_CHANCE_BONUS : 0))) {
        newState.activePowerUps.Shield = { 
            expiresAt: Infinity,
            hp: (newState.selectedHero === 'gamma' && newState.heroUpgrades.gamma_shield_hp_level > 0 ? C.HANGAR_GAMMA_UPGRADE_CONFIG[newState.heroUpgrades.gamma_shield_hp_level - 1].effect : 1),
            createdAt: effectiveNow,
        };
        // FIX: The generic 'powerUp' sound is not a valid SoundName. Use the specific sound for gaining a shield.
        playSound('powerUpShield');
    }
    return newState;
}

export function transitionToAsteroidFieldComplete(state: GameState, now: number, effectiveNow: number, performanceTimestamp: number): GameState {
    let newGeneralUpgrades = { ...state.generalUpgrades };
    const streakMultiplier = 1 + state.levelStreakThisRun * getStreakBonus(state.isHardMode);
    let newPartsEarned = state.partsEarnedThisRun;
    let outcomeText, partsRewardText = '';
    if (state.bossesDefeated > 0) {
        newPartsEarned += C.ASTEROID_FIELD_SURVIVAL_REWARD_PARTS;
        partsRewardText = ` and ${C.ASTEROID_FIELD_SURVIVAL_REWARD_PARTS} Upgrade Parts`;
    }
    let outcomeTitle = "Field Navigated!";
    let unlocksTrident = false;
    
    const currencyReward = Math.floor(C.ASTEROID_FIELD_SURVIVAL_REWARD_CURRENCY * streakMultiplier);
    const newCurrencyEarned = state.currencyEarnedThisRun + currencyReward;
    const newScore = state.score + C.ASTEROID_FIELD_SURVIVAL_REWARD_SCORE;

    if (!newGeneralUpgrades.trident_shot_unlocked) {
        unlocksTrident = true;
        newGeneralUpgrades.trident_shot_unlocked = true;
        saveProgression({ ...loadProgression(), generalUpgrades: newGeneralUpgrades });
        outcomeTitle = "Upgrade: Trident Shot Unlocked!";
        outcomeText = `You navigated the treacherous field and salvaged a rare blueprint from a wreck: The Trident Weapon System!\n\nYou can now construct this powerful upgrade in the Hangar Bay.`;
        outcomeText += `\n\nYou also recovered ${currencyReward.toLocaleString()} currency${partsRewardText}.`;
        playSound('secretFound');
    } else {
        outcomeText = `You emerge on the other side, battered but intact. Your skilled piloting has earned you ${currencyReward.toLocaleString()} currency${partsRewardText}.`;
        playSound('levelUp');
    }

    const encounterOutcome: OutcomeResult = { type: 'fight_reward', title: outcomeTitle, text: outcomeText, unlocksTrident };
    
    performMidRunCleanup(state);
    return { 
        ...state, 
        score: newScore,
        status: GameStatus.EncounterOutcome, 
        prePauseStatus: state.status,
        pauseStartTime: performanceTimestamp,
        encounterOutcome, 
        postEncounterStatus: GameStatus.Intermission, 
        asteroidFieldEndTime: null, 
        currencyEarnedThisRun: newCurrencyEarned, 
        partsEarnedThisRun: newPartsEarned, 
        generalUpgrades: newGeneralUpgrades, 
        screenShake: { magnitude: 0, duration: 0, startTime: 0 },
        touchState: { isActive: false, currentX: null, offsetX: 0, identifier: null },
    };
}

export function transitionToTrainingSimComplete(state: GameState, now: number, effectiveNow: number, performanceTimestamp: number): GameState {
    performMidRunCleanup(state);
    
    const { targets } = state.trainingSimState!;
    const successfulTargets = targets.filter(t => t.isComplete).length;
    const totalTargets = targets.length;
    const difficulty = state.trainingSimCompletions;
    const rewardPerTarget = C.TRAINING_SIM_BASE_REWARD_PER_TARGET * (1 + difficulty * 0.5);
    const totalReward = Math.floor(successfulTargets * rewardPerTarget);

    let partsReward = 0;
    if (difficulty >= 2) {
        partsReward = successfulTargets > 0 ? 1 + Math.floor(difficulty / 2) : 0;
    }

    let consumableReward: { type?: ConsumableItem, quantity?: number } = {};
    if (difficulty >= 4 && successfulTargets === totalTargets) {
        consumableReward = { type: 'fastReload', quantity: 1 };
    }
    
    let title, text;
    if (successfulTargets === 0) {
        title = "Simulation Failed";
        text = "You failed to calibrate any of the datacron's targets. No tactical data was recovered.";
    } else if (successfulTargets === totalTargets && totalTargets > 0) {
        title = "Perfect Calibration!";
        text = `A flawless run! You calibrated all ${totalTargets} targets, extracting a massive amount of tactical data. The simulation will be more challenging next time.`;
    } else {
        title = "Calibration Complete";
        text = `You successfully calibrated ${successfulTargets} out of ${totalTargets} targets. Tactical data has been extracted.`;
    }

    const outcome: OutcomeResult = {
        type: 'fight_reward',
        title,
        text,
        currency: totalReward,
        parts: partsReward,
        consumableType: consumableReward.type,
        consumableQuantity: consumableReward.quantity
    };
    
    const wasPerfect = successfulTargets === totalTargets && totalTargets > 0;
    const newCompletionCount = state.trainingSimCompletions + (wasPerfect ? 1 : 0);

    const newProgression = loadProgression();
    if (newProgression.trainingSimCompletions !== newCompletionCount) {
        newProgression.trainingSimCompletions = newCompletionCount;
        saveProgression(newProgression);
    }

    let restoredState: Partial<GameState> = {};
    if (state.stashedSimState) {
        const simTotalDuration = C.TRAINING_SIM_COUNTDOWN_DURATION + C.TRAINING_SIM_DURATION;
        const restoredActivePowerUps = { ...state.stashedSimState.activePowerUps };
        for (const key in restoredActivePowerUps) {
            const powerUpKey = key as keyof typeof restoredActivePowerUps;
            const powerUp = restoredActivePowerUps[powerUpKey];
            if (powerUp && powerUp.expiresAt !== Infinity) {
                powerUp.expiresAt += simTotalDuration;
            }
        }
        
        restoredState = {
            activePowerUps: restoredActivePowerUps,
            generalUpgrades: state.stashedSimState.generalUpgrades,
            heroUpgrades: state.stashedSimState.heroUpgrades,
            reloadBoosts: state.stashedSimState.reloadBoosts,
            hasPermanentRapidFire: state.stashedSimState.hasPermanentRapidFire,
            hasPermanentSpeedBoost: state.stashedSimState.hasPermanentSpeedBoost,
            activeRareConsumable: state.stashedSimState.activeRareConsumable,
            ammo: state.stashedSimState.ammo,
            maxAmmo: state.stashedSimState.maxAmmo,
            stashedSimState: null,
        };
    }

    return {
        ...state,
        ...restoredState,
        status: GameStatus.EncounterOutcome,
        prePauseStatus: state.status,
        pauseStartTime: performanceTimestamp,
        encounterOutcome: processOutcomeResult(outcome, state.bossesDefeated),
        trainingSimCompletions: newCompletionCount,
        trainingSimState: null,
        projectiles: [],
        postEncounterStatus: GameStatus.Intermission,
        currencyEarnedThisRun: state.currencyEarnedThisRun + totalReward,
        partsEarnedThisRun: state.partsEarnedThisRun + partsReward,
        screenShake: { magnitude: 0, duration: 0, startTime: 0 },
        touchState: { isActive: false, currentX: null, offsetX: 0, identifier: null },
    };
}

export function transitionToMontezumaComplete(state: GameState, now: number, effectiveNow: number, performanceTimestamp: number): GameState {
    const montezuma = state.asteroids.find(a => a.id === -999);
    let outcome: OutcomeResult | null = null;
    let progression = loadProgression();

    if (!montezuma) { // It was destroyed
        progression.montezuma_defeated = true;
        progression.montezuma_health = 0;
        playSound('secretFound');
        outcome = {
            type: 'fight_reward',
            title: 'Behemoth Shattered!',
            text: `You did it! The colossal asteroid cracks and breaks apart, revealing a core incredibly rich with resources!`,
            currency: C.MONTEZUMA_REWARD_CURRENCY,
            parts: C.MONTEZUMA_REWARD_PARTS,
        };
    } else { // It escaped
        progression.montezuma_health = montezuma.health;
        outcome = {
            type: 'nothing',
            title: 'It Got Away...',
            text: `The behemoth drifts past, its immense gravity making further pursuit impossible. You managed to chip away at it, though. Perhaps you'll see it again.`,
        };
    }

    saveProgression(progression);
    performMidRunCleanup(state);
    const newState = {
        ...state,
        isMontezumaActive: false,
    };

    return {
        ...newState,
        status: GameStatus.EncounterOutcome,
        prePauseStatus: state.status,
        pauseStartTime: performanceTimestamp,
        encounterOutcome: processOutcomeResult(outcome, state.bossesDefeated),
        postEncounterStatus: GameStatus.Intermission,
        currencyEarnedThisRun: state.currencyEarnedThisRun + (outcome.currency || 0),
        partsEarnedThisRun: state.partsEarnedThisRun + (outcome.parts || 0),
    };
}

export function transitionFromStory(state: GameState, now: number, effectiveNow: number): GameState {
    if (!state.currentStoryMessage) return state;

    const newDisplayedStoryLevels = [...new Set([...state.displayedStoryLevels, state.currentStoryMessage.level])];
    const progressionToSave = getProgressionFromState(state);
    progressionToSave.displayedStoryLevels = newDisplayedStoryLevels;
    saveProgression(progressionToSave);

    const isBossLevel = (state.level % C.BOSS_LEVEL_INTERVAL === 0) || state.level === 100;

    if (isBossLevel) {
        const newEffectiveNow = now - state.totalPauseDuration;
        const bossStateChanges = setupBossBattleState(state, newEffectiveNow);
        return {
            ...state,
            ...bossStateChanges,
            status: GameStatus.BossBattle,
            displayedStoryLevels: newDisplayedStoryLevels,
            currentStoryMessage: null,
            prePauseStatus: null,
            pauseStartTime: undefined,
        };
    }

    let playingState: GameState = {
        ...state,
        status: GameStatus.Playing,
        prePauseStatus: null,
        pauseStartTime: undefined,
        displayedStoryLevels: newDisplayedStoryLevels,
        currentStoryMessage: null,
    };
    
    return { ...playingState, reloadCompleteTime: 0 };
}

export function transitionBossPhase(state: GameState, now: number, effectiveNow: number, payload: BossPhaseTransitionPayload): GameState {
    if (!state.boss) return state;

    const { newPhase, ...phaseData } = payload;
    
    let newBossState: Boss = { 
        ...state.boss, 
        phase: newPhase, 
        phaseStartTime: effectiveNow, 
        lastAttackTime: effectiveNow,
        attackPatternStartTime: effectiveNow,
        ...phaseData
    };
    
    let newMessages = [...state.inGameMessages];
    let newEnemies = [...state.enemies];

    if (newPhase === 'attacking' && state.boss.phase === 'entering') {
        const msg = pools.inGameMessages.get();
        Object.assign(msg, { id: getNextId(), text: state.boss.bossType.replace(/_/g, ' '), createdAt: effectiveNow, duration: 4000, style: 'boss' });
        newMessages.push(msg);
        playSound('encounterBad');
    } else if (newPhase === 'spawning_fragments') {
        const fragments: Enemy[] = [];
        const fragmentHealth = state.isHardMode ? C.ENEMY_BASE_HEALTH * HARD_MODE_MULTIPLIERS.ENEMY_HEALTH : C.ENEMY_BASE_HEALTH;
        for (let i = 0; i < C.OVERMIND_FRAGMENT_COUNT; i++) {
             const newFragment = pools.enemies.get();
             Object.assign(newFragment, { 
                id: getNextId(), x: newBossState.x + (Math.random() - 0.5) * C.OVERMIND_WIDTH, y: newBossState.y + (Math.random() - 0.5) * C.OVERMIND_HEIGHT, type: 'dodger', health: fragmentHealth, maxHealth: fragmentHealth, lastShotTime: effectiveNow + Math.random() * 1000, baseX: newBossState.x, oscillationFrequency: Math.random() * 1.5 + 1, oscillationAmplitude: Math.random() * 60 + 30, oscillationOffset: Math.random() * Math.PI * 2, dodgeCooldownUntil: 0,
                isDodging: false, dodgeTargetX: undefined, isEncounterEnemy: false, isBuffedByConduit: false, debuffs: undefined, shieldHealth: undefined, shieldRegenTime: undefined, shieldCooldownUntil: undefined, lastHitTime: 0
            });
             fragments.push(newFragment);
        }
        newEnemies.push(...fragments);
        newBossState = { ...newBossState, fragments: fragments, isInvulnerable: true };
        
        const msg = pools.inGameMessages.get();
        Object.assign(msg, { id: getNextId(), text: 'INVULNERABLE', createdAt: effectiveNow, duration: 4000, style: 'warning' });
        newMessages.push(msg);
    } else if (newPhase === 'fury' && state.boss.phase === 'spawning_fragments') {
        playSound('levelUp');
        const msg = pools.inGameMessages.get();
        Object.assign(msg, { id: getNextId(), text: 'FURY MODE', createdAt: effectiveNow, duration: 3000, style: 'boss' });
        newMessages.push(msg);
        newBossState = { ...newBossState, isInvulnerable: false, attackPattern: 'barrage' };
    } else if (newPhase === 'beam') {
        playSound('laserShoot');
        const msg = pools.inGameMessages.get();
        Object.assign(msg, { id: getNextId(), text: 'BEAM ATTACK', createdAt: effectiveNow, duration: C.OVERMIND_BEAM_CHARGE_TIME, style: 'warning' });
        newMessages.push(msg);
        const rightPadding = C.GAME_WIDTH / state.laneCount;
        const playableWidth = C.GAME_WIDTH - rightPadding;
        newBossState = {
            ...newBossState, attackPattern: 'beam', beamChargeStartTime: effectiveNow, beamFireStartTime: effectiveNow + C.OVERMIND_BEAM_CHARGE_TIME, beamDuration: C.OVERMIND_BEAM_FIRE_TIME, safeSpotX: Math.random() * (playableWidth - C.OVERMIND_BEAM_SAFE_ZONE_WIDTH),
        };
    } else if (newPhase === 'fury' && state.boss.phase === 'beam') {
        newBossState = {
            ...newBossState, attackPattern: 'barrage', beamChargeStartTime: undefined, beamFireStartTime: undefined, beamDuration: undefined, safeSpotX: undefined,
        };
    }

    let newState = { ...state, boss: newBossState, inGameMessages: newMessages, enemies: newEnemies };
    return { ...newState, ...syncTimers(newState, effectiveNow) };
}

export function createEnemiesForEncounter(fightDetails: OutcomeResult, state: GameState, effectiveNow: number): Enemy[] {
    const enemiesToSpawn: Enemy[] = [];
    // Use standard health calculations based on current run level and difficulty
    const level = state.level;
    const standardHealth = state.isHardMode ? C.ENEMY_BASE_HEALTH * HARD_MODE_MULTIPLIERS.ENEMY_HEALTH : C.ENEMY_BASE_HEALTH;
    const weaverHealth = state.isHardMode ? C.WEAVER_HEALTH * HARD_MODE_MULTIPLIERS.ENEMY_HEALTH : C.WEAVER_HEALTH;
    
    // Conduit health scaling logic (copied from spawning.ts/creators.ts consistency)
    let conduitHealth = C.CONDUIT_HEALTH + (Math.floor(Math.max(0, level - C.CONDUIT_SPAWN_START_LEVEL) / C.CONDUIT_HEALTH_SCALING_INTERVAL) * C.CONDUIT_HEALTH_SCALING_AMOUNT);
    if (state.isHardMode) { conduitHealth *= HARD_MODE_MULTIPLIERS.ENEMY_HEALTH; }

    // Use a consistent spawn Y for calculating grid bounds, even if final Y has randomness
    const spawnYForBounds = -C.ENEMY_HEIGHT;
    const { minX, maxX } = getPlayableGridBoundsAtY(spawnYForBounds, state.laneCount);
    const playableWidth = maxX - minX;
    const midX = minX + playableWidth / 2;

    if (fightDetails.fightPreset === 'heretic_antibodies') {
        const weaver1 = pools.enemies.get(); Object.assign(weaver1, { id: getNextId(), x: minX + playableWidth * 0.25, y: -C.ENEMY_HEIGHT, type: 'weaver', health: weaverHealth, maxHealth: weaverHealth, lastShotTime: 0, baseX: minX + playableWidth * 0.25, oscillationFrequency: 0, oscillationAmplitude: 0, oscillationOffset: 0, diveTargetY: Math.random() * (C.PLAYER_Y_POSITION - 300) + 150, lastBeamTime: effectiveNow, isEncounterEnemy: true, isBuffedByConduit: false, shieldHealth: undefined, shieldRegenTime: undefined, shieldCooldownUntil: undefined, isDodging: false, dodgeTargetX: undefined, lastHitTime: 0, isPausing: false, pauseEndTime: undefined, debuffs: undefined, nextAttack: 'beam' }); enemiesToSpawn.push(weaver1);
        const weaver2 = pools.enemies.get(); Object.assign(weaver2, { id: getNextId(), x: minX + playableWidth * 0.75, y: -C.ENEMY_HEIGHT * 1.5, type: 'weaver', health: weaverHealth, maxHealth: weaverHealth, lastShotTime: 0, baseX: minX + playableWidth * 0.75, oscillationFrequency: 0, oscillationAmplitude: 0, oscillationOffset: 0, diveTargetY: Math.random() * (C.PLAYER_Y_POSITION - 300) + 150, lastBeamTime: effectiveNow, isEncounterEnemy: true, isBuffedByConduit: false, shieldHealth: undefined, shieldRegenTime: undefined, shieldCooldownUntil: undefined, isDodging: false, dodgeTargetX: undefined, lastHitTime: 0, isPausing: false, pauseEndTime: undefined, debuffs: undefined, nextAttack: 'beam' }); enemiesToSpawn.push(weaver2);
        const conduit1 = pools.enemies.get(); Object.assign(conduit1, { id: getNextId(), x: minX + playableWidth * 0.3, y: -C.ENEMY_HEIGHT * 2, type: 'conduit', health: conduitHealth, maxHealth: conduitHealth, lastShotTime: 0, baseX: minX + playableWidth * 0.3, oscillationFrequency: 0.5, oscillationAmplitude: playableWidth / 3, oscillationOffset: 0, linkedEnemyId: null, isEncounterEnemy: true, isBuffedByConduit: false, shieldHealth: undefined, shieldRegenTime: undefined, shieldCooldownUntil: undefined, isDodging: false, dodgeTargetX: undefined, lastHitTime: 0, debuffs: undefined }); enemiesToSpawn.push(conduit1);
        const conduit2 = pools.enemies.get(); Object.assign(conduit2, { id: getNextId(), x: minX + playableWidth * 0.7, y: -C.ENEMY_HEIGHT * 2.5, type: 'conduit', health: conduitHealth, maxHealth: conduitHealth, lastShotTime: 0, baseX: minX + playableWidth * 0.7, oscillationFrequency: 0.5, oscillationAmplitude: playableWidth / 3, oscillationOffset: Math.PI, linkedEnemyId: null, isEncounterEnemy: true, isBuffedByConduit: false, shieldHealth: undefined, shieldRegenTime: undefined, shieldCooldownUntil: undefined, isDodging: false, dodgeTargetX: undefined, lastHitTime: 0, debuffs: undefined }); enemiesToSpawn.push(conduit2);
    } else if (fightDetails.fightPreset === 'heretic_ship') {
        const hereticHealth = state.isHardMode ? 500 * HARD_MODE_MULTIPLIERS.ENEMY_HEALTH : 500;
        const heretic = pools.enemies.get();
        Object.assign(heretic, { id: getNextId(), x: midX, y: 150, type: 'heretic_ship', health: hereticHealth, maxHealth: hereticHealth, lastShotTime: effectiveNow, baseX: midX, oscillationFrequency: 0.2, oscillationAmplitude: 20, oscillationOffset: 0, isEncounterEnemy: true, isBuffedByConduit: false, shieldHealth: undefined, shieldRegenTime: undefined, shieldCooldownUntil: undefined, isDodging: false, dodgeTargetX: undefined, lastHitTime: 0, debuffs: undefined });
        enemiesToSpawn.push(heretic);
    } else if (fightDetails.fightPreset === 'distress_swarm') {
        const count = 8;
        for (let i = 0; i < count; i++) {
            const newEnemy = pools.enemies.get();
            // V-formation logic: from center outwards
            const relativeIndex = i - (count - 1) / 2; // -3.5 to +3.5
            const xOffset = relativeIndex * 50; 
            const yOffset = Math.abs(relativeIndex) * 30; // Further out = further back (V shape)
            
            Object.assign(newEnemy, { 
                id: getNextId(), 
                x: midX + xOffset, 
                y: -C.ENEMY_HEIGHT - yOffset, 
                type: 'standard', 
                health: standardHealth, 
                maxHealth: standardHealth, 
                lastShotTime: effectiveNow + Math.random() * 500, 
                baseX: midX + xOffset, 
                oscillationFrequency: 1.5, 
                oscillationAmplitude: 20, 
                oscillationOffset: i % 2 === 0 ? 0 : Math.PI, 
                dodgeCooldownUntil: 0, 
                isEncounterEnemy: true, 
                isBuffedByConduit: false, 
                shieldHealth: undefined, 
                shieldRegenTime: undefined, 
                isDodging: false, 
                dodgeTargetX: undefined, 
                lastHitTime: 0, 
                debuffs: undefined 
            });
            enemiesToSpawn.push(newEnemy);
        }
    } else if (fightDetails.fightPreset === 'distress_aces') {
        const count = 4;
        for (let i = 0; i < count; i++) {
            const newEnemy = pools.enemies.get();
            const xPos = minX + (playableWidth * (0.2 + 0.2 * i));
            const yPos = -C.ENEMY_HEIGHT - (i * 80);
            
            Object.assign(newEnemy, { 
                id: getNextId(), 
                x: xPos, 
                y: yPos, 
                type: 'dodger', 
                health: standardHealth, 
                maxHealth: standardHealth, 
                lastShotTime: effectiveNow + Math.random() * 300, 
                baseX: xPos, 
                oscillationFrequency: 2.0, 
                oscillationAmplitude: 60, 
                oscillationOffset: Math.random() * Math.PI * 2, 
                dodgeCooldownUntil: 0, 
                isEncounterEnemy: true, 
                isBuffedByConduit: false, 
                shieldHealth: undefined, 
                shieldRegenTime: undefined, 
                isDodging: false, 
                dodgeTargetX: undefined, 
                lastHitTime: 0, 
                debuffs: undefined 
            });
            enemiesToSpawn.push(newEnemy);
        }
    } else if (fightDetails.fightPreset === 'distress_web') {
        // 2 Weavers (Back Corners)
        const positions = [0.2, 0.8];
        positions.forEach(p => {
            const w = pools.enemies.get();
            Object.assign(w, { 
                id: getNextId(), 
                x: minX + playableWidth * p, 
                y: -C.ENEMY_HEIGHT - 150, 
                type: 'weaver', 
                health: weaverHealth, 
                maxHealth: weaverHealth, 
                lastShotTime: 0, 
                baseX: minX + playableWidth * p, 
                oscillationFrequency: 0, 
                oscillationAmplitude: 0, 
                oscillationOffset: 0, 
                diveTargetY: Math.random() * (C.PLAYER_Y_POSITION - 300) + 150, 
                lastBeamTime: effectiveNow + Math.random() * 1000, 
                isEncounterEnemy: true, 
                isBuffedByConduit: false, 
                nextAttack: 'beam',
                isPausing: false,
                lastHitTime: 0
            });
            enemiesToSpawn.push(w);
        });
        
        // 3 Standards (Front Center)
        for(let i=0; i<3; i++) {
            const s = pools.enemies.get();
            const xPos = minX + playableWidth * (0.3 + 0.2 * i);
            Object.assign(s, {
                id: getNextId(),
                x: xPos,
                y: -C.ENEMY_HEIGHT,
                type: 'standard',
                health: standardHealth, 
                maxHealth: standardHealth,
                lastShotTime: effectiveNow + Math.random() * 500,
                baseX: xPos,
                oscillationFrequency: 1.0,
                oscillationAmplitude: 30,
                oscillationOffset: Math.random() * Math.PI * 2,
                isEncounterEnemy: true,
                isBuffedByConduit: false,
                lastHitTime: 0
            });
            enemiesToSpawn.push(s);
        }
    } else if (fightDetails.fightPreset === 'distress_blockade') {
        // 2 Conduits (Front)
        const c1 = pools.enemies.get(); const c1_id = getNextId();
        const c2 = pools.enemies.get(); const c2_id = getNextId();
        
        // 2 Dodgers (Back, Shielded)
        const d1 = pools.enemies.get(); const d1_id = getNextId();
        const d2 = pools.enemies.get(); const d2_id = getNextId();
        
        // Conduit 1 (Left)
        Object.assign(c1, {
            id: c1_id, x: minX + playableWidth * 0.25, y: -C.ENEMY_HEIGHT, type: 'conduit',
            health: conduitHealth, maxHealth: conduitHealth, lastShotTime: 0, baseX: minX + playableWidth * 0.25,
            oscillationFrequency: 0.5, oscillationAmplitude: 20, oscillationOffset: 0,
            linkedEnemyId: d1_id, isEncounterEnemy: true, isBuffedByConduit: false, lastHitTime: 0
        });
        
        // Conduit 2 (Right)
        Object.assign(c2, {
            id: c2_id, x: minX + playableWidth * 0.75, y: -C.ENEMY_HEIGHT, type: 'conduit',
            health: conduitHealth, maxHealth: conduitHealth, lastShotTime: 0, baseX: minX + playableWidth * 0.75,
            oscillationFrequency: 0.5, oscillationAmplitude: 20, oscillationOffset: Math.PI,
            linkedEnemyId: d2_id, isEncounterEnemy: true, isBuffedByConduit: false, lastHitTime: 0
        });
        
        // Dodger 1 (Left, shielded)
        Object.assign(d1, {
            id: d1_id, x: minX + playableWidth * 0.25, y: -C.ENEMY_HEIGHT - 150, type: 'dodger',
            health: standardHealth, maxHealth: standardHealth, lastShotTime: effectiveNow + 500, baseX: minX + playableWidth * 0.25,
            oscillationFrequency: 1.5, oscillationAmplitude: 40, oscillationOffset: 0,
            isEncounterEnemy: true, isBuffedByConduit: true, lastHitTime: 0,
            isDodging: false, dodgeTargetX: undefined
        });

        // Dodger 2 (Right, shielded)
        Object.assign(d2, {
            id: d2_id, x: minX + playableWidth * 0.75, y: -C.ENEMY_HEIGHT - 150, type: 'dodger',
            health: standardHealth, maxHealth: standardHealth, lastShotTime: effectiveNow + 500, baseX: minX + playableWidth * 0.75,
            oscillationFrequency: 1.5, oscillationAmplitude: 40, oscillationOffset: Math.PI,
            isEncounterEnemy: true, isBuffedByConduit: true, lastHitTime: 0,
            isDodging: false, dodgeTargetX: undefined
        });
        
        enemiesToSpawn.push(c1, c2, d1, d2);
    } else {
        const count = fightDetails.fightEnemyCount || 0;
        for (let i = 0; i < count; i++) {
            const newEnemy = pools.enemies.get();
            const spawnX = minX + (playableWidth / (count + 1)) * (i + 1);
            // Default fallback for legacy or simple encounters
            const health = standardHealth;
            Object.assign(newEnemy, { id: getNextId(), x: spawnX, y: -C.ENEMY_HEIGHT * (Math.random() * 0.5 + 1), type: fightDetails.fightEnemyType || 'standard', health: health, maxHealth: health, lastShotTime: effectiveNow + Math.random() * 500, baseX: spawnX, oscillationFrequency: 1.5, oscillationAmplitude: 50, oscillationOffset: Math.random() * Math.PI * 2, dodgeCooldownUntil: 0, isEncounterEnemy: true, isBuffedByConduit: false, shieldHealth: undefined, shieldRegenTime: undefined, isDodging: false, dodgeTargetX: undefined, lastHitTime: 0, debuffs: undefined });
            enemiesToSpawn.push(newEnemy);
        }
    }
    if (enemiesToSpawn.length > 0) {
        playSound('encounterBad');
    }
    return enemiesToSpawn;
}
