import * as C from '../constants';
import { perspectiveWidthLUT } from '../utils/perspective';

/**
 * Calculates the bounds for a perfectly centered perspective trapezoid for visual rendering.
 * This function does not include any gameplay padding.
 * @param y The y-coordinate (depth) in the game world.
 * @returns An object with the minX and maxX for the visual grid at that y-coordinate.
 */
export function getVisualGridBoundsAtY(y: number): { minX: number; maxX: number } {
    const visibleWidth = getVisibleWidthAtY(y);
    
    let baseMinX: number, baseMaxX: number;

    if (visibleWidth >= C.GAME_WIDTH) {
        baseMinX = 0;
        baseMaxX = C.GAME_WIDTH;
    } else {
        const margin = (C.GAME_WIDTH - visibleWidth) / 2;
        baseMinX = margin;
        baseMaxX = C.GAME_WIDTH - margin;
    }

    // Apply the global horizontal offset to shift the entire grid.
    let minX = baseMinX + C.GAME_GRID_X_OFFSET;
    let maxX = baseMaxX + C.GAME_GRID_X_OFFSET;

    // Clamp the final values to the screen boundaries to prevent visual disconnects.
    // This ensures the grid shifts but doesn't render off-screen.
    minX = Math.max(0, Math.min(minX, C.GAME_WIDTH));
    maxX = Math.max(0, Math.min(maxX, C.GAME_WIDTH));

    return { minX, maxX };
}


/**
 * Calculates the bounds of the asymmetrical playable grid area at a given y-coordinate.
 * This function accounts for the UI lane padding on the right side.
 * @param y The y-coordinate (depth) in the game world.
 * @param laneCount The total number of lanes.
 * @returns An object with the minX and maxX for the playable grid at that y-coordinate.
 */
export function getPlayableGridBoundsAtY(y: number, laneCount: number): { minX: number; maxX: number } {
    const height = C.GAME_GRID_HEIGHT;
    const playableLanes = laneCount - 1;

    // Get the full visual bounds at the top and bottom, which now include the offset and are clamped.
    const fullTopBounds = getVisualGridBoundsAtY(0);
    const fullBottomBounds = getVisualGridBoundsAtY(height);

    // Calculate the width of the padding lane based on the perspective at top and bottom.
    const fullTopWidth = fullTopBounds.maxX - fullTopBounds.minX;
    const topPadding = fullTopWidth / playableLanes;

    const fullBottomWidth = fullBottomBounds.maxX - fullBottomBounds.minX;
    const bottomPadding = fullBottomWidth / playableLanes;

    // Define the playable area by subtracting the padding from the right side of the visual area.
    const topBounds = { minX: fullTopBounds.minX, maxX: fullTopBounds.maxX - topPadding };
    const bottomBounds = { minX: fullBottomBounds.minX, maxX: fullBottomBounds.maxX - bottomPadding };
    
    // Interpolate between top and bottom bounds based on the y-coordinate
    const clampedY = Math.max(0, Math.min(y, height));
    const progress = clampedY / height;
    let minX = topBounds.minX + (bottomBounds.minX - topBounds.minX) * progress;
    let maxX = topBounds.maxX + (bottomBounds.maxX - topBounds.maxX) * progress;
    
    // Clamp to the screen boundaries for safety. This prevents any part of the playable
    // area from being calculated as off-screen.
    minX = Math.max(0, Math.min(minX, C.GAME_WIDTH));
    maxX = Math.max(0, Math.min(maxX, C.GAME_WIDTH));
    
    return { minX, maxX };
}


/**
 * Retrieves the pre-calculated apparent width of the game area at a given y-coordinate.
 * This function uses a lookup table for high performance.
 * @param y The y-coordinate (depth) in the game world.
 * @returns The visible width in game world coordinates.
 */
export function getVisibleWidthAtY(y: number): number {
    const roundedY = Math.round(y);
    // Clamp the index to be within the bounds of the lookup table.
    const clampedY = Math.max(0, Math.min(roundedY, perspectiveWidthLUT.length - 1));
    return perspectiveWidthLUT[clampedY];
}

/**
 * Calculates the safe horizontal travel area for an entity's center point at a given y-coordinate.
 * This function derives its bounds directly from the playable grid, ensuring gameplay matches visuals.
 * @param y The y-coordinate (depth) of the entity.
 * @param entityWidth The full visual width of the entity.
 * @param laneCount The current number of lanes in the game.
 * @returns An object with minX and maxX coordinates for the entity's center.
 */
export function getHorizontalBoundsAtY(y: number, entityWidth: number, laneCount: number): { minX: number; maxX: number } {
    const { minX: gridMinX, maxX: gridMaxX } = getPlayableGridBoundsAtY(y, laneCount);
    const halfEntityWidth = entityWidth / 2;

    return {
        minX: gridMinX + halfEntityWidth,
        maxX: gridMaxX - halfEntityWidth,
    };
}

/**
 * Clamps a horizontal position to keep an entity fully within the visible play area.
 * This accounts for both the 3D perspective and the absolute screen edges.
 * @param x The current x-coordinate of the entity's center.
 * @param y The current y-coordinate of the entity's center.
 * @param entityWidth The full width of the entity.
 * @param laneCount The current number of lanes in the game.
 * @returns The clamped x-coordinate.
 */
export function clampHorizontalPosition(x: number, y: number, entityWidth: number, laneCount: number): number {
    const { minX, maxX } = getHorizontalBoundsAtY(y, entityWidth, laneCount);
    return Math.max(minX, Math.min(maxX, x));
}