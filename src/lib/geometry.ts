import type { Facing, Tower } from '../data/types';

export const FLAT_W = 13;
export const FLAT_D = 11;
export const BALC_D = 1.6;
export const GROUND_H = 4;
export const FLOOR_H = 3.2;
export const SLAB_T = 0.25;
export const CORE_HALF = 3;
export const X_GAP = 0.5;
/** Residential floors above the ground-floor lobby (North Park towers read as ~G + 22 on the renders). */
export const FLOORS = 22;
export const EXPLODE_GAP = 2.6;
export const TOWER_HX = X_GAP + FLAT_W;
export const TOWER_HZ = CORE_HALF + FLAT_D;
export const ROOF_Y = GROUND_H + FLOORS * FLOOR_H;
export const DEG = Math.PI / 180;

export function bearingToRotY(bearingDeg: number) {
  return Math.PI - bearingDeg * DEG;
}

/** World direction (x = east, z = south) for a compass bearing. */
export function dirFromBearing(bearingDeg: number): [number, number] {
  return [Math.sin(bearingDeg * DEG), -Math.cos(bearingDeg * DEG)];
}

export function bearingFromVec(x: number, z: number) {
  const b = Math.atan2(x, -z) / DEG;
  return (b + 360) % 360;
}

const EIGHT: Facing[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export function bearingLabel(bearingDeg: number): Facing {
  const i = Math.round((((bearingDeg % 360) + 360) % 360) / 45) % 8;
  return EIGHT[i];
}

export const FACING_LONG: Record<Facing, string> = {
  N: 'North',
  E: 'East',
  S: 'South',
  W: 'West',
  NE: 'North-East',
  NW: 'North-West',
  SE: 'South-East',
  SW: 'South-West',
};

export interface FlatFrame {
  ox: number;
  oz: number;
  /** +1 or -1: plan axes → tower-local axes. */
  s: 1 | -1;
  mirror: boolean;
}

/** 2×2 layout: 1 front-left, 2 front-right (mirrored), 3 back-right, 4 back-left (mirrored). */
export function flatFrame(index: 1 | 2 | 3 | 4): FlatFrame {
  switch (index) {
    case 1:
      return { ox: -TOWER_HX, oz: CORE_HALF, s: 1, mirror: false };
    case 2:
      return { ox: X_GAP, oz: CORE_HALF, s: 1, mirror: true };
    case 3:
      return { ox: TOWER_HX, oz: -CORE_HALF, s: -1, mirror: false };
    case 4:
      return { ox: -X_GAP, oz: -CORE_HALF, s: -1, mirror: true };
  }
}

export function floorBaseY(floor: number, explode = 0) {
  return GROUND_H + (floor - 1) * FLOOR_H + floor * EXPLODE_GAP * explode;
}

export function roofY(explode = 0) {
  return GROUND_H + FLOORS * FLOOR_H + (FLOORS + 1) * EXPLODE_GAP * explode;
}

/** Plan point → tower-local x/z. */
export function planToLocal(frame: FlatFrame, px: number, py: number): [number, number] {
  const mx = frame.mirror ? FLAT_W - px : px;
  return [frame.ox + frame.s * mx, frame.oz + frame.s * py];
}

export function localToWorld(tower: Tower, lx: number, lz: number): [number, number] {
  const r = tower.rotationY;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [tower.position[0] + lx * c + lz * s, tower.position[2] - lx * s + lz * c];
}

export function planToWorld(tower: Tower, frame: FlatFrame, px: number, py: number): [number, number] {
  const [lx, lz] = planToLocal(frame, px, py);
  return localToWorld(tower, lx, lz);
}

/** Rotation of a group whose children are laid out in (mirrored) plan coords. */
export function frameRotation(tower: Tower, frame: FlatFrame) {
  return tower.rotationY + (frame.s < 0 ? Math.PI : 0);
}

/** Mirror a plan-space rect into drawing coords. */
export function mirrorRect<T extends { x: number; w: number }>(r: T, mirror: boolean): T {
  return mirror ? { ...r, x: FLAT_W - r.x - r.w } : r;
}
