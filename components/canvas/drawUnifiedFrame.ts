
import type { GameState } from '../../types';
import { drawGridLayer, drawGameLayer, drawEffectsLayer } from './drawLayers';
import { cacheManager } from '../../utils/cacheManager';
import { enemyRenderCache, enemyShapeCache, clearEnemyRenderCache } from './drawEnemy';
import { asteroidRenderCache, clearAsteroidRenderCache } from './drawAsteroid';
import { shieldImageCache, shieldHpBarCache, shatterParticleCache, clearPlayerRenderCache } from './drawPlayer';
import { clearProjectileCache } from './drawProjectiles';
import { clearParticleCache } from './drawImpacts';
import { getProjectileColor } from '../../utils/visuals';

/**
 * Resets all critical context properties to a known default state.
 */
function resetContextState(ctx: CanvasRenderingContext2D) {
    // Reset drawing styles
    ctx.lineWidth = 1;
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
    ctx.miterLimit = 10;
    ctx.strokeStyle = '#000000';
    ctx.fillStyle = '#000000';

    // Reset compositing and filters
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';

    // Reset shadows - CRITICAL for preventing corruption
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    
    // Reset text properties
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
    
    // Reset image smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'low';

    // CRITICAL: Reset transform matrix to the initial DPR-scaled state.
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

// Cache Management
let frameCount = 0;
let lastCleanupFrame = 0;
const CLEANUP_INTERVAL = 1800; // Every 30 seconds at 60fps
const AGGRESSIVE_CLEANUP_INTERVAL = 600; // Every 10 seconds if memory pressure
// ✅ MOBILE OPTIMIZATION: Cache memory pressure detection to avoid repeated checks every frame
let lastMemoryCheckFrame = 0;
let cachedMemoryPressure = false;
const MEMORY_CHECK_INTERVAL = 60; // Check every 60 frames (once per second at 60fps)

export function initializeCacheManager() {
  cacheManager.registerCache('enemyRender', enemyRenderCache, 20); // Max 20 enemy types
  cacheManager.registerCache('asteroidRender', asteroidRenderCache, 100); // Max 100 asteroid variants
  cacheManager.registerCache('shieldImage', shieldImageCache, 5); // Max 5 hero types
  cacheManager.registerCache('shieldHpBar', shieldHpBarCache, 20); // Max 20 HP bar variants
  cacheManager.registerCache('shatterParticle', shatterParticleCache, 10); // Max 10 particle types
  cacheManager.registerCache('enemyShape', enemyShapeCache, 10); // Max 10 enemy shape types
  // Note: projectileRender and particleRender are registered in their respective files
}

function detectMemoryPressure(state: GameState): boolean {
  // Check if we're in a high-level game (more complex rendering)
  const isHighLevel = state.level > 15;
  
  // Check if we have many active entities
  const hasManyEntities = state.enemies.length > 20 || 
                         state.asteroids.length > 50;
  
  // Check if we're in a boss fight (more effects)
  const isBossFight = state.boss !== null;
  
  return isHighLevel || hasManyEntities || isBossFight;
}

export function performCacheCleanup(aggressive: boolean = false) {
  // Perform cleanup
  cacheManager.cleanup();
}

export function clearAllRenderCaches() {
    clearEnemyRenderCache();
    clearAsteroidRenderCache();
    clearPlayerRenderCache();
    clearProjectileCache();
    clearParticleCache();
    // New aggressive clear method
    cacheManager.clearAll();
}


/**
 * Orchestrates drawing on all three canvas layers from a single function call.
 */
export function drawUnifiedFrame(
  gridCtx: CanvasRenderingContext2D,
  gameCtx: CanvasRenderingContext2D,
  effectsCtx: CanvasRenderingContext2D,
  state: GameState,
  noiseCanvas: HTMLCanvasElement | null
) {
  frameCount++;
  
  // Check if cleanup is needed
  const framesSinceCleanup = frameCount - lastCleanupFrame;
  const shouldCleanup = framesSinceCleanup >= CLEANUP_INTERVAL;
  // ✅ MOBILE OPTIMIZATION: Cache memory pressure detection (check once per second instead of every frame)
  if (frameCount - lastMemoryCheckFrame >= MEMORY_CHECK_INTERVAL) {
    cachedMemoryPressure = detectMemoryPressure(state);
    lastMemoryCheckFrame = frameCount;
  }
  const isMemoryPressure = cachedMemoryPressure;
  const shouldAggressiveCleanup = isMemoryPressure && framesSinceCleanup >= AGGRESSIVE_CLEANUP_INTERVAL;
  
  if (shouldCleanup || shouldAggressiveCleanup) {
    performCacheCleanup(shouldAggressiveCleanup);
    lastCleanupFrame = frameCount;
  }

  // Clear with identity transform to avoid accidental wipes if any transform leaked
  gridCtx.setTransform(1, 0, 0, 1, 0, 0);
  gridCtx.clearRect(0, 0, gridCtx.canvas.width, gridCtx.canvas.height);
  gameCtx.setTransform(1, 0, 0, 1, 0, 0);
  gameCtx.clearRect(0, 0, gameCtx.canvas.width, gameCtx.canvas.height);
  effectsCtx.setTransform(1, 0, 0, 1, 0, 0);
  effectsCtx.clearRect(0, 0, effectsCtx.canvas.width, effectsCtx.canvas.height);
  // Now reset states (includes DPR transform)
  resetContextState(gridCtx);
  resetContextState(gameCtx);
  resetContextState(effectsCtx);

  // ESTABLISH A SINGLE TIMESTAMP FOR THE ENTIRE RENDER FRAME.
  const now = state.lastTick > 0 ? state.lastTick - state.totalPauseDuration : performance.now() - state.totalPauseDuration;
  
  // ✅ PERFORMANCE OPTIMIZATION: Calculate projectile color once per frame
  const projectileColor = getProjectileColor(state);
  
  // 1. Draw the background grid (bottom layer).
  drawGridLayer(gridCtx, state);

  // 2. Draw the main game objects (player, enemies, etc.) on the middle layer.
  drawGameLayer(gameCtx, state, now, projectileColor);

  // 3. Draw projectiles, explosions, and other visual effects on the top layer.
  drawEffectsLayer(effectsCtx, state, noiseCanvas, now, projectileColor);
}
