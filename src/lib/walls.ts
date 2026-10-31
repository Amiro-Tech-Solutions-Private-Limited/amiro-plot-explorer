import type { Room, RoomKind } from '../data/types';
import { FLAT_D, FLAT_W, mirrorRect } from './geometry';

export type SegKind = 'wall' | 'window' | 'door' | 'entry' | 'slide' | 'railing';

/** Wall segment in drawing (mirrored plan) coordinates. Axis-aligned. */
export interface Seg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind: SegKind;
  /** Door/window opening centre along the segment and its width. */
  gapC?: number;
  gapW?: number;
  rooms: [number, number | null];
}

const OPEN: RoomKind[] = ['living', 'dining', 'foyer', 'passage', 'lounge'];
const EPS = 0.01;

export const isOpen = (r: Room) => OPEN.includes(r.kind) || !!r.open;

type Edge = 'n' | 's' | 'w' | 'e';

function edgeOf(r: Room, e: Edge) {
  switch (e) {
    case 'n':
      return { fixed: r.y, a: r.x, b: r.x + r.w, horiz: true };
    case 's':
      return { fixed: r.y + r.h, a: r.x, b: r.x + r.w, horiz: true };
    case 'w':
      return { fixed: r.x, a: r.y, b: r.y + r.h, horiz: false };
    case 'e':
      return { fixed: r.x + r.w, a: r.y, b: r.y + r.h, horiz: false };
  }
}

const OPP: Record<Edge, Edge> = { n: 's', s: 'n', w: 'e', e: 'w' };

function overlap(a1: number, b1: number, a2: number, b2: number) {
  return Math.min(b1, b2) - Math.max(a1, a2);
}

export interface FlatLayout {
  rooms: Room[];
  segs: Seg[];
}

const cache = new Map<string, FlatLayout>();

/** Build the wall network for one level of a unit type. Rooms are mirrored when `mirror` is set. */
export function buildLayout(typeId: string, srcRooms: Room[], mirror: boolean, openKitchen = false): FlatLayout {
  const key = `${typeId}|${mirror}|${openKitchen}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const rooms = srcRooms
    .filter((r) => !r.level)
    .map((r) => mirrorRect(openKitchen && r.kind === 'kitchen' ? { ...r, open: true } : r, mirror));
  const outerX = mirror ? FLAT_W : 0;

  const neighbours = (i: number, e: Edge) => {
    const me = edgeOf(rooms[i], e);
    const out: { j: number; a: number; b: number }[] = [];
    rooms.forEach((r, j) => {
      if (j === i) return;
      const o = edgeOf(r, OPP[e]);
      if (Math.abs(o.fixed - me.fixed) > EPS) return;
      const ov = overlap(me.a, me.b, o.a, o.b);
      if (ov > EPS) out.push({ j, a: Math.max(me.a, o.a), b: Math.min(me.b, o.b) });
    });
    return out.sort((p, q) => p.a - q.a);
  };

  const sharedLen = (i: number, j: number) => {
    let len = 0;
    for (const e of ['n', 's', 'w', 'e'] as Edge[]) for (const n of neighbours(i, e)) if (n.j === j) len += n.b - n.a;
    return len;
  };

  // Door pairs
  const pairs = new Set<string>();
  rooms.forEach((r, i) => {
    if (isOpen(r)) return;
    let target = -1;
    if (r.doorTo) {
      const j = rooms.findIndex((q) => q.name === r.doorTo);
      if (j >= 0 && sharedLen(i, j) >= 1.0) target = j;
    }
    if (target < 0) {
      let best = 0;
      rooms.forEach((q, j) => {
        if (j === i || !isOpen(q)) return;
        const l = sharedLen(i, j);
        if (l > best + EPS) {
          best = l;
          target = j;
        }
      });
    }
    if (target >= 0) pairs.add(`${Math.min(i, target)}-${Math.max(i, target)}`);
  });

  const segs: Seg[] = [];
  const push = (horiz: boolean, fixed: number, a: number, b: number, kind: SegKind, i: number, j: number | null, gapW?: number) => {
    const seg: Seg = horiz
      ? { x1: a, y1: fixed, x2: b, y2: fixed, kind, rooms: [i, j] }
      : { x1: fixed, y1: a, x2: fixed, y2: b, kind, rooms: [i, j] };
    if (gapW) {
      seg.gapC = (a + b) / 2;
      seg.gapW = Math.min(gapW, b - a - 0.2);
    }
    segs.push(seg);
  };

  rooms.forEach((r, i) => {
    for (const e of ['n', 's', 'w', 'e'] as Edge[]) {
      const ed = edgeOf(r, e);
      const ns = neighbours(i, e);
      let cursor = ed.a;
      const pieces: { a: number; b: number; j: number | null }[] = [];
      for (const n of ns) {
        if (n.a > cursor + EPS) pieces.push({ a: cursor, b: n.a, j: null });
        pieces.push({ a: n.a, b: n.b, j: n.j });
        cursor = n.b;
      }
      if (ed.b > cursor + EPS) pieces.push({ a: cursor, b: ed.b, j: null });

      for (const p of pieces) {
        const len = p.b - p.a;
        if (p.j === null) {
          if (r.kind === 'balcony') {
            push(ed.horiz, ed.fixed, p.a, p.b, 'railing', i, null);
          } else if (ed.horiz && Math.abs(ed.fixed) < EPS) {
            push(ed.horiz, ed.fixed, p.a, p.b, r.kind === 'foyer' ? 'entry' : 'wall', i, null, r.kind === 'foyer' ? 1.1 : undefined);
          } else if (
            ((ed.horiz && Math.abs(ed.fixed - FLAT_D) < EPS) || (!ed.horiz && Math.abs(ed.fixed - outerX) < EPS)) &&
            len >= 1.4 &&
            r.kind !== 'stair' &&
            r.kind !== 'store'
          ) {
            push(ed.horiz, ed.fixed, p.a, p.b, 'window', i, null, Math.min(len - 0.6, r.kind === 'toilet' ? 0.8 : 2.4));
          } else {
            push(ed.horiz, ed.fixed, p.a, p.b, 'wall', i, null);
          }
          continue;
        }
        const j = p.j;
        const other = rooms[j];
        if (isOpen(r) && isOpen(other)) continue;
        if (j < i) continue;
        if (r.kind === 'balcony' && other.kind === 'balcony') {
          push(ed.horiz, ed.fixed, p.a, p.b, 'railing', i, j);
          continue;
        }
        const pair = pairs.has(`${i}-${j}`);
        const balc = r.kind === 'balcony' || other.kind === 'balcony';
        if (pair) push(ed.horiz, ed.fixed, p.a, p.b, balc ? 'slide' : 'door', i, j, balc ? 2.4 : 0.9);
        else if (balc && len >= 1.4) push(ed.horiz, ed.fixed, p.a, p.b, 'window', i, j, Math.min(len - 0.6, 2.0));
        else push(ed.horiz, ed.fixed, p.a, p.b, 'wall', i, j);
      }
    }
  });

  const layout = { rooms, segs };
  cache.set(key, layout);
  return layout;
}

export interface WallBox {
  /** Centre in drawing plan coords + vertical centre. */
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  mat: 'wall' | 'glass' | 'rail' | 'skirt' | 'frame' | 'sill' | 'block';
  solid: boolean;
}

export const WALL_T = 0.12;
export const EXT_T = 0.2;
export const DOOR_H = 2.1;
const SILL = 0.9;

/** Convert segments into boxes. Plan x → box x, plan y → box z, height → box y. */
export function wallBoxes(segs: Seg[], H: number, detail = true): WallBox[] {
  const out: WallBox[] = [];
  for (const s of segs) {
    const horiz = s.y1 === s.y2;
    const a = horiz ? s.x1 : s.y1;
    const b = horiz ? s.x2 : s.y2;
    const fixed = horiz ? s.y1 : s.x1;
    const T = s.rooms[1] == null && s.kind !== 'railing' ? EXT_T : WALL_T;
    const add = (p: number, q: number, y0: number, y1: number, mat: WallBox['mat'], solid: boolean, thick = T, off = 0) => {
      if (q - p < 0.01 || y1 - y0 < 0.01) return;
      const c = (p + q) / 2;
      const L = q - p;
      out.push(
        horiz
          ? { x: c, z: fixed + off, y: (y0 + y1) / 2, sx: L, sz: thick, sy: y1 - y0, mat, solid }
          : { x: fixed + off, z: c, y: (y0 + y1) / 2, sx: thick, sz: L, sy: y1 - y0, mat, solid },
      );
    };
    const skirt = (p: number, q: number) => detail && add(p, q, 0, 0.09, 'skirt', false, T + 0.03);
    if (s.kind === 'wall') {
      add(a, b, 0, H, 'wall', true);
      skirt(a, b);
    } else if (s.kind === 'railing') {
      const top = Math.min(1.05, H);
      add(a, b, 0, Math.min(0.45, H), 'wall', true, 0.15);
      if (H > 0.45) add(a, b, 0.45, top, 'glass', true, 0.03);
      add(a, b, top - 0.04, Math.min(1.1, H), 'rail', true, 0.07);
    } else {
      const g0 = s.gapC! - s.gapW! / 2;
      const g1 = s.gapC! + s.gapW! / 2;
      add(a, g0, 0, H, 'wall', true);
      add(g1, b, 0, H, 'wall', true);
      skirt(a, g0);
      skirt(g1, b);
      if (s.kind === 'window') {
        add(g0, g1, 0, Math.min(SILL, H), 'wall', true);
        skirt(g0, g1);
        if (H > SILL) {
          add(g0, g1, SILL, Math.min(DOOR_H, H), 'glass', true, 0.02);
          if (detail) {
            add(g0, g1, SILL - 0.04, SILL, 'sill', false, T + 0.08);
            add(g0, g0 + 0.05, SILL, Math.min(DOOR_H, H), 'frame', false, 0.07);
            add(g1 - 0.05, g1, SILL, Math.min(DOOR_H, H), 'frame', false, 0.07);
            add((g0 + g1) / 2 - 0.025, (g0 + g1) / 2 + 0.025, SILL, Math.min(DOOR_H, H), 'frame', false, 0.06);
            if (H > DOOR_H) add(g0, g1, DOOR_H - 0.05, DOOR_H, 'frame', false, 0.07);
          }
        }
        if (H > DOOR_H) add(g0, g1, DOOR_H, H, 'wall', true);
      } else {
        if (H > DOOR_H) add(g0, g1, DOOR_H, H, 'wall', false);
        if (detail && H > DOOR_H) {
          add(g0 - 0.06, g0, 0, DOOR_H + 0.06, 'frame', false, T + 0.04);
          add(g1, g1 + 0.06, 0, DOOR_H + 0.06, 'frame', false, T + 0.04);
          add(g0 - 0.06, g1 + 0.06, DOOR_H, DOOR_H + 0.06, 'frame', false, T + 0.04);
        }
        if (s.kind === 'entry') add(g0, g1, 0, Math.min(DOOR_H, H), 'block', true, 0.06);
      }
    }
  }
  return out;
}
