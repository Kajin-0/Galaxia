import type { GameState, Boss, BossDefeatCount, Encounter, ConsumableItem, OutcomeResult } from '../types';
import * as C from '../constants';
import { getNextId } from '../gameLogic/engine';

export function createNewBoss(level: number, bossDefeatCount: BossDefeatCount, effectiveNow: number, isHardMode: boolean, laneCount: number): Boss {
    let bossType: Boss['bossType'];
    let baseBossLevel = 0; // The first level this boss type can appear at.

    if (level === 100) {
        bossType = 'overmind';
    } else if (level === 10) {
        bossType = 'warden';
        baseBossLevel = 10;
    } else if (level === 20) {
        bossType = 'punisher';
        baseBossLevel = 20;
    } else if (level > 20 && level % C.BOSS_LEVEL_INTERVAL === 0) {
        const regularBosses: Boss['bossType'][] = ['warden', 'punisher'];
        // After level 20, they alternate. Level 30 is Warden, 40 is Punisher, etc.
        const bossIndex = (level / C.BOSS_LEVEL_INTERVAL) - 3; // 30/10 - 3 = 0, 40/10 - 3 = 1
        bossType = regularBosses[bossIndex % regularBosses.length];
        baseBossLevel = bossType === 'warden' ? 10 : 20; // Warden always scales from 10, Punisher from 20
    } else {
        // Fallback for any other boss level, shouldn't happen with current constants
        bossType = 'warden';
        baseBossLevel = 10;
    }

    const encounterCount = bossDefeatCount[bossType] || 0;
    const cappedEncounterCount = Math.min(encounterCount, C.BOSS_ENCOUNTER_DIFFICULTY_CAP);
    
    let baseHealth, bossY, scaledHealth, attackPattern: Boss['attackPattern'] = 'barrage';

    // Calculate the center of the asymmetrical playable area
    const rightPadding = C.GAME_WIDTH / laneCount;
    const playableWidth = C.GAME_WIDTH - rightPadding;
    const centerX = playableWidth / 2;
    
    // Overmind is a special case and doesn't follow the normal scaling rules.
    if(bossType === 'overmind') {
        baseHealth = C.OVERMIND_INITIAL_HEALTH;
        scaledHealth = isHardMode ? baseHealth * 1.5 : baseHealth;
        bossY = C.OVERMIND_Y_POSITION;
        return {
            id: getNextId(),
            bossType,
            x: centerX,
            y: bossY,
            health: scaledHealth,
            maxHealth: scaledHealth,
            phase: 'entering',
            phaseStartTime: 0, // Signal for sync
            lastAttackTime: 0, // Signal for sync
            attackPattern: 'barrage',
            attackPatternStartTime: 0, // Signal for sync
            difficultyLevel: 0,
            
            // Explicitly initialize all optional properties to ensure a consistent object shape
            sweepWavesFired: undefined,
            lastSweepWaveTime: undefined,
            sweepInitialSafeLane: undefined,
            sweepDirection: undefined,
            wardenBarrageInterval: undefined,
            wardenSweepWaveCount: undefined,
            wardenSweepWaveInterval: undefined,
            wardenMinionCount: undefined,
            punisherBarrageInterval: undefined,
            punisherMinionCount: undefined,
            fragments: [],
            isInvulnerable: false,
            beamChargeStartTime: undefined,
            beamFireStartTime: undefined,
            beamDuration: undefined,
            safeSpotX: undefined,
            debuffs: undefined,
            explosionsFired: undefined,
            lastExplosionTime: undefined,
        };
    }
    
    // Warden & Punisher scaling logic
    switch(bossType) {
        case 'punisher':
            baseHealth = C.PUNISHER_INITIAL_HEALTH;
            bossY = C.PUNISHER_Y_POSITION;
            break;
        case 'warden':
        default:
            baseHealth = C.WARDEN_INITIAL_HEALTH;
            bossY = C.WARDEN_Y_POSITION;
            break;
    }

    // --- Start with base stats ---
    let wardenBarrageInterval = C.WARDEN_ATTACK_INTERVAL_BARRAGE;
    let scaledWaveCount = C.WARDEN_SWEEP_BASE_WAVE_COUNT;
    let scaledWaveInterval = C.WARDEN_SWEEP_BASE_WAVE_INTERVAL;
    
    // --- Layer 1: ENCOUNTER SCALING (based on how many times you've beaten this specific boss) ---
    const encounterHealthMultiplier = 1 + (cappedEncounterCount * C.BOSS_HEALTH_SCALING_BASE_RATE) + (Math.pow(cappedEncounterCount, 2) * C.BOSS_HEALTH_SCALING_QUADRATIC_RATE);
    scaledHealth = baseHealth * Math.min(encounterHealthMultiplier, C.BOSS_HEALTH_SCALING_CAP);

    wardenBarrageInterval *= Math.pow(C.BOSS_ATTACK_SPEED_SCALING_RATE, cappedEncounterCount);
    scaledWaveCount = Math.min(C.WARDEN_SWEEP_WAVE_COUNT_SCALING_CAP, scaledWaveCount + (cappedEncounterCount * C.WARDEN_SWEEP_WAVE_COUNT_SCALING_ADD));
    scaledWaveInterval *= Math.pow(C.WARDEN_SWEEP_WAVE_INTERVAL_SCALING_RATE, cappedEncounterCount);
    
    // New, more gradual minion scaling
    const scaledWardenMinionCount = Math.min(C.WARDEN_MINION_SCALING_CAP, C.WARDEN_SPAWN_MINION_COUNT + Math.max(0, cappedEncounterCount - 1));
    const scaledPunisherMinionCount = Math.min(C.PUNISHER_MINION_SCALING_CAP, C.PUNISHER_ATTACK_SPAWN_MINION_COUNT + cappedEncounterCount);
    
    let punisherBarrageInterval = C.PUNISHER_ATTACK_INTERVAL_BARRAGE;
    punisherBarrageInterval *= Math.pow(C.BOSS_ATTACK_SPEED_SCALING_RATE, cappedEncounterCount);

    // --- Layer 2: HARD MODE LEVEL SCALING (based on current game level) ---
    if (isHardMode && level > baseBossLevel) {
        const levelDifference = level - baseBossLevel;

        // Health Scaling: +5% per level difference from base, capped at 400% total
        const healthScalingFactor = 0.05;
        const hardModeHealthMultiplier = 1 + (levelDifference * healthScalingFactor);
        scaledHealth *= Math.min(hardModeHealthMultiplier, 4.0);

        // Attack Speed Scaling: -1% interval per level difference from base, capped at 40% of original interval
        const attackSpeedScalingFactor = 0.01;
        const hardModeSpeedMultiplier = 1 - (levelDifference * attackSpeedScalingFactor);
        const cappedSpeedMultiplier = Math.max(hardModeSpeedMultiplier, 0.40);

        if (bossType === 'warden') {
            wardenBarrageInterval *= cappedSpeedMultiplier;
            scaledWaveInterval *= cappedSpeedMultiplier;
        } else if (bossType === 'punisher') {
            punisherBarrageInterval *= cappedSpeedMultiplier;
        }
    }
    
    // --- Final Clamping ---
    const finalWardenBarrageInterval = Math.max(wardenBarrageInterval, C.WARDEN_ATTACK_INTERVAL_BARRAGE * C.BOSS_ATTACK_SPEED_SCALING_CAP);
    const finalWaveInterval = Math.max(scaledWaveInterval, C.WARDEN_SWEEP_WAVE_INTERVAL_SCALING_CAP);
    const finalPunisherBarrageInterval = Math.max(punisherBarrageInterval, C.PUNISHER_ATTACK_INTERVAL_BARRAGE * C.BOSS_ATTACK_SPEED_SCALING_CAP);

    return {
        id: getNextId(),
        bossType,
        x: centerX,
        y: bossY,
        health: scaledHealth,
        maxHealth: scaledHealth,
        phase: 'entering',
        phaseStartTime: 0, // Signal for sync
        lastAttackTime: 0, // Signal for sync
        attackPattern,
        attackPatternStartTime: 0, // Signal for sync
        difficultyLevel: 0,
        
        // Encounter-based scaling properties (now correctly assigned or undefined)
        wardenBarrageInterval: bossType === 'warden' ? finalWardenBarrageInterval : undefined,
        wardenSweepWaveCount: bossType === 'warden' ? scaledWaveCount : undefined,
        wardenSweepWaveInterval: bossType === 'warden' ? finalWaveInterval : undefined,
        wardenMinionCount: bossType === 'warden' ? scaledWardenMinionCount : undefined,
        punisherBarrageInterval: bossType === 'punisher' ? finalPunisherBarrageInterval : undefined,
        punisherMinionCount: bossType === 'punisher' ? scaledPunisherMinionCount : undefined,

        // Warden sweep properties
        sweepWavesFired: undefined,
        lastSweepWaveTime: undefined,
        sweepInitialSafeLane: undefined,
        sweepDirection: undefined,

        // Overmind properties
        fragments: undefined,
        isInvulnerable: false,
        beamChargeStartTime: undefined,
        beamFireStartTime: undefined,
        beamDuration: undefined,
        safeSpotX: undefined,
        
        // Common optional properties
        debuffs: undefined,
        explosionsFired: undefined,
        lastExplosionTime: undefined,
    };
}

export function generateDynamicEncounter(baseEncounter: Encounter, state: GameState): Encounter {
    if (baseEncounter.id === 'glitch_market') {
        const consumableMap: Record<ConsumableItem, { name: string, cost: number }> = {
            revive: { name: 'a Revive', cost: C.REVIVE_COST },
            fastReload: { name: 'an Adrenal Injector', cost: C.FAST_RELOAD_COST },
            rapidFire: { name: 'an Overdrive Core', cost: C.RAPID_FIRE_COST },
            speedBoost: { name: 'Engine Coolant', cost: C.SPEED_BOOST_COST },
        };
        const availableConsumables = Object.keys(consumableMap) as ConsumableItem[];
        const chosenConsumable = availableConsumables[Math.floor(Math.random() * availableConsumables.length)];
        const itemInfo = consumableMap[chosenConsumable];
        const quantity = 3;
        const dealPrice = 1000;

        const newEncounter: Encounter = {
            ...baseEncounter,
            text: `A malfunctioning 'Galactic Prime' trade drone hails you, its speech garbled. "UNFORESEEN MARKET VOLATILITY," it buzzes. "PRICE OPTIMIZATION ERROR... LIQUIDATING ASSETS." It's offering a bundle of ${quantity}x ${itemInfo.name} for just ${dealPrice} currency!`,
            choices: [
                {
                    text: `Exploit the Glitch (Cost: ${dealPrice})`,
                    outcomes: [
                        {
                            probability: 0.9,
                            result: {
                                type: 'gain_consumables',
                                cost: dealPrice,
                                consumableType: chosenConsumable,
                                consumableQuantity: quantity,
                                title: "Deal of a Lifetime!",
                                text: `The transaction completes before the drone can correct itself. You snagged ${quantity} ${itemInfo.name} for a steal!`
                            }
                        },
                        {
                            probability: 0.1,
                            result: {
                                type: 'fight',
                                cost: dealPrice,
                                fightEnemyCount: 3,
                                fightEnemyType: 'dodger',
                                title: "Loss Prevention!",
                                text: "Your transaction trips an alarm! Galactic Prime dispatches 'Loss Prevention' drones to reclaim their assets.",
                                followupOutcomes: [{
                                    probability: 1,
                                    result: {
                                        type: 'gain_consumables',
                                        consumableType: chosenConsumable,
                                        consumableQuantity: quantity,
                                        title: "Hostile Takeover",
                                        text: "You defeat the security drones and salvage the items from the wreckage. The deal is yours, one way or another."
                                    }
                                }]
                            }
                        }
                    ]
                },
                {
                    text: "Report Anomaly",
                    outcomes: [
                        {
                            probability: 1,
                            result: {
                                type: 'nothing',
                                title: "Good Samaritan",
                                text: "You report the glitch. The drone thanks you profusely and warps away to be serviced, leaving you with only your integrity."
                            }
                        }
                    ]
                }
            ]
        };
        return newEncounter;
    } else if (baseEncounter.id === 'distress_call') {
        const level = state.level;
        let variant: 'swarm' | 'aces' | 'web' | 'blockade' = 'swarm';
        
        const rand = Math.random();
        if (level <= 10) {
            variant = 'swarm';
        } else if (level <= 30) {
            variant = rand < 0.6 ? 'swarm' : 'aces';
        } else if (level <= 60) {
            if (rand < 0.3) variant = 'swarm';
            else if (rand < 0.7) variant = 'aces';
            else variant = 'web';
        } else {
            if (rand < 0.1) variant = 'swarm';
            else if (rand < 0.3) variant = 'aces';
            else if (rand < 0.6) variant = 'web';
            else variant = 'blockade';
        }

        let fightPreset: OutcomeResult['fightPreset'] = 'distress_swarm';
        let flavorText = "You divert course to engage the fighters.";
        let rewardMult = 1;
        
        switch (variant) {
            case 'swarm':
                fightPreset = 'distress_swarm';
                flavorText = "Warning: Large swarm signature detected. A wall of standard fighters is blocking your path.";
                rewardMult = 1.0;
                break;
            case 'aces':
                fightPreset = 'distress_aces';
                flavorText = "Alert: Elite 'Dodger' class signatures detected. These pilots are fast and maneuverable.";
                rewardMult = 1.3;
                break;
            case 'web':
                fightPreset = 'distress_web';
                flavorText = "It's a trap! Weaver ships are setting up a perimeter to pin you down.";
                rewardMult = 1.6;
                break;
            case 'blockade':
                fightPreset = 'distress_blockade';
                flavorText = "Heavy readings! Shield Conduits are protecting elite units. Prioritize targets carefully.";
                rewardMult = 2.2;
                break;
        }

        // --- ENVIRONMENTAL MODIFIER LOGIC ---
        let environment: OutcomeResult['environment'] | undefined;
        const rollEnv = Math.random();
        let envChance = 0;
        
        if (level > 40) {
            envChance = 0.4; // 40% chance at high levels
        } else if (level >= 16) {
            envChance = 0.2; // 20% chance at mid levels
        }

        if (rollEnv < envChance) {
            // Roll for specific environment (50/50 split)
            if (Math.random() < 0.5) {
                environment = 'asteroid_ambush';
                flavorText += " Sensors indicate the ship is drifting through a dense debris field.";
            } else {
                environment = 'ion_storm';
                flavorText += " Warning: High-energy ionic interference detected. Mobility systems will be compromised.";
            }
            rewardMult *= 1.5; // 1.5x rewards for environmental hazard
        }

        const baseMinCurrency = 1200;
        const baseMaxCurrency = 1800;
        const baseMinParts = 1;
        const baseMaxParts = 3;

        return {
            ...baseEncounter,
            text: baseEncounter.text + "\n\n" + flavorText,
            choices: [
                {
                    text: "Help Them",
                    outcomes: [{
                        probability: 1,
                        result: {
                            type: 'fight',
                            fightPreset: fightPreset,
                            environment: environment,
                            title: "Engaging Hostiles",
                            text: flavorText,
                            followupOutcomes: [{
                                probability: 1,
                                result: {
                                    type: 'fight_reward',
                                    currencyRange: [Math.floor(baseMinCurrency * rewardMult), Math.floor(baseMaxCurrency * rewardMult)],
                                    partsRange: [Math.floor(baseMinParts * rewardMult), Math.floor(baseMaxParts * rewardMult)],
                                    title: "Rescue Successful",
                                    text: "The hostiles are destroyed. The grateful transport crew transfers a reward to your account."
                                }
                            }]
                        }
                    }]
                },
                // Preserve the "Ignore" option
                baseEncounter.choices![1]
            ]
        };
    }
    return baseEncounter;
}


/**
 * Processes an encounter outcome by rolling for randomized rewards and applying progression-based logic.
 * @param result The original outcome result.
 * @param bossesDefeated The number of bosses the player has defeated to check for Hangar unlock.
 * @returns An outcome result with specific, rolled reward values.
 */
export function processOutcomeResult(result: OutcomeResult, bossesDefeated: number): OutcomeResult {
    const processedResult = { ...result };

    // Roll for randomized currency
    if (processedResult.currencyRange) {
        const [min, max] = processedResult.currencyRange;
        processedResult.currency = Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // Roll for randomized parts
    if (processedResult.partsRange) {
        const [min, max] = processedResult.partsRange;
        processedResult.parts = Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // Zero out parts reward if Hangar is not yet unlocked
    if (bossesDefeated === 0 && processedResult.parts) {
        processedResult.parts = 0;
    }

    // Clean up range properties so they don't get used again
    delete processedResult.currencyRange;
    delete processedResult.partsRange;
    
    return processedResult;
}