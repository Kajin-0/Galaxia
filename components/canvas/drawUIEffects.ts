import type { GameState } from '../../types';
import * as C from '../../constants';

const upgradePartSVGPath = 'M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0L8 7.05H4.26c-1.56.38-2.22 2.36-1.05 3.53l2.92 2.92c.38.38.38 1 0 1.4l-2.92 2.92c-1.18 1.18-.52 3.15 1.05 3.53H8l.51 3.88c.38 1.56 2.6 1.56 2.98 0l.51-3.88h3.74c1.56-.38-2.22-2.36 1.05-3.53l-2.92-2.92a.996.996 0 010-1.4l2.92-2.92c-1.18-1.18.52-3.15-1.05-3.53H12l-.51-3.88z';
const upgradePartPath2D = new Path2D(upgradePartSVGPath);

function drawDamageNumbers(ctx: CanvasRenderingContext2D, gameState: GameState, now: number) {
    const { damageNumbers } = gameState;
    if (damageNumbers.length === 0) return;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // ✅ ZERO-ALLOCATION: Single-pass rendering - no temporary arrays or objects
    // Calculate values inline and render immediately, eliminating all intermediate allocations
    
    // Pass 1: Draw normal crits (yellow, non-insight)
    ctx.font = '900 24px "Exo 2", sans-serif';
    ctx.shadowColor = '#ff0';
    ctx.shadowBlur = 5;
    ctx.fillStyle = '#fde047';
    
    for (let i = 0; i < damageNumbers.length; i++) {
        const dn = damageNumbers[i];
        if (!dn.isCrit || dn.isInsightDamage) continue;
        
        const elapsed = now - dn.createdAt;
        const progress = Math.min(1, elapsed / C.DAMAGE_NUMBER_LIFETIME);
        if (progress >= 1) return;

        let yOffset = 0, scale = 1, opacity = 1;
        if (progress < 0.2) {
            const stageProgress = progress / 0.2;
            yOffset = -10 * stageProgress;
            scale = 1 + 0.6 * stageProgress;
        } else {
            const stageProgress = (progress - 0.2) / 0.8;
            yOffset = -10 - 50 * stageProgress;
            scale = 1.6 - 0.4 * stageProgress;
            opacity = 1 - stageProgress;
        }
        
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.translate(dn.x + dn.initialDriftX, dn.y + yOffset);
        ctx.scale(scale, scale);
        ctx.fillText(dn.text, 0, 0);
        ctx.restore();
    }
    
    // Draw shadow for normal crits
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 2;
    for (let i = 0; i < damageNumbers.length; i++) {
        const dn = damageNumbers[i];
        if (!dn.isCrit || dn.isInsightDamage) continue;
        
        const elapsed = now - dn.createdAt;
        const progress = Math.min(1, elapsed / C.DAMAGE_NUMBER_LIFETIME);
        if (progress >= 1) continue;

        let yOffset = 0, scale = 1, opacity = 1;
        if (progress < 0.2) {
            const stageProgress = progress / 0.2;
            yOffset = -10 * stageProgress;
            scale = 1 + 0.6 * stageProgress;
        } else {
            const stageProgress = (progress - 0.2) / 0.8;
            yOffset = -10 - 50 * stageProgress;
            scale = 1.6 - 0.4 * stageProgress;
            opacity = 1 - stageProgress;
        }
        
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.translate(dn.x + dn.initialDriftX, dn.y + yOffset);
        ctx.scale(scale, scale);
        ctx.fillText(dn.text, 0, 0);
        ctx.restore();
    }

    // Pass 2: Draw insight crits (purple)
    ctx.shadowColor = '#c084fc';
    ctx.shadowBlur = 7;
    ctx.fillStyle = '#e9d5ff';
    
    for (let i = 0; i < damageNumbers.length; i++) {
        const dn = damageNumbers[i];
        if (!dn.isCrit || !dn.isInsightDamage) continue;
        
        const elapsed = now - dn.createdAt;
        const progress = Math.min(1, elapsed / C.DAMAGE_NUMBER_LIFETIME);
        if (progress >= 1) continue;

        let yOffset = 0, scale = 1, opacity = 1;
        if (progress < 0.2) {
            const stageProgress = progress / 0.2;
            yOffset = -10 * stageProgress;
            scale = 1 + 0.6 * stageProgress;
        } else {
            const stageProgress = (progress - 0.2) / 0.8;
            yOffset = -10 - 50 * stageProgress;
            scale = 1.6 - 0.4 * stageProgress;
            opacity = 1 - stageProgress;
        }
        
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.translate(dn.x + dn.initialDriftX, dn.y + yOffset);
        ctx.scale(scale, scale);
        ctx.fillText(dn.text, 0, 0);
        ctx.restore();
    }
    
    // Draw shadow for insight crits
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 2;
    for (let i = 0; i < damageNumbers.length; i++) {
        const dn = damageNumbers[i];
        if (!dn.isCrit || !dn.isInsightDamage) continue;
        
        const elapsed = now - dn.createdAt;
        const progress = Math.min(1, elapsed / C.DAMAGE_NUMBER_LIFETIME);
        if (progress >= 1) continue;

        let yOffset = 0, scale = 1, opacity = 1;
        if (progress < 0.2) {
            const stageProgress = progress / 0.2;
            yOffset = -10 * stageProgress;
            scale = 1 + 0.6 * stageProgress;
        } else {
            const stageProgress = (progress - 0.2) / 0.8;
            yOffset = -10 - 50 * stageProgress;
            scale = 1.6 - 0.4 * stageProgress;
            opacity = 1 - stageProgress;
        }
        
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.translate(dn.x + dn.initialDriftX, dn.y + yOffset);
        ctx.scale(scale, scale);
        ctx.fillText(dn.text, 0, 0);
        ctx.restore();
    }

    // Pass 3: Draw normal hits
    ctx.font = 'bold 18px "Exo 2", sans-serif';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 3;
    
    for (let i = 0; i < damageNumbers.length; i++) {
        const dn = damageNumbers[i];
        if (dn.isCrit) continue;
        
        const elapsed = now - dn.createdAt;
        const progress = Math.min(1, elapsed / C.DAMAGE_NUMBER_LIFETIME);
        if (progress >= 1) continue;

        const yOffset = -40 * progress;
        const opacity = 1 - progress;
        
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.translate(dn.x + dn.initialDriftX, dn.y + yOffset);
        if (dn.isInsightDamage) {
            ctx.fillStyle = '#d8b4fe';
        } else {
            ctx.fillStyle = dn.isCorrosive ? '#84cc16' : '#fff';
        }
        ctx.fillText(dn.text, 0, 0);
        ctx.restore();
    }
}

function drawUpgradeParts(ctx: CanvasRenderingContext2D, gameState: GameState, now: number) {
    const { upgradePartCollects } = gameState;

    // ✅ MOBILE OPTIMIZATION: Manual loop instead of forEach (eliminates function call overhead)
    for (let i = 0; i < upgradePartCollects.length; i++) {
        const part = upgradePartCollects[i];
        const elapsed = now - part.createdAt, progress = Math.min(1, elapsed / C.UPGRADE_PART_ANIMATION_DURATION);
        if (progress >= 1) continue;
        const scale = 1 - progress * 0.5, opacity = 1 - progress;
        ctx.save();
        ctx.globalAlpha = opacity; ctx.translate(part.x, part.y);
        ctx.scale(scale, scale); ctx.translate(-10, -10);
        ctx.fillStyle = '#fb923c'; ctx.shadowColor = '#f97316'; ctx.shadowBlur = 5;
        ctx.fill(upgradePartPath2D);
        ctx.restore();
    }
}

// --- NEW: CACHE AND PRE-RENDERING FOR SLOW EFFECT ---
let slowEffectArcSegmentCache: HTMLCanvasElement | null = null;

function getPreRenderedSlowArcSegment(): HTMLCanvasElement {
    if (slowEffectArcSegmentCache) {
        return slowEffectArcSegmentCache;
    }
    const radius = 50;
    const shadow = 5; // Match shadowBlur from original function
    const padding = 5;
    const canvasSize = (radius + shadow + padding) * 2;
    const canvas = document.createElement('canvas');
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext('2d')!;

    ctx.translate(canvasSize / 2, canvasSize / 2);

    // Styles from the original function's loop
    ctx.strokeStyle = '#a78bfa';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#a78bfa';
    ctx.shadowBlur = shadow;
    ctx.setLineDash([20, 30]);

    ctx.beginPath();
    ctx.arc(0, 0, radius, -Math.PI / 2, 0); // The 90-degree arc segment
    ctx.stroke();

    slowEffectArcSegmentCache = canvas;
    return canvas;
}

// --- CONSTANTS ---
const SLOW_EFFECT_PULSE_PERIOD = 1000 / (2 * Math.PI);
const SLOW_EFFECT_ARC_DURATIONS = [1500, 2200, 2900];

// --- REFACTORED DRAW FUNCTION ---
function drawPlayerSlowEffect(ctx: CanvasRenderingContext2D, currentState: GameState, now: number) {
    // ✅ OPTIMIZATION: Use cached isPlayerSlowed from state (includes ion storm check)
    // ✅ BUG FIX: Now correctly shows visual effect during ion storm
    if (!currentState.isPlayerSlowed) return;
    
    const { playerX, playerY } = currentState;

    const effectX = playerX;
    const effectY = playerY + 40;
    const effectRadius = 50;
    
    // ✅ OPTIMIZATION: Calculate Math.sin() only when effect is visible
    const pulseSin = Math.sin(now / SLOW_EFFECT_PULSE_PERIOD);
    const pulseScale = 1.0 + pulseSin * 0.05;
    const pulseOpacity = 0.65 + pulseSin * 0.15;

    // ✅ OPTIMIZATION: Single context save/restore for all operations
    ctx.save();
    ctx.translate(effectX, effectY);

    // --- Draw pulsing outer circle ---
    ctx.save();
    ctx.scale(pulseScale, pulseScale);
    ctx.globalAlpha = pulseOpacity * 0.5;
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, effectRadius, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.restore();

    // ✅ OPTIMIZATION: Pre-calculate rotations and batch arc rendering
    const arcSegment = getPreRenderedSlowArcSegment();
    const arcOffset = -arcSegment.width / 2;
    
    // Pre-calculate all rotations to avoid repeated calculations
    const rotations = [
        (now / SLOW_EFFECT_ARC_DURATIONS[0]) * (2 * Math.PI),
        (now / SLOW_EFFECT_ARC_DURATIONS[1]) * (2 * Math.PI),
        (now / SLOW_EFFECT_ARC_DURATIONS[2]) * (2 * Math.PI)
    ];
    
    // ✅ OPTIMIZATION: Manual loop instead of forEach to avoid function call overhead
    for (let i = 0; i < rotations.length; i++) {
        ctx.save();
        ctx.rotate(rotations[i]);
        ctx.drawImage(arcSegment, arcOffset, arcOffset);
        ctx.restore();
    }
    
    ctx.restore();
}

export function drawAllUIEffects(ctx: CanvasRenderingContext2D, currentState: GameState, now: number) {
    drawDamageNumbers(ctx, currentState, now);
    drawUpgradeParts(ctx, currentState, now);
    drawPlayerSlowEffect(ctx, currentState, now);
}