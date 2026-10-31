import type { Flat, RoomKind } from './types';

export interface Theme {
  id: string;
  name: string;
  floorLiving: string;
  floorBed: string;
  floorWet: string;
  floorKitchen: string;
  walls: string[];
  accentWall: string;
  wood: string;
  woodLight: string;
  cabinet: string;
  counter: string;
  sofa: string;
  fabric: string;
  accent: string;
  curtain: string;
  rug: string;
  metal: string;
  spec: { living: string; bed: string; wet: string; kitchen: string };
}

export const THEMES: Theme[] = [
  {
    // Matched to Genurise's North Park living/dining, master bedroom and bathroom renders.
    id: 'northpark',
    name: 'North Park sample flat',
    floorLiving: '#ebe5da',
    floorBed: '#e7e0d4',
    floorWet: '#9c8466',
    floorKitchen: '#e6e0d5',
    walls: ['#f2efe9', '#efebe4'],
    accentWall: '#2f2d2b',
    wood: '#4f3526',
    woodLight: '#8a5d3e',
    cabinet: '#8e9a95',
    counter: '#ece8e1',
    sofa: '#d3cdc3',
    fabric: '#e7e1d7',
    accent: '#b5643d',
    curtain: '#8a6f55',
    rug: '#c9bdaa',
    metal: '#c9a14a',
    spec: { living: 'Large-format vitrified tiles', bed: 'Vitrified tiles', wet: 'Matt anti-skid tiles · marble-look dado', kitchen: 'Vitrified tiles · quartz-look counter' },
  },
  {
    id: 'modern',
    name: 'Modern',
    floorLiving: '#e9e6e1',
    floorBed: '#b58a63',
    floorWet: '#9aa7b0',
    floorKitchen: '#d3cfc8',
    walls: ['#f4f2ee', '#eef0f1', '#f1ede6'],
    accentWall: '#3f4c5a',
    wood: '#6b4e37',
    woodLight: '#c9a37a',
    cabinet: '#2f3a45',
    counter: '#1c1c1e',
    sofa: '#7b8794',
    fabric: '#e7e1d7',
    accent: '#d97a3a',
    curtain: '#cfc6b8',
    rug: '#9ea7ad',
    metal: '#c9ced3',
    spec: { living: '800×800 vitrified tiles', bed: 'Oak laminated wood', wet: 'Anti-skid ceramic tiles', kitchen: 'Vitrified tiles, granite counter' },
  },
  {
    id: 'warm',
    name: 'Warm Wood',
    floorLiving: '#d9c3a5',
    floorBed: '#9c6b43',
    floorWet: '#b7a58e',
    floorKitchen: '#cdb898',
    walls: ['#f3e9da', '#efe3d1', '#f6ede0'],
    accentWall: '#8a5a3c',
    wood: '#7a4b2a',
    woodLight: '#b9875a',
    cabinet: '#8d5d3a',
    counter: '#3b2f2a',
    sofa: '#a8754f',
    fabric: '#efe2cf',
    accent: '#c0392b',
    curtain: '#d8b98f',
    rug: '#a0522d',
    metal: '#b08d57',
    spec: { living: 'Wood-finish vitrified planks', bed: 'Teak engineered wood', wet: 'Matt terracotta tiles', kitchen: 'Wood-finish tiles, Black Galaxy granite' },
  },
  {
    id: 'minimal',
    name: 'Minimal White',
    floorLiving: '#f2f2f0',
    floorBed: '#d9cfc2',
    floorWet: '#dfe3e6',
    floorKitchen: '#ececea',
    walls: ['#fbfbfa', '#f7f7f6', '#f9f8f6'],
    accentWall: '#d8d6d2',
    wood: '#b9a58e',
    woodLight: '#e2d6c6',
    cabinet: '#f4f4f2',
    counter: '#e8e6e3',
    sofa: '#d6d2cc',
    fabric: '#ffffff',
    accent: '#2f80ed',
    curtain: '#f2f0ec',
    rug: '#d9d4cc',
    metal: '#dfe3e6',
    spec: { living: 'Italian marble-finish 1200×600', bed: 'Light ash laminate', wet: 'Large-format matt tiles', kitchen: 'Quartz counter, white lacquer' },
  },
  {
    id: 'classic',
    name: 'Classic Indian',
    floorLiving: '#e8dcc2',
    floorBed: '#8e5b3a',
    floorWet: '#a99a85',
    floorKitchen: '#d6c7a8',
    walls: ['#f6ecd6', '#f2e3c4', '#efe7d8'],
    accentWall: '#7a2e2e',
    wood: '#5a3520',
    woodLight: '#9a6a3f',
    cabinet: '#6d3f24',
    counter: '#2a2522',
    sofa: '#7a2e2e',
    fabric: '#f3e3c3',
    accent: '#e2a93b',
    curtain: '#b5452f',
    rug: '#8b2e2e',
    metal: '#c9a14a',
    spec: { living: 'Beige marble-finish tiles', bed: 'Rosewood-finish laminate', wet: 'Anti-skid ceramic tiles', kitchen: 'Granite counter, ceramic dado' },
  },
  {
    id: 'scandi',
    name: 'Scandinavian',
    floorLiving: '#e3d7c5',
    floorBed: '#d1b894',
    floorWet: '#c9cfd2',
    floorKitchen: '#e0d8cb',
    walls: ['#f5f5f2', '#eef1ee', '#f3f0ea'],
    accentWall: '#7d9a8c',
    wood: '#b08a5e',
    woodLight: '#d8bf98',
    cabinet: '#e9ece8',
    counter: '#cfcac2',
    sofa: '#9fb3a6',
    fabric: '#f2efe9',
    accent: '#f2c94c',
    curtain: '#e6e2da',
    rug: '#c9c1b4',
    metal: '#2f2f2f',
    spec: { living: 'Light oak-finish planks', bed: 'Birch laminated wood', wet: 'Terrazzo-look tiles', kitchen: 'Matt laminate, quartz counter' },
  },
  {
    id: 'luxury',
    name: 'Luxury Marble',
    floorLiving: '#f1ede6',
    floorBed: '#8a6448',
    floorWet: '#cfc9c0',
    floorKitchen: '#e6e1d8',
    walls: ['#f3efe8', '#ece6dc', '#f5f1ea'],
    accentWall: '#2d2a28',
    wood: '#3d2a1e',
    woodLight: '#8a6448',
    cabinet: '#1f2326',
    counter: '#f2efe9',
    sofa: '#c9b79c',
    fabric: '#efe7da',
    accent: '#b8893b',
    curtain: '#b9ab96',
    rug: '#8c7a63',
    metal: '#c9a14a',
    spec: { living: 'Italian Statuario marble', bed: 'Walnut engineered wood', wet: 'Marble-look porcelain', kitchen: 'Quartz counter, high-gloss shutters' },
  },
  {
    id: 'boho',
    name: 'Boho',
    floorLiving: '#e2d3bd',
    floorBed: '#b07d52',
    floorWet: '#c8b6a0',
    floorKitchen: '#d9c8ae',
    walls: ['#f4e9dc', '#efe0cf', '#f2e6da'],
    accentWall: '#c06c45',
    wood: '#8a5a36',
    woodLight: '#c79a6a',
    cabinet: '#6f8f7a',
    counter: '#e8e0d2',
    sofa: '#d1a273',
    fabric: '#f3e8d8',
    accent: '#2a7f7a',
    curtain: '#e3c9a6',
    rug: '#b0563a',
    metal: '#a67c45',
    spec: { living: 'Terracotta-finish tiles', bed: 'Mango-wood laminate', wet: 'Patterned cement tiles', kitchen: 'Wood-finish counter, sage shutters' },
  },
];

export type Household = 'couple' | 'kids' | 'elders' | 'professional';

export const HOUSEHOLD_LABEL: Record<Household, string> = {
  couple: 'Young couple',
  kids: 'Family with kids',
  elders: 'Family with elders',
  professional: 'Working professional',
};

export interface InteriorProfile {
  theme: Theme;
  household: Household;
  bed: 'king' | 'queen';
  sofa: 'L' | '3';
  dining: 4 | 6;
  openKitchen: boolean;
  accent: 'fluted' | 'paint' | 'stone';
  ceiling: 'cove' | 'plain';
  seed: number;
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rngFrom(seed: number) {
  let a = seed || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cache = new Map<string, InteriorProfile>();

/** Deterministic home profile per flat — the same flat always looks the same. */
export function interiorFor(flat: Flat): InteriorProfile {
  const hit = cache.get(flat.id);
  if (hit) return hit;
  const seed = hash(flat.id);
  const r = rngFrom(seed);
  const households: Household[] = flat.typeId === '2BHK' ? ['couple', 'professional', 'couple', 'elders'] : ['kids', 'elders', 'couple', 'kids', 'professional'];
  const randomTheme = THEMES[Math.floor(r() * THEMES.length)];
  // Unsold homes are staged exactly like the North Park sample flat; owners' homes vary.
  const np = flat.status === 'available' || r() < 0.35;
  const p: InteriorProfile = {
    theme: np ? THEMES[0] : randomTheme,
    household: households[Math.floor(r() * households.length)],
    bed: r() < 0.6 ? 'king' : 'queen',
    sofa: np ? '3' : r() < 0.5 ? 'L' : '3',
    dining: flat.typeId === '2BHK' ? 4 : r() < 0.7 ? 6 : 4,
    openKitchen: np ? true : r() < 0.4,
    accent: np ? 'fluted' : (['fluted', 'paint', 'stone'] as const)[Math.floor(r() * 3)],
    ceiling: np || r() < 0.75 ? 'cove' : 'plain',
    seed,
  };
  cache.set(flat.id, p);
  return p;
}

/** Profile with an optional user-picked theme ("Change interior"). */
export function profileWithTheme(flat: Flat, themeId?: string): InteriorProfile {
  const base = interiorFor(flat);
  if (!themeId || themeId === base.theme.id) return base;
  const theme = THEMES.find((t) => t.id === themeId);
  return theme ? { ...base, theme } : base;
}

export function floorColor(t: Theme, kind: RoomKind) {
  switch (kind) {
    case 'bed':
    case 'study':
      return t.floorBed;
    case 'toilet':
    case 'balcony':
    case 'utility':
      return t.floorWet;
    case 'kitchen':
      return t.floorKitchen;
    case 'pooja':
      return '#efe2c4';
    default:
      return t.floorLiving;
  }
}

/** Handover flooring as per the North Park specification (sample-home finishes are upgrades). */
export function flooringSpec(_t: Theme, kind: RoomKind) {
  if (kind === 'toilet') return 'Matt-finish anti-skid tiles · ceramic dado';
  if (kind === 'balcony' || kind === 'utility') return 'Matt-finish anti-skid tiles';
  return 'Vitrified tiles';
}

export const ELECTRICAL: Partial<Record<RoomKind, string>> = {
  bed: '3 light · 1 fan · 1 AC · 4 sockets · TV + data',
  living: '4 light · 1 fan · 1 AC · 5 sockets · TV + data',
  dining: '2 light · 1 pendant · 2 sockets',
  kitchen: 'Plumbing + electrical points (no platform) · exhaust',
  toilet: '2 light · geyser · exhaust · PVC false ceiling',
  utility: '1 light · washing machine point',
  balcony: '1 light · 1 socket',
  study: '2 light · 1 fan · 4 sockets · data',
  lounge: '3 light · 1 fan · 3 sockets',
  foyer: '1 light · video door phone · bell',
  pooja: '1 light · 1 socket',
  store: '1 light',
};
