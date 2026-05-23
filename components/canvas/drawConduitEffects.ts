import type { GameState, Enemy, Asteroid } from '../../types';
import * as C from '../../constants';
import { IS_MOBILE } from '../../constants';

// Module-level state for the desktop beam pattern, encapsulated here.
let beamPatternCanvas: HTMLCanvasElement | null = null;
let cachedBeamPattern: CanvasPattern | null = null;
let lastPatternUpdateTime = 0;
const PATTERN_UPDATE_INTERVAL = 16; // Update pattern every ~16ms (60fps)
const MOBILE_BEAM_OUTER_WIDTH = 6;
const MOBILE_BEAM_INNER_WIDTH = 2.5;
const MIN_VISIBLE_Y = -C.OFFSCREEN_BUFFER;
const MAX_VISIBLE_Y = C.GAME_GRID_HEIGHT + C.OFFSCREEN_BUFFER;

// ✅ MOBILE OPTIMIZATION: Reuse array to avoid filter() allocation every frame (zero-allocation)
let conduitsCache: Enemy[] = [];

function isBeamVisible(startY: number, endY: number): boolean {
    return !(
        (startY < MIN_VISIBLE_Y && endY < MIN_VISIBLE_Y) ||
        (startY > MAX_VISIBLE_Y && endY > MAX_VISIBLE_Y)
    );
}

function getLinkedTarget(linkedEnemyId: number, enemies: Enemy[], asteroids: Asteroid[]): Enemy | Asteroid | null {
    for (let i = 0; i < enemies.length; i++) {
        if (enemies[i].id === linkedEnemyId) {
            return enemies[i];
        }
    }
    for (let i = 0; i < asteroids.length; i++) {
        if (asteroids[i].id === linkedEnemyId) {
            return asteroids[i];
        }
    }
    return null;
}

function drawSimpleMobileBeam(
    ctx: CanvasRenderingContext2D,
    startX: number,
    startY: number,
    endX: number,
    endY: number
) {
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = 'rgba(103, 232, 249, 0.32)';
    ctx.lineWidth = MOBILE_BEAM_OUTER_WIDTH;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.lineWidth = MOBILE_BEAM_INNER_WIDTH;
    ctx.stroke();
}

function getDesktopBeamPattern(ctx: CanvasRenderingContext2D, now: number): { pattern: CanvasPattern | null; height: number } {
    if (!beamPatternCanvas) {
        beamPatternCanvas = document.createElement('canvas');
        beamPatternCanvas.width = 64;
        beamPatternCanvas.height = 10;
    }

    const patternCtx = beamPatternCanvas.getContext('2d');
    if (!patternCtx) {
        return { pattern: null, height: beamPatternCanvas.height };
    }

    const patternWidth = beamPatternCanvas.width;
    const patternHeight = beamPatternCanvas.height;

    if (!cachedBeamPattern || (now - lastPatternUpdateTime) > PATTERN_UPDATE_INTERVAL) {
        patternCtx.clearRect(0, 0, patternWidth, patternHeight);
        patternCtx.fillStyle = 'rgba(103, 232, 249, 0.3)';
        patternCtx.fillRect(0, (patternHeight - 7) / 2, patternWidth, 7);
        patternCtx.fillStyle = '#fff';
        patternCtx.fillRect(0, (patternHeight - 2) / 2, patternWidth, 2);
        patternCtx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        const particleWidth = 4;
        const particleSpacing = 16 + particleWidth;
        const particleY = (patternHeight - 3) / 2;
        const offset = (now / 5) % particleSpacing;
        for (let x = -offset; x < patternWidth; x += particleSpacing) {
            patternCtx.fillRect(x, particleY, particleWidth, 3);
        }
        cachedBeamPattern = ctx.createPattern(beamPatternCanvas, 'repeat-x');
        lastPatternUpdateTime = now;
    }

    return { pattern: cachedBeamPattern, height: patternHeight };
}

export function drawConduitBeams(ctx: CanvasRenderingContext2D, currentState: GameState, now: number) {
    const { enemies, asteroids } = currentState;

    // ✅ OPTIMIZATION: Reuse array instead of filter() allocation (zero-allocation)
    conduitsCache.length = 0;
    for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i];
        if (enemy.type === 'conduit' && enemy.linkedEnemyId != null) {
            conduitsCache.push(enemy);
        }
    }
    const conduits = conduitsCache;

    if (conduits.length === 0) {
        return;
    }

    if (IS_MOBILE) {
        ctx.save();
        ctx.lineCap = 'round';
        const conduitsLen = conduits.length;
        for (let i = 0; i < conduitsLen; i++) {
            const conduit = conduits[i];
            const linkedEnemyId = conduit.linkedEnemyId;
            if (linkedEnemyId == null) continue;

            const target = getLinkedTarget(linkedEnemyId, enemies, asteroids);
            if (!target) continue;

            const startX = conduit.x;
            const startY = conduit.y;
            const targetYOffset = 'size' in target ? 0 : C.ENEMY_HEIGHT_HALF;
            const endX = target.x;
            const endY = target.y + targetYOffset;
            if (!isBeamVisible(startY, endY)) continue;

            drawSimpleMobileBeam(ctx, startX, startY, endX, endY);
        }
        ctx.restore();
        return;
    }

    const { pattern: beamPattern, height: patternHeight } = getDesktopBeamPattern(ctx, now);
    if (!beamPattern) {
        return;
    }

    const conduitsLen = conduits.length;
    for (let i = 0; i < conduitsLen; i++) {
        const conduit = conduits[i];
        const linkedEnemyId = conduit.linkedEnemyId;
        if (linkedEnemyId == null) continue;

        const target = getLinkedTarget(linkedEnemyId, enemies, asteroids);
        if (!target) continue;

        const startX = conduit.x;
        const startY = conduit.y;
        const targetYOffset = 'size' in target ? 0 : C.ENEMY_HEIGHT_HALF;
        const endX = target.x;
        const endY = target.y + targetYOffset;
        if (!isBeamVisible(startY, endY)) continue;

        const dx = endX - startX;
        const dy = endY - startY;
        const distSq = dx * dx + dy * dy;
        if (distSq <= 0) continue;

        const length = Math.sqrt(distSq);
        const angle = Math.atan2(dy, dx);

        ctx.save();
        ctx.translate(startX, startY);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(length, 0);
        ctx.strokeStyle = beamPattern;
        ctx.lineWidth = patternHeight;
        ctx.stroke();
        ctx.restore();
    }
}
