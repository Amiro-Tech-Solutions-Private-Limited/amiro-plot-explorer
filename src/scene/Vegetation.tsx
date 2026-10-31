import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CABIN, CLUB, GATE_X, MAIN_ROAD, PARKING, POOL, RAMP, RING, SITE, trackDist, ZONES } from '../data/site';
import { TOWERS } from '../data/project';
import { TOWER_HX, TOWER_HZ } from '../lib/geometry';

type Species = 'rain' | 'gulmohar' | 'tabebuia' | 'ashoka' | 'palm' | 'neem';

export interface TreeInst {
  x: number;
  z: number;
  s: number;
  rot: number;
  sp: Species;
}

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* ---------- Placement ---------- */

const inRect = (x: number, z: number, cx: number, cz: number, w: number, d: number, m = 0) => Math.abs(x - cx) < w / 2 + m && Math.abs(z - cz) < d / 2 + m;

function blocked(x: number, z: number) {
  for (const t of TOWERS) {
    const c = Math.cos(t.rotationY);
    const s = Math.sin(t.rotationY);
    const dx = x - t.position[0];
    const dz = z - t.position[2];
    if (Math.abs(dx * c - dz * s) < TOWER_HX + 4 && Math.abs(dx * s + dz * c) < TOWER_HZ + 9) return true;
  }
  // Outside the compound: keep the main road clear.
  if (z > SITE.maxZ - 0.5 || x < SITE.minX + 0.5 || x > SITE.maxX - 0.5 || z < SITE.minZ + 0.5) {
    return Math.abs(z - MAIN_ROAD.z) < MAIN_ROAD.width / 2 + 3 || (Math.abs(x - GATE_X) < 9 && z > SITE.maxZ - 1 && z < MAIN_ROAD.z);
  }
  const rw = RING.width / 2 + 2;
  const onRing =
    ((Math.abs(z - RING.maxZ) < rw || Math.abs(z - RING.minZ) < rw) && x > RING.minX - rw && x < RING.maxX + rw) ||
    ((Math.abs(x - RING.minX) < rw || Math.abs(x - RING.maxX) < rw) && z > RING.minZ - rw && z < RING.maxZ + rw);
  if (onRing || (Math.abs(x - GATE_X) < rw + 1 && z > RING.maxZ)) return true;
  if (trackDist(x, z) < 2.6) return true;
  if (inRect(x, z, POOL.x, POOL.z, POOL.deckW, POOL.deckD, 2)) return true;
  if (inRect(x, z, CLUB.x, CLUB.z, CLUB.w, CLUB.d, 5)) return true;
  for (const k in ZONES) {
    const zn = ZONES[k];
    if (inRect(x, z, zn.x, zn.z, zn.w, zn.d, 2)) return true;
  }
  if (inRect(x, z, PARKING.x, PARKING.z, PARKING.w, PARKING.d, 3)) return true;
  if (inRect(x, z, RAMP.x, RAMP.z, RAMP.w, RAMP.d, 3)) return true;
  if (inRect(x, z, CABIN.x, CABIN.z, CABIN.w, CABIN.d, 4)) return true;
  if (inRect(x, z, GATE_X - 12.5, SITE.maxZ, 6, 6, 1)) return true;
  return false;
}

function place(): TreeInst[] {
  const r = rng(7);
  const out: TreeInst[] = [];
  const free = (x: number, z: number, gap: number) => !blocked(x, z) && !out.some((t) => Math.hypot(t.x - x, t.z - z) < gap);
  const add = (x: number, z: number, sp: Species, s = 0.85 + r() * 0.3) => out.push({ x, z, sp, s, rot: r() * Math.PI * 2 });

  // Palms ringing the pool deck and lining the entry drive.
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    const x = POOL.x + Math.cos(a) * (POOL.deckW / 2 + 2.5);
    const z = POOL.z + Math.sin(a) * (POOL.deckD / 2 + 2.5);
    if (free(x, z, 3)) add(x, z, 'palm');
  }
  for (let z = RING.maxZ + 6; z < SITE.maxZ - 3; z += 5) {
    if (free(GATE_X - RING.width / 2 - 2.5, z, 3)) add(GATE_X - RING.width / 2 - 2.5, z, 'palm');
    if (free(GATE_X + RING.width / 2 + 2.5, z, 3)) add(GATE_X + RING.width / 2 + 2.5, z, 'palm');
  }
  // Ashoka columns along the boundary wall.
  for (let x = SITE.minX + 4; x < SITE.maxX - 3; x += 5.5) if (free(x, SITE.minZ + 3, 3)) add(x, SITE.minZ + 3, 'ashoka');
  for (let z = SITE.minZ + 8; z < SITE.maxZ - 3; z += 5.5) {
    if (free(SITE.minX + 3, z, 3)) add(SITE.minX + 3, z, 'ashoka');
    if (free(SITE.maxX - 3, z, 3)) add(SITE.maxX - 3, z, 'ashoka');
  }
  // Shade and flowering trees in the lawns (Tabebuia / jacaranda-like purple bloom as in the renders).
  const mix: Species[] = ['rain', 'gulmohar', 'tabebuia', 'tabebuia', 'neem', 'rain', 'gulmohar'];
  let tries = 0;
  while (out.length < 150 && tries++ < 8000) {
    const x = SITE.minX + 4 + r() * (SITE.maxX - SITE.minX - 8);
    const z = SITE.minZ + 4 + r() * (SITE.maxZ - SITE.minZ - 8);
    const sp = mix[Math.floor(r() * mix.length)];
    if (!free(x, z, sp === 'rain' ? 8 : 5.5)) continue;
    add(x, z, sp);
  }
  // KIADB Aerospace Park greenery all round the site.
  tries = 0;
  const n0 = out.length;
  while (out.length < n0 + 320 && tries++ < 6000) {
    const x = SITE.minX - 90 + r() * (SITE.maxX - SITE.minX + 180);
    const z = SITE.minZ - 90 + r() * (MAIN_ROAD.z - SITE.minZ + 110);
    if (x > SITE.minX - 3 && x < SITE.maxX + 3 && z > SITE.minZ - 3 && z < SITE.maxZ + 3) continue;
    const sp: Species = r() < 0.55 ? 'rain' : r() < 0.6 ? 'neem' : 'tabebuia';
    if (!free(x, z, 7)) continue;
    add(x, z, sp, 0.9 + r() * 0.5);
  }
  // Street trees along the main road.
  for (let x = -300; x <= 300; x += 15) {
    if (Math.abs(x - GATE_X) < 16) continue;
    add(x, MAIN_ROAD.z + MAIN_ROAD.width / 2 + 5, x % 45 === 0 ? 'gulmohar' : 'rain', 0.8 + r() * 0.25);
  }
  return out;
}

export const TREE_LIST: TreeInst[] = place();

/* ---------- Textures ---------- */

function leafTexture(greens: string[], flowers: string[], flowerRatio: number, seed: number) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const r = rng(seed);
  for (let i = 0; i < 520; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * 112;
    const x = 128 + Math.cos(a) * d;
    const y = 128 + Math.sin(a) * d;
    const flower = r() < flowerRatio;
    g.save();
    g.translate(x, y);
    g.rotate(r() * Math.PI);
    g.fillStyle = flower ? flowers[Math.floor(r() * flowers.length)] : greens[Math.floor(r() * greens.length)];
    g.beginPath();
    if (flower) g.arc(0, 0, 4 + r() * 4, 0, Math.PI * 2);
    else g.ellipse(0, 0, 9 + r() * 7, 3.5 + r() * 2.5, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function frondTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.strokeStyle = '#6b7f3a';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(32, 0);
  g.lineTo(32, 256);
  g.stroke();
  for (let y = 8; y < 250; y += 5) {
    const w = 30 * Math.sin((y / 256) * Math.PI) + 4;
    g.strokeStyle = y % 10 ? '#4f7d34' : '#5d8c3c';
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(32, y);
    g.lineTo(32 - w, y + 12);
    g.moveTo(32, y);
    g.lineTo(32 + w, y + 12);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function barkTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#6a5240';
  g.fillRect(0, 0, 64, 256);
  const r = rng(3);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(40,28,20,0.35)' : 'rgba(150,130,110,0.25)';
    g.fillRect(r() * 64, r() * 256, 1 + r() * 3, 6 + r() * 26);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/* ---------- Geometry templates ---------- */

const UP = new THREE.Vector3(0, 1, 0);

function limb(from: THREE.Vector3, to: THREE.Vector3, r0: number, r1: number) {
  const len = from.distanceTo(to);
  const g = new THREE.CylinderGeometry(r1, r0, len, 7, 1, true);
  g.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(UP, to.clone().sub(from).normalize());
  g.applyQuaternion(q);
  g.translate(from.x, from.y, from.z);
  return g;
}

function cards(center: THREE.Vector3, clusters: THREE.Vector3[], size: number, r: () => number) {
  const parts: THREE.BufferGeometry[] = [];
  for (const p of clusters) {
    for (let k = 0; k < 3; k++) {
      const g = new THREE.PlaneGeometry(size * (0.8 + r() * 0.4), size * (0.8 + r() * 0.4));
      g.rotateY((k * Math.PI) / 3 + r() * 0.4);
      g.rotateX((r() - 0.5) * 0.9);
      g.translate(p.x, p.y, p.z);
      parts.push(g);
    }
  }
  const m = mergeGeometries(parts)!;
  // Spherical normals give soft, volumetric crown shading.
  const pos = m.attributes.position;
  const nrm = m.attributes.normal;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).sub(center).normalize();
    nrm.setXYZ(i, v.x, v.y * 0.8 + 0.2, v.z);
  }
  return m;
}

interface Template {
  wood: THREE.BufferGeometry;
  leaves: THREE.BufferGeometry;
  leafMap: THREE.Texture;
}

function broadleaf(seed: number, trunkH: number, crownR: number, crownH: number, flat: number, clusters: number, cardSize: number): { wood: THREE.BufferGeometry; leaves: THREE.BufferGeometry } {
  const r = rng(seed);
  const parts: THREE.BufferGeometry[] = [];
  const base = new THREE.Vector3(0, 0, 0);
  const top = new THREE.Vector3((r() - 0.5) * 0.4, trunkH, (r() - 0.5) * 0.4);
  parts.push(limb(base, top, 0.32, 0.22));
  const center = new THREE.Vector3(0, trunkH + crownH * 0.45, 0);
  const tips: THREE.Vector3[] = [];
  const nB = 5;
  for (let i = 0; i < nB; i++) {
    const a = (i / nB) * Math.PI * 2 + r() * 0.5;
    const tip = new THREE.Vector3(Math.cos(a) * crownR * 0.6, trunkH + crownH * (0.35 + r() * 0.3), Math.sin(a) * crownR * 0.6);
    parts.push(limb(top, tip, 0.18, 0.07));
    tips.push(tip);
  }
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < clusters; i++) {
    const u = r();
    const a = r() * Math.PI * 2;
    const rad = Math.sqrt(u) * crownR;
    const y = center.y + (Math.sqrt(Math.max(0, 1 - u)) * crownH * 0.5) * (r() < 0.75 ? 1 : -0.5) * flat;
    pts.push(new THREE.Vector3(Math.cos(a) * rad, y, Math.sin(a) * rad));
  }
  for (const t of tips) pts.push(t.clone().add(new THREE.Vector3(0, 0.6, 0)));
  return { wood: mergeGeometries(parts)!, leaves: cards(center, pts, cardSize, r) };
}

function columnar(seed: number) {
  const r = rng(seed);
  const H = 9;
  const parts = [limb(new THREE.Vector3(), new THREE.Vector3(0, H * 0.9, 0), 0.16, 0.06)];
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < 34; i++) {
    const y = 0.8 + r() * (H - 0.8);
    const rad = (1 - y / H) * 1.4 + 0.25;
    const a = r() * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * rad * r(), y, Math.sin(a) * rad * r()));
  }
  return { wood: mergeGeometries(parts)!, leaves: cards(new THREE.Vector3(0, H * 0.5, 0), pts, 1.3, r) };
}

function palm(seed: number) {
  const r = rng(seed);
  const parts: THREE.BufferGeometry[] = [];
  let p = new THREE.Vector3();
  const lean = new THREE.Vector3(r() - 0.5, 0, r() - 0.5).normalize().multiplyScalar(0.12);
  for (let i = 0; i < 7; i++) {
    const n = p.clone().add(new THREE.Vector3(lean.x * i * 0.25, 1.05, lean.z * i * 0.25));
    parts.push(limb(p, n, 0.2 - i * 0.008, 0.19 - i * 0.008));
    p = n;
  }
  const fronds: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 13; k++) {
    const g = new THREE.PlaneGeometry(0.9, 3.6, 1, 6);
    // Droop the frond along its length.
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const t = (pos.getY(i) + 1.8) / 3.6;
      pos.setZ(i, -t * t * 1.4);
    }
    g.translate(0, 1.8, 0);
    g.rotateX(Math.PI / 2 - 0.5 - r() * 0.5);
    g.rotateY((k / 13) * Math.PI * 2 + r() * 0.3);
    g.translate(p.x, p.y, p.z);
    fronds.push(g);
  }
  const leaves = mergeGeometries(fronds)!;
  leaves.computeVertexNormals();
  return { wood: mergeGeometries(parts)!, leaves };
}

let templates: Record<Species, Template> | null = null;
function getTemplates(): Record<Species, Template> {
  if (templates) return templates;
  const greens = ['#3f6f2e', '#4f8236', '#5b8f3c', '#355f27', '#6a9a45'];
  templates = {
    rain: { ...broadleaf(1, 3.6, 5.2, 3.2, 0.7, 46, 2.4), leafMap: leafTexture(['#5e9440', '#6fa64b', '#4d8034', '#7cb257'], [], 0, 11) },
    gulmohar: { ...broadleaf(2, 3.2, 4.2, 2.8, 0.8, 38, 2.1), leafMap: leafTexture(['#4f8a36', '#5f9a40', '#6aa64a'], ['#ff4a1c', '#ff6a2b', '#f2361a', '#ffb02e'], 0.6, 12) },
    tabebuia: { ...broadleaf(3, 3.4, 3.0, 3.6, 1.0, 34, 1.9), leafMap: leafTexture(['#5b8f3c'], ['#e78ab7', '#f3a6c8', '#d96ba3', '#f7c3dc'], 0.8, 13) },
    neem: { ...broadleaf(4, 2.8, 3.2, 3.4, 1.0, 36, 1.9), leafMap: leafTexture(greens, [], 0, 14) },
    ashoka: { ...columnar(5), leafMap: leafTexture(['#24461c', '#2f5a22', '#3a6a2a'], [], 0, 15) },
    palm: { ...palm(6), leafMap: frondTexture() },
  };
  return templates;
}

/* ---------- Materials ---------- */

const WIND = { value: 0 };

function leafMaterial(map: THREE.Texture) {
  const m = new THREE.MeshStandardMaterial({ map, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85 });
  m.onBeforeCompile = (s) => {
    s.uniforms.uWind = WIND;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWind;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float ph = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.23;
        #else
          float ph = 0.0;
        #endif
        float sway = max(position.y - 2.0, 0.0) * 0.025;
        transformed.x += sin(uWind * 1.3 + ph + position.y * 0.4) * sway;
        transformed.z += cos(uWind * 1.1 + ph * 1.3) * sway * 0.7;`,
      );
  };
  m.customProgramCacheKey = () => 'leaf-wind';
  return m;
}

/* ---------- Component ---------- */

function SpeciesMesh({ sp, list, barkMat }: { sp: Species; list: TreeInst[]; barkMat: THREE.Material }) {
  const t = getTemplates()[sp];
  const wood = useRef<THREE.InstancedMesh>(null);
  const leaves = useRef<THREE.InstancedMesh>(null);
  const mats = useMemo(() => {
    const leaf = leafMaterial(t.leafMap);
    const depth = new THREE.MeshDepthMaterial({ map: t.leafMap, alphaTest: 0.45, depthPacking: THREE.RGBADepthPacking });
    return { leaf, depth };
  }, [t]);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const c = new THREE.Color();
    list.forEach((tr, i) => {
      q.setFromAxisAngle(UP, tr.rot);
      m.compose(new THREE.Vector3(tr.x, 0, tr.z), q, new THREE.Vector3(tr.s, tr.s, tr.s));
      wood.current!.setMatrixAt(i, m);
      leaves.current!.setMatrixAt(i, m);
      const k = 0.85 + ((i * 37) % 30) / 100;
      leaves.current!.setColorAt(i, c.setRGB(k, k, k * 0.95));
    });
    for (const im of [wood.current!, leaves.current!]) {
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere();
    }
  }, [list]);

  return (
    <>
      <instancedMesh ref={wood} args={[t.wood, barkMat, list.length]} castShadow />
      <instancedMesh ref={leaves} args={[t.leaves, mats.leaf, list.length]} castShadow receiveShadow customDepthMaterial={mats.depth} />
    </>
  );
}

export function Vegetation() {
  const bySpecies = useMemo(() => {
    const m = new Map<Species, TreeInst[]>();
    for (const t of TREE_LIST) {
      if (!m.has(t.sp)) m.set(t.sp, []);
      m.get(t.sp)!.push(t);
    }
    return [...m.entries()];
  }, []);
  const barkMat = useMemo(() => new THREE.MeshStandardMaterial({ map: barkTexture(), roughness: 0.95 }), []);
  useFrame((_, dt) => {
    WIND.value += dt;
  });
  return (
    <group>
      {bySpecies.map(([sp, list]) => (
        <SpeciesMesh key={sp} sp={sp} list={list} barkMat={barkMat} />
      ))}
    </group>
  );
}
