import {
  Application,
  Container,
  FederatedPointerEvent,
  Ticker,
} from 'pixi.js';
import {
  BG_COLOR,
  DRAG_THRESHOLD_PX,
  GRID_SIZE,
  MAX_ZOOM,
  MIN_ZOOM,
  PATH_SINK_OFFSET,
  TILE_DEPTH,
  TILE_HEIGHT,
  TILE_WIDTH,
  ZOOM_FACTOR,
} from './config/constants';
import { getPathConfig } from './config/maps';
import { EventBus } from './core/EventBus';
import { GameState } from './core/GameState';
import { gridToScreen } from './core/IsoMath';
import { ProfileManager } from './core/PlayerProfile';
import type { Enemy } from './entities/Enemy';
import { SpriteManager } from './graphics/SpriteManager';
import { CombatSystem } from './systems/CombatSystem';
import { FloatingTextSystem } from './systems/FloatingTextSystem';
import { GridSystem } from './systems/GridSystem';
import { ParticleSystem } from './systems/ParticleSystem';
import { PerkSystem } from './systems/PerkSystem';
import { ScreenShakeSystem } from './systems/ScreenShakeSystem';
import { SkillSystem } from './systems/SkillSystem';
import { SoundSystem } from './systems/SoundSystem';
import { WaveSystem } from './systems/WaveSystem';
import { HudController } from './ui/HudController';
import { ScreenManager } from './ui/ScreenManager';

async function bootstrap(): Promise<void> {
  const containerEl = document.getElementById('game-container');
  if (!containerEl) {
    throw new Error('Missing #game-container element');
  }

  const app = new Application();
  await app.init({
    resizeTo: window,
    backgroundColor: BG_COLOR,
    antialias: true,
  });

  await SpriteManager.preloadAll();

  containerEl.appendChild(app.canvas);
  app.canvas.style.touchAction = 'none';

  const worldContainer = new Container();
  const tileLayer = new Container();
  const highlightLayer = new Container();
  const entityLayer = new Container();
  entityLayer.sortableChildren = true;
  const fxLayer = new Container();
  fxLayer.eventMode = 'none';

  worldContainer.addChild(tileLayer, highlightLayer, entityLayer, fxLayer);
  app.stage.addChild(worldContainer);

  const boardWidth = GRID_SIZE * TILE_WIDTH + 48;
  const fitZoom = Math.min(1, Math.max(MIN_ZOOM, app.screen.width / boardWidth));
  let currentZoom = fitZoom;
  worldContainer.scale.set(currentZoom);

  worldContainer.x = Math.round(app.screen.width / 2);
  worldContainer.y = Math.round(
    app.screen.height / 2 -
      (((GRID_SIZE - 1) * TILE_HEIGHT + TILE_DEPTH) * currentZoom) / 2,
  );

  let isPointerDown = false;
  let isDragging = false;
  let gestureHadMultiTouch = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let worldStartX = 0;
  let worldStartY = 0;
  let prevPinchDist = 0;
  let prevPinchMidX = 0;
  let prevPinchMidY = 0;
  let prevScreenWidth = app.screen.width;
  let prevScreenHeight = app.screen.height;
  let pointerCanvasX: number | null = null;
  let pointerCanvasY: number | null = null;
  const activePointers = new Map<number, { x: number; y: number }>();

  const eventBus = new EventBus();
  const profileManager = new ProfileManager(eventBus);
  const gameState = new GameState(eventBus);
  const soundSystem = new SoundSystem();
  soundSystem.setVolume(gameState.getSfxVolume());
  const particleSystem = new ParticleSystem(fxLayer, gameState);
  const floatingTextSystem = new FloatingTextSystem(fxLayer);
  const perkSystem = new PerkSystem(gameState, eventBus);
  let runEnemiesKilled = 0;
  let runGoldEarned = 0;

  eventBus.on('particlesEnabledChanged', (enabled) => {
    if (!enabled) {
      particleSystem.clear();
    }
  });

  window.addEventListener(
    'pointerdown',
    () => {
      soundSystem.unlock();
    },
    { capture: true, passive: true },
  );

  const gridSystem = new GridSystem(
    tileLayer,
    highlightLayer,
    entityLayer,
    gameState,
    soundSystem,
    eventBus,
    particleSystem,
    floatingTextSystem,
    profileManager,
  );
  gridSystem.loadMap(getPathConfig(1).mapLayout);

  const waveSystem = new WaveSystem(
    entityLayer,
    gameState,
    eventBus,
    perkSystem,
    floatingTextSystem,
    particleSystem,
  );
  const screenShakeSystem = new ScreenShakeSystem(worldContainer, gameState);
  const combatSystem = new CombatSystem(
    entityLayer,
    gameState,
    soundSystem,
    eventBus,
    particleSystem,
    screenShakeSystem,
    perkSystem,
    floatingTextSystem,
  );
  const skillSystem = new SkillSystem(
    highlightLayer,
    fxLayer,
    gameState,
    soundSystem,
    eventBus,
    particleSystem,
    screenShakeSystem,
    perkSystem,
  );

  let prevLives = gameState.getLives();
  eventBus.on('livesChanged', (lives) => {
    if (lives < prevLives) {
      screenShakeSystem.shake(4, 0.18);
    }
    prevLives = lives;
  });

  const applyZoomAt = (
    targetZoom: number,
    focalX: number,
    focalY: number,
    updateHoverAtPoint = true,
  ): void => {
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, targetZoom));
    if (Math.abs(nextZoom - currentZoom) < 0.0001) {
      return;
    }

    screenShakeSystem.revertOffset();
    const worldX = (focalX - worldContainer.x) / currentZoom;
    const worldY = (focalY - worldContainer.y) / currentZoom;

    currentZoom = nextZoom;
    worldContainer.scale.set(currentZoom);
    worldContainer.x = Math.round(focalX - worldX * currentZoom);
    worldContainer.y = Math.round(focalY - worldY * currentZoom);

    if (updateHoverAtPoint) {
      if (skillSystem.isTargeting()) {
        skillSystem.updateTargetingPreview(
          focalX,
          focalY,
          worldContainer.x,
          worldContainer.y,
          currentZoom,
        );
      } else {
        gridSystem.updateHover(
          focalX,
          focalY,
          worldContainer.x,
          worldContainer.y,
          currentZoom,
        );
      }
    }
  };

  let screenManager: ScreenManager;

  const resetBattleState = (
    pathId = gameState.getCurrentPathId(),
  ): void => {
    runEnemiesKilled = 0;
    runGoldEarned = 0;
    combatSystem.clear();
    particleSystem.clear();
    floatingTextSystem.clear();
    perkSystem.reset();
    skillSystem.clear();
    screenShakeSystem.clear();
    waveSystem.clear();
    gridSystem.clearUnits();
    hudController.clearFlyingGold();
    const pathConfig = getPathConfig(pathId);
    app.renderer.background.color = pathConfig.mapLayout.theme.backgroundColor;
    gridSystem.loadMap(pathConfig.mapLayout);
    waveSystem.setPath(pathConfig);
    gameState.setPathConfig(pathConfig);
    hudController.updateEnemyTooltip(null, 0, 0);
  };

  const hudController = new HudController(
    gameState,
    eventBus,
    profileManager,
    {
      onStartWave: () => {
        waveSystem.startWave();
      },
      onRestart: () => {
        resetBattleState(gameState.getCurrentPathId());
      },
      onNextPath: () => {
        screenManager.switchTo('battle', gameState.getCurrentPathId() + 1);
      },
      onOpenBarracks: () => {
        screenManager.switchTo('barracks');
      },
      onReturnToMap: () => {
        screenManager.switchTo('campaign');
      },
      onResetProfile: () => {
        profileManager.resetProfile();
      },
      isBattleScreenActive: () => screenManager.getCurrentScreen() === 'battle',
      onToggleMute: () => soundSystem.toggleMute(),
      onSetVolume: (volume) => {
        soundSystem.setVolume(volume);
      },
      onUpgradeUnit: () => {
        gridSystem.upgradeInspectedUnit();
      },
      onSellUnit: () => {
        gridSystem.sellInspectedUnit();
      },
      onSelectTargeting: (strategy) => {
        gridSystem.setInspectedTargetingStrategy(strategy);
      },
      onCloseInspector: () => {
        gridSystem.inspectUnit(null);
      },
      onZoomIn: () => {
        applyZoomAt(
          currentZoom * ZOOM_FACTOR,
          app.screen.width / 2,
          app.screen.height / 2,
          false,
        );
      },
      onZoomOut: () => {
        applyZoomAt(
          currentZoom / ZOOM_FACTOR,
          app.screen.width / 2,
          app.screen.height / 2,
          false,
        );
      },
      onUseSkill: (skillId) => {
        skillSystem.activateSkill(skillId, waveSystem.getEnemies());
      },
      onCancelSkillTargeting: () => {
        skillSystem.cancelTargeting();
      },
      onSelectPerk: (perkId) => {
        if (perkSystem.applyPerk(perkId)) {
          soundSystem.playUpgrade();
        }
        gameState.setPaused(false);
      },
      onUpgradeUnitMeta: (unitId, stat) => {
        const ok = profileManager.upgradeUnitStat(unitId, stat);
        if (ok) {
          soundSystem.playUpgrade();
        }
        return ok;
      },
    },
  );

  screenManager = new ScreenManager(eventBus, profileManager, {
    onEnterBattle: (pathId) => {
      resetBattleState(pathId);
    },
    onExitBattle: () => {
      resetBattleState(gameState.getCurrentPathId());
    },
  });

  eventBus.on('pathCompleted', (pathId) => {
    if (
      screenManager.getCurrentScreen() !== 'battle' ||
      gameState.getLives() <= 0
    ) {
      return;
    }
    const pathConfig = getPathConfig(pathId);
    const lives = gameState.getLives();
    const stars = lives >= 8 ? 3 : lives >= 4 ? 2 : 1;
    const starBonus =
      stars === 3
        ? Math.round(pathConfig.crystalReward * 0.3)
        : stars === 2
          ? Math.round(pathConfig.crystalReward * 0.15)
          : 0;
    const crystalsEarned = pathConfig.crystalReward + starBonus;
    const xpEarned = pathConfig.xpReward + stars * 25;
    profileManager.addBattleTotals(runEnemiesKilled, runGoldEarned);
    profileManager.recordPathCompletion(pathId, stars, crystalsEarned, xpEarned);
    soundSystem.playVictory();
    eventBus.emit('pathVictory', {
      pathId,
      pathName: pathConfig.name,
      totalWaves: pathConfig.totalWaves,
      stars,
      crystalsEarned,
      xpEarned,
      nextPathId: pathId + 1,
    });
  });

  eventBus.on('gameOverChanged', (isGameOver) => {
    if (!isGameOver || screenManager.getCurrentScreen() !== 'battle') {
      return;
    }
    const wave = gameState.getWave();
    const crystalsEarned = Math.floor(wave * 8 + runEnemiesKilled * 0.5);
    const xpEarned = Math.floor(wave * 20 + runEnemiesKilled * 2);
    profileManager.addBattleTotals(runEnemiesKilled, runGoldEarned);
    profileManager.recordDefeatReward(crystalsEarned, xpEarned);
    eventBus.emit('defeatRewardEarned', { crystalsEarned, xpEarned });
  });

  const updateEnemyHoverTooltip = (): void => {
    if (
      pointerCanvasX === null ||
      pointerCanvasY === null ||
      isDragging ||
      activePointers.size >= 2
    ) {
      hudController.updateEnemyTooltip(null, 0, 0);
      return;
    }

    let closestEnemy: Enemy | null = null;
    let closestDist = Infinity;

    for (const enemy of waveSystem.getEnemies()) {
      if (enemy.isDead || enemy.isDying || enemy.reachedGoal) {
        continue;
      }

      const iso = gridToScreen(enemy.gx, enemy.gy);
      const enemyScreenX = worldContainer.x + iso.x * currentZoom;
      const enemyScreenY =
        worldContainer.y +
        (iso.y + PATH_SINK_OFFSET - enemy.radius * 1.1) * currentZoom;
      const dist = Math.hypot(
        pointerCanvasX - enemyScreenX,
        pointerCanvasY - enemyScreenY,
      );
      const hitRadius = Math.max(22, (enemy.radius + 12) * currentZoom);

      if (dist <= hitRadius && dist < closestDist) {
        closestDist = dist;
        closestEnemy = enemy;
      }
    }

    if (!closestEnemy) {
      hudController.updateEnemyTooltip(null, 0, 0);
      return;
    }

    const rect = app.canvas.getBoundingClientRect();
    hudController.updateEnemyTooltip(
      closestEnemy,
      rect.left + pointerCanvasX,
      rect.top + pointerCanvasY,
    );
  };

  app.ticker.add((ticker: Ticker) => {
    if (screenManager.getCurrentScreen() !== 'battle') {
      return;
    }
    const hudDt = gameState.isPaused() ? 0 : ticker.deltaMS / 1000;
    const gameSpeed = gameState.getGameSpeed();
    const scaledDt = hudDt * gameSpeed;
    const freezeSprites =
      gameState.isPaused() ||
      gameState.isGameOver() ||
      gameState.isPathVictory();
    const pauseMenuOnly = gameState.isPaused() && !gameState.isPathVictory();
    for (const unit of gridSystem.getUnits()) {
      unit.syncPlayback(freezeSprites, gameSpeed);
    }
    for (const enemy of waveSystem.getEnemies()) {
      enemy.syncPlayback(
        enemy.isDying ? pauseMenuOnly : freezeSprites,
        gameSpeed,
      );
    }
    gridSystem.updateEnvironment(scaledDt);
    waveSystem.update(scaledDt, gridSystem.getUnits());
    combatSystem.update(
      scaledDt,
      gridSystem.getUnits(),
      waveSystem.getEnemies(),
    );
    skillSystem.update(scaledDt, waveSystem.getEnemies());
    particleSystem.update(scaledDt);
    floatingTextSystem.update(scaledDt);
    hudController.updateFlyingCoins(hudDt);
    screenShakeSystem.revertOffset();
    updateEnemyHoverTooltip();
    screenShakeSystem.update(hudDt);
  });

  eventBus.on('skillStateChanged', (state) => {
    if (state.targetingSkill !== null) {
      gridSystem.clearHover();
      if (!isDragging) {
        app.canvas.style.cursor = 'crosshair';
      }
      if (pointerCanvasX !== null && pointerCanvasY !== null) {
        screenShakeSystem.revertOffset();
        skillSystem.updateTargetingPreview(
          pointerCanvasX,
          pointerCanvasY,
          worldContainer.x,
          worldContainer.y,
          currentZoom,
        );
      }
    } else if (!isDragging) {
      app.canvas.style.cursor = 'default';
      if (pointerCanvasX !== null && pointerCanvasY !== null) {
        screenShakeSystem.revertOffset();
        gridSystem.updateHover(
          pointerCanvasX,
          pointerCanvasY,
          worldContainer.x,
          worldContainer.y,
          currentZoom,
        );
      }
    }
  });

  eventBus.on('enemyKilled', ({ worldX, worldY, rewardGold }) => {
    runEnemiesKilled += 1;
    runGoldEarned += rewardGold;
    const rect = app.canvas.getBoundingClientRect();
    const screenX = rect.left + worldContainer.x + worldX * currentZoom;
    const screenY = rect.top + worldContainer.y + worldY * currentZoom;
    hudController.spawnFlyingGold(screenX, screenY, rewardGold);
  });

  eventBus.on('unitSelected', () => {
    gridSystem.refreshHover();
  });
  eventBus.on('goldChanged', () => {
    gridSystem.refreshHover();
  });

  app.stage.eventMode = 'static';
  app.stage.hitArea = app.screen;

  const getTwoPointers = ():
    | [{ x: number; y: number }, { x: number; y: number }]
    | null => {
    if (activePointers.size < 2) {
      return null;
    }
    const iter = activePointers.values();
    const p1 = iter.next().value;
    const p2 = iter.next().value;
    return p1 && p2 ? [p1, p2] : null;
  };

  app.stage.on('pointerdown', (event: FederatedPointerEvent) => {
    if (
      event.pointerType !== 'touch' &&
      event.button === 2 &&
      skillSystem.isTargeting()
    ) {
      skillSystem.cancelTargeting();
      return;
    }

    activePointers.set(event.pointerId, {
      x: event.global.x,
      y: event.global.y,
    });

    if (activePointers.size === 1) {
      screenShakeSystem.revertOffset();
      gestureHadMultiTouch = false;
      isPointerDown = true;
      isDragging = false;
      dragStartX = event.global.x;
      dragStartY = event.global.y;
      worldStartX = worldContainer.x;
      worldStartY = worldContainer.y;
    } else {
      const pair = getTwoPointers();
      if (pair) {
        gestureHadMultiTouch = true;
        isDragging = true;
        const [p1, p2] = pair;
        prevPinchDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        prevPinchMidX = (p1.x + p2.x) / 2;
        prevPinchMidY = (p1.y + p2.y) / 2;
        gridSystem.clearHover();
      }
    }
  });

  app.stage.on('pointermove', (event: FederatedPointerEvent) => {
    if (activePointers.has(event.pointerId)) {
      activePointers.set(event.pointerId, {
        x: event.global.x,
        y: event.global.y,
      });
    }

    if (activePointers.size >= 2) {
      screenShakeSystem.revertOffset();
      const pair = getTwoPointers();
      if (pair) {
        const [p1, p2] = pair;
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);

        worldContainer.x = Math.round(
          worldContainer.x + (midX - prevPinchMidX),
        );
        worldContainer.y = Math.round(
          worldContainer.y + (midY - prevPinchMidY),
        );

        if (prevPinchDist > 8 && dist > 8) {
          applyZoomAt(currentZoom * (dist / prevPinchDist), midX, midY, false);
        }

        prevPinchDist = dist;
        prevPinchMidX = midX;
        prevPinchMidY = midY;
      }
      return;
    }

    if (isPointerDown) {
      const dx = event.global.x - dragStartX;
      const dy = event.global.y - dragStartY;
      const threshold =
        event.pointerType === 'touch' ? 10 : DRAG_THRESHOLD_PX;

      if (!isDragging && Math.hypot(dx, dy) > threshold) {
        isDragging = true;
        app.canvas.style.cursor = 'grabbing';
      }

      if (isDragging) {
        screenShakeSystem.revertOffset();
        worldContainer.x = Math.round(worldStartX + dx);
        worldContainer.y = Math.round(worldStartY + dy);
      }
    }

    if (event.pointerType !== 'touch') {
      screenShakeSystem.revertOffset();
      pointerCanvasX = event.global.x;
      pointerCanvasY = event.global.y;
      if (skillSystem.isTargeting()) {
        skillSystem.updateTargetingPreview(
          event.global.x,
          event.global.y,
          worldContainer.x,
          worldContainer.y,
          currentZoom,
        );
      } else {
        gridSystem.updateHover(
          event.global.x,
          event.global.y,
          worldContainer.x,
          worldContainer.y,
          currentZoom,
        );
      }
      updateEnemyHoverTooltip();
    }
  });

  const handlePointerRelease = (
    event: FederatedPointerEvent,
    allowTap: boolean,
  ): void => {
    activePointers.delete(event.pointerId);

    if (activePointers.size === 1) {
      screenShakeSystem.revertOffset();
      const remaining = activePointers.values().next().value;
      if (remaining) {
        dragStartX = remaining.x;
        dragStartY = remaining.y;
        worldStartX = worldContainer.x;
        worldStartY = worldContainer.y;
      }
      return;
    }

    if (activePointers.size === 0) {
      const shouldTap =
        allowTap &&
        !isDragging &&
        !gestureHadMultiTouch &&
        (event.pointerType === 'touch' || event.button === 0);
      isPointerDown = false;
      isDragging = false;
      gestureHadMultiTouch = false;
      app.canvas.style.cursor = skillSystem.isTargeting()
        ? 'crosshair'
        : 'default';

      if (shouldTap) {
        screenShakeSystem.revertOffset();
        if (skillSystem.isTargeting()) {
          skillSystem.tryCastAtScreenPos(
            event.global.x,
            event.global.y,
            worldContainer.x,
            worldContainer.y,
            currentZoom,
          );
        } else {
          gridSystem.handleTileClick(
            event.global.x,
            event.global.y,
            worldContainer.x,
            worldContainer.y,
            currentZoom,
          );
        }
      }
    }
  };

  app.stage.on('pointerup', (event: FederatedPointerEvent) => {
    handlePointerRelease(event, true);
  });
  app.stage.on('pointerupoutside', (event: FederatedPointerEvent) => {
    handlePointerRelease(event, false);
  });
  app.stage.on('pointercancel', (event: FederatedPointerEvent) => {
    handlePointerRelease(event, false);
  });
  const clearCanvasHover = (): void => {
    activePointers.clear();
    isPointerDown = false;
    isDragging = false;
    gestureHadMultiTouch = false;
    pointerCanvasX = null;
    pointerCanvasY = null;
    app.canvas.style.cursor = skillSystem.isTargeting()
      ? 'crosshair'
      : 'default';
    gridSystem.clearHover();
    skillSystem.hideTargetingPreview();
    hudController.updateEnemyTooltip(null, 0, 0);
  };

  app.stage.on('pointerleave', (event: FederatedPointerEvent) => {
    if (event.pointerType !== 'touch') {
      clearCanvasHover();
    }
  });

  app.canvas.addEventListener('pointerleave', () => {
    pointerCanvasX = null;
    pointerCanvasY = null;
    skillSystem.hideTargetingPreview();
    hudController.updateEnemyTooltip(null, 0, 0);
  });

  app.canvas.addEventListener('contextmenu', (event: MouseEvent) => {
    event.preventDefault();
    if (skillSystem.isTargeting()) {
      skillSystem.cancelTargeting();
    }
  });

  app.canvas.addEventListener(
    'wheel',
    (event: WheelEvent) => {
      event.preventDefault();
      if (event.deltaY === 0) {
        return;
      }

      const rect = app.canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      const nextZoom =
        event.deltaY < 0
          ? currentZoom * ZOOM_FACTOR
          : currentZoom / ZOOM_FACTOR;

      applyZoomAt(nextZoom, mouseX, mouseY, true);
    },
    { passive: false },
  );

  window.addEventListener('resize', () => {
    screenShakeSystem.revertOffset();
    app.resize();
    const deltaX = app.screen.width - prevScreenWidth;
    const deltaY = app.screen.height - prevScreenHeight;
    prevScreenWidth = app.screen.width;
    prevScreenHeight = app.screen.height;

    worldContainer.x = Math.round(worldContainer.x + deltaX / 2);
    worldContainer.y = Math.round(worldContainer.y + deltaY / 2);
    app.stage.hitArea = app.screen;
    app.render();
  });
}

void bootstrap();
