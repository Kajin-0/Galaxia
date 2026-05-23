import type { GameState } from '../../types';
import * as C from '../../constants';
import { calculatePerspectiveScale } from '../../utils/perspective';

function drawShellCasings(ctx: CanvasRenderingContext2D, gameState: GameState) {
    const { shellCasings } = gameState;
    ctx.fillStyle = '#f59e0b';
    // ✅ MOBILE OPTIMIZATION: Manual loop instead of forEach (eliminates function call overhead)
    for (let i = 0; i < shellCasings.length; i++) {
        const c = shellCasings[i];
        const scale = calculatePerspectiveScale(c.y);
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rotation * (Math.PI / 180));
        ctx.scale(scale, scale);
        ctx.fillRect(-4, -1.5, 8, 3);
        ctx.restore();
    }
}

function drawGibs(ctx: CanvasRenderingContext2D, gameState: GameState, now: number) {
    const { gibs } = gameState;

    // ✅ MOBILE OPTIMIZATION: Manual loop instead of forEach (eliminates function call overhead)
    for (let i = 0; i < gibs.length; i++) {
        const gib = gibs[i];
        const scale = calculatePerspectiveScale(gib.y);
        const opacity = 1 - (now - gib.createdAt) / C.GIB_LIFETIME;
        if (opacity <= 0) continue; // Early exit
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.translate(gib.x, gib.y);
        ctx.rotate(gib.rotation * (Math.PI / 180));
        ctx.scale(scale, scale);
        ctx.fillStyle = gib.color;
        ctx.fillRect(-gib.size / 2, -gib.size / 2, gib.size, gib.size);
        ctx.restore();
    }
}

export function drawAllDebris(ctx: CanvasRenderingContext2D, currentState: GameState, now: number) {
    drawShellCasings(ctx, currentState);
    drawGibs(ctx, currentState, now);
}