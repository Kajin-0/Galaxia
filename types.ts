
export interface GameObject {
  id: number;
  x: number; // Position from the left
  y: number; // Position from the top (depth)
  radius?: number; // Collision radius for spatial grid (optional)
}

export interface Enemy extends GameObject {
  type: 'standard' | 'dodger' | 'conduit' | 'weaver' | 'heretic_ship';
  health?: number;
  maxHealth?: number;
  lastShotTime: number;
  baseX: number;
  oscillationFrequency: number;
  oscillationAmplitude: number;
  oscillationOffset: number;
  // Dodger properties
  isDodging?: boolean;
  dodgeCooldownUntil?: number;
  dodgeTargetX?: number;
  trailPoints?: { x: number, y: number, timestamp: number }[];
  isEncounterEnemy?: boolean;
  // Weaver properties
  isPausing?: boolean;
  pauseEndTime?: number;
  diveTargetY?: number;
  lastBeamTime?: number;
  nextAttack?: 'beam' | 'surge';
  // Buff/debuff properties
  isBuffedByConduit?: boolean;
  debuffs?: {
    corrosive?: {
      damagePerTick: number;
      ticksLeft: number;
      lastTickTime: number;
    }
  };
  // FIX: Add missing optional properties for enemy shields. These are referenced in
  // other parts of the codebase (spawning, reducer) but were missing from the type definition.
  shieldHealth?: number;
  shieldRegenTime?: number;
  shieldCooldownUntil?: number;
  // Conduit properties
  linkedEnemyId?: number | null;
  // Visual effect properties
  lastHitTime?: number;
}

export interface Projectile extends GameObject {
  angle?: number;
  isTridentCluster?: boolean;
}
export interface EnemyProjectile extends GameObject {
  angle?: number;
  isDuplicated?: boolean;
  speed: number;
  prevX?: number;
  prevY?: number;
}

export interface SplatterParticle {
  angle: number;
  distance: number;
  size: number;
  color: string;
}

export interface Explosion {
  id: number;
  x: number;
  y: number;
  createdAt: number;
  particles: SplatterParticle[];
}

export interface DamageNumber {
    id: number;
    x: number;
    y: number;
    text: string;
    // FIX: Change `type` to `isCrit` to match usage in the codebase.
    isCrit: boolean;
    isCorrosive?: boolean;
    isInsightDamage?: boolean;
    createdAt: number;
    initialDriftX: number;
}

export interface RockImpact {
  id: number;
  x: number;
  y: number;
  createdAt: number;
}

export interface ProjectileImpact {
  id: number;
  x: number;
  y: number;
  createdAt: number;
  color: string;
  radius: number;
}

export interface Asteroid extends GameObject {
  health: number;
  maxHealth: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  rotationSpeed: number;
  isBuffedByConduit?: boolean;
  shieldCooldownUntil?: number;
  debuffs?: {
    corrosive?: {
      damagePerTick: number;
      ticksLeft: number;
      lastTickTime: number;
    }
  };
  // Visual effect properties
  lastHitTime?: number;
}

export interface CriticalHitExplosion {
  id: number;
  x: number;
  y: number;
  radius: number;
  createdAt: number;
  isBossDeath?: boolean;
}

export interface ShellCasing {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    rotation: number;
    rotationSpeed: number;
    createdAt: number;
}

export interface Gib {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    rotation: number;
    rotationSpeed: number;
    createdAt: number;
    color: string;
    size: number;
}

export interface LightningBolt {
    id: number;
    segments: string; // SVG polyline points
    points?: { x: number; y: number }[]; // Pre-parsed points
    createdAt: number;
}

export interface EmpArc {
    id: number;
    segments: string; // SVG polyline points
    points?: { x: number; y: number }[]; // Pre-parsed points
    createdAt: number;
}

export interface WeaverBeam {
  id: number;
  y: number; // Position from the top
  createdAt: number;
}

export interface WeaverSurge extends GameObject {
    createdAt: number;
}

export interface UpgradePart extends GameObject {
    createdAt: number;
    startX: number;
    startY: number;
}

export enum GameStatus {
  StartScreen,
  Armory,
  Hangar,
  Store,
  Loading,
  Playing,
  PlayerDying,
  GameOver,
  BossBattle,
  Intermission,
  Story,
  Paused,
  RandomEncounter,
  EncounterOutcome,
  AsteroidField,
  Victory,
  TrainingSim,
}

export type PowerUpType = 'RapidFire' | 'SpreadShot' | 'Shield' | 'ExtendedMag' | 'AutoReload' | 'CritBoost' | 'ReloadBoost';

export interface PowerUp extends GameObject {
  powerUpType: PowerUpType;
}

export interface PowerUpInfusionEffect {
  id: number;
  createdAt: number;
  powerUpType: PowerUpType;
}

export type HeroType = 'alpha' | 'beta' | 'gamma';

export type BossType = 'warden' | 'punisher' | 'overmind';

export interface BossLaser {
  id: number;
  lane: number;
  chargeStartTime: number;
  fireStartTime: number;
  duration: number;
}

export interface Boss extends GameObject {
  bossType: BossType;
  health: number;
  maxHealth: number;
  phase: 'entering' | 'attacking' | 'defeated' | 'spawning_fragments' | 'fury' | 'beam';
  phaseStartTime: number;
  lastAttackTime: number;
  attackPattern: 'sweep' | 'barrage' | 'spawnMinions' | 'laser' | 'beam';
  attackPatternStartTime: number;
  difficultyLevel: number; // In-fight difficulty scaling
  
  // Properties for Warden's new sweep
  sweepWavesFired?: number;
  lastSweepWaveTime?: number;
  sweepInitialSafeLane?: number;
  sweepDirection?: -1 | 1;

  // Encounter-based difficulty scaling properties
  wardenBarrageInterval?: number;
  wardenSweepWaveCount?: number;
  wardenSweepWaveInterval?: number;
  wardenMinionCount?: number;
  punisherBarrageInterval?: number;
  punisherMinionCount?: number;

  // Overmind properties
  fragments?: Enemy[];
  isInvulnerable?: boolean;
  beamChargeStartTime?: number;
  beamFireStartTime?: number;
  beamDuration?: number;
  safeSpotX?: number;

  debuffs?: {
    corrosive?: {
      damagePerTick: number;
      ticksLeft: number;
      lastTickTime: number;
    }
  };

  // Defeated state
  explosionsFired?: number;
  lastExplosionTime?: number;
}

export interface HeroUpgrades {
    alpha_aoe_level: number;
    beta_homing_level: number;
    gamma_shield_hp_level: number;
}
export type HeroUpgradeKey = keyof HeroUpgrades;

export interface GeneralUpgrades {
    movement_speed_level: number;
    reload_speed_level: number;
    ammo_capacity_level: number;
    trident_shot_level: number;
    trident_shot_unlocked: boolean;
    graviton_collector_level: number;
}
export type GeneralUpgradeKey = keyof Omit<GeneralUpgrades, 'trident_shot_unlocked'>;

export interface OngoingUpgrade {
    target: HeroType | 'general';
    upgradeKey: string; // HeroUpgradeKey or GeneralUpgradeKey
    level: number;
    completionTime: number;
}

export interface BossDefeatCount {
    warden: number;
    punisher: number;
    overmind: number;
}

export type ConsumableItem = 'revive' | 'fastReload' | 'rapidFire' | 'speedBoost';
export type RareConsumableType = 'corrosive';

export type SpecialEventType = 'asteroid_field_survival' | 'training_sim_challenge' | 'montezuma_encounter';
export type EncounterEnvironment = 'asteroid_ambush' | 'ion_storm';

export interface OutcomeResult {
    type: 'gain_items' | 'lose_all_items' | 'lose_random_items' | 'fight' | 'trade' | 'level_skip' | 'damage_ship' | 'nothing' | 'dialogue_reward' | 'fight_reward' | 'gain_consumables' | 'special_event' | 'gain_rare_consumable';
    parts?: number;
    currency?: number;
    partsRange?: [number, number];
    currencyRange?: [number, number];
    cost?: number; // for currency trades
    costConsumableType?: ConsumableItem; // for item trades
    costConsumableQuantity?: number; // for item trades
    levels?: number; // for level_skip
    fightEnemyCount?: number;
    fightEnemyType?: 'standard' | 'dodger' | 'conduit' | 'weaver' | 'heretic_ship';
    fightPreset?: 'heretic_antibodies' | 'heretic_ship' | 'distress_swarm' | 'distress_aces' | 'distress_web' | 'distress_blockade';
    environment?: EncounterEnvironment;
    title: string;
    text: string;
    followupOutcomes?: PossibleOutcome[];
    consumableType?: ConsumableItem;
    consumableQuantity?: number;
    rareConsumableType?: RareConsumableType;
    rareConsumableShots?: number;
    eventType?: SpecialEventType;
    unlocksTrident?: boolean;
    gainHereticalInsight?: boolean;
    itemLossCount?: number;
    lostItems?: { type: ConsumableItem; quantity: number }[];
    showDialogue?: boolean;
}

export interface PossibleOutcome {
    result: OutcomeResult;
    probability: number;
    conditions?: {
        hasShield?: boolean;
    };
}

export interface EncounterChoice {
    text: string;
    outcomes: PossibleOutcome[];
}

export interface Encounter {
    id: string;
    title: string;
    text: string;
    isChoice: boolean;
    choices?: EncounterChoice[];
    outcomes?: PossibleOutcome[]; // Used for non-choice encounters
    weight: number;
    minLevel?: number;
    isDynamic?: boolean;
    isScalable?: boolean;
}

export interface InGameMessage {
    id: number;
    text: string;
    createdAt: number;
    duration: number;
    style: 'default' | 'warning' | 'achievement' | 'boss';
}

export interface TrainingTarget extends GameObject {
  requiredHits: number;
  remainingHits: number;
  isComplete: boolean;
  isFailed: boolean;
  lastHitTime?: number;
}

export interface TrainingSimState {
    targets: TrainingTarget[];
    startTime: number; // When the countdown ends and the sim begins
    endTime: number;
}

export interface PlayerDebuffs {
    slow?: {
        expiresAt: number;
    };
}

// Stores player state that is temporarily removed for the training sim.
export interface StashedSimState {
    activePowerUps: GameState['activePowerUps'];
    generalUpgrades: GeneralUpgrades;
    heroUpgrades: HeroUpgrades;
    reloadBoosts: number;
    hasPermanentRapidFire: boolean;
    hasPermanentSpeedBoost: boolean;
    activeRareConsumable: GameState['activeRareConsumable'];
    ammo: number;
    maxAmmo: number;
}

export interface PhaseShiftState {
    isActive: boolean;
    activeUntil: number;
    cooldownUntil: number;
    distanceTraveledAtMaxSpeed: number;
}

// ============================================================================
// STATE SLICING (Phase 0.B)
// ============================================================================

/**
 * EngineState contains high-frequency data essential for the core game loop and simulation.
 * This data changes on nearly every frame.
 */
export interface EngineState {
  totalPauseDuration: number;
  playerX: number;
  playerY: number;
  playerVx: number;
  enemies: Enemy[];
  projectiles: Projectile[];
  enemyProjectiles: EnemyProjectile[];
  weaverBeams: WeaverBeam[];
  weaverSurges: WeaverSurge[];
  asteroids: Asteroid[];
  powerUps: PowerUp[];
  sortedRenderables: (Enemy | Asteroid | PowerUp | TrainingTarget | Boss)[];
  powerUpInfusions: PowerUpInfusionEffect[];
  activePowerUps: {
    [key in PowerUpType]?: {
      expiresAt: number;
      hp?: number;
      createdAt: number;
      lastHitTime?: number;
      lastRefillTime?: number;
      hpBeforeRefill?: number;
    };
  };
  lastTick: number;
  lastSpawnTime: number;
  lastPlayerShotTime: number;
  lastTridentShotTime: number;
  explosions: Explosion[];
  damageNumbers: DamageNumber[];
  rockImpacts: RockImpact[];
  projectileImpacts: ProjectileImpact[];
  criticalHits: CriticalHitExplosion[];
  shellCasings: ShellCasing[];
  gibs: Gib[];
  screenShake: {
    magnitude: number;
    duration: number;
    startTime: number;
  };
  screenFlashStartTime: number;
  lightning: LightningBolt | null;
  empArcs: EmpArc[];
  lastEmpFireTime: number;
  lastShieldClankTime: number;
  ammo: number;
  maxAmmo: number;
  reloadCompleteTime: number; // Timestamp when reloading finishes
  wantsToReload?: boolean;
  playedEmptyClipSound: boolean;
  selectedHero: HeroType;
  reloadBoosts: number;
  playerDebuffs: PlayerDebuffs;
  phaseShiftState: PhaseShiftState;
  upgradePartCollects: UpgradePart[];
  hasRevive: boolean;
  reviveTriggerTime: number;
  shieldBreakingUntil: number;
  playerDeathTime: number;
  playerDeathPosition: { x: number, y: number } | null;
  playerHitInvulnerableUntil: number;
  isHardMode: boolean;
  hasPermanentRapidFire: boolean;
  hasPermanentSpeedBoost: boolean;
  hasHereticalInsight: boolean;
  activeRareConsumable: {
    type: RareConsumableType;
    shotsLeft: number;
  } | null;
  encounterFightPrepareTime: number | null;
  asteroidFieldEndTime: number | null;
  trainingSimState: TrainingSimState | null;
  stashedSimState?: StashedSimState | null;
  isMontezumaActive: boolean;
  boss: Boss | null;
  wasBossHit: boolean;
  bossLasers: BossLaser[];
  touchState: {
    isActive: boolean;
    currentX: number | null;
    offsetX: number;
    identifier: number | null;
  };
  gridYOffset: number;
  isPlayerSlowed: boolean; // Cached slow state (includes debuff and ion storm)
}

/**
 * UiState contains low-frequency data, primarily for UI rendering,
 * player progression, and game settings. This data changes infrequently.
 */
export interface UiState {
  status: GameStatus;
  prePauseStatus: GameStatus | null;
  pauseStartTime?: number;
  score: number;
  highScore: number;
  level: number;
  levelStreakThisRun: number;
  enemiesDefeatedInLevel: number;
  levelUpAnnounceTime: number;
  selectedHeroForMenu: HeroType;
  // Progression and currency fields
  cumulativeScore: number;
  cumulativeLevels: number;
  unlockedHeroes: {
      beta: boolean;
      gamma:boolean;
  };
  totalCurrency: number;
  crystalite: number; // New premium currency
  ownedRevives: number;
  ownedFastReloads: number;
  ownedRapidFires: number;
  ownedSpeedBoosts: number;
  bossesDefeated: number;
  bossDefeatCount: BossDefeatCount;
  unlockedBlueprintTier: number; // Kept for compatibility, use unlockedTier2Upgrades
  unlockedTier2Upgrades: boolean;
  upgradeParts: number;
  heroUpgrades: HeroUpgrades;
  generalUpgrades: GeneralUpgrades;
  ongoingUpgrade: OngoingUpgrade | null;
  displayedStoryLevels: number[];
  trainingSimCompletions: number;
  unlocksNotified?: {
      beta?: boolean;
      gamma?: boolean;
      hangar?: boolean;
  };
  hardModeUnlocked: boolean;
  hardModePreference: boolean;
  currencyEarnedThisRun: number;
  partsEarnedThisRun: number;
  intermissionReward: { name: string } | null;
  // Story
  currentStoryMessage: { title: string; text: string; level: number; } | null;
  // Random Encounters
  currentEncounter: Encounter | null;
  pendingEncounter: Encounter | null;
  encounterOutcome: OutcomeResult | null;
  isProcessingEncounter?: boolean;
  pendingOutcomeToProcess?: OutcomeResult | null;
  postEncounterStatus: GameStatus | null;
  pendingPostFightOutcome: OutcomeResult | null;
  pendingFollowupOutcomes: PossibleOutcome[] | null;
  pendingOutcomeProcessTime: number | null;
  // In-game messages
  inGameMessages: InGameMessage[];
  seenEnemies: Set<Enemy['type'] | 'asteroid'>;
  // Settings
  controlLayout: 'right' | 'left';
  musicVolume: number;
  sfxVolume: number;
  hapticsEnabled: boolean;
  laneCount: number;
  containerSize?: {width: number, height: number};
  // In-App Purchase state
  iap: IAPState;
  // State machine transition flag
  pendingTransition?: { type: string; payload?: any };
}

export type GameState = EngineState & UiState;

export interface Consumables {
    useRevive: boolean;
    useFastReload: boolean;
    useRapidFire: boolean;
    useSpeedBoost: boolean;
}

export type GameAction =
  | { type: 'PREPARE_NEW_GAME'; payload: { consumables: Consumables; isHardMode: boolean } }
  | { type: 'START_GAME_READY'; payload: GameState }
  | { type: 'CONTINUE_GAME'; consumables: Consumables }
  | { type: 'CONTINUE_AFTER_VICTORY' }
  | { type: 'RESTART_GAME' }
  | { type: 'RETURN_TO_MENU' }
  | { type: 'EXIT_RUN_AND_SAVE' }
  | { type: 'TOGGLE_PAUSE'; timestamp: number }
  | { type: 'GO_TO_ARMORY' }
  | { type: 'GO_TO_HANGAR' }
  | { type: 'GO_TO_STORE' }
  | { type: 'SIMULATE_PURCHASE'; amount: number }
  | { type: 'INSTA_FINISH_UPGRADE'; cost: number }
  | { type: 'BUY_UPGRADE_WITH_CRYSTALITE'; target: HeroType | 'general'; upgradeKey: string }
  | { type: 'START_UPGRADE', target: HeroType | 'general', upgradeKey: string, level: number }
  | { type: 'COLLECT_UPGRADE' }
  | { type: 'RELOAD_GUN' }
  | { type: 'SELECT_HERO'; hero: HeroType }
  | { type: 'BUY_REVIVE' }
  | { type: 'BUY_FAST_RELOAD' }
  | { type: 'BUY_RAPID_FIRE' }
  | { type: 'BUY_SPEED_BOOST' }
  | { type: 'BUY_CONSUMABLE_WITH_CRYSTALITE'; item: ConsumableItem }
  | { type: 'DISMISS_STORY' }
  | { type: 'DISMISS_ENCOUNTER_OUTCOME' }
  | { type: 'CHOOSE_ENCOUNTER_OPTION'; choiceOutcomes: PossibleOutcome[] }
  | { type: 'FINISH_ENCOUNTER_PROCESSING' }
  | { type: 'TOGGLE_CONTROL_LAYOUT' }
  | { type: 'TOGGLE_HAPTICS' }
  | { type: 'SET_VOLUME'; volumeType: 'music' | 'sfx'; level: number }
  | { type: 'SET_HARD_MODE_PREFERENCE'; value: boolean }
  | { type: 'TOUCH_START'; x: number; identifier: number }
  | { type: 'TOUCH_MOVE'; x: number; identifier: number }
  | { type: 'TOUCH_END'; identifier: number }
  | { type: 'GAME_TICK'; delta: number; timestamp: number; pressedKeys: Set<string>; containerSize?: {width: number, height: number} }
  | { type: 'UPDATE_GRID_OFFSET'; delta: number }
  // In-App Purchase actions
  | { type: 'INITIATE_PURCHASE'; productId: IAPProductId }
  | { type: 'PURCHASE_INITIATED'; productId: IAPProductId }
  | { type: 'PURCHASE_COMPLETED'; receipt: PurchaseReceipt; amount: number }
  | { type: 'PURCHASE_FAILED'; error: PurchaseError; productId: IAPProductId }
  | { type: 'PURCHASE_VALIDATION_STARTED'; receipt: PurchaseReceipt }
  | { type: 'PURCHASE_VALIDATION_COMPLETED'; result: PurchaseValidationResult }
  | { type: 'PURCHASE_VALIDATION_FAILED'; error: PurchaseError; receipt: PurchaseReceipt }
  | { type: 'RESTORE_PURCHASES_STARTED' }
  | { type: 'RESTORE_PURCHASES_COMPLETED'; receipts: PurchaseReceipt[] }
  | { type: 'RESTORE_PURCHASES_FAILED'; error: PurchaseError }
  | { type: 'IAP_AVAILABILITY_CHANGED'; isAvailable: boolean; canMakePayments: boolean }
  | { type: 'CLEAR_PURCHASE_ERROR' }
  | { type: 'CLEAR_PURCHASE_STATE' };

export interface UpgradeConfig {
    currency: number;
    parts: number;
    time: number; // in milliseconds
    effect: number;
    critChanceBonus?: number;
}

// ============================================================================
// IN-APP PURCHASE TYPES AND INTERFACES
// ============================================================================

export type IAPProductId = 'com.galaxia.crystalite_100' | 'com.galaxia.crystalite_550' | 'com.galaxia.crystalite_1200' | 'com.galaxia.crystalite_2500' | 'com.galaxia.crystalite_7000' | 'com.galaxia.crystalite_15000';

export type PurchaseState = 'idle' | 'initiating' | 'purchasing' | 'validating' | 'success' | 'failed' | 'restoring';

export type PurchaseErrorType = 
    | 'user_cancelled'
    | 'network_error'
    | 'validation_failed'
    | 'server_error'
    | 'insufficient_funds'
    | 'product_unavailable'
    | 'receipt_invalid'
    | 'duplicate_purchase'
    | 'unknown';

export interface PurchaseError {
    type: PurchaseErrorType;
    message: string;
    code?: string;
    details?: any;
}

export interface PurchaseReceipt {
    transactionId: string;
    productId: IAPProductId;
    purchaseDate: string;
    originalTransactionId?: string;
    // Platform-specific receipt data
    iosReceipt?: string;
    androidReceipt?: string;
}

export interface PurchaseValidationResult {
    isValid: boolean;
    transactionId: string;
    productId: IAPProductId;
    amount: number;
    timestamp: number;
    error?: PurchaseError;
}

export interface PendingPurchase {
    id: string;
    productId: IAPProductId;
    amount: number;
    initiatedAt: number;
    receipt?: PurchaseReceipt;
    attempts: number;
    lastAttemptAt: number;
}

export interface PurchaseHistoryEntry {
    id: string;
    productId: IAPProductId;
    amount: number;
    completedAt: number;
    transactionId: string;
    platform: 'ios' | 'android' | 'unknown';
}

// Native bridge interface for mobile apps
export interface NativePurchaseBridge {
    initiatePurchase: (productId: IAPProductId) => Promise<PurchaseReceipt>;
    restorePurchases: () => Promise<PurchaseReceipt[]>;
    canMakePayments: () => Promise<boolean>;
    getAvailableProducts: () => Promise<IAPProductId[]>;
}

// Backend validation interface
export interface PurchaseValidationRequest {
    receipt: PurchaseReceipt;
    platform: 'ios' | 'android';
    userId?: string; // For user-specific validation
} 

export interface PurchaseValidationResponse {
    success: boolean;
    isValid: boolean;
    amount: number;
    error?: string;
    timestamp: number;
}

// IAP State for the game
export interface IAPState {
    currentPurchase: {
        state: PurchaseState;
        productId: IAPProductId | null;
        error: PurchaseError | null;
        progress: number; // 0-100 for UI progress bars
    };
    pendingPurchases: PendingPurchase[];
    purchaseHistory: PurchaseHistoryEntry[];
    lastRestoreAttempt: number | null;
    isAvailable: boolean;
    canMakePayments: boolean;
}
