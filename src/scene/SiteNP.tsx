import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { CABIN, CLUB, GATE_X, MAIN_ROAD, PARKING, RAMP, RING, SITE, TRACK, trackPoint, ZONES } from '../data/site';
import { TOWER_CENTERS } from '../data/project';
import { labelTexture } from './textures';
import { Boxes, type IBox } from './Boxes';
import { runtime } from '../store/runtime';

/*
 * North Park site: fire-tender driveway loop, jogging path, entrance gateway with signage
 * obelisk, clubhouse with terrace deck, pool, and the outdoor amenities from the master plan.
 */

const unitBox = new THREE.BoxGeometry(1, 1, 1);

function noiseTex(draw: (g: CanvasRenderingContext2D, r: () => number) => void, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  let s = 17;
  const r = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  draw(g, r);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

const grassTex = noiseTex((g, r) => {
  g.fillStyle = '#6f9a4a';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(${60 + r() * 50},${110 + r() * 50},${40 + r() * 30},0.25)`;
    g.beginPath();
    g.arc(r() * 256, r() * 256, 6 + r() * 26, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 4000; i++) {
    g.strokeStyle = r() < 0.5 ? 'rgba(40,80,25,0.35)' : 'rgba(150,190,90,0.3)';
    const x = r() * 256;
    const y = r() * 256;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (r() - 0.5) * 3, y - 3 - r() * 4);
    g.stroke();
  }
});

const asphaltTex = noiseTex((g, r) => {
  g.fillStyle = '#474c53';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9000; i++) {
    const v = 40 + r() * 70;
    g.fillStyle = `rgba(${v},${v},${v + 5},0.5)`;
    g.fillRect(r() * 256, r() * 256, 1.5, 1.5);
  }
});

const paverTex = noiseTex((g, r) => {
  g.fillStyle = '#9d958a';
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 4; x++) {
      const v = 200 + r() * 25;
      g.fillStyle = `rgb(${v},${v - 8},${v - 20})`;
      const off = y % 2 ? 32 : 0;
      g.fillRect(((x * 64 + off) % 256) + 2, y * 32 + 2, 60, 28);
      if (off) g.fillRect(-30, y * 32 + 2, 28, 28);
    }
  }
});

/** Accent paving for the drop-off plaza: charcoal and sandstone bands. */
const accentTex = noiseTex((g, r) => {
  g.fillStyle = '#cbbfa9';
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 32) {
    g.fillStyle = y % 64 ? '#d8cdb8' : '#5a5650';
    g.fillRect(0, y, 256, y % 64 ? 30 : 6);
  }
  for (let i = 0; i < 3000; i++) {
    g.fillStyle = `rgba(0,0,0,${r() * 0.05})`;
    g.fillRect(r() * 256, r() * 256, 2, 2);
  }
});

const grassPaverTex = noiseTex((g) => {
  g.fillStyle = '#7fae55';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(210,205,190,0.55)';
  g.lineWidth = 10;
  for (let i = 0; i <= 256; i += 64) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i, 256);
    g.stroke();
    g.beginPath();
    g.moveTo(0, i);
    g.lineTo(256, i);
    g.stroke();
  }
});

/** Ground material that tiles by world position, so planes of any size share one texture scale. */
function worldMat(map: THREE.Texture, metres: number, color = '#ffffff', roughness = 0.95) {
  const m = new THREE.MeshStandardMaterial({ map, color, roughness });
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vWUv;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\nvWUv = (modelMatrix * vec4(transformed, 1.0)).xz / ${metres.toFixed(2)};`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vWUv;')
      .replace('#include <map_fragment>', 'diffuseColor *= texture2D(map, vWUv);');
  };
  m.customProgramCacheKey = () => `world-${metres}-${map.uuid}`;
  return m;
}
const mat = (color: string, roughness = 0.85, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
const M = {
  grass: worldMat(grassTex, 6),
  farGround: mat('#9fb58c', 1),
  asphalt: worldMat(asphaltTex, 5),
  paver: worldMat(paverTex, 2.4),
  accent: worldMat(accentTex, 4),
  grassPaver: worldMat(grassPaverTex, 3),
  kerb: mat('#c9c6bf', 0.9),
  marking: new THREE.MeshBasicMaterial({ color: '#f4f4f0' }),
  wall: mat('#ece6da', 0.9),
  wallCap: mat('#6e6458', 0.8),
  stone: mat('#b9ab95', 0.85),
  charcoal: mat('#3c3f44', 0.6),
  gate: mat('#2f3640', 0.4, { metalness: 0.7 }),
  hedge: mat('#4d7f3b', 1),
  glass: mat('#86b9d8', 0.08, { metalness: 0.3, transparent: true, opacity: 0.55 }),
  white: mat('#f6f4ef', 0.8),
  wood: mat('#9a6b45', 0.8),
  deck: mat('#a5774f', 0.75),
  track: mat('#b5553a', 0.95),
  pole: mat('#3a3f46', 0.5, { metalness: 0.6 }),
  lamp: mat('#fff4d6', 0.5, { emissive: '#ffd79a', emissiveIntensity: 0 }),
  car: mat('#ffffff', 0.35, { metalness: 0.5 }),
  carGlass: mat('#1d2733', 0.1, { metalness: 0.4 }),
  rampDark: mat('#2b2f35', 1),
  court: mat('#2f7fc1', 0.9),
  courtKey: mat('#c8493f', 0.9),
  epdmA: mat('#d9473f', 1),
  epdmB: mat('#2f6fd1', 1),
  sand: mat('#e2cd98', 1),
  rubber: mat('#6f7f63', 1),
  pitch: mat('#5f9440', 0.95),
  net: new THREE.MeshBasicMaterial({ color: '#f5f5f5', wireframe: true, transparent: true, opacity: 0.35 }),
  yellow: mat('#f2c94c', 0.7),
  red: mat('#e04848', 0.7),
  green: mat('#45b36b', 0.7),
  steel: mat('#c9ced3', 0.35, { metalness: 0.8 }),
  creeper: mat('#3f7a32', 1),
};

function Flat({ x, z, w, d, y = 0.02, mat, ry = 0 }: { x: number; z: number; w: number; d: number; y?: number; mat: THREE.Material; ry?: number }) {
  return (
    <mesh position={[x, y, z]} rotation={[-Math.PI / 2, 0, ry]} material={mat} receiveShadow>
      <planeGeometry args={[w, d]} />
    </mesh>
  );
}

function Label({ text, x, z, ry = 0, w = 14, h = 2.6, color = '#ffffff', y = 0.05 }: { text: string; x: number; z: number; ry?: number; w?: number; h?: number; color?: string; y?: number }) {
  const tex = useMemo(() => labelTexture(text, { color, w: 1024, h: 190 }), [text, color]);
  return (
    <mesh position={[x, y, z]} rotation={[-Math.PI / 2, 0, ry]}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

function Sign({ text, position, w = 6, h = 0.9, color = '#f5e6c8', ry = 0 }: { text: string; position: [number, number, number]; w?: number; h?: number; color?: string; ry?: number }) {
  const tex = useMemo(() => labelTexture(text, { color, w: 1024, h: 150 }), [text, color]);
  return (
    <mesh position={position} rotation-y={ry}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={tex} transparent toneMapped={false} />
    </mesh>
  );
}

const RW = RING.width;

const roads = [
  { x: (RING.minX + RING.maxX) / 2, z: RING.maxZ, w: RING.maxX - RING.minX + RW, d: RW },
  { x: (RING.minX + RING.maxX) / 2, z: RING.minZ, w: RING.maxX - RING.minX + RW, d: RW },
  { x: RING.minX, z: (RING.minZ + RING.maxZ) / 2, w: RW, d: RING.maxZ - RING.minZ },
  { x: RING.maxX, z: (RING.minZ + RING.maxZ) / 2, w: RW, d: RING.maxZ - RING.minZ },
  { x: GATE_X, z: (RING.maxZ + SITE.maxZ) / 2 + 1, w: RW + 2, d: SITE.maxZ - RING.maxZ + 2 },
];

function dashes(): IBox[] {
  const out: IBox[] = [];
  for (let x = RING.minX + 8; x < RING.maxX - 6; x += 6) {
    out.push({ x, z: RING.maxZ, y: 0.035, sx: 3, sy: 0.01, sz: 0.15 });
    out.push({ x, z: RING.minZ, y: 0.035, sx: 3, sy: 0.01, sz: 0.15 });
  }
  for (let z = RING.minZ + 8; z < RING.maxZ - 6; z += 6) {
    out.push({ x: RING.minX, z, y: 0.035, sx: 0.15, sy: 0.01, sz: 3 });
    out.push({ x: RING.maxX, z, y: 0.035, sx: 0.15, sy: 0.01, sz: 3 });
  }
  for (let x = -600; x < 600; x += 8) out.push({ x, z: MAIN_ROAD.z, y: 0.035, sx: 4, sy: 0.01, sz: 0.18 });
  // Zebra crossing at the gate
  for (let k = -3; k <= 3; k++) out.push({ x: GATE_X + k * 1.1, z: MAIN_ROAD.z, y: 0.036, sx: 0.6, sy: 0.01, sz: MAIN_ROAD.width - 2 });
  return out;
}

function compoundWall(): { wall: IBox[]; cap: IBox[]; hedge: IBox[]; creeper: IBox[] } {
  const H = 2.4;
  const T = 0.3;
  const { minX, maxX, minZ, maxZ } = SITE;
  const g0 = GATE_X - 7;
  const g1 = GATE_X + 7;
  const segs = [
    { x: (minX + maxX) / 2, z: minZ, sx: maxX - minX, sz: T },
    { x: minX, z: (minZ + maxZ) / 2, sx: T, sz: maxZ - minZ },
    { x: maxX, z: (minZ + maxZ) / 2, sx: T, sz: maxZ - minZ },
    { x: (minX + g0) / 2, z: maxZ, sx: g0 - minX, sz: T },
    { x: (g1 + maxX) / 2, z: maxZ, sx: maxX - g1, sz: T },
  ];
  const wall = segs.map((s) => ({ ...s, y: H / 2, sy: H }));
  const cap = segs.map((s) => ({ ...s, y: H + 0.06, sy: 0.12, sx: s.sx + 0.2, sz: s.sz + 0.2 }));
  const hedge: IBox[] = [
    { x: (minX + maxX) / 2, z: minZ + 1.2, sx: maxX - minX - 3, sz: 1.2, y: 0.55, sy: 1.1 },
    { x: minX + 1.2, z: (minZ + maxZ) / 2, sx: 1.2, sz: maxZ - minZ - 3, y: 0.55, sy: 1.1 },
    { x: maxX - 1.2, z: (minZ + maxZ) / 2, sx: 1.2, sz: maxZ - minZ - 3, y: 0.55, sy: 1.1 },
  ];
  // Hanging creepers along the road-side wall, as in the North Park renders.
  const creeper: IBox[] = [];
  for (let x = minX + 2; x < maxX - 2; x += 1.6) {
    if (x > g0 - 1 && x < g1 + 1) continue;
    const h = 0.8 + ((x * 7.3) % 1) * 1.1;
    creeper.push({ x, z: maxZ + 0.2, y: H - h / 2, sx: 1.5, sy: h, sz: 0.16 });
  }
  return { wall, cap, hedge, creeper };
}

function lamps() {
  const poles: IBox[] = [];
  const heads: IBox[] = [];
  const add = (x: number, z: number) => {
    poles.push({ x, z, y: 2.4, sx: 0.12, sy: 4.8, sz: 0.12 });
    heads.push({ x, z, y: 4.85, sx: 0.5, sy: 0.14, sz: 0.5 });
  };
  const inset = RW / 2 + 1;
  for (let x = RING.minX + 8; x <= RING.maxX - 8; x += 16) {
    add(x, RING.maxZ - inset);
    add(x, RING.minZ + inset);
  }
  for (let z = RING.minZ + 12; z <= RING.maxZ - 8; z += 16) {
    add(RING.minX + inset, z);
    add(RING.maxX - inset, z);
  }
  for (let x = -300; x <= 300; x += 30) add(x, MAIN_ROAD.z - MAIN_ROAD.width / 2 - 1.5);
  return { poles, heads };
}

function benches(): IBox[] {
  const out: IBox[] = [];
  for (let i = 0; i < 26; i++) {
    const p = trackPoint(i / 26 + 0.013, 2.1);
    out.push({ x: p.x, z: p.z, y: 0.45, sx: 1.8, sy: 0.1, sz: 0.5, ry: p.yaw + Math.PI / 2, color: '#8b5e3c' });
  }
  return out;
}

function parking() {
  const lines: IBox[] = [];
  const cars: IBox[] = [];
  const roofs: IBox[] = [];
  const colors = ['#d9dde1', '#1f2329', '#a12a2a', '#2a4f8c', '#f2f2f2', '#6b7078', '#c58b2b'];
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const x = PARKING.x - PARKING.w / 2 + (i * PARKING.w) / n;
    lines.push({ x, z: PARKING.z, y: 0.04, sx: 0.12, sy: 0.01, sz: 5 });
    if (i < n && (i * 7) % 3 !== 0) {
      const cx = x + PARKING.w / n / 2;
      cars.push({ x: cx, z: PARKING.z, y: 0.6, sx: 1.8, sy: 0.8, sz: 4.3, color: colors[i % colors.length] });
      roofs.push({ x: cx, z: PARKING.z + 0.3, y: 1.25, sx: 1.6, sy: 0.55, sz: 2.2 });
    }
  }
  return { lines, cars, roofs };
}

/** Rounded-rectangle ring for the jogging path. */
function trackGeometry() {
  const { minX, maxX, minZ, maxZ, r, w } = TRACK;
  const rr = (o: number) => {
    const s = new THREE.Shape();
    const x0 = minX - o;
    const x1 = maxX + o;
    // Shape is drawn in (x, -z) so that rotating -90° about X lands it on the ground.
    const y0 = -(maxZ + o);
    const y1 = -(minZ - o);
    const rad = r + o;
    s.moveTo(x0 + rad, y0);
    s.lineTo(x1 - rad, y0);
    s.absarc(x1 - rad, y0 + rad, rad, -Math.PI / 2, 0, false);
    s.lineTo(x1, y1 - rad);
    s.absarc(x1 - rad, y1 - rad, rad, 0, Math.PI / 2, false);
    s.lineTo(x0 + rad, y1);
    s.absarc(x0 + rad, y1 - rad, rad, Math.PI / 2, Math.PI, false);
    s.lineTo(x0, y0 + rad);
    s.absarc(x0 + rad, y0 + rad, rad, Math.PI, Math.PI * 1.5, false);
    return s;
  };
  const outer = rr(w / 2);
  const inner = rr(-w / 2);
  outer.holes.push(new THREE.Path(inner.getPoints(48).reverse()));
  return new THREE.ShapeGeometry(outer, 48);
}

export function Site() {
  const d = useMemo(dashes, []);
  const wall = useMemo(compoundWall, []);
  const lp = useMemo(lamps, []);
  const bn = useMemo(benches, []);
  const pk = useMemo(parking, []);
  const trackGeo = useMemo(trackGeometry, []);
  const lampRef = useRef(1);

  useFrame(() => {
    const night = 1 - runtime.day;
    if (Math.abs(night - lampRef.current) > 0.01) {
      lampRef.current = night;
      M.lamp.emissiveIntensity = night * 3;
    }
  });

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.05, 0]} material={M.farGround} receiveShadow>
        <planeGeometry args={[4000, 4000]} />
      </mesh>
      <Flat x={0} z={(SITE.minZ + SITE.maxZ) / 2} w={SITE.maxX - SITE.minX} d={SITE.maxZ - SITE.minZ} y={0} mat={M.grass} />

      {/* Tower plinths and the drop-off plazas with accent paving */}
      {Object.values(TOWER_CENTERS).map(([x, z], i) => (
        <group key={i}>
          <Flat x={x} z={z} w={36} d={64} y={0.01} mat={M.paver} />
          <Flat x={x + 22} z={z} w={10} d={30} y={0.015} mat={M.accent} />
        </group>
      ))}

      {roads.map((r, i) => (
        <Flat key={i} x={r.x} z={r.z} w={r.w} d={r.d} y={0.025} mat={M.asphalt} />
      ))}
      <Flat x={0} z={MAIN_ROAD.z} w={1400} d={MAIN_ROAD.width} y={0.02} mat={M.asphalt} />
      <Flat x={0} z={MAIN_ROAD.z - MAIN_ROAD.width / 2 - 1.5} w={1400} d={3} y={0.03} mat={M.kerb} />
      <Flat x={0} z={MAIN_ROAD.z + MAIN_ROAD.width / 2 + 1.5} w={1400} d={3} y={0.03} mat={M.kerb} />
      <Boxes boxes={d} material={M.marking} />

      <Label text="6 m FIRE TENDER DRIVEWAY" x={RING.maxX} z={-20} ry={Math.PI / 2} w={16} h={2.2} />
      <Label text="FIRE TENDER DRIVEWAY" x={-10} z={RING.minZ} w={14} h={2.2} />
      <Label text="MAIN ROAD" x={-40} z={MAIN_ROAD.z + 3} w={14} h={3} />
      <Label text="ENTRY / EXIT" x={GATE_X} z={RING.maxZ + 6} w={6} h={1.3} />

      {/* Jogging path loop with benches along it */}
      <mesh geometry={trackGeo} rotation-x={-Math.PI / 2} position={[0, 0.03, 0]} material={M.track} receiveShadow />
      <Boxes boxes={bn} material={M.wood} castShadow />
      <Label text="JOGGING PATH" x={-TRACK.maxX} z={-25} ry={Math.PI / 2} w={7} h={1.2} y={0.06} />

      {/* Compound wall with hanging creepers */}
      <Boxes boxes={wall.wall} material={M.wall} castShadow receiveShadow />
      <Boxes boxes={wall.cap} material={M.wallCap} />
      <Boxes boxes={wall.hedge} material={M.hedge} castShadow />
      <Boxes boxes={wall.creeper} material={M.creeper} />

      <Gateway />

      {/* Security cabin */}
      <group position={[CABIN.x, 0, CABIN.z]}>
        <mesh position={[0, 1.4, 0]} scale={[CABIN.w, 2.8, CABIN.d]} geometry={unitBox} material={M.white} castShadow />
        <mesh position={[0, 2.95, 0]} scale={[CABIN.w + 0.8, 0.2, CABIN.d + 0.8]} geometry={unitBox} material={M.charcoal} castShadow />
        <mesh position={[-CABIN.w / 2 - 0.01, 1.6, 0]} scale={[0.02, 1, 2.2]} geometry={unitBox} material={M.glass} />
        <Sign text="SECURITY" position={[-CABIN.w / 2 - 0.05, 2.45, 0]} ry={-Math.PI / 2} w={2.2} h={0.35} color="#2b2b2b" />
      </group>

      {/* Lamps */}
      <Boxes boxes={lp.poles} material={M.pole} castShadow />
      <Boxes boxes={lp.heads} material={M.lamp} />

      <Clubhouse />
      <Amenities />
      <Ramp />

      {/* Visitor parking */}
      <Flat x={PARKING.x} z={PARKING.z} w={PARKING.w} d={PARKING.d} y={0.025} mat={M.asphalt} />
      <Boxes boxes={pk.lines} material={M.marking} />
      <Boxes boxes={pk.cars} material={M.car} castShadow />
      <Boxes boxes={pk.roofs} material={M.carGlass} castShadow />
      <Label text="VISITOR PARKING" x={PARKING.x} z={PARKING.z - 3.9} w={10} h={1.7} />
    </group>
  );
}

/** Entrance gateway with a signage obelisk, boom barrier and gate. */
function Gateway() {
  const z = SITE.maxZ;
  return (
    <group position={[GATE_X, 0, z]}>
      {[-7.4, 7.4].map((x) => (
        <mesh key={x} position={[x, 1.8, 0]} scale={[1.1, 3.6, 1.1]} geometry={unitBox} material={M.stone} castShadow />
      ))}
      <mesh position={[3.8, 1.1, -0.6]} scale={[6.6, 2, 0.1]} geometry={unitBox} material={M.gate} castShadow />
      {/* Boom barrier */}
      <mesh position={[-6.6, 0.55, -2]} scale={[0.4, 1.1, 0.4]} geometry={unitBox} material={M.charcoal} />
      <mesh position={[-3.6, 1.0, -2]} scale={[6, 0.1, 0.1]} geometry={unitBox} material={M.red} />
      {/* Signage obelisk */}
      <group position={[-12.5, 0, 1.2]}>
        <mesh position={[0, 0.3, 0]} scale={[3.2, 0.6, 2]} geometry={unitBox} material={M.stone} receiveShadow />
        <mesh position={[0, 4.2, 0]} scale={[1.6, 7.6, 1.3]} geometry={unitBox} material={M.charcoal} castShadow />
        <mesh position={[0, 4.2, 0.66]} scale={[0.12, 7, 0.02]} geometry={unitBox} material={M.lamp} />
        <Sign text="NORTH PARK" position={[0, 6.2, 0.67]} w={1.5} h={0.42} />
        <Sign text="by GENURISE" position={[0, 5.75, 0.67]} w={1.3} h={0.26} color="#d6c7a8" />
      </group>
    </group>
  );
}

function Clubhouse() {
  const { x, z, w, d } = CLUB;
  // Faces east (+x), towards the gap between the towers.
  return (
    <group position={[x, 0, z]}>
      <Flat x={2} z={0} w={w + 8} d={d + 6} y={0.015} mat={M.paver} />
      {/* Ground: glazed gym / indoor games */}
      <mesh position={[0, 2, 0]} scale={[w, 4, d]} geometry={unitBox} material={M.glass} castShadow />
      <mesh position={[-w / 4, 2, 0]} scale={[w / 2, 4, d - 0.4]} geometry={unitBox} material={M.white} castShadow />
      <mesh position={[0, 4.15, 0]} scale={[w + 1.2, 0.3, d + 1.2]} geometry={unitBox} material={M.white} castShadow receiveShadow />
      {/* First floor: multipurpose hall with a glass band */}
      <mesh position={[0, 6, -1]} scale={[w, 3.4, d - 2]} geometry={unitBox} material={M.white} castShadow receiveShadow />
      <mesh position={[w / 2 + 0.01, 6, -1]} scale={[0.02, 1.8, d - 4]} geometry={unitBox} material={M.glass} />
      {/* Vertical fins */}
      {Array.from({ length: 7 }, (_, i) => (
        <mesh key={i} position={[w / 2 + 0.25, 4, -d / 2 + 2 + i * 2]} scale={[0.25, 8, 0.12]} geometry={unitBox} material={M.wood} castShadow />
      ))}
      <mesh position={[0, 7.85, -1]} scale={[w + 0.6, 0.3, d - 1.4]} geometry={unitBox} material={M.charcoal} castShadow />
      {/* Terrace wooden deck with pergola and planters */}
      <mesh position={[0, 8.05, -1]} scale={[w - 1, 0.1, d - 3]} geometry={unitBox} material={M.deck} receiveShadow />
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} position={[-w / 2 + 1.5 + i * 1.4, 10.6, -1]} scale={[0.12, 0.2, 7]} geometry={unitBox} material={M.wood} castShadow />
      ))}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => <mesh key={`${sx}${sz}`} position={[sx * 5.4, 9.3, -1 + sz * 3.3]} scale={[0.18, 2.5, 0.18]} geometry={unitBox} material={M.wood} castShadow />),
      )}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, 8.45, -1 + s * (d / 2 - 2.2)]} scale={[w - 1.6, 0.7, 0.8]} geometry={unitBox} material={M.hedge} castShadow />
      ))}
      <Sign text="CLUBHOUSE" position={[w / 2 + 0.45, 4.6, 0]} ry={Math.PI / 2} w={5} h={0.7} color="#2b2b2b" />
    </group>
  );
}

function Amenities() {
  const Z = ZONES;
  const court = Z.court;
  const play = Z.play;
  const tod = Z.toddler;
  const seat = Z.seating;
  const eld = Z.elders;
  const cr = Z.cricket;
  const lawn = Z.lawn;
  const yoga = Z.yoga;
  const pods = Z.pods;
  const ut = Z.utilities;
  const courtLines = useMemo<IBox[]>(() => {
    const t = 0.1;
    return [
      { x: 0, z: -court.d / 2, sx: court.w, sz: t },
      { x: 0, z: court.d / 2, sx: court.w, sz: t },
      { x: -court.w / 2, z: 0, sx: t, sz: court.d },
      { x: court.w / 2, z: 0, sx: t, sz: court.d },
      { x: 0, z: -court.d / 2 + 5.8, sx: 4.9, sz: t },
    ].map((b) => ({ ...b, y: 0.05, sy: 0.01 }));
  }, [court]);
  return (
    <group>
      {/* Dribble court */}
      <group position={[court.x, 0, court.z]}>
        <Flat x={0} z={0} w={court.w} d={court.d} y={0.03} mat={M.court} />
        <Flat x={0} z={-court.d / 2 + 2.9} w={4.9} d={5.8} y={0.035} mat={M.courtKey} />
        <Boxes boxes={courtLines} material={M.marking} />
        <mesh position={[0, 1.7, -court.d / 2 - 0.4]} scale={[0.15, 3.4, 0.15]} geometry={unitBox} material={M.pole} castShadow />
        <mesh position={[0, 3.3, -court.d / 2 + 0.2]} scale={[1.8, 1.05, 0.05]} geometry={unitBox} material={M.white} castShadow />
        <mesh position={[0, 3.05, -court.d / 2 + 0.45]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.23, 0.02, 6, 20]} />
          <meshStandardMaterial color="#e2572b" />
        </mesh>
        <Label text="DRIBBLE COURT" x={0} z={court.d / 2 + 1.3} w={7} h={1.3} />
      </group>

      {/* Children's play area on EPDM */}
      <group position={[play.x, 0, play.z]}>
        <Flat x={0} z={-play.d / 4} w={play.w} d={play.d / 2} y={0.03} mat={M.epdmA} />
        <Flat x={0} z={play.d / 4} w={play.w} d={play.d / 2} y={0.03} mat={M.epdmB} />
        <mesh position={[-2.5, 1.5, -4]} scale={[1.6, 3, 1.6]} geometry={unitBox} material={M.yellow} castShadow />
        <mesh position={[-2.5, 1.2, -1.4]} rotation-x={0.62} scale={[1, 0.12, 4.2]} geometry={unitBox} material={M.red} castShadow />
        {[-1.2, 1.2].map((o) => (
          <mesh key={o} position={[2.5 + o, 1.4, 4]} scale={[0.15, 2.8, 0.15]} geometry={unitBox} material={M.pole} castShadow />
        ))}
        <mesh position={[2.5, 2.8, 4]} scale={[2.6, 0.15, 0.15]} geometry={unitBox} material={M.pole} castShadow />
        <mesh position={[2.5, 0.5, 4]} scale={[0.6, 0.06, 0.3]} geometry={unitBox} material={M.wood} castShadow />
        <mesh position={[2.8, 0.45, -3.5]} rotation-x={0.12} scale={[0.35, 0.1, 4]} geometry={unitBox} material={M.green} castShadow />
        <Label text="KIDS' PLAY" x={0} z={play.d / 2 + 1.2} w={6} h={1.2} />
      </group>

      {/* Toddlers' sand pit */}
      <group position={[tod.x, 0, tod.z]}>
        <Flat x={0} z={0} w={tod.w} d={tod.d} y={0.04} mat={M.sand} />
        {[
          [0, -tod.d / 2, tod.w, 0.3],
          [0, tod.d / 2, tod.w, 0.3],
          [-tod.w / 2, 0, 0.3, tod.d],
          [tod.w / 2, 0, 0.3, tod.d],
        ].map(([x, z, w, d], i) => (
          <mesh key={i} position={[x, 0.15, z]} scale={[w, 0.3, d]} geometry={unitBox} material={M.wood} castShadow />
        ))}
        {[-2, 0.5, 2.5].map((x, i) => (
          <mesh key={x} position={[x, 0.45, i - 1]} material={[M.yellow, M.green, M.red][i]} castShadow>
            <sphereGeometry args={[0.35, 12, 10]} />
          </mesh>
        ))}
      </group>

      {/* Stepped seating gallery */}
      <group position={[seat.x, 0, seat.z]}>
        {[0, 1, 2].map((k) => (
          <mesh key={k} position={[-seat.w / 2 + 1 + k * 1.2, 0.22 + k * 0.42, 0]} scale={[1.2, 0.44 + k * 0.84, seat.d]} geometry={unitBox} material={M.stone} castShadow receiveShadow />
        ))}
        <Label text="STEPPED SEATING" x={2} z={0} w={6} h={1.1} ry={Math.PI / 2} y={0.06} />
      </group>

      {/* Elders' outdoor gym */}
      <group position={[eld.x, 0, eld.z]}>
        <Flat x={0} z={0} w={eld.w} d={eld.d} y={0.03} mat={M.rubber} />
        {[
          [-3.5, -2.5],
          [0, -2.5],
          [3.5, -2.5],
          [-3.5, 2.5],
          [0, 2.5],
          [3.5, 2.5],
        ].map(([x, z], i) => (
          <group key={i} position={[x, 0, z]}>
            <mesh position={[0, 0.8, 0]} scale={[0.14, 1.6, 0.14]} geometry={unitBox} material={M.yellow} castShadow />
            <mesh position={[0, 1.2, 0]} scale={[1.1, 0.08, 0.08]} geometry={unitBox} material={M.steel} castShadow />
            <mesh position={[0, 0.45, 0.3]} scale={[0.6, 0.08, 0.4]} geometry={unitBox} material={M.steel} />
          </group>
        ))}
        <Label text="ELDERS' GYM" x={0} z={eld.d / 2 + 1.1} w={6} h={1.1} />
      </group>

      {/* Cricket practice pitch with net */}
      <group position={[cr.x, 0, cr.z]}>
        <Flat x={0} z={0} w={cr.w} d={cr.d} y={0.03} mat={M.pitch} />
        <Flat x={0} z={0} w={1.5} d={cr.d - 4} y={0.035} mat={M.sand} />
        <mesh position={[0, 1.8, 0]} scale={[cr.w, 3.6, cr.d]} material={M.net}>
          <boxGeometry args={[1, 1, 1, 4, 6, 18]} />
        </mesh>
        {[-cr.d / 2 + 2.5, cr.d / 2 - 2.5].map((z) =>
          [-0.12, 0, 0.12].map((x) => <mesh key={`${z}${x}`} position={[x, 0.36, z]} scale={[0.04, 0.72, 0.04]} geometry={unitBox} material={M.white} />),
        )}
        <Label text="CRICKET PITCH" x={cr.w / 2 + 1.3} z={0} w={7} h={1.1} ry={Math.PI / 2} />
      </group>

      {/* Drivable green */}
      <Flat x={lawn.x} z={lawn.z} w={lawn.w} d={lawn.d} y={0.03} mat={M.grassPaver} />
      <Label text="DRIVABLE GREEN" x={lawn.x} z={lawn.z} w={8} h={1.3} y={0.06} />

      {/* Yoga deck with pergola */}
      <group position={[yoga.x, 0, yoga.z]}>
        <mesh position={[0, 0.15, 0]} scale={[yoga.w, 0.3, yoga.d]} geometry={unitBox} material={M.deck} receiveShadow castShadow />
        {[-1, 1].flatMap((sx) =>
          [-1, 1].map((sz) => <mesh key={`${sx}${sz}`} position={[sx * (yoga.w / 2 - 0.4), 1.6, sz * (yoga.d / 2 - 0.4)]} scale={[0.2, 2.9, 0.2]} geometry={unitBox} material={M.wood} castShadow />),
        )}
        {Array.from({ length: 9 }, (_, i) => (
          <mesh key={i} position={[-yoga.w / 2 + 0.6 + i * 1.2, 3.1, 0]} scale={[0.12, 0.2, yoga.d]} geometry={unitBox} material={M.wood} castShadow />
        ))}
        {[-2.5, 0, 2.5].map((x) => (
          <mesh key={x} position={[x, 0.31, 1]} scale={[0.7, 0.02, 1.8]} geometry={unitBox} material={M.epdmB} />
        ))}
        <Label text="YOGA DECK" x={0} z={yoga.d / 2 + 1.1} w={5} h={1} />
      </group>

      {/* Work pods */}
      <group position={[pods.x, 0, pods.z]}>
        <Flat x={0} z={0} w={pods.w} d={pods.d} y={0.02} mat={M.paver} />
        {[-3, 0, 3].map((x) => (
          <group key={x} position={[x, 0, 0]}>
            <mesh position={[0, 1.3, 0]} scale={[2.4, 2.6, 2.4]} geometry={unitBox} material={M.glass} castShadow />
            <mesh position={[0, 2.7, 0]} scale={[2.7, 0.2, 2.7]} geometry={unitBox} material={M.white} castShadow />
            <mesh position={[0, 0.75, -0.6]} scale={[1.6, 0.05, 0.7]} geometry={unitBox} material={M.wood} />
          </group>
        ))}
        <Label text="WORK PODS" x={0} z={pods.d / 2 + 1} w={5} h={1} />
      </group>

      {/* Utilities strip (north boundary) */}
      <group position={[ut.x, 0, ut.z]}>
        <mesh position={[-10, 1.2, 0]} scale={[7, 2.4, 3]} geometry={unitBox} material={M.charcoal} castShadow />
        <mesh position={[-10, 1.1, 1.55]} scale={[7.2, 2.2, 0.05]} material={M.net}>
          <boxGeometry args={[1, 1, 1, 10, 4, 1]} />
        </mesh>
        <mesh position={[0, 0.9, 0]} scale={[4, 1.8, 2.6]} geometry={unitBox} material={M.white} castShadow />
        {[8, 9.4, 10.8].map((x) => (
          <mesh key={x} position={[x, 0.9, 0]} rotation-z={Math.PI / 2} material={M.steel} castShadow>
            <cylinderGeometry args={[0.55, 0.55, 2.6, 14]} />
          </mesh>
        ))}
        <Label text="TRANSFORMER · OWC · GAS BANK" x={0} z={2.6} w={12} h={1.1} />
      </group>
    </group>
  );
}

function Ramp() {
  const { x, z, w, d } = RAMP;
  return (
    <group position={[x, 0, z]}>
      <Flat x={0} z={0} w={w} d={d} y={0.04} mat={M.rampDark} />
      <mesh position={[-w / 2 - 0.15, 0.5, 0]} scale={[0.3, 1, d]} geometry={unitBox} material={M.wall} castShadow />
      <mesh position={[w / 2 + 0.15, 0.5, 0]} scale={[0.3, 1, d]} geometry={unitBox} material={M.wall} castShadow />
      <mesh position={[0, 2.6, -d / 2 + 1]} scale={[w + 1, 0.25, 3]} geometry={unitBox} material={M.white} castShadow />
      <Label text="BASEMENT ↓" x={0} z={0} ry={Math.PI / 2} w={9} h={1.8} color="#f2c94c" />
    </group>
  );
}
