import type { Enemy } from '../../types';
import * as C from '../../constants';
import { IS_MOBILE } from '../../constants';

// ============================================================================
// MEMOIZATION CACHES
// ============================================================================

// A single cache for all enemy paths. The key is the enemy type.
export const enemyShapeCache = new Map<string, Record<string, Path2D>>();

// ============================================================================
// PRE-RENDERING CACHE (Phase 1 & 2)
// ============================================================================

// A cache for pre-rendered enemy canvases.
// The key is a string like "dodger-hard", and the value is the rendered canvas.
export const enemyRenderCache = new Map<string, HTMLCanvasElement>();

/**
 * Creates a unique key for the pre-rendering cache.
 * This identifies each unique visual variant of an enemy (e.g., "dodger-hard").
 */
function getCacheKey(type: Enemy['type'], isHardMode: boolean): string {
    return `${type}-${isHardMode ? 'hard' : 'normal'}`;
}

// Configuration for geometry bounding boxes, used to size the offscreen canvases.
const ENEMY_DIMENSIONS: Record<Enemy['type'], { width: number; height: number }> = {
    standard: { width: 35, height: 42 },
    dodger: { width: 50, height: 40 },
    conduit: { width: 50, height: 40 },
    weaver: { width: 60, height: 50 },
    heretic_ship: { width: 50, height: 40 },
};

const SHADOW_BLUR = 15;
const PADDING = 10;
const CONDUIT_SHIELD_FRAME_COUNT = IS_MOBILE ? 4 : 8;
const CONDUIT_SHIELD_FRAME_MS = IS_MOBILE ? 90 : 55;
const CONDUIT_SHIELD_BLUR = IS_MOBILE ? 12 : 20;
const CONDUIT_SHIELD_MAX_PULSE = 1.05;
const conduitShieldFrameCache = new Map<string, HTMLCanvasElement[]>();

function getConduitShieldFrames(radius: number): HTMLCanvasElement[] {
    const key = radius.toFixed(2);
    if (conduitShieldFrameCache.has(key)) {
        return conduitShieldFrameCache.get(key)!;
    }

    const frames: HTMLCanvasElement[] = [];
    const maxRadius = radius * CONDUIT_SHIELD_MAX_PULSE;
    const padding = CONDUIT_SHIELD_BLUR + 8;
    const canvasSize = Math.ceil((maxRadius + padding) * 2);

    for (let i = 0; i < CONDUIT_SHIELD_FRAME_COUNT; i++) {
        const frameCanvas = document.createElement('canvas');
        frameCanvas.width = canvasSize;
        frameCanvas.height = canvasSize;

        const frameCtx = frameCanvas.getContext('2d');
        if (!frameCtx) {
            continue;
        }

        const phase = (i / CONDUIT_SHIELD_FRAME_COUNT) * 2 * Math.PI;
        const pulse = 1 + Math.sin(phase) * 0.05;
        const shieldRadius = radius * pulse;
        const fillOpacity = 0.2 + Math.sin(phase * 0.75) * 0.1;

        frameCtx.translate(canvasSize / 2, canvasSize / 2);
        frameCtx.beginPath();
        frameCtx.arc(0, 0, shieldRadius, 0, 2 * Math.PI);
        frameCtx.strokeStyle = '#67e8f9';
        frameCtx.lineWidth = 2.5;
        frameCtx.shadowColor = '#67e8f9';
        frameCtx.shadowBlur = CONDUIT_SHIELD_BLUR;
        frameCtx.stroke();
        frameCtx.shadowBlur = 0;
        frameCtx.fillStyle = `rgba(103, 232, 249, ${Math.max(0.05, fillOpacity)})`;
        frameCtx.fill();

        frames.push(frameCanvas);
    }

    if (frames.length === 0) {
        const fallbackFrame = document.createElement('canvas');
        fallbackFrame.width = 1;
        fallbackFrame.height = 1;
        frames.push(fallbackFrame);
    }

    conduitShieldFrameCache.set(key, frames);
    return frames;
}

/**
 * Retrieves a pre-rendered enemy canvas from the cache or creates it on-demand.
 * This is the core of the Phase 2 optimization.
 */
function getPreRenderedEnemy(type: Enemy['type'], isHardMode: boolean): HTMLCanvasElement {
    const key = getCacheKey(type, isHardMode);
    if (enemyRenderCache.has(key)) {
        return enemyRenderCache.get(key)!;
    }

    // Item not in cache, create it.
    const dimensions = ENEMY_DIMENSIONS[type];
    if (!dimensions) {
        // Fallback for safety, should not happen.
        // No dimensions found for enemy type
        const fallbackCanvas = document.createElement('canvas');
        fallbackCanvas.width = 1;
        fallbackCanvas.height = 1;
        return fallbackCanvas;
    }

    const canvas = document.createElement('canvas');
    canvas.width = dimensions.width + (SHADOW_BLUR * 2) + PADDING;
    canvas.height = dimensions.height + (SHADOW_BLUR * 2) + PADDING;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return canvas; // Should not happen.
    }

    // Center the drawing context so the enemy is rendered in the middle of the canvas.
    ctx.translate(canvas.width / 2, canvas.height / 2);

    // Get the specific drawing function for this enemy type.
    const renderFn = enemyRenderMap[type];
    if (renderFn) {
        // The render functions are stateless and only depend on type and mode,
        // so we can pass a mock enemy object.
        const mockEnemy: Enemy = { type } as Enemy;
        renderFn(ctx, mockEnemy, isHardMode);
    }
    
    // Store the newly rendered canvas in the cache for future frames.
    enemyRenderCache.set(key, canvas);
    
    return canvas;
}

// ============================================================================
// UTILITY RENDER FUNCTIONS (Modified to work with Path2D)
// ============================================================================

// Helper to draw a rectangle with a rounded top
function roundedTopRect(path: Path2D, x: number, y: number, width: number, height: number, radius: number) {
    path.moveTo(x + radius, y);
    path.lineTo(x + width - radius, y);
    path.arcTo(x + width, y, x + width, y + radius, radius);
    path.lineTo(x + width, y + height);
    path.lineTo(x, y + height);
    path.lineTo(x, y + radius);
    path.arcTo(x, y, x + radius, y, radius);
    path.closePath();
}

// Helper to draw a rectangle with a rounded bottom
function roundedBottomRect(path: Path2D, x: number, y: number, width: number, height: number, radius: number) {
    path.moveTo(x, y);
    path.lineTo(x + width, y);
    path.lineTo(x + width, y + height - radius);
    path.arcTo(x + width, y + height, x + width - radius, y + height, radius);
    path.lineTo(x + radius, y + height);
    path.arcTo(x, y + height, x, y + height - radius, radius);
    path.closePath();
}

// ============================================================================
// PATH GENERATORS (Run only once per enemy type)
// ============================================================================

function createAlienPaths(): Record<string, Path2D> {
    const tentacle1 = new Path2D();
    roundedBottomRect(tentacle1, -3.75, 8, 7.5, 12, 3.75);
    const tentacle2 = new Path2D();
    roundedBottomRect(tentacle2, -15, 10, 7.5, 10, 3.75);
    const tentacle3 = new Path2D();
    roundedBottomRect(tentacle3, 7.5, 10, 7.5, 10, 3.75);
    
    const body = new Path2D();
    body.rect(-7.5, 0, 15, 12);

    const head = new Path2D();
    roundedTopRect(head, -17.5, -20, 35, 24, 17.5);

    const eye1 = new Path2D();
    eye1.ellipse(-7.5, -6, 5, 6, 0, 0, 2 * Math.PI);
    const eye2 = new Path2D();
    eye2.ellipse(7.5, -6, 5, 6, 0, 0, 2 * Math.PI);

    return { tentacle1, tentacle2, tentacle3, body, head, eye1, eye2 };
}

function createDodgerPaths(): Record<string, Path2D> {
    const halfW = 25;
    const halfH = 20;
    const wings = new Path2D();
    wings.moveTo(0, 0); wings.lineTo(halfW, 12); wings.lineTo(-halfW, 12); wings.closePath();
    
    const body = new Path2D();
    body.moveTo(0, -halfH); body.lineTo(halfW, 4); body.lineTo(0, halfH); body.lineTo(-halfW, 4); body.closePath();

    const cockpit = new Path2D();
    cockpit.ellipse(0, -12, 2.5, 4, 0, 0, 2 * Math.PI);

    return { wings, body, cockpit };
}

function createConduitPaths(): Record<string, Path2D> {
    const hull = new Path2D();
    hull.moveTo(0, -20); hull.lineTo(25, -10); hull.lineTo(25, 10);
    hull.lineTo(0, 20); hull.lineTo(-25, 10); hull.lineTo(-25, -10); hull.closePath();
    
    const crystal = new Path2D();
    crystal.moveTo(0, -16); crystal.lineTo(20, 0);
    crystal.lineTo(0, 16); crystal.lineTo(-20, 0); crystal.closePath();

    return { hull, crystal };
}

function createWeaverPaths(): Record<string, Path2D> {
    // Each leg has a unique shape relative to its pivot point.
    // We pre-calculate all four to replicate the original `drawLeg` function.
    const leg1 = new Path2D(); // path: [5,0, 10,16, 5,32], origin: (10, 32)
    leg1.moveTo(5 - 10, 0 - 32); leg1.lineTo(10 - 10, 16 - 32); leg1.lineTo(5 - 10, 32 - 32); leg1.closePath();

    const leg2 = new Path2D(); // path: [5,0, 0,16, 5,32], origin: (0, 32)
    leg2.moveTo(5 - 0, 0 - 32); leg2.lineTo(0 - 0, 16 - 32); leg2.lineTo(5 - 0, 32 - 32); leg2.closePath();

    const leg3 = new Path2D(); // path: [5,0, 10,16, 5,32], origin: (10, 0)
    leg3.moveTo(5 - 10, 0 - 0); leg3.lineTo(10 - 10, 16 - 0); leg3.lineTo(5 - 10, 32 - 0); leg3.closePath();
    
    const leg4 = new Path2D(); // path: [5,0, 0,16, 5,32], origin: (0, 0)
    leg4.moveTo(5 - 0, 0 - 0);
    leg4.lineTo(0 - 0, 16 - 0);
    leg4.lineTo(5 - 0, 32 - 0);
    leg4.closePath();

    const body = new Path2D();
    body.ellipse(0, 0, 12.5, 10, 0, 0, 2 * Math.PI);

    return { leg1, leg2, leg3, leg4, body };
}


function createHereticShipPaths(): Record<string, Path2D> {
    const hull = new Path2D();
    hull.moveTo(0, -20); hull.lineTo(25, -8); hull.lineTo(17.5, 20);
    hull.lineTo(-17.5, 20); hull.lineTo(-25, -8); hull.closePath();

    const core = new Path2D();
    core.ellipse(0, 0, 10, 8, 0, 0, 2 * Math.PI);
    
    const accent1 = new Path2D();
    accent1.moveTo(-10, -15); accent1.lineTo(15, 0); accent1.lineTo(-5, 18);
    const accent2 = new Path2D();
    accent2.moveTo(5, -18); accent2.lineTo(-15, 5);

    return { hull, core, accent1, accent2 };
}

const pathGenerators: Record<Enemy['type'], () => Record<string, Path2D>> = {
    standard: createAlienPaths,
    dodger: createDodgerPaths,
    conduit: createConduitPaths,
    weaver: createWeaverPaths,
    heretic_ship: createHereticShipPaths,
};

function getEnemyPaths(type: Enemy['type']): Record<string, Path2D> {
    const key = type;
    if (enemyShapeCache.has(key)) {
        return enemyShapeCache.get(key)!;
    }
    const generator = pathGenerators[type];
    const paths = generator();
    enemyShapeCache.set(key, paths);
    return paths;
}


// ============================================================================
// ENEMY RENDER FUNCTIONS (Refactored to use cached paths)
// ============================================================================

function drawAlien(ctx: CanvasRenderingContext2D, enemy: Enemy, isHardMode: boolean) {
    const paths = getEnemyPaths('standard');
    
    // Original palette
    let shadowColor = '#0f0'; let tentacleColor = '#a855f7'; let bodyColor = '#059669';
    let headColor = '#10b981'; let eyeColor = '#0f172a';

    if (isHardMode) {
        shadowColor = '#f00'; tentacleColor = '#facc15'; bodyColor = '#7f1d1d';
        headColor = '#b91c1c'; eyeColor = '#fef2f2';
    }

    ctx.shadowColor = shadowColor; ctx.shadowBlur = 15;
    
    // Tentacles
    ctx.fillStyle = tentacleColor;
    ctx.fill(paths.tentacle1); ctx.fill(paths.tentacle2); ctx.fill(paths.tentacle3);
    // Body
    ctx.fillStyle = bodyColor;
    ctx.fill(paths.body);
    // Head
    ctx.fillStyle = headColor;
    ctx.fill(paths.head);
    
    // Eyes
    ctx.shadowBlur = 0; ctx.fillStyle = eyeColor;
    ctx.fill(paths.eye1); ctx.fill(paths.eye2);
    
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
}

function drawDodger(ctx: CanvasRenderingContext2D, enemy: Enemy, isHardMode: boolean) {
    const paths = getEnemyPaths('dodger');
    
    // Palettes
    let shadowColor = '#c084fc'; let wingColor = '#a855f7';
    let bodyColor = '#7e22ce'; let cockpitColor = '#f472b6';

    if (isHardMode) {
        shadowColor = '#f59e0b'; wingColor = '#f97316';
        bodyColor = '#b45309'; cockpitColor = '#fef08a';
    }

    ctx.shadowColor = shadowColor; ctx.shadowBlur = 15;

    // Wings
    ctx.fillStyle = wingColor; ctx.fill(paths.wings);
    // Main Body
    ctx.fillStyle = bodyColor; ctx.fill(paths.body);
    
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;

    // Cockpit Glow
    ctx.save();
    ctx.fillStyle = cockpitColor; ctx.shadowColor = cockpitColor; ctx.shadowBlur = 8;
    ctx.fill(paths.cockpit);
    ctx.restore();
}

function drawConduit(ctx: CanvasRenderingContext2D, enemy: Enemy, isHardMode: boolean) {
    const paths = getEnemyPaths('conduit');

    // Palettes
    let shadowColor = '#22d3ee';
    let hullColor = '#155e75';
    let crystalColor = '#0891b2';
    let coreColor = 'white';
    let coreShadow = '#0ff';
    
    if (isHardMode) {
        shadowColor = '#ef4444'; // red-500
        hullColor = '#450a0a';   // red-950
        crystalColor = '#7f1d1d';// red-900
        coreColor = '#fca5a5';   // red-300
        coreShadow = '#f00';
    }

    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = 15;

    // Hull
    ctx.fillStyle = hullColor;
    ctx.fill(paths.hull);

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Inner Crystal
    ctx.fillStyle = crystalColor;
    ctx.fill(paths.crystal);

    // Core - Reverted to original static appearance
    ctx.save();
    ctx.shadowColor = coreShadow;
    ctx.shadowBlur = 15;
    ctx.fillStyle = coreColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, (50 / 3) / 2, (40 / 3) / 2, 0, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
}

function drawWeaver(ctx: CanvasRenderingContext2D, enemy: Enemy, isHardMode: boolean) {
    const paths = getEnemyPaths('weaver');
    
    // Palettes
    let shadowColor = '#ec4899'; let legColor = '#7e22ce'; let bodyColor = '#db2777';

    if (isHardMode) {
        shadowColor = '#60a5fa'; legColor = '#d1d5db'; bodyColor = '#f9fafb';
    }

    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = 15;
    ctx.fillStyle = legColor;
    
    // Draw legs by applying the original, correct transformations for each unique leg path
    // Leg 1: { x: -30, y: -16, rotation: -45, originX: 10, originY: 32 }
    ctx.save();
    ctx.translate(-30, -16);
    ctx.translate(10, 32);
    ctx.rotate(-45 * Math.PI / 180);
    ctx.fill(paths.leg1);
    ctx.restore();

    // Leg 2: { x: 20, y: -16, rotation: 45, originX: 0, originY: 32 }
    ctx.save();
    ctx.translate(20, -16);
    ctx.translate(0, 32);
    ctx.rotate(45 * Math.PI / 180);
    ctx.fill(paths.leg2);
    ctx.restore();

    // Leg 3: { x: -30, y: -16, rotation: 45, originX: 10, originY: 0 }
    ctx.save();
    ctx.translate(-30, -16);
    ctx.translate(10, 0);
    ctx.rotate(45 * Math.PI / 180);
    ctx.fill(paths.leg3);
    ctx.restore();
    
    // Leg 4: { x: 20, y: -16, rotation: -45, originX: 0, originY: 0 }
    ctx.save();
    ctx.translate(20, -16);
    ctx.translate(0, 0);
    ctx.rotate(-45 * Math.PI / 180);
    ctx.fill(paths.leg4);
    ctx.restore();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    ctx.save();
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = 15;
    ctx.fillStyle = bodyColor;
    ctx.fill(paths.body);
    ctx.restore();
}

function drawHereticShip(ctx: CanvasRenderingContext2D, enemy: Enemy, isHardMode: boolean) {
    const paths = getEnemyPaths('heretic_ship');

    // Palettes
    let shadowColor = '#a855f7'; let hullColor = '#0f172a';
    let coreShadow = '#a855f7'; let coreColor = '#7e22ce'; let accentColor = 'rgba(192, 132, 252, 0.4)';

    if (isHardMode) {
        shadowColor = '#ef4444'; hullColor = '#111827';
        coreShadow = '#ef4444'; coreColor = '#dc2626'; accentColor = 'rgba(239, 68, 68, 0.4)';
    }

    ctx.shadowColor = shadowColor; ctx.shadowBlur = 15;
    ctx.fillStyle = hullColor; ctx.fill(paths.hull);
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;

    ctx.save();
    ctx.shadowColor = coreShadow; ctx.shadowBlur = 20; ctx.fillStyle = coreColor;
    ctx.fill(paths.core);
    ctx.restore();

    ctx.strokeStyle = accentColor; ctx.lineWidth = 1.5;
    ctx.stroke(paths.accent1);
    ctx.stroke(paths.accent2);
}

// ============================================================================
// MAIN EXPORTED RENDERER
// ============================================================================

const enemyRenderMap: Record<Enemy['type'], (ctx: CanvasRenderingContext2D, enemy: Enemy, isHardMode: boolean) => void> = {
    standard: drawAlien,
    dodger: drawDodger,
    conduit: drawConduit,
    weaver: drawWeaver,
    heretic_ship: drawHereticShip,
};

// ✅ MOBILE OPTIMIZATION: Reuse array to avoid allocation every frame (zero-allocation)
let dodgersCache: Enemy[] = [];

export function drawDodgerTrails(ctx: CanvasRenderingContext2D, enemies: Enemy[], isHardMode: boolean, now: number) {
    // ✅ MOBILE OPTIMIZATION: Manual loop instead of filter() to avoid array allocation
    dodgersCache.length = 0;
    for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (e.type === 'dodger' && e.trailPoints && e.trailPoints.length > 0) {
            dodgersCache.push(e);
        }
    }
    const dodgers = dodgersCache;
    if (dodgers.length === 0) return;

    const paths = getEnemyPaths('dodger');
    // ✅ MOBILE OPTIMIZATION: Use cached IS_MOBILE constant instead of repeated regex test
    const trailDuration = IS_MOBILE ? 150 : 200; // ms

    // ✅ MOBILE OPTIMIZATION: Manual loop instead of forEach (eliminates function call overhead)
    for (let i = 0; i < dodgers.length; i++) {
        const enemy = dodgers[i];
        // Optimization: Skip if dodger is off-screen
        if (enemy.y < -100 || enemy.y > C.GAME_HEIGHT + 100) continue;

        const trailPoints = enemy.trailPoints!;
        // ✅ MOBILE OPTIMIZATION: Manual loop instead of forEach (eliminates function call overhead)
        for (let j = 0; j < trailPoints.length; j++) {
            const point = trailPoints[j];
            const timeSincePoint = now - point.timestamp;
            // This is redundant now that trails are cleaned up in the simulation, but it's a safe guard.
            if (timeSincePoint > trailDuration) continue;

            const progress = timeSincePoint / trailDuration;
            const opacity = 0.5 * (1 - progress);
            
            // Optimization: Skip very transparent points
            if (opacity <= 0.01) continue;

            // Optimization: Skip points that are off-screen
            if (point.y < -50 || point.y > C.GAME_HEIGHT + 50) continue;

            const sizeScale = 1.0 - (progress * 0.15);

            ctx.save();
            try {
                ctx.translate(point.x, point.y);

                const perspectiveScale = 0.4 + (point.y / C.GAME_HEIGHT) * 0.6;
                ctx.scale(perspectiveScale * sizeScale, perspectiveScale * sizeScale);
                
                ctx.globalAlpha = opacity;

                const trailColor = isHardMode ? '#f97316' : '#a855f7';
                ctx.fillStyle = trailColor;

                ctx.fill(paths.wings);
                ctx.fill(paths.body);
            } finally {
                ctx.restore();
            }
        }
    }
}

export function drawEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy, wasHit: boolean, isHardMode: boolean, now: number) {
    // 1. Get the pre-rendered canvas for the enemy's base appearance.
    const preRenderedCanvas = getPreRenderedEnemy(enemy.type, isHardMode);

    // 2. Save context state before applying dynamic effects like hit flash.
    ctx.save();

    // NEW (Phase 4): Apply hit flash effect if `wasHit` is true.
    // The filter is a GPU-accelerated operation and is very performant.
    if (wasHit) {
        ctx.filter = 'brightness(2)';
    }

    // 3. Draw the cached image. It will be brightened if the filter was set.
    ctx.drawImage(preRenderedCanvas, -preRenderedCanvas.width / 2, -preRenderedCanvas.height / 2);
    
    // 4. Restore context to remove the filter, ensuring it doesn't affect other entities.
    ctx.restore();
    
    // 5. Draw DYNAMIC overlay effects on top of the pre-rendered sprite.
    
    // Corrosive debuff overlay
    if (enemy.debuffs?.corrosive) {
        ctx.save();
        const hueShift = Math.sin(now / 200 + enemy.id) * 10;
        const baseHue = 81;
        const newHue = baseHue + hueShift;
        const pulse = 0.5 + Math.sin(now / 150 + enemy.id) * 0.2;
        
        // Re-use the memoized path for a perfectly-shaped overlay
        const paths = getEnemyPaths(enemy.type);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = pulse;
        ctx.fillStyle = `hsl(${newHue}, 74%, 46%)`;
        
        // Fill all relevant paths for the enemy type
        // ✅ OPTIMIZATION: Direct iteration instead of Object.values().forEach (eliminates array allocation)
        for (const key in paths) {
            ctx.fill(paths[key]);
        }
        
        ctx.restore();
    }

    // Conduit shield effect
    if (enemy.isBuffedByConduit) {
        const shieldFrames = getConduitShieldFrames(C.ENEMY_HITBOX_RADIUS + 2);
        if (shieldFrames.length > 0) {
            const frameOffset = Math.abs(enemy.id) % shieldFrames.length;
            const frameIndex = (Math.floor(now / CONDUIT_SHIELD_FRAME_MS) + frameOffset) % shieldFrames.length;
            const shieldFrame = shieldFrames[frameIndex];
            ctx.drawImage(shieldFrame, -shieldFrame.width / 2, -shieldFrame.height / 2);
        }
    }
}

export function clearEnemyRenderCache() {
    enemyShapeCache.clear();
    enemyRenderCache.clear();
    conduitShieldFrameCache.clear();
}

export function warmUpEnemyCache() {
    const types: Enemy['type'][] = ['standard', 'dodger', 'conduit', 'weaver', 'heretic_ship'];
    const modes = [false, true]; // Normal, Hard

    types.forEach(type => {
        modes.forEach(isHardMode => {
            getPreRenderedEnemy(type, isHardMode);
        });
    });

    getConduitShieldFrames(C.ENEMY_HITBOX_RADIUS + 2);
}