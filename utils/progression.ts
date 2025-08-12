import type { GameState, HeroUpgrades, GeneralUpgrades, BossDefeatCount, OngoingUpgrade, Enemy as EnemyType } from '../types';
import { GameStatus } from '../types';
import * as C from '../constants';

const PROGRESSION_STORAGE_KEY = 'galaxiaProgression';

export interface ProgressionData {
    highScore: number;
    cumulativeScore: number;
    cumulativeLevels: number;
    unlockedHeroes: {
        beta: boolean;
        gamma: boolean;
    };
    totalCurrency: number;
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
    seenEnemies: Array<EnemyType['type'] | 'asteroid'>;
    trainingSimCompletions: number;
    controlLayout: 'right' | 'left';
    hardModeUnlocked: boolean;
    montezuma_health?: number;
    montezuma_max_health?: number;
    montezuma_defeated?: boolean;
    unlocksNotified?: {
        beta?: boolean;
        gamma?: boolean;
        hangar?: boolean;
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
    hardModeUnlocked: false,
    montezuma_health: C.MONTEZUMA_INITIAL_HEALTH,
    montezuma_max_health: C.MONTEZUMA_INITIAL_HEALTH,
    montezuma_defeated: false,
    unlocksNotified: { beta: false, gamma: false, hangar: false },
};

export const saveProgression = (data: ProgressionData) => {
    try {
        localStorage.setItem(PROGRESSION_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.error("Failed to save progression:", e);
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
                heroUpgrades: { ...defaultHeroUpgrades, ...(parsedData.heroUpgrades || {}) },
                generalUpgrades: { ...defaultGeneralUpgrades, ...(parsedData.generalUpgrades || {}) },
                bossDefeatCount: { ...defaultBossDefeatCount, ...(parsedData.bossDefeatCount || {}) },
                unlocksNotified: { ...defaultProgression.unlocksNotified, ...(parsedData.unlocksNotified || {}) },
            };
        }
    } catch (e) {
        console.error("Failed to load progression:", e);
    }
    return defaultProgression;
};

export const getInitialState = (): GameState => {
    const progression = loadProgression();

    const ammoBonus = progression.generalUpgrades.ammo_capacity_level > 0 
        ? C.HANGAR_GENERAL_UPGRADE_CONFIG.ammo_capacity_level[progression.generalUpgrades.ammo_capacity_level - 1].effect 
        : 0;

    return {
        // Core Game State
        status: GameStatus.StartScreen,
        prePauseStatus: null,
        playerX: C.GAME_WIDTH / 2,
        playerVx: 0,
        enemies: [],
        projectiles: [],
        enemyProjectiles: [],
        asteroids: [],
        powerUps: [],
        weaverBeams: [],
        boss: null,
        bossLasers: [],
        score: 0,
        gameTime: 0,
        lastTick: 0,
        lastSpawnTime: 0,
        lastPlayerShotTime: 0,
        lastTridentShotTime: 0,
        ammo: C.PLAYER_INITIAL_AMMO + ammoBonus,
        maxAmmo: C.PLAYER_INITIAL_AMMO + ammoBonus,
        reloadCompleteTime: 0,
        playedEmptyClipSound: false,
        level: 1,
        levelStreakThisRun: 0,
        enemiesDefeatedInLevel: 0,
        levelUpAnnounceTime: 0,
        selectedHero: 'alpha',
        selectedHeroForMenu: 'alpha',
        reloadBoosts: 0,

        // Effects State
        explosions: [],
        damageNumbers: [],
        rockImpacts: [],
        criticalHits: [],
        shellCasings: [],
        gibs: [],
        screenShake: { magnitude: 0, duration: 0, startTime: 0 },
        screenFlashStartTime: 0,
        lightning: null,
        empArcs: [],
        lastEmpFireTime: 0,
        upgradePartCollects: [],
        powerUpInfusions: [],
        inGameMessages: [],

        // Progression & Currency State
        ...progression,
        currencyEarnedThisRun: 0,
        partsEarnedThisRun: 0,
        
        // In-run State
        activePowerUps: {},
        hasRevive: false,
        reviveTriggerTime: 0,
        playerDeathTime: 0,
        playerDeathPosition: null,
        shieldBreakingUntil: 0,
        intermissionReward: null,
        wasBossHit: false,
        isHardMode: false,
        hasPermanentRapidFire: false,
        hasPermanentSpeedBoost: false,
        hasHereticalInsight: false,
        
        // Story & Encounter State
        currentStoryMessage: null,
        currentEncounter: null,
        pendingEncounter: null,
        encounterOutcome: null,
        encounterProcessingCompleteTime: null,
        encounterFightPrepareTime: null,
        postEncounterStatus: null,
        pendingPostFightOutcome: null,
        pendingFollowupOutcomes: null,
        asteroidFieldEndTime: null,
        trainingSimState: null,
        pendingOutcomeProcessTime: null,
        isMontezumaActive: false,

        controlLayout: progression.controlLayout || 'right',
        // Make sure seenEnemies is a Set
        seenEnemies: new Set(progression.seenEnemies || []),
        touchState: {
            isActive: false,
            currentX: null,
            offsetX: 0,
        },
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
    };
    
    if (isVictory) {
        updatedProgression.hardModeUnlocked = true;
    }

    saveProgression(updatedProgression);
    return updatedProgression;
};