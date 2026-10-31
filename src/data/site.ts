/**
 * North Park site, laid out after the published master plan (KIADB Aerospace Park, Bagalur).
 * The plan is rotated so the main road runs along the south edge; distances are scaled
 * ~1.35× so the modelled homes fit. Indicative.
 *
 * World axes: x = east, z = south.
 */
export const SITE = { minX: -52, maxX: 52, minZ: -80, maxZ: 80 };
/** 6 m fire-tender driveway looping the towers. */
export const RING = { minX: -46, maxX: 46, minZ: -74, maxZ: 72, width: 6 };
export const MAIN_ROAD = { z: 90, width: 14 };
/** Entrance gateway with signage obelisk (south-east corner, as on the master plan). */
export const GATE_X = 30;
export const CLUB = { x: -29, z: -8, w: 14, d: 16, h: 9 };
export const PLAY = { x: -31.5, z: 33, w: 12, d: 18 };
export const POOL = { x: 27, z: 8, w: 16, d: 9, deckW: 28, deckD: 17 };
/** Jogging path loop: a rounded rectangle just inside the driveway. */
export const TRACK = { minX: -40.5, maxX: 40.5, minZ: -68.5, maxZ: 66.5, r: 6, w: 2 };
export const PARKING = { x: 29, z: 61.5, w: 22, d: 6 };
export const RAMP = { x: 31, z: 46, w: 7, d: 14 };
export const CABIN = { x: 37.5, z: 76.5, w: 3.2, d: 3.2 };

export interface Zone {
  id: string;
  label: string;
  spec: string;
  x: number;
  z: number;
  w: number;
  d: number;
}

/** Outdoor amenities from the master plan legend. */
export const ZONES: Record<string, Zone> = {
  court: { id: 'court', label: 'Dribble court', spec: 'Half basketball court', x: -31.5, z: 55, w: 13, d: 14 },
  play: { id: 'play', label: 'Children’s play area', spec: 'On soft EPDM flooring', x: PLAY.x, z: PLAY.z, w: PLAY.w, d: PLAY.d },
  toddler: { id: 'toddler', label: 'Toddlers’ play', spec: 'Sand pit with low edge', x: -32, z: 15, w: 9, d: 8 },
  seating: { id: 'seating', label: 'Stepped seating gallery', spec: 'Amphitheatre steps', x: -32, z: 4.5, w: 10, d: 6 },
  elders: { id: 'elders', label: 'Elders’ outdoor gym', spec: 'Low-impact equipment', x: -31.5, z: -27, w: 12, d: 10 },
  cricket: { id: 'cricket', label: 'Cricket practice pitch', spec: 'Netted practice lane', x: -31.5, z: -46, w: 5, d: 22 },
  lawn: { id: 'lawn', label: 'Drivable green', spec: 'Grass-paver lawn for events', x: -24, z: -63, w: 24, d: 8 },
  yoga: { id: 'yoga', label: 'Yoga deck', spec: 'Timber deck with pergola', x: 31, z: -9.5, w: 11, d: 8 },
  pods: { id: 'pods', label: 'Work pods', spec: 'Glass pods with Wi-Fi', x: 31, z: -58, w: 10, d: 8 },
  utilities: { id: 'utilities', label: 'Utilities', spec: 'Transformer yard · OWC · gas bank', x: 0, z: -77, w: 30, d: 4 },
};

/** Points along the jogging loop (closed, clockwise), sampled once. */
export const TRACK_PATH: [number, number][] = (() => {
  const { minX, maxX, minZ, maxZ, r } = TRACK;
  const pts: [number, number][] = [];
  const arc = (cx: number, cz: number, a0: number) => {
    for (let i = 0; i <= 8; i++) {
      const a = a0 + (i / 8) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
    }
  };
  arc(maxX - r, maxZ - r, 0);
  arc(minX + r, maxZ - r, Math.PI / 2);
  arc(minX + r, minZ + r, Math.PI);
  arc(maxX - r, minZ + r, Math.PI * 1.5);
  return pts;
})();

const SEG_LEN = TRACK_PATH.map((p, i) => {
  const q = TRACK_PATH[(i + 1) % TRACK_PATH.length];
  return Math.hypot(q[0] - p[0], q[1] - p[1]);
});
export const TRACK_LEN = SEG_LEN.reduce((a, b) => a + b, 0);

/** Position and heading at fraction t of the loop; `inset` moves towards the inside. */
export function trackPoint(t: number, inset = 0): { x: number; z: number; yaw: number } {
  let d = (((t % 1) + 1) % 1) * TRACK_LEN;
  let i = 0;
  while (d > SEG_LEN[i]) {
    d -= SEG_LEN[i];
    i = (i + 1) % SEG_LEN.length;
  }
  const p = TRACK_PATH[i];
  const q = TRACK_PATH[(i + 1) % TRACK_PATH.length];
  const k = d / (SEG_LEN[i] || 1);
  const dx = (q[0] - p[0]) / (SEG_LEN[i] || 1);
  const dz = (q[1] - p[1]) / (SEG_LEN[i] || 1);
  // Inside of a clockwise (in x/z) loop is to the right of travel.
  return { x: p[0] + (q[0] - p[0]) * k - dz * inset, z: p[1] + (q[1] - p[1]) * k + dx * inset, yaw: Math.atan2(dx, dz) };
}

/** Distance from the jogging loop's centre line. */
export function trackDist(x: number, z: number) {
  const { minX, maxX, minZ, maxZ, r } = TRACK;
  const cx = Math.min(Math.max(x, minX + r), maxX - r);
  const cz = Math.min(Math.max(z, minZ + r), maxZ - r);
  const inner = Math.hypot(x - cx, z - cz);
  const inCore = x > minX + r && x < maxX - r && z > minZ + r && z < maxZ - r;
  if (inCore) return Math.min(x - minX, maxX - x, z - minZ, maxZ - z);
  return Math.abs(inner - r);
}
