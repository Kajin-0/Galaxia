import type { Asteroid } from '../../types';
import { ASTEROID_ROCK_COLORS } from '../../constants';

// Generate a random-ish but stable polygon shape for the asteroid based on its ID
function drawAsteroidPath(ctx: CanvasRenderingContext2D, id: number, radius: number): void {
    const isMontezuma = id === -999;
    const numVertices = isMontezuma ? 24 : 8 + (Math.abs(id) % 5);
    const angleStep = (2 * Math.PI) / numVertices;

    ctx.beginPath();

    for (let i = 0; i < numVertices; i++) {
        const angle = i * angleStep;
        
        const seed = isMontezuma ? 1337 : id;
        const variance = isMontezuma ? 0.1 : 0.4;
        const base = isMontezuma ? 0.9 : 0.8;
        const randomFactor = Math.sin((seed * (i + 1)) * 0.5) * variance + base;
        
        const r = radius * randomFactor;
        const x = r * Math.cos(angle);
        const y = r * Math.sin(angle);

        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.closePath();
}

export function drawAsteroid(ctx: CanvasRenderingContext2D, asteroid: Asteroid, wasHit: boolean) {
    const isMontezuma = asteroid.id === -999;
    const displayRadius = asteroid.size;
    
    // Base color and shadow
    ctx.fillStyle = ASTEROID_ROCK_COLORS[Math.abs(asteroid.id) % ASTEROID_ROCK_COLORS.length];
    ctx.shadowColor = isMontezuma ? '#f00' : '#111';
    ctx.shadowBlur = isMontezuma ? 20 : 10;
    
    // Hit flash effect
    if (wasHit) {
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 15;
        ctx.filter = 'brightness(1.8)';
    }

    // Draw main shape
    drawAsteroidPath(ctx, asteroid.id, displayRadius);
    ctx.fill();

    // Reset filter for other drawings
    ctx.filter = 'none';

    // Montezuma special effects
    if (isMontezuma) {
        ctx.shadowColor = 'rgba(255,50,50,0.5)';
        ctx.shadowBlur = 30;
        ctx.strokeStyle = 'rgba(255,50,50,0.5)';
        ctx.lineWidth = 3;
        drawAsteroidPath(ctx, asteroid.id, displayRadius);
        ctx.stroke();
    }

    // Craters
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    
    ctx.beginPath();
    ctx.arc(displayRadius * 0.2, displayRadius * 0.1, displayRadius * 0.2, 0, 2 * Math.PI);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(-displayRadius * 0.3, -displayRadius * 0.4, displayRadius * 0.25, 0, 2 * Math.PI);
    ctx.fill();

    // Reset shadows for subsequent draws
    ctx.shadowBlur = 0;
}
