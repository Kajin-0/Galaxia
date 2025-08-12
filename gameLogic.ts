

import type { GameState, GameAction, Enemy as EnemyType, Projectile as ProjectileType, PowerUp as PowerUpInterface, EnemyProjectile as EnemyProjectileType, Asteroid as AsteroidType, WeaverBeam, OutcomeResult, TrainingTarget, ConsumableItem, Explosion, RockImpact, CriticalHitExplosion } from './types';
import { GameStatus } from './types';
import * as C from './constants';
import { playSound } from './sounds';
import { updateAndSaveEndOfRunProgression, saveProgression, loadProgression } from './utils/progression';
import { createNewBoss, generateDynamicEncounter, processOutcomeResult } from './utils/creators';
import { triggerHaptic } from './utils/haptics';
import { SpatialGrid, Collidable } from './utils/collisionSystem';
import { pools } from './state/pools';

let nextId = 10000; // Start high to avoid collision with initial IDs

const HARD_MODE_MULTIPLIERS = {
    ENEMY_SPEED: 1.25,
    ENEMY_PROJECTILE_SPEED: 1.2,
    ENEMY_FIRE_RATE: 1.4,
    ENEMY_SPAWN_RATE: 1.3,
};

// --- Helper Functions for Game Logic ---

/**
 * Updates player position, velocity, and handles shooting logic.
 */
function updatePlayer(state: GameState, pressedKeys: Set<string>, delta: number, now: number, shootingDisabled: boolean = false) {
    let { 
        playerVx, playerX, ammo, reloadCompleteTime, playedEmptyClipSound,
        lastPlayerShotTime, lastTridentShotTime, projectiles, shellCasings, activePowerUps, reloadBoosts,
        touchState
    } = state;

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

    const friction = state.selectedHero === 'beta' ? C.PLAYER_FRICTION * C.BETA_ACCELERATION_MODIFIER : C.PLAYER_FRICTION;

    if (touchState.isActive && touchState.currentX !== null) {
        // Relative touch controls are active
        const targetX = touchState.currentX - touchState.offsetX;
        const deadZone = 5; // To prevent jitter when touch is close to player
        const dx = targetX - playerX;

        if (Math.abs(dx) > deadZone) {
            const direction = Math.sign(dx);
            playerVx += direction * acceleration * delta;
        } else {
            // Apply friction if inside deadzone or not moving
            playerVx -= playerVx * friction * delta;
        }
    } else {
        // Keyboard controls (fallback)
        const moveLeft = pressedKeys.has('ArrowLeft');
        const moveRight = pressedKeys.has('ArrowRight');
        if (moveLeft) {
            playerVx -= acceleration * delta;
        } else if (moveRight) {
            playerVx += acceleration * delta;
        } else {
            playerVx -= playerVx * friction * delta;
        }
    }

    if (Math.abs(playerVx) < 1 && !touchState.isActive) playerVx = 0;


    playerVx = Math.max(-maxSpeed, Math.min(maxSpeed, playerVx));
    playerX = state.playerX + playerVx * delta;
    playerX = Math.max(C.PLAYER_WIDTH / 2, Math.min(C.GAME_WIDTH - C.PLAYER_WIDTH / 2, playerX));

    // --- Player Shooting ---
    if (shootingDisabled) {
        // Return early to prevent any shooting logic from running
        return { playerVx, playerX, ammo, lastPlayerShotTime, lastTridentShotTime, projectiles, shellCasings, playedEmptyClipSound, reloadCompleteTime };
    }
    
    const shootInterval = (activePowerUps.RapidFire || state.hasPermanentRapidFire) ? C.RAPID_FIRE_AUTOSHOOT_INTERVAL : C.PLAYER_AUTOSHOOT_INTERVAL;
    const isReloading = reloadCompleteTime > now;

    if (now - lastPlayerShotTime > shootInterval) {
        if (ammo > 0 && !isReloading) {
            const createAndAddProjectile = (x: number, y: number, angle: number = 0, isTridentCluster: boolean = false) => {
                const p = pools.projectiles.get();
                p.id = nextId++;
                p.x = x;
                p.y = y;
                p.angle = angle;
                p.isTridentCluster = isTridentCluster;
                projectiles.push(p);
            };

            if (state.generalUpgrades.trident_shot_level >= 3) {
                createAndAddProjectile(playerX, C.PLAYER_Y_POSITION - C.PROJECTILE_HEIGHT, 0, true);
                createAndAddProjectile(playerX, C.PLAYER_Y_POSITION - C.PROJECTILE_HEIGHT, -3, true);
                createAndAddProjectile(playerX, C.PLAYER_Y_POSITION - C.PROJECTILE_HEIGHT, 3, true);
            } else {
                createAndAddProjectile(playerX, C.PLAYER_Y_POSITION - C.PROJECTILE_HEIGHT);
            }
            
            if (activePowerUps.SpreadShot) {
                createAndAddProjectile(playerX - C.SPREAD_SHOT_OFFSET, C.PLAYER_Y_POSITION - C.PROJECTILE_HEIGHT);
                createAndAddProjectile(playerX + C.SPREAD_SHOT_OFFSET, C.PLAYER_Y_POSITION - C.PROJECTILE_HEIGHT);
            }
            
            const sc = pools.shellCasings.get();
            sc.id = nextId++;
            sc.x = playerX + 15;
            sc.y = C.PLAYER_Y_POSITION;
            sc.vx = C.SHELL_EJECT_SPEED_X;
            sc.vy = C.SHELL_EJECT_SPEED_Y;
            sc.rotation = Math.random() * 360;
            sc.rotationSpeed = (Math.random() - 0.5) * 1000;
            sc.createdAt = now;
            shellCasings.push(sc);

            lastPlayerShotTime = now;
            playSound('shoot');
            ammo--;
            playedEmptyClipSound = false;
            if(ammo === 0 && activePowerUps.AutoReload && !isReloading){
                const totalReloadReduction = Math.min((reloadBoosts * C.RELOAD_TIME_REDUCTION_PER_STACK) + reloadBonus, 0.9);
                const currentReloadTime = C.RELOAD_TIME * (1 - totalReloadReduction);
                reloadCompleteTime = now + currentReloadTime;
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
    if (tridentLevel > 0 && now - lastTridentShotTime > tridentInterval) {
        if (ammo > 0 && !isReloading) {
            const angle = 15;
            const p1 = pools.projectiles.get();
            p1.id = nextId++; p1.x = playerX - C.TRIDENT_DRONE_OFFSET_X; p1.y = C.PLAYER_Y_POSITION + C.TRIDENT_DRONE_OFFSET_Y; p1.angle = -angle;
            projectiles.push(p1);

            const p2 = pools.projectiles.get();
            p2.id = nextId++; p2.x = playerX + C.TRIDENT_DRONE_OFFSET_X; p2.y = C.PLAYER_Y_POSITION + C.TRIDENT_DRONE_OFFSET_Y; p2.angle = angle;
            projectiles.push(p2);
            
            lastTridentShotTime = now;
        }
    }

    return { playerVx, playerX, ammo, lastPlayerShotTime, lastTridentShotTime, projectiles, shellCasings, playedEmptyClipSound, reloadCompleteTime };
}

/**
 * Updates positions of all non-player entities.
 */
function updateEntities(state: GameState, delta: number, gameTime: number, now: number) {
    let { enemies, projectiles, enemyProjectiles, asteroids, powerUps, shellCasings, gibs, upgradePartCollects } = state;
    const speedMultiplier = state.isHardMode ? HARD_MODE_MULTIPLIERS.ENEMY_SPEED : 1.0;
    const projectileSpeed = state.isHardMode ? C.ENEMY_PROJECTILE_SPEED * HARD_MODE_MULTIPLIERS.ENEMY_PROJECTILE_SPEED : C.ENEMY_PROJECTILE_SPEED;

    // Move Enemies
    enemies = enemies.map(e => {
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
                e.dodgeCooldownUntil = now + C.DODGER_DODGE_COOLDOWN;
            }
        } else if (e.type !== 'weaver') {
            newX = e.baseX + Math.sin(gameTime * e.oscillationFrequency / 1000 + e.oscillationOffset) * e.oscillationAmplitude;
        }

        return { ...e, y: newY, x: Math.max(C.ENEMY_WIDTH / 2, Math.min(C.GAME_WIDTH - C.ENEMY_WIDTH / 2, newX)) };
    });

    // Move Projectiles
    projectiles = projectiles.map(p => {
        const angleRad = (p.angle || 0) * (Math.PI / 180);
        const speedX = Math.sin(angleRad) * C.PROJECTILE_SPEED;
        const speedY = Math.cos(angleRad) * C.PROJECTILE_SPEED;
        let newY = p.y - speedY * delta;
        let newX = p.x + speedX * delta;
        
        if (state.selectedHero === 'beta' && state.heroUpgrades.beta_homing_level > 0) {
            let nearestEnemy = null, minDistanceSq = Infinity;
            const potentialTargets = [...enemies, ...(state.boss ? [state.boss] : [])];
            for (const target of potentialTargets) {
                if (target.y > p.y) continue;
                const dx = target.x - newX, dy = target.y - newY;
                const distanceSq = dx * dx + dy * dy;
                if (distanceSq < minDistanceSq) { minDistanceSq = distanceSq; nearestEnemy = target; }
            }
            if (nearestEnemy && minDistanceSq < 500 * 500) {
                const homingStrength = C.HANGAR_BETA_UPGRADE_CONFIG[state.heroUpgrades.beta_homing_level - 1].effect;
                const direction = Math.sign(nearestEnemy.x - newX);
                newX += direction * C.BETA_HOMING_MAX_SPEED * homingStrength * delta;
            }
        }
        return { ...p, y: newY, x: newX };
    });

    enemyProjectiles = enemyProjectiles.map(p => ({ ...p, y: p.y + projectileSpeed * delta }));

    // Move Collectibles (PowerUps, UpgradeParts)
    const isGravitonActive = state.generalUpgrades.graviton_collector_level > 0;

    if (isGravitonActive) {
        const targetX = state.playerX;
        const targetY = C.PLAYER_Y_POSITION;

        powerUps = powerUps.map(p => {
            const dx = targetX - p.x;
            const dy = targetY - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 1) { // Avoid division by zero and jitter
                const newX = p.x + (dx / dist) * C.GRAVITON_COLLECTOR_PULL_STRENGTH * delta;
                const newY = p.y + (dy / dist) * C.GRAVITON_COLLECTOR_PULL_STRENGTH * delta;
                return { ...p, x: newX, y: newY };
            }
            return p;
        });

        upgradePartCollects = upgradePartCollects.map(p => {
            const dx = targetX - p.x;
            const dy = targetY - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 1) {
                const newX = p.x + (dx / dist) * C.GRAVITON_COLLECTOR_PULL_STRENGTH * delta;
                const newY = p.y + (dy / dist) * C.GRAVITON_COLLECTOR_PULL_STRENGTH * delta;
                return { ...p, x: newX, y: newY };
            }
            return p;
        });

    } else {
        // Default movement for collectibles when Graviton Collector is off
        powerUps = powerUps.map(p => ({ ...p, y: p.y + C.POWERUP_SPEED * delta }));

        upgradePartCollects = upgradePartCollects.map(p => {
            const elapsed = now - p.createdAt;
            const progress = Math.min(1, elapsed / C.UPGRADE_PART_ANIMATION_DURATION);
            const easeOutQuad = (x: number) => 1 - (1 - x) * (1 - x);
            const easedProgress = easeOutQuad(progress);

            const targetX = C.GAME_WIDTH - 150;
            const targetY = C.GAME_HEIGHT - 30;

            const x = p.startX + (targetX - p.startX) * easedProgress;
            const y = p.startY + (targetY - p.startY) * easedProgress;
            return { ...p, x, y };
        });
    }

    
    // Move Asteroids
    asteroids = asteroids.map(a => {
        const asteroidSpeedMultiplier = a.id === -999 ? 1.0 : speedMultiplier; // Montezuma isn't affected by hard mode speed
        const newY = a.y + a.vy * asteroidSpeedMultiplier * delta;
        const newX = a.x + a.vx * asteroidSpeedMultiplier * delta;
        let newHealth = a.health;
        if (a.isBuffedByConduit) {
            newHealth = Math.min(a.maxHealth, a.health + C.CONDUIT_BUFF_ASTEROID_REPAIR_RATE * delta);
        }
        const newRotation = a.rotation + a.rotationSpeed * delta;
        return { ...a, y: newY, x: newX, rotation: newRotation, health: newHealth };
    });

    // Move Effects
    shellCasings = shellCasings.map(sc => ({ ...sc, vy: sc.vy + C.SHELL_GRAVITY * delta, x: sc.x + sc.vx * delta, y: sc.y + sc.vy * delta, rotation: sc.rotation + sc.rotationSpeed * delta, }));
    gibs = gibs.map(gib => ({ ...gib, vy: gib.vy + C.GIB_GRAVITY * delta, x: gib.x + gib.vx * delta, y: gib.y + gib.vy * delta, rotation: gib.rotation + gib.rotationSpeed * delta, }));

    return { enemies, projectiles, enemyProjectiles, asteroids, powerUps, shellCasings, gibs, upgradePartCollects };
}

/**
 * Handles all boss-related logic, including phase changes and attack patterns.
 */
function runBossLogic(state: GameState, now: number) {
    let { boss, enemies, enemyProjectiles, bossLasers, screenShake, inGameMessages } = state;
    if (!boss) return {};

    const newExplosions: GameState['explosions'] = [];
    const newCriticalHits: GameState['criticalHits'] = [];
    const phaseTime = now - boss.phaseStartTime;

    if (boss.phase === 'defeated') {
        const interval = C.BOSS_DEFEATED_DURATION / C.BOSS_DEATH_EXPLOSION_COUNT;
        if (now > (boss.lastExplosionTime ?? 0) + interval && (boss.explosionsFired ?? 0) < C.BOSS_DEATH_EXPLOSION_COUNT) {
            const bossWidth = boss.bossType === 'punisher' ? C.PUNISHER_WIDTH : boss.bossType === 'warden' ? C.WARDEN_WIDTH : C.OVERMIND_WIDTH;
            const bossHeight = boss.bossType === 'punisher' ? C.PUNISHER_HEIGHT : boss.bossType === 'warden' ? C.WARDEN_HEIGHT : C.OVERMIND_HEIGHT;

            const x = boss.x + (Math.random() - 0.5) * bossWidth * 1.2;
            const y = boss.y + (Math.random() - 0.5) * bossHeight * 1.2;
            
            const exp = pools.explosions.get();
            exp.id = nextId++; exp.x = x; exp.y = y; exp.createdAt = now;
            exp.particles = Array.from({ length: 25 }, () => ({
              angle: Math.random() * 2 * Math.PI,
              distance: Math.random() * 50 + 25,
              size: Math.random() * 12 + 8,
              color: ['#f09', '#ff007f', '#fff'][Math.floor(Math.random() * 3)],
            }));
            newExplosions.push(exp);
            
            if ((boss.explosionsFired ?? 0) % 4 === 0) { // Keep the crit hit ratio
                const crit = pools.criticalHits.get();
                crit.id = nextId++; crit.x = x; crit.y = y; crit.radius = C.CRITICAL_HIT_RADIUS * 1.2; crit.createdAt = now; crit.isBossDeath = true;
                newCriticalHits.push(crit);
                playSound('criticalHit');
                triggerHaptic('criticalHit');
            }
            playSound('explosion');
            triggerHaptic('explosion');
            
            boss.explosionsFired = (boss.explosionsFired ?? 0) + 1;
            boss.lastExplosionTime = now;
        }
    }

    if (boss.phase === 'entering' && phaseTime > C.BOSS_ENTER_DURATION) {
        boss = {...boss, phase: 'attacking', phaseStartTime: now, lastAttackTime: now, attackPatternStartTime: now };
    }
    
    if (boss.phase === 'attacking' || boss.phase === 'fury') {
        boss.x = C.GAME_WIDTH / 2 + Math.sin(now / (boss.bossType === 'punisher' ? 1500 : 2000)) * (C.GAME_WIDTH / 2 - C.PUNISHER_WIDTH / 2);
    }
    
    // Boss-specific attack logic
    switch(boss.bossType) {
        case 'overmind':
            if (boss.phase === 'attacking' && boss.health / boss.maxHealth < C.OVERMIND_PHASE_2_THRESHOLD) {
                boss.phase = 'spawning_fragments'; boss.isInvulnerable = true; boss.phaseStartTime = now; boss.fragments = [];
                for (let i = 0; i < C.OVERMIND_FRAGMENT_COUNT; i++) {
                     boss.fragments.push({ id: nextId++, x: boss.x + (Math.random() - 0.5) * C.OVERMIND_WIDTH, y: boss.y + (Math.random() - 0.5) * C.OVERMIND_HEIGHT, type: 'dodger', lastShotTime: now + Math.random() * 1000, baseX: boss.x, oscillationFrequency: Math.random() * 1.5 + 1, oscillationAmplitude: Math.random() * 60 + 30, oscillationOffset: Math.random() * Math.PI * 2, dodgeCooldownUntil: 0 });
                }
                enemies.push(...boss.fragments);
                const msg = pools.inGameMessages.get();
                msg.id = nextId++; msg.text = 'INVULNERABLE'; msg.createdAt = now; msg.duration = 4000; msg.style = 'warning';
                inGameMessages.push(msg);
            } else if (boss.phase === 'spawning_fragments' && boss.fragments?.length === 0) {
                boss.phase = 'fury'; boss.isInvulnerable = false; boss.phaseStartTime = now; boss.attackPatternStartTime = now; boss.attackPattern = 'barrage'; playSound('levelUp');
                const msg = pools.inGameMessages.get();
                msg.id = nextId++; msg.text = 'FURY MODE'; msg.createdAt = now; msg.duration = 3000; msg.style = 'boss';
                inGameMessages.push(msg);
            }

            if (boss.phase === 'attacking') {
                if (now > boss.lastAttackTime + (boss.wardenBarrageInterval || 500)) {
                    for(let i=0; i<3; i++) {
                        const ep = pools.enemyProjectiles.get();
                        ep.id = nextId++; ep.x = boss.x + (Math.random() - 0.5) * C.OVERMIND_WIDTH * 0.8; ep.y = boss.y;
                        enemyProjectiles.push(ep);
                    }
                    playSound('enemyShoot'); boss.lastAttackTime = now;
                }
            } else if (boss.phase === 'fury') {
                if (now > boss.attackPatternStartTime + 8000) {
                    boss.phase = 'beam';
                    boss.attackPattern = 'beam';
                    boss.attackPatternStartTime = now;
                    boss.beamChargeStartTime = now;
                    boss.safeSpotX = Math.random() * (C.GAME_WIDTH - C.OVERMIND_BEAM_SAFE_ZONE_WIDTH);
                    playSound('laserShoot');
                    const msg = pools.inGameMessages.get();
                    msg.id = nextId++; msg.text = 'BEAM ATTACK'; msg.createdAt = now; msg.duration = C.OVERMIND_BEAM_CHARGE_TIME; msg.style = 'warning';
                    inGameMessages.push(msg);
                } else if (now > boss.lastAttackTime + C.OVERMIND_FURY_BARRAGE_INTERVAL) {
                    const ep = pools.enemyProjectiles.get();
                    ep.id = nextId++; ep.x = boss.x + (Math.random() - 0.5) * C.OVERMIND_WIDTH; ep.y = boss.y;
                    enemyProjectiles.push(ep);
                    playSound('enemyShoot'); boss.lastAttackTime = now;
                }
            } else if (boss.phase === 'beam') {
                if (now > (boss.beamChargeStartTime ?? 0) + C.OVERMIND_BEAM_CHARGE_TIME && !boss.beamFireStartTime) {
                    boss.beamFireStartTime = now;
                }
                if (now > (boss.beamFireStartTime ?? 0) + C.OVERMIND_BEAM_FIRE_TIME) {
                    boss.phase = 'fury';
                    boss.attackPattern = 'barrage';
                    boss.attackPatternStartTime = now;
                    boss.beamChargeStartTime = undefined;
                    boss.beamFireStartTime = undefined;
                }
            }
            break;
        case 'warden':
            if (boss.phase === 'attacking') {
                const timeInPattern = now - boss.attackPatternStartTime;
                const sweepDuration = (boss.wardenSweepWaveCount ?? C.WARDEN_SWEEP_BASE_WAVE_COUNT) * (boss.wardenSweepWaveInterval ?? C.WARDEN_SWEEP_BASE_WAVE_INTERVAL) + 1500;
                
                if (boss.attackPattern === 'barrage' && timeInPattern > C.WARDEN_BARRAGE_DURATION) {
                    boss.attackPattern = 'sweep'; boss.attackPatternStartTime = now; boss.sweepWavesFired = 0; boss.lastSweepWaveTime = now; boss.sweepInitialSafeLane = Math.random() < 0.5 ? 0 : (10 - 2); boss.sweepDirection = boss.sweepInitialSafeLane === 0 ? 1 : -1;
                } else if (boss.attackPattern === 'sweep' && timeInPattern > sweepDuration) {
                    boss.attackPattern = 'spawnMinions'; boss.attackPatternStartTime = now; boss.lastAttackTime = now;
                } else if (boss.attackPattern === 'spawnMinions' && timeInPattern > C.WARDEN_SPAWN_MINION_DURATION) {
                    boss.attackPattern = 'barrage'; boss.attackPatternStartTime = now;
                }

                if (boss.attackPattern === 'barrage') {
                    const barrageInterval = (boss.wardenBarrageInterval || C.WARDEN_ATTACK_INTERVAL_BARRAGE) * Math.pow(0.8, boss.difficultyLevel);
                    if (now > boss.lastAttackTime + barrageInterval) {
                        const ep = pools.enemyProjectiles.get();
                        ep.id = nextId++; ep.x = boss.x + (Math.random() - 0.5) * C.WARDEN_WIDTH * 0.8; ep.y = boss.y + C.WARDEN_HEIGHT / 2;
                        enemyProjectiles.push(ep);
                        playSound('enemyShoot'); boss.lastAttackTime = now;
                    }
                } else if (boss.attackPattern === 'sweep') {
                    const waveInterval = boss.wardenSweepWaveInterval ?? C.WARDEN_SWEEP_BASE_WAVE_INTERVAL;
                    const totalWaves = boss.wardenSweepWaveCount ?? C.WARDEN_SWEEP_BASE_WAVE_COUNT;
                    if ((boss.sweepWavesFired ?? 0) < totalWaves && now > (boss.lastSweepWaveTime ?? 0) + waveInterval) {
                        const safeLanes = new Set([ (boss.sweepInitialSafeLane ?? 0) + ((boss.sweepWavesFired ?? 0) * (boss.sweepDirection ?? 1)), (boss.sweepInitialSafeLane ?? 0) + ((boss.sweepWavesFired ?? 0) * (boss.sweepDirection ?? 1)) + 1 ]);
                        for (let i = 0; i < 10; i++) {
                            if (!safeLanes.has(i)) {
                                const ep = pools.enemyProjectiles.get();
                                ep.id = nextId++; ep.x = (C.GAME_WIDTH / 10) * i + C.GAME_WIDTH / 20; ep.y = boss.y + C.WARDEN_HEIGHT / 2;
                                enemyProjectiles.push(ep);
                            }
                        }
                        playSound('enemyShoot'); boss.lastSweepWaveTime = now; boss.sweepWavesFired = (boss.sweepWavesFired ?? 0) + 1;
                    }
                } else if (boss.attackPattern === 'spawnMinions') {
                    const minionCount = boss.wardenMinionCount ?? C.WARDEN_SPAWN_MINION_COUNT;
                    if (now > boss.lastAttackTime + ((C.WARDEN_SPAWN_MINION_DURATION * 0.8) / minionCount)) {
                        enemies.push({ id: nextId++, x: boss.x + (Math.random() - 0.5) * C.WARDEN_WIDTH, y: boss.y + C.WARDEN_HEIGHT, type: state.bossDefeatCount.warden === 0 ? 'standard' : 'dodger', lastShotTime: now + Math.random() * C.ENEMY_SHOOT_INTERVAL, baseX: boss.x, oscillationFrequency: Math.random() * 1.0 + 0.5, oscillationAmplitude: Math.random() * 80 + 40, oscillationOffset: Math.random() * Math.PI * 2, dodgeCooldownUntil: now + 500 });
                        boss.lastAttackTime = now;
                    }
                }
            }
            break;
        case 'punisher':
             if (boss.phase === 'attacking') {
                const timeInPattern = now - boss.attackPatternStartTime;
                if (boss.attackPattern === 'barrage' && timeInPattern > C.PUNISHER_BARRAGE_DURATION) { boss.attackPattern = 'spawnMinions'; boss.attackPatternStartTime = now; }
                else if (boss.attackPattern === 'spawnMinions' && timeInPattern > C.PUNISHER_SPAWN_MINION_DURATION) { boss.attackPattern = 'laser'; boss.attackPatternStartTime = now; }
                else if (boss.attackPattern === 'laser' && timeInPattern > C.PUNISHER_LASER_PATTERN_DURATION) { boss.attackPattern = 'barrage'; boss.attackPatternStartTime = now; }
                
                if (boss.attackPattern === 'barrage') {
                    const barrageInterval = (boss.punisherBarrageInterval || C.PUNISHER_ATTACK_INTERVAL_BARRAGE) * Math.pow(0.85, boss.difficultyLevel);
                    if (now > boss.lastAttackTime + barrageInterval) {
                        const ep = pools.enemyProjectiles.get();
                        ep.id = nextId++; ep.x = boss.x + (Math.random() - 0.5) * C.PUNISHER_WIDTH * 0.8; ep.y = boss.y + C.PUNISHER_HEIGHT / 2;
                        enemyProjectiles.push(ep);
                        playSound('enemyShoot'); boss.lastAttackTime = now;
                    }
                } else if (boss.attackPattern === 'spawnMinions') {
                    const minionCount = (boss.punisherMinionCount ?? C.PUNISHER_ATTACK_SPAWN_MINION_COUNT) + boss.difficultyLevel;
                    if (enemies.length < minionCount && now > boss.lastAttackTime + ((C.PUNISHER_SPAWN_MINION_DURATION * 0.8) / minionCount)) {
                        const spawnX = (Math.random() * 0.6 + 0.2) * C.GAME_WIDTH;
                        enemies.push({ id: nextId++, x: spawnX, y: boss.y + C.PUNISHER_HEIGHT, type: 'standard', lastShotTime: now + Math.random() * C.ENEMY_SHOOT_INTERVAL, baseX: spawnX, oscillationFrequency: Math.random() * 1.0 + 0.5, oscillationAmplitude: Math.random() * 80 + 40, oscillationOffset: Math.random() * Math.PI * 2 });
                        boss.lastAttackTime = now;
                    }
                } else if (boss.attackPattern === 'laser' && bossLasers.length === 0 && timeInPattern < 100) {
                    const availableLanes = [0, 1, 3, 4];
                    const laserInfo = { chargeStartTime: now, fireStartTime: now + C.PUNISHER_LASER_CHARGE_TIME, duration: C.PUNISHER_LASER_FIRE_TIME };
                    bossLasers.push({ id: nextId++, lane: availableLanes.splice(Math.floor(Math.random() * availableLanes.length), 1)[0], ...laserInfo });
                    bossLasers.push({ id: nextId++, lane: availableLanes.splice(Math.floor(Math.random() * availableLanes.length), 1)[0], ...laserInfo });
                    if (boss.difficultyLevel >= 2) bossLasers.push({ id: nextId++, lane: 2, ...laserInfo });
                    playSound('laserShoot');
                }
            }
            break;
    }

    return { boss, enemies, enemyProjectiles, bossLasers, screenShake, inGameMessages, newExplosions, newCriticalHits };
}

/**
 * Handles all AI for standard enemies (shooting, dodging, special actions).
 * This function is now separate from spawning to ensure AI runs in all game modes.
 */
function runStandardEnemyAI(state: GameState, now: number) {
    const { enemies, projectiles, asteroids } = state; // Get a fresh copy of projectiles for AI decisions
    const fireRateMultiplier = state.isHardMode ? HARD_MODE_MULTIPLIERS.ENEMY_FIRE_RATE : 1.0;
    // This function will mutate the enemies array elements and push to other arrays,
    // which is consistent with the reducer's style of updating state.

    // Handle enemy AI actions (dodging, shooting, etc.)
    enemies.forEach(e => {
        // --- AI type-specific logic ---
        if (e.type === 'dodger') {
            // Only check for new dodge if not already dodging and not on cooldown
            if (!e.isDodging && now > (e.dodgeCooldownUntil ?? 0)) {
                let bestThreat = null;
                let minTimeToAction = 0.5; // Only react to threats within 0.5 seconds

                for (const p of projectiles) {
                    if (p.y < e.y) continue; // Projectile is already past

                    const projectileSpeedY = Math.cos((p.angle || 0) * Math.PI / 180) * C.PROJECTILE_SPEED;
                    if (projectileSpeedY <= 0) continue; // Not moving towards player

                    const timeToIntercept = (p.y - e.y) / projectileSpeedY;

                    if (timeToIntercept < 0 || timeToIntercept > minTimeToAction) continue;

                    const projectileSpeedX = Math.sin((p.angle || 0) * Math.PI / 180) * C.PROJECTILE_SPEED;
                    const predictedProjX = p.x + projectileSpeedX * timeToIntercept;
                    
                    // Simplified prediction for dodger X
                    const predictedDodgerX = e.x;

                    const collisionDistance = Math.abs(predictedProjX - predictedDodgerX);
                    const hitRadius = C.ENEMY_HITBOX_RADIUS * 1.5; // Generous hitbox for dodging

                    if (collisionDistance < hitRadius) {
                        // This is the most imminent threat found so far
                        minTimeToAction = timeToIntercept;
                        bestThreat = p;
                    }
                }

                if (bestThreat) {
                    e.isDodging = true;
                    const dodgeDistance = 80 + Math.random() * 40; // Add some variability
                    const dodgeDirection = bestThreat.x < e.x ? 1 : -1;
                    let targetX = e.x + dodgeDirection * dodgeDistance;
                    
                    targetX = Math.max(C.ENEMY_WIDTH / 2, Math.min(C.GAME_WIDTH - C.ENEMY_WIDTH / 2, targetX));
                    
                    e.dodgeTargetX = targetX;
                }
            }
        } else if (e.type === 'weaver') {
            // Check if the weaver should start pausing
            if (!e.isPausing && e.y >= (e.diveTargetY ?? C.PLAYER_Y_POSITION)) {
                e.isPausing = true;
                e.pauseEndTime = now + C.WEAVER_PAUSE_DURATION;
            }
            
            if (e.isPausing) {
                // Logic for while it's paused
                if (now > (e.pauseEndTime ?? 0)) {
                    e.isPausing = false; // Stop pausing
                } else if (now > (e.lastBeamTime ?? 0) + C.WEAVER_BEAM_INTERVAL / fireRateMultiplier) {
                    // Fire beam while paused
                    const beam = pools.weaverBeams.get();
                    beam.id = nextId++; beam.y = e.y; beam.createdAt = now;
                    state.weaverBeams.push(beam);
                    e.lastBeamTime = now;
                    playSound('weaverBeam');
                }
            }
        }
    
        // --- Shooting logic (for enemies that shoot projectiles) ---
        if ((e.type === 'standard' || e.type === 'dodger') && now > e.lastShotTime) {
            if (e.isBuffedByConduit && e.type === 'standard') {
                const ep1 = pools.enemyProjectiles.get();
                ep1.id = nextId++; ep1.x = e.x - 15; ep1.y = e.y + C.ENEMY_HEIGHT/2;
                state.enemyProjectiles.push(ep1);

                const ep2 = pools.enemyProjectiles.get();
                ep2.id = nextId++; ep2.x = e.x; ep2.y = e.y + C.ENEMY_HEIGHT/2;
                state.enemyProjectiles.push(ep2);

                const ep3 = pools.enemyProjectiles.get();
                ep3.id = nextId++; ep3.x = e.x + 15; ep3.y = e.y + C.ENEMY_HEIGHT/2;
                state.enemyProjectiles.push(ep3);

            } else {
                const ep = pools.enemyProjectiles.get();
                ep.id = nextId++; ep.x = e.x; ep.y = e.y + C.ENEMY_HEIGHT / 2;
                state.enemyProjectiles.push(ep);
            }
            playSound('enemyShoot');
            e.lastShotTime = now + (C.ENEMY_SHOOT_INTERVAL / fireRateMultiplier) + (Math.random() - 0.5) * C.ENEMY_SHOOT_JITTER;
        }
    });
    
    // Handle Conduit logic
    const conduits = enemies.filter(e => e.type === 'conduit');
    const potentialTargets = [...enemies.filter(e => e.type !== 'conduit'), ...asteroids];
    for (const conduit of conduits) {
        if (conduit.linkedEnemyId && !potentialTargets.find(t => t.id === conduit.linkedEnemyId)) conduit.linkedEnemyId = null;
        if (!conduit.linkedEnemyId) {
            let closestTarget = null, minDistance = Infinity;
            for (const target of potentialTargets) {
                if (target.isBuffedByConduit) continue;
                const dist = Math.sqrt((conduit.x - target.x)**2 + (conduit.y - target.y)**2);
                if (dist < minDistance) { minDistance = dist; closestTarget = target; }
            }
            if (closestTarget) { conduit.linkedEnemyId = closestTarget.id; closestTarget.isBuffedByConduit = true; if ('type' in closestTarget && closestTarget.type === 'dodger') closestTarget.shieldHealth = 1; }
        }
    }
    enemies.forEach(e => { if (e.type === 'dodger' && e.isBuffedByConduit && (e.shieldHealth ?? 0) <= 0 && now > (e.shieldRegenTime ?? 0)) e.shieldHealth = 1; });
}

/**
 * Handles spawning of enemies and asteroids in normal gameplay modes.
 */
function runSpawning(state: GameState, now: number, gameTime: number) {
    let { lastSpawnTime, enemies, asteroids, level, seenEnemies, inGameMessages } = state;
    const spawnRateMultiplier = state.isHardMode ? HARD_MODE_MULTIPLIERS.ENEMY_SPAWN_RATE : 1.0;
    
    if (state.isMontezumaActive) {
        return { lastSpawnTime, enemies, asteroids, seenEnemies, inGameMessages };
    }

    if (state.status === GameStatus.AsteroidField) {
        const asteroidSpawnInterval = (C.ASTEROID_FIELD_BASE_SPAWN_INTERVAL / (1 + (level / 40))) / spawnRateMultiplier;
        if (state.asteroidFieldEndTime && now < state.asteroidFieldEndTime) {
            if (now - lastSpawnTime > asteroidSpawnInterval) {
                lastSpawnTime = now;
                const roll = Math.random() * C.ASTEROID_TOTAL_SPAWN_WEIGHT;
                const sizeKey = (roll < C.ASTEROID_SIZES.large.spawnWeight) ? 'large' : (roll < C.ASTEROID_SIZES.large.spawnWeight + C.ASTEROID_SIZES.medium.spawnWeight) ? 'medium' : 'small';
                const config = C.ASTEROID_SIZES[sizeKey];
                asteroids.push({ id: nextId++, x: Math.random() * C.GAME_WIDTH, y: -config.radius, vx: (Math.random() - 0.5) * 80 * (1 + (level/40)), vy: C.ASTEROID_BASE_SPEED_Y * (1 + (Math.random() - 0.5) * 0.4) * (1 + (level/40)), health: config.health, maxHealth: config.health, size: config.radius, rotation: Math.random() * 360, rotationSpeed: (Math.random() - 0.5) * 120 * (1 + (level/40)) });
            }
        }
    } else {
        const spawnInterval = (C.INITIAL_SPAWN_INTERVAL - (C.INITIAL_SPAWN_INTERVAL - C.SPAWN_INTERVAL_MIN) * Math.min(1, gameTime / C.SPAWN_RAMP_UP_TIME)) / spawnRateMultiplier;
        if (now - lastSpawnTime > spawnInterval) {
            lastSpawnTime = now;
            const conduitRampProgress = Math.min(1, (state.level - C.CONDUIT_SPAWN_START_LEVEL) / C.CONDUIT_SPAWN_CHANCE_RAMP_LEVELS);
            const weaverRampProgress = Math.min(1, (state.level - C.WEAVER_SPAWN_START_LEVEL) / C.WEAVER_SPAWN_CHANCE_RAMP_LEVELS);
            
            if (level >= C.WEAVER_SPAWN_START_LEVEL && Math.random() < C.WEAVER_SPAWN_CHANCE_INITIAL + (C.WEAVER_SPAWN_CHANCE_MAX - C.WEAVER_SPAWN_CHANCE_INITIAL) * weaverRampProgress) {
                if (!seenEnemies.has('weaver')) {
                    const msg = pools.inGameMessages.get();
                    msg.id = nextId++; msg.text = 'Enemy: Weaver'; msg.createdAt = now; msg.duration = 3000; msg.style = 'warning';
                    inGameMessages.push(msg);
                    seenEnemies.add('weaver');
                }
                const spawnX = Math.random() * (C.GAME_WIDTH - 240) + 120;
                enemies.push({ id: nextId++, x: spawnX, y: -C.ENEMY_HEIGHT, type: 'weaver', health: C.WEAVER_HEALTH, lastShotTime: 0, baseX: spawnX, oscillationFrequency: 0, oscillationAmplitude: 0, oscillationOffset: 0, diveTargetY: Math.random() * (C.PLAYER_Y_POSITION - 300) + 150, lastBeamTime: now + Math.random() * C.WEAVER_BEAM_INTERVAL });
            } else if (level >= C.CONDUIT_SPAWN_START_LEVEL && enemies.filter(e => e.type === 'conduit').length < C.CONDUIT_MAX_ACTIVE && Math.random() < C.CONDUIT_SPAWN_CHANCE_INITIAL + (C.CONDUIT_SPAWN_CHANCE_MAX - C.CONDUIT_SPAWN_CHANCE_INITIAL) * conduitRampProgress) {
                 if (!seenEnemies.has('conduit')) {
                    const msg = pools.inGameMessages.get();
                    msg.id = nextId++; msg.text = 'Enemy: Conduit'; msg.createdAt = now; msg.duration = 3000; msg.style = 'warning';
                    inGameMessages.push(msg);
                    seenEnemies.add('conduit');
                 }
                 const scaledHealth = C.CONDUIT_HEALTH + (Math.floor((level - C.CONDUIT_SPAWN_START_LEVEL) / C.CONDUIT_HEALTH_SCALING_INTERVAL) * C.CONDUIT_HEALTH_SCALING_AMOUNT);
                 enemies.push({ id: nextId++, x: Math.random() * (C.GAME_WIDTH - C.ENEMY_WIDTH * 2) + C.ENEMY_WIDTH, y: -C.ENEMY_HEIGHT, type: 'conduit', health: scaledHealth, maxHealth: scaledHealth, lastShotTime: 0, baseX: Math.random() * (C.GAME_WIDTH - C.ENEMY_WIDTH * 2) + C.ENEMY_WIDTH, oscillationFrequency: 0.5, oscillationAmplitude: C.GAME_WIDTH / 3, oscillationOffset: Math.random() * Math.PI * 2, linkedEnemyId: null });
            } else if (state.bossesDefeated > 0 && state.level >= C.ASTEROID_SPAWN_UNLOCK_LEVEL && Math.random() < C.ASTEROID_SPAWN_CHANCE) {
                if (!seenEnemies.has('asteroid')) {
                    const msg = pools.inGameMessages.get();
                    msg.id = nextId++; msg.text = 'Threat: Asteroids'; msg.createdAt = now; msg.duration = 3000; msg.style = 'warning';
                    inGameMessages.push(msg);
                    seenEnemies.add('asteroid');
                }
                const roll = Math.random() * C.ASTEROID_TOTAL_SPAWN_WEIGHT;
                const sizeKey = (roll < C.ASTEROID_SIZES.large.spawnWeight) ? 'large' : (roll < C.ASTEROID_SIZES.large.spawnWeight + C.ASTEROID_SIZES.medium.spawnWeight) ? 'medium' : 'small';
                const config = C.ASTEROID_SIZES[sizeKey];
                asteroids.push({ id: nextId++, x: Math.random() * C.GAME_WIDTH, y: -config.radius, vx: (Math.random() - 0.5) * 40, vy: C.ASTEROID_BASE_SPEED_Y * (1 + (Math.random() - 0.5) * 0.4), health: config.health, maxHealth: config.health, size: config.radius, rotation: Math.random() * 360, rotationSpeed: (Math.random() - 0.5) * 60 });
            } else {
                let isDodger = false;
                if (state.bossDefeatCount.punisher > 0 && state.level >= C.DODGER_SPAWN_START_LEVEL) {
                    const rampProgress = Math.min(1, (state.level - C.DODGER_SPAWN_START_LEVEL) / C.DODGER_SPAWN_CHANCE_RAMP_LEVELS);
                    if (Math.random() < C.DODGER_SPAWN_CHANCE_INITIAL + (C.DODGER_SPAWN_CHANCE_MAX - C.DODGER_SPAWN_CHANCE_INITIAL) * rampProgress) isDodger = true;
                }
                if (isDodger && !seenEnemies.has('dodger')) {
                    const msg = pools.inGameMessages.get();
                    msg.id = nextId++; msg.text = 'Enemy: Dodger'; msg.createdAt = now; msg.duration = 3000; msg.style = 'warning';
                    inGameMessages.push(msg);
                    seenEnemies.add('dodger');
                } else if (!isDodger && !seenEnemies.has('standard') && state.level === 1) {
                     const msg = pools.inGameMessages.get();
                     msg.id = nextId++; msg.text = 'Enemy: Swarmers'; msg.createdAt = now; msg.duration = 3000; msg.style = 'warning';
                     inGameMessages.push(msg);
                     seenEnemies.add('standard');
                }
                const spawnX = Math.random() * (C.GAME_WIDTH - 240) + 120;
                enemies.push({ id: nextId++, x: spawnX, y: -C.ENEMY_HEIGHT, type: isDodger ? 'dodger' : 'standard', lastShotTime: now + Math.random() * C.ENEMY_SHOOT_INTERVAL, baseX: spawnX, oscillationFrequency: Math.random() * 1.0 + 0.5, oscillationAmplitude: Math.random() * 80 + 40, oscillationOffset: Math.random() * Math.PI * 2, dodgeCooldownUntil: 0 });
            }
        }
    }

    return { lastSpawnTime, enemies, asteroids, seenEnemies, inGameMessages };
}

/**
 * Handles all collision detection and resolves their outcomes (damage, score, effects).
 */
function resolveCollisions(state: GameState, now: number, grid: SpatialGrid) {
    let { 
        playerX, projectiles, enemies, enemyProjectiles, asteroids, powerUps, activePowerUps, score, 
        currencyEarnedThisRun, partsEarnedThisRun, boss, levelStreakThisRun, reloadBoosts, wasBossHit,
        inGameMessages, screenFlashStartTime
    } = state;

    let newExplosions: GameState['explosions'] = [];
    let newDamageNumbers: GameState['damageNumbers'] = [];
    let newRockImpacts: GameState['rockImpacts'] = [];
    let newCriticalHits: GameState['criticalHits'] = [];
    let newGibs: GameState['gibs'] = [];
    let screenShake: GameState['screenShake'] = { magnitude: 0, duration: 0, startTime: 0 };
    let lightning: GameState['lightning'] = null;
    let empArcs: GameState['empArcs'] = [];
    let lastEmpFireTime = state.lastEmpFireTime;
    let upgradePartCollects: GameState['upgradePartCollects'] = [];
    let newPowerUpInfusions: GameState['powerUpInfusions'] = [];
    let gameOver = false;
    let reviveTriggerTime = state.reviveTriggerTime;
    let hasRevive = state.hasRevive;
    let shieldBreakingUntil = state.shieldBreakingUntil;
    let enemiesDefeatedThisTick = 0;

    const streakMultiplier = 1 + levelStreakThisRun * C.CURRENCY_STREAK_BONUS_PER_LEVEL;

    const applyShake = (magnitude: number, duration: number, time: number) => {
        if (magnitude > screenShake.magnitude) {
            screenShake = { magnitude, duration, startTime: time };
        }
    };

    const destroyedEnemyIds = new Set<number>();
    const destroyedProjectileIds = new Set<number>();
    const destroyedAsteroidIds = new Set<number>();
    const destroyedEnemyProjectileIds = new Set<number>();
    const collectedPowerUpIds = new Set<number>();
    
    const getCritChance = () => {
        let critChance = activePowerUps.CritBoost ? C.CRITICAL_HIT_CHANCE * C.CRIT_BOOST_MODIFIER : C.CRITICAL_HIT_CHANCE;
        if (state.selectedHero === 'alpha') {
            const level = state.heroUpgrades.alpha_aoe_level;
            if (level > 0) {
                critChance += C.ALPHA_CRIT_CHANCE_BONUS + (C.HANGAR_ALPHA_UPGRADE_CONFIG[level - 1]?.critChanceBonus || 0);
            } else {
                 critChance += C.ALPHA_CRIT_CHANCE_BONUS;
            }
        }
        return critChance;
    };
    
    const calculateDamage = (isCrit: boolean) => {
        const baseDamage = Math.floor(Math.random() * (C.PLAYER_PROJECTILE_DAMAGE_MAX - C.PLAYER_PROJECTILE_DAMAGE_MIN + 1)) + C.PLAYER_PROJECTILE_DAMAGE_MIN;
        return isCrit ? Math.floor(baseDamage * C.CRITICAL_HIT_DAMAGE_MULTIPLIER) : baseDamage;
    };

    grid.clear();
    state.projectiles.forEach(p => grid.insert({ ...p, radius: C.PROJECTILE_HITBOX_RADIUS }));
    state.enemies.forEach(e => grid.insert({ ...e, radius: C.ENEMY_HITBOX_RADIUS }));
    state.asteroids.forEach(a => grid.insert({ ...a, radius: a.size }));
    const playerCollidable: Collidable = { id: -1, x: playerX, y: C.PLAYER_Y_POSITION + 30, radius: 40 };
    
    // --- Player Projectile Collisions ---
    for (const proj of projectiles) {
        if (destroyedProjectileIds.has(proj.id)) continue;

        // Create a collidable for the projectile to query the grid
        const projCollidable: Collidable = { ...proj, radius: C.PROJECTILE_HITBOX_RADIUS };
        const potentialTargets = grid.getNearby(projCollidable);
        
        // vs Boss
        if (boss && boss.phase !== 'defeated' && !boss.isInvulnerable) {
            const bossWidth = boss.bossType === 'punisher' ? C.PUNISHER_WIDTH : boss.bossType === 'warden' ? C.WARDEN_WIDTH : C.OVERMIND_WIDTH;
            const bossHeight = boss.bossType === 'punisher' ? C.PUNISHER_HEIGHT : boss.bossType === 'warden' ? C.WARDEN_HEIGHT : C.OVERMIND_HEIGHT;
            const bossCenterY = boss.y + bossHeight / 2;
            if (Math.sqrt(Math.pow(boss.x - proj.x, 2) + Math.pow(bossCenterY - proj.y, 2)) < bossWidth / 2 + C.PROJECTILE_HITBOX_RADIUS) {
                const isCrit = Math.random() < getCritChance();
                let damage = calculateDamage(isCrit);

                // Heretical Insight Bonus
                if (state.hasHereticalInsight && (boss.phase === 'fury' || boss.phase === 'beam')) {
                    damage = Math.floor(damage * 2.0);
                }

                destroyedProjectileIds.add(proj.id);
                boss.health -= damage;
                score += C.BOSS_HIT_SCORE;
                wasBossHit = true;
                playSound('bossHit');
                if (isCrit) { playSound('criticalHit'); triggerHaptic('criticalHit'); }

                const dn = pools.damageNumbers.get();
                dn.id = nextId++; dn.x = proj.x; dn.y = proj.y; dn.text = `${damage}`; dn.isCrit = isCrit; dn.createdAt = now; dn.initialDriftX = (Math.random() - 0.5) * 20;
                newDamageNumbers.push(dn);
                
                let newDifficultyLevel = C.BOSS_HEALTH_THRESHOLDS.filter(t => boss.health / boss.maxHealth < t).length;
                if (newDifficultyLevel > boss.difficultyLevel) { boss.difficultyLevel = newDifficultyLevel; if (boss.bossType !== 'overmind') playSound('levelUp'); }
                if (boss.health <= 0) {
                    boss.phase = 'defeated'; boss.phaseStartTime = now; boss.explosionsFired = 0; boss.lastExplosionTime = now;
                    enemies = []; state.weaverBeams = []; state.bossLasers = [];
                    playSound('gameOver'); triggerHaptic('bossDefeat');
                    applyShake(C.SCREEN_SHAKE_MAGNITUDE_BOSS_DEATH, C.SCREEN_SHAKE_DURATION_BOSS_DEATH, now);
                }
                continue; // Projectile is used, go to next one
            }
        }

        for(const target of potentialTargets) {
            if (destroyedProjectileIds.has(proj.id)) break; // projectile already hit something

            const originalTarget = state.enemies.find(e => e.id === target.id) || state.asteroids.find(a => a.id === target.id);
            if (!originalTarget) continue;

            if ('vx' in originalTarget) { // It's an asteroid
                const asteroid = originalTarget;
                if (destroyedAsteroidIds.has(asteroid.id)) continue;
                const asteroidCenterY = asteroid.y; // The y-coord is the center
                if (Math.sqrt(Math.pow(asteroid.x - proj.x, 2) + Math.pow(asteroidCenterY - proj.y, 2)) < asteroid.size + C.PROJECTILE_HITBOX_RADIUS) {
                    const isCrit = Math.random() < getCritChance();
                    const damage = calculateDamage(isCrit);

                    asteroid.health -= damage;
                    asteroid.lastHitTime = now;
                    destroyedProjectileIds.add(proj.id);
                    
                    const imp = pools.rockImpacts.get();
                    imp.id = nextId++; imp.x = proj.x; imp.y = proj.y; imp.createdAt = now;
                    newRockImpacts.push(imp);

                    playSound('bossHit');
                    if (isCrit) playSound('criticalHit');

                    const dn = pools.damageNumbers.get();
                    dn.id = nextId++; dn.x = proj.x; dn.y = proj.y; dn.text = `${damage}`; dn.isCrit = isCrit; dn.createdAt = now; dn.initialDriftX = (Math.random() - 0.5) * 20;
                    newDamageNumbers.push(dn);

                    if (asteroid.health <= 0) {
                        destroyedAsteroidIds.add(asteroid.id);
                        if (asteroid.id !== -999) { // Don't give rewards for regular asteroids during Montezuma logic
                            let sizeKey = (asteroid.size === C.ASTEROID_SIZES.medium.radius) ? 'medium' : (asteroid.size === C.ASTEROID_SIZES.large.radius) ? 'large' : 'small';
                            const stats = C.ASTEROID_SIZES[sizeKey];
                            score += stats.score; currencyEarnedThisRun += Math.floor(stats.currency * streakMultiplier);
                            if (state.bossesDefeated > 0 && Math.random() < stats.partChance) {
                                partsEarnedThisRun++; playSound('partCollect');
                                const up = pools.upgradeParts.get();
                                up.id = nextId++; up.x = asteroid.x; up.y = asteroid.y; up.createdAt = now; up.startX = asteroid.x; up.startY = asteroid.y;
                                upgradePartCollects.push(up);
                            }
                        }
                        playSound('explosion'); triggerHaptic('explosion');
                        applyShake(C.SCREEN_SHAKE_MAGNITUDE_EXPLOSION, C.SCREEN_SHAKE_DURATION_EXPLOSION, now);
                        
                        const crit = pools.criticalHits.get();
                        crit.id = nextId++; crit.x = asteroid.x; crit.y = asteroid.y; crit.radius = asteroid.size * 1.5; crit.createdAt = now;
                        newCriticalHits.push(crit);
                    }
                }
            } else { // It's an enemy
                const enemy = originalTarget as EnemyType;
                if (destroyedEnemyIds.has(enemy.id)) continue;
                const enemyCenterY = enemy.y + C.ENEMY_HEIGHT / 2;
                if (Math.sqrt(Math.pow(enemy.x - proj.x, 2) + Math.pow(enemyCenterY - proj.y, 2)) < C.ENEMY_HITBOX_RADIUS + C.PROJECTILE_HITBOX_RADIUS) {
                    enemy.lastHitTime = now;
                    if (enemy.type === 'dodger' && enemy.isBuffedByConduit && (enemy.shieldHealth ?? 0) > 0) {
                        enemy.shieldHealth = (enemy.shieldHealth ?? 1) - 1; enemy.shieldRegenTime = now + C.CONDUIT_BUFF_SHIELD_REGEN_TIME; destroyedProjectileIds.add(proj.id); playSound('shieldBreak'); continue;
                    }
                    
                    const canBeCrit = enemy.type !== 'conduit' && enemy.type !== 'weaver' && enemy.type !== 'heretic_ship';
                    const isCrit = canBeCrit && Math.random() < getCritChance();
                    const damage = calculateDamage(isCrit);
                    
                    const dn = pools.damageNumbers.get();
                    dn.id = nextId++; dn.x = enemy.x; dn.y = enemy.y; dn.text = `${damage}`; dn.isCrit = isCrit; dn.createdAt = now; dn.initialDriftX = (Math.random() - 0.5) * 20;
                    newDamageNumbers.push(dn);

                    if (enemy.type === 'conduit' || enemy.type === 'weaver' || enemy.type === 'heretic_ship') {
                        enemy.health = (enemy.health ?? 0) - damage;
                        destroyedProjectileIds.add(proj.id);
                        playSound('bossHit');
                        if (enemy.health > 0) continue;
                    }
                    
                    score += C.SCORE_PER_HIT; currencyEarnedThisRun += Math.floor(C.CURRENCY_PER_KILL * streakMultiplier); 

                    const exp = pools.explosions.get();
                    exp.id = nextId++; exp.x = enemy.x; exp.y = enemy.y; exp.createdAt = now;
                    exp.particles = Array.from({ length: 25 }, () => ({
                      angle: Math.random() * 2 * Math.PI,
                      distance: Math.random() * 50 + 25,
                      size: Math.random() * 12 + 8,
                      color: ['#f09', '#ff007f', '#fff'][Math.floor(Math.random() * 3)],
                    }));
                    newExplosions.push(exp);

                    destroyedEnemyIds.add(enemy.id); if (!destroyedProjectileIds.has(proj.id)) destroyedProjectileIds.add(proj.id);
                    playSound('explosion'); triggerHaptic('explosion');
                    applyShake(C.SCREEN_SHAKE_MAGNITUDE_EXPLOSION, C.SCREEN_SHAKE_DURATION_EXPLOSION, now);
                    screenFlashStartTime = now;
                    enemiesDefeatedThisTick++;
                    if (state.bossesDefeated > 0 && Math.random() < C.UPGRADE_PART_DROP_CHANCE_ENEMY) {
                        partsEarnedThisRun++; playSound('partCollect');
                        const up = pools.upgradeParts.get();
                        up.id = nextId++; up.x = enemy.x; up.y = enemy.y; up.createdAt = now; up.startX = enemy.x; up.startY = enemy.y;
                        upgradePartCollects.push(up);
                    }
                    
                    if (isCrit) {
                        playSound('criticalHit'); triggerHaptic('criticalHit');
                        applyShake(C.SCREEN_SHAKE_MAGNITUDE_EXPLOSION * 1.2, C.SCREEN_SHAKE_DURATION_EXPLOSION * 1.2, now);
                        if (state.selectedHero === 'alpha' && state.heroUpgrades.alpha_aoe_level > 0) setTimeout(() => playSound('explosion'), 80);
                        let critRadius = C.CRITICAL_HIT_RADIUS * (1 + (state.selectedHero === 'alpha' ? C.HANGAR_ALPHA_UPGRADE_CONFIG[state.heroUpgrades.alpha_aoe_level - 1]?.effect || 0 : 0));
                        const crit = pools.criticalHits.get();
                        crit.id = nextId++; crit.x = enemy.x; crit.y = enemy.y; crit.radius = critRadius; crit.createdAt = now;
                        newCriticalHits.push(crit);
                        
                        let points = `${enemy.x + (Math.random() - 0.5) * 50},0`, currentX = enemy.x, currentY = 0;
                        for (let i = 1; i <= 5; i++) { currentX += ((enemy.x - currentX) / (6 - i)) + (Math.random() - 0.5) * 40; points += ` ${currentX},${(enemy.y / 5) * i}`; }
                        
                        const l = pools.lightning.get();
                        l.id = nextId++; l.segments = points; l.createdAt = now;
                        lightning = l;

                        const critTargets = grid.getNearby({ ...enemy, radius: critRadius });
                        for (const otherTarget of critTargets) {
                            const otherEnemy = state.enemies.find(e => e.id === otherTarget.id);
                            if (!otherEnemy || destroyedEnemyIds.has(otherEnemy.id)) continue;
                            const distanceSq = (otherEnemy.x - enemy.x)**2 + (otherEnemy.y - enemy.y)**2;
                            if (distanceSq < critRadius**2) {
                                score += C.SCORE_PER_HIT; currencyEarnedThisRun += Math.floor(C.CURRENCY_PER_KILL * streakMultiplier); 

                                const critExp = pools.explosions.get();
                                critExp.id = nextId++; critExp.x = otherEnemy.x; critExp.y = otherEnemy.y; critExp.createdAt = now;
                                critExp.particles = Array.from({ length: 25 }, () => ({
                                  angle: Math.random() * 2 * Math.PI,
                                  distance: Math.random() * 50 + 25,
                                  size: Math.random() * 12 + 8,
                                  color: ['#f09', '#ff007f', '#fff'][Math.floor(Math.random() * 3)],
                                }));
                                newExplosions.push(critExp);

                                destroyedEnemyIds.add(otherEnemy.id); playSound('explosion'); enemiesDefeatedThisTick++;

                                const critDn = pools.damageNumbers.get();
                                critDn.id = nextId++; critDn.x = otherEnemy.x; critDn.y = otherEnemy.y; critDn.text = `${damage}`; critDn.isCrit = true; critDn.createdAt = now; critDn.initialDriftX = (Math.random() - 0.5) * 20;
                                newDamageNumbers.push(critDn);
                            }
                        }
                    }
                    if (enemy.type !== 'conduit' && Math.random() < C.POWERUP_SPAWN_CHANCE_ON_ENEMY_DEATH) {
                        const powerUpTypes: PowerUpInterface['powerUpType'][] = ['RapidFire', 'SpreadShot', 'Shield', 'ExtendedMag', 'AutoReload', 'CritBoost', 'ReloadBoost'];
                        const pu = pools.powerUps.get();
                        pu.id = nextId++; pu.x = enemy.x; pu.y = enemy.y; pu.powerUpType = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
                        powerUps.push(pu);
                    }
                }
            }
        }
    }

    // --- Player Hit Detection ---
    const checkPlayerCollision = (targetX: number, targetY: number, targetRadius: number): boolean => {
        const mainHitboxCenterY = C.PLAYER_Y_POSITION + C.PLAYER_HITBOX_MAIN_Y_OFFSET;
        const distSqMain = Math.pow(targetX - playerX, 2) + Math.pow(targetY - mainHitboxCenterY, 2);
        if (distSqMain < Math.pow(C.PLAYER_HITBOX_MAIN_RADIUS + targetRadius, 2)) return true;
        const noseHitboxCenterY = C.PLAYER_Y_POSITION + C.PLAYER_HITBOX_NOSE_Y_OFFSET;
        const distSqNose = Math.pow(targetX - playerX, 2) + Math.pow(targetY - noseHitboxCenterY, 2);
        if (distSqNose < Math.pow(C.PLAYER_HITBOX_NOSE_RADIUS + targetRadius, 2)) return true;
        return false;
    };
    const playerCenterY = C.PLAYER_Y_POSITION + (C.GAME_HEIGHT * 0.10) / 2;

    const handlePlayerHit = () => {
        if (now < reviveTriggerTime + C.REVIVE_INVULNERABILITY_DURATION || shieldBreakingUntil > now) return false;
        if (activePowerUps.Shield) {
            const newHp = (activePowerUps.Shield.hp ?? 1) - 1;
            if (newHp <= 0) shieldBreakingUntil = now + C.SHIELD_BREAK_ANIMATION_DURATION;
            else activePowerUps.Shield.hp = newHp;
            playSound('shieldBreak');
            triggerHaptic('shieldBreak');
            applyShake(C.SCREEN_SHAKE_MAGNITUDE_EXPLOSION, C.SCREEN_SHAKE_DURATION_EXPLOSION, now);
            return false;
        }
        if (hasRevive) {
            playSound('revive'); 
            hasRevive = false; 
            reviveTriggerTime = now;
            enemies = [];
            enemyProjectiles = [];
            asteroids = [];
            state.bossLasers = []; 
            if(state.boss?.beamFireStartTime) state.boss.beamFireStartTime = undefined;
            state.weaverBeams = [];
            return false;
        }
        gameOver = true;
        triggerHaptic('playerDamage');
        applyShake(C.SCREEN_SHAKE_MAGNITUDE_EXPLOSION * 1.5, C.SCREEN_SHAKE_DURATION_EXPLOSION, now);
        return true;
    };

    if (!gameOver) for (const asteroid of asteroids) {
        if (destroyedAsteroidIds.has(asteroid.id)) continue;
        const asteroidCenterY = asteroid.y; // The y-coord is the center
        if (checkPlayerCollision(asteroid.x, asteroidCenterY, asteroid.size)) {
            if (handlePlayerHit()) break;
        }
    }
    if (!gameOver && boss?.bossType === 'overmind' && boss.beamFireStartTime && now > boss.beamFireStartTime && (playerX < (boss.safeSpotX ?? 0) || playerX > (boss.safeSpotX ?? 0) + C.OVERMIND_BEAM_SAFE_ZONE_WIDTH)) handlePlayerHit();
    if (!gameOver) for (const laser of state.bossLasers) if (now >= laser.fireStartTime && Math.floor(playerX / (C.GAME_WIDTH / C.LANE_COUNT)) === laser.lane) if (handlePlayerHit()) break;
    if (!gameOver) for (const beam of state.weaverBeams) {
        if (playerCenterY > beam.y - C.WEAVER_BEAM_HITBOX_HEIGHT / 2 && playerCenterY < beam.y + C.WEAVER_BEAM_HITBOX_HEIGHT / 2) if (handlePlayerHit()) break;
    }
    if (!gameOver) for (const enemy of enemies) {
        if (destroyedEnemyIds.has(enemy.id)) continue;
        const enemyCenterY = enemy.y + C.ENEMY_HEIGHT / 2;
        if (checkPlayerCollision(enemy.x, enemyCenterY, C.ENEMY_HITBOX_RADIUS)) {
            // Kamikaze enemy explosion
            const exp = pools.explosions.get();
            exp.id = nextId++; exp.x = enemy.x; exp.y = enemy.y; exp.createdAt = now;
            exp.particles = Array.from({ length: 25 }, () => ({
              angle: Math.random() * 2 * Math.PI,
              distance: Math.random() * 50 + 25,
              size: Math.random() * 12 + 8,
              color: ['#f09', '#ff007f', '#fff'][Math.floor(Math.random() * 3)],
            }));
            newExplosions.push(exp);
            playSound('explosion');
            triggerHaptic('explosion');
            applyShake(C.SCREEN_SHAKE_MAGNITUDE_EXPLOSION, C.SCREEN_SHAKE_DURATION_EXPLOSION, now);

            destroyedEnemyIds.add(enemy.id);
            enemiesDefeatedThisTick++;
            if (handlePlayerHit()) break;
        }
    }
    if (!gameOver) for (const proj of enemyProjectiles) if (!destroyedEnemyProjectileIds.has(proj.id) && checkPlayerCollision(proj.x, proj.y, C.ENEMY_PROJECTILE_HITBOX_RADIUS)) { destroyedEnemyProjectileIds.add(proj.id); if (handlePlayerHit()) break; }
    if (!gameOver) for (const p of powerUps) {
        if (checkPlayerCollision(p.x, p.y, C.POWERUP_HITBOX_RADIUS)) {
            collectedPowerUpIds.add(p.id);

            const pui = pools.powerUpInfusions.get();
            pui.id = nextId++; pui.createdAt = now; pui.powerUpType = p.powerUpType;
            newPowerUpInfusions.push(pui);

            const powerUpNameMap: Record<PowerUpInterface['powerUpType'], string> = { RapidFire: 'RAPID FIRE', SpreadShot: 'SPREAD SHOT', Shield: 'SHIELD ACTIVE', ExtendedMag: 'EXTENDED MAG', AutoReload: 'AUTO-RELOAD', CritBoost: 'CRITICAL BOOST', ReloadBoost: 'RELOAD BOOST' };
            const msg = pools.inGameMessages.get();
            msg.id = nextId++; msg.text = powerUpNameMap[p.powerUpType]; msg.createdAt = now; msg.duration = 2500; msg.style = 'achievement';
            inGameMessages.push(msg);

            if (p.powerUpType === 'Shield') {
                 activePowerUps.Shield = { expiresAt: Infinity, hp: (state.selectedHero === 'gamma' && state.heroUpgrades.gamma_shield_hp_level > 0 ? C.HANGAR_GAMMA_UPGRADE_CONFIG[state.heroUpgrades.gamma_shield_hp_level - 1].effect : 1) };
            } else if (p.powerUpType === 'ReloadBoost') reloadBoosts++;
            else activePowerUps[p.powerUpType] = { expiresAt: now + C.POWERUP_DURATION };
            playSound('powerUp');
        }
    }


    if (gameOver) {
        const playerDeathPosition = { x: playerX, y: playerCenterY };
        const exp = pools.explosions.get();
        exp.id = nextId++; exp.x = playerDeathPosition.x; exp.y = playerDeathPosition.y; exp.createdAt = now;
        exp.particles = Array.from({ length: 25 }, () => ({
            angle: Math.random() * 2 * Math.PI,
            distance: Math.random() * 50 + 25,
            size: Math.random() * 12 + 8,
            color: ['#f09', '#ff007f', '#fff'][Math.floor(Math.random() * 3)],
        }));
        newExplosions.push(exp);
        playSound('explosion');
        playSound('gameOver');
    }

    // Continuous shake for Overmind beam
    if (boss?.bossType === 'overmind' && boss.beamFireStartTime && now > boss.beamFireStartTime && now < boss.beamFireStartTime + C.OVERMIND_BEAM_FIRE_TIME) {
        applyShake(6, 100, now); // A noticeable but not overwhelming shake
    }

    // EMP Arc from Gamma shield
    const gammaUpgradeLevel = state.heroUpgrades.gamma_shield_hp_level;
    if (state.selectedHero === 'gamma' && gammaUpgradeLevel >= 2 && activePowerUps.Shield && now > lastEmpFireTime + (gammaUpgradeLevel === 2 ? C.GAMMA_EMP_L2_COOLDOWN : C.GAMMA_EMP_L3_COOLDOWN)) {
        let nearestEnemy = null, minDistanceSq = (gammaUpgradeLevel === 2 ? C.GAMMA_EMP_L2_RANGE : C.GAMMA_EMP_L3_RANGE)**2;
        const potentialEmpTargets = grid.getNearby({ ...playerCollidable, radius: (gammaUpgradeLevel === 2 ? C.GAMMA_EMP_L2_RANGE : C.GAMMA_EMP_L3_RANGE) });
        for (const target of potentialEmpTargets) {
            const enemy = state.enemies.find(e => e.id === target.id);
            if (!enemy || destroyedEnemyIds.has(enemy.id)) continue;
            const distSq = (enemy.x - playerX)**2 + (enemy.y - playerCenterY)**2;
            if (distSq < minDistanceSq) { minDistanceSq = distSq; nearestEnemy = enemy; }
        }
        if (nearestEnemy && Math.random() < (gammaUpgradeLevel === 2 ? C.GAMMA_EMP_L2_CHANCE : C.GAMMA_EMP_L3_CHANCE)) {
            lastEmpFireTime = now; playSound('empArc');
            const arc = pools.empArcs.get();
            arc.id = nextId++; arc.startX = playerX; arc.startY = playerCenterY; arc.endX = nearestEnemy.x; arc.endY = nearestEnemy.y; arc.createdAt = now;
            empArcs.push(arc);
            
            const dn = pools.damageNumbers.get();
            dn.id = nextId++; dn.x = nearestEnemy.x; dn.y = nearestEnemy.y; dn.text = `${C.GAMMA_EMP_DAMAGE}`; dn.isCrit = true; dn.createdAt = now; dn.initialDriftX = (Math.random() - 0.5) * 20;
            newDamageNumbers.push(dn);

            score += C.SCORE_PER_HIT; currencyEarnedThisRun += Math.floor(C.CURRENCY_PER_KILL * streakMultiplier);
            const exp = pools.explosions.get();
            exp.id = nextId++; exp.x = nearestEnemy.x; exp.y = nearestEnemy.y; exp.createdAt = now;
            exp.particles = Array.from({ length: 25 }, () => ({
                angle: Math.random() * 2 * Math.PI,
                distance: Math.random() * 50 + 25,
                size: Math.random() * 12 + 8,
                color: ['#f09', '#ff007f', '#fff'][Math.floor(Math.random() * 3)],
            }));
            newExplosions.push(exp);
            destroyedEnemyIds.add(nearestEnemy.id);
            enemiesDefeatedThisTick++;
        }
    }
    
    // --- Partition and release destroyed entities ---
    const projectilesToKeep: ProjectileType[] = [];
    for (const p of projectiles) { if (destroyedProjectileIds.has(p.id)) { pools.projectiles.release(p); } else { projectilesToKeep.push(p); } }
    projectiles = projectilesToKeep;

    asteroids = asteroids.filter(a => !destroyedAsteroidIds.has(a.id)); // Not pooled yet

    if (boss?.fragments) boss.fragments = boss.fragments.filter(f => !destroyedEnemyIds.has(f.id));
    const destroyedConduitIds = new Set(Array.from(destroyedEnemyIds).map(id => state.enemies.find(e => e.id === id)).filter(e => e?.type === 'conduit').map(e => e.id));
    if (destroyedConduitIds.size > 0) {
        const linkedEnemyIdsToUnbuff = state.enemies.filter(e => destroyedConduitIds.has(e.id)).map(c => c.linkedEnemyId).filter(id => id != null);
        if (linkedEnemyIdsToUnbuff.length > 0) {
            enemies.forEach(e => { if (linkedEnemyIdsToUnbuff.includes(e.id)) e.isBuffedByConduit = false; });
            asteroids.forEach(a => { if (linkedEnemyIdsToUnbuff.includes(a.id)) a.isBuffedByConduit = false; });
        }
    }
    enemies = enemies.filter(e => !destroyedEnemyIds.has(e.id)); // Not pooled yet

    const enemyProjectilesToKeep: EnemyProjectileType[] = [];
    for (const p of enemyProjectiles) { if (destroyedEnemyProjectileIds.has(p.id)) { pools.enemyProjectiles.release(p); } else { enemyProjectilesToKeep.push(p); } }
    enemyProjectiles = enemyProjectilesToKeep;

    const powerUpsToKeep: PowerUpInterface[] = [];
    for (const p of powerUps) { if (collectedPowerUpIds.has(p.id)) { pools.powerUps.release(p); } else { powerUpsToKeep.push(p); } }
    powerUps = powerUpsToKeep;

    return { 
        projectiles, enemies, enemyProjectiles, asteroids, powerUps, activePowerUps, score, currencyEarnedThisRun, partsEarnedThisRun,
        boss, wasBossHit, reloadBoosts, gameOver, reviveTriggerTime, hasRevive, shieldBreakingUntil, enemiesDefeatedThisTick,
        explosions: newExplosions, rockImpacts: newRockImpacts, criticalHits: newCriticalHits, gibs: newGibs, damageNumbers: newDamageNumbers,
        screenShake, screenFlashStartTime, lightning, empArcs, lastEmpFireTime, upgradePartCollects, powerUpInfusions: newPowerUpInfusions, inGameMessages
    };
}

/**
 * Checks for level-ups, game over, and other major game state transitions.
 */
function checkProgression(state: GameState, now: number, enemiesDefeatedThisTick: number) {
    let { 
        enemiesDefeatedInLevel, level, levelUpAnnounceTime, levelStreakThisRun, unlockedTier2Upgrades,
        pendingEncounter, score, currencyEarnedThisRun, partsEarnedThisRun, boss, inGameMessages
    } = state;

    if (state.isMontezumaActive) {
        const montezuma = state.asteroids.find(a => a.id === -999);
        let encounterOver = false;
        let outcome: OutcomeResult | null = null;
        let progression = loadProgression();

        if (!montezuma) { // It was destroyed
            encounterOver = true;
            progression.montezuma_defeated = true;
            progression.montezuma_health = 0;
            playSound('secretFound');
            outcome = {
                type: 'fight_reward',
                title: 'Behemoth Shattered!',
                text: `You did it! The colossal asteroid cracks and breaks apart, revealing a core incredibly rich with resources!`,
                currency: C.MONTEZUMA_REWARD_CURRENCY,
                parts: C.MONTEZUMA_REWARD_PARTS,
            };
        } else if (montezuma.y > C.GAME_HEIGHT + montezuma.size) { // It escaped
            encounterOver = true;
            progression.montezuma_health = montezuma.health;
            outcome = {
                type: 'nothing',
                title: 'It Got Away...',
                text: `The behemoth drifts past, its immense gravity making further pursuit impossible. You managed to chip away at it, though. Perhaps you'll see it again.`,
            };
        }

        if (encounterOver) {
            saveProgression(progression);
            const newState = {
                ...state,
                isMontezumaActive: false,
                asteroids: state.asteroids.filter(a => a.id !== -999), // Remove it
            };
            if (outcome) {
                return {
                    majorTransitionState: {
                        ...newState,
                        status: GameStatus.EncounterOutcome,
                        encounterOutcome: processOutcomeResult(outcome, state.bossesDefeated),
                        postEncounterStatus: GameStatus.Intermission,
                        currencyEarnedThisRun: state.currencyEarnedThisRun + (outcome.currency || 0),
                        partsEarnedThisRun: state.partsEarnedThisRun + (outcome.parts || 0),
                    }
                };
            } else {
                return { majorTransitionState: { ...newState, status: GameStatus.Intermission, } };
            }
        }
    }
    
    if (state.status === GameStatus.TrainingSim && state.trainingSimState && now >= state.trainingSimState.endTime) {
        const { targets } = state.trainingSimState;
        const successfulTargets = targets.filter(t => t.isComplete).length;
        const totalTargets = targets.length;
        const difficulty = state.trainingSimCompletions;
        const rewardPerTarget = C.TRAINING_SIM_BASE_REWARD_PER_TARGET * (1 + difficulty * 0.5);
        const totalReward = Math.floor(successfulTargets * rewardPerTarget);

        let partsReward = 0;
        if (difficulty >= 2) {
            partsReward = successfulTargets > 0 ? 1 + Math.floor(difficulty / 2) : 0;
        }

        let consumableReward: { type?: ConsumableItem, quantity?: number } = {};
        if (difficulty >= 4 && successfulTargets === totalTargets) {
            consumableReward = { type: 'fastReload', quantity: 1 };
        }
        
        let title, text;
        if (successfulTargets === 0) {
            title = "Simulation Failed";
            text = "You failed to calibrate any of the datacron's targets. No tactical data was recovered.";
        } else if (successfulTargets === totalTargets && totalTargets > 0) {
            title = "Perfect Calibration!";
            text = `A flawless run! You calibrated all ${totalTargets} targets, extracting a massive amount of tactical data. The simulation will be more challenging next time.`;
        } else {
            title = "Calibration Complete";
            text = `You successfully calibrated ${successfulTargets} out of ${totalTargets} targets. Tactical data has been extracted.`;
        }

        const outcome: OutcomeResult = {
            type: 'fight_reward',
            title,
            text,
            currency: totalReward,
            parts: partsReward,
            consumableType: consumableReward.type,
            consumableQuantity: consumableReward.quantity
        };
        
        const wasPerfect = successfulTargets === totalTargets && totalTargets > 0;
        const newCompletionCount = state.trainingSimCompletions + (wasPerfect ? 1 : 0);

        const newProgression = loadProgression();
        if (newProgression.trainingSimCompletions !== newCompletionCount) {
            newProgression.trainingSimCompletions = newCompletionCount;
            saveProgression(newProgression);
        }

        return {
            majorTransitionState: {
                ...state,
                status: GameStatus.EncounterOutcome,
                encounterOutcome: processOutcomeResult(outcome, state.bossesDefeated),
                trainingSimCompletions: newCompletionCount,
                trainingSimState: null,
                projectiles: [],
                postEncounterStatus: GameStatus.Intermission,
                currencyEarnedThisRun: state.currencyEarnedThisRun + totalReward,
                partsEarnedThisRun: state.partsEarnedThisRun + partsReward,
                screenShake: { magnitude: 0, duration: 0, startTime: 0 },
            }
        };
    }

    if (state.status === GameStatus.AsteroidField && state.asteroidFieldEndTime && now >= state.asteroidFieldEndTime) {
        let generalUpgrades = { ...state.generalUpgrades };
        const streakMultiplier = 1 + levelStreakThisRun * C.CURRENCY_STREAK_BONUS_PER_LEVEL;

        let outcomeText, partsRewardText = '';
        if (state.bossesDefeated > 0) {
            partsEarnedThisRun += C.ASTEROID_FIELD_SURVIVAL_REWARD_PARTS;
            partsRewardText = ` and ${C.ASTEROID_FIELD_SURVIVAL_REWARD_PARTS} Upgrade Parts`;
        }
        let outcomeTitle = "Field Navigated!";
        let unlocksTrident = false;
        
        const currencyReward = Math.floor(C.ASTEROID_FIELD_SURVIVAL_REWARD_CURRENCY * streakMultiplier);
        currencyEarnedThisRun += currencyReward;

        if (!generalUpgrades.trident_shot_unlocked) {
            unlocksTrident = true;
            generalUpgrades.trident_shot_unlocked = true;
            saveProgression({ ...loadProgression(), generalUpgrades });
            outcomeTitle = "Upgrade: Trident Shot Unlocked!";
            outcomeText = `You navigated the treacherous field and salvaged a rare blueprint from a wreck: The Trident Weapon System!\n\nYou can now construct this powerful upgrade in the Hangar Bay.`;
            outcomeText += `\n\nYou also recovered ${currencyReward.toLocaleString()} currency${partsRewardText}.`;
            playSound('secretFound');
        } else {
            outcomeText = `You emerge on the other side, battered but intact. Your skilled piloting has earned you ${currencyReward.toLocaleString()} currency${partsRewardText}.`;
            playSound('levelUp');
        }

        const encounterOutcome: OutcomeResult = { type: 'fight_reward', title: outcomeTitle, text: outcomeText, unlocksTrident };
        
        return { 
            majorTransitionState: { 
                ...state, 
                status: GameStatus.EncounterOutcome, 
                encounterOutcome, 
                postEncounterStatus: GameStatus.Intermission, 
                asteroidFieldEndTime: null, 
                currencyEarnedThisRun, 
                partsEarnedThisRun, 
                generalUpgrades, 
                asteroids: [],
                screenShake: { magnitude: 0, duration: 0, startTime: 0 },
            } 
        };
    }
    
    enemiesDefeatedInLevel += enemiesDefeatedThisTick;

    if (enemiesDefeatedInLevel >= C.ENEMIES_PER_LEVEL && !state.pendingPostFightOutcome && state.status !== GameStatus.AsteroidField) {
        const levelsGained = Math.floor(enemiesDefeatedInLevel / C.ENEMIES_PER_LEVEL);
        level += levelsGained; enemiesDefeatedInLevel %= C.ENEMIES_PER_LEVEL; playSound('levelUp'); levelUpAnnounceTime = now;
        levelStreakThisRun += levelsGained;
        if (!unlockedTier2Upgrades && levelStreakThisRun >= C.TIER_2_UNLOCK_LEVEL_STREAK) {
            unlockedTier2Upgrades = true; 
            saveProgression({ ...loadProgression(), unlockedTier2Upgrades: true }); 
            playSound('secretFound');
            const msg = pools.inGameMessages.get();
            msg.id = nextId++; msg.text = 'Upgrade: Tier II Unlocked!'; msg.createdAt = now; msg.duration = 4000; msg.style = 'achievement';
            inGameMessages.push(msg);
        }
        const isBossLevel = (level % C.BOSS_LEVEL_INTERVAL === 0) || level === 100;
        const storyMilestone = C.STORY_MILESTONES.find(m => level >= m.level && !state.displayedStoryLevels.includes(m.level));
        
        // Return a whole new state for major transitions
        if (storyMilestone) {
             const newProgression = { ...loadProgression(), displayedStoryLevels: [...state.displayedStoryLevels, storyMilestone.level]};
             saveProgression(newProgression);
             const updatedStateForTransition = { ...state, displayedStoryLevels: newProgression.displayedStoryLevels };
             return { majorTransitionState: { ...updatedStateForTransition, status: GameStatus.Story, level, levelStreakThisRun, unlockedTier2Upgrades, enemiesDefeatedInLevel, levelUpAnnounceTime, currentStoryMessage: { ...storyMilestone, level: storyMilestone.level }, enemies: [], enemyProjectiles: [], weaverBeams: [], asteroids: [], bossLasers: [], screenShake: { magnitude: 0, duration: 0, startTime: 0 } } };
        } else if (isBossLevel) {
            const newBoss = createNewBoss(level, state.bossDefeatCount, now);
            const msg = pools.inGameMessages.get();
            msg.id = nextId++; msg.text = newBoss.bossType.replace(/_/g, ' '); msg.createdAt = now; msg.duration = 4000; msg.style = 'boss';
            const bossMessage = msg;
            playSound('encounterBad');
            return { majorTransitionState: { ...state, status: GameStatus.BossBattle, level, enemies: [], enemyProjectiles: [], powerUps: [], lastTick: now, boss: newBoss, levelStreakThisRun, unlockedTier2Upgrades, inGameMessages: [...state.inGameMessages, bossMessage] } };
        }
        
        if (!isBossLevel && !storyMilestone && state.status !== GameStatus.BossBattle && Math.random() < C.ENCOUNTER_CHANCE_ON_LEVEL_UP) {
            const availableEncounters = C.ENCOUNTERS.filter(e => {
                if (e.id === 'montezuma_approaches' && loadProgression().montezuma_defeated) return false;
                return level >= (e.minLevel || 0);
            });
            let roll = Math.random() * availableEncounters.reduce((s, e) => s + e.weight, 0);
            for (const encounter of availableEncounters) { if (roll < encounter.weight) { pendingEncounter = encounter; break; } roll -= encounter.weight; }
        }
        if (!state.activePowerUps.Shield && Math.random() < (C.SHIELD_CHANCE_ON_LEVEL_UP_BASE + (state.selectedHero === 'gamma' ? C.GAMMA_SHIELD_CHANCE_BONUS : 0))) {
             state.activePowerUps.Shield = { expiresAt: Infinity, hp: (state.selectedHero === 'gamma' && state.heroUpgrades.gamma_shield_hp_level > 0 ? C.HANGAR_GAMMA_UPGRADE_CONFIG[state.heroUpgrades.gamma_shield_hp_level - 1].effect : 1) };
             playSound('powerUp');
        }
    }
    
    // Check for game over from enemies reaching bottom
    if (state.enemies.some(e => e.y > C.GAME_HEIGHT + C.ENEMY_HEIGHT)) {
        return { majorTransitionState: { ...state, status: GameStatus.GameOver, screenShake: { magnitude: 0, duration: 0, startTime: 0 }, currencyEarnedThisRun, partsEarnedThisRun } };
    }
    
    // Check for boss defeat transition
    if (boss && boss.phase === 'defeated' && now > boss.phaseStartTime + C.BOSS_DEFEATED_DURATION) {
        const bossType = boss.bossType;
        const streakMultiplierOnDefeat = 1 + state.levelStreakThisRun * C.CURRENCY_STREAK_BONUS_PER_LEVEL;

        if (bossType === 'overmind') {
            playSound('secretFound');
            const finalStateForProgression = { ...state, score: state.score + C.BOSS_DEFEAT_SCORE, currencyEarnedThisRun: state.currencyEarnedThisRun + Math.floor(C.BOSS_DEFEAT_CURRENCY * streakMultiplierOnDefeat), partsEarnedThisRun: state.partsEarnedThisRun + C.UPGRADE_PART_REWARD_BOSS + (Math.random() < C.UPGRADE_PART_DROP_CHANCE_BOSS ? 1 : 0), };
            const finalProgression = updateAndSaveEndOfRunProgression(finalStateForProgression, true);
            return { majorTransitionState: { ...finalStateForProgression, ...finalProgression, status: GameStatus.Victory, boss: null, enemies: [], enemyProjectiles: [], projectiles: [], asteroids: [], powerUps: [], currencyEarnedThisRun: 0, partsEarnedThisRun: 0, levelStreakThisRun: 0, screenShake: { magnitude: 0, duration: 0, startTime: 0 }, seenEnemies: new Set(finalProgression.seenEnemies) }};
        }
        
        playSound('levelUp');
        const currentProgression = loadProgression();
        const wasHangarLocked = currentProgression.bossesDefeated === 0;

        currentProgression.bossesDefeated++;
        currentProgression.bossDefeatCount[bossType] = (currentProgression.bossDefeatCount[bossType] || 0) + 1;
        
        const isHangarNowUnlocked = wasHangarLocked && currentProgression.bossesDefeated > 0;
        
        if (isHangarNowUnlocked && !currentProgression.unlocksNotified?.hangar) {
            const msg = pools.inGameMessages.get();
            msg.id = nextId++; msg.text = 'Hangar Unlocked!'; msg.createdAt = now; msg.duration = 4000; msg.style = 'achievement';
            inGameMessages.push(msg);
            if (!currentProgression.unlocksNotified) currentProgression.unlocksNotified = { beta: false, gamma: false, hangar: false };
            currentProgression.unlocksNotified.hangar = true;
        }

        const armoryItems = [{ name: 'Revive', type: 'revive' }, { name: 'Adrenal Injector', type: 'fastReload' }, { name: 'Overdrive Core', type: 'rapidFire' }, { name: 'Engine Coolant', type: 'speedBoost' }];
        const randomReward = armoryItems[Math.floor(Math.random() * armoryItems.length)];
        switch(randomReward.type) { case 'revive': currentProgression.ownedRevives++; break; case 'fastReload': currentProgression.ownedFastReloads++; break; case 'rapidFire': currentProgression.ownedRapidFires++; break; case 'speedBoost': currentProgression.ownedSpeedBoosts++; break; }
        
        partsEarnedThisRun += C.UPGRADE_PART_REWARD_BOSS + (Math.random() < C.UPGRADE_PART_DROP_CHANCE_BOSS ? 1 : 0);
        saveProgression(currentProgression);
        const { generalUpgrades, seenEnemies, ...progressionToApply } = currentProgression;
        return { majorTransitionState: { ...state, ...progressionToApply, status: GameStatus.Intermission, boss: null, score: state.score + C.BOSS_DEFEAT_SCORE, currencyEarnedThisRun: state.currencyEarnedThisRun + Math.floor(C.BOSS_DEFEAT_CURRENCY * streakMultiplierOnDefeat), partsEarnedThisRun, intermissionReward: { name: randomReward.name }, inGameMessages, screenShake: { magnitude: 0, duration: 0, startTime: 0 } } };
    }
    
    return { level, enemiesDefeatedInLevel, levelUpAnnounceTime, levelStreakThisRun, unlockedTier2Upgrades, pendingEncounter, inGameMessages };
}


/**
 * The main game loop function, orchestrating calls to all other systems.
 */
export function runGameTick(state: GameState, action: Extract<GameAction, { type: 'GAME_TICK' }>): GameState {
    const now = action.timestamp;
    const delta = (now - state.lastTick) / 1000;
    const grid = new SpatialGrid(C.GAME_WIDTH, C.GAME_HEIGHT, 150);
    
    // --- High-level State Machine & Short-circuits ---
    if (state.pendingOutcomeProcessTime && now >= state.pendingOutcomeProcessTime) {
        // VICTORY PAUSE IS OVER. RESOLVE THE OUTCOME.
        let finalOutcomeResult = state.pendingPostFightOutcome; let additionalEnemiesToSpawn: EnemyType[] = [];
        if (state.pendingFollowupOutcomes && state.pendingFollowupOutcomes.length > 0) {
            const totalProbability = state.pendingFollowupOutcomes.reduce((sum, o) => sum + o.probability, 0); let chosenOutcome = null;
            if (totalProbability > 0) {
                const normalizedOutcomes = state.pendingFollowupOutcomes.map(o => ({...o, normalizedProb: o.probability / totalProbability})); let roll = Math.random();
                for (const outcome of normalizedOutcomes) { if (roll < outcome.normalizedProb) { chosenOutcome = outcome; break; } roll -= outcome.normalizedProb; }
                if (!chosenOutcome) chosenOutcome = normalizedOutcomes[normalizedOutcomes.length - 1];
            } else if (state.pendingFollowupOutcomes.length > 0) chosenOutcome = state.pendingFollowupOutcomes[Math.floor(Math.random() * state.pendingFollowupOutcomes.length)];
            if (chosenOutcome) {
                finalOutcomeResult = chosenOutcome.result;
                if (finalOutcomeResult && (finalOutcomeResult.type === 'fight' || finalOutcomeResult.type === 'fight_reward')) {
                    const count = finalOutcomeResult.fightEnemyCount || 0; const newEnemies: EnemyType[] = [];
                    for (let i = 0; i < count; i++) { const spawnX = (C.GAME_WIDTH / (count + 1)) * (i + 1); newEnemies.push({ id: nextId++, x: spawnX, y: -C.ENEMY_HEIGHT * (Math.random() * 0.5 + 1), type: finalOutcomeResult.fightEnemyType || 'standard', lastShotTime: now + Math.random() * 500, baseX: spawnX, oscillationFrequency: 1.5, oscillationAmplitude: 50, oscillationOffset: Math.random() * Math.PI * 2, dodgeCooldownUntil: 0, isEncounterEnemy: true }); }
                    additionalEnemiesToSpawn = newEnemies;
                }
            }
        }
        if (finalOutcomeResult) {
            const processedResult = processOutcomeResult(finalOutcomeResult, state.bossesDefeated); const currentProgression = loadProgression(); let progressionChanged = false;
            if (processedResult.type === 'fight_reward' || processedResult.type === 'gain_items' || processedResult.type === 'gain_consumables') { if (processedResult.currency) { currentProgression.totalCurrency += processedResult.currency; progressionChanged = true; } if (processedResult.parts) { currentProgression.upgradeParts += processedResult.parts; progressionChanged = true; } }
            if (progressionChanged) saveProgression(currentProgression);
            if (additionalEnemiesToSpawn.length > 0) return { ...state, status: GameStatus.EncounterOutcome, pendingPostFightOutcome: processedResult, pendingFollowupOutcomes: processedResult.followupOutcomes || null, encounterOutcome: processedResult, postEncounterStatus: GameStatus.Playing, pendingOutcomeProcessTime: null, enemies: [...state.enemies, ...additionalEnemiesToSpawn], ...currentProgression, seenEnemies: new Set(currentProgression.seenEnemies) };
            return { ...state, status: GameStatus.EncounterOutcome, pendingPostFightOutcome: null, pendingFollowupOutcomes: null, encounterOutcome: processedResult, postEncounterStatus: GameStatus.Intermission, pendingOutcomeProcessTime: null, ...currentProgression, seenEnemies: new Set(currentProgression.seenEnemies) };
        }
    }
    if (state.encounterProcessingCompleteTime && now >= state.encounterProcessingCompleteTime) {
        playSound('uiClick');
        return { ...state, status: GameStatus.EncounterOutcome, encounterProcessingCompleteTime: null, };
    }

    const isSoftPaused = state.status === GameStatus.EncounterProcessing || !!state.pendingOutcomeProcessTime;
    if (isSoftPaused) {
        let newState = { ...state };
        newState.gameTime += delta;

        // Player should be able to move during the post-fight pause, but not shoot.
        const playerUpdates = updatePlayer(newState, action.pressedKeys, delta, now, true); // shootingDisabled = true
        newState = { ...newState, ...playerUpdates };

        // Only update entity positions and visual effects
        const entityUpdates = updateEntities(newState, delta, newState.gameTime, now);
        newState = { ...newState, ...entityUpdates };
        
        // Clear dangerous projectiles and beams to ensure player safety when pause ends
        pools.enemyProjectiles.releaseAll(newState.enemyProjectiles);
        newState.enemyProjectiles = [];
        pools.weaverBeams.releaseAll(newState.weaverBeams);
        newState.weaverBeams = [];
        newState.bossLasers = [];

        // Let player projectiles fly and cleanup effects
        const projectilesToKeep: ProjectileType[] = [];
        for (const p of newState.projectiles) { if (p.y > -C.PROJECTILE_HEIGHT) { projectilesToKeep.push(p); } else { pools.projectiles.release(p); } }
        newState.projectiles = projectilesToKeep;

        const explosionsToKeep: Explosion[] = [];
        for (const exp of newState.explosions) { if (now - exp.createdAt < 500) { explosionsToKeep.push(exp); } else { pools.explosions.release(exp); } }
        newState.explosions = explosionsToKeep;

        const rockImpactsToKeep: RockImpact[] = [];
        for (const imp of newState.rockImpacts) { if (now - imp.createdAt < 300) { rockImpactsToKeep.push(imp); } else { pools.rockImpacts.release(imp); } }
        newState.rockImpacts = rockImpactsToKeep;

        const criticalHitsToKeep: CriticalHitExplosion[] = [];
        for (const c of newState.criticalHits) { if (now - c.createdAt < C.CRITICAL_HIT_DURATION) { criticalHitsToKeep.push(c); } else { pools.criticalHits.release(c); } }
        newState.criticalHits = criticalHitsToKeep;
        
        pools.damageNumbers.releaseAll(newState.damageNumbers.filter(d => now - d.createdAt >= C.DAMAGE_NUMBER_LIFETIME));
        newState.damageNumbers = newState.damageNumbers.filter(d => now - d.createdAt < C.DAMAGE_NUMBER_LIFETIME);
        pools.gibs.releaseAll(newState.gibs.filter(gib => now - gib.createdAt >= C.GIB_LIFETIME));
        newState.gibs = newState.gibs.filter(gib => now - gib.createdAt < C.GIB_LIFETIME);
        pools.shellCasings.releaseAll(newState.shellCasings.filter(sc => now - sc.createdAt >= C.SHELL_LIFETIME));
        newState.shellCasings = newState.shellCasings.filter(sc => now - sc.createdAt < C.SHELL_LIFETIME);
        pools.empArcs.releaseAll(newState.empArcs.filter(arc => now - arc.createdAt >= C.EMP_ARC_DURATION));
        newState.empArcs = newState.empArcs.filter(arc => now - arc.createdAt < C.EMP_ARC_DURATION);
        
        if (newState.lightning && now - newState.lightning.createdAt > C.LIGHTNING_DURATION) {
            pools.lightning.release(newState.lightning);
            newState.lightning = null;
        }
        
        newState.lastTick = now;
        return newState;
    }

    if (state.pendingEncounter && state.enemies.length === 0 && state.enemyProjectiles.length === 0 && state.asteroids.length === 0 && state.weaverBeams.length === 0) {
        let finalEncounter = state.pendingEncounter.isDynamic ? generateDynamicEncounter(state.pendingEncounter, state) : state.pendingEncounter;
        return { ...state, status: GameStatus.RandomEncounter, currentEncounter: finalEncounter, pendingEncounter: null, lastTick: now, screenShake: { magnitude: 0, duration: 0, startTime: 0 } };
    }
    if (state.status === GameStatus.PlayerDying) {
        if (now > state.playerDeathTime + C.PLAYER_DEATH_ANIMATION_DURATION) return { ...state, status: GameStatus.GameOver, screenShake: { magnitude: 0, duration: 0, startTime: 0 } };
        
        const emptyStateForParticleUpdate: GameState = { ...state, enemies: [], projectiles: [], enemyProjectiles: [], asteroids: [], powerUps: [], upgradePartCollects: [] };
        const { gibs: updatedGibs, shellCasings: updatedShells } = updateEntities(emptyStateForParticleUpdate, delta, 0, now);

        let explosions = [...state.explosions]; // Make a mutable copy of explosions.
        const chanceOfExplosion = (now - state.lastTick) / C.PLAYER_DEATH_EXPLOSION_INTERVAL;
        const deathExplosionsSoFar = state.explosions.filter(e => e.createdAt >= state.playerDeathTime).length;
        if (Math.random() < chanceOfExplosion && state.playerDeathPosition && deathExplosionsSoFar < C.PLAYER_DEATH_EXPLOSION_COUNT) {
            const x = state.playerDeathPosition.x + (Math.random() - 0.5) * C.PLAYER_WIDTH; const y = state.playerDeathPosition.y + (Math.random() - 0.5) * C.PLAYER_WIDTH * 1.2;
            
            const exp = pools.explosions.get();
            exp.id = nextId++; exp.x = x; exp.y = y; exp.createdAt = now;
            exp.particles = Array.from({ length: 25 }, () => ({
              angle: Math.random() * 2 * Math.PI,
              distance: Math.random() * 50 + 25,
              size: Math.random() * 12 + 8,
              color: ['#f09', '#ff007f', '#fff'][Math.floor(Math.random() * 3)],
            }));
            explosions.push(exp);

            playSound('explosion');
            for (let i = 0; i < C.GIB_COUNT / 2; i++) {
                const angle = Math.random() * 2 * Math.PI, speed = C.GIB_INITIAL_SPEED_MIN + Math.random() * (C.GIB_INITIAL_SPEED_MAX - C.GIB_INITIAL_SPEED_MIN);
                const gib = pools.gibs.get();
                gib.id = nextId++; gib.x = x; gib.y = y; gib.vx = Math.cos(angle) * speed; gib.vy = Math.sin(angle) * speed; gib.rotation = Math.random() * 360; gib.rotationSpeed = (Math.random() - 0.5) * 2000; gib.createdAt = now; gib.color = C.PLAYER_GIB_COLORS[Math.floor(Math.random() * C.PLAYER_GIB_COLORS.length)]; gib.size = Math.random() * 8 + 5;
                updatedGibs.push(gib);
            }
        }
        return { ...state, lastTick: now, explosions, gibs: updatedGibs, shellCasings: updatedShells, weaverBeams: [] };
    }

    if (state.pendingPostFightOutcome && !state.enemies.some(e => e.isEncounterEnemy) && !state.encounterFightPrepareTime && !state.pendingOutcomeProcessTime) {
        // Win detected. Start the victory pause.
        return { ...state, pendingOutcomeProcessTime: now + 1500 };
    }
    
    // --- Training Sim Logic ---
    if (state.status === GameStatus.TrainingSim && state.trainingSimState) {
        let newState = { ...state };
        
        const isCountingDown = now < newState.trainingSimState.startTime;

        // 1. Update Player and Projectiles (with shooting disabled during countdown)
        const playerUpdates = updatePlayer(newState, action.pressedKeys, delta, now, isCountingDown);
        newState = { ...newState, ...playerUpdates };
        newState.projectiles = newState.projectiles.map(p => ({ ...p, y: p.y - C.PROJECTILE_SPEED * delta }));
        
        // 2. Collision Detection: Projectiles vs Targets (only if not counting down)
        if (!isCountingDown) {
            const destroyedProjectileIds = new Set<number>();
            for (const proj of newState.projectiles) {
                if (destroyedProjectileIds.has(proj.id)) continue;
                for (const target of newState.trainingSimState.targets) {
                    if (target.isFailed) continue; // Once failed, stay failed.

                    const distSq = (proj.x - target.x)**2 + (proj.y - target.y)**2;
                    if (distSq < (40 * 40) && now > ((target.lastHitTime ?? 0) + C.TRAINING_TARGET_HIT_COOLDOWN)) {
                        destroyedProjectileIds.add(proj.id);
                        target.remainingHits--;
                        target.lastHitTime = now;
                        
                        if (target.remainingHits < 0) {
                            target.isFailed = true;
                            target.isComplete = false; // It's no longer a success
                            playSound('trainingTargetFail');
                        } else if (target.remainingHits === 0) {
                            target.isComplete = true;
                            playSound('trainingTargetSuccess');
                        } else {
                            playSound('trainingTargetHit');
                        }
                        break; 
                    }
                }
            }
            const projectilesToKeep: ProjectileType[] = [];
            for (const p of newState.projectiles) { if (destroyedProjectileIds.has(p.id)) { pools.projectiles.release(p); } else { projectilesToKeep.push(p); } }
            newState.projectiles = projectilesToKeep;
        }

        // 3. Cleanup & Progression Check (end of sim)
        const progressionResult = checkProgression(newState, now, 0);
        if (progressionResult.majorTransitionState) {
            return progressionResult.majorTransitionState;
        }

        newState.lastTick = now;
        return newState;
    }


    // --- Core Game Tick ---
    let newState = { ...state };
    newState.gameTime += now - state.lastTick;

    // --- Update powerups and stats ---
    let maxAmmoChanged = false;
    const activePowerUps = {...newState.activePowerUps};
    for (const key in activePowerUps) {
        const powerUpKey = key as keyof typeof activePowerUps;
        const powerUp = activePowerUps[powerUpKey];
        if (powerUp && now > (powerUp.expiresAt)) {
            if (key === 'ExtendedMag') maxAmmoChanged = true;
            if (key === 'Shield' && newState.shieldBreakingUntil > now) continue;
            delete activePowerUps[powerUpKey];
        }
    }
    newState.activePowerUps = activePowerUps;
    if (newState.shieldBreakingUntil > 0 && now > newState.shieldBreakingUntil) {
        delete newState.activePowerUps.Shield;
        newState.shieldBreakingUntil = 0;
    }

    const ammoBonus = state.generalUpgrades.ammo_capacity_level > 0 ? C.HANGAR_GENERAL_UPGRADE_CONFIG.ammo_capacity_level[state.generalUpgrades.ammo_capacity_level - 1].effect : 0;
    newState.maxAmmo = (newState.activePowerUps.ExtendedMag ? C.EXTENDED_MAG_SIZE : C.PLAYER_INITIAL_AMMO) + ammoBonus;
    if(maxAmmoChanged) newState.ammo = Math.min(newState.ammo, newState.maxAmmo);

    // Reload check
    if (newState.reloadCompleteTime > 0 && now >= newState.reloadCompleteTime) {
        newState.ammo = newState.maxAmmo;
        newState.reloadCompleteTime = 0;
    }
    
    // Player actions
    const playerUpdates = updatePlayer(newState, action.pressedKeys, delta, now, !!newState.encounterFightPrepareTime);
    newState = { ...newState, ...playerUpdates };

    // Update entity positions
    const entityUpdates = updateEntities(newState, delta, newState.gameTime, now);
    newState = { ...newState, ...entityUpdates };

    // Run AI and Spawning
    if (newState.status === GameStatus.BossBattle) {
        const bossUpdates = runBossLogic(newState, now);
        const { newExplosions = [], newCriticalHits = [], ...restOfBossUpdates } = bossUpdates;
        newState = { ...newState, ...restOfBossUpdates };
        newState.explosions.push(...newExplosions);
        newState.criticalHits.push(...newCriticalHits);
    } else if (newState.status === GameStatus.Playing || newState.status === GameStatus.AsteroidField) {
        if (!newState.pendingEncounter && !newState.pendingPostFightOutcome && !newState.encounterFightPrepareTime) {
            const spawnUpdates = runSpawning(newState, now, newState.gameTime);
            newState = { ...newState, ...spawnUpdates };
        }
    }
    
    // Always run AI for active enemies if game is in an active state.
    const activeAIStates = [GameStatus.Playing, GameStatus.BossBattle, GameStatus.AsteroidField];
    if (activeAIStates.includes(newState.status)) {
        runStandardEnemyAI(newState, now);
    }
    
    // Handle encounter fight spawning
    if (newState.encounterFightPrepareTime && now >= newState.encounterFightPrepareTime) {
        const fightDetails = newState.pendingPostFightOutcome;
        if (fightDetails && (fightDetails.type === 'fight' || fightDetails.type === 'fight_reward')) {
            let enemiesToSpawn: EnemyType[] = [];
            if (fightDetails.fightPreset === 'heretic_antibodies') {
                const level = state.level;
                const conduitHealth = C.CONDUIT_HEALTH + (Math.floor((level - C.CONDUIT_SPAWN_START_LEVEL) / C.CONDUIT_HEALTH_SCALING_INTERVAL) * C.CONDUIT_HEALTH_SCALING_AMOUNT);
                enemiesToSpawn.push({ id: nextId++, x: C.GAME_WIDTH * 0.25, y: -C.ENEMY_HEIGHT, type: 'weaver', health: C.WEAVER_HEALTH, lastShotTime: 0, baseX: C.GAME_WIDTH * 0.25, oscillationFrequency: 0, oscillationAmplitude: 0, oscillationOffset: 0, diveTargetY: Math.random() * (C.PLAYER_Y_POSITION - 300) + 150, lastBeamTime: now, isEncounterEnemy: true });
                enemiesToSpawn.push({ id: nextId++, x: C.GAME_WIDTH * 0.75, y: -C.ENEMY_HEIGHT * 1.5, type: 'weaver', health: C.WEAVER_HEALTH, lastShotTime: 0, baseX: C.GAME_WIDTH * 0.75, oscillationFrequency: 0, oscillationAmplitude: 0, oscillationOffset: 0, diveTargetY: Math.random() * (C.PLAYER_Y_POSITION - 300) + 150, lastBeamTime: now, isEncounterEnemy: true });
                enemiesToSpawn.push({ id: nextId++, x: C.GAME_WIDTH * 0.3, y: -C.ENEMY_HEIGHT * 2, type: 'conduit', health: conduitHealth, maxHealth: conduitHealth, lastShotTime: 0, baseX: C.GAME_WIDTH * 0.3, oscillationFrequency: 0.5, oscillationAmplitude: C.GAME_WIDTH / 4, oscillationOffset: 0, linkedEnemyId: null, isEncounterEnemy: true });
                enemiesToSpawn.push({ id: nextId++, x: C.GAME_WIDTH * 0.7, y: -C.ENEMY_HEIGHT * 2.5, type: 'conduit', health: conduitHealth, maxHealth: conduitHealth, lastShotTime: 0, baseX: C.GAME_WIDTH * 0.7, oscillationFrequency: 0.5, oscillationAmplitude: C.GAME_WIDTH / 4, oscillationOffset: Math.PI, linkedEnemyId: null, isEncounterEnemy: true });
            } else if (fightDetails.fightPreset === 'heretic_ship') {
                enemiesToSpawn.push({ id: nextId++, x: C.GAME_WIDTH / 2, y: 150, type: 'heretic_ship', health: 500, maxHealth: 500, lastShotTime: Infinity, baseX: C.GAME_WIDTH / 2, oscillationFrequency: 0.2, oscillationAmplitude: 20, oscillationOffset: 0, isEncounterEnemy: true });
            } else {
                // Fallback to old system
                const count = fightDetails.fightEnemyCount || 0;
                for (let i = 0; i < count; i++) { enemiesToSpawn.push({ id: nextId++, x: (C.GAME_WIDTH / (count + 1)) * (i + 1), y: -C.ENEMY_HEIGHT * (Math.random() * 0.5 + 1), type: fightDetails.fightEnemyType || 'standard', lastShotTime: now + Math.random() * 500, baseX: (C.GAME_WIDTH / (count + 1)) * (i + 1), oscillationFrequency: 1.5, oscillationAmplitude: 50, oscillationOffset: Math.random() * Math.PI * 2, dodgeCooldownUntil: 0, isEncounterEnemy: true }); }
            }
            if (enemiesToSpawn.length > 0) {
                newState.enemies.push(...enemiesToSpawn);
                playSound('encounterBad');
            }
        }
        newState.encounterFightPrepareTime = null;
    }
    
    // Resolve all collisions and their effects
    const collisionResults = resolveCollisions(newState, now, grid);
    
    const {
        explosions: addedExplosions, rockImpacts: addedRockImpacts, criticalHits: addedCriticalHits,
        gibs: addedGibs, empArcs: addedEmpArcs, upgradePartCollects: addedUpgradePartCollects,
        damageNumbers: addedDamageNumbers, powerUpInfusions: addedPowerUpInfusions,
        ...restOfCollisionResults
    } = collisionResults;
    newState = { ...newState, ...restOfCollisionResults };

    newState.explosions = [...newState.explosions, ...addedExplosions];
    newState.rockImpacts = [...newState.rockImpacts, ...addedRockImpacts];
    newState.criticalHits = [...newState.criticalHits, ...addedCriticalHits];
    newState.gibs = [...newState.gibs, ...addedGibs];
    newState.empArcs = [...newState.empArcs, ...addedEmpArcs];
    newState.upgradePartCollects = [...newState.upgradePartCollects, ...addedUpgradePartCollects];
    newState.damageNumbers = [...newState.damageNumbers, ...addedDamageNumbers];
    newState.powerUpInfusions = [...newState.powerUpInfusions, ...addedPowerUpInfusions];


    // Check against current state's shake, and only update if the new shake from this tick is stronger.
    const currentShakeElapsed = now - state.screenShake.startTime;
    if (currentShakeElapsed >= state.screenShake.duration || collisionResults.screenShake.magnitude > state.screenShake.magnitude) {
      newState.screenShake = collisionResults.screenShake;
    } else {
      newState.screenShake = state.screenShake;
    }

    // --- Cleanup and Progression ---
    const progressionResult = checkProgression(newState, now, collisionResults.enemiesDefeatedThisTick);
    if (progressionResult.majorTransitionState) {
        return progressionResult.majorTransitionState;
    } else {
        newState = { ...newState, ...progressionResult };
    }

    // --- Final Cleanup for Entities Going Off-screen ---
    const projectilesToKeep: ProjectileType[] = [];
    for (const p of newState.projectiles) { if (p.y > -C.PROJECTILE_HEIGHT) { projectilesToKeep.push(p); } else { pools.projectiles.release(p); } }
    newState.projectiles = projectilesToKeep;

    const enemyProjectilesToKeep: EnemyProjectileType[] = [];
    for (const p of newState.enemyProjectiles) { if (p.y < C.GAME_HEIGHT + C.ENEMY_PROJECTILE_HEIGHT) { enemyProjectilesToKeep.push(p); } else { pools.enemyProjectiles.release(p); } }
    newState.enemyProjectiles = enemyProjectilesToKeep;
    
    newState.enemies = newState.enemies.filter(e => e.y < C.GAME_HEIGHT + C.ENEMY_HEIGHT); // Not pooled yet
    newState.asteroids = newState.asteroids.filter(a => a.y < C.GAME_HEIGHT + a.size); // Not pooled yet
    
    const powerUpsToKeep: PowerUpInterface[] = [];
    for (const p of newState.powerUps) { if (p.y < C.GAME_HEIGHT + C.POWERUP_HITBOX_RADIUS) { powerUpsToKeep.push(p); } else { pools.powerUps.release(p); } }
    newState.powerUps = powerUpsToKeep;

    // Filter out effects that have expired
    const explosionsToKeep: Explosion[] = [];
    for (const exp of newState.explosions) { if (now - exp.createdAt < 500) { explosionsToKeep.push(exp); } else { pools.explosions.release(exp); } }
    newState.explosions = explosionsToKeep;

    const rockImpactsToKeep: RockImpact[] = [];
    for (const imp of newState.rockImpacts) { if (now - imp.createdAt < 300) { rockImpactsToKeep.push(imp); } else { pools.rockImpacts.release(imp); } }
    newState.rockImpacts = rockImpactsToKeep;
    
    const criticalHitsToKeep: CriticalHitExplosion[] = [];
    for (const c of newState.criticalHits) { if (now - c.createdAt < C.CRITICAL_HIT_DURATION) { criticalHitsToKeep.push(c); } else { pools.criticalHits.release(c); } }
    newState.criticalHits = criticalHitsToKeep;
    
    pools.damageNumbers.releaseAll(newState.damageNumbers.filter(d => now - d.createdAt >= C.DAMAGE_NUMBER_LIFETIME));
    newState.damageNumbers = newState.damageNumbers.filter(d => now - d.createdAt < C.DAMAGE_NUMBER_LIFETIME);
    
    pools.gibs.releaseAll(newState.gibs.filter(gib => now - gib.createdAt >= C.GIB_LIFETIME));
    newState.gibs = newState.gibs.filter(gib => now - gib.createdAt < C.GIB_LIFETIME);

    pools.shellCasings.releaseAll(newState.shellCasings.filter(sc => now - sc.createdAt >= C.SHELL_LIFETIME));
    newState.shellCasings = newState.shellCasings.filter(sc => now - sc.createdAt < C.SHELL_LIFETIME);

    pools.empArcs.releaseAll(newState.empArcs.filter(arc => now - arc.createdAt >= C.EMP_ARC_DURATION));
    newState.empArcs = newState.empArcs.filter(arc => now - arc.createdAt < C.EMP_ARC_DURATION);
    
    const weaverBeamsToKeep = [];
    for (const b of newState.weaverBeams) { if (now - b.createdAt < C.WEAVER_BEAM_DURATION) { weaverBeamsToKeep.push(b); } else { pools.weaverBeams.release(b); } }
    newState.weaverBeams = weaverBeamsToKeep;

    const upgradePartsToKeep = [];
    for (const p of newState.upgradePartCollects) { if (now - p.createdAt < C.UPGRADE_PART_ANIMATION_DURATION) { upgradePartsToKeep.push(p); } else { pools.upgradeParts.release(p); } }
    newState.upgradePartCollects = upgradePartsToKeep;

    const infusionsToKeep = [];
    for (const p of newState.powerUpInfusions) { if (now - p.createdAt < C.POWERUP_INFUSION_DURATION) { infusionsToKeep.push(p); } else { pools.powerUpInfusions.release(p); } }
    newState.powerUpInfusions = infusionsToKeep;

    if (newState.lightning && now - newState.lightning.createdAt > C.LIGHTNING_DURATION) {
        pools.lightning.release(newState.lightning);
        newState.lightning = null;
    }
    
    if (newState.wasBossHit && newState.bossLasers.length > 0) {
      if(now > (newState.bossLasers[0].fireStartTime + newState.bossLasers[0].duration)) newState.bossLasers = [];
    }

    // --- Final State Update ---
    newState.lastTick = now;
    newState.wasBossHit = false;

    if (collisionResults.gameOver) {
        newState.status = GameStatus.PlayerDying;
        newState.playerDeathTime = now;
        newState.playerDeathPosition = { x: newState.playerX, y: C.PLAYER_Y_POSITION + (C.GAME_HEIGHT * 0.10) / 2 };
    }

    return newState;
}
