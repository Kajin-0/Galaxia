
import type { GameState, Enemy, Asteroid, InGameMessage } from '../types';
import { GameStatus } from '../types';
import * as C from '../constants';
import { pools } from '../state/pools';
import { HARD_MODE_MULTIPLIERS } from './config';
import { getHorizontalBoundsAtY } from './positioning';
import { getNextId } from './engine';

/**
 * Handles spawning of enemies and asteroids in normal gameplay modes.
 */
export function runSpawning(state: GameState, now: number, effectiveNow: number) {
    let { lastSpawnTime, level, seenEnemies } = state;
    const newEnemies: Enemy[] = [];
    const newAsteroids: Asteroid[] = [];
    const newInGameMessages: InGameMessage[] = [];
    const spawnRateMultiplier = state.isHardMode ? HARD_MODE_MULTIPLIERS.ENEMY_SPAWN_RATE : 1.0;

    // Do not run the standard spawner during a boss battle.
    if (state.status === GameStatus.BossBattle) {
        return { lastSpawnTime, newEnemies, newAsteroids, seenEnemies, newInGameMessages };
    }

    // FIX: Do not run standard spawner during an encounter fight.
    if (state.pendingPostFightOutcome) {
        // EXCEPTION: Environmental hazards (Asteroid Ambush)
        if (state.pendingPostFightOutcome.environment === 'asteroid_ambush') {
             const ambushInterval = 500 / spawnRateMultiplier; // 500ms base interval, frequent but manageable
             if (effectiveNow - lastSpawnTime > ambushInterval) {
                const roll = Math.random() * C.ASTEROID_TOTAL_SPAWN_WEIGHT;
                const sizeKey = (roll < C.ASTEROID_SIZES.large.spawnWeight) ? 'large' : (roll < C.ASTEROID_SIZES.large.spawnWeight + C.ASTEROID_SIZES.medium.spawnWeight) ? 'medium' : 'small';
                const config = C.ASTEROID_SIZES[sizeKey];
                const asteroid = pools.asteroids.get();
                Object.assign(asteroid, { 
                    id: getNextId(), 
                    x: Math.random() * C.GAME_WIDTH, 
                    y: -config.radius, 
                    vx: (Math.random() - 0.5) * 60, 
                    vy: C.ASTEROID_BASE_SPEED_Y * (1 + (Math.random() - 0.5) * 0.4) * 1.5, // Faster than normal ambient asteroids
                    health: config.health, 
                    maxHealth: config.health, 
                    size: config.radius, 
                    rotation: Math.random() * 360, 
                    rotationSpeed: (Math.random() - 0.5) * 100,
                    isBuffedByConduit: false,
                    shieldCooldownUntil: 0,
                    debuffs: undefined,
                    lastHitTime: 0
                });
                newAsteroids.push(asteroid);
                lastSpawnTime = effectiveNow;
             }
        }
        // Return with potentially new asteroids, but NO new enemies (encounter enemies are fixed)
        return { lastSpawnTime, newEnemies, newAsteroids, seenEnemies, newInGameMessages };
    }
    
    if (state.isMontezumaActive) {
        return { lastSpawnTime, newEnemies, newAsteroids, seenEnemies, newInGameMessages };
    }

    if (state.status === GameStatus.AsteroidField) {
        const asteroidSpawnInterval = (C.ASTEROID_FIELD_BASE_SPAWN_INTERVAL / (1 + (level / 40))) / spawnRateMultiplier;
        if (state.asteroidFieldEndTime && effectiveNow < state.asteroidFieldEndTime) {
            if (effectiveNow - lastSpawnTime > asteroidSpawnInterval) {
                // Timer is updated AFTER successful spawn
                const roll = Math.random() * C.ASTEROID_TOTAL_SPAWN_WEIGHT;
                const sizeKey = (roll < C.ASTEROID_SIZES.large.spawnWeight) ? 'large' : (roll < C.ASTEROID_SIZES.large.spawnWeight + C.ASTEROID_SIZES.medium.spawnWeight) ? 'medium' : 'small';
                const config = C.ASTEROID_SIZES[sizeKey];
                const asteroid = pools.asteroids.get();
                Object.assign(asteroid, { 
                    id: getNextId(), 
                    x: Math.random() * C.GAME_WIDTH, 
                    y: -config.radius, 
                    vx: (Math.random() - 0.5) * 80 * (1 + (level/40)), 
                    vy: C.ASTEROID_BASE_SPEED_Y * (1 + (Math.random() - 0.5) * 0.4) * (1 + (level/40)), 
                    health: config.health, 
                    maxHealth: config.health, 
                    size: config.radius, 
                    rotation: Math.random() * 360, 
                    rotationSpeed: (Math.random() - 0.5) * 120 * (1 + (level/40)),
                    isBuffedByConduit: false,
                    shieldCooldownUntil: 0,
                    debuffs: undefined,
                    lastHitTime: 0
                });
                newAsteroids.push(asteroid);
                lastSpawnTime = effectiveNow;
            }
        }
    } else {
        const levelRampUpEnd = 30; // Ramp up to max speed by level 30
        const rampProgress = Math.min(1, (state.level - 1) / (levelRampUpEnd - 1));
        const spawnInterval = (C.INITIAL_SPAWN_INTERVAL - (C.INITIAL_SPAWN_INTERVAL - C.SPAWN_INTERVAL_MIN) * rampProgress) / spawnRateMultiplier;
        
        if (effectiveNow - lastSpawnTime > spawnInterval) {
            // --- Independent Asteroid Spawning ---
            // This roll happens on the enemy spawn tick and does not affect the main timer.
            // Asteroids are considered an environmental hazard rather than part of the main enemy wave.
            if (state.level >= C.ASTEROID_SPAWN_UNLOCK_LEVEL && Math.random() < C.ASTEROID_SPAWN_CHANCE) {
                if (!seenEnemies.has('asteroid')) {
                    const msg = pools.inGameMessages.get();
                    msg.id = getNextId(); msg.text = 'Threat: Asteroids'; msg.createdAt = effectiveNow; msg.duration = 3000; msg.style = 'warning';
                    newInGameMessages.push(msg);
                    seenEnemies.add('asteroid');
                }
                const roll = Math.random() * C.ASTEROID_TOTAL_SPAWN_WEIGHT;
                const sizeKey = (roll < C.ASTEROID_SIZES.large.spawnWeight) ? 'large' : (roll < C.ASTEROID_SIZES.large.spawnWeight + C.ASTEROID_SIZES.medium.spawnWeight) ? 'medium' : 'small';
                const config = C.ASTEROID_SIZES[sizeKey];
                const asteroid = pools.asteroids.get();
                Object.assign(asteroid, { 
                    id: getNextId(), x: Math.random() * C.GAME_WIDTH, y: -config.radius, vx: (Math.random() - 0.5) * 40, vy: C.ASTEROID_BASE_SPEED_Y * (1 + (Math.random() - 0.5) * 0.4), health: config.health, maxHealth: config.health, size: config.radius, rotation: Math.random() * 360, rotationSpeed: (Math.random() - 0.5) * 60,
                    isBuffedByConduit: false, shieldCooldownUntil: 0, debuffs: undefined, lastHitTime: 0
                });
                newAsteroids.push(asteroid);
            }

            const maxEnemies = state.isHardMode ? C.MAX_ENEMIES_HARD : C.MAX_ENEMIES_NORMAL;
            if (state.enemies.length < maxEnemies) {
                
                const conduitRampProgress = Math.min(1, (state.level - C.CONDUIT_SPAWN_START_LEVEL) / C.CONDUIT_SPAWN_CHANCE_RAMP_LEVELS);
                const weaverRampProgress = Math.min(1, (state.level - C.WEAVER_SPAWN_START_LEVEL) / C.WEAVER_SPAWN_CHANCE_RAMP_LEVELS);
                
                // ✅ OPTIMIZATION: Count conduits manually to avoid filter() allocation
                let conduitCount = 0;
                for (let i = 0; i < state.enemies.length; i++) {
                    if (state.enemies[i].type === 'conduit') conduitCount++;
                }
                
                // FIX: This has been refactored into a single if/else if/else chain to guarantee
                // that an enemy is always spawned if the cap is not reached. Previously, separate if
                // statements could all fail their random roll, resulting in no spawn for the tick.
                if (level >= C.WEAVER_SPAWN_START_LEVEL && Math.random() < C.WEAVER_SPAWN_CHANCE_INITIAL + (C.WEAVER_SPAWN_CHANCE_MAX - C.WEAVER_SPAWN_CHANCE_INITIAL) * weaverRampProgress) {
                    if (!seenEnemies.has('weaver')) {
                        const msg = pools.inGameMessages.get();
                        msg.id = getNextId(); msg.text = 'Enemy: Weaver'; msg.createdAt = effectiveNow; msg.duration = 3000; msg.style = 'warning';
                        newInGameMessages.push(msg);
                        seenEnemies.add('weaver');
                    }
                    const rightPadding = C.GAME_WIDTH / state.laneCount;
                    const playableWidth = C.GAME_WIDTH - rightPadding;
                    const spawnableWidth = playableWidth - 240; // 120px margin on each side
                    const spawnX = Math.random() * spawnableWidth + 120;

                    const weaverHealth = state.isHardMode ? C.WEAVER_HEALTH * HARD_MODE_MULTIPLIERS.ENEMY_HEALTH : C.WEAVER_HEALTH;
                    const weaver = pools.enemies.get();
                    Object.assign(weaver, { 
                        id: getNextId(), x: spawnX, y: -C.ENEMY_HEIGHT, type: 'weaver', health: weaverHealth, maxHealth: weaverHealth, lastShotTime: 0, baseX: spawnX, oscillationFrequency: 0, oscillationAmplitude: 0, oscillationOffset: 0, diveTargetY: Math.random() * (C.PLAYER_Y_POSITION - 300) + 150, lastBeamTime: effectiveNow + Math.random() * C.WEAVER_BEAM_INTERVAL, nextAttack: 'beam',
                        isBuffedByConduit: false, shieldHealth: undefined, shieldRegenTime: undefined, isDodging: false, dodgeTargetX: undefined, isEncounterEnemy: false, lastHitTime: 0, isPausing: false, pauseEndTime: undefined, debuffs: undefined,
                    });
                    newEnemies.push(weaver);
                } else if (level >= C.CONDUIT_SPAWN_START_LEVEL && conduitCount < C.CONDUIT_MAX_ACTIVE && Math.random() < C.CONDUIT_SPAWN_CHANCE_INITIAL + (C.CONDUIT_SPAWN_CHANCE_MAX - C.CONDUIT_SPAWN_CHANCE_INITIAL) * conduitRampProgress) {
                     if (!seenEnemies.has('conduit')) {
                        const msg = pools.inGameMessages.get();
                        msg.id = getNextId(); msg.text = 'Enemy: Conduit'; msg.createdAt = effectiveNow; msg.duration = 3000; msg.style = 'warning';
                        newInGameMessages.push(msg);
                        seenEnemies.add('conduit');
                     }
                     let scaledHealth = C.CONDUIT_HEALTH + (Math.floor((level - C.CONDUIT_SPAWN_START_LEVEL) / C.CONDUIT_HEALTH_SCALING_INTERVAL) * C.CONDUIT_HEALTH_SCALING_AMOUNT);
                     if (state.isHardMode) { scaledHealth *= HARD_MODE_MULTIPLIERS.ENEMY_HEALTH; }
                     const conduit = pools.enemies.get();
                     Object.assign(conduit, { 
                        id: getNextId(), x: Math.random() * (C.GAME_WIDTH - C.ENEMY_WIDTH * 2) + C.ENEMY_WIDTH, y: -C.ENEMY_HEIGHT, type: 'conduit', health: scaledHealth, maxHealth: scaledHealth, lastShotTime: 0, baseX: Math.random() * (C.GAME_WIDTH - C.ENEMY_WIDTH * 2) + C.ENEMY_WIDTH, oscillationFrequency: 0.5, oscillationAmplitude: C.GAME_WIDTH / 3, oscillationOffset: Math.random() * Math.PI * 2, linkedEnemyId: null,
                        isBuffedByConduit: false, shieldHealth: undefined, shieldRegenTime: undefined, isDodging: false, dodgeTargetX: undefined, isEncounterEnemy: false, lastHitTime: 0, debuffs: undefined,
                    });
                     newEnemies.push(conduit);
                } else {
                    let isDodger = false;
                    if (state.level >= C.DODGER_SPAWN_START_LEVEL) {
                        const rampProgress = Math.min(1, (state.level - C.DODGER_SPAWN_START_LEVEL) / C.DODGER_SPAWN_CHANCE_RAMP_LEVELS);
                        if (Math.random() < C.DODGER_SPAWN_CHANCE_INITIAL + (C.DODGER_SPAWN_CHANCE_MAX - C.DODGER_SPAWN_CHANCE_INITIAL) * rampProgress) isDodger = true;
                    }
                    if (isDodger && !seenEnemies.has('dodger')) {
                        const msg = pools.inGameMessages.get();
                        msg.id = getNextId(); msg.text = 'Enemy: Dodger'; msg.createdAt = effectiveNow; msg.duration = 3000; msg.style = 'warning';
                        newInGameMessages.push(msg);
                        seenEnemies.add('dodger');
                    } else if (!isDodger && !seenEnemies.has('standard') && state.level === 1) {
                         const msg = pools.inGameMessages.get();
                         msg.id = getNextId(); msg.text = 'Enemy: Swarmers'; msg.createdAt = effectiveNow; msg.duration = 3000; msg.style = 'warning';
                         newInGameMessages.push(msg);
                         seenEnemies.add('standard');
                    }
                    
                    const spawnY = -C.ENEMY_HEIGHT;
                    const oscillationAmplitude = Math.random() * 80 + 40;
                    const scaleAtSpawn = Math.max(0.1, 0.4 + (spawnY / C.GAME_HEIGHT) * 0.6);
                    const { minX: minEntityX, maxX: maxEntityX } = getHorizontalBoundsAtY(spawnY, C.ENEMY_WIDTH * scaleAtSpawn, state.laneCount);
                    const minAllowedBaseX = minEntityX + oscillationAmplitude;
                    const maxAllowedBaseX = maxEntityX - oscillationAmplitude;
                    let baseX;
                    if (minAllowedBaseX >= maxAllowedBaseX) {
                        baseX = C.GAME_WIDTH / 2;
                    } else {
                        baseX = Math.random() * (maxAllowedBaseX - minAllowedBaseX) + minAllowedBaseX;
                    }
                    
                    const enemyHealth = state.isHardMode ? C.ENEMY_BASE_HEALTH * HARD_MODE_MULTIPLIERS.ENEMY_HEALTH : C.ENEMY_BASE_HEALTH;
                    const enemy = pools.enemies.get();
                    Object.assign(enemy, {
                        id: getNextId(), x: baseX, y: spawnY, type: isDodger ? 'dodger' : 'standard', health: enemyHealth, maxHealth: enemyHealth, lastShotTime: effectiveNow + Math.random() * C.ENEMY_SHOOT_INTERVAL, baseX: baseX, oscillationFrequency: Math.random() * 1.0 + 0.5, oscillationAmplitude: oscillationAmplitude, oscillationOffset: Math.random() * Math.PI * 2, dodgeCooldownUntil: 0,
                        isBuffedByConduit: false, shieldHealth: undefined, shieldRegenTime: undefined, isDodging: false, dodgeTargetX: undefined, isEncounterEnemy: false, lastHitTime: 0, debuffs: undefined,
                    });
                    newEnemies.push(enemy);
                }
            }

            // A spawn attempt was made. Update the timer to ensure correct cadence
            // regardless of whether an enemy was actually spawned (e.g. due to enemy cap).
            lastSpawnTime = effectiveNow;
        }
    }

    return { lastSpawnTime, newEnemies, newAsteroids, seenEnemies, newInGameMessages };
}
