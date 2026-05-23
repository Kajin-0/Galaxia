import type { GameState, WeaverBeam, WeaverSurge } from '../../types';
import { WEAVER_BEAM_DURATION, GAME_WIDTH } from '../../constants';

// ============================================================================
// PRE-RENDERING CACHES FOR GRADIENTS
// ============================================================================

const weaverBeamImageCache: { image: HTMLCanvasElement | null } = { image: null };
const weaverSurgeImageCache: { image: HTMLCanvasElement | null } = { image: null };

/**
 * Creates a pre-rendered canvas for the Weaver's beam effect.
 * @param width The width of the canvas (should match game width).
 * @returns An HTMLCanvasElement with the pre-rendered effect.
 */
function getPreRenderedWeaverBeam(width: number): HTMLCanvasElement {
    if (weaverBeamImageCache.image && weaverBeamImageCache.image.width === width) {
        return weaverBeamImageCache.image;
    }
    const height = 10; // A small canonical height for the texture.
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, 'transparent');
    gradient.addColorStop(0.2, '#f472b6');
    gradient.addColorStop(0.5, '#ec4899');
    gradient.addColorStop(0.8, '#f472b6');
    gradient.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient;
    ctx.shadowColor = '#ec4899';
    ctx.shadowBlur = 15;
    ctx.filter = 'blur(1px)';
    
    ctx.fillRect(0, 0, width, height);
    
    weaverBeamImageCache.image = canvas;
    return canvas;
}

/**
 * Creates a pre-rendered canvas for the Weaver's surge effect.
 * @param width The width of the canvas (should match game width).
 * @returns An HTMLCanvasElement with the pre-rendered effect.
 */
function getPreRenderedWeaverSurge(width: number): HTMLCanvasElement {
    if (weaverSurgeImageCache.image && weaverSurgeImageCache.image.width === width) {
        return weaverSurgeImageCache.image;
    }
    const height = 12; // A canonical height for the texture.
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, 'transparent');
    gradient.addColorStop(0.2, '#a78bfa');
    gradient.addColorStop(0.5, '#8b5cf6');
    gradient.addColorStop(0.8, '#a78bfa');
    gradient.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient;
    ctx.shadowColor = '#8b5cf6';
    ctx.shadowBlur = 20;
    ctx.filter = 'blur(2px)';
    
    ctx.fillRect(0, 0, width, height);

    weaverSurgeImageCache.image = canvas;
    return canvas;
}

// ============================================================================
// DRAW FUNCTIONS
// ============================================================================

export function drawWeaverBeam(ctx: CanvasRenderingContext2D, beam: WeaverBeam, now: number, canvasWidth: number, beamCrackleSin?: number) {
    const timeAlive = now - beam.createdAt;
    const fadeDuration = 300; // ms
    
    let opacity = 1;
    if (timeAlive < fadeDuration) {
        opacity = timeAlive / fadeDuration; // Fade in
    } else if (timeAlive > WEAVER_BEAM_DURATION - fadeDuration) {
        opacity = (WEAVER_BEAM_DURATION - timeAlive) / fadeDuration; // Fade out
    }
    
    if (opacity <= 0) return;

    const beamImage = getPreRenderedWeaverBeam(canvasWidth);

    // ✅ OPTIMIZATION: Use cached Math.sin() value if provided, otherwise calculate
    const crackle = 1 + (beamCrackleSin ?? Math.sin(now / 30)) * 0.5;
    const height = 4 * crackle;

    ctx.save();
    ctx.globalAlpha = opacity;
    
    // Draw the pre-rendered image, scaled vertically for the crackle effect.
    ctx.drawImage(beamImage, 0, beam.y - height / 2, canvasWidth, height);

    ctx.restore();
}


export function drawWeaverSurge(ctx: CanvasRenderingContext2D, surge: WeaverSurge, now: number, canvasWidth: number, surgePulseSin?: number) {
    const surgeImage = getPreRenderedWeaverSurge(canvasWidth);
    
    // ✅ OPTIMIZATION: Use cached Math.sin() value if provided, otherwise calculate
    const pulseProgress = surgePulseSin ?? Math.sin(now / 50); // From -1 to 1
    const pulseY = 1.4 + pulseProgress * 0.4; // Range [1.0, 1.8]
    const pulseX = 1.025 + pulseProgress * 0.025; // Range [1.0, 1.05]
    const pulseOpacity = 0.95 + pulseProgress * 0.05; // Range [0.9, 1.0]

    const height = 12 * pulseY;
    const width = canvasWidth * pulseX;
    const xOffset = (canvasWidth - width) / 2;

    ctx.save();
    ctx.globalAlpha = pulseOpacity;

    // Draw the pre-rendered image with dynamic transformations for the pulse effect.
    ctx.drawImage(surgeImage, xOffset, surge.y - height / 2, width, height);

    ctx.restore();
}

export function drawAllWeaverEffects(ctx: CanvasRenderingContext2D, currentState: GameState, now: number) {
    const { weaverBeams, weaverSurges } = currentState;
    const canvasWidth = GAME_WIDTH;

    // ✅ OPTIMIZATION: Cache Math.sin() calculations (calculate once per frame)
    const beamCrackleSin = Math.sin(now / 30);
    const surgePulseSin = Math.sin(now / 50);
    
    // ✅ OPTIMIZATION: Manual loop instead of forEach to avoid function call overhead
    for (let i = 0; i < weaverBeams.length; i++) {
        drawWeaverBeam(ctx, weaverBeams[i], now, canvasWidth, beamCrackleSin);
    }
    
    for (let i = 0; i < weaverSurges.length; i++) {
        drawWeaverSurge(ctx, weaverSurges[i], now, canvasWidth, surgePulseSin);
    }
}