import type { Container } from 'pixi.js';
import type { GameState } from '../core/GameState';

export class ScreenShakeSystem {
  private readonly worldContainer: Container;
  private readonly gameState: GameState;
  private intensity = 0;
  private duration = 0;
  private timer = 0;
  private offsetX = 0;
  private offsetY = 0;

  constructor(worldContainer: Container, gameState: GameState) {
    this.worldContainer = worldContainer;
    this.gameState = gameState;
  }

  public shake(intensity: number, duration: number): void {
    if (intensity <= 0 || duration <= 0 || this.gameState.isPaused()) {
      return;
    }

    const currentRemaining =
      this.duration > 0 ? this.intensity * (this.timer / this.duration) : 0;
    if (intensity >= currentRemaining) {
      this.intensity = intensity;
      this.duration = duration;
      this.timer = duration;
    }
  }

  public revertOffset(): void {
    if (this.offsetX === 0 && this.offsetY === 0) {
      return;
    }
    this.worldContainer.x -= this.offsetX;
    this.worldContainer.y -= this.offsetY;
    this.offsetX = 0;
    this.offsetY = 0;
  }

  public update(dt: number): void {
    this.revertOffset();

    if (this.gameState.isPaused() || dt <= 0 || this.timer <= 0) {
      return;
    }

    this.timer = Math.max(0, this.timer - dt);
    if (this.timer <= 0 || this.duration <= 0) {
      this.intensity = 0;
      this.duration = 0;
      return;
    }

    const amp = this.intensity * (this.timer / this.duration);
    this.offsetX = Math.round((Math.random() * 2 - 1) * amp);
    this.offsetY = Math.round((Math.random() * 2 - 1) * amp);
    this.worldContainer.x += this.offsetX;
    this.worldContainer.y += this.offsetY;
  }

  public clear(): void {
    this.revertOffset();
    this.intensity = 0;
    this.duration = 0;
    this.timer = 0;
  }
}
