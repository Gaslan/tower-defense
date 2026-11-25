import {
  PERK_CONFIGS,
  PERK_LIST,
  type PerkConfig,
  type PerkId,
} from '../config/perks';
import type { ActivePerkEntry, EventBus } from '../core/EventBus';
import type { GameState } from '../core/GameState';

export class PerkSystem {
  private readonly gameState: GameState;
  private readonly eventBus: EventBus;
  private readonly stacks = new Map<string, number>();

  constructor(gameState: GameState, eventBus: EventBus) {
    this.gameState = gameState;
    this.eventBus = eventBus;
  }

  public getStacks(perkId: string): number {
    return this.stacks.get(perkId) ?? 0;
  }

  public getStacksSnapshot(): Readonly<Record<string, number>> {
    const snapshot: Record<string, number> = {};
    this.stacks.forEach((count, id) => {
      snapshot[id] = count;
    });
    return snapshot;
  }

  public getActivePerks(): ActivePerkEntry[] {
    const active: ActivePerkEntry[] = [];
    for (const config of PERK_LIST) {
      const count = this.getStacks(config.id);
      if (count > 0) {
        active.push({ config, stacks: count });
      }
    }
    return active;
  }

  public rollChoices(count = 3): PerkConfig[] {
    const pool = PERK_LIST.filter(
      (perk) => this.getStacks(perk.id) < perk.maxStacks,
    );

    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }

    return pool.slice(0, count);
  }

  public applyPerk(perkId: string): boolean {
    if (!(perkId in PERK_CONFIGS)) {
      return false;
    }

    const id = perkId as PerkId;
    const config = PERK_CONFIGS[id];
    const current = this.getStacks(id);
    if (current >= config.maxStacks) {
      return false;
    }

    this.stacks.set(id, current + 1);

    if (id === 'fortify_base') {
      this.gameState.addLives(3);
      this.gameState.addGold(75);
    }

    this.eventBus.emit('perksChanged', this.getActivePerks());
    return true;
  }

  public reset(): void {
    this.stacks.clear();
    this.eventBus.emit('perksChanged', []);
  }

  public getArcherCritChance(): number {
    return this.getStacks('archer_crit') * 0.2;
  }

  public getKnightStunDuration(): number {
    return this.getStacks('knight_stun') * 0.35;
  }

  public getMageBurnDps(): number {
    return this.getStacks('mage_burn') * 18;
  }

  public getGoldMultiplier(): number {
    return 1 + this.getStacks('gold_rush') * 0.2;
  }

  public getFireRateMultiplier(): number {
    return 1 + this.getStacks('global_haste') * 0.12;
  }

  public getXpMultiplier(): number {
    return 1 + this.getStacks('xp_boost') * 0.3;
  }

  public getCooldownMultiplier(): number {
    return Math.max(0.4, 1 - this.getStacks('skill_cdr') * 0.15);
  }
}
