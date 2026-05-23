import type { GameState, EnemyProjectile as EnemyProjectileType } from '../../types';
import * as C from '../../constants';
import { pools } from '../../state/pools';
import { getNextId } from '../engine';

/**
 * Handles weaver beam collision logic - when enemy projectiles pass through weaver beams,
 * they are duplicated into three projectiles (one straight, two at angles).
 * 
 * @param state Current game state
 * @param effectiveNow Current effective time
 * @param destroyedEnemyProjectileIds Set of destroyed enemy projectile IDs
 * @returns Array of newly duplicated projectiles
 */
export function handleWeaverBeamCollisions(
    state: GameState,
    effectiveNow: number,
    destroyedEnemyProjectileIds: Set<number>
): EnemyProjectileType[] {
    const newDuplicatedProjectiles: EnemyProjectileType[] = [];
    
    // ✅ OPTIMIZATION: Early exit for expired beams and optimize nested loop
    if (state.weaverBeams.length > 0 && state.enemyProjectiles.length > 0) {
        const beamExpirationTime = effectiveNow - C.WEAVER_BEAM_DURATION;
        for (const beam of state.weaverBeams) {
            // Early exit: skip expired beams
            if (beam.createdAt < beamExpirationTime) continue;
            
            const beamY = beam.y;
            // ✅ OPTIMIZATION: Pre-filter projectiles that can intersect (only check those moving upward past beam)
            for (const p of state.enemyProjectiles) {
                if (p.isDuplicated || destroyedEnemyProjectileIds.has(p.id)) continue;
                // Early exit: only check projectiles that cross the beam line
                if (p.prevY !== undefined && p.prevY < beamY && p.y >= beamY) {
                    p.isDuplicated = true;
                    const p1 = pools.enemyProjectiles.get();
                    Object.assign(p1, p, { id: getNextId(), angle: -C.ENEMY_PROJECTILE_DUPLICATION_ANGLE, isDuplicated: true });
                    newDuplicatedProjectiles.push(p1);
                    const p2 = pools.enemyProjectiles.get();
                    Object.assign(p2, p, { id: getNextId(), angle: C.ENEMY_PROJECTILE_DUPLICATION_ANGLE, isDuplicated: true });
                    newDuplicatedProjectiles.push(p2);
                    p.angle = 0;
                }
            }
        }
    }
    
    return newDuplicatedProjectiles;
}










