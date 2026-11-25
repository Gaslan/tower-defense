import { Container, Graphics } from 'pixi.js';
import {
  GRID_SIZE,
  PATH_SINK_OFFSET,
  PATH_WAYPOINTS,
  TILE_DEPTH,
  TILE_HEIGHT,
  TILE_WIDTH,
  type Waypoint,
} from '../config/constants';
import type { MapProp, MapTheme } from '../config/maps';
import { gridToScreen } from '../core/IsoMath';

const HALF_W = TILE_WIDTH / 2;
const HALF_H = TILE_HEIGHT / 2;
const ISLAND_DIRT_DEPTH = 11;
const ISLAND_ROCK_DEPTH = 26;

const FLOWER_COLORS: readonly number[] = [0xf9e79f, 0xfdfefe, 0x85c1e9];

export interface AnimatedEnvironmentProp {
  readonly container: Container;
  readonly animTarget: Container | null;
  readonly mode: 'sway' | 'pulse' | 'static';
  readonly phase: number;
  readonly speed: number;
  readonly amplitude: number;
}

function tileHash(gx: number, gy: number): number {
  return ((gx * 73856093) ^ (gy * 19349663)) >>> 0;
}

function shadeColor(color: number, factor: number): number {
  const r = Math.min(
    255,
    Math.max(0, Math.round(((color >> 16) & 0xff) * factor)),
  );
  const g = Math.min(
    255,
    Math.max(0, Math.round(((color >> 8) & 0xff) * factor)),
  );
  const b = Math.min(
    255,
    Math.max(0, Math.round((color & 0xff) * factor)),
  );
  return (r << 16) | (g << 8) | b;
}

function drawSlabFace(
  g: Graphics,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  topDepth: number,
  bottomDepth: number,
  color: number,
  strokeColor: number,
): void {
  g.poly([
    x0,
    y0 + topDepth,
    x1,
    y1 + topDepth,
    x1,
    y1 + bottomDepth,
    x0,
    y0 + bottomDepth,
  ])
    .fill(color)
    .stroke({ width: 1, color: strokeColor });
}

export function createIsoTileGraphic(
  gx: number,
  gy: number,
  isPath: boolean,
  theme: MapTheme,
  layoutId = 'emerald_valley',
): Graphics {
  const tile = new Graphics();
  tile.eventMode = 'none';
  const yOff = isPath ? PATH_SINK_OFFSET : 0;
  const hash = tileHash(gx, gy);

  const grassLeftWall = shadeColor(theme.grassSecondary, 0.85);
  const grassRightWall = shadeColor(theme.grassSecondary, 0.68);
  const grassStroke = shadeColor(theme.grassSecondary, 0.72);
  const pathLeftWall = shadeColor(theme.pathColor, 0.8);
  const pathRightWall = shadeColor(theme.pathColor, 0.62);
  const crustLeft = shadeColor(theme.pathColor, 0.78);
  const crustRight = shadeColor(theme.pathColor, 0.58);

  if (gy === GRID_SIZE - 1) {
    drawSlabFace(
      tile,
      -HALF_W,
      yOff,
      0,
      HALF_H + yOff,
      0,
      ISLAND_DIRT_DEPTH - yOff,
      crustLeft,
      shadeColor(crustLeft, 0.7),
    );
    drawSlabFace(
      tile,
      -HALF_W,
      0,
      0,
      HALF_H,
      ISLAND_DIRT_DEPTH,
      ISLAND_ROCK_DEPTH,
      theme.cliffLeft,
      shadeColor(theme.cliffLeft, 0.68),
    );
  } else {
    drawSlabFace(
      tile,
      -HALF_W,
      0,
      0,
      HALF_H,
      yOff,
      TILE_DEPTH,
      isPath ? pathLeftWall : grassLeftWall,
      isPath ? theme.pathBorder : grassStroke,
    );
  }

  if (gx === GRID_SIZE - 1) {
    drawSlabFace(
      tile,
      0,
      HALF_H + yOff,
      HALF_W,
      yOff,
      0,
      ISLAND_DIRT_DEPTH - yOff,
      crustRight,
      shadeColor(crustRight, 0.7),
    );
    drawSlabFace(
      tile,
      0,
      HALF_H,
      HALF_W,
      0,
      ISLAND_DIRT_DEPTH,
      ISLAND_ROCK_DEPTH,
      theme.cliffRight,
      shadeColor(theme.cliffRight, 0.68),
    );
  } else {
    drawSlabFace(
      tile,
      0,
      HALF_H,
      HALF_W,
      0,
      yOff,
      TILE_DEPTH,
      isPath ? pathRightWall : grassRightWall,
      isPath ? theme.pathBorder : grassStroke,
    );
  }

  const topFill = isPath
    ? theme.pathColor
    : (gx + gy + (hash & 1)) % 2 === 0
      ? theme.grassPrimary
      : theme.grassSecondary;
  const topStroke = isPath ? theme.pathBorder : grassStroke;

  tile
    .poly([0, -HALF_H + yOff, HALF_W, yOff, 0, HALF_H + yOff, -HALF_W, yOff])
    .fill(topFill)
    .stroke({ width: 1.4, color: topStroke });

  if (isPath) {
    tile
      .moveTo(-HALF_W + 6, yOff)
      .lineTo(0, -HALF_H + yOff + 2.5)
      .lineTo(HALF_W - 6, yOff)
      .stroke({ width: 1.5, color: theme.pathBorder, alpha: 0.55 });

    const pebbleCount = 3 + (hash % 2);
    const pebbleBase = shadeColor(theme.pathColor, 0.82);
    const pebbleHighlight = shadeColor(theme.pathColor, 1.3);
    for (let i = 0; i < pebbleCount; i++) {
      const sub = tileHash(gx + i * 17, gy + i * 31);
      const px = ((sub % 28) - 14) * 1.0;
      const py = yOff + (((sub >>> 5) % 10) - 5) * 0.9;
      const rx = 2.2 + (sub % 2);
      const ry = 1.2 + ((sub >>> 3) % 2) * 0.4;
      tile.ellipse(px, py, rx, ry).fill({ color: pebbleBase, alpha: 0.88 });
      tile
        .circle(px - 0.6, py - 0.4, 0.7)
        .fill({ color: pebbleHighlight, alpha: 0.5 });
    }
  } else {
    tile
      .moveTo(-HALF_W + 4, 0)
      .lineTo(0, -HALF_H + 1.5)
      .stroke({
        width: 1,
        color: shadeColor(theme.grassPrimary, 1.25),
        alpha: 0.4,
      });

    drawBiomeGroundDetails(tile, hash, theme, layoutId);
  }

  const pos = gridToScreen(gx, gy);
  tile.position.set(pos.x, pos.y);
  return tile;
}

function drawBiomeGroundDetails(
  tile: Graphics,
  hash: number,
  theme: MapTheme,
  layoutId: string,
): void {
  const detailKind = hash % 5;
  const ox = ((hash >>> 3) % 20) - 10;
  const oy = ((hash >>> 7) % 8) - 4;

  if (layoutId === 'obsidian_citadel') {
    if (detailKind === 1 || detailKind === 3) {
      tile
        .moveTo(ox - 5, oy + 1)
        .lineTo(ox, oy - 1)
        .lineTo(ox + 6, oy + 2)
        .stroke({ width: 1.2, color: 0xe74c3c, alpha: 0.75 });
      tile.circle(ox, oy - 1, 1.1).fill({ color: 0xf39c12, alpha: 0.85 });
    }
    return;
  }

  if (layoutId === 'frostpeak_pass') {
    if (detailKind === 1 || detailKind === 2) {
      tile.ellipse(ox, oy, 3.2, 1.4).fill({ color: 0xffffff, alpha: 0.65 });
    } else if (detailKind === 3) {
      tile.circle(ox, oy, 1.3).fill({ color: 0x85c1e9, alpha: 0.85 });
    }
    return;
  }

  if (layoutId === 'sunscorched_canyon') {
    if (detailKind === 1 || detailKind === 2) {
      tile
        .moveTo(ox - 4, oy)
        .lineTo(ox + 4, oy - 1.5)
        .stroke({ width: 1.1, color: 0x935116, alpha: 0.55 });
    } else if (detailKind === 3) {
      tile.circle(ox, oy, 1.2).fill({ color: 0x935116, alpha: 0.7 });
    }
    return;
  }

  if (layoutId === 'twilight_marsh') {
    if (detailKind === 1 || detailKind === 2) {
      tile
        .moveTo(ox, oy)
        .lineTo(ox - 1.5, oy - 3.5)
        .moveTo(ox + 2, oy + 0.5)
        .lineTo(ox + 3, oy - 3)
        .stroke({ width: 1.1, color: 0x1e8449, alpha: 0.8 });
    } else if (detailKind === 3) {
      tile.circle(ox, oy, 1.3).fill({ color: 0x76d7c4, alpha: 0.75 });
    }
    return;
  }

  if (detailKind === 1 || detailKind === 2) {
    tile
      .moveTo(ox, oy)
      .lineTo(ox - 1.5, oy - 3.5)
      .moveTo(ox + 2, oy + 0.5)
      .lineTo(ox + 3, oy - 3)
      .stroke({
        width: 1.1,
        color: shadeColor(theme.grassSecondary, 0.7),
        alpha: 0.75,
      });
  } else if (detailKind === 3) {
    const flowerColor = FLOWER_COLORS[(hash >>> 2) % FLOWER_COLORS.length];
    tile.circle(ox, oy, 1.3).fill(flowerColor);
    tile.circle(ox + 5, oy + 2, 1.1).fill(flowerColor);
  }
}

export function createPropEntity(
  placement: MapProp,
  layoutId = 'emerald_valley',
): AnimatedEnvironmentProp {
  const container = new Container();
  container.eventMode = 'none';
  const pos = gridToScreen(placement.gx, placement.gy);
  container.position.set(pos.x, pos.y);
  container.zIndex = placement.gx + placement.gy;

  const shadow = new Graphics();
  container.addChild(shadow);

  const hash = tileHash(placement.gx, placement.gy);
  const phase = (hash % 628) / 100;

  if (placement.type === 'tree') {
    const isPine = layoutId === 'frostpeak_pass' || hash % 2 === 0;
    if (isPine) {
      shadow.ellipse(1, 2, 13, 6).fill({ color: 0x000000, alpha: 0.28 });
      const trunk = new Graphics();
      trunk
        .rect(-2.5, -9, 5, 11)
        .fill(0x6e2c00)
        .stroke({ width: 1, color: 0x3b1800 });

      const foliage = new Container();
      foliage.position.set(0, -6);
      const canopy = new Graphics();
      const isFrost = layoutId === 'frostpeak_pass';
      const isMarsh = layoutId === 'twilight_marsh';
      const tiers = isFrost
        ? [
            { y: 0, w: 14, h: 14, base: 0x2471a3, light: 0xd6eaf8 },
            { y: -9, w: 11, h: 13, base: 0x2e86c1, light: 0xebf5fb },
            { y: -17, w: 7.5, h: 12, base: 0x5dade2, light: 0xffffff },
          ]
        : isMarsh
          ? [
              { y: 0, w: 14, h: 14, base: 0x194d33, light: 0x2e7d5b },
              { y: -9, w: 11, h: 13, base: 0x1f5f40, light: 0x3d9970 },
              { y: -17, w: 7.5, h: 12, base: 0x26734d, light: 0x52be80 },
            ]
          : [
              { y: 0, w: 14, h: 14, base: 0x196f3d, light: 0x27ae60 },
              { y: -9, w: 11, h: 13, base: 0x1e8449, light: 0x2ecc71 },
              { y: -17, w: 7.5, h: 12, base: 0x229954, light: 0x58d68d },
            ];
      const outline = isFrost ? 0x1b4f72 : 0x145a32;
      for (const tier of tiers) {
        canopy
          .poly([
            0,
            tier.y - tier.h,
            tier.w,
            tier.y,
            0,
            tier.y + 3,
            -tier.w,
            tier.y,
          ])
          .fill(tier.base)
          .stroke({ width: 1, color: outline })
          .poly([0, tier.y - tier.h, 0, tier.y + 3, -tier.w, tier.y])
          .fill({ color: tier.light, alpha: 0.75 });
      }
      foliage.addChild(canopy);
      container.addChild(trunk, foliage);
      return {
        container,
        animTarget: foliage,
        mode: 'sway',
        phase,
        speed: 1.7,
        amplitude: 0.035,
      };
    }

    shadow.ellipse(1, 2, 15, 7).fill({ color: 0x000000, alpha: 0.28 });
    const trunk = new Graphics();
    trunk
      .poly([-3.5, 2, -2.5, -12, 2.5, -12, 3.5, 2])
      .fill(0x6e2c00)
      .stroke({ width: 1, color: 0x3b1800 });

    const canopy = new Container();
    canopy.position.set(0, -11);
    const puffs = new Graphics();
    const isMarsh = layoutId === 'twilight_marsh';
    puffs
      .circle(6, -6, 8)
      .fill(isMarsh ? 0x194d33 : 0x196f3d)
      .circle(-6, -6, 8.5)
      .fill(isMarsh ? 0x1e5e3f : 0x229954)
      .circle(0, -13, 9.5)
      .fill(isMarsh ? 0x24734d : 0x27ae60)
      .circle(-3, -15, 6.5)
      .fill(isMarsh ? 0x3b8c66 : 0x52be80)
      .circle(4, -10, 5.5)
      .fill(isMarsh ? 0x2e7d5b : 0x2ecc71)
      .stroke({ width: 1, color: 0x145a32 });
    canopy.addChild(puffs);
    container.addChild(trunk, canopy);
    return {
      container,
      animTarget: canopy,
      mode: 'sway',
      phase,
      speed: 1.35,
      amplitude: 0.025,
    };
  }

  if (placement.type === 'rock') {
    shadow.ellipse(1, 2, 13, 6).fill({ color: 0x000000, alpha: 0.28 });
    const isCanyon = layoutId === 'sunscorched_canyon';
    const isCitadel = layoutId === 'obsidian_citadel';
    const isFrost = layoutId === 'frostpeak_pass';

    const mainCol = isCanyon
      ? 0xb9770e
      : isCitadel
        ? 0x2c2f36
        : isFrost
          ? 0x85c1e9
          : 0x7f8c8d;
    const lightCol = isCanyon
      ? 0xe67e22
      : isCitadel
        ? 0x515a5a
        : isFrost
          ? 0xd6eaf8
          : 0xbdc3c7;
    const darkCol = isCanyon
      ? 0x7e5109
      : isCitadel
        ? 0x171a21
        : isFrost
          ? 0x5499c7
          : 0x566573;
    const strokeCol = isCanyon ? 0x5d3a06 : isCitadel ? 0x111217 : 0x2c3e50;

    const rock = new Graphics();
    rock
      .poly([-11, 1, -8, -8, -1, -12, 8, -7, 11, 1, 2, 4])
      .fill(mainCol)
      .stroke({ width: 1.2, color: strokeCol })
      .poly([-11, 1, -8, -8, -1, -12, -1, 0])
      .fill(lightCol)
      .poly([-1, -12, 8, -7, 11, 1, 2, 4, -1, 0])
      .fill(darkCol)
      .poly([-13, 3, -10, -2, -5, 0, -6, 4])
      .fill(mainCol)
      .stroke({ width: 1, color: strokeCol });

    if (isCitadel) {
      rock
        .moveTo(-3, -6)
        .lineTo(1, -2)
        .lineTo(4, -5)
        .stroke({ width: 1.4, color: 0xe74c3c });
    } else if (!isCanyon && !isFrost) {
      rock
        .moveTo(6, 3)
        .lineTo(8, -1)
        .moveTo(8, 3)
        .lineTo(11, 0)
        .stroke({ width: 1.3, color: 0x27ae60 });
    }

    container.addChild(rock);
    return {
      container,
      animTarget: null,
      mode: 'static',
      phase,
      speed: 0,
      amplitude: 0,
    };
  }

  shadow.ellipse(0, 2, 12, 5.5).fill({ color: 0x000000, alpha: 0.25 });
  const bushBody = new Container();
  bushBody.position.set(0, 1);
  const isCanyon = layoutId === 'sunscorched_canyon';
  const isCitadel = layoutId === 'obsidian_citadel';
  const isFrost = layoutId === 'frostpeak_pass';

  const c1 = isCanyon ? 0x7d6608 : isCitadel ? 0x4a235a : isFrost ? 0x2e86c1 : 0x1e8449;
  const c2 = isCanyon ? 0x6e2c00 : isCitadel ? 0x512e5f : isFrost ? 0x2471a3 : 0x196f3d;
  const c3 = isCanyon ? 0x9a7d0a : isCitadel ? 0x78281f : isFrost ? 0x5dade2 : 0x2ecc71;
  const c4 = isCanyon ? 0xb7950b : isCitadel ? 0xc0392b : isFrost ? 0xd6eaf8 : 0x58d68d;
  const berry = isCitadel ? 0xf39c12 : isFrost ? 0xffffff : 0xe74c3c;

  const puffs = new Graphics();
  puffs
    .circle(-6, -4, 5.5)
    .fill(c1)
    .circle(6, -4, 5.5)
    .fill(c2)
    .circle(0, -7, 6.5)
    .fill(c3)
    .circle(-2, -9, 4)
    .fill(c4)
    .circle(-4, -6, 1.2)
    .fill(berry)
    .circle(4, -5, 1.2)
    .fill(isCitadel ? 0xe74c3c : 0xf9e79f);
  bushBody.addChild(puffs);
  container.addChild(bushBody);
  return {
    container,
    animTarget: bushBody,
    mode: 'sway',
    phase,
    speed: 2.0,
    amplitude: 0.03,
  };
}

export function createPathLandmarks(
  waypoints: readonly Waypoint[] = PATH_WAYPOINTS,
): {
  portal: AnimatedEnvironmentProp;
  gatehouse: Container;
} {
  const start = waypoints[0];
  const end = waypoints[waypoints.length - 1];

  // Spawn Portal on first path tile
  const portalContainer = new Container();
  portalContainer.eventMode = 'none';
  const startPos = gridToScreen(start.gx, start.gy);
  portalContainer.position.set(startPos.x, startPos.y + PATH_SINK_OFFSET);
  portalContainer.zIndex = start.gx + start.gy - 0.1;

  const portalFrame = new Graphics();
  portalFrame
    .ellipse(0, 2, 16, 7)
    .fill({ color: 0x000000, alpha: 0.32 })
    .poly([-13, 2, -13, -18, -7, -23, -7, 2])
    .fill(0x566573)
    .stroke({ width: 1.2, color: 0x1c2833 })
    .poly([7, 2, 7, -23, 13, -18, 13, 2])
    .fill(0x34495e)
    .stroke({ width: 1.2, color: 0x1c2833 })
    .poly([-14, -18, 0, -27, 14, -18, 8, -14, 0, -20, -8, -14])
    .fill(0x7f8c8d)
    .stroke({ width: 1.2, color: 0x1c2833 });

  const portalCoreWrap = new Container();
  portalCoreWrap.position.set(0, -10);
  const portalCore = new Graphics();
  portalCore
    .ellipse(0, 0, 7.5, 11)
    .fill({ color: 0x8e44ad, alpha: 0.85 })
    .ellipse(0, 0, 4.5, 7.5)
    .fill({ color: 0xe74c3c, alpha: 0.9 })
    .circle(0, -1, 2.5)
    .fill(0xf9e79f);
  portalCoreWrap.addChild(portalCore);
  portalContainer.addChild(portalFrame, portalCoreWrap);

  // Castle Gatehouse on final path tile
  const gatehouse = new Container();
  gatehouse.eventMode = 'none';
  const endPos = gridToScreen(end.gx, end.gy);
  gatehouse.position.set(endPos.x, endPos.y + PATH_SINK_OFFSET);
  gatehouse.zIndex = end.gx + end.gy + 0.15;

  const keep = new Graphics();
  keep
    .ellipse(0, 3, 20, 9)
    .fill({ color: 0x000000, alpha: 0.35 })
    // Main stone body
    .rect(-15, -24, 30, 26)
    .fill(0x7f8c8d)
    .stroke({ width: 1.2, color: 0x1b2631 })
    // Sunlit left face & shadowed right tower
    .rect(-17, -30, 10, 32)
    .fill(0xaab7b8)
    .stroke({ width: 1.2, color: 0x1b2631 })
    .rect(7, -30, 10, 32)
    .fill(0x566573)
    .stroke({ width: 1.2, color: 0x1b2631 })
    // Crenellations
    .rect(-18, -33, 4, 4)
    .fill(0xd5dbdb)
    .rect(-10, -33, 4, 4)
    .fill(0xd5dbdb)
    .rect(6, -33, 4, 4)
    .fill(0x808b96)
    .rect(14, -33, 4, 4)
    .fill(0x808b96)
    // Dark arched portcullis entrance
    .rect(-6, -15, 12, 17)
    .fill(0x1b2631)
    .circle(0, -15, 6)
    .fill(0x1b2631)
    .moveTo(-2, -19)
    .lineTo(-2, 2)
    .moveTo(2, -19)
    .lineTo(2, 2)
    .stroke({ width: 1, color: 0x566573 })
    // Royal gold trim & crimson pennant
    .rect(-7, -23, 14, 3)
    .fill(0xf1c40f)
    .moveTo(0, -24)
    .lineTo(0, -36)
    .stroke({ width: 1.5, color: 0xf1c40f })
    .poly([0, -36, 9, -33, 0, -30])
    .fill(0xc0392b);
  gatehouse.addChild(keep);

  return {
    portal: {
      container: portalContainer,
      animTarget: portalCoreWrap,
      mode: 'pulse',
      phase: 0,
      speed: 3.4,
      amplitude: 0.1,
    },
    gatehouse,
  };
}
