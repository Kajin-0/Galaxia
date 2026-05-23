import type { GameState, Enemy as EnemyType, DamageNumber, Asteroid as AsteroidType, PowerUp, TrainingTarget, Boss, EnemyProjectile as EnemyProjectileType } from '../types';
import { GameStatus } from '../types';
import * as C from '../constants';
import { pools } from '../state/pools';
import { SpatialGrid, Collidable } from '../utils/collisionSystem';
import { updatePlayer, updateEntities } from './update';
import { runBossLogic, runStandardEnemyAI } from './ai';
import { runSpawning } from './spawning';
import { resolveCollisions, populateExplosionParticles } from './collision';
import { generateDynamicEncounter } from '../utils/creators';
import { playSound } from '../sounds';
import { clearPlayerRenderCache } from '../components/canvas/drawPlayer';
import { 
    setupBossBattleState, 
    setupIntermissionState, 
    transitionToGameOver,
    transitionToLevelUp,
    transitionToAsteroidFieldComplete,
    transitionToTrainingSimComplete,
    transitionToMontezumaComplete,
    transitionBossPhase,
    transitionToPlayerDying,
} from '../utils/stateTransitions';


let nextId = 10000;

export function getNextId() {
    return nextId++;
}

export function resetNextId() {
    nextId = 10000;
}

export interface GameTickStep {
    delta: number;
    timestamp: number;
    pressedKeys: Set<string>;
    containerSize?: { width: number; height: number };
}

// ✅ OPTIMIZATION: Reusable array for boss in renderable sorting to avoid allocation every frame
const reusableBossArray: Boss[] = [];
// ✅ MOBILE OPTIMIZATION: Double-buffer sorted renderables to avoid per-tick slice allocations.
const sortedRenderablesBuffers: Array<(EnemyType | AsteroidType | PowerUp | TrainingTarget | Boss)[]> = [[], []];
let sortedRenderablesBufferIndex = 0;
// ✅ MOBILE OPTIMIZATION: Reusable spatial grid to eliminate object + Map allocation every frame
const reusableSpatialGrid = new SpatialGrid(C.GAME_WIDTH, C.GAME_GRID_HEIGHT, 150);
const reusablePlayerMainCollidable: Collidable = {
    id: -1,
    x: 0,
    y: 0,
    radius: C.PLAYER_HITBOX_MAIN_RADIUS
};
const reusablePlayerNoseCollidable: Collidable = {
    id: -2,
    x: 0,
    y: 0,
    radius: C.PLAYER_HITBOX_NOSE_RADIUS
};
const SIMULATION_STATES = new Set<GameStatus>([
    GameStatus.Playing,
    GameStatus.BossBattle,
    GameStatus.PlayerDying,
    GameStatus.AsteroidField,
    GameStatus.TrainingSim,
]);
const EMPTY_ENEMY_PROJECTILES: EnemyProjectileType[] = [];
const EMPTY_MINIONS: EnemyType[] = [];
const EMPTY_EXPLOSIONS: GameState['explosions'] = [];
const EMPTY_CRITICAL_HITS: GameState['criticalHits'] = [];
const EMPTY_BOSS_LASERS: GameState['bossLasers'] = [];

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

function appendArray2<T>(base: T[], additionsA: T[], additionsB: T[]): T[] {
    const aLen = additionsA.length;
    const bLen = additionsB.length;
    if (aLen === 0 && bLen === 0) return base;

    const baseLen = base.length;
    const result = new Array<T>(baseLen + aLen + bLen);
    let idx = 0;
    for (let i = 0; i < baseLen; i++) result[idx++] = base[i];
    for (let i = 0; i < aLen; i++) result[idx++] = additionsA[i];
    for (let i = 0; i < bLen; i++) result[idx++] = additionsB[i];
    return result;
}

function getNextSortedRenderablesBuffer(): (EnemyType | AsteroidType | PowerUp | TrainingTarget | Boss)[] {
    sortedRenderablesBufferIndex = (sortedRenderablesBufferIndex + 1) & 1;
    const buffer = sortedRenderablesBuffers[sortedRenderablesBufferIndex];
    buffer.length = 0;
    return buffer;
}

// Helper function for sorting nearly-sorted arrays efficiently.
function insertionSort<T extends { y: number }>(arr: T[]): void {
  for (let i = 1; i < arr.length; i++) {
    const current = arr[i];
    let j = i - 1;
    while (j > -1 && arr[j].y > current.y) {
      arr[j + 1] = arr[j];
      j--;
    }
    arr[j + 1] = current;
  }
}

const defaultTouchState = {
    isActive: false,
    currentX: null,
    offsetX: 0,
    identifier: null,
};


/**
 * A non-allocating helper to check if an object is empty.
 * Replaces `Object.keys(obj).length === 0`.
 */
function isObjectEmpty(obj: object | null | undefined): boolean {
    if (!obj) return true;
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            return false; // Found a key, object is not empty.
        }
    }
    return true; // Loop completed, no keys found.
}


function processDebuffs(state: GameState, now: number, effectiveNow: number): {
    updatedEnemies: EnemyType[];
    updatedAsteroids: AsteroidType[];
    updatedBoss: GameState['boss'];
    newDamageNumbers: DamageNumber[];
} {
    // Early exit if no debuffs exist anywhere in the state to avoid allocations.
    // ✅ CRITICAL PERFORMANCE: Manual loops instead of some() to reduce function call overhead
    let hasDebuffs = false;
    const enemiesLen = state.enemies.length;
    for (let i = 0; i < enemiesLen; i++) {
        if (state.enemies[i].debuffs?.corrosive) {
            hasDebuffs = true;
            break;
        }
    }
    if (!hasDebuffs) {
        const asteroidsLen = state.asteroids.length;
        for (let i = 0; i < asteroidsLen; i++) {
            if (state.asteroids[i].debuffs?.corrosive) {
                hasDebuffs = true;
                break;
            }
        }
    }
    if (!hasDebuffs && state.boss?.debuffs?.corrosive) {
        hasDebuffs = true;
    }

    if (!hasDebuffs) {
        return {
            updatedEnemies: state.enemies,
            updatedAsteroids: state.asteroids,
            updatedBoss: state.boss,
            newDamageNumbers: []
        };
    }

    const newDamageNumbers: DamageNumber[] = [];

    const processEntity = <T extends { health?: number; debuffs?: EnemyType['debuffs']; x: number; y: number; }>(entity: T): T => {
        if (!entity || (entity.health ?? 0) <= 0) return entity;
        
        if (entity.debuffs?.corrosive) {
            const corrosive = entity.debuffs.corrosive;
            if (effectiveNow >= corrosive.lastTickTime + C.CORROSIVE_TICK_INTERVAL) {
                const newHealth = (entity.health ?? 0) - corrosive.damagePerTick;
                playSound('corrosiveTick');
                
                const dn = pools.damageNumbers.get();
                Object.assign(dn, {
                    id: getNextId(),
                    x: entity.x + (Math.random() - 0.5) * 30,
                    y: entity.y + (Math.random() - 0.5) * 20,
                    text: `${corrosive.damagePerTick}`,
                    isCrit: false,
                    isCorrosive: true,
                    createdAt: effectiveNow,
                    initialDriftX: (Math.random() - 0.5) * 10
                });
                newDamageNumbers.push(dn);

                const newTicksLeft = corrosive.ticksLeft - 1;
                let newDebuffs = { ...entity.debuffs };
                if (newTicksLeft <= 0) {
                    delete newDebuffs.corrosive;
                } else {
                    newDebuffs.corrosive = { ...corrosive, ticksLeft: newTicksLeft, lastTickTime: effectiveNow };
                }

                // If debuffs object is now empty, remove it
                if (isObjectEmpty(newDebuffs)) {
                    return { ...entity, health: newHealth, debuffs: undefined };
                }

                return { ...entity, health: newHealth, debuffs: newDebuffs };
            }
        }
        return entity;
    };

    // ✅ CRITICAL PERFORMANCE: Manual loops instead of map() to reduce function call overhead
    const updatedEnemies: EnemyType[] = [];
    // Reuse length variable (first loop above is complete)
    for (let i = 0; i < enemiesLen; i++) {
        updatedEnemies.push(processEntity(state.enemies[i]));
    }
    const updatedAsteroids: AsteroidType[] = [];
    const asteroidsLen = state.asteroids.length;
    for (let i = 0; i < asteroidsLen; i++) {
        updatedAsteroids.push(processEntity(state.asteroids[i]));
    }
    const updatedBoss = state.boss ? processEntity(state.boss) : null;

    return { updatedEnemies, updatedAsteroids, updatedBoss, newDamageNumbers };
}

/**
 * Handles all high-level game flow transitions after a simulation tick is complete.
 * This includes leveling up, boss fights, event completions, and game over conditions.
 * @param state The fully simulated state for the current tick.
 * @param performanceTimestamp The high-resolution timestamp for the current frame.
 * @returns A new GameState if a transition occurred, otherwise the original state.
 */
function checkStateTransitions(state: GameState, performanceTimestamp: number): GameState {
    const effectiveNow = state.lastTick - state.totalPauseDuration;
    let newState = state; // Start with the passed state

    // Check for end of encounter fight -> transition to Loading
    const isFightPrepared = newState.encounterFightPrepareTime != null ? effectiveNow > newState.encounterFightPrepareTime : true;
    if (newState.status === GameStatus.Playing && newState.pendingPostFightOutcome && newState.enemies.length === 0 && newState.enemyProjectiles.length === 0 && newState.weaverBeams.length === 0 && newState.weaverSurges.length === 0 && isFightPrepared) {
        return {
            ...newState,
            status: GameStatus.Loading,
            isProcessingEncounter: true,
            encounterFightPrepareTime: null, // Clear this timer now that the fight is over
        };
    }

    const EXPLOSION_ANIMATION_DURATION = 500; // ms, matches filterAndPool and drawSplatterExplosions
    if (newState.boss?.phase === 'defeated' && effectiveNow > newState.boss.phaseStartTime + C.BOSS_DEFEATED_DURATION + EXPLOSION_ANIMATION_DURATION) {
        if (newState.boss.bossType === 'overmind') {
            return {
                ...newState,
                status: GameStatus.Victory,
                prePauseStatus: state.status,
                pauseStartTime: performanceTimestamp,
            };
        } else {
            playSound('levelUp');
            const intermissionStateChanges = setupIntermissionState(newState);
            return {
                ...newState,
                ...intermissionStateChanges,
                status: GameStatus.Intermission, 
                prePauseStatus: state.status, // The status *before* this tick
                pauseStartTime: performanceTimestamp,
            };
        }
    }
    if (newState.status === GameStatus.AsteroidField && newState.asteroidFieldEndTime && effectiveNow >= newState.asteroidFieldEndTime) { 
        return transitionToAsteroidFieldComplete(newState, state.lastTick, effectiveNow, performanceTimestamp); 
    }
    if (newState.isMontezumaActive) {
        // ✅ OPTIMIZATION: Manual loop instead of find() to avoid function call overhead
        let montezumaAsteroid: AsteroidType | undefined = undefined;
        const asteroidsLen = newState.asteroids.length;
        for (let i = 0; i < asteroidsLen; i++) {
            if (newState.asteroids[i].id === -999) {
                montezumaAsteroid = newState.asteroids[i];
                break;
            }
        }
        if (montezumaAsteroid === undefined || (montezumaAsteroid.y ?? 0) > C.GAME_HEIGHT + (montezumaAsteroid.size ?? 0)) {
            return transitionToMontezumaComplete(newState, state.lastTick, effectiveNow, performanceTimestamp);
        }
    }
    
    if (newState.status === GameStatus.Playing && newState.enemiesDefeatedInLevel >= C.ENEMIES_PER_LEVEL) {
        // This will increment the level and check for any story milestones.
        const stateAfterLevelUp = transitionToLevelUp(newState, state.lastTick, effectiveNow, performanceTimestamp);
        
        // If leveling up triggered a story screen, we stop here and let the story play.
        if (stateAfterLevelUp.status === GameStatus.Story) {
            return stateAfterLevelUp;
        }

        // After leveling up (and not showing a story), check if the new level is a boss level.
        const isBossLevel = (stateAfterLevelUp.level % C.BOSS_LEVEL_INTERVAL === 0) || stateAfterLevelUp.level === 100;
        if (isBossLevel) {
            const newEffectiveNow = performanceTimestamp - stateAfterLevelUp.totalPauseDuration;
            // The state passed to setupBossBattleState now has the correct, incremented level.
            const bossStateChanges = setupBossBattleState(stateAfterLevelUp, newEffectiveNow);
            return {
                ...stateAfterLevelUp,
                ...bossStateChanges,
                status: GameStatus.BossBattle,
                lastTick: performanceTimestamp,
            };
        }
        
        // If it's not a story level and not a boss level, just return the standard level-up state.
        return stateAfterLevelUp;
    }
    
    newState.wasBossHit = false;

    // The 'gameOver' from off-screen enemies
    const GAME_OVER_Y_THRESHOLD = C.GAME_HEIGHT + C.GAME_HEIGHT_BUFFER + C.ENEMY_HEIGHT;
    // ✅ CRITICAL PERFORMANCE: Manual loop instead of some() to reduce function call overhead
    let gameOver = false;
    const enemiesLen = newState.enemies.length;
    for (let i = 0; i < enemiesLen; i++) {
        if (newState.enemies[i].y > GAME_OVER_Y_THRESHOLD) {
            gameOver = true;
            break;
        }
    }
    if (gameOver) {
        return transitionToPlayerDying(newState, state.lastTick, effectiveNow, { x: newState.playerX, y: C.PLAYER_Y_POSITION + (C.GAME_HEIGHT * 0.10) / 2 });
    }

    return newState;
}

/**
 * Handles logic that runs before the main simulation, such as player reload requests,
 * power-up expirations, and ammo recalculations.
 */
function _handlePreSimulationUpdates(state: GameState, effectiveNow: number): Partial<GameState> {
    const isTraining = state.status === GameStatus.TrainingSim;
    let { 
        reloadCompleteTime, 
        playedEmptyClipSound, 
        wantsToReload, 
        shieldBreakingUntil, 
        ammo 
    } = state;

    // --- Process Reload Request from UI ---
    if (wantsToReload) {
        let reloadBonus = 0;
        if (!isTraining && state.generalUpgrades.reload_speed_level > 0) {
            reloadBonus = C.HANGAR_GENERAL_UPGRADE_CONFIG.reload_speed_level[state.generalUpgrades.reload_speed_level - 1].effect;
        }
        
        const reloadBoostReduction = !isTraining ? Math.min(state.reloadBoosts * C.RELOAD_TIME_REDUCTION_PER_STACK, C.RELOAD_TIME_REDUCTION_MAX) : 0;
        const totalReloadReduction = Math.min(reloadBoostReduction + reloadBonus, C.RELOAD_TIME_REDUCTION_MAX);
        const currentReloadTime = C.RELOAD_TIME * (1 - totalReloadReduction);
        
        playSound('reload');
        
        reloadCompleteTime = effectiveNow + currentReloadTime;
        playedEmptyClipSound = false;
        wantsToReload = false;
    }

    // --- Process Power-Up Expirations ---
    let maxAmmoChanged = false;
    const activePowerUps: GameState['activePowerUps'] = {};
    for (const key in state.activePowerUps) {
        const powerUpKey = key as keyof typeof state.activePowerUps;
        const powerUp = state.activePowerUps[powerUpKey];
        if (powerUp && (effectiveNow <= powerUp.expiresAt || (key === 'Shield' && shieldBreakingUntil > effectiveNow))) {
            activePowerUps[powerUpKey] = { ...powerUp };
        } 
        else if (key === 'ExtendedMag') {
            maxAmmoChanged = true;
        }
    }
    
    // --- Shield Break Completion ---
    if (shieldBreakingUntil > 0 && effectiveNow > shieldBreakingUntil) { 
        delete activePowerUps.Shield; 
        shieldBreakingUntil = 0;
        clearPlayerRenderCache();
    }
    
    // --- Recalculate Ammo Capacity ---
    const ammoBonus = !isTraining && state.generalUpgrades.ammo_capacity_level > 0 ? C.HANGAR_GENERAL_UPGRADE_CONFIG.ammo_capacity_level[state.generalUpgrades.ammo_capacity_level - 1].effect : 0;
    const maxAmmo = (!isTraining && activePowerUps.ExtendedMag ? C.EXTENDED_MAG_SIZE : C.PLAYER_INITIAL_AMMO) + ammoBonus;
    
    if (maxAmmoChanged) {
        ammo = Math.min(ammo, maxAmmo);
    }
    
    // --- Process Reload Completion ---
    if (reloadCompleteTime > 0 && effectiveNow >= reloadCompleteTime) {
        if (!isTraining) {
            ammo = maxAmmo;
        }
        reloadCompleteTime = 0;
    }

    return {
        reloadCompleteTime,
        playedEmptyClipSound,
        wantsToReload,
        activePowerUps,
        shieldBreakingUntil,
        maxAmmo,
        ammo,
    };
}


function runGameTickLogic(state: GameState, action: GameTickStep, now: number, effectiveNow: number, delta: number, grid: SpatialGrid, performanceTimestamp: number): GameState {
    
    // --- FULL SIMULATION FOR ACTIVE STATES ---
    if (state.status === GameStatus.PlayerDying) {
        if (effectiveNow > state.playerDeathTime + C.PLAYER_DEATH_ANIMATION_DURATION) {
            return transitionToGameOver(state, now);
        }
        // ✅ MOBILE OPTIMIZATION: Create minimal state object instead of spreading large state
        const emptyStateForParticleUpdate: GameState = {
            ...state,
            enemies: [],
            projectiles: [],
            enemyProjectiles: [],
            asteroids: [],
            powerUps: [],
            upgradePartCollects: []
        };
        const { gibs: updatedGibs, shellCasings: updatedShells } = updateEntities(emptyStateForParticleUpdate, delta, now, effectiveNow);
        // ✅ MOBILE OPTIMIZATION: Reuse existing array instead of copying
        const explosions = state.explosions;
        const elapsedSinceDeath = effectiveNow - state.playerDeathTime;
        const expectedTotalExplosions = 1 + Math.floor(elapsedSinceDeath / C.PLAYER_DEATH_EXPLOSION_INTERVAL);
        // ✅ MOBILE OPTIMIZATION: Manual loop instead of filter().length to avoid allocation
        let deathExplosionsSoFar = 0;
        for (const exp of state.explosions) {
            if (exp.createdAt >= state.playerDeathTime) deathExplosionsSoFar++;
        }
        const explosionsToSpawn = Math.min(C.PLAYER_DEATH_EXPLOSION_COUNT, expectedTotalExplosions) - deathExplosionsSoFar;
        if (explosionsToSpawn > 0 && state.playerDeathPosition) {
            for (let i = 0; i < explosionsToSpawn; i++) {
                const x = state.playerDeathPosition.x + (Math.random() - 0.5) * C.PLAYER_WIDTH;
                const y = state.playerDeathPosition.y + (Math.random() - 0.5) * C.PLAYER_WIDTH * 1.2;
                const exp = pools.explosions.get();
                Object.assign(exp, { id: getNextId(), x, y, createdAt: effectiveNow });
                populateExplosionParticles(exp.particles);
                explosions.push(exp);
                playSound('explosion');
                for (let j = 0; j < C.GIB_COUNT / 2; j++) {
                    const angle = Math.random() * 2 * Math.PI, speed = C.GIB_INITIAL_SPEED_MIN + Math.random() * (C.GIB_INITIAL_SPEED_MAX - C.GIB_INITIAL_SPEED_MIN);
                    const gib = pools.gibs.get();
                    Object.assign(gib, { id: getNextId(), x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, rotation: Math.random() * 360, rotationSpeed: (Math.random() - 0.5) * 2000, createdAt: effectiveNow, color: C.PLAYER_GIB_COLORS[Math.floor(Math.random() * C.PLAYER_GIB_COLORS.length)], size: Math.random() * 8 + 5 });
                    updatedGibs.push(gib);
                }
            }
        }
        return { ...state, explosions, gibs: updatedGibs, shellCasings: updatedShells, weaverBeams: [] };
    }
    
    // --- Step 1: Handle Pre-simulation Updates ---
    const preSimUpdates = _handlePreSimulationUpdates(state, effectiveNow);
    let newState: GameState = { ...state, ...preSimUpdates };
    
    // ✅ OPTIMIZATION: Calculate isPlayerSlowed once per frame (includes debuff and ion storm)
    const isIonStorm = newState.pendingPostFightOutcome?.environment === 'ion_storm';
    const isPlayerSlowed = (newState.playerDebuffs.slow && effectiveNow < newState.playerDebuffs.slow.expiresAt) || isIonStorm;
    newState.isPlayerSlowed = isPlayerSlowed;
    
    if (newState.status === GameStatus.TrainingSim && newState.trainingSimState) {
        if (effectiveNow >= newState.trainingSimState.endTime) {
            return transitionToTrainingSimComplete(newState, now, effectiveNow, performanceTimestamp);
        }

        const isCountingDown = effectiveNow < newState.trainingSimState.startTime;

        const playerUpdates = updatePlayer(newState, action.pressedKeys, delta, now, effectiveNow, isCountingDown);
        
        // OPTIMIZATION: Assign properties directly instead of using spread
        newState.playerVx = playerUpdates.playerVx;
        newState.playerX = playerUpdates.playerX;
        newState.ammo = playerUpdates.ammo;
        newState.lastPlayerShotTime = playerUpdates.lastPlayerShotTime;
        newState.lastTridentShotTime = playerUpdates.lastTridentShotTime;
        newState.playedEmptyClipSound = playerUpdates.playedEmptyClipSound;
        newState.reloadCompleteTime = playerUpdates.reloadCompleteTime;
        newState.phaseShiftState = playerUpdates.phaseShiftState;
        newState.activeRareConsumable = playerUpdates.activeRareConsumable;
        newState.projectiles = appendArray(newState.projectiles, playerUpdates.newProjectiles);
        newState.shellCasings = appendArray(newState.shellCasings, playerUpdates.newShellCasings);
        
        const entityUpdates = updateEntities(newState, delta, now, effectiveNow);
        // OPTIMIZATION: Assign properties directly instead of using spread
        newState.enemies = entityUpdates.enemies;
        newState.projectiles = entityUpdates.projectiles;
        newState.enemyProjectiles = entityUpdates.enemyProjectiles;
        newState.asteroids = entityUpdates.asteroids;
        newState.powerUps = entityUpdates.powerUps;
        newState.shellCasings = entityUpdates.shellCasings;
        newState.gibs = entityUpdates.gibs;
        newState.upgradePartCollects = entityUpdates.upgradePartCollects;
        newState.weaverSurges = entityUpdates.weaverSurges;

        if (!isCountingDown) {
            // ✅ CRITICAL PERFORMANCE: Reuse passed grid instead of creating new one (saves allocation every frame)
            grid.clear();
            // ✅ CRITICAL PERFORMANCE: Manual loop instead of for...of to avoid iterator allocation
            const projectilesLen = newState.projectiles.length;
            for (let i = 0; i < projectilesLen; i++) {
                const proj = newState.projectiles[i];
                proj.radius = C.PROJECTILE_HITBOX_RADIUS;
                grid.insert(proj as unknown as Collidable);
            }
            // ✅ PERFORMANCE: Insert training targets into spatial grid for efficient collision detection
            // This reduces collision checks from O(n*m) to O(n*k) where k is nearby targets
            if (newState.trainingSimState?.targets) {
                const TARGET_VISUAL_RADIUS = 40;
                const targets = newState.trainingSimState.targets;
                const targetsLen = targets.length;
                // ✅ CRITICAL PERFORMANCE: Manual loop instead of for...of to avoid iterator allocation
                for (let i = 0; i < targetsLen; i++) {
                    const target = targets[i];
                    if (!target.isFailed) {
                        target.radius = TARGET_VISUAL_RADIUS;
                        grid.insert(target as unknown as Collidable);
                    }
                }
            }
            const collisionResults = resolveCollisions(newState, now, effectiveNow, grid);
            // ✅ MOBILE OPTIMIZATION: Use Object.assign instead of spread to avoid large object allocation
            Object.assign(newState, collisionResults);
        }
        
        // --- Step 9: Sort Renderables ---
        const sortedRenderables = getNextSortedRenderablesBuffer();
        insertionSort(newState.enemies);
        insertionSort(newState.asteroids);
        insertionSort(newState.powerUps);
        const targets = newState.trainingSimState?.targets ?? [];
        if (targets.length > 0) insertionSort(targets);
        
        // ✅ OPTIMIZATION: Reuse array instead of allocating every frame
        reusableBossArray.length = 0;
        if (newState.boss) reusableBossArray.push(newState.boss);
        
        const enemiesLen = newState.enemies.length;
        const asteroidsLen = newState.asteroids.length;
        const powerUpsLen = newState.powerUps.length;
        const targetsLen = targets.length;
        const bossAsArrayLen = reusableBossArray.length;

        let i = 0, j = 0, k = 0, l = 0, m = 0;
        while (i < enemiesLen || j < asteroidsLen || k < powerUpsLen || l < targetsLen || m < bossAsArrayLen) {
            const e1 = i < enemiesLen ? newState.enemies[i] : null;
            const e2 = j < asteroidsLen ? newState.asteroids[j] : null;
            const e3 = k < powerUpsLen ? newState.powerUps[k] : null;
            const e4 = l < targetsLen ? targets[l] : null;
            const e5 = m < bossAsArrayLen ? reusableBossArray[m] : null;
    
            const y1 = e1 ? e1.y : Infinity;
            const y2 = e2 ? e2.y : Infinity;
            const y3 = e3 ? e3.y : Infinity;
            const y4 = e4 ? e4.y : Infinity;
            const y5 = e5 ? e5.y : Infinity;
    
            // ✅ MOBILE OPTIMIZATION: Manual comparison chain instead of Math.min() for better performance
            let minY = y1;
            if (y2 < minY) minY = y2;
            if (y3 < minY) minY = y3;
            if (y4 < minY) minY = y4;
            if (y5 < minY) minY = y5;
    
            if (minY === y1) { sortedRenderables.push(e1!); i++; }
            else if (minY === y2) { sortedRenderables.push(e2!); j++; }
            else if (minY === y3) { sortedRenderables.push(e3!); k++; }
            else if (minY === y4) { sortedRenderables.push(e4!); l++; }
            else { sortedRenderables.push(e5!); m++; }
        }
        newState.sortedRenderables = sortedRenderables;

        return newState;
    }

    if (state.pendingEncounter && state.enemies.length === 0 && state.enemyProjectiles.length === 0 && state.asteroids.length === 0 && state.weaverBeams.length === 0) {
        let finalEncounter = state.pendingEncounter.isDynamic ? generateDynamicEncounter(state.pendingEncounter, state) : state.pendingEncounter;
        return { 
            ...state, 
            status: GameStatus.RandomEncounter, 
            currentEncounter: finalEncounter, 
            pendingEncounter: null, 
            screenShake: { magnitude: 0, duration: 0, startTime: 0 }, 
            touchState: defaultTouchState,
            pauseStartTime: performanceTimestamp,
        };
    }

    const isTraining = newState.status === GameStatus.TrainingSim;
    const shootingDisabled = (isTraining && newState.trainingSimState && effectiveNow < newState.trainingSimState.startTime) ||
                             (!!newState.encounterFightPrepareTime && effectiveNow < newState.encounterFightPrepareTime);
    
    // --- Step 2: Player action -> generates new projectiles, shell casings ---
    const playerUpdates = updatePlayer(newState, action.pressedKeys, delta, now, effectiveNow, shootingDisabled);
    // ✅ MOBILE OPTIMIZATION: Use Object.assign instead of spread for shallow copy
    let stateAfterPlayerUpdate: GameState = Object.assign({}, newState);
    // OPTIMIZATION: Assign properties directly instead of using spread
    stateAfterPlayerUpdate.playerVx = playerUpdates.playerVx;
    stateAfterPlayerUpdate.playerX = playerUpdates.playerX;
    stateAfterPlayerUpdate.ammo = playerUpdates.ammo;
    stateAfterPlayerUpdate.lastPlayerShotTime = playerUpdates.lastPlayerShotTime;
    stateAfterPlayerUpdate.lastTridentShotTime = playerUpdates.lastTridentShotTime;
    stateAfterPlayerUpdate.playedEmptyClipSound = playerUpdates.playedEmptyClipSound;
    stateAfterPlayerUpdate.reloadCompleteTime = playerUpdates.reloadCompleteTime;
    stateAfterPlayerUpdate.phaseShiftState = playerUpdates.phaseShiftState;
    stateAfterPlayerUpdate.activeRareConsumable = playerUpdates.activeRareConsumable;
    stateAfterPlayerUpdate.projectiles = appendArray(newState.projectiles, playerUpdates.newProjectiles);
    stateAfterPlayerUpdate.shellCasings = appendArray(newState.shellCasings, playerUpdates.newShellCasings);
    
    // --- Step 3: AI Logic ---
    const bossUpdates = stateAfterPlayerUpdate.status === GameStatus.BossBattle 
        ? runBossLogic(stateAfterPlayerUpdate, now, effectiveNow) 
        : {
            boss: null,
            newEnemyProjectiles: EMPTY_ENEMY_PROJECTILES,
            newMinions: EMPTY_MINIONS,
            newExplosions: EMPTY_EXPLOSIONS,
            newCriticalHits: EMPTY_CRITICAL_HITS,
            bossLasers: EMPTY_BOSS_LASERS,
            screenShake: stateAfterPlayerUpdate.screenShake
        };

    if (bossUpdates.phaseTransitionRequest) {
        return transitionBossPhase(stateAfterPlayerUpdate, now, effectiveNow, bossUpdates.phaseTransitionRequest.payload);
    }
    const aiUpdates = runStandardEnemyAI(stateAfterPlayerUpdate, now, effectiveNow);
    
    // --- Step 4: APPLY AI UPDATES ---
    // ✅ MOBILE OPTIMIZATION: Use push with spread instead of array spread to avoid intermediate arrays
    let stateAfterAI: GameState = {
        ...stateAfterPlayerUpdate,
        boss: bossUpdates.boss,
        bossLasers: bossUpdates.bossLasers,
        screenShake: bossUpdates.screenShake,
        enemies: aiUpdates.enemies,
        asteroids: aiUpdates.asteroids,
        enemyProjectiles: appendArray2(
            stateAfterPlayerUpdate.enemyProjectiles,
            bossUpdates.newEnemyProjectiles,
            aiUpdates.enemyProjectiles
        ),
        weaverBeams: appendArray(stateAfterPlayerUpdate.weaverBeams, aiUpdates.weaverBeams),
        weaverSurges: appendArray(stateAfterPlayerUpdate.weaverSurges, aiUpdates.weaverSurges),
        explosions: appendArray(stateAfterPlayerUpdate.explosions, bossUpdates.newExplosions),
        criticalHits: appendArray(stateAfterPlayerUpdate.criticalHits, bossUpdates.newCriticalHits),
    };
    
    // --- Step 5: Spawning ---
    const spawnUpdates = runSpawning(stateAfterAI, now, effectiveNow);
    let stateAfterSpawning: GameState = {
        ...stateAfterAI,
        enemies: appendArray2(stateAfterAI.enemies, spawnUpdates.newEnemies, bossUpdates.newMinions),
        asteroids: appendArray(stateAfterAI.asteroids, spawnUpdates.newAsteroids),
        lastSpawnTime: spawnUpdates.lastSpawnTime,
        seenEnemies: spawnUpdates.seenEnemies,
        inGameMessages: appendArray(stateAfterAI.inGameMessages, spawnUpdates.newInGameMessages),
    };
    
    // --- Step 6: Update entity positions ---
    const entityUpdates = updateEntities(stateAfterSpawning, delta, now, effectiveNow);
    // ✅ MOBILE OPTIMIZATION: Use Object.assign instead of spread for shallow copy
    let stateAfterMovement: GameState = Object.assign({}, stateAfterSpawning);
    stateAfterMovement.enemies = entityUpdates.enemies;
    stateAfterMovement.projectiles = entityUpdates.projectiles;
    stateAfterMovement.enemyProjectiles = entityUpdates.enemyProjectiles;
    stateAfterMovement.asteroids = entityUpdates.asteroids;
    stateAfterMovement.powerUps = entityUpdates.powerUps;
    stateAfterMovement.shellCasings = entityUpdates.shellCasings;
    stateAfterMovement.gibs = entityUpdates.gibs;
    stateAfterMovement.upgradePartCollects = entityUpdates.upgradePartCollects;
    stateAfterMovement.weaverSurges = entityUpdates.weaverSurges;

    // --- Step 7: Process debuffs ---
    const debuffUpdates = processDebuffs(stateAfterMovement, now, effectiveNow);
    let stateAfterDebuffs: GameState = {
        ...stateAfterMovement,
        enemies: debuffUpdates.updatedEnemies,
        asteroids: debuffUpdates.updatedAsteroids,
        boss: debuffUpdates.updatedBoss,
        damageNumbers: appendArray(stateAfterMovement.damageNumbers, debuffUpdates.newDamageNumbers),
    };
    
    // --- Step 8: Populate Spatial Grid with up-to-date entity positions.
    grid.clear();
    // ✅ CRITICAL PERFORMANCE: Manual loops instead of for...of to avoid iterator allocations
    const enemiesLen = stateAfterDebuffs.enemies.length;
    for (let i = 0; i < enemiesLen; i++) {
        const enemy = stateAfterDebuffs.enemies[i];
        enemy.radius = enemy.isBuffedByConduit ? C.ENEMY_HITBOX_RADIUS * 0.4 : C.ENEMY_HITBOX_RADIUS;
        grid.insert(enemy as unknown as Collidable);
    }
    const asteroidsLen = stateAfterDebuffs.asteroids.length;
    for (let i = 0; i < asteroidsLen; i++) {
        const asteroid = stateAfterDebuffs.asteroids[i];
        asteroid.radius = asteroid.size;
        grid.insert(asteroid as unknown as Collidable);
    }
    const projectilesLen = stateAfterDebuffs.projectiles.length;
    for (let i = 0; i < projectilesLen; i++) {
        const proj = stateAfterDebuffs.projectiles[i];
        proj.radius = C.PROJECTILE_HITBOX_RADIUS;
        grid.insert(proj as unknown as Collidable);
    }
    if (stateAfterDebuffs.boss && stateAfterDebuffs.boss.phase !== 'defeated' && !stateAfterDebuffs.boss.isInvulnerable) {
        const bossWidth = stateAfterDebuffs.boss.bossType === 'punisher' ? C.PUNISHER_WIDTH : stateAfterDebuffs.boss.bossType === 'warden' ? C.WARDEN_WIDTH : C.OVERMIND_WIDTH;
        // ✅ OPTIMIZATION: Mutate existing object instead of creating new one via spread
        stateAfterDebuffs.boss.radius = bossWidth / 2;
        grid.insert(stateAfterDebuffs.boss as unknown as Collidable);
    }
    reusablePlayerMainCollidable.x = stateAfterDebuffs.playerX;
    reusablePlayerMainCollidable.y = C.PLAYER_Y_POSITION + C.PLAYER_HITBOX_MAIN_Y_OFFSET;
    grid.insert(reusablePlayerMainCollidable);
    reusablePlayerNoseCollidable.x = stateAfterDebuffs.playerX;
    reusablePlayerNoseCollidable.y = C.PLAYER_Y_POSITION + C.PLAYER_HITBOX_NOSE_Y_OFFSET;
    grid.insert(reusablePlayerNoseCollidable);
    
    // --- Step 9: Resolve Collisions using the final grid ---
    const collisionResults = resolveCollisions(stateAfterDebuffs, now, effectiveNow, grid);
    const bossShake = bossUpdates.screenShake;
    const collisionShake = collisionResults.screenShake;
    
    // ✅ MOBILE OPTIMIZATION: Use Object.assign instead of spread to avoid large object allocation
    Object.assign(stateAfterDebuffs, collisionResults);
    newState = stateAfterDebuffs;

    const currentShakeElapsed = effectiveNow - state.screenShake.startTime;
    let resultingShake = (currentShakeElapsed < state.screenShake.duration)
        ? state.screenShake
        : { magnitude: 0, duration: 0, startTime: 0 };
    if (bossShake && bossShake.magnitude > resultingShake.magnitude) resultingShake = bossShake;
    if (collisionShake && collisionShake.magnitude > resultingShake.magnitude) resultingShake = collisionShake;
    newState.screenShake = resultingShake;
    
    newState.enemiesDefeatedInLevel += collisionResults.enemiesDefeatedThisTick;

    // --- Step 10: Sort Renderables ---
    const sortedRenderables = getNextSortedRenderablesBuffer();
    
    // ✅ MOBILE OPTIMIZATION: Only sort if arrays changed significantly
    const enemiesChanged = Math.abs(newState.enemies.length - (state.enemies?.length || 0)) > 2;
    if (enemiesChanged) {
        insertionSort(newState.enemies);
    }
    const asteroidsChanged = Math.abs(newState.asteroids.length - (state.asteroids?.length || 0)) > 2;
    if (asteroidsChanged) {
        insertionSort(newState.asteroids);
    }
    const powerUpsChanged = Math.abs(newState.powerUps.length - (state.powerUps?.length || 0)) > 1;
    if (powerUpsChanged) {
        insertionSort(newState.powerUps);
    }

    const targets = newState.trainingSimState?.targets ?? [];
    if (targets.length > 0) insertionSort(targets);
    
    // ✅ OPTIMIZATION: Reuse array instead of allocating every frame
    reusableBossArray.length = 0;
    if (newState.boss) reusableBossArray.push(newState.boss);
    
    const renderEnemiesLen = newState.enemies.length;
    const renderAsteroidsLen = newState.asteroids.length;
    const renderPowerUpsLen = newState.powerUps.length;
    const targetsLen = targets.length;
    const bossAsArrayLen = reusableBossArray.length;

    let i = 0, j = 0, k = 0, l = 0, m = 0;
    while (i < renderEnemiesLen || j < renderAsteroidsLen || k < renderPowerUpsLen || l < targetsLen || m < bossAsArrayLen) {
        const e1 = i < renderEnemiesLen ? newState.enemies[i] : null;
        const e2 = j < renderAsteroidsLen ? newState.asteroids[j] : null;
        const e3 = k < renderPowerUpsLen ? newState.powerUps[k] : null;
        const e4 = l < targetsLen ? targets[l] : null;
        const e5 = m < bossAsArrayLen ? reusableBossArray[m] : null;

        const y1 = e1 ? e1.y : Infinity;
        const y2 = e2 ? e2.y : Infinity;
        const y3 = e3 ? e3.y : Infinity;
        const y4 = e4 ? e4.y : Infinity;
        const y5 = e5 ? e5.y : Infinity;

        // ✅ PERFORMANCE: Manual comparison chain instead of Math.min() to avoid function call overhead
        let minY = y1;
        if (y2 < minY) minY = y2;
        if (y3 < minY) minY = y3;
        if (y4 < minY) minY = y4;
        if (y5 < minY) minY = y5;

        if (minY === y1) { sortedRenderables.push(e1!); i++; }
        else if (minY === y2) { sortedRenderables.push(e2!); j++; }
        else if (minY === y3) { sortedRenderables.push(e3!); k++; }
        else if (minY === y4) { sortedRenderables.push(e4!); l++; }
        else { sortedRenderables.push(e5!); m++; }
    }
    newState.sortedRenderables = sortedRenderables;

    // --- Step 11: Post-Tick State Transitions (Atomic) ---
    const { playerDied, playerDeathPosition } = collisionResults;
    if (playerDied && playerDeathPosition) {
        return transitionToPlayerDying(newState, now, effectiveNow, playerDeathPosition);
    }
    
    return checkStateTransitions(newState, performanceTimestamp);
}

export function runGameTick(state: GameState, action: GameTickStep): GameState {
    const { delta: delta_s, timestamp: performanceTimestamp } = action;
    const isSimulating = SIMULATION_STATES.has(state.status);

    if (isSimulating) {
        const initialLastTick = state.lastTick;
        const now = initialLastTick === 0 ? performanceTimestamp : initialLastTick + (delta_s * 1000);
        const effectiveNow = now - state.totalPauseDuration;
        
        // ✅ MOBILE OPTIMIZATION: Reuse spatial grid instead of allocating new one every frame
        const grid = reusableSpatialGrid;
        // ✅ CRITICAL PERFORMANCE: Pass state directly - runGameTickLogic already creates new state objects internally
        let nextState = runGameTickLogic(state, action, now, effectiveNow, delta_s, grid, performanceTimestamp);
        
        if (nextState.lastTick === initialLastTick) {
            nextState.lastTick = now;
        }

        // Keep grid scrolling inside the simulation tick to avoid an extra per-frame reducer dispatch.
        nextState.gridYOffset = (state.gridYOffset + (delta_s * 1000 * C.GRID_SCROLL_SPEED)) % C.GRID_CELL_HEIGHT;

        // Avoid allocating a fresh top-level state object every frame when container size did not change.
        if (
            state.containerSize?.width !== action.containerSize?.width ||
            state.containerSize?.height !== action.containerSize?.height
        ) {
            nextState.containerSize = action.containerSize;
        }

        return nextState;

    } else {
        // While paused or in menus, do not update the game clock. This prevents
        // triggering a state update and re-render on every animation frame, which
        // is a major performance bottleneck on mobile.
        if (state.containerSize?.width !== action.containerSize?.width || state.containerSize?.height !== action.containerSize?.height) {
            return { ...state, containerSize: action.containerSize };
        }
        return state;
    }
}