export type SkillId = 'meteor' | 'frost';

export interface SkillConfig {
  readonly id: SkillId;
  readonly name: string;
  readonly hotkey: string;
  readonly cooldown: number;
  readonly requiresTargeting: boolean;
  readonly aoeRadius?: number;
  readonly slowFactor?: number;
  readonly slowDuration?: number;
}

export const SKILL_CONFIGS: Readonly<Record<SkillId, SkillConfig>> = {
  meteor: {
    id: 'meteor',
    name: 'Meteor',
    hotkey: 'Q',
    cooldown: 25,
    requiresTargeting: true,
    aoeRadius: 1.8,
  },
  frost: {
    id: 'frost',
    name: 'Frost Wave',
    hotkey: 'W',
    cooldown: 20,
    requiresTargeting: false,
    slowFactor: 0.5,
    slowDuration: 4.5,
  },
};

export function getMeteorDamage(wave: number): number {
  return 120 + wave * 25;
}
