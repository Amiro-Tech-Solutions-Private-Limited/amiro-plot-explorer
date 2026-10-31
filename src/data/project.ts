import type { Flat, Project, Room, Status, Tower, TowerGroup, TowerId, UnitType, View } from './types';
import { bearingLabel, bearingToRotY, dirFromBearing, flatFrame, FLAT_D, FLAT_W, FLOORS, planToWorld, TOWER_HX } from '../lib/geometry';
import { POOL } from './site';

/** Gap between the two wings of a tower — the deep recessed slot seen on North Park's elevations. */
export const WING_GAP = 3;
const WING_OFF = TOWER_HX + WING_GAP / 2;

/**
 * North Park has two towers, A and B, each a long slab with two lift cores (wings), set
 * diagonally as on the published master plan. Both front façades face east (towards the
 * pool, clubhouse drive and the KIADB Aerospace Park side).
 */
const mkWing = (group: TowerGroup, wing: 1 | 2, cx: number, cz: number, frontBearing: number): Tower => {
  const rot = bearingToRotY(frontBearing);
  // Wing 1 sits at local −x, wing 2 at +x (local x runs along the slab).
  const lx = wing === 1 ? -WING_OFF : WING_OFF;
  return {
    id: `${group}${wing}` as TowerId,
    group,
    wing,
    name: `Tower ${group} · Wing ${wing}`,
    position: [cx + lx * Math.cos(rot), 0, cz - lx * Math.sin(rot)],
    rotationY: rot,
    frontBearing,
    floors: FLOORS,
  };
};

export const TOWER_CENTERS: Record<TowerGroup, [number, number]> = { A: [-6, 33], B: [6, -33] };
export const TOWERS: Tower[] = [
  mkWing('A', 1, ...TOWER_CENTERS.A, 90),
  mkWing('A', 2, ...TOWER_CENTERS.A, 90),
  mkWing('B', 1, ...TOWER_CENTERS.B, 90),
  mkWing('B', 2, ...TOWER_CENTERS.B, 90),
];
export const TOWER_GROUPS: TowerGroup[] = ['A', 'B'];

export const POOL_CENTER: [number, number] = [POOL.x, POOL.z];

const common3BHKLeft: Room[] = [
  { name: 'Bedroom 2', kind: 'bed', x: 0, y: 0, w: 4.2, h: 3.6 },
  { name: 'Master Toilet', kind: 'toilet', x: 0, y: 3.6, w: 2.2, h: 2.4, doorTo: 'Master Bedroom' },
  { name: 'Toilet 2', kind: 'toilet', x: 2.2, y: 3.6, w: 2.0, h: 2.4 },
  { name: 'Master Bedroom', kind: 'bed', x: 0, y: 6.0, w: 4.2, h: 5.0 },
  { name: 'Balcony 2', kind: 'balcony', x: 0, y: 11, w: 4.2, h: 1.2, doorTo: 'Master Bedroom' },
];

const UNIT_TYPES: UnitType[] = [
  {
    id: '2BHK',
    label: '2 BHK',
    short: '2 BHK',
    bhk: 2,
    carpet: 860,
    builtUp: 1090,
    superBuiltUp: 1255,
    balconies: 1,
    carParks: 1,
    rooms: [
      { name: 'Bedroom 2', kind: 'bed', x: 0, y: 0, w: 4.2, h: 3.6 },
      { name: 'Master Toilet', kind: 'toilet', x: 0, y: 3.6, w: 2.2, h: 2.4, doorTo: 'Master Bedroom' },
      { name: 'Toilet 2', kind: 'toilet', x: 2.2, y: 3.6, w: 2.0, h: 2.4 },
      { name: 'Master Bedroom', kind: 'bed', x: 0, y: 6.0, w: 4.2, h: 5.0 },
      { name: 'Foyer', kind: 'foyer', x: 4.2, y: 0, w: 4.4, h: 2.2 },
      { name: 'Dining', kind: 'dining', x: 4.2, y: 2.2, w: 4.4, h: 3.8 },
      { name: 'Living', kind: 'living', x: 4.2, y: 6.0, w: 4.4, h: 5.0 },
      { name: 'Kitchen', kind: 'kitchen', x: 8.6, y: 0, w: 4.4, h: 3.0, doorTo: 'Dining' },
      { name: 'Pooja', kind: 'pooja', x: 8.6, y: 3.0, w: 1.8, h: 1.5, doorTo: 'Dining' },
      { name: 'Utility', kind: 'utility', x: 10.4, y: 3.0, w: 2.6, h: 1.5, doorTo: 'Kitchen' },
      { name: 'Store', kind: 'store', x: 8.6, y: 4.5, w: 4.4, h: 1.5, doorTo: 'Dining' },
      { name: 'Family Lounge', kind: 'lounge', x: 8.6, y: 6.0, w: 4.4, h: 5.0 },
      { name: 'Balcony', kind: 'balcony', x: 4.2, y: 11, w: 8.8, h: 1.6, doorTo: 'Living' },
    ],
  },
  {
    id: '3BHK',
    label: '3 BHK',
    short: '3 BHK',
    bhk: 3,
    carpet: 1160,
    builtUp: 1440,
    superBuiltUp: 1690,
    balconies: 2,
    carParks: 1,
    rooms: [
      ...common3BHKLeft,
      { name: 'Foyer', kind: 'foyer', x: 4.2, y: 0, w: 4.4, h: 2.2 },
      { name: 'Dining', kind: 'dining', x: 4.2, y: 2.2, w: 4.4, h: 3.8 },
      { name: 'Living', kind: 'living', x: 4.2, y: 6.0, w: 4.4, h: 5.0 },
      { name: 'Kitchen', kind: 'kitchen', x: 8.6, y: 0, w: 4.4, h: 3.0, doorTo: 'Dining' },
      { name: 'Pooja', kind: 'pooja', x: 8.6, y: 3.0, w: 1.8, h: 1.5, doorTo: 'Dining' },
      { name: 'Utility', kind: 'utility', x: 10.4, y: 3.0, w: 2.6, h: 1.5, doorTo: 'Kitchen' },
      { name: 'Store', kind: 'store', x: 8.6, y: 4.5, w: 1.8, h: 1.5, doorTo: 'Dining' },
      { name: 'Toilet 3', kind: 'toilet', x: 10.4, y: 4.5, w: 2.6, h: 1.5, doorTo: 'Bedroom 3' },
      { name: 'Bedroom 3', kind: 'bed', x: 8.6, y: 6.0, w: 4.4, h: 5.0, doorTo: 'Living' },
      { name: 'Balcony', kind: 'balcony', x: 4.2, y: 11, w: 8.8, h: 1.6, doorTo: 'Living' },
    ],
  },
  {
    id: '2.5BHK',
    label: '2.5 BHK',
    short: '2.5 BHK',
    bhk: 2,
    carpet: 985,
    builtUp: 1230,
    superBuiltUp: 1430,
    balconies: 1,
    carParks: 1,
    rooms: [
      { name: 'Bedroom 2', kind: 'bed', x: 0, y: 0, w: 4.2, h: 3.6 },
      { name: 'Master Toilet', kind: 'toilet', x: 0, y: 3.6, w: 2.2, h: 2.4, doorTo: 'Master Bedroom' },
      { name: 'Toilet 2', kind: 'toilet', x: 2.2, y: 3.6, w: 2.0, h: 2.4 },
      { name: 'Master Bedroom', kind: 'bed', x: 0, y: 6.0, w: 4.2, h: 5.0 },
      { name: 'Foyer', kind: 'foyer', x: 4.2, y: 0, w: 4.4, h: 2.2 },
      { name: 'Dining', kind: 'dining', x: 4.2, y: 2.2, w: 4.4, h: 3.8 },
      { name: 'Living', kind: 'living', x: 4.2, y: 6.0, w: 4.4, h: 5.0 },
      { name: 'Kitchen', kind: 'kitchen', x: 8.6, y: 0, w: 4.4, h: 3.0, doorTo: 'Dining' },
      { name: 'Pooja', kind: 'pooja', x: 8.6, y: 3.0, w: 1.8, h: 1.5, doorTo: 'Dining' },
      { name: 'Utility', kind: 'utility', x: 10.4, y: 3.0, w: 2.6, h: 1.5, doorTo: 'Kitchen' },
      { name: 'Store', kind: 'store', x: 8.6, y: 4.5, w: 4.4, h: 1.5, doorTo: 'Dining' },
      { name: 'Study', kind: 'study', x: 8.6, y: 6.0, w: 4.4, h: 5.0, doorTo: 'Living' },
      { name: 'Balcony', kind: 'balcony', x: 4.2, y: 11, w: 8.8, h: 1.6, doorTo: 'Living' },
    ],
  },
];

/** Deterministic PRNG so the seed data is stable between reloads. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Indicative base rates (₹/sq ft of super built-up area). */
const BASE_RATE: Record<TowerGroup, number> = { A: 6950, B: 7100 };

/** Unit mix per wing, by position (1 front-left … 4 back-left). Indicative. */
const MIX: Record<1 | 2, Record<1 | 2 | 3 | 4, string>> = {
  1: { 1: '3BHK', 2: '2.5BHK', 3: '3BHK', 4: '2BHK' },
  2: { 1: '2BHK', 2: '3BHK', 3: '2.5BHK', 4: '3BHK' },
};

function buildFlats(): Flat[] {
  const rnd = mulberry32(20260626);
  const flats: Flat[] = [];
  const demand: number[] = [];
  for (const tower of TOWERS) {
    for (let floor = 1; floor <= tower.floors; floor++) {
      for (const index of [1, 2, 3, 4] as const) {
        const typeId = MIX[tower.wing][index];
        const facingBearing = (tower.frontBearing + (index >= 3 ? 180 : 0)) % 360;
        const frame = flatFrame(index);
        const [cx, cz] = planToWorld(tower, frame, FLAT_W / 2, FLAT_D / 2);
        const [dx, dz] = dirFromBearing(facingBearing);
        const tp = [POOL_CENTER[0] - cx, POOL_CENTER[1] - cz];
        const len = Math.hypot(tp[0], tp[1]);
        const towardsPool = (dx * tp[0] + dz * tp[1]) / len > 0.35;
        // East faces the pool / clubhouse drive; west faces the courts, play areas and greens.
        const view: View[] = towardsPool ? ['pool', 'garden'] : index >= 3 ? (floor >= 15 ? ['garden', 'city'] : ['garden']) : floor >= 15 ? ['city', 'road'] : ['road', 'garden'];

        // Demand score: higher floors and pool-facing homes sold first.
        demand.push(rnd() + (floor / tower.floors) * 0.35 + (towardsPool ? 0.25 : 0));
        const status: Status = 'available';
        const no = index + (tower.wing - 1) * 4;

        flats.push({
          id: `${tower.group}-${floor}${String(no).padStart(2, '0')}`,
          tower: tower.id,
          no,
          floor,
          index,
          typeId,
          facing: bearingLabel(facingBearing),
          facingBearing,
          status,
          corner: index === 1 || index === 3,
          view,
          baseRate: BASE_RATE[tower.group] + Math.round(rnd() * 4) * 25,
        });
      }
    }
  }
  // Ready to move in (OC received): most homes are already sold. Indicative mix.
  const order = flats.map((_, i) => i).sort((a, b) => demand[b] - demand[a]);
  const nSold = Math.round(flats.length * 0.58);
  const nBooked = Math.round(flats.length * 0.09);
  order.forEach((i, rank) => {
    flats[i].status = rank < nSold ? 'sold' : rank < nSold + nBooked ? 'booked' : 'available';
  });
  return flats;
}

export const AMENITIES = [
  'Elevated sky garden',
  'Terrace wooden deck',
  'Clubhouse',
  'Swimming pool',
  'Kids’ pool',
  'Pool deck',
  'Gymnasium',
  'Multipurpose hall',
  'Indoor games',
  'Billiards',
  'Table tennis',
  'Work pods',
  'Seating lounge',
  'Dribble / basketball court',
  'Cricket practice pitch',
  'Jogging path loop',
  'Children’s play area (EPDM)',
  'Toddlers’ sand pit',
  'Elders’ outdoor gym',
  'Stepped seating gallery',
  'Yoga area',
  'Chess play area',
  'Drivable green / lawn',
  'Outdoor seating along pathways',
  'Activity area',
];

export const PROJECT: Project = {
  name: 'North Park',
  short: 'NP',
  brand: 'Amiro',
  developer: 'Genurise Builders (formerly MJR Builders)',
  locality: 'KIADB Aerospace Park, Bagalur, North Bengaluru',
  address: 'KIADB Aerospace Park, Bagalur, Bengaluru North',
  rera: 'PRM/KA/RERA/1251/472/PR/050224/006611',
  status: 'Ready to move in · OC received',
  acres: 2.25,
  priceFrom: '₹99 L* onwards',
  configs: 'Studio · 2 BHK · 2.5 BHK · 3 BHK',
  amenities: AMENITIES,
  specs: [
    { title: 'Structure', items: [['Structure', 'RCC framed structure with aluminium formwork']] },
    {
      title: 'Flooring',
      items: [
        ['Living, dining, kitchen, bedrooms', 'Vitrified tiles'],
        ['Toilets, utility, balcony', 'Matt-finish tiles'],
        ['Toilet walls', 'Ceramic tile dado'],
      ],
    },
    {
      title: 'Doors & windows',
      items: [
        ['Main door', 'Engineered wood frame and shutter'],
        ['Bedroom & toilet doors', 'Engineered wood frame and shutter'],
        ['Utility door', 'UPVC'],
        ['Windows', 'UPVC / anodised aluminium, mosquito-mesh provision'],
      ],
    },
    {
      title: 'Kitchen & toilets',
      items: [
        ['Kitchen / utility', 'No platform — plumbing and electrical points provided'],
        ['CP & sanitary', 'American Standard / Jaquar or equivalent'],
        ['Toilet ceiling', 'PVC false ceiling'],
      ],
    },
    {
      title: 'Finishes & electrical',
      items: [
        ['Internal walls / ceilings', 'Emulsion / OBD'],
        ['External', 'Texture paint with emulsion'],
        ['Balcony railing', 'SS railing with glass'],
        ['Switches', 'ABB / Legrand or equivalent'],
        ['Power (2 / 3 BHK)', '3.5 kW + 1.5 kW DG / 4 kW + 2 kW DG'],
      ],
    },
  ],
  contact: {
    phone: '+91 80 4850 7166',
    email: 'projectinfo@genurisebuilders.com',
    office: '#444 Grand, 3rd Floor, 16th Cross, 5th Main, HSR Layout Sector 6, Bengaluru 560102',
    web: 'https://genurisebuilders.com',
  },
  disclaimer:
    'Indicative demo by Amiro. Tower massing follows the published North Park master plan; floor counts, unit plans, areas, prices and availability are placeholders pending the official price list and floor plans.',
  lat: 13.165,
  lng: 77.66,
  towers: TOWERS,
  unitTypes: [...UNIT_TYPES].sort((a, b) => a.superBuiltUp - b.superBuiltUp),
  flats: buildFlats(),
  pricing: {
    floorRisePerFloor: 25,
    cornerPLC: 100,
    poolViewPLC: 150,
    parking: 350000,
    club: 250000,
    gstPct: 5,
    stampPct: 6.6,
  },
};

export const FLAT_BY_ID = new Map(PROJECT.flats.map((f) => [f.id, f]));
export const UNIT_BY_ID = new Map(PROJECT.unitTypes.map((u) => [u.id, u]));
export const TOWER_BY_ID = new Map(PROJECT.towers.map((t) => [t.id, t]));

export const towerOf = (f: Flat) => TOWER_BY_ID.get(f.tower)!;
export const unitOf = (f: Flat) => UNIT_BY_ID.get(f.typeId)!;
/** "Tower A · Wing 2" */
export const towerName = (id: TowerId) => TOWER_BY_ID.get(id)?.name ?? `Tower ${id}`;
