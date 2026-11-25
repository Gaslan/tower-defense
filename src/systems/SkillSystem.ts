import { Container, Graphics } from 'pixi.js';
import {
  GRID_SIZE,
  PATH_SINK_OFFSET,
  TILE_HEIGHT,
  TILE_WIDTH,
} from '../config/constants';
import {
  getMeteorDamage,
  SKILL_CONFIGS,
  type SkillId,
} from '../config/skills';
import type { EventBus, SkillStatePayload } from '../core/EventBus';
import type { GameState } from '../core/GameState';
import { gridToScreen } from '../core/IsoMath';
import type { Enemy } from '../entities/Enemy';
import type { ParticleSystem } from './ParticleSystem';
import type { PerkSystem } from './PerkSystem';
import type { ScreenShakeSystem } from './ScreenShakeSystem';
import type { SoundSystem } from './SoundSystem';

interface ActiveMeteor {
  readonly graphic: Graphics;
  readonly targetGx: number;
  readonly targetGy: number;
  readonly targetX: number;
  readonly targetY: number;
  readonly startX: number;
  readonly startY: number;
  elapsed: number;
  readonly duration: number;
}

interface SkillRingEffect {
  readonly graphic: Graphics;
  elapsed: number;
  readonly duration: number;
  readonly drawFn: (progress: number) => void;
}

export class SkillSystem {
  private readonly highlightLayer: Container;
  private readonly fxLayer: Container;
  private readonly gameState: GameState;
  private readonly soundSystem: SoundSystem;
  private readonly eventBus: EventBus;
  private readonly particleSystem: ParticleSystem;
  private readonly screenShakeSystem: ScreenShakeSystem;
  private readonly perkSystem: PerkSystem;

  private readonly cooldowns: Record<SkillId, number> = {
    meteor: 0,
    frost: 0,
  };
  private targetingSkill: SkillId | null = null;
  private readonly previewGraphic: Graphics;
  private previewHasPos = false;
  private previewWorldX = 0;
  private previewWorldY = 0;
  private previewPulseTimer = 0;
  private readonly activeMeteors: ActiveMeteor[] = [];
  private readonly effects: SkillRingEffect[] = [];

  constructor(
    highlightLayer: Container,
    fxLayer: Container,
    gameState: GameState,
    soundSystem: SoundSystem,
    eventBus: EventBus,
    particleSystem: ParticleSystem,
    screenShakeSystem: ScreenShakeSystem,
    perkSystem: PerkSystem,
  ) {
    this.highlightLayer = highlightLayer;
    this.fxLayer = fxLayer;
    this.gameState = gameState;
    this.soundSystem = soundSystem;
    this.eventBus = eventBus;
    this.particleSystem = particleSystem;
    this.screenShakeSystem = screenShakeSystem;
    this.perkSystem = perkSystem;

    this.previewGraphic = new Graphics();
    this.previewGraphic.eventMode = 'none';
    this.previewGraphic.visible = false;
    this.highlightLayer.addChild(this.previewGraphic);

    this.eventBus.on('unitSelected', (unitId) => {
      if (unitId !== null && this.targetingSkill !== null) {
        this.cancelTargeting();
      }
    });

    this.eventBus.on('perksChanged', () => {
      const mult = this.perkSystem.getCooldownMultiplier();
      (['meteor', 'frost'] as const).forEach((id) => {
        this.cooldowns[id] = Math.min(
          this.cooldowns[id],
          SKILL_CONFIGS[id].cooldown * mult,
        );
      });
      this.emitState();
    });

    this.emitState();
  }

  public isTargeting(): boolean {
    return this.targetingSkill !== null;
  }

  public getTargetingSkill(): SkillId | null {
    return this.targetingSkill;
  }

  public getState(): SkillStatePayload {
    const cdMult = this.perkSystem.getCooldownMultiplier();
    return {
      cooldowns: { ...this.cooldowns },
      maxCooldowns: {
        meteor: SKILL_CONFIGS.meteor.cooldown * cdMult,
        frost: SKILL_CONFIGS.frost.cooldown * cdMult,
      },
      targetingSkill: this.targetingSkill,
    };
  }

  public activateSkill(skillId: SkillId, enemies: readonly Enemy[]): boolean {
    if (this.gameState.isGameOver() || this.gameState.isPaused()) {
      return false;
    }

    if (this.cooldowns[skillId] > 0) {
      return false;
    }

    const config = SKILL_CONFIGS[skillId];
    if (config.requiresTargeting) {
      if (this.targetingSkill === skillId) {
        this.cancelTargeting();
        return false;
      }
      this.targetingSkill = skillId;
      this.gameState.selectUnit(null);
      this.emitState();
      return true;
    }

    if (skillId === 'frost') {
      this.cancelTargeting();
      this.cooldowns.frost =
        config.cooldown * this.perkSystem.getCooldownMultiplier();
      this.castFrostWave(enemies);
      this.emitState();
      return true;
    }

    return false;
  }

  public cancelTargeting(): void {
    if (this.targetingSkill === null) {
      return;
    }
    this.targetingSkill = null;
    this.previewHasPos = false;
    this.previewGraphic.visible = false;
    this.emitState();
  }

  public hideTargetingPreview(): void {
    this.previewHasPos = false;
    this.previewGraphic.visible = false;
  }

  public updateTargetingPreview(
    screenX: number,
    screenY: number,
    worldOffsetX: number,
    worldOffsetY: number,
    worldScale = 1,
  ): void {
    if (this.targetingSkill !== 'meteor') {
      this.previewGraphic.visible = false;
      return;
    }

    const localX = (screenX - worldOffsetX) / worldScale;
    const localY = (screenY - worldOffsetY) / worldScale;
    const { fx, fy } = this.localToFractionalGrid(localX, localY);

    if (!this.isInsideMapBounds(fx, fy)) {
      this.previewHasPos = false;
      this.previewGraphic.visible = false;
      return;
    }

    this.previewHasPos = true;
    this.previewWorldX = localX;
    this.previewWorldY = localY;
    this.drawMeteorPreview();
  }

  public tryCastAtScreenPos(
    screenX: number,
    screenY: number,
    worldOffsetX: number,
    worldOffsetY: number,
    worldScale = 1,
  ): boolean {
    if (
      this.targetingSkill !== 'meteor' ||
      this.gameState.isGameOver() ||
      this.gameState.isPaused()
    ) {
      return false;
    }

    if (this.cooldowns.meteor > 0) {
      this.cancelTargeting();
      return false;
    }

    const localX = (screenX - worldOffsetX) / worldScale;
    const localY = (screenY - worldOffsetY) / worldScale;
    const { fx, fy } = this.localToFractionalGrid(localX, localY);

    if (!this.isInsideMapBounds(fx, fy)) {
      return false;
    }

    this.cooldowns.meteor =
      SKILL_CONFIGS.meteor.cooldown * this.perkSystem.getCooldownMultiplier();
    this.targetingSkill = null;
    this.previewHasPos = false;
    this.previewGraphic.visible = false;

    this.spawnFallingMeteor(fx, fy, localX, localY);
    this.emitState();
    return true;
  }

  public update(dt: number, enemies: readonly Enemy[]): void {
    if (dt <= 0) {
      return;
    }

    let stateDirty = false;
    (['meteor', 'frost'] as const).forEach((id) => {
      if (this.cooldowns[id] > 0) {
        this.cooldowns[id] = Math.max(0, this.cooldowns[id] - dt);
        stateDirty = true;
      }
    });

    if (stateDirty) {
      this.emitState();
    }

    if (this.targetingSkill === 'meteor' && this.previewHasPos) {
      this.previewPulseTimer += dt;
      this.drawMeteorPreview();
    }

    for (let i = this.activeMeteors.length - 1; i >= 0; i--) {
      const meteor = this.activeMeteors[i];
      meteor.elapsed += dt;
      const t = Math.min(1, meteor.elapsed / meteor.duration);
      this.drawFallingMeteor(meteor, t);

      if (meteor.elapsed >= meteor.duration) {
        this.detonateMeteor(meteor, enemies);
        meteor.graphic.parent?.removeChild(meteor.graphic);
        meteor.graphic.destroy({ children: true });
        this.activeMeteors.splice(i, 1);
      }
    }

    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      effect.elapsed += dt;
      const progress = Math.min(1, effect.elapsed / effect.duration);
      effect.drawFn(progress);

      if (effect.elapsed >= effect.duration) {
        effect.graphic.parent?.removeChild(effect.graphic);
        effect.graphic.destroy({ children: true });
        this.effects.splice(i, 1);
      }
    }
  }

  public clear(): void {
    this.cooldowns.meteor = 0;
    this.cooldowns.frost = 0;
    this.targetingSkill = null;
    this.previewHasPos = false;
    this.previewGraphic.visible = false;

    for (const meteor of this.activeMeteors) {
      meteor.graphic.parent?.removeChild(meteor.graphic);
      meteor.graphic.destroy({ children: true });
    }
    this.activeMeteors.length = 0;

    for (const effect of this.effects) {
      effect.graphic.parent?.removeChild(effect.graphic);
      effect.graphic.destroy({ children: true });
    }
    this.effects.length = 0;

    this.emitState();
  }

  private localToFractionalGrid(
    localX: number,
    localY: number,
  ): { fx: number; fy: number } {
    const halfW = TILE_WIDTH / 2;
    const halfH = TILE_HEIGHT / 2;
    return {
      fx: (localX / halfW + localY / halfH) / 2,
      fy: (localY / halfH - localX / halfW) / 2,
    };
  }

  private isInsideMapBounds(fx: number, fy: number): boolean {
    return (
      fx >= -0.55 &&
      fx <= GRID_SIZE - 0.45 &&
      fy >= -0.55 &&
      fy <= GRID_SIZE - 0.45
    );
  }

  private drawMeteorPreview(): void {
    const aoeRadius = SKILL_CONFIGS.meteor.aoeRadius ?? 1.8;
    const rx = aoeRadius * (TILE_WIDTH / Math.SQRT2);
    const ry = aoeRadius * (TILE_HEIGHT / Math.SQRT2);
    const pulse = 1 + Math.sin(this.previewPulseTimer * 7) * 0.05;
    const innerAlpha = 0.2 + Math.sin(this.previewPulseTimer * 7) * 0.06;

    this.previewGraphic
      .clear()
      .ellipse(0, 0, rx * pulse, ry * pulse)
      .fill({ color: 0xff5722, alpha: innerAlpha })
      .stroke({ width: 2.2, color: 0xff8a00, alpha: 0.92 })
      .ellipse(0, 0, rx * 0.48 * pulse, ry * 0.48 * pulse)
      .stroke({ width: 1.5, color: 0xffd166, alpha: 0.78 })
      .moveTo(-8, 0)
      .lineTo(8, 0)
      .moveTo(0, -4)
      .lineTo(0, 4)
      .stroke({ width: 1.5, color: 0xfff3b0, alpha: 0.9 });
    this.previewGraphic.position.set(this.previewWorldX, this.previewWorldY);
    this.previewGraphic.visible = true;
  }

  private spawnFallingMeteor(
    targetGx: number,
    targetGy: number,
    targetX: number,
    targetY: number,
  ): void {
    const graphic = new Graphics();
    graphic.eventMode = 'none';
    this.fxLayer.addChild(graphic);

    const meteor: ActiveMeteor = {
      graphic,
      targetGx,
      targetGy,
      targetX,
      targetY,
      startX: targetX - 75,
      startY: targetY - 260,
      elapsed: 0,
      duration: 0.3,
    };
    this.drawFallingMeteor(meteor, 0);
    this.activeMeteors.push(meteor);
  }

  private drawFallingMeteor(meteor: ActiveMeteor, t: number): void {
    const ease = t * t;
    const cx = meteor.startX + (meteor.targetX - meteor.startX) * ease;
    const cy = meteor.startY + (meteor.targetY - meteor.startY) * ease;
    const dx = meteor.startX - meteor.targetX;
    const dy = meteor.startY - meteor.targetY;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;

    const aoeRadius = SKILL_CONFIGS.meteor.aoeRadius ?? 1.8;
    const rx = aoeRadius * (TILE_WIDTH / Math.SQRT2);
    const ry = aoeRadius * (TILE_HEIGHT / Math.SQRT2);
    const shrink = 1 - t * 0.35;

    const g = meteor.graphic;
    g.clear()
      .ellipse(meteor.targetX, meteor.targetY, rx * shrink, ry * shrink)
      .fill({ color: 0xff4d00, alpha: 0.14 + t * 0.14 })
      .stroke({ width: 1.8, color: 0xff8a00, alpha: 0.55 + t * 0.35 })
      .ellipse(meteor.targetX, meteor.targetY, 18 * (1 - t * 0.4), 8 * (1 - t * 0.4))
      .fill({ color: 0x000000, alpha: 0.2 + t * 0.35 })
      .poly([
        cx + uy * 12,
        cy - ux * 12,
        cx - uy * 12,
        cy + ux * 12,
        cx + ux * 68,
        cy + uy * 68,
      ])
      .fill({ color: 0xff4d00, alpha: 0.72 })
      .poly([
        cx + uy * 7,
        cy - ux * 7,
        cx - uy * 7,
        cy + ux * 7,
        cx + ux * 42,
        cy + uy * 42,
      ])
      .fill({ color: 0xffb703, alpha: 0.9 })
      .circle(cx, cy, 14)
      .fill({ color: 0xff5400, alpha: 0.45 })
      .circle(cx, cy, 10)
      .fill(0xff7b00)
      .circle(cx, cy, 6)
      .fill(0xfff3b0);
  }

  private detonateMeteor(meteor: ActiveMeteor, enemies: readonly Enemy[]): void {
    const aoeRadius = SKILL_CONFIGS.meteor.aoeRadius ?? 1.8;
    const damage = getMeteorDamage(this.gameState.getWave());

    for (const enemy of enemies) {
      if (enemy.isDead || enemy.isDying || enemy.reachedGoal) {
        continue;
      }

      const dist = Math.hypot(
        enemy.gx - meteor.targetGx,
        enemy.gy - meteor.targetGy,
      );
      if (dist > aoeRadius) {
        continue;
      }

      const pos = gridToScreen(enemy.gx, enemy.gy);
      const hitY = pos.y + PATH_SINK_OFFSET - 10;
      this.particleSystem.spawnHitSparks(pos.x, hitY, 0xff8a00, 6);
      enemy.takeDamage(damage);

      if (enemy.isDead) {
        const rewardGold = Math.round(
          enemy.rewardGold * this.perkSystem.getGoldMultiplier(),
        );
        this.particleSystem.spawnDeathBurst(pos.x, hitY, enemy.color);
        this.soundSystem.playEnemyDeath();
        if (enemy.isBoss) {
          this.screenShakeSystem.shake(6, 0.25);
        }
        this.eventBus.emit('enemyKilled', {
          worldX: pos.x,
          worldY: hitY,
          rewardGold,
        });
        this.gameState.addGold(rewardGold);
      }
    }

    this.particleSystem.spawnMeteorBurst(meteor.targetX, meteor.targetY);
    this.spawnMeteorBlastRing(meteor.targetX, meteor.targetY, aoeRadius);
    this.screenShakeSystem.shake(7, 0.3);
    this.soundSystem.playMeteorImpact();
  }

  private spawnMeteorBlastRing(
    screenX: number,
    screenY: number,
    aoeRadius: number,
  ): void {
    const graphic = new Graphics();
    graphic.eventMode = 'none';
    graphic.position.set(screenX, screenY);
    this.fxLayer.addChild(graphic);

    const maxRx = aoeRadius * (TILE_WIDTH / Math.SQRT2);
    const maxRy = aoeRadius * (TILE_HEIGHT / Math.SQRT2);

    const drawFn = (progress: number): void => {
      const alpha = 1 - progress;
      const scale = 0.3 + 0.9 * progress;
      graphic
        .clear()
        .ellipse(0, 0, maxRx * scale, maxRy * scale)
        .fill({ color: 0xff5722, alpha: 0.32 * alpha })
        .stroke({ width: 3 * alpha + 0.5, color: 0xffd166, alpha })
        .ellipse(0, 0, maxRx * 0.55 * scale, maxRy * 0.55 * scale)
        .fill({ color: 0xfff3b0, alpha: 0.45 * alpha });
    };

    drawFn(0);
    this.effects.push({ graphic, elapsed: 0, duration: 0.42, drawFn });
  }

  private castFrostWave(enemies: readonly Enemy[]): void {
    const factor = SKILL_CONFIGS.frost.slowFactor ?? 0.5;
    const duration = SKILL_CONFIGS.frost.slowDuration ?? 4.5;

    for (const enemy of enemies) {
      if (enemy.isDead || enemy.isDying || enemy.reachedGoal) {
        continue;
      }
      enemy.applySlow(factor, duration);
      const pos = gridToScreen(enemy.gx, enemy.gy);
      this.particleSystem.spawnFrostBurst(
        pos.x,
        pos.y + PATH_SINK_OFFSET - 10,
        8,
      );
    }

    const center = gridToScreen((GRID_SIZE - 1) / 2, (GRID_SIZE - 1) / 2);
    this.spawnFrostShockwave(center.x, center.y);
    this.soundSystem.playFrostWave();
  }

  private spawnFrostShockwave(centerX: number, centerY: number): void {
    const graphic = new Graphics();
    graphic.eventMode = 'none';
    graphic.position.set(centerX, centerY);
    this.fxLayer.addChild(graphic);

    const maxRx = GRID_SIZE * TILE_WIDTH * 0.65;
    const maxRy = GRID_SIZE * TILE_HEIGHT * 0.65;

    const drawFn = (progress: number): void => {
      const ease = 1 - Math.pow(1 - progress, 2);
      const alpha = 1 - progress;
      const rx = Math.max(8, maxRx * ease);
      const ry = Math.max(4, maxRy * ease);

      graphic
        .clear()
        .ellipse(0, 0, rx, ry)
        .fill({ color: 0x38bdf8, alpha: 0.16 * alpha })
        .stroke({ width: 4 * alpha + 0.8, color: 0x7df9ff, alpha: 0.9 * alpha })
        .ellipse(0, 0, rx * 0.78, ry * 0.78)
        .stroke({ width: 2 * alpha + 0.4, color: 0xffffff, alpha: 0.75 * alpha });
    };

    drawFn(0);
    this.effects.push({ graphic, elapsed: 0, duration: 0.65, drawFn });
  }

  private emitState(): void {
    this.eventBus.emit('skillStateChanged', this.getState());
  }
}
