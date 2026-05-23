import type { GameState } from '../../types';
import { drawAllSpecialEffects } from './drawSpecialEffects';
import { drawAllImpacts } from './drawImpacts';
import { drawAllDebris } from './drawDebris';
import { drawAllProjectiles } from './drawProjectiles';
import { drawAllUIEffects } from './drawUIEffects';

export function drawAllEffects(ctx: CanvasRenderingContext2D, currentState: GameState, noiseCanvas: HTMLCanvasElement | null, now: number, projectileColor: string) {
    // 1. Draw large-scale, background-style effects first.
    drawAllSpecialEffects(ctx, currentState, noiseCanvas, now);

    // 2. Draw impact and explosion effects that happen at a point in time.
    drawAllImpacts(ctx, currentState, now);

    // 3. Draw debris that originates from impacts.
    drawAllDebris(ctx, currentState, now);
    
    // 4. Draw moving projectiles, which should appear over impacts and debris.
    drawAllProjectiles(ctx, currentState, projectileColor);

    // 5. Draw UI-like elements that should appear on top of all gameplay effects.
    drawAllUIEffects(ctx, currentState, now);
}