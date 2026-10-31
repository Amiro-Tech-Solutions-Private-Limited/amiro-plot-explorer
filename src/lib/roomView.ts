import type { Flat } from '../data/types';
import { useStore } from '../store/useStore';
import { flatXform, furnishedOf, planToWorldXZ, worldToPlan } from './interiorFrame';
import { floorNav } from './floor';
import type { Pose } from './poses';

/** Look into the room from a clear perimeter spot instead of facing its nearest wall. */
export function roomViewPose(flat: Flat, name: string, fallback: { x: number; z: number }): Pose {
  const xf = flatXform(flat);
  const room = xf.layout.rooms.find(r => r.name === name)!;
  const grid = floorNav(flat.tower, flat.floor, useStore.getState().furnishing);
  const [cx, cz] = planToWorldXZ(xf, room.x + room.w / 2, room.y + room.h / 2);
  const feature=room.kind==='living'?'sofa':room.kind==='bed'?'bed':room.kind==='toilet'?'basin':null;
  const state=useStore.getState();
  const hero=feature?furnishedOf(flat,state.furnishing,state.themes[flat.id]).pieces.find(p=>p.tag===`${name}::${feature}`&&p.y<1):undefined;
  const [hx,hz]=hero?planToWorldXZ(xf,hero.x,hero.z):[cx,cz];
  let spot = fallback;
  let distance = 0;
  const seen = new Set<number>();
  for (let py = room.y + 0.55; py < room.y + room.h - 0.55; py += grid.cell) {
    for (let px = room.x + 0.55; px < room.x + room.w - 0.55; px += grid.cell) {
      const [wx, wz] = planToWorldXZ(xf, px, py);
      const i = Math.floor((wx - grid.x0) / grid.cell), j = Math.floor((wz - grid.z0) / grid.cell);
      const key = j * grid.w + i;
      if (i < 0 || j < 0 || i >= grid.w || j >= grid.h || grid.occ[key] || seen.has(key)) continue;
      seen.add(key);
      const x = grid.x0 + (i + 0.5) * grid.cell, z = grid.z0 + (j + 0.5) * grid.cell;
      const p = worldToPlan(xf, x, z);
      if (p.x < room.x + 0.45 || p.x > room.x + room.w - 0.45 || p.y < room.y + 0.45 || p.y > room.y + room.h - 0.45) continue;
      const d = Math.hypot(x - hx, z - hz);
      if (d > distance) { distance = d; spot = { x, z }; }
    }
  }
  return { pos: [spot.x, xf.baseY + 1.6, spot.z], target: [(cx+hx)/2, xf.baseY + 1.25, (cz+hz)/2], fov: 68 };
}
