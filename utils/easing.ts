/**
 * Shared easing functions for animations and transitions.
 * Consolidates all easing functions used throughout the codebase.
 */

/**
 * Ease out quintic - smooth deceleration
 * Matches cubic-bezier(0.22, 1, 0.36, 1) for shield form-up
 */
export function easeOutQuint(t: number): number {
    return 1 - Math.pow(1 - t, 5);
}

/**
 * Ease out cubic - moderate deceleration
 */
export function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
}

/**
 * Ease out quadratic - gentle deceleration
 */
export function easeOutQuad(t: number): number {
    return 1 - (1 - t) * (1 - t);
}

/**
 * Alternative ease out quadratic - different curve
 * Used in some UI animations
 */
export function easeOutQuadAlt(t: number): number {
    return t * (2 - t);
}
















