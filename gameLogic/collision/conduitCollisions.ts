import type { GameState, Enemy as EnemyType, Asteroid as AsteroidType } from '../../types';
import * as C from '../../constants';
import { pools } from '../../state/pools';
import { getNextId } from '../engine';
import { playSound } from '../../sounds';

const reusableLivingLinkedTargetIds = new Set<number>();

function getTargetById(state: GameState, id: number): EnemyType | AsteroidType | null {
    const enemies = state.enemies;
    for (let i = 0; i < enemies.length; i++) {
        if (enemies[i].id === id) {
            return enemies[i];
        }
    }

    const asteroids = state.asteroids;
    for (let i = 0; i < asteroids.length; i++) {
        if (asteroids[i].id === id) {
            return asteroids[i];
        }
    }

    return null;
}

/**
 * Processes conduit destruction debuffs - when a conduit is destroyed,
 * its linked target loses its shield buff and gets a cooldown.
 * 
 * @param state Current game state
 * @param effectiveNow Current effective time
 * @param destroyedConduits Array of destroyed conduit enemies
 * @param newCriticalHits Array to add critical hit effects to
 * @returns Map of entity ID to debuff updates to apply
 */
export function processConduitDebuffs(
    state: GameState,
    effectiveNow: number,
    destroyedConduits: EnemyType[],
    newCriticalHits: GameState['criticalHits']
): Map<number, Partial<EnemyType | AsteroidType>> {
    const debuffUpdates = new Map<number, Partial<EnemyType | AsteroidType>>();
    
    if (destroyedConduits.length > 0) {
        for (let i = 0; i < destroyedConduits.length; i++) {
            const conduit = destroyedConduits[i];
            if (conduit.linkedEnemyId != null) {
                const linkedId = conduit.linkedEnemyId;
                const linkedTarget = getTargetById(state, linkedId);
                if (linkedTarget) {
                    debuffUpdates.set(linkedId, {
                        isBuffedByConduit: false,
                        shieldCooldownUntil: effectiveNow + C.CONDUIT_SHIELD_BREAK_COOLDOWN,
                        shieldHealth: undefined,
                        shieldRegenTime: undefined
                    });
                    const popX = linkedTarget.x;
                    const popY = 'size' in linkedTarget ? linkedTarget.y : linkedTarget.y + C.ENEMY_HEIGHT_HALF;
                    const popRadius = 'size' in linkedTarget ? linkedTarget.size * 1.5 : C.ENEMY_HITBOX_RADIUS * 1.5;
                    playSound('shieldBreak');
                    const crit = pools.criticalHits.get();
                    crit.id = getNextId(); 
                    crit.x = popX; 
                    crit.y = popY; 
                    crit.radius = popRadius; 
                    crit.createdAt = effectiveNow;
                    newCriticalHits.push(crit);
                }
            }
        }
    }
    
    return debuffUpdates;
}

/**
 * Applies debuff updates to filtered entities.
 * 
 * @param filtered Filtered entities from collision resolution
 * @param debuffUpdates Map of entity ID to debuff updates
 */
export function applyConduitDebuffs(
    filtered: { enemies: EnemyType[]; asteroids: AsteroidType[] },
    debuffUpdates: Map<number, Partial<EnemyType | AsteroidType>>
): void {
    if (debuffUpdates.size > 0) {
        for (const enemy of filtered.enemies) {
            if (debuffUpdates.has(enemy.id)) {
                const updates = debuffUpdates.get(enemy.id) as Partial<EnemyType>;
                if (updates) {
                    enemy.isBuffedByConduit = updates.isBuffedByConduit;
                    enemy.shieldCooldownUntil = updates.shieldCooldownUntil;
                    enemy.shieldHealth = updates.shieldHealth;
                    enemy.shieldRegenTime = updates.shieldRegenTime;
                }
            }
        }
        for (const asteroid of filtered.asteroids) {
            if (debuffUpdates.has(asteroid.id)) {
                const updates = debuffUpdates.get(asteroid.id) as Partial<AsteroidType>;
                if (updates) {
                    asteroid.isBuffedByConduit = updates.isBuffedByConduit;
                    asteroid.shieldCooldownUntil = updates.shieldCooldownUntil;
                }
            }
        }
    }
}

/**
 * Final sanity check for orphaned shields - removes shields from entities
 * that no longer have a living conduit targeting them.
 * This addresses a potential race condition where a conduit is destroyed,
 * but its target's `isBuffedByConduit` flag is not cleared correctly.
 * 
 * @param filtered Filtered entities from collision resolution
 * @param effectiveNow Current effective time
 */
export function cleanupOrphanedConduitShields(
    filtered: { enemies: EnemyType[]; asteroids: AsteroidType[] },
    effectiveNow: number
): void {
    reusableLivingLinkedTargetIds.clear();

    for (let i = 0; i < filtered.enemies.length; i++) {
        const enemy = filtered.enemies[i];
        if (enemy.type === 'conduit' && enemy.linkedEnemyId != null) {
            reusableLivingLinkedTargetIds.add(enemy.linkedEnemyId);
        }
    }

    for (let i = 0; i < filtered.enemies.length; i++) {
        const enemy = filtered.enemies[i];
        if (enemy.isBuffedByConduit && !reusableLivingLinkedTargetIds.has(enemy.id)) {
            // This enemy has a shield, but no living conduit is targeting it. Remove the orphaned shield.
            enemy.isBuffedByConduit = false;
            enemy.shieldCooldownUntil = effectiveNow + C.CONDUIT_SHIELD_BREAK_COOLDOWN;
        }
    }
    for (let i = 0; i < filtered.asteroids.length; i++) {
        const asteroid = filtered.asteroids[i];
        if (asteroid.isBuffedByConduit && !reusableLivingLinkedTargetIds.has(asteroid.id)) {
            asteroid.isBuffedByConduit = false;
            asteroid.shieldCooldownUntil = effectiveNow + C.CONDUIT_SHIELD_BREAK_COOLDOWN;
        }
    }
}










