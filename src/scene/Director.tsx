import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import { useStore } from '../store/useStore';
import { runtime } from '../store/runtime';
import { getItem, landmarks, type Item } from '../lib/items';
import { FLAT_BY_ID } from '../data/project';
import { flatXform } from '../lib/interiorFrame';
import { PANORAMA_EYE_HEIGHT, panoramaYaw } from '../lib/panorama';

const v = new THREE.Vector3();
const want = new THREE.Vector3();
const look = new THREE.Vector3();
const M = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);

const smooth = (t: number) => t * t * (3 - 2 * t);

function floorOf(it: Item) {
  if (it.floorY != null) return it.floorY;
  const f = it.flatId ? FLAT_BY_ID.get(it.flatId) : undefined;
  return f ? flatXform(f).baseY : 0;
}

/** Where the camera should be and what it should look at for one beat. */
function shot(kind: string, items: Item[], t: number, from: THREE.Vector3) {
  const it = items[0];
  const c = new THREE.Vector3();
  for (const x of items) c.add(v.set(...x.center));
  c.divideScalar(items.length);
  const site = it.kind === 'site';
  const fy = floorOf(it);
  const p = runtime.player;
  const eye = new THREE.Vector3(p.x, site ? p.y + 1.7 : fy + 1.6, p.z);
  const pos = new THREE.Vector3();
  const tgt = c.clone();

  if (site) {
    const r = Math.max(it.size[0], it.size[2]);
    const dir = v.set(eye.x - c.x, 0, eye.z - c.z);
    if (dir.lengthSq() < 1) dir.set(0, 0, 1);
    dir.normalize();
    const a = Math.atan2(dir.z, dir.x) + (kind === 'orbit' ? t * 0.12 : 0);
    const R = r * (kind === 'closeup' ? 0.9 : 1.5);
    pos.set(c.x + Math.cos(a) * R, Math.max(4, r * (kind === 'overhead' ? 1.6 : 0.65)), c.z + Math.sin(a) * R);
    // Roof-top items (sky garden): look down from above the terrace.
    if (c.y > 20) pos.y = c.y + r * 0.7;
    return { pos, tgt };
  }

  switch (kind) {
    case 'closeup':
      pos.set(...it.view);
      break;
    case 'dolly':
      pos.copy(from).lerp(v.set(...it.view), smooth(Math.min(1, t / 3.5)));
      break;
    case 'view': {
      pos.set(...it.view);
      // A slow pan across the view.
      const dx = it.center[0] - pos.x;
      const dz = it.center[2] - pos.z;
      const a = Math.atan2(dz, dx) + Math.sin(t * 0.25) * 0.35;
      const d = Math.hypot(dx, dz);
      tgt.set(pos.x + Math.cos(a) * d, it.center[1], pos.z + Math.sin(a) * d);
      break;
    }
    case 'orbit': {
      const R = Math.max(0.6, Math.min(it.size[0], it.size[2]) * 0.3);
      const a0 = Math.atan2(from.z - c.z, from.x - c.x);
      const a = a0 + t * 0.18;
      pos.set(c.x + Math.cos(a) * R, fy + 1.75, c.z + Math.sin(a) * R);
      tgt.set(c.x - Math.cos(a) * R * 2, fy + 1.0, c.z - Math.sin(a) * R * 2);
      break;
    }
    case 'wide':
    case 'overhead': {
      if (it.corners) {
        // Stand in the corner nearest the visitor and look across the room.
        let best = it.corners[0];
        for (const k of it.corners) if (Math.hypot(k[0] - eye.x, k[1] - eye.z) < Math.hypot(best[0] - eye.x, best[1] - eye.z)) best = k;
        const ix = c.x - best[0];
        const iz = c.z - best[1];
        const l = Math.hypot(ix, iz) || 1;
        pos.set(best[0] + (ix / l) * 0.45, fy + (kind === 'overhead' ? 2.6 : 2.25), best[1] + (iz / l) * 0.45);
        tgt.set(c.x + (ix / l) * 0.8, fy + 0.7, c.z + (iz / l) * 0.8);
      } else {
        pos.copy(eye);
        pos.y = fy + 2.2;
      }
      break;
    }
    default:
      // 'look': stay where the visitor stands and turn towards the item.
      pos.copy(eye);
  }
  return { pos, tgt };
}

/** Takes the camera during narrated beats and frames what is being talked about. */
export function Director() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const st = useRef({ key: -1, t: 0, yaw: 0, from: new THREE.Vector3(), active: false, panoramic: false });
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const s = st.current;
    const store = useStore.getState();
    const b = store.beat;
    const on = !!b && runtime.directing && performance.now() - runtime.userCam > 5000 && !store.flying && !runtime.camOverride && (store.mode === 'interior' || store.mode === 'walk' || store.mode === 'balcony');
    const items = on ? (b!.focus.map(getItem).filter(Boolean) as Item[]) : [];
    if (!on || !items.length) {
      if (s.active) {
        s.active = false;
        camera.getWorldDirection(v);
        runtime.dirYaw = Math.atan2(-v.x, -v.z);
        if (s.panoramic && !store.flying) {
          camera.fov = 70;
          camera.updateProjectionMatrix();
        }
      }
      return;
    }
    if (b!.key !== s.key) {
      s.key = b!.key;
      s.t = 0;
      s.from.copy(camera.position);
      camera.getWorldDirection(v);
      s.yaw = Math.atan2(-v.x, -v.z);
      s.panoramic = b!.shot === 'panorama';
      if (s.panoramic) {
        // The room waypoint is already collision-checked. Keep a fixed human viewpoint.
        camera.position.set(runtime.player.x, floorOf(items[0]) + PANORAMA_EYE_HEIGHT, runtime.player.z);
      }
    } else if (s.panoramic && !s.active) {
      // Resume from the visitor's chosen heading instead of pulling back to the old angle.
      camera.getWorldDirection(v);
      s.yaw = Math.atan2(-v.x, -v.z) - panoramaYaw(0, s.t);
    }
    s.active = true;
    if (store.tour?.paused) return;
    s.t += dt;
    runtime.beatElapsed = s.t;
    if (s.panoramic) {
      const yaw = panoramaYaw(s.yaw, s.t);
      // Look around from one spot instead of orbiting furniture or moving through walls.
      Q.setFromEuler(new THREE.Euler(-0.025, yaw, 0, 'YXZ'));
      camera.quaternion.slerp(Q, 1 - Math.exp(-dt * 6));
      const fov = camera.fov + (76 - camera.fov) * (1 - Math.exp(-dt * 3));
      if (Math.abs(fov - camera.fov) > 0.001) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
      return;
    }
    const { pos, tgt } = shot(b!.shot, items, s.t, s.from);
    const kp = 1 - Math.exp(-dt * (b!.shot === 'dolly' ? 6 : 2.4));
    want.copy(pos);
    camera.position.lerp(want, kp);
    look.copy(tgt);
    M.lookAt(camera.position, look, UP);
    Q.setFromRotationMatrix(M);
    camera.quaternion.slerp(Q, 1 - Math.exp(-dt * 3.2));
  });
  return null;
}

const ftIn = (m: number) => {
  const inches = Math.round(m * 39.37);
  return `${Math.floor(inches / 12)}′${inches % 12}″`;
};

function Outline({ it }: { it: Item }) {
  const geo = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(it.size[0] + 0.08, it.size[1] + 0.08, it.size[2] + 0.08)), [it.size]);
  const mat = useMemo(() => new THREE.LineBasicMaterial({ color: '#fbbf24', transparent: true, depthTest: false, toneMapped: false }), []);
  const glow = useMemo(() => new THREE.MeshBasicMaterial({ color: '#fde68a', transparent: true, opacity: 0.12, depthWrite: false, toneMapped: false }), []);
  useFrame(({ clock }) => {
    const k = 0.55 + Math.sin(clock.elapsedTime * 4) * 0.35;
    mat.opacity = k;
    glow.opacity = k * 0.16;
  });
  return (
    <group position={it.center} rotation-y={it.rotY}>
      <lineSegments geometry={geo} material={mat} renderOrder={10} />
      <mesh material={glow} scale={[it.size[0] + 0.06, it.size[1] + 0.06, it.size[2] + 0.06]}>
        <boxGeometry />
      </mesh>
    </group>
  );
}

function Tag({ it, dy }: { it: Item; dy: number }) {
  return (
    <Html position={[it.center[0], it.center[1] + dy, it.center[2]]} center zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }}>
      <div className="flex flex-col items-center">
        <div className="w-max max-w-[240px] rounded-xl bg-slate-900/90 px-3 py-1.5 text-center text-white shadow-xl ring-1 ring-amber-300/60">
          <div className="whitespace-nowrap text-[12px] font-semibold">{it.label}</div>
          {it.spec && <div className="text-[10.5px] leading-tight text-amber-100/90">{it.spec}</div>}
        </div>
        <div className="h-6 w-px bg-amber-300" />
        <div className="h-2 w-2 rounded-full bg-amber-300 shadow" />
      </div>
    </Html>
  );
}

function Dimensions({ it }: { it: Item }) {
  if (!it.corners) return null;
  const y = (it.floorY ?? 0) + 0.04;
  const pts = [...it.corners, it.corners[0]].map(([x, z]) => [x, y, z] as [number, number, number]);
  const mid = (a: [number, number], b: [number, number]) => [(a[0] + b[0]) / 2, y + 0.15, (a[1] + b[1]) / 2] as [number, number, number];
  const [a, b, c] = it.corners;
  const w = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const h = Math.hypot(c[0] - b[0], c[1] - b[1]);
  return (
    <group>
      <Line points={pts} color="#fbbf24" lineWidth={3} dashed dashSize={0.25} gapSize={0.12} depthTest={false} renderOrder={10} />
      {[
        [mid(a, b), w],
        [mid(b, c), h],
      ].map(([p, len], i) => (
        <Html key={i} position={p as [number, number, number]} center zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }}>
          <div className="whitespace-nowrap rounded-md bg-amber-300 px-1.5 py-0.5 text-[11px] font-bold text-slate-900 shadow">
            {ftIn(len as number)} · {(len as number).toFixed(1)} m
          </div>
        </Html>
      ))}
    </group>
  );
}

function Compass({ it }: { it: Item }) {
  const y = (it.floorY ?? 0) + 0.05;
  return (
    <group position={[it.center[0], y, it.center[2]]}>
      <mesh rotation-x={-Math.PI / 2} renderOrder={10}>
        <ringGeometry args={[0.55, 0.62, 48]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.85} depthTest={false} toneMapped={false} />
      </mesh>
      {/* North arrow: world north is -z. */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, -0.3]} renderOrder={10}>
        <circleGeometry args={[0.22, 3, Math.PI / 2]} />
        <meshBasicMaterial color="#ef4444" depthTest={false} toneMapped={false} />
      </mesh>
      {(
        [
          ['N', 0, -0.85],
          ['E', 0.85, 0],
          ['S', 0, 0.85],
          ['W', -0.85, 0],
        ] as const
      ).map(([l, x, z]) => (
        <Html key={l} position={[x, 0.05, z]} center zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }}>
          <div className={`text-[13px] font-black ${l === 'N' ? 'text-red-500' : 'text-amber-200'} drop-shadow`}>{l}</div>
        </Html>
      ))}
    </group>
  );
}

function Landmarks() {
  const list = useMemo(() => landmarks(), []);
  const p = runtime.player;
  return (
    <>
      {list.map((l) => (
        <Html key={l.label} position={l.pos} center zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }}>
          <div className="flex flex-col items-center">
            <div className="whitespace-nowrap rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-slate-800 shadow-lg">
              {l.label} <span className="text-slate-500">· {Math.round(Math.hypot(l.pos[0] - p.x, l.pos[2] - p.z))} m</span>
            </div>
            <div className="h-5 w-px bg-white/90" />
          </div>
        </Html>
      ))}
    </>
  );
}

/** On-screen annotations for the current beat: outlines, labels, dimensions, compass, landmarks. */
export function BeatFX() {
  const beat = useStore((s) => s.beat);
  const furnishing = useStore((s) => s.furnishing);
  const items = useMemo(() => (beat ? (beat.focus.map(getItem).filter(Boolean) as Item[]) : []), [beat?.key, furnishing]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!beat || !items.length || beat.shot === 'panorama') return null;
  const hl = beat.highlight ?? 'outline';
  return (
    <group>
      {items.map((it) => (
        <group key={it.id}>
          {(it.kind === 'feature' || it.kind === 'door') && <Outline it={it} />}
          {(it.kind === 'feature' || it.kind === 'door' || it.kind === 'site') && hl !== 'dimension' && <Tag it={it} dy={it.kind === 'site' ? it.size[1] + 2 : it.size[1] / 2 + 0.45} />}
          {it.kind === 'room' && hl === 'dimension' && <Dimensions it={it} />}
          {it.kind === 'room' && hl === 'compass' && <Compass it={it} />}
        </group>
      ))}
      {hl === 'landmarks' && <Landmarks />}
    </group>
  );
}
