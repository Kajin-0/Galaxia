import type { Asteroid } from '../../types';
import { ASTEROID_ROCK_COLORS, ASTEROID_SIZES, IS_MOBILE } from '../../constants';
import { getCachedSin } from '../../gameLogic/update';

// Memoization cache for asteroid paths.
const asteroidPathCache = new Map<string, Path2D>();
// Pre-rendering cache for asteroid canvases.
export const asteroidRenderCache = new Map<string, HTMLCanvasElement>();

/**
 * Clears the asteroid path and render caches. This should be called between game runs
 * to prevent the caches from growing indefinitely and causing a memory leak.
 */
export function clearAsteroidRenderCache() {
    asteroidPathCache.clear();
    asteroidRenderCache.clear();
    asteroidShieldFrameCache.clear();
}

// Generate a random-ish but stable polygon shape for the asteroid based on its ID
function getMemoizedAsteroidPath(id: number, radius: number): Path2D {
    const key = `${id}-${radius}`;
    if (asteroidPathCache.has(key)) {
        return asteroidPathCache.get(key)!;
    }

    const path = new Path2D();
    const isMontezuma = id === -999;
    const numVertices = isMontezuma ? 24 : 8 + (Math.abs(id) % 5);
    const angleStep = (2 * Math.PI) / numVertices;

    for (let i = 0; i < numVertices; i++) {
        const angle = i * angleStep;
        
        const seed = isMontezuma ? 1337 : id;
        const variance = isMontezuma ? 0.1 : 0.4;
        const base = isMontezuma ? 0.9 : 0.8;
        const randomFactor = Math.sin((seed * (i + 1)) * 0.5) * variance + base;
        
        const r = radius * randomFactor;
        const x = r * Math.cos(angle);
        const y = r * Math.sin(angle);

        if (i === 0) {
            path.moveTo(x, y);
        } else {
            path.lineTo(x, y);
        }
    }
    path.closePath();
    
    asteroidPathCache.set(key, path);
    return path;
}

const SHADOW_BLUR = 20; // A generous blur amount for all asteroids
const PADDING = 10;
const ASTEROID_SHIELD_FRAME_COUNT = IS_MOBILE ? 4 : 8;
const ASTEROID_SHIELD_FRAME_MS = IS_MOBILE ? 90 : 55;
const ASTEROID_SHIELD_BLUR = IS_MOBILE ? 14 : 25;
const ASTEROID_SHIELD_MAX_PULSE = 1.05;
const asteroidShieldFrameCache = new Map<string, HTMLCanvasElement[]>();

function getAsteroidShieldFrames(radius: number): HTMLCanvasElement[] {
    const key = radius.toFixed(2);
    if (asteroidShieldFrameCache.has(key)) {
        return asteroidShieldFrameCache.get(key)!;
    }

    const frames: HTMLCanvasElement[] = [];
    const maxRadius = radius * ASTEROID_SHIELD_MAX_PULSE;
    const padding = ASTEROID_SHIELD_BLUR + 8;
    const canvasSize = Math.ceil((maxRadius + padding) * 2);

    for (let i = 0; i < ASTEROID_SHIELD_FRAME_COUNT; i++) {
        const frameCanvas = document.createElement('canvas');
        frameCanvas.width = canvasSize;
        frameCanvas.height = canvasSize;

        const frameCtx = frameCanvas.getContext('2d');
        if (!frameCtx) {
            continue;
        }

        const phase = (i / ASTEROID_SHIELD_FRAME_COUNT) * 2 * Math.PI;
        const pulse = 1 + Math.sin(phase) * 0.05;
        const shieldRadius = radius * pulse;
        const fillOpacity = 0.2 + Math.sin(phase * 0.75) * 0.1;

        frameCtx.translate(canvasSize / 2, canvasSize / 2);
        frameCtx.beginPath();
        frameCtx.arc(0, 0, shieldRadius, 0, 2 * Math.PI);
        frameCtx.strokeStyle = '#67e8f9';
        frameCtx.lineWidth = 2.5;
        frameCtx.shadowColor = '#67e8f9';
        frameCtx.shadowBlur = ASTEROID_SHIELD_BLUR;
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

    asteroidShieldFrameCache.set(key, frames);
    return frames;
}

/**
 * Retrieves a pre-rendered asteroid canvas from the cache or creates it on-demand.
 * This function draws the static parts of the asteroid (shape, craters, shadow).
 */
function getPreRenderedAsteroid(id: number, radius: number): HTMLCanvasElement {
    const key = `${id}-${radius}`;
    if (asteroidRenderCache.has(key)) {
        return asteroidRenderCache.get(key)!;
    }

    const isMontezuma = id === -999;
    // Calculate canvas size to accommodate the shape, shadow, and padding.
    const canvasSize = Math.ceil((radius + SHADOW_BLUR + PADDING) * 2);

    const canvas = document.createElement('canvas');
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext('2d')!;

    // Center the drawing context so the asteroid is rendered in the middle.
    ctx.translate(canvasSize / 2, canvasSize / 2);

    const asteroidPath = getMemoizedAsteroidPath(id, radius);
    
    // Base color and shadow.
    ctx.fillStyle = ASTEROID_ROCK_COLORS[Math.abs(id) % ASTEROID_ROCK_COLORS.length];
    ctx.shadowColor = isMontezuma ? '#f00' : '#111';
    ctx.shadowBlur = isMontezuma ? 20 : 10;
    
    // Draw main shape with its shadow.
    ctx.fill(asteroidPath);
    
    // Montezuma special effects (glow stroke).
    if (isMontezuma) {
        ctx.shadowColor = 'rgba(255,50,50,0.5)';
        ctx.shadowBlur = 30;
        ctx.strokeStyle = 'rgba(255,50,50,0.5)';
        ctx.lineWidth = 3;
        ctx.stroke(asteroidPath);
    }
    
    // Craters (drawn on top of the main shape, without their own shadow).
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    
    ctx.beginPath();
    ctx.arc(radius * 0.2, radius * 0.1, radius * 0.2, 0, 2 * Math.PI);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(-radius * 0.3, -radius * 0.4, radius * 0.25, 0, 2 * Math.PI);
    ctx.fill();

    asteroidRenderCache.set(key, canvas);
    return canvas;
}

export function drawAsteroid(ctx: CanvasRenderingContext2D, asteroid: Asteroid, wasHit: boolean, now: number) {
    ctx.save();
    
    // 1. Apply entity rotation.
    // ctx.rotate() is handled in drawSortedRenderables for this entity.
    
    // 2. Get the pre-rendered canvas for the asteroid's base appearance.
    const preRenderedCanvas = getPreRenderedAsteroid(asteroid.id, asteroid.size);

    // 3. Apply hit flash effect if `wasHit` is true and the asteroid is not shielded.
    // The filter is a GPU-accelerated operation and is very performant.
    if (wasHit && !asteroid.isBuffedByConduit) {
        ctx.filter = 'brightness(2.5) drop-shadow(0 0 10px #fff)';
    }

    // 4. Draw the cached image. It will be brightened if the filter was set.
    ctx.drawImage(preRenderedCanvas, -preRenderedCanvas.width / 2, -preRenderedCanvas.height / 2);
    
    // 5. Restore from the filter so it doesn't affect subsequent effects.
    if (wasHit && !asteroid.isBuffedByConduit) {
        ctx.filter = 'none';
    }
    
    // 6. Draw DYNAMIC overlay effects on top of the pre-rendered, rotated sprite.
    
    // Corrosive debuff overlay
    if (asteroid.debuffs?.corrosive) {
        ctx.save();
        // ✅ PERFORMANCE: Use cached sin calculations for asteroid effects
        // Limit phase offset to 100 unique values to prevent cache thrashing
        const phaseOffset = asteroid.id % 100;
        const hueShift = getCachedSin(now / 200 + phaseOffset) * 10;
        const baseHue = 81;
        const newHue = baseHue + hueShift;
        const pulse = 0.5 + getCachedSin(now / 150 + phaseOffset) * 0.2;
        
        // Use 'source-atop' to apply the color only to the pixels of the asteroid already drawn.
        ctx.globalCompositeOperation = 'source-atop';
        ctx.globalAlpha = pulse;
        ctx.fillStyle = `hsl(${newHue}, 74%, 46%)`;
        
        const radius = asteroid.size;
        // Fill a rectangle covering the asteroid; it will be clipped by source-atop.
        ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
        
        ctx.restore();
    }

    // Draw Invulnerability Shield on TOP of the rotated asteroid.
    if (asteroid.isBuffedByConduit) {
        const shieldFrames = getAsteroidShieldFrames(asteroid.size + 4);
        if (shieldFrames.length > 0) {
            const frameOffset = Math.abs(asteroid.id) % shieldFrames.length;
            const frameIndex = (Math.floor(now / ASTEROID_SHIELD_FRAME_MS) + frameOffset) % shieldFrames.length;
            const shieldFrame = shieldFrames[frameIndex];
            ctx.drawImage(shieldFrame, -shieldFrame.width / 2, -shieldFrame.height / 2);
        }
    }

    ctx.restore();
}

export function warmUpAsteroidCache() {
    // Pre-render a variety of asteroid shapes and sizes
    const sizes = [ASTEROID_SIZES.small.radius, ASTEROID_SIZES.medium.radius, ASTEROID_SIZES.large.radius];
    
    // Warm up standard asteroids (IDs 0-19 covers most color/shape combos)
    for (let id = 0; id < 20; id++) {
        sizes.forEach(size => {
            getPreRenderedAsteroid(id, size);
        });
    }

    sizes.forEach(size => {
        getAsteroidShieldFrames(size + 4);
    });
    
    // Warm up Montezuma
    // Montezuma size is calculated dynamically in engine usually, but let's approximate.
    // In transitionToMontezumaComplete: size: C.GAME_WIDTH * 0.33
    const montezumaSize = 500 * 0.33; // Approx
    getPreRenderedAsteroid(-999, montezumaSize);
}