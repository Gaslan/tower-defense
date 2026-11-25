import { UNIT_CONFIGS, UNIT_LIST, type UnitId } from '../config/units';
import type { EventBus } from './EventBus';

export const PROFILE_STORAGE_KEY = 'iso_td_profile_v1';

export type UnitUpgradeStat = 'damage' | 'range' | 'fireRate' | 'maxLevel';

export const MAX_DAMAGE_LEVEL = 10;
export const MAX_RANGE_LEVEL = 6;
export const MAX_FIRE_RATE_LEVEL = 8;
export const MIN_IN_GAME_LEVEL = 3;
export const MAX_IN_GAME_LEVEL = 6;
export const MAX_LEVEL_UPGRADE_COSTS: readonly number[] = [120, 250, 450];

export interface UnitMetaUpgrade {
  damageLevel: number;
  rangeLevel: number;
  fireRateLevel: number;
  maxInGameLevel: number;
}

export interface StatUpgradePreview {
  readonly stat: UnitUpgradeStat;
  readonly level: number;
  readonly maxLevel: number;
  readonly isMaxed: boolean;
  readonly cost: number | null;
  readonly currentValue: number;
  readonly nextValue: number | null;
}

export interface UnitEffectiveStats {
  readonly damage: number;
  readonly range: number;
  readonly fireRate: number;
  readonly maxInGameLevel: number;
  readonly buffDamagePct: number;
  readonly buffFireRatePct: number;
  readonly goldPerWave: number;
  readonly minerWaveXp: number;
}

export interface PlayerLevelProgress {
  readonly playerLevel: number;
  readonly currentLevelXp: number;
  readonly xpForNextLevel: number;
}

export interface PlayerProfile {
  highestUnlockedPath: number;
  pathStars: Record<number, number>;
  crystals: number;
  totalXp: number;
  playerLevel: number;
  totalEnemiesKilled: number;
  totalGoldEarned: number;
  unitUpgrades: Record<string, UnitMetaUpgrade>;
}

function createDefaultUnitUpgrade(): UnitMetaUpgrade {
  return {
    damageLevel: 0,
    rangeLevel: 0,
    fireRateLevel: 0,
    maxInGameLevel: MIN_IN_GAME_LEVEL,
  };
}

function createDefaultProfile(): PlayerProfile {
  const unitUpgrades: Record<string, UnitMetaUpgrade> = {};
  for (const unit of UNIT_LIST) {
    unitUpgrades[unit.id] = createDefaultUnitUpgrade();
  }
  return {
    highestUnlockedPath: 1,
    pathStars: {},
    crystals: 0,
    totalXp: 0,
    playerLevel: 1,
    totalEnemiesKilled: 0,
    totalGoldEarned: 0,
    unitUpgrades,
  };
}

export function computeLevelProgress(totalXp: number): PlayerLevelProgress {
  let remaining = Math.max(0, Math.floor(totalXp));
  let playerLevel = 1;
  let xpForNextLevel = 100;

  while (remaining >= xpForNextLevel) {
    remaining -= xpForNextLevel;
    playerLevel += 1;
    xpForNextLevel = 100 + (playerLevel - 1) * 50;
  }

  return {
    playerLevel,
    currentLevelXp: remaining,
    xpForNextLevel,
  };
}

function toSafeNonNegInt(value: unknown, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    return fallback;
  }
  return Math.floor(num);
}

function sanitizeProfile(raw: unknown): PlayerProfile {
  const defaults = createDefaultProfile();
  if (typeof raw !== 'object' || raw === null) {
    return defaults;
  }

  const record = raw as Record<string, unknown>;
  const highestUnlockedPath = Math.max(
    1,
    toSafeNonNegInt(record.highestUnlockedPath, 1),
  );
  const crystals = toSafeNonNegInt(record.crystals, 0);
  const totalXp = toSafeNonNegInt(record.totalXp, 0);
  const { playerLevel } = computeLevelProgress(totalXp);
  const totalEnemiesKilled = toSafeNonNegInt(record.totalEnemiesKilled, 0);
  const totalGoldEarned = toSafeNonNegInt(record.totalGoldEarned, 0);

  const pathStars: Record<number, number> = {};
  if (typeof record.pathStars === 'object' && record.pathStars !== null) {
    for (const [key, val] of Object.entries(
      record.pathStars as Record<string, unknown>,
    )) {
      const pathId = Number(key);
      const stars = toSafeNonNegInt(val, 0);
      if (Number.isInteger(pathId) && pathId >= 1 && stars >= 1) {
        pathStars[pathId] = Math.min(3, stars);
      }
    }
  }

  const unitUpgrades: Record<string, UnitMetaUpgrade> = {
    ...defaults.unitUpgrades,
  };
  if (
    typeof record.unitUpgrades === 'object' &&
    record.unitUpgrades !== null
  ) {
    for (const [unitId, val] of Object.entries(
      record.unitUpgrades as Record<string, unknown>,
    )) {
      if (typeof val !== 'object' || val === null) {
        continue;
      }
      const u = val as Record<string, unknown>;
      unitUpgrades[unitId] = {
        damageLevel: Math.min(
          MAX_DAMAGE_LEVEL,
          toSafeNonNegInt(u.damageLevel, 0),
        ),
        rangeLevel: Math.min(MAX_RANGE_LEVEL, toSafeNonNegInt(u.rangeLevel, 0)),
        fireRateLevel: Math.min(
          MAX_FIRE_RATE_LEVEL,
          toSafeNonNegInt(u.fireRateLevel, 0),
        ),
        maxInGameLevel: Math.min(
          MAX_IN_GAME_LEVEL,
          Math.max(
            MIN_IN_GAME_LEVEL,
            toSafeNonNegInt(u.maxInGameLevel, MIN_IN_GAME_LEVEL),
          ),
        ),
      };
    }
  }

  return {
    highestUnlockedPath,
    pathStars,
    crystals,
    totalXp,
    playerLevel,
    totalEnemiesKilled,
    totalGoldEarned,
    unitUpgrades,
  };
}

export class ProfileManager {
  private readonly eventBus: EventBus;
  private profile: PlayerProfile;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.profile = this.load();
  }

  public getProfile(): Readonly<PlayerProfile> {
    return this.profile;
  }

  public getLevelProgress(): PlayerLevelProgress {
    return computeLevelProgress(this.profile.totalXp);
  }

  public addCrystals(amount: number): void {
    const safeAmount = Math.floor(amount);
    if (safeAmount <= 0) {
      return;
    }
    this.profile.crystals += safeAmount;
    this.saveAndNotify();
  }

  public spendCrystals(amount: number): boolean {
    const safeAmount = Math.floor(amount);
    if (safeAmount <= 0 || this.profile.crystals < safeAmount) {
      return false;
    }
    this.profile.crystals -= safeAmount;
    this.saveAndNotify();
    return true;
  }

  public addBattleTotals(enemiesKilled: number, goldEarned: number): void {
    const safeKills = Math.max(0, Math.floor(enemiesKilled));
    const safeGold = Math.max(0, Math.floor(goldEarned));
    if (safeKills === 0 && safeGold === 0) {
      return;
    }
    this.profile.totalEnemiesKilled += safeKills;
    this.profile.totalGoldEarned += safeGold;
    this.saveAndNotify();
  }

  public recordPathCompletion(
    pathId: number,
    stars: number,
    crystalsEarned: number,
    xpEarned: number,
  ): void {
    const safeStars = Math.min(3, Math.max(1, Math.floor(stars)));
    const prevStars = this.profile.pathStars[pathId] ?? 0;
    this.profile.pathStars[pathId] = Math.max(prevStars, safeStars);

    if (pathId >= this.profile.highestUnlockedPath) {
      this.profile.highestUnlockedPath = pathId + 1;
    }

    this.profile.crystals += Math.max(0, Math.floor(crystalsEarned));
    this.profile.totalXp += Math.max(0, Math.floor(xpEarned));
    this.profile.playerLevel = computeLevelProgress(
      this.profile.totalXp,
    ).playerLevel;
    this.saveAndNotify();
  }

  public recordDefeatReward(crystalsEarned: number, xpEarned: number): void {
    const safeCrystals = Math.max(0, Math.floor(crystalsEarned));
    const safeXp = Math.max(0, Math.floor(xpEarned));
    if (safeCrystals === 0 && safeXp === 0) {
      return;
    }
    this.profile.crystals += safeCrystals;
    this.profile.totalXp += safeXp;
    this.profile.playerLevel = computeLevelProgress(
      this.profile.totalXp,
    ).playerLevel;
    this.saveAndNotify();
  }

  public getUnitUpgrade(unitId: UnitId): Readonly<UnitMetaUpgrade> {
    return this.profile.unitUpgrades[unitId] ?? createDefaultUnitUpgrade();
  }

  public getStatUpgradePreview(
    unitId: UnitId,
    stat: UnitUpgradeStat,
  ): StatUpgradePreview {
    const base = UNIT_CONFIGS[unitId];
    const upgrade = this.getUnitUpgrade(unitId);

    if (base.attackType === 'support') {
      const baseDmgPct = (base.buffDamagePct ?? 0.2) * 100;
      const baseRatePct = (base.buffFireRatePct ?? 0.15) * 100;
      switch (stat) {
        case 'damage': {
          const level = upgrade.damageLevel;
          const isMaxed = level >= MAX_DAMAGE_LEVEL;
          return {
            stat,
            level,
            maxLevel: MAX_DAMAGE_LEVEL,
            isMaxed,
            cost: isMaxed ? null : Math.floor(30 * Math.pow(1.45, level)),
            currentValue: Number((baseDmgPct * (1 + level * 0.1)).toFixed(1)),
            nextValue: isMaxed
              ? null
              : Number((baseDmgPct * (1 + (level + 1) * 0.1)).toFixed(1)),
          };
        }
        case 'range': {
          const level = upgrade.rangeLevel;
          const isMaxed = level >= MAX_RANGE_LEVEL;
          return {
            stat,
            level,
            maxLevel: MAX_RANGE_LEVEL,
            isMaxed,
            cost: isMaxed ? null : Math.floor(40 * Math.pow(1.55, level)),
            currentValue: Number((base.range * (1 + level * 0.05)).toFixed(2)),
            nextValue: isMaxed
              ? null
              : Number((base.range * (1 + (level + 1) * 0.05)).toFixed(2)),
          };
        }
        case 'fireRate': {
          const level = upgrade.fireRateLevel;
          const isMaxed = level >= MAX_FIRE_RATE_LEVEL;
          return {
            stat,
            level,
            maxLevel: MAX_FIRE_RATE_LEVEL,
            isMaxed,
            cost: isMaxed ? null : Math.floor(35 * Math.pow(1.5, level)),
            currentValue: Number((baseRatePct * (1 + level * 0.08)).toFixed(1)),
            nextValue: isMaxed
              ? null
              : Number((baseRatePct * (1 + (level + 1) * 0.08)).toFixed(1)),
          };
        }
        case 'maxLevel': {
          const level = upgrade.maxInGameLevel;
          const isMaxed = level >= MAX_IN_GAME_LEVEL;
          const costIndex = level - MIN_IN_GAME_LEVEL;
          return {
            stat,
            level,
            maxLevel: MAX_IN_GAME_LEVEL,
            isMaxed,
            cost: isMaxed ? null : (MAX_LEVEL_UPGRADE_COSTS[costIndex] ?? null),
            currentValue: level,
            nextValue: isMaxed ? null : level + 1,
          };
        }
      }
    }

    if (base.attackType === 'economy') {
      const baseGold = base.goldPerWave ?? 35;
      const calcGold = (dmgLvl: number, spdLvl: number): number =>
        Math.round(baseGold * (1 + dmgLvl * 0.1) * (1 + spdLvl * 0.08));

      switch (stat) {
        case 'damage': {
          const level = upgrade.damageLevel;
          const isMaxed = level >= MAX_DAMAGE_LEVEL;
          return {
            stat,
            level,
            maxLevel: MAX_DAMAGE_LEVEL,
            isMaxed,
            cost: isMaxed ? null : Math.floor(30 * Math.pow(1.45, level)),
            currentValue: calcGold(level, upgrade.fireRateLevel),
            nextValue: isMaxed
              ? null
              : calcGold(level + 1, upgrade.fireRateLevel),
          };
        }
        case 'range': {
          const level = upgrade.rangeLevel;
          const isMaxed = level >= MAX_RANGE_LEVEL;
          return {
            stat,
            level,
            maxLevel: MAX_RANGE_LEVEL,
            isMaxed,
            cost: isMaxed ? null : Math.floor(40 * Math.pow(1.55, level)),
            currentValue: Math.round(60 * (1 + level * 0.1)),
            nextValue: isMaxed ? null : Math.round(60 * (1 + (level + 1) * 0.1)),
          };
        }
        case 'fireRate': {
          const level = upgrade.fireRateLevel;
          const isMaxed = level >= MAX_FIRE_RATE_LEVEL;
          return {
            stat,
            level,
            maxLevel: MAX_FIRE_RATE_LEVEL,
            isMaxed,
            cost: isMaxed ? null : Math.floor(35 * Math.pow(1.5, level)),
            currentValue: calcGold(upgrade.damageLevel, level),
            nextValue: isMaxed
              ? null
              : calcGold(upgrade.damageLevel, level + 1),
          };
        }
        case 'maxLevel': {
          const level = upgrade.maxInGameLevel;
          const isMaxed = level >= MAX_IN_GAME_LEVEL;
          const costIndex = level - MIN_IN_GAME_LEVEL;
          return {
            stat,
            level,
            maxLevel: MAX_IN_GAME_LEVEL,
            isMaxed,
            cost: isMaxed ? null : (MAX_LEVEL_UPGRADE_COSTS[costIndex] ?? null),
            currentValue: level,
            nextValue: isMaxed ? null : level + 1,
          };
        }
      }
    }

    switch (stat) {
      case 'damage': {
        const level = upgrade.damageLevel;
        const isMaxed = level >= MAX_DAMAGE_LEVEL;
        return {
          stat,
          level,
          maxLevel: MAX_DAMAGE_LEVEL,
          isMaxed,
          cost: isMaxed ? null : Math.floor(30 * Math.pow(1.45, level)),
          currentValue: Number((base.damage * (1 + level * 0.1)).toFixed(1)),
          nextValue: isMaxed
            ? null
            : Number((base.damage * (1 + (level + 1) * 0.1)).toFixed(1)),
        };
      }
      case 'range': {
        const level = upgrade.rangeLevel;
        const isMaxed = level >= MAX_RANGE_LEVEL;
        return {
          stat,
          level,
          maxLevel: MAX_RANGE_LEVEL,
          isMaxed,
          cost: isMaxed ? null : Math.floor(40 * Math.pow(1.55, level)),
          currentValue: Number((base.range * (1 + level * 0.05)).toFixed(2)),
          nextValue: isMaxed
            ? null
            : Number((base.range * (1 + (level + 1) * 0.05)).toFixed(2)),
        };
      }
      case 'fireRate': {
        const level = upgrade.fireRateLevel;
        const isMaxed = level >= MAX_FIRE_RATE_LEVEL;
        return {
          stat,
          level,
          maxLevel: MAX_FIRE_RATE_LEVEL,
          isMaxed,
          cost: isMaxed ? null : Math.floor(35 * Math.pow(1.5, level)),
          currentValue: Number((base.fireRate * (1 + level * 0.08)).toFixed(2)),
          nextValue: isMaxed
            ? null
            : Number((base.fireRate * (1 + (level + 1) * 0.08)).toFixed(2)),
        };
      }
      case 'maxLevel': {
        const level = upgrade.maxInGameLevel;
        const isMaxed = level >= MAX_IN_GAME_LEVEL;
        const costIndex = level - MIN_IN_GAME_LEVEL;
        return {
          stat,
          level,
          maxLevel: MAX_IN_GAME_LEVEL,
          isMaxed,
          cost: isMaxed ? null : (MAX_LEVEL_UPGRADE_COSTS[costIndex] ?? null),
          currentValue: level,
          nextValue: isMaxed ? null : level + 1,
        };
      }
    }
  }

  public upgradeUnitStat(unitId: UnitId, stat: UnitUpgradeStat): boolean {
    const preview = this.getStatUpgradePreview(unitId, stat);
    if (
      preview.isMaxed ||
      preview.cost === null ||
      this.profile.crystals < preview.cost
    ) {
      return false;
    }

    this.profile.crystals -= preview.cost;
    const upgrade =
      this.profile.unitUpgrades[unitId] ?? createDefaultUnitUpgrade();
    this.profile.unitUpgrades[unitId] = upgrade;

    switch (stat) {
      case 'damage':
        upgrade.damageLevel += 1;
        break;
      case 'range':
        upgrade.rangeLevel += 1;
        break;
      case 'fireRate':
        upgrade.fireRateLevel += 1;
        break;
      case 'maxLevel':
        upgrade.maxInGameLevel += 1;
        break;
    }

    this.saveAndNotify();
    return true;
  }

  public getUnitEffectiveStats(unitId: string): UnitEffectiveStats {
    const resolvedId: UnitId =
      unitId in UNIT_CONFIGS ? (unitId as UnitId) : 'archer';
    const base = UNIT_CONFIGS[resolvedId];
    const upgrade = this.getUnitUpgrade(resolvedId);

    const buffDamagePct =
      base.attackType === 'support'
        ? Number(
            ((base.buffDamagePct ?? 0.2) * (1 + upgrade.damageLevel * 0.1)).toFixed(
              3,
            ),
          )
        : 0;
    const buffFireRatePct =
      base.attackType === 'support'
        ? Number(
            (
              (base.buffFireRatePct ?? 0.15) *
              (1 + upgrade.fireRateLevel * 0.08)
            ).toFixed(3),
          )
        : 0;
    const goldPerWave =
      base.attackType === 'economy'
        ? Math.round(
            (base.goldPerWave ?? 35) *
              (1 + upgrade.damageLevel * 0.1) *
              (1 + upgrade.fireRateLevel * 0.08),
          )
        : 0;
    const minerWaveXp =
      base.attackType === 'economy'
        ? Math.round(60 * (1 + upgrade.rangeLevel * 0.1))
        : 0;

    return {
      damage: Number((base.damage * (1 + upgrade.damageLevel * 0.1)).toFixed(1)),
      range: Number((base.range * (1 + upgrade.rangeLevel * 0.05)).toFixed(2)),
      fireRate: Number(
        (base.fireRate * (1 + upgrade.fireRateLevel * 0.08)).toFixed(2),
      ),
      maxInGameLevel: Math.min(
        MAX_IN_GAME_LEVEL,
        Math.max(MIN_IN_GAME_LEVEL, upgrade.maxInGameLevel),
      ),
      buffDamagePct,
      buffFireRatePct,
      goldPerWave,
      minerWaveXp,
    };
  }

  public resetProfile(): void {
    this.profile = createDefaultProfile();
    this.saveAndNotify();
  }

  private load(): PlayerProfile {
    try {
      const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
      if (!raw) {
        return createDefaultProfile();
      }
      return sanitizeProfile(JSON.parse(raw) as unknown);
    } catch {
      return createDefaultProfile();
    }
  }

  private saveAndNotify(): void {
    try {
      window.localStorage.setItem(
        PROFILE_STORAGE_KEY,
        JSON.stringify(this.profile),
      );
    } catch {
      // Ignore storage quota or private browsing write errors
    }
    this.eventBus.emit('profileChanged', this.profile);
  }
}
