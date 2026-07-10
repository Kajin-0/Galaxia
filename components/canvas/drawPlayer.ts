import type { HeroType, GeneralUpgrades, PowerUpInfusionEffect, GameState, PowerUpType, GameStatus as GSType } from '../../types';
import { GameStatus } from '../../types';
import * as C from '../../constants';
import { easeOutQuint, easeOutCubic } from '../../utils/easing';

export interface PlayerDrawState {
    now: number;
    playerVx: number; // For movement-based animations
    hero: HeroType;
    width: number;
    height: number;
    lastShotTime: number;
    recoilActive: boolean;
    lastTridentShotTime: number;
    generalUpgrades: GeneralUpgrades;
    powerUpInfusions: PowerUpInfusionEffect[];
    activePowerUps: GameState['activePowerUps'];
    shieldBreakingUntil: number;
    heroUpgrades: GameState['heroUpgrades'];
    gameStatus: GSType;
    hasPermanentRapidFire: boolean;
    phaseShiftState: GameState['phaseShiftState'];
    activeRareConsumable: GameState['activeRareConsumable'];
    projectileColor: string; // ✅ PERFORMANCE: Pre-calculated projectile color to avoid redundant getProjectileColor calls
}

interface ShatterParticleProperties {
    tx: number; ty: number;
    rStart: number; rEnd: number;
    delay: number; size: number;
}
export const shatterParticleCache = new Map<number, ShatterParticleProperties[]>();
// Cache for pre-rendered shield graphics
export const shieldImageCache = new Map<HeroType, HTMLCanvasElement>();
// NEW: Cache for pre-rendered Gamma shield HP bar graphics.
export const shieldHpBarCache = new Map<string, HTMLCanvasElement>();
// Cache for Gamma ship gradient (gradient is expensive to create)
const gammaGradientCache = new Map<string, CanvasGradient>();
// ✅ ZERO-ALLOCATION: Cache static gradients for Alpha, Beta, and Drone ships
const alphaGradientCache = new Map<string, CanvasGradient>();
const betaGradientCache = new Map<string, CanvasGradient>();
const droneGradientCache = new Map<string, CanvasGradient>();
const droneEyePathCache = new Map<string, { eyePath: Path2D; corePath: Path2D }>();
const droneMuzzleFlashCache = new Map<string, { canvas: HTMLCanvasElement; offsetX: number; offsetY: number }>();

/**
 * Pre-renders the glowing HP bar circle to an offscreen canvas to avoid expensive
 * shadowBlur operations on every frame.
 */
function getShieldHpBarImage(radius: number, strokeWidth: number): HTMLCanvasElement {
    // Add a version to the key to invalidate old caches after this code change.
    const key = `${radius}-${strokeWidth}-v3`; // Changed to v3 to invalidate old cache
    if (shieldHpBarCache.has(key)) {
        return shieldHpBarCache.get(key)!;
    }

    const padding = 10;
    const canvasSize = (radius + strokeWidth / 2 + padding) * 2;
    
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = canvasSize;
    offscreenCanvas.height = canvasSize;
    const ctx = offscreenCanvas.getContext('2d')!;

    ctx.translate(canvasSize / 2, canvasSize / 2);
    ctx.lineCap = 'round';

    // --- Draw only the faint background ring (always visible, no shadow for performance) ---
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.15)';
    ctx.lineWidth = strokeWidth;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, 2 * Math.PI);
    ctx.stroke();
    
    shieldHpBarCache.set(key, offscreenCanvas);
    return offscreenCanvas;
}


export function clearPlayerRenderCache() {
    shatterParticleCache.clear();
    shieldImageCache.clear();
    shieldHpBarCache.clear();
    // ✅ ZERO-ALLOCATION: Clear gradient caches
    alphaGradientCache.clear();
    betaGradientCache.clear();
    gammaGradientCache.clear();
    droneGradientCache.clear();
    droneEyePathCache.clear();
    droneMuzzleFlashCache.clear();
}

const powerUpColorMap: Record<PowerUpType, string> = {
    RapidFire:  '#ef4444', // red-500
    SpreadShot: '#a855f7', // purple-500
    Shield:     '#22d3ee', // cyan-400
    ExtendedMag:'#3b82f6', // blue-500
    AutoReload: '#22c55e', // green-500
    CritBoost:  '#f97316', // orange-500
    ReloadBoost:'#facc15', // yellow-400
};


// --- NEW: Alpha MK-VIIb "Monolithic Hull" Ship ---
const alphaPathsCache: { [key: string]: { cracks: Path2D; hullOutline: Path2D; } } = {};
function createAlphaPaths(W: number, H: number): { cracks: Path2D; hullOutline: Path2D; } {
    const halfW = W / 2, halfH = H / 2;
    const key = `${W}x${H}`;
    if (alphaPathsCache[key]) return alphaPathsCache[key];

    // Define the crack paths
    const cracks = new Path2D();
    cracks.moveTo(0, -halfH * 0.7); cracks.lineTo(0, halfH * 0.8);
    cracks.moveTo(-halfW * 0.7, halfH * 0.55); cracks.lineTo(0, -halfH * 0.4);
    cracks.lineTo(halfW * 0.7, halfH * 0.55);
    cracks.moveTo(-halfW * 0.2, -halfH * 0.2); cracks.lineTo(-halfW * 0.4, halfH * 0.1);
    cracks.lineTo(-halfW * 0.25, halfH * 0.9);
    cracks.moveTo(halfW * 0.2, -halfH * 0.2); cracks.lineTo(halfW * 0.4, halfH * 0.1);
    cracks.lineTo(halfW * 0.25, halfH * 0.9);
    cracks.moveTo(0, halfH * 0.2); cracks.lineTo(-halfW * 0.2, halfH * 0.4);
    cracks.moveTo(0, halfH * 0.2); cracks.lineTo(halfW * 0.2, halfH * 0.4);

    const hullOutline = new Path2D();
    hullOutline.moveTo(0, -halfH);
    hullOutline.lineTo(halfW * 0.9, halfH * 0.6);
    hullOutline.lineTo(halfW * 0.4, halfH);
    hullOutline.lineTo(-halfW * 0.4, halfH);
    hullOutline.lineTo(-halfW * 0.9, halfH * 0.6);
    hullOutline.closePath();

    const paths = { cracks, hullOutline };
    alphaPathsCache[key] = paths;
    return paths;
}


// --- NEW: Beta "Interceptor" Ship ---
const betaPathsCache: { [key: string]: { cracks: Path2D; hullOutline: Path2D; } } = {};
function createBetaPaths(W: number, H: number): { cracks: Path2D; hullOutline: Path2D; } {
    const halfW = W / 2, halfH = H / 2;
    const key = `${W}x${H}`;
    if (betaPathsCache[key]) return betaPathsCache[key];

    const hullOutline = new Path2D();
    hullOutline.moveTo(0, -halfH); hullOutline.lineTo(halfW * 0.4, halfH * 0.8);
    hullOutline.lineTo(0, halfH); hullOutline.lineTo(-halfW * 0.4, halfH * 0.8);
    hullOutline.closePath();

    const cracks = new Path2D();
    cracks.moveTo(0, -halfH * 0.9); cracks.lineTo(0, halfH * 0.9); // Main vertical crack
    cracks.moveTo(0, -halfH * 0.5); cracks.lineTo(halfW * 0.3, -halfH * 0.2); // Upper branch
    cracks.moveTo(0, -halfH * 0.5); cracks.lineTo(-halfW * 0.3, -halfH * 0.2); // Upper branch
    cracks.moveTo(0, halfH * 0.2); cracks.lineTo(halfW * 0.2, halfH * 0.5); // Lower branch
    cracks.moveTo(0, halfH * 0.2); cracks.lineTo(-halfW * 0.2, halfH * 0.5); // Lower branch

    const paths = { cracks, hullOutline };
    betaPathsCache[key] = paths;
    return paths;
}

// --- NEW: Gamma "Gunship" Ship ---
interface GammaPathData {
    conduitPaths: { x: number; y: number }[][]; // Array of paths, each path is an array of points
    hullOutline: Path2D;
}
const gammaPathsCache: { [key: string]: GammaPathData } = {};
function createGammaPaths(W: number, H: number): GammaPathData {
    const halfW = W / 2, halfH = H / 2;
    const key = `${W}x${H}_v13_curved_conduit`;
    if (gammaPathsCache[key]) return gammaPathsCache[key];

    const hullOutline = new Path2D();
    hullOutline.moveTo(0, -halfH);
    hullOutline.lineTo(halfW, -halfH * 0.2);
    hullOutline.lineTo(halfW * 0.7, halfH);
    hullOutline.lineTo(-halfW * 0.7, halfH);
    hullOutline.lineTo(-halfW, -halfH * 0.2);
    hullOutline.closePath();

    // Define points for curved paths. Each sub-array is a continuous curved line.
    const conduitPaths: { x: number; y: number }[][] = [
        // Path 1: Right main trunk
        [
            { x: 0, y: halfH * 0.8 },
            { x: halfW * 0.1, y: halfH * 0.4 },
            { x: halfW * 0.3, y: -halfH * 0.1 },
            { x: halfW * 0.7, y: -halfH * 0.4 },
            { x: halfW * 0.9, y: -halfH * 0.3 },
        ],
        // Path 2: Left main trunk
        [
            { x: 0, y: halfH * 0.8 },
            { x: -halfW * 0.1, y: halfH * 0.4 },
            { x: -halfW * 0.3, y: -halfH * 0.1 },
            { x: -halfW * 0.7, y: -halfH * 0.4 },
            { x: -halfW * 0.9, y: -halfH * 0.3 },
        ],
        // Path 3: Central upper branch
        [
            { x: 0, y: halfH * 0.1 },
            { x: 0, y: -halfH * 0.95 },
        ],
        // Path 4: Right secondary branch
        [
            { x: halfW * 0.3, y: -halfH * 0.1 },
            { x: halfW * 0.4, y: halfH * 0.5 },
            { x: halfW * 0.6, y: halfH * 0.9 },
        ],
        // Path 5: Left secondary branch
        [
            { x: -halfW * 0.3, y: -halfH * 0.1 },
            { x: -halfW * 0.4, y: halfH * 0.5 },
            { x: -halfW * 0.6, y: halfH * 0.9 },
        ],
    ];
    
    const paths = { conduitPaths, hullOutline };
    gammaPathsCache[key] = paths;
    return paths;
}

function drawAlphaShip(ctx: CanvasRenderingContext2D, W: number, H: number, muzzleFlashActive: boolean, state: PlayerDrawState) {
    const { now, playerVx, activePowerUps, hasPermanentRapidFire, projectileColor } = state;
    const thrustFactor = Math.min(1, Math.abs(playerVx) / C.PLAYER_MAX_SPEED);
    const isRapidFire = !!(activePowerUps.RapidFire || hasPermanentRapidFire);
    
    const paths = createAlphaPaths(W, H);

    // --- Layer 1: Monolithic Hull (Base) ---
    // ✅ ZERO-ALLOCATION: Cache gradient to avoid creating new object every frame
    const gradientKey = `${W}x${H}`;
    let gradient = alphaGradientCache.get(gradientKey);
    if (!gradient) {
        gradient = ctx.createLinearGradient(-W / 2, -H / 2, W / 2, H / 2);
        gradient.addColorStop(0, '#334155'); // slate-700
        gradient.addColorStop(0.5, '#1e293b'); // slate-800
        gradient.addColorStop(1, '#0f172a'); // slate-900
        alphaGradientCache.set(gradientKey, gradient);
    }
    ctx.fillStyle = gradient;
    ctx.fill(paths.hullOutline);
    
    // ✅ PERFORMANCE: Use pre-calculated projectileColor instead of calling getProjectileColor
    const energyColor = projectileColor === C.PROJECTILE_COLOR_DEFAULT ? '#22d3ee' : projectileColor;
    const coreColor = isRapidFire ? '#fefce8' : '#ecfeff'; // a bright white-yellow or white-cyan

    const shieldState = activePowerUps.Shield;
    const timeSinceHit = shieldState?.lastHitTime ? now - shieldState.lastHitTime : Infinity;
    const isFlickering = timeSinceHit < 150;
    const flickerAlpha = isFlickering ? (Math.random() > 0.3 ? 1 : 0.2) : 1;
    
    // --- Layer 2: Crack Underglow (On Top) ---
    // ✅ MOBILE OPTIMIZATION: Batch context state changes - single save/restore for both layers
    ctx.save();
    // Layer 2: Underglow
    ctx.globalAlpha = (isRapidFire ? 0.7 : 0.5) * flickerAlpha;
    ctx.strokeStyle = energyColor;
    ctx.lineWidth = isRapidFire ? 10 : 7;
    // ✅ MOBILE OPTIMIZATION: Use shadowBlur instead of filter blur (more efficient)
    ctx.shadowColor = energyColor;
    ctx.shadowBlur = isRapidFire ? 14 : 10; // Increased to compensate for removed filter
    ctx.filter = 'none'; // Explicitly disable filter
    ctx.stroke(paths.cracks);

    // --- Layer 3: Crack Core Filament (On Top of Glow) ---
    const baseBrightness = isRapidFire ? 0.8 + Math.sin(now / 80) * 0.2 : 0.7 + Math.sin(now / 250) * 0.3;
    // Change only what's different for layer 3
    ctx.globalAlpha = baseBrightness * flickerAlpha;
    ctx.strokeStyle = coreColor;
    ctx.lineWidth = isRapidFire ? 2 : 1.5;
    ctx.shadowBlur = isRapidFire ? 8 : 5;
    ctx.stroke(paths.cracks);
    ctx.restore();

    // --- Overdrive Heat Vents ---
    if (isRapidFire) {
        ctx.save();
        const heatPulse = 0.6 + Math.sin(now / 60) * 0.4;
        const ventGradient = ctx.createLinearGradient(0, 0, W * 0.2, 0);
        ventGradient.addColorStop(0, `rgba(251, 146, 60, ${heatPulse * 0.8})`);
        ventGradient.addColorStop(1, `rgba(251, 146, 60, 0)`);
        
        ctx.shadowColor = '#f97316'; ctx.shadowBlur = 15;

        ctx.fillStyle = ventGradient;
        ctx.beginPath();
        ctx.moveTo(W * 0.1, -H * 0.1); ctx.lineTo(W * 0.25, 0);
        ctx.lineTo(W * 0.25, H * 0.3); ctx.lineTo(W * 0.1, H * 0.2);
        ctx.closePath(); ctx.fill();

        const leftVentGradient = ctx.createLinearGradient(-W * 0.2, 0, 0, 0);
        leftVentGradient.addColorStop(0, `rgba(251, 146, 60, 0)`);
        leftVentGradient.addColorStop(1, `rgba(251, 146, 60, ${heatPulse * 0.8})`);
        ctx.fillStyle = leftVentGradient;
        ctx.beginPath();
        ctx.moveTo(-W * 0.1, -H * 0.1); ctx.lineTo(-W * 0.25, 0);
        ctx.lineTo(-W * 0.25, H * 0.3); ctx.lineTo(-W * 0.1, H * 0.2);
        ctx.closePath(); ctx.fill();

        ctx.restore();
    }

    // --- Propulsion System ---
    if (thrustFactor > 0.01) {
        ctx.save();
        const trailLength = H * 1.5 * thrustFactor, trailY = H / 2, trailWidth = W * 0.5;
        const outerGlow = ctx.createLinearGradient(0, trailY, 0, trailY + trailLength);
        outerGlow.addColorStop(0, `rgba(${isRapidFire ? '251, 191, 36' : '103, 232, 249'}, 0.4)`);
        outerGlow.addColorStop(1, 'rgba(103, 232, 249, 0)');
        ctx.fillStyle = outerGlow; ctx.fillRect(-trailWidth * 0.7, trailY, trailWidth * 1.4, trailLength);
        const midLayer = ctx.createLinearGradient(0, trailY, 0, trailY + trailLength);
        midLayer.addColorStop(0, `rgba(${isRapidFire ? '253, 224, 71' : '165, 243, 252'}, 0.8)`);
        midLayer.addColorStop(1, 'rgba(165, 243, 252, 0)');
        ctx.fillStyle = midLayer; ctx.fillRect(-trailWidth * 0.4, trailY, trailWidth * 0.8, trailLength);
        const core = ctx.createLinearGradient(0, trailY, 0, trailY + trailLength);
        core.addColorStop(0, '#ffffff'); core.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = core; ctx.fillRect(-trailWidth * 0.15, trailY, trailWidth * 0.3, trailLength);
        ctx.restore();
    }
    
    // Removed decorative chevrons beneath the alpha ship to avoid small idle triangles on screen.

    // --- Muzzle Flash ---
    if (muzzleFlashActive) {
        drawMuzzleFlash(ctx, W, H, isRapidFire, 0.1);
    }
}

function drawBetaShip(ctx: CanvasRenderingContext2D, W: number, H: number, muzzleFlashActive: boolean, state: PlayerDrawState) {
    const { now, playerVx, activePowerUps, hasPermanentRapidFire, projectileColor } = state;
    const thrustFactor = Math.min(1, Math.abs(playerVx) / C.PLAYER_MAX_SPEED);
    const isRapidFire = !!(activePowerUps.RapidFire || hasPermanentRapidFire);
    
    const paths = createBetaPaths(W, H);

    // --- Hull ---
    // ✅ ZERO-ALLOCATION: Cache gradient to avoid creating new object every frame
    const gradientKey = `${W}x${H}`;
    let gradient = betaGradientCache.get(gradientKey);
    if (!gradient) {
        gradient = ctx.createLinearGradient(-W / 2, -H / 2, W / 2, H / 2);
        gradient.addColorStop(0, '#334155');
        gradient.addColorStop(0.5, '#1e293b');
        gradient.addColorStop(1, '#0f172a');
        betaGradientCache.set(gradientKey, gradient);
    }
    ctx.fillStyle = gradient;
    ctx.fill(paths.hullOutline);
    
    // ✅ PERFORMANCE: Use pre-calculated projectileColor instead of calling getProjectileColor
    const energyColor = projectileColor === C.PROJECTILE_COLOR_DEFAULT ? '#22d3ee' : projectileColor;
    const coreColor = isRapidFire ? '#fefce8' : '#ecfeff';

    const shieldState = activePowerUps.Shield;
    const timeSinceHit = shieldState?.lastHitTime ? now - shieldState.lastHitTime : Infinity;
    const isFlickering = timeSinceHit < 150;
    const flickerAlpha = isFlickering ? (Math.random() > 0.3 ? 1 : 0.2) : 1;
    
    // --- Cracks ---
    // ✅ MOBILE OPTIMIZATION: Batch context state changes and replace filter with shadowBlur
    ctx.save();
    // Layer 1: Underglow
    ctx.globalAlpha = (isRapidFire ? 0.7 : 0.5) * flickerAlpha;
    ctx.strokeStyle = energyColor;
    ctx.lineWidth = isRapidFire ? 8 : 5;
    // ✅ MOBILE OPTIMIZATION: Use shadowBlur instead of filter blur (more efficient)
    ctx.shadowColor = energyColor;
    ctx.shadowBlur = isRapidFire ? 12 : 8; // Increased to compensate for removed filter
    ctx.filter = 'none';
    ctx.stroke(paths.cracks);

    // Layer 2: Core Filament
    const baseBrightness = isRapidFire ? 0.8 + Math.sin(now / 80) * 0.2 : 0.7 + Math.sin(now / 250) * 0.3;
    ctx.globalAlpha = baseBrightness * flickerAlpha;
    ctx.strokeStyle = coreColor;
    ctx.lineWidth = isRapidFire ? 1.5 : 1;
    ctx.shadowBlur = isRapidFire ? 6 : 4;
    ctx.stroke(paths.cracks);
    ctx.restore();

    // --- Propulsion ---
    if (thrustFactor > 0.01) {
        ctx.save();
        const trailLength = H * 1.2 * thrustFactor, trailY = H / 2, trailWidth = W * 0.3;
        const outerGlow = ctx.createLinearGradient(0, trailY, 0, trailY + trailLength);
        outerGlow.addColorStop(0, `rgba(${isRapidFire ? '251, 191, 36' : '103, 232, 249'}, 0.4)`);
        outerGlow.addColorStop(1, 'rgba(103, 232, 249, 0)');
        ctx.fillStyle = outerGlow; ctx.fillRect(-trailWidth * 0.5, trailY, trailWidth, trailLength);
        const core = ctx.createLinearGradient(0, trailY, 0, trailY + trailLength);
        core.addColorStop(0, '#ffffff'); core.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = core; ctx.fillRect(-trailWidth * 0.2, trailY, trailWidth * 0.4, trailLength);
        ctx.restore();
    }
    
    // --- Muzzle Flash ---
    if (muzzleFlashActive) {
        drawMuzzleFlash(ctx, W, H, isRapidFire, 0.15);
    }
}

// Helper to draw muzzle flash with conical shape
function drawMuzzleFlash(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    isRapidFire: boolean,
    widthMultiplier: number = 0.15
) {
    ctx.save();
    const fTopY = -H / 2 - H * 0.1, fBottomY = fTopY + H * 0.3;
    const fTopHalfW = W * widthMultiplier * 0.3; // Narrow at top (conical)
    const fBottomHalfW = W * widthMultiplier; // Wider at bottom
    const flashCenterX = 0;
    const flashCenterY = fTopY + (fBottomY - fTopY) * 0.3;
    
    // Outer glow layer (larger, softer)
    const glowRadius = Math.max(fBottomHalfW, H * 0.2);
    const outerGlow = ctx.createRadialGradient(flashCenterX, flashCenterY, 0, flashCenterX, flashCenterY, glowRadius);
    outerGlow.addColorStop(0, isRapidFire ? 'rgba(249, 115, 22, 0.6)' : 'rgba(254, 240, 138, 0.6)');
    outerGlow.addColorStop(0.5, isRapidFire ? 'rgba(249, 115, 22, 0.3)' : 'rgba(254, 240, 138, 0.3)');
    outerGlow.addColorStop(1, 'rgba(254, 240, 138, 0)');
    ctx.fillStyle = outerGlow;
    ctx.beginPath();
    ctx.arc(flashCenterX, flashCenterY, glowRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Core flash (conical shape - trapezoid that widens outward)
    ctx.shadowColor = isRapidFire ? '#f97316' : '#fef08a';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-fTopHalfW, fTopY);      // Top left (narrow)
    ctx.lineTo(fTopHalfW, fTopY);       // Top right (narrow)
    ctx.lineTo(fBottomHalfW, fBottomY); // Bottom right (wide)
    ctx.lineTo(-fBottomHalfW, fBottomY); // Bottom left (wide)
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
}

// Helper to draw a tapered line as a filled polygon.
const drawTaperedPolygon = (ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w1: number, w2: number) => {
    if (w1 <= 0 && w2 <= 0) return;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;

    const px = -dy / len, py = dx / len;
    const p1x = x1 + px * w1 / 2, p1y = y1 + py * w1 / 2;
    const p2x = x1 - px * w1 / 2, p2y = y1 - py * w1 / 2;
    const p3x = x2 - px * w2 / 2, p3y = y2 - py * w2 / 2;
    const p4x = x2 + px * w2 / 2, p4y = y2 + py * w2 / 2;

    ctx.beginPath();
    ctx.moveTo(p1x, p1y); ctx.lineTo(p2x, p2y); ctx.lineTo(p3x, p3y); ctx.lineTo(p4x, p4y);
    ctx.closePath(); ctx.fill();
};

// Helper to draw a single curved path with tapered segments.
const drawTaperedPath = (ctx: CanvasRenderingContext2D, path: { x: number, y: number }[], thicknessProfile: (progress: number) => number) => {
    if (path.length < 2) return;
    
    // First, draw the path as a series of quadratic curves to get total length.
    // This is a simplification; a true arc length calculation is complex.
    // For our visual purpose, a linear approximation is sufficient.
    let totalLength = 0;
    for (let i = 0; i < path.length - 1; i++) {
        totalLength += Math.sqrt(Math.pow(path[i+1].x - path[i].x, 2) + Math.pow(path[i+1].y - path[i].y, 2));
    }
    if (totalLength === 0) return;

    let lengthSoFar = 0;
    for (let i = 0; i < path.length - 1; i++) {
        const p1 = path[i];
        const p2 = path[i+1];
        const segmentLength = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));

        const progress1 = lengthSoFar / totalLength;
        const progress2 = (lengthSoFar + segmentLength) / totalLength;

        const w1 = thicknessProfile(progress1);
        const w2 = thicknessProfile(progress2);

        drawTaperedPolygon(ctx, p1.x, p1.y, p2.x, p2.y, w1, w2);
        lengthSoFar += segmentLength;
    }
}

// --- OPTIMIZATION: Dedicated offscreen canvas for Gamma conduits ---
let gammaConduitCanvas: HTMLCanvasElement | null = null;

function drawGammaConduitsOffscreen(ctx: CanvasRenderingContext2D, W: number, H: number, state: PlayerDrawState) {
    const { now, activePowerUps, hasPermanentRapidFire, projectileColor } = state;
    const isRapidFire = activePowerUps.RapidFire || hasPermanentRapidFire;

    // ✅ PERFORMANCE: Use pre-calculated projectileColor instead of calling getProjectileColor
    const energyColor = projectileColor === C.PROJECTILE_COLOR_DEFAULT ? '#22d3ee' : projectileColor;
    const coreColor = isRapidFire ? '#fefce8' : '#ecfeff';

    const shieldState = activePowerUps.Shield;
    const timeSinceHit = shieldState?.lastHitTime ? now - shieldState.lastHitTime : Infinity;
    const isFlickering = timeSinceHit < 150;
    const flickerAlpha = isFlickering ? (Math.random() > 0.3 ? 1 : 0.2) : 1;

    const pulseFrequency = isRapidFire ? 200 : 400;
    const phaseShift = now / pulseFrequency;

    const createThicknessProfile = (base: number, max: number, min: number) => (progress: number) => {
        const pulse = (Math.sin(phaseShift - progress * 2) + 1) / 2;
        return min + (max - min) * pulse;
    };

    const { conduitPaths } = createGammaPaths(W, H);

    // ✅ ZERO-ALLOCATION: Manual loop instead of forEach to eliminate function closure overhead
    for (let i = 0; i < conduitPaths.length; i++) {
        const path = conduitPaths[i];
        const auraProfile = createThicknessProfile(0, isRapidFire ? 30 : 25, 4);
        const glowProfile = createThicknessProfile(0, isRapidFire ? 15 : 12, 2);
        const filamentProfile = createThicknessProfile(0, isRapidFire ? 4.5 : 3.5, 1);

        // Layer 1: Aura (replaces filter: blur)
        ctx.save();
        ctx.fillStyle = 'transparent'; // Use transparent fill to only draw the shadow
        ctx.shadowColor = energyColor;
        ctx.shadowBlur = isRapidFire ? 14 : 12;
        ctx.globalAlpha = (isRapidFire ? 0.6 : 0.4) * flickerAlpha;
        drawTaperedPath(ctx, path, auraProfile);
        ctx.restore();

        // Layer 2: Glow (replaces filter: blur)
        ctx.save();
        ctx.fillStyle = 'transparent';
        ctx.shadowColor = energyColor;
        ctx.shadowBlur = isRapidFire ? 7 : 5;
        ctx.globalAlpha = (isRapidFire ? 0.8 : 0.6) * flickerAlpha;
        drawTaperedPath(ctx, path, glowProfile);
        ctx.restore();
        
        // Layer 3: Filament (already used shadowBlur)
        ctx.save();
        ctx.fillStyle = coreColor;
        ctx.shadowColor = energyColor;
        ctx.shadowBlur = isRapidFire ? 12 : 8;
        ctx.globalAlpha = flickerAlpha;
        drawTaperedPath(ctx, path, filamentProfile);
        ctx.restore();
    }
}


function drawGammaShip(ctx: CanvasRenderingContext2D, W: number, H: number, muzzleFlashActive: boolean, state: PlayerDrawState) {
    const { playerVx, activePowerUps, hasPermanentRapidFire } = state;
    const thrustFactor = Math.min(1, Math.abs(playerVx) / C.PLAYER_MAX_SPEED);
    const isRapidFire = !!(activePowerUps.RapidFire || hasPermanentRapidFire);
    
    const { hullOutline } = createGammaPaths(W, H);

    // ✅ OPTIMIZATION: Cache gradient to avoid expensive createLinearGradient() every frame
    const gradientKey = `${W}x${H}`;
    let gradient = gammaGradientCache.get(gradientKey);
    if (!gradient) {
        gradient = ctx.createLinearGradient(-W / 2, -H / 2, W / 2, H / 2);
        gradient.addColorStop(0, '#334155');
        gradient.addColorStop(0.5, '#1e293b');
        gradient.addColorStop(1, '#0f172a');
        gammaGradientCache.set(gradientKey, gradient);
    }
    ctx.fillStyle = gradient;
    ctx.fill(hullOutline);
    
    // --- OPTIMIZATION: Draw conduits to offscreen canvas ---
    if (!gammaConduitCanvas) gammaConduitCanvas = document.createElement('canvas');
    const conduitPadding = 30;
    const requiredW = W + conduitPadding * 2;
    const requiredH = H + conduitPadding * 2;
    if (gammaConduitCanvas.width !== requiredW || gammaConduitCanvas.height !== requiredH) {
        gammaConduitCanvas.width = requiredW;
        gammaConduitCanvas.height = requiredH;
    }
    const conduitCtx = gammaConduitCanvas.getContext('2d')!;
    conduitCtx.clearRect(0, 0, requiredW, requiredH);
    conduitCtx.save();
    conduitCtx.translate(requiredW / 2, requiredH / 2);
    drawGammaConduitsOffscreen(conduitCtx, W, H, state);
    conduitCtx.restore();
    ctx.drawImage(gammaConduitCanvas, -requiredW / 2, -requiredH / 2);

    if (thrustFactor > 0.01) {
        ctx.save();
        const trailLength = H * 1.0 * thrustFactor, trailY = H / 2, trailWidth = W * 0.5;
        const outerGlow = ctx.createLinearGradient(0, trailY, 0, trailY + trailLength);
        const colorRgb = isRapidFire ? '251, 191, 36' : '103, 232, 249';
        
        outerGlow.addColorStop(0, `rgba(${colorRgb}, 0.4)`);
        outerGlow.addColorStop(1, `rgba(${colorRgb}, 0)`);
        ctx.fillStyle = outerGlow;
        ctx.fillRect(-trailWidth * 0.7, trailY, trailWidth * 0.6, trailLength);
        ctx.fillRect(trailWidth * 0.1, trailY, trailWidth * 0.6, trailLength);
        
        const core = ctx.createLinearGradient(0, trailY, 0, trailY + trailLength);
        core.addColorStop(0, '#ffffff'); core.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = core;
        ctx.fillRect(-trailWidth * 0.55, trailY, trailWidth * 0.3, trailLength);
        ctx.fillRect(trailWidth * 0.25, trailY, trailWidth * 0.3, trailLength);
        ctx.restore();
    }
    
    // --- Muzzle Flash ---
    if (muzzleFlashActive) {
        drawMuzzleFlash(ctx, W, H, isRapidFire, 0.15);
    }
}

const legacyDronePathCache = new Map<string, Path2D>();

function getDronePath(W: number, H: number): Path2D {
    const key = `${W}x${H}`;
    if (legacyDronePathCache.has(key)) {
        return legacyDronePathCache.get(key)!;
    }
    const halfW = W / 2, halfH = H / 2;
    const path = new Path2D();
    path.moveTo(0, -halfH); path.lineTo(halfW, -halfH * 0.5);
    path.lineTo(halfW, halfH * 0.5); path.lineTo(0, halfH);
    path.lineTo(-halfW, halfH * 0.5); path.lineTo(-halfW, -halfH * 0.5);
    path.closePath();
    legacyDronePathCache.set(key, path);
    return path;
}

const shieldPathCache = new Map<HeroType, Path2D>();

function getCombinedShieldPath(hero: HeroType, shipW: number, shipH: number, droneW: number, droneH: number): Path2D {
    if (shieldPathCache.has(hero)) {
        return shieldPathCache.get(hero)!;
    }

    const combinedPath = new Path2D();

    let shipPath: Path2D;
    if (hero === 'alpha') {
        shipPath = createAlphaPaths(shipW, shipH).hullOutline;
    } else if (hero === 'beta') {
        shipPath = createBetaPaths(shipW, shipH).hullOutline;
    } else { // Gamma
        shipPath = createGammaPaths(shipW, shipH).hullOutline;
    }
    combinedPath.addPath(shipPath);

    const dronePath = getDronePath(droneW, droneH);
    
    const leftDroneTransform = new DOMMatrix().translateSelf(-C.TRIDENT_DRONE_OFFSET_X, 0);
    combinedPath.addPath(dronePath, leftDroneTransform);

    const rightDroneTransform = new DOMMatrix().translateSelf(C.TRIDENT_DRONE_OFFSET_X, 0);
    combinedPath.addPath(dronePath, rightDroneTransform);

    shieldPathCache.set(hero, combinedPath);
    return combinedPath;
}

/**
 * Pre-renders the glowing shield effect to an offscreen canvas and caches it.
 * This is the core of the performance optimization.
 */
function getShieldImage(hero: HeroType, shipW: number, shipH: number, droneW: number, droneH: number): HTMLCanvasElement {
    if (shieldImageCache.has(hero)) {
        return shieldImageCache.get(hero)!;
    }

    const padding = 60; // Extra space for the glow effect to bleed
    const canvasWidth = C.TRIDENT_DRONE_OFFSET_X * 2 + droneW + padding * 2;
    const canvasHeight = shipH + padding * 2;
    
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = canvasWidth;
    offscreenCanvas.height = canvasHeight;
    const ctx = offscreenCanvas.getContext('2d')!;

    // Center the drawing operations
    ctx.translate(canvasWidth / 2, canvasHeight / 2);

    const shieldPath = getCombinedShieldPath(hero, shipW, shipH, droneW, droneH);
    
    // --- Perform the expensive, multi-layered stroke and shadow operations ONCE ---
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
    ctx.lineWidth = 5;
    ctx.shadowColor = '#0ff';
    ctx.shadowBlur = 40; // The most expensive part
    ctx.stroke(shieldPath);

    ctx.strokeStyle = '#67e8f9';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#67e8f9';
    ctx.shadowBlur = 20; // The second most expensive part
    ctx.stroke(shieldPath);

    // Reset shadows and draw the final sharp line
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#cffafe';
    ctx.lineWidth = 2;
    ctx.stroke(shieldPath);
    
    shieldImageCache.set(hero, offscreenCanvas);
    return offscreenCanvas;
}

function getDroneEyePaths(W: number, H: number): { eyePath: Path2D; corePath: Path2D } {
    const key = `${W}x${H}`;
    const cached = droneEyePathCache.get(key);
    if (cached) return cached;

    const pillWidth = W * 0.25;
    const pillHeight = H * 0.4;
    const radius = pillWidth / 2;
    const straightPartHeight = pillHeight - pillWidth;

    const eyePath = new Path2D();
    eyePath.arc(0, -straightPartHeight / 2, radius, Math.PI, 0);
    eyePath.lineTo(radius, straightPartHeight / 2);
    eyePath.arc(0, straightPartHeight / 2, radius, 0, Math.PI);
    eyePath.lineTo(-radius, -straightPartHeight / 2);
    eyePath.closePath();

    const corePillHeight = pillHeight * 0.8;
    const corePillWidth = pillWidth * 0.3;
    const coreRadius = corePillWidth / 2;
    const coreStraightHeight = corePillHeight - corePillWidth;

    const corePath = new Path2D();
    corePath.arc(0, -coreStraightHeight / 2, coreRadius, Math.PI, 0);
    corePath.lineTo(coreRadius, coreStraightHeight / 2);
    corePath.arc(0, coreStraightHeight / 2, coreRadius, 0, Math.PI);
    corePath.lineTo(-coreRadius, -coreStraightHeight / 2);
    corePath.closePath();

    const paths = { eyePath, corePath };
    droneEyePathCache.set(key, paths);
    return paths;
}

function getDroneMuzzleFlashSprite(
    W: number,
    H: number,
    isRapidFire: boolean
): { canvas: HTMLCanvasElement; offsetX: number; offsetY: number } {
    const key = `${W}x${H}-${isRapidFire ? 1 : 0}`;
    const cached = droneMuzzleFlashCache.get(key);
    if (cached) return cached;

    const halfH = H / 2;
    const fTopY = -halfH - H * 0.05 - H * 0.3;
    const fBottomY = -halfH - H * 0.05;
    const fTopHalfW = W * 0.25 * 0.3;
    const fBottomHalfW = W * 0.25;
    const flashCenterX = 0;
    const flashCenterY = fTopY + (fBottomY - fTopY) * 0.3;
    const glowRadius = Math.max(fBottomHalfW, H * 0.2);
    const shadowPadding = 10;

    const minX = -Math.max(glowRadius, fBottomHalfW) - shadowPadding;
    const maxX = Math.max(glowRadius, fBottomHalfW) + shadowPadding;
    const minY = Math.min(fTopY, flashCenterY - glowRadius) - shadowPadding;
    const maxY = Math.max(fBottomY, flashCenterY + glowRadius) + shadowPadding;

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(maxX - minX));
    canvas.height = Math.max(1, Math.ceil(maxY - minY));
    const spriteCtx = canvas.getContext('2d')!;
    spriteCtx.translate(-minX, -minY);

    const outerGlow = spriteCtx.createRadialGradient(
        flashCenterX,
        flashCenterY,
        0,
        flashCenterX,
        flashCenterY,
        glowRadius
    );
    outerGlow.addColorStop(0, isRapidFire ? 'rgba(249, 115, 22, 0.6)' : 'rgba(254, 240, 138, 0.6)');
    outerGlow.addColorStop(0.5, isRapidFire ? 'rgba(249, 115, 22, 0.3)' : 'rgba(254, 240, 138, 0.3)');
    outerGlow.addColorStop(1, 'rgba(254, 240, 138, 0)');
    spriteCtx.fillStyle = outerGlow;
    spriteCtx.beginPath();
    spriteCtx.arc(flashCenterX, flashCenterY, glowRadius, 0, Math.PI * 2);
    spriteCtx.fill();

    spriteCtx.shadowColor = isRapidFire ? '#f97316' : '#fef08a';
    spriteCtx.shadowBlur = 8;
    spriteCtx.fillStyle = '#ffffff';
    spriteCtx.beginPath();
    spriteCtx.moveTo(-fTopHalfW, fTopY);
    spriteCtx.lineTo(fTopHalfW, fTopY);
    spriteCtx.lineTo(fBottomHalfW, fBottomY);
    spriteCtx.lineTo(-fBottomHalfW, fBottomY);
    spriteCtx.closePath();
    spriteCtx.fill();

    const sprite = { canvas, offsetX: minX, offsetY: minY };
    droneMuzzleFlashCache.set(key, sprite);
    return sprite;
}

function drawDrone(ctx: CanvasRenderingContext2D, W: number, H: number, muzzleFlashActive: boolean, state: PlayerDrawState) {
    const { now, activePowerUps, hasPermanentRapidFire, projectileColor } = state;
    const halfH = H / 2;

    // ✅ ZERO-ALLOCATION: Cache gradient to avoid creating new object every frame
    const gradientKey = `${W}x${H}`;
    let gradient = droneGradientCache.get(gradientKey);
    if (!gradient) {
        gradient = ctx.createLinearGradient(0, -halfH, 0, halfH);
        gradient.addColorStop(0, '#334155');
        gradient.addColorStop(1, '#1e293b');
        droneGradientCache.set(gradientKey, gradient);
    }
    ctx.fillStyle = gradient;
    ctx.fill(getDronePath(W, H));
    
    // ✅ PERFORMANCE: Use pre-calculated projectileColor instead of calling getProjectileColor
    // Default to cyan, but allow overrides for specific power-ups.
    const energyColor = projectileColor === C.PROJECTILE_COLOR_DEFAULT ? '#22d3ee' : projectileColor;
    
    const isRapidFire = activePowerUps.RapidFire || hasPermanentRapidFire;
    const coreColor = isRapidFire ? '#fefce8' : '#ecfeff';

    const eyePulse = 0.7 + Math.sin(now / 200) * 0.3;
    const { eyePath, corePath } = getDroneEyePaths(W, H);

    ctx.save();
    ctx.shadowColor = energyColor;
    ctx.shadowBlur = 12 * eyePulse;
    ctx.fillStyle = energyColor;
    ctx.fill(eyePath);
    
    ctx.globalAlpha = 0.8 * eyePulse;
    ctx.fillStyle = coreColor;
    ctx.shadowBlur = 0;

    ctx.fill(corePath);
    ctx.restore();

    // --- Muzzle Flash ---
    if (muzzleFlashActive) {
        const flashSprite = getDroneMuzzleFlashSprite(W, H, !!isRapidFire);
        ctx.drawImage(flashSprite.canvas, flashSprite.offsetX, flashSprite.offsetY);
    }
}

export interface PlayerPreviewRenderOptions {
    hero: HeroType;
    centerX: number;
    centerY: number;
    maxWidth: number;
    maxHeight: number;
    now?: number;
    animated?: boolean;
}

const previewGeneralUpgrades: GeneralUpgrades = {
    movement_speed_level: 0,
    reload_speed_level: 0,
    ammo_capacity_level: 0,
    trident_shot_level: 0,
    trident_shot_unlocked: false,
    graviton_collector_level: 0,
};

const previewHeroUpgrades: GameState['heroUpgrades'] = {
    alpha_aoe_level: 0,
    beta_homing_level: 0,
    gamma_shield_hp_level: 0,
};

const previewActivePowerUps: GameState['activePowerUps'] = {};
const previewPowerUpInfusions: PowerUpInfusionEffect[] = [];

/**
 * Draws a menu-safe player craft using the same ship and drone renderers as gameplay.
 * Neutral preview state keeps this path independent from the active run and its effects.
 */
export function drawPlayerPreview(ctx: CanvasRenderingContext2D, options: PlayerPreviewRenderOptions) {
    const {
        hero,
        centerX,
        centerY,
        maxWidth,
        maxHeight,
        now = 0,
        animated = false,
    } = options;

    if (maxWidth <= 0 || maxHeight <= 0) return;

    const shipW = C.PLAYER_SPRITE_WIDTH;
    const shipH = C.PLAYER_SPRITE_HEIGHT;
    const droneW = shipW * 0.6;
    const droneH = shipH * 0.6;
    const visualWidth = C.TRIDENT_DRONE_OFFSET_X * 2 + droneW + 20;
    const visualHeight = shipH + 20;
    const scale = Math.min(maxWidth / visualWidth, maxHeight / visualHeight);
    const renderNow = animated ? now : 0;
    const previewState: PlayerDrawState = {
        now: renderNow,
        playerVx: 0,
        hero,
        width: shipW,
        height: shipH,
        lastShotTime: Number.NEGATIVE_INFINITY,
        recoilActive: false,
        lastTridentShotTime: Number.NEGATIVE_INFINITY,
        generalUpgrades: previewGeneralUpgrades,
        powerUpInfusions: previewPowerUpInfusions,
        activePowerUps: previewActivePowerUps,
        shieldBreakingUntil: 0,
        heroUpgrades: previewHeroUpgrades,
        gameStatus: GameStatus.StartScreen,
        hasPermanentRapidFire: false,
        phaseShiftState: {
            isActive: false,
            activeUntil: 0,
            cooldownUntil: 0,
            distanceTraveledAtMaxSpeed: 0,
        },
        activeRareConsumable: null,
        projectileColor: C.PROJECTILE_COLOR_DEFAULT,
    };

    const bobOffset = animated ? Math.sin(renderNow / 650) * 3 : 0;
    const yaw = animated ? Math.sin(renderNow / 900) * 0.025 : 0;

    ctx.save();
    try {
        ctx.translate(centerX, centerY + bobOffset);
        ctx.rotate(yaw);
        ctx.scale(scale, scale);

        ctx.save();
        ctx.translate(-C.TRIDENT_DRONE_OFFSET_X, 0);
        drawDrone(ctx, droneW, droneH, false, previewState);
        ctx.restore();

        ctx.save();
        ctx.translate(C.TRIDENT_DRONE_OFFSET_X, 0);
        drawDrone(ctx, droneW, droneH, false, previewState);
        ctx.restore();

        ctx.save();
        if (hero === 'alpha') {
            drawAlphaShip(ctx, shipW, shipH, false, previewState);
        } else if (hero === 'beta') {
            drawBetaShip(ctx, shipW, shipH, false, previewState);
        } else {
            drawGammaShip(ctx, shipW, shipH, false, previewState);
        }
        ctx.restore();
    } finally {
        ctx.restore();
    }
}

let offscreenCanvas: HTMLCanvasElement | null = null;

export function drawPlayer(ctx: CanvasRenderingContext2D, state: PlayerDrawState) {
    const { now, hero, width: W, height: H, lastShotTime, recoilActive, lastTridentShotTime, powerUpInfusions, activePowerUps, shieldBreakingUntil, phaseShiftState } = state;

    const shieldState = activePowerUps.Shield;
    const isShieldActive = shieldState && shieldBreakingUntil <= now;
    const isPhased = phaseShiftState.isActive;
    const droneW = W * 0.6, droneH = H * 0.6;

    // --- 1. Draw Shield (if active) ---
    if (isShieldActive) {
        ctx.save();
        
        const formTime = now - (shieldState.createdAt || now);
        const formProgress = Math.min(1, formTime / 400);
        const formEase = easeOutQuint(formProgress);
        
        const scale = 0.5 + 0.5 * formEase;
        ctx.globalAlpha = formEase;
        ctx.scale(scale, scale);
        
        const idlePulse = 1 + Math.sin(now / 500) * 0.02;
        ctx.scale(idlePulse, idlePulse);

        // --- OPTIMIZATION: Draw the pre-baked shield image ---
        const shieldImage = getShieldImage(hero, W, H, droneW, droneH);
        ctx.drawImage(shieldImage, -shieldImage.width / 2, -shieldImage.height / 2);
        
        const hitTime = now - (shieldState.lastHitTime || -Infinity);
        if (hitTime < 150) {
            // OPTIMIZATION: Use a composite operation for a fast hit flash
            ctx.globalAlpha = formEase * (1 - (hitTime / 150));
            ctx.globalCompositeOperation = 'lighter';
            ctx.filter = 'brightness(2.5)';
            ctx.drawImage(shieldImage, -shieldImage.width / 2, -shieldImage.height / 2);
            // Reset for subsequent drawing
            ctx.globalCompositeOperation = 'source-over';
            ctx.filter = 'none';
        }
        
        if (hero === 'gamma' && shieldState.hp && state.heroUpgrades.gamma_shield_hp_level > 0) {
            const maxHp = C.HANGAR_GAMMA_UPGRADE_CONFIG[state.heroUpgrades.gamma_shield_hp_level - 1].effect;
            if (maxHp > 1) {
                const radius = C.TRIDENT_DRONE_OFFSET_X + (droneW / 2) + 5;
                const strokeWidth = 8;
                let progress = (shieldState.hp ?? maxHp) / maxHp;

                if (shieldState.lastRefillTime && shieldState.hpBeforeRefill !== undefined) {
                    const refillAnimDuration = 500;
                    const timeSinceRefill = now - shieldState.lastRefillTime;
                    if (timeSinceRefill < refillAnimDuration) {
                        const animProgress = timeSinceRefill / refillAnimDuration;
                        const easedProgress = easeOutCubic(animProgress);
                        const startProgress = shieldState.hpBeforeRefill / maxHp;
                        const endProgress = 1.0;
                        progress = startProgress + (endProgress - startProgress) * easedProgress;
                    }
                }
                
                ctx.save();
                ctx.globalAlpha = formEase;
                
                // --- Draw the full background ring (pre-rendered, always visible) ---
                const hpBarImage = getShieldHpBarImage(radius, strokeWidth);
                ctx.drawImage(hpBarImage, -hpBarImage.width / 2, -hpBarImage.height / 2);
                
                // --- Draw the bright progress arc on top (dynamically based on HP) ---
                if (progress > 0) {
                    ctx.save();
                    ctx.strokeStyle = '#cffafe';
                    ctx.lineWidth = strokeWidth;
                    ctx.lineCap = 'round';
                    ctx.shadowColor = '#0ff';
                    ctx.shadowBlur = 20;
                    
                    // Start from top (-Math.PI / 2) and draw clockwise
                    const startAngle = -Math.PI / 2; // Top of circle
                    const endAngle = startAngle + (progress * 2 * Math.PI);
                    
                    ctx.beginPath();
                    ctx.arc(0, 0, radius, startAngle, endAngle);
                    ctx.stroke();
                    
                    ctx.restore();
                }
                
                ctx.restore();
            }
        }
        ctx.restore();
    }
    
    // --- 2. Draw Ship and Drones ---
    const glowPadding = 80;
    const requiredWidth = (C.TRIDENT_DRONE_OFFSET_X * 2) + droneW + glowPadding;
    const requiredHeight = H + glowPadding;
    if (!offscreenCanvas || offscreenCanvas.width !== requiredWidth || offscreenCanvas.height !== requiredHeight) {
        offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = requiredWidth;
        offscreenCanvas.height = requiredHeight;
    }
    const offscreenCtx = offscreenCanvas.getContext('2d');
    if (!offscreenCtx) return;
    offscreenCtx.clearRect(0, 0, requiredWidth, requiredHeight);
    
    offscreenCtx.save();
    try {
        offscreenCtx.translate(requiredWidth / 2, requiredHeight / 2);

        if (isPhased) {
            const phasePulse = 0.7 + Math.sin(now / 80) * 0.3;
            offscreenCtx.globalAlpha = 0.4 * phasePulse;
            offscreenCtx.shadowColor = '#67e8f9';
            offscreenCtx.shadowBlur = 25 * phasePulse;
        }

        const tridentMuzzleFlashActive = now - lastTridentShotTime < 50;
        const muzzleFlashActive = now - lastShotTime < 50;

        // Draw Drones
        offscreenCtx.save();
        offscreenCtx.translate(-C.TRIDENT_DRONE_OFFSET_X, 0);
        drawDrone(offscreenCtx, droneW, droneH, tridentMuzzleFlashActive, state);
        offscreenCtx.restore();
        offscreenCtx.save();
        offscreenCtx.translate(C.TRIDENT_DRONE_OFFSET_X, 0);
        drawDrone(offscreenCtx, droneW, droneH, tridentMuzzleFlashActive, state);
        offscreenCtx.restore();

        // Draw Main Ship
        offscreenCtx.save();
        offscreenCtx.translate(0, recoilActive ? 3 : 0);
        if (hero === 'alpha') {
            drawAlphaShip(offscreenCtx, W, H, muzzleFlashActive, state);
        } else if (hero === 'beta') {
            drawBetaShip(offscreenCtx, W, H, muzzleFlashActive, state);
        } else { // Gamma
            drawGammaShip(offscreenCtx, W, H, muzzleFlashActive, state);
        }
        offscreenCtx.restore();
        
        if (isPhased) {
            offscreenCtx.globalAlpha = 1.0;
            offscreenCtx.shadowColor = 'transparent';
            offscreenCtx.shadowBlur = 0;
        }
    } finally {
        offscreenCtx.restore();
    }

    // ✅ MOBILE OPTIMIZATION: Batch context state changes - single save/restore
    ctx.save();
    if (!isShieldActive && !isPhased) {
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 40;
        ctx.drawImage(offscreenCanvas, -requiredWidth / 2, -requiredHeight / 2);
        // Change shadowBlur without restore - both use same shadowColor
        ctx.shadowBlur = 20;
        ctx.drawImage(offscreenCanvas, -requiredWidth / 2, -requiredHeight / 2);
    }
    // Reset shadow state for final draw
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.drawImage(offscreenCanvas, -requiredWidth / 2, -requiredHeight / 2);
    ctx.restore();

    // --- 3. Draw Infusion Effects ---
    // ✅ ZERO-ALLOCATION: Manual loop instead of forEach to eliminate function closure overhead
    for (let i = 0; i < powerUpInfusions.length; i++) {
        const infusion = powerUpInfusions[i];
        const elapsed = now - infusion.createdAt, progress = Math.min(1, elapsed / C.POWERUP_INFUSION_DURATION);
        if (progress >= 1) continue;
        const color = powerUpColorMap[infusion.powerUpType], opacity = 0.9 * (1 - progress), yOffset = -H/2 + H*progress*2;
        ctx.globalAlpha = opacity; ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 15;
        ctx.save();
        if (hero === 'alpha') {
            ctx.clip(createAlphaPaths(W, H).hullOutline);
        } else if (hero === 'beta') {
            ctx.clip(createBetaPaths(W, H).hullOutline);
        } else { // Gamma
            ctx.clip(createGammaPaths(W, H).hullOutline);
        }
        ctx.fillRect(-W/2, yOffset-5, W, 10);
        ctx.restore();
    }
    ctx.globalAlpha = 1.0; ctx.shadowBlur = 0;
    
    // --- 4. Draw Shield Shatter ---
    if (shatterParticleCache.size > 0) {
        for (const key of shatterParticleCache.keys()) {
            if (key < now) {
                shatterParticleCache.delete(key);
            }
        }
    }

    if (shieldBreakingUntil > now) {
        const shieldWidth = W * 1.8;
        const shieldHeight = H * 1.5;

        if (!shatterParticleCache.has(shieldBreakingUntil)) {
            const particles = Array.from({ length: 40 }, () => {
                const angle = Math.random() * 2 * Math.PI;
                const originX = Math.cos(angle) * shieldWidth / 2;
                const originY = Math.sin(angle) * shieldHeight / 2;
                
                return {
                    size: Math.random() * 15 + 5,
                    tx: originX * (Math.random() * 1.5 + 1.5),
                    ty: originY * (Math.random() * 1.5 + 1.5),
                    rStart: Math.random() * 360,
                    rEnd: Math.random() * 720 - 360,
                    delay: Math.random() * 100,
                };
            });
            shatterParticleCache.set(shieldBreakingUntil, particles);
        }
        const particles = shatterParticleCache.get(shieldBreakingUntil)!;
        const animationStartTime = shieldBreakingUntil - 500;
        
        // ✅ ZERO-ALLOCATION: Manual loop instead of forEach to eliminate function closure overhead
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            const elapsed = now - (animationStartTime + p.delay);
            if (elapsed < 0 || elapsed > 500) continue;
            
            const progress = elapsed / 500;
            const easedProgress = easeOutQuint(progress);
            
            const currentX = p.tx * easedProgress;
            const currentY = p.ty * easedProgress;
            const currentRot = (p.rStart + (p.rEnd - p.rStart) * easedProgress) * Math.PI / 180;
            const currentScale = 1 - easedProgress;
            const opacity = 0.9 * (1 - progress);
            
            ctx.save();
            ctx.translate(currentX, currentY);
            ctx.rotate(currentRot);
            ctx.scale(currentScale, currentScale);
            ctx.globalAlpha = opacity;
            ctx.fillStyle = '#67e8f9';
            ctx.shadowColor = '#0ff';
            ctx.shadowBlur = 10;
            
            const s = p.size / 2;
            ctx.beginPath();
            ctx.moveTo(0, -s);
            ctx.lineTo(s, 0);
            ctx.lineTo(0, s);
            ctx.lineTo(-s, 0);
            ctx.closePath();
            ctx.fill();
            
            ctx.restore();
        }
    }

    // --- 5. Draw Phase Shift UI ---
    if (state.hero === 'beta' && state.heroUpgrades.beta_homing_level >= 3) {
        const { isActive, activeUntil, cooldownUntil, distanceTraveledAtMaxSpeed } = state.phaseShiftState;
        
        const BAR_WIDTH = 60;
        const BAR_HEIGHT = 6;
        const BAR_Y_OFFSET = H * 1.0;

        ctx.save();
        ctx.translate(0, BAR_Y_OFFSET);

        ctx.fillStyle = '#334155';
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1;
        ctx.beginPath();
        // @ts-ignore
        ctx.roundRect(-BAR_WIDTH / 2, -BAR_HEIGHT / 2, BAR_WIDTH, BAR_HEIGHT, BAR_HEIGHT / 2);
        ctx.fill();
        ctx.stroke();

        let progress = 0;
        let fillColor = '#3b82f6';

        if (isActive) {
            progress = Math.max(0, (activeUntil - now) / C.BETA_L3_PHASE_SHIFT_DURATION);
            fillColor = '#22d3ee';
            
            const pulse = 0.8 + Math.sin(now / 150) * 0.2;
            ctx.shadowColor = fillColor;
            ctx.shadowBlur = 15 * pulse;
        } else if (now < cooldownUntil) {
            const cooldownDuration = C.BETA_L3_PHASE_SHIFT_COOLDOWN;
            const timeElapsed = now - (cooldownUntil - cooldownDuration);
            progress = Math.min(1, timeElapsed / cooldownDuration);
            fillColor = '#64748b';
        } else {
            progress = Math.min(1, distanceTraveledAtMaxSpeed / C.BETA_L3_PHASE_SHIFT_DISTANCE_THRESHOLD);
            fillColor = '#3b82f6';
        }

        if (progress > 0) {
            ctx.fillStyle = fillColor;
            ctx.beginPath();
            // @ts-ignore
            ctx.roundRect(
                -BAR_WIDTH / 2 + 1,
                -BAR_HEIGHT / 2 + 1,
                (BAR_WIDTH - 2) * progress,
                BAR_HEIGHT - 2,
                (BAR_HEIGHT - 2) / 2
            );
            ctx.fill();
        }
        
        ctx.restore();
    }
}

export function warmUpPlayerCache() {
    const heroes: HeroType[] = ['alpha', 'beta', 'gamma'];
    // Mock dimensions based on constants
    const shipW = C.PLAYER_SPRITE_WIDTH;
    const shipH = C.PLAYER_SPRITE_HEIGHT;
    const droneW = shipW * 0.6;
    const droneH = shipH * 0.6;

    // Warm up shield images
    // ✅ ZERO-ALLOCATION: Manual loop instead of forEach to eliminate function closure overhead
    for (let i = 0; i < heroes.length; i++) {
        getShieldImage(heroes[i], shipW, shipH, droneW, droneH);
    }

    // Warm up path caches
    createAlphaPaths(shipW, shipH);
    createBetaPaths(shipW, shipH);
    createGammaPaths(shipW, shipH);
    getDroneEyePaths(droneW, droneH);
    getDroneMuzzleFlashSprite(droneW, droneH, false);
    getDroneMuzzleFlashSprite(droneW, droneH, true);

    // Warm up HP bar cache (common radius/stroke combo)
    const radius = C.TRIDENT_DRONE_OFFSET_X + (droneW / 2) + 5;
    getShieldHpBarImage(radius, 8);
}
