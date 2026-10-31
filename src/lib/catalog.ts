import type { Mat, Piece, Shape } from './furniture';

/** Furniture you can place or swap in "Design your home". Sizes are real-world (metres). */
export type Category = 'sofa' | 'bed' | 'dining' | 'wardrobe' | 'tv' | 'desk' | 'storage' | 'table' | 'chair' | 'plant' | 'rug' | 'custom';

export interface CatalogItem {
  id: string;
  name: string;
  category: Category;
  w: number;
  d: number;
  h: number;
  colors: string[];
  /** Pieces in a local frame: centred on the footprint, front facing +z, floor at y = 0. */
  build: (color: string, size?: { w: number; d: number; h: number }) => Piece[];
}

const p = (x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string, shape: Shape = 'rbox', mat: Mat = 'matte', solid = false): Piece => ({
  x,
  y,
  z,
  sx,
  sy,
  sz,
  color,
  shape,
  mat,
  solid: solid || undefined,
});

const WOOD = '#8a6446';
const METAL = '#2b2f33';
const WHITE = '#f2efe9';

const FABRICS = ['#8d8f94', '#3f5a73', '#b49a7a', '#5d6b4f', '#7a3f44', '#d8d0c4', '#2f3238'];
const WOODS = ['#8a6446', '#c39a6b', '#5b3d2b', '#e7dccb', '#3b3b3b'];

function legs(out: Piece[], w: number, d: number, h: number, inset = 0.06, color = METAL) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) out.push(p(sx * (w / 2 - inset), h / 2, sz * (d / 2 - inset), 0.04, h, 0.04, color, 'cyl', 'metal'));
}

function sofa(w: number, d: number, seats: number, color: string): Piece[] {
  const out: Piece[] = [];
  const legH = 0.1;
  const baseH = 0.26;
  const arm = 0.16;
  out.push(p(0, legH + baseH / 2, 0, w, baseH, d, color, 'rbox', 'fabric', true));
  out.push(p(0, legH + baseH + 0.24, -d / 2 + 0.11, w - 0.04, 0.48, 0.2, color, 'cushion', 'fabric'));
  for (const s of [-1, 1]) out.push(p(s * (w / 2 - arm / 2), legH + baseH + 0.11, 0.02, arm, 0.22, d - 0.04, color, 'rbox', 'fabric'));
  const seatW = (w - arm * 2) / seats;
  for (let i = 0; i < seats; i++) {
    const x = -w / 2 + arm + seatW * (i + 0.5);
    out.push(p(x, legH + baseH + 0.07, 0.07, seatW - 0.02, 0.14, d - 0.3, color, 'cushion', 'fabric'));
    out.push(p(x, legH + baseH + 0.3, -d / 2 + 0.26, seatW - 0.06, 0.4, 0.14, color, 'cushion', 'fabric'));
  }
  out.push(p(-w / 2 + arm + 0.25, legH + baseH + 0.32, -d / 2 + 0.36, 0.38, 0.36, 0.12, '#e9d9b8', 'cushion', 'fabric'));
  legs(out, w, d, legH, 0.08);
  return out;
}

function lsofa(w: number, d: number, color: string): Piece[] {
  const depth = 0.92;
  const out = sofa(w, depth, 3, color).map((q) => ({ ...q, z: q.z - (d - depth) / 2 }));
  // Chaise extension along the right side.
  const cw = 0.92;
  const cx = w / 2 - cw / 2;
  const cz = (depth - (d - depth)) / 2 + (d - depth) / 2;
  out.push(p(cx, 0.1 + 0.13, cz + 0.02, cw, 0.26, d - depth + 0.04, color, 'rbox', 'fabric', true));
  out.push(p(cx, 0.43, cz + 0.02, cw - 0.04, 0.14, d - depth, color, 'cushion', 'fabric'));
  out.push(p(cx + cw / 2 - 0.08, 0.47, cz, 0.16, 0.22, d - depth, color, 'rbox', 'fabric'));
  return out;
}

function armchair(color: string): Piece[] {
  return sofa(0.82, 0.82, 1, color);
}

function bed(w: number, len: number, color: string): Piece[] {
  const out: Piece[] = [];
  const frameH = 0.32;
  out.push(p(0, frameH / 2, 0.04, w + 0.06, frameH, len, WOOD, 'rbox', 'wood', true));
  out.push(p(0, frameH + 0.11, 0.06, w - 0.04, 0.22, len - 0.1, WHITE, 'cushion', 'fabric'));
  out.push(p(0, 0.62, -len / 2 - 0.02, w + 0.14, 1.0, 0.1, color, 'rbox', 'fabric', true));
  const pw = w > 1.2 ? (w - 0.2) / 2 : w - 0.2;
  for (let i = 0; i < (w > 1.2 ? 2 : 1); i++) out.push(p(w > 1.2 ? (i ? 1 : -1) * (pw / 2 + 0.04) : 0, frameH + 0.28, -len / 2 + 0.3, pw, 0.14, 0.38, '#f7f4ee', 'cushion', 'fabric'));
  out.push(p(0, frameH + 0.24, len * 0.18, w + 0.02, 0.06, len * 0.62, color, 'cushion', 'fabric'));
  return out;
}

function chair(x: number, z: number, ry: number, wood: string, fabric: string): Piece[] {
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  const at = (lx: number, lz: number): [number, number] => [x + lx * c + lz * s, z - lx * s + lz * c];
  const out: Piece[] = [];
  const [sx, sz] = at(0, 0);
  out.push({ ...p(sx, 0.46, sz, 0.44, 0.06, 0.44, fabric, 'cushion', 'fabric'), ry });
  const [bx, bz] = at(0, -0.2);
  out.push({ ...p(bx, 0.72, bz, 0.42, 0.46, 0.05, wood, 'rbox', 'wood'), ry });
  for (const lx of [-0.18, 0.18]) for (const lz of [-0.18, 0.18]) {
    const [lxw, lzw] = at(lx, lz);
    out.push({ ...p(lxw, 0.22, lzw, 0.04, 0.44, 0.04, wood, 'box', 'wood'), ry });
  }
  return out;
}

function dining(w: number, d: number, seats: number, color: string): Piece[] {
  const out: Piece[] = [];
  const tw = w - 0.9;
  const td = d - 0.9;
  out.push(p(0, 0.74, 0, tw, 0.05, td, color, 'rbox', 'wood', true));
  legs(out, tw, td, 0.72, 0.08, color);
  const perSide = Math.max(1, Math.floor((seats - (seats >= 6 ? 2 : 0)) / 2));
  for (let i = 0; i < perSide; i++) {
    const x = -tw / 2 + (tw / perSide) * (i + 0.5);
    out.push(...chair(x, td / 2 + 0.25, Math.PI, color, '#d8d0c4'), ...chair(x, -td / 2 - 0.25, 0, color, '#d8d0c4'));
  }
  if (seats >= 6) out.push(...chair(-tw / 2 - 0.25, 0, -Math.PI / 2, color, '#d8d0c4'), ...chair(tw / 2 + 0.25, 0, Math.PI / 2, color, '#d8d0c4'));
  out.push(p(0, 0.8, 0, 0.3, 0.08, 0.3, '#3f6e45', 'sphere', 'matte'));
  return out;
}

function wardrobe(w: number, d: number, h: number, color: string): Piece[] {
  const out: Piece[] = [p(0, h / 2, 0, w, h, d, color, 'rbox', 'wood', true)];
  const doors = Math.max(2, Math.round(w / 0.5));
  for (let i = 1; i < doors; i++) out.push(p(-w / 2 + (w / doors) * i, h / 2, d / 2 + 0.003, 0.008, h - 0.1, 0.01, '#2a201a', 'box', 'matte'));
  for (let i = 0; i < doors; i++) out.push(p(-w / 2 + (w / doors) * (i + (i % 2 ? 0.12 : 0.88)), h * 0.5, d / 2 + 0.02, 0.02, 0.3, 0.02, '#c9ced3', 'box', 'metal'));
  out.push(p(0, h - 0.4, d / 2 + 0.004, w - 0.02, 0.006, 0.01, '#3a2a20', 'box', 'matte'));
  return out;
}

function tvUnit(w: number, color: string): Piece[] {
  const out: Piece[] = [p(0, 0.22, 0, w, 0.4, 0.42, color, 'rbox', 'wood', true)];
  out.push(p(0, 1.15, -0.15, Math.min(1.45, w * 0.7), 0.83, 0.05, '#0d0f12', 'rbox', 'gloss'));
  out.push(p(0, 1.15, -0.123, Math.min(1.39, w * 0.7 - 0.06), 0.77, 0.004, '#1b2a3a', 'box', 'gloss'));
  out.push(p(w / 2 - 0.25, 0.55, 0.05, 0.22, 0.3, 0.18, '#3f6e45', 'sphere', 'matte'));
  return out;
}

function desk(w: number, d: number, color: string): Piece[] {
  const out: Piece[] = [p(0, 0.74, 0, w, 0.04, d, color, 'rbox', 'wood', true)];
  legs(out, w, d, 0.72, 0.05);
  out.push(p(0, 0.98, -d / 2 + 0.12, 0.6, 0.38, 0.03, '#111418', 'rbox', 'gloss'));
  out.push(...chair(0, d / 2 + 0.25, Math.PI, METAL, '#2f3238'));
  return out;
}

function bookshelf(w: number, h: number, color: string): Piece[] {
  const d = 0.32;
  const out: Piece[] = [];
  for (const s of [-1, 1]) out.push(p(s * (w / 2 - 0.015), h / 2, 0, 0.03, h, d, color, 'box', 'wood', true));
  const shelves = Math.round(h / 0.38);
  const books = ['#b33939', '#227093', '#218c74', '#cc8e35', '#706fd3', '#2c2c54'];
  for (let i = 0; i <= shelves; i++) {
    const y = 0.02 + (i * (h - 0.04)) / shelves;
    out.push(p(0, y, 0, w - 0.03, 0.025, d, color, 'box', 'wood'));
    if (i < shelves) for (let b = 0; b < 5; b++) out.push(p(-w / 2 + 0.12 + b * 0.09, y + 0.13, 0.02, 0.06, 0.24, 0.22, books[(i + b) % books.length], 'box', 'matte'));
  }
  return out;
}

function coffeeTable(color: string): Piece[] {
  const out: Piece[] = [p(0, 0.4, 0, 1.0, 0.04, 0.55, color, 'rbox', 'wood', true)];
  legs(out, 1.0, 0.55, 0.38, 0.06, color);
  out.push(p(0.25, 0.46, 0, 0.18, 0.08, 0.18, '#d9cbb2', 'cyl', 'gloss'));
  return out;
}

function plant(h: number, color: string): Piece[] {
  return [
    p(0, 0.18, 0, 0.36, 0.36, 0.36, color, 'cyl', 'matte', true),
    p(0, 0.38 + (h - 0.4) * 0.35, 0, 0.5, (h - 0.4) * 0.7, 0.5, '#3f7a44', 'sphere', 'matte'),
    p(0.1, 0.4 + (h - 0.4) * 0.75, -0.05, 0.36, 0.4, 0.36, '#4f8f4f', 'sphere', 'matte'),
  ];
}

function rug(w: number, d: number, color: string): Piece[] {
  return [p(0, 0.008, 0, w, 0.016, d, color, 'box', 'fabric'), p(0, 0.012, 0, w - 0.16, 0.012, d - 0.16, '#f2efe9', 'box', 'fabric')].map((q, i) =>
    i ? { ...q, color: shade(color, 0.25) } : q,
  );
}

function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.round(v + (255 - v) * k);
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join('')}`;
}

function customBox(color: string, s?: { w: number; d: number; h: number }): Piece[] {
  const { w, d, h } = s ?? { w: 1, d: 0.6, h: 0.8 };
  return [p(0, h / 2, 0, w, h, d, color, 'rbox', 'matte', true)];
}

export const CATALOG: CatalogItem[] = [
  { id: 'sofa3', name: '3-seater sofa', category: 'sofa', w: 2.1, d: 0.9, h: 0.85, colors: FABRICS, build: (c) => sofa(2.1, 0.9, 3, c) },
  { id: 'sofa2', name: '2-seater sofa', category: 'sofa', w: 1.5, d: 0.85, h: 0.85, colors: FABRICS, build: (c) => sofa(1.5, 0.85, 2, c) },
  { id: 'lsofa', name: 'L-shaped sofa', category: 'sofa', w: 2.7, d: 1.8, h: 0.85, colors: FABRICS, build: (c) => lsofa(2.7, 1.8, c) },
  { id: 'armchair', name: 'Armchair', category: 'chair', w: 0.82, d: 0.82, h: 0.85, colors: FABRICS, build: armchair },
  { id: 'bedKing', name: 'King bed', category: 'bed', w: 1.93, d: 2.03, h: 1.1, colors: FABRICS, build: (c) => bed(1.83, 1.93, c) },
  { id: 'bedQueen', name: 'Queen bed', category: 'bed', w: 1.62, d: 2.08, h: 1.1, colors: FABRICS, build: (c) => bed(1.52, 1.98, c) },
  { id: 'bedSingle', name: 'Single bed', category: 'bed', w: 1.0, d: 2.0, h: 1.0, colors: FABRICS, build: (c) => bed(0.91, 1.9, c) },
  { id: 'dining6', name: '6-seater dining', category: 'dining', w: 2.7, d: 1.8, h: 0.95, colors: WOODS, build: (c) => dining(2.7, 1.8, 6, c) },
  { id: 'dining4', name: '4-seater dining', category: 'dining', w: 2.1, d: 1.65, h: 0.95, colors: WOODS, build: (c) => dining(2.1, 1.65, 4, c) },
  { id: 'wardrobe3', name: '3-door wardrobe (6 ft)', category: 'wardrobe', w: 1.8, d: 0.6, h: 2.1, colors: WOODS, build: (c) => wardrobe(1.8, 0.6, 2.1, c) },
  { id: 'wardrobe2', name: '2-door wardrobe (4 ft)', category: 'wardrobe', w: 1.2, d: 0.6, h: 2.1, colors: WOODS, build: (c) => wardrobe(1.2, 0.6, 2.1, c) },
  { id: 'tvunit', name: 'TV unit + 65″ TV', category: 'tv', w: 1.8, d: 0.42, h: 1.6, colors: WOODS, build: (c) => tvUnit(1.8, c) },
  { id: 'tvunitS', name: 'TV unit + 55″ TV', category: 'tv', w: 1.4, d: 0.42, h: 1.5, colors: WOODS, build: (c) => tvUnit(1.4, c) },
  { id: 'desk', name: 'Study desk + chair', category: 'desk', w: 1.2, d: 1.1, h: 1.0, colors: WOODS, build: (c) => desk(1.2, 0.6, c).map((q) => ({ ...q, z: q.z - 0.25 })) },
  { id: 'bookshelf', name: 'Bookshelf', category: 'storage', w: 0.9, d: 0.32, h: 1.8, colors: WOODS, build: (c) => bookshelf(0.9, 1.8, c) },
  { id: 'coffee', name: 'Coffee table', category: 'table', w: 1.0, d: 0.55, h: 0.45, colors: WOODS, build: coffeeTable },
  { id: 'plant', name: 'Floor plant', category: 'plant', w: 0.5, d: 0.5, h: 1.3, colors: ['#e7e2da', '#3b3b3b', '#b0643d'], build: (c) => plant(1.3, c) },
  { id: 'rug', name: 'Rug 200×140', category: 'rug', w: 2.0, d: 1.4, h: 0.02, colors: ['#8a6f5a', '#3f5a73', '#7a3f44', '#b49a7a'], build: (c) => rug(2.0, 1.4, c) },
  { id: 'custom', name: 'Your own item', category: 'custom', w: 1, d: 0.6, h: 0.8, colors: ['#9aa5b1', '#c9a14a', '#7a3f44'], build: customBox },
];

export const CATALOG_BY_ID = new Map(CATALOG.map((c) => [c.id, c]));

/** Which catalogue category an existing (generated) furniture feature belongs to. */
export const FEATURE_CATEGORY: Record<string, Category> = {
  sofa: 'sofa',
  bed: 'bed',
  table: 'dining',
  wardrobe: 'wardrobe',
  tv: 'tv',
  desk: 'desk',
  bookshelf: 'storage',
  crockery: 'storage',
  dressing: 'storage',
  shoerack: 'storage',
  plant: 'plant',
  plants: 'plant',
  seating: 'chair',
  coffee: 'table',
  rug: 'rug',
};

export const CATEGORY_LABEL: Record<Category, string> = {
  sofa: 'Sofas',
  bed: 'Beds',
  dining: 'Dining',
  wardrobe: 'Wardrobes',
  tv: 'TV units',
  desk: 'Desks',
  storage: 'Storage',
  table: 'Tables',
  chair: 'Chairs',
  plant: 'Plants',
  rug: 'Rugs',
  custom: 'Your item',
};
