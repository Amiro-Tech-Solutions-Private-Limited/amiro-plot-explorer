import { useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { PROJECT, TOWER_CENTERS, TOWER_GROUPS, TOWERS } from '../data/project';
import type { TowerId } from '../data/types';
import { useMatchSet } from '../store/hooks';
import { CLUB, GATE_X, POOL, SITE, ZONES } from '../data/site';
import { floorBaseY, FLOORS } from '../lib/geometry';
import { runtime } from '../store/runtime';
import { useStore } from '../store/useStore';

function Chip({ children, big }: { children: ReactNode; big?: boolean }) {
  return (
    <div
      className={`select-none whitespace-nowrap rounded-full bg-white/90 font-semibold text-slate-800 shadow-md ring-1 ring-black/5 backdrop-blur ${
        big ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-[11px]'
      }`}
    >
      {children}
    </div>
  );
}

function TowerLabel({ id, ids, text, x, z }: { id: TowerId; ids: TowerId[]; text: string; x: number; z: number }) {
  const ref = useRef<THREE.Group>(null);
  const plan = useStore((s) => s.mode === 'plan');
  const setFloorsTower = useStore((s) => s.setFloorsTower);
  const floorsMode = useStore((s) => s.mode === 'floors');
  const matchSet = useMatchSet();
  const avail = PROJECT.flats.filter((f) => ids.includes(f.tower) && f.status === 'available' && matchSet.has(f.id)).length;
  useFrame(() => {
    if (ref.current) ref.current.position.y = floorBaseY(FLOORS + 1, runtime.explode[id]) + 9;
  });
  return (
    <group ref={ref} position={[x, 60, z]}>
      <Html center zIndexRange={[10, 0]}>
        <button
          onClick={() => floorsMode && setFloorsTower(id)}
          className={`select-none whitespace-nowrap rounded-full bg-brand-700/95 font-bold tracking-wide text-white shadow-lg ${
            plan ? 'px-4 py-1.5 text-base' : 'px-3 py-1 text-xs'
          } ${floorsMode ? 'cursor-pointer hover:bg-brand-600' : 'pointer-events-none'}`}
        >
          {text}
          {plan && <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">{avail} available</span>}
        </button>
      </Html>
    </group>
  );
}

export function Labels() {
  const mode = useStore((s) => s.mode);
  const hasSelection = useStore((s) => !!s.selectedId);
  if (mode === 'walk' || mode === 'interior' || mode === 'balcony') return null;
  const plan = mode === 'plan';
  return (
    <group>
      {mode === 'floors'
        ? TOWERS.map((t) => <TowerLabel key={t.id} id={t.id} ids={[t.id]} text={`TOWER ${t.group} · W${t.wing}`} x={t.position[0]} z={t.position[2]} />)
        : TOWER_GROUPS.map((g) => (
            <TowerLabel key={g} id={`${g}1`} ids={[`${g}1`, `${g}2`]} text={`TOWER ${g}`} x={TOWER_CENTERS[g][0]} z={TOWER_CENTERS[g][1]} />
          ))}
      {mode !== 'floors' && (plan || !hasSelection) && (
        <>
          <group position={[CLUB.x, 11, CLUB.z]}>
            <Html center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
              <Chip big={plan}>Clubhouse</Chip>
            </Html>
          </group>
          <group position={[POOL.x, 3, POOL.z]}>
            <Html center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
              <Chip big={plan}>Swimming pool</Chip>
            </Html>
          </group>
          {(plan ? Object.values(ZONES).filter((z) => z.id !== 'utilities') : [ZONES.play, ZONES.court]).map((z) => (
            <group key={z.id} position={[z.x, 4, z.z]}>
              <Html center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
                <Chip big={plan}>{z.label}</Chip>
              </Html>
            </group>
          ))}
          <group position={[GATE_X, 7, SITE.maxZ]}>
            <Html center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
              <Chip big={plan}>Entrance gateway</Chip>
            </Html>
          </group>
        </>
      )}
    </group>
  );
}
