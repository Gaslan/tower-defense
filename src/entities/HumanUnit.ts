import { AnimatedSprite, Container, Graphics } from 'pixi.js';
import { TILE_HEIGHT, TILE_WIDTH } from '../config/constants';
import type { UnitConfig } from '../config/units';
import { gridToScreen } from '../core/IsoMath';
import type { UnitEffectiveStats } from '../core/PlayerProfile';
import {
  SpriteManager,
  type UnitSpriteFrames,
} from '../graphics/SpriteManager';
import {
  createUnitVisualRig,
  drawArcherWeapon,
  drawSpriteBaseOverlay,
  drawUnitVisuals,
  getWeaponAnchor,
  type UnitVisualRig,
} from '../graphics/UnitVisuals';

export type UnitAnimState = 'IDLE' | 'TRACKING' | 'ATTACKING';
export type TargetingStrategy = 'first' | 'strongest' | 'lowest';

const DEFAULT_MAX_LEVEL = 3;
const ATTACK_DURATION = 0.25;

export class HumanUnit {
  public readonly container: Container;
  public readonly config: UnitConfig;
  public readonly gx: number;
  public readonly gy: number;
  public readonly maxLevel: number;
  public level = 1;
  public xp = 0;
  public kills = 0;
  public damage: number;
  public range: number;
  public fireRate: number;
  public baseDamage: number;
  public baseFireRate: number;
  public buffDamagePct: number;
  public buffFireRatePct: number;
  public goldPerWave: number;
  public minerWaveXp: number;
  public totalGoldMined = 0;
  public auraDamageBonusPct = 0;
  public auraFireRateBonusPct = 0;
  public auraProvider: HumanUnit | null = null;
  public cooldown = 0;
  public targetingStrategy: TargetingStrategy = 'first';
  public totalInvestedGold: number;
  public isDestroyed = false;
  public animState: UnitAnimState = 'IDLE';

  private animTimer = Math.random() * Math.PI * 2;
  private attackTimer = 0;
  private bobTimer = 0;
  private facing: 1 | -1 = 1;
  private aimAngle = 0;
  private hasTargetInRange = false;
  private archerBowDirty = false;
  private readonly weaponBaseX: number;
  private readonly weaponBaseY: number;
  private readonly rig: UnitVisualRig;
  private readonly spriteData: UnitSpriteFrames | null;
  private readonly animatedSprite: AnimatedSprite | null = null;
  private readonly spriteBaseScale: number = 1;
  private spriteInAttackClip = false;
  private playbackSpeedMultiplier = 1;
  private spritePaused = false;
  private readonly auraRingGraphic: Graphics;
  private readonly buffChevronGraphic: Graphics;
  private readonly upgradeIndicatorGraphic: Graphics;

  constructor(
    config: UnitConfig,
    gx: number,
    gy: number,
    effectiveStats?: UnitEffectiveStats,
  ) {
    this.config = config;
    this.gx = gx;
    this.gy = gy;
    this.maxLevel = effectiveStats?.maxInGameLevel ?? DEFAULT_MAX_LEVEL;
    this.baseDamage = effectiveStats?.damage ?? config.damage;
    this.baseFireRate = effectiveStats?.fireRate ?? config.fireRate;
    this.damage = this.baseDamage;
    this.range = effectiveStats?.range ?? config.range;
    this.fireRate = this.baseFireRate;
    this.buffDamagePct =
      effectiveStats?.buffDamagePct ?? config.buffDamagePct ?? 0;
    this.buffFireRatePct =
      effectiveStats?.buffFireRatePct ?? config.buffFireRatePct ?? 0;
    this.goldPerWave = effectiveStats?.goldPerWave ?? config.goldPerWave ?? 0;
    this.minerWaveXp = effectiveStats?.minerWaveXp ?? 60;
    this.totalInvestedGold = config.cost;

    const anchor = getWeaponAnchor(config.id);
    this.weaponBaseX = anchor.x;
    this.weaponBaseY = anchor.y;

    this.container = new Container();
    this.container.eventMode = 'none';

    const screenPos = gridToScreen(gx, gy);
    this.container.position.set(screenPos.x, screenPos.y);
    this.container.zIndex = gx + gy;

    this.rig = createUnitVisualRig(config.id);
    this.spriteData = SpriteManager.hasSprite(config.id)
      ? SpriteManager.getFrames(config.id)
      : null;

    this.auraRingGraphic = new Graphics();
    this.auraRingGraphic.visible = config.attackType === 'support';
    this.drawAuraRing();

    this.buffChevronGraphic = new Graphics();
    this.buffChevronGraphic
      .poly([0, -5, 4.5, 0, 2, 0, 0, -2.2, -2, 0, -4.5, 0])
      .fill(0xffd166)
      .stroke({ width: 0.9, color: 0x7d4a02 });
    this.buffChevronGraphic.position.set(11, -28);
    this.buffChevronGraphic.visible = false;

    this.upgradeIndicatorGraphic = new Graphics();
    this.drawUpgradeIndicator();
    this.upgradeIndicatorGraphic.position.set(0, -35);
    this.upgradeIndicatorGraphic.visible = false;

    if (this.spriteData) {
      drawSpriteBaseOverlay(this.rig.baseGraphic, config.id, this.level);
      this.rig.characterContainer.visible = false;

      const spriteCfg = this.spriteData.config;
      const sprite = new AnimatedSprite(this.spriteData.idle);
      sprite.eventMode = 'none';
      sprite.anchor.set(0.5, spriteCfg.anchorY);
      this.spriteBaseScale = spriteCfg.displayHeight / spriteCfg.frameHeight;
      sprite.scale.set(this.spriteBaseScale);
      sprite.animationSpeed = spriteCfg.idleFps / 60;
      sprite.loop = true;
      sprite.play();
      sprite.onComplete = (): void => {
        if (this.isDestroyed || !this.spriteData) {
          return;
        }
        this.spriteInAttackClip = false;
        sprite.textures = this.spriteData.idle;
        sprite.loop = true;
        sprite.animationSpeed =
          (this.spriteData.config.idleFps / 60) * this.playbackSpeedMultiplier;
        if (!this.spritePaused) {
          sprite.play();
        }
      };

      this.animatedSprite = sprite;
      this.container.addChild(
        this.auraRingGraphic,
        this.rig.baseGraphic,
        sprite,
        this.buffChevronGraphic,
        this.upgradeIndicatorGraphic,
      );
    } else {
      drawUnitVisuals(this.rig, config.id, this.level);
      this.container.addChild(
        this.auraRingGraphic,
        this.rig.baseGraphic,
        this.rig.characterContainer,
        this.buffChevronGraphic,
        this.upgradeIndicatorGraphic,
      );
    }
  }

  public get canAttack(): boolean {
    return (
      this.config.attackType !== 'support' &&
      this.config.attackType !== 'economy'
    );
  }

  public applyAuraBuff(
    dmgPct: number,
    ratePct: number,
    provider: HumanUnit | null,
  ): void {
    this.auraDamageBonusPct = dmgPct;
    this.auraFireRateBonusPct = ratePct;
    this.auraProvider = provider;
    this.damage = Number((this.baseDamage * (1 + dmgPct)).toFixed(1));
    this.fireRate = Number((this.baseFireRate * (1 + ratePct)).toFixed(2));
    this.buffChevronGraphic.visible = dmgPct > 0 || ratePct > 0;
  }

  public get xpToNextLevel(): number {
    return Math.floor(100 * Math.pow(1.65, this.level - 1));
  }

  public get upgradeCost(): number {
    return Math.floor(this.config.cost * 0.8 * Math.pow(1.45, this.level - 1));
  }

  public get canUpgrade(): boolean {
    return this.level < this.maxLevel && this.xp >= this.xpToNextLevel;
  }

  public getSellValue(): number {
    return Math.floor(this.totalInvestedGold * 0.7);
  }

  public addXp(amount: number): void {
    if (this.isDestroyed || this.level >= this.maxLevel || amount <= 0) {
      return;
    }
    this.xp = Math.min(this.xpToNextLevel, this.xp + amount);
    this.upgradeIndicatorGraphic.visible = this.canUpgrade;
  }

  public upgrade(): boolean {
    if (!this.canUpgrade) {
      return false;
    }

    const spent = this.upgradeCost;
    this.totalInvestedGold += spent;
    this.xp = 0;
    this.level++;
    this.baseDamage = Number((this.baseDamage * 1.35).toFixed(1));
    this.range = Number((this.range * 1.1).toFixed(2));
    this.baseFireRate = Number((this.baseFireRate * 1.15).toFixed(2));

    if (this.config.attackType === 'support') {
      this.buffDamagePct = Number((this.buffDamagePct * 1.25).toFixed(3));
      this.buffFireRatePct = Number((this.buffFireRatePct * 1.2).toFixed(3));
      this.drawAuraRing();
    } else if (this.config.attackType === 'economy') {
      this.goldPerWave = Math.round(this.goldPerWave * 1.35);
    }

    this.applyAuraBuff(
      this.auraDamageBonusPct,
      this.auraFireRateBonusPct,
      this.auraProvider,
    );

    if (this.animatedSprite && this.spriteData) {
      drawSpriteBaseOverlay(this.rig.baseGraphic, this.config.id, this.level);
    } else {
      drawUnitVisuals(this.rig, this.config.id, this.level);
    }
    this.drawUpgradeIndicator();
    this.upgradeIndicatorGraphic.visible = this.canUpgrade;
    return true;
  }

  private drawAuraRing(): void {
    this.auraRingGraphic.clear();
    if (this.config.attackType !== 'support' || this.range <= 0) {
      return;
    }
    const rx = this.range * (TILE_WIDTH / Math.SQRT2);
    const ry = this.range * (TILE_HEIGHT / Math.SQRT2);
    this.auraRingGraphic
      .ellipse(0, 0, rx, ry)
      .fill({ color: 0xf39c12, alpha: 0.07 })
      .stroke({ width: 1.5, color: 0xffd166, alpha: 0.45 });
  }

  private drawUpgradeIndicator(): void {
    const isMythicTier = this.level >= 3;
    this.upgradeIndicatorGraphic
      .clear()
      .poly([0, -7, 6, 2, 2, 2, 2, 5, -2, 5, -2, 2, -6, 2])
      .fill(isMythicTier ? 0x7df9ff : 0xf1c40f)
      .stroke({ width: 1.2, color: 0xffffff });
  }

  public destroy(): void {
    if (this.isDestroyed) {
      return;
    }
    this.isDestroyed = true;
    this.container.parent?.removeChild(this.container);
    this.container.destroy({ children: true });
  }

  public updateTargetTracking(
    targetScreenX: number | null,
    targetScreenY: number | null,
  ): void {
    if (targetScreenX !== null && targetScreenY !== null) {
      this.hasTargetInRange = true;
      const dx = targetScreenX - this.container.x;
      const dy = targetScreenY - this.container.y;

      if (Math.abs(dx) > 1) {
        this.facing = dx < 0 ? -1 : 1;
      }

      const rawAngle = Math.atan2(dy, Math.max(8, Math.abs(dx))) * 0.45;
      this.aimAngle = Math.max(-0.5, Math.min(0.5, rawAngle));

      if (this.attackTimer <= 0) {
        this.animState = 'TRACKING';
      }
      return;
    }

    this.hasTargetInRange = false;
    if (this.attackTimer <= 0) {
      this.animState = 'IDLE';
    }
  }

  public syncPlayback(paused: boolean, gameSpeed: number): void {
    this.playbackSpeedMultiplier = gameSpeed;
    if (!this.animatedSprite || !this.spriteData) {
      return;
    }
    const fps = this.spriteInAttackClip
      ? this.spriteData.config.attackFps
      : this.spriteData.config.idleFps;
    this.animatedSprite.animationSpeed = (fps / 60) * gameSpeed;

    if (paused && !this.spritePaused) {
      this.spritePaused = true;
      this.animatedSprite.stop();
    } else if (!paused && this.spritePaused) {
      this.spritePaused = false;
      this.animatedSprite.play();
    }
  }

  public triggerAttackAnimation(): void {
    this.animState = 'ATTACKING';
    this.attackTimer = ATTACK_DURATION;

    if (this.animatedSprite && this.spriteData) {
      this.spriteInAttackClip = true;
      this.animatedSprite.textures = this.spriteData.attack;
      this.animatedSprite.loop = false;
      this.animatedSprite.animationSpeed =
        (this.spriteData.config.attackFps / 60) * this.playbackSpeedMultiplier;
      this.animatedSprite.gotoAndPlay(0);
      if (this.spritePaused) {
        this.animatedSprite.stop();
      }
    }
  }

  public updateVisuals(dt: number): void {
    this.animTimer += dt;

    if (this.animatedSprite) {
      this.animatedSprite.scale.x =
        this.facing < 0 ? -this.spriteBaseScale : this.spriteBaseScale;
      this.animatedSprite.scale.y = this.spriteBaseScale;

      if (this.attackTimer > 0) {
        this.attackTimer = Math.max(0, this.attackTimer - dt);
        if (this.attackTimer === 0) {
          this.animState = this.hasTargetInRange ? 'TRACKING' : 'IDLE';
        }
      }
    } else {
      this.rig.characterContainer.scale.x = this.facing;

      if (this.attackTimer > 0) {
        this.attackTimer = Math.max(0, this.attackTimer - dt);
        const progress = 1 - this.attackTimer / ATTACK_DURATION;
        this.applyAttackAnimation(progress);

        if (this.attackTimer === 0) {
          this.rig.effectGraphic.clear();
          this.rig.effectGraphic.visible = false;
          if (this.archerBowDirty && this.config.id === 'archer') {
            drawArcherWeapon(this.rig.weaponGraphic, this.level, 0, true);
            this.archerBowDirty = false;
          }
          this.animState = this.hasTargetInRange ? 'TRACKING' : 'IDLE';
        }
      } else {
        this.rig.effectGraphic.clear();
        this.rig.effectGraphic.visible = false;
        this.applyIdleOrTrackingAnimation(dt);
      }
    }

    if (this.auraRingGraphic.visible) {
      this.auraRingGraphic.alpha = 0.65 + Math.sin(this.animTimer * 2.8) * 0.25;
    }
    if (this.buffChevronGraphic.visible) {
      this.buffChevronGraphic.y = -28 + Math.sin(this.animTimer * 4) * 1.6;
    }

    const ready = this.canUpgrade;
    this.upgradeIndicatorGraphic.visible = ready;
    if (ready) {
      this.bobTimer += dt * 4.5;
      this.upgradeIndicatorGraphic.y = -35 + Math.sin(this.bobTimer) * 2.5;
    }
  }

  private applyIdleOrTrackingAnimation(dt: number): void {
    const { bodyContainer, weaponContainer } = this.rig;
    if (this.archerBowDirty && this.config.id === 'archer') {
      drawArcherWeapon(this.rig.weaponGraphic, this.level, 0, true);
      this.archerBowDirty = false;
    }

    if (this.animState === 'TRACKING') {
      bodyContainer.x = 0;
      bodyContainer.y = Math.sin(this.animTimer * 4) * 0.8;
      bodyContainer.scale.y = 1 + Math.sin(this.animTimer * 4) * 0.02;
      weaponContainer.position.set(this.weaponBaseX, this.weaponBaseY);
      const lerp = Math.min(1, dt * 12);
      weaponContainer.rotation +=
        (this.aimAngle - weaponContainer.rotation) * lerp;
      return;
    }

    bodyContainer.x = 0;
    bodyContainer.y = Math.sin(this.animTimer * 3) * 1.1;
    bodyContainer.scale.y = 1 + Math.sin(this.animTimer * 3) * 0.025;
    weaponContainer.position.set(this.weaponBaseX, this.weaponBaseY);
    weaponContainer.rotation = Math.sin(this.animTimer * 2) * 0.08;
  }

  private applyAttackAnimation(p: number): void {
    const { bodyContainer, weaponContainer, effectGraphic } = this.rig;
    bodyContainer.scale.y = 1;

    switch (this.config.id) {
      case 'archer': {
        this.archerBowDirty = true;
        if (p < 0.5) {
          const pull = (p / 0.5) * 5.5;
          drawArcherWeapon(this.rig.weaponGraphic, this.level, pull, true);
          weaponContainer.position.set(this.weaponBaseX, this.weaponBaseY);
          weaponContainer.rotation = this.aimAngle;
          bodyContainer.position.set(-pull * 0.25, 0);
          const tipX = -2.2 - pull + 16.4;
          effectGraphic
            .clear()
            .circle(tipX, 0, 2.2 + (p / 0.5) * 2.2)
            .fill({
              color: this.level >= 3 ? 0xf9e79f : 0xabebc6,
              alpha: 0.45,
            });
          effectGraphic.visible = true;
        } else {
          const release = (p - 0.5) / 0.5;
          const stringSnap =
            Math.sin(release * Math.PI * 3) * (1 - release) * 1.5;
          const recoil = (1 - release) * 2.2;
          drawArcherWeapon(
            this.rig.weaponGraphic,
            this.level,
            stringSnap,
            false,
          );
          weaponContainer.position.set(
            this.weaponBaseX + recoil,
            this.weaponBaseY,
          );
          weaponContainer.rotation = this.aimAngle - (1 - release) * 0.1;
          bodyContainer.position.set(recoil * 0.45, 0);
          effectGraphic
            .clear()
            .arc(6, 0, 6 + release * 8, -0.55, 0.55)
            .stroke({
              width: 2.2 * (1 - release) + 0.5,
              color: this.level >= 3 ? 0xf9e79f : 0xabebc6,
              alpha: (1 - release) * 0.9,
            })
            .moveTo(8, -2.5)
            .lineTo(15 + release * 6, -2.5)
            .moveTo(8, 2.5)
            .lineTo(15 + release * 6, 2.5)
            .stroke({
              width: 1.3,
              color: 0xffffff,
              alpha: (1 - release) * 0.7,
            });
          effectGraphic.visible = true;
        }
        break;
      }
      case 'knight': {
        if (p < 0.32) {
          const w = p / 0.32;
          bodyContainer.position.set(-w * 2, 0);
          weaponContainer.position.set(
            this.weaponBaseX - w * 1.5,
            this.weaponBaseY - w * 2,
          );
          weaponContainer.rotation = -1.35 * w;
          effectGraphic.visible = false;
        } else {
          const c = (p - 0.32) / 0.68;
          const lunge = Math.sin(c * Math.PI);
          bodyContainer.position.set(lunge * 5.5, -lunge * 1.5);
          weaponContainer.position.set(
            this.weaponBaseX + lunge * 4.5,
            this.weaponBaseY,
          );
          weaponContainer.rotation = -1.35 + c * 2.5;
          const tipAngle = -1.3 + c * 2.15;
          const tipX = 2 + Math.cos(tipAngle) * 17;
          const tipY = -4 + Math.sin(tipAngle) * 17;
          effectGraphic
            .clear()
            .arc(2, -4, 17, -1.3, 0.85)
            .stroke({
              width: 3.5 * (1 - c) + 0.6,
              color: this.level >= 3 ? 0xf1c40f : 0x5dade2,
              alpha: (1 - c) * 0.9,
            })
            .arc(2, -4, 14, -1.1, 0.7)
            .stroke({
              width: 2 * (1 - c) + 0.5,
              color: 0xffffff,
              alpha: 1 - c,
            })
            .circle(tipX, tipY, 2.5 * (1 - c) + 0.8)
            .fill({ color: 0xffffff, alpha: 1 - c });
          effectGraphic.visible = true;
        }
        break;
      }
      case 'mage': {
        const lift = Math.sin(p * Math.PI) * 5.5;
        bodyContainer.position.set(0, -lift * 0.25);
        weaponContainer.position.set(
          this.weaponBaseX,
          this.weaponBaseY - lift,
        );
        weaponContainer.rotation =
          this.aimAngle * 0.5 - Math.sin(p * Math.PI) * 0.18;

        const cy = -19.5;
        const rot = p * Math.PI;
        const rLong = 7 + Math.sin(p * Math.PI) * 5;
        const rShort = 2;
        const starPts: number[] = [];
        for (let i = 0; i < 8; i++) {
          const angle = rot + (i * Math.PI) / 4;
          const rad = i % 2 === 0 ? rLong : rShort;
          starPts.push(Math.cos(angle) * rad, cy + Math.sin(angle) * rad);
        }

        effectGraphic
          .clear()
          .circle(0, cy, 6 + p * 9)
          .fill({ color: 0xbb8fce, alpha: (1 - p) * 0.35 })
          .stroke({
            width: 1.8,
            color: this.level >= 3 ? 0xf1c40f : 0xd980fa,
            alpha: 1 - p,
          })
          .circle(0, cy, 4 + p * 4.5)
          .stroke({ width: 1.2, color: 0xffffff, alpha: (1 - p) * 0.9 })
          .poly(starPts)
          .fill({
            color: this.level >= 3 ? 0xf9e79f : 0xffffff,
            alpha: (1 - p) * 0.9,
          });
        effectGraphic.visible = true;
        break;
      }
      case 'bannerman': {
        const wave = Math.sin(p * Math.PI);
        weaponContainer.position.set(this.weaponBaseX, this.weaponBaseY - wave * 4);
        weaponContainer.rotation = Math.sin(p * Math.PI * 2) * 0.16;
        effectGraphic.visible = false;
        break;
      }
      case 'miner': {
        const swing = Math.sin(p * Math.PI);
        weaponContainer.position.set(this.weaponBaseX + swing * 2, this.weaponBaseY);
        weaponContainer.rotation = -0.6 + swing * 1.3;
        effectGraphic
          .clear()
          .circle(4, -12, 3 + (1 - p) * 4)
          .fill({ color: 0xffd166, alpha: (1 - p) * 0.7 });
        effectGraphic.visible = true;
        break;
      }
      case 'frost_mage': {
        const lift = Math.sin(p * Math.PI) * 5;
        bodyContainer.position.set(0, -lift * 0.2);
        weaponContainer.position.set(
          this.weaponBaseX,
          this.weaponBaseY - lift,
        );
        weaponContainer.rotation =
          this.aimAngle * 0.5 - Math.sin(p * Math.PI) * 0.16;
        const cy = -19.5;
        effectGraphic
          .clear()
          .circle(0, cy, 5 + p * 8)
          .fill({ color: 0x38bdf8, alpha: (1 - p) * 0.35 })
          .stroke({ width: 1.8, color: 0x7df9ff, alpha: 1 - p })
          .circle(0, cy, 3.5 + p * 4)
          .stroke({ width: 1.2, color: 0xffffff, alpha: (1 - p) * 0.9 });
        effectGraphic.visible = true;
        break;
      }
    }
  }
}
