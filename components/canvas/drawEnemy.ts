import type { Enemy } from '../../types';

// Helper to draw a rectangle with a rounded top, like `rounded-t-full`
function roundedTopRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.arcTo(x + width, y, x + width, y + radius, radius);
    ctx.lineTo(x + width, y + height);
    ctx.lineTo(x, y + height);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
    ctx.fill();
}

// Helper to draw a rectangle with a rounded bottom, like `rounded-b-full`
function roundedBottomRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + width, y);
    ctx.lineTo(x + width, y + height - radius);
    ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
    ctx.lineTo(x + radius, y + height);
    ctx.arcTo(x, y + height, x, y + height - radius, radius);
    ctx.closePath();
    ctx.fill();
}

function drawAlien(ctx: CanvasRenderingContext2D, enemy: Enemy) {
    ctx.shadowColor = '#0f0';
    ctx.shadowBlur = 15;

    const halfW = 25;
    const halfH = 20;

    // Tentacles
    ctx.fillStyle = '#a855f7';
    roundedBottomRect(ctx, -3.75, 8, 7.5, 12, 3.75);
    roundedBottomRect(ctx, -15, 10, 7.5, 10, 3.75);
    roundedBottomRect(ctx, 7.5, 10, 7.5, 10, 3.75);
    
    // Body
    ctx.fillStyle = '#059669';
    ctx.fillRect(-7.5, 0, 15, 12);
    
    // Head
    ctx.fillStyle = '#10b981';
    roundedTopRect(ctx, -17.5, -20, 35, 24, 17.5);

    // Eyes
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.ellipse(-7.5, -6, 5, 6, 0, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(7.5, -6, 5, 6, 0, 0, 2 * Math.PI);
    ctx.fill();
    
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
}


function drawDodger(ctx: CanvasRenderingContext2D, enemy: Enemy) {
    const halfW = 25;
    const halfH = 20;

    ctx.shadowColor = '#c084fc';
    ctx.shadowBlur = 15;

    // Wings
    ctx.fillStyle = '#a855f7';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(halfW, 12);
    ctx.lineTo(-halfW, 12);
    ctx.closePath();
    ctx.fill();
    
    // Main Body
    ctx.fillStyle = '#7e22ce';
    ctx.beginPath();
    ctx.moveTo(0, -halfH);
    ctx.lineTo(halfW, 4);
    ctx.lineTo(0, halfH);
    ctx.lineTo(-halfW, 4);
    ctx.closePath();
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Cockpit Glow
    ctx.save();
    ctx.fillStyle = '#f472b6';
    ctx.shadowColor = '#f472b6';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.ellipse(0, -12, 2.5, 4, 0, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();

    // Shield
    if (enemy.shieldHealth && enemy.shieldHealth > 0) {
        ctx.save();
        ctx.shadowColor = '#0ff';
        ctx.shadowBlur = 15;
        ctx.strokeStyle = '#67e8f9';
        ctx.fillStyle = 'rgba(34, 211, 238, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const shieldRadius = Math.max(halfW, halfH) + 6;
        ctx.arc(0, 0, shieldRadius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        ctx.shadowColor = '#0ff';
        ctx.shadowBlur = 8;
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, shieldRadius - 2, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.restore();
    }
}

function drawConduit(ctx: CanvasRenderingContext2D, enemy: Enemy) {
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 15;

    // Hull
    ctx.fillStyle = '#155e75';
    ctx.beginPath();
    ctx.moveTo(0, -20); ctx.lineTo(25, -10); ctx.lineTo(25, 10);
    ctx.lineTo(0, 20); ctx.lineTo(-25, 10); ctx.lineTo(-25, -10);
    ctx.closePath();
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Inner Crystal
    ctx.fillStyle = '#0891b2';
    ctx.beginPath();
    ctx.moveTo(0, -16); ctx.lineTo(20, 0);
    ctx.lineTo(0, 16); ctx.lineTo(-20, 0);
    ctx.closePath();
    ctx.fill();

    // Core
    ctx.save();
    ctx.shadowColor = '#0ff';
    ctx.shadowBlur = 15;
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.ellipse(0, 0, (50 / 3) / 2, (40 / 3) / 2, 0, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
}

function drawWeaver(ctx: CanvasRenderingContext2D, enemy: Enemy) {
    ctx.shadowColor = '#ec4899';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#7e22ce';

    const drawLeg = (css: {x:number, y:number, rotation:number, originX:number, originY:number, path:number[]}) => {
        ctx.save();
        ctx.translate(css.x, css.y);
        ctx.translate(css.originX, css.originY);
        ctx.rotate(css.rotation * Math.PI / 180);
        ctx.beginPath();
        ctx.moveTo(css.path[0] - css.originX, css.path[1] - css.originY);
        ctx.lineTo(css.path[2] - css.originX, css.path[3] - css.originY);
        ctx.lineTo(css.path[4] - css.originX, css.path[5] - css.originY);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    };
    
    drawLeg({ x: -30, y: -16, rotation: -45, originX: 10, originY: 32, path: [5,0, 10,16, 5,32] });
    drawLeg({ x: 20, y: -16, rotation: 45, originX: 0, originY: 32, path: [5,0, 0,16, 5,32] });
    drawLeg({ x: -30, y: -16, rotation: 45, originX: 10, originY: 0, path: [5,0, 10,16, 5,32] });
    drawLeg({ x: 20, y: -16, rotation: -45, originX: 0, originY: 0, path: [5,0, 0,16, 5,32] });

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    ctx.save();
    ctx.shadowColor = '#ec4899';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#db2777';
    ctx.beginPath();
    ctx.ellipse(0, 0, 12.5, 10, 0, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
}

function drawHereticShip(ctx: CanvasRenderingContext2D, enemy: Enemy) {
    ctx.shadowColor = '#a855f7';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(0, -20); ctx.lineTo(25, -8); ctx.lineTo(17.5, 20);
    ctx.lineTo(-17.5, 20); ctx.lineTo(-25, -8);
    ctx.closePath();
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    ctx.save();
    ctx.shadowColor = '#a855f7';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#7e22ce';
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 8, 0, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = 'rgba(192, 132, 252, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-10, -15); ctx.lineTo(15, 0); ctx.lineTo(-5, 18);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(5, -18); ctx.lineTo(-15, 5);
    ctx.stroke();
}

const enemyRenderMap: Record<Enemy['type'], (ctx: CanvasRenderingContext2D, enemy: Enemy) => void> = {
    standard: drawAlien,
    dodger: drawDodger,
    conduit: drawConduit,
    weaver: drawWeaver,
    heretic_ship: drawHereticShip,
};

export function drawEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy, wasHit: boolean) {
    const renderFn = enemyRenderMap[enemy.type];
    if (renderFn) {
        if (wasHit) {
            ctx.filter = 'brightness(2.5)';
        }
        renderFn(ctx, enemy);
        if (wasHit) {
            ctx.filter = 'none';
        }
    }
}
