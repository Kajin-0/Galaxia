import type { UpgradeConfig, GeneralUpgradeKey, Encounter } from './types';

export const LANE_COUNT = 5;
export const GAME_HEIGHT = 800;
export const GAME_WIDTH = 500;

export const PLAYER_Y_POSITION = GAME_HEIGHT - 60;
export const PLAYER_HITBOX_MAIN_RADIUS = 20;
export const PLAYER_HITBOX_MAIN_Y_OFFSET = 55; // from top of sprite
export const PLAYER_HITBOX_NOSE_RADIUS = 15;
export const PLAYER_HITBOX_NOSE_Y_OFFSET = 20; // from top of sprite
export const PLAYER_MAX_SPEED = 450; // pixels per second
export const PLAYER_ACCELERATION = 2000; // pixels per second^2
export const PLAYER_FRICTION = 8; // A coefficient for slowing down. Higher is more friction.
export const PLAYER_WIDTH = 60; // Approximate width for boundary checks
export const PLAYER_DEATH_ANIMATION_DURATION = 2000; // ms
export const PLAYER_DEATH_EXPLOSION_COUNT = 8;
export const PLAYER_DEATH_EXPLOSION_INTERVAL = 200; // ms

export const PLAYER_INITIAL_AMMO = 30;
export const RELOAD_TIME = 1500; // ms
export const EXTENDED_MAG_SIZE = 60;
export const RELOAD_TIME_REDUCTION_PER_STACK = 0.1; // 10% reduction per stack
export const RELOAD_TIME_REDUCTION_MAX = 0.75; // Cap at 75% reduction

export const PROJECTILE_SPEED = 1000; // pixels per second
export const PROJECTILE_HEIGHT = 30;
export const PROJECTILE_HITBOX_RADIUS = 5;
export const PROJECTILE_COLOR_DEFAULT = '#f97316'; // orange-500
export const PROJECTILE_COLOR_RAPID_FIRE = '#ef4444'; // red-500
export const PROJECTILE_COLOR_SPREAD_SHOT = '#a855f7'; // purple-500
export const PLAYER_PROJECTILE_DAMAGE_MIN = 100;
export const PLAYER_PROJECTILE_DAMAGE_MAX = 150;


export const ENEMY_SPEED = 150; // pixels per second
export const ENEMY_HEIGHT = 40;
export const ENEMY_WIDTH = 50;
export const ENEMY_HITBOX_RADIUS = 25;

export const ENEMY_PROJECTILE_SPEED = 400; // pixels per second
export const ENEMY_PROJECTILE_HEIGHT = 15;
export const ENEMY_PROJECTILE_WIDTH = 15;
export const ENEMY_PROJECTILE_HITBOX_RADIUS = 8;

export const INITIAL_SPAWN_INTERVAL = 1200; // ms
export const SPAWN_INTERVAL_MIN = 350; // ms
export const SPAWN_RAMP_UP_TIME = 60000; // 60 seconds to reach max spawn rate

export const SCORE_PER_HIT = 100;
export const CURRENCY_PER_KILL = 15;
export const CURRENCY_STREAK_BONUS_PER_LEVEL = 0.05; // 5% bonus per consecutive level

export const PLAYER_AUTOSHOOT_INTERVAL = 180; // ms between shots
export const TRIDENT_SHOT_INTERVAL = 360; // ms between shots for the side-cannons
export const TRIDENT_SHOT_INTERVAL_L2 = 240; // ms for level 2 trident shot
export const TRIDENT_DRONE_OFFSET_X = 40; // pixels from player center
export const TRIDENT_DRONE_OFFSET_Y = 48; // pixels below player top (y-position)
export const RAPID_FIRE_AUTOSHOOT_INTERVAL = 90; // ms for rapid fire powerup
export const SPREAD_SHOT_OFFSET = 50; // pixels from center for spread shots

export const ENEMY_SHOOT_INTERVAL = 1800; // ms average
export const ENEMY_SHOOT_JITTER = 800; // ms random variance

// Dodger enemy constants
export const DODGER_SPAWN_START_LEVEL = 21; // Appears in normal levels after first Punisher is defeated.
export const DODGER_SPAWN_CHANCE_INITIAL = 0.05; // 5% initial chance
export const DODGER_SPAWN_CHANCE_MAX = 0.40;     // 40% max chance
export const DODGER_SPAWN_CHANCE_RAMP_LEVELS = 20; // Levels to reach max chance
export const DODGER_DODGE_SPEED = 800; // pixels per second
export const DODGER_DODGE_COOLDOWN = 500; // ms

// Conduit enemy constants
export const CONDUIT_SPAWN_START_LEVEL = 60; // Appears after level 60.
export const CONDUIT_SPAWN_CHANCE_INITIAL = 0.15; // 15% initial chance
export const CONDUIT_SPAWN_CHANCE_MAX = 0.35; // 35% max chance
export const CONDUIT_SPAWN_CHANCE_RAMP_LEVELS = 30; // Levels to reach max chance (i.e., by level 90)
export const CONDUIT_MAX_ACTIVE = 2; // Maximum number of conduits allowed on screen at once.
export const CONDUIT_HEALTH = 300; // Takes 3 hits at base
export const CONDUIT_HEALTH_SCALING_INTERVAL = 10; // Gains health every 10 levels
export const CONDUIT_HEALTH_SCALING_AMOUNT = 100; // Gains 1 extra hit worth of health
export const CONDUIT_SPEED_Y = 40; // Moves slowly
export const CONDUIT_BUFF_ASTEROID_REPAIR_RATE = 250; // Health per second
export const CONDUIT_BUFF_SHIELD_REGEN_TIME = 5000; // 5 seconds to regen shield

// Weaver enemy constants
export const WEAVER_SPAWN_START_LEVEL = 31;
export const WEAVER_SPAWN_CHANCE_INITIAL = 0.05;
export const WEAVER_SPAWN_CHANCE_MAX = 0.30;
export const WEAVER_SPAWN_CHANCE_RAMP_LEVELS = 20;
export const WEAVER_HEALTH = 200; // 2 hits
export const WEAVER_DIVE_SPEED = 500; // pixels per second
export const WEAVER_PAUSE_DURATION = 1500; // ms to pause and shoot
export const WEAVER_BEAM_INTERVAL = 2000; // ms between beams for a single weaver
export const WEAVER_BEAM_DURATION = 1000; // ms the beam stays on screen
export const WEAVER_BEAM_HITBOX_HEIGHT = 8; // pixels

// Asteroid constants
export const ASTEROID_SPAWN_UNLOCK_LEVEL = 11; // Appear after first Warden is defeated.
export const ASTEROID_SPAWN_CHANCE = 0.035; // 3.5% chance per spawn tick
export const ASTEROID_BASE_SPEED_Y = 80; // pixels per second
export const ASTEROID_ROCK_COLORS = ['#969696', '#828282', '#6e6e6e', '#5a5a5a'];
export const ASTEROID_GIB_COUNT_MULTIPLIER = 0.5; // Half a normal enemy's gibs, per unit of radius
export const ASTEROID_SIZES = {
  small: { health: 500, radius: 30, score: 250, currency: 50, partChance: 0.10, spawnWeight: 6 },
  medium: { health: 1500, radius: 50, score: 750, currency: 150, partChance: 0.30, spawnWeight: 3 },
  large: { health: 4000, radius: 80, score: 2000, currency: 400, partChance: 1.0, spawnWeight: 1 },
};
export const ASTEROID_TOTAL_SPAWN_WEIGHT = Object.values(ASTEROID_SIZES).reduce((sum, size) => sum + size.spawnWeight, 0);

// Asteroid Field Encounter Constants
export const ASTEROID_FIELD_DURATION = 25000; // 25 seconds
export const ASTEROID_FIELD_BASE_SPAWN_INTERVAL = 400; // ms
export const ASTEROID_FIELD_SURVIVAL_REWARD_CURRENCY = 1500;
export const ASTEROID_FIELD_SURVIVAL_REWARD_PARTS = 2;

// Montezuma Boss Asteroid Constants
export const MONTEZUMA_INITIAL_HEALTH = 500000;
export const MONTEZUMA_SPEED_Y = 20; // Very slow
export const MONTEZUMA_REWARD_CURRENCY = 100000;
export const MONTEZUMA_REWARD_PARTS = 50;


// Power-up constants
export const POWERUP_SPAWN_CHANCE_ON_ENEMY_DEATH = 0.20; // 20% chance
export const POWERUP_SPEED = 120; // pixels per second
export const POWERUP_DURATION = 8000; // 8 seconds
export const POWERUP_HITBOX_RADIUS = 20;
export const POWERUP_INFUSION_DURATION = 600; // ms
export const CRIT_BOOST_MODIFIER = 2.5; // Multiplier for crit chance
export const SHIELD_BREAK_ANIMATION_DURATION = 500; // ms
export const GRAVITON_COLLECTOR_PULL_STRENGTH = 400; // pixels per second

// Critical Hit constants
export const CRITICAL_HIT_CHANCE = 0.15; // 15% chance
export const CRITICAL_HIT_DAMAGE_MULTIPLIER = 2.5; // Damage multiplier
export const CRITICAL_HIT_RADIUS = 120; // pixels
export const CRITICAL_HIT_DURATION = 400; // ms

// Shell casing constants
export const SHELL_GRAVITY = 980; // pixels/s^2
export const SHELL_EJECT_SPEED_X = 150; // pixels/s
export const SHELL_EJECT_SPEED_Y = -250; // pixels/s (upwards)
export const SHELL_LIFETIME = 1500; // ms

// Gib constants (enemy death particles)
export const GIB_COUNT = 15;
export const GIB_LIFETIME = 1800; // ms
export const GIB_GRAVITY = 600; // pixels/s^2
export const GIB_INITIAL_SPEED_MIN = 200;
export const GIB_INITIAL_SPEED_MAX = 500;
export const GIB_COLORS_FLESH = ['#880808', '#dc2626', '#7f1d1d', '#450a0a']; // Various shades of blood red
export const PLAYER_GIB_COLORS = ['#67e8f9', '#22d3ee', '#0891b2', '#155e75']; // Shades of cyan/blue

// Screen shake constants
export const SCREEN_SHAKE_DURATION_EXPLOSION = 300; // ms
export const SCREEN_SHAKE_MAGNITUDE_EXPLOSION = 8; // pixels
export const SCREEN_SHAKE_DURATION_BOSS_DEATH = 1500; // ms
export const SCREEN_SHAKE_MAGNITUDE_BOSS_DEATH = 15; // pixels

// Screen flash on explosion
export const SCREEN_FLASH_DURATION = 200; // ms

// Background lightning effect
export const LIGHTNING_DURATION = 200; // ms
export const LIGHTNING_WIDTH = 4; // px
export const LIGHTNING_COLOR = 'rgba(255, 255, 255, 0.9)';
export const LIGHTNING_GLOW = '0 0 8px #fff, 0 0 15px #fff, 0 0 30px #0ff, 0 0 45px #0ff';
export const LIGHTNING_BG_FLASH_OPACITY = 0.3;

// Damage number constants
export const DAMAGE_NUMBER_LIFETIME = 1000; // ms

// Leveling constants
export const ENEMIES_PER_LEVEL = 20;
export const LEVEL_UP_ANNOUNCE_DURATION = 2000; // ms
export const BOSS_LEVEL_INTERVAL = 10;

// Boss constants
export const BOSS_HEALTH_THRESHOLDS = [0.75, 0.5, 0.25]; // Health percentages for difficulty increase
export const BOSS_ENTER_DURATION = 3000; // ms
export const BOSS_DEFEATED_DURATION = 4000; // ms
export const BOSS_HIT_SCORE = 50;
export const BOSS_DEFEAT_SCORE = 10000;
export const BOSS_DEFEAT_CURRENCY = 1000;
export const BOSS_DEATH_EXPLOSION_COUNT = 30;

// Warden (Boss 1) constants
export const WARDEN_INITIAL_HEALTH = 8000;
export const WARDEN_WIDTH = 150;
export const WARDEN_HEIGHT = 120;
export const WARDEN_Y_POSITION = 100;
export const WARDEN_ATTACK_INTERVAL_BARRAGE = 500; // ms
export const WARDEN_ATTACK_INTERVAL_SWEEP = 2500; // ms
export const WARDEN_BARRAGE_DURATION = 5000;
export const WARDEN_SWEEP_DURATION = 8000; // Increased to accommodate more waves
export const WARDEN_INITIAL_SWEEP_SAFE_LANES = 2;
export const WARDEN_SPAWN_MINION_DURATION = 5000; // ms
export const WARDEN_SPAWN_MINION_COUNT = 2;

// Punisher (Boss 2) constants
export const PUNISHER_INITIAL_HEALTH = 13000;
export const PUNISHER_WIDTH = 180;
export const PUNISHER_HEIGHT = 140;
export const PUNISHER_Y_POSITION = 110;
export const PUNISHER_ATTACK_INTERVAL_BARRAGE = 250;
export const PUNISHER_ATTACK_SPAWN_MINION_COUNT = 4;
export const PUNISHER_BARRAGE_DURATION = 4000; // ms
export const PUNISHER_SPAWN_MINION_DURATION = 5000; // ms
export const PUNISHER_LASER_PATTERN_DURATION = 3000; //ms
export const PUNISHER_LASER_CHARGE_TIME = 1200; // ms
export const PUNISHER_LASER_FIRE_TIME = 1000; // ms
export const PUNISHER_LASER_LANE_WIDTH_PERCENT = 0.2; // 20% of game width

// Overmind (Final Boss) constants
export const OVERMIND_INITIAL_HEALTH = 120000;
export const OVERMIND_WIDTH = 250;
export const OVERMIND_HEIGHT = 200;
export const OVERMIND_Y_POSITION = 150;
export const OVERMIND_PHASE_2_THRESHOLD = 0.66;
export const OVERMIND_FRAGMENT_COUNT = 12;
export const OVERMIND_FURY_BARRAGE_INTERVAL = 120;
export const OVERMIND_BEAM_CHARGE_TIME = 2000;
export const OVERMIND_BEAM_FIRE_TIME = 2000;
export const OVERMIND_BEAM_SAFE_ZONE_WIDTH = 100;

// Boss Encounter Scaling (difficulty increases each time you fight the same boss)
export const BOSS_ENCOUNTER_DIFFICULTY_CAP = 10;
export const BOSS_HEALTH_SCALING_BASE_RATE = 0.25; // Base 25% health increase per encounter
export const BOSS_HEALTH_SCALING_QUADRATIC_RATE = 0.1; // Add a squared term for exponential feel
export const BOSS_HEALTH_SCALING_CAP = 5.0; // Max 500% base health
export const BOSS_ATTACK_SPEED_SCALING_RATE = 0.90; // 10% faster attacks per encounter
export const BOSS_ATTACK_SPEED_SCALING_CAP = 0.35; // Interval won't drop below 35% of base
export const PUNISHER_MINION_SCALING_ADD = 2; // +2 minions per encounter
export const PUNISHER_MINION_SCALING_CAP = 8; // Max 8 base minions
export const WARDEN_SWEEP_BASE_WAVE_COUNT = 3;
export const WARDEN_SWEEP_WAVE_COUNT_SCALING_ADD = 1; // +1 wave per encounter
export const WARDEN_SWEEP_WAVE_COUNT_SCALING_CAP = 8;
export const WARDEN_SWEEP_BASE_WAVE_INTERVAL = 800; // ms
export const WARDEN_SWEEP_WAVE_INTERVAL_SCALING_RATE = 0.95; // 5% faster per encounter
export const WARDEN_SWEEP_WAVE_INTERVAL_SCALING_CAP = 350; // ms minimum
export const WARDEN_MINION_SCALING_ADD = 2; // +2 minions per encounter
export const WARDEN_MINION_SCALING_CAP = 6;

// Perk & Leveling constants
export const SHIELD_CHANCE_ON_LEVEL_UP_BASE = 0.15; // 15% base chance

// Alpha Hero Perk
export const ALPHA_CRIT_CHANCE_BONUS = 0.05; // +5% crit chance

// Beta Hero Perk
export const BETA_ACCELERATION_MODIFIER = 1.2; // 20% faster acceleration
export const BETA_FRICTION_MODIFIER = 1.2; // 20% more friction

// Gamma Hero Perk
export const GAMMA_SHIELD_CHANCE_BONUS = 0.25; // +25% shield chance on level up (total 40%)
export const GAMMA_EMP_L2_CHANCE = 0.45;
export const GAMMA_EMP_L2_RANGE = 250;
export const GAMMA_EMP_L2_COOLDOWN = 1000;
export const GAMMA_EMP_L3_CHANCE = 0.65;
export const GAMMA_EMP_L3_RANGE = 350;
export const GAMMA_EMP_L3_COOLDOWN = 600;
export const GAMMA_EMP_DAMAGE = 500;
export const EMP_ARC_DURATION = 150; // ms

// Hero Unlock Requirements
export const BETA_UNLOCK_LEVELS = 30;
export const GAMMA_UNLOCK_SCORE = 200000;

// Currency and Consumables
export const REVIVE_COST = 5000;
export const FAST_RELOAD_COST = 2500;
export const RAPID_FIRE_COST = 7500;
export const SPEED_BOOST_COST = 6000;

export const FAST_RELOAD_STACKS = 2; // Start with 2 stacks of reload boost
export const SPEED_BOOST_MODIFIER = 1.25; // 25% boost to speed and acceleration

export const REVIVE_INVULNERABILITY_DURATION = 3000; // ms

// Hangar and Upgrades
export const UPGRADE_PART_DROP_CHANCE_ENEMY = 0.005; // 0.5%
export const UPGRADE_PART_DROP_CHANCE_BOSS = 0.5;   // 50%
export const UPGRADE_PART_REWARD_BOSS = 2;
export const UPGRADE_PART_ANIMATION_DURATION = 1500; // ms
export const TIER_2_UNLOCK_LEVEL_STREAK = 42;

export const HANGAR_ALPHA_UPGRADE_CONFIG: UpgradeConfig[] = [
    { currency: 25000, parts: 5, time: 300000, effect: 0.30, critChanceBonus: 0.15 },  // L1: 5 min
    { currency: 75000, parts: 15, time: 1200000, effect: 0.45, critChanceBonus: 0.30 }, // L2: 20 min
    { currency: 200000, parts: 30, time: 2700000, effect: 0.60, critChanceBonus: 0.50 },// L3: 45 min
];

export const HANGAR_BETA_UPGRADE_CONFIG: UpgradeConfig[] = [
    { currency: 30000, parts: 5, time: 300000, effect: 0.20 },   // L1: 5 min
    { currency: 90000, parts: 15, time: 1200000, effect: 0.25 }, // L2: 20 min
    { currency: 250000, parts: 30, time: 2700000, effect: 0.30 },// L3: 45 min
];
export const BETA_HOMING_MAX_SPEED = 600; // pixels per second for homing adjustment

export const HANGAR_GAMMA_UPGRADE_CONFIG: UpgradeConfig[] = [
    { currency: 20000, parts: 5, time: 300000, effect: 2 },    // L1: 5 min
    { currency: 60000, parts: 15, time: 1200000, effect: 2 },  // L2: 20 min
    { currency: 180000, parts: 30, time: 2700000, effect: 3 }, // L3: 45 min
];

export const HANGAR_GENERAL_UPGRADE_CONFIG: Record<GeneralUpgradeKey, UpgradeConfig[]> = {
    movement_speed_level: [
        { currency: 15000, parts: 8, time: 300000, effect: 0.05 },    // L1: 5 min
        { currency: 45000, parts: 20, time: 900000, effect: 0.10 },   // L2: 15 min
        { currency: 120000, parts: 40, time: 1800000, effect: 0.15 }, // L3: 30 min
        { currency: 300000, parts: 80, time: 5400000, effect: 0.20 }, // L4: 90 min (TIER 2)
        { currency: 650000, parts: 160, time: 10800000, effect: 0.25 },// L5: 3h (TIER 2)
        { currency: 1300000, parts: 320, time: 32400000, effect: 0.30 },// L6: 9h (TIER 2)
    ],
    reload_speed_level: [
        { currency: 10000, parts: 5, time: 300000, effect: 0.10 },     // L1: 5 min
        { currency: 30000, parts: 15, time: 900000, effect: 0.20 },    // L2: 15 min
        { currency: 90000, parts: 35, time: 1800000, effect: 0.30 },  // L3: 30 min
        { currency: 275000, parts: 75, time: 5400000, effect: 0.40 }, // L4: 90 min (TIER 2)
        { currency: 825000, parts: 150, time: 10800000, effect: 0.50 },// L5: 3h (TIER 2)
        { currency: 2500000, parts: 300, time: 32400000, effect: 0.60 },// L6: 9h (TIER 2)
    ],
    ammo_capacity_level: [
        { currency: 20000, parts: 10, time: 450000, effect: 10 },      // L1: 7.5 min
        { currency: 60000, parts: 25, time: 1350000, effect: 20 },     // L2: 22.5 min
        { currency: 150000, parts: 50, time: 2700000, effect: 30 },   // L3: 45 min
        { currency: 350000, parts: 100, time: 7200000, effect: 50 },  // L4: 120 min (TIER 2)
        { currency: 750000, parts: 200, time: 18000000, effect: 70 }, // L5: 5h (TIER 2)
        { currency: 1700000, parts: 400, time: 45000000, effect: 100 },// L6: 12.5h (TIER 2)
    ],
    trident_shot_level: [
        { currency: 100000, parts: 25, time: 3600000, effect: 1 },    // L1: 60 min - Unlock
        { currency: 150000, parts: 30, time: 5400000, effect: 2 },   // L2: 90 min - Faster Side Cannons
        { currency: 400000, parts: 75, time: 10800000, effect: 3 }, // L3: 3h - Primary Cannon Cluster Shot
    ],
    graviton_collector_level: [
        { currency: 75000, parts: 20, time: 1800000, effect: 1 }, // L1: 30 min - Unlock
    ],
};

// Story Mode Milestones
export const STORY_MILESTONES = [
    { level: 1, title: "Mission Briefing", text: "Pilot, you are our last hope. The alien armada has shattered our defenses.\n\nYour mission: break through their lines and reach the Orion Nebula rendezvous point. Good luck." },
    { level: 10, title: "Command Ship Detected", text: "That's a Warden-class command ship! It's coordinating their fleet in this sector.\n\nTaking it down will throw their forces into disarray. Hit it with everything you've got!" },
    { level: 20, title: "High-Threat Signature", text: "Intel reports a new high-threat signature... a Punisher-class assault platform.\n\nThis thing is a walking fortress armed with overwhelming firepower. Stay sharp, pilot. This is a whole new level of dangerous." },
    { level: 25, title: "A Glimmer of Hope", text: "Is that... a friendly signal? It's weak, but it's there! Other survivors might be out here.\n\nKeep pushing forward, pilot. You're not alone." },
    { level: 50, title: "Through the Fire", text: "You've punched through their main blockade! The enemy's grip is weakening.\n\nThe path to Orion is clearer, but they're getting desperate. Expect heavier resistance." },
    { level: 75, title: "The Final Push", text: "That's the edge of the Orion Nebula on long-range scanners! You're almost there.\n\nThe enemy is throwing everything they have left at you. Don't let them stop you now!" },
    { level: 100, title: "The Source", text: "That's... the heart of the invasion. A biomechanical consciousness of immense power. The Overmind.\n\nIf you can destroy it, you might just end this war for good. No holding back." }
];

// Training Sim Encounter
export const TRAINING_SIM_COUNTDOWN_DURATION = 3000; // ms
export const TRAINING_SIM_DURATION = 20000; // 20 seconds
export const TRAINING_SIM_BASE_TARGET_COUNT = 5;
export const TRAINING_SIM_BASE_HITS_MIN = 2;
export const TRAINING_SIM_BASE_HITS_MAX = 4;
export const TRAINING_SIM_BASE_REWARD_PER_TARGET = 400;
export const TRAINING_TARGET_HIT_COOLDOWN = 200; // ms

// Random Encounters
export const ENCOUNTER_CHANCE_ON_LEVEL_UP = 0.12; // 12% chance for an encounter on level up.
export const ENCOUNTERS: Encounter[] = [
    {
        id: 'derelict_freighter',
        title: 'Derelict Freighter',
        text: "Your sensors pick up a faint transponder signal from a massive, silent cargo ship. It's scarred by battle, but the cargo hold seems intact. Do you board it?",
        isChoice: false,
        outcomes: [
            {
                probability: 0.7,
                result: { type: 'gain_items', partsRange: [3, 6], currencyRange: [1500, 2500], title: "Treasure Trove!", text: "The hold is full of abandoned supplies! You manage to recover a haul of valuable resources." }
            },
            {
                probability: 0.2,
                result: { 
                    type: 'fight', 
                    fightEnemyCount: 4, 
                    fightEnemyType: 'standard', 
                    title: "It's a Trap!", 
                    text: "The ship wasn't abandoned! Scavengers emerge from the shadows. Defend yourself!",
                    followupOutcomes: [
                        {
                            probability: 1,
                            result: {
                                type: 'fight_reward',
                                currencyRange: [800, 1200],
                                partsRange: [0, 2],
                                title: 'Scavengers Neutralized',
                                text: 'You defeat the scavengers and help yourself to their loot.'
                            }
                        }
                    ]
                }
            },
            {
                probability: 0.1,
                result: { type: 'damage_ship', title: "Structural Collapse!", text: "As you approach, the ship's reactor goes critical! You escape the blast, but your ship takes damage, forcing some automatic repairs.", currency: -1500 }
            }
        ],
        weight: 2,
    },
    {
        id: 'stowaway_thief',
        title: 'Unwanted Passenger',
        text: "A sudden alarm blares. A stowaway has been hiding in the service ducts! They're making a run for your pre-flight consumables.",
        isChoice: false,
        outcomes: [
            // --- Outcomes if player HAS a shield ---
            {
                probability: 0.9, // 90% chance
                conditions: { hasShield: true },
                result: { type: 'nothing', title: "Stowaway Caught!", text: "Your active shield emissions tripped the proximity alarm early. You corner the thief before they can steal anything." }
            },
            {
                probability: 0.1, // 10% chance
                conditions: { hasShield: true },
                result: { type: 'dialogue_reward', currencyRange: [2500, 3500], title: "A Desperate Refugee", text: "You find the 'thief' is just a scared refugee. They offer you their life savings for safe passage." }
            },
            // --- Outcomes if player DOES NOT have a shield ---
            {
                probability: 0.95, // 95% chance
                conditions: { hasShield: false },
                result: { type: 'lose_all_items', title: "Sabotage!", text: "The thief jettisons an escape pod, taking all of your pre-flight consumables with them." }
            },
            {
                probability: 0.05, // 5% chance
                conditions: { hasShield: false },
                result: { type: 'dialogue_reward', currencyRange: [2500, 3500], title: "A Desperate Refugee", text: "You find the 'thief' is just a scared refugee. They offer you their life savings for safe passage." }
            }
        ],
        weight: 1,
    },
    {
        id: 'distress_call',
        title: 'Distress Signal',
        text: "A weak distress call cuts through the static from a civilian transport, pinned down by enemy fighters. Assisting them is a diversion.",
        isChoice: true,
        isScalable: true,
        choices: [
            { 
                text: 'Help Them', 
                outcomes: [
                    {
                        probability: 1, // This is now the only outcome for choosing to help
                        result: { 
                            type: 'fight', 
                            fightEnemyCount: 5, 
                            fightEnemyType: 'standard', 
                            title: "Engaging Hostiles", 
                            text: "You divert course to engage the fighters attacking the transport.",
                            followupOutcomes: [
                                {
                                    probability: 0.8,
                                    result: { type: 'fight_reward', currencyRange: [1200, 1800], partsRange: [1, 3], title: "Heroic Rescue", text: "You fight off the attackers. The grateful transport crew transfers a reward to your account." }
                                },
                                {
                                    probability: 0.2,
                                    result: {
                                        type: 'fight',
                                        fightEnemyCount: 3,
                                        fightEnemyType: 'dodger',
                                        title: "It's an Ambush!",
                                        text: "The 'civilian' ship was a pirate lure! A wing of elite fighters decloaks to support the first wave. Survive!",
                                        followupOutcomes: [
                                            {
                                                probability: 1,
                                                result: {
                                                    type: 'fight_reward',
                                                    currencyRange: [400, 800],
                                                    partsRange: [0, 1],
                                                    title: 'Ambush Repelled',
                                                    text: 'You successfully defended against the pirate ambush! You managed to salvage some components from their wreckage.'
                                                }
                                            }
                                        ]
                                    }
                                }
                            ]
                        }
                    }
                ] 
            },
            { 
                text: 'Ignore the Call', 
                outcomes: [
                     {
                        probability: 1,
                        result: { type: 'nothing', title: "Mission First", text: "You stick to your primary objective, leaving the transport to its fate. The comms go silent." }
                    }
                ]
            },
        ],
        weight: 5,
    },
    {
        id: 'black_market_trader',
        title: 'Shadowy Contact',
        text: "A cloaked ship decloaks off your bow, offering 'rare components' for a price. They seem shady, but their offer is tempting.",
        isChoice: true,
        choices: [
            { 
                text: 'Trade (Cost: 5000)',
                outcomes: [
                    {
                        probability: 0.9,
                        result: { type: 'trade', cost: 5000, partsRange: [7, 12], title: "Trade Successful", text: "You exchange the currency for a container of pristine components. A risky but profitable deal." }
                    },
                    {
                        probability: 0.1,
                        result: { type: 'trade', cost: 5000, parts: 0, title: "Scammed!", text: "You pay the fee, but the trader jettisons a container of worthless scrap and cloaks away. You've been had!" }
                    },
                ]
            },
            { 
                text: 'Decline', 
                outcomes: [
                    {
                        probability: 0.85,
                        result: { type: 'nothing', title: "No Deal", text: "You decline the offer. The trader gives a curt nod and cloaks away into the darkness." }
                    },
                    {
                        probability: 0.15,
                        result: { 
                            type: 'fight', 
                            fightEnemyCount: 2, 
                            fightEnemyType: 'dodger', 
                            title: "A Poor Choice of Words", 
                            text: "Your refusal offends the trader. They see you as an easy mark and attack!",
                            followupOutcomes: [
                                {
                                    probability: 1,
                                    result: {
                                        type: 'fight_reward',
                                        currencyRange: [2000, 3000],
                                        partsRange: [1, 3],
                                        title: 'Hostile Negotiation',
                                        text: 'You fight off the shady trader and salvage some valuable components from their wreckage.'
                                    }
                                }
                            ]
                        }
                    }
                ]
            },
        ],
        weight: 3,
    },
    {
        id: 'unstable_wormhole',
        title: 'Gravitational Anomaly',
        text: "Scanners detect an unstable wormhole. It's a shortcut, but the gravimetric shear is intense. The risk is immense, but the reward could be great.",
        isChoice: true,
        choices: [
            { 
                text: 'Enter the Wormhole', 
                outcomes: [
                    {
                        probability: 0.50,
                        result: { type: 'level_skip', levels: 2, title: "Quantum Leap!", text: "The wormhole stabilizes! You are propelled forward, skipping 2 entire levels!" }
                    },
                    {
                        probability: 0.35,
                        result: { type: 'damage_ship', title: "Gravimetric Shear!", text: "The wormhole is turbulent! Your ship is battered. Emergency repairs cost you currency.", currencyRange: [-5000, -2000] }
                    },
                    {
                        probability: 0.10,
                        result: { type: 'level_skip', levels: 3, title: "Perfect Trajectory!", text: "You ride the perfect wave through the wormhole, jumping ahead an incredible 3 levels!" }
                    },
                    {
                        probability: 0.05,
                        result: { type: 'level_skip', levels: -1, title: "Temporal Inversion!", text: "Catastrophe! The wormhole was unstable and flung you backwards! You've lost ground." }
                    },
                ]
            },
            { 
                text: 'Go Around', 
                outcomes: [
                    {
                        probability: 1,
                        result: { type: 'nothing', title: "The Safe Route", text: "You decide against the risk and plot a course around the anomaly." }
                    }
                ]
            },
        ],
        weight: 2,
    },
    {
        id: 'glitch_market',
        title: 'Glitch in the Market',
        text: "A malfunctioning 'Galactic Prime' trade drone hails you. Its speech is garbled... 'PR-CE OP-IMIZ-TION... FAIL-RE. LIQ-IDATING...'", // This is a placeholder, App.tsx will generate the real text
        isChoice: true,
        isDynamic: true, // This tells the game to generate its content on the fly
        minLevel: 30,
        weight: 2,
    },
    {
        id: 'asteroid_field',
        title: 'Dense Asteroid Field',
        text: "Warning! Your long-range sensors detect a dense asteroid field directly in your path. The gravitational pull is strong, making it difficult to avoid entirely.",
        isChoice: true,
        minLevel: 11,
        weight: 3,
        choices: [
            {
                text: "Navigate the Field",
                outcomes: [
                    {
                        probability: 1,
                        result: { type: 'special_event', eventType: 'asteroid_field_survival', title: "Entering the Field", text: "You steel your nerves and pilot the ship directly into the swirling chaos of rock and ice. Brace for impact!" }
                    }
                ]
            },
            {
                text: "Attempt to Go Around",
                outcomes: [
                    {
                        probability: 0.8, // Base probability, will be modified by the reducer
                        result: { type: 'nothing', title: "Clear Passage", text: "You successfully find a clear channel around the densest part of the field. It cost you some time, but the ship is safe." }
                    },
                    {
                        probability: 0.2, // Base probability, will be modified by the reducer
                        result: { type: 'special_event', eventType: 'asteroid_field_survival', title: "No Escape!", text: "There's no way around! The field is too vast. You're pulled into the gravitational currents and must navigate through. Brace yourself!" }
                    }
                ]
            }
        ],
    },
    {
        id: 'space_lotto',
        title: 'Quadrant Quadrillionaire Quick-Quiz!',
        text: "A booming voice fills your comms: 'It's me, ZORP GLORBAX, with a chance to win BIG! For a staggering 15,000 currency, answer this: What color is a red dwarf star?'",
        isChoice: true,
        minLevel: 40,
        choices: [
            {
                text: "It's... red?",
                outcomes: [
                    {
                        probability: 0.95,
                        result: { type: 'gain_items', currency: 15000, title: "DING DING DING!", text: "CORRECT! You're smarter than you look! Zorp transfers the funds, minus a small 'processing fee'." }
                    },
                    {
                        probability: 0.05,
                        result: { type: 'gain_items', currency: 10, title: "Technicality!", text: "Technically correct, but BORING! Here's a pittance for your troubles. Now get out of my sight!" }
                    }
                ]
            },
            {
                text: "Chartreuse, with purple spots.",
                outcomes: [
                    {
                        probability: 1,
                        result: { type: 'nothing', title: "WRONG!", text: "BZZT! So wrong! So sad! Zorp cackles at your lack of astronomical AND fashion sense." }
                    }
                ]
            },
            {
                text: "Ignore the broadcast.",
                outcomes: [
                    {
                        probability: 1,
                        result: { type: 'nothing', title: "No Fun!", text: "You ignore Zorp. He can be heard muttering about 'pilots with no sense of adventure' as the signal fades." }
                    }
                ]
            }
        ],
        weight: 2,
    },
    {
        id: 'slumbering_sentry',
        title: 'The Slumbering Sentry',
        text: "Your ship's proximity alarms scream. You find yourself in the shadow of a colossal, dormant war-drone from a long-dead civilization. It's covered in strange glyphs, silent and still... for now.",
        isChoice: true,
        minLevel: 45,
        weight: 3,
        choices: [
            {
                text: "Attempt to salvage its outer plating.",
                outcomes: [
                    {
                        probability: 0.8,
                        result: {
                            type: 'fight',
                            fightEnemyCount: 2,
                            fightEnemyType: 'conduit',
                            title: "Guardian Awakened!",
                            text: "Your salvage beam awakens the sentry! Its single red eye locks onto you as it deploys crystalline guardian drones. PREPARE FOR BATTLE!",
                            followupOutcomes: [
                                {
                                    probability: 1,
                                    result: {
                                        type: 'gain_consumables',
                                        consumableType: 'fastReload',
                                        consumableQuantity: 1,
                                        title: "Sentry Down!",
                                        text: "You miraculously defeat the ancient guardians. In their wreckage, you find a fully charged Adrenal Injector and a trove of components.",
                                        partsRange: [3, 5],
                                        currencyRange: [2000, 3000]
                                    }
                                }
                            ]
                        }
                    },
                    {
                        probability: 0.2,
                        result: {
                            type: 'gain_items',
                            partsRange: [8, 12],
                            currencyRange: [4000, 6000],
                            title: "Silent Plunder",
                            text: "Incredible! You manage to pry off several large plates of unknown alloy without waking the beast. These will be incredibly valuable."
                        }
                    }
                ]
            },
            {
                text: "Try to sneak past it quietly.",
                outcomes: [
                    {
                        probability: 0.85,
                        result: { type: 'nothing', title: "Calculated Risk", text: "You hold your breath, cutting all non-essential power. You slip by unnoticed. The silence is deafening." }
                    },
                    {
                        probability: 0.15,
                        result: {
                            type: 'damage_ship',
                            title: "Spotted!",
                            text: "A loose panel on your ship rattles! The sentry's eye snaps open and tracks you. It fires a warning shot that damages your systems, costing you currency for repairs.",
                            currencyRange: [-3000, -1000]
                        }
                    }
                ]
            }
        ],
    },
    {
        id: 'last_broadcast',
        title: 'The Last Broadcast',
        text: "Your comms crackle to life, picking up a looping, wide-band civilian message. It's not a distress call, but a digital ghost - a final, preserved broadcast from a colony world that was annihilated weeks ago. It's a collage of voices... a parent's lullaby, a poet's last words, a captain's defiance. A monument to the lost.",
        isChoice: true,
        minLevel: 15,
        weight: 3,
        choices: [
            {
                text: 'Log the Broadcast',
                outcomes: [{
                    probability: 1,
                    result: {
                        type: 'gain_items',
                        title: "Resolve Hardened",
                        text: "You silently save the recording to your ship's log. A somber reminder of what you're fighting for. You also manage to extract some residual resource data from the signal.",
                        currencyRange: [2000, 3000],
                        partsRange: [1, 2],
                    }
                }]
            },
            {
                text: 'Relay the Broadcast (RISKY)',
                outcomes: [{
                    probability: 1,
                    result: {
                        type: 'fight',
                        fightEnemyCount: 6,
                        fightEnemyType: 'dodger',
                        title: "They're Listening",
                        text: "You amplify the broadcast across all channels, a defiant cry into the void. The enemy heard. Multiple hostiles are warping in on your position!",
                        followupOutcomes: [{
                            probability: 1,
                            result: {
                                type: 'fight_reward',
                                title: 'Message Received',
                                text: "You weathered the storm. As the last hostile explodes, a ping lights up your console. A nearby survivor outpost, inspired by your actions, has transferred a significant reward. The voices of the lost will not be forgotten.",
                                currencyRange: [5000, 7500],
                                partsRange: [3, 5],
                            }
                        }]
                    }
                }]
            },
            {
                text: 'Jam the Signal',
                outcomes: [{
                    probability: 1,
                    result: {
                        type: 'nothing',
                        title: "Static",
                        text: "The mission is all that matters. You jam the frequency, and the voices fade into silence. There's no time for ghosts."
                    }
                }]
            }
        ]
    },
    {
        id: 'echoes_of_a_hero',
        title: 'Echoes of a Hero',
        text: "Your sensors detect a repeating, encrypted signal. It's an old hero-class ship, identical to your own, adrift and heavily damaged. Its IFF transponder is broadcasting a final captain's log on a loop.",
        isChoice: true,
        minLevel: 65,
        weight: 2,
        choices: [
            {
                text: "Salvage its core systems.",
                outcomes: [
                    {
                        probability: 0.65,
                        result: {
                            type: 'gain_consumables',
                            consumableType: 'rapidFire',
                            consumableQuantity: 1,
                            title: "A Hero's Legacy",
                            text: "You interface with the derelict's core. The logs speak of a final, desperate act against overwhelming odds. You download their combat telemetry and find an intact Overdrive Core in the engine room."
                        }
                    },
                    {
                        probability: 0.20,
                        result: {
                            type: 'gain_items',
                            partsRange: [6, 10],
                            currencyRange: [3000, 5000],
                            title: "Scrap and Data",
                            text: "The core is corrupted, but you manage to salvage a significant amount of scrap and raw materials from the ship's hull."
                        }
                    },
                    {
                        probability: 0.15,
                        result: {
                            type: 'damage_ship',
                            title: "Feedback Loop!",
                            text: "As you connect, a feedback loop from the damaged core fries one of your own weapon stabilizers! The damage costs you a significant amount to repair.",
                            currencyRange: [-6000, -3000]
                        }
                    }
                ]
            },
            {
                text: "Hold a moment of silence and move on.",
                outcomes: [
                    {
                        probability: 1,
                        result: { type: 'nothing', title: "Respects Paid", text: "You pay your respects to a fallen comrade. The mission continues, your resolve strengthened." }
                    }
                ]
            }
        ]
    },
    {
        id: 'the_heretic',
        title: 'The Heretic',
        text: "You're hailed by a heavily damaged alien ship of a design you don't recognize. The communication isn't verbal, but a direct, calm telepathic message.\n\nThe being identifies itself as a \"dissident\" that has severed its connection to the Overmind. It claims the Overmind isn't a conqueror, but a collector of consciousness, and its crusade will lead to the heat death of the universe's soul. It offers you a secret.",
        isChoice: true,
        minLevel: 65,
        weight: 2,
        choices: [
            {
                text: "Trust it. Ask for the secret.",
                outcomes: [{
                    probability: 1,
                    result: {
                        type: 'fight',
                        fightPreset: 'heretic_antibodies',
                        title: "The Overmind's Wrath",
                        text: "As the dissident reveals the secret, the Overmind's 'antibodies' warp in to silence it! Defend yourself!",
                        followupOutcomes: [{
                            probability: 1,
                            result: {
                                type: 'fight_reward',
                                gainHereticalInsight: true,
                                title: 'Heretical Insight Gained',
                                text: "The dissident's ship is destroyed in the crossfire, but its final message echoes in your mind: a critical vulnerability in the Overmind's final form. You have gained Heretical Insight."
                            }
                        }]
                    }
                }]
            },
            {
                text: "Distrust it. Destroy the xeno.",
                outcomes: [{
                    probability: 1,
                    result: {
                        type: 'fight',
                        fightPreset: 'heretic_ship',
                        title: "No Half-Measures",
                        text: "This could be a trap. You open fire on the strange vessel.",
                        followupOutcomes: [{
                            probability: 1,
                            result: {
                                type: 'fight_reward',
                                title: '...Then You Are Lost, Too.',
                                text: "The heretic's ship barely resists, sending one final, sorrowful message as it explodes. You salvage some materials from the wreckage.",
                                currencyRange: [2000, 3000],
                                partsRange: [2, 4],
                            }
                        }]
                    }
                }]
            },
            {
                text: "Ignore it. This changes nothing.",
                outcomes: [{
                    probability: 1,
                    result: {
                        type: 'nothing',
                        title: "A Risk Not Taken",
                        text: "You power down your comms and fly away, leaving the alien to its fate. The opportunity is lost forever."
                    }
                }]
            }
        ]
    },
    {
        id: 'training_sim',
        title: 'Floating Datacron',
        text: "You detect a strange, inert object floating in space. It appears to be an ancient datacron broadcasting a combat simulation program. Connecting to it could yield valuable tactical data, but it will consume time and resources.",
        isChoice: true,
        minLevel: 5,
        weight: 2,
        choices: [
            {
                text: "Run Simulation",
                outcomes: [
                    {
                        probability: 1,
                        result: { type: 'special_event', eventType: 'training_sim_challenge', title: "Initializing...", text: "You connect your ship's systems to the datacron. The simulation is beginning." }
                    }
                ]
            },
            {
                text: "Ignore",
                outcomes: [
                    {
                        probability: 1,
                        result: { type: 'nothing', title: "Unknown Potential", text: "You decide the risk isn't worth it and leave the datacron behind." }
                    }
                ]
            }
        ]
    },
    {
        id: 'phantom_echo',
        title: 'Phantom Echo',
        text: "Your long-range sensors are picking up a duplicate of your own IFF signal, faint and distorted. It's an impossibility. The signal originates from a nearby nebula.",
        isChoice: true,
        minLevel: 35,
        weight: 2,
        choices: [
            {
                text: "Trace the echo",
                outcomes: [
                    {
                        probability: 0.35,
                        result: {
                            type: 'fight',
                            fightEnemyCount: 4,
                            fightEnemyType: 'weaver',
                            title: "Signal Ambush!",
                            text: "The signal was a lure! As you enter the nebula, Weaver-class ships decloak and attack!",
                            followupOutcomes: [{
                                probability: 1,
                                result: {
                                    type: 'fight_reward',
                                    currencyRange: [2500, 4000],
                                    partsRange: [2, 4],
                                    title: "Ambush Cleared",
                                    text: "You fight off the Weavers and find the signal repeater they were using. You smash it and salvage the components."
                                }
                            }]
                        }
                    },
                    {
                        probability: 0.65,
                        result: {
                            type: 'gain_consumables',
                            consumableType: 'revive',
                            consumableQuantity: 1,
                            title: "Fallen Hero's Cache",
                            text: "The signal leads to the wreckage of another Hero-class ship. Its final act was to broadcast this warning. You find their emergency supplies intact.",
                            partsRange: [5, 8]
                        }
                    }
                ]
            },
            {
                text: "Purge the false signal",
                outcomes: [
                    {
                        probability: 1,
                        result: { type: 'nothing', title: "Safety First", text: "You erase the phantom signal from your logs. Whatever it was, it's not your problem now." }
                    }
                ]
            }
        ]
    },
    {
        id: 'collector_trade',
        title: 'The Collector',
        text: "A small, ornate ship approaches, its hull covered in strange relics. The pilot, a being shrouded in robes, contacts you. \"I seek rare artifacts from your species' short but... explosive... history. I will pay handsomely for a functional Overdrive Core.\"",
        isChoice: true,
        minLevel: 15,
        weight: 3,
        choices: [
            {
                text: 'Trade an Overdrive Core',
                outcomes: [{
                    probability: 1,
                    result: {
                        type: 'trade',
                        costConsumableType: 'rapidFire',
                        costConsumableQuantity: 1,
                        currency: 12000,
                        title: 'A Fine Specimen',
                        text: 'The collector examines the core with delight and transfers the funds. "A pleasure doing business," it hums before warping away.'
                    }
                }]
            },
            {
                text: 'Decline',
                outcomes: [{
                    probability: 1,
                    result: { type: 'nothing', title: 'No Deal', text: 'You decline. The collector gives a slight bow and vanishes into the void.' }
                }]
            }
        ]
    },
    {
        id: 'medic_trade',
        title: 'Field Medic',
        text: "You receive a priority message from a medical transport. \"We're low on emergency revival kits for our patients. We can offer payment from our relief fund if you can spare one.\"",
        isChoice: true,
        minLevel: 15,
        weight: 3,
        choices: [
            {
                text: 'Trade a Revive Kit',
                outcomes: [{
                    probability: 1,
                    result: {
                        type: 'trade',
                        costConsumableType: 'revive',
                        costConsumableQuantity: 1,
                        currency: 8000,
                        title: 'For a Good Cause',
                        text: 'You transfer the kit. "You have our thanks, pilot. Many will live because of you." The promised funds are wired to your account.'
                    }
                }]
            },
            {
                text: 'My mission is too critical',
                outcomes: [{
                    probability: 1,
                    result: { type: 'nothing', title: 'Mission First', text: 'You decline the request. The medic expresses disappointment but understands the difficult choice.' }
                }]
            }
        ]
    },
    {
        id: 'quartermaster_trade',
        title: 'Desperate Quartermaster',
        text: "A battered military freighter hails you. \"Pilot! Our main gunner crews are exhausted. We need combat stimulants, fast. We can wire you the credits if you can spare an Adrenal Injector.\"",
        isChoice: true,
        minLevel: 15,
        weight: 3,
        choices: [
            {
                text: 'Trade an Adrenal Injector',
                outcomes: [{
                    probability: 1,
                    result: {
                        type: 'trade',
                        costConsumableType: 'fastReload',
                        costConsumableQuantity: 1,
                        currency: 4000,
                        title: 'Supporting the Fleet',
                        text: 'The quartermaster is relieved. "This will keep our guns firing! Sending payment now. Good luck out there."'
                    }
                }]
            },
            {
                text: 'I can\'t spare any',
                outcomes: [{
                    probability: 1,
                    result: { type: 'nothing', title: 'Priorities', text: 'You inform the quartermaster you can\'t help. They sigh and wish you luck on your own mission.' }
                }]
            }
        ]
    },
    {
        id: 'montezuma_approaches',
        title: 'The Behemoth',
        text: "Your sensors are screaming. A planetoid-sized asteroid, impossibly rich in resources, is on a slow collision course with this sector. Its sheer mass is distorting local space-time. This is a unique opportunity, but the risks are astronomical.",
        isChoice: true,
        minLevel: 40,
        weight: 1, // Rare
        choices: [
            {
                text: "Engage the Behemoth",
                outcomes: [{
                    probability: 1,
                    result: { type: 'special_event', eventType: 'montezuma_encounter', title: "Engaging the Behemoth", text: "You pivot your ship, engines flaring, and head towards the colossal asteroid. The mission just changed." }
                }]
            },
            {
                text: "Avoid at all costs",
                outcomes: [{
                    probability: 1,
                    result: { type: 'nothing', title: "Prudence", text: "You wisely decide that discretion is the better part of valor and steer clear of the massive object. Some treasures aren't worth the risk." }
                }]
            }
        ]
    }
];