import type { GameState } from '../../types';
import * as C from '../../constants';
import { getPlayableGridBoundsAtY } from '../../gameLogic/positioning';
import { drawSortedRenderables, drawPlayerAndDrones } from './drawGameObjects';
import { drawAllWeaverEffects } from './drawWeaverEffects';
import { drawConduitBeams } from './drawConduitEffects';
import { drawAllEffects } from './drawEffects';
import { drawDodgerTrails } from './drawEnemy';

/**
 * Draws the background grid layer.
 * This function contains all logic previously in GridCanvas.tsx's draw loop.
 */
export function drawGridLayer(ctx: CanvasRenderingContext2D, gameState: GameState) {
    const { gridYOffset, laneCount } = gameState;
    const height = C.GAME_GRID_HEIGHT;

    ctx.strokeStyle = C.GRID_COLOR;
    ctx.lineWidth = 1;
    
    // --- Define the ASYMMETRICAL Playable Grid Area ---
    // We reserve one lane for UI padding, so the grid should only cover the playable lanes.
    const playableLanes = laneCount - 1;

    // Use the single source of truth from positioning.ts to get the correct, tuned grid boundaries.
    const bottomBounds = getPlayableGridBoundsAtY(height, laneCount);
    const topBounds = getPlayableGridBoundsAtY(0, laneCount);

    // --- Draw Horizontal Lines (within the asymmetrical playable grid) ---
    for (let y = gridYOffset - C.GRID_CELL_HEIGHT; y < height; y += C.GRID_CELL_HEIGHT) {
      if (y < 0) continue; // Don't draw off-screen
      const progress = y / height;
      // Interpolate the asymmetrical bounds for the current y coordinate.
      const minX = topBounds.minX + (bottomBounds.minX - topBounds.minX) * progress;
      const maxX = topBounds.maxX + (bottomBounds.maxX - topBounds.maxX) * progress;
      ctx.beginPath();
      ctx.moveTo(minX, y);
      ctx.lineTo(maxX, y);
      ctx.stroke();
    }

    // --- Draw Vertical Lines (within the asymmetrical playable grid) ---
    const playableTopWidth = topBounds.maxX - topBounds.minX;
    const playableBottomWidth = bottomBounds.maxX - bottomBounds.minX;
    
    // The lane width for drawing must be based on the number of PLAYABLE lanes
    // to fit the correct number of lines into the padded space.
    const laneWidthAtTop = playableTopWidth / playableLanes;
    const laneWidthAtBottom = playableBottomWidth / playableLanes;
    
    // Draw vertical lines for the playable lanes.
    for (let i = 0; i <= playableLanes; i++) {
        const xAtTop = topBounds.minX + i * laneWidthAtTop;
        const xAtBottom = bottomBounds.minX + i * laneWidthAtBottom;

        ctx.beginPath();
        ctx.moveTo(xAtTop, 0);
        ctx.lineTo(xAtBottom, height);
        ctx.stroke();
    }
}

/**
 * Draws the main game objects layer (player, enemies, etc.).
 * This function contains all logic previously in GameCanvas.tsx's draw loop.
 */
export function drawGameLayer(ctx: CanvasRenderingContext2D, gameState: GameState, now: number, projectileColor: string) {
    // Resizing logic has been moved to GameView.tsx for performance.
    // The canvas is now assumed to be correctly sized and transformed.

    // --- Draw Conduit Link Beams ---
    drawConduitBeams(ctx, gameState, now);
    
    // --- Draw Dodger Trails (behind main objects) ---
    drawDodgerTrails(ctx, gameState.enemies, gameState.isHardMode, now);

    // --- Draw Game Objects (pre-sorted by the engine) ---
    drawSortedRenderables(ctx, gameState, now);
    
    // --- Draw Weaver Effects ---
    drawAllWeaverEffects(ctx, gameState, now);

    // --- Draw Player ---
    drawPlayerAndDrones(ctx, gameState, now, projectileColor);
}

/**
 * Draws the top-level effects layer (projectiles, explosions, etc.).
 * This function contains all logic previously in EffectsCanvas.tsx's draw loop.
 */
export function drawEffectsLayer(ctx: CanvasRenderingContext2D, gameState: GameState, noiseCanvas: HTMLCanvasElement | null, now: number, projectileColor: string) {
    ctx.save();
    try {
        ctx.translate(0, C.EFFECTS_CANVAS_TOP_BUFFER);
        drawAllEffects(ctx, gameState, noiseCanvas, now, projectileColor);
    } finally {
        // Hard reset of critical props to avoid persistent artifacts (grey bars, lingering blur)
        ctx.filter = 'none';
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
    }
}