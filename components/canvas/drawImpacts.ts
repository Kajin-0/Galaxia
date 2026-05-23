
import type { GameState } from '../../types';
import * as C from '../../constants';
import { easeOutCubic, easeOutQuadAlt } from '../../utils/easing';
import { cacheManager } from '../../utils/cacheManager';

// ============================================================================
// CACHING SYSTEMS
// ============================================================================

const critHitImageCache: { image: HTMLCanvasElement | null } = { image: null };
const particleCache = new Map<string, HTMLCanvasElement>();
const rockImpactParticleCache = new Map<string, HTMLCanvasElement>();
const ROCK_IMPACT_PARTICLE_BASE_RADIUS = 8;

// Register caches
cacheManager.registerCache('particleRender', particleCache, 10);
cacheManager.registerCache('rockImpactParticleRender', rockImpactParticleCache, 8);

export function clearParticleCache() {
    particleCache.clear();
    rockImpactParticleCache.clear();
}

/**
 * Creates a pre-rendered canvas containing the critical hit's radial gradient.
 */
function getPreRenderedCritHit(): HTMLCanvasElement {
    if (critHitImageCache.image) {
        return critHitImageCache.image;
    }

    const radius = 100;
    const canvas = document.createElement('canvas');
    canvas.width = radius * 2;
    canvas.height = radius * 2;
    const ctx = canvas.getContext('2d')!;

    const gradient = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
    const ringThickness = 0.25;
    const ringInnerEdge = 1 - ringThickness;
    
    gradient.addColorStop(0, `rgba(207, 250, 254, 0)`);
    gradient.addColorStop(Math.max(0, ringInnerEdge - 0.1), `rgba(207, 250, 254, 0)`);
    gradient.addColorStop(ringInnerEdge, `rgba(103, 232, 249, 0.7)`);
    gradient.addColorStop(ringInnerEdge + (ringThickness * 0.5), `rgba(207, 250, 254, 0.95)`);
    gradient.addColorStop(1, `rgba(34, 211, 238, 0)`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, radius * 2, radius * 2);

    critHitImageCache.image = canvas;
    return canvas;
}

/**
 * Creates a small cached sprite for a glowing particle.
 * This replaces drawing thousands of arcs with shadowBlur per second.
 */
function getCachedParticle(color: string): HTMLCanvasElement {
    if (particleCache.has(color)) return particleCache.get(color)!;

    const baseRadius = 8; // Render at a decent resolution, scale down later
    const padding = 10; // For glow
    const canvas = document.createElement('canvas');
    canvas.width = (baseRadius + padding) * 2;
    canvas.height = (baseRadius + padding) * 2;
    const ctx = canvas.getContext('2d')!;

    ctx.translate(canvas.width / 2, canvas.height / 2);

    // Glow
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillStyle = color;
    
    ctx.beginPath();
    ctx.arc(0, 0, baseRadius, 0, 2 * Math.PI);
    ctx.fill();
    
    // Core (brighter center)
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, baseRadius * 0.5, 0, 2 * Math.PI);
    ctx.fill();

    particleCache.set(color, canvas);
    return canvas;
}

function getCachedRockImpactParticle(color: string): HTMLCanvasElement {
    if (rockImpactParticleCache.has(color)) return rockImpactParticleCache.get(color)!;

    const padding = 2;
    const radius = ROCK_IMPACT_PARTICLE_BASE_RADIUS;
    const canvas = document.createElement('canvas');
    canvas.width = (radius + padding) * 2;
    canvas.height = (radius + padding) * 2;
    const ctx = canvas.getContext('2d')!;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, 2 * Math.PI);
    ctx.fill();

    rockImpactParticleCache.set(color, canvas);
    return canvas;
}

export function warmUpParticleCache() {
    getCachedParticle('#f09');    // Pink
    getCachedParticle('#ff007f'); // Hot Pink
    getCachedParticle('#fff');    // White
    getCachedRockImpactParticle('#f59e0b');
    getCachedRockImpactParticle('#d97706');
    getCachedRockImpactParticle('#fef3c7');
}

// ============================================================================
// DRAW FUNCTIONS
// ============================================================================

function drawSplatterExplosions(ctx: CanvasRenderingContext2D, gameState: GameState, now: number) {
    const { explosions } = gameState;
    if (explosions.length === 0) return;

    // Get sprites once
    const spritePink = getCachedParticle('#f09');
    const spriteHotPink = getCachedParticle('#ff007f');
    const spriteWhite = getCachedParticle('#fff');

    // ✅ MOBILE OPTIMIZATION: Manual loop
    for (let expIdx = 0; expIdx < explosions.length; expIdx++) {
        const exp = explosions[expIdx];
        const elapsed = now - exp.createdAt;
        if (elapsed > 500) continue;
        
        const progress = elapsed / 500;
        const easedProgress = easeOutCubic(progress);
        const opacity = 1 - easedProgress;
        // Explode outward scaling
        const explosionScale = 1.2 * (1 - easedProgress); 
        
        if (opacity <= 0.01) continue;

        ctx.globalAlpha = opacity;

        // Draw particles using cached sprites
        for (let i = 0; i < exp.particles.length; i++) {
            const p = exp.particles[i];
            // Calculate current position
            const x = exp.x + Math.cos(p.angle) * p.distance * easedProgress;
            const y = exp.y + Math.sin(p.angle) * p.distance * easedProgress;
            
            // Calculate particle scale based on its life and base size
            // The cached sprite has a base radius of ~8px.
            // p.size ranges from ~6 to 14.
            // We need to scale the sprite to match the desired visual size.
            const spriteScale = (p.size * explosionScale) / 16; // 16 is approx cached diameter
            
            if (spriteScale < 0.1) continue;

            let sprite = spriteWhite;
            if (p.color === '#f09') sprite = spritePink;
            else if (p.color === '#ff007f') sprite = spriteHotPink;

            ctx.translate(x, y);
            ctx.drawImage(
                sprite, 
                -sprite.width / 2 * spriteScale, 
                -sprite.height / 2 * spriteScale, 
                sprite.width * spriteScale, 
                sprite.height * spriteScale
            );
            ctx.translate(-x, -y); // Reset translate faster than save/restore in a loop
        }
    }
    
    ctx.globalAlpha = 1;
}

function drawRockImpacts(ctx: CanvasRenderingContext2D, gameState: GameState, now: number) {
    const { rockImpacts } = gameState;
    if (rockImpacts.length === 0) return;

    const rockImpactParticleCount = 5;
    const rockImpactDuration = 300;
    const rockImpactSpriteAmber = getCachedRockImpactParticle('#f59e0b');
    const rockImpactSpriteDarkAmber = getCachedRockImpactParticle('#d97706');
    const rockImpactSpriteCream = getCachedRockImpactParticle('#fef3c7');
    
    for (let i = 0; i < rockImpacts.length; i++) {
        const impact = rockImpacts[i];
        const elapsed = now - impact.createdAt;
        if (elapsed > rockImpactDuration) continue;
        
        const progress = elapsed / rockImpactDuration;
        const easedProgress = easeOutCubic(progress);
        const opacity = 1 - easedProgress;
        if (opacity <= 0) continue;
        
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.translate(impact.x, impact.y);
        
        for (let j = 0; j < rockImpactParticleCount; j++) {
            const angle = ((impact.id * j * 3.14) % (2 * Math.PI));
            const distance = ((impact.id * j * 7) % 20 + 10);
            const size = ((impact.id * j * 5) % 5 + 2);
            
            const currentDist = distance * easedProgress;
            const offsetX = Math.cos(angle) * currentDist;
            const offsetY = Math.sin(angle) * currentDist;
            const currentRadius = size * (1 - easedProgress);
            
            if (currentRadius > 0) {
                const spriteIndex = (impact.id + j) % 3;
                const sprite = spriteIndex === 0
                    ? rockImpactSpriteAmber
                    : spriteIndex === 1
                        ? rockImpactSpriteDarkAmber
                        : rockImpactSpriteCream;
                const spriteScale = currentRadius / ROCK_IMPACT_PARTICLE_BASE_RADIUS;
                ctx.drawImage(
                    sprite,
                    offsetX - (sprite.width / 2) * spriteScale,
                    offsetY - (sprite.height / 2) * spriteScale,
                    sprite.width * spriteScale,
                    sprite.height * spriteScale
                );
            }
        }
        ctx.restore();
    }
}

function drawProjectileImpacts(ctx: CanvasRenderingContext2D, gameState: GameState, now: number) {
    const { projectileImpacts } = gameState;
    if (projectileImpacts.length === 0) return;
    
    const impactDuration = 200;
    
    for (let i = 0; i < projectileImpacts.length; i++) {
        const impact = projectileImpacts[i];
          const elapsed = now - impact.createdAt;
          if (elapsed > impactDuration + 100) continue;
          const progress = Math.min(1, elapsed / impactDuration), easedProgress = easeOutCubic(progress), opacity = 1 - progress, impactSize = 1.0;
          ctx.save();
          ctx.translate(impact.x, impact.y);
          if (progress < 1) {
              const glowRadius = 25 * impactSize * easedProgress;
              ctx.fillStyle = impact.color; ctx.globalAlpha = opacity * 0.5;
              ctx.beginPath(); ctx.arc(0, 0, glowRadius, 0, Math.PI * 2); ctx.fill();
              const coreRadius = 8 * impactSize * (1 - progress);
              if (coreRadius > 0) {
                  ctx.globalAlpha = opacity; ctx.fillStyle = '#fff';
                  ctx.beginPath(); ctx.arc(0, 0, coreRadius, 0, Math.PI * 2); ctx.fill();
              }
          }
          const sparkCount = Math.floor(4 * impactSize), sparkDuration = 300;
          if (elapsed < sparkDuration) {
              const sparkProgress = elapsed / sparkDuration, easedSparkProgress = easeOutCubic(sparkProgress), sparkOpacity = 1 - sparkProgress;
              if (sparkOpacity > 0) {
                  ctx.globalAlpha = sparkOpacity; ctx.lineWidth = Math.max(1, 2 * impactSize * (1 - sparkProgress));
                  ctx.strokeStyle = '#fff'; ctx.lineCap = 'round';
                  for (let j = 0; j < sparkCount; j++) {
                      const angle = ((impact.id % 360) + (360 / sparkCount * j) + (impact.id % 20)) * Math.PI / 180, speed = ((impact.id * (j + 1) * 7) % 60 + 90) * impactSize, length = 12 * impactSize * (1 - sparkProgress);
                      const distance = speed * easedSparkProgress, startX = Math.cos(angle) * distance, startY = Math.sin(angle) * distance, endX = Math.cos(angle) * (distance + length), endY = Math.sin(angle) * (distance + length);
                      if (length > 0.5) { ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(endX, endY); ctx.stroke(); }
                  }
              }
          }
          ctx.restore();
      }
}

function drawCriticalHits(ctx: CanvasRenderingContext2D, gameState: GameState, now: number) {
    const { criticalHits, selectedHero, heroUpgrades } = gameState;
    if (criticalHits.length === 0) return;
    
    const critImage = getPreRenderedCritHit();

    ctx.save();
    for (let i = 0; i < criticalHits.length; i++) {
        const crit = criticalHits[i];
        const elapsed = now - crit.createdAt;
        const progress = Math.min(1, elapsed / C.CRITICAL_HIT_DURATION);
        if (progress >= 1) continue;

        const easedProgress = easeOutQuadAlt(progress);
        const currentRadius = crit.radius * easedProgress;
        const opacity = 1 - easedProgress;

        if (currentRadius <= 0) continue;

        // Draw pre-rendered gradient image
        ctx.save();
        ctx.globalAlpha = opacity;
        const diameter = currentRadius * 2;
        ctx.drawImage(critImage, crit.x - currentRadius, crit.y - currentRadius, diameter, diameter);
        ctx.restore();
        
        let alphaLevel = selectedHero === 'alpha' ? heroUpgrades.alpha_aoe_level : 0;
        if (crit.isBossDeath) alphaLevel = 1;

        if (alphaLevel > 0) {
            const secondRingProgress = Math.min(1, elapsed / (C.CRITICAL_HIT_DURATION * 0.8));
            const secondRadius = crit.radius * easeOutQuadAlt(secondRingProgress);
            ctx.globalAlpha = opacity * 0.7;
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(crit.x, crit.y, secondRadius, 0, 2 * Math.PI);
            ctx.stroke();
            
            const flashDuration = 150;
            if (elapsed < flashDuration) {
                const flashProgress = elapsed / flashDuration;
                const flashRadius = crit.radius * 0.25 * (1 - flashProgress);
                ctx.globalAlpha = 1 - flashProgress;
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(crit.x, crit.y, flashRadius, 0, 2 * Math.PI);
                ctx.fill();
            }
        }
    }
    ctx.restore();
}

export function drawAllImpacts(ctx: CanvasRenderingContext2D, currentState: GameState, now: number) {
    drawSplatterExplosions(ctx, currentState, now);
    drawRockImpacts(ctx, currentState, now);
    drawProjectileImpacts(ctx, currentState, now);
    drawCriticalHits(ctx, currentState, now);
}
