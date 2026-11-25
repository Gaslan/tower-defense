import { GRID_SIZE, TILE_HEIGHT, TILE_WIDTH } from '../config/constants';

export interface GridPoint {
  gx: number;
  gy: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export function gridToScreen(gx: number, gy: number): ScreenPoint {
  return {
    x: (gx - gy) * (TILE_WIDTH / 2),
    y: (gx + gy) * (TILE_HEIGHT / 2),
  };
}

export function screenToGrid(
  sx: number,
  sy: number,
  offsetX = 0,
  offsetY = 0,
  scale = 1,
): GridPoint {
  const localX = (sx - offsetX) / scale;
  const localY = (sy - offsetY) / scale;
  const halfW = TILE_WIDTH / 2;
  const halfH = TILE_HEIGHT / 2;

  const fx = (localX / halfW + localY / halfH) / 2;
  const fy = (localY / halfH - localX / halfW) / 2;

  return {
    gx: Math.floor(fx + 0.5),
    gy: Math.floor(fy + 0.5),
  };
}

export function gridDistance(a: GridPoint, b: GridPoint): number {
  return Math.hypot(a.gx - b.gx, a.gy - b.gy);
}

export function isValidGridCoord(gx: number, gy: number): boolean {
  return gx >= 0 && gx < GRID_SIZE && gy >= 0 && gy < GRID_SIZE;
}
