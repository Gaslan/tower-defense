export const GRID_SIZE = 10;
export const TILE_WIDTH = 72;
export const TILE_HEIGHT = 26;
export const TILE_DEPTH = 10;
export const PATH_SINK_OFFSET = 3;

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 2.5;
export const ZOOM_FACTOR = 1.12;
export const DRAG_THRESHOLD_PX = 4;

export const TILE_GRASS = 0 as const;
export const TILE_PATH = 1 as const;
export type TileType = typeof TILE_GRASS | typeof TILE_PATH;

export const BG_COLOR = 0x1a1a2e;
export const GRASS_FILL_COLOR = 0x2ecc71;
export const GRASS_STROKE_COLOR = 0x1e8449;
export const GRASS_LEFT_WALL_COLOR = 0x239b56;
export const GRASS_RIGHT_WALL_COLOR = 0x196f3d;
export const PATH_FILL_COLOR = 0x8d6e63;
export const PATH_STROKE_COLOR = 0x5d4037;
export const PATH_LEFT_WALL_COLOR = 0x6d4c41;
export const PATH_RIGHT_WALL_COLOR = 0x4e342e;

export const HOVER_BUILDABLE_FILL = 0xffffff;
export const HOVER_BUILDABLE_STROKE = 0xf1c40f;
export const HOVER_UNAFFORDABLE_FILL = 0xe67e22;
export const HOVER_UNAFFORDABLE_STROKE = 0xd35400;
export const HOVER_BLOCKED_FILL = 0xe74c3c;
export const HOVER_BLOCKED_STROKE = 0xc0392b;

export interface Waypoint {
  readonly gx: number;
  readonly gy: number;
}

export const PATH_WAYPOINTS: readonly Waypoint[] = [
  { gx: 0, gy: 2 },
  { gx: 1, gy: 2 },
  { gx: 2, gy: 2 },
  { gx: 3, gy: 2 },
  { gx: 3, gy: 3 },
  { gx: 3, gy: 4 },
  { gx: 3, gy: 5 },
  { gx: 3, gy: 6 },
  { gx: 4, gy: 6 },
  { gx: 5, gy: 6 },
  { gx: 6, gy: 6 },
  { gx: 6, gy: 5 },
  { gx: 6, gy: 4 },
  { gx: 6, gy: 3 },
  { gx: 7, gy: 3 },
  { gx: 8, gy: 3 },
  { gx: 9, gy: 3 },
];

export const MAP_LAYOUT: readonly (readonly TileType[])[] = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 1, 0, 0, 1, 1, 1, 1],
  [0, 0, 0, 1, 0, 0, 1, 0, 0, 0],
  [0, 0, 0, 1, 0, 0, 1, 0, 0, 0],
  [0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
];

export type PropType = 'pine' | 'oak' | 'rock' | 'bush';

export interface PropPlacement {
  readonly gx: number;
  readonly gy: number;
  readonly type: PropType;
}

export const PROP_PLACEMENTS: readonly PropPlacement[] = [
  { gx: 0, gy: 0, type: 'pine' },
  { gx: 2, gy: 0, type: 'rock' },
  { gx: 0, gy: 1, type: 'bush' },
  { gx: 7, gy: 0, type: 'oak' },
  { gx: 9, gy: 0, type: 'pine' },
  { gx: 9, gy: 1, type: 'rock' },
  { gx: 0, gy: 8, type: 'oak' },
  { gx: 1, gy: 9, type: 'bush' },
  { gx: 8, gy: 9, type: 'pine' },
  { gx: 9, gy: 8, type: 'rock' },
];
