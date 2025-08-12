import { ObjectPool } from '../utils/objectPool';
import type {
    Projectile,
    EnemyProjectile,
    Explosion,
    DamageNumber,
    RockImpact,
    CriticalHitExplosion,
    ShellCasing,
    Gib,
    LightningBolt,
    EmpArc,
    WeaverBeam,
    UpgradePart,
    PowerUp,
    PowerUpInfusionEffect,
    InGameMessage,
} from '../types';

// Creator functions for each pooled object type. They return a default object.
const createProjectile = (): Projectile => ({ id: 0, x: 0, y: 0 });
const createEnemyProjectile = (): EnemyProjectile => ({ id: 0, x: 0, y: 0 });
const createExplosion = (): Explosion => ({ id: 0, x: 0, y: 0, createdAt: 0, particles: [] });
const createDamageNumber = (): DamageNumber => ({ id: 0, x: 0, y: 0, text: '', isCrit: false, createdAt: 0, initialDriftX: 0 });
const createRockImpact = (): RockImpact => ({ id: 0, x: 0, y: 0, createdAt: 0 });
const createCriticalHitExplosion = (): CriticalHitExplosion => ({ id: 0, x: 0, y: 0, radius: 0, createdAt: 0 });
const createShellCasing = (): ShellCasing => ({ id: 0, x: 0, y: 0, vx: 0, vy: 0, rotation: 0, rotationSpeed: 0, createdAt: 0 });
const createGib = (): Gib => ({ id: 0, x: 0, y: 0, vx: 0, vy: 0, rotation: 0, rotationSpeed: 0, createdAt: 0, color: '', size: 0 });
const createLightningBolt = (): LightningBolt => ({ id: 0, segments: '', createdAt: 0 });
const createEmpArc = (): EmpArc => ({ id: 0, startX: 0, startY: 0, endX: 0, endY: 0, createdAt: 0 });
const createWeaverBeam = (): WeaverBeam => ({ id: 0, y: 0, createdAt: 0 });
const createUpgradePart = (): UpgradePart => ({ id: 0, x: 0, y: 0, createdAt: 0, startX: 0, startY: 0 });
const createPowerUp = (): PowerUp => ({ id: 0, x: 0, y: 0, powerUpType: 'Shield' });
const createPowerUpInfusionEffect = (): PowerUpInfusionEffect => ({ id: 0, createdAt: 0, powerUpType: 'Shield' });
const createInGameMessage = (): InGameMessage => ({ id: 0, text: '', createdAt: 0, duration: 0, style: 'default' });

// The central export containing all object pools for the game.
export const pools = {
    projectiles: new ObjectPool<Projectile>(createProjectile, 100),
    enemyProjectiles: new ObjectPool<EnemyProjectile>(createEnemyProjectile, 150),
    explosions: new ObjectPool<Explosion>(createExplosion, 50),
    damageNumbers: new ObjectPool<DamageNumber>(createDamageNumber, 100),
    rockImpacts: new ObjectPool<RockImpact>(createRockImpact, 50),
    criticalHits: new ObjectPool<CriticalHitExplosion>(createCriticalHitExplosion, 20),
    shellCasings: new ObjectPool<ShellCasing>(createShellCasing, 100),
    gibs: new ObjectPool<Gib>(createGib, 300),
    lightning: new ObjectPool<LightningBolt>(createLightningBolt, 2), // Only one can be active, but pool is good practice
    empArcs: new ObjectPool<EmpArc>(createEmpArc, 30),
    weaverBeams: new ObjectPool<WeaverBeam>(createWeaverBeam, 20),
    upgradeParts: new ObjectPool<UpgradePart>(createUpgradePart, 10),
    powerUps: new ObjectPool<PowerUp>(createPowerUp, 20),
    powerUpInfusions: new ObjectPool<PowerUpInfusionEffect>(createPowerUpInfusionEffect, 10),
    inGameMessages: new ObjectPool<InGameMessage>(createInGameMessage, 10),
};
