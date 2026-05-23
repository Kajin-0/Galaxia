import type { GameState, Enemy as EnemyType, Projectile as ProjectileType, PowerUp as PowerUpInterface, PowerUpType, EnemyProjectile as EnemyProjectileType, Asteroid as AsteroidType, SplatterParticle, ProjectileImpact, DamageNumber, RockImpact as RockImpactType, CriticalHitExplosion as CriticalHit } from '../types';
import type { ObjectPool } from '../utils/objectPool';
import { GameStatus } from '../types';
import * as C from '../constants';
import { playSound, type SoundName } from '../sounds';
import { triggerHaptic } from '../utils/haptics';
import { SpatialGrid, Collidable } from '../utils/collisionSystem';
import { pools } from '../state/pools';
import { getNextId } from './engine';
import { getStreakBonus } from '../utils/progression';
import { getProjectileColor } from '../utils/visuals';
import { arrayPools } from '../utils/arrayPool';
import { getPlayableGridBoundsAtY } from './positioning';
import { clearPlayerRenderCache } from '../components/canvas/drawPlayer';
import { dodgerNextScanAt } from './ai';
import { calculatePerspectiveScale } from '../utils/perspective';
import { handleWeaverBeamCollisions } from './collision/weaverBeamCollisions';
import { processConduitDebuffs, applyConduitDebuffs, cleanupOrphanedConduitShields } from './collision/conduitCollisions';

function parseSegmentsString(segments: string): { x: number; y: number }[] {
    if (!segments) return [];
    return segments.split(' ').map(p => {
        const coords = p.split(',');
        return { x: parseFloat(coords[0]), y: parseFloat(coords[1]) };
    });
}

// ============================================================================
// REUSABLE COLLIDABLE OBJECTS (Phase 3 Optimization)
// ============================================================================
// These objects are reused every frame to avoid allocations in hot paths.

const aoeQueryObject: Collidable = { id: -1001, x: 0, y: 0, radius: 0 };
const playerMainHitboxCollidable: Collidable = { id: -1, x: 0, y: 0, radius: C.PLAYER_HITBOX_MAIN_RADIUS };


// ============================================================================
// OPTIMIZATION: Shield Impact Batching System
// ============================================================================

const SHIELD_IMPACT_POOL_SIZE = 50;
const shieldImpactPool: RockImpactType[] = [];
let shieldImpactPoolIndex = 0;
// Initialize pool once
for (let i = 0; i < SHIELD_IMPACT_POOL_SIZE; i++) {
    shieldImpactPool.push({ id: 0, x: 0, y: 0, createdAt: 0 });
}
const MAX_PENDING_IMPACTS = 200; // Memory leak prevention
let pendingShieldImpacts: { x: number; y: number; time: number }[] = [];


/**
 * Processes a small batch of pending shield impacts each frame.
 * This avoids performance spikes by spreading the work over time.
 */
function processBatchedShieldImpacts(newRockImpacts: RockImpactType[]) {
    if (pendingShieldImpacts.length === 0) return;

    const batchSize = Math.min(10, pendingShieldImpacts.length);
    const batch = pendingShieldImpacts.splice(0, batchSize);

    for (const impact of batch) {
        const imp = shieldImpactPool[shieldImpactPoolIndex];
        imp.id = getNextId();
        imp.x = impact.x;
        imp.y = impact.y;
        imp.createdAt = impact.time;
        newRockImpacts.push(imp);
        
        shieldImpactPoolIndex = (shieldImpactPoolIndex + 1) % SHIELD_IMPACT_POOL_SIZE;
    }
}

// ============================================================================
// OPTIMIZATION: Collision Effect Batching System
// ============================================================================
const COLLISION_EFFECT_POOL_SIZE = 100;

const collisionEffectPool = {
    damageNumbers: Array.from({ length: COLLISION_EFFECT_POOL_SIZE }, (): DamageNumber => ({ id: 0, x: 0, y: 0, text: '', isCrit: false, isCorrosive: false, createdAt: 0, initialDriftX: 0, isInsightDamage: false })),
    criticalHits: Array.from({ length: COLLISION_EFFECT_POOL_SIZE }, (): CriticalHit => ({ id: 0, x: 0, y: 0, radius: 0, createdAt: 0 }))
};
let damageNumberPoolIndex = 0;
let critPoolIndex = 0;

// ✅ MOBILE OPTIMIZATION: Reusable Sets to eliminate 240 Set allocations per second (4 Sets × 60 fps)
const reusableDestroyedEnemyIds = new Set<number>();
const reusableDestroyedProjectileIds = new Set<number>();
const reusableDestroyedAsteroidIds = new Set<number>();
const reusableDestroyedEnemyProjectileIds = new Set<number>();
const reusableDestroyedConduitLinkedIds = new Set<number>();
const reusableCollectedPowerUpIds = new Set<number>();
const reusableCollectedUpgradePartIds = new Set<number>();
const reusableClonedTrainingTargetIndices = new Set<number>();

interface PendingEffect {
    x: number;
    y: number;
    text: string;
    isCrit: boolean;
    isCorrosive: boolean;
    radius?: number;
    isInsightDamage?: boolean;
}
let pendingEffects: PendingEffect[] = [];
const MAX_PENDING_EFFECTS = 200; // Memory leak prevention

// ✅ OPTIMIZATION: Reusable object for AOE effects to avoid allocations in hot loop
const reusableAoeEffect: PendingEffect = { x: 0, y: 0, text: '', isCrit: false, isCorrosive: false, radius: undefined };

// ✅ OPTIMIZATION: Module-level sound throttle for training targets
// This MUST be outside the function scope to persist across frames
let lastTrainingSoundTime = 0;

export function clearCollisionCaches() {
    shieldImpactPoolIndex = 0;
    pendingShieldImpacts.length = 0;
    damageNumberPoolIndex = 0;
    critPoolIndex = 0;
    pendingEffects.length = 0;
    lastTrainingSoundTime = 0;
    reusableDestroyedConduitLinkedIds.clear();
    reusableCollectedPowerUpIds.clear();
    reusableCollectedUpgradePartIds.clear();
    reusableClonedTrainingTargetIndices.clear();
}

function appendArray<T>(base: T[], additions: T[]): T[] {
    const additionsLen = additions.length;
    if (additionsLen === 0) return base;

    const baseLen = base.length;
    const result = new Array<T>(baseLen + additionsLen);
    let idx = 0;
    for (let i = 0; i < baseLen; i++) result[idx++] = base[i];
    for (let i = 0; i < additionsLen; i++) result[idx++] = additions[i];
    return result;
}


/**
 * Processes a batch of pending collision visual effects (damage numbers, crits).
 * This avoids performance spikes by creating all effects at once from pre-allocated pools.
 */
function processBatchedCollisionEffects(
    effectiveNow: number,
    newDamageNumbers: DamageNumber[],
    newCriticalHits: CriticalHit[]
) {
    if (pendingEffects.length === 0) return;

    const batchSize = Math.min(20, pendingEffects.length);
    const batch = pendingEffects.splice(0, batchSize);

    for (const effect of batch) {
        const dn = collisionEffectPool.damageNumbers[damageNumberPoolIndex];
        damageNumberPoolIndex = (damageNumberPoolIndex + 1) % COLLISION_EFFECT_POOL_SIZE;
        Object.assign(dn, { id: getNextId(), x: effect.x, y: effect.y, text: effect.text, isCrit: effect.isCrit, isCorrosive: effect.isCorrosive, createdAt: effectiveNow, initialDriftX: (Math.random() - 0.5) * 20, isInsightDamage: effect.isInsightDamage });
        newDamageNumbers.push(dn);

        if (effect.isCrit) {
            // BUG FIX: Only create a CriticalHitExplosion (the visual effect) if a valid radius is provided.
            // This prevents chain-reaction AOE kills from creating invalid effects that cause a render crash.
            // The damage number will still be yellow because `isCrit` is true, but the faulty visual effect won't be created.
            if (typeof effect.radius === 'number' && effect.radius > 0) {
                const crit = collisionEffectPool.criticalHits[critPoolIndex];
                critPoolIndex = (critPoolIndex + 1) % COLLISION_EFFECT_POOL_SIZE;
                Object.assign(crit, { id: getNextId(), x: effect.x, y: effect.y, radius: effect.radius, createdAt: effectiveNow });
                newCriticalHits.push(crit);
            }
        }
    }
}


/**
 * A pure array filter function that also releases removed items back to a pool.
 * @param array The array to filter.
 * @param predicate A function that returns true for elements to keep.
 * @param pool The object pool to release removed items to.
 * @param onRelease An optional callback to run on each released item before it's returned to the pool.
 * @returns A new array containing only the elements for which the predicate returned true.
 */
function filterAndPool<T>(
    array: T[],
    predicate: (item: T) => boolean,
    pool: ObjectPool<T>,
    onRelease?: (item: T) => void
): T[] {
    const len = array.length;
    const kept = new Array<T>(len);
    let keptCount = 0;
    for (let i = 0; i < len; i++) {
        const item = array[i];
        if (predicate(item)) {
            kept[keptCount] = item;
            keptCount++;
        } else {
            if (onRelease) {
                onRelease(item);
            }
            pool.release(item);
        }
    }
    kept.length = keptCount;
    return kept;
}

function filterAndPoolAndAppend<T>(
    array: T[],
    predicate: (item: T) => boolean,
    pool: ObjectPool<T>,
    additions: T[],
    onRelease?: (item: T) => void
): T[] {
    const len = array.length;
    const additionsLen = additions.length;
    const result = new Array<T>(len + additionsLen);
    let resultCount = 0;

    for (let i = 0; i < len; i++) {
        const item = array[i];
        if (predicate(item)) {
            result[resultCount] = item;
            resultCount++;
        } else {
            if (onRelease) {
                onRelease(item);
            }
            pool.release(item);
        }
    }

    for (let i = 0; i < additionsLen; i++) {
        result[resultCount] = additions[i];
        resultCount++;
    }

    result.length = resultCount;
    return result;
}


/**
 * Orchestrates the cleanup of all game entities that are marked for destruction
 * or have moved off-screen. Returns new, filtered arrays.
 */
function filterDestroyedEntities(
    state: GameState,
    boss: GameState['boss'],
    destroyedProjectileIds: Set<number>,
    destroyedEnemyIds: Set<number>,
    destroyedAsteroidIds: Set<number>,
    destroyedEnemyProjectileIds: Set<number>,
    collectedPowerUpIds: Set<number>,
    collectedUpgradePartIds: Set<number>
): { 
    projectiles: ProjectileType[], 
    enemies: EnemyType[], 
    asteroids: AsteroidType[],
    enemyProjectiles: EnemyProjectileType[],
    powerUps: PowerUpInterface[],
    upgradePartCollects: GameState['upgradePartCollects'],
    boss: GameState['boss']
} {
    const isOffScreen = (y: number) => y > C.GAME_GRID_HEIGHT + C.GAME_HEIGHT_BUFFER;
    const isOffScreenTop = (y: number) => y < -C.OFFSCREEN_BUFFER;

    const projectiles = filterAndPool(state.projectiles, p => !destroyedProjectileIds.has(p.id) && !isOffScreenTop(p.y), pools.projectiles);
    const asteroids = filterAndPool(state.asteroids, a => !destroyedAsteroidIds.has(a.id) && !isOffScreen(a.y), pools.asteroids);
    const enemies = filterAndPool(state.enemies, e => !destroyedEnemyIds.has(e.id) && !isOffScreen(e.y), pools.enemies, (e) => {
        if (e.trailPoints) {
            e.trailPoints.length = 0;
        }
        if (e.type === 'dodger') {
            dodgerNextScanAt.delete(e);
        }
    });
    const enemyProjectiles = filterAndPool(state.enemyProjectiles, p => !destroyedEnemyProjectileIds.has(p.id) && !isOffScreen(p.y) && !isOffScreenTop(p.y), pools.enemyProjectiles);
    const powerUps = filterAndPool(state.powerUps, p => !collectedPowerUpIds.has(p.id) && !isOffScreen(p.y), pools.powerUps);
    const upgradePartCollects = filterAndPool(state.upgradePartCollects, p => !collectedUpgradePartIds.has(p.id), pools.upgradeParts);
    
    let newBoss = boss;
    if (newBoss?.fragments) {
        newBoss.fragments = filterAndPool(newBoss.fragments, f => !destroyedEnemyIds.has(f.id) && !isOffScreen(f.y), pools.enemies);
    }
    
    return { projectiles, enemies, asteroids, enemyProjectiles, powerUps, upgradePartCollects, boss: newBoss };
}


const calculateDamage = (isCrit: boolean, isAlphaL3: boolean) => {
    // ✅ OPTIMIZATION: Use pre-computed range constant
    const baseDamage = Math.floor(Math.random() * C.PLAYER_PROJECTILE_DAMAGE_RANGE) + C.PLAYER_PROJECTILE_DAMAGE_MIN;
    let finalDamage = isCrit ? Math.floor(baseDamage * C.CRITICAL_HIT_DAMAGE_MULTIPLIER) : baseDamage;
    if (isAlphaL3) {
        finalDamage = Math.floor(finalDamage * C.ALPHA_L3_DAMAGE_MULTIPLIER);
    }
    return finalDamage;
};

export function populateExplosionParticles(
    particles: SplatterParticle[],
    count: number = 12,
    distanceMin: number = 25,
    distanceMax: number = 75,
    sizeMin: number = 6,
    sizeMax: number = 14
) {
    if (particles.length > 0) {
        pools.splatterParticles.releaseAll(particles);
    }

    particles.length = 0;
    const distanceRange = distanceMax - distanceMin;
    const sizeRange = sizeMax - sizeMin;
    for (let i = 0; i < count; i++) {
        const p = pools.splatterParticles.get();
        p.angle = Math.random() * 2 * Math.PI;
        p.distance = Math.random() * distanceRange + distanceMin;
        p.size = Math.random() * sizeRange + sizeMin;
        p.color = ['#f09', '#ff007f', '#fff'][Math.floor(Math.random() * 3)];
        particles.push(p);
    }
}

const checkCollision = (x1: number, y1: number, x2: number, y2: number, combinedRadiusSquared: number): boolean => {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return (dx * dx + dy * dy) < combinedRadiusSquared;
};

function applyShake(currentShake: GameState['screenShake'], magnitude: number, duration: number, time: number): GameState['screenShake'] {
    if (magnitude > currentShake.magnitude) {
        return { magnitude, duration, startTime: time };
    }
    return currentShake;
}

function handleTrainingTargetCollisions(
    state: GameState,
    effectiveNow: number,
    destroyedProjectileIds: Set<number>,
    baseProjectileColor: string,
    newProjectileImpacts: ProjectileImpact[],
    createImpactThrottled: (x: number, y: number, effectiveNow: number, baseProjectileColor: string, hapticsEnabled: boolean) => ProjectileImpact
): GameState['trainingSimState'] {
    if (!state.trainingSimState) return null;
    if (state.projectiles.length === 0) return state.trainingSimState; // Early exit
    
    const SOUND_COOLDOWN = 30; // ms
    
    let updatedTargets: typeof state.trainingSimState.targets | null = null;
    // ✅ OPTIMIZATION: Track which indices have been cloned this frame to avoid double-cloning
    reusableClonedTrainingTargetIndices.clear();
    const clonedIndices = reusableClonedTrainingTargetIndices;

    // ✅ OPTIMIZATION: Pre-calculate constants to avoid repeated divisions
    const GAME_HEIGHT_INV = 1 / C.GAME_HEIGHT;
    const TARGET_VISUAL_RADIUS = 40;
    const SCALE_MIN = 0.4;
    const SCALE_RANGE = 0.6;

    const targets = state.trainingSimState.targets;
    const targetsLen = targets.length;
    const projectilesLen = state.projectiles.length;

    // ✅ CRITICAL PERFORMANCE FIX: For training mode, we have very few targets (5-10).
    // Iterating them directly is faster than using the SpatialGrid overhead.
    // O(Projectiles * Targets) is acceptable here because Targets is very small.
    
    for (let i = 0; i < projectilesLen; i++) {
        const proj = state.projectiles[i];
        if (destroyedProjectileIds.has(proj.id)) continue;

        // ✅ OPTIMIZATION: Pre-calculate projectile scale once per projectile
        const projScale = SCALE_MIN + (proj.y * GAME_HEIGHT_INV) * SCALE_RANGE;
        const scaledProjectileRadius = C.PROJECTILE_HITBOX_RADIUS * projScale;

        // Iterate targets directly (faster than grid for small N)
        for (let j = 0; j < targetsLen; j++) {
            const trainingTarget = targets[j];
            if (trainingTarget.isFailed) continue;
            if (destroyedProjectileIds.has(proj.id)) break;

            const dx = proj.x - trainingTarget.x;
            const dy = proj.y - trainingTarget.y;
            const distSq = dx * dx + dy * dy;

            const targetScale = SCALE_MIN + (trainingTarget.y * GAME_HEIGHT_INV) * SCALE_RANGE;
            const scaledTargetRadius = TARGET_VISUAL_RADIUS * targetScale;
            
            const combinedRadius = scaledProjectileRadius + scaledTargetRadius;
            const combinedRadiusSquared = combinedRadius * combinedRadius;
            
            if (distSq <= combinedRadiusSquared) {
                // Check cooldown against the original or updated target (doesn't matter for read)
                const currentTargetState = (updatedTargets && clonedIndices.has(j)) ? updatedTargets[j] : trainingTarget;
                if (effectiveNow < (currentTargetState.lastHitTime ?? 0) + C.TRAINING_TARGET_HIT_COOLDOWN) continue;
                
                // Create impact + destroy projectile
                newProjectileImpacts.push(createImpactThrottled(proj.x, proj.y, effectiveNow, baseProjectileColor, state.hapticsEnabled));
                destroyedProjectileIds.add(proj.id);
                
                // Initialize updatedTargets array only once per frame if hit detected
                if (!updatedTargets) {
                    updatedTargets = [...targets];
                }
                
                // ✅ OPTIMIZATION: Smart clone - only clone the target object ONCE per frame
                if (!clonedIndices.has(j)) {
                    updatedTargets[j] = { ...updatedTargets[j] };
                    clonedIndices.add(j);
                }
                
                const t = updatedTargets[j];
                t.lastHitTime = effectiveNow;
                t.remainingHits--;

                // Use module-level var for cross-frame throttling
                const canPlay = (effectiveNow - lastTrainingSoundTime) > SOUND_COOLDOWN;

                if (t.remainingHits < 0) {
                    t.isFailed = true;
                    t.isComplete = false;
                    if (canPlay) { playSound('trainingTargetFail'); lastTrainingSoundTime = effectiveNow; }
                } else if (t.remainingHits === 0) {
                    t.isComplete = true;
                    if (canPlay) { playSound('trainingTargetSuccess'); lastTrainingSoundTime = effectiveNow; }
                } else {
                    if (canPlay) { playSound('trainingTargetHit'); lastTrainingSoundTime = effectiveNow; }
                }
                
                break; // A projectile can only hit one target
            }
        }
    }
    
    // If nothing changed, avoid allocations and return original reference
    if (!updatedTargets) return state.trainingSimState;

    return { ...state.trainingSimState, targets: updatedTargets };
}

function generateJaggedLineSegments(startX: number, startY: number, endX: number, endY: number, maxOffset: number, numSegments: number): string {
    const points = [{ x: startX, y: startY }];
    const dx = endX - startX;
    const dy = endY - startY;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length === 0) {
        points.push({ x: endX, y: endY });
        return points.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
    }
    const normal = { x: -dy / length, y: dx / length };

    for (let i = 1; i < numSegments; i++) {
        const progress = i / numSegments;
        const pointOnLine = {
            x: startX + dx * progress,
            y: startY + dy * progress,
        };
        // Reduce offset near the start and end of the bolt for a more natural look
        const offsetMultiplier = Math.sin(progress * Math.PI);
        const offset = (Math.random() - 0.5) * maxOffset * offsetMultiplier;

        points.push({
            x: pointOnLine.x + normal.x * offset,
            y: pointOnLine.y + normal.y * offset,
        });
    }

    points.push({ x: endX, y: endY });
    return points.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
}


function handleAutomaticAbilities(
    state: GameState,
    effectiveNow: number,
    destroyedEnemyIds: Set<number>,
    destroyedConduits: EnemyType[],
    newExplosions: GameState['explosions'],
    newEmpArcs: GameState['empArcs'],
    // Initial values
    initialLastEmpFireTime: number,
    streakMultiplier: number,
): {
    score: number;
    currencyEarnedThisRun: number;
    enemiesDefeatedThisTick: number;
    lastEmpFireTime: number;
} {
    const { selectedHero, heroUpgrades, playerX, enemies, activePowerUps } = state;
    let lastEmpFireTime = initialLastEmpFireTime;
    let score = 0;
    let currencyEarnedThisRun = 0;
    let enemiesDefeatedThisTick = 0;

    // ✅ OPTIMIZATION: Cache state.status check
    const isNotBossBattle = state.status !== GameStatus.BossBattle;
    const isGamma = selectedHero === 'gamma';

    // --- GAMMA EMP ARC ABILITY ---
    if (isGamma && heroUpgrades.gamma_shield_hp_level >= 2 && activePowerUps.Shield) {
        const isL3 = heroUpgrades.gamma_shield_hp_level >= 3;
        const empRange = isL3 ? C.GAMMA_EMP_L3_RANGE : C.GAMMA_EMP_L2_RANGE;
        const empCooldown = isL3 ? C.GAMMA_EMP_L3_COOLDOWN : C.GAMMA_EMP_L2_COOLDOWN;

        if (effectiveNow > lastEmpFireTime + empCooldown) {
            // ✅ FIX: Start lightning from the bottom of the player ship, not the center
            const playerBottomY = C.PLAYER_Y_POSITION; // This is the bottom of the player ship
            
            let closestEnemy: EnemyType | null = null;
            let minDistanceSq = empRange * empRange;

            // Find the single closest enemy
            for (const enemy of enemies) {
                if (destroyedEnemyIds.has(enemy.id) || enemy.isBuffedByConduit) continue;
                const dx = enemy.x - playerX;
                const dy = (enemy.y + C.ENEMY_HEIGHT_HALF) - playerBottomY; // ✅ Use playerBottomY
                const distSq = dx * dx + dy * dy;
                if (distSq < minDistanceSq) {
                    minDistanceSq = distSq;
                    closestEnemy = enemy;
                }
            }

            if (closestEnemy) {
                lastEmpFireTime = effectiveNow;
                playSound('empArc');
                
                const target = closestEnemy;
                
                // ✅ FIX: Generate lightning from the bottom of the player ship
                const segments = generateJaggedLineSegments( 
                    playerX, 
                    playerBottomY,  // ✅ Start from bottom, not center
                    target.x, 
                    target.y + C.ENEMY_HEIGHT_HALF, 
                    20, 
                    10
                );
                const arc = pools.empArcs.get();
                Object.assign(arc, { id: getNextId(), segments, points: parseSegmentsString(segments), createdAt: effectiveNow });
                newEmpArcs.push(arc);
                
                const damage = Math.floor(400 + Math.random() * 201);

                // ✅ FIX: EMP arc strikes should NOT create lightning
                if (pendingEffects.length < MAX_PENDING_EFFECTS) {
                    pendingEffects.push({ 
                        x: target.x, 
                        y: target.y, 
                        text: `${damage}`, 
                        isCrit: true, 
                        isCorrosive: false, 
                        radius: undefined
                    });
                }

                const newHealth = (target.health ?? C.ENEMY_BASE_HEALTH) - damage;
                target.health = newHealth;
                target.lastHitTime = effectiveNow;

                if (newHealth <= 0 && !destroyedEnemyIds.has(target.id)) {
                    score += C.SCORE_PER_HIT;
                    currencyEarnedThisRun += Math.floor(C.CURRENCY_PER_KILL * streakMultiplier);
                    const exp = pools.explosions.get();
                    Object.assign(exp, { id: getNextId(), x: target.x, y: target.y, createdAt: effectiveNow });
                    populateExplosionParticles(exp.particles);
                    newExplosions.push(exp);
                    destroyedEnemyIds.add(target.id);
                    if (target.type === 'conduit') destroyedConduits.push(target);
                    playSound('explosion');
                    triggerHaptic('explosion', state.hapticsEnabled);
                    if (!target.isEncounterEnemy && isNotBossBattle) {
                        enemiesDefeatedThisTick++;
                    }
                }
            }
        }
    }

    return { score, currencyEarnedThisRun, enemiesDefeatedThisTick, lastEmpFireTime };
}


function handlePlayerProjectileCollisions(
    state: GameState,
    now: number,
    effectiveNow: number,
    grid: SpatialGrid,
    destroyedProjectileIds: Set<number>,
    destroyedEnemyIds: Set<number>,
    destroyedAsteroidIds: Set<number>,
    destroyedConduits: EnemyType[],
    newUpgradePartCollects: GameState['upgradePartCollects'],
    newPowerUps: PowerUpInterface[],
    newExplosions: GameState['explosions'],
    newRockImpacts: GameState['rockImpacts'],
    newProjectileImpacts: GameState['projectileImpacts'],
    initialValues: {
        boss: GameState['boss'],
        activeRareConsumable: GameState['activeRareConsumable'],
        trainingSimState: GameState['trainingSimState'],
        lastShieldClankTime: number,
        screenFlashStartTime: number,
        score: number,
        currencyEarnedThisRun: number,
        partsEarnedThisRun: number,
        wasBossHit: boolean,
        enemiesDefeatedThisTick: number,
        screenShake: GameState['screenShake'],
        streakMultiplier: number,
        baseProjectileColor: string,
    }
) {
    let { 
        boss, activeRareConsumable, trainingSimState, lastShieldClankTime,
        screenFlashStartTime, score, currencyEarnedThisRun, partsEarnedThisRun, wasBossHit,
        enemiesDefeatedThisTick, screenShake, streakMultiplier, baseProjectileColor
    } = initialValues;

    // ✅ MOBILE OPTIMIZATION: Throttle sound effects to prevent audio stutter
    let lastImpactSoundTime = 0;
    let lastExplosionSoundTime = 0;
    let lastCritSoundTime = 0;
    let lastCorrosiveSoundTime = 0;
    let lastBossHitSoundTime = 0;
    let lastPartCollectSoundTime = 0;
    const SOUND_COOLDOWN = 16; // ~1 frame at 60fps

    // ✅ MOBILE OPTIMIZATION: Throttle haptics - very expensive on mobile
    let lastHapticTime = 0;
    const HAPTIC_COOLDOWN = 50; // Only once per 50ms

    // Create a Set of linked enemy IDs from destroyed conduits for O(1) lookups.
    // ✅ CRITICAL PERFORMANCE: Manual loop instead of map().filter() chain to avoid two intermediate arrays
    reusableDestroyedConduitLinkedIds.clear();
    const destroyedConduitLinkedIds = reusableDestroyedConduitLinkedIds;
    const destroyedConduitsLen = destroyedConduits.length;
    for (let i = 0; i < destroyedConduitsLen; i++) {
        const linkedId = destroyedConduits[i].linkedEnemyId;
        if (linkedId != null) {
            destroyedConduitLinkedIds.add(linkedId);
        }
    }

    function createImpactThrottled(x: number, y: number, effectiveNow: number, baseProjectileColor: string, hapticsEnabled: boolean): ProjectileImpact {
        const impact = pools.projectileImpacts.get();
        impact.id = getNextId();
        impact.x = x;
        impact.y = y;
        impact.createdAt = effectiveNow;
        impact.color = baseProjectileColor;
        
        // ✅ Throttle sound - only play once per cooldown period
        if (effectiveNow - lastImpactSoundTime > SOUND_COOLDOWN) {
            playSound('projectileImpact');
            lastImpactSoundTime = effectiveNow;
        }
        
        // ✅ Throttle haptics - very expensive
        if (hapticsEnabled && effectiveNow - lastHapticTime > HAPTIC_COOLDOWN) {
            triggerHaptic('projectileImpact', hapticsEnabled);
            lastHapticTime = effectiveNow;
        }
        
        return impact;
    }

    let aoeProcessedThisTick = false; // NEW: throttle AOE chains within this tick
    const SHIELD_CLANK_COOLDOWN = 50; // ms
    
    function handleShieldedEnemyHit(proj: ProjectileType, effectiveNow: number) {
        destroyedProjectileIds.add(proj.id);
        
        if (effectiveNow > lastShieldClankTime + SHIELD_CLANK_COOLDOWN) {
            playSound('shieldClank');
            lastShieldClankTime = effectiveNow;
        }

        if (pendingShieldImpacts.length < MAX_PENDING_IMPACTS) {
            pendingShieldImpacts.push({
                x: proj.x,
                y: proj.y,
                time: effectiveNow
            });
        }
    }

    // ✅ OPTIMIZATION: Pre-compute crit chance once instead of recalculating in hot loops
    let critChance: number;
    if (state.status === GameStatus.TrainingSim) {
        critChance = 0;
    } else {
        critChance = state.activePowerUps.CritBoost ? C.CRITICAL_HIT_CHANCE * C.CRIT_BOOST_MODIFIER : C.CRITICAL_HIT_CHANCE;
        if (state.selectedHero === 'alpha') {
            const level = state.heroUpgrades.alpha_aoe_level;
            if (level > 0) {
                critChance += C.ALPHA_CRIT_CHANCE_BONUS + (C.HANGAR_ALPHA_UPGRADE_CONFIG[level - 1]?.critChanceBonus || 0);
            } else {
                critChance += C.ALPHA_CRIT_CHANCE_BONUS;
            }
        }
    }
    const isNotBossBattle = state.status !== GameStatus.BossBattle;
    
    const isAlphaL3 = state.selectedHero === 'alpha' && state.heroUpgrades.alpha_aoe_level >= 3;
    // ✅ OPTIMIZATION: Pre-compute alpha AOE multiplier once instead of recalculating in hot loops
    const alphaAoeMultiplier = state.selectedHero === 'alpha' && state.heroUpgrades.alpha_aoe_level > 0
        ? (C.HANGAR_ALPHA_UPGRADE_CONFIG[state.heroUpgrades.alpha_aoe_level - 1]?.effect || 0)
        : 0;
    const isCorrosive = state.activeRareConsumable?.type === 'corrosive';

    if (state.status === GameStatus.TrainingSim) {
        trainingSimState = handleTrainingTargetCollisions(
            state,
            effectiveNow,
            destroyedProjectileIds,
            baseProjectileColor,
            newProjectileImpacts,
            createImpactThrottled
        );
    }

    // ✅ CRITICAL PERFORMANCE: Manual loop instead of for...of to avoid iterator allocation
    const projectilesLen2 = state.projectiles.length;
    for (let i = 0; i < projectilesLen2; i++) {
        const proj = state.projectiles[i];
        if (destroyedProjectileIds.has(proj.id)) continue;
        
        // ✅ OPTIMIZATION: Mutate existing object instead of creating a new one
        const projCollidable = proj as unknown as Collidable;
        projCollidable.radius = C.PROJECTILE_HITBOX_RADIUS;
        const nearbyTargets = grid.getNearby(projCollidable);

        // ✅ CRITICAL PERFORMANCE: Manual loop instead of for...of to avoid iterator allocation
        const nearbyTargetsLen2 = nearbyTargets.length;
        for (let j = 0; j < nearbyTargetsLen2; j++) {
            const target = nearbyTargets[j];
            if (destroyedProjectileIds.has(proj.id)) break;

            if (boss && target.id === boss.id) {
                if (boss.phase === 'entering' || boss.isInvulnerable) {
                    newProjectileImpacts.push(createImpactThrottled(proj.x, proj.y, effectiveNow, baseProjectileColor, state.hapticsEnabled));
                    destroyedProjectileIds.add(proj.id);
                    if (effectiveNow > lastShieldClankTime + SHIELD_CLANK_COOLDOWN) { playSound('shieldClank'); lastShieldClankTime = effectiveNow; }
                    continue;
                }
                const bossHeight = boss.bossType === 'punisher' ? C.PUNISHER_HEIGHT : boss.bossType === 'warden' ? C.WARDEN_HEIGHT : C.OVERMIND_WIDTH;
                const bossCenterY = boss.y + bossHeight / 2;
                const bossProjectileRadiusSq = (target.radius + C.PROJECTILE_HITBOX_RADIUS) ** 2;
                if (checkCollision(boss.x, bossCenterY, proj.x, proj.y, bossProjectileRadiusSq)) {
                    newProjectileImpacts.push(createImpactThrottled(proj.x, proj.y, effectiveNow, baseProjectileColor, state.hapticsEnabled));
                    if (isCorrosive) {
                        if (effectiveNow - lastCorrosiveSoundTime > SOUND_COOLDOWN) {
                            playSound('corrosiveImpact');
                            lastCorrosiveSoundTime = effectiveNow;
                        }
                        if (!boss.debuffs?.corrosive) {
                            if (!boss.debuffs) boss.debuffs = {};
                            boss.debuffs.corrosive = { damagePerTick: C.CORROSIVE_DAMAGE_PER_TICK, ticksLeft: C.CORROSIVE_TOTAL_TICKS, lastTickTime: effectiveNow };
                        }
                    }
                    const isCrit = Math.random() < critChance;
                    let damage = calculateDamage(isCrit, isAlphaL3);
                    if (isCorrosive) { damage = Math.floor(damage * C.CORROSIVE_ROUNDS_IMPACT_MULTIPLIER); }
                    
                    let isInsightDamage = false;
                    if (state.hasHereticalInsight && (boss.phase === 'fury' || boss.phase === 'beam')) {
                        damage = Math.floor(damage * 2.0);
                        isInsightDamage = true;
                    }

                    const newHealth = boss.health - damage;
                    destroyedProjectileIds.add(proj.id);
                    score += C.BOSS_HIT_SCORE;
                    wasBossHit = true;
                    if (effectiveNow - lastBossHitSoundTime > SOUND_COOLDOWN) {
                        playSound('bossHit');
                        lastBossHitSoundTime = effectiveNow;
                    }
                    if (isCrit) {
                        if (effectiveNow - lastCritSoundTime > SOUND_COOLDOWN) {
                            playSound('criticalHit');
                            lastCritSoundTime = effectiveNow;
                        }
                    }
                    // ✅ FIX: Bosses should NOT create lightning
                    if (pendingEffects.length < MAX_PENDING_EFFECTS) {
                        pendingEffects.push({ 
                            x: proj.x, 
                            y: proj.y, 
                            text: `${damage}`, 
                            isCrit, 
                            isCorrosive, 
                            radius: isCrit ? C.CRITICAL_HIT_RADIUS * 1.2 : undefined,
                            isInsightDamage,
                        });
                    }
                    // ✅ OPTIMIZATION: Manual loop instead of filter() to avoid array allocation
                    const healthRatio = newHealth / boss.maxHealth;
                    let newDifficultyLevel = 0;
                    const thresholdsLen = C.BOSS_HEALTH_THRESHOLDS.length;
                    for (let i = 0; i < thresholdsLen; i++) {
                        if (healthRatio < C.BOSS_HEALTH_THRESHOLDS[i]) {
                            newDifficultyLevel++;
                        }
                    }
                    let phaseUpdates: Partial<typeof boss> = {};
                    if (newHealth <= 0) {
                        phaseUpdates = { phase: 'defeated', phaseStartTime: effectiveNow, explosionsFired: 0, lastExplosionTime: effectiveNow };
                        pools.enemies.releaseAll(state.enemies); state.enemies.length = 0; 
                        pools.weaverBeams.releaseAll(state.weaverBeams); state.weaverBeams.length = 0; 
                        state.bossLasers.length = 0;
                        playSound('gameOver'); triggerHaptic('bossDefeat', state.hapticsEnabled);
                        screenShake = applyShake(screenShake, C.SCREEN_SHAKE_MAGNITUDE_BOSS_DEATH, C.BOSS_DEFEATED_DURATION, now);
                    }
                    // ✅ OPTIMIZATION: Mutate directly instead of object spread
                    boss.health = newHealth;
                    boss.difficultyLevel = Math.max(boss.difficultyLevel, newDifficultyLevel);
                    Object.assign(boss, phaseUpdates);
                    continue;
                }
            }
            
            if ('size' in target && target.id !== 0) {
                const asteroid = target as unknown as AsteroidType;
                if (destroyedAsteroidIds.has(asteroid.id)) continue;
                
                if (asteroid.isBuffedByConduit) {
                    newProjectileImpacts.push(createImpactThrottled(proj.x, proj.y, effectiveNow, baseProjectileColor, state.hapticsEnabled));
                    destroyedProjectileIds.add(proj.id);
                    if (effectiveNow > lastShieldClankTime + SHIELD_CLANK_COOLDOWN) { playSound('shieldClank'); lastShieldClankTime = effectiveNow; }
                    const imp = pools.rockImpacts.get();
                    imp.id = getNextId(); imp.x = proj.x; imp.y = proj.y; imp.createdAt = effectiveNow;
                    newRockImpacts.push(imp);
                    continue;
                }

                const scale = calculatePerspectiveScale(asteroid.y);
                const scaledAsteroidRadius = asteroid.size * scale;
                const combinedRadiusSq = (scaledAsteroidRadius + C.PROJECTILE_HITBOX_RADIUS) ** 2;

                if (checkCollision(asteroid.x, asteroid.y, proj.x, proj.y, combinedRadiusSq)) {
                    newProjectileImpacts.push(createImpactThrottled(proj.x, proj.y, effectiveNow, baseProjectileColor, state.hapticsEnabled));
                    if (isCorrosive) {
                        if (effectiveNow - lastCorrosiveSoundTime > SOUND_COOLDOWN) {
                            playSound('corrosiveImpact');
                            lastCorrosiveSoundTime = effectiveNow;
                        }
                        if (!asteroid.debuffs?.corrosive) {
                            if (!asteroid.debuffs) asteroid.debuffs = {};
                            asteroid.debuffs.corrosive = { damagePerTick: C.CORROSIVE_DAMAGE_PER_TICK, ticksLeft: C.CORROSIVE_TOTAL_TICKS, lastTickTime: effectiveNow };
                        }
                    }
                    const isCrit = Math.random() < critChance;
                    let damage = calculateDamage(isCrit, isAlphaL3);
                    if (isCorrosive) { damage = Math.floor(damage * C.CORROSIVE_ROUNDS_IMPACT_MULTIPLIER); }
                    const newHealth = asteroid.health - damage;
                    asteroid.health = newHealth;
                    asteroid.lastHitTime = effectiveNow;
                    destroyedProjectileIds.add(proj.id);
                    const imp = pools.rockImpacts.get();
                    imp.id = getNextId(); imp.x = proj.x; imp.y = proj.y; imp.createdAt = effectiveNow;
                    newRockImpacts.push(imp);
                    if (effectiveNow - lastBossHitSoundTime > SOUND_COOLDOWN) {
                        playSound('bossHit');
                        lastBossHitSoundTime = effectiveNow;
                    }
                    if (isCrit) {
                        if (effectiveNow - lastCritSoundTime > SOUND_COOLDOWN) {
                            playSound('criticalHit');
                            lastCritSoundTime = effectiveNow;
                        }
                    }
                    // ✅ FIX: Asteroids should NOT create lightning
                    if (pendingEffects.length < MAX_PENDING_EFFECTS) {
                        pendingEffects.push({ 
                            x: proj.x, 
                            y: proj.y, 
                            text: `${damage}`, 
                            isCrit, 
                            isCorrosive, 
                            radius: isCrit ? asteroid.size * 1.5 : undefined
                        });
                    }
                    if (newHealth <= 0) {
                        destroyedAsteroidIds.add(asteroid.id);
                        if (asteroid.id !== -999) {
                            let sizeKey = (asteroid.size === C.ASTEROID_SIZES.medium.radius) ? 'medium' : (asteroid.size === C.ASTEROID_SIZES.large.radius) ? 'large' : 'small';
                            const stats = C.ASTEROID_SIZES[sizeKey];
                            score += stats.score; currencyEarnedThisRun += Math.floor(stats.currency * streakMultiplier);
                            if (state.bossesDefeated > 0 && Math.random() < stats.partChance) {
                                partsEarnedThisRun++; 
                                if (effectiveNow - lastPartCollectSoundTime > SOUND_COOLDOWN) {
                                    playSound('partCollect');
                                    lastPartCollectSoundTime = effectiveNow;
                                }
                                const up = pools.upgradeParts.get();
                                up.id = getNextId(); up.x = asteroid.x; up.y = asteroid.y; up.createdAt = effectiveNow; up.startX = asteroid.x; up.startY = asteroid.y;
                                newUpgradePartCollects.push(up);
                            }
                        }
                        if (effectiveNow - lastExplosionSoundTime > SOUND_COOLDOWN) {
                            playSound('explosion');
                            lastExplosionSoundTime = effectiveNow;
                        }
                        if (state.hapticsEnabled && effectiveNow - lastHapticTime > HAPTIC_COOLDOWN) {
                            triggerHaptic('explosion', state.hapticsEnabled);
                            lastHapticTime = effectiveNow;
                        }
                        screenShake = applyShake(screenShake, C.SCREEN_SHAKE_MAGNITUDE_EXPLOSION, C.SCREEN_SHAKE_DURATION_EXPLOSION, now);
                    }
                    continue;
                }
                
            } else if ('type' in target && target.id > 0) {
                const enemy = target as unknown as EnemyType;
                if (destroyedEnemyIds.has(enemy.id)) continue;
                if (!enemy.type) { continue; }
                
                const willHaveShieldCleared = destroyedConduitLinkedIds.has(enemy.id);
                const isActuallyShielded = enemy.isBuffedByConduit && !willHaveShieldCleared;
                
                const enemyCenterY = enemy.y + C.ENEMY_HEIGHT_HALF;
                const hitboxRadius = isActuallyShielded ? C.ENEMY_HITBOX_RADIUS * 0.4 : C.ENEMY_HITBOX_RADIUS;
                const combinedRadiusSquared = isActuallyShielded ? (hitboxRadius + C.PROJECTILE_HITBOX_RADIUS) ** 2 : C.SQUARED_PROJECTILE_ENEMY_RADIUS;
                
                if (checkCollision(enemy.x, enemyCenterY, proj.x, proj.y, combinedRadiusSquared)) {
                    newProjectileImpacts.push(createImpactThrottled(proj.x, proj.y, effectiveNow, baseProjectileColor, state.hapticsEnabled));
                    
                    if (isActuallyShielded) {
                        handleShieldedEnemyHit(proj, effectiveNow);
                        continue;
                    }

                    if (isCorrosive) {
                        if (effectiveNow - lastCorrosiveSoundTime > SOUND_COOLDOWN) {
                            playSound('corrosiveImpact');
                            lastCorrosiveSoundTime = effectiveNow;
                        }
                    }
                    if (isCorrosive && !enemy.debuffs?.corrosive) {
                        if (!enemy.debuffs) enemy.debuffs = {};
                        enemy.debuffs.corrosive = { damagePerTick: C.CORROSIVE_DAMAGE_PER_TICK, ticksLeft: C.CORROSIVE_TOTAL_TICKS, lastTickTime: effectiveNow };
                    }
                    const canBeCrit = enemy.type === 'standard' || enemy.type === 'dodger';
                    const isCrit = canBeCrit && Math.random() < critChance;
                    let damage = calculateDamage(isCrit, isAlphaL3);
                    if (isCorrosive) { damage = Math.floor(damage * C.CORROSIVE_ROUNDS_IMPACT_MULTIPLIER); }
                    
                    const newHealth = (enemy.health ?? C.ENEMY_BASE_HEALTH) - damage;
                    enemy.health = newHealth;
                    enemy.lastHitTime = effectiveNow;
                    destroyedProjectileIds.add(proj.id);

                    let critRadius = 0;
                    if (isCrit) {
                        critRadius = C.CRITICAL_HIT_RADIUS * (1 + alphaAoeMultiplier);
                    }
                    // ✅ FIX: Only standard/dodger enemies should create lightning
                    if (pendingEffects.length < MAX_PENDING_EFFECTS) {
                        pendingEffects.push({ 
                            x: enemy.x, 
                            y: enemy.y, 
                            text: `${damage}`, 
                            isCrit, 
                            isCorrosive, 
                            radius: isCrit ? critRadius : undefined
                        });
                    }

                    if (newHealth > 0) { 
                        if (effectiveNow - lastBossHitSoundTime > SOUND_COOLDOWN) {
                            playSound('bossHit');
                            lastBossHitSoundTime = effectiveNow;
                        }
                        continue; 
                    }
                    score += C.SCORE_PER_HIT; currencyEarnedThisRun += Math.floor(C.CURRENCY_PER_KILL * streakMultiplier); 
                    const exp = pools.explosions.get();
                    exp.id = getNextId(); exp.x = enemy.x; exp.y = enemy.y; exp.createdAt = effectiveNow;
                    populateExplosionParticles(exp.particles);
                    newExplosions.push(exp);
                    destroyedEnemyIds.add(enemy.id);
                    if (enemy.type === 'conduit') destroyedConduits.push(enemy);
                    if (effectiveNow - lastExplosionSoundTime > SOUND_COOLDOWN) {
                        playSound('explosion');
                        lastExplosionSoundTime = effectiveNow;
                    }
                    if (state.hapticsEnabled && effectiveNow - lastHapticTime > HAPTIC_COOLDOWN) {
                        triggerHaptic('explosion', state.hapticsEnabled);
                        lastHapticTime = effectiveNow;
                    }
                    screenShake = applyShake(screenShake, C.SCREEN_SHAKE_MAGNITUDE_EXPLOSION, C.SCREEN_SHAKE_DURATION_EXPLOSION, now);
                    screenFlashStartTime = now;
                    if (!enemy.isEncounterEnemy && isNotBossBattle) enemiesDefeatedThisTick++;
                    if (state.bossesDefeated > 0 && Math.random() < C.UPGRADE_PART_DROP_CHANCE_ENEMY) {
                        partsEarnedThisRun++; 
                        if (effectiveNow - lastPartCollectSoundTime > SOUND_COOLDOWN) {
                            playSound('partCollect');
                            lastPartCollectSoundTime = effectiveNow;
                        }
                        const up = pools.upgradeParts.get();
                        up.id = getNextId(); up.x = enemy.x; up.y = enemy.y; up.createdAt = effectiveNow; up.startX = enemy.x; up.startY = enemy.y;
                        newUpgradePartCollects.push(up);
                    }
                    if (isCrit) {
                        if (effectiveNow - lastCritSoundTime > SOUND_COOLDOWN) {
                            playSound('criticalHit');
                            lastCritSoundTime = effectiveNow;
                        }
                        if (state.hapticsEnabled && effectiveNow - lastHapticTime > HAPTIC_COOLDOWN) {
                            triggerHaptic('criticalHit', state.hapticsEnabled);
                            lastHapticTime = effectiveNow;
                        }
                        screenShake = applyShake(screenShake, C.SCREEN_SHAKE_MAGNITUDE_EXPLOSION * 1.2, C.SCREEN_SHAKE_DURATION_EXPLOSION * 1.2, now);
                        // NEW: Process AOE once per tick, and cap target scan to prevent jank
                        if (!aoeProcessedThisTick) {
                            // ✅ OPTIMIZATION: Reuse the module-scoped query object
                            aoeQueryObject.x = enemy.x;
                            aoeQueryObject.y = enemy.y;
                            aoeQueryObject.radius = critRadius;
                            const nearbyTargetsForCrit = grid.getNearby(aoeQueryObject);
                            const critRadiusSquared = critRadius ** 2;

                            const MAX_AOE_TARGETS = 12; // soft cap to protect frame time
                            let processed = 0;
                            for (const aoeTarget of nearbyTargetsForCrit) {
                                if (processed >= MAX_AOE_TARGETS) break;
                                if (!('type' in aoeTarget)) continue;
                                const otherEnemy = aoeTarget as unknown as EnemyType;
                                if (destroyedEnemyIds.has(otherEnemy.id)) continue;
                                if (((otherEnemy.x - enemy.x)**2 + (otherEnemy.y - enemy.y)**2) < critRadiusSquared) {
                                    processed++;
                                    score += C.SCORE_PER_HIT; currencyEarnedThisRun += Math.floor(C.CURRENCY_PER_KILL * streakMultiplier); 
                                    const critExp = pools.explosions.get();
                                    critExp.id = getNextId(); critExp.x = otherEnemy.x; critExp.y = otherEnemy.y; critExp.createdAt = effectiveNow;
                                    populateExplosionParticles(critExp.particles);
                                    newExplosions.push(critExp);
                                    destroyedEnemyIds.add(otherEnemy.id); 
                                    if (effectiveNow - lastExplosionSoundTime > SOUND_COOLDOWN) {
                                        playSound('explosion');
                                        lastExplosionSoundTime = effectiveNow;
                                    }
                                    if (!otherEnemy.isEncounterEnemy && isNotBossBattle) enemiesDefeatedThisTick++;
                                    if (pendingEffects.length < MAX_PENDING_EFFECTS) {
                                        // ✅ OPTIMIZATION: Reuse object instead of creating new one
                                        reusableAoeEffect.x = otherEnemy.x;
                                        reusableAoeEffect.y = otherEnemy.y;
                                        // ✅ MOBILE OPTIMIZATION: Use toString() instead of template literal (slightly faster)
                                        reusableAoeEffect.text = damage.toString();
                                        reusableAoeEffect.isCrit = true;
                                        reusableAoeEffect.isCorrosive = false;
                                        reusableAoeEffect.radius = undefined;
                                        pendingEffects.push({ ...reusableAoeEffect });
                                    }
                                }
                            }
                            aoeProcessedThisTick = true; // throttle further AOE expansions this tick
                        }
                    }
                    if (enemy.type !== 'conduit' && Math.random() < C.POWERUP_SPAWN_CHANCE_ON_ENEMY_DEATH) {
                        // ✅ OPTIMIZATION: Cache array and length as constants
                        const powerUpTypes: PowerUpInterface['powerUpType'][] = ['RapidFire', 'SpreadShot', 'Shield', 'ExtendedMag', 'AutoReload', 'CritBoost', 'ReloadBoost'];
                        const POWER_UP_TYPES_LENGTH = powerUpTypes.length;
                        const pu = pools.powerUps.get();
                        pu.id = getNextId(); pu.x = enemy.x; pu.y = enemy.y; pu.powerUpType = powerUpTypes[Math.floor(Math.random() * POWER_UP_TYPES_LENGTH)];
                        newPowerUps.push(pu);
                    }
                    continue;
                }
            }
        }
    }

    return {
        score, currencyEarnedThisRun, partsEarnedThisRun, wasBossHit, enemiesDefeatedThisTick,
        activeRareConsumable, trainingSimState, boss, lastShieldClankTime,
        screenFlashStartTime, screenShake
    };
}

function handlePlayerDamageCollisions(
    state: GameState,
    now: number,
    effectiveNow: number,
    grid: SpatialGrid,
    destroyedEnemyIds: Set<number>,
    destroyedAsteroidIds: Set<number>,
    destroyedEnemyProjectileIds: Set<number>,
    destroyedConduits: EnemyType[],
    newExplosions: GameState['explosions'],
    initialValues: {
        playerX: number,
        playerDied: boolean,
        playerDeathPosition: {x: number, y: number} | null,
        reviveTriggerTime: number,
        playerHitInvulnerableUntil: number,
        hasRevive: boolean,
        shieldBreakingUntil: number,
        activePowerUps: GameState['activePowerUps'],
        playerDebuffs: GameState['playerDebuffs'],
        lastShieldClankTime: number,
        screenShake: GameState['screenShake'],
        boss: GameState['boss'],
    }
) {
    let { 
        playerX, playerDied, playerDeathPosition, reviveTriggerTime,
        playerHitInvulnerableUntil, hasRevive, shieldBreakingUntil, activePowerUps,
        playerDebuffs, lastShieldClankTime, screenShake, boss
    } = initialValues;

    let enemiesKilledByHit = 0;
    let clearAllBeamsOnRevive = false;
    
    // ✅ OPTIMIZATION: Pre-compute player top Y position once
    const playerTopY = C.PLAYER_Y_POSITION - C.PLAYER_SPRITE_HEIGHT;
    const mainHitboxCenterY = playerTopY + C.PLAYER_HITBOX_MAIN_Y_OFFSET;
    const noseHitboxCenterY = playerTopY + C.PLAYER_HITBOX_NOSE_Y_OFFSET;
    const playerCenterY = C.PLAYER_Y_POSITION - C.PLAYER_SPRITE_HEIGHT / 2;
    
    const handlePlayerHit = () => {
        if (state.phaseShiftState.isActive) return false;
        if (effectiveNow < reviveTriggerTime + C.REVIVE_INVULNERABILITY_DURATION || shieldBreakingUntil > effectiveNow || effectiveNow < playerHitInvulnerableUntil) return false;
        triggerHaptic('playerDamage', state.hapticsEnabled);
        screenShake = applyShake(screenShake, C.SCREEN_SHAKE_MAGNITUDE_EXPLOSION * 1.5, C.SCREEN_SHAKE_DURATION_EXPLOSION, now);
        if (activePowerUps.Shield) {
            const newHp = (activePowerUps.Shield.hp ?? 1) - 1;
            if (newHp <= 0) { shieldBreakingUntil = effectiveNow + C.SHIELD_BREAK_ANIMATION_DURATION; playSound('shieldBreak'); delete activePowerUps.Shield; } 
            else {
                activePowerUps.Shield.hp = newHp;
                activePowerUps.Shield.lastHitTime = effectiveNow;
                
                const isGamma = state.selectedHero === 'gamma';
                playSound(isGamma ? 'gammaShieldHit' : 'shieldHit');

                playerHitInvulnerableUntil = effectiveNow + 250;
            }
            return false;
        }
        if (hasRevive) {
            playSound('revive');
            hasRevive = false;
            reviveTriggerTime = effectiveNow;
            
            // Mark entities for destruction instead of mutating state arrays.
            for (const enemy of state.enemies) {
                if (!enemy.isEncounterEnemy) {
                    destroyedEnemyIds.add(enemy.id);
                }
            }
            for (const proj of state.enemyProjectiles) {
                destroyedEnemyProjectileIds.add(proj.id);
            }
            for (const asteroid of state.asteroids) {
                if (asteroid.id !== -999) {
                    destroyedAsteroidIds.add(asteroid.id);
                }
            }
            
            // Signal to clear special effects that aren't in the main destruction sets.
            clearAllBeamsOnRevive = true;

            // These are safe as they are local to `resolveCollisions`.
            // ✅ OPTIMIZATION: Mutate directly instead of object spread
            if (boss?.beamFireStartTime) {
                boss.beamFireStartTime = undefined;
            }
            
            return false; // Player did not die
        }
        if (!playerDied) { playerDied = true; playerDeathPosition = { x: playerX, y: playerCenterY }; }
        return true;
    };
    
    if (!playerDied) {
        // ✅ OPTIMIZATION: Reuse the module-scoped query object
        playerMainHitboxCollidable.x = playerX;
        playerMainHitboxCollidable.y = mainHitboxCenterY;
        playerMainHitboxCollidable.radius = Math.max(C.PLAYER_HITBOX_MAIN_RADIUS, C.PLAYER_HITBOX_NOSE_RADIUS) + C.PLAYER_HITBOX_MAIN_Y_OFFSET; // Use a larger radius for broad-phase
        const nearbyToPlayer = grid.getNearby(playerMainHitboxCollidable);

        for (const target of nearbyToPlayer) {
            if (playerDied) break;
            if ('type' in target && target.id > 0) {
                const enemy = target as unknown as EnemyType;
                if (!destroyedEnemyIds.has(enemy.id)) {
                    const enemyCenterY = enemy.y + C.ENEMY_HEIGHT_HALF;
                    const hitboxRadius = enemy.isBuffedByConduit ? C.ENEMY_HITBOX_RADIUS * 0.4 : C.ENEMY_HITBOX_RADIUS;
                    const { mainSq, noseSq } = enemy.isBuffedByConduit ? { mainSq: (C.PLAYER_HITBOX_MAIN_RADIUS + hitboxRadius) ** 2, noseSq: (C.PLAYER_HITBOX_NOSE_RADIUS + hitboxRadius) ** 2 } : { mainSq: C.SQUARED_PLAYER_MAIN_ENEMY_RADIUS, noseSq: C.SQUARED_PLAYER_NOSE_ENEMY_RADIUS };
                    if (checkCollision(enemy.x, enemyCenterY, playerX, mainHitboxCenterY, mainSq) || checkCollision(enemy.x, enemyCenterY, playerX, noseHitboxCenterY, noseSq)) {
                         const exp = pools.explosions.get();
                         exp.id = getNextId(); exp.x = enemy.x; exp.y = enemy.y; exp.createdAt = effectiveNow;
                         populateExplosionParticles(exp.particles);
                         newExplosions.push(exp);
                         playSound('explosion'); triggerHaptic('explosion', state.hapticsEnabled);
                         screenShake = applyShake(screenShake, C.SCREEN_SHAKE_MAGNITUDE_EXPLOSION, C.SCREEN_SHAKE_DURATION_EXPLOSION, now);
                         destroyedEnemyIds.add(enemy.id);
                         if(enemy.type === 'conduit') destroyedConduits.push(enemy);
                         handlePlayerHit();
                    }
                    continue;
                }
            }
            if ('size' in target && target.id !== 0) {
                const asteroid = target as unknown as AsteroidType;
                if (!destroyedAsteroidIds.has(asteroid.id)) {
                    const scale = calculatePerspectiveScale(asteroid.y);
                    const scaledAsteroidRadius = asteroid.size * scale;
                    const mainSq = (C.PLAYER_HITBOX_MAIN_RADIUS + scaledAsteroidRadius) ** 2;
                    const noseSq = (C.PLAYER_HITBOX_NOSE_RADIUS + scaledAsteroidRadius) ** 2;
                    if (checkCollision(asteroid.x, asteroid.y, playerX, mainHitboxCenterY, mainSq) || checkCollision(asteroid.x, asteroid.y, playerX, noseHitboxCenterY, noseSq)) {
                        handlePlayerHit();
                    }
                    continue;
                }
            }
        }
    }
    if (!playerDied && boss?.bossType === 'overmind' && boss.beamFireStartTime && effectiveNow > boss.beamFireStartTime && effectiveNow < boss.beamFireStartTime + (boss.beamDuration || 0)) {
        const safeZoneStart = boss.safeSpotX ?? 0;
        const safeZoneEnd = safeZoneStart + C.OVERMIND_BEAM_SAFE_ZONE_WIDTH;
        if (playerX < safeZoneStart || playerX > safeZoneEnd) { handlePlayerHit(); }
    }
    if (!playerDied) {
        const playableLanes = state.laneCount - 1;
        if (playableLanes > 0 && state.bossLasers.length > 0) {
            const playerBounds = getPlayableGridBoundsAtY(C.PLAYER_Y_POSITION, state.laneCount);
            const playableWidthAtPlayer = playerBounds.maxX - playerBounds.minX;
            const laneWidthAtPlayer = playableWidthAtPlayer / playableLanes;

            const playerHalfWidth = C.PLAYER_WIDTH / 2;
            const playerStartX = playerX - playerHalfWidth;
            const playerEndX = playerX + playerHalfWidth;

            for (const laser of state.bossLasers) {
                if (effectiveNow >= laser.fireStartTime && effectiveNow < laser.fireStartTime + laser.duration) {
                    const laserHitboxWidth = laneWidthAtPlayer * C.PUNISHER_LASER_HITBOX_WIDTH_RATIO;
                    const laserLaneCenterX = playerBounds.minX + (laser.lane * laneWidthAtPlayer) + (laneWidthAtPlayer / 2);
                    
                    const laserHitboxStartX = laserLaneCenterX - (laserHitboxWidth / 2);
                    const laserHitboxEndX = laserLaneCenterX + (laserHitboxWidth / 2);
                    
                    if (playerEndX > laserHitboxStartX && playerStartX < laserHitboxEndX) {
                        if (handlePlayerHit()) {
                            break;
                        }
                    }
                }
            }
        }
    }
    if (!playerDied) for (const beam of state.weaverBeams) { if (playerCenterY > beam.y - C.WEAVER_BEAM_HITBOX_HEIGHT / 2 && playerCenterY < beam.y + C.WEAVER_BEAM_HITBOX_HEIGHT / 2) if (handlePlayerHit()) break; }
    // ✅ OPTIMIZATION: Mutate directly instead of object spread
    // ✅ OPTIMIZATION: Use squared distance and early exit for weaver surge collision
    if (!playerDied && state.weaverSurges.length > 0) {
        const hitRadius = 10 + C.PLAYER_HITBOX_MAIN_RADIUS;
        const hitRadiusSq = hitRadius * hitRadius;
        for (const surge of state.weaverSurges) {
            const dy = surge.y - playerCenterY;
            const distSq = dy * dy;
            if (distSq < hitRadiusSq) {
                if (!playerDebuffs) playerDebuffs = {};
                playerDebuffs.slow = { expiresAt: effectiveNow + C.PLAYER_SLOW_DURATION };
                break; // Only need to apply slow once
            }
        }
    }
    if (!playerDied) for (const proj of state.enemyProjectiles) {
        if (destroyedEnemyProjectileIds.has(proj.id)) continue;
        if (checkCollision(proj.x, proj.y, playerX, mainHitboxCenterY, C.SQUARED_ENEMY_PROJECTILE_PLAYER_MAIN_RADIUS) || checkCollision(proj.x, proj.y, playerX, noseHitboxCenterY, C.SQUARED_ENEMY_PROJECTILE_PLAYER_NOSE_RADIUS)) {
            destroyedEnemyProjectileIds.add(proj.id);
            if (handlePlayerHit()) break;
        }
    }
    if (!playerDied) {
        for (const enemy of state.enemies) {
            if (destroyedEnemyIds.has(enemy.id)) continue;
            if (enemy.y >= C.PLAYER_Y_POSITION) {
                const exp = pools.explosions.get();
                exp.id = getNextId(); exp.x = enemy.x; exp.y = enemy.y; exp.createdAt = effectiveNow;
                populateExplosionParticles(exp.particles);
                newExplosions.push(exp);
                playSound('explosion');
                if (handlePlayerHit()) break;
            }
        }
    }

    return { 
        playerDied, playerDeathPosition, reviveTriggerTime, playerHitInvulnerableUntil, hasRevive, 
        shieldBreakingUntil, activePowerUps, playerDebuffs, lastShieldClankTime, screenShake, boss,
        enemiesKilledByEmp: enemiesKilledByHit,
        clearAllBeamsOnRevive,
    };
}

function handlePlayerCollection(
    state: GameState,
    effectiveNow: number,
    playerDied: boolean,
    playerX: number,
    activePowerUps: GameState['activePowerUps'], // mutable
): {
    newReloadBoosts: number;
    collectedPowerUpIds: Set<number>;
    collectedUpgradePartIds: Set<number>;
    newInGameMessages: GameState['inGameMessages'];
    newPowerUpInfusions: GameState['powerUpInfusions'];
} {
    let newReloadBoosts = 0;
    reusableCollectedPowerUpIds.clear();
    reusableCollectedUpgradePartIds.clear();
    const collectedPowerUpIds = reusableCollectedPowerUpIds;
    const collectedUpgradePartIds = reusableCollectedUpgradePartIds;
    const newInGameMessages: GameState['inGameMessages'] = [];
    const newPowerUpInfusions: GameState['powerUpInfusions'] = [];

    const powerUpSoundMap: Record<PowerUpType, SoundName> = {
        RapidFire: 'powerUpRapidFire',
        SpreadShot: 'powerUpSpreadShot',
        Shield: 'powerUpShield',
        ExtendedMag: 'powerUpExtendedMag',
        AutoReload: 'powerUpAutoReload',
        CritBoost: 'powerUpCritBoost',
        ReloadBoost: 'powerUpReloadBoost',
    };

    if (!playerDied) {
        // ✅ OPTIMIZATION: Pre-compute player top Y position once
        const playerTopY = C.PLAYER_Y_POSITION - C.PLAYER_SPRITE_HEIGHT;
        const mainHitboxCenterY = playerTopY + C.PLAYER_HITBOX_MAIN_Y_OFFSET;
        const noseHitboxCenterY = playerTopY + C.PLAYER_HITBOX_NOSE_Y_OFFSET;
        
        for (const p of state.powerUps) {
            const hitMain = checkCollision(p.x, p.y, playerX, mainHitboxCenterY, C.SQUARED_POWERUP_PLAYER_MAIN_RADIUS);
            const hitNose = checkCollision(p.x, p.y, playerX, noseHitboxCenterY, C.SQUARED_POWERUP_PLAYER_NOSE_RADIUS);

            if (hitMain || hitNose) {
                collectedPowerUpIds.add(p.id);
                const pui = pools.powerUpInfusions.get();
                pui.id = getNextId(); pui.createdAt = effectiveNow; pui.powerUpType = p.powerUpType;
                newPowerUpInfusions.push(pui);
                const powerUpNameMap: Record<PowerUpInterface['powerUpType'], string> = { RapidFire: 'RAPID FIRE', SpreadShot: 'SPREAD SHOT', Shield: 'SHIELD ACTIVE', ExtendedMag: 'EXTENDED MAG', AutoReload: 'AUTO-RELOAD', CritBoost: 'CRITICAL BOOST', ReloadBoost: 'RELOAD BOOST' };
                const msg = pools.inGameMessages.get();
                msg.id = getNextId(); msg.text = powerUpNameMap[p.powerUpType]; msg.createdAt = effectiveNow; msg.duration = 2500; msg.style = 'achievement';
                newInGameMessages.push(msg);
                if (p.powerUpType === 'Shield') {
                    const maxHp = (state.selectedHero === 'gamma' && state.heroUpgrades.gamma_shield_hp_level > 0 ? C.HANGAR_GAMMA_UPGRADE_CONFIG[state.heroUpgrades.gamma_shield_hp_level - 1].effect : 1);
                    // ✅ OPTIMIZATION: Mutate directly instead of object spread
                    const oldHp = activePowerUps.Shield?.hp;
                    const isRefill = oldHp !== undefined && oldHp < maxHp;
                    if (activePowerUps.Shield) {
                        activePowerUps.Shield.expiresAt = Infinity;
                        activePowerUps.Shield.hp = maxHp;
                        activePowerUps.Shield.lastRefillTime = isRefill ? effectiveNow : undefined;
                        activePowerUps.Shield.hpBeforeRefill = isRefill ? oldHp : undefined;
                        // createdAt stays the same if it exists
                    } else {
                        activePowerUps.Shield = { expiresAt: Infinity, hp: maxHp, createdAt: effectiveNow };
                    }
                } else if (p.powerUpType === 'ReloadBoost') {
                    newReloadBoosts++;
                } else {
                    activePowerUps[p.powerUpType] = { expiresAt: effectiveNow + C.POWERUP_DURATION, createdAt: effectiveNow };
                }
                
                const soundToPlay = powerUpSoundMap[p.powerUpType];
                if (soundToPlay) {
                    playSound(soundToPlay);
                }
            }
        }
    }
    
    for (const p of state.upgradePartCollects) {
        const elapsed = effectiveNow - p.createdAt;
        if (elapsed > C.UPGRADE_PART_ANIMATION_DURATION) {
            collectedUpgradePartIds.add(p.id);
        }
    }
    
    return { newReloadBoosts, collectedPowerUpIds, collectedUpgradePartIds, newInGameMessages, newPowerUpInfusions };
}


export function resolveCollisions(state: GameState, now: number, effectiveNow: number, grid: SpatialGrid) {
    pendingEffects.length = 0;
    
    // ✅ MOBILE OPTIMIZATION: Clear and reuse Sets instead of allocating new ones
    reusableDestroyedEnemyIds.clear();
    reusableDestroyedProjectileIds.clear();
    reusableDestroyedAsteroidIds.clear();
    reusableDestroyedEnemyProjectileIds.clear();
    const destroyedEnemyIds = reusableDestroyedEnemyIds;
    const destroyedProjectileIds = reusableDestroyedProjectileIds;
    const destroyedAsteroidIds = reusableDestroyedAsteroidIds;
    const destroyedEnemyProjectileIds = reusableDestroyedEnemyProjectileIds;
    const destroyedConduits = arrayPools.tempEnemies.get();
    
    const newExplosions: GameState['explosions'] = [];
    const newDamageNumbers: GameState['damageNumbers'] = [];
    const newRockImpacts: GameState['rockImpacts'] = [];
    const newProjectileImpacts: GameState['projectileImpacts'] = [];
    const newCriticalHits: GameState['criticalHits'] = [];
    const newGibs: GameState['gibs'] = [];
    const newShellCasings: GameState['shellCasings'] = [];
    const newUpgradePartCollects: GameState['upgradePartCollects'] = [];
    const newPowerUps: PowerUpInterface[] = [];
    const newEmpArcs: GameState['empArcs'] = [];

    // ✅ OPTIMIZATION: Direct mutation instead of expensive deep clone
    // Since we return a new state object, we can safely mutate the original activePowerUps
    const activePowerUps = state.activePowerUps;

    const streakMultiplier = 1 + state.levelStreakThisRun * getStreakBonus(state.isHardMode);

    const abilityResults = handleAutomaticAbilities(
        state, effectiveNow, destroyedEnemyIds, destroyedConduits,
        newExplosions, newEmpArcs, state.lastEmpFireTime, streakMultiplier
    );

    const projectileResults = handlePlayerProjectileCollisions(
        state, now, effectiveNow, grid,
        destroyedProjectileIds, destroyedEnemyIds, destroyedAsteroidIds, destroyedConduits, newUpgradePartCollects, newPowerUps,
        newExplosions, newRockImpacts, newProjectileImpacts,
        {
            boss: state.boss, activeRareConsumable: state.activeRareConsumable, trainingSimState: state.trainingSimState,
            lastShieldClankTime: state.lastShieldClankTime, screenFlashStartTime: state.screenFlashStartTime, score: state.score,
            currencyEarnedThisRun: state.currencyEarnedThisRun, partsEarnedThisRun: state.partsEarnedThisRun,
            wasBossHit: state.wasBossHit, enemiesDefeatedThisTick: 0, screenShake: state.screenShake,
            streakMultiplier, baseProjectileColor: getProjectileColor(state)
        }
    );

    projectileResults.score += abilityResults.score;
    projectileResults.currencyEarnedThisRun += abilityResults.currencyEarnedThisRun;
    projectileResults.enemiesDefeatedThisTick += abilityResults.enemiesDefeatedThisTick;

    const damageResults = handlePlayerDamageCollisions(
        state, now, effectiveNow, grid,
        destroyedEnemyIds, destroyedAsteroidIds, destroyedEnemyProjectileIds, destroyedConduits, newExplosions,
        {
            playerX: state.playerX, playerDied: false, playerDeathPosition: null, reviveTriggerTime: state.reviveTriggerTime,
            playerHitInvulnerableUntil: state.playerHitInvulnerableUntil, hasRevive: state.hasRevive,
            shieldBreakingUntil: state.shieldBreakingUntil, activePowerUps, playerDebuffs: state.playerDebuffs,
            lastShieldClankTime: projectileResults.lastShieldClankTime, screenShake: projectileResults.screenShake,
            boss: projectileResults.boss,
        }
    );

    const collectionResults = handlePlayerCollection(
        state, effectiveNow, damageResults.playerDied, state.playerX, 
        activePowerUps
    );
    
    // ✅ REFACTOR: Use extracted weaver beam collision module
    const newDuplicatedProjectiles = handleWeaverBeamCollisions(
        state,
        effectiveNow,
        destroyedEnemyProjectileIds
    );

    // ✅ REFACTOR: Use extracted conduit debuff module
    const debuffUpdates = processConduitDebuffs(
        state,
        effectiveNow,
        destroyedConduits,
        newCriticalHits
    );
    
    const filtered = filterDestroyedEntities(state, damageResults.boss, destroyedProjectileIds, destroyedEnemyIds, destroyedAsteroidIds, destroyedEnemyProjectileIds, collectionResults.collectedPowerUpIds, collectionResults.collectedUpgradePartIds);
    
    // ✅ REFACTOR: Use extracted conduit debuff application
    applyConduitDebuffs(filtered, debuffUpdates);

    arrayPools.tempEnemies.release(destroyedConduits);
    
    // Process batched effects at the end of the collision phase.
    processBatchedCollisionEffects(effectiveNow, newDamageNumbers, newCriticalHits);
    processBatchedShieldImpacts(newRockImpacts);

    const onExplosionRelease = (exp: GameState['explosions'][0]) => {
        if (exp.particles.length > 0) {
            pools.splatterParticles.releaseAll(exp.particles);
            exp.particles.length = 0;
        }
    };
    
    const { clearAllBeamsOnRevive } = damageResults;
    let finalWeaverBeams: GameState['weaverBeams'] = state.weaverBeams;
    let finalWeaverSurges: GameState['weaverSurges'] = state.weaverSurges;
    let finalBossLasers: GameState['bossLasers'] = state.bossLasers;

    if (clearAllBeamsOnRevive) {
        pools.weaverBeams.releaseAll(finalWeaverBeams);
        finalWeaverBeams = [];
        pools.weaverSurges.releaseAll(finalWeaverSurges);
        finalWeaverSurges = [];
        finalBossLasers = [];
    } else {
        // Filter by time/position to fix memory leaks
        finalWeaverBeams = filterAndPool(state.weaverBeams, b => effectiveNow - b.createdAt < C.WEAVER_BEAM_DURATION, pools.weaverBeams);
        finalWeaverSurges = filterAndPool(state.weaverSurges, s => s.y < C.GAME_GRID_HEIGHT + C.GAME_HEIGHT_BUFFER, pools.weaverSurges);
    }
    
    if (damageResults.shieldBreakingUntil > 0) {
        clearPlayerRenderCache();
    }
    
    const finalEnemiesDefeated = projectileResults.enemiesDefeatedThisTick + damageResults.enemiesKilledByEmp;

    // ✅ REFACTOR: Use extracted orphaned shield cleanup module
    cleanupOrphanedConduitShields(filtered, effectiveNow);

    return { 
        ...filtered,
        score: projectileResults.score,
        currencyEarnedThisRun: projectileResults.currencyEarnedThisRun,
        partsEarnedThisRun: projectileResults.partsEarnedThisRun,
        wasBossHit: projectileResults.wasBossHit,
        enemiesDefeatedThisTick: finalEnemiesDefeated,
        activeRareConsumable: projectileResults.activeRareConsumable,
        trainingSimState: projectileResults.trainingSimState,
        lightning: null,
        lastShieldClankTime: damageResults.lastShieldClankTime,
        screenFlashStartTime: projectileResults.screenFlashStartTime,
        screenShake: damageResults.screenShake,
        playerDied: damageResults.playerDied,
        playerDeathPosition: damageResults.playerDeathPosition,
        reviveTriggerTime: damageResults.reviveTriggerTime,
        playerHitInvulnerableUntil: damageResults.playerHitInvulnerableUntil,
        hasRevive: damageResults.hasRevive,
        shieldBreakingUntil: damageResults.shieldBreakingUntil,
        activePowerUps: damageResults.activePowerUps,
        playerDebuffs: damageResults.playerDebuffs,
        lastEmpFireTime: abilityResults.lastEmpFireTime,
        reloadBoosts: state.reloadBoosts + collectionResults.newReloadBoosts,
        powerUps: appendArray(filtered.powerUps, newPowerUps),
        enemyProjectiles: appendArray(filtered.enemyProjectiles, newDuplicatedProjectiles),
        
        // Return final filtered effect arrays
        bossLasers: finalBossLasers,
        weaverBeams: finalWeaverBeams,
        weaverSurges: finalWeaverSurges,
        explosions: filterAndPoolAndAppend(
            state.explosions,
            e => effectiveNow - e.createdAt < 500,
            pools.explosions,
            newExplosions,
            onExplosionRelease
        ),
        damageNumbers: filterAndPoolAndAppend(
            state.damageNumbers,
            d => effectiveNow - d.createdAt < C.DAMAGE_NUMBER_LIFETIME,
            pools.damageNumbers,
            newDamageNumbers
        ),
        rockImpacts: filterAndPoolAndAppend(
            state.rockImpacts,
            i => effectiveNow - i.createdAt < 300,
            pools.rockImpacts,
            newRockImpacts
        ),
        projectileImpacts: filterAndPoolAndAppend(
            state.projectileImpacts,
            i => effectiveNow - i.createdAt < 300,
            pools.projectileImpacts,
            newProjectileImpacts
        ),
        criticalHits: filterAndPoolAndAppend(
            state.criticalHits,
            c => effectiveNow - c.createdAt < C.CRITICAL_HIT_DURATION,
            pools.criticalHits,
            newCriticalHits
        ),
        gibs: filterAndPoolAndAppend(
            state.gibs,
            g => effectiveNow - g.createdAt < C.GIB_LIFETIME,
            pools.gibs,
            newGibs
        ),
        shellCasings: filterAndPoolAndAppend(
            state.shellCasings,
            s => effectiveNow - s.createdAt < C.SHELL_LIFETIME,
            pools.shellCasings,
            newShellCasings
        ),
        empArcs: filterAndPoolAndAppend(
            state.empArcs,
            a => effectiveNow - a.createdAt < C.EMP_ARC_DURATION,
            pools.empArcs,
            newEmpArcs
        ),
        powerUpInfusions: filterAndPoolAndAppend(
            state.powerUpInfusions,
            i => effectiveNow - i.createdAt < C.POWERUP_INFUSION_DURATION,
            pools.powerUpInfusions,
            collectionResults.newPowerUpInfusions
        ),
        inGameMessages: appendArray(state.inGameMessages, collectionResults.newInGameMessages),
        upgradePartCollects: appendArray(filtered.upgradePartCollects, newUpgradePartCollects),
    }; 
}