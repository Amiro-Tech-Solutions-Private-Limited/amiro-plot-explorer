import type { Room } from '../data/types';
import type { Anchor, Furnished, Piece } from './furniture';
import type { FlatLayout } from './walls';
import { CATALOG_BY_ID, FEATURE_CATEGORY, type Category } from './catalog';

/** Per-feature change to the generated furniture (all in drawing-plan metres / radians). */
export interface FeatureEdit {
  dx: number;
  dz: number;
  rot: number;
  removed?: boolean;
  /** Catalogue id this feature was swapped for. */
  replace?: string;
  color?: string;
}

export interface AddedItem {
  uid: string;
  cat: string;
  room: string;
  x: number;
  z: number;
  rot: number;
  color?: string;
  size?: { w: number; d: number; h: number };
}

export interface FlatDesign {
  rev: number;
  edits: Record<string, FeatureEdit>;
  added: AddedItem[];
}

export const EMPTY_DESIGN: FlatDesign = { rev: 0, edits: {}, added: [] };

/** A movable furniture group: a tagged feature (e.g. "Living::sofa") or an added item. */
export interface Group {
  key: string;
  room: string;
  feature: string;
  category: Category | null;
  label: string;
  /** Footprint centre and half-size in the group's own frame, plus rotation (plan). */
  cx: number;
  cz: number;
  hx: number;
  hz: number;
  rot: number;
  h: number;
  /** Direction the front faces (radians, plan; 0 = +z). */
  front: number;
  added?: AddedItem;
  catalog?: string;
}

const NON_MOVABLE = new Set(['ceiling', 'window', 'ac', 'art', 'chimney', 'hob', 'sink', 'counter', 'cabinets', 'purifier', 'microwave', 'wc', 'basin', 'geyser', 'shower', 'washer', 'mandir']);

export const isMovable = (feature: string) => !NON_MOVABLE.has(feature.split('#')[0]);

const rotXZ = (x: number, z: number, cx: number, cz: number, a: number): [number, number] => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const dx = x - cx;
  const dz = z - cz;
  return [cx + dx * c + dz * s, cz - dx * s + dz * c];
};

function bbox(pieces: Piece[]) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  let y1 = 0;
  for (const p of pieces) {
    // Account for the piece's own rotation in the footprint.
    const c = Math.abs(Math.cos(p.ry ?? 0));
    const s = Math.abs(Math.sin(p.ry ?? 0));
    const ex = (p.sx * c + p.sz * s) / 2;
    const ez = (p.sx * s + p.sz * c) / 2;
    x0 = Math.min(x0, p.x - ex);
    x1 = Math.max(x1, p.x + ex);
    z0 = Math.min(z0, p.z - ez);
    z1 = Math.max(z1, p.z + ez);
    y1 = Math.max(y1, p.y + p.sy / 2);
  }
  return { x0, x1, z0, z1, y1 };
}

/** Front of a generated feature: towards the room centre, snapped to the nearest axis. */
function frontOf(r: Room | undefined, cx: number, cz: number) {
  if (!r) return 0;
  const dx = r.x + r.w / 2 - cx;
  const dz = r.y + r.h / 2 - cz;
  return Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? Math.PI / 2 : -Math.PI / 2) : dz > 0 ? 0 : Math.PI;
}

function placeCatalog(id: string, color: string | undefined, x: number, z: number, rot: number, tag: string, size?: AddedItem['size']): Piece[] {
  const item = CATALOG_BY_ID.get(id);
  if (!item) return [];
  return item.build(color ?? item.colors[0], size).map((p) => {
    const [px, pz] = rotXZ(p.x + x, p.z + z, x, z, rot);
    return { ...p, x: px, z: pz, ry: (p.ry ?? 0) + rot, tag };
  });
}

/** Apply a design to generated furniture. Pure: returns new arrays. */
export function applyDesign(f: Furnished, layout: FlatLayout, d: FlatDesign | undefined): Furnished {
  if (!d || (!Object.keys(d.edits).length && !d.added.length)) return f;
  const byTag = new Map<string, Piece[]>();
  for (const p of f.pieces) if (p.tag) (byTag.get(p.tag) ?? byTag.set(p.tag, []).get(p.tag)!).push(p);
  const out: Piece[] = [];
  const moved = new Map<string, { cx: number; cz: number; e: FeatureEdit; box: ReturnType<typeof bbox> }>();
  for (const [tag, list] of byTag) {
    const e = d.edits[tag];
    if (e) moved.set(tag, { ...centreOf(list), e, box: bbox(list) });
  }
  for (const p of f.pieces) {
    const m = p.tag ? moved.get(p.tag) : undefined;
    if (!m) {
      out.push(p);
      continue;
    }
    if (m.e.removed || m.e.replace) continue;
    const [x, z] = rotXZ(p.x, p.z, m.cx, m.cz, m.e.rot);
    out.push({ ...p, x: x + m.e.dx, z: z + m.e.dz, ry: (p.ry ?? 0) + m.e.rot, color: m.e.color && p.mat === 'fabric' ? m.e.color : p.color });
  }
  for (const [tag, m] of moved) {
    if (!m.e.replace || m.e.removed) continue;
    const [room] = tag.split('::');
    const r = layout.rooms.find((q) => q.name === room);
    out.push(...placeCatalog(m.e.replace, m.e.color, m.cx + m.e.dx, m.cz + m.e.dz, frontOf(r, m.cx, m.cz) + m.e.rot, tag));
  }
  for (const a of d.added) out.push(...placeCatalog(a.cat, a.color, a.x, a.z, a.rot, `${a.room}::${CATALOG_BY_ID.get(a.cat)?.category ?? 'item'}#${a.uid}`, a.size));

  // People sitting on / standing at moved furniture move with it.
  const anchors: Furnished['anchors'] = {};
  for (const [k, a] of Object.entries(f.anchors) as [keyof Furnished['anchors'], Anchor][]) {
    let next: Anchor | null = a;
    for (const m of moved.values()) {
      const b = m.box;
      if (a.x > b.x0 - 0.7 && a.x < b.x1 + 0.7 && a.z > b.z0 - 0.7 && a.z < b.z1 + 0.7) {
        if (m.e.removed || m.e.replace) next = null;
        else {
          const [x, z] = rotXZ(a.x, a.z, m.cx, m.cz, m.e.rot);
          next = { x: x + m.e.dx, z: z + m.e.dz, ry: a.ry + m.e.rot };
        }
        break;
      }
    }
    if (next) anchors[k] = next;
  }
  return { ...f, pieces: out, anchors };
}

function centreOf(list: Piece[]) {
  const b = bbox(list);
  return { cx: (b.x0 + b.x1) / 2, cz: (b.z0 + b.z1) / 2 };
}

/** Movable groups in a flat after the design is applied (for picking, outlines and metrics). */
export function groupsOf(pieces: Piece[], layout: FlatLayout, d: FlatDesign | undefined): Group[] {
  const byTag = new Map<string, Piece[]>();
  for (const p of pieces) if (p.tag) (byTag.get(p.tag) ?? byTag.set(p.tag, []).get(p.tag)!).push(p);
  const out: Group[] = [];
  for (const [tag, list] of byTag) {
    const [room, feature] = tag.split('::');
    if (!isMovable(feature)) continue;
    const base = feature.split('#')[0];
    const uid = feature.includes('#') ? feature.split('#')[1] : null;
    const added = uid ? d?.added.find((a) => a.uid === uid) : undefined;
    const e = d?.edits[tag];
    const catId = added?.cat ?? e?.replace;
    const cat = catId ? CATALOG_BY_ID.get(catId) : undefined;
    const r = layout.rooms.find((q) => q.name === room);
    if (cat) {
      // Known catalogue item: exact footprint and orientation.
      const rot = added ? added.rot : 0;
      const b = bbox(list);
      const cx = added ? added.x : (b.x0 + b.x1) / 2;
      const cz = added ? added.z : (b.z0 + b.z1) / 2;
      const size = added?.size ?? cat;
      const fr = added ? rot : frontOf(r, cx - (e?.dx ?? 0), cz - (e?.dz ?? 0)) + (e?.rot ?? 0);
      out.push({ key: tag, room, feature: base, category: cat.category, label: cat.name, cx, cz, hx: size.w / 2, hz: size.d / 2, rot: fr, h: size.h, front: fr, added, catalog: cat.id });
      continue;
    }
    // Generated feature: axis-aligned bounds of its (possibly rotated) pieces.
    const low = list.filter((p) => p.y - p.sy / 2 < 1.6);
    const b = bbox(low.length ? low : list);
    const cx = (b.x0 + b.x1) / 2;
    const cz = (b.z0 + b.z1) / 2;
    out.push({
      key: tag,
      room,
      feature: base,
      category: FEATURE_CATEGORY[base] ?? null,
      label: base.charAt(0).toUpperCase() + base.slice(1),
      cx,
      cz,
      hx: (b.x1 - b.x0) / 2,
      hz: (b.z1 - b.z0) / 2,
      rot: 0,
      h: b.y1,
      front: frontOf(r, cx - (e?.dx ?? 0), cz - (e?.dz ?? 0)) + (e?.rot ?? 0),
    });
  }
  return out;
}

/** Corners of a group's footprint (plan). */
export function corners(g: Group): [number, number][] {
  return [
    [-g.hx, -g.hz],
    [g.hx, -g.hz],
    [g.hx, g.hz],
    [-g.hx, g.hz],
  ].map(([x, z]) => rotXZ(g.cx + x, g.cz + z, g.cx, g.cz, g.rot));
}

function insideGroup(g: Group, x: number, z: number, pad = 0) {
  const [lx, lz] = rotXZ(x, z, g.cx, g.cz, -g.rot);
  return Math.abs(lx - g.cx) < g.hx + pad && Math.abs(lz - g.cz) < g.hz + pad;
}

export interface RoomSpace {
  area: number;
  used: number;
  free: number;
  pct: number;
}

/** Free floor area in a room: room area minus furniture footprints (sampled on a 10 cm grid). */
export function roomSpace(r: Room, groups: Group[]): RoomSpace {
  const inRoom = groups.filter((g) => g.room === r.name && g.category !== 'rug' && g.h > 0.05);
  const step = 0.1;
  let used = 0;
  let n = 0;
  for (let x = r.x + step / 2; x < r.x + r.w; x += step) {
    for (let z = r.y + step / 2; z < r.y + r.h; z += step) {
      n++;
      if (inRoom.some((g) => insideGroup(g, x, z))) used++;
    }
  }
  const area = r.w * r.h;
  const u = (used / Math.max(1, n)) * area;
  return { area, used: u, free: area - u, pct: (u / area) * 100 };
}

export interface Clearance {
  dir: 'front' | 'back' | 'left' | 'right';
  /** Gap in metres to the nearest wall or furniture, measured from the footprint edge. */
  gap: number;
  from: [number, number];
  to: [number, number];
}

/** Gaps from a group's four sides to the nearest wall (room edge) or other furniture. */
export function clearances(g: Group, r: Room, groups: Group[]): Clearance[] {
  const others = groups.filter((o) => o.key !== g.key && o.room === g.room && o.category !== 'rug');
  const sides: [Clearance['dir'], number][] = [
    ['front', 0],
    ['right', -Math.PI / 2],
    ['back', Math.PI],
    ['left', Math.PI / 2],
  ];
  return sides.map(([dir, off]) => {
    const a = g.front + off;
    const dx = Math.sin(a);
    const dz = Math.cos(a);
    // Edge midpoint along that direction (group frame may differ from front frame).
    const la = a - g.rot;
    const ext = Math.abs(Math.sin(la)) * g.hx + Math.abs(Math.cos(la)) * g.hz;
    const sx = g.cx + dx * ext;
    const sz = g.cz + dz * ext;
    let t = 0;
    const max = 6;
    for (; t < max; t += 0.02) {
      const x = sx + dx * t;
      const z = sz + dz * t;
      if (x < r.x || x > r.x + r.w || z < r.y || z > r.y + r.h) break;
      if (others.some((o) => insideGroup(o, x, z))) break;
    }
    return { dir, gap: Math.max(0, t), from: [sx, sz], to: [sx + dx * t, sz + dz * t] };
  });
}

/** Recommended walking clearance in front of furniture (m). */
export const MIN_CLEAR: Partial<Record<Category, number>> = { sofa: 0.75, bed: 0.6, wardrobe: 0.75, dining: 0.6, desk: 0.75, tv: 0.9, storage: 0.6 };

export interface DoorSwing {
  /** Hinge point (plan). The closed leaf runs along +x (horizontal wall) or +z (vertical wall). */
  x: number;
  z: number;
  r: number;
  horiz: boolean;
  /** +1 / -1: which side of the wall the leaf opens to. */
  into: number;
  blocked: boolean;
}

/** Door swing quadrants for a room, flagged when furniture sits in the door's path. */
export function doorSwings(layout: FlatLayout, r: Room, groups: Group[]): DoorSwing[] {
  const ri = layout.rooms.indexOf(r);
  const out: DoorSwing[] = [];
  for (const s of layout.segs) {
    if ((s.kind !== 'door' && s.kind !== 'entry') || !s.gapC || !s.gapW || !s.rooms.includes(ri)) continue;
    const horiz = s.y1 === s.y2;
    const w = s.gapW;
    // Swing into this room.
    const into = horiz ? (r.y + r.h / 2 > s.y1 ? 1 : -1) : r.x + r.w / 2 > s.x1 ? 1 : -1;
    const hx = horiz ? s.gapC - w / 2 : s.x1;
    const hz = horiz ? s.y1 : s.gapC - w / 2;
    let blocked = false;
    for (let k = 1; k <= 6 && !blocked; k++) {
      for (let q = 0; q <= 6 && !blocked; q++) {
        const rad = (w * k) / 6;
        const ang = (q / 6) * (Math.PI / 2);
        const x = horiz ? hx + Math.cos(ang) * rad : hx + into * Math.sin(ang) * rad;
        const z = horiz ? hz + into * Math.sin(ang) * rad : hz + Math.cos(ang) * rad;
        if (groups.some((g) => g.room === r.name && g.category !== 'rug' && insideGroup(g, x, z))) blocked = true;
      }
    }
    out.push({ x: hx, z: hz, r: w, horiz, into, blocked });
  }
  return out;
}

export const newUid = () => Math.random().toString(36).slice(2, 8);

/** Compact URL-safe encoding for sharing a design. */
export function encodeDesign(d: FlatDesign) {
  const json = JSON.stringify({ e: d.edits, a: d.added });
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeDesign(s: string): FlatDesign | null {
  try {
    const json = decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
    const o = JSON.parse(json) as { e?: Record<string, FeatureEdit>; a?: AddedItem[] };
    const edits: Record<string, FeatureEdit> = {};
    for (const [k, v] of Object.entries(o.e ?? {})) {
      if (typeof k !== 'string' || k.length > 80 || typeof v !== 'object' || !v) continue;
      edits[k] = {
        dx: clampNum(v.dx, -15, 15),
        dz: clampNum(v.dz, -15, 15),
        rot: clampNum(v.rot, -10, 10),
        removed: !!v.removed || undefined,
        replace: typeof v.replace === 'string' && CATALOG_BY_ID.has(v.replace) ? v.replace : undefined,
        color: typeof v.color === 'string' && /^#[0-9a-f]{6}$/i.test(v.color) ? v.color : undefined,
      };
    }
    const added: AddedItem[] = (o.a ?? [])
      .filter((a) => a && typeof a.cat === 'string' && CATALOG_BY_ID.has(a.cat) && typeof a.room === 'string' && a.room.length < 40)
      .slice(0, 40)
      .map((a) => ({
        uid: String(a.uid).replace(/[^a-z0-9]/gi, '').slice(0, 8) || newUid(),
        cat: a.cat,
        room: a.room,
        x: clampNum(a.x, -2, 16),
        z: clampNum(a.z, -2, 16),
        rot: clampNum(a.rot, -10, 10),
        color: typeof a.color === 'string' && /^#[0-9a-f]{6}$/i.test(a.color) ? a.color : undefined,
        size: a.size ? { w: clampNum(a.size.w, 0.1, 4), d: clampNum(a.size.d, 0.1, 4), h: clampNum(a.size.h, 0.05, 2.8) } : undefined,
      }));
    return { rev: 1, edits, added };
  } catch {
    return null;
  }
}

function clampNum(v: unknown, lo: number, hi: number) {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : 0;
  return Math.min(hi, Math.max(lo, n));
}
