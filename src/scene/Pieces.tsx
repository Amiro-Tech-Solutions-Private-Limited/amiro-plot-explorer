import { useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Mat, Piece } from '../lib/furniture';
import { marbleTexture, surfaceTexture } from './textures';

export const PIECE_MATS: Record<Mat, THREE.Material> = {
  matte: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }),
  fabric: new THREE.MeshStandardMaterial({ vertexColors: true, map: surfaceTexture('linen'), bumpMap: surfaceTexture('linen'), bumpScale: 0.006, roughness: 0.94 }),
  wood: new THREE.MeshPhysicalMaterial({ vertexColors: true, map: surfaceTexture('oak'), bumpMap: surfaceTexture('oak'), bumpScale: 0.003, roughness: 0.48, clearcoat: 0.12, clearcoatRoughness: 0.55 }),
  metal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.85 }),
  gloss: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.12, metalness: 0.05 }),
  glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
  glass: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.04, metalness: 0.5, transparent: true, opacity: 0.45, depthWrite: false }),
  marble: new THREE.MeshStandardMaterial({ vertexColors: true, map: marbleTexture(), roughness: 0.18, metalness: 0.02 }),
};

const BASE = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 20),
  sphere: new THREE.SphereGeometry(0.5, 18, 12),
};

const rounded = new Map<string, THREE.BufferGeometry>();
function roundedBox(sx: number, sy: number, sz: number, cushion: boolean) {
  const q = (v: number) => Math.round(v * 50) / 50;
  const key = `${q(sx)}|${q(sy)}|${q(sz)}|${cushion}`;
  let g = rounded.get(key);
  if (!g) {
    const m = Math.min(sx, sy, sz);
    const radius = cushion ? m * 0.45 : Math.min(0.03, m * 0.35);
    g = new RoundedBoxGeometry(Math.max(q(sx), 0.002), Math.max(q(sy), 0.002), Math.max(q(sz), 0.002), cushion ? 3 : 2, radius);
    rounded.set(key, g);
  }
  return g;
}

const M = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const E = new THREE.Euler(0, 0, 0, 'YXZ');
const V = new THREE.Vector3();
const S = new THREE.Vector3();
const C = new THREE.Color();

function pieceGeometry(p: Piece) {
  let g: THREE.BufferGeometry;
  if (p.shape === 'rbox' || p.shape === 'cushion') {
    g = roundedBox(p.sx, p.sy, p.sz, p.shape === 'cushion').clone();
    S.set(1, 1, 1);
  } else {
    g = BASE[p.shape].clone();
    S.set(Math.max(p.sx, 0.001), Math.max(p.sy, 0.001), Math.max(p.sz, 0.001));
  }
  Q.setFromEuler(E.set(p.rx ?? 0, p.ry ?? 0, 0));
  M.compose(V.set(p.x, p.y, p.z), Q, S);
  g.applyMatrix4(M);
  // RoundedBoxGeometry is non-indexed; normalise so everything can be merged.
  if (g.index) {
    const ni = g.toNonIndexed();
    g.dispose();
    g = ni;
  }
  C.set(p.color);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    col[i * 3] = C.r;
    col[i * 3 + 1] = C.g;
    col[i * 3 + 2] = C.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

const cache = new WeakMap<Piece[], { mat: Mat; geo: THREE.BufferGeometry }[]>();

/** Merges all furniture of a flat into one mesh per material — rounded shapes, few draw calls. */
export function buildPieces(pieces: Piece[]) {
  const hit = cache.get(pieces);
  if (hit) return hit;
  const groups = new Map<Mat, THREE.BufferGeometry[]>();
  for (const p of pieces) {
    if (!groups.has(p.mat)) groups.set(p.mat, []);
    groups.get(p.mat)!.push(pieceGeometry(p));
  }
  const out = [...groups.entries()].map(([mat, list]) => {
    const geo = mergeGeometries(list, false)!;
    list.forEach((g) => g.dispose());
    geo.computeBoundingSphere();
    return { mat, geo };
  });
  cache.set(pieces, out);
  return out;
}

export function Pieces({ pieces, shadows = false }: { pieces: Piece[]; shadows?: boolean }) {
  const groups = useMemo(() => buildPieces(pieces), [pieces]);
  return (
    <>
      {groups.map(({ mat, geo }) => (
        <mesh
          key={mat}
          geometry={geo}
          material={PIECE_MATS[mat]}
          castShadow={shadows && mat !== 'glow' && mat !== 'glass'}
          receiveShadow={mat !== 'glow'}
          raycast={() => null}
        />
      ))}
    </>
  );
}
