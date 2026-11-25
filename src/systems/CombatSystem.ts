import { Container, Graphics } from 'pixi.js';
import {
  PATH_SINK_OFFSET,
  TILE_HEIGHT,
  TILE_WIDTH,
} from '../config/constants';
import { EventBus } from '../core/EventBus';
import { GameState } from '../core/GameState';
import { gridDistance, gridToScreen } from '../core/IsoMath';
import { Enemy } from '../entities/Enemy';
import { HumanUnit, type TargetingStrategy } from '../entities/HumanUnit';
import { Projectile } from '../entities/Projectile';
import { FloatingTextSystem } from './FloatingTextSystem';
import { ParticleSystem } from './ParticleSystem';
import { PerkSystem } from './PerkSystem';
import { ScreenShakeSystem } from './ScreenShakeSystem';
import { SoundSystem } from './SoundSystem';

interface VisualEffect {
  readonly graphic: Graphics;
  readonly duration: number;
  elapsed: number;
  readonly updateFn: (progress: number) => void;
}

export class CombatSystem {
  private readonly entityLayer: Container;
  private readonly gameState: GameState;
  private readonly soundSystem: SoundSystem;
  private readonly eventBus: EventBus;
  private readonly particleSystem: ParticleSystem;
  private readonly screenShakeSystem: ScreenShakeSystem;
  private readonly perkSystem: PerkSystem;
  private readonly floatingTextSystem: FloatingTextSystem;
  private readonly projectiles: Projectile[] = [];
  private readonly effects: VisualEffect[] = [];

  constructor(
    entityLayer: Container,
    gameState: GameState,
    soundSystem: SoundSystem,
    eventBus: EventBus,
    particleSystem: ParticleSystem,
    screenShakeSystem: ScreenShakeSystem,
    perkSystem: PerkSystem,
    floatingTextSystem: FloatingTextSystem,
  ) {
    this.entityLayer = entityLayer;
    this.gameState = gameState;
    this.soundSystem = soundSystem;
    this.eventBus = eventBus;
    this.particleSystem = particleSystem;
    this.screenShakeSystem = screenShakeSystem;
    this.perkSystem = perkSystem;
    this.floatingTextSystem = floatingTextSystem;
  }

  public update(
    dt: number,
    units: readonly HumanUnit[],
    enemies: readonly Enemy[],
  ): void {
    if (dt <= 0 || this.gameState.isGameOver()) {
      return;
    }

    for (const enemy of enemies) {
      if (enemy.updateBurn(dt)) {
        this.handleEnemyDeath(enemy, enemy.burnSourceUnit);
      }
    }

    const fireRateMult = this.perkSystem.getFireRateMultiplier();
    for (const unit of units) {
      if (!unit.canAttack) {
        unit.updateTargetTracking(null, null);
        unit.updateVisuals(dt);
        continue;
      }

      unit.cooldown = Math.max(0, unit.cooldown - dt);
      const target = this.findTarget(unit, enemies);

      if (target) {
        const targetScreen = gridToScreen(target.gx, target.gy);
        unit.updateTargetTracking(targetScreen.x, targetScreen.y);

        if (unit.cooldown <= 0) {
          unit.cooldown = 1 / (unit.fireRate * fireRateMult);
          unit.triggerAttackAnimation();
          this.performAttack(unit, target);
        }
      } else {
        unit.updateTargetTracking(null, null);
      }

      unit.updateVisuals(dt);
    }

    this.updateProjectiles(dt, enemies);
    this.updateEffects(dt);
  }

  public clear(): void {
    for (const projectile of this.projectiles) {
      projectile.destroy();
    }
    this.projectiles.length = 0;

    for (const effect of this.effects) {
      effect.graphic.parent?.removeChild(effect.graphic);
      effect.graphic.destroy({ children: true });
    }
    this.effects.length = 0;
  }

  private findTarget(
    unit: HumanUnit,
    enemies: readonly Enemy[],
  ): Enemy | null {
    let bestTarget: Enemy | null = null;

    for (const enemy of enemies) {
      if (enemy.isDead || enemy.isDying || enemy.reachedGoal) {
        continue;
      }
      if (gridDistance(unit, enemy) > unit.range) {
        continue;
      }
      if (
        !bestTarget ||
        this.isBetterTarget(enemy, bestTarget, unit.targetingStrategy)
      ) {
        bestTarget = enemy;
      }
    }

    return bestTarget;
  }

  private isBetterTarget(
    candidate: Enemy,
    currentBest: Enemy,
    strategy: TargetingStrategy,
  ): boolean {
    switch (strategy) {
      case 'strongest':
        if (candidate.hp !== currentBest.hp) {
          return candidate.hp > currentBest.hp;
        }
        return candidate.progress > currentBest.progress;
      case 'lowest':
        if (candidate.hp !== currentBest.hp) {
          return candidate.hp < currentBest.hp;
        }
        return candidate.progress > currentBest.progress;
      case 'first':
        return candidate.progress > currentBest.progress;
    }
  }

  private performAttack(unit: HumanUnit, target: Enemy): void {
    switch (unit.config.attackType) {
      case 'melee': {
        this.applyDamage(target, unit.damage, unit, false);
        const stunDuration = this.perkSystem.getKnightStunDuration();
        if (
          stunDuration > 0 &&
          !target.isDead &&
          !target.isDying &&
          !target.reachedGoal
        ) {
          target.applyStun(stunDuration);
        }
        this.spawnMeleeSlash(unit, target);
        this.soundSystem.playKnightSlash();
        break;
      }
      case 'projectile':
        this.spawnProjectile(unit, target, 10, 0);
        this.soundSystem.playArcherShoot();
        break;
      case 'aoe':
        this.spawnProjectile(unit, target, 6, unit.config.aoeRadius ?? 1.2);
        this.soundSystem.playMageCast();
        break;
      case 'frost':
        this.spawnProjectile(unit, target, 8.5, 0);
        this.soundSystem.playFrostCast();
        break;
      case 'support':
      case 'economy':
        break;
    }
  }

  private spawnProjectile(
    unit: HumanUnit,
    target: Enemy,
    speed: number,
    aoeRadius: number,
  ): void {
    const projectile = new Projectile(
      unit,
      unit.gx,
      unit.gy,
      target,
      speed,
      unit.damage,
      unit.config.color,
      aoeRadius,
    );
    this.entityLayer.addChild(projectile.container);
    this.projectiles.push(projectile);
  }

  private updateProjectiles(dt: number, enemies: readonly Enemy[]): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i];
      projectile.update(dt);

      if (!projectile.hasImpacted) {
        continue;
      }

      if (projectile.aoeRadius > 0) {
        const burnDps = this.perkSystem.getMageBurnDps();
        for (const enemy of enemies) {
          if (enemy.isDead || enemy.isDying || enemy.reachedGoal) {
            continue;
          }
          if (gridDistance(projectile, enemy) <= projectile.aoeRadius) {
            this.applyDamage(
              enemy,
              projectile.damage,
              projectile.sourceUnit,
              false,
            );
            if (
              burnDps > 0 &&
              !enemy.isDead &&
              !enemy.isDying &&
              !enemy.reachedGoal
            ) {
              enemy.applyBurn(burnDps, 3, projectile.sourceUnit);
            }
          }
        }
        this.spawnAoeRing(
          projectile.gx,
          projectile.gy,
          projectile.aoeRadius,
          projectile.color,
        );
        const impactPos = gridToScreen(projectile.gx, projectile.gy);
        this.particleSystem.spawnHitSparks(
          impactPos.x,
          impactPos.y + PATH_SINK_OFFSET - 6,
          0xd980fa,
          8,
        );
        this.soundSystem.playMageImpact();
      } else if (projectile.sourceUnit.config.attackType === 'frost') {
        const cfg = projectile.sourceUnit.config;
        const target = projectile.target;
        this.applyDamage(
          target,
          projectile.damage,
          projectile.sourceUnit,
          false,
        );
        if (!target.isDead && !target.isDying && !target.reachedGoal) {
          target.applySlow(cfg.slowFactor ?? 0.55, cfg.slowDuration ?? 2.5);
          if (Math.random() < (cfg.freezeChance ?? 0.25)) {
            target.applyFreeze(cfg.freezeDuration ?? 1.0);
            const hitPos = gridToScreen(target.gx, target.gy);
            this.particleSystem.spawnIceShatter(
              hitPos.x,
              hitPos.y + PATH_SINK_OFFSET - 10,
              14,
            );
          }
        }
      } else {
        const isCrit =
          projectile.sourceUnit.config.id === 'archer' &&
          Math.random() < this.perkSystem.getArcherCritChance();
        const finalDamage = isCrit
          ? projectile.damage * 2
          : projectile.damage;
        this.applyDamage(
          projectile.target,
          finalDamage,
          projectile.sourceUnit,
          isCrit,
        );
      }

      projectile.destroy();
      this.projectiles.splice(i, 1);
    }
  }

  private updateEffects(dt: number): void {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      effect.elapsed += dt;
      const progress = Math.min(1, effect.elapsed / effect.duration);
      effect.updateFn(progress);

      if (effect.elapsed >= effect.duration) {
        effect.graphic.parent?.removeChild(effect.graphic);
        effect.graphic.destroy({ children: true });
        this.effects.splice(i, 1);
      }
    }
  }

  private applyDamage(
    enemy: Enemy,
    damage: number,
    sourceUnit: HumanUnit,
    isCrit = false,
  ): void {
    if (enemy.isDead || enemy.isDying || enemy.reachedGoal) {
      return;
    }
    const pos = gridToScreen(enemy.gx, enemy.gy);
    const hitY = pos.y + PATH_SINK_OFFSET - 10;
    this.particleSystem.spawnHitSparks(
      pos.x,
      hitY,
      isCrit ? 0xffd166 : this.getHitSparkColor(sourceUnit),
      isCrit ? 9 : 6,
    );
    if (isCrit) {
      this.floatingTextSystem.spawnCrit(pos.x, hitY - 16, damage);
    }
    enemy.takeDamage(damage);
    if (enemy.isDead) {
      this.handleEnemyDeath(enemy, sourceUnit);
    }
  }

  private handleEnemyDeath(
    enemy: Enemy,
    sourceUnit: HumanUnit | null,
  ): void {
    const pos = gridToScreen(enemy.gx, enemy.gy);
    const hitY = pos.y + PATH_SINK_OFFSET - 10;
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
    if (sourceUnit && !sourceUnit.isDestroyed) {
      const xpReward = Math.round(
        enemy.xpReward * this.perkSystem.getXpMultiplier(),
      );
      sourceUnit.kills += 1;
      sourceUnit.addXp(xpReward);
      this.eventBus.emit('unitUpdated', sourceUnit);

      if (sourceUnit.auraProvider && !sourceUnit.auraProvider.isDestroyed) {
        const assistXp = Math.max(1, Math.round(xpReward * 0.35));
        sourceUnit.auraProvider.kills += 1;
        sourceUnit.auraProvider.addXp(assistXp);
        this.eventBus.emit('unitUpdated', sourceUnit.auraProvider);
      }
    }
  }

  private getHitSparkColor(unit: HumanUnit): number {
    switch (unit.config.id) {
      case 'archer':
        return 0xffe066;
      case 'knight':
        return 0x7cc4fa;
      case 'mage':
        return 0xd980fa;
      case 'frost_mage':
        return 0x7df9ff;
      default:
        return 0xffffff;
    }
  }

  private spawnMeleeSlash(unit: HumanUnit, target: Enemy): void {
    const graphic = new Graphics();
    graphic.eventMode = 'none';
    const targetScreen = gridToScreen(target.gx, target.gy);
    graphic.position.set(targetScreen.x, targetScreen.y + PATH_SINK_OFFSET - 8);
    graphic.zIndex = Math.max(unit.gx + unit.gy, target.gx + target.gy) + 0.5;
    this.entityLayer.addChild(graphic);

    const drawSlash = (progress: number): void => {
      const alpha = 1 - progress;
      const spread = 8 + progress * 6;
      const slashColor = unit.level >= 3 ? 0xf1c40f : unit.config.color;
      graphic
        .clear()
        .arc(0, 0, 11 + progress * 5, -0.95, 0.95)
        .stroke({ width: 3 * alpha + 0.5, color: slashColor, alpha })
        .moveTo(-spread, -spread * 0.65)
        .lineTo(spread, spread * 0.65)
        .stroke({ width: 2.8, color: 0xffffff, alpha })
        .moveTo(-spread * 0.55, spread * 0.75)
        .lineTo(spread * 0.55, -spread * 0.75)
        .stroke({ width: 2.2, color: slashColor, alpha });
    };

    drawSlash(0);
    this.effects.push({
      graphic,
      duration: 0.2,
      elapsed: 0,
      updateFn: drawSlash,
    });
  }

  private spawnAoeRing(
    gx: number,
    gy: number,
    aoeRadius: number,
    color: number,
  ): void {
    const graphic = new Graphics();
    graphic.eventMode = 'none';
    const pos = gridToScreen(gx, gy);
    graphic.position.set(pos.x, pos.y + PATH_SINK_OFFSET);
    graphic.zIndex = gx + gy + 0.4;
    this.entityLayer.addChild(graphic);

    const maxRx = aoeRadius * (TILE_WIDTH / Math.SQRT2);
    const maxRy = aoeRadius * (TILE_HEIGHT / Math.SQRT2);

    const drawRing = (progress: number): void => {
      const scale = 0.25 + progress * 0.75;
      const alpha = 1 - progress;
      const rx = maxRx * scale;
      const ry = maxRy * scale;
      const innerRx = rx * 0.65;
      const innerRy = ry * 0.65;
      graphic
        .clear()
        .ellipse(0, 0, rx, ry)
        .fill({ color, alpha: 0.22 * alpha })
        .stroke({ width: 2.5, color, alpha })
        .poly([0, -innerRy, innerRx, 0, 0, innerRy, -innerRx, 0])
        .stroke({ width: 1.5, color: 0xf9e79f, alpha: alpha * 0.85 })
        .ellipse(0, 0, rx * 0.28, ry * 0.28)
        .fill({ color: 0xffffff, alpha: alpha * 0.5 });
    };

    drawRing(0);
    this.effects.push({
      graphic,
      duration: 0.3,
      elapsed: 0,
      updateFn: drawRing,
    });
  }
}
