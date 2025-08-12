import React, { useRef, useEffect } from 'react';
import type { Enemy as EnemyType, Asteroid as AsteroidType, PowerUp as PowerUpType, Projectile, EnemyProjectile, ShellCasing, Gib, DamageNumber, Explosion, SplatterParticle } from '../types';
import * as C from '../constants';
import { drawEnemy } from './canvas/drawEnemy';
import { drawAsteroid } from './canvas/drawAsteroid';
import { drawPowerUp } from './canvas/drawPowerUp';

interface GameCanvasProps {
  now: number;
  enemies: EnemyType[];
  asteroids: AsteroidType[];
  powerUps: PowerUpType[];
  projectiles: Projectile[];
  enemyProjectiles: EnemyProjectile[];
  shellCasings: ShellCasing[];
  gibs: Gib[];
  damageNumbers: DamageNumber[];
  explosions: Explosion[];
  projectileColor: string;
  reviveTriggerTime: number;
  width: number;
  height: number;
}

const GameCanvas: React.FC<GameCanvasProps> = (props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latestProps = useRef(props);
  latestProps.current = props;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const render = () => {
      const {
        now, enemies, asteroids, powerUps, projectiles, enemyProjectiles,
        shellCasings, gibs, damageNumbers, explosions, projectileColor,
        reviveTriggerTime, width, height
      } = latestProps.current;
      
      ctx.clearRect(0, 0, width, height);
      
      // --- Draw Game Objects (sorted by depth) ---
      const allEntities: (EnemyType | AsteroidType | PowerUpType)[] = [...enemies, ...asteroids, ...powerUps];
      allEntities.sort((a, b) => a.y - b.y);

      allEntities.forEach(entity => {
        ctx.save();
        
        const isPowerUp = 'powerUpType' in entity;
        const scale = isPowerUp 
            ? 0.4 + (entity.y / C.GAME_HEIGHT) * 0.6
            : 0.3 + (entity.y / C.GAME_HEIGHT) * 0.7;

        ctx.translate(entity.x, entity.y);
        ctx.scale(scale, scale);
        
        const wasHit = 'lastHitTime' in entity ? now - (entity.lastHitTime ?? 0) < 100 : false;

        if ('vx' in entity) { // It's an Asteroid
            ctx.save();
            ctx.rotate(entity.rotation * (Math.PI / 180));
            drawAsteroid(ctx, entity, wasHit);
            ctx.restore();
        } else if ('powerUpType' in entity) { // It's a PowerUp
            drawPowerUp(ctx, entity as PowerUpType);
        } else { // It's an Enemy
            drawEnemy(ctx, entity as EnemyType, wasHit);
        }
        
        ctx.restore();
      });

      // --- Draw Effects ---
      
      // --- Draw Revive Pulse ---
      const revivePulseDuration = 800;
      if (reviveTriggerTime > 0 && now - reviveTriggerTime < revivePulseDuration) {
          const elapsed = now - reviveTriggerTime;
          const progress = elapsed / revivePulseDuration;
          const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5);
          const easedProgress = easeOutQuint(progress);
          const scale = easedProgress * 2;
          const opacity = 0.8 * (1 - progress);

          if (scale > 0 && opacity > 0) {
              const centerX = width / 2;
              const centerY = height / 2;
              const radius = (width / 2) * scale; 
              const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
              gradient.addColorStop(0, `rgba(254, 252, 232, ${0.8 * opacity})`);
              gradient.addColorStop(0.7, `rgba(250, 204, 21, 0)`);
              gradient.addColorStop(1, 'rgba(250, 204, 21, 0)');
              ctx.fillStyle = gradient;
              ctx.beginPath();
              ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
              ctx.fill();
          }
      }

      // --- Draw Splatter Explosions ---
      const splatterColors = ['#f09', '#ff007f', '#fff'];
      ctx.shadowBlur = 10;
      explosions.forEach(exp => {
        const elapsed = now - exp.createdAt;
        if (elapsed > 500) return;
        const progress = elapsed / 500;
        const easedProgress = easeOutCubic(progress);
        const opacity = 1 - easedProgress;
        const scale = 1.2 * (1 - easedProgress);
        if (scale <= 0 || opacity <= 0) return;
        ctx.globalAlpha = opacity;
        for (const color of splatterColors) {
          ctx.fillStyle = color;
          ctx.shadowColor = color;
          ctx.beginPath();
          exp.particles.forEach(p => {
            if (p.color !== color) return;
            const currentDist = p.distance * easedProgress;
            const offsetX = Math.cos(p.angle) * currentDist;
            const offsetY = Math.sin(p.angle) * currentDist;
            const currentRadius = (p.size * scale) / 2;
            if (currentRadius > 0) {
              ctx.moveTo(exp.x + offsetX + currentRadius, exp.y + offsetY);
              ctx.arc(exp.x + offsetX, exp.y + offsetY, currentRadius, 0, 2 * Math.PI);
            }
          });
          ctx.fill();
        }
      });
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';

      // --- Draw Player Projectiles ---
      projectiles.forEach(p => {
        const isCluster = !!p.isTridentCluster;
        const scale = 0.4 + (p.y / C.GAME_HEIGHT) * 0.6;
        const projectileHeight = C.PROJECTILE_HEIGHT * scale * (isCluster ? 1.2 : 1);
        const projectileWidth = 6 * scale * (isCluster ? 1.5 : 1);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.angle || 0) * (Math.PI / 180));
        ctx.shadowColor = projectileColor;
        ctx.shadowBlur = (isCluster ? 20 : 15) * scale;
        ctx.fillStyle = projectileColor;
        ctx.fillRect(-projectileWidth / 2, -projectileHeight / 2, projectileWidth, projectileHeight);
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(-projectileWidth / 4, -projectileHeight / 2, projectileWidth / 2, projectileHeight);
        ctx.restore();
      });

      // --- Draw Enemy Projectiles ---
      ctx.shadowColor = '#22c55e';
      enemyProjectiles.forEach(p => {
        const scale = 0.4 + (p.y / C.GAME_HEIGHT) * 0.6;
        const projectileRadius = (C.ENEMY_PROJECTILE_WIDTH / 2) * scale;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.shadowBlur = 15 * scale;
        ctx.fillStyle = '#bbf7d0';
        ctx.beginPath();
        ctx.arc(0, 0, projectileRadius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
      });
      ctx.shadowBlur = 0;

      // --- Draw Shell Casings ---
      ctx.fillStyle = '#f59e0b';
      shellCasings.forEach(c => {
          const scale = 0.4 + (c.y / C.GAME_HEIGHT) * 0.6;
          ctx.save();
          ctx.translate(c.x, c.y);
          ctx.rotate(c.rotation * (Math.PI / 180));
          ctx.scale(scale, scale);
          ctx.fillRect(-4, -1.5, 8, 3);
          ctx.restore();
      });

      // --- Draw Gibs ---
      gibs.forEach(gib => {
        const scale = 0.4 + (gib.y / C.GAME_HEIGHT) * 0.6;
        const opacity = 1 - (now - gib.createdAt) / C.GIB_LIFETIME;
        if (opacity <= 0) return;
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.translate(gib.x, gib.y);
        ctx.rotate(gib.rotation * (Math.PI / 180));
        ctx.scale(scale, scale);
        ctx.fillStyle = gib.color;
        ctx.fillRect(-gib.size / 2, -gib.size / 2, gib.size, gib.size);
        ctx.restore();
      });

      // --- Draw Damage Numbers ---
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      damageNumbers.forEach(dn => {
        const elapsed = now - dn.createdAt;
        const progress = Math.min(1, elapsed / C.DAMAGE_NUMBER_LIFETIME);
        if (progress >= 1) return;
        ctx.save();
        let yOffset = 0, scale = 1, opacity = 1;
        if (dn.isCrit) {
            if (progress < 0.2) {
                const stageProgress = progress / 0.2;
                yOffset = -10 * stageProgress;
                scale = 1 + 0.6 * stageProgress;
            } else {
                const stageProgress = (progress - 0.2) / 0.8;
                yOffset = -10 - 50 * stageProgress;
                scale = 1.6 - 0.4 * stageProgress;
                opacity = 1 - stageProgress;
            }
        } else {
            yOffset = -40 * progress;
            opacity = 1 - progress;
        }
        ctx.globalAlpha = opacity;
        ctx.translate(dn.x + dn.initialDriftX, dn.y + yOffset);
        ctx.scale(scale, scale);
        if (dn.isCrit) {
            ctx.font = '900 24px "Exo 2", sans-serif';
            ctx.shadowColor = '#ff0'; ctx.shadowBlur = 5; ctx.fillStyle = '#fde047';
            ctx.fillText(dn.text, 0, 0);
            ctx.shadowColor = '#000'; ctx.shadowBlur = 2;
            ctx.fillText(dn.text, 0, 0);
        } else {
            ctx.font = 'bold 18px "Exo 2", sans-serif';
            ctx.shadowColor = '#000'; ctx.shadowBlur = 3; ctx.fillStyle = '#fff';
            ctx.fillText(dn.text, 0, 0);
        }
        ctx.restore();
      });

      animationFrameId = window.requestAnimationFrame(render);
    };

    render();

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} width={props.width} height={props.height} className="absolute inset-0 pointer-events-none" style={{ zIndex: 16, transform: 'translateZ(16px)' }} />;
};

export default React.memo(GameCanvas);