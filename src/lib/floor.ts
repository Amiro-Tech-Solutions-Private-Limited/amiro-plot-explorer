import type { Flat, Tower, TowerId } from '../data/types';
import { FLAT_BY_ID, PROJECT, TOWER_BY_ID } from '../data/project';
import { BALC_D, CORE_HALF, FLAT_D, FLAT_W, floorBaseY, localToWorld, TOWER_HX } from './geometry';
import { flatXform, furnishedOf, planToWorldXZ, worldToPlan } from './interiorFrame';
import { wallBoxes } from './walls';
import type { OBB } from './collide';
import { roomAt, route } from './route';
import type { Furnishing } from '../store/useStore';
import { useStore } from '../store/useStore';
import { buildGrid, type NavGrid } from './nav';

/** Changes whenever furniture on this floor is themed or redesigned (invalidates collider caches). */
function designKey(tower: TowerId, floor: number) {
  const s = useStore.getState();
  return floorFlats(tower, floor)
    .map((f) => `${s.themes[f.id] ?? ''}:${s.design[f.id]?.rev ?? 0}`)
    .join(',');
}

/** Lift core at the west end of the corridor, stair/fire exit at the east end (tower-local x). */
export const LIFT_X1 = -10.9;
export const STAIR_X0 = 11.2;
const END_X = TOWER_HX - 0.15;

export function floorFlats(tower: TowerId, floor: number): Flat[] {
  return PROJECT.flats.filter((f) => f.tower === tower && f.floor === floor).sort((a, b) => a.index - b.index);
}

export function worldToTowerLocal(t: Tower, wx: number, wz: number): [number, number] {
  const c = Math.cos(t.rotationY);
  const s = Math.sin(t.rotationY);
  const dx = wx - t.position[0];
  const dz = wz - t.position[2];
  return [dx * c - dz * s, dx * s + dz * c];
}

/** Entry-door points in world space: inside the foyer, on the threshold and out in the corridor. */
export function doorPoints(flat: Flat) {
  const xf = flatXform(flat);
  const entry = xf.layout.segs.find((s) => s.kind === 'entry')!;
  const x = entry.gapC!;
  return {
    inside: planToWorldXZ(xf, x, 0.9),
    door: planToWorldXZ(xf, x, 0),
    outside: planToWorldXZ(xf, x, -1.5),
    plan: { x, y: 0.9 },
  };
}

export function liftFront(t: Tower, floor: number) {
  const [x, z] = localToWorld(t, LIFT_X1 + 1.4, 0);
  return { x, z, y: floorBaseY(floor), yaw: t.rotationY - Math.PI / 2 };
}

/** Which flat (if any) a world point is inside, on a given floor. */
export function flatAt(tower: TowerId, floor: number, wx: number, wz: number): Flat | null {
  for (const f of floorFlats(tower, floor)) {
    const p = worldToPlan(flatXform(f), wx, wz);
    if (p.x > 0.05 && p.x < FLAT_W - 0.05 && p.y > 0.02 && p.y < FLAT_D + BALC_D) return f;
  }
  return null;
}

export function corridorArea(tower: TowerId, wx: number, wz: number): 'Lift lobby' | 'Corridor' | 'Fire exit' {
  const [lx] = worldToTowerLocal(TOWER_BY_ID.get(tower)!, wx, wz);
  return lx < LIFT_X1 + 3 ? 'Lift lobby' : lx > STAIR_X0 - 2 ? 'Fire exit' : 'Corridor';
}

const colliderCache = new Map<string, OBB[]>();

/** Walls of all four homes, corridor ends, lift and stair cores, plus optional furniture. */
export function floorColliders(tower: TowerId, floor: number, furnishing: Furnishing, withFurniture: boolean): OBB[] {
  const key = `${tower}|${floor}|${furnishing}|${withFurniture}|${withFurniture ? designKey(tower, floor) : ''}`;
  const hit = colliderCache.get(key);
  if (hit) return hit;
  const t = TOWER_BY_ID.get(tower)!;
  const out: OBB[] = [];
  for (const f of floorFlats(tower, floor)) {
    const xf = flatXform(f);
    const c = Math.cos(xf.rot);
    const s = Math.sin(xf.rot);
    const toWorld = (x: number, z: number, hx: number, hz: number, ry = 0): OBB => ({ cx: xf.gx + x * c + z * s, cz: xf.gz - x * s + z * c, hx, hz, rot: xf.rot + ry });
    for (const b of wallBoxes(xf.layout.segs, 2.9, false)) {
      if (b.solid && b.mat !== 'block' && b.y - b.sy / 2 < 1.2) out.push(toWorld(b.x, b.z, b.sx / 2, b.sz / 2));
    }
    if (withFurniture) {
      for (const p of furnishedOf(f, furnishing, useStore.getState().themes[f.id]).pieces) if (p.solid && p.y - p.sy / 2 < 1.2 && p.y + p.sy / 2 > 0.08) out.push(toWorld(p.x, p.z, p.sx / 2, p.sz / 2, p.ry ?? 0));
    }
  }
  const box = (x0: number, x1: number, z0: number, z1: number) => {
    const [cx, cz] = localToWorld(t, (x0 + x1) / 2, (z0 + z1) / 2);
    out.push({ cx, cz, hx: (x1 - x0) / 2, hz: (z1 - z0) / 2, rot: t.rotationY });
  };
  box(-END_X - 0.3, LIFT_X1, -CORE_HALF, CORE_HALF);
  box(STAIR_X0, END_X + 0.3, -CORE_HALF, CORE_HALF);
  // The 1 m slots between neighbouring homes.
  box(-0.55, 0.55, CORE_HALF - 0.1, CORE_HALF + 0.3);
  box(-0.55, 0.55, -CORE_HALF - 0.3, -CORE_HALF + 0.1);
  colliderCache.set(key, out);
  return out;
}

const navCache = new Map<string, NavGrid>();

/** Path-finding grid for a whole floor (walls, cores and furniture). */
export function floorNav(tower: TowerId, floor: number, furnishing: Furnishing): NavGrid {
  const key = `${tower}|${floor}|${furnishing}|${designKey(tower, floor)}`;
  let g = navCache.get(key);
  if (!g) {
    g = buildGrid(floorColliders(tower, floor, furnishing, true), 0.32);
    navCache.set(key, g);
  }
  return g;
}

export type Shot = 'look' | 'dolly' | 'orbit' | 'closeup' | 'wide' | 'overhead' | 'view' | 'panorama';
export type Highlight = 'outline' | 'label' | 'dimension' | 'compass' | 'landmarks' | 'sunpath';

/** One sentence of narration plus what to show while it is spoken. */
export interface Beat {
  say: string;
  duration?: number;
  /** Item ids (see lib/items.ts). */
  focus: string[];
  shot: Shot;
  highlight?: Highlight;
  host?: 'point' | 'present' | 'namaste' | 'talk';
}

export interface Waypoint {
  x: number;
  z: number;
  caption?: string;
  say?: string;
  beats?: Beat[];
  pause?: number;
  action?: () => void;
  /** Already checked / detoured by the path-finder. */
  routed?: boolean;
  /** Room presentation: move the unseen viewer to a clear spot before framing the room. */
  present?: boolean;
}

/** Route anywhere on a floor: out of the current home, along the corridor, into another home. */
export function floorRoute(tower: TowerId, floor: number, from: { x: number; z: number }, toFlat: Flat | null, toPlan?: { x: number; y: number }): Waypoint[] {
  const pts: Waypoint[] = [];
  const cur = flatAt(tower, floor, from.x, from.z);
  if (cur && toFlat && cur.id === toFlat.id && toPlan) {
    const xf = flatXform(cur);
    const a = roomAt(xf.layout, worldToPlan(xf, from.x, from.z));
    const b = roomAt(xf.layout, toPlan);
    if (b < 0) return [];
    return route(xf.layout, Math.max(0, a), b, toPlan).map((p) => {
      const [x, z] = planToWorldXZ(xf, p.x, p.y);
      return { x, z };
    });
  }
  if (cur) {
    const xf = flatXform(cur);
    const foyer = xf.layout.rooms.findIndex((r) => r.kind === 'foyer');
    const a = roomAt(xf.layout, worldToPlan(xf, from.x, from.z));
    for (const p of route(xf.layout, Math.max(0, a), foyer, doorPoints(cur).plan)) {
      const [x, z] = planToWorldXZ(xf, p.x, p.y);
      pts.push({ x, z });
    }
    const d = doorPoints(cur);
    pts.push({ x: d.door[0], z: d.door[1] }, { x: d.outside[0], z: d.outside[1] });
  }
  if (!toFlat) {
    const lf = liftFront(TOWER_BY_ID.get(tower)!, floor);
    pts.push({ x: lf.x, z: lf.z });
    return pts;
  }
  const d = doorPoints(toFlat);
  pts.push({ x: d.outside[0], z: d.outside[1] }, { x: d.door[0], z: d.door[1] }, { x: d.inside[0], z: d.inside[1] });
  if (toPlan) {
    const xf = flatXform(toFlat);
    const foyer = xf.layout.rooms.findIndex((r) => r.kind === 'foyer');
    const b = roomAt(xf.layout, toPlan);
    if (b >= 0) {
      for (const p of route(xf.layout, foyer, b, toPlan)) {
        const [x, z] = planToWorldXZ(xf, p.x, p.y);
        pts.push({ x, z });
      }
    }
  }
  return pts;
}

export const flatOnFloor = (tower: TowerId, floor: number, index: number) => FLAT_BY_ID.get(`${tower}-${floor}${String(index).padStart(2, '0')}`);
