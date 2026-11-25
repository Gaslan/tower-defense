import { Container, Graphics } from 'pixi.js';
import { PATH_SINK_OFFSET } from '../config/constants';
import { gridToScreen } from '../core/IsoMath';
import { Enemy } from './Enemy';
import type { HumanUnit } from './HumanUnit';

export class Projectile {
  public readonly container: Container;
  public readonly sourceUnit: HumanUnit;
  public readonly target: Enemy;
  public gx: number;
  public gy: number;
  public readonly speed: number;
  public readonly damage: number;
  public readonly aoeRadius: number;
  public readonly color: number;
  public hasImpacted = false;

  private readonly startGx: number;
  private readonly startGy: number;
  private readonly totalDist: number;
  private readonly graphic: Graphics;
  private targetGx: number;
  private targetGy: number;

  constructor(
    sourceUnit: HumanUnit,
    startGx: number,
    startGy: number,
    target: Enemy,
    speed: number,
    damage: number,
    color: number,
    aoeRadius = 0,
  ) {
    this.sourceUnit = sourceUnit;
    this.gx = startGx;
    this.gy = startGy;
    this.startGx = startGx;
    this.startGy = startGy;
    this.target = target;
    this.targetGx = target.gx;
    this.targetGy = target.gy;
    this.totalDist = Math.max(
      0.2,
      Math.hypot(this.targetGx - startGx, this.targetGy - startGy),
    );
    this.speed = speed;
    this.damage = damage;
    this.color = color;
    this.aoeRadius = aoeRadius;

    this.container = new Container();
    this.container.eventMode = 'none';

    this.graphic = new Graphics();
    const level = sourceUnit.level;
    if (sourceUnit.config.attackType === 'frost') {
      const coreColor = level >= 4 ? 0xffffff : 0x7df9ff;
      const rimColor = level >= 3 ? 0xbae6fd : 0x38bdf8;
      this.graphic
        .poly([-14, 0, -4, -3, -4, 3])
        .fill({ color: 0x38bdf8, alpha: 0.48 })
        .poly([8, 0, -1, -3.5, -7, 0, -1, 3.5])
        .fill(coreColor)
        .stroke({ width: 1.2, color: rimColor })
        .circle(1, 0, 1.8)
        .fill(0xffffff);
    } else if (aoeRadius > 0) {
      const cometCore = level >= 3 ? 0xf9e79f : 0xd980fa;
      const cometHalo = level >= 3 ? 0xf1c40f : color;
      this.graphic
        .poly([-15, 0, -4, -3.5, -4, 3.5])
        .fill({ color: cometHalo, alpha: 0.48 })
        .circle(0, 0, 7)
        .fill({ color: cometHalo, alpha: 0.35 })
        .poly([5.5, 0, 0, -4.2, -4.5, 0, 0, 4.2])
        .fill(cometCore)
        .stroke({ width: 1.2, color: 0xffffff })
        .circle(0, 0, 2)
        .fill(0xffffff);
    } else {
      const shaftColor = level >= 3 ? 0xf9e79f : 0xf4f6f7;
      const headColor = level >= 2 ? 0xf1c40f : 0xd5dbdb;
      const fletchColor = level >= 3 ? 0xe74c3c : 0x58d68d;
      const trailColor = level >= 3 ? 0xf1c40f : 0xabebc6;

      this.graphic
        .moveTo(-18, 0)
        .lineTo(-7, 0)
        .stroke({ width: 1.4, color: trailColor, alpha: 0.45 })
        .poly([-9, 0, -13, -3, -7, -0.8])
        .fill(fletchColor)
        .poly([-9, 0, -13, 3, -7, 0.8])
        .fill(fletchColor)
        .moveTo(-9, 0)
        .lineTo(6, 0)
        .stroke({ width: 1.8, color: shaftColor })
        .poly([10, 0, 4.5, -2.6, 5.8, 0, 4.5, 2.6])
        .fill(headColor)
        .stroke({ width: 0.8, color: 0x1b2631 });

      if (level >= 2) {
        this.graphic.circle(7, 0, 3.5).fill({
          color: level >= 3 ? 0xf1c40f : 0x58d68d,
          alpha: 0.28,
        });
      }
    }

    this.container.addChild(this.graphic);
    this.syncTransform();
  }

  public update(dt: number): void {
    if (this.hasImpacted) {
      return;
    }

    if (
      !this.target.isDead &&
      !this.target.isDying &&
      !this.target.reachedGoal
    ) {
      this.targetGx = this.target.gx;
      this.targetGy = this.target.gy;
    }

    const dx = this.targetGx - this.gx;
    const dy = this.targetGy - this.gy;
    const dist = Math.hypot(dx, dy);
    const stepDist = this.speed * dt;

    if (dist <= stepDist || dist < 0.05) {
      this.gx = this.targetGx;
      this.gy = this.targetGy;
      this.hasImpacted = true;
    } else {
      const ratio = stepDist / dist;
      this.gx += dx * ratio;
      this.gy += dy * ratio;
    }

    this.syncTransform();
  }

  public destroy(): void {
    this.container.parent?.removeChild(this.container);
    this.container.destroy({ children: true });
  }

  private syncTransform(): void {
    const screenPos = gridToScreen(this.gx, this.gy);
    const traveled = Math.hypot(
      this.gx - this.startGx,
      this.gy - this.startGy,
    );
    const currentTotal = Math.max(
      this.totalDist,
      Math.hypot(this.targetGx - this.startGx, this.targetGy - this.startGy),
    );
    const t = Math.min(1, Math.max(0, traveled / Math.max(0.2, currentTotal)));
    const arcPeak = this.aoeRadius === 0 ? 16 : 8;
    const arcHeight = Math.sin(t * Math.PI) * arcPeak;

    this.container.position.set(
      screenPos.x,
      screenPos.y + PATH_SINK_OFFSET * 0.5 - 12 - arcHeight,
    );

    const startScreen = gridToScreen(this.startGx, this.startGy);
    const targetScreen = gridToScreen(this.targetGx, this.targetGy);
    const vx = targetScreen.x - startScreen.x;
    const vy =
      targetScreen.y - startScreen.y - arcPeak * Math.PI * Math.cos(t * Math.PI);
    if (Math.abs(vx) > 0.01 || Math.abs(vy) > 0.01) {
      this.graphic.rotation = Math.atan2(vy, vx);
    }

    this.container.zIndex = this.gx + this.gy + 0.5;
  }
}
