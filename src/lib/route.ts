import type { FlatLayout } from './walls';
import { isOpen } from './walls';

export interface PlanPoint {
  x: number;
  y: number;
}

interface Edge {
  to: number;
  via: PlanPoint;
}

const graphs = new WeakMap<FlatLayout, Edge[][]>();

/** Room connectivity: doors, sliding doors and open-plan boundaries. */
function graphOf(layout: FlatLayout): Edge[][] {
  const hit = graphs.get(layout);
  if (hit) return hit;
  const g: Edge[][] = layout.rooms.map(() => []);
  const link = (a: number, b: number, via: PlanPoint) => {
    g[a].push({ to: b, via });
    g[b].push({ to: a, via });
  };
  for (const s of layout.segs) {
    const [a, b] = s.rooms;
    if (b == null) continue;
    if (s.kind === 'door' || s.kind === 'slide') {
      const horiz = s.y1 === s.y2;
      link(a, b, horiz ? { x: s.gapC!, y: s.y1 } : { x: s.x1, y: s.gapC! });
    }
  }
  // Open-plan neighbours have no wall segment, so derive their shared edge.
  const R = layout.rooms;
  for (let i = 0; i < R.length; i++) {
    for (let j = i + 1; j < R.length; j++) {
      if (!isOpen(R[i]) || !isOpen(R[j])) continue;
      const a = R[i];
      const b = R[j];
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (Math.abs(a.y + a.h - b.y) < 0.01 && ox > 0.5) link(i, j, { x: Math.max(a.x, b.x) + ox / 2, y: b.y });
      else if (Math.abs(b.y + b.h - a.y) < 0.01 && ox > 0.5) link(i, j, { x: Math.max(a.x, b.x) + ox / 2, y: a.y });
      else if (Math.abs(a.x + a.w - b.x) < 0.01 && oy > 0.5) link(i, j, { x: b.x, y: Math.max(a.y, b.y) + oy / 2 });
      else if (Math.abs(b.x + b.w - a.x) < 0.01 && oy > 0.5) link(i, j, { x: a.x, y: Math.max(a.y, b.y) + oy / 2 });
    }
  }
  graphs.set(layout, g);
  return g;
}

export function roomAt(layout: FlatLayout, p: PlanPoint) {
  return layout.rooms.findIndex((r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h);
}

export const roomCenter = (layout: FlatLayout, i: number): PlanPoint => {
  const r = layout.rooms[i];
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
};

/** Waypoints (plan coords) from one room to another through doorways, ending at `end`. */
export function route(layout: FlatLayout, from: number, to: number, end?: PlanPoint): PlanPoint[] {
  const g = graphOf(layout);
  const prev = new Map<number, { from: number; via: PlanPoint }>();
  const q = [from];
  const seen = new Set([from]);
  while (q.length) {
    const n = q.shift()!;
    if (n === to) break;
    for (const e of g[n]) {
      if (seen.has(e.to)) continue;
      seen.add(e.to);
      prev.set(e.to, { from: n, via: e.via });
      q.push(e.to);
    }
  }
  if (from !== to && !prev.has(to)) return end ? [end] : [roomCenter(layout, to)];
  const pts: PlanPoint[] = [];
  let cur = to;
  while (cur !== from) {
    const p = prev.get(cur)!;
    pts.unshift(p.via, roomCenter(layout, cur));
    cur = p.from;
  }
  if (end) {
    if (pts.length) pts[pts.length - 1] = end;
    else pts.push(end);
  }
  return pts;
}
