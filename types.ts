

export interface GameObject {
  id: number;
  x: number; // Position from the left
  y: number; // Position from the top (depth)
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
  isEncounterEnemy?: boolean;
  // Weaver properties
  isPausing?: boolean;
  pauseEndTime?: number;
  diveTargetY?: number;
  lastBeamTime?: number;
  // Buff/debuff properties
  isBuffedByConduit?: boolean;
  shieldHealth?: number;
  shieldRegenTime?: number;
  // Conduit properties
  linkedEnemyId?: number | null;
  // Visual effect properties
  lastHitTime?: number;
}

export interface Projectile extends GameObject {
  angle?: number;
  isTridentCluster?: boolean;
}
export interface EnemyProjectile extends GameObject {}

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
    isCrit: boolean;
    createdAt: number;
    initialDriftX: number;
}

export interface RockImpact {
  id: number;
  x: number;
  y: number;
  createdAt: number;
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
    createdAt: number;
}

export interface EmpArc {
    id: number;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    createdAt: number;
}

export interface WeaverBeam {
  id: number;
  y: number; // Position from the top
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
  Playing,
  PlayerDying,
  GameOver,
  BossBattle,
  Intermission,
  Story,
  Paused,
  RandomEncounter,
  EncounterProcessing,
  EncounterOutcome,
  AsteroidField,
  BlueprintUnlock,
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

export type SpecialEventType = 'asteroid_field_survival' | 'training_sim_challenge' | 'montezuma_encounter';

export interface OutcomeResult {
    type: 'gain_items' | 'lose_all_items' | 'fight' | 'trade' | 'level_skip' | 'damage_ship' | 'nothing' | 'dialogue_reward' | 'fight_reward' | 'gain_consumables' | 'special_event';
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
    fightPreset?: 'heretic_antibodies' | 'heretic_ship';
    title: string;
    text: string;
    followupOutcomes?: PossibleOutcome[];
    consumableType?: ConsumableItem;
    consumableQuantity?: number;
    eventType?: SpecialEventType;
    unlocksTrident?: boolean;
    gainHereticalInsight?: boolean;
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

export interface GameState {
  status: GameStatus;
  prePauseStatus: GameStatus | null;
  pauseStartTime?: number;
  playerX: number;
  playerVx: number;
  enemies: Enemy[];
  projectiles: Projectile[];
  enemyProjectiles: EnemyProjectile[];
  weaverBeams: WeaverBeam[];
  asteroids: Asteroid[];
  powerUps: PowerUp[];
  powerUpInfusions: PowerUpInfusionEffect[];
  activePowerUps: {
    [key in PowerUpType]?: { expiresAt: number; hp?: number; };
  };
  score: number;
  highScore: number;
  lastTick: number;
  gameTime: number;
  lastSpawnTime: number;
  lastPlayerShotTime: number;
  lastTridentShotTime: number;
  explosions: Explosion[];
  damageNumbers: DamageNumber[];
  rockImpacts: RockImpact[];
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
  ammo: number;
  maxAmmo: number;
  reloadCompleteTime: number; // Timestamp when reloading finishes
  playedEmptyClipSound: boolean;
  level: number;
  levelStreakThisRun: number;
  enemiesDefeatedInLevel: number;
  levelUpAnnounceTime: number;
  selectedHero: HeroType;
  selectedHeroForMenu: HeroType;
  reloadBoosts: number;
  
  // Progression and currency fields
  cumulativeScore: number;
  cumulativeLevels: number;
  unlockedHeroes: {
      beta: boolean;
      gamma:boolean;
  };
  totalCurrency: number;
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

  currencyEarnedThisRun: number;
  partsEarnedThisRun: number;
  upgradePartCollects: UpgradePart[];

  hasRevive: boolean;
  reviveTriggerTime: number;
  shieldBreakingUntil: number;
  intermissionReward: { name: string } | null;
  playerDeathTime: number;
  playerDeathPosition: { x: number, y: number } | null;

  isHardMode: boolean;

  // In-run permanent boosts
  hasPermanentRapidFire: boolean;
  hasPermanentSpeedBoost: boolean;
  hasHereticalInsight: boolean;

  // Story
  currentStoryMessage: { title: string; text: string; level: number; } | null;

  // Random Encounters
  currentEncounter: Encounter | null;
  pendingEncounter: Encounter | null;
  encounterOutcome: OutcomeResult | null;
  encounterProcessingCompleteTime: number | null;
  encounterFightPrepareTime: number | null;
  postEncounterStatus: GameStatus | null;
  pendingPostFightOutcome: OutcomeResult | null;
  pendingFollowupOutcomes: PossibleOutcome[] | null;
  asteroidFieldEndTime: number | null;
  pendingOutcomeProcessTime: number | null;
  trainingSimState: TrainingSimState | null;
  isMontezumaActive: boolean;

  // Boss state
  boss: Boss | null;
  wasBossHit: boolean;
  bossLasers: BossLaser[];

  // In-game messages
  inGameMessages: InGameMessage[];
  seenEnemies: Set<Enemy['type'] | 'asteroid'>;
  controlLayout: 'right' | 'left';
  touchState: {
    isActive: boolean;
    currentX: number | null;
    offsetX: number;
  };
}

export interface Consumables {
    useRevive: boolean;
    useFastReload: boolean;
    useRapidFire: boolean;
    useSpeedBoost: boolean;
}

export type GameAction =
  | { type: 'START_GAME'; consumables: Consumables; isHardMode: boolean }
  | { type: 'CONTINUE_GAME'; consumables: Consumables }
  | { type: 'RESTART_GAME' }
  | { type: 'RETURN_TO_MENU' }
  | { type: 'TOGGLE_PAUSE'; timestamp: number }
  | { type: 'GO_TO_ARMORY' }
  | { type: 'GO_TO_HANGAR' }
  | { type: 'START_UPGRADE', target: HeroType | 'general', upgradeKey: string, level: number }
  | { type: 'COLLECT_UPGRADE' }
  | { type: 'RELOAD_GUN' }
  | { type: 'SELECT_HERO'; hero: HeroType }
  | { type: 'BUY_REVIVE' }
  | { type: 'BUY_FAST_RELOAD' }
  | { type: 'BUY_RAPID_FIRE' }
  | { type: 'BUY_SPEED_BOOST' }
  | { type: 'DISMISS_STORY' }
  | { type: 'DISMISS_BLUEPRINT_UNLOCK' }
  | { type: 'DISMISS_ENCOUNTER_OUTCOME' }
  | { type: 'CHOOSE_ENCOUNTER_OPTION'; choiceOutcomes: PossibleOutcome[] }
  | { type: 'TOGGLE_CONTROL_LAYOUT' }
  | { type: 'TOUCH_START'; x: number }
  | { type: 'TOUCH_MOVE'; x: number }
  | { type: 'TOUCH_END' }
  | { type: 'GAME_TICK'; timestamp: number; pressedKeys: Set<string> };

export interface UpgradeConfig {
    currency: number;
    parts: number;
    time: number; // in milliseconds
    effect: number;
    critChanceBonus?: number;
}
