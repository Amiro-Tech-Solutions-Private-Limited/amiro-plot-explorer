import type { Room } from '../data/types';
import type { InteriorProfile, Theme } from '../data/interiors';
import type { FlatLayout, Seg } from './walls';
import { rngFrom } from '../data/interiors';

export type Shape = 'box' | 'rbox' | 'cushion' | 'cyl' | 'sphere';
export type Mat = 'matte' | 'fabric' | 'wood' | 'metal' | 'gloss' | 'glow' | 'glass' | 'marble';

export interface Piece {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  color: string;
  shape: Shape;
  mat: Mat;
  rx?: number;
  ry?: number;
  /** Collides with the walking player. */
  solid?: boolean;
  /** `Room name::feature` id used by tours to frame and highlight things. */
  tag?: string;
}

export interface Anchor {
  x: number;
  z: number;
  /** Rotation so a character's +Z faces into the room. */
  ry: number;
}

export interface Furnished {
  pieces: Piece[];
  fans: { x: number; z: number }[];
  lights: { x: number; z: number }[];
  anchors: Partial<Record<'sofa' | 'host' | 'cook' | 'desk' | 'balcony' | 'kid' | 'armchair', Anchor>>;
}

type Edge = 'n' | 's' | 'w' | 'e';
type Extra = Partial<Pick<Piece, 'solid' | 'rx' | 'ry'>>;
const INSET = 0.11;
const CEIL = 2.93;

// Builders tag every piece they push with the current room/feature.
let ROOM = '';
let TAG: string | undefined;
const T = (feature?: string) => {
  TAG = feature ? `${ROOM}::${feature}` : undefined;
};

const edgeLen = (r: Room, e: Edge) => (e === 'n' || e === 's' ? r.w : r.h);
const opposite = (e: Edge): Edge => ({ n: 's', s: 'n', w: 'e', e: 'w' } as const)[e];
const RY: Record<Edge, number> = { n: 0, s: Math.PI, w: Math.PI / 2, e: -Math.PI / 2 };

function segsOnEdge(segs: Seg[], r: Room, e: Edge) {
  const horiz = e === 'n' || e === 's';
  const fixed = e === 'n' ? r.y : e === 's' ? r.y + r.h : e === 'w' ? r.x : r.x + r.w;
  const a = horiz ? r.x : r.y;
  const b = horiz ? r.x + r.w : r.y + r.h;
  return segs.filter((s) => {
    const sh = s.y1 === s.y2;
    if (sh !== horiz) return false;
    if (Math.abs((sh ? s.y1 : s.x1) - fixed) > 0.01) return false;
    const sa = sh ? s.x1 : s.y1;
    const sb = sh ? s.x2 : s.y2;
    return Math.min(b, sb) - Math.max(a, sa) > 0.01;
  });
}

/** Edges fully covered by plain wall — safe to put furniture against. */
function freeEdges(layout: FlatLayout, r: Room): Edge[] {
  return (['n', 's', 'w', 'e'] as Edge[])
    .filter((e) => {
      const ss = segsOnEdge(layout.segs, r, e);
      if (!ss.length || ss.some((s) => s.kind !== 'wall')) return false;
      const horiz = e === 'n' || e === 's';
      const a = horiz ? r.x : r.y;
      const b = horiz ? r.x + r.w : r.y + r.h;
      let cover = 0;
      for (const s of ss) {
        const sh = s.y1 === s.y2;
        cover += Math.min(b, sh ? s.x2 : s.y2) - Math.max(a, sh ? s.x1 : s.y1);
      }
      return cover >= (b - a) * 0.9;
    })
    .sort((p, q) => edgeLen(r, q) - edgeLen(r, p));
}

/** Edges with no doorway (windows allowed) — fallback for big pieces like beds. */
function quietEdges(layout: FlatLayout, r: Room): Edge[] {
  return (['n', 's', 'w', 'e'] as Edge[])
    .filter((e) => {
      const ss = segsOnEdge(layout.segs, r, e);
      return ss.length > 0 && !ss.some((s) => s.kind === 'door' || s.kind === 'entry' || s.kind === 'slide');
    })
    .sort((p, q) => edgeLen(r, q) - edgeLen(r, p));
}

/** Places pieces in a wall-relative frame: u along the wall, v away from it, y up. */
class Wall {
  constructor(
    private out: Piece[],
    private r: Room,
    readonly e: Edge,
    private uA: number,
  ) {}
  map(u: number, v: number): [number, number] {
    const { r, e, uA } = this;
    switch (e) {
      case 'n':
        return [r.x + uA + u, r.y + INSET + v];
      case 's':
        return [r.x + uA - u, r.y + r.h - INSET - v];
      case 'w':
        return [r.x + INSET + v, r.y + uA - u];
      case 'e':
        return [r.x + r.w - INSET - v, r.y + uA + u];
    }
  }
  add(u: number, v: number, y0: number, du: number, dv: number, h: number, color: string, shape: Shape = 'rbox', mat: Mat = 'matte', extra: Extra = {}) {
    const [x, z] = this.map(u, v + dv / 2);
    const horiz = this.e === 'n' || this.e === 's';
    this.out.push({ x, z, y: y0 + h / 2, sx: horiz ? du : dv, sz: horiz ? dv : du, sy: h, color, shape, mat, tag: TAG, ...extra, ry: (extra.ry ?? 0) + (shape === 'cyl' && extra.rx ? RY[this.e] : 0) });
    return this;
  }
  anchor(u: number, v: number): Anchor {
    const [x, z] = this.map(u, v);
    return { x, z, ry: RY[this.e] };
  }
  get len() {
    return edgeLen(this.r, this.e);
  }
}

function wall(out: Piece[], r: Room, e: Edge, width: number, along = 0.5) {
  const L = edgeLen(r, e);
  const lo = width / 2 + 0.12;
  const hi = L - width / 2 - 0.12;
  const uA = lo > hi ? L / 2 : Math.min(Math.max(along * L, lo), hi);
  return new Wall(out, r, e, uA);
}

const BOOKS = ['#b33939', '#227093', '#218c74', '#cc8e35', '#706fd3', '#2c2c54', '#ffda79', '#e15f41'];
const ART = ['#d35400', '#2980b9', '#16a085', '#8e44ad', '#c0392b', '#f39c12', '#34495e'];

const P = (x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string, shape: Shape = 'rbox', mat: Mat = 'matte', extra: Extra = {}): Piece => ({ x, y, z, sx, sy, sz, color, shape, mat, tag: TAG, ...extra });

function plant(out: Piece[], x: number, z: number, h = 1.0, kind: 'areca' | 'bush' = 'bush') {
  out.push(P(x, 0.2, z, 0.34, 0.4, 0.34, '#c9c2b6', 'cyl', 'gloss'));
  out.push(P(x, 0.41, z, 0.3, 0.02, 0.3, '#4a3426', 'cyl', 'matte'));
  if (kind === 'areca') {
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      out.push(P(x + Math.cos(a) * 0.06, 0.4 + h * 0.35, z + Math.sin(a) * 0.06, 0.02, h * 0.7, 0.02, '#6b8e3a', 'cyl', 'matte', { rx: Math.cos(a) * 0.15, ry: 0 }));
      out.push(P(x + Math.cos(a) * 0.22, 0.4 + h * 0.75, z + Math.sin(a) * 0.22, 0.42, 0.26, 0.42, k % 2 ? '#4f8a3c' : '#5f9b45', 'sphere', 'fabric'));
    }
  } else {
    out.push(P(x, 0.42 + h * 0.32, z, 0.52, h * 0.62, 0.52, '#4f8a43', 'sphere', 'fabric'));
    out.push(P(x + 0.08, 0.42 + h * 0.58, z - 0.05, 0.36, h * 0.4, 0.36, '#5f9e4f', 'sphere', 'fabric'));
  }
}

function frame(W: Wall, u: number, y0: number, w: number, h: number, color: string, v = 0) {
  W.add(u, v, y0, w + 0.06, 0.03, h + 0.06, '#2b2420', 'box', 'wood').add(u, v + 0.012, y0 + 0.03, w, 0.02, h, color, 'box', 'gloss');
}

function accentWall(W: Wall, len: number, t: Theme, style: InteriorProfile['accent'], h = 2.6) {
  if (style === 'fluted') {
    const n = Math.floor(len / 0.06);
    for (let k = 0; k < n; k++) W.add(-len / 2 + (k + 0.5) * (len / n), 0, 0.1, len / n - 0.012, 0.035, h, t.woodLight, 'box', 'wood');
  } else if (style === 'stone') {
    for (let row = 0; row < Math.floor(h / 0.15); row++) {
      const off = row % 2 ? 0.15 : 0;
      for (let u = -len / 2 + off; u < len / 2 - 0.1; u += 0.3) W.add(u + 0.14, 0, 0.1 + row * 0.15, 0.28, 0.03, 0.13, row % 3 ? '#b9ab98' : '#a8977f', 'rbox', 'matte');
    }
  } else {
    W.add(0, 0, 0.1, len, 0.02, h, t.accentWall, 'box', 'matte');
  }
}

function bed(W: Wall, width: number, t: Theme, r: () => number) {
  W.add(0, 0, 0, width + 0.12, 2.1, 0.3, t.wood, 'rbox', 'wood', { solid: true })
    .add(0, 0.05, 0.3, width, 2.0, 0.24, '#f6f4ef', 'cushion', 'fabric')
    .add(0, 0.06, 0.54, width + 0.02, 1.98, 0.02, t.fabric, 'box', 'fabric')
    .add(0, 1.25, 0.55, width + 0.08, 0.6, 0.06, t.accent, 'cushion', 'fabric')
    .add(0, -0.02, 0.15, width + 0.3, 0.14, 1.15, t.sofa, 'cushion', 'fabric')
    .add(-width * 0.24, 0.16, 0.54, width * 0.42, 0.4, 0.15, '#fbfbf9', 'cushion', 'fabric')
    .add(width * 0.24, 0.16, 0.54, width * 0.42, 0.4, 0.15, '#fbfbf9', 'cushion', 'fabric')
    .add(0, 0.3, 0.58, width * 0.3, 0.14, 0.3, t.accent, 'cushion', 'fabric');
  for (const s of [-1, 1]) {
    const u = s * (width / 2 + 0.4);
    W.add(u, 0, 0, 0.48, 0.42, 0.5, t.wood, 'rbox', 'wood')
      .add(u, 0.42, 0.25, 0.4, 0.01, 0.12, '#1d1d1d', 'box', 'metal')
      .add(u, 0.14, 0.5, 0.14, 0.14, 0.04, t.metal, 'cyl', 'metal')
      .add(u, 0.18, 0.54, 0.03, 0.03, 0.26, t.metal, 'cyl', 'metal')
      .add(u, 0.08, 0.78, 0.3, 0.3, 0.24, t.fabric, 'cyl', 'fabric')
      .add(u, 0.18, 0.84, 0.1, 0.1, 0.1, '#ffe7b8', 'sphere', 'glow');
  }
  W.add(0, 2.05, 0, width + 0.9, 1.2, 0.012, t.rug, 'box', 'fabric');
  frame(W, 0, 1.55, 0.9, 0.6, ART[Math.floor(r() * ART.length)]);
}

function wardrobe(W: Wall, len: number, t: Theme, mirror: boolean) {
  W.add(0, 0, 0, len, 0.6, 2.25, t.woodLight, 'box', 'wood', { solid: true }).add(0, 0, 2.27, len, 0.6, 0.6, t.woodLight, 'box', 'wood');
  W.add(0, 0.6, 2.25, len, 0.01, 0.015, '#2b2b2b', 'box', 'matte');
  const n = Math.max(2, Math.round(len / 0.55));
  for (let k = 1; k < n; k++) W.add(-len / 2 + (k * len) / n, 0.6, 0.05, 0.008, 0.01, 2.85, '#2b2b2b', 'box', 'matte');
  for (let k = 0; k < n; k++) {
    const u = -len / 2 + ((k + 0.5) * len) / n + (k % 2 ? -0.2 : 0.2) * (len / n / 0.55);
    W.add(u, 0.6, 0.8, 0.02, 0.03, 0.55, t.metal, 'box', 'metal');
  }
  if (mirror) W.add(-len / 2 + len / n / 2, 0.605, 0.25, len / n - 0.08, 0.01, 1.7, '#cfe0ea', 'box', 'glass');
}

function sofa(W: Wall, t: Theme, L: boolean, lived: boolean, r: () => number) {
  const w = 2.3;
  const legs = (u: number, v: number) => W.add(u, v, 0, 0.05, 0.05, 0.1, t.metal, 'cyl', 'metal');
  for (const u of [-w / 2 + 0.1, w / 2 - 0.1]) for (const v of [0.12, 0.75]) legs(u, v);
  W.add(0, 0, 0.1, w, 0.88, 0.3, t.sofa, 'rbox', 'fabric', { solid: true })
    .add(0, 0, 0.36, w - 0.1, 0.24, 0.5, t.sofa, 'cushion', 'fabric')
    .add(-w / 2 + 0.09, 0, 0.1, 0.18, 0.88, 0.55, t.sofa, 'cushion', 'fabric')
    .add(w / 2 - 0.09, 0, 0.1, 0.18, 0.88, 0.55, t.sofa, 'cushion', 'fabric');
  for (const u of [-0.5, 0.5]) {
    W.add(u, 0.24, 0.4, 0.98, 0.62, 0.16, t.fabric, 'cushion', 'fabric').add(u, 0.2, 0.55, 0.95, 0.2, 0.45, t.fabric, 'cushion', 'fabric');
  }
  W.add(-0.85, 0.32, 0.56, 0.42, 0.14, 0.4, t.accent, 'cushion', 'fabric').add(0.85, 0.32, 0.56, 0.42, 0.14, 0.4, t.accentWall, 'cushion', 'fabric');
  if (L) {
    W.add(w / 2 - 0.45, 0.88, 0.1, 0.9, 0.85, 0.3, t.sofa, 'rbox', 'fabric', { solid: true }).add(w / 2 - 0.45, 0.88, 0.4, 0.86, 0.8, 0.16, t.fabric, 'cushion', 'fabric');
    for (const v of [1.6]) legs(w / 2 - 0.1, v);
  }
  W.add(0, 1.3, 0, 2.7, 1.9, 0.012, t.rug, 'box', 'fabric')
    .add(0, 1.55, 0, 0.9, 0.45, 0.32, t.wood, 'rbox', 'wood', { solid: true })
    .add(0, 1.5, 0.32, 1.15, 0.6, 0.04, t.counter, 'rbox', 'gloss')
    .add(-0.25, 1.75, 0.36, 0.26, 0.26, 0.07, t.metal, 'cyl', 'metal')
    .add(0.3, 1.68, 0.36, 0.08, 0.08, 0.22, t.accent, 'cyl', 'gloss');
  if (lived) {
    W.add(0.15, 1.62, 0.36, 0.28, 0.22, 0.03, BOOKS[Math.floor(r() * BOOKS.length)], 'box', 'matte')
      .add(-0.05, 1.82, 0.36, 0.16, 0.05, 0.02, '#111', 'rbox', 'gloss')
      .add(0.4, 1.9, 0.36, 0.08, 0.15, 0.01, '#1a1a1a', 'rbox', 'gloss')
      .add(0.55, 0.3, 0.56, 0.35, 0.3, 0.02, '#f0e6d2', 'box', 'matte');
  }
  W.add(-w / 2 - 0.4, 0.15, 0, 0.3, 0.3, 0.03, t.metal, 'cyl', 'metal')
    .add(-w / 2 - 0.4, 0.15, 0.03, 0.03, 0.03, 1.5, t.metal, 'cyl', 'metal')
    .add(-w / 2 - 0.4, 0.15, 1.45, 0.42, 0.42, 0.3, t.fabric, 'cyl', 'fabric')
    .add(-w / 2 - 0.4, 0.15, 1.5, 0.15, 0.15, 0.15, '#ffe2a8', 'sphere', 'glow');
}

function tvWall(W: Wall, t: Theme, style: InteriorProfile['accent']) {
  accentWall(W, Math.min(2.8, W.len - 0.2), t, style);
  W.add(0, 0.04, 0, 2.0, 0.42, 0.4, t.wood, 'rbox', 'wood', { solid: true })
    .add(0, 0.46, 0.18, 1.96, 0.01, 0.02, t.metal, 'box', 'metal')
    .add(0, 0.06, 1.0, 1.45, 0.05, 0.84, '#0d0f12', 'rbox', 'gloss')
    .add(0, 0.11, 1.03, 1.39, 0.005, 0.78, '#2c5a8a', 'box', 'glow')
    .add(0, 0.15, 0.42, 0.9, 0.08, 0.08, '#1d1d1d', 'rbox', 'matte')
    .add(-0.7, 0.15, 0.42, 0.25, 0.18, 0.05, '#222', 'rbox', 'gloss');
}

function kitchen(W: Wall, t: Theme, lived: boolean) {
  const L = W.len - 0.15;
  W.add(0, 0, 0, L, 0.58, 0.1, '#1d1d1d', 'box', 'matte')
    .add(0, 0, 0.1, L, 0.58, 0.76, t.cabinet, 'box', 'gloss', { solid: true })
    .add(0, 0, 0.86, L + 0.02, 0.62, 0.04, t.counter, 'box', 'gloss')
    .add(0, 0, 0.9, L, 0.015, 0.62, '#ecebe7', 'box', 'gloss');
  const doors = Math.max(2, Math.round(L / 0.5));
  for (let k = 1; k < doors; k++) W.add(-L / 2 + (k * L) / doors, 0.58, 0.12, 0.006, 0.006, 0.72, '#111', 'box', 'matte');
  for (let k = 0; k < doors; k++) W.add(-L / 2 + ((k + 0.5) * L) / doors, 0.59, 0.78, 0.3, 0.02, 0.02, t.metal, 'box', 'metal');
  // Sink, tap, hob, chimney
  T('sink');
  W.add(L * 0.25, 0.1, 0.87, 0.6, 0.42, 0.04, '#b8bec4', 'rbox', 'metal')
    .add(L * 0.25, 0.04, 0.9, 0.035, 0.035, 0.3, '#c9ced3', 'cyl', 'metal')
    .add(L * 0.25, 0.08, 1.18, 0.03, 0.12, 0.03, '#c9ced3', 'box', 'metal');
  T('hob');
  W.add(-L * 0.22, 0.06, 0.9, 0.7, 0.5, 0.015, '#0f0f10', 'rbox', 'gloss');
  for (const du of [-0.17, 0.17]) W.add(-L * 0.22 + du, 0.2, 0.915, 0.16, 0.16, 0.012, '#2a2a2a', 'cyl', 'metal').add(-L * 0.22 + du, 0.2, 0.927, 0.1, 0.1, 0.005, '#3a6ff7', 'cyl', 'glow');
  T('chimney');
  W.add(-L * 0.22, 0, 1.6, 0.8, 0.5, 0.2, t.metal, 'box', 'metal')
    .add(-L * 0.22, 0, 1.8, 0.32, 0.26, 1.1, t.metal, 'box', 'metal')
    .add(-L * 0.22, 0.42, 1.61, 0.6, 0.06, 0.01, '#fff2cc', 'box', 'glow');
  T('cabinets');
  const cab = (L / 2 - 0.5) * 0.95;
  if (cab > 0.3) {
    W.add(-L / 2 + cab / 2, 0, 1.5, cab, 0.34, 0.72, t.cabinet, 'box', 'gloss');
    W.add(L / 2 - cab / 2, 0, 1.5, cab, 0.34, 0.72, t.cabinet, 'box', 'gloss');
  }
  W.add(0, 0.02, 1.38, L * 0.4, 0.03, 0.02, t.metal, 'box', 'metal');
  for (let k = 0; k < 4; k++) W.add(-L * 0.18 + k * 0.12, 0.05, 1.18, 0.05, 0.05, 0.18, '#a4a8ad', 'cyl', 'metal');
  T('purifier');
  W.add(L * 0.43, 0, 1.25, 0.3, 0.24, 0.45, '#f5f5f5', 'rbox', 'gloss').add(L * 0.43, 0.24, 1.45, 0.06, 0.01, 0.06, '#36c', 'box', 'glow');
  T('microwave');
  W.add(L * 0.05, 0.08, 0.9, 0.5, 0.36, 0.3, '#2d2f33', 'rbox', 'gloss');
  T('counter');
  if (lived) {
    W.add(-L * 0.36, 0.2, 0.93, 0.2, 0.2, 0.16, t.metal, 'cyl', 'metal')
      .add(L * 0.38, 0.25, 0.9, 0.16, 0.16, 0.3, '#e9e9e9', 'cyl', 'gloss')
      .add(-L * 0.05, 0.4, 0.9, 0.22, 0.22, 0.12, '#c0392b', 'cyl', 'gloss');
    for (let k = 0; k < 5; k++) W.add(L * 0.12 + k * 0.07, 0.04, 1.45, 0.06, 0.06, 0.1, ['#c0392b', '#f1c40f', '#27ae60', '#8e5b3a', '#e67e22'][k], 'cyl', 'gloss');
  }
}

function toilet(W: Wall, t: Theme) {
  const L = W.len;
  const uWC = -Math.min(0.45, L / 2 - 0.3);
  const uB = Math.min(0.45, L / 2 - 0.35);
  W.add(0, 0, 0, L - 0.04, 0.012, 2.4, '#dfe6ea', 'box', 'gloss');
  T('wc');
  W.add(uWC, 0, 0.35, 0.38, 0.55, 0.32, '#fafafa', 'cushion', 'gloss', { solid: true })
    .add(uWC, 0.01, 0.95, 0.24, 0.02, 0.16, '#e9edf0', 'rbox', 'gloss')
    .add(uWC + 0.3, 0.01, 0.5, 0.04, 0.06, 0.14, '#c9ced3', 'rbox', 'metal');
  T('basin');
  W.add(uB, 0, 0.55, 0.6, 0.48, 0.3, t.cabinet, 'rbox', 'wood')
    .add(uB, 0, 0.85, 0.62, 0.5, 0.03, t.counter, 'box', 'gloss')
    .add(uB, 0.12, 0.88, 0.4, 0.3, 0.08, '#ffffff', 'cyl', 'gloss')
    .add(uB, 0.04, 0.96, 0.03, 0.03, 0.2, '#c9ced3', 'cyl', 'metal')
    .add(uB, 0.005, 1.15, 0.6, 0.02, 0.75, '#d8e6ee', 'rbox', 'glass')
    .add(uB, 0.02, 1.92, 0.6, 0.03, 0.03, '#fff3d6', 'box', 'glow');
  T('geyser');
  W.add(uB, 0.02, 2.05, 0.36, 0.36, 0.5, '#f2f2f2', 'cyl', 'gloss');
  T('basin');
  W.add(0, 0.02, 1.45, 0.5, 0.06, 0.02, t.metal, 'box', 'metal')
    .add(0, 0.05, 1.25, 0.45, 0.04, 0.4, '#ffffff', 'box', 'fabric');
}

function dining(out: Piece[], cx: number, cz: number, n: 4 | 6, along: boolean, t: Theme, lived: boolean) {
  const tw = n === 6 ? 1.7 : 1.2;
  const np = t.id === 'northpark';
  const sx = along ? tw : 0.9;
  const sz = along ? 0.9 : tw;
  out.push(P(cx, 0.75, cz, sx, 0.05, sz, np ? t.wood : t.counter, 'rbox', np ? 'wood' : 'gloss', { solid: true }));
  for (const dx of [-1, 1]) for (const dz of [-1, 1]) out.push(P(cx + dx * (sx / 2 - 0.1), 0.36, cz + dz * (sz / 2 - 0.1), 0.06, 0.72, 0.06, t.wood, 'rbox', 'wood'));
  out.push(P(cx, 0.36, cz, sx * 0.5, 0.72, sz * 0.4, t.wood, 'box', 'wood', { solid: true }));
  const per = n / 2;
  for (let k = 0; k < per; k++) {
    const off = (k - (per - 1) / 2) * 0.6;
    for (const side of [-1, 1]) {
      const x = cx + (along ? off : side * 0.72);
      const z = cz + (along ? side * 0.72 : off);
      out.push(P(x, 0.45, z, 0.46, 0.1, 0.46, np ? '#d6d0c6' : t.fabric, 'cushion', 'fabric', { solid: true }));
      if (np) for (const lx of [-0.17, 0.17]) for (const lz of [-0.17, 0.17]) out.push(P(x + lx, 0.21, z + lz, 0.025, 0.42, 0.025, '#1d1d1d', 'cyl', 'metal'));
      else out.push(P(x, 0.2, z, 0.38, 0.4, 0.38, t.wood, 'box', 'wood'));
      const bx = x + (along ? 0 : side * 0.21);
      const bz = z + (along ? side * 0.21 : 0);
      out.push(P(bx, 0.78, bz, along ? 0.44 : 0.09, 0.5, along ? 0.09 : 0.44, np ? '#d6d0c6' : t.wood, np ? 'cushion' : 'rbox', np ? 'fabric' : 'wood'));
    }
  }
  out.push(P(cx, 2.0, cz, 0.5, 0.25, 0.5, t.metal, 'sphere', 'metal'));
  out.push(P(cx, 1.9, cz, 0.22, 0.08, 0.22, '#ffe2a8', 'sphere', 'glow'));
  out.push(P(cx, 2.48, cz, 0.012, 0.9, 0.012, '#222', 'cyl', 'metal'));
  if (lived) {
    out.push(P(cx, 0.82, cz, 0.36, 0.1, 0.36, '#e9e3d8', 'cyl', 'gloss'));
    for (const [dx, c] of [[-0.06, '#e74c3c'], [0.07, '#f39c12'], [0, '#27ae60']] as [number, string][]) out.push(P(cx + dx, 0.9, cz + dx * 0.5, 0.09, 0.09, 0.09, c, 'sphere', 'gloss'));
  } else {
    out.push(P(cx, 0.9, cz, 0.12, 0.26, 0.12, t.accent, 'cyl', 'gloss'));
    for (const d of [-0.4, 0.4]) out.push(P(cx + (along ? d : 0), 0.79, cz + (along ? 0 : d), 0.26, 0.015, 0.26, '#f4f4f2', 'cyl', 'gloss'));
  }
}

/* ---------- North Park sample flat (matched to the developer's interior renders) ---------- */

function npLiving(W: Wall, t: Theme, lived: boolean) {
  const w = 2.2;
  // Greige three-seater with soft seat/back cushions and rounded arms.
  W.add(0, 0.05, 0.08, w, 0.88, 0.3, t.sofa, 'rbox', 'fabric', { solid: true })
    .add(0, 0.03, 0.36, w - 0.12, 0.24, 0.44, t.sofa, 'cushion', 'fabric');
  for (const s of [-1, 1]) W.add(s * (w / 2 - 0.1), 0.05, 0.08, 0.22, 0.88, 0.56, t.sofa, 'cushion', 'fabric');
  for (let k = 0; k < 3; k++) W.add(-w / 2 + 0.22 + ((w - 0.44) / 3) * (k + 0.5), 0.26, 0.37, (w - 0.44) / 3 - 0.02, 0.64, 0.15, '#dcd6cc', 'cushion', 'fabric');
  W.add(-0.38, 0.22, 0.5, 0.48, 0.15, 0.42, '#6e6257', 'cushion', 'fabric')
    .add(0.32, 0.22, 0.5, 0.46, 0.15, 0.4, '#d8cdbd', 'cushion', 'fabric')
    .add(0.55, 0.45, 0.2, 0.5, 0.42, 0.42, '#3a3836', 'cushion', 'fabric');
  // Travertine coffee table on two walnut blocks, with a vase.
  T('coffee');
  W.add(-0.22, 1.32, 0, 0.32, 0.36, 0.36, t.woodLight, 'rbox', 'wood', { solid: true })
    .add(0.32, 1.52, 0, 0.3, 0.3, 0.3, t.woodLight, 'rbox', 'wood')
    .add(-0.1, 1.28, 0.36, 1.0, 0.58, 0.05, '#e6dac8', 'rbox', 'gloss')
    .add(0.4, 1.5, 0.3, 0.55, 0.44, 0.05, '#e6dac8', 'rbox', 'gloss')
    .add(0.0, 1.5, 0.41, 0.08, 0.08, 0.26, '#2a2a2a', 'cyl', 'gloss')
    .add(0.0, 1.5, 0.64, 0.26, 0.2, 0.22, '#3f6e45', 'sphere', 'matte');
  // Curved lounge armchair facing the sofa.
  T('seating');
  W.add(-1.05, 2.25, 0, 0.82, 0.78, 0.42, '#c9c4bc', 'cushion', 'fabric', { solid: true })
    .add(-1.05, 2.85, 0.3, 0.84, 0.2, 0.42, '#c9c4bc', 'cushion', 'fabric')
    .add(-1.42, 2.3, 0.22, 0.14, 0.7, 0.32, '#c9c4bc', 'cushion', 'fabric')
    .add(-0.68, 2.3, 0.22, 0.14, 0.7, 0.32, '#c9c4bc', 'cushion', 'fabric')
    .add(-1.0, 2.6, 0.42, 0.36, 0.14, 0.3, '#7a4a32', 'cushion', 'fabric');
  // Textured beige rug.
  T('rug');
  W.add(0, 1.0, 0, 2.7, 2.0, 0.012, '#bfb3a0', 'box', 'fabric').add(0, 1.15, 0.012, 2.4, 1.7, 0.004, '#a99a86', 'box', 'fabric');
  // Abstract canvas: beige ground with a black brushstroke and a gold line.
  T('art');
  W.add(0, 0, 1.25, 0.95, 0.04, 1.15, '#2b2420', 'box', 'wood')
    .add(0, 0.02, 1.27, 0.9, 0.025, 1.1, '#ece5d8', 'box', 'matte')
    .add(0.12, 0.035, 1.45, 0.05, 0.005, 0.75, '#1c1c1c', 'box', 'matte')
    .add(-0.05, 0.035, 1.55, 0.45, 0.005, 0.03, '#1c1c1c', 'box', 'matte')
    .add(-0.12, 0.035, 1.42, 0.03, 0.005, 0.25, '#b08a4a', 'box', 'matte');
  if (lived) W.add(0.2, 1.4, 0.42, 0.26, 0.2, 0.03, '#d35400', 'box', 'matte');
}

function npBed(W: Wall, width: number, t: Theme, master: boolean, blankWall: boolean) {
  const L = Math.min(W.len - 0.3, 3.6);
  // Full-height feature panels only on a blank wall, never over a window.
  if (master && blankWall) {
    // Charcoal panel + fluted walnut half, brass ring and terracotta disc.
    W.add(-L * 0.18, 0, 0.1, L * 0.64, 0.03, 2.7, t.accentWall, 'box', 'matte');
    const n = Math.floor((L * 0.36) / 0.07);
    for (let k = 0; k < n; k++) W.add(L * 0.14 + (k + 0.5) * 0.07, 0, 0.1, 0.055, 0.045, 2.7, t.woodLight, 'box', 'wood');
    const cu = L * 0.14;
    const cy = 1.95;
    for (let k = 0; k < 40; k++) {
      const a = (k / 40) * Math.PI * 2;
      W.add(cu + Math.cos(a) * 0.62, 0.05, cy + Math.sin(a) * 0.62, 0.07, 0.01, 0.03, '#ffd9a0', 'box', 'glow');
    }
    W.add(cu - 0.15, -0.25 + 0.05, cy - 0.27, 0.5, 0.5, 0.02, t.accent, 'cyl', 'matte', { rx: Math.PI / 2 });
  } else if (blankWall) {
    W.add(0, 0, 0.1, L * 0.7, 0.025, 2.7, '#d6cec2', 'box', 'matte');
  }
  // Wide upholstered grey headboard spanning the side tables.
  W.add(0, 0.02, 0.5, width + 1.5, 0.12, 0.66, '#8f8a84', 'cushion', 'fabric');
  // White platform bed, grey linen, terracotta throw and check cushions.
  W.add(0, 0.14, 0, width + 0.1, 2.05, 0.3, '#ece8e1', 'rbox', 'matte', { solid: true })
    .add(0, 0.16, 0.3, width, 1.98, 0.22, '#f6f4ef', 'cushion', 'fabric')
    .add(0, 0.55, 0.5, width + 0.06, 1.6, 0.05, '#d6d3cd', 'cushion', 'fabric')
    .add(0, 1.1, 0.53, width + 0.1, 0.6, 0.05, '#b8693f', 'cushion', 'fabric');
  for (const s of [-1, 1]) {
    W.add(s * width * 0.25, 0.25, 0.54, width * 0.42, 0.18, 0.4, '#f7f4ee', 'cushion', 'fabric')
      .add(s * width * 0.16, 0.42, 0.62, width * 0.2, 0.12, 0.3, '#4a4744', 'cushion', 'fabric')
      .add(s * width * 0.06, 0.52, 0.62, width * 0.14, 0.1, 0.24, '#b8693f', 'cushion', 'fabric');
    // White bedside table with a brass line, amber glass lamp and a ring pendant.
    const u = s * (width / 2 + 0.42);
    W.add(u, 0.02, 0, 0.55, 0.42, 0.5, '#f1ede6', 'rbox', 'matte')
      .add(u, 0.44, 0.28, 0.45, 0.005, 0.015, t.metal, 'box', 'metal')
      .add(u + 0.08, 0.15, 0.5, 0.12, 0.12, 0.2, t.metal, 'cyl', 'metal')
      .add(u + 0.08, 0.15, 0.7, 0.24, 0.24, 0.2, '#ffcf8a', 'sphere', 'glow');
    if (master) {
      W.add(u - 0.08, 0.2, 1.25, 0.12, 0.02, 0.36, '#ffe7b8', 'rbox', 'glow').add(u - 0.08, 0.2, 1.61, 0.008, 0.008, 1.3, '#222', 'cyl', 'metal');
    }
  }
  // Feather pendant over the bed and a black-and-white geometric rug.
  if (master) W.add(0, 1.0, 2.05, 0.7, 0.62, 0.5, '#fbfaf7', 'sphere', 'fabric').add(0, 1.15, 2.1, 0.22, 0.22, 0.22, '#fff1d6', 'sphere', 'glow');
  W.add(0, 1.95, 0, width + 1.3, 1.35, 0.012, '#2a2a2a', 'box', 'fabric');
  for (let k = 0; k < 6; k++) W.add(0, 2.02 + k * 0.21, 0.013, width + 1.1, 0.07, 0.004, '#efece6', 'box', 'fabric');
}

function npWardrobe(W: Wall, len: number, t: Theme) {
  // Glass-front wardrobe with a lit walnut interior and brass frames.
  const H = 2.7;
  const D = 0.6;
  W.add(0, 0, 0, len, D, 0.1, '#5e4230', 'box', 'wood', { solid: true })
    .add(0, 0, 0.1, len, 0.03, H - 0.1, '#a6764f', 'box', 'wood')
    .add(0, 0, H - 0.04, len, D, 0.04, '#8a5d3e', 'box', 'wood');
  for (const s of [-1, 1]) W.add(s * (len / 2 - 0.015), 0, 0.1, 0.03, D, H - 0.14, '#8a5d3e', 'box', 'wood');
  const half = len / 2;
  // Left: hanging clothes; right: shelves with folded stacks.
  W.add(-half / 2, 0.3, 1.95, half - 0.1, 0.02, 0.02, t.metal, 'cyl', 'metal', { rx: Math.PI / 2 });
  const tones = ['#f2efe9', '#d9cdbd', '#c9b49a', '#efe9df', '#b9a58c'];
  for (let k = 0; k < Math.floor((half - 0.15) / 0.11); k++) W.add(-half + 0.12 + k * 0.11, 0.3, 1.0, 0.035, 0.42, 0.92, tones[k % tones.length], 'rbox', 'fabric');
  for (let k = 0; k < 6; k++) {
    const y = 0.35 + k * 0.38;
    W.add(half / 2, 0.03, y, half - 0.06, D - 0.06, 0.025, '#b07d55', 'box', 'wood');
    if (k < 5) W.add(half / 2 - 0.1, 0.25, y + 0.025, 0.36, 0.3, 0.12 + (k % 2) * 0.05, tones[(k + 2) % tones.length], 'rbox', 'fabric');
  }
  W.add(0, 0.05, 0.12, 0.03, 0.02, H - 0.2, '#ffd9a0', 'box', 'glow');
  // Bronze-tinted glass doors in thin brass frames.
  const n = Math.max(2, Math.round(len / 0.5));
  W.add(0, D - 0.02, 0.1, len - 0.04, 0.012, H - 0.16, '#b39a7c', 'box', 'glass');
  for (let k = 0; k <= n; k++) W.add(-len / 2 + (k * len) / n, D - 0.01, 0.1, 0.02, 0.02, H - 0.14, t.metal, 'box', 'metal');
}

function npToilet(W: Wall, t: Theme) {
  const L = W.len;
  const uWC = -Math.min(0.5, L / 2 - 0.45);
  const uB = Math.min(0.5, L / 2 - 0.4);
  W.add(0, 0, 0, L - 0.04, 0.012, 2.6, '#ffffff', 'box', 'marble');
  T('wc');
  // Half-height ledge hiding the cistern, black flush plate, wall-hung WC.
  W.add(uWC, 0.012, 0, 0.9, 0.2, 1.05, '#ffffff', 'box', 'marble', { solid: true })
    .add(uWC, 0.012, 1.05, 0.92, 0.22, 0.03, '#2e2e2c', 'box', 'gloss')
    .add(uWC, 0.212, 0.78, 0.22, 0.008, 0.12, '#3a3a3a', 'box', 'metal')
    .add(uWC, 0.22, 0.3, 0.36, 0.52, 0.32, '#fafafa', 'cushion', 'gloss', { solid: true })
    .add(uWC - 0.25, 0.05, 1.08, 0.07, 0.07, 0.2, '#4a3426', 'cyl', 'gloss')
    .add(uWC - 0.12, 0.05, 1.08, 0.06, 0.06, 0.16, '#7a4a2a', 'cyl', 'gloss');
  T('basin');
  // Floating fluted walnut vanity, green terrazzo top, round back-lit mirror.
  W.add(uB, 0.012, 0.52, 0.85, 0.48, 0.33, t.woodLight, 'rbox', 'wood');
  for (let k = 0; k < 14; k++) W.add(uB - 0.4 + k * 0.06, 0.49, 0.53, 0.04, 0.012, 0.31, '#7a5236', 'box', 'wood');
  W.add(uB, 0.012, 0.85, 0.88, 0.5, 0.04, '#5c6650', 'box', 'gloss')
    .add(uB, 0.12, 0.88, 0.42, 0.3, 0.06, '#ffffff', 'rbox', 'gloss')
    .add(uB, 0.05, 0.89, 0.03, 0.03, 0.22, '#c9ced3', 'cyl', 'metal')
    .add(uB, -0.41 + 0.015, 1.6, 0.82, 0.82, 0.02, '#fff0cf', 'cyl', 'glow', { rx: Math.PI / 2 })
    .add(uB, -0.38 + 0.03, 1.6, 0.76, 0.76, 0.02, '#cfdde5', 'cyl', 'gloss', { rx: Math.PI / 2 });
  T('geyser');
  W.add(uB + 0.45, 0.02, 2.1, 0.3, 0.3, 0.42, '#f2f2f2', 'cyl', 'gloss');
}

function bookshelf(W: Wall, t: Theme, r: () => number) {
  W.add(0, 0, 0, 0.9, 0.32, 1.9, t.wood, 'box', 'wood', { solid: true });
  for (let row = 0; row < 4; row++) {
    let u = -0.38;
    while (u < 0.36) {
      const bw = 0.04 + r() * 0.05;
      W.add(u + bw / 2, 0.33, 0.12 + row * 0.45, bw, 0.02, 0.24 + r() * 0.1, BOOKS[Math.floor(r() * BOOKS.length)], 'box', 'matte');
      u += bw + 0.005;
    }
  }
}

function bunkBed(W: Wall, t: Theme) {
  W.add(0, 0, 0, 1.0, 2.0, 0.3, t.woodLight, 'rbox', 'wood', { solid: true })
    .add(0, 0.05, 0.3, 0.95, 1.9, 0.18, '#5dade2', 'cushion', 'fabric')
    .add(0, 0, 1.25, 1.0, 2.0, 0.12, t.woodLight, 'rbox', 'wood')
    .add(0, 0.05, 1.37, 0.95, 1.9, 0.18, '#f5b041', 'cushion', 'fabric')
    .add(-0.25, 0.15, 0.48, 0.4, 0.35, 0.12, '#ffffff', 'cushion', 'fabric')
    .add(-0.25, 0.15, 1.55, 0.4, 0.35, 0.12, '#ffffff', 'cushion', 'fabric');
  for (const u of [-0.48, 0.48]) for (const v of [0, 1.94]) W.add(u, v, 0, 0.06, 0.06, 1.8, t.wood, 'rbox', 'wood');
  for (let k = 0; k < 5; k++) W.add(0.52, 1.6, 0.3 + k * 0.25, 0.05, 0.3, 0.03, t.wood, 'rbox', 'wood');
}

function falseCeiling(out: Piece[], room: Room, lights: boolean) {
  const b = 0.45;
  const y = 2.72;
  const h = CEIL - y;
  const { x, y: z, w, h: d } = room;
  out.push(P(x + w / 2, y + h / 2, z + b / 2, w, h, b, '#fbfbf9', 'box', 'matte'));
  out.push(P(x + w / 2, y + h / 2, z + d - b / 2, w, h, b, '#fbfbf9', 'box', 'matte'));
  out.push(P(x + b / 2, y + h / 2, z + d / 2, b, h, d - 2 * b, '#fbfbf9', 'box', 'matte'));
  out.push(P(x + w - b / 2, y + h / 2, z + d / 2, b, h, d - 2 * b, '#fbfbf9', 'box', 'matte'));
  // Warm cove strip hidden behind the border lip
  out.push(P(x + w / 2, y + 0.02, z + b + 0.02, w - 2 * b, 0.02, 0.03, '#ffd9a0', 'box', 'glow'));
  out.push(P(x + w / 2, y + 0.02, z + d - b - 0.02, w - 2 * b, 0.02, 0.03, '#ffd9a0', 'box', 'glow'));
  out.push(P(x + b + 0.02, y + 0.02, z + d / 2, 0.03, 0.02, d - 2 * b, '#ffd9a0', 'box', 'glow'));
  out.push(P(x + w - b - 0.02, y + 0.02, z + d / 2, 0.03, 0.02, d - 2 * b, '#ffd9a0', 'box', 'glow'));
  if (lights) {
    const n = Math.max(2, Math.round(w / 1.4));
    for (let k = 0; k < n; k++) {
      const px = x + ((k + 0.5) / n) * w;
      for (const pz of [z + b / 2, z + d - b / 2]) out.push(P(px, y - 0.005, pz, 0.09, 0.01, 0.09, '#fff6e2', 'cyl', 'glow'));
    }
  }
}

/** Generates furniture, décor and fixtures for one flat (drawing-plan coords). */
export function furnish(layout: FlatLayout, profile: InteriorProfile, mode: 'sample' | 'lived' | 'bare', kidsRoom: string | null): Furnished {
  const t = profile.theme;
  const lived = mode === 'lived';
  const out: Piece[] = [];
  const fans: Furnished['fans'] = [];
  const lights: Furnished['lights'] = [];
  const anchors: Furnished['anchors'] = {};
  const r = rngFrom(profile.seed ^ 0x9e37);
  const np = t.id === 'northpark';

  // Fixtures in every mode: switch boards beside openings, ceiling points.
  for (const s of layout.segs) {
    if (s.kind !== 'door' && s.kind !== 'entry' && s.kind !== 'slide') continue;
    const horiz = s.y1 === s.y2;
    for (const ri of s.rooms) {
      if (ri == null) continue;
      const room = layout.rooms[ri];
      if (room.kind === 'balcony') continue;
      const fixed = horiz ? s.y1 : s.x1;
      const side = horiz ? Math.sign(room.y + room.h / 2 - fixed) : Math.sign(room.x + room.w / 2 - fixed);
      const along = s.gapC! + s.gapW! / 2 + 0.28;
      const n = 0.075 * side;
      out.push(horiz ? P(along, 1.2, fixed + n, 0.22, 0.12, 0.015, '#fdfdfd', 'rbox', 'gloss') : P(fixed + n, 1.2, along, 0.015, 0.12, 0.22, '#fdfdfd', 'rbox', 'gloss'));
    }
  }
  for (const room of layout.rooms) {
    const cx = room.x + room.w / 2;
    const cz = room.y + room.h / 2;
    ROOM = room.name;
    T('ceiling');
    const premium = ['living', 'dining'].includes(room.kind) || room.name.startsWith('Master');
    if (premium && profile.ceiling === 'cove' && mode !== 'bare' && room.w > 2.5 && room.h > 2.5) falseCeiling(out, room, true);
    else if (room.kind !== 'balcony') out.push(P(cx, CEIL - 0.02, cz, room.kind === 'toilet' ? 0.25 : 0.9, 0.03, room.kind === 'toilet' ? 0.25 : 0.08, '#fff7e6', room.kind === 'toilet' ? 'cyl' : 'rbox', 'glow'));
    else out.push(P(cx, 2.6, room.y + 0.13, 0.2, 0.12, 0.06, '#ffe8bd', 'rbox', 'glow'));
    if (['bed', 'living', 'lounge', 'study', 'kitchen', 'dining'].includes(room.kind)) lights.push({ x: cx, z: cz });
  }
  if (mode === 'bare') return { pieces: out, fans, lights, anchors };

  // Double curtains (sheer + drape) at windows and sliding doors.
  for (const s of layout.segs) {
    if (s.kind !== 'window' && s.kind !== 'slide') continue;
    const room = layout.rooms[s.rooms[0]];
    if (room.kind === 'balcony' || room.kind === 'toilet' || room.kind === 'kitchen' || room.kind === 'utility') continue;
    ROOM = room.name;
    T('window');
    const horiz = s.y1 === s.y2;
    const fixed = horiz ? s.y1 : s.x1;
    const side = horiz ? Math.sign(room.y + room.h / 2 - fixed) : Math.sign(room.x + room.w / 2 - fixed);
    const g0 = s.gapC! - s.gapW! / 2;
    const g1 = s.gapC! + s.gapW! / 2;
    const at = (along: number, off: number, len: number, h: number, y: number, color: string, mat: Mat, shape: Shape = 'box') =>
      out.push(horiz ? P(along, y, fixed + side * off, len, h, 0.04, color, shape, mat) : P(fixed + side * off, y, along, 0.04, h, len, color, shape, mat));
    at((g0 + g1) / 2, 0.16, g1 - g0 - 0.1, 2.5, 1.5, '#f4f1ea', 'glass');
    for (const p of [g0 - 0.12, g1 + 0.12]) {
      for (let k = 0; k < 3; k++) at(p - 0.12 + k * 0.12, 0.24 + (k % 2) * 0.03, 0.14, 2.7, 1.42, t.curtain, 'fabric', 'cushion');
    }
    at((g0 + g1) / 2, 0.24, g1 - g0 + 0.9, 0.025, 2.8, t.metal, 'metal', 'box');
  }

  for (const room of layout.rooms) {
    const free = freeEdges(layout, room);
    const e0 = free[0];
    const cx = room.x + room.w / 2;
    const cz = room.y + room.h / 2;
    ROOM = room.name;
    T();
    const ac = (e: Edge | undefined) => {
      if (!e) return;
      T('ac');
      wall(out, room, e, 0.95).add(0, 0, 2.3, 0.95, 0.22, 0.3, '#f7f7f7', 'rbox', 'gloss').add(0, 0.22, 2.36, 0.88, 0.005, 0.02, '#8fe0ff', 'box', 'glow');
    };

    switch (room.kind) {
      case 'bed': {
        const master = room.name.startsWith('Master');
        const eBed = e0 ?? quietEdges(layout, room)[0];
        if (!eBed) break;
        T('bed');
        if (room.name === kidsRoom) {
          bunkBed(wall(out, room, eBed, 1.0, 0.25), t);
          out.push(P(cx + 0.3, 0.15, cz + 0.4, 0.3, 0.3, 0.3, '#e74c3c', 'sphere', 'gloss'));
          out.push(P(cx - 0.2, 0.1, cz + 0.6, 0.4, 0.2, 0.3, '#f1c40f', 'rbox', 'gloss'));
          out.push(P(cx + 0.6, 0.12, cz - 0.2, 0.25, 0.25, 0.25, '#2ecc71', 'rbox', 'gloss'));
          out.push(P(cx + 0.1, 0.006, cz + 0.2, 1.6, 0.012, 1.2, '#5dade2', 'box', 'fabric'));
          const D = wall(out, room, eBed, 1.0, 0.85);
          for (let k = 0; k < 4; k++) D.add(-0.5 + k * 0.35, -0.15, 1.55 + (k % 2) * 0.35, 0.3, 0.3, 0.01, ART[k], 'cyl', 'gloss', { rx: Math.PI / 2 });
          anchors.kid = { x: cx + 0.3, z: cz + 0.1, ry: 0 };
        } else {
          const B = wall(out, room, eBed, 2.7);
          if (np) npBed(B, master ? (profile.bed === 'king' ? 1.95 : 1.6) : 1.5, t, master, !!e0);
          else {
            if (master) accentWall(B, Math.min(B.len - 0.3, 3.2), t, profile.accent, 1.3);
            bed(B, master ? (profile.bed === 'king' ? 1.95 : 1.6) : 1.5, t, r);
          }
        }
        const pool = [...free, ...quietEdges(layout, room).filter((e) => !free.includes(e))];
        const e1 = pool.find((e) => e !== eBed && e !== opposite(eBed)) ?? pool.find((e) => e !== eBed);
        if (e1) {
          const len = Math.min(2.4, edgeLen(room, e1) - 1.0);
          T('wardrobe');
          if (len > 0.8) {
            if (np && master) npWardrobe(wall(out, room, e1, len, 0.5), len, t);
            else wardrobe(wall(out, room, e1, len, 0.5), len, t, master);
          }
        }
        const e2 = free.find((e) => e !== eBed && e !== e1);
        T('dressing');
        if (e2 && edgeLen(room, e2) > 1.6) {
          const D = wall(out, room, e2, 1.1, 0.7);
          D.add(0, 0, 0, 1.0, 0.45, 0.75, t.woodLight, 'rbox', 'wood', { solid: true })
            .add(0, 0, 1.0, 0.6, 0.02, 0.85, '#d8e6ee', 'rbox', 'glass')
            .add(0, 0.5, 0, 0.45, 0.4, 0.45, t.fabric, 'cushion', 'fabric');
          if (lived) D.add(0.3, 0.1, 0.75, 0.08, 0.08, 0.18, '#d35400', 'cyl', 'gloss').add(0.15, 0.12, 0.75, 0.06, 0.06, 0.14, '#8e44ad', 'cyl', 'gloss');
        }
        if (profile.household === 'elders' && master) {
          out.push(P(cx, 0.22, cz + 0.9, 0.8, 0.44, 0.8, t.sofa, 'cushion', 'fabric', { solid: true }));
          out.push(P(cx, 0.65, cz + 1.25, 0.8, 0.65, 0.18, t.sofa, 'cushion', 'fabric'));
          anchors.armchair = { x: cx, z: cz + 0.9, ry: Math.PI };
        }
        if (lived) out.push(P(cx + 0.4, 0.03, cz - 0.3, 0.3, 0.05, 0.12, '#6d4c41', 'rbox', 'fabric'), P(cx + 0.55, 0.03, cz - 0.3, 0.3, 0.05, 0.12, '#6d4c41', 'rbox', 'fabric'));
        ac(free.find((e) => e === opposite(eBed)) ?? e1);
        fans.push({ x: cx, z: cz });
        break;
      }
      case 'living': {
        const sEdge = e0 ?? 'w';
        const S = wall(out, room, sEdge, 2.4);
        T('sofa');
        if (np) npLiving(S, t, lived);
        else {
          sofa(S, t, profile.sofa === 'L', lived, r);
          T('art');
          frame(S, -0.5, 1.45, 0.7, 0.5, ART[Math.floor(r() * ART.length)]);
          frame(S, 0.4, 1.5, 0.5, 0.4, ART[Math.floor(r() * ART.length)]);
        }
        anchors.sofa = S.anchor(-0.45, 0.48);
        const host = S.anchor(0.4, 2.8);
        anchors.host = { ...host, ry: host.ry + Math.PI };
        const op = opposite(sEdge);
        T('tv');
        tvWall(wall(out, room, op, 2.8), t, profile.accent);
        ac(free.find((e) => e !== sEdge && e !== op));
        T('plant');
        const [px, pz] = wall(out, room, sEdge, 0.4, 0.02).map(0.1, 0.3);
        plant(out, px, pz, 1.5, 'areca');
        const side = free.find((e) => e !== sEdge && e !== op);
        if (side && edgeLen(room, side) > 2) wall(out, room, side, 0.3, 0.5).add(0, -0.16, 2.05, 0.32, 0.32, 0.04, '#2b2420', 'cyl', 'wood', { rx: Math.PI / 2 }).add(0, -0.14 + 0.03, 2.05, 0.28, 0.28, 0.02, '#f8f6f0', 'cyl', 'gloss', { rx: Math.PI / 2 });
        fans.push({ x: cx, z: cz });
        break;
      }
      case 'dining':
        T('table');
        dining(out, cx, cz, profile.dining, room.w >= room.h, t, lived);
        T('crockery');
        if (e0 && edgeLen(room, e0) > 1.6) {
          const C = wall(out, room, e0, 1.4, 0.5);
          C.add(0, 0, 0, 1.4, 0.42, 0.85, t.wood, 'rbox', 'wood', { solid: true }).add(0, 0, 0.85, 1.4, 0.35, 1.2, t.woodLight, 'box', 'wood').add(0, 0.35, 1.0, 1.3, 0.01, 0.9, '#d8e6ee', 'box', 'glass');
          for (let k = 0; k < 5; k++) C.add(-0.5 + k * 0.25, 0.15, 1.05 + (k % 2) * 0.4, 0.16, 0.16, 0.16, '#f4f1ea', 'cyl', 'gloss');
        }
        break;
      case 'kitchen': {
        if (!e0) break;
        const K = wall(out, room, e0, edgeLen(room, e0));
        T('counter');
        kitchen(K, t, lived);
        // Marble-look backsplash between counter and wall cabinets.
        if (np) K.add(0, 0, 0.92, K.len - 0.2, 0.012, 0.56, '#ffffff', 'box', 'marble');
        const a = K.anchor(-K.len * 0.22, 0.95);
        anchors.cook = { ...a, ry: a.ry + Math.PI };
        const e1 = free.find((e) => e !== e0 && e !== opposite(e0));
        T('fridge');
        if (e1) {
          wall(out, room, e1, 0.75, 0.9)
            .add(0, 0, 0, 0.72, 0.7, 1.85, t.metal, 'rbox', 'metal', { solid: true })
            .add(-0.3, 0.71, 0.95, 0.025, 0.03, 0.55, '#555', 'rbox', 'metal')
            .add(0.18, 0.705, 1.55, 0.08, 0.005, 0.1, '#36c', 'box', 'glow');
        }
        if (room.open) {
          const cut = free.find((e) => e === opposite(e0));
          if (!cut) out.push(P(cx, 0.5, cz + room.h * 0.32, Math.min(1.6, room.w - 0.8), 1.0, 0.45, t.cabinet, 'rbox', 'gloss', { solid: true }), P(cx, 1.02, cz + room.h * 0.32, Math.min(1.7, room.w - 0.7), 0.04, 0.55, t.counter, 'rbox', 'gloss'));
        }
        break;
      }
      case 'toilet': {
        if (!e0) break;
        if (np) npToilet(wall(out, room, e0, edgeLen(room, e0)), t);
        else toilet(wall(out, room, e0, edgeLen(room, e0)), t);
        for (const e of free.slice(1)) wall(out, room, e, edgeLen(room, e)).add(0, 0, 0, edgeLen(room, e) - 0.04, 0.012, np ? 2.6 : 2.4, np ? '#ffffff' : '#dfe6ea', 'box', np ? 'marble' : 'gloss');
        if (room.w > 1.9 && room.h > 1.9) {
          T('shower');
          const G = wall(out, room, opposite(e0), 0.9, 0.85);
          G.add(0, 0.9, 0, 0.02, 0.9, 2.0, '#cfe6f5', 'box', 'glass').add(0, 0.25, 2.1, 0.25, 0.25, 0.02, np ? '#2a2a2a' : t.metal, np ? 'box' : 'cyl', 'metal').add(0, 0, 2.1, 0.03, 0.3, 0.03, np ? '#2a2a2a' : t.metal, 'box', 'metal');
        }
        break;
      }
      case 'pooja':
        T('mandir');
        if (e0) {
          const M = wall(out, room, e0, 0.8);
          M.add(0, 0, 0, 0.8, 0.42, 0.75, t.wood, 'rbox', 'wood')
            .add(0, 0.02, 0.75, 0.72, 0.38, 0.8, t.woodLight, 'rbox', 'wood')
            .add(0, 0.06, 0.78, 0.6, 0.02, 0.7, '#7a1f1f', 'box', 'fabric')
            .add(0, 0.12, 1.55, 0.45, 0.45, 0.32, t.metal, 'sphere', 'metal')
            .add(0, 0.2, 0.95, 0.16, 0.08, 0.28, '#e2a93b', 'rbox', 'metal')
            .add(-0.22, 0.3, 0.78, 0.07, 0.07, 0.04, '#ffb347', 'sphere', 'glow')
            .add(0.22, 0.3, 0.78, 0.07, 0.07, 0.04, '#ffb347', 'sphere', 'glow')
            .add(0.25, 0.1, 1.45, 0.08, 0.1, 0.08, t.metal, 'sphere', 'metal');
          const [rx, rz] = M.map(0, 0.85);
          out.push(P(rx, 0.006, rz, 0.6, 0.006, 0.6, '#e74c3c', 'cyl', 'matte'), P(rx, 0.008, rz, 0.42, 0.006, 0.42, '#f1c40f', 'cyl', 'matte'), P(rx, 0.01, rz, 0.22, 0.006, 0.22, '#ffffff', 'cyl', 'matte'));
        }
        break;
      case 'utility':
        T('washer');
        if (e0) {
          const U = wall(out, room, e0, 0.6, 0.3);
          U.add(0, 0, 0, 0.6, 0.6, 0.85, '#f4f4f4', 'rbox', 'gloss', { solid: true }).add(0, 0.6 - 0.19, 0.5, 0.38, 0.38, 0.03, '#2b2f35', 'cyl', 'gloss', { rx: Math.PI / 2 });
          wall(out, room, e0, 0.6, 0.8).add(0, 0, 0.6, 0.6, 0.45, 0.25, '#b8bec4', 'rbox', 'metal');
          if (lived) wall(out, room, opposite(e0), 0.8, 0.5).add(0, 0.1, 0, 0.8, 0.5, 1.1, '#bdc3c7', 'box', 'metal');
        }
        break;
      case 'study': {
        if (!e0) break;
        T('desk');
        const D = wall(out, room, e0, 1.3);
        D.add(0, 0, 0.72, 1.3, 0.6, 0.04, t.woodLight, 'rbox', 'wood', { solid: true })
          .add(-0.6, 0, 0, 0.05, 0.6, 0.72, t.woodLight, 'box', 'wood')
          .add(0.6, 0, 0, 0.05, 0.6, 0.72, t.woodLight, 'box', 'wood')
          .add(0, 0.12, 0.92, 0.62, 0.04, 0.38, '#111', 'rbox', 'gloss')
          .add(0, 0.165, 0.95, 0.58, 0.004, 0.33, '#4a90d9', 'box', 'glow')
          .add(0, 0.14, 0.76, 0.06, 0.06, 0.16, '#333', 'cyl', 'metal')
          .add(0.35, 0.3, 0.76, 0.35, 0.25, 0.02, '#c0c4c8', 'rbox', 'metal')
          .add(0, 0.7, 0.45, 0.5, 0.5, 0.08, '#333', 'cushion', 'fabric')
          .add(0, 0.95, 0.5, 0.48, 0.08, 0.55, '#333', 'cushion', 'fabric')
          .add(0, 0.7, 0, 0.06, 0.06, 0.45, '#222', 'cyl', 'metal');
        const a = D.anchor(0, 0.95);
        anchors.desk = { ...a, ry: a.ry + Math.PI };
        T('bookshelf');
        if (free[1]) bookshelf(wall(out, room, free[1], 0.9), t, r);
        fans.push({ x: cx, z: cz });
        break;
      }
      case 'lounge': {
        T('sofa');
        sofa(wall(out, room, e0 ?? 'n', 2.4), t, false, lived, r);
        if (free[1]) bookshelf(wall(out, room, free[1], 0.9, 0.3), t, r);
        out.push(P(cx + 0.7, 0.22, cz + 0.5, 0.75, 0.45, 0.75, t.accent, 'sphere', 'fabric'));
        plant(out, room.x + room.w - 0.4, room.y + room.h - 0.4, 1.2, 'areca');
        fans.push({ x: cx, z: cz });
        break;
      }
      case 'balcony': {
        const big = room.w * room.h > 8;
        const ty = room.y + room.h * 0.55;
        T('seating');
        if (np && big) {
          // Rattan lounge chair with cushion, round stone side table, tall bird-of-paradise.
          const lx = room.x + room.w * 0.62;
          out.push(
            P(lx, 0.22, ty, 0.75, 0.3, 0.8, '#c8b28e', 'rbox', 'wood', { solid: true }),
            P(lx, 0.42, ty + 0.02, 0.68, 0.1, 0.7, '#e9e6e0', 'cushion', 'fabric'),
            P(lx, 0.62, ty - 0.33, 0.72, 0.5, 0.12, '#c8b28e', 'rbox', 'wood', { rx: -0.25 }),
            P(lx, 0.66, ty - 0.27, 0.6, 0.38, 0.08, '#d9d6d0', 'cushion', 'fabric'),
            P(lx + 0.75, 0.25, ty, 0.42, 0.5, 0.42, '#cfcac2', 'cyl', 'matte'),
            P(lx + 0.75, 0.52, ty, 0.55, 0.04, 0.55, '#d9d4cc', 'cyl', 'gloss'),
          );
          anchors.balcony = { x: lx, z: ty, ry: 0 };
          T('plants');
          plant(out, room.x + 0.4, room.y + room.h / 2, 1.7, 'areca');
          break;
        }
        out.push(P(cx, 0.6, ty, 0.55, 0.03, 0.55, t.counter, 'cyl', 'gloss'), P(cx, 0.3, ty, 0.06, 0.6, 0.06, t.metal, 'cyl', 'metal'));
        for (const s of [-1, 1]) {
          out.push(P(cx + s * 0.65, 0.42, ty, 0.48, 0.08, 0.48, t.fabric, 'cushion', 'fabric'));
          out.push(P(cx + s * 0.65, 0.2, ty, 0.44, 0.4, 0.44, t.woodLight, 'rbox', 'wood'));
          out.push(P(cx + s * 0.65, 0.68, ty - 0.22, 0.46, 0.45, 0.05, t.woodLight, 'rbox', 'wood'));
        }
        if (big) anchors.balcony = { x: cx + 0.65, z: ty, ry: 0 };
        T('plants');
        plant(out, room.x + 0.35, room.y + room.h / 2, 0.9);
        plant(out, room.x + room.w - 0.35, room.y + room.h / 2, 1.1, 'areca');
        out.push(P(room.x + room.w - 0.95, 0.32, room.y + 0.22, 0.8, 0.6, 0.3, '#e6e6e6', 'rbox', 'gloss'), P(room.x + room.w - 0.95, 0.32, room.y + 0.375, 0.42, 0.42, 0.01, '#9aa0a6', 'cyl', 'metal', { rx: Math.PI / 2 }));
        if (lived && big) {
          out.push(P(cx - 1.8, 0.55, ty, 1.0, 0.04, 0.5, '#c9ced3', 'box', 'metal'));
          for (let k = 0; k < 4; k++) out.push(P(cx - 2.2 + k * 0.25, 0.75, ty, 0.2, 0.35, 0.02, ART[k], 'box', 'fabric'));
        }
        break;
      }
      case 'foyer':
        T('shoerack');
        if (e0) {
          const F = wall(out, room, e0, 1.2);
          F.add(0, 0, 0, 1.2, 0.35, 0.95, t.cabinet, 'rbox', 'wood').add(0, 0, 0.95, 1.22, 0.37, 0.03, t.counter, 'box', 'gloss').add(0, 0, 1.25, 0.6, 0.02, 0.85, '#d8e6ee', 'rbox', 'glass').add(0.4, 0.12, 0.98, 0.16, 0.16, 0.05, t.metal, 'cyl', 'metal');
          if (lived) F.add(0.3, 0.45, 0, 0.28, 0.11, 0.08, '#333', 'rbox', 'fabric').add(-0.2, 0.5, 0, 0.26, 0.1, 0.07, '#8e44ad', 'rbox', 'fabric').add(-0.45, 0.5, 0, 0.35, 0.25, 0.4, '#2c3e50', 'rbox', 'fabric');
          else plant(out, ...F.map(-0.55, 0.15), 0.8);
        }
        out.push(P(cx, 0.006, room.y + 0.6, 1.0, 0.012, 0.6, t.rug, 'box', 'fabric'));
        break;
      case 'store':
        if (e0) {
          const S = wall(out, room, e0, edgeLen(room, e0) - 0.2);
          S.add(0, 0, 0, edgeLen(room, e0) - 0.2, 0.45, 2.0, t.metal, 'box', 'metal', { solid: true });
          for (let k = 0; k < 3; k++) S.add(-0.3 + k * 0.3, 0.46, 0.5 + k * 0.5, 0.28, 0.02, 0.22, '#c49a6c', 'box', 'matte');
        }
        break;
      case 'stair': {
        const horiz = room.w >= room.h;
        for (let k = 0; k < 9; k++) {
          const tt = (k + 0.5) / 9;
          const h = (k + 1) * 0.18;
          out.push(
            horiz
              ? P(room.x + tt * room.w, h / 2, cz, room.w / 9, h, room.h - 0.3, t.floorLiving, 'box', 'gloss', { solid: true })
              : P(cx, h / 2, room.y + tt * room.h, room.w - 0.3, h, room.h / 9, t.floorLiving, 'box', 'gloss', { solid: true }),
          );
        }
        break;
      }
    }
  }
  return { pieces: out, fans, lights, anchors };
}
