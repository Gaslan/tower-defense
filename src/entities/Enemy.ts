import { AnimatedSprite, Container, Graphics } from 'pixi.js';
import {
  PATH_SINK_OFFSET,
  PATH_WAYPOINTS,
  type Waypoint,
} from '../config/constants';
import type { EnemySpawnSpec, EnemyTypeId } from '../config/enemies';
import type { EnemySpriteKey } from '../config/sprites';
import { gridToScreen } from '../core/IsoMath';
import {
  SpriteManager,
  type EnemySpriteFrames,
} from '../graphics/SpriteManager';
import type { HumanUnit } from './HumanUnit';

const HP_BAR_HEIGHT = 4;

export class Enemy {
  public readonly container: Container;
  public gx: number;
  public gy: number;
  public progress = 0;
  public readonly typeId: EnemyTypeId;
  public readonly isBoss: boolean;
  public readonly radius: number;
  public readonly maxHp: number;
  public hp: number;
  public readonly speed: number;
  public readonly rewardGold: number;
  public readonly xpReward: number;
  public readonly color: number;
  public slowTimer = 0;
  public slowFactor = 1;
  public freezeTimer = 0;
  public stunTimer = 0;
  public burnTimer = 0;
  public burnDps = 0;
  public burnSourceUnit: HumanUnit | null = null;
  public isDead = false;
  public isDying = false;
  public countedDefeated = false;
  public reachedGoal = false;

  private readonly waypoints: readonly Waypoint[];
  private waypointIndex = 1;
  private walkPhase = Math.random() * Math.PI * 2;
  private prevScreenX: number;
  private facing: 1 | -1 = 1;
  private playbackSpeedMultiplier = 1;
  private isDestroyed = false;
  private readonly hpBarWidth: number;
  private readonly hpBarY: number;
  private readonly shadowGraphic: Graphics;
  private readonly slowRingGraphic: Graphics;
  private readonly freezeBlockGraphic: Graphics;
  private readonly stunGraphic: Graphics;
  private readonly bodyContainer: Container;
  private readonly bodyGraphic: Graphics;
  private readonly spriteData: EnemySpriteFrames | null;
  private readonly animatedSprite: AnimatedSprite | null = null;
  private readonly spriteBaseScale: number = 1;
  private readonly hpBarGraphic: Graphics;

  constructor(
    spec: EnemySpawnSpec,
    waypoints: readonly Waypoint[] = PATH_WAYPOINTS,
  ) {
    this.waypoints = waypoints;
    this.typeId = spec.typeId;
    this.isBoss = spec.isBoss;
    this.radius = spec.radius;
    this.maxHp = spec.maxHp;
    this.hp = spec.maxHp;
    this.speed = spec.speed;
    this.rewardGold = spec.rewardGold;
    this.xpReward = spec.xpReward;
    this.color = spec.color;
    this.hpBarWidth = spec.isBoss ? 32 : 24;

    const spriteKey: EnemySpriteKey = spec.isBoss ? 'boss' : spec.typeId;
    this.spriteData = SpriteManager.hasEnemySprite(spriteKey)
      ? SpriteManager.getEnemyFrames(spriteKey)
      : null;

    this.hpBarY = this.spriteData
      ? -Math.round(
          this.spriteData.config.displayHeight *
            this.spriteData.config.anchorY *
            0.84,
        ) - 6
      : -spec.radius * 2 - 10;

    const start = this.waypoints[0];
    this.gx = start.gx;
    this.gy = start.gy;
    this.prevScreenX = gridToScreen(this.gx, this.gy).x;

    this.container = new Container();
    this.container.eventMode = 'none';

    this.shadowGraphic = new Graphics();
    this.shadowGraphic
      .ellipse(0, 2, spec.radius * 1.15, spec.radius * 0.5)
      .fill({ color: 0x000000, alpha: 0.3 });

    if (spec.isBoss) {
      this.shadowGraphic
        .ellipse(0, 2, spec.radius * 1.35, spec.radius * 0.65)
        .stroke({ width: 1.5, color: 0xf1c40f, alpha: 0.85 });
    }

    this.slowRingGraphic = new Graphics();
    this.slowRingGraphic
      .ellipse(0, 2, spec.radius * 1.48, spec.radius * 0.68)
      .fill({ color: 0x38bdf8, alpha: 0.18 })
      .stroke({ width: 1.6, color: 0x7df9ff, alpha: 0.88 });
    this.slowRingGraphic.visible = false;

    this.bodyContainer = new Container();
    this.bodyGraphic = new Graphics();
    if (this.spriteData) {
      this.bodyContainer.visible = false;
      const spriteCfg = this.spriteData.config;
      const sprite = new AnimatedSprite(this.spriteData.walk);
      sprite.eventMode = 'none';
      sprite.anchor.set(0.5, spriteCfg.anchorY);
      this.spriteBaseScale = spriteCfg.displayHeight / spriteCfg.frameHeight;
      sprite.scale.set(this.spriteBaseScale);
      sprite.animationSpeed = spriteCfg.walkFps / 60;
      sprite.loop = true;
      sprite.play();
      this.animatedSprite = sprite;
    } else {
      this.drawMonsterBody(spec);
      this.bodyContainer.addChild(this.bodyGraphic);
    }

    this.freezeBlockGraphic = new Graphics();
    const r = spec.radius;
    this.freezeBlockGraphic
      .poly([
        -r * 1.25,
        2,
        -r * 1.15,
        -r * 1.85,
        0,
        -r * 2.45,
        r * 1.15,
        -r * 1.85,
        r * 1.25,
        2,
        0,
        5,
      ])
      .fill({ color: 0x38bdf8, alpha: 0.42 })
      .stroke({ width: 1.6, color: 0xbae6fd, alpha: 0.92 })
      .poly([-r * 0.8, -r * 1.6, 0, -r * 2.25, 0, 2, -r * 0.9, 0])
      .fill({ color: 0xffffff, alpha: 0.22 });
    this.freezeBlockGraphic.visible = false;

    this.hpBarGraphic = new Graphics();
    this.drawHealthBar();

    this.stunGraphic = new Graphics();
    this.stunGraphic
      .circle(-5, 0, 1.8)
      .fill(0xf1c40f)
      .circle(5, 0, 1.8)
      .fill(0xfff3b0)
      .circle(0, -4, 1.8)
      .fill(0xf1c40f)
      .ellipse(0, -1, 6.5, 3)
      .stroke({ width: 1.1, color: 0xf9e79f, alpha: 0.9 });
    this.stunGraphic.position.set(0, this.hpBarY - 6);
    this.stunGraphic.visible = false;

    this.container.addChild(
      this.shadowGraphic,
      this.slowRingGraphic,
      this.animatedSprite ?? this.bodyContainer,
      this.freezeBlockGraphic,
      this.hpBarGraphic,
      this.stunGraphic,
    );
    this.syncTransform();
  }

  public syncPlayback(isPaused: boolean, gameSpeed: number): void {
    this.playbackSpeedMultiplier = gameSpeed;
    if (!this.animatedSprite || !this.spriteData || this.isDestroyed) {
      return;
    }

    if (this.isDying) {
      if (isPaused) {
        if (this.animatedSprite.playing) {
          this.animatedSprite.stop();
        }
      } else {
        this.animatedSprite.animationSpeed =
          (this.spriteData.config.deathFps / 60) * gameSpeed;
        if (!this.animatedSprite.playing) {
          this.animatedSprite.play();
        }
      }
      return;
    }

    if (this.isDead) {
      return;
    }

    const shouldStop = isPaused || this.freezeTimer > 0 || this.stunTimer > 0;
    if (shouldStop) {
      if (this.animatedSprite.playing) {
        this.animatedSprite.stop();
      }
      return;
    }

    const slowMult = this.slowTimer > 0 ? this.slowFactor : 1;
    this.animatedSprite.animationSpeed =
      (this.spriteData.config.walkFps / 60) * gameSpeed * slowMult;
    if (!this.animatedSprite.playing) {
      this.animatedSprite.play();
    }
  }

  public applySlow(factor: number, duration: number): void {
    if (this.isDead || this.isDying || this.reachedGoal || duration <= 0) {
      return;
    }

    const clamped = Math.max(0.1, Math.min(1, factor));
    this.slowFactor =
      this.slowTimer > 0 ? Math.min(this.slowFactor, clamped) : clamped;
    this.slowTimer = Math.max(this.slowTimer, duration);
    this.slowRingGraphic.visible = true;
    this.updateBodyTint();
  }

  public applyStun(duration: number): void {
    if (this.isDead || this.isDying || this.reachedGoal || duration <= 0) {
      return;
    }
    this.stunTimer = Math.max(this.stunTimer, duration);
    this.stunGraphic.visible = true;
  }

  public applyFreeze(duration: number): void {
    if (this.isDead || this.isDying || this.reachedGoal || duration <= 0) {
      return;
    }
    this.freezeTimer = Math.max(this.freezeTimer, duration);
    this.freezeBlockGraphic.visible = true;
    this.updateBodyTint();
  }

  public applyBurn(
    dps: number,
    duration: number,
    sourceUnit: HumanUnit | null,
  ): void {
    if (
      this.isDead ||
      this.isDying ||
      this.reachedGoal ||
      dps <= 0 ||
      duration <= 0
    ) {
      return;
    }
    this.burnDps = Math.max(this.burnDps, dps);
    this.burnTimer = Math.max(this.burnTimer, duration);
    if (sourceUnit) {
      this.burnSourceUnit = sourceUnit;
    }
    this.updateBodyTint();
  }

  public updateBurn(dt: number): boolean {
    if (
      this.isDead ||
      this.isDying ||
      this.reachedGoal ||
      this.burnTimer <= 0 ||
      dt <= 0
    ) {
      return false;
    }

    const activeDt = Math.min(this.burnTimer, dt);
    this.burnTimer = Math.max(0, this.burnTimer - activeDt);
    this.takeDamage(this.burnDps * activeDt);

    if (this.burnTimer <= 0) {
      this.burnDps = 0;
      this.burnSourceUnit = null;
    }
    this.updateBodyTint();
    return this.isDead;
  }

  public update(dt: number): void {
    if (this.isDead || this.isDying || this.reachedGoal) {
      return;
    }

    if (this.slowTimer > 0) {
      this.slowTimer = Math.max(0, this.slowTimer - dt);
      if (this.slowTimer <= 0) {
        this.slowFactor = 1;
        this.slowRingGraphic.visible = false;
        this.updateBodyTint();
      }
    }

    if (this.freezeTimer > 0) {
      this.freezeTimer = Math.max(0, this.freezeTimer - dt);
      if (this.freezeTimer <= 0) {
        this.freezeBlockGraphic.visible = false;
        this.updateBodyTint();
      } else {
        this.bodyContainer.y = 0;
        this.bodyContainer.rotation = 0;
        this.syncTransform();
        return;
      }
    }

    if (this.stunTimer > 0) {
      this.stunTimer = Math.max(0, this.stunTimer - dt);
      if (this.stunTimer <= 0) {
        this.stunGraphic.visible = false;
      } else {
        this.stunGraphic.rotation += dt * 5.5;
        this.bodyContainer.y = 0;
        this.bodyContainer.rotation = 0;
        this.syncTransform();
        return;
      }
    }

    const effectiveSpeed =
      this.speed * (this.slowTimer > 0 ? this.slowFactor : 1);
    let remaining = effectiveSpeed * dt;
    while (remaining > 0 && this.waypointIndex < this.waypoints.length) {
      const target = this.waypoints[this.waypointIndex];
      const dx = target.gx - this.gx;
      const dy = target.gy - this.gy;
      const dist = Math.hypot(dx, dy);

      if (dist <= remaining) {
        this.gx = target.gx;
        this.gy = target.gy;
        this.progress += dist;
        remaining -= dist;
        this.waypointIndex++;
      } else {
        const step = remaining / dist;
        this.gx += dx * step;
        this.gy += dy * step;
        this.progress += remaining;
        remaining = 0;
      }
    }

    if (this.waypointIndex >= this.waypoints.length) {
      this.reachedGoal = true;
    }

    if (!this.animatedSprite) {
      this.walkPhase += dt * effectiveSpeed * 7.5;
      this.bodyContainer.y = -Math.abs(Math.sin(this.walkPhase)) * 3.2;
      this.bodyContainer.rotation = Math.sin(this.walkPhase) * 0.09;
    }

    this.syncTransform();
  }

  public takeDamage(amount: number): void {
    if (this.isDead || this.isDying || this.reachedGoal) {
      return;
    }

    this.hp = Math.max(0, this.hp - amount);
    this.drawHealthBar();
    if (this.hp <= 0) {
      this.isDead = true;
      if (this.animatedSprite && this.spriteData?.death) {
        this.startDeathAnimation(this.spriteData.death);
      }
    }
  }

  private startDeathAnimation(deathFrames: EnemySpriteFrames['walk']): void {
    if (!this.animatedSprite || !this.spriteData) {
      return;
    }
    this.isDying = true;
    this.slowTimer = 0;
    this.freezeTimer = 0;
    this.stunTimer = 0;
    this.burnTimer = 0;
    this.burnDps = 0;
    this.burnSourceUnit = null;

    this.hpBarGraphic.visible = false;
    this.slowRingGraphic.visible = false;
    this.freezeBlockGraphic.visible = false;
    this.stunGraphic.visible = false;
    this.animatedSprite.tint = 0xffffff;

    this.animatedSprite.textures = deathFrames;
    this.animatedSprite.loop = false;
    this.animatedSprite.animationSpeed =
      (this.spriteData.config.deathFps / 60) * this.playbackSpeedMultiplier;
    this.animatedSprite.onComplete = (): void => {
      this.isDying = false;
    };
    this.animatedSprite.gotoAndPlay(0);
  }

  public destroy(): void {
    if (this.isDestroyed) {
      return;
    }
    this.isDestroyed = true;
    this.container.parent?.removeChild(this.container);
    this.container.destroy({ children: true });
  }

  private updateBodyTint(): void {
    const tint =
      this.freezeTimer > 0
        ? 0x7df9ff
        : this.burnTimer > 0
          ? 0xff9f43
          : this.slowTimer > 0
            ? 0x8be9fd
            : 0xffffff;
    this.bodyGraphic.tint = tint;
    if (this.animatedSprite && !this.isDying) {
      this.animatedSprite.tint = tint;
    }
  }

  private drawMonsterBody(spec: EnemySpawnSpec): void {
    const r = spec.radius;
    const g = this.bodyGraphic;

    switch (spec.typeId) {
      case 'scout': {
        // Pointed goblin ears, agile hood/body, yellow eyes, small dagger
        g.poly([-r * 0.9, -r * 1.4, -r * 1.65, -r * 1.85, -r * 0.5, -r * 0.8])
          .fill(spec.color)
          .stroke({ width: 1, color: spec.strokeColor })
          .poly([r * 0.9, -r * 1.4, r * 1.65, -r * 1.85, r * 0.5, -r * 0.8])
          .fill(spec.color)
          .stroke({ width: 1, color: spec.strokeColor })
          .poly([-r * 0.7, -r * 0.9, r * 0.7, -r * 0.9, r * 0.9, 0, -r * 0.9, 0])
          .fill(0x7e5109)
          .circle(0, -r * 1.2, r * 0.85)
          .fill(spec.color)
          .stroke({ width: 1.2, color: spec.strokeColor })
          .circle(-1.5, -r * 1.25, 1.3)
          .fill(0xf9e79f)
          .circle(2.5, -r * 1.25, 1.3)
          .fill(0xf9e79f)
          .poly([r * 0.7, -r * 0.5, r * 1.4, -r * 0.9, r * 0.9, -r * 0.2])
          .fill(0xd5dbdb);
        break;
      }
      case 'grunt': {
        // Orc raider with dark armor vest, horned helm, glowing eyes, club
        g.poly([-r * 0.8, -r * 1.0, r * 0.8, -r * 1.0, r * 0.7, 0, -r * 0.7, 0])
          .fill(0x34495e)
          .stroke({ width: 1, color: 0x1b2631 })
          .circle(0, -r * 1.25, r * 0.78)
          .fill(spec.color)
          .stroke({ width: 1.3, color: spec.strokeColor })
          .poly([-r * 0.65, -r * 1.7, -r * 1.15, -r * 2.25, -r * 0.25, -r * 1.8])
          .fill(0xecf0f1)
          .poly([r * 0.65, -r * 1.7, r * 1.15, -r * 2.25, r * 0.25, -r * 1.8])
          .fill(0xecf0f1)
          .circle(-1.5, -r * 1.25, 1.4)
          .fill(0xf7dc6f)
          .circle(3, -r * 1.25, 1.4)
          .fill(0xf7dc6f)
          .rect(r * 0.65, -r * 1.2, 3, r * 0.9)
          .fill(0x6e2c00);
        break;
      }
      case 'brute': {
        // Hulking armored juggernaut with spiked pauldrons and heavy horns
        g.poly([-r * 1.0, -r * 1.15, r * 1.0, -r * 1.15, r * 0.85, 0, -r * 0.85, 0])
          .fill(spec.color)
          .stroke({ width: 1.5, color: spec.strokeColor })
          .circle(-r * 0.85, -r * 1.05, r * 0.42)
          .fill(0x2c3e50)
          .stroke({ width: 1, color: 0x1a252f })
          .circle(r * 0.85, -r * 1.05, r * 0.42)
          .fill(0x2c3e50)
          .stroke({ width: 1, color: 0x1a252f })
          .circle(0, -r * 1.35, r * 0.72)
          .fill(spec.color)
          .stroke({ width: 1.4, color: spec.strokeColor })
          .poly([-r * 0.55, -r * 1.75, -r * 1.05, -r * 2.35, -r * 0.2, -r * 1.9])
          .fill(0xfdfefe)
          .poly([r * 0.55, -r * 1.75, r * 1.05, -r * 2.35, r * 0.2, -r * 1.9])
          .fill(0xfdfefe)
          .circle(-2, -r * 1.35, 1.6)
          .fill(0xf39c12)
          .circle(3.5, -r * 1.35, 1.6)
          .fill(0xf39c12);

        if (spec.isBoss) {
          g.poly([
            -r * 0.45,
            -r * 2.05,
            -r * 0.3,
            -r * 2.45,
            0,
            -r * 2.15,
            r * 0.3,
            -r * 2.45,
            r * 0.45,
            -r * 2.05,
          ])
            .fill(0xf1c40f)
            .stroke({ width: 1, color: 0xffffff });
        }
        break;
      }
    }
  }

  private drawHealthBar(): void {
    const ratio = Math.max(0, this.hp / this.maxHp);
    const fillColor = ratio > 0.4 ? 0x2ecc71 : 0xe74c3c;

    this.hpBarGraphic
      .clear()
      .rect(-this.hpBarWidth / 2, this.hpBarY, this.hpBarWidth, HP_BAR_HEIGHT)
      .fill(0x1a1a2e)
      .stroke({ width: 1, color: 0x000000 });

    if (ratio > 0) {
      this.hpBarGraphic
        .rect(
          -this.hpBarWidth / 2 + 1,
          this.hpBarY + 1,
          (this.hpBarWidth - 2) * ratio,
          HP_BAR_HEIGHT - 2,
        )
        .fill(fillColor);
    }
  }

  private syncTransform(): void {
    const screenPos = gridToScreen(this.gx, this.gy);
    const screenDx = screenPos.x - this.prevScreenX;
    if (Math.abs(screenDx) > 0.01) {
      this.facing = screenDx < 0 ? -1 : 1;
    }
    if (this.animatedSprite) {
      this.animatedSprite.scale.x = this.facing * this.spriteBaseScale;
      this.animatedSprite.scale.y = this.spriteBaseScale;
    } else {
      this.bodyContainer.scale.x = this.facing;
    }
    this.prevScreenX = screenPos.x;

    this.container.position.set(screenPos.x, screenPos.y + PATH_SINK_OFFSET);
    this.container.zIndex = this.gx + this.gy;
  }
}
