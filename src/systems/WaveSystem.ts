import { Container } from 'pixi.js';
import { PATH_SINK_OFFSET } from '../config/constants';
import {
  ENEMY_CONFIGS,
  type EnemySpawnSpec,
  type EnemyTypeId,
} from '../config/enemies';
import { getPathConfig, type PathConfig } from '../config/maps';
import { EventBus } from '../core/EventBus';
import { GameState } from '../core/GameState';
import { gridToScreen } from '../core/IsoMath';
import { Enemy } from '../entities/Enemy';
import type { HumanUnit } from '../entities/HumanUnit';
import type { FloatingTextSystem } from './FloatingTextSystem';
import type { ParticleSystem } from './ParticleSystem';
import type { PerkSystem } from './PerkSystem';

export class WaveSystem {
  private static readonly AUTO_WAVE_DELAY = 2.5;

  private readonly entityLayer: Container;
  private readonly gameState: GameState;
  private readonly eventBus: EventBus;
  private readonly perkSystem: PerkSystem;
  private readonly floatingTextSystem: FloatingTextSystem;
  private readonly particleSystem: ParticleSystem;
  private readonly enemies: Enemy[] = [];
  private readonly spawnQueue: EnemySpawnSpec[] = [];
  private pathConfig: PathConfig = getPathConfig(1);
  private spawnTimer = 0;
  private spawnInterval = 2.0;
  private currentWaveTotal = 0;
  private waveActive = false;
  private autoWaveTimer: number | null = null;

  constructor(
    entityLayer: Container,
    gameState: GameState,
    eventBus: EventBus,
    perkSystem: PerkSystem,
    floatingTextSystem: FloatingTextSystem,
    particleSystem: ParticleSystem,
  ) {
    this.entityLayer = entityLayer;
    this.gameState = gameState;
    this.eventBus = eventBus;
    this.perkSystem = perkSystem;
    this.floatingTextSystem = floatingTextSystem;
    this.particleSystem = particleSystem;
    this.currentWaveTotal = this.getWaveEnemyCount(this.gameState.getWave());

    this.eventBus.on('autoWaveChanged', (enabled) => {
      if (!enabled) {
        this.autoWaveTimer = null;
        return;
      }
      if (
        !this.waveActive &&
        this.gameState.getWave() > 1 &&
        !this.gameState.isGameOver()
      ) {
        this.autoWaveTimer = WaveSystem.AUTO_WAVE_DELAY;
      }
    });
  }

  public getEnemies(): readonly Enemy[] {
    return this.enemies;
  }

  public isWaveActive(): boolean {
    return this.waveActive;
  }

  public setPath(pathConfig: PathConfig): void {
    this.pathConfig = pathConfig;
  }

  public startWave(): void {
    if (
      this.waveActive ||
      this.gameState.isGameOver() ||
      this.gameState.isPathVictory() ||
      this.gameState.getWave() > this.gameState.getTotalWaves()
    ) {
      return;
    }

    this.autoWaveTimer = null;
    const wave = this.gameState.getWave();
    this.spawnQueue.length = 0;
    this.spawnQueue.push(...this.buildWaveQueue(wave));
    this.currentWaveTotal = this.spawnQueue.length;
    this.spawnInterval = this.getSpawnInterval(wave);
    this.spawnTimer = 0;
    this.waveActive = true;

    this.eventBus.emit('waveStateChanged', true);
    this.emitWaveProgress();
  }

  public update(dt: number, units: readonly HumanUnit[] = []): void {
    this.cleanupFinishedCorpses();
    if (
      dt <= 0 ||
      this.gameState.isGameOver() ||
      this.gameState.isPathVictory()
    ) {
      return;
    }

    if (!this.waveActive) {
      if (this.autoWaveTimer !== null) {
        this.autoWaveTimer -= dt;
        if (this.autoWaveTimer <= 0) {
          this.autoWaveTimer = null;
          this.startWave();
        }
      }
      return;
    }

    if (this.spawnQueue.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        const spec = this.spawnQueue.shift();
        if (spec) {
          this.spawnEnemy(spec);
        }
        this.spawnTimer = this.spawnInterval;
      }
    }

    let progressDirty = false;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (!enemy.isDead && !enemy.isDying && !enemy.reachedGoal) {
        enemy.update(dt);
      }

      if (enemy.reachedGoal) {
        this.gameState.loseLife(1);
        enemy.destroy();
        this.enemies.splice(i, 1);
        progressDirty = true;
      } else if (enemy.isDead) {
        if (!enemy.countedDefeated) {
          enemy.countedDefeated = true;
          progressDirty = true;
        }
        if (!enemy.isDying) {
          enemy.destroy();
          this.enemies.splice(i, 1);
        }
      }
    }

    if (
      this.waveActive &&
      this.spawnQueue.length === 0 &&
      this.getLivingEnemyCount() === 0 &&
      !this.gameState.isGameOver()
    ) {
      this.waveActive = false;
      const clearedWave = this.gameState.getWave();
      this.processMinerWavePayouts(units);

      if (clearedWave >= this.gameState.getTotalWaves()) {
        this.autoWaveTimer = null;
        this.currentWaveTotal = 0;
        this.eventBus.emit('waveStateChanged', false);
        this.emitWaveProgress();
        this.gameState.completePath();
        return;
      }

      const nextWave = clearedWave + 1;
      this.gameState.setWave(nextWave);
      this.currentWaveTotal = this.getWaveEnemyCount(nextWave);
      this.autoWaveTimer = this.gameState.isAutoWave()
        ? WaveSystem.AUTO_WAVE_DELAY
        : null;
      this.eventBus.emit('waveStateChanged', false);
      this.emitWaveProgress();

      if (clearedWave % 3 === 0) {
        const choices = this.perkSystem.rollChoices(3);
        if (choices.length > 0) {
          this.eventBus.emit('perkSelectionOpen', {
            choices,
            stacks: this.perkSystem.getStacksSnapshot(),
          });
          this.gameState.setPaused(true);
        }
      }
      return;
    }

    if (progressDirty) {
      this.emitWaveProgress();
    }
  }

  public clear(): void {
    for (const enemy of this.enemies) {
      enemy.destroy();
    }
    this.enemies.length = 0;
    this.spawnQueue.length = 0;
    this.spawnTimer = 0;
    this.autoWaveTimer = null;
    this.waveActive = false;
    this.currentWaveTotal = this.getWaveEnemyCount(1);
    this.eventBus.emit('waveStateChanged', false);
    this.eventBus.emit('waveProgressChanged', {
      wave: 1,
      remaining: 0,
      total: this.currentWaveTotal,
      active: false,
    });
  }

  private processMinerWavePayouts(units: readonly HumanUnit[]): void {
    const xpMult = this.perkSystem.getXpMultiplier();
    for (const unit of units) {
      if (unit.isDestroyed || unit.config.attackType !== 'economy') {
        continue;
      }
      const gold = unit.goldPerWave;
      if (gold > 0) {
        unit.totalGoldMined += gold;
        this.gameState.addGold(gold);
        const pos = gridToScreen(unit.gx, unit.gy);
        this.floatingTextSystem.spawnGold(
          pos.x,
          pos.y + PATH_SINK_OFFSET - 24,
          gold,
        );
        this.particleSystem.spawnGoldSparkles(
          pos.x,
          pos.y + PATH_SINK_OFFSET - 12,
          12,
        );
      }
      unit.triggerAttackAnimation();
      const gainedXp = Math.round(unit.minerWaveXp * xpMult);
      unit.addXp(gainedXp);
      this.eventBus.emit('unitUpdated', unit);
    }
  }

  private getWaveEnemyCount(wave: number): number {
    return 4 + wave * 3;
  }

  private getSpawnInterval(wave: number): number {
    return Math.max(0.55, 2.0 * Math.pow(0.92, wave - 1));
  }

  private buildWaveQueue(wave: number): EnemySpawnSpec[] {
    const count = this.getWaveEnemyCount(wave);
    const diff = this.pathConfig.difficultyMultiplier;
    const hpMult = Math.pow(1.22, wave - 1) * diff;
    const goldMult =
      Math.pow(1.15, wave - 1) * (1 + (this.pathConfig.pathId - 1) * 0.08);
    const speedMult =
      (1 + Math.min(0.35, (wave - 1) * 0.025)) *
      Math.min(1.5, 1 + (diff - 1) * 0.12);
    const queue: EnemySpawnSpec[] = [];

    for (let i = 0; i < count; i++) {
      if (wave % 5 === 0 && i === count - 1) {
        const brute = ENEMY_CONFIGS.brute;
        queue.push({
          typeId: 'brute',
          maxHp: Math.round(brute.baseHp * hpMult * 3),
          speed: brute.speed * speedMult,
          rewardGold: Math.round(brute.baseRewardGold * goldMult * 3),
          xpReward: brute.baseXpReward * 3,
          color: brute.color,
          strokeColor: 0xf1c40f,
          radius: 14.5,
          isBoss: true,
        });
        continue;
      }

      const typeId = this.selectEnemyType(wave, i);
      const config = ENEMY_CONFIGS[typeId];
      queue.push({
        typeId,
        maxHp: Math.round(config.baseHp * hpMult),
        speed: config.speed * speedMult,
        rewardGold: Math.round(config.baseRewardGold * goldMult),
        xpReward: config.baseXpReward,
        color: config.color,
        strokeColor: config.strokeColor,
        radius: config.radius,
        isBoss: false,
      });
    }

    return queue;
  }

  private selectEnemyType(wave: number, index: number): EnemyTypeId {
    if (wave <= 1) {
      return 'grunt';
    }
    if (wave === 2) {
      return index % 3 === 1 ? 'scout' : 'grunt';
    }
    if (index % 5 === 4) {
      return 'brute';
    }
    if (index % 3 === 1) {
      return 'scout';
    }
    return 'grunt';
  }

  public cleanupFinishedCorpses(): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (enemy.isDead && !enemy.isDying) {
        enemy.destroy();
        this.enemies.splice(i, 1);
      }
    }
  }

  private getLivingEnemyCount(): number {
    let count = 0;
    for (const enemy of this.enemies) {
      if (!enemy.isDead && !enemy.isDying && !enemy.reachedGoal) {
        count += 1;
      }
    }
    return count;
  }

  private spawnEnemy(spec: EnemySpawnSpec): void {
    const enemy = new Enemy(spec, this.pathConfig.mapLayout.waypoints);
    this.entityLayer.addChild(enemy.container);
    this.enemies.push(enemy);
  }

  private emitWaveProgress(): void {
    this.eventBus.emit('waveProgressChanged', {
      wave: this.gameState.getWave(),
      remaining: this.spawnQueue.length + this.getLivingEnemyCount(),
      total: this.currentWaveTotal,
      active: this.waveActive,
    });
  }
}
