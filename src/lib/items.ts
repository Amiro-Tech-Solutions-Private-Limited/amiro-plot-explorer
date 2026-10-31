import type { Flat } from '../data/types';
import { FLAT_BY_ID, TOWER_BY_ID, TOWER_CENTERS, TOWER_GROUPS } from '../data/project';
import { CLUB, GATE_X, POOL, SITE, ZONES } from '../data/site';
import { profileWithTheme } from '../data/interiors';
import { useStore } from '../store/useStore';
import { flatXform, furnishedOf, planToWorldXZ } from './interiorFrame';
import { dirFromBearing, ROOF_Y } from './geometry';
import { doorPoints } from './floor';

export type V3 = [number, number, number];

/** Something a tour can frame, highlight and talk about. */
export interface Item {
  id: string;
  label: string;
  spec?: string;
  center: V3;
  /** Size in the item's own frame (x along plan x, y up, z along plan y). */
  size: V3;
  rotY: number;
  /** Suggested camera position for a close look. */
  view: V3;
  flatId?: string;
  room?: string;
  kind: 'feature' | 'room' | 'door' | 'view' | 'site';
  /** Room rectangle corners in world space (rooms only). */
  corners?: [number, number][];
  floorY?: number;
}

const LABEL: Record<string, [string, string?]> = {
  sofa: ['Sofa set', 'L-shaped seating for 5–6'],
  tv: ['TV wall', 'Accent panel with TV and cable points'],
  ac: ['Split AC point', '1.5 ton, with outdoor unit ledge'],
  art: ['Wall art'],
  plant: ['Indoor plants'],
  ceiling: ['False ceiling', 'Gypsum with warm LED cove lighting'],
  window: ['Window', 'UPVC / anodised aluminium, mosquito-mesh provision'],
  table: ['Dining table', 'Fits a 6-seater comfortably'],
  crockery: ['Crockery unit'],
  counter: ['Kitchen counter', 'Sample-home fit-out · handover has plumbing & electrical points'],
  sink: ['Steel sink', 'Sample-home fit-out'],
  hob: ['Gas hob', '3-burner, toughened glass'],
  chimney: ['Chimney', 'Auto-clean, 1200 m³/h suction'],
  cabinets: ['Wall cabinets', 'Soft-close shutters'],
  purifier: ['RO water purifier point'],
  microwave: ['Microwave'],
  fridge: ['Refrigerator space', 'Up to 600 L double door'],
  bed: ['Bed', 'Space for a king-size bed'],
  wardrobe: ['Wardrobe', 'Full-height with loft storage'],
  dressing: ['Dressing table'],
  wc: ['Wall-hung WC', 'American Standard / Jaquar or equivalent'],
  basin: ['Wash basin', 'American Standard / Jaquar CP fittings'],
  geyser: ['Geyser point', '25 L storage'],
  shower: ['Shower area', 'Glass partition with rain shower'],
  mandir: ['Pooja mandir', 'Teak finish with diya shelf'],
  washer: ['Washing machine point', 'UPVC utility door · inlet and drain'],
  desk: ['Study desk', 'Data and power points'],
  bookshelf: ['Bookshelf'],
  seating: ['Balcony seating'],
  coffee: ['Coffee table', 'Travertine top on walnut blocks'],
  rug: ['Rug'],
  plants: ['Balcony planters'],
  shoerack: ['Shoe cabinet', 'With mirror and key bowl'],
};

const cache = new Map<string, Map<string, Item>>();

/** All items of one flat: tagged furniture/fixtures, rooms, entry door and balcony view. */
export function flatItems(flat: Flat): Map<string, Item> {
  const s = useStore.getState();
  const key = `${flat.id}|${s.furnishing}|${s.themes[flat.id] ?? ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const xf = flatXform(flat);
  const L = xf.layout;
  const out = new Map<string, Item>();
  const w = (px: number, py: number) => planToWorldXZ(xf, px, py);

  // Group tagged pieces into features with plan-space bounding boxes.
  const boxes = new Map<string, { x0: number; x1: number; z0: number; z1: number; y0: number; y1: number }>();
  for (const p of furnishedOf(flat, s.furnishing, s.themes[flat.id]).pieces) {
    if (!p.tag) continue;
    const b = boxes.get(p.tag) ?? { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity, y0: Infinity, y1: -Infinity };
    b.x0 = Math.min(b.x0, p.x - p.sx / 2);
    b.x1 = Math.max(b.x1, p.x + p.sx / 2);
    b.z0 = Math.min(b.z0, p.z - p.sz / 2);
    b.z1 = Math.max(b.z1, p.z + p.sz / 2);
    b.y0 = Math.min(b.y0, p.y - p.sy / 2);
    b.y1 = Math.max(b.y1, p.y + p.sy / 2);
    boxes.set(p.tag, b);
  }
  for (const [tag, b] of boxes) {
    const [room, feature] = tag.split('::');
    const r = L.rooms.find((q) => q.name === room);
    if (!r) continue;
    const cx = (b.x0 + b.x1) / 2;
    const cz = (b.z0 + b.z1) / 2;
    // Look from the room side opposite the item, kept inside the room.
    let dx = r.x + r.w / 2 - cx;
    let dz = r.y + r.h / 2 - cz;
    const dl = Math.hypot(dx, dz);
    if (dl < 0.3) {
      dx = 0.7;
      dz = 0.7;
    }
    const n = Math.hypot(dx, dz);
    const rad = Math.hypot(b.x1 - b.x0, b.z1 - b.z0, b.y1 - b.y0) / 2;
    const dist = Math.min(Math.max(rad * 2 + 0.7, 1.3), Math.hypot(r.w, r.h) * 0.6);
    const vx = Math.min(Math.max(cx + (dx / n) * dist, r.x + 0.35), r.x + r.w - 0.35);
    const vz = Math.min(Math.max(cz + (dz / n) * dist, r.y + 0.35), r.y + r.h - 0.35);
    const cy = (b.y0 + b.y1) / 2;
    const [wx, wz] = w(cx, cz);
    const [vwx, vwz] = w(vx, vz);
    const [label, spec] = LABEL[feature] ?? [feature];
    const id = `${flat.id}/${tag}`;
    out.set(id, {
      id,
      label: feature === 'ceiling' || feature === 'window' ? `${room} ${label.toLowerCase()}` : label,
      spec,
      center: [wx, xf.baseY + cy, wz],
      size: [b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0],
      rotY: xf.rot,
      view: [vwx, xf.baseY + Math.min(Math.max(cy + 0.55, 1.3), 1.85), vwz],
      flatId: flat.id,
      room,
      kind: 'feature',
    });
  }

  for (const r of L.rooms) {
    const [cx, cz] = w(r.x + r.w / 2, r.y + r.h / 2);
    const corners: [number, number][] = [w(r.x, r.y), w(r.x + r.w, r.y), w(r.x + r.w, r.y + r.h), w(r.x, r.y + r.h)];
    const id = `${flat.id}/${r.name}::room`;
    out.set(id, {
      id,
      label: r.name,
      center: [cx, xf.baseY + 1.2, cz],
      size: [r.w, 2.9, r.h],
      rotY: xf.rot,
      view: [cx, xf.baseY + 1.6, cz],
      flatId: flat.id,
      room: r.name,
      kind: 'room',
      corners,
      floorY: xf.baseY,
    });
    if (r.kind === 'balcony') {
      const [fx, fz] = dirFromBearing(flat.facingBearing);
      const [bx, bz] = w(r.x + r.w / 2, r.y + r.h * 0.7);
      const vid = `${flat.id}/${r.name}::view`;
      out.set(vid, {
        id: vid,
        label: 'View',
        center: [bx + fx * 40, xf.baseY - 4, bz + fz * 40],
        size: [1, 1, 1],
        rotY: 0,
        view: [bx, xf.baseY + 1.6, bz],
        flatId: flat.id,
        room: r.name,
        kind: 'view',
      });
    }
  }

  const d = doorPoints(flat);
  const did = `${flat.id}/door::entry`;
  out.set(did, {
    id: did,
    label: `Flat ${flat.id}`,
    spec: 'Engineered wood frame and shutter, with name plate',
    center: [d.door[0], xf.baseY + 1.1, d.door[1]],
    size: [1.1, 2.1, 0.1],
    rotY: xf.rot,
    view: [d.outside[0] + (d.outside[0] - d.door[0]) * 0.6, xf.baseY + 1.6, d.outside[1] + (d.outside[1] - d.door[1]) * 0.6],
    flatId: flat.id,
    kind: 'door',
  });
  cache.set(key, out);
  return out;
}

const SITE_ITEMS: Record<string, { label: string; spec?: string; c: V3; r: number }> = {
  gate: { label: 'Entrance gateway', spec: 'Signage obelisk · security cabin · boom barrier', c: [GATE_X, 3, SITE.maxZ], r: 12 },
  clubhouse: { label: 'Clubhouse', spec: 'Gym · indoor games · billiards · multipurpose hall · terrace deck', c: [CLUB.x, 5, CLUB.z], r: 16 },
  pool: { label: 'Swimming pool', spec: 'Pool · kids’ pool · pool deck', c: [POOL.x, 0.5, POOL.z], r: 15 },
  ...Object.fromEntries(Object.values(ZONES).map((z) => [z.id, { label: z.label, spec: z.spec, c: [z.x, 1, z.z] as V3, r: Math.max(8, Math.max(z.w, z.d) * 0.9) }])),
};

export function getItem(id: string): Item | null {
  if (id.startsWith('site::')) {
    const k = id.slice(6);
    if (k.startsWith('tower')) {
      const g = k.slice(5) as 'A' | 'B';
      const c = TOWER_CENTERS[g];
      if (!c) return null;
      const t = TOWER_BY_ID.get(`${g}1`)!;
      return { id, label: `Tower ${g}`, spec: `G + ${t.floors} · two lift cores · sky garden on the terrace`, center: [c[0], 30, c[1]], size: [60, 40, 60], rotY: 0, view: [c[0], 1.7, c[1]], kind: 'site' };
    }
    if (k === 'skygarden') {
      const c = TOWER_CENTERS.A;
      return { id, label: 'Elevated sky garden', spec: 'Terrace landscape · deck · pergolas · seating', center: [c[0], ROOF_Y + 1, c[1]], size: [30, 10, 30], rotY: 0, view: [c[0], 1.7, c[1]], kind: 'site' };
    }
    const s = SITE_ITEMS[k];
    return s ? { id, label: s.label, spec: s.spec, center: s.c, size: [s.r, s.r / 2, s.r], rotY: 0, view: s.c, kind: 'site' } : null;
  }
  const flatId = id.split('/')[0];
  const flat = FLAT_BY_ID.get(flatId);
  return flat ? flatItems(flat).get(id) ?? null : null;
}

export function itemId(flat: Flat, room: string, feature: string) {
  const id = `${flat.id}/${room}::${feature}`;
  return flatItems(flat).has(id) ? id : null;
}

/** Landmarks for the balcony-view overlay. */
export function landmarks(): { label: string; pos: V3 }[] {
  return [
    { label: 'Swimming pool', pos: [POOL.x, 1, POOL.z] },
    { label: 'Clubhouse', pos: [CLUB.x, 11, CLUB.z] },
    { label: 'Kids’ play area', pos: [ZONES.play.x, 3, ZONES.play.z] },
    { label: 'Dribble court', pos: [ZONES.court.x, 4, ZONES.court.z] },
    { label: 'Entrance gateway', pos: [GATE_X, 6, SITE.maxZ] },
    ...TOWER_GROUPS.map((g) => ({ label: `Tower ${g}`, pos: [TOWER_CENTERS[g][0], ROOF_Y + 6, TOWER_CENTERS[g][1]] as V3 })),
  ];
}

export function themeSpec(flat: Flat) {
  return profileWithTheme(flat, useStore.getState().themes[flat.id]).theme;
}
