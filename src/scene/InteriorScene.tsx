import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Billboard, Html } from '@react-three/drei';
import type { Flat } from '../data/types';
import { FLAT_BY_ID, TOWER_BY_ID, unitOf } from '../data/project';
import { interiorFor, profileWithTheme } from '../data/interiors';
import { useStore } from '../store/useStore';
import { runtime } from '../store/runtime';
import { effectiveFurnishing, flatXform, furnishedOf, planToWorldXZ, worldToPlan } from '../lib/interiorFrame';
import type { Anchor } from '../lib/furniture';
import type { Seg } from '../lib/walls';
import { DOOR_H } from '../lib/walls';
import { interiorTour, floorTour } from '../lib/tours';
import { floorFlats, floorRoute } from '../lib/floor';
import { startTour, walkPath } from '../lib/tourEngine';
import { narrator } from '../lib/narrator';
import { getItem } from '../lib/items';
import { FACING_LONG } from '../lib/geometry';
import { ordinal } from '../lib/format';
import { labelTexture } from './textures';
import { HomeModel } from './HomeModel';
import { LOOKS, Person, type Anim, type AnimState, type Look } from './Person';
import { Corridor } from './Corridor';
import { DesignLayer } from './DesignLayer';

const doorGeo = new THREE.BoxGeometry(1, 1, 1);
const metal = new THREE.MeshStandardMaterial({ color: '#c9a14a', metalness: 0.85, roughness: 0.25 });
const steel = new THREE.MeshStandardMaterial({ color: '#c9ced3', metalness: 0.8, roughness: 0.3 });
const slideGlass = new THREE.MeshStandardMaterial({ color: '#cfe6f5', transparent: true, opacity: 0.3, roughness: 0.05, depthWrite: false });

function nearPlan(flat: Flat, x: number, z: number, r: number) {
  const p = worldToPlan(flatXform(flat), runtime.player.x, runtime.player.z);
  return Math.hypot(p.x - x, p.y - z) < r;
}

function Door({ seg, flat, wood }: { seg: Seg; flat: Flat; wood: string }) {
  const { layout } = flatXform(flat);
  const pivot = useRef<THREE.Group>(null);
  const open = useRef(0);
  const horiz = seg.y1 === seg.y2;
  const fixed = horiz ? seg.y1 : seg.x1;
  const g0 = seg.gapC! - seg.gapW! / 2;
  const w = seg.gapW! - 0.02;
  const [a, b] = seg.rooms;
  const into = (() => {
    if (b == null) return layout.rooms[a];
    const ra = layout.rooms[a];
    const rb = layout.rooms[b];
    return ra.w * ra.h <= rb.w * rb.h ? ra : rb;
  })();
  const side = horiz ? Math.sign(into.y + into.h / 2 - fixed) : Math.sign(into.x + into.w / 2 - fixed);
  const closed = horiz ? 0 : -Math.PI / 2;
  const delta = horiz ? -side * (Math.PI / 2) : side * (Math.PI / 2);
  const entry = seg.kind === 'entry';
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: entry ? '#6b3f22' : wood, roughness: 0.5 }), [entry, wood]);
  const plate = useMemo(() => (entry ? labelTexture(flat.id, { color: '#f5e6c8', bg: '#2b2b2b', w: 256, h: 96 }) : null), [entry, flat.id]);

  useFrame((_, dt) => {
    const cx = horiz ? seg.gapC! : fixed;
    const cz = horiz ? fixed : seg.gapC!;
    const target = nearPlan(flat, cx, cz, entry ? 2.0 : 1.8) ? 1 : 0;
    open.current += (target - open.current) * Math.min(1, dt * 5);
    if (pivot.current) pivot.current.rotation.y = closed + delta * open.current;
  });

  return (
    <group position={[horiz ? g0 : fixed, 0, horiz ? fixed : g0]}>
      <group ref={pivot} rotation-y={closed}>
        <mesh geometry={doorGeo} material={mat} position={[w / 2, 1.03, 0]} scale={[w, 2.05, 0.045]} castShadow />
        {entry && (
          <>
            {[0.45, 1.0, 1.55].map((y) => (
              <mesh key={y} geometry={doorGeo} material={mat} position={[w / 2, y, -side * 0.03]} scale={[w - 0.2, 0.32, 0.02]} />
            ))}
            <mesh geometry={doorGeo} material={metal} position={[w / 2, 1.42, -side * 0.035]} scale={[0.03, 0.03, 0.02]} />
          </>
        )}
        <mesh geometry={doorGeo} material={entry ? metal : steel} position={[w - 0.09, 1.0, 0.04]} scale={[0.13, 0.025, 0.03]} />
        <mesh geometry={doorGeo} material={entry ? metal : steel} position={[w - 0.09, 1.0, -0.04]} scale={[0.13, 0.025, 0.03]} />
      </group>
      {entry && plate && (
        <mesh position={[w + 0.32, 1.55, -side * 0.12]} rotation-y={side > 0 ? Math.PI : 0}>
          <planeGeometry args={[0.38, 0.14]} />
          <meshBasicMaterial map={plate} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

function SlideDoor({ seg, flat }: { seg: Seg; flat: Flat }) {
  const panel = useRef<THREE.Mesh>(null);
  const open = useRef(0);
  const horiz = seg.y1 === seg.y2;
  const fixed = horiz ? seg.y1 : seg.x1;
  const half = seg.gapW! / 2;
  useFrame((_, dt) => {
    const cx = horiz ? seg.gapC! : fixed;
    const cz = horiz ? fixed : seg.gapC!;
    open.current += ((nearPlan(flat, cx, cz, 2.2) ? 1 : 0) - open.current) * Math.min(1, dt * 4);
    const along = seg.gapC! + half / 2 - half * 0.95 * open.current;
    if (panel.current) panel.current.position.set(horiz ? along : fixed + 0.05, DOOR_H / 2, horiz ? fixed + 0.05 : along);
  });
  const fixedPos: [number, number, number] = horiz ? [seg.gapC! - half / 2, DOOR_H / 2, fixed - 0.03] : [fixed - 0.03, DOOR_H / 2, seg.gapC! - half / 2];
  const scale: [number, number, number] = horiz ? [half, DOOR_H, 0.025] : [0.025, DOOR_H, half];
  return (
    <group>
      <mesh geometry={doorGeo} material={slideGlass} position={fixedPos} scale={scale} />
      <mesh ref={panel} geometry={doorGeo} material={slideGlass} scale={scale} />
    </group>
  );
}

function Fan({ x, z }: { x: number; z: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 7;
  });
  return (
    <group position={[x, 2.62, z]}>
      <mesh position={[0, 0.17, 0]} material={steel}>
        <cylinderGeometry args={[0.015, 0.015, 0.34, 6]} />
      </mesh>
      <group ref={ref}>
        <mesh material={steel}>
          <cylinderGeometry args={[0.1, 0.12, 0.12, 16]} />
        </mesh>
        {[0, 1, 2].map((k) => (
          <mesh key={k} rotation-y={(k * Math.PI * 2) / 3} position={[0.35, -0.02, 0]}>
            <boxGeometry args={[0.62, 0.012, 0.12]} />
            <meshStandardMaterial color="#e9e9e6" roughness={0.6} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function RoomTag({ name, x, z }: { name: string; x: number; z: number }) {
  const tex = useMemo(() => labelTexture(name, { color: '#0f172a', bg: 'rgba(255,255,255,0.9)', w: 512, h: 96 }), [name]);
  return (
    <Billboard position={[x, 2.3, z]}>
      <mesh renderOrder={5}>
        <planeGeometry args={[1.1, 0.21]} />
        <meshBasicMaterial map={tex} transparent toneMapped={false} />
      </mesh>
    </Billboard>
  );
}

function Hotspot({ x, z, onGo }: { x: number; z: number; onGo: () => void }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      const s = 1 + Math.sin(clock.elapsedTime * 2.5) * 0.08;
      ref.current.scale.set(s, s, s);
    }
  });
  return (
    <mesh
      ref={ref}
      position={[x, 0.035, z]}
      rotation-x={-Math.PI / 2}
      onClick={(e) => {
        e.stopPropagation();
        onGo();
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      <ringGeometry args={[0.2, 0.28, 32]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.75} toneMapped={false} depthWrite={false} />
    </mesh>
  );
}

function Residents({ flat }: { flat: Flat }) {
  const furnishing = useStore((s) => s.furnishing);
  const mode = effectiveFurnishing(flat, furnishing);
  if (mode !== 'lived') return null;
  const a = furnishedOf(flat, furnishing).anchors;
  const p = interiorFor(flat);
  const people: { look: Look; anim: Anim; at: Anchor | undefined }[] = [];
  switch (p.household) {
    case 'couple':
      people.push({ look: LOOKS.dad, anim: 'sit', at: a.sofa }, { look: LOOKS.mom, anim: 'cook', at: a.cook });
      break;
    case 'kids':
      people.push({ look: LOOKS.kid1, anim: 'wave', at: a.kid }, { look: LOOKS.mom, anim: 'cook', at: a.cook }, { look: LOOKS.dad, anim: 'sit', at: a.sofa });
      break;
    case 'elders':
      people.push({ look: LOOKS.elder, anim: 'sit', at: a.armchair ?? a.sofa }, { look: LOOKS.mom, anim: 'cook', at: a.cook });
      break;
    case 'professional':
      people.push({ look: LOOKS.dad, anim: 'sit', at: a.desk ?? a.sofa });
      break;
  }
  return (
    <>
      {people
        .filter((x) => x.at)
        .map((x, i) => (
          <Person key={i} look={x.look} anim={x.anim} position={[x.at!.x, 0, x.at!.z]} rotation-y={x.at!.ry} phaseOffset={i * 2} />
        ))}
    </>
  );
}

/**
 * The sales host: waits in the current sample flat's living room, offers tours,
 * and walks alongside the visitor (following their trail) while a tour runs.
 */
function HostGuide({ flat }: { flat: Flat }) {
  const ref = useRef<THREE.Group>(null);
  const state = useRef<AnimState>({ anim: 'idle', speed: 0 });
  const trail = useRef<{ x: number; z: number }[]>([]);
  const touring = useStore((s) => s.touring);
  const furnishing = useStore((s) => s.furnishing);
  const [near, setNear] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const xf = flatXform(flat);
  const sample = effectiveFurnishing(flat, furnishing) === 'sample';
  const home = useMemo(() => {
    const a = furnishedOf(flat, furnishing).anchors.host;
    if (!a) return null;
    const [x, z] = planToWorldXZ(xf, a.x, a.z);
    return { x, z };
  }, [flat, furnishing, xf]);
  const look = interiorFor(flat).seed % 2 ? LOOKS.hostF : LOOKS.host;
  const camera = useThree((s) => s.camera);
  const aim = useRef<THREE.Vector3 | null>(new THREE.Vector3());

  useFrame((_, rawDt) => {
    const g = ref.current;
    if (!g || !home) return;
    const dt = Math.min(rawDt, 0.05);
    const p = runtime.player;
    if (!g.userData.placed) {
      g.position.set(home.x, xf.baseY, home.z);
      g.userData.placed = true;
    }
    const tr = trail.current;
    const last = tr[tr.length - 1];
    if (!last || Math.hypot(last.x - p.x, last.z - p.z) > 0.25) tr.push({ x: p.x, z: p.z });
    if (tr.length > 40) tr.shift();
    const beat = useStore.getState().beat;
    let item = beat?.focus[0] ? getItem(beat.focus[0]) : null;
    if (item && Math.abs(item.center[1] - xf.baseY) > 4) item = null;
    const atStop = runtime.tourCap === runtime.tourIdx;
    // While touring the host leads the way along the route and waits beside each stop.
    let target = home;
    if (touring && runtime.tourAll.length) {
      const wp = runtime.tourAll[Math.min(runtime.tourIdx, runtime.tourAll.length - 1)];
      if (atStop && item && (item.kind === 'feature' || item.kind === 'door')) {
        // Stand beside the thing being shown, off the camera line.
        const dx = item.center[0] - item.view[0];
        const dz = item.center[2] - item.view[2];
        const l = Math.hypot(dx, dz) || 1;
        target = { x: item.view[0] + dx * 0.35 - (dz / l) * 1.15, z: item.view[2] + dz * 0.35 + (dx / l) * 1.15 };
      } else if (atStop && item?.corners) {
        // Room overview: stand across the room from the camera's corner, facing back at it.
        let ni = 0;
        item.corners.forEach((k, i) => {
          if (Math.hypot(k[0] - p.x, k[1] - p.z) < Math.hypot(item!.corners![ni][0] - p.x, item!.corners![ni][1] - p.z)) ni = i;
        });
        const far = item.corners[(ni + 2) % 4];
        target = { x: item.center[0] + (far[0] - item.center[0]) * 0.4, z: item.center[2] + (far[1] - item.center[2]) * 0.4 };
      } else if (atStop) {
        const fx0 = -Math.sin(p.yaw);
        const fz0 = -Math.cos(p.yaw);
        target = { x: p.x + fx0 * 1.4 - fz0 * 0.5, z: p.z + fz0 * 1.4 + fx0 * 0.5 };
      } else target = wp;
    } else if (touring && tr.length > 6) target = tr[tr.length - 6];
    const dx = target.x - g.position.x;
    const dz = target.z - g.position.z;
    const d = Math.hypot(dx, dz);
    const speed = d > 0.15 ? Math.min(2.2, d * 2.2) : 0;
    if (speed > 0) {
      g.position.x += (dx / d) * speed * dt;
      g.position.z += (dz / d) * speed * dt;
    }
    if (d > 8) g.position.set(target.x, xf.baseY, target.z);
    g.position.y = xf.baseY;
    // Face the viewer (the camera) when standing still — eye contact while talking.
    const pointing = !!item && beat?.host === 'point' && speed < 0.3;
    // The pointing clip aims straight ahead, so turn the body towards the item while pointing.
    const fx = speed > 0.3 ? dx : pointing && item ? item.center[0] - g.position.x : camera.position.x - g.position.x;
    const fz = speed > 0.3 ? dz : pointing && item ? item.center[2] - g.position.z : camera.position.z - g.position.z;
    let dy = Math.atan2(fx, fz) - g.rotation.y;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    g.rotation.y += dy * Math.min(1, dt * 4);
    aim.current!.copy(camera.position);
    state.current.speed = speed;
    state.current.anim =
      speed > 0.3
        ? 'walk'
        : pointing
          ? 'point'
          : beat?.host === 'present'
            ? 'present'
            : beat?.host === 'namaste'
              ? 'namaste'
              : narrator.speaking
                ? 'talk'
                : 'idle';
    const n = Math.hypot(p.x - g.position.x, p.z - g.position.z) < 3.2;
    if (n !== near) setNear(n);
  });

  if (!home || (!sample && !touring)) return null;
  const u = unitOf(flat);
  return (
    <group ref={ref}>
      <Person look={look} state={state} talk target={aim} />
      {near && !touring && !dismissed && sample && (
        <Html position={[0, 2.15, 0]} center zIndexRange={[50, 0]}>
          <div className="w-64 rounded-2xl bg-white/95 p-3 text-xs text-slate-700 shadow-xl ring-1 ring-black/5">
            <div className="mb-1 font-semibold text-slate-900">Hi! Welcome to {flat.id} 👋</div>
            This is a {u.label}, {FACING_LONG[flat.facing]} facing, on the {ordinal(flat.floor)} floor. Shall I show you around?
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <button
                onClick={() => startTour(interiorTour(flat, runtime.plan.valid ? { x: runtime.plan.x, y: runtime.plan.y } : { x: 6, y: 1 }), `${flat.id} tour`)}
                className="rounded-lg bg-brand-700 px-2 py-1.5 font-semibold text-white"
              >
                Tour this home
              </button>
              <button onClick={() => startTour(floorTour(flat.tower, flat.floor, runtime.player), `Floor ${flat.floor} tour`)} className="rounded-lg bg-brand-50 px-2 py-1.5 font-semibold text-brand-700">
                Tour the floor
              </button>
            </div>
            <button onClick={() => setDismissed(true)} className="mt-1.5 w-full rounded-lg bg-slate-100 px-2 py-1 font-semibold">
              Maybe later
            </button>
          </div>
        </Html>
      )}
    </group>
  );
}

function FlatInterior({ flat, current }: { flat: Flat; current: boolean }) {
  const furnishing = useStore((s) => s.furnishing);
  const roomTags = useStore((s) => s.roomTags);
  const night = useStore((s) => s.interiorNight);
  const themeId = useStore((s) => s.themes[flat.id]);
  const designMode = useStore((s) => s.designMode && current);
  const designTop = useStore((s) => s.designTop && current);
  useStore((s) => s.design[flat.id]?.rev);
  const xf = flatXform(flat);
  const f = furnishedOf(flat, furnishing, themeId);
  const theme = profileWithTheme(flat, themeId).theme;

  const walkTo = (px: number, py: number) => {
    walkPath(floorRoute(flat.tower, flat.floor, runtime.player, flat, { x: px, y: py }));
  };
  const onFloor = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return;
    e.stopPropagation();
    if (useStore.getState().designMode) {
      useStore.setState({ designSel: null });
      return;
    }
    const p = worldToPlan(xf, e.point.x, e.point.z);
    walkTo(p.x, p.y);
  };

  return (
    <group position={[xf.gx, xf.baseY + 0.005, xf.gz]} rotation-y={xf.rot}>
      <HomeModel flat={flat} wallH={2.93} furnishing={furnishing} themeId={themeId} castShadow={current} open={designTop} onFloorClick={onFloor} />
      {designMode && <DesignLayer flat={flat} />}
      {xf.layout.segs.map((s, i) =>
        s.kind === 'door' || s.kind === 'entry' ? <Door key={i} seg={s} flat={flat} wood={theme.woodLight} /> : s.kind === 'slide' ? <SlideDoor key={i} seg={s} flat={flat} /> : null,
      )}
      {current && !designTop && effectiveFurnishing(flat, furnishing) !== 'bare' && f.fans.map((p, i) => <Fan key={i} x={p.x} z={p.z} />)}
      {current && night && f.lights.slice(0, 6).map((p, i) => <pointLight key={i} position={[p.x, 2.6, p.z]} intensity={5} distance={7} decay={1.5} color="#ffd9a8" />)}
      {current &&
        roomTags &&
        !designMode &&
        xf.layout.rooms
          .filter((r) => r.kind !== 'stair')
          .map((r) => (
            <group key={r.name}>
              <RoomTag name={r.name} x={r.x + r.w / 2} z={r.y + r.h / 2} />
              <Hotspot x={r.x + r.w / 2} z={r.y + r.h / 2 + (r.h > 2.5 ? 0.8 : 0)} onGo={() => walkTo(r.x + r.w / 2, r.y + r.h / 2 + (r.h > 2.5 ? 0.8 : 0))} />
            </group>
          ))}
      <Residents flat={flat} />
    </group>
  );
}

/** The whole visited floor: four furnished homes, the corridor, lifts and the host. */
export function InteriorScene() {
  const mode = useStore((s) => s.mode);
  const selectedId = useStore((s) => s.selectedId);
  const night = useStore((s) => s.interiorNight);
  const flat = selectedId ? FLAT_BY_ID.get(selectedId) : undefined;
  const flats = useMemo(() => (flat ? floorFlats(flat.tower, flat.floor) : []), [flat?.tower, flat?.floor]); // eslint-disable-line react-hooks/exhaustive-deps
  if (mode !== 'interior' || !flat) return null;
  return (
    <group>
      {flats.map((f) => (
        <FlatInterior key={f.id} flat={f} current={f.id === flat.id} />
      ))}
      <Corridor tower={TOWER_BY_ID.get(flat.tower)!} floor={flat.floor} />
      <HostGuide key={`${flat.tower}-${flat.floor}`} flat={flat} />
      {!night && <ambientLight intensity={0.3} />}
    </group>
  );
}
