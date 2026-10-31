import type { OBB } from './collide';

/** Occupancy grid on the ground plane for A* path-finding around walls and furniture. */
export interface NavGrid {
  x0: number;
  z0: number;
  cell: number;
  w: number;
  h: number;
  /** 1 = blocked */
  occ: Uint8Array;
}

export function buildGrid(boxes: OBB[], radius = 0.26, cell = 0.2): NavGrid {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const b of boxes) {
    const r = Math.hypot(b.hx, b.hz);
    minX = Math.min(minX, b.cx - r);
    maxX = Math.max(maxX, b.cx + r);
    minZ = Math.min(minZ, b.cz - r);
    maxZ = Math.max(maxZ, b.cz + r);
  }
  const x0 = minX - 1;
  const z0 = minZ - 1;
  const w = Math.ceil((maxX - minX + 2) / cell);
  const h = Math.ceil((maxZ - minZ + 2) / cell);
  const occ = new Uint8Array(w * h);
  for (const b of boxes) {
    const c = Math.cos(b.rot);
    const s = Math.sin(b.rot);
    const hx = b.hx + radius;
    const hz = b.hz + radius;
    const r = Math.hypot(hx, hz);
    const i0 = Math.max(0, Math.floor((b.cx - r - x0) / cell));
    const i1 = Math.min(w - 1, Math.ceil((b.cx + r - x0) / cell));
    const j0 = Math.max(0, Math.floor((b.cz - r - z0) / cell));
    const j1 = Math.min(h - 1, Math.ceil((b.cz + r - z0) / cell));
    for (let j = j0; j <= j1; j++) {
      const z = z0 + (j + 0.5) * cell - b.cz;
      for (let i = i0; i <= i1; i++) {
        const x = x0 + (i + 0.5) * cell - b.cx;
        const lx = x * c - z * s;
        const lz = x * s + z * c;
        if (Math.abs(lx) > hx || Math.abs(lz) > hz) continue;
        // Rounded inflation at the corners keeps doorways passable.
        const ox = Math.max(0, Math.abs(lx) - b.hx);
        const oz = Math.max(0, Math.abs(lz) - b.hz);
        if (ox * ox + oz * oz <= radius * radius) occ[j * w + i] = 1;
      }
    }
  }
  return { x0, z0, cell, w, h, occ };
}

const cellOf = (g: NavGrid, x: number, z: number): [number, number] => [Math.floor((x - g.x0) / g.cell), Math.floor((z - g.z0) / g.cell)];
const centre = (g: NavGrid, i: number, j: number): [number, number] => [g.x0 + (i + 0.5) * g.cell, g.z0 + (j + 0.5) * g.cell];

export function blockedAt(g: NavGrid, x: number, z: number) {
  const [i, j] = cellOf(g, x, z);
  if (i < 0 || j < 0 || i >= g.w || j >= g.h) return false;
  return g.occ[j * g.w + i] === 1;
}

/** Nearest free cell within `maxR` metres (spiral search). */
export function nearestFree(g: NavGrid, x: number, z: number, maxR = 1.6): [number, number] | null {
  const [ci, cj] = cellOf(g, x, z);
  const R = Math.ceil(maxR / g.cell);
  let best: [number, number] | null = null;
  let bd = Infinity;
  for (let dj = -R; dj <= R; dj++) {
    for (let di = -R; di <= R; di++) {
      const i = ci + di;
      const j = cj + dj;
      if (i < 0 || j < 0 || i >= g.w || j >= g.h || g.occ[j * g.w + i]) continue;
      const d = di * di + dj * dj;
      if (d < bd) {
        bd = d;
        best = [i, j];
      }
    }
  }
  return best ? centre(g, best[0], best[1]) : null;
}

export function lineClear(g: NavGrid, ax: number, az: number, bx: number, bz: number) {
  const d = Math.hypot(bx - ax, bz - az);
  const n = Math.max(1, Math.ceil(d / (g.cell * 0.5)));
  // Ignore the first few samples if we start inside a padded cell (e.g. hugging a wall).
  let leaving = blockedAt(g, ax, az);
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const b = blockedAt(g, ax + (bx - ax) * t, az + (bz - az) * t);
    if (leaving) {
      if (!b || t * d > 0.4) leaving = false;
      if (b && t * d <= 0.4) continue;
    }
    if (b) return false;
  }
  return true;
}

/** A* on the grid, then string-pulled. Returns world points after the start (ending at the goal). */
export function findPath(g: NavGrid, sx: number, sz: number, tx: number, tz: number): [number, number][] | null {
  const s = blockedAt(g, sx, sz) ? nearestFree(g, sx, sz) : ([sx, sz] as [number, number]);
  const t = blockedAt(g, tx, tz) ? nearestFree(g, tx, tz) : ([tx, tz] as [number, number]);
  if (!s || !t) return null;
  if (lineClear(g, s[0], s[1], t[0], t[1])) return [t];
  const [si, sj] = cellOf(g, s[0], s[1]);
  const [ti, tj] = cellOf(g, t[0], t[1]);
  const W = g.w;
  const N = W * g.h;
  const start = sj * W + si;
  const goal = tj * W + ti;
  if (start < 0 || start >= N || goal < 0 || goal >= N) return null;
  const gs = new Float32Array(N).fill(Infinity);
  const from = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const heap: number[] = [];
  const f = new Float32Array(N);
  const hfun = (k: number) => {
    const dx = Math.abs((k % W) - ti);
    const dz = Math.abs(Math.floor(k / W) - tj);
    return Math.max(dx, dz) + 0.4142 * Math.min(dx, dz);
  };
  const push = (k: number) => {
    heap.push(k);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (f[heap[p]] <= f[heap[i]]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && f[heap[l]] < f[heap[m]]) m = l;
        if (r < heap.length && f[heap[r]] < f[heap[m]]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  gs[start] = 0;
  f[start] = hfun(start);
  push(start);
  const DIRS = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, 1.4142],
    [1, -1, 1.4142],
    [-1, 1, 1.4142],
    [-1, -1, 1.4142],
  ];
  let found = false;
  let iter = 0;
  while (heap.length && iter++ < 200000) {
    const k = pop();
    if (closed[k]) continue;
    if (k === goal) {
      found = true;
      break;
    }
    closed[k] = 1;
    const i = k % W;
    const j = Math.floor(k / W);
    for (const [di, dj, c] of DIRS) {
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= W || nj >= g.h) continue;
      const nk = nj * W + ni;
      if (g.occ[nk] || closed[nk]) continue;
      // No corner cutting through blocked diagonals.
      if (di && dj && (g.occ[j * W + ni] || g.occ[nj * W + i])) continue;
      const ng = gs[k] + c;
      if (ng < gs[nk]) {
        gs[nk] = ng;
        from[nk] = k;
        f[nk] = ng + hfun(nk);
        push(nk);
      }
    }
  }
  if (!found) return null;
  const cells: [number, number][] = [];
  for (let k = goal; k !== -1 && k !== start; k = from[k]) cells.push(centre(g, k % W, Math.floor(k / W)));
  cells.reverse();
  cells[cells.length - 1] = t;
  // String-pull: keep only the points needed to stay in line of sight.
  const out: [number, number][] = [];
  let ax = s[0];
  let az = s[1];
  let i = 0;
  while (i < cells.length) {
    let j = cells.length - 1;
    while (j > i && !lineClear(g, ax, az, cells[j][0], cells[j][1])) j--;
    out.push(cells[j]);
    [ax, az] = cells[j];
    i = j + 1;
  }
  return out;
}
