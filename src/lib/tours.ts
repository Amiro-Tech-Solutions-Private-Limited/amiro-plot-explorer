import type { Flat, TowerId } from '../data/types';
import { PROJECT, TOWER_BY_ID, towerName, unitOf } from '../data/project';
import { CLUB, GATE_X, POOL, RING, SITE, TRACK, ZONES } from '../data/site';
import { localToWorld, TOWER_HZ } from './geometry';
import { flatXform, planToWorldXZ } from './interiorFrame';
import { roomAt, route } from './route';
import { roomSize } from './format';
import { DIR_LONG, isVastuIdeal, roomDirection } from './vastu';
import { doorPoints, floorFlats, floorRoute, liftFront, type Beat, type Waypoint } from './floor';
import { flatSay, flatSummarySay, floorIntroSay, roomBeats, roomSay } from './narration';

export type { Waypoint };

const BLURB: Record<string, string> = {
  foyer: 'Entrance foyer with shoe storage and video door phone',
  living: 'Spacious living room opening onto the balcony',
  dining: 'Dining area right next to the kitchen',
  kitchen: 'Modular kitchen with chimney, hob and utility access',
  balcony: 'Balcony — step out and enjoy the view',
  study: 'Study — perfect for work from home',
  lounge: 'Family lounge',
  pooja: 'Pooja room',
};

export function roomCaption(flat: Flat, name: string, units: 'sqft' | 'm2' = 'sqft') {
  const src = unitOf(flat).rooms.find((r) => r.name === name && !r.level);
  if (!src) return name;
  const d = roomDirection(flat, src);
  const ok = isVastuIdeal(src, d);
  const blurb = src.kind === 'bed' ? (name.startsWith('Master') ? 'Master bedroom with attached toilet' : 'Bedroom with wardrobe space') : BLURB[src.kind] ?? '';
  return `${name} · ${roomSize(src.w, src.h, units)} · ${DIR_LONG[d]}${ok ? ' ✓ Vastu' : ''}${blurb ? ` — ${blurb}` : ''}`;
}

const ORDER = ['foyer', 'living', 'balcony', 'dining', 'kitchen', 'bed', 'study', 'lounge'];

/** Ordered rooms worth showing in a flat walk-through. */
function showRooms(flat: Flat, short: boolean) {
  const L = flatXform(flat).layout;
  const keep = short ? ['living', 'balcony'] : ORDER;
  return L.rooms
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => keep.includes(r.kind) && !(r.kind === 'balcony' && r.w * r.h < 8))
    .sort((a, b) => ORDER.indexOf(a.r.kind) * 10 + (a.r.name.startsWith('Master') ? 0 : 1) - (ORDER.indexOf(b.r.kind) * 10 + (b.r.name.startsWith('Master') ? 0 : 1)));
}

function roomSteps(flat: Flat, fromRoom: number, short: boolean): { steps: Waypoint[]; last: number } {
  const xf = flatXform(flat);
  const L = xf.layout;
  let cur = fromRoom;
  const steps: Waypoint[] = [];
  for (const { r, i } of showRooms(flat, short)) {
    if (i === cur && r.kind === 'foyer') continue;
    const pts = route(L, cur, i);
    if (!pts.length) pts.push({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
    pts.forEach((p, k) => {
      const [x, z] = planToWorldXZ(xf, p.x, p.y);
      const last = k === pts.length - 1;
      steps.push(last ? { x, z, caption: roomCaption(flat, r.name), say: roomSay(flat, r.name), beats: roomBeats(flat, r.name, short), pause: 0.6 } : { x, z });
    });
    cur = i;
  }
  return { steps, last: cur };
}

/** Room-by-room narrated walk through one flat, ending with a summary. */
export function interiorTour(flat: Flat, from: { x: number; y: number }): Waypoint[] {
  const L = flatXform(flat).layout;
  const start = Math.max(0, roomAt(L, from));
  const { steps } = roomSteps(flat, start, false);
  const end = steps[steps.length - 1];
  if (end) steps.push({ x: end.x, z: end.z, caption: `${flat.id} · tour complete`, say: flatSummarySay(flat), pause: 1 });
  return steps;
}

/** Corridor walk visiting every home on a floor; available homes are entered and shown. */
export function floorTour(tower: TowerId, floor: number, from?: { x: number; z: number }): Waypoint[] {
  const t = TOWER_BY_ID.get(tower)!;
  const flats = floorFlats(tower, floor);
  const lf = liftFront(t, floor);
  const lead = from ? floorRoute(tower, floor, from, null) : [];
  const steps: Waypoint[] = [...lead, { x: lf.x, z: lf.z, caption: `${towerName(tower)} · Floor ${floor}`, say: floorIntroSay(tower, floor, flats), pause: 0.8 }];
  // Visit homes in corridor order starting nearest the lift.
  const order = [...flats].sort((a, b) => {
    const da = doorPoints(a).outside;
    const db = doorPoints(b).outside;
    return Math.hypot(da[0] - lf.x, da[1] - lf.z) - Math.hypot(db[0] - lf.x, db[1] - lf.z);
  });
  for (const f of order) {
    const d = doorPoints(f);
    const say = flatSay(f);
    steps.push({
      x: d.outside[0],
      z: d.outside[1],
      caption: `${f.id} · ${unitOf(f).label} · ${f.status}`,
      say,
      beats: [{ say, focus: [`${f.id}/door::entry`], shot: 'closeup', highlight: 'label', host: 'point' }],
      pause: 0.6,
    });
    if (f.status === 'available') {
      steps.push({ x: d.door[0], z: d.door[1] }, { x: d.inside[0], z: d.inside[1], caption: `Inside ${f.id}`, say: "Let's step inside.", pause: 0.3 });
      const L = flatXform(f).layout;
      const foyer = L.rooms.findIndex((r) => r.kind === 'foyer');
      const { steps: inner, last } = roomSteps(f, foyer, true);
      steps.push(...inner);
      const xf = flatXform(f);
      for (const p of route(L, last, foyer, d.plan)) {
        const [x, z] = planToWorldXZ(xf, p.x, p.y);
        steps.push({ x, z });
      }
      steps.push({ x: d.door[0], z: d.door[1] }, { x: d.outside[0], z: d.outside[1] });
    }
  }
  steps.push({ x: lf.x, z: lf.z, caption: 'Floor tour complete', say: 'That completes this floor. Use the lift panel to visit another floor, or open any home to see its details.', pause: 0.5 });
  return steps;
}

export function siteTour(onArrive?: () => void): Waypoint[] {
  const A1 = TOWER_BY_ID.get('A1')!;
  const [lx, lz] = localToWorld(A1, 0, TOWER_HZ + 7);
  const P = PROJECT;
  const stop = (x: number, z: number, caption: string, beats: Beat[], extra: Partial<Waypoint> = {}): Waypoint => ({
    x,
    z,
    caption,
    say: beats.map((b) => b.say).join(' '),
    beats,
    pause: 0.4,
    ...extra,
  });
  const b = (say: string, focus: string[], shot: Beat['shot'] = 'wide', highlight?: Beat['highlight']): Beat => ({ say, focus, shot, highlight });
  return [
    stop(GATE_X, SITE.maxZ - 6, 'Entrance gateway — signage obelisk, security cabin and boom barrier', [
      b(`Welcome to ${P.name} by Genurise Builders, formerly M J R Builders, in the K I A D B Aerospace Park at Bagalur.`, ['site::gate'], 'closeup'),
      b(`It is a ${P.acres} acre community with two towers, A and B, and the project has received its occupancy certificate, so homes are ready to move in.`, ['site::towerA', 'site::towerB'], 'wide', 'landmarks'),
    ]),
    { x: RING.maxX - 3, z: RING.maxZ - 4 },
    stop(RING.maxX - 3, POOL.z, 'Swimming pool — pool deck, loungers and a separate kids’ pool', [
      b('This is the swimming pool, with a pool deck and loungers.', ['site::pool'], 'closeup'),
      b('Right next to it is a shallow kids pool, so parents can keep an eye on the little ones.', ['site::pool'], 'orbit'),
    ]),
    stop(RING.maxX - 3, ZONES.yoga.z, 'Yoga deck — timber deck under a pergola', [b('Beside the pool is a timber yoga deck under a pergola.', ['site::yoga'], 'closeup')]),
    { x: 14, z: 0 },
    { x: -14, z: 0 },
    stop(-17, CLUB.z + 2, 'Clubhouse — gym, indoor games, billiards, multipurpose hall and terrace deck', [
      b('Between the two towers is the clubhouse, with a gymnasium, indoor games, billiards and table tennis.', ['site::clubhouse'], 'closeup'),
      b('Upstairs there is a multipurpose hall, and the roof is a terrace wooden deck with a pergola.', ['site::clubhouse'], 'overhead'),
    ]),
    { x: -23.5, z: 4 },
    stop(-23.5, ZONES.toddler.z + 4, 'Kids’ zone — stepped seating, toddlers’ sand pit and an EPDM play area', [
      b('The west side is for families. There is a stepped seating gallery,', ['site::seating'], 'closeup'),
      b('a sand pit for toddlers,', ['site::toddler'], 'closeup'),
      b('and a children’s play area on soft E P D M flooring.', ['site::play'], 'closeup'),
    ]),
    stop(-23.5, ZONES.court.z - 2, 'Dribble court, cricket practice pitch and elders’ gym', [
      b('Here is the dribble court for basketball.', ['site::court'], 'closeup'),
      b('Further north are a netted cricket practice pitch, an outdoor gym for elders, work pods and a drivable green for events.', ['site::cricket', 'site::elders', 'site::pods', 'site::lawn'], 'overhead'),
      b('And a jogging path loops right around the whole site.', ['site::court'], 'orbit'),
    ]),
    { x: -23.5, z: TRACK.maxZ - 2 },
    { x: lx + 2, z: TRACK.maxZ - 2 },
    {
      ...stop(lx, lz, 'Tower A lobby — glass lobby under a white portico', [
        b('This is the Tower A lobby, a double-height glass lobby under a white portico.', ['site::towerA'], 'look'),
        b('Up on the terrace of both towers is the elevated sky garden, with landscaped planters, a deck and seating. Let us take the lift up.', ['site::skygarden'], 'overhead'),
      ]),
      action: onArrive,
    },
  ];
}

export { flatXform };
