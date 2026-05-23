
import type { TrainingTarget as TrainingTargetType } from '../../types';

const TARGET_RADIUS = 40;

export function drawTrainingTarget(ctx: CanvasRenderingContext2D, target: TrainingTargetType, wasHit: boolean) {
    ctx.save();

    if (wasHit) {
        ctx.scale(1.1, 1.1); // Reduced scale slightly to keep it tight
    }
    
    let borderColor = '#22d3ee'; // cyan-400
    let bgColor = 'rgba(14, 116, 144, 0.5)'; // cyan-900/50
    let textColor = '#67e8f9'; // cyan-300
    let shadowColor = '#22d3ee';

    // ✅ MOBILE OPTIMIZATION: Use color swap instead of expensive filter: brightness(2)
    if (wasHit) {
        borderColor = '#ffffff';
        bgColor = 'rgba(200, 255, 255, 0.8)'; // Bright flash
        textColor = '#ffffff';
        shadowColor = '#ffffff';
    } else if (target.isComplete && !target.isFailed) {
        borderColor = '#4ade80'; // green-400
        bgColor = 'rgba(21, 128, 61, 0.5)'; // green-900/50
        textColor = '#86efac'; // green-300
        shadowColor = '#4ade80';
    } else if (target.isFailed) {
        borderColor = '#f87171'; // red-400
        bgColor = 'rgba(127, 29, 29, 0.5)'; // red-900/50
        textColor = '#fca5a5'; // red-300
        shadowColor = '#f87171';
    }

    // Outer ring and shadow
    ctx.beginPath();
    ctx.arc(0, 0, TARGET_RADIUS, 0, 2 * Math.PI);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 4;
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = 15;
    ctx.stroke();

    // Inner background
    ctx.shadowBlur = 0;
    ctx.fillStyle = bgColor;
    ctx.fill();

    // Inner glow
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const innerGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, TARGET_RADIUS);
    innerGradient.addColorStop(0, `${shadowColor}40`); // 25% opacity
    innerGradient.addColorStop(1, `${shadowColor}00`); // 0% opacity
    ctx.fillStyle = innerGradient;
    ctx.fill();
    ctx.restore();

    // Text / Icon
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    
    if (target.isFailed) {
        ctx.font = '900 70px "Exo 2", sans-serif';
        ctx.fillStyle = '#ef4444'; // red-500
        ctx.fillText('X', 0, 5);
    } else if (target.isComplete) {
        ctx.strokeStyle = textColor;
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-TARGET_RADIUS * 0.4, 0);
        ctx.lineTo(-TARGET_RADIUS * 0.1, TARGET_RADIUS * 0.3);
        ctx.lineTo(TARGET_RADIUS * 0.4, -TARGET_RADIUS * 0.3);
        ctx.stroke();
    } else {
        ctx.font = '900 50px "Exo 2", sans-serif';
        ctx.fillStyle = textColor;
        ctx.fillText(String(target.remainingHits), 0, 2);
    }

    ctx.restore();
}