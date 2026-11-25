import {
  GRID_SIZE,
  TILE_GRASS,
  TILE_PATH,
  type TileType,
} from './constants';

export interface GridCoord {
  readonly gx: number;
  readonly gy: number;
}

export type MapPropType = 'tree' | 'rock' | 'bush';

export interface MapProp {
  readonly gx: number;
  readonly gy: number;
  readonly type: MapPropType;
}

export interface MapTheme {
  readonly grassPrimary: number;
  readonly grassSecondary: number;
  readonly pathColor: number;
  readonly pathBorder: number;
  readonly cliffLeft: number;
  readonly cliffRight: number;
  readonly backgroundColor: number;
}

export interface MapLayout {
  readonly id: string;
  readonly name: string;
  readonly theme: MapTheme;
  readonly waypoints: readonly GridCoord[];
  readonly props: readonly MapProp[];
  readonly tileGrid: readonly (readonly TileType[])[];
}

export interface PathConfig {
  readonly pathId: number;
  readonly name: string;
  readonly isBossPath: boolean;
  readonly totalWaves: number;
  readonly mapLayout: MapLayout;
  readonly difficultyMultiplier: number;
  readonly crystalReward: number;
  readonly xpReward: number;
}

interface MapBlueprint {
  readonly id: string;
  readonly name: string;
  readonly theme: MapTheme;
  readonly corners: readonly GridCoord[];
  readonly props: readonly MapProp[];
}

function expandWaypoints(corners: readonly GridCoord[]): GridCoord[] {
  const result: GridCoord[] = [];
  for (let i = 0; i < corners.length; i++) {
    const curr = corners[i];
    if (i === 0) {
      result.push({ gx: curr.gx, gy: curr.gy });
      continue;
    }
    const prev = result[result.length - 1];
    let gx = prev.gx;
    let gy = prev.gy;
    while (gx !== curr.gx || gy !== curr.gy) {
      if (gx !== curr.gx) {
        gx += gx < curr.gx ? 1 : -1;
      } else if (gy !== curr.gy) {
        gy += gy < curr.gy ? 1 : -1;
      }
      result.push({ gx, gy });
    }
  }
  return result;
}

function createMapLayout(blueprint: MapBlueprint): MapLayout {
  const waypoints = expandWaypoints(blueprint.corners);
  const tileGrid: TileType[][] = Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => TILE_GRASS),
  );

  for (const pt of waypoints) {
    if (pt.gx >= 0 && pt.gx < GRID_SIZE && pt.gy >= 0 && pt.gy < GRID_SIZE) {
      tileGrid[pt.gy][pt.gx] = TILE_PATH;
    }
  }

  const start = waypoints[0];
  const end = waypoints[waypoints.length - 1];
  const props = blueprint.props.filter((prop) => {
    if (
      prop.gx < 0 ||
      prop.gx >= GRID_SIZE ||
      prop.gy < 0 ||
      prop.gy >= GRID_SIZE
    ) {
      return false;
    }
    if (tileGrid[prop.gy][prop.gx] === TILE_PATH) {
      return false;
    }
    const nearStart =
      Math.abs(prop.gx - start.gx) + Math.abs(prop.gy - start.gy) <= 1;
    const nearEnd =
      Math.abs(prop.gx - end.gx) + Math.abs(prop.gy - end.gy) <= 1;
    return !nearStart && !nearEnd;
  });

  return {
    id: blueprint.id,
    name: blueprint.name,
    theme: blueprint.theme,
    waypoints,
    props,
    tileGrid,
  };
}

const MAP_BLUEPRINTS: readonly MapBlueprint[] = [
  {
    id: 'emerald_valley',
    name: 'Emerald Valley',
    theme: {
      grassPrimary: 0x2ecc71,
      grassSecondary: 0x27ae60,
      pathColor: 0x8d6e63,
      pathBorder: 0x5d4037,
      cliffLeft: 0x566573,
      cliffRight: 0x34495e,
      backgroundColor: 0x1a1a2e,
    },
    corners: [
      { gx: 0, gy: 2 },
      { gx: 3, gy: 2 },
      { gx: 3, gy: 7 },
      { gx: 6, gy: 7 },
      { gx: 6, gy: 2 },
      { gx: 9, gy: 2 },
    ],
    props: [
      { gx: 0, gy: 0, type: 'tree' },
      { gx: 2, gy: 0, type: 'rock' },
      { gx: 0, gy: 5, type: 'bush' },
      { gx: 4, gy: 4, type: 'tree' },
      { gx: 5, gy: 4, type: 'rock' },
      { gx: 8, gy: 0, type: 'tree' },
      { gx: 9, gy: 0, type: 'bush' },
      { gx: 1, gy: 8, type: 'tree' },
      { gx: 5, gy: 9, type: 'rock' },
      { gx: 8, gy: 8, type: 'bush' },
      { gx: 9, gy: 7, type: 'tree' },
    ],
  },
  {
    id: 'sunscorched_canyon',
    name: 'Sunscorched Canyon',
    theme: {
      grassPrimary: 0xd4ac6e,
      grassSecondary: 0xc59855,
      pathColor: 0xa95c3c,
      pathBorder: 0x6e3520,
      cliffLeft: 0x935116,
      cliffRight: 0x6e2c00,
      backgroundColor: 0x241610,
    },
    corners: [
      { gx: 0, gy: 1 },
      { gx: 8, gy: 1 },
      { gx: 8, gy: 4 },
      { gx: 1, gy: 4 },
      { gx: 1, gy: 8 },
      { gx: 9, gy: 8 },
    ],
    props: [
      { gx: 3, gy: 0, type: 'rock' },
      { gx: 6, gy: 0, type: 'bush' },
      { gx: 9, gy: 2, type: 'rock' },
      { gx: 4, gy: 2, type: 'rock' },
      { gx: 5, gy: 2, type: 'bush' },
      { gx: 3, gy: 6, type: 'rock' },
      { gx: 6, gy: 6, type: 'bush' },
      { gx: 0, gy: 9, type: 'rock' },
      { gx: 5, gy: 9, type: 'bush' },
    ],
  },
  {
    id: 'frostpeak_pass',
    name: 'Frostpeak Pass',
    theme: {
      grassPrimary: 0xd6eaf8,
      grassSecondary: 0xbfdcf0,
      pathColor: 0x5d6d7e,
      pathBorder: 0x2e4053,
      cliffLeft: 0x5499c7,
      cliffRight: 0x2471a3,
      backgroundColor: 0x101d2e,
    },
    corners: [
      { gx: 1, gy: 0 },
      { gx: 1, gy: 7 },
      { gx: 5, gy: 7 },
      { gx: 5, gy: 2 },
      { gx: 8, gy: 2 },
      { gx: 8, gy: 9 },
    ],
    props: [
      { gx: 0, gy: 3, type: 'tree' },
      { gx: 0, gy: 6, type: 'rock' },
      { gx: 3, gy: 3, type: 'tree' },
      { gx: 3, gy: 4, type: 'rock' },
      { gx: 7, gy: 0, type: 'tree' },
      { gx: 9, gy: 1, type: 'bush' },
      { gx: 6, gy: 5, type: 'tree' },
      { gx: 3, gy: 9, type: 'rock' },
      { gx: 6, gy: 9, type: 'tree' },
    ],
  },
  {
    id: 'twilight_marsh',
    name: 'Twilight Marsh',
    theme: {
      grassPrimary: 0x3b5e47,
      grassSecondary: 0x2f4d3a,
      pathColor: 0x4e3b31,
      pathBorder: 0x2c201a,
      cliffLeft: 0x3d4849,
      cliffRight: 0x262e30,
      backgroundColor: 0x131b1e,
    },
    corners: [
      { gx: 0, gy: 6 },
      { gx: 2, gy: 6 },
      { gx: 2, gy: 2 },
      { gx: 5, gy: 2 },
      { gx: 5, gy: 7 },
      { gx: 7, gy: 7 },
      { gx: 7, gy: 3 },
      { gx: 9, gy: 3 },
    ],
    props: [
      { gx: 0, gy: 1, type: 'tree' },
      { gx: 1, gy: 3, type: 'bush' },
      { gx: 3, gy: 0, type: 'rock' },
      { gx: 7, gy: 0, type: 'tree' },
      { gx: 9, gy: 0, type: 'bush' },
      { gx: 3, gy: 5, type: 'bush' },
      { gx: 4, gy: 9, type: 'rock' },
      { gx: 6, gy: 9, type: 'tree' },
      { gx: 8, gy: 6, type: 'rock' },
      { gx: 9, gy: 8, type: 'bush' },
    ],
  },
  {
    id: 'obsidian_citadel',
    name: 'Obsidian Citadel',
    theme: {
      grassPrimary: 0x424949,
      grassSecondary: 0x33393b,
      pathColor: 0x262026,
      pathBorder: 0xc0392b,
      cliffLeft: 0x2c2c34,
      cliffRight: 0x191920,
      backgroundColor: 0x160d14,
    },
    corners: [
      { gx: 0, gy: 1 },
      { gx: 8, gy: 1 },
      { gx: 8, gy: 8 },
      { gx: 2, gy: 8 },
      { gx: 2, gy: 4 },
      { gx: 5, gy: 4 },
      { gx: 5, gy: 6 },
    ],
    props: [
      { gx: 4, gy: 0, type: 'rock' },
      { gx: 9, gy: 0, type: 'rock' },
      { gx: 9, gy: 5, type: 'bush' },
      { gx: 0, gy: 5, type: 'rock' },
      { gx: 0, gy: 8, type: 'rock' },
      { gx: 5, gy: 9, type: 'rock' },
      { gx: 9, gy: 9, type: 'rock' },
      { gx: 3, gy: 2, type: 'rock' },
      { gx: 6, gy: 2, type: 'bush' },
    ],
  },
];

export const MAP_LAYOUTS: readonly MapLayout[] =
  MAP_BLUEPRINTS.map(createMapLayout);

const ROMAN_NUMERALS: readonly [number, string][] = [
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

function toRoman(num: number): string {
  let rem = Math.max(1, Math.floor(num));
  let out = '';
  for (const [val, sym] of ROMAN_NUMERALS) {
    while (rem >= val) {
      out += sym;
      rem -= val;
    }
  }
  return out;
}

export function getPathConfig(pathId: number): PathConfig {
  const safeId = Math.max(1, Math.floor(pathId));
  const isBossPath = safeId % 5 === 0;
  const totalWaves = !isBossPath ? 10 : safeId === 5 ? 15 : 20;

  const mapLayout = isBossPath
    ? MAP_LAYOUTS[4]
    : MAP_LAYOUTS[(safeId - 1 - Math.floor((safeId - 1) / 5)) % 4];

  const chapter = Math.floor((safeId - 1) / 5) + 1;
  const name =
    chapter === 1 ? mapLayout.name : `${mapLayout.name} ${toRoman(chapter)}`;

  const difficultyMultiplier = Number((1 + (safeId - 1) * 0.28).toFixed(2));
  const bossMult = isBossPath ? 2 : 1;
  const crystalReward = (35 + safeId * 15) * bossMult;
  const xpReward = (80 + safeId * 35) * bossMult;

  return {
    pathId: safeId,
    name,
    isBossPath,
    totalWaves,
    mapLayout,
    difficultyMultiplier,
    crystalReward,
    xpReward,
  };
}
