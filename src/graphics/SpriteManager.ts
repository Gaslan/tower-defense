import { Assets, Rectangle, Texture } from 'pixi.js';
import {
  ENEMY_SPRITE_CONFIGS,
  ENEMY_SPRITE_KEYS,
  UNIT_SPRITE_CONFIGS,
  type EnemySpriteConfig,
  type EnemySpriteKey,
  type UnitSpriteConfig,
} from '../config/sprites';
import { UNIT_LIST, type UnitId } from '../config/units';

export interface UnitSpriteFrames {
  readonly idle: Texture[];
  readonly attack: Texture[];
  readonly config: UnitSpriteConfig;
}

export interface EnemySpriteFrames {
  readonly walk: Texture[];
  readonly death: Texture[] | null;
  readonly config: EnemySpriteConfig;
}

class SpriteManagerImpl {
  private readonly cache = new Map<UnitId, UnitSpriteFrames>();
  private readonly enemyCache = new Map<EnemySpriteKey, EnemySpriteFrames>();

  public async preloadAll(): Promise<void> {
    await Promise.all([this.preloadAllUnits(), this.preloadAllEnemies()]);
  }

  public async preloadAllUnits(): Promise<void> {
    await Promise.all(
      UNIT_LIST.map(async (unit) => {
        const config = UNIT_SPRITE_CONFIGS[unit.id];
        try {
          const [idle, attack] = await Promise.all([
            this.loadStrip(
              config.idleUrl,
              config.frameWidth,
              config.frameHeight,
              config.idleFrames,
            ),
            this.loadStrip(
              config.attackUrl,
              config.frameWidth,
              config.frameHeight,
              config.attackFrames,
            ),
          ]);
          this.cache.set(unit.id, { idle, attack, config });
        } catch {
          console.info(
            `[SpriteManager] Sprite sheets not found for "${unit.id}", using procedural visuals.`,
          );
        }
      }),
    );
  }

  public async preloadAllEnemies(): Promise<void> {
    await Promise.all(
      ENEMY_SPRITE_KEYS.map(async (key) => {
        const config = ENEMY_SPRITE_CONFIGS[key];
        let walk: Texture[];
        try {
          walk = await this.loadStrip(
            config.walkUrl,
            config.frameWidth,
            config.frameHeight,
            config.walkFrames,
          );
        } catch {
          console.info(
            `[SpriteManager] Sprite sheet not found for enemy "${key}", using procedural visuals.`,
          );
          return;
        }

        let death: Texture[] | null = null;
        try {
          death = await this.loadStrip(
            config.deathUrl,
            config.frameWidth,
            config.frameHeight,
            config.deathFrames,
          );
        } catch {
          console.info(
            `[SpriteManager] Optional death sheet not found for enemy "${key}", using instant burst fallback.`,
          );
        }

        this.enemyCache.set(key, { walk, death, config });
      }),
    );
  }

  public hasSprite(unitId: UnitId): boolean {
    return this.cache.has(unitId);
  }

  public getFrames(unitId: UnitId): UnitSpriteFrames | null {
    return this.cache.get(unitId) ?? null;
  }

  public hasEnemySprite(key: EnemySpriteKey): boolean {
    return this.enemyCache.has(key);
  }

  public getEnemyFrames(key: EnemySpriteKey): EnemySpriteFrames | null {
    return this.enemyCache.get(key) ?? null;
  }

  private async loadStrip(
    url: string,
    frameWidth: number,
    frameHeight: number,
    frameCount: number,
  ): Promise<Texture[]> {
    const head = await fetch(url, { method: 'HEAD' });
    const contentType = head.headers.get('content-type') ?? '';
    if (!head.ok || !contentType.startsWith('image/')) {
      throw new Error(`Missing image asset: ${url}`);
    }

    const sheetTexture = await Assets.load<Texture>(url);
    if (
      !(sheetTexture instanceof Texture) ||
      sheetTexture.source.width < frameWidth ||
      sheetTexture.source.height < frameHeight
    ) {
      throw new Error(`Invalid sprite sheet dimensions: ${url}`);
    }

    const available = Math.max(
      1,
      Math.min(
        frameCount,
        Math.floor(sheetTexture.source.width / frameWidth),
      ),
    );
    const frames: Texture[] = [];
    for (let i = 0; i < available; i++) {
      frames.push(
        new Texture({
          source: sheetTexture.source,
          frame: new Rectangle(i * frameWidth, 0, frameWidth, frameHeight),
        }),
      );
    }
    return frames;
  }
}

export const SpriteManager = new SpriteManagerImpl();
