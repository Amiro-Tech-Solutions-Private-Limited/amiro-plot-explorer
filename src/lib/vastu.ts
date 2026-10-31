import type { Flat, Room } from '../data/types';
import { towerOf, unitOf } from '../data/project';
import { bearingFromVec, bearingLabel, flatFrame, FLAT_D, FLAT_W, planToWorld } from './geometry';

export type Dir8 = ReturnType<typeof bearingLabel> | 'Centre';

export const DIR_LONG: Record<Dir8, string> = {
  N: 'North',
  E: 'East',
  S: 'South',
  W: 'West',
  NE: 'North-East',
  NW: 'North-West',
  SE: 'South-East',
  SW: 'South-West',
  Centre: 'Centre',
};

/** Compass zone of a room's centre within the flat (rooms given in source plan coords). */
export function roomDirection(flat: Flat, room: Room): Dir8 {
  const tower = towerOf(flat);
  const frame = flatFrame(flat.index);
  const [cx, cz] = planToWorld(tower, frame, FLAT_W / 2, FLAT_D / 2);
  const [rx, rz] = planToWorld(tower, frame, room.x + room.w / 2, room.y + room.h / 2);
  const dx = rx - cx;
  const dz = rz - cz;
  if (Math.hypot(dx / FLAT_W, dz / FLAT_D) < 0.14) return 'Centre';
  return bearingLabel(bearingFromVec(dx, dz));
}

const IDEAL: Partial<Record<Room['kind'] | 'master', Dir8[]>> = {
  master: ['SW', 'S', 'W'],
  bed: ['S', 'W', 'NW', 'SW'],
  kitchen: ['SE', 'NW'],
  pooja: ['NE', 'E', 'N'],
  living: ['N', 'E', 'NE', 'Centre'],
  dining: ['W', 'E', 'Centre'],
  toilet: ['NW', 'W', 'S'],
  study: ['W', 'NE', 'E', 'N'],
  balcony: ['N', 'E', 'NE'],
  lounge: ['N', 'E', 'NW', 'Centre'],
  foyer: ['N', 'E', 'NE'],
};

export function isVastuIdeal(room: Room, dir: Dir8) {
  const key = room.kind === 'bed' && room.name.startsWith('Master') ? 'master' : room.kind;
  return IDEAL[key]?.includes(dir) ?? false;
}

const FACING_POINTS: Record<string, number> = { N: 2, E: 2, NE: 2, NW: 1, W: 1, SE: 1, S: 0, SW: 0 };

const FACING_TEXT: Record<string, string> = {
  E: 'East-facing homes receive the first morning sun and are considered among the most auspicious.',
  N: 'North-facing homes are associated with prosperity (Kubera) and get soft, even daylight all day.',
  NE: 'North-east (Ishanya) is the most sacred direction — bright mornings and positive energy.',
  NW: 'North-west (Vayavya) brings good ventilation and is considered favourable for social life.',
  W: 'West-facing homes enjoy evening light and are considered good for stability and gains.',
  SE: 'South-east (Agneya) is ruled by fire — suitable with the right kitchen placement.',
  S: 'South-facing homes can be very good when the entrance pada is chosen correctly.',
  SW: 'South-west (Nairutya) suits heavy, stable functions; needs careful entrance planning.',
};

const PADA: Record<string, string> = {
  E: 'East side: north half — Jayant / Indra padas (3rd–4th from the north-east corner).',
  N: 'North side: Mukhya / Bhallat / Soma padas (3rd–5th from the north-west corner).',
  S: 'South side: Vitatha / Grihakshat padas (3rd–4th from the south-east corner).',
  W: 'West side: Sugriva / Pushpadant padas (3rd–4th from the south-west corner).',
  NE: 'East side near the north-east — Jayant / Indra, or north side — Mukhya / Bhallat.',
  NW: 'North side: Mukhya / Bhallat / Soma — avoid Roga at the north-west corner.',
  SE: 'South side: Vitatha / Grihakshat — avoid Anil at the south-east corner.',
  SW: 'West side: Sugriva / Pushpadant — keep the south-west corner closed.',
};

export interface VastuReport {
  stars: number;
  text: string;
  entranceDir: string;
  pada: string;
  checks: { label: string; ok: boolean; detail: string }[];
}

const cache = new Map<string, VastuReport>();

export function vastuOf(flat: Flat): VastuReport {
  const hit = cache.get(flat.id);
  if (hit) return hit;
  const u = unitOf(flat);
  const rooms = u.rooms.filter((r) => !r.level);
  const find = (pred: (r: Room) => boolean) => rooms.find(pred);
  const check = (label: string, room: Room | undefined) => {
    if (!room) return { label, ok: false, detail: '—' };
    const d = roomDirection(flat, room);
    return { label, ok: isVastuIdeal(room, d), detail: DIR_LONG[d] };
  };
  const checks = [
    check('Kitchen', find((r) => r.kind === 'kitchen')),
    check('Master bedroom', find((r) => r.kind === 'bed' && r.name.startsWith('Master'))),
    check('Pooja', find((r) => r.kind === 'pooja')),
  ];
  const entrance = bearingLabel(flat.facingBearing + 180);
  const stars = Math.max(1, Math.min(5, FACING_POINTS[flat.facing] + checks.filter((c) => c.ok).length));
  const res: VastuReport = {
    stars,
    text: FACING_TEXT[flat.facing],
    entranceDir: entrance,
    pada: PADA[entrance],
    checks,
  };
  cache.set(flat.id, res);
  return res;
}
