import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { FLAT_BY_ID, towerOf, unitOf } from '../data/project';
import { useStore } from '../store/useStore';
import { runtime } from '../store/runtime';
import { flatFrame, FLAT_D, FLAT_W, FLOOR_H, floorBaseY, planToWorld, SLAB_T } from '../lib/geometry';
import { priceOf } from '../lib/pricing';
import { formatPrice } from '../lib/format';
import { STATUS_UI } from '../lib/colors';

const H = FLOOR_H - SLAB_T;
const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(FLAT_W + 0.5, H + 0.4, FLAT_D + 0.5));
const glowGeo = new THREE.BoxGeometry(FLAT_W + 0.4, H + 0.3, FLAT_D + 0.4);

export function Highlight() {
  const selectedId = useStore((s) => s.selectedId);
  const mode = useStore((s) => s.mode);
  const floors = useStore((s) => s.floors);
  const group = useRef<THREE.Group>(null);
  const glow = useRef<THREE.MeshBasicMaterial>(null);
  const flat = selectedId ? FLAT_BY_ID.get(selectedId) : undefined;

  const base = useMemo(() => {
    if (!flat) return null;
    const t = towerOf(flat);
    const [x, z] = planToWorld(t, flatFrame(flat.index), FLAT_W / 2, FLAT_D / 2);
    return { x, z, rot: t.rotationY };
  }, [flat]);

  useFrame(({ clock }) => {
    if (!flat || !group.current) return;
    const e = runtime.explode[flat.tower];
    group.current.position.y = floorBaseY(flat.floor, e) + H / 2;
    if (glow.current) glow.current.opacity = 0.18 + 0.12 * Math.sin(clock.elapsedTime * 3.2);
  });

  const hidden =
    !flat || mode === 'interior' || mode === 'balcony' || (mode === 'floors' && floors.isolated === flat.floor && floors.tower === flat.tower);
  if (hidden || !base || !flat) return null;

  return (
    <group ref={group} position={[base.x, floorBaseY(flat.floor) + H / 2, base.z]} rotation-y={base.rot}>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#ffffff" toneMapped={false} />
      </lineSegments>
      <mesh geometry={glowGeo} renderOrder={2}>
        <meshBasicMaterial ref={glow} color="#7cf0b4" transparent opacity={0.25} depthWrite={false} toneMapped={false} />
      </mesh>
      {mode !== 'walk' && (
        <Html position={[0, H / 2 + 2.2, 0]} center zIndexRange={[30, 0]} style={{ pointerEvents: 'none' }}>
          <div className="flex flex-col items-center">
            <div className="whitespace-nowrap rounded-lg bg-slate-900/90 px-2.5 py-1 text-xs font-semibold text-white shadow-lg">{flat.id}</div>
            <div className="h-3 w-0.5 bg-slate-900/80" />
          </div>
        </Html>
      )}
    </group>
  );
}

export function HoverTip() {
  const hoveredId = useStore((s) => s.hoveredId);
  const selectedId = useStore((s) => s.selectedId);
  const mode = useStore((s) => s.mode);
  const canHover = useMemo(() => window.matchMedia('(hover: hover)').matches, []);
  const ref = useRef<THREE.Group>(null);
  const flat = hoveredId ? FLAT_BY_ID.get(hoveredId) : undefined;

  useFrame(() => {
    if (!flat || !ref.current) return;
    ref.current.position.y = floorBaseY(flat.floor, runtime.explode[flat.tower]) + H + 1;
  });

  if (!canHover || !flat || flat.id === selectedId || mode === 'interior' || mode === 'balcony') return null;
  const [x, z] = planToWorld(towerOf(flat), flatFrame(flat.index), FLAT_W / 2, FLAT_D / 2);
  const st = STATUS_UI[flat.status];
  return (
    <group ref={ref} position={[x, floorBaseY(flat.floor) + H + 1, z]}>
      <Html center zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }}>
        <div className="flex items-center gap-2 whitespace-nowrap rounded-xl bg-white/95 px-3 py-1.5 text-xs text-slate-800 shadow-xl ring-1 ring-black/5">
          <span className={`h-2 w-2 rounded-full ${st.dot}`} />
          <b>{flat.id}</b>
          <span className="text-slate-500">·</span>
          {unitOf(flat).short}
          <span className="text-slate-500">·</span>
          <b>{formatPrice(priceOf(flat).total)}</b>
        </div>
      </Html>
    </group>
  );
}
