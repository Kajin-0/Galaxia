import * as C from '../constants';

// The lookup table for pre-calculated perspective widths.
export const perspectiveWidthLUT: number[] = [];

/**
 * Calculates the perspective scale factor for entities based on their y-position.
 * This creates the 3D depth effect where objects appear smaller when further away.
 * @param y The y-coordinate of the entity
 * @returns A scale factor between 0.4 (far) and 1.0 (near)
 */
export function calculatePerspectiveScale(y: number): number {
    return 0.4 + (y / C.GAME_HEIGHT) * 0.6;
}

/**
 * Calculates the apparent width of the game area at a given y-coordinate.
 * This is the original, expensive calculation used for pre-computation.
 */
function calculateVisibleWidthAtY(y: number): number {
    // This is a more accurate perspective projection calculation.
    // We define a "camera" distance from the screen (the player's viewpoint)
    // and calculate how the field of view expands into the distance.
    const cameraDistance = 450; // Distance from player (at y=GAME_HEIGHT) to the screen plane.
    const fov_y = C.GAME_GRID_HEIGHT + cameraDistance; // The y-coordinate of the "focal point" or vanishing point.

    // How far "into" the screen the current y-coordinate is, from the camera's perspective.
    const depth = fov_y - y;
    
    // The scale factor is the ratio of the current depth to the total depth at the bottom of the screen.
    const scale = fov_y / depth;
    
    // The visible width is the base game width scaled by this factor.
    const perspectiveWidth = C.GAME_WIDTH * scale;
    
    return perspectiveWidth;
}

/**
 * Pre-computes the visible width for every y-coordinate and stores it in a lookup table.
 * This should be called once when the application loads.
 */
export function precomputePerspectiveLUT(): void {
    // Clear any existing values
    perspectiveWidthLUT.length = 0;
    
    // Calculate for the visible game height plus a buffer for off-screen entities.
    const calculationHeight = C.GAME_GRID_HEIGHT + C.GAME_HEIGHT_BUFFER;

    for (let y = 0; y <= calculationHeight; y++) {
        perspectiveWidthLUT[y] = calculateVisibleWidthAtY(y);
    }
    // Perspective LUT pre-computed with non-linear projection
}