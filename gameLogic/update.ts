import type { GameState, Projectile, ShellCasing } from '../types';
import { GameStatus } from '../types';
import * as C from '../constants';
import { pools } from '../state/pools';
import { clampHorizontalPosition } from './positioning';
import { getNextId } from './engine';
import { playSound } from '../sounds';
import { HARD_MODE_MULTIPLIERS } from './config';
import { IS_MOBILE } from '../constants';
import { easeOutQuad } from '../utils/easing';
import { calculatePerspectiveScale } from '../utils/perspective';

// ✅ OPTIMIZATION: Cache Math.sin() and Math.cos() calculations for enemy oscillation and projectile movement
// Quantize phase angles to reduce cache size while maintaining accuracy
const SIN_CACHE_QUANTIZATION = 0.01; // Quantize to 0.01 radians (~0.57 degrees)
const sinCache = new Map<number, number>();
const cosCache = new Map<number, number>();
const MAX_SIN_CACHE_SIZE = 10000; // Increased from 1000 to handle asteroid field with many asteroids
// ✅ PERFORMANCE: Cache frequently used math constant
const PI_OVER_180 = Math.PI / 180;

export function getCachedSin(phaseAngle: number): number {
    // Quantize the phase angle to reduce cache size
    const quantized = Math.round(phaseAngle / SIN_CACHE_QUANTIZATION) * SIN_CACHE_QUANTIZATION;
    
    // Normalize to [0, 2π) for better cache hit rate (sin is periodic)
    const normalized = quantized % (2 * Math.PI);
    const normalizedPositive = normalized < 0 ? normalized + 2 * Math.PI : normalized;
    
    if (sinCache.has(normalizedPositive)) {
        return sinCache.get(normalizedPositive)!;
    }
    
    // Calculate and cache
    const value = Math.sin(normalizedPositive);
    
    // Prevent cache from growing too large
    if (sinCache.size >= MAX_SIN_CACHE_SIZE) {
        // Clear cache if it gets too large (simple strategy - could be improved with LRU)
        sinCache.clear();
    }
    
    sinCache.set(normalizedPositive, value);
    return value;
}

export function getCachedCos(phaseAngle: number): number {
    // Quantize the phase angle to reduce cache size
    const quantized = Math.round(phaseAngle / SIN_CACHE_QUANTIZATION) * SIN_CACHE_QUANTIZATION;
    
    // Normalize to [0, 2π) for better cache hit rate (cos is periodic)
    const normalized = quantized % (2 * Math.PI);
    const normalizedPositive = normalized < 0 ? normalized + 2 * Math.PI : normalized;
    
    if (cosCache.has(normalizedPositive)) {
        return cosCache.get(normalizedPositive)!;
    }
    
    // Calculate and cache
    const value = Math.cos(normalizedPositive);
    
    // Prevent cache from growing too large
    if (cosCache.size >= MAX_SIN_CACHE_SIZE) {
        // Clear cache if it gets too large (simple strategy - could be improved with LRU)
        cosCache.clear();
    }
    
    cosCache.set(normalizedPositive, value);
    return value;
}

/**
 * Updates player position, velocity, and handles shooting logic.
 */
export function updatePlayer(state: GameState, pressedKeys: Set<string>, delta: number, now: number, effectiveNow: number, shootingDisabled: boolean = false) {
    let { 
        playerVx, playerX, ammo, reloadCompleteTime, playedEmptyClipSound,
        lastPlayerShotTime, lastTridentShotTime, activePowerUps, reloadBoosts,
        touchState, playerDebuffs, activeRareConsumable
    } = state;
    
    const newProjectiles: Projectile[] = [];
    const newShellCasings: ShellCasing[] = [];

    // ✅ OPTIMIZATION: Use cached isPlayerSlowed from state (calculated once per frame)
    const isSlowed = state.isPlayerSlowed;

    // --- Player Movement & Stats ---
    const genUpgrades = state.generalUpgrades;
    let speedBonus = 0;
    if (genUpgrades.movement_speed_level > 0) {
        speedBonus = C.HANGAR_GENERAL_UPGRADE_CONFIG.movement_speed_level[genUpgrades.movement_speed_level - 1].effect;
    }
    let reloadBonus = 0;
    if (genUpgrades.reload_speed_level > 0) {
        reloadBonus = C.HANGAR_GENERAL_UPGRADE_CONFIG.reload_speed_level[genUpgrades.reload_speed_level - 1].effect;
    }
    
    let maxSpeed = C.PLAYER_MAX_SPEED * (1 + speedBonus);
    let acceleration = state.selectedHero === 'beta' ? C.PLAYER_ACCELERATION * C.BETA_ACCELERATION_MODIFIER : C.PLAYER_ACCELERATION;
    
    if (state.hasPermanentSpeedBoost) {
        maxSpeed *= C.SPEED_BOOST_MODIFIER;
        acceleration *= C.SPEED_BOOST_MODIFIER;
    }
    
    if (isSlowed) {
        maxSpeed *= C.PLAYER_MOVEMENT_SLOW_MULTIPLIER;
        acceleration *= C.PLAYER_MOVEMENT_SLOW_MULTIPLIER; // Reduced acceleration for sluggish feel
    }

    const friction = state.selectedHero === 'beta' ? C.PLAYER_FRICTION * C.BETA_ACCELERATION_MODIFIER : C.PLAYER_FRICTION;

    if (touchState.isActive && touchState.currentX !== null) {
        // Use a Proportional-Derivative controller for smooth, responsive touch movement.
        const targetX = touchState.currentX - touchState.offsetX;
        const dx = targetX - playerX;

        // Gain determines responsiveness, Damping prevents wobble.
        const gain = 25;
        const damping = 3;

        const force = (dx * gain) - (playerVx * damping);
        
        // Scale by acceleration upgrades and apply the force.
        // This bypasses the normal friction when under touch control, as damping handles braking.
        playerVx += force * (acceleration / C.PLAYER_ACCELERATION) * delta;

    } else {
        // Keyboard controls & no-input friction
        const moveLeft = pressedKeys.has('ArrowLeft');
        const moveRight = pressedKeys.has('ArrowRight');
        
        if (moveLeft) {
            playerVx -= acceleration * delta;
        } else if (moveRight) {
            playerVx += acceleration * delta;
        } else {
            // Apply friction only when there is no keyboard input and no active touch.
            playerVx -= playerVx * friction * delta;
        }
    }
    
    // Bring ship to a complete stop at low velocities to prevent drifting
    if (Math.abs(playerVx) < 1 && !touchState.isActive && !pressedKeys.has('ArrowLeft') && !pressedKeys.has('ArrowRight')) {
        playerVx = 0;
    }

    // Clamp to max speed and update position
    playerVx = Math.max(-maxSpeed, Math.min(maxSpeed, playerVx));
    playerX = state.playerX + playerVx * delta;
    
    // Allow the player's center to reach the boundaries for a wider feel.
    playerX = clampHorizontalPosition(playerX, C.PLAYER_Y_POSITION, 0, state.laneCount);

    // --- Phase Shift Logic ---
    let finalPhaseShiftState = state.phaseShiftState;
    if (state.selectedHero === 'beta' && state.heroUpgrades.beta_homing_level >= 3) {
        const isAtMaxSpeed = Math.abs(playerVx) >= maxSpeed * 0.90;

        // Handle state transitions (deactivation)
        if (finalPhaseShiftState.isActive && effectiveNow > finalPhaseShiftState.activeUntil) {
            finalPhaseShiftState = {
                ...finalPhaseShiftState,
                isActive: false,
                cooldownUntil: effectiveNow + C.BETA_L3_PHASE_SHIFT_COOLDOWN,
            };
            playSound('phaseShiftDeactivate');
        }

        // Handle charging and activation
        if (!finalPhaseShiftState.isActive && effectiveNow > finalPhaseShiftState.cooldownUntil) {
            const newDistance = isAtMaxSpeed
                ? finalPhaseShiftState.distanceTraveledAtMaxSpeed + Math.abs(playerVx * delta)
                : 0;

            if (newDistance >= C.BETA_L3_PHASE_SHIFT_DISTANCE_THRESHOLD) {
                finalPhaseShiftState = {
                    ...finalPhaseShiftState,
                    isActive: true,
                    activeUntil: effectiveNow + C.BETA_L3_PHASE_SHIFT_DURATION,
                    distanceTraveledAtMaxSpeed: 0,
                };
                playSound('phaseShiftActivate');
            } else if (newDistance !== finalPhaseShiftState.distanceTraveledAtMaxSpeed) {
                 finalPhaseShiftState = {
                    ...finalPhaseShiftState,
                    distanceTraveledAtMaxSpeed: newDistance,
                };
            }
        }
    } else {
        // Reset state if not the correct hero/upgrade level
        if (finalPhaseShiftState.distanceTraveledAtMaxSpeed > 0 || finalPhaseShiftState.isActive || (finalPhaseShiftState.cooldownUntil > 0 && effectiveNow > finalPhaseShiftState.cooldownUntil)) {
            finalPhaseShiftState = { isActive: false, activeUntil: 0, cooldownUntil: 0, distanceTraveledAtMaxSpeed: 0 };
        }
    }


    // --- Player Shooting ---
    if (shootingDisabled) {
        // Return early to prevent any shooting logic from running
        return { playerVx, playerX, ammo, lastPlayerShotTime, lastTridentShotTime, newProjectiles, newShellCasings, playedEmptyClipSound, reloadCompleteTime, phaseShiftState: finalPhaseShiftState, activeRareConsumable };
    }
    
    let shootInterval = (activePowerUps.RapidFire || state.hasPermanentRapidFire) ? C.RAPID_FIRE_AUTOSHOOT_INTERVAL : C.PLAYER_AUTOSHOOT_INTERVAL;
    if (isSlowed) {
        shootInterval *= C.PLAYER_FIRERATE_SLOW_MULTIPLIER;
    }

    const isReloading = reloadCompleteTime > effectiveNow;

    if (effectiveNow - lastPlayerShotTime > shootInterval) {
        if (ammo > 0 && !isReloading) {

            if (activeRareConsumable?.type === 'corrosive') {
                const newShotsLeft = activeRareConsumable.shotsLeft - 1;
                if (newShotsLeft <= 0) {
                    activeRareConsumable = null;
                } else {
                    // ✅ OPTIMIZATION: Mutate directly instead of creating new object
                    activeRareConsumable.shotsLeft = newShotsLeft;
                }
            }
            
            const createAndAddProjectile = (x: number, y: number, angle: number = 0, isTridentCluster: boolean = false) => {
                const p = pools.projectiles.get();
                p.id = getNextId();
                p.x = x;
                p.y = y;
                p.angle = angle;
                p.isTridentCluster = isTridentCluster;
                newProjectiles.push(p);
            };

            const spawnY = C.PLAYER_Y_POSITION - C.PLAYER_SPRITE_HEIGHT;

            if (state.generalUpgrades.trident_shot_level >= 3) {
                createAndAddProjectile(playerX, spawnY, 0, true);
                createAndAddProjectile(playerX, spawnY, -3, true);
                createAndAddProjectile(playerX, spawnY, 3, true);
            } else {
                createAndAddProjectile(playerX, spawnY);
            }
            
            if (activePowerUps.SpreadShot) {
                createAndAddProjectile(playerX - C.SPREAD_SHOT_OFFSET, spawnY);
                createAndAddProjectile(playerX + C.SPREAD_SHOT_OFFSET, spawnY);
            }
            
            const sc = pools.shellCasings.get();
            sc.id = getNextId();
            sc.x = playerX + 15;
            sc.y = spawnY; // ✅ Use same Y as projectiles (top of ship, near muzzle flash)
            sc.vx = C.SHELL_EJECT_SPEED_X;
            sc.vy = C.SHELL_EJECT_SPEED_Y;
            sc.rotation = Math.random() * 360;
            sc.rotationSpeed = (Math.random() - 0.5) * 1000;
            sc.createdAt = effectiveNow;
            newShellCasings.push(sc);

            lastPlayerShotTime = effectiveNow;
            const isAlphaL3 = state.selectedHero === 'alpha' && state.heroUpgrades.alpha_aoe_level >= 3;
            playSound(isAlphaL3 ? 'shoot_empowered' : 'shoot');
            ammo--;
            playedEmptyClipSound = false;
            if(ammo === 0 && activePowerUps.AutoReload && !isReloading){
                const totalReloadReduction = Math.min((reloadBoosts * C.RELOAD_TIME_REDUCTION_PER_STACK) + reloadBonus, 0.9);
                const currentReloadTime = C.RELOAD_TIME * (1 - totalReloadReduction);
                reloadCompleteTime = effectiveNow + currentReloadTime;
                playSound('reload');
            }
        } else if (!isReloading && !playedEmptyClipSound) {
            playSound('emptyClip');
            playedEmptyClipSound = true;
        }
    }

    // Independent Trident Shot
    const tridentLevel = state.generalUpgrades.trident_shot_level;
    const tridentInterval = tridentLevel >= 2 ? C.TRIDENT_SHOT_INTERVAL_L2 : C.TRIDENT_SHOT_INTERVAL;
    if (tridentLevel > 0 && effectiveNow - lastTridentShotTime > tridentInterval) {
        if (ammo > 0 && !isReloading) {
            const angle = 15;
            const droneSpawnY = C.PLAYER_Y_POSITION - C.PLAYER_SPRITE_HEIGHT * 0.8;
            const p1 = pools.projectiles.get();
            p1.id = getNextId(); p1.x = playerX - C.TRIDENT_DRONE_OFFSET_X; p1.y = droneSpawnY; p1.angle = -angle;
            newProjectiles.push(p1);

            const p2 = pools.projectiles.get();
            p2.id = getNextId(); p2.x = playerX + C.TRIDENT_DRONE_OFFSET_X; p2.y = droneSpawnY; p2.angle = angle;
            newProjectiles.push(p2);
            
            lastTridentShotTime = effectiveNow;
        }
    }

    return { playerVx, playerX, ammo, lastPlayerShotTime, lastTridentShotTime, newProjectiles, newShellCasings, playedEmptyClipSound, reloadCompleteTime, phaseShiftState: finalPhaseShiftState, activeRareConsumable };
}

/**
 * Updates positions of all non-player entities.
 */
export function updateEntities(state: GameState, delta: number, now: number, effectiveNow: number) {
    // Destructure mutable arrays from the state
    const { enemies, projectiles, enemyProjectiles, asteroids, powerUps, shellCasings, gibs, upgradePartCollects, weaverSurges } = state;

    const speedMultiplier = state.isHardMode ? HARD_MODE_MULTIPLIERS.ENEMY_SPEED : 1.0;
    
    // Move Enemies
    // ✅ CRITICAL PERFORMANCE: Manual loop instead of for...of to avoid iterator allocation
    const enemiesLen = enemies.length;
    for (let i = 0; i < enemiesLen; i++) {
        const e = enemies[i];
        let speed = C.ENEMY_SPEED;
        let newY = e.y;
        let newX = e.x;

        if (e.type === 'conduit' || e.type === 'heretic_ship') {
            speed = C.CONDUIT_SPEED_Y;
        } else if (e.type === 'weaver') {
            if (e.isPausing) {
                speed = 0; // Stop vertical movement
            } else {
                speed = C.WEAVER_DIVE_SPEED;
            }
        }
        newY += speed * speedMultiplier * delta;
        
        if (e.isDodging && e.dodgeTargetX !== undefined) {
            const dodgeSpeed = C.DODGER_DODGE_SPEED * speedMultiplier;
            const direction = Math.sign(e.dodgeTargetX - e.x);
            newX += direction * dodgeSpeed * delta;
            
            // Check if arrived
            if ((direction > 0 && newX >= e.dodgeTargetX) || (direction < 0 && newX <= e.dodgeTargetX)) {
                newX = e.dodgeTargetX;
                e.isDodging = false;
                e.baseX = e.dodgeTargetX; // New home base
                e.dodgeCooldownUntil = effectiveNow + C.DODGER_DODGE_COOLDOWN;
            }
        } else if (e.type !== 'weaver') {
            // This handles standard, dodger, conduit and heretic_ship with sine wave logic
            // ✅ MOBILE OPTIMIZATION: Removed console.warn from hot path (extremely slow on mobile)
            // Note: Zero oscillation amplitude is valid (enemy moves in straight line)
            // ✅ OPTIMIZATION: Use cached Math.sin() to avoid expensive calculations
            const phaseAngle = (effectiveNow / 1000) * e.oscillationFrequency + e.oscillationOffset;
            newX = e.baseX + getCachedSin(phaseAngle) * e.oscillationAmplitude;
        }

        // Apply clamping to all non-diving-weaver enemies AFTER calculating their new potential X position
        if (e.type !== 'weaver' || e.isPausing) {
             const scale = calculatePerspectiveScale(newY);
             const scaledWidth = C.ENEMY_WIDTH * scale;
             newX = clampHorizontalPosition(newX, newY, scaledWidth, state.laneCount);
        }

        e.y = newY;
        e.x = newX;

        // Dodger trail logic
        if (e.type === 'dodger') {
            if (!e.trailPoints) {
                e.trailPoints = [];
            }
    
            if (e.isDodging) {
                const TRAIL_INTERVAL = 30; // ms
                const lastTrailPoint = e.trailPoints.length > 0 ? e.trailPoints[e.trailPoints.length - 1] : null;
        
                if (!lastTrailPoint || effectiveNow - lastTrailPoint.timestamp > TRAIL_INTERVAL) {
                     e.trailPoints.push({ x: e.x, y: e.y, timestamp: effectiveNow });
                }
            }
            
            // CRITICAL FIX: Cleanup old trail points to prevent memory leaks.
            if (e.trailPoints) {
                // ✅ MOBILE OPTIMIZATION: Use cached IS_MOBILE constant
                const trailDuration = IS_MOBILE ? 150 : 200; // ms
                const maxTrailPoints = IS_MOBILE ? 20 : 30;

                // ✅ MOBILE OPTIMIZATION: Manual loop instead of filter() to avoid array allocation
                // Use reverse loop for safe in-place removal
                for (let i = e.trailPoints.length - 1; i >= 0; i--) {
                    if (effectiveNow - e.trailPoints[i].timestamp > trailDuration) {
                        e.trailPoints.splice(i, 1);
                    }
                }
                
                // Enforce maximum trail points for performance
                if (e.trailPoints.length > maxTrailPoints) {
                    // slice(-N) is more efficient for taking from the end than splice
                    e.trailPoints = e.trailPoints.slice(-maxTrailPoints);
                }
            }
        }
    }

    // Move Projectiles
    // ✅ CRITICAL PERFORMANCE: Manual loop instead of for...of to avoid iterator allocation
    const projectilesLen = projectiles.length;
    for (let i = 0; i < projectilesLen; i++) {
        const p = projectiles[i];
        const angleRad = (p.angle || 0) * PI_OVER_180;
        const speedX = Math.sin(angleRad) * C.PROJECTILE_SPEED;
        const speedY = Math.cos(angleRad) * C.PROJECTILE_SPEED;
        let newY = p.y - speedY * delta;
        let newX = p.x + speedX * delta;
        
        if (state.selectedHero === 'beta' && state.heroUpgrades.beta_homing_level > 0) {
            // ✅ OPTIMIZATION: Avoid array spread allocation - check enemies and boss separately
            const BETA_HOMING_RANGE_SQ = 500 * 500; // Pre-compute squared range
            let nearestEnemy = null, minDistanceSq = Infinity;
            
            // Check enemies
            // ✅ CRITICAL PERFORMANCE: Manual loop instead of for...of to avoid iterator allocation
            for (let j = 0; j < enemiesLen; j++) {
                const target = enemies[j];
                if (target.y > p.y) continue;
                // Skip enemies that are invulnerable due to conduit shield
                if ('isBuffedByConduit' in target && target.isBuffedByConduit) continue;
                const dx = target.x - newX, dy = target.y - newY;
                const distanceSq = dx * dx + dy * dy;
                if (distanceSq < minDistanceSq) { minDistanceSq = distanceSq; nearestEnemy = target; }
            }
            
            // Check boss if present
            if (state.boss) {
                const target = state.boss;
                if (target.y <= p.y) {
                    // Skip if invulnerable due to conduit shield (bosses don't have this, but check for consistency)
                    if (!('isBuffedByConduit' in target) || !target.isBuffedByConduit) {
                        const dx = target.x - newX, dy = target.y - newY;
                        const distanceSq = dx * dx + dy * dy;
                        if (distanceSq < minDistanceSq) { minDistanceSq = distanceSq; nearestEnemy = target; }
                    }
                }
            }
            
            if (nearestEnemy && minDistanceSq < BETA_HOMING_RANGE_SQ) {
                const homingStrength = C.HANGAR_BETA_UPGRADE_CONFIG[state.heroUpgrades.beta_homing_level - 1].effect;
                const direction = Math.sign(nearestEnemy.x - newX);
                newX += direction * C.BETA_HOMING_MAX_SPEED * homingStrength * delta;
            }
        }
        p.y = newY;
        p.x = newX;
    }

    // Move Enemy Projectiles
    const hardModeMultiplier = state.isHardMode ? HARD_MODE_MULTIPLIERS.ENEMY_PROJECTILE_SPEED : 1.0;
    // ✅ CRITICAL PERFORMANCE: Manual loop instead of for...of to avoid iterator allocation
    const enemyProjectilesLen = enemyProjectiles.length;
    for (let i = 0; i < enemyProjectilesLen; i++) {
        const p = enemyProjectiles[i];
        // Store previous position before updating for the tail effect
        p.prevX = p.x;
        p.prevY = p.y;

        const effectiveSpeed = p.speed * hardModeMultiplier;
        const angleRad = (p.angle || 0) * PI_OVER_180;
        const speedX = getCachedSin(angleRad) * effectiveSpeed;
        const speedY = getCachedCos(angleRad) * effectiveSpeed;
        p.x += speedX * delta;
        p.y += speedY * delta;
    }

    // Move Weaver Surges
    for (const s of weaverSurges) {
        s.y += C.WEAVER_SURGE_SPEED * delta;
    }

    // Move Collectibles (PowerUps, UpgradeParts)
    const isGravitonActive = state.generalUpgrades.graviton_collector_level > 0;

    if (isGravitonActive) {
        const targetX = state.playerX;
        // FIX: Correctly calculate the pull target Y to be the visual center of the ship, not a point behind it.
        const targetY = C.PLAYER_Y_POSITION - C.PLAYER_SPRITE_HEIGHT / 2;
        const MIN_DIST_SQ = 1; // Squared minimum distance to avoid division by zero and jitter

        // ✅ CRITICAL PERFORMANCE: Manual loop instead of for...of to avoid iterator allocation
        const powerUpsLen = powerUps.length;
        for (let i = 0; i < powerUpsLen; i++) {
            const p = powerUps[i];
            const dx = targetX - p.x;
            const dy = targetY - p.y;
            const distSq = dx * dx + dy * dy;
            // ✅ MOBILE OPTIMIZATION: Use squared distance comparison to avoid expensive Math.sqrt()
            // Only compute sqrt when we actually need to normalize the vector
            if (distSq > MIN_DIST_SQ) {
                const dist = Math.sqrt(distSq);
                p.x += (dx / dist) * C.GRAVITON_COLLECTOR_PULL_STRENGTH * delta;
                p.y += (dy / dist) * C.GRAVITON_COLLECTOR_PULL_STRENGTH * delta;
            }
        }

        // ✅ CRITICAL PERFORMANCE: Manual loop instead of for...of to avoid iterator allocation
        const upgradePartCollectsLen = upgradePartCollects.length;
        for (let i = 0; i < upgradePartCollectsLen; i++) {
            const p = upgradePartCollects[i];
            const dx = targetX - p.x;
            const dy = targetY - p.y;
            const distSq = dx * dx + dy * dy;
            // ✅ MOBILE OPTIMIZATION: Use squared distance comparison to avoid expensive Math.sqrt()
            // Only compute sqrt when we actually need to normalize the vector
            if (distSq > MIN_DIST_SQ) {
                const dist = Math.sqrt(distSq);
                p.x += (dx / dist) * C.GRAVITON_COLLECTOR_PULL_STRENGTH * delta;
                p.y += (dy / dist) * C.GRAVITON_COLLECTOR_PULL_STRENGTH * delta;
            }
        }

    } else {
        // Default movement for collectibles when Graviton Collector is off
        // ✅ CRITICAL PERFORMANCE: Manual loop instead of for...of to avoid iterator allocation
        const powerUpsLen2 = powerUps.length;
        for (let i = 0; i < powerUpsLen2; i++) {
            const p = powerUps[i];
            p.y += C.POWERUP_SPEED * delta;
        }

        // ✅ CRITICAL PERFORMANCE: Manual loop instead of for...of to avoid iterator allocation
        const upgradePartCollectsLen2 = upgradePartCollects.length;
        for (let i = 0; i < upgradePartCollectsLen2; i++) {
            const p = upgradePartCollects[i];
            const elapsed = effectiveNow - p.createdAt;
            const progress = Math.min(1, elapsed / C.UPGRADE_PART_ANIMATION_DURATION);
            const easedProgress = easeOutQuad(progress);

            const targetX = C.GAME_WIDTH - 150;
            const targetY = C.GAME_HEIGHT - 30;

            p.x = p.startX + (targetX - p.startX) * easedProgress;
            p.y = p.startY + (targetY - p.startY) * easedProgress;
        }
    }

    
    // Move Asteroids
    for (const a of asteroids) {
        const asteroidSpeedMultiplier = state.isHardMode ? HARD_MODE_MULTIPLIERS.ASTEROID_SPEED : 1.0;
        let newX = a.x + a.vx * asteroidSpeedMultiplier * delta;
        let newY = a.y + a.vy * asteroidSpeedMultiplier * delta;
        let newRotation = a.rotation + a.rotationSpeed * asteroidSpeedMultiplier * delta;
        let newHealth = a.health;
        if (a.isBuffedByConduit) {
            newHealth = Math.min(a.maxHealth, a.health + C.CONDUIT_BUFF_ASTEROID_REPAIR_RATE * delta);
        }
        
        let newVx = a.vx;
        // Proactive "Pinball" bounce logic for asteroids.
        // During the Asteroid Field event, let them fly off-screen.
        if (state.status !== GameStatus.AsteroidField && newY > -a.size) { // Only apply physics when mostly on screen.
            const scale = calculatePerspectiveScale(newY);
            const scaledDiameter = (a.size * 2) * scale;
            const clampedX = clampHorizontalPosition(newX, newY, scaledDiameter, state.laneCount);
            if (clampedX !== newX) {
                newX = clampedX;
                newVx = -a.vx;
            }
        }
        a.x = newX;
        a.y = newY;
        a.rotation = newRotation;
        a.health = newHealth;
        a.vx = newVx;
    }

    // Move Effects
    // ✅ CRITICAL PERFORMANCE: Manual loop instead of for...of to avoid iterator allocation
    const shellCasingsLen = shellCasings.length;
    for (let i = 0; i < shellCasingsLen; i++) {
        const sc = shellCasings[i];
        const oldVy = sc.vy; // Store original velocity for this tick's position calculation
        sc.vy += C.SHELL_GRAVITY * delta;
        sc.x += sc.vx * delta;
        sc.y += oldVy * delta; // Use original velocity for position update
        sc.rotation += sc.rotationSpeed * delta;
    }

    // ✅ CRITICAL PERFORMANCE: Manual loop instead of for...of to avoid iterator allocation
    const gibsLen = gibs.length;
    for (let i = 0; i < gibsLen; i++) {
        const gib = gibs[i];
        gib.vy += C.GIB_GRAVITY * delta;
        gib.x += gib.vx * delta;
        gib.y += gib.vy * delta;
        gib.rotation += gib.rotationSpeed * delta;
    }

    // Return the updated arrays
    return { enemies, projectiles, enemyProjectiles, asteroids, powerUps, shellCasings, gibs, upgradePartCollects, weaverSurges };
}
