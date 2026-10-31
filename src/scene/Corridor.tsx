import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Tower } from '../data/types';
import { useStore } from '../store/useStore';
import { runtime } from '../store/runtime';
import { CORE_HALF, floorBaseY, TOWER_HX } from '../lib/geometry';
import { LIFT_X1, STAIR_X0, worldToTowerLocal } from '../lib/floor';
import { Boxes, type IBox } from './Boxes';
import { MATS } from './HomeModel';
import { labelTexture } from './textures';
import { Person, LOOKS } from './Person';

const END = TOWER_HX - 0.15;
const H = 2.93;
const box = new THREE.BoxGeometry(1, 1, 1);
const M = {
  stone: new THREE.MeshStandardMaterial({ color: '#cbbfae', roughness: 0.7 }),
  steel: new THREE.MeshStandardMaterial({ color: '#b9bfc5', metalness: 0.9, roughness: 0.22 }),
  glow: new THREE.MeshBasicMaterial({ color: '#fff4dc', toneMapped: false }),
  red: new THREE.MeshStandardMaterial({ color: '#b3261e', roughness: 0.5 }),
  exit: new THREE.MeshBasicMaterial({ color: '#2ecc71', toneMapped: false }),
  door: new THREE.MeshStandardMaterial({ color: '#8d6e63', roughness: 0.6 }),
  wall: new THREE.MeshStandardMaterial({ color: '#efe9df', roughness: 0.9 }),
  glass: new THREE.MeshStandardMaterial({ color: '#b9dcf0', transparent: true, opacity: 0.25, roughness: 0.03, depthWrite: false }),
  mat: new THREE.MeshStandardMaterial({ color: '#6d4c41', roughness: 1 }),
};

function LiftDoors({ z, floor }: { z: number; floor: number }) {
  const l = useRef<THREE.Mesh>(null);
  const r = useRef<THREE.Mesh>(null);
  const open = useRef(0);
  const tex = useMemo(() => labelTexture(`▲ ${floor}`, { color: '#ff8c3a', bg: '#111111', w: 256, h: 96 }), [floor]);
  useFrame((_, dt) => {
    const st = useStore.getState();
    const target = st.nearLift && !st.lift ? 1 : 0;
    open.current += (target - open.current) * Math.min(1, dt * 3);
    const o = open.current * 0.5;
    l.current?.position.set(LIFT_X1 + 0.03, 1.05, z - 0.27 - o);
    r.current?.position.set(LIFT_X1 + 0.03, 1.05, z + 0.27 + o);
  });
  return (
    <group>
      <mesh geometry={box} material={M.steel} position={[LIFT_X1 + 0.02, 1.08, z]} scale={[0.04, 2.2, 1.3]} />
      <mesh ref={l} geometry={box} material={M.steel} scale={[0.04, 2.1, 0.54]} />
      <mesh ref={r} geometry={box} material={M.steel} scale={[0.04, 2.1, 0.54]} />
      <mesh position={[LIFT_X1 + 0.05, 2.38, z]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[0.42, 0.16]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      {/* Lift cabin interior (visible when doors open) */}
      <mesh geometry={box} material={M.glow} position={[LIFT_X1 - 1.0, 2.5, z]} scale={[1.2, 0.02, 1.2]} />
      <mesh geometry={box} material={M.steel} position={[LIFT_X1 - 1.7, 1.25, z]} scale={[0.04, 2.5, 1.4]} />
    </group>
  );
}

/** Lift lobby, corridor and fire exit for one floor, in tower-local coordinates. */
export function Corridor({ tower, floor }: { tower: Tower; floor: number }) {
  const y = floorBaseY(floor);
  const sign = useMemo(() => labelTexture(`FLOOR ${floor}`, { color: '#2b2b2b', w: 512, h: 120 }), [floor]);
  const flatsSign = useMemo(() => labelTexture(`${tower.id}-${floor}01 → ${tower.id}-${floor}04`, { color: '#2b2b2b', w: 512, h: 90 }), [tower.id, floor]);
  const exitSign = useMemo(() => labelTexture('EXIT ⇢', { color: '#ffffff', bg: '#1e8e3e', w: 256, h: 96 }), []);
  const parts = useMemo(() => {
    const floorTiles: IBox[] = [{ x: 0, z: 0, y: 0.012, sx: END * 2, sz: CORE_HALF * 2 - 0.02, sy: 0.02, color: '#e9e3d8' }];
    const lights: IBox[] = [];
    for (let x = LIFT_X1 + 1.5; x < STAIR_X0 - 0.5; x += 3) lights.push({ x, z: 0, y: H - 0.02, sx: 1.2, sy: 0.02, sz: 0.3 });
    const walls: IBox[] = [
      { x: LIFT_X1 - 0.1, z: 0, y: H / 2, sx: 0.2, sy: H, sz: CORE_HALF * 2 },
      { x: STAIR_X0 + 0.1, z: 0, y: H / 2, sx: 0.2, sy: H, sz: CORE_HALF * 2 },
    ];
    return { floorTiles, lights, walls };
  }, []);
  const doorRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    // Fire door opens a crack when you stand next to it.
    if (!doorRef.current) return;
    const [lx] = worldToTowerLocal(tower, runtime.player.x, runtime.player.z);
    doorRef.current.rotation.y = lx > STAIR_X0 - 1.5 ? -0.5 : 0;
  });

  return (
    <group position={[tower.position[0], y + 0.005, tower.position[2]]} rotation-y={tower.rotationY}>
      <Boxes boxes={parts.floorTiles} material={MATS.tile} receiveShadow />
      <mesh geometry={box} material={MATS.ceiling} position={[0, H + 0.005, 0]} scale={[END * 2, 0.01, CORE_HALF * 2]} />
      <Boxes boxes={parts.lights} material={M.glow} />
      <Boxes boxes={parts.walls} material={M.stone} castShadow receiveShadow />
      {/* Lifts */}
      <LiftDoors z={-1.35} floor={floor} />
      <LiftDoors z={1.35} floor={floor} />
      <mesh geometry={box} material={M.steel} position={[LIFT_X1 + 0.03, 1.2, 0]} scale={[0.03, 0.22, 0.1]} />
      <mesh geometry={box} material={M.glow} position={[LIFT_X1 + 0.05, 1.25, 0]} scale={[0.01, 0.04, 0.04]} />
      <mesh position={[LIFT_X1 + 0.05, 2.65, 0]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[1.2, 0.28]} />
        <meshStandardMaterial map={sign} transparent />
      </mesh>
      <mesh position={[LIFT_X1 + 3, 2.55, -CORE_HALF + 0.02]}>
        <planeGeometry args={[1.6, 0.28]} />
        <meshStandardMaterial map={flatsSign} transparent />
      </mesh>
      {/* Fire exit */}
      <mesh ref={doorRef} geometry={box} material={M.red} position={[STAIR_X0 - 0.04, 1.05, 0.2]} scale={[0.06, 2.1, 1.1]} />
      <mesh position={[STAIR_X0 - 0.06, 2.4, 0.2]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[0.5, 0.18]} />
        <meshBasicMaterial map={exitSign} toneMapped={false} />
      </mesh>
      <mesh geometry={box} material={M.red} position={[STAIR_X0 - 0.15, 1.3, -1.9]} scale={[0.25, 0.7, 0.7]} />
      {/* Doormats and plants */}
      <mesh geometry={box} material={M.mat} position={[-7.1, 0.01, CORE_HALF - 0.5]} scale={[1.0, 0.015, 0.6]} />
      <mesh geometry={box} material={M.mat} position={[7.1, 0.01, CORE_HALF - 0.5]} scale={[1.0, 0.015, 0.6]} />
      <mesh geometry={box} material={M.mat} position={[7.1, 0.01, -CORE_HALF + 0.5]} scale={[1.0, 0.015, 0.6]} />
      <mesh geometry={box} material={M.mat} position={[-7.1, 0.01, -CORE_HALF + 0.5]} scale={[1.0, 0.015, 0.6]} />
      <mesh position={[LIFT_X1 + 0.5, 0.3, CORE_HALF - 0.4]}>
        <cylinderGeometry args={[0.2, 0.17, 0.6, 16]} />
        <meshStandardMaterial color="#d8d2c6" roughness={0.3} />
      </mesh>
      <mesh position={[LIFT_X1 + 0.5, 0.95, CORE_HALF - 0.4]}>
        <sphereGeometry args={[0.38, 14, 10]} />
        <meshStandardMaterial color="#4f8a43" roughness={0.9} />
      </mesh>
      {/* Housekeeping staff mopping near the fire exit adds life to the corridor */}
      <Person look={LOOKS.guard} anim="cook" position={[STAIR_X0 - 2.2, 0, -1.2]} rotation-y={-Math.PI / 2} />
    </group>
  );
}
