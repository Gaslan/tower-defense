import { Container, Graphics } from 'pixi.js';
import type { GameState } from '../core/GameState';

export type ParticleShape = 'circle' | 'square';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: number;
  alpha: number;
  life: number;
  maxLife: number;
  gravity: number;
  drag: number;
  shape: ParticleShape;
}

const MAX_PARTICLES = 400;
const GOLD_SPARK_COLORS: readonly number[] = [0xf5b041, 0xffd166];
const METEOR_BURST_COLORS: readonly number[] = [
  0xff4d00,
  0xff7b00,
  0xffb703,
  0xe63946,
  0xfff3b0,
];
const FROST_BURST_COLORS: readonly number[] = [
  0x38bdf8,
  0x7df9ff,
  0xbae6fd,
  0xffffff,
];
const UPGRADE_COLORS: readonly number[] = [
  0xf5b041,
  0xffd166,
  0xfff3b0,
  0xffffff,
];

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export class ParticleSystem {
  private readonly gameState: GameState;
  private readonly graphics: Graphics;
  private readonly particles: Particle[] = [];
  private overwriteIndex = 0;

  constructor(fxLayer: Container, gameState: GameState) {
    this.gameState = gameState;
    this.graphics = new Graphics();
    this.graphics.eventMode = 'none';
    fxLayer.addChild(this.graphics);
  }

  public spawnHitSparks(
    screenX: number,
    screenY: number,
    color = 0xffffff,
    count = 6,
  ): void {
    if (!this.gameState.isParticlesEnabled()) {
      return;
    }
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = randomRange(55, 135);
      const maxLife = randomRange(0.2, 0.28);
      const sparkColor = i % 3 === 0 ? 0xffffff : color;

      this.pushParticle({
        x: screenX + randomRange(-3, 3),
        y: screenY + randomRange(-3, 3),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - randomRange(10, 30),
        size: randomRange(1.8, 3.2),
        color: sparkColor,
        alpha: 1,
        life: maxLife,
        maxLife,
        gravity: 140,
        drag: 0.92,
        shape: i % 2 === 0 ? 'circle' : 'square',
      });
    }
  }

  public spawnDeathBurst(
    screenX: number,
    screenY: number,
    enemyColor: number,
  ): void {
    if (!this.gameState.isParticlesEnabled()) {
      return;
    }
    const count = 14 + Math.floor(Math.random() * 5);

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = randomRange(45, 145);
      const maxLife = randomRange(0.45, 0.62);
      const isGoldSpark = i % 4 === 0;
      const color = isGoldSpark
        ? GOLD_SPARK_COLORS[i % GOLD_SPARK_COLORS.length]
        : enemyColor;

      this.pushParticle({
        x: screenX + randomRange(-4, 4),
        y: screenY + randomRange(-4, 4),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.7 - randomRange(40, 95),
        size: randomRange(2.5, 4.8),
        color,
        alpha: 1,
        life: maxLife,
        maxLife,
        gravity: 260,
        drag: 0.94,
        shape: i % 2 === 0 ? 'circle' : 'square',
      });
    }
  }

  public spawnUpgradeBurst(screenX: number, screenY: number): void {
    if (!this.gameState.isParticlesEnabled()) {
      return;
    }
    const count = 16;

    for (let i = 0; i < count; i++) {
      const maxLife = randomRange(0.5, 0.75);
      const color = UPGRADE_COLORS[i % UPGRADE_COLORS.length];

      this.pushParticle({
        x: screenX + randomRange(-14, 14),
        y: screenY + randomRange(-6, 8),
        vx: randomRange(-24, 24),
        vy: -randomRange(35, 85),
        size: randomRange(2.0, 3.8),
        color,
        alpha: 1,
        life: maxLife,
        maxLife,
        gravity: -95,
        drag: 0.95,
        shape: i % 3 === 0 ? 'square' : 'circle',
      });
    }
  }

  public spawnMeteorBurst(screenX: number, screenY: number): void {
    if (!this.gameState.isParticlesEnabled()) {
      return;
    }

    const count = 34;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = randomRange(75, 220);
      const maxLife = randomRange(0.35, 0.72);
      const color = METEOR_BURST_COLORS[i % METEOR_BURST_COLORS.length];

      this.pushParticle({
        x: screenX + randomRange(-10, 10),
        y: screenY + randomRange(-6, 6),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.65 - randomRange(45, 130),
        size: randomRange(3.0, 6.2),
        color,
        alpha: 1,
        life: maxLife,
        maxLife,
        gravity: 280,
        drag: 0.93,
        shape: i % 3 === 0 ? 'square' : 'circle',
      });
    }
  }

  public spawnFrostBurst(
    screenX: number,
    screenY: number,
    count = 10,
  ): void {
    if (!this.gameState.isParticlesEnabled()) {
      return;
    }

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = randomRange(30, 95);
      const maxLife = randomRange(0.4, 0.75);
      const color = FROST_BURST_COLORS[i % FROST_BURST_COLORS.length];

      this.pushParticle({
        x: screenX + randomRange(-6, 6),
        y: screenY + randomRange(-6, 4),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.6 - randomRange(18, 48),
        size: randomRange(2.0, 4.0),
        color,
        alpha: 1,
        life: maxLife,
        maxLife,
        gravity: -35,
        drag: 0.94,
        shape: i % 2 === 0 ? 'square' : 'circle',
      });
    }
  }

  public spawnIceShatter(
    screenX: number,
    screenY: number,
    count = 14,
  ): void {
    if (!this.gameState.isParticlesEnabled()) {
      return;
    }

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = randomRange(55, 145);
      const maxLife = randomRange(0.28, 0.52);
      const color = FROST_BURST_COLORS[i % FROST_BURST_COLORS.length];

      this.pushParticle({
        x: screenX + randomRange(-5, 5),
        y: screenY + randomRange(-6, 4),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.65 - randomRange(25, 65),
        size: randomRange(2.2, 4.2),
        color,
        alpha: 1,
        life: maxLife,
        maxLife,
        gravity: 160,
        drag: 0.92,
        shape: 'square',
      });
    }
  }

  public spawnGoldSparkles(
    screenX: number,
    screenY: number,
    count = 14,
  ): void {
    if (!this.gameState.isParticlesEnabled()) {
      return;
    }

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = randomRange(38, 105);
      const maxLife = randomRange(0.4, 0.68);
      const color = UPGRADE_COLORS[i % UPGRADE_COLORS.length];

      this.pushParticle({
        x: screenX + randomRange(-10, 10),
        y: screenY + randomRange(-8, 6),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.65 - randomRange(30, 75),
        size: randomRange(2.0, 3.8),
        color,
        alpha: 1,
        life: maxLife,
        maxLife,
        gravity: 110,
        drag: 0.94,
        shape: i % 3 === 0 ? 'square' : 'circle',
      });
    }
  }

  public update(dt: number): void {
    if (dt <= 0) {
      return;
    }
    this.graphics.clear();
    if (this.particles.length === 0) {
      return;
    }

    const dragStep = dt * 60;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;

      if (p.life <= 0) {
        const last = this.particles.pop();
        if (i < this.particles.length && last) {
          this.particles[i] = last;
        }
        continue;
      }

      const dragFactor = Math.pow(p.drag, dragStep);
      p.vx *= dragFactor;
      p.vy = p.vy * dragFactor + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      const ratio = Math.max(0, p.life / p.maxLife);
      const drawSize = Math.max(0.5, p.size * (0.3 + 0.7 * ratio));
      p.alpha = ratio;

      if (p.shape === 'circle') {
        this.graphics.circle(p.x, p.y, drawSize).fill({
          color: p.color,
          alpha: p.alpha,
        });
      } else {
        this.graphics
          .rect(p.x - drawSize, p.y - drawSize, drawSize * 2, drawSize * 2)
          .fill({
            color: p.color,
            alpha: p.alpha,
          });
      }
    }
  }

  public clear(): void {
    this.particles.length = 0;
    this.overwriteIndex = 0;
    this.graphics.clear();
  }

  private pushParticle(particle: Particle): void {
    if (!this.gameState.isParticlesEnabled()) {
      return;
    }
    if (this.particles.length < MAX_PARTICLES) {
      this.particles.push(particle);
      return;
    }
    this.particles[this.overwriteIndex] = particle;
    this.overwriteIndex = (this.overwriteIndex + 1) % MAX_PARTICLES;
  }
}
