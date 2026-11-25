export type PerkId =
  | 'archer_crit'
  | 'knight_stun'
  | 'mage_burn'
  | 'gold_rush'
  | 'global_haste'
  | 'xp_boost'
  | 'skill_cdr'
  | 'fortify_base';

export type PerkRarity = 'common' | 'rare' | 'epic';

export interface PerkConfig {
  readonly id: PerkId;
  readonly name: string;
  readonly description: string;
  readonly rarity: PerkRarity;
  readonly maxStacks: number;
  readonly icon: string;
}

export const PERK_CONFIGS: Readonly<Record<PerkId, PerkConfig>> = {
  archer_crit: {
    id: 'archer_crit',
    name: 'Eagle Eye',
    description: 'Archers gain +20% Critical Hit chance (2x damage).',
    rarity: 'rare',
    maxStacks: 3,
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="13" fill="rgba(245,176,65,0.18)" stroke="#ffd166" stroke-width="2"/><circle cx="18" cy="18" r="7" fill="none" stroke="#ff7b00" stroke-width="2"/><circle cx="18" cy="18" r="2.5" fill="#fff3b0"/><path d="M18 2v6M18 28v6M2 18h6M28 18h6" stroke="#ffd166" stroke-width="2.2" stroke-linecap="round"/></svg>',
  },
  knight_stun: {
    id: 'knight_stun',
    name: 'Concussive Bash',
    description: 'Knight melee hits stun enemies for +0.35s.',
    rarity: 'epic',
    maxStacks: 2,
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path d="M8 28L22 14" stroke="#cbd7f0" stroke-width="3.6" stroke-linecap="round"/><rect x="19" y="7" width="11" height="8" rx="2" transform="rotate(-45 24 11)" fill="#d980fa" stroke="#ffffff" stroke-width="1.6"/><polygon points="27,5 28.5,8.5 32,10 28.5,11.5 27,15 25.5,11.5 22,10 25.5,8.5" fill="#ffd166"/><circle cx="11" cy="11" r="2" fill="#ffd166"/></svg>',
  },
  mage_burn: {
    id: 'mage_burn',
    name: 'Pyromancer',
    description: 'Mage AoE impacts ignite enemies for 18 burn DPS over 3s.',
    rarity: 'rare',
    maxStacks: 3,
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path d="M18 4c3 5 9 8.5 9 15.5A9 9 0 1 1 9 19.5c0-4.2 2.2-7.2 4.5-9.5.3 3 1.8 4.4 3.2 4.4 0-3.8 1.3-7.6 1.3-10.4z" fill="#ff5722" stroke="#ffd166" stroke-width="1.7" stroke-linejoin="round"/><path d="M18 14c1.8 2.8 4.2 4.5 4.2 8a4.2 4.2 0 1 1-8.4 0c0-2.5 1.4-4.5 4.2-8z" fill="#ffd166"/></svg>',
  },
  gold_rush: {
    id: 'gold_rush',
    name: 'Gold Rush',
    description: 'Enemies drop +20% more gold on death.',
    rarity: 'common',
    maxStacks: 4,
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="15" cy="20" r="9.5" fill="#f5b041" stroke="#7d4a02" stroke-width="2"/><circle cx="15" cy="20" r="6" fill="#ffd166" stroke="#b7791f" stroke-width="1.2"/><circle cx="22" cy="14" r="9" fill="#ffd166" stroke="#7d4a02" stroke-width="2"/><path d="M22 9v10M19.8 11.5c0-1 1-1.5 2.2-1.5s2.2.5 2.2 1.5-1 1.4-2.2 1.7-2.2.8-2.2 1.8 1 1.5 2.2 1.5 2.2-.5 2.2-1.5" fill="none" stroke="#7d4a02" stroke-width="1.6" stroke-linecap="round"/></svg>',
  },
  global_haste: {
    id: 'global_haste',
    name: 'Battle Fervor',
    description: 'All units gain +12% faster attack speed.',
    rarity: 'common',
    maxStacks: 4,
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><polygon points="20,4 9,19 17,19 15,32 27,16 19,16" fill="#3be082" stroke="#ffffff" stroke-width="1.6" stroke-linejoin="round"/><path d="M7 11h5M5 24h6" stroke="#a7f3d0" stroke-width="2" stroke-linecap="round"/></svg>',
  },
  xp_boost: {
    id: 'xp_boost',
    name: 'War Veteran',
    description: 'All units gain +30% bonus XP from kills.',
    rarity: 'common',
    maxStacks: 3,
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path d="M7 10h22l-4 17H11L7 10z" fill="#2ecc71" stroke="#ffd166" stroke-width="1.8" stroke-linejoin="round"/><polygon points="18,11 20.4,16 26,16.7 22,20.5 23,26 18,23.3 13,26 14,20.5 10,16.7 15.6,16" fill="#ffd166" stroke="#7d4a02" stroke-width="1"/></svg>',
  },
  skill_cdr: {
    id: 'skill_cdr',
    name: 'Arcane Surge',
    description: 'Meteor & Frost Wave cooldowns reduced by 15%.',
    rarity: 'rare',
    maxStacks: 3,
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="19" r="11" fill="rgba(93,173,226,0.22)" stroke="#5dade2" stroke-width="2.2"/><path d="M18 11v8l5.5 3.5" fill="none" stroke="#ffd166" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 5h8M18 5v3" stroke="#bae6fd" stroke-width="2.4" stroke-linecap="round"/><path d="M27 7l3 3" stroke="#5dade2" stroke-width="2.2" stroke-linecap="round"/></svg>',
  },
  fortify_base: {
    id: 'fortify_base',
    name: 'Royal Bastion',
    description: 'Instant: Gain +3 Kingdom Lives and +75 Gold immediately.',
    rarity: 'common',
    maxStacks: 5,
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path d="M18 4L30 9.5V19c0 7.6-5.2 13-12 15-6.8-2-12-7.4-12-15V9.5L18 4z" fill="#1e8449" stroke="#ffd166" stroke-width="2" stroke-linejoin="round"/><path d="M18 12v10M13 17h10" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/></svg>',
  },
};

export const PERK_LIST: readonly PerkConfig[] = Object.values(PERK_CONFIGS);
