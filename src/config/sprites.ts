import type { UnitId } from './units';

export type EnemySpriteKey = 'scout' | 'grunt' | 'brute' | 'boss';

export interface UnitSpriteConfig {
  readonly idleUrl: string;
  readonly attackUrl: string;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly idleFrames: number;
  readonly attackFrames: number;
  readonly displayHeight: number;
  readonly anchorY: number;
  readonly idleFps: number;
  readonly attackFps: number;
}

export interface EnemySpriteConfig {
  readonly walkUrl: string;
  readonly deathUrl: string;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly walkFrames: number;
  readonly deathFrames: number;
  readonly displayHeight: number;
  readonly anchorY: number;
  readonly walkFps: number;
  readonly deathFps: number;
}

export const ENEMY_SPRITE_KEYS: readonly EnemySpriteKey[] = [
  'scout',
  'grunt',
  'brute',
  'boss',
];

export const ENEMY_SPRITE_CONFIGS: Readonly<
  Record<EnemySpriteKey, EnemySpriteConfig>
> = {
  scout: {
    walkUrl: '/assets/enemies/scout/walk.png',
    deathUrl: '/assets/enemies/scout/death.png',
    frameWidth: 128,
    frameHeight: 128,
    walkFrames: 6,
    deathFrames: 6,
    displayHeight: 44,
    anchorY: 0.85,
    walkFps: 12,
    deathFps: 14,
  },
  grunt: {
    walkUrl: '/assets/enemies/grunt/walk.png',
    deathUrl: '/assets/enemies/grunt/death.png',
    frameWidth: 128,
    frameHeight: 128,
    walkFrames: 6,
    deathFrames: 6,
    displayHeight: 52,
    anchorY: 0.85,
    walkFps: 10,
    deathFps: 14,
  },
  brute: {
    walkUrl: '/assets/enemies/brute/walk.png',
    deathUrl: '/assets/enemies/brute/death.png',
    frameWidth: 128,
    frameHeight: 128,
    walkFrames: 6,
    deathFrames: 6,
    displayHeight: 64,
    anchorY: 0.85,
    walkFps: 8,
    deathFps: 13,
  },
  boss: {
    walkUrl: '/assets/enemies/boss/walk.png',
    deathUrl: '/assets/enemies/boss/death.png',
    frameWidth: 128,
    frameHeight: 128,
    walkFrames: 6,
    deathFrames: 6,
    displayHeight: 82,
    anchorY: 0.85,
    walkFps: 8,
    deathFps: 12,
  },
};

export const UNIT_SPRITE_CONFIGS: Readonly<Record<UnitId, UnitSpriteConfig>> = {
  archer: {
    idleUrl: '/assets/units/archer/idle.png',
    attackUrl: '/assets/units/archer/attack.png',
    frameWidth: 128,
    frameHeight: 128,
    idleFrames: 4,
    attackFrames: 6,
    displayHeight: 56,
    anchorY: 0.85,
    idleFps: 6,
    attackFps: 14,
  },
  knight: {
    idleUrl: '/assets/units/knight/idle.png',
    attackUrl: '/assets/units/knight/attack.png',
    frameWidth: 128,
    frameHeight: 128,
    idleFrames: 4,
    attackFrames: 6,
    displayHeight: 58,
    anchorY: 0.85,
    idleFps: 6,
    attackFps: 14,
  },
  mage: {
    idleUrl: '/assets/units/mage/idle.png',
    attackUrl: '/assets/units/mage/attack.png',
    frameWidth: 128,
    frameHeight: 128,
    idleFrames: 4,
    attackFrames: 6,
    displayHeight: 58,
    anchorY: 0.85,
    idleFps: 6,
    attackFps: 12,
  },
  bannerman: {
    idleUrl: '/assets/units/bannerman/idle.png',
    attackUrl: '/assets/units/bannerman/attack.png',
    frameWidth: 128,
    frameHeight: 128,
    idleFrames: 4,
    attackFrames: 6,
    displayHeight: 62,
    anchorY: 0.85,
    idleFps: 6,
    attackFps: 12,
  },
  miner: {
    idleUrl: '/assets/units/miner/idle.png',
    attackUrl: '/assets/units/miner/attack.png',
    frameWidth: 128,
    frameHeight: 128,
    idleFrames: 4,
    attackFrames: 6,
    displayHeight: 54,
    anchorY: 0.85,
    idleFps: 6,
    attackFps: 12,
  },
  frost_mage: {
    idleUrl: '/assets/units/frost_mage/idle.png',
    attackUrl: '/assets/units/frost_mage/attack.png',
    frameWidth: 128,
    frameHeight: 128,
    idleFrames: 4,
    attackFrames: 6,
    displayHeight: 58,
    anchorY: 0.85,
    idleFps: 6,
    attackFps: 13,
  },
};
