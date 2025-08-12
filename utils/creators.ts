


import type { GameState, Boss, BossDefeatCount, Encounter, ConsumableItem, OutcomeResult, PossibleOutcome } from '../types';
import * as C from '../constants';

let nextId = 20000; // Start high to avoid collision with other IDs

export function createNewBoss(level: number, bossDefeatCount: BossDefeatCount, now: number): Boss {
    let bossType: Boss['bossType'];
    if (level === 100) {
        bossType = 'overmind';
    } else if (level === 10) {
        bossType = 'warden';
    } else if (level === 20) {
        bossType = 'punisher';
    } else if (level > 20 && level % C.BOSS_LEVEL_INTERVAL === 0) {
        const regularBosses: Boss['bossType'][] = ['warden', 'punisher'];
        // After level 20, they alternate. Level 30 is Warden, 40 is Punisher, etc.
        const bossIndex = (level / C.BOSS_LEVEL_INTERVAL) - 3; // 30/10 - 3 = 0, 40/10 - 3 = 1
        bossType = regularBosses[bossIndex % regularBosses.length];
    } else {
        // Fallback for any other boss level, shouldn't happen with current constants
        bossType = 'warden';
    }

    const encounterCount = bossDefeatCount[bossType] || 0;
    const cappedEncounterCount = Math.min(encounterCount, C.BOSS_ENCOUNTER_DIFFICULTY_CAP);
    
    let baseHealth, bossY, scaledHealth, attackPattern: Boss['attackPattern'] = 'barrage';
    
    switch(bossType) {
        case 'overmind':
            baseHealth = C.OVERMIND_INITIAL_HEALTH;
            scaledHealth = baseHealth; // Overmind doesn't scale with encounters for now
            bossY = C.OVERMIND_Y_POSITION;
            return {
                id: nextId++, bossType, x: C.GAME_WIDTH / 2, y: bossY,
                health: scaledHealth, maxHealth: scaledHealth, phase: 'entering',
                phaseStartTime: now, lastAttackTime: now, attackPattern: 'barrage',
                attackPatternStartTime: now, difficultyLevel: 0, isInvulnerable: false,
            };
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

    const healthMultiplier = 1 + (cappedEncounterCount * C.BOSS_HEALTH_SCALING_BASE_RATE) + (Math.pow(cappedEncounterCount, 2) * C.BOSS_HEALTH_SCALING_QUADRATIC_RATE);
    scaledHealth = baseHealth * Math.min(healthMultiplier, C.BOSS_HEALTH_SCALING_CAP);

    const wardenBarrageInterval = C.WARDEN_ATTACK_INTERVAL_BARRAGE * Math.pow(C.BOSS_ATTACK_SPEED_SCALING_RATE, cappedEncounterCount);
    const scaledWardenBarrageInterval = Math.max(wardenBarrageInterval, C.WARDEN_ATTACK_INTERVAL_BARRAGE * C.BOSS_ATTACK_SPEED_SCALING_CAP);
    const scaledWaveCount = Math.min( C.WARDEN_SWEEP_WAVE_COUNT_SCALING_CAP, C.WARDEN_SWEEP_BASE_WAVE_COUNT + (cappedEncounterCount * C.WARDEN_SWEEP_WAVE_COUNT_SCALING_ADD));
    const scaledWaveInterval = Math.max( C.WARDEN_SWEEP_WAVE_INTERVAL_SCALING_CAP, C.WARDEN_SWEEP_BASE_WAVE_INTERVAL * Math.pow(C.WARDEN_SWEEP_WAVE_INTERVAL_SCALING_RATE, cappedEncounterCount));
    const scaledWardenMinionCount = Math.min(C.WARDEN_MINION_SCALING_CAP, C.WARDEN_SPAWN_MINION_COUNT + (cappedEncounterCount * C.WARDEN_MINION_SCALING_ADD));

    const punisherBarrageInterval = C.PUNISHER_ATTACK_INTERVAL_BARRAGE * Math.pow(C.BOSS_ATTACK_SPEED_SCALING_RATE, cappedEncounterCount);
    const scaledPunisherBarrageInterval = Math.max(punisherBarrageInterval, C.PUNISHER_ATTACK_INTERVAL_BARRAGE * C.BOSS_ATTACK_SPEED_SCALING_CAP);
    const scaledPunisherMinionCount = Math.min(C.PUNISHER_ATTACK_SPAWN_MINION_COUNT + (cappedEncounterCount * C.PUNISHER_MINION_SCALING_ADD), C.PUNISHER_MINION_SCALING_CAP);

    return {
        id: nextId++, bossType, x: C.GAME_WIDTH / 2, y: bossY, health: scaledHealth, maxHealth: scaledHealth,
        phase: 'entering', phaseStartTime: now, lastAttackTime: 0, attackPattern, attackPatternStartTime: now,
        difficultyLevel: 0, wardenBarrageInterval: scaledWardenBarrageInterval, wardenSweepWaveCount: scaledWaveCount,
        wardenSweepWaveInterval: scaledWaveInterval, wardenMinionCount: scaledWardenMinionCount,
        punisherBarrageInterval: scaledPunisherBarrageInterval,
        punisherMinionCount: scaledPunisherMinionCount,
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
                                fightEnemyCount: 3,
                                fightEnemyType: 'dodger',
                                title: "Loss Prevention!",
                                text: "Your transaction trips an alarm! Galactic Prime dispatches 'Loss Prevention' drones to reclaim their assets.",
                                followupOutcomes: [{
                                    probability: 1,
                                    result: {
                                        type: 'gain_consumables',
                                        cost: dealPrice,
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