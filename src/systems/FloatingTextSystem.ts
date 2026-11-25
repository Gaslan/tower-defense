import { Container, Text } from 'pixi.js';

interface FloatingTextItem {
  readonly label: Text;
  readonly startY: number;
  elapsed: number;
  readonly duration: number;
}

export class FloatingTextSystem {
  private readonly fxLayer: Container;
  private readonly items: FloatingTextItem[] = [];

  constructor(fxLayer: Container) {
    this.fxLayer = fxLayer;
  }

  public spawnGold(screenX: number, screenY: number, amount: number): void {
    this.spawnLabel(screenX, screenY, `+${amount}g`, 0xffd166, 0x080b13, 15);
  }

  public spawnCrit(screenX: number, screenY: number, damage: number): void {
    this.spawnLabel(
      screenX,
      screenY,
      `CRIT! ${damage}`,
      0xff9f1c,
      0x2a0800,
      16,
    );
  }

  private spawnLabel(
    screenX: number,
    screenY: number,
    text: string,
    fill: number,
    strokeColor: number,
    fontSize: number,
  ): void {
    const label = new Text({
      text,
      style: {
        fontFamily: 'Nunito, system-ui, sans-serif',
        fontSize,
        fontWeight: '800',
        fill,
        stroke: { color: strokeColor, width: 3 },
        dropShadow: {
          color: 0x000000,
          alpha: 0.75,
          blur: 2,
          distance: 1,
        },
      },
    });
    label.anchor.set(0.5);
    label.eventMode = 'none';
    label.position.set(screenX, screenY);
    this.fxLayer.addChild(label);

    this.items.push({
      label,
      startY: screenY,
      elapsed: 0,
      duration: 0.85,
    });
  }

  public update(dt: number): void {
    if (dt <= 0 || this.items.length === 0) {
      return;
    }

    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.elapsed += dt;
      const t = Math.min(1, item.elapsed / item.duration);
      const easeOut = 1 - Math.pow(1 - t, 3);

      item.label.y = item.startY - 26 * easeOut;
      item.label.alpha = t > 0.55 ? 1 - (t - 0.55) / 0.45 : 1;

      if (item.elapsed >= item.duration) {
        item.label.parent?.removeChild(item.label);
        item.label.destroy();
        this.items.splice(i, 1);
      }
    }
  }

  public clear(): void {
    for (const item of this.items) {
      item.label.parent?.removeChild(item.label);
      item.label.destroy();
    }
    this.items.length = 0;
  }
}
