import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Billboard, Html } from '@react-three/drei';
import type { Flat, Tower as TowerT } from '../data/types';
import { FLAT_BY_ID, PROJECT, towerName, unitOf, WING_GAP } from '../data/project';
import {
  CORE_HALF,
  FLAT_D,
  FLAT_W,
  FLOOR_H,
  FLOORS,
  floorBaseY,
  flatFrame,
  GROUND_H,
  planToLocal,
  ROOF_Y,
  SLAB_T,
  TOWER_HX,
  TOWER_HZ,
} from '../lib/geometry';
import { useStore } from '../store/useStore';
import { useMatchSet } from '../store/hooks';
import { runtime } from '../store/runtime';
import { STATUS_COLOR } from '../lib/colors';
import { flatXform } from '../lib/interiorFrame';
import { coreTexture, labelTexture, realFacadeTexture } from './textures';
import { seedAttribute, withLitWindows } from './facadeMaterial';
import { HomeModel } from './HomeModel';
import { Boxes, type IBox } from './Boxes';
import { Person, LOOKS } from './Person';

interface Inst {
  floor: number;
  x: number;
  z: number;
  yOff: number;
  sx: number;
  sy: number;
  sz: number;
  ry: number;
}

const unitBox = new THREE.BoxGeometry(1, 1, 1);
/** Plan-x span of the deep recess splitting each home's façade, and how far it is set back. */
const NOTCH: [number, number] = [5.9, 7.3];
const NOTCH_D = 2.2;
const M = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const P = new THREE.Vector3();
const S = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const C = new THREE.Color();
const WHITE = new THREE.Color('#ffffff');
const FLAT_H = FLOOR_H - SLAB_T;

const mats = {
  slab: new THREE.MeshStandardMaterial({ color: '#f2efe9', roughness: 0.8 }),
  core: new THREE.MeshStandardMaterial({ color: '#e9e5de', roughness: 0.85 }),
  balc: new THREE.MeshStandardMaterial({ color: '#ebe6de', roughness: 0.85 }),
  parapet: new THREE.MeshStandardMaterial({ color: '#f6f4ef', roughness: 0.85 }),
  glass: new THREE.MeshStandardMaterial({ color: '#bcd9ea', roughness: 0.04, metalness: 0.3, transparent: true, opacity: 0.32, depthWrite: false }),
  rail: new THREE.MeshStandardMaterial({ color: '#c9ced3', roughness: 0.3, metalness: 0.85 }),
  fin: new THREE.MeshStandardMaterial({ color: '#f7f5f1', roughness: 0.7 }),
  recess: new THREE.MeshStandardMaterial({ color: '#4a4e54', roughness: 0.8 }),
  column: new THREE.MeshStandardMaterial({ color: '#f4f2ee', roughness: 0.6 }),
  lobby: new THREE.MeshStandardMaterial({ color: '#9cc6de', roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.35, depthWrite: false }),
  lobbyFloor: new THREE.MeshStandardMaterial({ color: '#e8e1d3', roughness: 0.25 }),
  lobbyWall: new THREE.MeshStandardMaterial({ color: '#7a5a3f', roughness: 0.6 }),
  warm: new THREE.MeshBasicMaterial({ color: '#ffe3b0', toneMapped: false }),
  dark: new THREE.MeshStandardMaterial({ color: '#59616b', roughness: 0.7 }),
  solar: new THREE.MeshStandardMaterial({ color: '#1c355a', roughness: 0.2, metalness: 0.7 }),
  planter: new THREE.MeshStandardMaterial({ color: '#3f7f36', roughness: 0.95 }),
  pot: new THREE.MeshStandardMaterial({ color: '#8b6b52', roughness: 0.9 }),
  tank: new THREE.MeshStandardMaterial({ color: '#d7dbe0', roughness: 0.6 }),
  pergola: new THREE.MeshStandardMaterial({ color: '#6b4e37', roughness: 0.7 }),
  pool: new THREE.MeshStandardMaterial({ color: '#3fa7c9', roughness: 0.1, metalness: 0.2 }),
  overlay: new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.46, roughness: 0.4, depthWrite: false, emissive: '#000000' }),
  ac: new THREE.MeshStandardMaterial({ color: '#b9bcbf', roughness: 0.55, metalness: 0.3 }),
  slot: new THREE.MeshStandardMaterial({ color: '#4a4f55', roughness: 0.8 }),
  pipe: new THREE.MeshStandardMaterial({ color: '#d9d4cb', roughness: 0.6 }),
};

function setInstances(mesh: THREE.InstancedMesh | null, list: Inst[], explode: number, visible: (i: Inst, idx: number) => number, grow = 0) {
  if (!mesh) return;
  list.forEach((it, i) => {
    const v = visible(it, i);
    P.set(it.x, floorBaseY(it.floor, explode) + it.yOff * (v === 0.35 ? 0.35 : 1), it.z);
    Q.setFromAxisAngle(UP, it.ry);
    if (v === 0) S.set(0, 0, 0);
    else S.set(it.sx + grow, it.sy * (v === 0.35 ? 0.35 : 1) + grow * 0.08, it.sz + grow);
    M.compose(P, Q, S);
    mesh.setMatrixAt(i, M);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.computeBoundingBox();
}

function RoomTags({ flat }: { flat: Flat }) {
  const { layout } = flatXform(flat);
  return (
    <>
      {layout.rooms
        .filter((r) => r.w * r.h > 3)
        .map((r) => (
          <Billboard key={r.name} position={[r.x + r.w / 2, 1.5, r.y + r.h / 2]}>
            <mesh>
              <planeGeometry args={[1.5, 0.29]} />
              <meshBasicMaterial map={labelTexture(r.name, { color: '#0f172a', bg: 'rgba(255,255,255,0.88)', w: 512, h: 100 })} transparent toneMapped={false} />
            </mesh>
          </Billboard>
        ))}
    </>
  );
}

export function TowerBlock({ tower }: { tower: TowerT }) {
  const flats = useMemo(() => PROJECT.flats.filter((f) => f.tower === tower.id), [tower.id]);
  const mode = useStore((s) => s.mode);
  const floors = useStore((s) => s.floors);
  const selectedId = useStore((s) => s.selectedId);
  const hoveredId = useStore((s) => s.hoveredId);
  const statusColors = useStore((s) => s.statusColors);
  const matchSet = useMatchSet();

  const isFloorsTower = mode === 'floors' && floors.tower === tower.id;
  const isolated = isFloorsTower ? floors.isolated : null;
  const selFlat = selectedId ? FLAT_BY_ID.get(selectedId) : undefined;
  const hiddenFloor = mode === 'interior' && selFlat?.tower === tower.id ? selFlat.floor : null;
  const designTop = useStore((s) => s.designTop);
  // Top-down design view: remove everything above the visited floor.
  const cut = hiddenFloor != null && designTop ? hiddenFloor : Infinity;
  const explodeTarget = isFloorsTower ? 1 : 0;

  const flatMesh = useRef<THREE.InstancedMesh>(null);
  const notchMesh = useRef<THREE.InstancedMesh>(null);
  const frameMesh = useRef<THREE.InstancedMesh>(null);
  const overlayMesh = useRef<THREE.InstancedMesh>(null);
  const slabMesh = useRef<THREE.InstancedMesh>(null);
  const coreMesh = useRef<THREE.InstancedMesh>(null);
  const balcMesh = useRef<THREE.InstancedMesh>(null);
  const parapetMesh = useRef<THREE.InstancedMesh>(null);
  const glassMesh = useRef<THREE.InstancedMesh>(null);
  const railMesh = useRef<THREE.InstancedMesh>(null);
  const finMesh = useRef<THREE.InstancedMesh>(null);
  const plantMesh = useRef<THREE.InstancedMesh>(null);
  const acMesh = useRef<THREE.InstancedMesh>(null);
  const slot = useRef<THREE.Group>(null);
  const roof = useRef<THREE.Group>(null);
  const ex = useRef(runtime.explode[tower.id]);
  const dirty = useRef(true);

  const facadeGeo = useMemo(() => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    g.setAttribute('aSeed', seedAttribute(flats.length * 2, tower.id.charCodeAt(0)));
    return g;
  }, [flats.length, tower.id]);
  const facadeMat = useMemo(
    () => withLitWindows(new THREE.MeshStandardMaterial({ map: realFacadeTexture(), roughness: 0.78, metalness: 0, envMapIntensity: 0.6 })),
    [],
  );
  const coreMat = useMemo(() => {
    const m = mats.core.clone();
    m.map = coreTexture();
    return m;
  }, []);

  const data = useMemo(() => {
    const flatInst: Inst[] = [];
    const mass: Inst[] = [];
    const notch: Inst[] = [];
    const frames: Inst[] = [];
    const balc: Inst[] = [];
    const parapet: Inst[] = [];
    const glass: Inst[] = [];
    const rail: Inst[] = [];
    const plants: Inst[] = [];
    const ac: Inst[] = [];
    flats.forEach((f, idx) => {
      const fr = flatFrame(f.index);
      const [lx, lz] = planToLocal(fr, FLAT_W / 2, FLAT_D / 2);
      const ry = fr.s < 0 ? Math.PI : 0;
      flatInst.push({ floor: f.floor, x: lx, z: lz, yOff: FLAT_H / 2, sx: FLAT_W - 0.15, sy: FLAT_H, sz: FLAT_D - 0.15, ry });
      // Exterior only: each home reads as two slim masses either side of a deep recess.
      for (const [a, b] of [
        [0.08, NOTCH[0]],
        [NOTCH[1], FLAT_W - 0.08],
      ]) {
        const [mx, mz] = planToLocal(fr, (a + b) / 2, FLAT_D / 2);
        mass.push({ floor: f.floor, x: mx, z: mz, yOff: FLAT_H / 2, sx: b - a, sy: FLAT_H, sz: FLAT_D - 0.15, ry });
        if (f.floor === FLOORS) {
          // Open white box frame crowning each stack, as on the renders.
          const cap = (px: number, py: number, sx: number, sy: number, sz: number, y: number) => {
            const [cx, cz] = planToLocal(fr, px, py);
            frames.push({ floor: FLOORS + 1, x: cx, z: cz, yOff: y, sx, sy, sz, ry: 0 });
          };
          for (const px of [a + 0.2, b - 0.2]) for (const py of [0.4, FLAT_D - 0.4]) cap(px, py, 0.35, 3.4, 0.35, 1.7);
          for (const py of [0.4, FLAT_D - 0.4]) cap((a + b) / 2, py, b - a, 0.45, 0.4, 3.4);
          for (const px of [a + 0.2, b - 0.2]) cap(px, FLAT_D / 2, 0.4, 0.45, FLAT_D - 0.4, 3.4);
        }
      }
      const [nx, nz] = planToLocal(fr, (NOTCH[0] + NOTCH[1]) / 2, (FLAT_D - NOTCH_D) / 2);
      notch.push({ floor: f.floor, x: nx, z: nz, yOff: FLAT_H / 2, sx: NOTCH[1] - NOTCH[0] + 0.02, sy: FLAT_H, sz: FLAT_D - NOTCH_D, ry });
      if ((f.floor + f.index) % 2 === 0) {
        // Trailing planters in the recesses (the green streaks on the elevations).
        const [px, pz] = planToLocal(fr, (NOTCH[0] + NOTCH[1]) / 2, FLAT_D - NOTCH_D + 0.3);
        plants.push({ floor: f.floor, x: px, z: pz, yOff: 0.5, sx: NOTCH[1] - NOTCH[0] - 0.1, sy: 1.0, sz: 0.5, ry: 0 });
      }
      // Outdoor AC units on ledges along the end wall (louvred screens).
      const side = f.index === 1 || f.index === 4 ? -1 : 1;
      for (const dz of [-2.6, 2.6]) ac.push({ floor: f.floor, x: side * (TOWER_HX + 0.32), z: lz + dz, yOff: 0.45, sx: 0.62, sy: 0.6, sz: 1.0, ry: 0 });
      for (const r of unitOf(f).rooms) {
        if (r.kind !== 'balcony' || r.level) continue;
        const [bx, bz] = planToLocal(fr, r.x + r.w / 2, r.y + r.h / 2);
        balc.push({ floor: f.floor, x: bx, z: bz, yOff: -0.11, sx: r.w + 0.1, sy: 0.22, sz: r.h, ry: 0 });
        // White "picture frame" blades at the balcony ends, stacking into vertical lines.
        for (const px of [r.x, r.x + r.w]) {
          const [fx, fz] = planToLocal(fr, px, r.y + r.h / 2 + 0.05);
          frames.push({ floor: f.floor, x: fx, z: fz, yOff: FLAT_H / 2 + SLAB_T / 2, sx: 0.32, sy: FLOOR_H + 0.02, sz: r.h + 0.25, ry: 0 });
        }
        const edges: [number, number, number, number][] = [
          [r.x + r.w / 2, r.y + r.h, r.w, 0],
          [r.x, r.y + r.h / 2, 0, r.h],
          [r.x + r.w, r.y + r.h / 2, 0, r.h],
        ];
        for (const [px, py, w, h] of edges) {
          const [ex2, ez2] = planToLocal(fr, px, py);
          parapet.push({ floor: f.floor, x: ex2, z: ez2, yOff: 0.25, sx: w || 0.15, sy: 0.5, sz: h || 0.15, ry: 0 });
          glass.push({ floor: f.floor, x: ex2, z: ez2, yOff: 0.78, sx: w || 0.03, sy: 0.56, sz: h || 0.03, ry: 0 });
          rail.push({ floor: f.floor, x: ex2, z: ez2, yOff: 1.08, sx: (w || 0) + 0.06, sy: 0.05, sz: (h || 0) + 0.06, ry: 0 });
        }
        if ((idx + f.floor) % 4 !== 0 && r.w > 3) {
          // Planter boxes with trailing greenery along the balcony edge.
          const [qx, qz] = planToLocal(fr, r.x + r.w / 2, r.y + r.h - 0.3);
          plants.push({ floor: f.floor, x: qx, z: qz, yOff: 0.35, sx: Math.min(r.w - 1, 3.2), sy: 0.55, sz: 0.4, ry: 0 });
        }
      }
    });
    const slabs: Inst[] = [];
    for (let f = 1; f <= FLOORS + 1; f++) {
      slabs.push({ floor: f, x: 0, z: 0, yOff: -SLAB_T / 2, sx: TOWER_HX * 2 + 0.45, sy: SLAB_T + 0.08, sz: TOWER_HZ * 2 + 0.45, ry: 0 });
    }
    const cores: Inst[] = [];
    const fins: Inst[] = [];
    for (let f = 1; f <= FLOORS; f++) {
      cores.push({ floor: f, x: 0, z: 0, yOff: FLAT_H / 2, sx: TOWER_HX * 2 - 0.3, sy: FLAT_H, sz: CORE_HALF * 2 - 0.1, ry: 0 });
      // Tall white blades framing the balconies (North Park's vertical expression).
      for (const x of [-TOWER_HX, 0, TOWER_HX]) {
        for (const z of [-1, 1]) fins.push({ floor: f, x, z: z * (TOWER_HZ + 0.75), yOff: FLAT_H / 2 + SLAB_T / 2, sx: x === 0 ? 1.1 : 0.7, sy: FLOOR_H + 0.02, sz: 1.9, ry: 0 });
      }
    }
    return { flatInst, mass, notch, frames, balc, parapet, glass, rail, plants, slabs, cores, fins, ac };
  }, [flats]);

  useEffect(() => {
    dirty.current = true;
  }, [isolated, hiddenFloor, statusColors, matchSet, selectedId, cut]);

  // Status overlay colours
  useEffect(() => {
    const mesh = overlayMesh.current;
    if (!mesh) return;
    flats.forEach((f, i) => {
      C.set(STATUS_COLOR[f.status]);
      if (f.id === selectedId) C.lerp(WHITE, 0.3);
      else if (f.id === hoveredId) C.lerp(WHITE, 0.3);
      mesh.setColorAt(i, C);
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [flats, selectedId, hoveredId]);

  useFrame((_, dt) => {
    const cur = ex.current;
    let next = cur + (explodeTarget - cur) * Math.min(1, dt * 3.2);
    if (Math.abs(explodeTarget - next) < 0.002) next = explodeTarget;
    if (next !== cur) {
      ex.current = next;
      dirty.current = true;
    }
    runtime.explode[tower.id] = ex.current;
    if (!dirty.current) return;
    dirty.current = false;
    const e = ex.current;
    const onlyIso = (it: Inst) => (it.floor > cut ? 0 : isolated == null || it.floor === isolated ? 1 : 0);
    // The detailed interior replaces every part of this floor's simplified exterior shell.
    const shellVis = (it: Inst) => it.floor === hiddenFloor ? 0 : onlyIso(it);
    const flatVis = (it: Inst) => ((isolated != null && (it.floor !== isolated || e > 0.95)) || it.floor === hiddenFloor || it.floor > cut ? 0 : 1);
    setInstances(flatMesh.current, data.mass, e, flatVis);
    setInstances(notchMesh.current, data.notch, e, flatVis);
    setInstances(frameMesh.current, data.frames, e, (it) => (it.floor === hiddenFloor ? 0 : onlyIso(it)));
    setInstances(
      overlayMesh.current,
      data.flatInst,
      e,
      (it, i) => (statusColors && matchSet.has(flats[i].id) && flatVis(it) ? 1 : 0),
      0.5,
    );
    setInstances(slabMesh.current, data.slabs, e, shellVis);
    setInstances(coreMesh.current, data.cores, e, (it) => (it.floor === hiddenFloor || it.floor > cut ? 0 : isolated == null ? 1 : it.floor === isolated ? 0.35 : 0));
    setInstances(balcMesh.current, data.balc, e, shellVis);
    setInstances(parapetMesh.current, data.parapet, e, shellVis);
    setInstances(glassMesh.current, data.glass, e, shellVis);
    setInstances(railMesh.current, data.rail, e, shellVis);
    setInstances(finMesh.current, data.fins, e, (it) => (isolated == null && it.floor < cut && it.floor !== hiddenFloor ? 1 : 0));
    setInstances(plantMesh.current, data.plants, e, shellVis);
    setInstances(acMesh.current, data.ac, e, (it) => (isolated == null && it.floor !== hiddenFloor ? onlyIso(it) : 0));
    if (slot.current) slot.current.visible = isolated == null && cut === Infinity;
    if (roof.current) {
      roof.current.position.y = floorBaseY(FLOORS + 1, e) - ROOF_Y;
      roof.current.visible = isolated == null && cut === Infinity;
    }
  });

  const select = useStore((s) => s.selectFlat);
  const hover = useStore((s) => s.hover);
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (e.instanceId == null) return;
    e.stopPropagation();
    hover(flats[e.instanceId >> 1].id);
    document.body.style.cursor = 'pointer';
  };
  const onOut = () => {
    hover(null);
    document.body.style.cursor = '';
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.instanceId == null || e.delta > 6) return;
    e.stopPropagation();
    select(flats[e.instanceId >> 1].id);
  };

  const penthouses = flats.filter((f) => f.floor === FLOORS && unitOf(f).duplex);
  const isoFlats: Flat[] = isolated != null ? flats.filter((f) => f.floor === isolated) : [];
  const noRay = () => null;

  return (
    <group position={tower.position} rotation-y={tower.rotationY}>
      <instancedMesh
        ref={flatMesh}
        args={[facadeGeo, facadeMat, data.mass.length]}
        castShadow
        receiveShadow
        onPointerMove={onMove}
        onPointerOut={onOut}
        onClick={onClick}
      />
      <instancedMesh ref={notchMesh} args={[unitBox, mats.slot, data.notch.length]} castShadow receiveShadow raycast={noRay} />
      <instancedMesh ref={frameMesh} args={[unitBox, mats.parapet, data.frames.length]} castShadow receiveShadow raycast={noRay} />
      <instancedMesh ref={overlayMesh} args={[unitBox, mats.overlay, data.flatInst.length]} raycast={noRay} renderOrder={3} />
      <instancedMesh ref={slabMesh} args={[unitBox, mats.slab, data.slabs.length]} castShadow receiveShadow />
      <instancedMesh ref={coreMesh} args={[unitBox, coreMat, data.cores.length]} castShadow receiveShadow />
      <instancedMesh ref={finMesh} args={[unitBox, mats.fin, data.fins.length]} castShadow receiveShadow raycast={noRay} />
      <instancedMesh ref={balcMesh} args={[unitBox, mats.balc, data.balc.length]} castShadow receiveShadow />
      <instancedMesh ref={parapetMesh} args={[unitBox, mats.parapet, data.parapet.length]} castShadow receiveShadow raycast={noRay} />
      <instancedMesh ref={glassMesh} args={[unitBox, mats.glass, data.glass.length]} raycast={noRay} />
      <instancedMesh ref={railMesh} args={[unitBox, mats.rail, data.rail.length]} raycast={noRay} />
      <instancedMesh ref={plantMesh} args={[unitBox, mats.planter, data.plants.length]} raycast={noRay} />
      <instancedMesh ref={acMesh} args={[unitBox, mats.ac, data.ac.length]} castShadow raycast={noRay} />

      <group ref={slot}>
        {tower.wing === 1 && (
          // Deep charcoal slot joining the two wings, as on the North Park elevations.
          <mesh position={[TOWER_HX + WING_GAP / 2, (GROUND_H + ROOF_Y) / 2, 0]} scale={[WING_GAP + 0.2, ROOF_Y - GROUND_H + 0.6, TOWER_HZ * 2 - 2.4]} geometry={unitBox} material={mats.slot} castShadow receiveShadow raycast={noRay} />
        )}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * (TOWER_HX + 0.12), ROOF_Y / 2, s * (CORE_HALF + 0.35)]} scale={[0.11, ROOF_Y, 0.11]} material={mats.pipe} raycast={noRay}>
            <cylinderGeometry args={[0.5, 0.5, 1, 8]} />
          </mesh>
        ))}
      </group>

      <GroundFloor id={tower.id} />

      <group ref={roof}>
        <Roof />
        {penthouses.map((f) => (
          <PenthouseUpper key={f.id} flat={f} material={facadeMat} />
        ))}
      </group>

      {isoFlats.map((f) => {
        const fr = flatFrame(f.index);
        return (
          <group key={f.id} position={[fr.ox, floorBaseY(f.floor, 1) + 0.01, fr.oz]} rotation-y={fr.s < 0 ? Math.PI : 0}>
            <group
              onClick={(e) => {
                if (e.delta > 6) return;
                e.stopPropagation();
                select(f.id, false);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                hover(f.id);
              }}
              onPointerOut={() => hover(null)}
            >
              <HomeModel flat={f} wallH={1.15} detail={false} furnishing="auto" tint={statusColors ? STATUS_COLOR[f.status] : undefined} />
            </group>
            <RoomTags flat={f} />
            <Html position={[FLAT_W / 2, 3.2, FLAT_D / 2]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
              <div className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold shadow ${f.id === selectedId ? 'bg-brand-700 text-white' : 'bg-white/90 text-slate-800'}`}>
                {f.id} · {unitOf(f).short}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

function PenthouseUpper({ flat, material }: { flat: Flat; material: THREE.Material }) {
  const statusColors = useStore((s) => s.statusColors);
  const selectedId = useStore((s) => s.selectedId);
  const select = useStore((s) => s.selectFlat);
  const matchSet = useMatchSet();
  const fr = flatFrame(flat.index);
  const [x, z] = planToLocal(fr, FLAT_W / 2, 3.5);
  const overlay = useMemo(() => mats.overlay.clone(), []);
  const geo = useMemo(() => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array([flat.index * 17.3]), 1));
    return g;
  }, [flat.index]);
  useEffect(() => {
    C.set(STATUS_COLOR[flat.status]);
    if (flat.id === selectedId) C.lerp(WHITE, 0.3);
    overlay.color.copy(C);
  }, [selectedId, flat, overlay]);
  const showOverlay = statusColors && matchSet.has(flat.id);
  const [px, pz] = planToLocal(fr, FLAT_W / 2, 9);
  return (
    <group>
      <instancedMesh
        args={[geo, material, 1]}
        position={[x, ROOF_Y + FLAT_H / 2, z]}
        scale={[FLAT_W - 0.4, FLAT_H, 7 - 0.4]}
        castShadow
        receiveShadow
        onClick={(e) => {
          if (e.delta > 6) return;
          e.stopPropagation();
          select(flat.id);
        }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      />
      {showOverlay && <mesh geometry={unitBox} material={overlay} position={[x, ROOF_Y + FLAT_H / 2, z]} scale={[FLAT_W, FLAT_H + 0.4, 7.1]} raycast={() => null} />}
      {/* Private terrace: pergola + plunge pool */}
      <mesh geometry={unitBox} material={mats.pool} position={[px - 3, ROOF_Y + 0.15, pz]} scale={[3, 0.3, 1.8]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={unitBox} material={mats.pergola} position={[px + 2.5 + s * 1.8, ROOF_Y + 1.3, pz]} scale={[0.15, 2.6, 0.15]} castShadow />
      ))}
      <mesh geometry={unitBox} material={mats.pergola} position={[px + 2.5, ROOF_Y + 2.65, pz]} scale={[4, 0.12, 2.4]} castShadow />
    </group>
  );
}

const groundBoxes = (() => {
  const cols: IBox[] = [];
  for (const x of [-13, -6.5, 6.5, 13]) for (const z of [-13.6, 13.6]) cols.push({ x, z, y: 1.9, sx: 0.7, sy: 3.8, sz: 0.7 });
  const furn: IBox[] = [
    { x: 0, z: 1.8, y: 0.55, sx: 3.2, sy: 1.1, sz: 0.7, color: '#6b4e37' },
    { x: -4, z: -1.2, y: 0.22, sx: 2.2, sy: 0.44, sz: 0.85, color: '#8a8f96' },
    { x: 4, z: -1.2, y: 0.22, sx: 2.2, sy: 0.44, sz: 0.85, color: '#8a8f96' },
    { x: 0, z: -2.6, y: 1.9, sx: 11.6, sy: 3.8, sz: 0.2, color: '#7a5a3f' },
    { x: -5.2, z: 2.2, y: 0.6, sx: 0.6, sy: 1.2, sz: 0.6, color: '#4e8a43' },
    { x: 5.2, z: 2.2, y: 0.6, sx: 0.6, sy: 1.2, sz: 0.6, color: '#4e8a43' },
  ];
  return { cols, furn };
})();

function GroundFloor({ id }: { id: TowerT['id'] }) {
  const sign = useMemo(() => labelTexture(towerName(id).toUpperCase(), { color: '#2b2b2b', w: 768, h: 120 }), [id]);
  return (
    <group>
      <Boxes boxes={groundBoxes.cols} material={mats.column} castShadow />
      <mesh position={[0, 0.06, 0]} scale={[12, 0.12, 6.2]} geometry={unitBox} material={mats.lobbyFloor} receiveShadow />
      <Boxes boxes={groundBoxes.furn} material={mats.parapet} castShadow />
      <mesh position={[0, 1.9, 0]} scale={[12, 3.8, 6.2]} geometry={unitBox} material={mats.lobby} />
      <mesh position={[0, 3.65, 0]} scale={[10, 0.06, 4.5]} geometry={unitBox} material={mats.warm} />
      {/* White portico on tall pilasters over the drop-off */}
      <mesh position={[0, 7.4, TOWER_HZ + 3]} scale={[11, 0.45, 6.4]} geometry={unitBox} material={mats.parapet} castShadow />
      <mesh position={[0, 7.15, TOWER_HZ + 3]} scale={[10, 0.02, 5.8]} geometry={unitBox} material={mats.warm} />
      {[-5, -2.5, 2.5, 5].map((x) => (
        <mesh key={x} position={[x, 3.6, TOWER_HZ + 5.9]} scale={[0.5, 7.2, 0.5]} geometry={unitBox} material={mats.parapet} castShadow />
      ))}
      <mesh position={[0, 6.4, TOWER_HZ + 6.2]}>
        <planeGeometry args={[4.6, 0.72]} />
        <meshStandardMaterial map={sign} transparent metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.02, TOWER_HZ + 4]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[12, 9]} />
        <meshStandardMaterial color="#cfc6b6" roughness={0.9} />
      </mesh>
      <Person look={LOOKS.guard} anim="idle" position={[2.5, 0.12, 1.3]} rotation-y={0} />
    </group>
  );
}

const roofBoxes = (() => {
  const W = TOWER_HX * 2;
  const D = TOWER_HZ * 2;
  const planters: IBox[] = [];
  for (let ix = 0; ix < 7; ix++) {
    planters.push({ x: -W / 2 + 2 + ix * ((W - 4) / 6), z: TOWER_HZ - 0.9, y: 0.4, sx: 2.6, sy: 0.8, sz: 1.1 });
    planters.push({ x: -W / 2 + 2 + ix * ((W - 4) / 6), z: -TOWER_HZ + 0.9, y: 0.4, sx: 2.6, sy: 0.8, sz: 1.1 });
  }
  for (const s of [-1, 1]) for (let iz = 0; iz < 5; iz++) planters.push({ x: s * (TOWER_HX - 0.9), z: -D / 2 + 4 + iz * ((D - 8) / 4), y: 0.4, sx: 1.1, sy: 0.8, sz: 2.4 });
  // Open white crown frame over the sky-garden deck (seen on the North Park elevations).
  const frame: IBox[] = [];
  const fx = W / 2 - 1.2;
  const fz0 = 1.5;
  const fz1 = TOWER_HZ - 2.2;
  for (const x of [-fx, -fx / 3, fx / 3, fx]) for (const z of [fz0, fz1]) frame.push({ x, z, y: 3.2, sx: 0.45, sy: 6.4, sz: 0.45 });
  for (let i = 0; i < 14; i++) frame.push({ x: -fx + (i * 2 * fx) / 13, z: (fz0 + fz1) / 2, y: 6.3, sx: 0.22, sy: 0.35, sz: fz1 - fz0 + 0.5 });
  frame.push({ x: 0, z: fz0, y: 6.5, sx: fx * 2 + 0.5, sy: 0.4, sz: 0.5 }, { x: 0, z: fz1, y: 6.5, sx: fx * 2 + 0.5, sy: 0.4, sz: 0.5 });
  const benches: IBox[] = [];
  for (let i = 0; i < 4; i++) benches.push({ x: -fx + 3 + i * ((2 * fx - 6) / 3), z: fz1 - 1.6, y: 0.23, sx: 2.2, sy: 0.45, sz: 0.6 });
  const trees: [number, number][] = [
    [-fx + 1.5, fz0 + 1.5],
    [fx - 1.5, fz0 + 1.5],
    [-4, -TOWER_HZ + 3],
    [5, -TOWER_HZ + 3],
    [-fx + 2, -6],
    [fx - 2, -6],
  ];
  return { planters, frame, benches, trees, deck: { w: fx * 2 + 1.5, z: (fz0 + fz1) / 2, d: fz1 - fz0 + 1.5 } };
})();

/** Terrace "elevated sky garden": timber deck, planters, seating and trees under a white crown frame. */
function Roof() {
  const { deck } = roofBoxes;
  return (
    <group position={[0, ROOF_Y, 0]}>
      <mesh position={[0, 0.55, TOWER_HZ]} scale={[TOWER_HX * 2 + 0.45, 1.1, 0.25]} geometry={unitBox} material={mats.parapet} castShadow />
      <mesh position={[0, 0.55, -TOWER_HZ]} scale={[TOWER_HX * 2 + 0.45, 1.1, 0.25]} geometry={unitBox} material={mats.parapet} castShadow />
      <mesh position={[TOWER_HX, 0.55, 0]} scale={[0.25, 1.1, TOWER_HZ * 2]} geometry={unitBox} material={mats.parapet} castShadow />
      <mesh position={[-TOWER_HX, 0.55, 0]} scale={[0.25, 1.1, TOWER_HZ * 2]} geometry={unitBox} material={mats.parapet} castShadow />
      <mesh position={[0, 0.03, 0]} scale={[TOWER_HX * 2 - 0.4, 0.06, TOWER_HZ * 2 - 0.4]} geometry={unitBox} receiveShadow>
        <meshStandardMaterial color="#7fa36a" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.09, deck.z]} scale={[deck.w, 0.08, deck.d]} geometry={unitBox} material={mats.pergola} receiveShadow />
      {/* Lift machine room / stair head */}
      <mesh position={[0, 1.8, -1]} scale={[9, 3.6, 4.4]} geometry={unitBox} material={mats.slab} castShadow />
      <mesh position={[-2.2, 4.4, -1]} castShadow material={mats.tank}>
        <cylinderGeometry args={[1.2, 1.2, 1.6, 20]} />
      </mesh>
      <Boxes boxes={roofBoxes.planters} material={mats.planter} castShadow />
      <Boxes boxes={roofBoxes.frame} material={mats.parapet} castShadow />
      <Boxes boxes={roofBoxes.benches} material={mats.pergola} castShadow />
      {roofBoxes.trees.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 1.1, 0]} material={mats.pot} castShadow>
            <cylinderGeometry args={[0.1, 0.14, 2.2, 8]} />
          </mesh>
          <mesh position={[0, 2.6, 0]} material={mats.planter} castShadow>
            <icosahedronGeometry args={[1.25, 1]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
