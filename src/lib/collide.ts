export interface OBB {
  cx: number;
  cz: number;
  hx: number;
  hz: number;
  rot: number;
}

/** Push a circle (player) out of oriented boxes on the ground plane. */
export function resolveCircle(px: number, pz: number, radius: number, boxes: OBB[]): [number, number] {
  for (let iter = 0; iter < 2; iter++) {
    for (const b of boxes) {
      const c = Math.cos(b.rot);
      const s = Math.sin(b.rot);
      const dx = px - b.cx;
      const dz = pz - b.cz;
      const lx = dx * c - dz * s;
      const lz = dx * s + dz * c;
      if (Math.abs(lx) > b.hx + radius || Math.abs(lz) > b.hz + radius) continue;
      const qx = Math.max(-b.hx, Math.min(b.hx, lx));
      const qz = Math.max(-b.hz, Math.min(b.hz, lz));
      let nx = lx - qx;
      let nz = lz - qz;
      const d = Math.hypot(nx, nz);
      let rx = lx;
      let rz = lz;
      if (d > 1e-6) {
        if (d >= radius) continue;
        nx /= d;
        nz /= d;
        rx = qx + nx * radius;
        rz = qz + nz * radius;
      } else {
        const penX = b.hx - Math.abs(lx);
        const penZ = b.hz - Math.abs(lz);
        if (penX < penZ) rx = Math.sign(lx || 1) * (b.hx + radius);
        else rz = Math.sign(lz || 1) * (b.hz + radius);
      }
      px = b.cx + rx * c + rz * s;
      pz = b.cz - rx * s + rz * c;
    }
  }
  return [px, pz];
}
