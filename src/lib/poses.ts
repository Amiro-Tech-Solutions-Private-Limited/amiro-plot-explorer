import type { Flat, TowerId } from '../data/types';
import { TOWER_BY_ID, towerOf, unitOf } from '../data/project';
import { DEG, dirFromBearing, flatFrame, FLAT_D, FLAT_W, floorBaseY, FLOORS, planToWorld } from './geometry';
import { GATE_X } from '../data/site';

export type V3 = [number, number, number];
export interface Pose {
  pos: V3;
  target: V3;
  fov: number;
}

/** Aerial view from the main road side, like the North Park hero render. */
export const DEFAULT_POSE: Pose = { pos: [200, 150, 195], target: [0, 34, -6], fov: 42 };

export function planPose(aspect: number): Pose {
  const fov = 30;
  const t = Math.tan((fov / 2) * DEG);
  const h = Math.max(92 / t, 64 / (t * aspect));
  return { pos: [0, h, 0.01], target: [0, 0, 0], fov };
}

export const WALK_START: Pose = { pos: [GATE_X, 1.7, 82], target: [GATE_X - 8, 1.7, 40], fov: 60 };

export function flatCenter(flat: Flat, explode = 0): V3 {
  const [x, z] = planToWorld(towerOf(flat), flatFrame(flat.index), FLAT_W / 2, FLAT_D / 2);
  return [x, floorBaseY(flat.floor, explode) + 1.5, z];
}

export function outsidePose(flat: Flat): Pose {
  const c = flatCenter(flat);
  const [fx, fz] = dirFromBearing(flat.facingBearing);
  const sx = -fz;
  const sz = fx;
  // On phones the bottom sheet covers the lower half, so aim below the flat to lift it on screen.
  const mobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const d = mobile ? 78 : 58;
  return {
    pos: [c[0] + fx * d + sx * 18, c[1] + 14, c[2] + fz * d + sz * 18],
    target: [c[0], c[1] - (mobile ? 16 : 0), c[2]],
    fov: 42,
  };
}

export function balconyPose(flat: Flat): Pose {
  const u = unitOf(flat);
  const balc = u.rooms.filter((r) => r.kind === 'balcony' && !r.level).sort((a, b) => b.w * b.h - a.w * a.h)[0];
  const [x, z] = planToWorld(towerOf(flat), flatFrame(flat.index), balc.x + balc.w / 2, balc.y + balc.h * 0.45);
  const [fx, fz] = dirFromBearing(flat.facingBearing);
  const y = floorBaseY(flat.floor) + 1.6;
  return { pos: [x, y, z], target: [x + fx * 30, y - 3, z + fz * 30], fov: 65 };
}

export function interiorPose(flat: Flat): Pose {
  const u = unitOf(flat);
  const foyer = u.rooms.find((r) => r.kind === 'foyer')!;
  const living = u.rooms.find((r) => r.kind === 'living')!;
  const t = towerOf(flat);
  const fr = flatFrame(flat.index);
  const [x, z] = planToWorld(t, fr, foyer.x + foyer.w / 2, foyer.y + foyer.h * 0.6);
  const [lx, lz] = planToWorld(t, fr, living.x + living.w / 2, living.y + living.h * 0.8);
  const y = floorBaseY(flat.floor) + 1.6;
  return { pos: [x, y, z], target: [lx, y - 0.1, lz], fov: 70 };
}

export function floorsPose(towerId: TowerId, floor: number | null): Pose {
  const t = TOWER_BY_ID.get(towerId)!;
  const [fx, fz] = dirFromBearing(t.frontBearing);
  const sx = -fz;
  const sz = fx;
  const [cx, , cz] = t.position;
  if (floor == null) {
    const mid = floorBaseY(Math.round(FLOORS / 2), 1);
    return { pos: [cx + fx * 170 + sx * 70, mid + 30, cz + fz * 170 + sz * 70], target: [cx, mid, cz], fov: 42 };
  }
  const y = floorBaseY(floor, 1);
  const mobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const k = mobile ? 1.5 : 1;
  return {
    pos: [cx + fx * 30 * k + sx * 20 * k, y + 30 * k, cz + fz * 30 * k + sz * 20 * k],
    target: [cx, y - (mobile ? 14 : 0), cz + 0.001],
    fov: 45,
  };
}
