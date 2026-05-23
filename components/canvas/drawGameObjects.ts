import type { Enemy as EnemyType, Asteroid as AsteroidType, PowerUp as PowerUpType, GameState, TrainingTarget as TrainingTargetType, Boss } from '../../types';
import { GameStatus } from '../../types';
import * as G from '../../constants';
import { drawEnemy } from './drawEnemy';
import { drawAsteroid } from './drawAsteroid';
import { drawPowerUp } from './drawPowerUp';
import { drawPlayer } from './drawPlayer';
import { drawTrainingTarget } from './drawTrainingTarget';
import { drawBoss } from './drawBoss';

// ✅ PERFORMANCE: Cache frequently used math constants
const PI_OVER_180 = Math.PI / 180;
const SCALE_MULTIPLIER = 0.6 / G.GAME_HEIGHT;
const TRAINING_TARGET_CULL_SIZE = 80;
const POWER_UP_CULL_SIZE = 40;

/**
 * ✅ MOBILE OPTIMIZATION: Viewport culling to skip off-screen entities
 * Accounts for perspective viewport and entity size to reduce GPU work
 */
function isEntityInViewport(entity: { x: number; y: number }, entityWidth: number, entityHeight: number): boolean {
    // Add generous margin for perspective and smooth scrolling
    // Entities slightly off-screen may still be visible due to perspective
    const marginX = G.GAME_WIDTH * 0.2; // 20% margin on sides
    const marginY = G.GAME_GRID_HEIGHT * 0.1; // 10% margin top/bottom
    
    // Check if entity center is within viewport + margins
    // Account for entity size (half width/height from center)
    const halfWidth = entityWidth / 2;
    const halfHeight = entityHeight / 2;
    
    return entity.x + halfWidth > -marginX &&
           entity.x - halfWidth < G.GAME_WIDTH + marginX &&
           entity.y + halfHeight > -marginY &&
           entity.y - halfHeight < G.GAME_GRID_HEIGHT + marginY;
}

export function drawSortedRenderables(ctx: CanvasRenderingContext2D, currentState: GameState, now: number) {
    const { sortedRenderables, isHardMode } = currentState;

    // ✅ PERFORMANCE: Manual loop instead of for...of to avoid iterator allocation
    const len = sortedRenderables.length;
    for (let i = 0; i < len; i++) {
        const entity = sortedRenderables[i];
        let entityWidth = G.ENEMY_WIDTH;
        let entityHeight = G.ENEMY_HEIGHT;
        if ('bossType' in entity) {
            if (entity.bossType === 'warden') {
                entityWidth = G.WARDEN_TOTAL_VISUAL_WIDTH;
                entityHeight = G.WARDEN_HEIGHT;
            } else if (entity.bossType === 'punisher') {
                entityWidth = G.PUNISHER_TOTAL_VISUAL_WIDTH;
                entityHeight = G.PUNISHER_HEIGHT;
            } else {
                entityWidth = G.OVERMIND_WIDTH;
                entityHeight = G.OVERMIND_HEIGHT;
            }
        } else if ('size' in entity) {
            entityWidth = entity.size * 2;
            entityHeight = entityWidth;
        } else if ('requiredHits' in entity) {
            entityWidth = TRAINING_TARGET_CULL_SIZE;
            entityHeight = TRAINING_TARGET_CULL_SIZE;
        } else if ('powerUpType' in entity) {
            entityWidth = POWER_UP_CULL_SIZE;
            entityHeight = POWER_UP_CULL_SIZE;
        }
        // ✅ MOBILE OPTIMIZATION: Early culling - skip entities outside viewport
        // This prevents expensive transform and draw operations for off-screen entities
        if (!isEntityInViewport(entity, entityWidth, entityHeight)) {
            continue; // Skip rendering off-screen entities
        }
        
        // ✅ PERFORMANCE: Use cached multiplier instead of division
        let scale = 0.4 + entity.y * SCALE_MULTIPLIER;
        
        ctx.save();
        ctx.translate(entity.x, entity.y);

        // Bosses have their own fixed size and do not use perspective scaling
        if (!('bossType' in entity)) {
            if ('size' in entity) { scale = Math.min(scale, 0.85); }
            ctx.scale(scale, scale);
        }

        const wasHit = 'lastHitTime' in entity ? now - (entity.lastHitTime ?? 0) < 100 : false;

        if ('bossType' in entity) {
            drawBoss(ctx, entity as Boss, currentState.wasBossHit, isHardMode, now);
        } else if ('requiredHits' in entity) {
            drawTrainingTarget(ctx, entity as TrainingTargetType, wasHit);
        } else if ('size' in entity) {
            ctx.save();
            // ✅ PERFORMANCE: Use cached PI conversion
            ctx.rotate(entity.rotation * PI_OVER_180);
            drawAsteroid(ctx, entity as AsteroidType, wasHit, now);
            ctx.restore();
        } else if ('powerUpType' in entity) {
            drawPowerUp(ctx, entity as PowerUpType);
        } else {
            drawEnemy(ctx, entity as EnemyType, wasHit, isHardMode, now);
        }
        ctx.restore();
    }
}

export function drawPlayerAndDrones(ctx: CanvasRenderingContext2D, currentState: GameState, now: number, projectileColor: string) {
    const {
        playerX, playerVx, selectedHero, lastPlayerShotTime: lastShotTime, status,
        generalUpgrades, lastTridentShotTime, powerUpInfusions,
        activePowerUps, shieldBreakingUntil, heroUpgrades,
        hasPermanentRapidFire,
        phaseShiftState, activeRareConsumable,
      } = currentState;

    const gameStatus = status;

    // --- Draw Player ---
    const gameActive = gameStatus === GameStatus.Playing || gameStatus === GameStatus.BossBattle || gameStatus === GameStatus.AsteroidField || gameStatus === GameStatus.TrainingSim;
    if (gameActive) {
        const recoilActive = now - lastShotTime < 80;
        const maxTilt = 15;
        const tilt = (playerVx / G.PLAYER_MAX_SPEED) * maxTilt;
        const shipWidth = G.PLAYER_SPRITE_WIDTH, shipHeight = G.PLAYER_SPRITE_HEIGHT;
        ctx.save();
        ctx.translate(playerX, G.PLAYER_Y_POSITION - shipHeight / 2);
        ctx.rotate(tilt * (Math.PI / 180));
        drawPlayer(ctx, {
            now, playerVx, hero: selectedHero, width: shipWidth, height: shipHeight,
            lastShotTime, recoilActive, lastTridentShotTime, generalUpgrades,
            powerUpInfusions, activePowerUps, shieldBreakingUntil, heroUpgrades,
            gameStatus, hasPermanentRapidFire, phaseShiftState, activeRareConsumable,
            projectileColor
        });
        ctx.restore();
    }
}