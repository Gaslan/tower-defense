import { getPathConfig, type PathConfig } from '../config/maps';
import type { EventBus } from '../core/EventBus';
import type { ProfileManager } from '../core/PlayerProfile';

export type ScreenId = 'campaign' | 'barracks' | 'battle';

export interface ScreenManagerCallbacks {
  onEnterBattle: (pathId: number) => void;
  onExitBattle: () => void;
}

const NODE_STEP_Y = 92;
const TRAIL_TOP_PAD = 56;
const TRAIL_BOTTOM_PAD = 56;
const WAVE_X_PCTS: readonly number[] = [22, 50, 78, 50];

export class ScreenManager {
  private readonly eventBus: EventBus;
  private readonly profileManager: ProfileManager;
  private readonly callbacks: ScreenManagerCallbacks;

  private readonly gameContainerEl: HTMLElement;
  private readonly battleOverlayEl: HTMLElement;
  private readonly menuShellEl: HTMLElement;
  private readonly campaignScreenEl: HTMLElement;
  private readonly barracksScreenEl: HTMLElement;
  private readonly navCampaignBtn: HTMLButtonElement;
  private readonly navBarracksBtn: HTMLButtonElement;
  private readonly playerLevelEl: HTMLElement;
  private readonly xpFillEl: HTMLElement;
  private readonly xpTextEl: HTMLElement;
  private readonly crystalsEl: HTMLElement;
  private readonly barracksCrystalsEl: HTMLElement;
  private readonly campaignHighestPathEl: HTMLElement;
  private readonly campaignTotalStarsEl: HTMLElement;
  private readonly campaignTrailViewport: HTMLElement;
  private readonly campaignTrailCanvas: HTMLElement;
  private readonly campaignTrailSvg: SVGSVGElement;
  private readonly campaignNodesLayer: HTMLElement;
  private readonly previewPathTagEl: HTMLElement;
  private readonly previewBossBannerEl: HTMLElement;
  private readonly previewPathNameEl: HTMLElement;
  private readonly previewMinimapEl: HTMLElement;
  private readonly previewThemeNameEl: HTMLElement;
  private readonly previewTotalWavesEl: HTMLElement;
  private readonly previewCrystalRewardEl: HTMLElement;
  private readonly previewEarnedStarsEl: HTMLElement;
  private readonly startBattleBtn: HTMLButtonElement;

  private currentScreen: ScreenId = 'campaign';
  private selectedPathId: number;
  private lastKnownHighestUnlocked: number;

  constructor(
    eventBus: EventBus,
    profileManager: ProfileManager,
    callbacks: ScreenManagerCallbacks,
  ) {
    this.eventBus = eventBus;
    this.profileManager = profileManager;
    this.callbacks = callbacks;

    const initialHighest = this.profileManager.getProfile().highestUnlockedPath;
    this.selectedPathId = initialHighest;
    this.lastKnownHighestUnlocked = initialHighest;

    const gameContainerEl = document.getElementById('game-container');
    const battleOverlayEl = document.getElementById('ui-overlay');
    const menuShellEl = document.getElementById('menu-shell');
    const campaignScreenEl = document.getElementById('screen-campaign');
    const barracksScreenEl = document.getElementById('screen-barracks');
    const navCampaignBtn = document.getElementById('nav-tab-campaign');
    const navBarracksBtn = document.getElementById('nav-tab-barracks');
    const playerLevelEl = document.getElementById('menu-player-level');
    const xpFillEl = document.getElementById('menu-xp-fill');
    const xpTextEl = document.getElementById('menu-xp-text');
    const crystalsEl = document.getElementById('menu-crystals');
    const barracksCrystalsEl = document.getElementById('barracks-crystals-val');
    const campaignHighestPathEl = document.getElementById(
      'campaign-highest-path',
    );
    const campaignTotalStarsEl = document.getElementById(
      'campaign-total-stars',
    );
    const campaignTrailViewport = document.getElementById(
      'campaign-trail-viewport',
    );
    const campaignTrailCanvas = document.getElementById(
      'campaign-trail-canvas',
    );
    const campaignTrailSvg = document.getElementById('campaign-trail-svg');
    const campaignNodesLayer = document.getElementById('campaign-nodes-layer');
    const previewPathTagEl = document.getElementById('preview-path-tag');
    const previewBossBannerEl = document.getElementById('preview-boss-banner');
    const previewPathNameEl = document.getElementById('preview-path-name');
    const previewMinimapEl = document.getElementById('preview-minimap');
    const previewThemeNameEl = document.getElementById('preview-theme-name');
    const previewTotalWavesEl = document.getElementById('preview-total-waves');
    const previewCrystalRewardEl = document.getElementById(
      'preview-crystal-reward',
    );
    const previewEarnedStarsEl = document.getElementById(
      'preview-earned-stars',
    );
    const startBattleBtn = document.getElementById('campaign-start-battle-btn');

    if (
      !gameContainerEl ||
      !battleOverlayEl ||
      !menuShellEl ||
      !campaignScreenEl ||
      !barracksScreenEl ||
      !(navCampaignBtn instanceof HTMLButtonElement) ||
      !(navBarracksBtn instanceof HTMLButtonElement) ||
      !playerLevelEl ||
      !xpFillEl ||
      !xpTextEl ||
      !crystalsEl ||
      !barracksCrystalsEl ||
      !campaignHighestPathEl ||
      !campaignTotalStarsEl ||
      !campaignTrailViewport ||
      !campaignTrailCanvas ||
      !(campaignTrailSvg instanceof SVGSVGElement) ||
      !campaignNodesLayer ||
      !previewPathTagEl ||
      !previewBossBannerEl ||
      !previewPathNameEl ||
      !previewMinimapEl ||
      !previewThemeNameEl ||
      !previewTotalWavesEl ||
      !previewCrystalRewardEl ||
      !previewEarnedStarsEl ||
      !(startBattleBtn instanceof HTMLButtonElement)
    ) {
      throw new Error('Missing screen navigation elements in DOM');
    }

    this.gameContainerEl = gameContainerEl;
    this.battleOverlayEl = battleOverlayEl;
    this.menuShellEl = menuShellEl;
    this.campaignScreenEl = campaignScreenEl;
    this.barracksScreenEl = barracksScreenEl;
    this.navCampaignBtn = navCampaignBtn;
    this.navBarracksBtn = navBarracksBtn;
    this.playerLevelEl = playerLevelEl;
    this.xpFillEl = xpFillEl;
    this.xpTextEl = xpTextEl;
    this.crystalsEl = crystalsEl;
    this.barracksCrystalsEl = barracksCrystalsEl;
    this.campaignHighestPathEl = campaignHighestPathEl;
    this.campaignTotalStarsEl = campaignTotalStarsEl;
    this.campaignTrailViewport = campaignTrailViewport;
    this.campaignTrailCanvas = campaignTrailCanvas;
    this.campaignTrailSvg = campaignTrailSvg;
    this.campaignNodesLayer = campaignNodesLayer;
    this.previewPathTagEl = previewPathTagEl;
    this.previewBossBannerEl = previewBossBannerEl;
    this.previewPathNameEl = previewPathNameEl;
    this.previewMinimapEl = previewMinimapEl;
    this.previewThemeNameEl = previewThemeNameEl;
    this.previewTotalWavesEl = previewTotalWavesEl;
    this.previewCrystalRewardEl = previewCrystalRewardEl;
    this.previewEarnedStarsEl = previewEarnedStarsEl;
    this.startBattleBtn = startBattleBtn;

    navCampaignBtn.addEventListener('click', () => {
      this.switchTo('campaign');
    });
    navBarracksBtn.addEventListener('click', () => {
      this.switchTo('barracks');
    });
    startBattleBtn.addEventListener('click', () => {
      this.switchTo('battle', this.selectedPathId);
    });

    this.eventBus.on('profileChanged', () => {
      this.renderProfile();
    });

    this.renderProfile();
    this.applyScreenVisibility('campaign');
    this.scrollToFrontierNode();
  }

  public getCurrentScreen(): ScreenId {
    return this.currentScreen;
  }

  public switchTo(screen: ScreenId, pathId = 1): void {
    const prevScreen = this.currentScreen;
    if (prevScreen === 'battle' && screen !== 'battle') {
      this.callbacks.onExitBattle();
    }

    this.currentScreen = screen;
    this.applyScreenVisibility(screen);

    if (screen === 'battle') {
      this.callbacks.onEnterBattle(pathId);
    } else {
      this.renderProfile();
      if (screen === 'campaign') {
        this.scrollToFrontierNode();
      }
    }

    this.eventBus.emit('screenChanged', screen);
  }

  private applyScreenVisibility(screen: ScreenId): void {
    const inBattle = screen === 'battle';
    this.gameContainerEl.classList.toggle('is-menu-bg', !inBattle);
    this.battleOverlayEl.classList.toggle('is-hidden', !inBattle);
    this.menuShellEl.classList.toggle('is-hidden', inBattle);

    this.campaignScreenEl.classList.toggle('is-hidden', screen !== 'campaign');
    this.barracksScreenEl.classList.toggle('is-hidden', screen !== 'barracks');

    const onCampaign = screen === 'campaign';
    const onBarracks = screen === 'barracks';
    this.navCampaignBtn.classList.toggle('is-active', onCampaign);
    this.navCampaignBtn.setAttribute('aria-pressed', String(onCampaign));
    this.navBarracksBtn.classList.toggle('is-active', onBarracks);
    this.navBarracksBtn.setAttribute('aria-pressed', String(onBarracks));
  }

  private scrollToFrontierNode(): void {
    const frontierId = this.profileManager.getProfile().highestUnlockedPath;
    const nodeY = TRAIL_TOP_PAD + (frontierId - 1) * NODE_STEP_Y;
    const targetScroll = Math.max(
      0,
      nodeY - this.campaignTrailViewport.clientHeight / 2,
    );
    this.campaignTrailViewport.scrollTop = targetScroll;
  }

  private renderProfile(): void {
    const profile = this.profileManager.getProfile();
    const { playerLevel, currentLevelXp, xpForNextLevel } =
      this.profileManager.getLevelProgress();

    if (profile.highestUnlockedPath !== this.lastKnownHighestUnlocked) {
      this.selectedPathId = profile.highestUnlockedPath;
      this.lastKnownHighestUnlocked = profile.highestUnlockedPath;
    } else if (this.selectedPathId > profile.highestUnlockedPath) {
      this.selectedPathId = profile.highestUnlockedPath;
    }

    this.playerLevelEl.textContent = `Lv.${playerLevel}`;
    const pct =
      xpForNextLevel > 0
        ? Math.min(100, Math.round((currentLevelXp / xpForNextLevel) * 100))
        : 0;
    this.xpFillEl.style.width = `${pct}%`;
    this.xpTextEl.textContent = `${currentLevelXp} / ${xpForNextLevel} XP`;
    this.crystalsEl.textContent = String(profile.crystals);
    this.barracksCrystalsEl.textContent = String(profile.crystals);

    this.campaignHighestPathEl.textContent = `Unlocked: Path ${profile.highestUnlockedPath}`;

    let totalStars = 0;
    for (const val of Object.values(profile.pathStars)) {
      totalStars += val;
    }
    this.campaignTotalStarsEl.textContent = `${totalStars} ★`;

    this.renderCampaignTrail(profile.highestUnlockedPath, profile.pathStars);
    this.renderPreviewCard(
      getPathConfig(this.selectedPathId),
      profile.highestUnlockedPath,
      profile.pathStars[this.selectedPathId] ?? 0,
    );
  }

  private renderCampaignTrail(
    highestUnlockedPath: number,
    pathStars: Readonly<Record<number, number>>,
  ): void {
    const visibleCount = Math.max(10, highestUnlockedPath + 4);
    const canvasHeight =
      TRAIL_TOP_PAD + (visibleCount - 1) * NODE_STEP_Y + TRAIL_BOTTOM_PAD;
    this.campaignTrailCanvas.style.height = `${canvasHeight}px`;

    const svgNs = 'http://www.w3.org/2000/svg';
    this.campaignTrailSvg.setAttribute('viewBox', `0 0 400 ${canvasHeight}`);
    this.campaignTrailSvg.setAttribute('preserveAspectRatio', 'none');

    const coords: { xPct: number; yPx: number; svgX: number }[] = [];
    for (let i = 0; i < visibleCount; i++) {
      const xPct = WAVE_X_PCTS[i % WAVE_X_PCTS.length];
      const yPx = TRAIL_TOP_PAD + i * NODE_STEP_Y;
      coords.push({ xPct, yPx, svgX: xPct * 4 });
    }

    const segments: SVGElement[] = [];
    for (let i = 0; i < coords.length - 1; i++) {
      const from = coords[i];
      const to = coords[i + 1];
      const midY = (from.yPx + to.yPx) / 2;
      const d = `M ${from.svgX} ${from.yPx} C ${from.svgX} ${midY}, ${to.svgX} ${midY}, ${to.svgX} ${to.yPx}`;

      const pathIdTo = i + 2;
      const isCompletedEdge = pathIdTo < highestUnlockedPath;
      const isFrontierEdge = pathIdTo === highestUnlockedPath;

      const edgeGlow = document.createElementNS(svgNs, 'path');
      edgeGlow.setAttribute('d', d);
      edgeGlow.setAttribute('fill', 'none');
      edgeGlow.setAttribute(
        'stroke',
        isCompletedEdge
          ? 'rgba(46, 204, 113, 0.28)'
          : isFrontierEdge
            ? 'rgba(255, 209, 102, 0.34)'
            : 'rgba(51, 65, 85, 0.35)',
      );
      edgeGlow.setAttribute('stroke-width', '14');
      edgeGlow.setAttribute('stroke-linecap', 'round');

      const edgeCore = document.createElementNS(svgNs, 'path');
      edgeCore.setAttribute('d', d);
      edgeCore.setAttribute('fill', 'none');
      edgeCore.setAttribute(
        'stroke',
        isCompletedEdge
          ? '#3be082'
          : isFrontierEdge
            ? '#ffd166'
            : '#475569',
      );
      edgeCore.setAttribute('stroke-width', '5');
      edgeCore.setAttribute('stroke-linecap', 'round');
      if (pathIdTo > highestUnlockedPath) {
        edgeCore.setAttribute('stroke-dasharray', '9 9');
      }

      segments.push(edgeGlow, edgeCore);
    }
    this.campaignTrailSvg.replaceChildren(...segments);

    const nodes = coords.map((pt, idx) => {
      const pathConfig = getPathConfig(idx + 1);
      return this.createTrailNode(
        pathConfig,
        pt.xPct,
        pt.yPx,
        highestUnlockedPath,
        pathStars[pathConfig.pathId] ?? 0,
      );
    });
    this.campaignNodesLayer.replaceChildren(...nodes);
  }

  private createTrailNode(
    pathConfig: PathConfig,
    xPct: number,
    yPx: number,
    highestUnlockedPath: number,
    stars: number,
  ): HTMLElement {
    const id = pathConfig.pathId;
    const isCompleted = id < highestUnlockedPath;
    const isCurrent = id === highestUnlockedPath;
    const isLocked = id > highestUnlockedPath;

    const wrap = document.createElement('div');
    wrap.className = 'campaign-trail-node-wrap';
    wrap.setAttribute('role', 'listitem');
    wrap.style.left = `${xPct}%`;
    wrap.style.top = `${yPx}px`;

    if (isCurrent) {
      const playPill = document.createElement('button');
      playPill.type = 'button';
      playPill.className = 'trail-play-pill';
      playPill.textContent = 'PLAY';
      playPill.addEventListener('click', (event) => {
        event.stopPropagation();
        this.switchTo('battle', id);
      });
      wrap.appendChild(playPill);
    }

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'campaign-trail-node';
    btn.disabled = isLocked;
    btn.title = isLocked
      ? `Path ${id}: Clear Path ${id - 1} to unlock`
      : `Path ${id}: ${pathConfig.name} (${pathConfig.totalWaves} Waves)`;

    if (isCompleted) {
      btn.classList.add('campaign-trail-node--completed');
    } else if (isCurrent) {
      btn.classList.add('campaign-trail-node--current');
    } else {
      btn.classList.add('campaign-trail-node--locked');
    }
    if (pathConfig.isBossPath) {
      btn.classList.add('campaign-trail-node--boss');
    }
    if (id === this.selectedPathId) {
      btn.classList.add('is-selected');
    }

    if (isLocked) {
      btn.appendChild(this.createLockIconSvg());
    } else if (pathConfig.isBossPath) {
      btn.appendChild(this.createBossCrownSvg());
    }

    const numSpan = document.createElement('span');
    numSpan.className = 'trail-node-num';
    numSpan.textContent = String(id);
    btn.appendChild(numSpan);

    if (!isLocked) {
      btn.addEventListener('click', () => {
        if (this.selectedPathId === id) {
          this.switchTo('battle', id);
          return;
        }
        this.selectedPathId = id;
        this.renderProfile();
      });
    }

    wrap.appendChild(btn);

    if (isCompleted) {
      const starsRow = document.createElement('div');
      starsRow.className = 'trail-node-stars';
      for (let i = 0; i < 3; i++) {
        const s = document.createElement('span');
        s.className = i < stars ? 'is-earned' : '';
        s.textContent = i < stars ? '★' : '☆';
        starsRow.appendChild(s);
      }
      wrap.appendChild(starsRow);
    } else if (pathConfig.isBossPath) {
      const waveBadge = document.createElement('span');
      waveBadge.className = 'trail-node-boss-waves';
      waveBadge.textContent = `${pathConfig.totalWaves}W BOSS`;
      wrap.appendChild(waveBadge);
    } else {
      const label = document.createElement('span');
      label.className = 'trail-node-label';
      label.textContent = `Path ${id}`;
      wrap.appendChild(label);
    }

    return wrap;
  }

  private renderPreviewCard(
    pathConfig: PathConfig,
    highestUnlockedPath: number,
    stars: number,
  ): void {
    const isLocked = pathConfig.pathId > highestUnlockedPath;
    this.previewPathTagEl.textContent = pathConfig.isBossPath
      ? `PATH ${pathConfig.pathId} • BOSS STAGE`
      : `PATH ${pathConfig.pathId}`;
    this.previewBossBannerEl.classList.toggle(
      'is-hidden',
      !pathConfig.isBossPath,
    );
    this.previewPathNameEl.textContent = pathConfig.name;
    this.previewThemeNameEl.textContent = pathConfig.mapLayout.name;
    this.previewTotalWavesEl.textContent = `${pathConfig.totalWaves} Waves`;
    this.previewCrystalRewardEl.textContent = `+${pathConfig.crystalReward} 💎`;
    this.previewEarnedStarsEl.textContent = isLocked
      ? 'LOCKED'
      : '★'.repeat(stars) + '☆'.repeat(Math.max(0, 3 - stars));
    this.startBattleBtn.disabled = isLocked;
    this.previewMinimapEl.replaceChildren(
      this.createPathMinimapSvg(pathConfig, isLocked),
    );
  }

  private createLockIconSvg(): SVGSVGElement {
    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'trail-node-icon');
    svg.setAttribute('aria-hidden', 'true');

    const shackle = document.createElementNS(svgNs, 'path');
    shackle.setAttribute('d', 'M7 11V8a5 5 0 0 1 10 0v3');
    shackle.setAttribute('fill', 'none');
    shackle.setAttribute('stroke', '#94a3b8');
    shackle.setAttribute('stroke-width', '2.2');
    shackle.setAttribute('stroke-linecap', 'round');

    const body = document.createElementNS(svgNs, 'rect');
    body.setAttribute('x', '5');
    body.setAttribute('y', '11');
    body.setAttribute('width', '14');
    body.setAttribute('height', '10');
    body.setAttribute('rx', '2.5');
    body.setAttribute('fill', '#64748b');

    svg.append(shackle, body);
    return svg;
  }

  private createBossCrownSvg(): SVGSVGElement {
    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'trail-node-crown');
    svg.setAttribute('aria-hidden', 'true');

    const crown = document.createElementNS(svgNs, 'path');
    crown.setAttribute('d', 'M3 18L5 8l5 4 2-6 2 6 5-4 2 10H3z');
    crown.setAttribute('fill', '#ffd166');
    crown.setAttribute('stroke', '#7b241c');
    crown.setAttribute('stroke-width', '1.6');
    crown.setAttribute('stroke-linejoin', 'round');

    svg.appendChild(crown);
    return svg;
  }

  private createPathMinimapSvg(
    pathConfig: PathConfig,
    isLocked: boolean,
  ): SVGSVGElement {
    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('viewBox', '0 0 100 84');
    svg.setAttribute('class', 'path-minimap-svg');
    svg.setAttribute('aria-hidden', 'true');

    const { theme, waypoints } = pathConfig.mapLayout;
    const toHex = (color: number): string =>
      `#${color.toString(16).padStart(6, '0')}`;

    const diamond = document.createElementNS(svgNs, 'polygon');
    diamond.setAttribute('points', '50,15 92,41 50,67 8,41');
    diamond.setAttribute(
      'fill',
      isLocked ? 'rgba(30, 41, 59, 0.5)' : toHex(theme.grassSecondary),
    );
    diamond.setAttribute('fill-opacity', isLocked ? '1' : '0.42');
    diamond.setAttribute(
      'stroke',
      pathConfig.isBossPath ? '#e74c3c' : toHex(theme.grassPrimary),
    );
    diamond.setAttribute('stroke-width', '1.6');
    svg.appendChild(diamond);

    const pts = waypoints.map((wp) => ({
      x: 50 + (wp.gx - wp.gy) * 4.4,
      y: 21 + (wp.gx + wp.gy) * 2.25,
    }));

    const polyline = document.createElementNS(svgNs, 'polyline');
    polyline.setAttribute(
      'points',
      pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),
    );
    polyline.setAttribute('fill', 'none');
    polyline.setAttribute(
      'stroke',
      isLocked
        ? '#64748b'
        : pathConfig.isBossPath
          ? '#ff7675'
          : '#ffd166',
    );
    polyline.setAttribute('stroke-width', '4.2');
    polyline.setAttribute('stroke-linecap', 'round');
    polyline.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(polyline);

    const start = pts[0];
    const end = pts[pts.length - 1];
    if (start) {
      const startDot = document.createElementNS(svgNs, 'circle');
      startDot.setAttribute('cx', start.x.toFixed(1));
      startDot.setAttribute('cy', start.y.toFixed(1));
      startDot.setAttribute('r', '3.4');
      startDot.setAttribute('fill', '#2ecc71');
      svg.appendChild(startDot);
    }
    if (end) {
      const endDot = document.createElementNS(svgNs, 'circle');
      endDot.setAttribute('cx', end.x.toFixed(1));
      endDot.setAttribute('cy', end.y.toFixed(1));
      endDot.setAttribute('r', '3.4');
      endDot.setAttribute('fill', '#e74c3c');
      svg.appendChild(endDot);
    }

    return svg;
  }
}
