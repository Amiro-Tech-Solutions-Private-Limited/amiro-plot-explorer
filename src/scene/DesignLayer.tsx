import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import type { Flat } from '../data/types';
import { useStore } from '../store/useStore';
import { runtime } from '../store/runtime';
import { flatXform, furnishedOf, worldToPlan } from '../lib/interiorFrame';
import { clearances, corners, doorSwings, groupsOf, MIN_CLEAR, type Group } from '../lib/design';
import { moveGroup } from '../lib/designStore';
import { FLAT_D, FLAT_W } from '../lib/geometry';

const ftIn = (m: number) => {
  const inches = Math.round(m * 39.37);
  return `${Math.floor(inches / 12)}′${inches % 12}″`;
};

const pickMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
const hoverMat = new THREE.MeshBasicMaterial({ color: '#38bdf8', transparent: true, opacity: 0.12, depthWrite: false });
const box = new THREE.BoxGeometry(1, 1, 1);
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hit = new THREE.Vector3();
const ndc = new THREE.Vector2();
const ray = new THREE.Raycaster();

export function useGroups(flat: Flat) {
  const furnishing = useStore((s) => s.furnishing);
  const themeId = useStore((s) => s.themes[flat.id]);
  const design = useStore((s) => s.design[flat.id]);
  return useMemo(() => groupsOf(furnishedOf(flat, furnishing, themeId).pieces, flatXform(flat).layout, design), [flat, furnishing, themeId, design]);
}

/** Overlaps another piece of furniture or leaves the room? */
export function fitsAt(g: Group, groups: Group[], dx: number, dz: number, flat: Flat) {
  const r = flatXform(flat).layout.rooms.find((q) => q.name === g.room);
  const moved = { ...g, cx: g.cx + dx, cz: g.cz + dz };
  const cs = corners(moved);
  // Allow furniture to spill into an adjoining open-plan room, but keep it inside the home.
  if (cs.some(([x, z]) => x < 0.08 || x > FLAT_W - 0.08 || z < 0.08 || z > FLAT_D + 1.5)) return false;
  if (r && g.category !== 'rug') {
    const others = groups.filter((o) => o.key !== g.key && o.category !== 'rug' && o.h > 0.05);
    const step = 0.1;
    for (let u = -moved.hx + 0.05; u <= moved.hx - 0.05; u += step) {
      for (let v = -moved.hz + 0.05; v <= moved.hz - 0.05; v += step) {
        const c = Math.cos(moved.rot);
        const s = Math.sin(moved.rot);
        const x = moved.cx + u * c + v * s;
        const z = moved.cz - u * s + v * c;
        for (const o of others) {
          const oc = Math.cos(-o.rot);
          const os = Math.sin(-o.rot);
          const lx = (x - o.cx) * oc + (z - o.cz) * os;
          const lz = -(x - o.cx) * os + (z - o.cz) * oc;
          if (Math.abs(lx) < o.hx - 0.02 && Math.abs(lz) < o.hz - 0.02) return false;
        }
      }
    }
  }
  return true;
}

/** Snap a dragged footprint flush to a nearby wall of its room (within 15 cm). */
function snap(g: Group, dx: number, dz: number, flat: Flat): [number, number] {
  const r = flatXform(flat).layout.rooms.find((q) => q.name === g.room);
  if (!r) return [dx, dz];
  const cs = corners({ ...g, cx: g.cx + dx, cz: g.cz + dz });
  const x0 = Math.min(...cs.map((c) => c[0]));
  const x1 = Math.max(...cs.map((c) => c[0]));
  const z0 = Math.min(...cs.map((c) => c[1]));
  const z1 = Math.max(...cs.map((c) => c[1]));
  const T = 0.15;
  const wall = 0.07;
  if (Math.abs(x0 - (r.x + wall)) < T) dx += r.x + wall - x0;
  else if (Math.abs(x1 - (r.x + r.w - wall)) < T) dx += r.x + r.w - wall - x1;
  if (Math.abs(z0 - (r.y + wall)) < T) dz += r.y + wall - z0;
  else if (Math.abs(z1 - (r.y + r.h - wall)) < T) dz += r.y + r.h - wall - z1;
  return [Math.round(dx * 20) / 20, Math.round(dz * 20) / 20];
}

function Footprint({ g, color, y = 0.03, dashed = false }: { g: Group; color: string; y?: number; dashed?: boolean }) {
  const pts = [...corners(g), corners(g)[0]].map(([x, z]) => [x, y, z] as [number, number, number]);
  return <Line points={pts} color={color} lineWidth={3} dashed={dashed} dashSize={0.15} gapSize={0.08} depthTest={false} renderOrder={12} />;
}

function Clearances({ g, groups, flat }: { g: Group; groups: Group[]; flat: Flat }) {
  const r = flatXform(flat).layout.rooms.find((q) => q.name === g.room);
  if (!r) return null;
  const cl = clearances(g, r, groups);
  const need = g.category ? MIN_CLEAR[g.category] ?? 0 : 0;
  const front = cl.find((c) => c.dir === 'front')!;
  const ok = front.gap >= need;
  // Walking band in front of the item.
  const bandD = Math.max(0.05, Math.min(front.gap, Math.max(need, 0.75)));
  const fx = Math.sin(g.front);
  const fz = Math.cos(g.front);
  const la = g.front - g.rot;
  const halfW = Math.abs(Math.cos(la)) * g.hx + Math.abs(Math.sin(la)) * g.hz;
  return (
    <group>
      {need > 0 && (
        <mesh position={[front.from[0] + (fx * bandD) / 2, 0.025, front.from[1] + (fz * bandD) / 2]} rotation={[-Math.PI / 2, 0, g.front]} renderOrder={11}>
          <planeGeometry args={[halfW * 2, bandD]} />
          <meshBasicMaterial color={ok ? '#22c55e' : '#ef4444'} transparent opacity={0.28} depthTest={false} toneMapped={false} />
        </mesh>
      )}
      {cl.map((c) =>
        c.gap > 0.02 ? (
          <group key={c.dir}>
            <Line points={[[c.from[0], 0.06, c.from[1]], [c.to[0], 0.06, c.to[1]]]} color={c.dir === 'front' ? (ok ? '#22c55e' : '#ef4444') : '#fbbf24'} lineWidth={2} depthTest={false} renderOrder={12} />
            <Html position={[(c.from[0] + c.to[0]) / 2, 0.15, (c.from[1] + c.to[1]) / 2]} center zIndexRange={[45, 0]} style={{ pointerEvents: 'none' }}>
              <div className={`whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10.5px] font-bold shadow ${c.dir === 'front' && !ok ? 'bg-red-500 text-white' : 'bg-amber-300 text-slate-900'}`}>
                {ftIn(c.gap)} · {c.gap.toFixed(2)} m
              </div>
            </Html>
          </group>
        ) : null,
      )}
    </group>
  );
}

function DoorArcs({ flat, room, groups }: { flat: Flat; room: string; groups: Group[] }) {
  const L = flatXform(flat).layout;
  const r = L.rooms.find((q) => q.name === room);
  if (!r) return null;
  return (
    <>
      {doorSwings(L, r, groups).map((d, i) => {
        // Arc from the closed leaf direction to the open direction, on the floor.
        const pts: [number, number, number][] = [[d.x, 0.04, d.z]];
        for (let k = 0; k <= 12; k++) {
          const a = (k / 12) * (Math.PI / 2);
          const x = d.horiz ? d.x + Math.cos(a) * d.r : d.x + d.into * Math.sin(a) * d.r;
          const z = d.horiz ? d.z + d.into * Math.sin(a) * d.r : d.z + Math.cos(a) * d.r;
          pts.push([x, 0.04, z]);
        }
        pts.push([d.x, 0.04, d.z]);
        return <Line key={i} points={pts} color={d.blocked ? '#ef4444' : '#60a5fa'} lineWidth={2} dashed dashSize={0.08} gapSize={0.05} depthTest={false} renderOrder={12} />;
      })}
    </>
  );
}

/**
 * "Design your home" layer for the current flat (drawing-plan coords): pick, drag, snap,
 * clearance bands, gap dimensions and door swings.
 */
export function DesignLayer({ flat }: { flat: Flat }) {
  const sel = useStore((s) => s.designSel);
  const top = useStore((s) => s.designTop);
  const groups = useGroups(flat);
  const { camera, gl } = useThree();
  const xf = flatXform(flat);
  const [drag, setDrag] = useState<{ key: string; sx: number; sz: number; dx: number; dz: number; ok: boolean } | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const selected = groups.find((g) => g.key === sel) ?? null;

  const planAt = (clientX: number, clientY: number) => {
    const rect = gl.domElement.getBoundingClientRect();
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    plane.constant = -xf.baseY;
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    return worldToPlan(xf, hit.x, hit.z);
  };

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const p = planAt(e.clientX, e.clientY);
      if (!p) return;
      const g = groups.find((q) => q.key === drag.key);
      if (!g) return;
      const [dx, dz] = snap(g, p.x - drag.sx, p.y - drag.sz, flat);
      setDrag((d) => (d ? { ...d, dx, dz, ok: fitsAt(g, groups, dx, dz, flat) } : d));
    };
    const up = () => {
      runtime.designDrag = false;
      setDrag((d) => {
        if (d && (Math.abs(d.dx) > 0.01 || Math.abs(d.dz) > 0.01)) {
          if (d.ok) moveGroup(flat.id, d.key, d.dx, d.dz);
          else useStore.getState().showToast('That spot overlaps other furniture or a wall — try another place');
        }
        return null;
      });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [drag?.key, groups]); // eslint-disable-line react-hooks/exhaustive-deps

  // Top-down camera over the flat while designing.
  const wasTop = useRef(false);
  useFrame(() => {
    if (top) {
      const [cx, cz] = [xf.gx + (FLAT_W / 2) * Math.cos(xf.rot) + (FLAT_D / 2 + 0.6) * Math.sin(xf.rot), xf.gz - (FLAT_W / 2) * Math.sin(xf.rot) + (FLAT_D / 2 + 0.6) * Math.cos(xf.rot)];
      camera.up.set(-Math.sin(xf.rot), 0, -Math.cos(xf.rot));
      camera.position.set(cx, xf.baseY + 15, cz);
      camera.lookAt(cx, xf.baseY, cz);
      runtime.camOverride = true;
      wasTop.current = true;
    } else if (wasTop.current) {
      camera.up.set(0, 1, 0);
      runtime.camOverride = false;
      wasTop.current = false;
    }
  });
  useEffect(
    () => () => {
      camera.up.set(0, 1, 0);
      runtime.camOverride = false;
      runtime.designDrag = false;
    },
    [camera],
  );

  const down = (g: Group) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    useStore.setState({ designSel: g.key });
    const p = planAt(e.nativeEvent.clientX, e.nativeEvent.clientY);
    if (!p) return;
    runtime.designDrag = true;
    setDrag({ key: g.key, sx: p.x, sz: p.y, dx: 0, dz: 0, ok: true });
  };

  const dragged = drag ? groups.find((g) => g.key === drag.key) : null;
  const shown = selected && drag?.key === selected.key ? { ...selected, cx: selected.cx + drag.dx, cz: selected.cz + drag.dz } : selected;

  return (
    <group>
      {groups.map((g) => (
        <mesh
          key={g.key}
          geometry={box}
          material={hover === g.key && g.key !== sel ? hoverMat : pickMat}
          position={[g.cx, Math.max(0.3, g.h) / 2, g.cz]}
          rotation-y={g.rot}
          scale={[g.hx * 2 + 0.04, Math.max(0.3, g.h), g.hz * 2 + 0.04]}
          onPointerDown={down(g)}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHover(g.key);
            document.body.style.cursor = 'grab';
          }}
          onPointerOut={() => {
            setHover(null);
            document.body.style.cursor = '';
          }}
        />
      ))}
      {dragged && drag && (
        <mesh geometry={box} position={[dragged.cx + drag.dx, Math.max(0.3, dragged.h) / 2, dragged.cz + drag.dz]} rotation-y={dragged.rot} scale={[dragged.hx * 2, Math.max(0.3, dragged.h), dragged.hz * 2]} renderOrder={13}>
          <meshBasicMaterial color={drag.ok ? '#38bdf8' : '#ef4444'} transparent opacity={0.35} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      {shown && (
        <>
          <Footprint g={shown} color={drag && !drag.ok ? '#ef4444' : '#fbbf24'} />
          <Clearances g={shown} groups={groups} flat={flat} />
          <DoorArcs flat={flat} room={shown.room} groups={groups.map((g) => (g.key === shown.key ? shown : g))} />
          {!top && (
            <Html position={[shown.cx, shown.h + 0.35, shown.cz]} center zIndexRange={[45, 0]} style={{ pointerEvents: 'none' }}>
              <div className="whitespace-nowrap rounded-lg bg-slate-900/90 px-2 py-1 text-[11px] font-semibold text-white shadow">
                {shown.label} · {(shown.hx * 2 * 100).toFixed(0)}×{(shown.hz * 2 * 100).toFixed(0)} cm
              </div>
            </Html>
          )}
        </>
      )}
    </group>
  );
}
