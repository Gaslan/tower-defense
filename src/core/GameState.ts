import {
  GRID_SIZE,
  MAP_LAYOUT,
  PROP_PLACEMENTS,
  TILE_GRASS,
  type TileType,
} from '../config/constants';
import { getPathConfig, type PathConfig } from '../config/maps';
import { UNIT_CONFIGS, type UnitConfig, type UnitId } from '../config/units';
import { EventBus, type GameSpeed } from './EventBus';
import { isValidGridCoord } from './IsoMath';

const STARTING_GOLD = 200;
const STARTING_LIVES = 10;
const STARTING_WAVE = 1;

export class GameState {
  private readonly eventBus: EventBus;
  private currentPathId = 1;
  private totalWaves = getPathConfig(1).totalWaves;
  private gold = STARTING_GOLD;
  private lives = STARTING_LIVES;
  private wave = STARTING_WAVE;
  private gameOver = false;
  private pathVictory = false;
  private gameSpeed: GameSpeed = 1;
  private isPausedState = false;
  private autoWave = false;
  private sfxVolume = 0.7;
  private particlesEnabled = true;
  private selectedUnitId: UnitId | null = null;
  private mapLayout: readonly (readonly TileType[])[] = MAP_LAYOUT;
  private readonly occupied: boolean[][];
  private readonly blockedProps: boolean[][];

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.occupied = Array.from({ length: GRID_SIZE }, () =>
      Array.from({ length: GRID_SIZE }, () => false),
    );
    this.blockedProps = Array.from({ length: GRID_SIZE }, () =>
      Array.from({ length: GRID_SIZE }, () => false),
    );
    this.applyPropPlacements(PROP_PLACEMENTS);
  }

  public getCurrentPathId(): number {
    return this.currentPathId;
  }

  public getTotalWaves(): number {
    return this.totalWaves;
  }

  public setPathConfig(pathConfig: PathConfig): void {
    this.currentPathId = pathConfig.pathId;
    this.totalWaves = pathConfig.totalWaves;
    this.mapLayout = pathConfig.mapLayout.tileGrid;
    this.applyPropPlacements(pathConfig.mapLayout.props);
    this.eventBus.emit('activePathChanged', this.currentPathId);
    this.reset();
  }

  public getGold(): number {
    return this.gold;
  }

  public getLives(): number {
    return this.lives;
  }

  public getWave(): number {
    return this.wave;
  }

  public isGameOver(): boolean {
    return this.gameOver;
  }

  public isPathVictory(): boolean {
    return this.pathVictory;
  }

  public completePath(): void {
    if (this.gameOver || this.pathVictory) {
      return;
    }
    this.pathVictory = true;
    this.selectedUnitId = null;
    this.eventBus.emit('unitSelected', null);
    this.setPaused(true);
    this.eventBus.emit('pathCompleted', this.currentPathId);
  }

  public getGameSpeed(): GameSpeed {
    return this.gameSpeed;
  }

  public setGameSpeed(speed: GameSpeed): void {
    if (this.gameSpeed === speed) {
      return;
    }
    this.gameSpeed = speed;
    this.eventBus.emit('gameSpeedChanged', this.gameSpeed);
  }

  public cycleGameSpeed(): GameSpeed {
    const next: GameSpeed =
      this.gameSpeed === 1 ? 2 : this.gameSpeed === 2 ? 3 : 1;
    this.setGameSpeed(next);
    return next;
  }

  public isPaused(): boolean {
    return this.isPausedState;
  }

  public setPaused(paused: boolean): void {
    if (this.isPausedState === paused) {
      return;
    }
    this.isPausedState = paused;
    this.eventBus.emit('pauseChanged', this.isPausedState);
  }

  public togglePaused(): boolean {
    this.setPaused(!this.isPausedState);
    return this.isPausedState;
  }

  public isAutoWave(): boolean {
    return this.autoWave;
  }

  public setAutoWave(autoWave: boolean): void {
    if (this.autoWave === autoWave) {
      return;
    }
    this.autoWave = autoWave;
    this.eventBus.emit('autoWaveChanged', this.autoWave);
  }

  public toggleAutoWave(): boolean {
    this.setAutoWave(!this.autoWave);
    return this.autoWave;
  }

  public getSfxVolume(): number {
    return this.sfxVolume;
  }

  public setSfxVolume(volume: number): void {
    const clamped = Math.min(1, Math.max(0, volume));
    if (this.sfxVolume === clamped) {
      return;
    }
    this.sfxVolume = clamped;
    this.eventBus.emit('sfxVolumeChanged', this.sfxVolume);
  }

  public isParticlesEnabled(): boolean {
    return this.particlesEnabled;
  }

  public setParticlesEnabled(enabled: boolean): void {
    if (this.particlesEnabled === enabled) {
      return;
    }
    this.particlesEnabled = enabled;
    this.eventBus.emit('particlesEnabledChanged', this.particlesEnabled);
  }

  public toggleParticlesEnabled(): boolean {
    this.setParticlesEnabled(!this.particlesEnabled);
    return this.particlesEnabled;
  }

  public getSelectedUnitId(): UnitId | null {
    return this.selectedUnitId;
  }

  public getSelectedUnitConfig(): UnitConfig | null {
    if (this.selectedUnitId === null) {
      return null;
    }
    return UNIT_CONFIGS[this.selectedUnitId];
  }

  public spendGold(amount: number): boolean {
    if (amount < 0 || this.gold < amount) {
      return false;
    }
    this.gold -= amount;
    this.eventBus.emit('goldChanged', this.gold);
    return true;
  }

  public addGold(amount: number): void {
    if (amount <= 0) {
      return;
    }
    this.gold += amount;
    this.eventBus.emit('goldChanged', this.gold);
  }

  public addLives(amount: number): void {
    if (amount <= 0 || this.gameOver) {
      return;
    }
    this.lives += amount;
    this.eventBus.emit('livesChanged', this.lives);
  }

  public loseLife(amount = 1): void {
    if (amount <= 0 || this.gameOver) {
      return;
    }
    this.lives = Math.max(0, this.lives - amount);
    this.eventBus.emit('livesChanged', this.lives);
    if (this.lives === 0 && !this.gameOver) {
      this.gameOver = true;
      this.eventBus.emit('gameOverChanged', true);
    }
  }

  public setWave(wave: number): void {
    this.wave = wave;
    this.eventBus.emit('waveChanged', this.wave);
  }

  public reset(): void {
    this.gold = STARTING_GOLD;
    this.lives = STARTING_LIVES;
    this.wave = STARTING_WAVE;
    this.gameOver = false;
    this.pathVictory = false;
    this.selectedUnitId = null;

    for (let gy = 0; gy < GRID_SIZE; gy++) {
      for (let gx = 0; gx < GRID_SIZE; gx++) {
        this.occupied[gy][gx] = false;
      }
    }

    this.eventBus.emit('goldChanged', this.gold);
    this.eventBus.emit('livesChanged', this.lives);
    this.eventBus.emit('waveChanged', this.wave);
    this.eventBus.emit('unitSelected', null);
    this.eventBus.emit('gameOverChanged', false);
    this.setPaused(false);
  }

  private applyPropPlacements(
    placements: readonly { readonly gx: number; readonly gy: number }[],
  ): void {
    for (let gy = 0; gy < GRID_SIZE; gy++) {
      for (let gx = 0; gx < GRID_SIZE; gx++) {
        this.blockedProps[gy][gx] = false;
      }
    }
    for (const prop of placements) {
      if (isValidGridCoord(prop.gx, prop.gy)) {
        this.blockedProps[prop.gy][prop.gx] = true;
      }
    }
  }

  public selectUnit(unitId: UnitId | null): void {
    if (this.selectedUnitId === unitId) {
      return;
    }
    this.selectedUnitId = unitId;
    this.eventBus.emit('unitSelected', this.selectedUnitId);
  }

  public isTileOccupied(gx: number, gy: number): boolean {
    if (!isValidGridCoord(gx, gy)) {
      return false;
    }
    return this.occupied[gy][gx];
  }

  public setTileOccupied(gx: number, gy: number, occupied: boolean): void {
    if (!isValidGridCoord(gx, gy)) {
      return;
    }
    this.occupied[gy][gx] = occupied;
  }

  public isTileProp(gx: number, gy: number): boolean {
    if (!isValidGridCoord(gx, gy)) {
      return false;
    }
    return this.blockedProps[gy][gx];
  }

  public isTileBuildable(gx: number, gy: number): boolean {
    if (!isValidGridCoord(gx, gy)) {
      return false;
    }
    return (
      this.mapLayout[gy][gx] === TILE_GRASS &&
      !this.occupied[gy][gx] &&
      !this.blockedProps[gy][gx]
    );
  }
}
