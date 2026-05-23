import type { PowerUp as PowerUpType } from '../../types';
import { POWERUP_HITBOX_RADIUS } from '../../constants';

const typeMap = {
    RapidFire:  { char: 'R', color: '#ef4444' }, // red-500
    SpreadShot: { char: 'S', color: '#a855f7' }, // purple-500
    Shield:     { char: 'H', color: '#22d3ee' }, // cyan-400
    ExtendedMag:{ char: 'E', color: '#3b82f6' }, // blue-500
    AutoReload: { char: 'A', color: '#22c55e' }, // green-500
    CritBoost:  { char: 'C', color: '#f97316' }, // orange-500
    ReloadBoost:{ char: 'L', color: '#facc15' }, // yellow-400
};

export function drawPowerUp(ctx: CanvasRenderingContext2D, powerUp: PowerUpType) {
    const { char, color } = typeMap[powerUp.powerUpType];
    const radius = POWERUP_HITBOX_RADIUS;

    // --- Circle and Shadow ---
    ctx.shadowColor = color;
    ctx.shadowBlur = 15;
    ctx.fillStyle = color;

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, 2 * Math.PI);
    ctx.fill();

    // Reset shadow for text
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    
    // --- Text ---
    ctx.save();
    ctx.font = '900 20px "Exo 2", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Text shadow
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    ctx.shadowBlur = 3;
    
    // Text color
    ctx.fillStyle = 'white';
    
    ctx.fillText(char, 0, 1);
    ctx.restore();
}
