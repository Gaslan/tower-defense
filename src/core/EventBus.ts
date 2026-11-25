import type { PerkConfig } from '../config/perks';
import type { SkillId } from '../config/skills';
import type { UnitId } from '../config/units';
import type { HumanUnit } from '../entities/HumanUnit';
import type { ScreenId } from '../ui/ScreenManager';
import type { PlayerProfile } from './PlayerProfile';

export type GameSpeed = 1 | 2 | 3;

export interface WaveProgressPayload {
  readonly wave: number;
  readonly remaining: number;
  readonly total: number;
  readonly active: boolean;
}

export interface EnemyKilledPayload {
  readonly worldX: number;
  readonly worldY: number;
  readonly rewardGold: number;
}

export interface SkillStatePayload {
  readonly cooldowns: Readonly<Record<SkillId, number>>;
  readonly maxCooldowns: Readonly<Record<SkillId, number>>;
  readonly targetingSkill: SkillId | null;
}

export interface ActivePerkEntry {
  readonly config: PerkConfig;
  readonly stacks: number;
}

export interface PerkSelectionPayload {
  readonly choices: readonly PerkConfig[];
  readonly stacks: Readonly<Record<string, number>>;
}

export interface DefeatRewardPayload {
  readonly crystalsEarned: number;
  readonly xpEarned: number;
}

export interface PathVictoryPayload {
  readonly pathId: number;
  readonly pathName: string;
  readonly totalWaves: number;
  readonly stars: number;
  readonly crystalsEarned: number;
  readonly xpEarned: number;
  readonly nextPathId: number;
}

export interface GameEvents {
  goldChanged: number;
  livesChanged: number;
  waveChanged: number;
  enemyKilled: EnemyKilledPayload;
  skillStateChanged: SkillStatePayload;
  perkSelectionOpen: PerkSelectionPayload;
  perksChanged: readonly ActivePerkEntry[];
  profileChanged: Readonly<PlayerProfile>;
  screenChanged: ScreenId;
  activePathChanged: number;
  pathCompleted: number;
  defeatRewardEarned: DefeatRewardPayload;
  pathVictory: PathVictoryPayload;
  unitSelected: UnitId | null;
  unitInspected: HumanUnit | null;
  unitUpdated: HumanUnit;
  waveStateChanged: boolean;
  waveProgressChanged: WaveProgressPayload;
  gameOverChanged: boolean;
  gameSpeedChanged: GameSpeed;
  pauseChanged: boolean;
  autoWaveChanged: boolean;
  sfxVolumeChanged: number;
  particlesEnabledChanged: boolean;
}

export type EventCallback<T> = (payload: T) => void;
type ListenerFn = (payload: unknown) => void;

export class EventBus {
  private readonly listeners = new Map<keyof GameEvents, Set<ListenerFn>>();

  public on<K extends keyof GameEvents>(
    event: K,
    callback: EventCallback<GameEvents[K]>,
  ): void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set<ListenerFn>();
      this.listeners.set(event, set);
    }
    set.add(callback as unknown as ListenerFn);
  }

  public off<K extends keyof GameEvents>(
    event: K,
    callback: EventCallback<GameEvents[K]>,
  ): void {
    this.listeners.get(event)?.delete(callback as unknown as ListenerFn);
  }

  public emit<K extends keyof GameEvents>(
    event: K,
    payload: GameEvents[K],
  ): void {
    const set = this.listeners.get(event);
    if (!set) {
      return;
    }
    for (const listener of set) {
      listener(payload);
    }
  }
}
