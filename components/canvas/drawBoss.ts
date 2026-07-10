import type { Boss, BossType as BT } from '../../types';
import * as C from '../../constants';
import { easeOutQuadAlt } from '../../utils/easing';

const bossRenderCache = new Map<string, HTMLCanvasElement>();
const bossPathCache = new Map<string, Record<string, Path2D>>();
const wardenGlowCache = new Map<string, HTMLCanvasElement>();
// ✅ ZERO-ALLOCATION: Cache static gradients for Warden boss
const wardenHullGradientCache = new Map<boolean, CanvasGradient>();
const wardenCannonGradientCache = new Map<boolean, CanvasGradient>();
// ✅ MOBILE OPTIMIZATION: Cache filter strings to avoid template literal allocations
const blurFilterCache = new Map<string, string>();

function getBlurFilter(amount: number): string {
    const key = `${amount}px`;
    if (!blurFilterCache.has(key)) {
        blurFilterCache.set(key, `blur(${key})`);
    }
    return blurFilterCache.get(key)!;
}

const BOSS_DIMENSIONS: Record<BT, { width: number, height: number, totalWidth: number, totalHeight: number }> = {
    warden: { width: C.WARDEN_WIDTH, height: C.WARDEN_HEIGHT, totalWidth: C.WARDEN_TOTAL_VISUAL_WIDTH, totalHeight: C.WARDEN_HEIGHT },
    punisher: { width: C.PUNISHER_WIDTH, height: C.PUNISHER_HEIGHT, totalWidth: C.PUNISHER_TOTAL_VISUAL_WIDTH, totalHeight: C.PUNISHER_HEIGHT },
    overmind: { width: C.OVERMIND_WIDTH, height: C.OVERMIND_HEIGHT, totalWidth: C.OVERMIND_WIDTH, totalHeight: C.OVERMIND_HEIGHT },
};

const SHADOW_BLUR = 15;
const PADDING = 15;

function getCacheKey(type: BT, isHardMode: boolean): string {
    return `${type}-${isHardMode ? 'hard' : 'normal'}`;
}

function createWardenPaths(): Record<string, Path2D> {
    const W = C.WARDEN_WIDTH;
    const H = C.WARDEN_HEIGHT;
    const halfW = W / 2;
    const halfH = H / 2;

    const mainHull = new Path2D();
    mainHull.moveTo(0, -halfH); // 50% 0%
    mainHull.lineTo(W * 0.3, H * -0.2);
    mainHull.lineTo(halfW, 0); 
    mainHull.lineTo(W * 0.3, H * 0.2);
    mainHull.lineTo(0, halfH);
    mainHull.lineTo(W * -0.3, H * 0.2);
    mainHull.lineTo(-halfW, 0);
    mainHull.lineTo(W * -0.3, H * -0.2);
    mainHull.closePath();

    const cockpit = new Path2D();
    const cockpitW = W * 0.2, cockpitH = H * 0.3;
    // top-[5%] left-[40%] -> centered, top 5%
    cockpit.rect(-cockpitW / 2, -halfH + H * 0.05, cockpitW, cockpitH);

    const cannonLeftPath = new Path2D();
    // top-[30%] left-[-10%] w-[20%] h-[40%]
    const cannonW = W * 0.2, cannonH = H * 0.4;
    const cannonX = -halfW - W * 0.1;
    const cannonY = -halfH + H * 0.3;
    cannonLeftPath.moveTo(cannonX, cannonY);
    cannonLeftPath.lineTo(cannonX + cannonW, cannonY + cannonH * 0.25);
    cannonLeftPath.lineTo(cannonX + cannonW, cannonY + cannonH * 0.75);
    cannonLeftPath.lineTo(cannonX, cannonY + cannonH);
    cannonLeftPath.closePath();
    
    const cannonRightPath = new Path2D();
    const cannonRX = halfW - W*0.1; // Symmetrical to cannonX
    cannonRightPath.moveTo(cannonRX + cannonW, cannonY);
    cannonRightPath.lineTo(cannonRX, cannonY + cannonH * 0.25);
    cannonRightPath.lineTo(cannonRX, cannonY + cannonH * 0.75);
    cannonRightPath.lineTo(cannonRX + cannonW, cannonY + cannonH);
    cannonRightPath.closePath();

    const seams = new Path2D();
    seams.moveTo(0, -halfH * 0.4);
    seams.lineTo(W * 0.2, H * -0.1);
    seams.lineTo(halfW - W * 0.25, 0);
    seams.lineTo(W * 0.2, H * 0.1);
    seams.lineTo(0, halfH * 0.4);
    seams.lineTo(W * -0.2, H * 0.1);
    seams.lineTo(-halfW + W * 0.25, 0);
    seams.lineTo(W * -0.2, H * -0.1);
    seams.closePath();

    return { mainHull, cockpit, cannonLeft: cannonLeftPath, cannonRight: cannonRightPath, seams };
}


function createPunisherPaths(): Record<string, Path2D> {
    const W = C.PUNISHER_WIDTH, H = C.PUNISHER_HEIGHT;
    const halfW = W / 2, halfH = H / 2;

    const mainHull = new Path2D();
    mainHull.moveTo(0, -halfH); // 50% 0
    mainHull.lineTo(halfW, H * -0.15); // 100% 35% -> y: -0.5 + 0.35 = -0.15
    mainHull.lineTo(W * 0.35, halfH); // 85% 100%
    mainHull.lineTo(W * -0.35, halfH); // 15% 100%
    mainHull.lineTo(-halfW, H * -0.15); // 0 35%
    mainHull.closePath();

    const plating = new Path2D();
    const plW = W * 0.9, plH = H * 0.5;
    const plHalfW = plW/2, plHalfH = plH/2;
    const plYOffset = -halfH + H*0.05 + plHalfH;
    plating.moveTo(0, plYOffset - plHalfH); // 50% 0
    plating.lineTo(plHalfW * 0.9, plYOffset - plHalfH + plH * 0.4);
    plating.lineTo(plHalfW * 0.6, plYOffset + plHalfH);
    plating.lineTo(-plHalfW * 0.6, plYOffset + plHalfH);
    plating.lineTo(-plHalfW * 0.9, plYOffset - plHalfH + plH * 0.4);
    plating.closePath();

    const eye = new Path2D();
    const eyeW = W * 0.1, eyeH = H * 0.2;
    eye.rect(-eyeW/2, -halfH + H*0.1, eyeW, eyeH);

    const podW = W * 0.3, podH = H * 0.7;
    const podHalfW = podW / 2, podHalfH = podH / 2;
    const podCenterY = -halfH + H * 0.2 + podHalfH;
    
    const podLeft = new Path2D();
    const podLeftX = -halfW - (W * 0.15);
    podLeft.moveTo(podLeftX + podHalfW, podCenterY - podHalfH);
    podLeft.lineTo(podLeftX + podW, podCenterY - podHalfH + podH * 0.1);
    podLeft.lineTo(podLeftX + podW, podCenterY - podHalfH + podH * 0.9);
    podLeft.lineTo(podLeftX + podHalfW, podCenterY + podHalfH);
    podLeft.lineTo(podLeftX, podCenterY);
    podLeft.closePath();

    const podRight = new Path2D();
    const podRightX = halfW + (W * 0.15);
    podRight.moveTo(podRightX - podHalfW, podCenterY - podHalfH);
    podRight.lineTo(podRightX - podW, podCenterY - podHalfH + podH * 0.1);
    podRight.lineTo(podRightX - podW, podCenterY - podHalfH + podH * 0.9);
    podRight.lineTo(podRightX - podHalfW, podCenterY + podHalfH);
    podRight.lineTo(podRightX, podCenterY);
    podRight.closePath();

    return { mainHull, plating, eye, podLeft, podRight };
}


function getBossPaths(type: BT): Record<string, Path2D> {
    if (bossPathCache.has(type)) {
        return bossPathCache.get(type)!;
    }
    let paths: Record<string, Path2D> = {};
    if (type === 'warden') paths = createWardenPaths();
    if (type === 'punisher') paths = createPunisherPaths();
    bossPathCache.set(type, paths);
    return paths;
}

function getPreRenderedWardenGlow(part: 'seams' | 'cockpit' | 'engine', isHardMode: boolean): HTMLCanvasElement {
    const key = `${part}-${isHardMode ? 'hard' : 'normal'}`;
    if (wardenGlowCache.has(key)) {
        return wardenGlowCache.get(key)!;
    }

    const dims = BOSS_DIMENSIONS.warden;
    const canvas = document.createElement('canvas');
    canvas.width = dims.totalWidth + (SHADOW_BLUR * 4); // Increased padding for glows
    canvas.height = dims.totalHeight + (SHADOW_BLUR * 4);
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    ctx.translate(canvas.width / 2, canvas.height / 2);
    const paths = getBossPaths('warden');

    if (part === 'seams') {
        const bleedColor = isHardMode ? '#f97316' : '#ec4899';
        const bleedShadow = isHardMode ? '#fbbf24' : '#f9a8d4';
        const filamentColor = isHardMode ? '#fef3c7' : '#fff';

        // 1. Soft, wide aura
        ctx.strokeStyle = bleedColor;
        ctx.lineWidth = 10;
        ctx.shadowColor = bleedShadow;
        ctx.shadowBlur = 20;
        ctx.filter = 'blur(5px)';
        ctx.stroke(paths.seams);
        ctx.filter = 'none';

        // 2. Bright, inner filament
        ctx.strokeStyle = filamentColor;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = bleedShadow;
        ctx.shadowBlur = 10;
        ctx.stroke(paths.seams);

    } else if (part === 'cockpit') {
        const cockpitColor = isHardMode ? '#f97316' : '#ec4899';
        const cockpitShadow = isHardMode ? '#f97316' : '#f0f';
        
        ctx.fillStyle = cockpitColor;
        ctx.shadowColor = cockpitShadow;
        ctx.shadowBlur = 15;
        ctx.fill(paths.cockpit);
        
        ctx.fillStyle = isHardMode ? '#fef3c7' : '#fff';
        ctx.globalAlpha = 0.8;
        ctx.shadowBlur = 5;
        ctx.fill(paths.cockpit);

    } else if (part === 'engine') {
        const W = C.WARDEN_WIDTH;
        const H = C.WARDEN_HEIGHT;
        const engineColor = isHardMode ? '#f97316' : '#9333ea';
        
        ctx.fillStyle = engineColor;
        ctx.filter = 'blur(10px)';
        
        const portRadius = W * 0.08;
        const portY = H * 0.35;
        const portXOffset = W * 0.15;
        
        ctx.beginPath();
        ctx.arc(-portXOffset, portY, portRadius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(portXOffset, portY, portRadius, 0, Math.PI * 2);
        ctx.fill();
    }
    
    wardenGlowCache.set(key, canvas);
    return canvas;
}

function drawWardenVisual(ctx: CanvasRenderingContext2D, isHardMode: boolean) {
    const paths = getBossPaths('warden');
    
    ctx.save();
    
    // Main Hull Gradient
    // ✅ ZERO-ALLOCATION: Cache gradient to avoid creating new object every frame
    let hullGradient = wardenHullGradientCache.get(isHardMode);
    if (!hullGradient) {
        hullGradient = ctx.createLinearGradient(0, -C.WARDEN_HEIGHT / 2, 0, C.WARDEN_HEIGHT / 2);
        const color1 = isHardMode ? '#52525b' : '#334155';
        const color2 = isHardMode ? '#27272a' : '#1e293b';
        hullGradient.addColorStop(0, color1);
        hullGradient.addColorStop(1, color2);
        wardenHullGradientCache.set(isHardMode, hullGradient);
    }
    ctx.fillStyle = hullGradient;
    ctx.fill(paths.mainHull);

    // Side Cannons Gradient
    // ✅ ZERO-ALLOCATION: Cache gradient to avoid creating new object every frame
    let cannonGradient = wardenCannonGradientCache.get(isHardMode);
    if (!cannonGradient) {
        cannonGradient = ctx.createLinearGradient(0, -C.WARDEN_HEIGHT/2, 0, C.WARDEN_HEIGHT/2);
        const color1 = isHardMode ? '#3f3f46' : '#475569';
        const color2 = isHardMode ? '#18181b' : '#1e293b';
        cannonGradient.addColorStop(0, color1);
        cannonGradient.addColorStop(1, color2);
        wardenCannonGradientCache.set(isHardMode, cannonGradient);
    }
    ctx.fillStyle = cannonGradient;
    ctx.fill(paths.cannonLeft);
    ctx.fill(paths.cannonRight);
    
    ctx.restore();
}

function drawPunisherVisual(ctx: CanvasRenderingContext2D, isHardMode: boolean) {
    const paths = getBossPaths('punisher');
    
    const hullColor = isHardMode ? '#3f3f46' : '#111827';
    const platingColor = isHardMode ? '#22d3ee' : '#991b1b';
    const eyeColor = isHardMode ? '#67e8f9' : '#ef4444';
    const eyeShadow = isHardMode ? '#0ff' : '#f00';
    const podColor = isHardMode ? '#52525b' : '#374151';

    ctx.save();
    
    ctx.fillStyle = hullColor;
    ctx.fill(paths.mainHull);
    
    ctx.fillStyle = podColor;
    ctx.fill(paths.podLeft);
    ctx.fill(paths.podRight);

    ctx.fillStyle = platingColor;
    ctx.fill(paths.plating);
    
    ctx.fillStyle = eyeColor;
    ctx.shadowColor = eyeShadow;
    ctx.shadowBlur = 15;
    ctx.fill(paths.eye);

    ctx.restore();
}


function getPreRenderedBoss(type: BT, isHardMode: boolean): HTMLCanvasElement {
    const key = getCacheKey(type, isHardMode);
    if (bossRenderCache.has(key)) {
        return bossRenderCache.get(key)!;
    }

    const dims = BOSS_DIMENSIONS[type];
    const canvas = document.createElement('canvas');
    canvas.width = dims.totalWidth + (SHADOW_BLUR * 2) + PADDING;
    canvas.height = dims.totalHeight + (SHADOW_BLUR * 2) + PADDING;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    ctx.translate(canvas.width / 2, canvas.height / 2);
    
    if (type === 'warden') {
        ctx.shadowColor = isHardMode ? '#f97316' : '#f0f';
    } else if (type === 'punisher') {
        ctx.shadowColor = isHardMode ? '#22d3ee' : '#f00';
    }
    ctx.shadowBlur = SHADOW_BLUR;
    

    if (type === 'warden') drawWardenVisual(ctx, isHardMode);
    if (type === 'punisher') drawPunisherVisual(ctx, isHardMode);

    bossRenderCache.set(key, canvas);
    return canvas;
}

function drawOvermindVisual(ctx: CanvasRenderingContext2D, boss: Boss, isHardMode: boolean, now: number) {
    const { phase, isInvulnerable, phaseStartTime } = boss;
    const isFury = phase === 'fury' || phase === 'beam';
    
    const coreColor = isHardMode ? (isFury ? '#fef08a' : '#dc2626') : (isFury ? '#67e8f9' : '#a855f7');
    const coreShadow = isHardMode ? (isFury ? '#fbbf24' : '#ef4444') : (isFury ? '#0ff' : '#a855f7');
    const armorColor1 = isHardMode ? '#111827' : '#334155';
    const armorColor2 = isHardMode ? '#1f2937' : '#475569';
    
    const isDormant = isInvulnerable && phase === 'spawning_fragments';

    ctx.save();
    const pulse = isFury ? 1 + Math.sin(now / 150) * 0.05 : 1;
    const dormantScale = isDormant ? 0.8 : 1;
    ctx.scale(pulse * dormantScale, pulse * dormantScale);
    const coreRadius = C.OVERMIND_WIDTH * 0.25;
    
    ctx.shadowColor = coreShadow;
    ctx.shadowBlur = isFury ? 40 : 20;
    
    const coreGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, coreRadius);
    coreGradient.addColorStop(0, '#ffffff');
    coreGradient.addColorStop(0.5, coreColor);
    coreGradient.addColorStop(1, coreColor);
    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(0, 0, coreRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const phaseTime = now - phaseStartTime;
    const furyProgress = (phase === 'fury' || phase === 'beam') ? Math.min(1, phaseTime / 1000) : 0;
    const armorTranslate = -C.OVERMIND_HEIGHT * 0.8 * furyProgress;
    const armorScale = 1 - 0.5 * furyProgress;
    const armorOpacity = 1 - furyProgress;

    if (armorOpacity <= 0) return;
    
    ctx.save();
    ctx.globalAlpha = armorOpacity;
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 10;
    
    const outerArmorPath = new Path2D();
    const outerW = C.OVERMIND_WIDTH * 0.3, outerH = C.OVERMIND_HEIGHT * 0.6;
    outerArmorPath.moveTo(0, -outerH/2);
    outerArmorPath.lineTo(outerW/2, outerH/2);
    outerArmorPath.lineTo(-outerW/2, outerH/2);
    outerArmorPath.closePath();

    const innerArmorPath = new Path2D();
    const innerW = C.OVERMIND_WIDTH * 0.2, innerH = C.OVERMIND_HEIGHT * 0.4;
    innerArmorPath.moveTo(0, -innerH/2);
    innerArmorPath.lineTo(innerW/2, innerH/2);
    innerArmorPath.lineTo(-innerW/2, innerH/2);
    innerArmorPath.closePath();

    for (let i = 0; i < 4; i++) {
        const rot = i * (Math.PI / 2);
        ctx.save();
        ctx.rotate(rot);
        ctx.translate(0, armorTranslate);
        ctx.scale(armorScale, armorScale);
        ctx.translate(0, -C.OVERMIND_HEIGHT*0.35);
        ctx.fillStyle = armorColor1;
        ctx.fill(outerArmorPath);
        ctx.restore();
    }
    
    for (let i = 0; i < 4; i++) {
        const rot = i * (Math.PI / 2) + Math.PI / 4;
        ctx.save();
        ctx.rotate(rot);
        ctx.translate(0, armorTranslate * 0.8);
        ctx.scale(armorScale, armorScale);
        ctx.translate(0, -C.OVERMIND_HEIGHT*0.2);
        ctx.fillStyle = armorColor2;
        ctx.fill(innerArmorPath);
        ctx.restore();
    }
    ctx.restore();
}

function drawCorrosiveOverlay(ctx: CanvasRenderingContext2D, boss: Boss, now: number) {
    if (!boss.debuffs?.corrosive) return;

    ctx.save();
    const hueShift = Math.sin(now / 200 + boss.id) * 10;
    const baseHue = 81;
    const newHue = baseHue + hueShift;
    const pulse = 0.5 + Math.sin(now / 150 + boss.id) * 0.2;
    
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = pulse;
    ctx.fillStyle = `hsl(${newHue}, 74%, 46%)`;

    if (boss.bossType === 'warden' || boss.bossType === 'punisher') {
        const paths = getBossPaths(boss.bossType);
        // ✅ OPTIMIZATION: Direct iteration instead of Object.values().forEach (eliminates array allocation)
        for (const key in paths) {
            ctx.fill(paths[key]);
        }
    } else if (boss.bossType === 'overmind') {
        ctx.beginPath();
        ctx.arc(0, 0, C.OVERMIND_WIDTH * 0.25, 0, 2 * Math.PI);
        ctx.fill();
    }
    ctx.restore();
}


export function drawBoss(ctx: CanvasRenderingContext2D, boss: Boss, wasHit: boolean, isHardMode: boolean, now: number) {
    ctx.save();

    if (wasHit && !boss.isInvulnerable) {
        ctx.filter = 'brightness(2)';
    }

    if (boss.phase === 'defeated') {
        const phaseTime = now - boss.phaseStartTime;
        const defeatProgress = Math.min(1, phaseTime / C.BOSS_DEFEATED_DURATION);
        ctx.globalAlpha = 1 - defeatProgress;
        const shakeX = (Math.random() - 0.5) * 10 * defeatProgress;
        const shakeY = (Math.random() - 0.5) * 10 * defeatProgress;
        ctx.translate(shakeX, shakeY);
    } else if (boss.phase === 'entering') {
        const phaseTime = now - boss.phaseStartTime;
        ctx.globalAlpha = Math.min(1, phaseTime / C.BOSS_ENTER_DURATION);
    }
    
    if (boss.bossType === 'overmind') {
        drawOvermindVisual(ctx, boss, isHardMode, now);
    } else {
        const preRenderedCanvas = getPreRenderedBoss(boss.bossType, isHardMode);
        ctx.drawImage(preRenderedCanvas, -preRenderedCanvas.width / 2, -preRenderedCanvas.height / 2);
    }
    
    if (boss.bossType === 'warden') {
        const isBarrage = boss.attackPattern === 'barrage';
        const pulseSpeed = isBarrage ? 100 : 400;
        const pulse = 0.6 + (Math.sin(now / pulseSpeed) + 1) / 2 * 0.4;
        const cockpitPulse = 0.7 + (Math.sin(now / (pulseSpeed * 1.5)) + 1) / 2 * 0.3;
        const enginePulse = 0.8 + Math.sin(now / 200) * 0.2;

        const seamGlow = getPreRenderedWardenGlow('seams', isHardMode);
        const cockpitGlow = getPreRenderedWardenGlow('cockpit', isHardMode);
        const engineGlow = getPreRenderedWardenGlow('engine', isHardMode);
        
        // Engine Glow (underneath)
        ctx.save();
        ctx.globalAlpha = enginePulse;
        ctx.drawImage(engineGlow, -engineGlow.width / 2, -engineGlow.height / 2);
        ctx.restore();

        // Seam Glow
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.drawImage(seamGlow, -seamGlow.width / 2, -seamGlow.height / 2);
        ctx.restore();

        // Cockpit Glow
        ctx.save();
        ctx.globalAlpha = cockpitPulse;
        ctx.drawImage(cockpitGlow, -cockpitGlow.width / 2, -cockpitGlow.height / 2);
        ctx.restore();
        
        // Minion Spawning Bays (already performant, no changes needed)
        if (boss.attackPattern === 'spawnMinions') {
            const H = C.WARDEN_HEIGHT;
            const W = C.WARDEN_WIDTH;
            const timeInPattern = now - boss.attackPatternStartTime;
            const openDuration = 500;
            const closeStartTime = C.WARDEN_SPAWN_MINION_DURATION - openDuration;
            
            let openProgress = 0;
            if (timeInPattern < openDuration) openProgress = timeInPattern / openDuration;
            else if (timeInPattern < closeStartTime) openProgress = 1;
            else if (timeInPattern < C.WARDEN_SPAWN_MINION_DURATION) openProgress = 1 - ((timeInPattern - closeStartTime) / openDuration);
            
            const easedProgress = easeOutQuadAlt(openProgress);

            const bayY = H * 0.25, bayXOffset = W * 0.3, bayWidth = 30, bayHeight = 12, doorWidth = bayWidth / 2;

            const drawBay = (xOffset: number) => {
                ctx.save();
                ctx.translate(xOffset, bayY);
                ctx.fillStyle = '#0f172a';
                ctx.fillRect(-bayWidth/2, -bayHeight/2, bayWidth, bayHeight);
                if (easedProgress > 0.1) {
                    const glowRadius = bayWidth * 0.8 * easedProgress;
                    const glowAlpha = 0.6 * easedProgress;
                    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, glowRadius);
                    const glowColor = isHardMode ? '251, 146, 60' : '219, 39, 119';
                    gradient.addColorStop(0, `rgba(${glowColor}, ${glowAlpha})`);
                    gradient.addColorStop(1, `rgba(${glowColor}, 0)`);
                    ctx.fillStyle = gradient;
                    ctx.fillRect(-bayWidth, -bayHeight, bayWidth * 2, bayHeight * 2);
                }
                const doorOffset = doorWidth * easedProgress;
                const doorColor = isHardMode ? '#52525b' : '#334155';
                ctx.fillStyle = doorColor;
                ctx.fillRect(-bayWidth/2 - doorOffset, -bayHeight/2, doorWidth, bayHeight);
                ctx.fillRect(0 + doorOffset, -bayHeight/2, doorWidth, bayHeight);
                ctx.restore();
            };
            drawBay(-bayXOffset);
            drawBay(bayXOffset);
        }
    } else if (boss.bossType === 'punisher') {
        const engineColor = isHardMode ? '#0891b2' : '#dc2626';
        const pulse = 0.5 + Math.sin(now / 250) * 0.5;
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.fillStyle = engineColor;
        // ✅ MOBILE OPTIMIZATION: Use cached filter string
        ctx.filter = getBlurFilter(16);
        const engineY = C.PUNISHER_HEIGHT / 2;
        const engineW = C.PUNISHER_WIDTH * 0.4, engineH = C.PUNISHER_HEIGHT * 0.15;
        ctx.fillRect(-engineW/2, engineY-engineH, engineW, engineH);
        ctx.restore();
    }
    
    drawCorrosiveOverlay(ctx, boss, now);
    
    if (boss.phase === 'defeated') {
        const phaseTime = now - boss.phaseStartTime;
        const pingProgress1 = (phaseTime % 1000) / 1000;
        const pingProgress2 = ((phaseTime + 200) % 1000) / 1000;
        
        ctx.save();
        ctx.globalAlpha = 1 - pingProgress1;
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, (C.OVERMIND_WIDTH / 2) * pingProgress1, 0, 2 * Math.PI);
        ctx.stroke();

        ctx.globalAlpha = 1 - pingProgress2;
        ctx.strokeStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, 0, (C.OVERMIND_WIDTH / 4) * pingProgress2, 0, 2 * Math.PI);
        ctx.stroke();

        ctx.restore();
    }

    ctx.restore();
}
