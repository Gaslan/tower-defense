import { Container, Graphics } from 'pixi.js';
import {
  GRID_SIZE,
  HOVER_BLOCKED_FILL,
  HOVER_BLOCKED_STROKE,
  HOVER_BUILDABLE_FILL,
  HOVER_BUILDABLE_STROKE,
  HOVER_UNAFFORDABLE_FILL,
  HOVER_UNAFFORDABLE_STROKE,
  PATH_SINK_OFFSET,
  TILE_HEIGHT,
  TILE_PATH,
  TILE_WIDTH,
  type TileType,
} from '../config/constants';
import { getPathConfig, type MapLayout } from '../config/maps';
import { EventBus } from '../core/EventBus';
import { GameState } from '../core/GameState';
import {
  gridDistance,
  gridToScreen,
  isValidGridCoord,
  screenToGrid,
} from '../core/IsoMath';
import type { ProfileManager } from '../core/PlayerProfile';
import { HumanUnit, type TargetingStrategy } from '../entities/HumanUnit';
import {
  createIsoTileGraphic,
  createPathLandmarks,
  createPropEntity,
  type AnimatedEnvironmentProp,
} from '../graphics/EnvironmentVisuals';
import { FloatingTextSystem } from './FloatingTextSystem';
import { ParticleSystem } from './ParticleSystem';
import { SoundSystem } from './SoundSystem';

const HALF_W = TILE_WIDTH / 2;
const HALF_H = TILE_HEIGHT / 2;
const DIAMOND_POINTS = [0, -HALF_H, HALF_W, 0, 0, HALF_H, -HALF_W, 0];

export class GridSystem {
  private readonly tileLayer: Container;
  private readonly highlightLayer: Container;
  private readonly entityLayer: Container;
  private readonly gameState: GameState;
  private readonly soundSystem: SoundSystem;
  private readonly eventBus: EventBus;
  private readonly particleSystem: ParticleSystem;
  private readonly floatingTextSystem: FloatingTextSystem;
  private readonly profileManager: ProfileManager;
  private readonly inspectRangeGraphic: Graphics;
  private readonly rangeGraphic: Graphics;
  private readonly hoverGraphic: Graphics;
  private readonly units: HumanUnit[] = [];
  private readonly envProps: AnimatedEnvironmentProp[] = [];
  private landmarkGatehouse: Container | null = null;
  private currentMapLayout: readonly (readonly TileType[])[] =
    getPathConfig(1).mapLayout.tileGrid;
  private envTimer = 0;
  private inspectedUnit: HumanUnit | null = null;
  private lastHoverGx: number | null = null;
  private lastHoverGy: number | null = null;

  constructor(
    tileLayer: Container,
    highlightLayer: Container,
    entityLayer: Container,
    gameState: GameState,
    soundSystem: SoundSystem,
    eventBus: EventBus,
    particleSystem: ParticleSystem,
    floatingTextSystem: FloatingTextSystem,
    profileManager: ProfileManager,
  ) {
    this.tileLayer = tileLayer;
    this.highlightLayer = highlightLayer;
    this.entityLayer = entityLayer;
    this.gameState = gameState;
    this.soundSystem = soundSystem;
    this.eventBus = eventBus;
    this.particleSystem = particleSystem;
    this.floatingTextSystem = floatingTextSystem;
    this.profileManager = profileManager;

    this.inspectRangeGraphic = new Graphics();
    this.inspectRangeGraphic.visible = false;
    this.inspectRangeGraphic.eventMode = 'none';

    this.rangeGraphic = new Graphics();
    this.rangeGraphic.visible = false;
    this.rangeGraphic.eventMode = 'none';

    this.hoverGraphic = new Graphics();
    this.hoverGraphic.visible = false;
    this.hoverGraphic.eventMode = 'none';

    this.highlightLayer.addChild(
      this.inspectRangeGraphic,
      this.rangeGraphic,
      this.hoverGraphic,
    );
  }

  public getUnits(): readonly HumanUnit[] {
    return this.units;
  }

  public getUnitAt(gx: number, gy: number): HumanUnit | null {
    return this.units.find((unit) => unit.gx === gx && unit.gy === gy) ?? null;
  }

  public getInspectedUnit(): HumanUnit | null {
    return this.inspectedUnit;
  }

  public inspectUnit(unit: HumanUnit | null): void {
    this.inspectedUnit = unit;
    if (unit && unit.range > 0) {
      this.drawRangeEllipse(
        this.inspectRangeGraphic,
        unit.gx,
        unit.gy,
        unit.range,
        unit.config.attackType === 'support' ? 0xf39c12 : 0xf1c40f,
        0.1,
        0.8,
      );
      this.inspectRangeGraphic.visible = true;
    } else {
      this.inspectRangeGraphic.visible = false;
    }
    this.eventBus.emit('unitInspected', this.inspectedUnit);
  }

  public upgradeInspectedUnit(): boolean {
    const unit = this.inspectedUnit;
    if (
      !unit ||
      !unit.canUpgrade ||
      this.gameState.isGameOver() ||
      this.gameState.isPathVictory()
    ) {
      return false;
    }

    const cost = unit.upgradeCost;
    if (!this.gameState.spendGold(cost)) {
      return false;
    }

    unit.upgrade();
    this.recomputeAuras();
    const pos = gridToScreen(unit.gx, unit.gy);
    this.particleSystem.spawnUpgradeBurst(pos.x, pos.y - 12);
    this.soundSystem.playUpgrade();
    this.inspectUnit(unit);
    this.eventBus.emit('unitUpdated', unit);
    return true;
  }

  public recomputeAuras(): void {
    const bannermen = this.units.filter(
      (u) => !u.isDestroyed && u.config.attackType === 'support',
    );
    for (const unit of this.units) {
      if (!unit.canAttack) {
        unit.applyAuraBuff(0, 0, null);
        continue;
      }
      let bestProvider: HumanUnit | null = null;
      for (const b of bannermen) {
        if (gridDistance(unit, b) > b.range) {
          continue;
        }
        if (
          !bestProvider ||
          b.buffDamagePct > bestProvider.buffDamagePct ||
          (b.buffDamagePct === bestProvider.buffDamagePct &&
            b.buffFireRatePct > bestProvider.buffFireRatePct)
        ) {
          bestProvider = b;
        }
      }
      if (bestProvider) {
        unit.applyAuraBuff(
          bestProvider.buffDamagePct,
          bestProvider.buffFireRatePct,
          bestProvider,
        );
      } else {
        unit.applyAuraBuff(0, 0, null);
      }
    }
    if (this.inspectedUnit) {
      this.eventBus.emit('unitUpdated', this.inspectedUnit);
    }
  }

  public setInspectedTargetingStrategy(strategy: TargetingStrategy): void {
    if (
      !this.inspectedUnit ||
      this.gameState.isGameOver() ||
      this.gameState.isPathVictory()
    ) {
      return;
    }
    if (this.inspectedUnit.targetingStrategy === strategy) {
      return;
    }
    this.inspectedUnit.targetingStrategy = strategy;
    this.eventBus.emit('unitUpdated', this.inspectedUnit);
  }

  public sellInspectedUnit(): boolean {
    if (
      !this.inspectedUnit ||
      this.gameState.isGameOver() ||
      this.gameState.isPathVictory()
    ) {
      return false;
    }
    return this.sellUnit(this.inspectedUnit);
  }

  public sellUnit(unit: HumanUnit): boolean {
    const index = this.units.indexOf(unit);
    if (
      index === -1 ||
      this.gameState.isGameOver() ||
      this.gameState.isPathVictory()
    ) {
      return false;
    }

    const refund = unit.getSellValue();
    this.gameState.addGold(refund);
    this.gameState.setTileOccupied(unit.gx, unit.gy, false);

    const pos = gridToScreen(unit.gx, unit.gy);
    this.floatingTextSystem.spawnGold(pos.x, pos.y - 24, refund);
    this.particleSystem.spawnGoldSparkles(pos.x, pos.y - 14);
    this.soundSystem.playSellUnit();

    this.units.splice(index, 1);
    unit.destroy();
    this.recomputeAuras();

    if (this.inspectedUnit === unit) {
      this.inspectUnit(null);
    } else {
      this.inspectRangeGraphic.visible = false;
    }
    this.refreshHover();
    return true;
  }

  public clearUnits(): void {
    this.inspectUnit(null);
    for (const unit of this.units) {
      unit.destroy();
    }
    this.units.length = 0;
    this.refreshHover();
  }

  public loadMap(layout: MapLayout): void {
    this.clearUnits();
    this.clearEnvironment();
    this.currentMapLayout = layout.tileGrid;

    for (let gy = 0; gy < GRID_SIZE; gy++) {
      for (let gx = 0; gx < GRID_SIZE; gx++) {
        const isPath = layout.tileGrid[gy][gx] === TILE_PATH;
        const tile = createIsoTileGraphic(
          gx,
          gy,
          isPath,
          layout.theme,
          layout.id,
        );
        this.tileLayer.addChild(tile);
      }
    }

    for (const placement of layout.props) {
      const prop = createPropEntity(placement, layout.id);
      this.entityLayer.addChild(prop.container);
      this.envProps.push(prop);
    }

    const landmarks = createPathLandmarks(layout.waypoints);
    this.landmarkGatehouse = landmarks.gatehouse;
    this.entityLayer.addChild(landmarks.portal.container, landmarks.gatehouse);
    this.envProps.push(landmarks.portal);
    this.refreshHover();
  }

  private clearEnvironment(): void {
    const tiles = this.tileLayer.removeChildren();
    for (const tile of tiles) {
      tile.destroy({ children: true });
    }
    for (const prop of this.envProps) {
      prop.container.parent?.removeChild(prop.container);
      prop.container.destroy({ children: true });
    }
    this.envProps.length = 0;
    if (this.landmarkGatehouse) {
      this.landmarkGatehouse.parent?.removeChild(this.landmarkGatehouse);
      this.landmarkGatehouse.destroy({ children: true });
      this.landmarkGatehouse = null;
    }
  }

  public updateEnvironment(dt: number): void {
    if (dt <= 0) {
      return;
    }
    this.envTimer += dt;
    for (const prop of this.envProps) {
      if (!prop.animTarget) {
        continue;
      }
      const wave = Math.sin(this.envTimer * prop.speed + prop.phase);
      if (prop.mode === 'sway') {
        prop.animTarget.rotation = wave * prop.amplitude;
      } else if (prop.mode === 'pulse') {
        const scale = 1 + wave * prop.amplitude;
        prop.animTarget.scale.set(scale, scale);
      }
    }
  }

  public updateHover(
    screenX: number,
    screenY: number,
    worldOffsetX: number,
    worldOffsetY: number,
    worldScale = 1,
  ): void {
    const { gx, gy } = screenToGrid(
      screenX,
      screenY,
      worldOffsetX,
      worldOffsetY,
      worldScale,
    );

    if (!isValidGridCoord(gx, gy)) {
      this.clearHover();
      return;
    }

    if (gx === this.lastHoverGx && gy === this.lastHoverGy) {
      return;
    }

    this.lastHoverGx = gx;
    this.lastHoverGy = gy;
    this.renderHoverAt(gx, gy);
  }

  public refreshHover(): void {
    if (this.lastHoverGx === null || this.lastHoverGy === null) {
      return;
    }
    this.renderHoverAt(this.lastHoverGx, this.lastHoverGy);
  }

  public clearHover(): void {
    if (this.lastHoverGx === null && this.lastHoverGy === null) {
      return;
    }

    this.lastHoverGx = null;
    this.lastHoverGy = null;
    this.hoverGraphic.visible = false;
    this.rangeGraphic.visible = false;
  }

  public handleTileClick(
    screenX: number,
    screenY: number,
    worldOffsetX: number,
    worldOffsetY: number,
    worldScale = 1,
  ): boolean {
    if (this.gameState.isGameOver() || this.gameState.isPathVictory()) {
      return false;
    }

    const { gx, gy } = screenToGrid(
      screenX,
      screenY,
      worldOffsetX,
      worldOffsetY,
      worldScale,
    );

    const existingUnit = this.getUnitAt(gx, gy);
    if (existingUnit) {
      this.inspectUnit(existingUnit);
      return true;
    }

    if (this.inspectedUnit !== null) {
      this.inspectUnit(null);
      return false;
    }

    const unitConfig = this.gameState.getSelectedUnitConfig();
    if (!unitConfig || !this.gameState.isTileBuildable(gx, gy)) {
      return false;
    }

    if (!this.gameState.spendGold(unitConfig.cost)) {
      return false;
    }

    this.gameState.setTileOccupied(gx, gy, true);
    const effectiveStats = this.profileManager.getUnitEffectiveStats(
      unitConfig.id,
    );
    const unit = new HumanUnit(unitConfig, gx, gy, effectiveStats);
    this.entityLayer.addChild(unit.container);
    this.units.push(unit);
    this.recomputeAuras();
    this.soundSystem.playPlaceUnit();

    this.lastHoverGx = gx;
    this.lastHoverGy = gy;
    this.gameState.selectUnit(null);
    this.refreshHover();
    return true;
  }

  private renderHoverAt(gx: number, gy: number): void {
    const isPath = this.currentMapLayout[gy][gx] === TILE_PATH;
    const isBuildable = this.gameState.isTileBuildable(gx, gy);
    const selectedUnit = this.gameState.getSelectedUnitConfig();
    const canAfford =
      selectedUnit !== null && this.gameState.getGold() >= selectedUnit.cost;

    let fillColor = HOVER_BLOCKED_FILL;
    let strokeColor = HOVER_BLOCKED_STROKE;
    if (isBuildable) {
      if (selectedUnit === null || canAfford) {
        fillColor = HOVER_BUILDABLE_FILL;
        strokeColor = HOVER_BUILDABLE_STROKE;
      } else {
        fillColor = HOVER_UNAFFORDABLE_FILL;
        strokeColor = HOVER_UNAFFORDABLE_STROKE;
      }
    }

    this.hoverGraphic
      .clear()
      .poly(DIAMOND_POINTS)
      .fill({ color: fillColor, alpha: 0.28 })
      .stroke({ width: 2, color: strokeColor });

    const screenPos = gridToScreen(gx, gy);
    const yOffset = isPath ? PATH_SINK_OFFSET : 0;
    this.hoverGraphic.position.set(screenPos.x, screenPos.y + yOffset);
    this.hoverGraphic.visible = true;

    if (isBuildable && selectedUnit !== null && selectedUnit.range > 0) {
      const ringColor = canAfford ? selectedUnit.color : HOVER_BLOCKED_FILL;
      const effectiveRange = this.profileManager.getUnitEffectiveStats(
        selectedUnit.id,
      ).range;
      this.drawRangeEllipse(
        this.rangeGraphic,
        gx,
        gy,
        effectiveRange,
        ringColor,
        0.12,
        0.65,
      );
      this.rangeGraphic.visible = true;
    } else {
      this.rangeGraphic.visible = false;
    }
  }

  private drawRangeEllipse(
    graphic: Graphics,
    gx: number,
    gy: number,
    range: number,
    color: number,
    fillAlpha: number,
    strokeAlpha: number,
  ): void {
    const rx = range * (TILE_WIDTH / Math.SQRT2);
    const ry = range * (TILE_HEIGHT / Math.SQRT2);
    const screenPos = gridToScreen(gx, gy);

    graphic
      .clear()
      .ellipse(0, 0, rx, ry)
      .fill({ color, alpha: fillAlpha })
      .stroke({ width: 1.5, color, alpha: strokeAlpha });
    graphic.position.set(screenPos.x, screenPos.y);
  }
}
