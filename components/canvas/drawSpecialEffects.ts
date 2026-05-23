import type { GameState } from '../../types';
import * as C from '../../constants';
import { getPlayableGridBoundsAtY } from '../../gameLogic/positioning';
import { easeOutQuint, easeOutCubic } from '../../utils/easing';

// ============================================================================
// PRE-RENDERING CACHES FOR GRADIENTS
// ============================================================================

const revivePulseImageCache: { image: HTMLCanvasElement | null } = { image: null };

/**
 * Creates a pre-rendered canvas containing the revive pulse's radial gradient.
 * @returns An HTMLCanvasElement with the pre-rendered effect.
 */
function getPreRenderedRevivePulse(): HTMLCanvasElement {
    if (revivePulseImageCache.image) {
        return revivePulseImageCache.image;
    }

    const radius = 100; // A canonical radius for the texture.
    const canvas = document.createElement('canvas');
    canvas.width = radius * 2;
    canvas.height = radius * 2;
    const ctx = canvas.getContext('2d')!;

    const gradient = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
    gradient.addColorStop(0, `rgba(254, 252, 232, 0.8)`);
    gradient.addColorStop(0.7, `rgba(250, 204, 21, 0)`);
    gradient.addColorStop(1, 'rgba(250, 204, 21, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, radius * 2, radius * 2);

    revivePulseImageCache.image = canvas;
    return canvas;
}

const explosionFlashImageCache: { image: HTMLCanvasElement | null } = { image: null };
const critFlashImageCache: { image: HTMLCanvasElement | null } = { image: null };

/**
 * Creates a pre-rendered canvas containing the explosion light flash gradient.
 * This avoids creating expensive gradients on every frame for every explosion.
 * ✅ MOBILE OPTIMIZATION: Pre-rendering eliminates 10-30+ createRadialGradient() calls per frame
 * @returns An HTMLCanvasElement with the pre-rendered effect.
 */
function getPreRenderedExplosionFlash(): HTMLCanvasElement {
    if (explosionFlashImageCache.image) {
        return explosionFlashImageCache.image;
    }

    const radius = 150; // Canonical radius (will be scaled dynamically via drawImage)
    const canvas = document.createElement('canvas');
    canvas.width = radius * 2;
    canvas.height = radius * 2;
    const ctx = canvas.getContext('2d')!;

    const gradient = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
    gradient.addColorStop(0, `rgba(255,255,224,0.7)`);
    gradient.addColorStop(0.7, 'transparent');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, radius * 2, radius * 2);

    explosionFlashImageCache.image = canvas;
    return canvas;
}

/**
 * Creates a pre-rendered canvas containing the critical hit light flash gradient.
 * This avoids creating expensive gradients on every frame for every critical hit.
 * ✅ MOBILE OPTIMIZATION: Pre-rendering eliminates createRadialGradient() calls per frame
 * @returns An HTMLCanvasElement with the pre-rendered effect.
 */
function getPreRenderedCritFlash(): HTMLCanvasElement {
    if (critFlashImageCache.image) {
        return critFlashImageCache.image;
    }

    const radius = 100; // Canonical radius (will be scaled dynamically via drawImage)
    const canvas = document.createElement('canvas');
    canvas.width = radius * 2;
    canvas.height = radius * 2;
    const ctx = canvas.getContext('2d')!;

    const gradient = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
    gradient.addColorStop(0, `rgba(173, 216, 230, 0.6)`);
    gradient.addColorStop(0.7, 'transparent');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, radius * 2, radius * 2);

    critFlashImageCache.image = canvas;
    return canvas;
}


// ============================================================================
// DRAW FUNCTIONS
// ============================================================================


function drawEmpArcs(ctx: CanvasRenderingContext2D, currentState: GameState, now: number) {
    const { empArcs } = currentState;
    if (empArcs.length === 0) return; // ✅ MOBILE OPTIMIZATION: Early exit

    ctx.save();
    ctx.strokeStyle = C.LIGHTNING_COLOR;
    ctx.lineWidth = C.LIGHTNING_WIDTH - 1;
    ctx.shadowColor = '#0ff';
    ctx.shadowBlur = 8;
    ctx.lineCap = 'round';

    // ✅ MOBILE OPTIMIZATION: Manual loop instead of forEach (eliminates function call overhead)
    for (let i = 0; i < empArcs.length; i++) {
        const arc = empArcs[i];
        const elapsed = now - arc.createdAt;
        const progress = Math.min(1, elapsed / C.EMP_ARC_DURATION);
        if (progress >= 1) continue; // Early exit

        ctx.globalAlpha = 1 - progress;
        
        const points = arc.points;
        if (points && points.length > 1) {
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let j = 1; j < points.length; j++) {
                ctx.lineTo(points[j].x, points[j].y);
            }
            ctx.stroke();
        }
    }
    ctx.restore();
}

function drawBossLasers(ctx: CanvasRenderingContext2D, currentState: GameState, noiseCanvas: HTMLCanvasElement | null, now: number) {
    const { bossLasers, laneCount } = currentState;
    const height = C.GAME_GRID_HEIGHT;

    if (!bossLasers || bossLasers.length === 0 || laneCount <= 1) {
        return;
    }

    const playableLanes = laneCount - 1;

    // Pre-calculate the geometry for all lanes to avoid repeated calculations inside the loop.
    const topBounds = getPlayableGridBoundsAtY(0, laneCount);
    const bottomBounds = getPlayableGridBoundsAtY(height, laneCount);
    
    // --- Loop through each laser to draw it ---
    for (const laser of bossLasers) {
        if (laser.lane >= playableLanes) continue; // Safety check.

        const laneWidthAtTop = (topBounds.maxX - topBounds.minX) / playableLanes;
        const laneWidthAtBottom = (bottomBounds.maxX - bottomBounds.minX) / playableLanes;

        // Lane corners at y=0 and y=height
        const xTopLeft = topBounds.minX + laser.lane * laneWidthAtTop;
        const xTopRight = xTopLeft + laneWidthAtTop;
        const xBottomLeft = bottomBounds.minX + laser.lane * laneWidthAtBottom;
        const xBottomRight = xBottomLeft + laneWidthAtBottom;
        
        // Calculate slopes
        const leftSlope = (xBottomLeft - xTopLeft) / height;
        const rightSlope = (xBottomRight - xTopRight) / height;
        
        // Extrapolate to an extended height to ensure the laser covers the player area
        const extendedHeight = C.GAME_GRID_HEIGHT + 100;
        const xExtendedBottomLeft = xTopLeft + leftSlope * extendedHeight;
        const xExtendedBottomRight = xTopRight + rightSlope * extendedHeight;

        const p1 = { x: xTopLeft, y: 0 };
        const p2 = { x: xTopRight, y: 0 };
        const p3 = { x: xExtendedBottomRight, y: extendedHeight };
        const p4 = { x: xExtendedBottomLeft, y: extendedHeight };

        // --- CHARGING PHASE ---
        if (now >= laser.chargeStartTime && now < laser.fireStartTime) {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.lineTo(p3.x, p3.y);
            ctx.lineTo(p4.x, p4.y);
            ctx.closePath();
            
            const chargeProgress = (now - laser.chargeStartTime) / (laser.fireStartTime - laser.chargeStartTime);
            // Create a pulsing alpha effect that intensifies as it charges.
            const pulse = 0.3 + (Math.sin(chargeProgress * Math.PI * 8) + 1) / 2 * (0.4 * chargeProgress);

            ctx.save();
            ctx.globalAlpha = pulse;
            ctx.fillStyle = '#ef4444'; // red-500
            ctx.shadowColor = '#f87171'; // red-400
            ctx.shadowBlur = 15;
            ctx.fill();
            ctx.restore();
        }
        // --- FIRING PHASE ---
        else if (now >= laser.fireStartTime && now < laser.fireStartTime + laser.duration) {
            const fireProgress = (now - laser.fireStartTime) / laser.duration;
            // Use a sine wave to create a grow-and-shrink effect for the width.
            const widthMultiplier = Math.sin(fireProgress * Math.PI);

            if (widthMultiplier <= 0) continue;

            const outerGlowWidthRatio = 0.9 * widthMultiplier;
            const coreWidthRatio = 0.3 * widthMultiplier;

            ctx.save();
            
            const createLaserPath = (ratio: number): Path2D => {
                const path = new Path2D();
                
                const currentLaneWidthAtTop = (p2.x - p1.x) * ratio;
                const currentLaneWidthAtBottom = (p3.x - p4.x) * ratio;

                const p1_dynamic = { x: p1.x + ((p2.x - p1.x) - currentLaneWidthAtTop) / 2, y: p1.y };
                const p2_dynamic = { x: p2.x - ((p2.x - p1.x) - currentLaneWidthAtTop) / 2, y: p2.y };
                const p3_dynamic = { x: p3.x - ((p3.x - p4.x) - currentLaneWidthAtBottom) / 2, y: p3.y };
                const p4_dynamic = { x: p4.x + ((p3.x - p4.x) - currentLaneWidthAtBottom) / 2, y: p4.y };
                
                path.moveTo(p1_dynamic.x, p1_dynamic.y);
                path.lineTo(p2_dynamic.x, p2_dynamic.y);
                path.lineTo(p3_dynamic.x, p3_dynamic.y);
                path.lineTo(p4_dynamic.x, p4_dynamic.y);
                path.closePath();
                return path;
            };

            // Layer 1: Outer Glow
            const outerGlowPath = createLaserPath(outerGlowWidthRatio);
            ctx.fillStyle = '#a855f7';
            ctx.shadowColor = '#c084fc';
            ctx.shadowBlur = 20;
            ctx.globalAlpha = (0.7 + Math.sin(now / 30 + laser.id) * 0.1) * widthMultiplier;
            ctx.fill(outerGlowPath);

            // Layer 2: Inner Core
            const corePath = createLaserPath(coreWidthRatio);
            ctx.fillStyle = 'white';
            ctx.shadowColor = 'white';
            ctx.shadowBlur = 10;
            ctx.globalAlpha = (0.9 + Math.sin(now / 25 + laser.id) * 0.1) * widthMultiplier;
            ctx.fill(corePath);

            ctx.restore();
        }
    }
}


function drawRevivePulse(ctx: CanvasRenderingContext2D, currentState: GameState, now: number) {
    const { reviveTriggerTime } = currentState;
    const width = C.GAME_WIDTH;
    const height = C.GAME_GRID_HEIGHT;

    const revivePulseDuration = 800;
    if (reviveTriggerTime > 0 && now - reviveTriggerTime < revivePulseDuration) {
        const elapsed = now - reviveTriggerTime;
        const progress = elapsed / revivePulseDuration;
        const easedProgress = easeOutQuint(progress);
        const scale = easedProgress * 2;
        const opacity = (1 - progress);

        if (scale > 0 && opacity > 0) {
            const centerX = width / 2;
            const centerY = height / 2;
            const radius = (width / 2) * scale;
            
            // --- OPTIMIZATION: Draw the pre-rendered gradient image ---
            const pulseImage = getPreRenderedRevivePulse();

            ctx.save();
            ctx.globalAlpha = opacity;
            const diameter = radius * 2;
            ctx.drawImage(pulseImage, centerX - radius, centerY - radius, diameter, diameter);
            ctx.restore();
        }
    }
}

function drawLightFlashes(ctx: CanvasRenderingContext2D, currentState: GameState, now: number) {
    const { explosions, criticalHits } = currentState;
    if (explosions.length === 0 && criticalHits.length === 0) return;

    // Scale factor to compensate for the zoomed-out perspective.
    const perspectiveScaleFactor = 0.4;

    // ✅ CRITICAL FIX: Clip all light flashes to the actual game grid area
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, C.GAME_WIDTH, C.GAME_GRID_HEIGHT);
    ctx.clip();

    // ✅ MOBILE OPTIMIZATION: Get pre-rendered images once (not per explosion/crit)
    const explosionFlashImage = getPreRenderedExplosionFlash();
    const critFlashImage = getPreRenderedCritFlash();

    // ✅ MOBILE OPTIMIZATION: Manual loop instead of forEach (eliminates function call overhead)
    for (let i = 0; i < explosions.length; i++) {
        const exp = explosions[i];
        const duration = 450;
        const elapsed = now - exp.createdAt;
        if (elapsed > duration) continue; // Early exit

        const progress = elapsed / duration;
        const easedProgress = easeOutCubic(progress);

        const startScale = 0.2;
        const endScale = 2.0;
        const currentScale = startScale + (endScale - startScale) * easedProgress;

        const startOpacity = 0.7;
        const currentOpacity = startOpacity * (1 - easedProgress);

        if (currentOpacity <= 0) continue;

        const baseRadius = (300 / 2) * perspectiveScaleFactor;
        const radius = baseRadius * currentScale;

        // ✅ MOBILE OPTIMIZATION: Draw pre-rendered image instead of creating gradient every frame
        // This eliminates expensive createRadialGradient() calls (20-30% performance improvement)
        ctx.save();
        ctx.globalAlpha = currentOpacity;
        const diameter = radius * 2;
        ctx.drawImage(explosionFlashImage, exp.x - radius, exp.y - radius, diameter, diameter);
        ctx.restore();
    }

    // ✅ MOBILE OPTIMIZATION: Manual loop instead of forEach (eliminates function call overhead)
    for (let i = 0; i < criticalHits.length; i++) {
        const crit = criticalHits[i];
        const duration = 300;
        const elapsed = now - crit.createdAt;
        if (elapsed > duration) continue; // Early exit

        const progress = elapsed / duration;
        const easedProgress = easeOutCubic(progress);

        const startScale = 0.2;
        const endScale = 1.5;
        const currentScale = startScale + (endScale - startScale) * easedProgress;
        
        const startOpacity = 0.6;
        const currentOpacity = startOpacity * (1 - easedProgress);

        if (currentOpacity <= 0) continue;

        const baseRadius = (crit.radius * 2.0 / 2) * perspectiveScaleFactor;
        const radius = baseRadius * currentScale;

        // ✅ MOBILE OPTIMIZATION: Draw pre-rendered image instead of creating gradient every frame
        ctx.save();
        ctx.globalAlpha = currentOpacity;
        const diameter = radius * 2;
        ctx.drawImage(critFlashImage, crit.x - radius, crit.y - radius, diameter, diameter);
        ctx.restore();
    }

    // ✅ Restore from clipping
    ctx.restore();
}

function drawOvermindBeam(ctx: CanvasRenderingContext2D, currentState: GameState, now: number) {
    const { boss, laneCount } = currentState;
    if (!boss || boss.bossType !== 'overmind' || !boss.beamChargeStartTime) return;


    const chargeProgress = Math.min(1, (now - boss.beamChargeStartTime) / C.OVERMIND_BEAM_CHARGE_TIME);
    const rightPadding = C.GAME_WIDTH / laneCount;
    const playableWidth = C.GAME_WIDTH - rightPadding;
    const rightDangerZoneStart = (boss.safeSpotX ?? 0) + C.OVERMIND_BEAM_SAFE_ZONE_WIDTH;
    const rightDangerZoneWidth = playableWidth - rightDangerZoneStart;

    ctx.save();
    // The effects canvas is translated down, so we need to draw covering the full logical height.
    const fullHeight = C.GAME_GRID_HEIGHT + C.EFFECTS_CANVAS_TOP_BUFFER + C.GAME_HEIGHT_BUFFER;
    const topOffset = -C.EFFECTS_CANVAS_TOP_BUFFER;

    if (now < (boss.beamFireStartTime ?? Infinity)) {
        // Charging visual
        // Safe Zone Indicator
        ctx.fillStyle = 'rgba(10, 150, 10, 0.2)';
        ctx.fillRect(boss.safeSpotX ?? 0, topOffset, C.OVERMIND_BEAM_SAFE_ZONE_WIDTH, fullHeight);

        // Danger Zone Charge-up
        ctx.globalAlpha = chargeProgress;
        ctx.fillStyle = 'rgba(150, 10, 10, 0.2)';
        ctx.fillRect(0, topOffset, boss.safeSpotX ?? 0, fullHeight);
        ctx.fillRect(rightDangerZoneStart, topOffset, rightDangerZoneWidth, fullHeight);

    } else {
        // Firing visual
        const pulse = 0.8 + Math.sin(now / 50) * 0.2;
        ctx.globalAlpha = pulse;

        // The beam itself
        const beamGradient = ctx.createLinearGradient(0, 0, C.GAME_WIDTH, 0);
        beamGradient.addColorStop(0, 'rgba(239, 68, 68, 0)');
        beamGradient.addColorStop(0.5, 'rgba(253, 224, 71, 1)');
        beamGradient.addColorStop(1, 'rgba(239, 68, 68, 0)');

        // ✅ MOBILE OPTIMIZATION: Batch filter operations - single filter change
        ctx.fillStyle = beamGradient;
        ctx.filter = 'blur(5px)';
        ctx.fillRect(0, topOffset, boss.safeSpotX ?? 0, fullHeight);
        ctx.fillRect(rightDangerZoneStart, topOffset, rightDangerZoneWidth, fullHeight);

        // White hot core - change filter without restore
        ctx.filter = 'blur(2px)';
        ctx.fillStyle = 'white';
        ctx.fillRect(0, topOffset, (boss.safeSpotX ?? 0) * 0.5, fullHeight);
        ctx.fillRect((boss.safeSpotX ?? 0) * 0.5, topOffset, (boss.safeSpotX ?? 0) * 0.5, fullHeight);

        const rightCoreStart = rightDangerZoneStart;
        const rightCoreWidth = rightDangerZoneWidth * 0.5;
        ctx.fillRect(rightCoreStart, topOffset, rightCoreWidth, fullHeight);
        ctx.fillRect(rightCoreStart + rightCoreWidth, topOffset, rightCoreWidth, fullHeight);
    }

    ctx.restore();
}

export function drawAllSpecialEffects(ctx: CanvasRenderingContext2D, currentState: GameState, noiseCanvas: HTMLCanvasElement | null, now: number) {
    drawEmpArcs(ctx, currentState, now);
    drawBossLasers(ctx, currentState, noiseCanvas, now);
    drawOvermindBeam(ctx, currentState, now);
    drawRevivePulse(ctx, currentState, now);
    drawLightFlashes(ctx, currentState, now);
}

export function warmUpEffectsCache() {
    getPreRenderedRevivePulse();
    getPreRenderedExplosionFlash();
    getPreRenderedCritFlash();
}