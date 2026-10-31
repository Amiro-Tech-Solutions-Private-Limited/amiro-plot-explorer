import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useStore } from '../store/useStore';
import { runtime } from '../store/runtime';
import { CABIN, PARKING, PLAY, RING, TRACK_LEN, trackPoint, ZONES } from '../data/site';
import { LOOKS, Person, type AnimState } from './Person';

/** The visitor's own avatar for third-person walking. */
export function Avatar() {
  const mode = useStore((s) => s.mode);
  const third = useStore((s) => s.thirdPerson);
  const flying = useStore((s) => s.flying);
  const avatar = useStore((s) => s.avatar);
  const group = useRef<THREE.Group>(null);
  const state = useRef<AnimState>({ anim: 'idle', speed: 0 });

  useFrame(() => {
    const p = runtime.player;
    const g = group.current;
    if (!g) return;
    g.position.set(p.x, p.y, p.z);
    g.rotation.y = p.yaw + Math.PI;
    // The Director's camera is placed independently of the walker, so hide them from those shots.
    g.visible = !(runtime.directing && performance.now() - runtime.userCam > 5000) || mode === 'walk';
    state.current.speed = p.speed;
    state.current.anim = p.speed > 2.3 ? 'jog' : p.speed > 0.12 ? 'walk' : 'idle';
  });

  if (!third || flying || (mode !== 'walk' && mode !== 'interior')) return null;
  return <Person ref={group} look={avatar === 'f' ? LOOKS.avatarF : LOOKS.avatarM} state={state} />;
}

function Jogger({ look, offset, speed, lane }: { look: keyof typeof LOOKS; offset: number; speed: number; lane: number }) {
  const ref = useRef<THREE.Group>(null);
  const t = useRef(offset);
  useFrame((_, dt) => {
    t.current += (dt * speed) / TRACK_LEN;
    const p = trackPoint(t.current, lane);
    if (ref.current) {
      ref.current.position.set(p.x, 0.03, p.z);
      ref.current.rotation.y = p.yaw;
    }
  });
  return <Person ref={ref} look={LOOKS[look]} anim={speed > 2 ? 'jog' : 'walk'} phaseOffset={offset * 10} simple />;
}

function Stroller({ look, offset }: { look: keyof typeof LOOKS; offset: number }) {
  const ref = useRef<THREE.Group>(null);
  const t = useRef(offset);
  const W = RING.maxX - RING.minX;
  const H = RING.maxZ - RING.minZ;
  const per = 2 * (W + H);
  useFrame((_, dt) => {
    t.current = (t.current + dt * 1.2) % per;
    let d = t.current;
    const inset = RING.width / 2 + 2.2;
    let x: number;
    let z: number;
    let yaw: number;
    if (d < W) {
      x = RING.minX + d;
      z = RING.maxZ - inset;
      yaw = Math.PI / 2;
    } else if ((d -= W) < H) {
      x = RING.maxX - inset;
      z = RING.maxZ - d;
      yaw = Math.PI;
    } else if ((d -= H) < W) {
      x = RING.maxX - d;
      z = RING.minZ + inset;
      yaw = -Math.PI / 2;
    } else {
      d -= W;
      x = RING.minX + inset;
      z = RING.minZ + d;
      yaw = 0;
    }
    if (ref.current) {
      ref.current.position.set(x, 0, z);
      ref.current.rotation.y = yaw;
    }
  });
  return <Person ref={ref} look={LOOKS[look]} anim="walk" phaseOffset={offset} simple />;
}

/** Ambient residents around the site. */
export function SitePeople() {
  const mode = useStore((s) => s.mode);
  if (mode === 'plan' || mode === 'floors' || mode === 'interior') return null;
  return (
    <group>
      <Person look={LOOKS.guard} anim="idle" position={[CABIN.x - 2.4, 0, CABIN.z]} rotation-y={Math.PI} />
      <Jogger look="jogger1" offset={0} speed={3.2} lane={0.3} />
      <Jogger look="jogger2" offset={0.37} speed={2.8} lane={-0.4} />
      <Jogger look="elder" offset={0.7} speed={1.1} lane={0.5} />
      <Stroller look="mom" offset={10} />
      <Stroller look="dad" offset={11.2} />
      <Stroller look="hostF" offset={240} />
      <Person look={LOOKS.kid1} anim="wave" position={[PLAY.x + 2, 0.03, PLAY.z + 1]} rotation-y={0.6} />
      <Person look={LOOKS.kid2} anim="idle" position={[PLAY.x - 3, 0.03, PLAY.z - 2]} rotation-y={-0.4} />
      <Person look={LOOKS.mom} anim="talk" position={[PLAY.x + 3.5, 0.03, PLAY.z - PLAY.d / 2 - 1]} rotation-y={Math.PI} />
      <Person look={LOOKS.dad} anim="idle" position={[PARKING.x - 10, 0, PARKING.z - 4]} rotation-y={2.2} />
      <Person look={LOOKS.jogger3} anim="wave" position={[ZONES.court.x + 2, 0.03, ZONES.court.z - 2]} rotation-y={Math.PI} />
      <Person look={LOOKS.elder} anim="cook" position={[ZONES.elders.x - 3.5, 0.03, ZONES.elders.z - 2]} rotation-y={0} />
      <Person look={LOOKS.hostF} anim="namaste" position={[ZONES.yoga.x, 0.32, ZONES.yoga.z + 1]} rotation-y={Math.PI / 2} />
    </group>
  );
}
