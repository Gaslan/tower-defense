export type UnitId =
  | 'archer'
  | 'knight'
  | 'mage'
  | 'bannerman'
  | 'miner'
  | 'frost_mage';

export type AttackType =
  | 'projectile'
  | 'melee'
  | 'aoe'
  | 'support'
  | 'economy'
  | 'frost';

export interface UnitConfig {
  readonly id: UnitId;
  readonly name: string;
  readonly role: string;
  readonly description: string;
  readonly cost: number;
  readonly range: number;
  readonly damage: number;
  readonly fireRate: number;
  readonly color: number;
  readonly attackType: AttackType;
  readonly aoeRadius?: number;
  readonly buffDamagePct?: number;
  readonly buffFireRatePct?: number;
  readonly goldPerWave?: number;
  readonly slowFactor?: number;
  readonly slowDuration?: number;
  readonly freezeChance?: number;
  readonly freezeDuration?: number;
}

export const UNIT_CONFIGS: Readonly<Record<UnitId, UnitConfig>> = {
  archer: {
    id: 'archer',
    name: 'Archer',
    role: 'Ranged Marksman',
    description:
      'High-cadence marksman dealing single-target ranged damage from afar.',
    cost: 50,
    range: 3.5,
    damage: 15,
    fireRate: 1.5,
    color: 0x2ecc71,
    attackType: 'projectile',
  },
  knight: {
    id: 'knight',
    name: 'Knight',
    role: 'Armored Vanguard',
    description:
      'Frontline melee champion delivering heavy cleaving strikes.',
    cost: 75,
    range: 1.6,
    damage: 40,
    fireRate: 0.9,
    color: 0x3498db,
    attackType: 'melee',
  },
  mage: {
    id: 'mage',
    name: 'Mage',
    role: 'Arcane AoE Caster',
    description:
      'Arcane spellcaster hurling explosive AoE bolts into clustered foes.',
    cost: 120,
    range: 2.8,
    damage: 25,
    fireRate: 0.6,
    color: 0x9b59b6,
    attackType: 'aoe',
    aoeRadius: 1.2,
  },
  bannerman: {
    id: 'bannerman',
    name: 'Bannerman',
    role: 'War Standard',
    description:
      'Inspires nearby defenders within aura range, boosting damage and attack speed.',
    cost: 100,
    range: 1.8,
    damage: 0,
    fireRate: 0,
    color: 0xe67e22,
    attackType: 'support',
    buffDamagePct: 0.2,
    buffFireRatePct: 0.15,
  },
  miner: {
    id: 'miner',
    name: 'Gold Miner',
    role: 'Guild Prospector',
    description:
      'Excavates gold veins and delivers bonus gold at the end of every cleared wave.',
    cost: 90,
    range: 0,
    damage: 0,
    fireRate: 0,
    color: 0xd4ac0d,
    attackType: 'economy',
    goldPerWave: 35,
  },
  frost_mage: {
    id: 'frost_mage',
    name: 'Frost Mage',
    role: 'Cryomancer',
    description:
      'Fires piercing ice shards that slow enemies and have a chance to freeze them solid.',
    cost: 130,
    range: 3.0,
    damage: 14,
    fireRate: 0.85,
    color: 0x38bdf8,
    attackType: 'frost',
    slowFactor: 0.55,
    slowDuration: 2.5,
    freezeChance: 0.25,
    freezeDuration: 1.0,
  },
};

export const UNIT_LIST: readonly UnitConfig[] = [
  UNIT_CONFIGS.archer,
  UNIT_CONFIGS.knight,
  UNIT_CONFIGS.mage,
  UNIT_CONFIGS.bannerman,
  UNIT_CONFIGS.miner,
  UNIT_CONFIGS.frost_mage,
];
