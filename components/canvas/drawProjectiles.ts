
import type { GameState } from '../../types';
import * as C from '../../constants';
import { calculatePerspectiveScale } from '../../utils/perspective';
import { cacheManager } from '../../utils/cacheManager';

// ============================================================================
// PROJECTILE CACHING SYSTEM
// ============================================================================

const projectileCache = new Map<string, HTMLCanvasElement>();

// Register cache for memory management
cacheManager.registerCache('projectileRender', projectileCache, 50); // Capacity for various colors/types

export function clearProjectileCache() {
    projectileCache.clear();
}

/**
 * Generates or retrieves a pre-rendered projectile sprite.
 * Baking the shadowBlur and colors into an image saves massive GPU performance.
 */
function getCachedProjectile(color: string, isCluster: boolean, isAlphaL3: boolean, isEnemy: boolean): HTMLCanvasElement {
    // Create a unique key for this specific visual variant
    const key = isEnemy ? 'enemy' : `player-${color}-${isCluster}-${isAlphaL3}`;
    
    if (projectileCache.has(key)) {
        return projectileCache.get(key)!;
    }

    // Determine dimensions and styles
    const PADDING = 24; // Extra space for the glow/shadow to bleed into
    let width, height, shadowBlur, fillStyle, shadowColor;
    
    if (isEnemy) {
        width = C.ENEMY_PROJECTILE_WIDTH;
        height = C.ENEMY_PROJECTILE_HEIGHT;
        shadowBlur = 8;
        shadowColor = '#22c55e'; // Green glow
        fillStyle = '#bbf7d0';   // Light green core
    } else {
        const sizeMultiplier = isAlphaL3 ? C.ALPHA_L3_PROJECTILE_SIZE_MULTIPLIER : 1;
        width = 6 * (isCluster ? 1.5 : 1) * sizeMultiplier;
        height = C.PROJECTILE_HEIGHT * (isCluster ? 1.2 : 1) * sizeMultiplier;
        shadowBlur = (isCluster ? 12 : 8) * sizeMultiplier;
        shadowColor = color;
        fillStyle = color;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: false, alpha: true })!;
    
    // Size canvas to fit projectile + max shadow blur
    canvas.width = Math.ceil(width + PADDING * 2);
    canvas.height = Math.ceil(height + PADDING * 2);
    
    ctx.translate(canvas.width / 2, canvas.height / 2);
    
    // Apply expensive effects once
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = shadowBlur;
    ctx.fillStyle = fillStyle;
    
    if (isEnemy) {
        ctx.beginPath(); 
        ctx.arc(0, 0, width / 2, 0, 2 * Math.PI); 
        ctx.fill();
    } else {
        // Draw main body
        ctx.fillRect(-width / 2, -height / 2, width, height);
        
        // Draw inner white hot core (no shadow for this part to keep it crisp)
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(-width / 4, -height / 2, width / 2, height);
    }
    
    projectileCache.set(key, canvas);
    return canvas;
}

/**
 * Pre-generates common projectile sprites during game load to prevent stutter.
 */
export function warmUpProjectileCache() {
    // Warm up common player colors
    const commonColors = [
        C.PROJECTILE_COLOR_DEFAULT, 
        C.PROJECTILE_COLOR_RAPID_FIRE,
        C.PROJECTILE_COLOR_SPREAD_SHOT,
        C.PROJECTILE_COLOR_ALPHA_L3,
        C.PROJECTILE_COLOR_CORROSIVE
    ];
    
    commonColors.forEach(color => {
        getCachedProjectile(color, false, false, false); // Standard
        getCachedProjectile(color, true, false, false);  // Cluster (Trident L3)
        getCachedProjectile(color, false, true, false);  // Alpha L3
    });
    
    // Warm up enemy projectile
    getCachedProjectile('', false, false, true);
}

// ============================================================================
// DRAW FUNCTIONS
// ============================================================================

function drawPlayerProjectiles(ctx: CanvasRenderingContext2D, currentState: GameState, projectileColor: string) {
    const { selectedHero, heroUpgrades, projectiles } = currentState;
    const isAlphaL3 = selectedHero === 'alpha' && heroUpgrades.alpha_aoe_level >= 3;

    // Get the cached sprite for the current weapon state
    // We assume most projectiles in the array share the same state (except maybe Trident clusters)
    // Note: Trident L3 clusters have `isTridentCluster: true`
    const standardSprite = getCachedProjectile(projectileColor, false, isAlphaL3, false);
    const clusterSprite = isAlphaL3 || currentState.generalUpgrades.trident_shot_level >= 3 
        ? getCachedProjectile(projectileColor, true, isAlphaL3, false) 
        : standardSprite;

    // ✅ MOBILE OPTIMIZATION: Manual loop to avoid iterator allocation
    for (let i = 0; i < projectiles.length; i++) {
        const p = projectiles[i];
        const scale = calculatePerspectiveScale(p.y);
        const sprite = p.isTridentCluster ? clusterSprite : standardSprite;
        
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.angle || 0) * (Math.PI / 180));
        
        // Scale the entire cached image (including shadow).
        // This is visually correct (shadows get smaller with distance) and highly performant.
        // We divide dimensions by 2 because we are centering (drawing from -w/2, -h/2)
        // BUT drawImage takes width/height, not radius. 
        // The sprite canvas center is at sprite.width/2, sprite.height/2.
        ctx.drawImage(
            sprite, 
            -sprite.width / 2 * scale, 
            -sprite.height / 2 * scale, 
            sprite.width * scale, 
            sprite.height * scale
        );
        
        ctx.restore();
    }
}

function drawEnemyProjectiles(ctx: CanvasRenderingContext2D, currentState: GameState) {
    const { enemyProjectiles } = currentState;
    const sprite = getCachedProjectile('', false, false, true);

    // ✅ MOBILE OPTIMIZATION: Manual loop
    for (let i = 0; i < enemyProjectiles.length; i++) {
        const p = enemyProjectiles[i];
        const scale = calculatePerspectiveScale(p.y);
        
        // Draw Tail
        if (p.prevX !== undefined && p.prevY !== undefined) {
            const tailLengthSq = (p.x - p.prevX) ** 2 + (p.y - p.prevY) ** 2;
            if (tailLengthSq > 0.1) {
                const tailWidth = (C.ENEMY_PROJECTILE_WIDTH * 0.9) * scale;
                ctx.save();
                ctx.strokeStyle = 'rgba(34, 197, 94, 0.6)'; // Simplified opacity stroke
                ctx.lineWidth = tailWidth;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.prevX, p.prevY);
                ctx.stroke();
                ctx.restore();
            }
        }

        // Draw Head (Cached Sprite)
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.drawImage(
            sprite, 
            -sprite.width / 2 * scale, 
            -sprite.height / 2 * scale, 
            sprite.width * scale, 
            sprite.height * scale
        );
        ctx.restore();
    }
}

export function drawAllProjectiles(ctx: CanvasRenderingContext2D, currentState: GameState, projectileColor: string) {
    // Ensure clean context state
    ctx.save();
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    
    // Reset shadow to prevent double-shadowing (sprites already have shadows)
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    
    drawPlayerProjectiles(ctx, currentState, projectileColor);
    drawEnemyProjectiles(ctx, currentState);

    ctx.restore();
}
