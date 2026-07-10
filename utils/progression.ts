import type { GameState, HeroUpgrades, GeneralUpgrades, BossDefeatCount, OngoingUpgrade, Enemy as EnemyType, PurchaseState, RareConsumableType, Consumables, EngineState, UiState } from '../types';
import { GameStatus } from '../types';
import * as C from '../constants';
import { pools } from '../state/pools';
import { getNextId } from '../gameLogic/engine';
import { playSound } from '../sounds';

export interface ProgressionData {
    highScore: number;
    cumulativeScore: number;
    cumulativeLevels: number;
    unlockedHeroes: { beta: boolean; gamma: boolean };
    totalCurrency: number;
    crystalite: number;
    ownedRevives: number;
    ownedFastReloads: number;
    ownedRapidFires: number;
    ownedSpeedBoosts: number;
    bossesDefeated: number;
    bossDefeatCount: BossDefeatCount;
    unlockedBlueprintTier: number;
    unlockedTier2Upgrades: boolean;
    upgradeParts: number;
    heroUpgrades: HeroUpgrades;
    generalUpgrades: GeneralUpgrades;
    ongoingUpgrade: OngoingUpgrade | null;
    displayedStoryLevels: number[];
    seenEnemies: (EnemyType['type'] | 'asteroid')[];
    trainingSimCompletions: number;
    controlLayout: 'right' | 'left';
    musicVolume: number;
    sfxVolume: number;
    hapticsEnabled: boolean;
    hardModeUnlocked: boolean;
    hardModePreference: boolean;
    montezuma_health?: number;
    montezuma_max_health?: number;
    montezuma_defeated?: boolean;
    activeRareConsumable: {
        type: RareConsumableType;
        shotsLeft: number;
    } | null;
    unlocksNotified?: {
        beta?: boolean;
        gamma?: boolean;
        hangar?: boolean;
    };
}

const PROGRESSION_STORAGE_KEY = 'galaxiaProgression';

/**
 * Creates a ProgressionData object from the current game state.
 * This avoids redundantly reading from localStorage when the data is already in memory.
 * @param state The current GameState.
 * @returns A ProgressionData object.
 */
export function getProgressionFromState(state: GameState): ProgressionData {
    return {
        highScore: state.highScore,
        cumulativeScore: state.cumulativeScore,
        cumulativeLevels: state.cumulativeLevels,
        unlockedHeroes: state.unlockedHeroes,
        totalCurrency: state.totalCurrency,
        crystalite: state.crystalite,
        ownedRevives: state.ownedRevives,
        ownedFastReloads: state.ownedFastReloads,
        ownedRapidFires: state.ownedRapidFires,
        ownedSpeedBoosts: state.ownedSpeedBoosts,
        bossesDefeated: state.bossesDefeated,
        bossDefeatCount: state.bossDefeatCount,
        unlockedBlueprintTier: state.unlockedBlueprintTier,
        unlockedTier2Upgrades: state.unlockedTier2Upgrades,
        upgradeParts: state.upgradeParts,
        heroUpgrades: state.heroUpgrades,
        generalUpgrades: state.generalUpgrades,
        ongoingUpgrade: state.ongoingUpgrade,
        displayedStoryLevels: state.displayedStoryLevels,
        seenEnemies: Array.from(state.seenEnemies),
        trainingSimCompletions: state.trainingSimCompletions,
        controlLayout: state.controlLayout,
        musicVolume: state.musicVolume,
        sfxVolume: state.sfxVolume,
        hapticsEnabled: state.hapticsEnabled,
        hardModeUnlocked: state.hardModeUnlocked,
        hardModePreference: state.hardModePreference,
        activeRareConsumable: state.activeRareConsumable,
        unlocksNotified: state.unlocksNotified,
    };
}

const defaultHeroUpgrades: HeroUpgrades = {
    alpha_aoe_level: 0,
    beta_homing_level: 0,
    gamma_shield_hp_level: 0,
};

const defaultGeneralUpgrades: GeneralUpgrades = {
    movement_speed_level: 0,
    reload_speed_level: 0,
    ammo_capacity_level: 0,
    trident_shot_level: 0,
    trident_shot_unlocked: false,
    graviton_collector_level: 0,
};

const defaultBossDefeatCount: BossDefeatCount = {
    warden: 0,
    punisher: 0,
    overmind: 0,
};

const defaultProgression: ProgressionData = {
    highScore: 0,
    cumulativeScore: 0,
    cumulativeLevels: 0,
    unlockedHeroes: { beta: false, gamma: false },
    totalCurrency: 0,
    crystalite: 0,
    ownedRevives: 0,
    ownedFastReloads: 0,
    ownedRapidFires: 0,
    ownedSpeedBoosts: 0,
    bossesDefeated: 0,
    bossDefeatCount: defaultBossDefeatCount,
    unlockedBlueprintTier: 0,
    unlockedTier2Upgrades: false,
    upgradeParts: 0,
    heroUpgrades: defaultHeroUpgrades,
    generalUpgrades: defaultGeneralUpgrades,
    ongoingUpgrade: null,
    displayedStoryLevels: [],
    seenEnemies: [],
    trainingSimCompletions: 0,
    controlLayout: 'right', // Default to right-handed layout
    musicVolume: 0.4,
    sfxVolume: 0.5,
    hapticsEnabled: true,
    hardModeUnlocked: false,
    hardModePreference: false,
    montezuma_health: C.MONTEZUMA_INITIAL_HEALTH,
    montezuma_max_health: C.MONTEZUMA_INITIAL_HEALTH,
    montezuma_defeated: false,
    activeRareConsumable: null,
    unlocksNotified: { beta: false, gamma: false, hangar: false },
};

export const saveProgression = (data: ProgressionData) => {
    try {
        localStorage.setItem(PROGRESSION_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        // Failed to save progression
    }
};

export const loadProgression = (): ProgressionData => {
    try {
        const storedData = localStorage.getItem(PROGRESSION_STORAGE_KEY);
        if (storedData) {
            const parsedData: Partial<ProgressionData> = JSON.parse(storedData);
            
            // Destructure to handle controlLayout separately and ensure correct typing.
            const { controlLayout: parsedControlLayout, ...restOfParsedData } = parsedData;

            // Validate the controlLayout property to ensure it matches the expected type.
            const controlLayout: 'right' | 'left' = parsedControlLayout === 'left' ? 'left' : 'right';

            // Merge with defaults to ensure new fields are present
            return {
                ...defaultProgression,
                ...restOfParsedData,
                controlLayout, // Add back the validated, correctly typed value
                hapticsEnabled: parsedData.hapticsEnabled ?? true, // Default to true if missing
                heroUpgrades: { ...defaultHeroUpgrades, ...(parsedData.heroUpgrades || {}) },
                generalUpgrades: { ...defaultGeneralUpgrades, ...(parsedData.generalUpgrades || {}) },
                bossDefeatCount: { ...defaultBossDefeatCount, ...(parsedData.bossDefeatCount || {}) },
                unlocksNotified: { ...defaultProgression.unlocksNotified, ...(parsedData.unlocksNotified || {}) },
            };
        }
    } catch (e) {
        // Failed to load progression
    }
    return defaultProgression;
};

/**
 * Returns an object containing only the state properties that need to be reset for a new game run.
 * This should be used inside the reducer for START_GAME and RESTART_GAME actions.
 */
export const getNewRunState = (progression: ProgressionData, _timestamp: number) => {
    const ammoBonus = progression.generalUpgrades.ammo_capacity_level > 0
        ? C.HANGAR_GENERAL_UPGRADE_CONFIG.ammo_capacity_level[progression.generalUpgrades.ammo_capacity_level - 1].effect
        : 0;
    const initialAmmo = C.PLAYER_INITIAL_AMMO + ammoBonus;

    return {
        prePauseStatus: null,
        totalPauseDuration: 0,
        playerX: C.GAME_WIDTH / 2,
        // FIX: Initialize playerY
        playerY: C.PLAYER_Y_POSITION,
        playerVx: 0,
        enemies: [],
        projectiles: [],
        enemyProjectiles: [],
        asteroids: [],
        powerUps: [],
        sortedRenderables: [],
        weaverBeams: [],
        weaverSurges: [],
        boss: null,
        bossLasers: [],
        score: 0,
        lastTick: 0,
        lastSpawnTime: -C.INITIAL_SPAWN_INTERVAL,
        lastPlayerShotTime: -C.PLAYER_AUTOSHOOT_INTERVAL,
        lastTridentShotTime: -C.TRIDENT_SHOT_INTERVAL,
        ammo: initialAmmo,
        maxAmmo: initialAmmo,
        reloadCompleteTime: 0,
        playedEmptyClipSound: false,
        level: 1,
        levelStreakThisRun: 0,
        enemiesDefeatedInLevel: 0,
        levelUpAnnounceTime: 0,
        reloadBoosts: 0,
        playerDebuffs: {},
        phaseShiftState: {
            isActive: false,
            activeUntil: 0,
            cooldownUntil: 0,
            distanceTraveledAtMaxSpeed: 0,
        },
        explosions: [],
        damageNumbers: [],
        rockImpacts: [],
        projectileImpacts: [],
        criticalHits: [],
        shellCasings: [],
        gibs: [],
        screenShake: { magnitude: 0, duration: 0, startTime: 0 },
        screenFlashStartTime: 0,
        lightning: null,
        empArcs: [],
        lastEmpFireTime: 0,
        lastShieldClankTime: 0,
        upgradePartCollects: [],
        powerUpInfusions: [],
        inGameMessages: [],
        currencyEarnedThisRun: 0,
        partsEarnedThisRun: 0,
        activePowerUps: {},
        hasRevive: false,
        reviveTriggerTime: 0,
        playerDeathTime: 0,
        playerDeathPosition: null,
        playerHitInvulnerableUntil: 0,
        shieldBreakingUntil: 0,
        intermissionReward: null,
        wasBossHit: false,
        isHardMode: false,
        hasPermanentRapidFire: false,
        hasPermanentSpeedBoost: false,
        hasHereticalInsight: false,
        currentStoryMessage: null,
        currentEncounter: null,
        pendingEncounter: null,
        encounterOutcome: null,
        encounterFightPrepareTime: null,
        postEncounterStatus: null,
        pendingPostFightOutcome: null,
        pendingFollowupOutcomes: null,
        asteroidFieldEndTime: null,
        trainingSimState: null,
        stashedSimState: null,
        pendingOutcomeProcessTime: null,
        isMontezumaActive: false,
        gridYOffset: 0,
        isPlayerSlowed: false, // Cached slow state (calculated each frame in game loop)
        touchState: {
            isActive: false,
            currentX: null,
            offsetX: 0,
            identifier: null,
        },
        // Initialize IAP state
        iap: {
            currentPurchase: {
                state: 'idle' as PurchaseState,
                productId: null,
                error: null,
                progress: 0
            },
            pendingPurchases: [],
            purchaseHistory: [],
            lastRestoreAttempt: null,
            isAvailable: false,
            canMakePayments: false
        },
    };
};

export const getInitialEngineState = (progression: ProgressionData): EngineState => {
    const newRunState = getNewRunState(progression, performance.now());
    return {
        totalPauseDuration: newRunState.totalPauseDuration,
        playerX: newRunState.playerX,
        playerY: newRunState.playerY,
        playerVx: newRunState.playerVx,
        enemies: newRunState.enemies,
        projectiles: newRunState.projectiles,
        enemyProjectiles: newRunState.enemyProjectiles,
        weaverBeams: newRunState.weaverBeams,
        weaverSurges: newRunState.weaverSurges,
        asteroids: newRunState.asteroids,
        powerUps: newRunState.powerUps,
        sortedRenderables: newRunState.sortedRenderables,
        powerUpInfusions: newRunState.powerUpInfusions,
        activePowerUps: newRunState.activePowerUps,
        lastTick: newRunState.lastTick,
        lastSpawnTime: newRunState.lastSpawnTime,
        lastPlayerShotTime: newRunState.lastPlayerShotTime,
        lastTridentShotTime: newRunState.lastTridentShotTime,
        explosions: newRunState.explosions,
        damageNumbers: newRunState.damageNumbers,
        rockImpacts: newRunState.rockImpacts,
        projectileImpacts: newRunState.projectileImpacts,
        criticalHits: newRunState.criticalHits,
        shellCasings: newRunState.shellCasings,
        gibs: newRunState.gibs,
        screenShake: newRunState.screenShake,
        screenFlashStartTime: newRunState.screenFlashStartTime,
        lightning: newRunState.lightning,
        empArcs: newRunState.empArcs,
        lastEmpFireTime: newRunState.lastEmpFireTime,
        lastShieldClankTime: newRunState.lastShieldClankTime,
        ammo: newRunState.ammo,
        maxAmmo: newRunState.maxAmmo,
        reloadCompleteTime: newRunState.reloadCompleteTime,
        wantsToReload: undefined,
        playedEmptyClipSound: newRunState.playedEmptyClipSound,
        selectedHero: 'alpha', // Default for a run
        reloadBoosts: newRunState.reloadBoosts,
        playerDebuffs: newRunState.playerDebuffs,
        phaseShiftState: newRunState.phaseShiftState,
        upgradePartCollects: newRunState.upgradePartCollects,
        hasRevive: newRunState.hasRevive,
        reviveTriggerTime: newRunState.reviveTriggerTime,
        shieldBreakingUntil: newRunState.shieldBreakingUntil,
        playerDeathTime: newRunState.playerDeathTime,
        playerDeathPosition: newRunState.playerDeathPosition,
        playerHitInvulnerableUntil: newRunState.playerHitInvulnerableUntil,
        isHardMode: newRunState.isHardMode,
        hasPermanentRapidFire: newRunState.hasPermanentRapidFire,
        hasPermanentSpeedBoost: newRunState.hasPermanentSpeedBoost,
        hasHereticalInsight: newRunState.hasHereticalInsight,
        activeRareConsumable: null,
        encounterFightPrepareTime: newRunState.encounterFightPrepareTime,
        asteroidFieldEndTime: newRunState.asteroidFieldEndTime,
        trainingSimState: newRunState.trainingSimState,
        stashedSimState: newRunState.stashedSimState,
        isMontezumaActive: newRunState.isMontezumaActive,
        boss: newRunState.boss,
        wasBossHit: newRunState.wasBossHit,
        bossLasers: newRunState.bossLasers,
        touchState: newRunState.touchState,
        gridYOffset: newRunState.gridYOffset,
        isPlayerSlowed: newRunState.isPlayerSlowed,
    };
};

export const getInitialUiState = (progressionOverride?: ProgressionData): UiState => {
    const progression = progressionOverride ?? loadProgression();
    const newRunState = getNewRunState(progression, performance.now());

    const screenWidth = window.innerWidth;
    let laneCount = 10;
    if (screenWidth < 450) laneCount = 8;
    else if (screenWidth < 768) laneCount = 9;

    return {
        ...progression,
        seenEnemies: new Set(progression.seenEnemies || []),
        status: GameStatus.StartScreen,
        prePauseStatus: newRunState.prePauseStatus,
        pauseStartTime: undefined,
        score: newRunState.score,
        level: newRunState.level,
        levelStreakThisRun: newRunState.levelStreakThisRun,
        enemiesDefeatedInLevel: newRunState.enemiesDefeatedInLevel,
        levelUpAnnounceTime: newRunState.levelUpAnnounceTime,
        selectedHeroForMenu: 'alpha',
        currencyEarnedThisRun: newRunState.currencyEarnedThisRun,
        partsEarnedThisRun: newRunState.partsEarnedThisRun,
        intermissionReward: newRunState.intermissionReward,
        currentStoryMessage: newRunState.currentStoryMessage,
        currentEncounter: newRunState.currentEncounter,
        pendingEncounter: newRunState.pendingEncounter,
        encounterOutcome: newRunState.encounterOutcome,
        pendingOutcomeToProcess: undefined,
        postEncounterStatus: newRunState.postEncounterStatus,
        pendingPostFightOutcome: newRunState.pendingPostFightOutcome,
        pendingFollowupOutcomes: newRunState.pendingFollowupOutcomes,
        pendingOutcomeProcessTime: newRunState.pendingOutcomeProcessTime,
        inGameMessages: newRunState.inGameMessages,
        laneCount: laneCount,
        containerSize: undefined,
        iap: newRunState.iap,
    };
};

export const getInitialState = (progressionOverride?: ProgressionData): GameState => {
    const progression = progressionOverride ?? loadProgression();
    const uiState = getInitialUiState(progression);
    const engineState = getInitialEngineState(progression);

    // selectedHero is part of EngineState but needs to be synced with the UI choice at game start.
    // getInitialState is only called once at app load, so we set a default.
    // the PREPARE_NEW_GAME action will sync the hero choice properly.
    
    return {
        ...uiState,
        ...engineState,
        selectedHero: 'alpha', // from engine state
        selectedHeroForMenu: 'alpha', // from ui state
    };
};

export const updateAndSaveEndOfRunProgression = (state: GameState, isVictory: boolean = false): ProgressionData => {
    const currentProgression = loadProgression();

    const newHighScore = Math.max(currentProgression.highScore, state.score);
    const newCumulativeScore = currentProgression.cumulativeScore + state.score;
    const newCumulativeLevels = currentProgression.cumulativeLevels + state.levelStreakThisRun;
    const newTotalCurrency = currentProgression.totalCurrency + state.currencyEarnedThisRun;
    const newUpgradeParts = currentProgression.upgradeParts + state.partsEarnedThisRun;

    const newUnlockedHeroes = {
        beta: currentProgression.unlockedHeroes.beta || newCumulativeLevels >= C.BETA_UNLOCK_LEVELS,
        gamma: currentProgression.unlockedHeroes.gamma || newCumulativeScore >= C.GAMMA_UNLOCK_SCORE,
    };
    
    // Add any newly seen enemies from this run to the persistent set
    const combinedSeenEnemies = new Set([...currentProgression.seenEnemies, ...Array.from(state.seenEnemies)]);

    const updatedProgression: ProgressionData = {
        ...currentProgression,
        highScore: newHighScore,
        cumulativeScore: newCumulativeScore,
        cumulativeLevels: newCumulativeLevels,
        totalCurrency: newTotalCurrency,
        upgradeParts: newUpgradeParts,
        unlockedHeroes: newUnlockedHeroes,
        seenEnemies: Array.from(combinedSeenEnemies),
        activeRareConsumable: state.activeRareConsumable,
    };
    
    if (isVictory) {
        updatedProgression.hardModeUnlocked = true;
    }

    saveProgression(updatedProgression);
    return updatedProgression;
};

export const getStreakBonus = (isHardMode: boolean) => isHardMode ? C.CURRENCY_STREAK_BONUS_PER_LEVEL_HARD : C.CURRENCY_STREAK_BONUS_PER_LEVEL;

export function checkAndQueueUnlockMessages(progressionData: ProgressionData, timestamp: number): { messages: GameState['inGameMessages'], updatedProgression: ProgressionData | null, didUnlock: boolean } {
    let messagesToShow: GameState['inGameMessages'] = [];
    let updatedNotified = { ...(progressionData.unlocksNotified || { beta: false, gamma: false, hangar: false }) };
    let changed = false;
    let didUnlock = false;

    if (progressionData.unlockedHeroes.beta && !updatedNotified.beta) {
        const msg = pools.inGameMessages.get();
        msg.id = getNextId(); msg.text = 'Hero: Beta Unlocked!'; msg.createdAt = timestamp; msg.duration = 4000; msg.style = 'achievement';
        messagesToShow.push(msg);
        updatedNotified.beta = true;
        changed = true;
        didUnlock = true;
    }
    if (progressionData.unlockedHeroes.gamma && !updatedNotified.gamma) {
        const msg = pools.inGameMessages.get();
        msg.id = getNextId(); msg.text = 'Hero: Gamma Unlocked!'; msg.createdAt = timestamp; msg.duration = 4000; msg.style = 'achievement';
        messagesToShow.push(msg);
        updatedNotified.gamma = true;
        changed = true;
        didUnlock = true;
    }
    if (progressionData.bossesDefeated > 0 && !updatedNotified.hangar) {
        const msg = pools.inGameMessages.get();
        msg.id = getNextId(); msg.text = 'Hangar Unlocked!'; msg.createdAt = timestamp; msg.duration = 4000; msg.style = 'achievement';
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

export function prepareNewRun(
    currentState: GameState,
    consumables: Consumables,
    isHardMode: boolean,
    isRestart: boolean
): GameState {
    const now = performance.now();
    let progressionData: ProgressionData;

    // 1. Load/Save Progression
    if (isRestart) {
        // We are restarting, so save the stats from the run that just ended.
        progressionData = updateAndSaveEndOfRunProgression(currentState);
    } else {
        // We are starting a fresh game from the menu, just load the latest data.
        progressionData = loadProgression();
    }

    let progressionChanged = false;

    // 2. Apply Consumables
    let hasRevive = false;
    let reloadBoosts = 0;
    let hasPermanentRapidFire = false;
    let hasPermanentSpeedBoost = false;

    const { useRevive, useFastReload, useRapidFire, useSpeedBoost } = consumables;

    if (useRevive && progressionData.ownedRevives > 0) {
        hasRevive = true;
        progressionData.ownedRevives--;
        progressionChanged = true;
    }
    if (useFastReload && progressionData.ownedFastReloads > 0) {
        reloadBoosts = C.FAST_RELOAD_STACKS;
        progressionData.ownedFastReloads--;
        progressionChanged = true;
    }
    if (useRapidFire && progressionData.ownedRapidFires > 0) {
        hasPermanentRapidFire = true;
        progressionData.ownedRapidFires--;
        progressionChanged = true;
    }
    if (useSpeedBoost && progressionData.ownedSpeedBoosts > 0) {
        hasPermanentSpeedBoost = true;
        progressionData.ownedSpeedBoosts--;
        progressionChanged = true;
    }

    // 3. Check for Unlocks
    const { messages: unlockMessages, updatedProgression, didUnlock } = checkAndQueueUnlockMessages(progressionData, now);
    if (updatedProgression) {
        progressionData = updatedProgression;
        progressionChanged = true; // Not strictly needed as updatedProgression is assigned, but good for clarity
    }
    if (didUnlock) {
        playSound('secretFound');
    }
    
    // 4. Save Progression if anything changed
    if (progressionChanged) {
        saveProgression(progressionData);
    }

    // 5. Create New Run State
    const newRunState = getNewRunState(progressionData, now);

    // 6. Check for Story
    const storyMilestone = C.STORY_MILESTONES.find(m => m.level === 1 && !progressionData.displayedStoryLevels.includes(1));
    const isStory = !!storyMilestone;
    
    // 7. Assemble and Return Final State
    const finalState: GameState = {
        ...progressionData, // Base progression data
        ...newRunState,     // Reset gameplay properties
        status: isStory ? GameStatus.Story : GameStatus.Playing,
        prePauseStatus: isStory ? GameStatus.Playing : null,
        // FIX: Story screens are not a "pause" state. Setting pauseStartTime here confuses the clock logic
        // when other states (like Intermission) are entered and then resumed. The game loop already
        // correctly handles not simulating during non-active states like Story.
        pauseStartTime: undefined,
        isHardMode: isHardMode,
        currentStoryMessage: isStory ? { ...storyMilestone, level: 1 } : null,
        selectedHero: currentState.selectedHeroForMenu, // Persist hero selection from menu
        selectedHeroForMenu: currentState.selectedHeroForMenu,
        hasRevive,
        reloadBoosts,
        hasPermanentRapidFire,
        hasPermanentSpeedBoost,
        inGameMessages: unlockMessages,
        seenEnemies: new Set(progressionData.seenEnemies),
        // Persist settings
        controlLayout: progressionData.controlLayout,
        musicVolume: progressionData.musicVolume,
        sfxVolume: progressionData.sfxVolume,
        hapticsEnabled: progressionData.hapticsEnabled,
        hardModePreference: progressionData.hardModePreference,
        // Carry over other non-run-specific state that might be in currentState
        containerSize: currentState.containerSize,
        laneCount: currentState.laneCount, // This is calculated once in getInitialState, should be carried over
    };
    
    return finalState;
}
