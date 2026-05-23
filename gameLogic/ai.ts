import type { GameState, Enemy as EnemyType, Asteroid as AsteroidType, WeaverBeam, WeaverSurge, EnemyProjectile as EnemyProjectileType, Projectile as ProjectileType } from '../types';
import { GameStatus } from '../types';
import * as C from '../constants';
import { playSound } from '../sounds';
import { pools } from '../state/pools';
import { getHorizontalBoundsAtY, getPlayableGridBoundsAtY } from './positioning';
import { getNextId } from './engine';
import { HARD_MODE_MULTIPLIERS } from './config';
import { triggerHaptic } from '../utils/haptics';
import { arrayPools } from '../utils/arrayPool';
import { populateExplosionParticles } from './collision';
import { calculatePerspectiveScale } from '../utils/perspective';
import { getCachedSin, getCachedCos } from './update';

// ✅ PERFORMANCE: Cache frequently used math constant
const PI_OVER_180 = Math.PI / 180;

// Per-dodger scan scheduling: avoids scanning every frame
export const dodgerNextScanAt = new Map<EnemyType, number>();

// ✅ MOBILE OPTIMIZATION: Reuse array to avoid allocation every frame (zero-allocation)
let potentialTargetsCache: (EnemyType | AsteroidType)[] | null = null;

// ✅ MOBILE OPTIMIZATION: Reuse Maps to avoid allocation every frame (zero-allocation)
let enemyMapCache: Map<number, EnemyType> | null = null;
let asteroidMapCache: Map<number, AsteroidType> | null = null;

// ✅ CRITICAL FIX: Cache conduits array to avoid filter() allocation every frame
let conduitsCache: EnemyType[] = [];

// ✅ MOBILE OPTIMIZATION: Reuse Maps for AI updates to avoid allocation every frame
let aiEnemyUpdatesCache: Map<number, Partial<EnemyType>> | null = null;
let aiAsteroidUpdatesCache: Map<number, Partial<AsteroidType>> | null = null;

/**
 * Handles all boss-related logic, including phase changes and attack patterns.
 */
export function runBossLogic(state: GameState, now: number, effectiveNow: number) {
    let { boss, bossLasers, screenShake } = state;
    if (!boss) {
        return { boss: null, newEnemyProjectiles: [], newMinions: [], newExplosions: [], newCriticalHits: [], bossLasers: [], screenShake: state.screenShake };
    }

    const newEnemyProjectiles: EnemyProjectileType[] = [];
    const newMinions: EnemyType[] = [];
    const newExplosions: GameState['explosions'] = [];
    const newCriticalHits: GameState['criticalHits'] = [];
    let localBoss = { ...boss }; // Create a local mutable copy
    const phaseTime = effectiveNow - localBoss.phaseStartTime;

    if (localBoss.phase === 'defeated') {
        const interval = C.BOSS_DEFEATED_DURATION / C.BOSS_DEATH_EXPLOSION_COUNT;
        if (effectiveNow > (localBoss.lastExplosionTime ?? 0) + interval && (localBoss.explosionsFired ?? 0) < C.BOSS_DEATH_EXPLOSION_COUNT) {
            const bossWidth = localBoss.bossType === 'punisher' ? C.PUNISHER_WIDTH : localBoss.bossType === 'warden' ? C.WARDEN_WIDTH : C.OVERMIND_WIDTH;
            const bossHeight = localBoss.bossType === 'punisher' ? C.PUNISHER_HEIGHT : localBoss.bossType === 'warden' ? C.WARDEN_HEIGHT : C.OVERMIND_HEIGHT;

            const x = localBoss.x + (Math.random() - 0.5) * bossWidth * 1.2;
            const y = localBoss.y + (Math.random() - 0.5) * bossHeight * 1.2;
            
            const exp = pools.explosions.get();
            exp.id = getNextId(); exp.x = x; exp.y = y; exp.createdAt = effectiveNow;
            populateExplosionParticles(exp.particles, 25, 30, 90, 10, 25);
            newExplosions.push(exp);
            
            if ((localBoss.explosionsFired ?? 0) % 4 === 0) { // Keep the crit hit ratio
                const crit = pools.criticalHits.get();
                crit.id = getNextId(); crit.x = x; crit.y = y; crit.radius = C.CRITICAL_HIT_RADIUS * 1.2; crit.createdAt = effectiveNow; crit.isBossDeath = true;
                newCriticalHits.push(crit);
                playSound('criticalHit');
                triggerHaptic('criticalHit', state.hapticsEnabled);
            }
            playSound('explosion');
            triggerHaptic('explosion', state.hapticsEnabled);
            
            localBoss = {
                ...localBoss,
                explosionsFired: (localBoss.explosionsFired ?? 0) + 1,
                lastExplosionTime: effectiveNow,
            };
        }
    }

    if (localBoss.phase === 'entering' && phaseTime > C.BOSS_ENTER_DURATION) {
        return { boss: localBoss, newEnemyProjectiles, newMinions, newExplosions, newCriticalHits, bossLasers, screenShake, phaseTransitionRequest: { type: 'boss_phase_change', payload: { newPhase: 'attacking' as const } } };
    }
    
    if (localBoss.phase === 'attacking' || localBoss.phase === 'fury') {
        let speed = 2000;
        let halfVisualWidth = 0;

        switch(localBoss.bossType) {
            case 'warden':
                halfVisualWidth = C.WARDEN_TOTAL_VISUAL_WIDTH / 2;
                break;
            case 'punisher':
                speed = 1500;
                halfVisualWidth = C.PUNISHER_TOTAL_VISUAL_WIDTH / 2;
                break;
            case 'overmind':
                halfVisualWidth = C.OVERMIND_WIDTH / 2;
                break;
        }
        
        const { minX, maxX } = getHorizontalBoundsAtY(localBoss.y, halfVisualWidth * 2, state.laneCount);
        const centerX = (minX + maxX) / 2;
        const amplitude = (maxX - minX) / 2;

        const timeInPhase = effectiveNow - localBoss.phaseStartTime;
        localBoss = { ...localBoss, x: centerX + Math.sin(timeInPhase / speed) * amplitude };
    }
    
    // Boss-specific attack logic
    switch(localBoss.bossType) {
        case 'overmind':
            if (localBoss.phase === 'attacking' && localBoss.health / localBoss.maxHealth < C.OVERMIND_PHASE_2_THRESHOLD) {
                return { boss: localBoss, newEnemyProjectiles, newMinions, newExplosions, newCriticalHits, bossLasers, screenShake, phaseTransitionRequest: { type: 'boss_phase_change', payload: { newPhase: 'spawning_fragments' as const } } };
            } else if (localBoss.phase === 'spawning_fragments' && localBoss.fragments?.length === 0) {
                return { boss: localBoss, newEnemyProjectiles, newMinions, newExplosions, newCriticalHits, bossLasers, screenShake, phaseTransitionRequest: { type: 'boss_phase_change', payload: { newPhase: 'fury' as const } } };
            }

            if (localBoss.phase === 'attacking') {
                if (effectiveNow > localBoss.lastAttackTime + (localBoss.wardenBarrageInterval || 500)) {
                    for(let i=0; i<3; i++) {
                        const ep = pools.enemyProjectiles.get();
                        ep.id = getNextId(); ep.x = localBoss.x + (Math.random() - 0.5) * C.OVERMIND_WIDTH * 0.8; ep.y = localBoss.y;
                        ep.angle = 0;
                        ep.isDuplicated = false;
                        ep.speed = C.ENEMY_PROJECTILE_SPEED;
                        ep.prevX = ep.x;
                        ep.prevY = ep.y;
                        newEnemyProjectiles.push(ep);
                    }
                    playSound('enemyShoot');
                    localBoss = { ...localBoss, lastAttackTime: effectiveNow };
                }
            } else if (localBoss.phase === 'fury') {
                const timeInPattern = effectiveNow - localBoss.attackPatternStartTime;
                const FURY_PHASE_DURATION = 8000; // Total duration of fury before beam
                const BARRAGE_DURATION = 2000; // 2 seconds of firing
                const PAUSE_DURATION = 1500;   // 1.5 seconds of pause
                const CYCLE_DURATION = BARRAGE_DURATION + PAUSE_DURATION;

                if (timeInPattern > FURY_PHASE_DURATION) {
                    return { boss: localBoss, newEnemyProjectiles, newMinions, newExplosions, newCriticalHits, bossLasers, screenShake, phaseTransitionRequest: { type: 'boss_phase_change', payload: { newPhase: 'beam' as const } } };
                } else {
                    const timeInCycle = timeInPattern % CYCLE_DURATION;
                    const isFiringPeriod = timeInCycle < BARRAGE_DURATION;
                    
                    if (isFiringPeriod && effectiveNow > localBoss.lastAttackTime + C.OVERMIND_FURY_BARRAGE_INTERVAL) {
                        const ep = pools.enemyProjectiles.get();
                        ep.id = getNextId(); ep.x = localBoss.x + (Math.random() - 0.5) * C.OVERMIND_WIDTH; ep.y = localBoss.y;
                        ep.angle = 0;
                        ep.isDuplicated = false;
                        ep.speed = C.ENEMY_PROJECTILE_SPEED;
                        ep.prevX = ep.x;
                        ep.prevY = ep.y;
                        newEnemyProjectiles.push(ep);
                        playSound('enemyShoot');
                        localBoss = { ...localBoss, lastAttackTime: effectiveNow };
                    }
                }
            } else if (localBoss.phase === 'beam') {
                const timeInPattern = effectiveNow - localBoss.attackPatternStartTime;
                const totalBeamDuration = C.OVERMIND_BEAM_CHARGE_TIME + C.OVERMIND_BEAM_FIRE_TIME;
                
                if (timeInPattern > totalBeamDuration) {
                    return { boss: localBoss, newEnemyProjectiles, newMinions, newExplosions, newCriticalHits, bossLasers, screenShake, phaseTransitionRequest: { type: 'boss_phase_change', payload: { newPhase: 'fury' as const } } };
                }
            }
            break;
        case 'warden':
            if (localBoss.phase === 'attacking') {
                const timeInPattern = effectiveNow - localBoss.attackPatternStartTime;
                const sweepDuration = (localBoss.wardenSweepWaveCount ?? C.WARDEN_SWEEP_BASE_WAVE_COUNT) * (localBoss.wardenSweepWaveInterval ?? C.WARDEN_SWEEP_BASE_WAVE_INTERVAL) + 1500;
                
                let nextPattern = localBoss.attackPattern;
                let newPatternStartTime = localBoss.attackPatternStartTime;
                let patternUpdates: Partial<typeof localBoss> = {};

                if (localBoss.attackPattern === 'barrage' && timeInPattern > C.WARDEN_BARRAGE_DURATION) {
                    nextPattern = 'sweep';
                    newPatternStartTime = effectiveNow;
                    const lastPossibleSafeLaneStart = (state.laneCount - 1) - 2; // (playable lanes) - (safe zone width)
                    const sweepInitialSafeLane = Math.random() < 0.5 ? 0 : lastPossibleSafeLaneStart;
                    patternUpdates = {
                        sweepWavesFired: 0,
                        lastSweepWaveTime: effectiveNow,
                        sweepInitialSafeLane,
                        sweepDirection: sweepInitialSafeLane === 0 ? 1 : -1,
                    };
                } else if (localBoss.attackPattern === 'sweep' && timeInPattern > sweepDuration) {
                    nextPattern = 'spawnMinions';
                    newPatternStartTime = effectiveNow;
                    patternUpdates = { lastAttackTime: effectiveNow };
                } else if (localBoss.attackPattern === 'spawnMinions' && timeInPattern > C.WARDEN_SPAWN_MINION_DURATION) {
                    nextPattern = 'barrage';
                    newPatternStartTime = effectiveNow;
                }
                
                localBoss = { ...localBoss, attackPattern: nextPattern, attackPatternStartTime: newPatternStartTime, ...patternUpdates };

                if (localBoss.attackPattern === 'barrage') {
                    const barrageInterval = (localBoss.wardenBarrageInterval || C.WARDEN_ATTACK_INTERVAL_BARRAGE) * Math.pow(0.8, localBoss.difficultyLevel);
                    if (effectiveNow > localBoss.lastAttackTime + barrageInterval) {
                        const ep = pools.enemyProjectiles.get();
                        ep.id = getNextId(); ep.x = localBoss.x + (Math.random() - 0.5) * C.WARDEN_WIDTH * 0.8; ep.y = localBoss.y + C.WARDEN_HEIGHT / 2;
                        ep.angle = 0;
                        ep.isDuplicated = false;
                        ep.speed = C.ENEMY_PROJECTILE_SPEED;
                        ep.prevX = ep.x;
                        ep.prevY = ep.y;
                        newEnemyProjectiles.push(ep);
                        playSound('enemyShoot');
                        localBoss = { ...localBoss, lastAttackTime: effectiveNow };
                    }
                } else if (localBoss.attackPattern === 'sweep') {
                    const waveInterval = localBoss.wardenSweepWaveInterval ?? C.WARDEN_SWEEP_BASE_WAVE_INTERVAL;
                    const totalWaves = localBoss.wardenSweepWaveCount ?? C.WARDEN_SWEEP_BASE_WAVE_COUNT;
                    if ((localBoss.sweepWavesFired ?? 0) < totalWaves && effectiveNow > (localBoss.lastSweepWaveTime ?? 0) + waveInterval) {
                        const safeLanes = new Set([ (localBoss.sweepInitialSafeLane ?? 0) + ((localBoss.sweepWavesFired ?? 0) * (localBoss.sweepDirection ?? 1)), (localBoss.sweepInitialSafeLane ?? 0) + ((localBoss.sweepWavesFired ?? 0) * (localBoss.sweepDirection ?? 1)) + 1 ]);
                        const spawnY = localBoss.y + C.WARDEN_HEIGHT / 2;
                        const playableLanes = state.laneCount - 1;

                        const playableBounds = getPlayableGridBoundsAtY(spawnY, state.laneCount);
                        const playableWidth = playableBounds.maxX - playableBounds.minX;
                        const laneWidth = playableWidth / playableLanes;

                        for (let i = 0; i < playableLanes; i++) {
                            if (!safeLanes.has(i)) {
                                const ep = pools.enemyProjectiles.get();
                                ep.id = getNextId();
                                ep.x = playableBounds.minX + (i * laneWidth) + (laneWidth / 2);
                                ep.y = spawnY;
                                ep.angle = 0;
                                ep.isDuplicated = false;
                                ep.speed = C.ENEMY_PROJECTILE_SPEED;
                                ep.prevX = ep.x;
                                ep.prevY = ep.y;
                                newEnemyProjectiles.push(ep);
                            }
                        }
                        playSound('enemyShoot');
                        localBoss = { ...localBoss, lastSweepWaveTime: effectiveNow, sweepWavesFired: (localBoss.sweepWavesFired ?? 0) + 1 };
                    }
                } else if (localBoss.attackPattern === 'spawnMinions') {
                    const minionCount = localBoss.wardenMinionCount ?? C.WARDEN_SPAWN_MINION_COUNT;
                    const maxEnemies = state.isHardMode ? C.MAX_ENEMIES_HARD : C.MAX_ENEMIES_NORMAL;
                    if (state.enemies.length < maxEnemies && effectiveNow > localBoss.lastAttackTime + ((C.WARDEN_SPAWN_MINION_DURATION * 0.8) / minionCount)) {
                        const spawnY = localBoss.y + C.WARDEN_HEIGHT;
                        const initialX = localBoss.x + (Math.random() - 0.5) * C.WARDEN_WIDTH;
                        const oscillationAmplitude = Math.random() * 80 + 40;
                        const scaleAtSpawn = Math.max(0.1, 0.4 + (spawnY / C.GAME_HEIGHT) * 0.6);
                        const { minX: minEntityX, maxX: maxEntityX } = getHorizontalBoundsAtY(spawnY, C.ENEMY_WIDTH * scaleAtSpawn, state.laneCount);
                        const minAllowedBaseX = minEntityX + oscillationAmplitude;
                        const maxAllowedBaseX = maxEntityX - oscillationAmplitude;
                        const baseX = Math.max(minAllowedBaseX, Math.min(maxAllowedBaseX, initialX));
                        const minionHealth = state.isHardMode ? C.ENEMY_BASE_HEALTH * HARD_MODE_MULTIPLIERS.ENEMY_HEALTH : C.ENEMY_BASE_HEALTH;
                        const minion = pools.enemies.get();
                        
                        Object.assign(minion, {
                            id: getNextId(), x: baseX, y: spawnY, type: state.bossDefeatCount.warden === 0 ? 'standard' : 'dodger', health: minionHealth, maxHealth: minionHealth, lastShotTime: effectiveNow + Math.random() * C.ENEMY_SHOOT_INTERVAL, baseX: baseX, oscillationFrequency: Math.random() * 1.0 + 0.5, oscillationAmplitude: oscillationAmplitude, oscillationOffset: Math.random() * Math.PI * 2, isEncounterEnemy: false, lastHitTime: 0, isBuffedByConduit: false, debuffs: undefined, isDodging: false, dodgeCooldownUntil: 0, dodgeTargetX: undefined, isPausing: undefined, pauseEndTime: undefined, diveTargetY: undefined, lastBeamTime: undefined, nextAttack: undefined, shieldHealth: undefined, shieldRegenTime: undefined, shieldCooldownUntil: undefined, linkedEnemyId: undefined
                        });

                        newMinions.push(minion);
                        localBoss = { ...localBoss, lastAttackTime: effectiveNow };
                    }
                }
            }
            break;
        case 'punisher':
             if (localBoss.phase === 'attacking') {
                const timeInPattern = effectiveNow - localBoss.attackPatternStartTime;
                let nextPattern = localBoss.attackPattern;
                let newPatternStartTime = localBoss.attackPatternStartTime;

                if (localBoss.attackPattern === 'barrage' && timeInPattern > C.PUNISHER_BARRAGE_DURATION) { nextPattern = 'spawnMinions'; newPatternStartTime = effectiveNow; }
                else if (localBoss.attackPattern === 'spawnMinions' && timeInPattern > C.PUNISHER_SPAWN_MINION_DURATION) { nextPattern = 'laser'; newPatternStartTime = effectiveNow; }
                else if (localBoss.attackPattern === 'laser' && timeInPattern > C.PUNISHER_LASER_PATTERN_DURATION) { 
                    nextPattern = 'barrage'; 
                    newPatternStartTime = effectiveNow; 
                    bossLasers = [];
                }
                
                localBoss = { ...localBoss, attackPattern: nextPattern, attackPatternStartTime: newPatternStartTime };

                if (localBoss.attackPattern === 'barrage') {
                    const barrageInterval = (localBoss.punisherBarrageInterval || C.PUNISHER_ATTACK_INTERVAL_BARRAGE) * Math.pow(0.85, localBoss.difficultyLevel);
                    if (effectiveNow > localBoss.lastAttackTime + barrageInterval) {
                        const ep = pools.enemyProjectiles.get();
                        ep.id = getNextId(); ep.x = localBoss.x + (Math.random() - 0.5) * C.PUNISHER_WIDTH * 0.8; ep.y = localBoss.y + C.PUNISHER_HEIGHT / 2;
                        ep.angle = 0;
                        ep.isDuplicated = false;
                        ep.speed = C.ENEMY_PROJECTILE_SPEED;
                        ep.prevX = ep.x;
                        ep.prevY = ep.y;
                        newEnemyProjectiles.push(ep);
                        playSound('enemyShoot');
                        localBoss = { ...localBoss, lastAttackTime: effectiveNow };
                    }
                } else if (localBoss.attackPattern === 'spawnMinions') {
                    const minionCount = (localBoss.punisherMinionCount ?? C.PUNISHER_ATTACK_SPAWN_MINION_COUNT) + localBoss.difficultyLevel;
                    const maxEnemies = state.isHardMode ? C.MAX_ENEMIES_HARD : C.MAX_ENEMIES_NORMAL;
                    if (state.enemies.length < maxEnemies && effectiveNow > localBoss.lastAttackTime + ((C.PUNISHER_SPAWN_MINION_DURATION * 0.8) / minionCount)) {
                        const spawnY = localBoss.y + C.PUNISHER_HEIGHT;
                        const oscillationAmplitude = Math.random() * 80 + 40;
                        const scaleAtSpawn = Math.max(0.1, 0.4 + (spawnY / C.GAME_HEIGHT) * 0.6);
                        const { minX: minEntityX, maxX } = getHorizontalBoundsAtY(spawnY, C.ENEMY_WIDTH * scaleAtSpawn, state.laneCount);
                        const minAllowedBaseX = minEntityX + oscillationAmplitude;
                        const maxAllowedBaseX = maxX - oscillationAmplitude;
                        let baseX;
                        if (minAllowedBaseX >= maxAllowedBaseX) {
                            baseX = C.GAME_WIDTH / 2;
                        } else {
                            baseX = Math.random() * (maxAllowedBaseX - minAllowedBaseX) + minAllowedBaseX;
                        }
                        const minionHealth = state.isHardMode ? C.ENEMY_BASE_HEALTH * HARD_MODE_MULTIPLIERS.ENEMY_HEALTH : C.ENEMY_BASE_HEALTH;
                        const minion = pools.enemies.get();

                        Object.assign(minion, {
                            id: getNextId(), x: baseX, y: spawnY, type: 'standard', health: minionHealth, maxHealth: minionHealth, lastShotTime: effectiveNow + Math.random() * C.ENEMY_SHOOT_INTERVAL, baseX: baseX, oscillationFrequency: Math.random() * 1.0 + 0.5, oscillationAmplitude: oscillationAmplitude, oscillationOffset: Math.random() * Math.PI * 2, isEncounterEnemy: false, lastHitTime: 0, isBuffedByConduit: false, debuffs: undefined, isDodging: false, dodgeCooldownUntil: 0, dodgeTargetX: undefined, isPausing: undefined, pauseEndTime: undefined, diveTargetY: undefined, lastBeamTime: undefined, nextAttack: undefined, shieldHealth: undefined, shieldRegenTime: undefined, shieldCooldownUntil: undefined, linkedEnemyId: undefined
                        });

                        newMinions.push(minion);
                        localBoss = { ...localBoss, lastAttackTime: effectiveNow };
                    }
                } else if (localBoss.attackPattern === 'laser' && bossLasers.length === 0 && timeInPattern < 100) {
                    const playableLanes = state.laneCount - 1;
                    const SAFE_LANE_COUNT = 2;
                    
                    if (playableLanes <= SAFE_LANE_COUNT) {
                        localBoss = { ...localBoss, attackPattern: 'barrage', attackPatternStartTime: effectiveNow };
                    } else {
                        const laserInfo = {
                            chargeStartTime: effectiveNow,
                            fireStartTime: effectiveNow + C.PUNISHER_LASER_CHARGE_TIME,
                            duration: C.PUNISHER_LASER_FIRE_TIME,
                        };

                        const lastPossibleSafeLaneStart = playableLanes - SAFE_LANE_COUNT;
                        const safeLaneStart = Math.floor(Math.random() * (lastPossibleSafeLaneStart + 1));
                        const safeLanes = new Set([safeLaneStart, safeLaneStart + 1]);

                        const baseLaserCount = 3;
                        const lasersToFireCount = Math.min(
                            playableLanes - SAFE_LANE_COUNT,
                            baseLaserCount + localBoss.difficultyLevel
                        );

                        const unsafeLanes: number[] = [];
                        for (let i = 0; i < playableLanes; i++) {
                            if (!safeLanes.has(i)) {
                                unsafeLanes.push(i);
                            }
                        }

                        for (let i = unsafeLanes.length - 1; i > 0; i--) {
                            const j = Math.floor(Math.random() * (i + 1));
                            [unsafeLanes[i], unsafeLanes[j]] = [unsafeLanes[j], unsafeLanes[i]];
                        }

                        const lanesToFire = unsafeLanes.slice(0, lasersToFireCount);

                        if (lanesToFire.length > 0) {
                            lanesToFire.forEach(lane => {
                                bossLasers.push({ id: getNextId(), lane: lane, ...laserInfo });
                            });
                            playSound('laserShoot');
                        }
                    }
                }
            }
            break;
    }

    let isLaserFiring = false;
    for (const laser of bossLasers) {
        if (effectiveNow >= laser.fireStartTime && effectiveNow < laser.fireStartTime + laser.duration) {
            isLaserFiring = true;
            break;
        }
    }

    if (isLaserFiring) {
        const isShakeActive = screenShake.magnitude > 0 && now < screenShake.startTime + screenShake.duration;
        if (!isShakeActive) {
            screenShake = { magnitude: C.SCREEN_SHAKE_MAGNITUDE_BEAM, duration: C.SCREEN_SHAKE_DURATION_BEAM, startTime: now };
        }
    }

    return { boss: localBoss, newEnemyProjectiles, newMinions, bossLasers, screenShake, newExplosions, newCriticalHits };
}

/**
 * Handles all AI for standard enemies (shooting, dodging, special actions).
 */
export function runStandardEnemyAI(state: GameState, now: number, effectiveNow: number) {
    const { enemies, projectiles, asteroids } = state;
    const isHardMode = state.isHardMode;
    const laneCount = state.laneCount;
    const level = state.level;
    const fireRateMultiplier = isHardMode ? HARD_MODE_MULTIPLIERS.ENEMY_FIRE_RATE : 1.0;
    const hardModeEnemySpeed = isHardMode ? HARD_MODE_MULTIPLIERS.ENEMY_SPEED : 1.0;

    // ✅ MOBILE OPTIMIZATION: Reuse Maps instead of allocating new ones every frame
    if (!aiEnemyUpdatesCache) {
        aiEnemyUpdatesCache = new Map<number, Partial<EnemyType>>();
    }
    if (!aiAsteroidUpdatesCache) {
        aiAsteroidUpdatesCache = new Map<number, Partial<AsteroidType>>();
    }
    aiEnemyUpdatesCache.clear();
    aiAsteroidUpdatesCache.clear();
    const enemyUpdates = aiEnemyUpdatesCache;
    const asteroidUpdates = aiAsteroidUpdatesCache;
    
    const newEnemyProjectiles: EnemyProjectileType[] = [];
    const newWeaverBeams: WeaverBeam[] = [];
    const newWeaverSurges: WeaverSurge[] = [];

    // --- OPTIMIZATION: Mutate existing update objects instead of creating new ones with spread syntax ---
    const setEnemyUpdate = (id: number, update: Partial<EnemyType>) => {
        const existing = enemyUpdates.get(id);
        if (existing) {
            Object.assign(existing, update);
        } else {
            enemyUpdates.set(id, { ...update });
        }
    };
    const setAsteroidUpdate = (id: number, update: Partial<AsteroidType>) => {
        const existing = asteroidUpdates.get(id);
        if (existing) {
            Object.assign(existing, update);
        } else {
            asteroidUpdates.set(id, { ...update });
        }
    };

    // ✅ MOBILE OPTIMIZATION: Manual loop instead of forEach to avoid closure allocation
    const enemiesLen = enemies.length;
    for (let idx = 0; idx < enemiesLen; idx++) {
        const e = enemies[idx];
        // ✅ MOBILE OPTIMIZATION: Direct property access instead of creating merged object
        // Eliminates ~1,200+ object allocations per second with 20 enemies at 60fps
        const updates = enemyUpdates.get(e.id);
        
        // Get effective values: check updates first, fall back to original
        const eType = e.type; // type never changes in updates
        const eX = e.x;
        const eY = e.y;
        const eIsDodging = updates?.isDodging ?? e.isDodging;
        const eDodgeCooldownUntil = updates?.dodgeCooldownUntil ?? e.dodgeCooldownUntil;
        const eBaseX = e.baseX;
        const eOscillationFrequency = e.oscillationFrequency;
        const eOscillationOffset = e.oscillationOffset;
        const eOscillationAmplitude = e.oscillationAmplitude;
        const eIsPausing = updates?.isPausing ?? e.isPausing;
        const eDiveTargetY = e.diveTargetY;
        const eLastShotTime = updates?.lastShotTime ?? e.lastShotTime;
        const eIsBuffedByConduit = e.isBuffedByConduit;
        const eIsEncounterEnemy = e.isEncounterEnemy;

        if (eType === 'dodger') {
            const levelFactor = Math.min(1, Math.max(0, (level - C.DODGER_SPAWN_START_LEVEL)) / 40);
            const reactionTime = 0.5 - (0.2 * levelFactor); // 500ms → 300ms
            const scaledCooldown = C.DODGER_DODGE_COOLDOWN - (150 * levelFactor); // 450ms → 300ms
        
            // If actively dodging or still on cooldown, skip scanning entirely
            if (eIsDodging || effectiveNow <= (eDodgeCooldownUntil ?? 0)) {
                // Keep next scan time slightly in the future to avoid immediate re-scan when cooldown ends
                const nextAt = Math.max(dodgerNextScanAt.get(e) ?? 0, effectiveNow + 24);
                dodgerNextScanAt.set(e, nextAt);
            } else {
                // Always-on throttle: scan every ~2 frames
                const SCAN_INTERVAL_MS = 32;
                const nextAt = dodgerNextScanAt.get(e) ?? 0;
                if (effectiveNow >= nextAt) {
                    const MAX_THREATS = 8; // cap threats considered per scan
                    const threats = arrayPools.tempProjectiles.get();
                    const detectionRadius = 300;
                    const detectionRadiusSq = detectionRadius * detectionRadius;
                    let collected = 0;
                    const projectilesLen = projectiles.length;
                    for (let pIdx = 0; pIdx < projectilesLen; pIdx++) {
                        if (collected >= MAX_THREATS) break;
                        const proj = projectiles[pIdx];
                        // Fast rejection
                        const dx = proj.x - eX;
                        const dy = proj.y - eY;
                        const distSq = dx*dx + dy*dy;
                        if (distSq > detectionRadiusSq) continue;
                        if (proj.y < eY) continue;
                        const projectileSpeedY = getCachedCos((proj.angle || 0) * PI_OVER_180) * C.PROJECTILE_SPEED;
                        if (projectileSpeedY <= 0) continue;
                        // Intercept window
                        const enemySpeedY = C.ENEMY_SPEED * hardModeEnemySpeed;
                        const closingSpeed = projectileSpeedY + enemySpeedY;
                        if (closingSpeed <= 0) continue;
                        const timeToIntercept = (proj.y - eY) / closingSpeed;
                        if (timeToIntercept < 0 || timeToIntercept > reactionTime) continue;
                        // Predict X
                        const projectileSpeedX = Math.sin((proj.angle || 0) * PI_OVER_180) * C.PROJECTILE_SPEED;
                        const predictedProjX = proj.x + projectileSpeedX * timeToIntercept;
                        const timeAtIntercept = effectiveNow + (timeToIntercept * 1000);
                        const predictedEnemyX = eBaseX
                            + Math.sin((timeAtIntercept / 1000) * eOscillationFrequency + eOscillationOffset)
                            * eOscillationAmplitude;
                        const threatRadius = C.ENEMY_HITBOX_RADIUS * 4.0;
                        if (Math.abs(predictedProjX - predictedEnemyX) < threatRadius) {
                            threats.push(proj);
                            collected++;
                        }
                    }
                    if (threats.length > 0) {
                        let totalPredictedX = 0;
                        const threatsLen = threats.length;
                        for (let tIdx = 0; tIdx < threatsLen; tIdx++) {
                            const threat = threats[tIdx];
                            const projectileSpeedY = getCachedCos((threat.angle || 0) * PI_OVER_180) * C.PROJECTILE_SPEED;
                            const enemySpeedY = C.ENEMY_SPEED * hardModeEnemySpeed;
                            const closingSpeed = projectileSpeedY + enemySpeedY;
                            const timeToIntercept = (threat.y - eY) / closingSpeed;
                            const projectileSpeedX = getCachedSin((threat.angle || 0) * PI_OVER_180) * C.PROJECTILE_SPEED;
                            totalPredictedX += threat.x + projectileSpeedX * timeToIntercept;
                        }
                        const avgThreatX = totalPredictedX / threats.length;
                        const dodgeDirection = avgThreatX < eX ? 1 : -1;
                        const dodgeDistance = (80 + 70 * levelFactor) + Math.random() * 40;
                        const scale = calculatePerspectiveScale(eY);
                        const scaledWidth = C.ENEMY_WIDTH * scale;
                        const { minX, maxX } = getHorizontalBoundsAtY(eY, scaledWidth, laneCount);
                        let targetX = eX + dodgeDirection * dodgeDistance;
                        if (targetX > maxX || targetX < minX) targetX = eX - dodgeDirection * dodgeDistance;
                        targetX = Math.max(minX, Math.min(maxX, targetX));
                        setEnemyUpdate(e.id, { isDodging: true, dodgeTargetX: targetX, dodgeCooldownUntil: effectiveNow + scaledCooldown });
                    }
                    arrayPools.tempProjectiles.release(threats);
                    dodgerNextScanAt.set(e, effectiveNow + SCAN_INTERVAL_MS);
                }
            }
        } else if (eType === 'weaver') {
            if (!eIsPausing && eY >= (eDiveTargetY ?? C.PLAYER_Y_POSITION)) {
                const firstShotDelay = 500; // ms
                setEnemyUpdate(e.id, { 
                    isPausing: true, 
                    pauseEndTime: effectiveNow + C.WEAVER_PAUSE_DURATION, 
                    lastBeamTime: effectiveNow - (C.WEAVER_BEAM_INTERVAL - firstShotDelay) 
                });
            }
            // ✅ OPTIMIZATION: Direct property access instead of object spread (eliminates allocations)
            const weaverUpdates = enemyUpdates.get(e.id);
            const isPausing = weaverUpdates?.isPausing ?? e.isPausing;
            const pauseEndTime = weaverUpdates?.pauseEndTime ?? e.pauseEndTime;
            const lastBeamTime = weaverUpdates?.lastBeamTime ?? e.lastBeamTime;
            const nextAttack = weaverUpdates?.nextAttack ?? e.nextAttack;
            const weaverY = e.y; // Use original y, not updated (weaver doesn't move when pausing)
            
            if (isPausing) {
                if (effectiveNow > (pauseEndTime ?? 0)) {
                    setEnemyUpdate(e.id, { isPausing: false });
                } else if (effectiveNow > (lastBeamTime ?? 0) + C.WEAVER_BEAM_INTERVAL / fireRateMultiplier) {
                    if (nextAttack === 'beam') {
                        const beam = pools.weaverBeams.get();
                        beam.id = getNextId(); beam.y = weaverY; beam.createdAt = effectiveNow;
                        newWeaverBeams.push(beam);
                        playSound('weaverBeam');
                        setEnemyUpdate(e.id, { nextAttack: 'surge' });
                    } else {
                        const surge = pools.weaverSurges.get();
                        surge.id = getNextId(); surge.x = 0; surge.y = weaverY; surge.createdAt = effectiveNow;
                        newWeaverSurges.push(surge);
                        playSound('weaverSurge');
                        setEnemyUpdate(e.id, { nextAttack: 'beam' });
                    }
                    setEnemyUpdate(e.id, { lastBeamTime: effectiveNow });
                }
            }
        }

        const isShootingEnemy = eType === 'standard' || eType === 'dodger' || eType === 'heretic_ship';
        if (isShootingEnemy && effectiveNow > eLastShotTime) {
            
            const isHeretic = eType === 'heretic_ship';
            const isBuffedStandard = eType === 'standard' && eIsBuffedByConduit;
            const isBurst = isHeretic || isBuffedStandard;
            const shotCount = isBurst ? 3 : 1;

            for (let i = 0; i < shotCount; i++) {
                const ep = pools.enemyProjectiles.get();
                ep.id = getNextId();
                ep.x = eX + (isBurst ? (i - 1) * 15 : 0);
                ep.y = eY + C.ENEMY_HEIGHT_HALF;
                ep.angle = 0;
                ep.isDuplicated = false;
                const speedShouldVary = state.status !== GameStatus.BossBattle;
                ep.speed = speedShouldVary
                    ? C.ENEMY_PROJECTILE_SPEED * (1 + (Math.random() - 0.5) * C.ENEMY_PROJECTILE_SPEED_VARIATION)
                    : C.ENEMY_PROJECTILE_SPEED;
                ep.prevX = ep.x;
                ep.prevY = ep.y;
                newEnemyProjectiles.push(ep);
            }
            playSound('enemyShoot');

            const encounterAggressionFactor = eIsEncounterEnemy ? 2.5 : 1.0;
            const baseInterval = C.ENEMY_SHOOT_INTERVAL / (fireRateMultiplier * encounterAggressionFactor);
            const nextShotTime = effectiveNow + baseInterval + (Math.random() - 0.5) * C.ENEMY_SHOOT_JITTER;
            
            setEnemyUpdate(e.id, { lastShotTime: nextShotTime });
        }
    }

    // ✅ CRITICAL FIX: Manual loop instead of filter() to avoid array allocation
    conduitsCache.length = 0;
    for (let i = 0; i < enemies.length; i++) {
        if (enemies[i].type === 'conduit') {
            conduitsCache.push(enemies[i]);
        }
    }
    const conduits = conduitsCache;
    
    if (conduits.length > 0) {
        // ✅ OPTIMIZATION: Reuse Maps instead of creating new ones every frame (zero-allocation)
        if (!enemyMapCache) {
            enemyMapCache = new Map<number, EnemyType>();
        }
        if (!asteroidMapCache) {
            asteroidMapCache = new Map<number, AsteroidType>();
        }
        
        enemyMapCache.clear();
        for (let i = 0; i < enemies.length; i++) {
            enemyMapCache.set(enemies[i].id, enemies[i]);
        }
        
        asteroidMapCache.clear();
        for (let i = 0; i < asteroids.length; i++) {
            asteroidMapCache.set(asteroids[i].id, asteroids[i]);
        }
        
        const enemyMap = enemyMapCache;
        const asteroidMap = asteroidMapCache;
        const getEnemy = (id: number) => enemyMap.get(id);
        const getAsteroid = (id: number) => asteroidMap.get(id);

        // ✅ MOBILE OPTIMIZATION: Reuse array to avoid allocation every frame (zero-allocation)
        if (!potentialTargetsCache) {
            potentialTargetsCache = [];
        }
        potentialTargetsCache.length = 0; // Clear for reuse
        for (let i = 0; i < enemies.length; i++) {
            if (enemies[i].type !== 'conduit') {
                potentialTargetsCache.push(enemies[i]);
            }
        }
        for (let i = 0; i < asteroids.length; i++) {
            potentialTargetsCache.push(asteroids[i]);
        }
        const potentialTargets = potentialTargetsCache;
        
        // ✅ CRITICAL PERFORMANCE: Manual loop instead of for...of to reduce iterator overhead
        const conduitsLen = conduits.length;
        for (let i = 0; i < conduitsLen; i++) {
            const conduit = conduits[i];
            // ✅ OPTIMIZATION: Direct property access instead of object spread (eliminates allocations)
            const conduitUpdates = enemyUpdates.get(conduit.id);
            const currentLinkedId = conduitUpdates?.linkedEnemyId ?? conduit.linkedEnemyId;
            
            if (currentLinkedId) {
                const linkedEnemy = getEnemy(currentLinkedId);
                const linkedAsteroid = getAsteroid(currentLinkedId);
                const isTargetInvalid = (!linkedEnemy && !linkedAsteroid) || (linkedEnemy && linkedEnemy.type === 'conduit');

                if (isTargetInvalid) {
                    const oldTargetId = currentLinkedId;
                    // Check if the old target exists in the original maps to set its cooldown
                    if (enemyMap.has(oldTargetId)) {
                        setEnemyUpdate(oldTargetId, { isBuffedByConduit: false, shieldCooldownUntil: effectiveNow + C.CONDUIT_SHIELD_BREAK_COOLDOWN });
                    } else if (asteroidMap.has(oldTargetId)) {
                        setAsteroidUpdate(oldTargetId, { isBuffedByConduit: false, shieldCooldownUntil: effectiveNow + C.CONDUIT_SHIELD_BREAK_COOLDOWN });
                    }
                    setEnemyUpdate(conduit.id, { linkedEnemyId: null });
                }
            }
        
            // ✅ OPTIMIZATION: Direct property access - check updates first, then fall back to original
            const conduitAfterDelinkUpdates = enemyUpdates.get(conduit.id);
            const conduitAfterDelinkLinkedId = conduitAfterDelinkUpdates?.linkedEnemyId ?? currentLinkedId;
            
            if (!conduitAfterDelinkLinkedId) {
                // ✅ OPTIMIZATION: Increased from 3 to 5 frames to further reduce CPU load (80% reduction vs original)
                const CONDUIT_SCAN_INTERVAL = 5;
                const shouldScan = (conduit.id % CONDUIT_SCAN_INTERVAL) === (Math.floor(effectiveNow / 16) % CONDUIT_SCAN_INTERVAL);
                
                if (shouldScan) {
                    // ✅ OPTIMIZATION: Use squared distance to avoid expensive Math.sqrt()
                    // ✅ OPTIMIZATION: Direct property access instead of object spread (eliminates allocations in hot loop)
                    let closestTarget: (EnemyType | AsteroidType | null) = null, minDistanceSq = Infinity;
                    const MAX_CONDUIT_RANGE_SQ = 1500 * 1500; // Early exit for targets too far away
                    // ✅ CRITICAL PERFORMANCE: Manual loop instead of for...of in nested loop (huge performance gain)
                    const potentialTargetsLen = potentialTargets.length;
                    for (let j = 0; j < potentialTargetsLen; j++) {
                        const target = potentialTargets[j];
                        // ✅ OPTIMIZATION: Quick distance check BEFORE expensive property lookups
                        const dx = conduit.x - target.x;
                        const dy = conduit.y - target.y;
                        const distSq = dx * dx + dy * dy;
                        
                        // Early exit if too far (max reasonable conduit range ~1000px, so 1500² = 2.25M)
                        if (distSq > MAX_CONDUIT_RANGE_SQ) continue;
                        
                        // Get updates if they exist, otherwise use original target properties
                        const targetUpdates = 'size' in target 
                            ? asteroidUpdates.get(target.id)
                            : enemyUpdates.get(target.id);
                        
                        // Check isBuffedByConduit (updates override original)
                        const isBuffed = targetUpdates?.isBuffedByConduit ?? (target as any).isBuffedByConduit;
                        if (isBuffed) continue;
                        
                        // Check shieldCooldownUntil (updates override original)
                        const shieldCooldown = targetUpdates?.shieldCooldownUntil ?? (target as any).shieldCooldownUntil;
                        if (shieldCooldown && effectiveNow < shieldCooldown) continue;
                        
                        if (distSq < minDistanceSq) { minDistanceSq = distSq; closestTarget = target; }
                    }
                    if (closestTarget) {
                        setEnemyUpdate(conduit.id, { linkedEnemyId: closestTarget.id });
                        if ('size' in closestTarget) {
                            setAsteroidUpdate(closestTarget.id, { isBuffedByConduit: true });
                        } else {
                            const updates: Partial<EnemyType> = { isBuffedByConduit: true };
                            setEnemyUpdate(closestTarget.id, updates);
                        }
                    }
                }
            }
        }
    }
    
    // ✅ CRITICAL OPTIMIZATION: Mutate enemies/asteroids in place instead of creating new objects (eliminates 1000+ allocations/second)
    if (enemyUpdates.size > 0) {
        for (let i = 0; i < enemies.length; i++) {
            const updates = enemyUpdates.get(enemies[i].id);
            if (updates) {
                // Mutate the existing enemy object in place (zero allocation)
                Object.assign(enemies[i], updates);
            }
        }
    }

    if (asteroidUpdates.size > 0) {
        for (let i = 0; i < asteroids.length; i++) {
            const updates = asteroidUpdates.get(asteroids[i].id);
            if (updates) {
                // Mutate the existing asteroid object in place (zero allocation)
                Object.assign(asteroids[i], updates);
            }
        }
    }

    // Return the same arrays (no new allocations, preserves reference equality)
    return { enemies, asteroids, enemyProjectiles: newEnemyProjectiles, weaverBeams: newWeaverBeams, weaverSurges: newWeaverSurges };
}