import { ObjectPool } from '../utils/objectPool';
import type {
    Projectile,
    EnemyProjectile,
    Explosion,
    DamageNumber,
    RockImpact,
    ProjectileImpact,
    CriticalHitExplosion,
    ShellCasing,
    Gib,
    LightningBolt,
    EmpArc,
    WeaverBeam,
    WeaverSurge,
    UpgradePart,
    PowerUp,
    PowerUpInfusionEffect,
    InGameMessage,
    Enemy,
    Asteroid,
    SplatterParticle,
} from '../types';
import * as C from '../constants';

// Creator functions for each pooled object type. They return a default object.
const createProjectile = (): Projectile => ({
    id: 0,
    x: 0,
    y: 0,
    angle: 0,
    isTridentCluster: false,
});
const createEnemyProjectile = (): EnemyProjectile => ({
    id: 0,
    x: 0,
    y: 0,
    angle: 0,
    isDuplicated: false,
    speed: C.ENEMY_PROJECTILE_SPEED,
    prevX: undefined,
    prevY: undefined,
});
const createExplosion = (): Explosion => ({ id: 0, x: 0, y: 0, createdAt: 0, particles: [] });
const createSplatterParticle = (): SplatterParticle => ({ angle: 0, distance: 0, size: 0, color: '' });
const createDamageNumber = (): DamageNumber => ({ id: 0, x: 0, y: 0, text: '', isCrit: false, createdAt: 0, initialDriftX: 0 });
const createRockImpact = (): RockImpact => ({ id: 0, x: 0, y: 0, createdAt: 0 });
const createProjectileImpact = (): ProjectileImpact => ({ id: 0, x: 0, y: 0, createdAt: 0, color: '', radius: 0 });
const createCriticalHitExplosion = (): CriticalHitExplosion => ({ id: 0, x: 0, y: 0, radius: 0, createdAt: 0 });
const createShellCasing = (): ShellCasing => ({ id: 0, x: 0, y: 0, vx: 0, vy: 0, rotation: 0, rotationSpeed: 0, createdAt: 0 });
const createGib = (): Gib => ({ id: 0, x: 0, y: 0, vx: 0, vy: 0, rotation: 0, rotationSpeed: 0, createdAt: 0, color: '', size: 0 });
const createLightningBolt = (): LightningBolt => ({ id: 0, segments: '', points: [], createdAt: 0 });
const createEmpArc = (): EmpArc => ({ id: 0, segments: '', points: [], createdAt: 0 });
const createWeaverBeam = (): WeaverBeam => ({ id: 0, y: 0, createdAt: 0 });
const createWeaverSurge = (): WeaverSurge => ({ id: 0, x: 0, y: 0, createdAt: 0 });
const createUpgradePart = (): UpgradePart => ({ id: 0, x: 0, y: 0, createdAt: 0, startX: 0, startY: 0 });
const createPowerUp = (): PowerUp => ({ id: 0, x: 0, y: 0, powerUpType: 'Shield' });
const createPowerUpInfusionEffect = (): PowerUpInfusionEffect => ({ id: 0, createdAt: 0, powerUpType: 'Shield' });
const createInGameMessage = (): InGameMessage => ({ id: 0, text: '', createdAt: 0, duration: 0, style: 'default' });
const createEnemy = (): Enemy => ({
    id: 0,
    x: 0,
    y: 0,
    type: 'standard',
    health: 0,
    maxHealth: 0,
    lastShotTime: 0,
    baseX: 0,
    oscillationFrequency: 0,
    oscillationAmplitude: 0,
    oscillationOffset: 0,
    // Dodger properties
    isDodging: false,
    dodgeCooldownUntil: 0,
    dodgeTargetX: undefined,
    trailPoints: undefined,
    isEncounterEnemy: false,
    // Weaver properties
    isPausing: false,
    pauseEndTime: 0,
    diveTargetY: undefined,
    lastBeamTime: 0,
    nextAttack: undefined,
    // Buff/debuff properties
    isBuffedByConduit: false,
    debuffs: undefined,
    // Shield properties
    shieldHealth: undefined,
    shieldRegenTime: undefined,
    shieldCooldownUntil: 0,
    // Conduit properties
    linkedEnemyId: null,
    // Visual effect properties
    lastHitTime: 0,
});
const createAsteroid = (): Asteroid => ({
    id: 0,
    x: 0,
    y: 0,
    health: 0,
    maxHealth: 0,
    vx: 0,
    vy: 0,
    size: 0,
    rotation: 0,
    rotationSpeed: 0,
    isBuffedByConduit: false,
    shieldCooldownUntil: 0,
    debuffs: undefined,
    lastHitTime: 0,
});

// The central export containing all object pools for the game.
export const pools = {
    projectiles: new ObjectPool<Projectile>(createProjectile, 100),
    enemyProjectiles: new ObjectPool<EnemyProjectile>(createEnemyProjectile, 150),
    explosions: new ObjectPool<Explosion>(createExplosion, 50),
    splatterParticles: new ObjectPool<SplatterParticle>(createSplatterParticle, 500),
    damageNumbers: new ObjectPool<DamageNumber>(createDamageNumber, 100),
    rockImpacts: new ObjectPool<RockImpact>(createRockImpact, 50),
    projectileImpacts: new ObjectPool<ProjectileImpact>(createProjectileImpact, 50),
    criticalHits: new ObjectPool<CriticalHitExplosion>(createCriticalHitExplosion, 20),
    shellCasings: new ObjectPool<ShellCasing>(createShellCasing, 100),
    gibs: new ObjectPool<Gib>(createGib, 300),
    lightning: new ObjectPool<LightningBolt>(createLightningBolt, 2), // Only one can be active, but pool is good practice
    empArcs: new ObjectPool<EmpArc>(createEmpArc, 30),
    weaverBeams: new ObjectPool<WeaverBeam>(createWeaverBeam, 20),
    weaverSurges: new ObjectPool<WeaverSurge>(createWeaverSurge, 10),
    upgradeParts: new ObjectPool<UpgradePart>(createUpgradePart, 10),
    powerUps: new ObjectPool<PowerUp>(createPowerUp, 20),
    powerUpInfusions: new ObjectPool<PowerUpInfusionEffect>(createPowerUpInfusionEffect, 10),
    inGameMessages: new ObjectPool<InGameMessage>(createInGameMessage, 10),
    enemies: new ObjectPool<Enemy>(createEnemy, 100),
    asteroids: new ObjectPool<Asteroid>(createAsteroid, 50),
};

/**
 * Touches objects in critical pools to ensure V8 Hidden Classes are optimized
 * and memory is allocated before the game starts.
 */
export function warmUpPools() {
    pools.projectiles.warmUp((p) => { p.x = 0; p.y = 0; p.angle = 0; });
    pools.enemies.warmUp((e) => { e.x = 0; e.y = 0; e.health = 100; });
    pools.splatterParticles.warmUp((p) => { p.angle = 0; p.size = 1; });
    pools.enemyProjectiles.warmUp((p) => { p.x = 0; p.speed = 0; });
    pools.asteroids.warmUp((a) => { a.x = 0; a.vx = 0; });
}