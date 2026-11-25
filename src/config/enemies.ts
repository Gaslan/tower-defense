export type EnemyTypeId = 'scout' | 'grunt' | 'brute';

export interface EnemyConfig {
  readonly id: EnemyTypeId;
  readonly name: string;
  readonly baseHp: number;
  readonly speed: number;
  readonly baseRewardGold: number;
  readonly baseXpReward: number;
  readonly color: number;
  readonly strokeColor: number;
  readonly radius: number;
}

export interface EnemySpawnSpec {
  readonly typeId: EnemyTypeId;
  readonly maxHp: number;
  readonly speed: number;
  readonly rewardGold: number;
  readonly xpReward: number;
  readonly color: number;
  readonly strokeColor: number;
  readonly radius: number;
  readonly isBoss: boolean;
}

export const ENEMY_CONFIGS: Readonly<Record<EnemyTypeId, EnemyConfig>> = {
  scout: {
    id: 'scout',
    name: 'Scout',
    baseHp: 35,
    speed: 2.35,
    baseRewardGold: 12,
    baseXpReward: 35,
    color: 0xf39c12,
    strokeColor: 0x9c640c,
    radius: 6.5,
  },
  grunt: {
    id: 'grunt',
    name: 'Grunt',
    baseHp: 60,
    speed: 1.55,
    baseRewardGold: 15,
    baseXpReward: 40,
    color: 0xe74c3c,
    strokeColor: 0x7b241c,
    radius: 9,
  },
  brute: {
    id: 'brute',
    name: 'Brute',
    baseHp: 145,
    speed: 0.95,
    baseRewardGold: 30,
    baseXpReward: 80,
    color: 0x8e1b1b,
    strokeColor: 0x4a0e0e,
    radius: 12,
  },
};
