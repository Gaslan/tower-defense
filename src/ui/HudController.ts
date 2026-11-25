import { ENEMY_CONFIGS } from '../config/enemies';
import type { PerkConfig } from '../config/perks';
import { SKILL_CONFIGS, type SkillId } from '../config/skills';
import {
  UNIT_CONFIGS,
  UNIT_LIST,
  type UnitConfig,
  type UnitId,
} from '../config/units';
import {
  type ActivePerkEntry,
  EventBus,
  type GameSpeed,
  type PathVictoryPayload,
  type PerkSelectionPayload,
  type SkillStatePayload,
  type WaveProgressPayload,
} from '../core/EventBus';
import { GameState } from '../core/GameState';
import {
  MIN_IN_GAME_LEVEL,
  type ProfileManager,
  type StatUpgradePreview,
  type UnitUpgradeStat,
} from '../core/PlayerProfile';
import type { Enemy } from '../entities/Enemy';
import type { HumanUnit, TargetingStrategy } from '../entities/HumanUnit';

export interface HudCallbacks {
  onStartWave: () => void;
  onRestart: () => void;
  onNextPath: () => void;
  onOpenBarracks: () => void;
  onReturnToMap: () => void;
  onResetProfile: () => void;
  isBattleScreenActive: () => boolean;
  onToggleMute: () => boolean;
  onSetVolume: (volume: number) => void;
  onUpgradeUnit: () => void;
  onSellUnit: () => void;
  onSelectTargeting: (strategy: TargetingStrategy) => void;
  onCloseInspector: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onUseSkill: (skillId: SkillId) => void;
  onCancelSkillTargeting: () => void;
  onSelectPerk: (perkId: string) => void;
  onUpgradeUnitMeta: (unitId: UnitId, stat: UnitUpgradeStat) => boolean;
}

interface BarracksStatMeta {
  readonly stat: UnitUpgradeStat;
  readonly label: string;
  readonly subLabel: string;
  readonly iconSvg: string;
}

const BARRACKS_STAT_META: readonly BarracksStatMeta[] = [
  {
    stat: 'damage',
    label: 'Attack Damage',
    subLabel: '+10% base damage per rank',
    iconSvg:
      '<svg viewBox="0 0 24 24"><path d="M18.5 4.5l1 1-7.8 7.8 2.1 2.1-1.4 1.4-2.1-2.1-4.6 4.6-1.6-1.6 4.6-4.6-2.1-2.1 1.4-1.4 2.1 2.1L18.5 4.5z" fill="#ff7675" stroke="#fff" stroke-width="1.2"/></svg>',
  },
  {
    stat: 'range',
    label: 'Attack Range',
    subLabel: '+5% targeting radius per rank',
    iconSvg:
      '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7.5" fill="none" stroke="#7df9ff" stroke-width="2"/><circle cx="12" cy="12" r="2.5" fill="#7df9ff"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="#7df9ff" stroke-width="2" stroke-linecap="round"/></svg>',
  },
  {
    stat: 'fireRate',
    label: 'Attack Speed',
    subLabel: '+8% fire rate per rank',
    iconSvg:
      '<svg viewBox="0 0 24 24"><polygon points="13.5,2.5 5.5,13 11,13 9.5,21.5 18.5,11 13,11" fill="#ffd166" stroke="#7d4a02" stroke-width="1.2" stroke-linejoin="round"/></svg>',
  },
  {
    stat: 'maxLevel',
    label: 'Max Battle Level',
    subLabel: 'Unlock mythic battle tiers (up to Lv.6)',
    iconSvg:
      '<svg viewBox="0 0 24 24"><path d="M12 3l2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8-5.4 2.8 1-6L3.3 9.4l6-.9L12 3z" fill="#d980fa" stroke="#ffffff" stroke-width="1.3" stroke-linejoin="round"/></svg>',
  },
];

const CRYSTAL_BTN_SVG =
  '<svg viewBox="0 0 28 28"><polygon points="14,2 23,10 19,25 9,25 5,10" fill="#38bdf8" stroke="#e0f7ff" stroke-width="1.8" stroke-linejoin="round"/></svg>';

const HOTKEY_TO_UNIT: Readonly<Record<string, UnitId>> = {
  '1': 'archer',
  '2': 'knight',
  '3': 'mage',
  '4': 'bannerman',
  '5': 'miner',
  '6': 'frost_mage',
};

interface FlyingCoin {
  readonly el: HTMLElement;
  readonly innerEl: HTMLElement;
  readonly startX: number;
  readonly startY: number;
  readonly rewardGold: number;
  elapsed: number;
  readonly riseDuration: number;
  readonly flyDuration: number;
}

interface SkillButtonRefs {
  readonly button: HTMLButtonElement;
  readonly overlay: HTMLElement;
  readonly fill: HTMLElement;
  readonly text: HTMLElement;
}

export class HudController {
  private readonly goldEl: HTMLElement;
  private readonly goldPillEl: HTMLElement;
  private readonly livesEl: HTMLElement;
  private readonly livesPillEl: HTMLElement;
  private readonly waveEl: HTMLElement;
  private readonly waveFillEl: HTMLElement;
  private readonly waveBannerEl: HTMLElement;
  private readonly waveBannerEyebrowEl: HTMLElement;
  private readonly waveBannerTextEl: HTMLElement;
  private readonly deployHintEl: HTMLElement;
  private readonly startWaveBtn: HTMLButtonElement;
  private readonly autoWaveBtn: HTMLButtonElement;
  private readonly speedBtn: HTMLButtonElement;
  private readonly speedBtnLabelEl: HTMLElement;
  private readonly muteBtn: HTMLButtonElement;
  private readonly settingsBtn: HTMLButtonElement;
  private readonly settingsModal: HTMLElement;
  private readonly settingsVolumeSlider: HTMLInputElement;
  private readonly settingsVolumeValEl: HTMLElement;
  private readonly settingsParticlesBtn: HTMLButtonElement;
  private readonly gameOverModal: HTMLElement;
  private readonly gameOverWaveEl: HTMLElement;
  private readonly gameOverCrystalsEl: HTMLElement;
  private readonly gameOverXpEl: HTMLElement;
  private readonly victoryModal: HTMLElement;
  private readonly victoryEyebrowEl: HTMLElement;
  private readonly victoryPathNameEl: HTMLElement;
  private readonly victoryStarsEl: HTMLElement;
  private readonly victoryCrystalsEl: HTMLElement;
  private readonly victoryXpEl: HTMLElement;
  private readonly victoryNextLabelEl: HTMLElement;
  private readonly inspectorEl: HTMLElement;
  private readonly inspectorIconEl: HTMLElement;
  private readonly inspectorNameEl: HTMLElement;
  private readonly inspectorRoleEl: HTMLElement;
  private readonly inspectorLevelEl: HTMLElement;
  private readonly inspectorLabelDmgEl: HTMLElement;
  private readonly inspectorDamageEl: HTMLElement;
  private readonly inspectorDamageNextEl: HTMLElement;
  private readonly inspectorLabelRngEl: HTMLElement;
  private readonly inspectorRangeEl: HTMLElement;
  private readonly inspectorRangeNextEl: HTMLElement;
  private readonly inspectorLabelRateEl: HTMLElement;
  private readonly inspectorFireRateEl: HTMLElement;
  private readonly inspectorFireRateNextEl: HTMLElement;
  private readonly inspectorLabelKillsEl: HTMLElement;
  private readonly inspectorKillsEl: HTMLElement;
  private readonly inspectorTierBadgeEl: HTMLElement;
  private readonly inspectorTargetingEl: HTMLElement;
  private readonly inspectorXpStatusEl: HTMLElement;
  private readonly inspectorXpTextEl: HTMLElement;
  private readonly inspectorXpFillEl: HTMLElement;
  private readonly inspectorUpgradeBtn: HTMLButtonElement;
  private readonly inspectorUpgradeMainEl: HTMLElement;
  private readonly inspectorUpgradeSubEl: HTMLElement;
  private readonly inspectorUpgradeCostBadgeEl: HTMLElement;
  private readonly inspectorSellBtn: HTMLButtonElement;
  private readonly inspectorSellLabelEl: HTMLElement;
  private readonly targetingButtons = new Map<TargetingStrategy, HTMLButtonElement>();
  private readonly enemyTooltipEl: HTMLElement;
  private readonly enemyTooltipNameEl: HTMLElement;
  private readonly enemyTooltipBadgeEl: HTMLElement;
  private readonly enemyTooltipHpFillEl: HTMLElement;
  private readonly enemyTooltipHpTextEl: HTMLElement;
  private readonly enemyTooltipSpeedEl: HTMLElement;
  private readonly enemyTooltipRewardEl: HTMLElement;
  private readonly coinFxLayer: HTMLElement;
  private readonly perkModal: HTMLElement;
  private readonly perkCardsGrid: HTMLElement;
  private readonly activePerksBar: HTMLElement;
  private readonly barracksCrystalsValEl: HTMLElement;
  private readonly barracksUnitStripEl: HTMLElement;
  private readonly barracksUnitEmblemEl: HTMLElement;
  private readonly barracksUnitNameEl: HTMLElement;
  private readonly barracksUnitRoleEl: HTMLElement;
  private readonly barracksUnitDescEl: HTMLElement;
  private readonly barracksEffDamageEl: HTMLElement;
  private readonly barracksEffRangeEl: HTMLElement;
  private readonly barracksEffFireRateEl: HTMLElement;
  private readonly barracksEffMaxLevelEl: HTMLElement;
  private readonly barracksUpgradesListEl: HTMLElement;
  private readonly flyingCoins: FlyingCoin[] = [];
  private readonly unitButtons = new Map<UnitId, HTMLButtonElement>();
  private readonly skillButtons = new Map<SkillId, SkillButtonRefs>();
  private readonly gameState: GameState;
  private readonly profileManager: ProfileManager;
  private readonly onSelectPerkCallback: (perkId: string) => void;
  private readonly onUpgradeUnitMetaCallback: (
    unitId: UnitId,
    stat: UnitUpgradeStat,
  ) => boolean;
  private inspectedUnit: HumanUnit | null = null;
  private selectedBarracksUnitId: UnitId = UNIT_LIST[0].id;
  private lastUpgradedStat: UnitUpgradeStat | null = null;
  private perkModalOpen = false;
  private waveActive = false;
  private waveProgress: WaveProgressPayload;
  private skillState: SkillStatePayload = {
    cooldowns: { meteor: 0, frost: 0 },
    maxCooldowns: {
      meteor: SKILL_CONFIGS.meteor.cooldown,
      frost: SKILL_CONFIGS.frost.cooldown,
    },
    targetingSkill: null,
  };
  private pendingFlyingGold = 0;
  private lastGold: number;
  private lastLives: number;
  private waveBannerTimer: number | null = null;

  constructor(
    gameState: GameState,
    eventBus: EventBus,
    profileManager: ProfileManager,
    callbacks: HudCallbacks,
  ) {
    this.gameState = gameState;
    this.profileManager = profileManager;
    this.lastGold = this.gameState.getGold();
    this.lastLives = this.gameState.getLives();
    const initialWave = this.gameState.getWave();
    this.waveProgress = {
      wave: initialWave,
      remaining: 0,
      total: 4 + initialWave * 3,
      active: false,
    };

    const goldEl = document.getElementById('hud-gold');
    const goldPillEl = document.getElementById('hud-gold-pill');
    const livesEl = document.getElementById('hud-lives');
    const livesPillEl = document.getElementById('hud-lives-pill');
    const waveEl = document.getElementById('hud-wave');
    const waveFillEl = document.getElementById('hud-wave-fill');
    const waveBannerEl = document.getElementById('wave-banner');
    const waveBannerEyebrowEl = document.getElementById('wave-banner-eyebrow');
    const waveBannerTextEl = document.getElementById('wave-banner-text');
    const deployHintEl = document.getElementById('deploy-hint');
    const startWaveBtn = document.getElementById('start-wave-btn');
    const autoWaveBtn = document.getElementById('auto-wave-btn');
    const speedBtn = document.getElementById('speed-btn');
    const speedBtnLabelEl = document.getElementById('speed-btn-label');
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const muteBtn = document.getElementById('mute-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const settingsCloseBtn = document.getElementById('settings-close-btn');
    const settingsVolumeSlider = document.getElementById(
      'settings-volume-slider',
    );
    const settingsVolumeValEl = document.getElementById('settings-volume-val');
    const settingsParticlesBtn = document.getElementById(
      'settings-particles-btn',
    );
    const settingsResumeBtn = document.getElementById('settings-resume-btn');
    const settingsRestartBtn = document.getElementById('settings-restart-btn');
    const settingsMapBtn = document.getElementById('settings-map-btn');
    const settingsResetProfileBtn = document.getElementById(
      'settings-reset-profile-btn',
    );
    const gameOverModal = document.getElementById('game-over-modal');
    const gameOverWaveEl = document.getElementById('game-over-wave');
    const gameOverCrystalsEl = document.getElementById('game-over-crystals');
    const gameOverXpEl = document.getElementById('game-over-xp');
    const restartBtn = document.getElementById('restart-btn');
    const gameOverMapBtn = document.getElementById('game-over-map-btn');
    const victoryModal = document.getElementById('modal-victory');
    const victoryEyebrowEl = document.getElementById('victory-eyebrow');
    const victoryPathNameEl = document.getElementById('victory-path-name');
    const victoryStarsEl = document.getElementById('victory-stars');
    const victoryCrystalsEl = document.getElementById('victory-crystals');
    const victoryXpEl = document.getElementById('victory-xp');
    const victoryNextBtn = document.getElementById('victory-next-btn');
    const victoryNextLabelEl = document.getElementById('victory-next-label');
    const victoryBarracksBtn = document.getElementById('victory-barracks-btn');
    const victoryMapBtn = document.getElementById('victory-map-btn');
    const inspectorEl = document.getElementById('unit-inspector');
    const inspectorIconEl = document.getElementById('inspector-icon');
    const inspectorNameEl = document.getElementById('inspector-name');
    const inspectorRoleEl = document.getElementById('inspector-role');
    const inspectorLevelEl = document.getElementById('inspector-level');
    const inspectorCloseBtn = document.getElementById('inspector-close-btn');
    const inspectorLabelDmgEl = document.getElementById('inspector-label-dmg');
    const inspectorDamageEl = document.getElementById('inspector-damage');
    const inspectorDamageNextEl = document.getElementById(
      'inspector-damage-next',
    );
    const inspectorLabelRngEl = document.getElementById('inspector-label-rng');
    const inspectorRangeEl = document.getElementById('inspector-range');
    const inspectorRangeNextEl = document.getElementById(
      'inspector-range-next',
    );
    const inspectorLabelRateEl = document.getElementById(
      'inspector-label-rate',
    );
    const inspectorFireRateEl = document.getElementById('inspector-firerate');
    const inspectorFireRateNextEl = document.getElementById(
      'inspector-firerate-next',
    );
    const inspectorLabelKillsEl = document.getElementById(
      'inspector-label-kills',
    );
    const inspectorKillsEl = document.getElementById('inspector-kills');
    const inspectorTierBadgeEl = document.getElementById(
      'inspector-tier-badge',
    );
    const inspectorTargetingEl = document.getElementById('inspector-targeting');
    const inspectorXpStatusEl = document.getElementById('inspector-xp-status');
    const inspectorXpTextEl = document.getElementById('inspector-xp-text');
    const inspectorXpFillEl = document.getElementById('inspector-xp-fill');
    const inspectorUpgradeBtn = document.getElementById(
      'inspector-upgrade-btn',
    );
    const inspectorUpgradeMainEl = inspectorUpgradeBtn?.querySelector(
      '.upgrade-btn-main',
    );
    const inspectorUpgradeSubEl = inspectorUpgradeBtn?.querySelector(
      '.upgrade-btn-sub',
    );
    const inspectorUpgradeCostBadgeEl = document.getElementById(
      'inspector-upgrade-cost-badge',
    );
    const inspectorSellBtn = document.getElementById('inspector-sell-btn');
    const inspectorSellLabelEl = document.getElementById(
      'inspector-sell-label',
    );
    const enemyTooltipEl = document.getElementById('enemy-tooltip');
    const enemyTooltipNameEl = document.getElementById('enemy-tooltip-name');
    const enemyTooltipBadgeEl = document.getElementById('enemy-tooltip-badge');
    const enemyTooltipHpFillEl = document.getElementById(
      'enemy-tooltip-hp-fill',
    );
    const enemyTooltipHpTextEl = document.getElementById(
      'enemy-tooltip-hp-text',
    );
    const enemyTooltipSpeedEl = document.getElementById('enemy-tooltip-speed');
    const enemyTooltipRewardEl = document.getElementById(
      'enemy-tooltip-reward',
    );
    const coinFxLayer = document.getElementById('coin-fx-layer');
    const perkModal = document.getElementById('perk-modal');
    const perkCardsGrid = document.getElementById('perk-cards-grid');
    const activePerksBar = document.getElementById('active-perks-bar');
    const barracksCrystalsValEl = document.getElementById(
      'barracks-crystals-val',
    );
    const barracksUnitStripEl = document.getElementById('barracks-unit-strip');
    const barracksUnitEmblemEl = document.getElementById(
      'barracks-unit-emblem',
    );
    const barracksUnitNameEl = document.getElementById('barracks-unit-name');
    const barracksUnitRoleEl = document.getElementById('barracks-unit-role');
    const barracksUnitDescEl = document.getElementById('barracks-unit-desc');
    const barracksEffDamageEl = document.getElementById('barracks-eff-damage');
    const barracksEffRangeEl = document.getElementById('barracks-eff-range');
    const barracksEffFireRateEl = document.getElementById(
      'barracks-eff-firerate',
    );
    const barracksEffMaxLevelEl = document.getElementById(
      'barracks-eff-maxlevel',
    );
    const barracksUpgradesListEl = document.getElementById(
      'barracks-upgrades-list',
    );

    if (
      !goldEl ||
      !goldPillEl ||
      !livesEl ||
      !livesPillEl ||
      !waveEl ||
      !waveFillEl ||
      !waveBannerEl ||
      !waveBannerEyebrowEl ||
      !waveBannerTextEl ||
      !deployHintEl ||
      !(startWaveBtn instanceof HTMLButtonElement) ||
      !(autoWaveBtn instanceof HTMLButtonElement) ||
      !(speedBtn instanceof HTMLButtonElement) ||
      !speedBtnLabelEl ||
      !(zoomInBtn instanceof HTMLButtonElement) ||
      !(zoomOutBtn instanceof HTMLButtonElement) ||
      !(muteBtn instanceof HTMLButtonElement) ||
      !(settingsBtn instanceof HTMLButtonElement) ||
      !settingsModal ||
      !(settingsCloseBtn instanceof HTMLButtonElement) ||
      !(settingsVolumeSlider instanceof HTMLInputElement) ||
      !settingsVolumeValEl ||
      !(settingsParticlesBtn instanceof HTMLButtonElement) ||
      !(settingsResumeBtn instanceof HTMLButtonElement) ||
      !(settingsRestartBtn instanceof HTMLButtonElement) ||
      !(settingsMapBtn instanceof HTMLButtonElement) ||
      !(settingsResetProfileBtn instanceof HTMLButtonElement) ||
      !gameOverModal ||
      !gameOverWaveEl ||
      !gameOverCrystalsEl ||
      !gameOverXpEl ||
      !(restartBtn instanceof HTMLButtonElement) ||
      !(gameOverMapBtn instanceof HTMLButtonElement) ||
      !victoryModal ||
      !victoryEyebrowEl ||
      !victoryPathNameEl ||
      !victoryStarsEl ||
      !victoryCrystalsEl ||
      !victoryXpEl ||
      !(victoryNextBtn instanceof HTMLButtonElement) ||
      !victoryNextLabelEl ||
      !(victoryBarracksBtn instanceof HTMLButtonElement) ||
      !(victoryMapBtn instanceof HTMLButtonElement) ||
      !inspectorEl ||
      !inspectorIconEl ||
      !inspectorNameEl ||
      !inspectorRoleEl ||
      !inspectorLevelEl ||
      !(inspectorCloseBtn instanceof HTMLButtonElement) ||
      !inspectorLabelDmgEl ||
      !inspectorDamageEl ||
      !inspectorDamageNextEl ||
      !inspectorLabelRngEl ||
      !inspectorRangeEl ||
      !inspectorRangeNextEl ||
      !inspectorLabelRateEl ||
      !inspectorFireRateEl ||
      !inspectorFireRateNextEl ||
      !inspectorLabelKillsEl ||
      !inspectorKillsEl ||
      !inspectorTierBadgeEl ||
      !inspectorTargetingEl ||
      !inspectorXpStatusEl ||
      !inspectorXpTextEl ||
      !inspectorXpFillEl ||
      !(inspectorUpgradeBtn instanceof HTMLButtonElement) ||
      !(inspectorUpgradeMainEl instanceof HTMLElement) ||
      !(inspectorUpgradeSubEl instanceof HTMLElement) ||
      !inspectorUpgradeCostBadgeEl ||
      !(inspectorSellBtn instanceof HTMLButtonElement) ||
      !inspectorSellLabelEl ||
      !enemyTooltipEl ||
      !enemyTooltipNameEl ||
      !enemyTooltipBadgeEl ||
      !enemyTooltipHpFillEl ||
      !enemyTooltipHpTextEl ||
      !enemyTooltipSpeedEl ||
      !enemyTooltipRewardEl ||
      !coinFxLayer ||
      !perkModal ||
      !perkCardsGrid ||
      !activePerksBar ||
      !barracksCrystalsValEl ||
      !barracksUnitStripEl ||
      !barracksUnitEmblemEl ||
      !barracksUnitNameEl ||
      !barracksUnitRoleEl ||
      !barracksUnitDescEl ||
      !barracksEffDamageEl ||
      !barracksEffRangeEl ||
      !barracksEffFireRateEl ||
      !barracksEffMaxLevelEl ||
      !barracksUpgradesListEl
    ) {
      throw new Error('Missing HUD elements in #ui-overlay');
    }

    this.goldEl = goldEl;
    this.goldPillEl = goldPillEl;
    this.livesEl = livesEl;
    this.livesPillEl = livesPillEl;
    this.waveEl = waveEl;
    this.waveFillEl = waveFillEl;
    this.waveBannerEl = waveBannerEl;
    this.waveBannerEyebrowEl = waveBannerEyebrowEl;
    this.waveBannerTextEl = waveBannerTextEl;
    this.deployHintEl = deployHintEl;
    this.startWaveBtn = startWaveBtn;
    this.autoWaveBtn = autoWaveBtn;
    this.speedBtn = speedBtn;
    this.speedBtnLabelEl = speedBtnLabelEl;
    this.muteBtn = muteBtn;
    this.settingsBtn = settingsBtn;
    this.settingsModal = settingsModal;
    this.settingsVolumeSlider = settingsVolumeSlider;
    this.settingsVolumeValEl = settingsVolumeValEl;
    this.settingsParticlesBtn = settingsParticlesBtn;
    this.gameOverModal = gameOverModal;
    this.gameOverWaveEl = gameOverWaveEl;
    this.gameOverCrystalsEl = gameOverCrystalsEl;
    this.gameOverXpEl = gameOverXpEl;
    this.victoryModal = victoryModal;
    this.victoryEyebrowEl = victoryEyebrowEl;
    this.victoryPathNameEl = victoryPathNameEl;
    this.victoryStarsEl = victoryStarsEl;
    this.victoryCrystalsEl = victoryCrystalsEl;
    this.victoryXpEl = victoryXpEl;
    this.victoryNextLabelEl = victoryNextLabelEl;
    this.inspectorEl = inspectorEl;
    this.inspectorIconEl = inspectorIconEl;
    this.inspectorNameEl = inspectorNameEl;
    this.inspectorRoleEl = inspectorRoleEl;
    this.inspectorLevelEl = inspectorLevelEl;
    this.inspectorLabelDmgEl = inspectorLabelDmgEl;
    this.inspectorDamageEl = inspectorDamageEl;
    this.inspectorDamageNextEl = inspectorDamageNextEl;
    this.inspectorLabelRngEl = inspectorLabelRngEl;
    this.inspectorRangeEl = inspectorRangeEl;
    this.inspectorRangeNextEl = inspectorRangeNextEl;
    this.inspectorLabelRateEl = inspectorLabelRateEl;
    this.inspectorFireRateEl = inspectorFireRateEl;
    this.inspectorFireRateNextEl = inspectorFireRateNextEl;
    this.inspectorLabelKillsEl = inspectorLabelKillsEl;
    this.inspectorKillsEl = inspectorKillsEl;
    this.inspectorTierBadgeEl = inspectorTierBadgeEl;
    this.inspectorTargetingEl = inspectorTargetingEl;
    this.inspectorXpStatusEl = inspectorXpStatusEl;
    this.inspectorXpTextEl = inspectorXpTextEl;
    this.inspectorXpFillEl = inspectorXpFillEl;
    this.inspectorUpgradeBtn = inspectorUpgradeBtn;
    this.inspectorUpgradeMainEl = inspectorUpgradeMainEl;
    this.inspectorUpgradeSubEl = inspectorUpgradeSubEl;
    this.inspectorUpgradeCostBadgeEl = inspectorUpgradeCostBadgeEl;
    this.inspectorSellBtn = inspectorSellBtn;
    this.inspectorSellLabelEl = inspectorSellLabelEl;
    this.enemyTooltipEl = enemyTooltipEl;
    this.enemyTooltipNameEl = enemyTooltipNameEl;
    this.enemyTooltipBadgeEl = enemyTooltipBadgeEl;
    this.enemyTooltipHpFillEl = enemyTooltipHpFillEl;
    this.enemyTooltipHpTextEl = enemyTooltipHpTextEl;
    this.enemyTooltipSpeedEl = enemyTooltipSpeedEl;
    this.enemyTooltipRewardEl = enemyTooltipRewardEl;
    this.coinFxLayer = coinFxLayer;
    this.perkModal = perkModal;
    this.perkCardsGrid = perkCardsGrid;
    this.activePerksBar = activePerksBar;
    this.barracksCrystalsValEl = barracksCrystalsValEl;
    this.barracksUnitStripEl = barracksUnitStripEl;
    this.barracksUnitEmblemEl = barracksUnitEmblemEl;
    this.barracksUnitNameEl = barracksUnitNameEl;
    this.barracksUnitRoleEl = barracksUnitRoleEl;
    this.barracksUnitDescEl = barracksUnitDescEl;
    this.barracksEffDamageEl = barracksEffDamageEl;
    this.barracksEffRangeEl = barracksEffRangeEl;
    this.barracksEffFireRateEl = barracksEffFireRateEl;
    this.barracksEffMaxLevelEl = barracksEffMaxLevelEl;
    this.barracksUpgradesListEl = barracksUpgradesListEl;
    this.onSelectPerkCallback = callbacks.onSelectPerk;
    this.onUpgradeUnitMetaCallback = callbacks.onUpgradeUnitMeta;

    this.goldPillEl.addEventListener(
      'animationend',
      (event: AnimationEvent) => {
        if (event.target === this.goldPillEl) {
          this.goldPillEl.classList.remove('is-popping', 'is-collecting');
        }
      },
    );
    this.livesPillEl.addEventListener('animationend', () => {
      this.livesPillEl.classList.remove('is-damaged');
    });

    this.startWaveBtn.addEventListener('click', () => {
      callbacks.onStartWave();
    });

    this.autoWaveBtn.addEventListener('click', () => {
      this.gameState.toggleAutoWave();
    });

    this.speedBtn.addEventListener('click', () => {
      this.gameState.cycleGameSpeed();
    });

    zoomInBtn.addEventListener('click', () => {
      callbacks.onZoomIn();
    });

    zoomOutBtn.addEventListener('click', () => {
      callbacks.onZoomOut();
    });

    this.muteBtn.addEventListener('click', () => {
      const muted = callbacks.onToggleMute();
      this.renderMuteButton(muted);
    });

    this.settingsBtn.addEventListener('click', () => {
      this.gameState.togglePaused();
    });

    settingsCloseBtn.addEventListener('click', () => {
      this.gameState.setPaused(false);
    });

    settingsResumeBtn.addEventListener('click', () => {
      this.gameState.setPaused(false);
    });

    settingsRestartBtn.addEventListener('click', () => {
      this.gameState.setPaused(false);
      callbacks.onRestart();
    });

    settingsMapBtn.addEventListener('click', () => {
      this.gameState.setPaused(false);
      callbacks.onReturnToMap();
    });

    settingsResetProfileBtn.addEventListener('click', () => {
      callbacks.onResetProfile();
    });

    this.settingsModal.addEventListener('click', (event: MouseEvent) => {
      if (event.target === this.settingsModal) {
        this.gameState.setPaused(false);
      }
    });

    this.settingsVolumeSlider.addEventListener('input', () => {
      const volume = Number(this.settingsVolumeSlider.value) / 100;
      this.gameState.setSfxVolume(volume);
      callbacks.onSetVolume(volume);
    });

    this.settingsParticlesBtn.addEventListener('click', () => {
      this.gameState.toggleParticlesEnabled();
    });

    restartBtn.addEventListener('click', () => {
      callbacks.onRestart();
    });

    gameOverMapBtn.addEventListener('click', () => {
      callbacks.onReturnToMap();
    });

    victoryNextBtn.addEventListener('click', () => {
      callbacks.onNextPath();
    });

    victoryBarracksBtn.addEventListener('click', () => {
      callbacks.onOpenBarracks();
    });

    victoryMapBtn.addEventListener('click', () => {
      callbacks.onReturnToMap();
    });

    inspectorCloseBtn.addEventListener('click', () => {
      callbacks.onCloseInspector();
    });

    this.inspectorUpgradeBtn.addEventListener('click', () => {
      callbacks.onUpgradeUnit();
    });

    this.inspectorSellBtn.addEventListener('click', () => {
      callbacks.onSellUnit();
    });

    const targetingBtns = document.querySelectorAll<HTMLButtonElement>(
      '#unit-inspector .targeting-seg-btn[data-strategy]',
    );
    targetingBtns.forEach((button) => {
      const strategy = button.dataset.strategy as
        | TargetingStrategy
        | undefined;
      if (
        strategy !== 'first' &&
        strategy !== 'strongest' &&
        strategy !== 'lowest'
      ) {
        return;
      }
      this.targetingButtons.set(strategy, button);
      button.addEventListener('click', () => {
        callbacks.onSelectTargeting(strategy);
      });
    });

    const buttons = document.querySelectorAll<HTMLButtonElement>(
      '#unit-bar .unit-btn[data-unit-id]',
    );
    buttons.forEach((button) => {
      const unitId = button.dataset.unitId as UnitId | undefined;
      if (!unitId || !(unitId in UNIT_CONFIGS)) {
        return;
      }

      this.unitButtons.set(unitId, button);
      button.addEventListener('click', () => {
        const current = this.gameState.getSelectedUnitId();
        this.gameState.selectUnit(current === unitId ? null : unitId);
      });
    });

    const skillBtns = document.querySelectorAll<HTMLButtonElement>(
      '#skill-bar .skill-btn[data-skill-id]',
    );
    skillBtns.forEach((button) => {
      const skillId = button.dataset.skillId as SkillId | undefined;
      if (!skillId || !(skillId in SKILL_CONFIGS)) {
        return;
      }
      const overlay = button.querySelector('.skill-cd-overlay');
      const fill = button.querySelector('.skill-cd-fill');
      const text = button.querySelector('.skill-cd-text');
      if (
        !(overlay instanceof HTMLElement) ||
        !(fill instanceof HTMLElement) ||
        !(text instanceof HTMLElement)
      ) {
        return;
      }
      this.skillButtons.set(skillId, { button, overlay, fill, text });
      button.addEventListener('click', () => {
        callbacks.onUseSkill(skillId);
      });
    });

    window.addEventListener('keydown', (event: KeyboardEvent) => {
      if (
        !callbacks.isBattleScreenActive() ||
        (event.target instanceof HTMLInputElement &&
          event.target.type !== 'range') ||
        event.target instanceof HTMLTextAreaElement ||
        this.gameState.isGameOver() ||
        this.gameState.isPathVictory() ||
        this.perkModalOpen
      ) {
        return;
      }

      if (event.key === 'Escape') {
        if (this.gameState.isPaused()) {
          event.preventDefault();
          this.gameState.setPaused(false);
          return;
        }
        if (this.skillState.targetingSkill !== null) {
          callbacks.onCancelSkillTargeting();
          return;
        }
        if (this.gameState.getSelectedUnitId() !== null) {
          this.gameState.selectUnit(null);
          return;
        }
        if (this.inspectedUnit !== null) {
          callbacks.onCloseInspector();
        }
        return;
      }

      if (event.key === ' ' || event.code === 'Space') {
        event.preventDefault();
        if (event.repeat) {
          return;
        }
        if (this.waveActive || this.gameState.isPaused()) {
          this.gameState.togglePaused();
        } else {
          callbacks.onStartWave();
        }
        return;
      }

      if (this.gameState.isPaused()) {
        return;
      }

      if ((event.key === 'q' || event.key === 'Q') && !event.repeat) {
        callbacks.onUseSkill('meteor');
        return;
      }

      if ((event.key === 'w' || event.key === 'W') && !event.repeat) {
        callbacks.onUseSkill('frost');
        return;
      }

      if ((event.key === 'f' || event.key === 'F') && !event.repeat) {
        this.gameState.cycleGameSpeed();
        return;
      }

      const hotkeyUnit = HOTKEY_TO_UNIT[event.key];
      if (hotkeyUnit && !event.repeat) {
        const current = this.gameState.getSelectedUnitId();
        this.gameState.selectUnit(current === hotkeyUnit ? null : hotkeyUnit);
      }
    });

    eventBus.on('goldChanged', (gold) => {
      this.renderGold(gold);
      this.updateButtonStates();
      this.renderInspector();
    });
    eventBus.on('livesChanged', (lives) => {
      this.renderLives(lives);
    });
    eventBus.on('waveChanged', (wave) => {
      if (!this.waveActive) {
        this.waveProgress = {
          wave,
          remaining: 0,
          total: 4 + wave * 3,
          active: false,
        };
      }
      this.renderWave();
      this.updateWaveButton();
    });
    eventBus.on('waveStateChanged', (active) => {
      const wasActive = this.waveActive;
      this.waveActive = active;
      if (active && !wasActive) {
        this.showWaveBanner(this.gameState.getWave());
      }
      this.updateWaveButton();
    });
    eventBus.on('waveProgressChanged', (progress) => {
      this.waveProgress = progress;
      this.waveActive = progress.active;
      this.renderWave();
      this.updateWaveButton();
    });
    eventBus.on('gameOverChanged', (isGameOver) => {
      if (isGameOver) {
        this.clearFlyingGold();
        this.closePerkSelection();
      } else {
        this.hideVictoryModal();
      }
      if (isGameOver || !this.waveActive) {
        this.hideWaveBanner();
      }
      this.renderGameOver(isGameOver);
      this.updateWaveButton();
      this.updateButtonStates();
      this.renderSkills();
      this.renderInspector();
    });
    eventBus.on('activePathChanged', () => {
      this.hideVictoryModal();
      this.renderWave();
      this.updateWaveButton();
    });
    eventBus.on('pathVictory', (payload) => {
      this.clearFlyingGold();
      this.closePerkSelection();
      this.hideWaveBanner();
      this.showVictoryModal(payload);
      this.renderWave();
      this.updateWaveButton();
      this.updateButtonStates();
      this.renderSkills();
      this.renderInspector();
    });
    eventBus.on('perkSelectionOpen', (payload) => {
      this.openPerkSelection(payload);
    });
    eventBus.on('perksChanged', (perks) => {
      if (perks.length === 0) {
        this.closePerkSelection();
      }
      this.renderActivePerks(perks);
    });
    eventBus.on('unitSelected', () => {
      this.updateButtonStates();
    });
    eventBus.on('skillStateChanged', (skillState) => {
      this.skillState = skillState;
      this.renderSkills();
      this.updateDeployHint();
    });
    eventBus.on('unitInspected', (unit) => {
      this.inspectedUnit = unit;
      this.renderInspector();
    });
    eventBus.on('unitUpdated', (unit) => {
      if (this.inspectedUnit === unit) {
        this.renderInspector();
      }
    });
    eventBus.on('gameSpeedChanged', (speed) => {
      this.renderGameSpeed(speed);
    });
    eventBus.on('autoWaveChanged', (enabled) => {
      this.renderAutoWave(enabled);
    });
    eventBus.on('pauseChanged', (paused) => {
      this.renderPauseState(paused);
    });
    eventBus.on('sfxVolumeChanged', (volume) => {
      this.renderSfxVolume(volume);
    });
    eventBus.on('particlesEnabledChanged', (enabled) => {
      this.renderParticlesEnabled(enabled);
    });
    eventBus.on('defeatRewardEarned', ({ crystalsEarned, xpEarned }) => {
      this.gameOverCrystalsEl.textContent = `+${crystalsEarned}`;
      this.gameOverXpEl.textContent = `+${xpEarned} XP`;
    });
    eventBus.on('profileChanged', () => {
      this.syncUnitCardStats();
      this.renderBarracks();
    });

    this.syncUnitCardStats();
    this.renderBarracks();

    this.renderGold(this.gameState.getGold());
    this.renderLives(this.gameState.getLives());
    this.renderWave();
    this.renderGameOver(this.gameState.isGameOver());
    this.renderGameSpeed(this.gameState.getGameSpeed());
    this.renderAutoWave(this.gameState.isAutoWave());
    this.renderPauseState(this.gameState.isPaused());
    this.renderSfxVolume(this.gameState.getSfxVolume());
    this.renderParticlesEnabled(this.gameState.isParticlesEnabled());
    this.updateWaveButton();
    this.updateButtonStates();
    this.renderSkills();
    this.renderInspector();
  }

  public updateEnemyTooltip(
    enemy: Enemy | null,
    clientX: number,
    clientY: number,
  ): void {
    if (
      !enemy ||
      enemy.isDead ||
      enemy.isDying ||
      enemy.reachedGoal ||
      this.gameState.isGameOver() ||
      this.gameState.isPaused()
    ) {
      this.enemyTooltipEl.classList.add('is-hidden');
      return;
    }

    const cfg = ENEMY_CONFIGS[enemy.typeId];
    const ratio = Math.max(0, Math.min(1, enemy.hp / enemy.maxHp));
    const speedLabel =
      enemy.speed >= 2.0 ? 'Fast' : enemy.speed >= 1.2 ? 'Normal' : 'Slow';
    const accentHex = `#${enemy.color.toString(16).padStart(6, '0')}`;
    const halfBound = Math.max(0, Math.min(100, window.innerWidth / 2 - 8));
    const clampedX = Math.max(
      halfBound,
      Math.min(window.innerWidth - halfBound, Math.round(clientX)),
    );
    const clampedY = Math.max(
      24,
      Math.min(window.innerHeight - 24, Math.round(clientY)),
    );

    this.enemyTooltipEl.classList.remove('is-hidden');
    this.enemyTooltipEl.classList.toggle('is-boss', enemy.isBoss);
    this.enemyTooltipEl.classList.toggle('is-below', clampedY < 110);
    this.enemyTooltipEl.style.left = `${clampedX}px`;
    this.enemyTooltipEl.style.top = `${clampedY}px`;
    this.enemyTooltipEl.style.setProperty('--enemy-accent', accentHex);

    this.enemyTooltipNameEl.textContent = cfg.name;
    this.enemyTooltipBadgeEl.textContent = enemy.isBoss
      ? 'BOSS'
      : cfg.name.toUpperCase();
    this.enemyTooltipHpFillEl.style.width = `${Math.round(ratio * 100)}%`;
    this.enemyTooltipHpFillEl.classList.toggle('is-low', ratio <= 0.4);
    this.enemyTooltipHpTextEl.textContent = `${Math.max(0, Math.ceil(enemy.hp))} / ${enemy.maxHp} HP`;
    this.enemyTooltipSpeedEl.textContent = `SPD: ${speedLabel} (${enemy.speed.toFixed(1)})`;
    this.enemyTooltipRewardEl.textContent = `+${enemy.rewardGold}g`;
  }

  public spawnFlyingGold(
    screenX: number,
    screenY: number,
    rewardGold: number,
  ): void {
    if (rewardGold <= 0 || this.gameState.isGameOver()) {
      return;
    }

    this.pendingFlyingGold += rewardGold;

    const el = document.createElement('div');
    el.className = 'flying-gold-coin';
    const innerEl = document.createElement('div');
    innerEl.className = 'flying-gold-coin-inner';
    el.appendChild(innerEl);

    el.style.transform = `translate3d(${screenX.toFixed(1)}px, ${screenY.toFixed(1)}px, 0) scale(0.4)`;
    innerEl.style.transform = 'rotateY(0deg)';
    this.coinFxLayer.appendChild(el);

    this.flyingCoins.push({
      el,
      innerEl,
      startX: screenX,
      startY: screenY,
      rewardGold,
      elapsed: 0,
      riseDuration: 0.24,
      flyDuration: 0.5,
    });
  }

  public updateFlyingCoins(dt: number): void {
    if (dt <= 0 || this.flyingCoins.length === 0) {
      return;
    }

    const boxRect = this.goldPillEl.getBoundingClientRect();
    const targetX = boxRect.left + 4;
    const targetY = boxRect.top + boxRect.height * 0.5;
    let landedGold = 0;

    for (let i = this.flyingCoins.length - 1; i >= 0; i--) {
      const coin = this.flyingCoins[i];
      coin.elapsed += dt;
      const totalDuration = coin.riseDuration + coin.flyDuration;

      if (coin.elapsed >= totalDuration) {
        coin.el.remove();
        this.flyingCoins.splice(i, 1);
        landedGold += coin.rewardGold;
        continue;
      }

      if (coin.elapsed < coin.riseDuration) {
        const t = coin.elapsed / coin.riseDuration;
        const easeOut = 1 - Math.pow(1 - t, 3);
        const x = coin.startX;
        const y = coin.startY - 34 * easeOut;
        const scale = 0.4 + 0.6 * easeOut;
        const spinDeg = t * 540;

        coin.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${scale.toFixed(3)})`;
        coin.innerEl.style.transform = `rotateY(${spinDeg.toFixed(1)}deg)`;
        continue;
      }

      const u = Math.min(
        1,
        (coin.elapsed - coin.riseDuration) / coin.flyDuration,
      );
      const easeU = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      const inv = 1 - easeU;

      const p0x = coin.startX;
      const p0y = coin.startY - 34;
      const p1x = p0x + (targetX - p0x) * 0.32;
      const p1y = Math.min(p0y - 20, targetY + 10);
      const p2x = targetX + (p0x - targetX) * 0.14;
      const p2y = Math.max(6, targetY - 34);

      const x =
        inv * inv * inv * p0x +
        3 * inv * inv * easeU * p1x +
        3 * inv * easeU * easeU * p2x +
        easeU * easeU * easeU * targetX;
      const y =
        inv * inv * inv * p0y +
        3 * inv * inv * easeU * p1y +
        3 * inv * easeU * easeU * p2y +
        easeU * easeU * easeU * targetY;

      const scale = 1.0 - 0.4 * easeU;
      const spinDeg = 540 + easeU * 720;
      const opacity = easeU > 0.88 ? 1 - (easeU - 0.88) / 0.12 : 1;

      coin.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${scale.toFixed(3)})`;
      coin.el.style.opacity = opacity.toFixed(2);
      coin.innerEl.style.transform = `rotateY(${spinDeg.toFixed(1)}deg)`;
    }

    if (landedGold > 0) {
      this.pendingFlyingGold = Math.max(0, this.pendingFlyingGold - landedGold);
      this.renderGold(this.gameState.getGold(), true);
      this.triggerAnimation(this.goldPillEl, 'is-collecting');
      this.spawnGoldGainTag(landedGold);
    }
  }

  public clearFlyingGold(): void {
    for (const coin of this.flyingCoins) {
      coin.el.remove();
    }
    this.flyingCoins.length = 0;
    this.pendingFlyingGold = 0;
    this.goldPillEl.classList.remove('is-collecting', 'is-popping');
    this.goldPillEl
      .querySelectorAll('.gold-gain-float')
      .forEach((node) => node.remove());
    this.renderGold(this.gameState.getGold(), true);
  }

  private spawnGoldGainTag(amount: number): void {
    this.goldPillEl
      .querySelectorAll('.gold-gain-float')
      .forEach((node) => node.remove());
    const tag = document.createElement('span');
    tag.className = 'gold-gain-float';
    tag.textContent = `+${amount}g`;
    tag.addEventListener('animationend', () => {
      tag.remove();
    });
    this.goldPillEl.appendChild(tag);
  }

  private renderGameSpeed(speed: GameSpeed): void {
    this.speedBtn.dataset.speed = String(speed);
    this.speedBtnLabelEl.textContent = `${speed}x`;
  }

  private renderAutoWave(enabled: boolean): void {
    this.autoWaveBtn.classList.toggle('is-active', enabled);
    this.autoWaveBtn.setAttribute('aria-pressed', String(enabled));
  }

  private renderPauseState(paused: boolean): void {
    const showSettings =
      paused && !this.perkModalOpen && !this.gameState.isPathVictory();
    this.settingsBtn.classList.toggle('is-active', showSettings);
    this.settingsModal.classList.toggle('is-hidden', !showSettings);
  }

  private openPerkSelection(payload: PerkSelectionPayload): void {
    this.perkModalOpen = true;
    this.renderPauseState(this.gameState.isPaused());
    this.perkCardsGrid.replaceChildren(
      ...payload.choices.map((config) =>
        this.createPerkCardElement(config, payload.stacks[config.id] ?? 0),
      ),
    );
    this.perkModal.classList.remove('is-hidden');
  }

  private closePerkSelection(): void {
    if (!this.perkModalOpen) {
      return;
    }
    this.perkModalOpen = false;
    this.perkModal.classList.add('is-hidden');
    this.perkCardsGrid.replaceChildren();
    this.renderPauseState(this.gameState.isPaused());
  }

  private createPerkCardElement(
    config: PerkConfig,
    currentStacks: number,
  ): HTMLButtonElement {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `perk-card perk-card--${config.rarity}`;

    const rarity = document.createElement('span');
    rarity.className = 'perk-card-rarity';
    rarity.textContent = config.rarity.toUpperCase();

    const emblem = document.createElement('div');
    emblem.className = 'perk-card-emblem';
    emblem.appendChild(this.createSvgElement(config.icon));

    const title = document.createElement('span');
    title.className = 'perk-card-title';
    title.textContent = config.name;

    const desc = document.createElement('p');
    desc.className = 'perk-card-desc';
    desc.textContent = config.description;

    const stack = document.createElement('span');
    stack.className = 'perk-card-stack';
    stack.textContent = `Lv ${currentStacks}/${config.maxStacks}`;

    card.append(rarity, emblem, title, desc, stack);
    card.addEventListener('click', () => {
      this.closePerkSelection();
      this.onSelectPerkCallback(config.id);
    });
    return card;
  }

  private renderActivePerks(perks: readonly ActivePerkEntry[]): void {
    if (perks.length === 0) {
      this.activePerksBar.classList.add('is-hidden');
      this.activePerksBar.replaceChildren();
      return;
    }

    const badges = perks.map(({ config, stacks }) => {
      const badge = document.createElement('div');
      badge.className = `active-perk-badge active-perk-badge--${config.rarity}`;
      badge.title = `${config.name} (${stacks}/${config.maxStacks}): ${config.description}`;

      const iconWrap = document.createElement('span');
      iconWrap.className = 'active-perk-badge-icon';
      iconWrap.appendChild(this.createSvgElement(config.icon));

      const stackLabel = document.createElement('span');
      stackLabel.className = 'active-perk-badge-stack';
      stackLabel.textContent = `x${stacks}`;

      badge.append(iconWrap, stackLabel);
      return badge;
    });

    this.activePerksBar.replaceChildren(...badges);
    this.activePerksBar.classList.remove('is-hidden');
  }

  private createSvgElement(svgMarkup: string): Node {
    const parsed = new DOMParser().parseFromString(svgMarkup, 'image/svg+xml');
    return document.importNode(parsed.documentElement, true);
  }

  private renderSfxVolume(volume: number): void {
    const pct = Math.round(volume * 100);
    this.settingsVolumeSlider.value = String(pct);
    this.settingsVolumeValEl.textContent = `${pct}%`;
  }

  private renderParticlesEnabled(enabled: boolean): void {
    this.settingsParticlesBtn.classList.toggle('is-on', enabled);
    this.settingsParticlesBtn.textContent = enabled ? 'ON' : 'OFF';
    this.settingsParticlesBtn.setAttribute('aria-pressed', String(enabled));
  }

  private triggerAnimation(el: HTMLElement, className: string): void {
    el.classList.remove(className);
    void el.offsetWidth;
    el.classList.add(className);
  }

  private renderGold(gold: number, suppressPop = false): void {
    const visibleGold = Math.max(0, gold - this.pendingFlyingGold);
    this.goldEl.textContent = String(visibleGold);
    if (!suppressPop && visibleGold > this.lastGold) {
      this.triggerAnimation(this.goldPillEl, 'is-popping');
    }
    this.lastGold = visibleGold;
  }

  private renderLives(lives: number): void {
    this.livesEl.textContent = String(lives);
    if (lives < this.lastLives) {
      this.triggerAnimation(this.livesPillEl, 'is-damaged');
    }
    this.lastLives = lives;
  }

  private showWaveBanner(wave: number): void {
    const isBoss = wave % 5 === 0;
    this.waveBannerEyebrowEl.textContent = isBoss
      ? '⚠️ DREAD BOSS APPROACHING ⚠️'
      : 'PREPARE FOR BATTLE';
    this.waveBannerTextEl.textContent = isBoss
      ? `WAVE ${wave} — BOSS WAVE!`
      : `WAVE ${wave} — INCOMING!`;
    this.waveBannerEl.classList.toggle('is-boss', isBoss);

    this.waveBannerEl.classList.remove('is-hidden', 'is-active');
    void this.waveBannerEl.offsetWidth;
    this.waveBannerEl.classList.add('is-active');

    if (this.waveBannerTimer !== null) {
      window.clearTimeout(this.waveBannerTimer);
    }
    this.waveBannerTimer = window.setTimeout(() => {
      this.hideWaveBanner();
    }, 2200);
  }

  private hideWaveBanner(): void {
    if (this.waveBannerTimer !== null) {
      window.clearTimeout(this.waveBannerTimer);
      this.waveBannerTimer = null;
    }
    this.waveBannerEl.classList.remove('is-active');
    this.waveBannerEl.classList.add('is-hidden');
  }

  private renderWave(): void {
    const pathId = this.gameState.getCurrentPathId();
    const totalWaves = this.gameState.getTotalWaves();
    const { wave, remaining, total } = this.waveProgress;
    if (this.gameState.isPathVictory()) {
      this.waveEl.textContent = `Path ${pathId} • Wave ${totalWaves} / ${totalWaves}`;
      this.waveFillEl.style.width = '100%';
      return;
    }
    if (this.waveActive) {
      this.waveEl.textContent = `Path ${pathId} • Wave ${wave} / ${totalWaves} (${remaining} Left)`;
      const pct =
        total > 0
          ? Math.max(0, Math.min(100, Math.round(((total - remaining) / total) * 100)))
          : 0;
      this.waveFillEl.style.width = `${pct}%`;
      return;
    }

    this.waveEl.textContent = `Path ${pathId} • Wave ${wave} / ${totalWaves}`;
    this.waveFillEl.style.width = '0%';
  }

  private renderMuteButton(muted: boolean): void {
    this.muteBtn.classList.toggle('is-muted', muted);
    const label = this.muteBtn.querySelector('.btn-label');
    const text = muted ? 'Sound: OFF' : 'Sound: ON';
    if (label) {
      label.textContent = text;
    } else {
      this.muteBtn.textContent = text;
    }
    this.muteBtn.setAttribute('aria-pressed', String(muted));
  }

  private showVictoryModal(payload: PathVictoryPayload): void {
    this.victoryEyebrowEl.textContent = `${payload.totalWaves} / ${payload.totalWaves} WAVES CLEARED`;
    this.victoryPathNameEl.textContent = `Path ${payload.pathId}: ${payload.pathName}`;

    const starEls: HTMLElement[] = [];
    for (let i = 0; i < 3; i++) {
      const earned = i < payload.stars;
      const star = document.createElement('span');
      star.className = earned ? 'victory-star is-earned' : 'victory-star';
      star.textContent = '★';
      if (earned) {
        star.style.animationDelay = `${i * 0.14}s`;
      }
      starEls.push(star);
    }
    this.victoryStarsEl.replaceChildren(...starEls);
    this.victoryStarsEl.setAttribute('aria-label', `${payload.stars} of 3 stars`);
    this.victoryCrystalsEl.textContent = `+${payload.crystalsEarned}`;
    this.victoryXpEl.textContent = `+${payload.xpEarned} XP`;
    this.victoryNextLabelEl.textContent = `Next Path (${payload.nextPathId})`;
    this.victoryModal.classList.remove('is-hidden');
  }

  private hideVictoryModal(): void {
    this.victoryModal.classList.add('is-hidden');
  }

  private renderGameOver(isGameOver: boolean): void {
    this.gameOverModal.classList.toggle('is-hidden', !isGameOver);
    this.gameOverWaveEl.textContent = String(this.gameState.getWave());
    if (!isGameOver) {
      this.gameOverCrystalsEl.textContent = '+0';
      this.gameOverXpEl.textContent = '+0 XP';
    }
  }

  private syncUnitCardStats(): void {
    this.unitButtons.forEach((button, unitId) => {
      const miniEl = button.querySelector('.unit-mini-stats');
      if (!miniEl) {
        return;
      }
      const cfg = UNIT_CONFIGS[unitId];
      const stats = this.profileManager.getUnitEffectiveStats(unitId);
      if (cfg.attackType === 'support') {
        miniEl.textContent = `+${Math.round(stats.buffDamagePct * 100)}% DMG • ${stats.range.toFixed(1)} RNG`;
      } else if (cfg.attackType === 'economy') {
        miniEl.textContent = `+${stats.goldPerWave}g / WAVE`;
      } else {
        const dmgTag = cfg.attackType === 'aoe' ? 'AOE' : 'DMG';
        miniEl.textContent = `${this.formatStatNumber(stats.damage)} ${dmgTag} • ${stats.range.toFixed(1)} RNG`;
      }
    });
  }

  private formatStatNumber(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }

  private buildUnitEmblemNode(unit: UnitConfig): Node {
    const sourceSvg = this.unitButtons
      .get(unit.id)
      ?.querySelector('.unit-emblem-svg');
    if (sourceSvg) {
      return sourceSvg.cloneNode(true);
    }
    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('viewBox', '0 0 36 36');
    svg.setAttribute('class', 'unit-emblem-svg');
    const circle = document.createElementNS(svgNs, 'circle');
    circle.setAttribute('cx', '18');
    circle.setAttribute('cy', '18');
    circle.setAttribute('r', '12');
    circle.setAttribute('fill', `#${unit.color.toString(16).padStart(6, '0')}`);
    circle.setAttribute('stroke', '#ffffff');
    circle.setAttribute('stroke-width', '2');
    svg.appendChild(circle);
    return svg;
  }

  private formatBarracksStatValue(
    unit: UnitConfig,
    stat: UnitUpgradeStat,
    value: number,
  ): string {
    if (stat === 'maxLevel') {
      return `Lv.${value}`;
    }
    if (unit.attackType === 'support') {
      if (stat === 'damage' || stat === 'fireRate') {
        return `+${value.toFixed(1)}%`;
      }
      return value.toFixed(2);
    }
    if (unit.attackType === 'economy') {
      if (stat === 'range') {
        return `${Math.round(value)} XP`;
      }
      return `+${Math.round(value)}g`;
    }
    switch (stat) {
      case 'damage':
        return value.toFixed(1);
      case 'range':
        return value.toFixed(2);
      case 'fireRate':
        return `${value.toFixed(2)}/s`;
    }
  }

  private getBarracksStatCopy(
    unit: UnitConfig,
    stat: UnitUpgradeStat,
    defaultMeta: BarracksStatMeta,
  ): { label: string; subLabel: string } {
    if (unit.attackType === 'support') {
      switch (stat) {
        case 'damage':
          return { label: 'Aura Damage', subLabel: '+10% aura damage bonus per rank' };
        case 'range':
          return { label: 'Aura Radius', subLabel: '+5% aura coverage per rank' };
        case 'fireRate':
          return { label: 'Aura Speed', subLabel: '+8% aura fire rate bonus per rank' };
        case 'maxLevel':
          return defaultMeta;
      }
    }
    if (unit.attackType === 'economy') {
      switch (stat) {
        case 'damage':
          return { label: 'Gold Yield', subLabel: '+10% gold per wave per rank' };
        case 'range':
          return { label: 'Ore Wisdom', subLabel: '+10% wave XP earned per rank' };
        case 'fireRate':
          return { label: 'Mining Speed', subLabel: '+8% gold per wave per rank' };
        case 'maxLevel':
          return defaultMeta;
      }
    }
    return defaultMeta;
  }

  private renderBarracks(): void {
    const profile = this.profileManager.getProfile();
    const selectedConfig = UNIT_CONFIGS[this.selectedBarracksUnitId];

    const stripButtons = UNIT_LIST.map((unit) => {
      const isSelected = unit.id === selectedConfig.id;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'barracks-unit-tab';
      if (isSelected) {
        btn.classList.add('is-selected');
      }
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', String(isSelected));
      btn.dataset.unitId = unit.id;

      const emblem = document.createElement('span');
      emblem.className = `unit-card-emblem unit-card-emblem--${unit.id}`;
      emblem.appendChild(this.buildUnitEmblemNode(unit));

      const copy = document.createElement('span');
      copy.className = 'barracks-tab-copy';

      const nameEl = document.createElement('span');
      nameEl.className = 'barracks-tab-name';
      nameEl.textContent = unit.name;

      const roleEl = document.createElement('span');
      roleEl.className = 'barracks-tab-role';
      roleEl.textContent = unit.role;

      copy.append(nameEl, roleEl);
      btn.append(emblem, copy);
      btn.addEventListener('click', () => {
        this.selectedBarracksUnitId = unit.id;
        this.renderBarracks();
      });
      return btn;
    });
    this.barracksUnitStripEl.replaceChildren(...stripButtons);

    this.barracksUnitEmblemEl.className = `unit-card-emblem unit-card-emblem--${selectedConfig.id}`;
    this.barracksUnitEmblemEl.replaceChildren(
      this.buildUnitEmblemNode(selectedConfig),
    );
    this.barracksUnitNameEl.textContent = selectedConfig.name;
    this.barracksUnitRoleEl.textContent = selectedConfig.role;
    this.barracksUnitDescEl.textContent = selectedConfig.description;

    const eff = this.profileManager.getUnitEffectiveStats(selectedConfig.id);
    if (selectedConfig.attackType === 'support') {
      this.barracksEffDamageEl.textContent = `+${(eff.buffDamagePct * 100).toFixed(1)}%`;
      this.barracksEffRangeEl.textContent = eff.range.toFixed(2);
      this.barracksEffFireRateEl.textContent = `+${(eff.buffFireRatePct * 100).toFixed(1)}%`;
    } else if (selectedConfig.attackType === 'economy') {
      this.barracksEffDamageEl.textContent = `+${eff.goldPerWave}g/W`;
      this.barracksEffRangeEl.textContent = `${eff.minerWaveXp} XP`;
      this.barracksEffFireRateEl.textContent = 'Passive';
    } else {
      this.barracksEffDamageEl.textContent = this.formatStatNumber(eff.damage);
      this.barracksEffRangeEl.textContent = eff.range.toFixed(2);
      this.barracksEffFireRateEl.textContent = `${eff.fireRate.toFixed(2)}/s`;
    }
    this.barracksEffMaxLevelEl.textContent = `Lv.${eff.maxInGameLevel}`;

    const rows = BARRACKS_STAT_META.map((meta) => {
      const preview = this.profileManager.getStatUpgradePreview(
        selectedConfig.id,
        meta.stat,
      );
      return this.createBarracksUpgradeRow(
        selectedConfig,
        meta,
        preview,
        profile.crystals,
      );
    });
    this.lastUpgradedStat = null;
    this.barracksUpgradesListEl.replaceChildren(...rows);
  }

  private createBarracksUpgradeRow(
    unit: UnitConfig,
    meta: BarracksStatMeta,
    preview: StatUpgradePreview,
    crystals: number,
  ): HTMLElement {
    const unitId = unit.id;
    const copy = this.getBarracksStatCopy(unit, meta.stat, meta);
    const row = document.createElement('div');
    row.className = 'barracks-upgrade-row';
    if (this.lastUpgradedStat === meta.stat) {
      row.classList.add('is-just-upgraded');
    }

    const iconWrap = document.createElement('div');
    iconWrap.className = 'barracks-row-icon';
    iconWrap.appendChild(this.createSvgElement(meta.iconSvg));

    const info = document.createElement('div');
    info.className = 'barracks-row-info';

    const head = document.createElement('div');
    head.className = 'barracks-row-head';

    const nameEl = document.createElement('span');
    nameEl.className = 'barracks-row-title';
    nameEl.textContent = copy.label;

    const lvBadge = document.createElement('span');
    lvBadge.className = 'barracks-row-lv';
    lvBadge.textContent = `Lv ${preview.level} / ${preview.maxLevel}`;

    head.append(nameEl, lvBadge);

    const track = document.createElement('div');
    track.className = 'barracks-progress-track';
    const fill = document.createElement('div');
    fill.className = 'barracks-progress-fill';
    const baseLevel = meta.stat === 'maxLevel' ? MIN_IN_GAME_LEVEL : 0;
    const span = Math.max(1, preview.maxLevel - baseLevel);
    const pct = Math.min(
      100,
      Math.max(0, Math.round(((preview.level - baseLevel) / span) * 100)),
    );
    fill.style.width = `${pct}%`;
    track.appendChild(fill);

    const previewRow = document.createElement('div');
    previewRow.className = 'barracks-row-preview';

    const subText = document.createElement('span');
    subText.className = 'barracks-row-sub';
    subText.textContent = copy.subLabel;

    const deltaEl = document.createElement('span');
    deltaEl.className = 'barracks-row-delta';
    const currText = this.formatBarracksStatValue(
      unit,
      meta.stat,
      preview.currentValue,
    );
    if (preview.isMaxed || preview.nextValue === null) {
      deltaEl.textContent = `${currText} (MAX)`;
      deltaEl.classList.add('is-maxed');
    } else {
      const nextText = this.formatBarracksStatValue(
        unit,
        meta.stat,
        preview.nextValue,
      );
      deltaEl.textContent = `${currText} → ${nextText}`;
    }

    previewRow.append(subText, deltaEl);
    info.append(head, track, previewRow);

    const buyBtn = document.createElement('button');
    buyBtn.type = 'button';
    buyBtn.className = 'action-btn barracks-buy-btn';

    if (preview.isMaxed || preview.cost === null) {
      buyBtn.disabled = true;
      buyBtn.classList.add('is-maxed');
      buyBtn.textContent = 'MAXED';
    } else {
      const canAfford = crystals >= preview.cost;
      buyBtn.disabled = !canAfford;
      buyBtn.classList.toggle('is-unaffordable', !canAfford);

      const iconNode = this.createSvgElement(CRYSTAL_BTN_SVG);
      if (iconNode instanceof Element) {
        iconNode.classList.add('barracks-btn-crystal-svg');
      }
      const costSpan = document.createElement('span');
      costSpan.textContent = String(preview.cost);
      buyBtn.append(iconNode, costSpan);

      buyBtn.addEventListener('click', () => {
        this.lastUpgradedStat = meta.stat;
        if (this.onUpgradeUnitMetaCallback(unitId, meta.stat)) {
          this.triggerAnimation(this.barracksCrystalsValEl, 'is-popping');
        } else {
          this.lastUpgradedStat = null;
        }
      });
    }

    row.append(iconWrap, info, buyBtn);
    return row;
  }

  private updateWaveButton(): void {
    const wave = this.gameState.getWave();
    const totalWaves = this.gameState.getTotalWaves();
    const pathId = this.gameState.getCurrentPathId();
    const isVictory = this.gameState.isPathVictory();
    const isDisabled =
      this.waveActive || this.gameState.isGameOver() || isVictory;
    this.startWaveBtn.disabled = isDisabled;
    const label = this.startWaveBtn.querySelector('.btn-label');
    const text = isVictory
      ? `Path ${pathId} Cleared!`
      : this.waveActive
        ? `Wave ${wave} / ${totalWaves} Active...`
        : `Start Wave ${wave} / ${totalWaves}`;
    if (label) {
      label.textContent = text;
    } else {
      this.startWaveBtn.textContent = text;
    }
  }

  private updateButtonStates(): void {
    const selectedId = this.gameState.getSelectedUnitId();
    const gold = this.gameState.getGold();

    this.unitButtons.forEach((button, unitId) => {
      const config = UNIT_CONFIGS[unitId];
      const isSelected = selectedId === unitId;
      const canAfford = gold >= config.cost;

      button.classList.toggle('is-selected', isSelected);
      button.classList.toggle('is-unaffordable', !canAfford);
      button.setAttribute('aria-pressed', String(isSelected));
    });

    this.updateDeployHint();
  }

  private updateDeployHint(): void {
    if (this.gameState.isGameOver() || this.gameState.isPathVictory()) {
      this.deployHintEl.classList.remove('is-targeting');
      this.deployHintEl.classList.add('is-hidden');
      return;
    }

    const isTouch = window.matchMedia('(pointer: coarse)').matches;
    if (this.skillState.targetingSkill === 'meteor') {
      this.deployHintEl.classList.add('is-targeting');
      if (isTouch) {
        this.deployHintEl.replaceChildren(
          'Meteor Targeting — Tap the map to strike',
        );
      } else {
        const kbd = document.createElement('kbd');
        kbd.textContent = 'ESC';
        this.deployHintEl.replaceChildren(
          'Meteor Targeting — Click map to strike • ',
          kbd,
          ' / Right-Click Cancel',
        );
      }
      this.deployHintEl.classList.remove('is-hidden');
      return;
    }

    this.deployHintEl.classList.remove('is-targeting');
    const selectedId = this.gameState.getSelectedUnitId();
    if (selectedId) {
      const unitName = UNIT_CONFIGS[selectedId].name;
      if (isTouch) {
        this.deployHintEl.replaceChildren(
          `Deploying ${unitName} — Tap a grass tile`,
        );
      } else {
        const kbd = document.createElement('kbd');
        kbd.textContent = 'ESC';
        this.deployHintEl.replaceChildren(
          `Deploying ${unitName} — Click a grass tile • `,
          kbd,
          ' Cancel',
        );
      }
      this.deployHintEl.classList.remove('is-hidden');
    } else {
      this.deployHintEl.classList.add('is-hidden');
    }
  }

  private renderSkills(): void {
    const isEnded =
      this.gameState.isGameOver() || this.gameState.isPathVictory();
    this.skillButtons.forEach((refs, skillId) => {
      const remaining = this.skillState.cooldowns[skillId];
      const maxCd = this.skillState.maxCooldowns[skillId];
      const onCooldown = remaining > 0;
      const isTargeting = this.skillState.targetingSkill === skillId;

      refs.button.disabled = onCooldown || isEnded;
      refs.button.classList.toggle('is-cooldown', onCooldown);
      refs.button.classList.toggle('is-targeting', isTargeting);
      refs.button.setAttribute('aria-pressed', String(isTargeting));

      if (onCooldown) {
        refs.overlay.classList.remove('is-hidden');
        const pct = maxCd > 0 ? Math.min(100, (remaining / maxCd) * 100) : 0;
        refs.fill.style.height = `${pct.toFixed(1)}%`;
        const secLabel = `${Math.ceil(remaining)}s`;
        if (refs.text.textContent !== secLabel) {
          refs.text.textContent = secLabel;
        }
      } else {
        refs.overlay.classList.add('is-hidden');
      }
    });
  }

  private renderInspector(): void {
    const unit = this.inspectedUnit;
    if (!unit) {
      this.inspectorEl.classList.add('is-hidden');
      return;
    }

    this.inspectorEl.classList.remove('is-hidden');
    this.inspectorEl.dataset.unitId = unit.config.id;
    this.inspectorIconEl.className = `unit-card-emblem unit-card-emblem--${unit.config.id}`;
    const sourceSvg = this.unitButtons
      .get(unit.config.id)
      ?.querySelector('.unit-emblem-svg');
    if (sourceSvg) {
      this.inspectorIconEl.replaceChildren(sourceSvg.cloneNode(true));
    }

    this.inspectorNameEl.textContent = unit.config.name;
    this.inspectorRoleEl.textContent = unit.config.role;

    const starNodes: HTMLElement[] = [];
    for (let i = 1; i <= unit.maxLevel; i++) {
      const star = document.createElement('span');
      const filled = i <= unit.level;
      star.className = filled ? 'star is-filled' : 'star';
      if (i >= 4) {
        star.classList.add('star--mythic');
      }
      star.textContent = filled ? '★' : '☆';
      starNodes.push(star);
    }
    const lvTag = document.createElement('span');
    lvTag.className = 'inspector-lv-tag';
    lvTag.textContent =
      unit.level >= unit.maxLevel
        ? `Lv ${unit.level} / ${unit.maxLevel} MAX`
        : `Lv ${unit.level} / ${unit.maxLevel}`;
    starNodes.push(lvTag);
    this.inspectorLevelEl.replaceChildren(...starNodes);
    this.inspectorLevelEl.setAttribute(
      'aria-label',
      `Level ${unit.level} of ${unit.maxLevel}`,
    );

    const isSupport = unit.config.attackType === 'support';
    const isEconomy = unit.config.attackType === 'economy';
    this.inspectorTargetingEl.classList.toggle(
      'is-hidden',
      isSupport || isEconomy,
    );

    if (isSupport) {
      this.inspectorLabelDmgEl.textContent = 'AURA DMG';
      this.inspectorLabelRngEl.textContent = 'AURA RNG';
      this.inspectorLabelRateEl.textContent = 'AURA SPD';
      this.inspectorLabelKillsEl.textContent = 'ASSISTS';
      this.inspectorDamageEl.textContent = `+${Math.round(unit.buffDamagePct * 100)}%`;
      this.inspectorRangeEl.textContent = unit.range.toFixed(1);
      this.inspectorFireRateEl.textContent = `+${Math.round(unit.buffFireRatePct * 100)}%`;
      this.inspectorKillsEl.textContent = String(unit.kills);
    } else if (isEconomy) {
      this.inspectorLabelDmgEl.textContent = 'GOLD/WAVE';
      this.inspectorLabelRngEl.textContent = 'WAVE XP';
      this.inspectorLabelRateEl.textContent = 'ROLE';
      this.inspectorLabelKillsEl.textContent = 'MINED';
      this.inspectorDamageEl.textContent = `+${unit.goldPerWave}g`;
      this.inspectorRangeEl.textContent = `+${unit.minerWaveXp}`;
      this.inspectorFireRateEl.textContent = 'Economy';
      this.inspectorKillsEl.textContent = `${unit.totalGoldMined}g`;
    } else {
      this.inspectorLabelDmgEl.textContent =
        unit.auraDamageBonusPct > 0 ? 'DMG (BUFF)' : 'DMG';
      this.inspectorLabelRngEl.textContent = 'RNG';
      this.inspectorLabelRateEl.textContent = 'RATE';
      this.inspectorLabelKillsEl.textContent = 'KILLS';
      this.inspectorDamageEl.textContent = this.formatStatNumber(unit.damage);
      this.inspectorRangeEl.textContent = unit.range.toFixed(1);
      this.inspectorFireRateEl.textContent = `${unit.fireRate.toFixed(2)}/s`;
      this.inspectorKillsEl.textContent = String(unit.kills);
    }

    this.targetingButtons.forEach((button, strategy) => {
      const active = unit.targetingStrategy === strategy;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    this.inspectorSellLabelEl.textContent = `Sell (+${unit.getSellValue()}g)`;
    this.inspectorSellBtn.disabled =
      this.gameState.isGameOver() || this.gameState.isPathVictory();

    if (unit.level >= unit.maxLevel) {
      this.inspectorDamageNextEl.textContent = '';
      this.inspectorRangeNextEl.textContent = '';
      this.inspectorFireRateNextEl.textContent = '';
      this.inspectorTierBadgeEl.textContent = 'MAX';
      this.inspectorXpStatusEl.textContent = 'MAX TIER';
      this.inspectorXpStatusEl.classList.remove('is-ready');
      this.inspectorXpTextEl.textContent = 'MAX LEVEL ★';
      this.inspectorXpFillEl.style.width = '100%';
      this.inspectorUpgradeBtn.disabled = true;
      this.inspectorUpgradeBtn.classList.remove('is-ready');
      this.inspectorUpgradeMainEl.textContent = 'MAX LEVEL REACHED';
      this.inspectorUpgradeSubEl.textContent = 'All upgrades unlocked';
      this.inspectorUpgradeCostBadgeEl.textContent = 'MAX';
      return;
    }

    const needed = unit.xpToNextLevel;
    const pct = Math.min(100, Math.round((unit.xp / needed) * 100));
    this.inspectorXpStatusEl.textContent = unit.canUpgrade
      ? 'MAX XP • READY!'
      : isEconomy
        ? 'WAVE XP'
        : 'COMBAT XP';
    this.inspectorXpStatusEl.classList.toggle('is-ready', unit.canUpgrade);
    this.inspectorXpTextEl.textContent = `${unit.xp} / ${needed} XP`;
    this.inspectorXpFillEl.style.width = `${pct}%`;

    this.inspectorTierBadgeEl.textContent = `Lv.${unit.level}`;
    if (isSupport) {
      const dmgPctDelta =
        Math.round(unit.buffDamagePct * 1.25 * 100) -
        Math.round(unit.buffDamagePct * 100);
      const spdPctDelta =
        Math.round(unit.buffFireRatePct * 1.2 * 100) -
        Math.round(unit.buffFireRatePct * 100);
      const rngDelta = Number((unit.range * 1.1 - unit.range).toFixed(2));
      this.inspectorDamageNextEl.textContent = `+${dmgPctDelta}%`;
      this.inspectorRangeNextEl.textContent = `+${rngDelta.toFixed(1)}`;
      this.inspectorFireRateNextEl.textContent = `+${spdPctDelta}%`;
      this.inspectorUpgradeSubEl.textContent = `+25% AURA DMG • +20% AURA SPD • +10% RNG`;
    } else if (isEconomy) {
      const goldDelta = Math.round(unit.goldPerWave * 1.35) - unit.goldPerWave;
      this.inspectorDamageNextEl.textContent = `+${goldDelta}g`;
      this.inspectorRangeNextEl.textContent = '';
      this.inspectorFireRateNextEl.textContent = '';
      this.inspectorUpgradeSubEl.textContent = `+35% GOLD / WAVE (+${goldDelta}g)`;
    } else {
      const nextDmg = Number((unit.damage * 1.35).toFixed(1));
      const dmgDelta = Number((nextDmg - unit.damage).toFixed(1));
      const nextRange = Number((unit.range * 1.1).toFixed(2));
      const rngDelta = nextRange - unit.range;
      const nextRate = Number((unit.fireRate * 1.15).toFixed(2));
      const rateDelta = nextRate - unit.fireRate;

      this.inspectorDamageNextEl.textContent = `+${this.formatStatNumber(dmgDelta)}`;
      this.inspectorRangeNextEl.textContent = `+${rngDelta.toFixed(1)}`;
      this.inspectorFireRateNextEl.textContent = `+${rateDelta.toFixed(2)}`;
      this.inspectorUpgradeSubEl.textContent = `+35% DMG (+${this.formatStatNumber(dmgDelta)}) • +15% SPD • +10% RNG`;
    }

    const canAfford = this.gameState.getGold() >= unit.upgradeCost;
    const isReady = unit.canUpgrade && canAfford;

    this.inspectorUpgradeBtn.disabled = !isReady;
    this.inspectorUpgradeBtn.classList.toggle('is-ready', isReady);
    this.inspectorUpgradeMainEl.textContent = unit.canUpgrade
      ? 'UPGRADE UNIT'
      : 'LOCKED (NEED XP)';
    this.inspectorUpgradeCostBadgeEl.textContent = `${unit.upgradeCost}g`;
  }
}
