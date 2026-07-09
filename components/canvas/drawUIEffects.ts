import type { GameState } from '../../types';
import * as C from '../../constants';

const upgradePartSVGPath = 'M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0L8 7.05H4.26c-1.56.38-2.22 2.36-1.05 3.53l2.92 2.92c.38.38.38 1 0 1.4l-2.92 2.92c-1.18 1.18-.52 3.15 1.05 3.53H8l.51 3.88c.38 1.56 2.6 1.56 2.98 0l.51-3.88h3.74c1.56-.38-2.22-2.36 1.05-3.53l-2.92-2.92a.996.996 0 010-1.4l2.92-2.92c-1.18-1.18.52-3.15-1.05-3.53H12l-.51-3.88z';
const upgradePartPath2D = new Path2D(upgradePartSVGPath);

type DamageSpriteVariant = 'crit' | 'insightCrit' | 'hit' | 'insight' | 'corrosive';

interface DamageSprite {
    canvas: HTMLCanvasElement;
    width: number;
    height: number;
}

const damageSpriteCache = new Map<string, DamageSprite>();
const MAX_DAMAGE_SPRITES = 96;
let damageNumberRenderLimit = 24;
let performanceObserverInitialized = false;

function updateDamageNumberLimit() {
    const tier = document.documentElement.dataset.performanceTier;
    damageNumberRenderLimit = tier === '0' ? 12 : tier === '2' ? 36 : 24;
}

function ensurePerformanceObserver() {
    if (performanceObserverInitialized || typeof document === 'undefined') return;
    performanceObserverInitialized = true;
    updateDamageNumberLimit();
    new MutationObserver(updateDamageNumberLimit).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-performance-tier'],
    });
}

function getDamageSprite(text: string, variant: DamageSpriteVariant): DamageSprite {
    const key = `${variant}:${text}`;
    const cached = damageSpriteCache.get(key);
    if (cached) return cached;

    if (damageSpriteCache.size >= MAX_DAMAGE_SPRITES) damageSpriteCache.clear();

    const isCrit = variant === 'crit' || variant === 'insightCrit';
    const fontSize = isCrit ? 24 : 18;
    const font = `${isCrit ? 900 : 700} ${fontSize}px "Exo 2", sans-serif`;
    const color = variant === 'crit'
        ? '#fde047'
        : variant === 'insightCrit' || variant === 'insight'
            ? '#e9d5ff'
            : variant === 'corrosive'
                ? '#a3e635'
                : '#ffffff';
    const glow = variant === 'crit' ? '#facc15' : variant.includes('insight') ? '#c084fc' : '#020617';
    const ratio = 2;
    const measureCanvas = document.createElement('canvas');
    const measureContext = measureCanvas.getContext('2d')!;
    measureContext.font = font;
    const width = Math.ceil(measureContext.measureText(text).width + (isCrit ? 18 : 12));
    const height = fontSize + (isCrit ? 18 : 12);
    const canvas = document.createElement('canvas');
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const spriteContext = canvas.getContext('2d')!;
    spriteContext.scale(ratio, ratio);
    spriteContext.font = font;
    spriteContext.textAlign = 'center';
    spriteContext.textBaseline = 'middle';
    spriteContext.fillStyle = color;
    spriteContext.shadowColor = glow;
    spriteContext.shadowBlur = isCrit ? 7 : 3;
    spriteContext.fillText(text, width / 2, height / 2);
    const sprite = { canvas, width, height };
    damageSpriteCache.set(key, sprite);
    return sprite;
}

function drawDamageNumbers(ctx: CanvasRenderingContext2D, gameState: GameState, now: number) {
    const { damageNumbers } = gameState;
    if (damageNumbers.length === 0) return;
    ensurePerformanceObserver();

    const firstIndex = Math.max(0, damageNumbers.length - damageNumberRenderLimit);
    for (let index = firstIndex; index < damageNumbers.length; index++) {
        const number = damageNumbers[index];
        const progress = Math.min(1, (now - number.createdAt) / C.DAMAGE_NUMBER_LIFETIME);
        if (progress >= 1) continue;

        const variant: DamageSpriteVariant = number.isCrit
            ? number.isInsightDamage ? 'insightCrit' : 'crit'
            : number.isInsightDamage ? 'insight' : number.isCorrosive ? 'corrosive' : 'hit';
        const sprite = getDamageSprite(number.text, variant);
        let scale = 1;
        let yOffset = -40 * progress;
        let opacity = 1 - progress;

        if (number.isCrit) {
            if (progress < 0.2) {
                const stageProgress = progress / 0.2;
                yOffset = -10 * stageProgress;
                scale = 1 + 0.6 * stageProgress;
                opacity = 1;
            } else {
                const stageProgress = (progress - 0.2) / 0.8;
                yOffset = -10 - 50 * stageProgress;
                scale = 1.6 - 0.4 * stageProgress;
                opacity = 1 - stageProgress;
            }
        }

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.translate(number.x + number.initialDriftX, number.y + yOffset);
        ctx.scale(scale, scale);
        ctx.drawImage(sprite.canvas, -sprite.width / 2, -sprite.height / 2, sprite.width, sprite.height);
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
