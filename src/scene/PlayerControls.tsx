import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useStore } from '../store/useStore';
import { runtime } from '../store/runtime';
import { FLAT_BY_ID, TOWER_BY_ID, TOWERS, WING_GAP } from '../data/project';
import { CABIN, CLUB, GATE_X, POOL, RAMP, SITE, ZONES } from '../data/site';
import { BALC_D, localToWorld, TOWER_HX, TOWER_HZ } from '../lib/geometry';
import { resolveCircle, type OBB } from '../lib/collide';
import { flatXform, worldToPlan } from '../lib/interiorFrame';
import { roomAt } from '../lib/route';
import { corridorArea, flatAt, floorColliders, floorNav, LIFT_X1, worldToTowerLocal } from '../lib/floor';
import { findPath, lineClear } from '../lib/nav';
import { arriveAt, startTour, stopTour } from '../lib/tourEngine';
import { narrator, readingTime } from '../lib/narrator';
import { floorTour } from '../lib/tours';
import { TREE_LIST } from './Vegetation';

const SITE_COLLIDERS: OBB[] = [
  ...TOWERS.map((t) => ({ cx: t.position[0], cz: t.position[2], hx: TOWER_HX + 0.3, hz: TOWER_HZ + BALC_D + 0.3, rot: t.rotationY })),
  ...TOWERS.filter((t) => t.wing === 1).map((t) => {
    const [cx, cz] = localToWorld(t, TOWER_HX + WING_GAP / 2, 0);
    return { cx, cz, hx: WING_GAP / 2 + 0.3, hz: TOWER_HZ - 1, rot: t.rotationY };
  }),
  { cx: CLUB.x, cz: CLUB.z, hx: CLUB.w / 2, hz: CLUB.d / 2, rot: 0 },
  { cx: POOL.x, cz: POOL.z, hx: POOL.w / 2, hz: POOL.d / 2, rot: 0 },
  { cx: CABIN.x, cz: CABIN.z, hx: CABIN.w / 2, hz: CABIN.d / 2, rot: 0 },
  { cx: RAMP.x, cz: RAMP.z, hx: RAMP.w / 2 + 0.3, hz: RAMP.d / 2, rot: 0 },
  { cx: ZONES.cricket.x, cz: ZONES.cricket.z, hx: ZONES.cricket.w / 2, hz: ZONES.cricket.d / 2, rot: 0 },
  { cx: ZONES.utilities.x, cz: ZONES.utilities.z, hx: ZONES.utilities.w / 2, hz: ZONES.utilities.d / 2, rot: 0 },
  { cx: GATE_X - 12.5, cz: SITE.maxZ + 1.2, hx: 1.6, hz: 1, rot: 0 },
  ...TREE_LIST.map((t) => ({ cx: t.x, cz: t.z, hx: 0.3, hz: 0.3, rot: 0 })),
];

function siteGround(x: number, z: number) {
  return Math.abs(x - POOL.x) < POOL.deckW / 2 && Math.abs(z - POOL.z) < POOL.deckD / 2 ? 0.4 : 0;
}

function pointBlocked(x: number, z: number, boxes: OBB[]) {
  for (const b of boxes) {
    const c = Math.cos(b.rot);
    const s = Math.sin(b.rot);
    const dx = x - b.cx;
    const dz = z - b.cz;
    if (Math.abs(dx * c - dz * s) < b.hx + 0.12 && Math.abs(dx * s + dz * c) < b.hz + 0.12) return true;
  }
  return false;
}

const keys = new Set<string>();

export { stopTour };

/** First/third-person walking for the site, a whole apartment floor and balcony look-around. */
export function PlayerControls({ active }: { active: boolean }) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const mode = useStore((s) => s.mode);
  const selectedId = useStore((s) => s.selectedId);
  const furnishing = useStore((s) => s.furnishing);
  const camYaw = useRef(0);
  const pitch = useRef(0);
  const bob = useRef(0);
  const stuck = useRef({ t: 0, d: Infinity, r: false });
  const vel = useRef({ x: 0, z: 0 });
  const armD = useRef(2);
  const camPos = useRef(new THREE.Vector3());
  const camInit = useRef(false);
  const lastFloor = useRef('');
  const v = useMemo(() => ({ head: new THREE.Vector3(), f: new THREE.Vector3() }), []);

  const flat = selectedId ? FLAT_BY_ID.get(selectedId) : undefined;
  const interior = mode === 'interior' && !!flat;
  const floorKey = interior ? `${flat!.tower}|${flat!.floor}` : '';
  const walls = useMemo(() => (interior ? floorColliders(flat!.tower, flat!.floor, furnishing, false) : SITE_COLLIDERS), [floorKey, furnishing]); // eslint-disable-line react-hooks/exhaustive-deps
  const withFurn = useMemo(() => (interior ? floorColliders(flat!.tower, flat!.floor, furnishing, true) : SITE_COLLIDERS), [floorKey, furnishing]); // eslint-disable-line react-hooks/exhaustive-deps
  const baseY = interior ? flatXform(flat!).baseY : 0;

  useEffect(() => {
    if (!active) return;
    const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
    camYaw.current = e.y;
    pitch.current = mode === 'balcony' ? e.x : 0;
    const p = runtime.player;
    p.x = camera.position.x;
    p.z = camera.position.z;
    p.yaw = e.y;
    p.speed = 0;
    lastFloor.current = floorKey;
    if (useStore.getState().thirdPerson && mode !== 'balcony') {
      const fx = -Math.sin(e.y);
      const fz = -Math.cos(e.y);
      const d = mode === 'interior' ? 0.8 : 3;
      [p.x, p.z] = resolveCircle(p.x + fx * d, p.z + fz * d, 0.3, mode === 'interior' ? walls : SITE_COLLIDERS);
    }
    if (runtime.pendingTour === 'floor' && interior) {
      runtime.pendingTour = null;
      startTour(floorTour(flat!.tower, flat!.floor), `Floor ${flat!.floor} tour`);
    }

    const el = gl.domElement;
    let dragging = false;
    let lx = 0;
    let ly = 0;
    let pid = -1;
    const down = (ev: PointerEvent) => {
      dragging = true;
      pid = ev.pointerId;
      lx = ev.clientX;
      ly = ev.clientY;
      if (runtime.directing) runtime.userCam = performance.now();
    };
    const move = (ev: PointerEvent) => {
      if (!dragging || ev.pointerId !== pid) return;
      if (runtime.designDrag || runtime.camOverride) {
        lx = ev.clientX;
        ly = ev.clientY;
        return;
      }
      const k = ev.pointerType === 'touch' ? 0.006 : 0.004;
      camYaw.current += (ev.clientX - lx) * k;
      pitch.current = THREE.MathUtils.clamp(pitch.current + (ev.clientY - ly) * k, -1.2, 1.2);
      lx = ev.clientX;
      ly = ev.clientY;
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId === pid) dragging = false;
    };
    const kd = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      keys.add(ev.code);
    };
    const ku = (ev: KeyboardEvent) => keys.delete(ev.code);
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => {
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      keys.clear();
      runtime.plan.valid = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, camera, gl, mode]);

  useFrame((_, rawDt) => {
    if (!active) return;
    const dt = Math.min(rawDt, 0.05);
    const st = useStore.getState();
    const p = runtime.player;
    const third = st.thirdPerson && mode !== 'balcony';
    const canMove = mode !== 'balcony' && !st.lift;

    // Lift arrival on another floor: face out of the lift.
    if (floorKey !== lastFloor.current) {
      lastFloor.current = floorKey;
      camYaw.current = p.yaw;
    }

    let mx = 0;
    let mz = 0;
    let speed = 0;
    const path = runtime.tourAll;
    if (canMove) {
      const fwd = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) + runtime.joy.y;
      const str = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + runtime.joy.x;
      const len = Math.hypot(fwd, str);
      if (len > 0.05) {
        if (path.length) stopTour();
        const n = Math.min(1, len) / len;
        const sy = Math.sin(camYaw.current);
        const cy = Math.cos(camYaw.current);
        mx = (-sy * fwd + cy * str) * n;
        mz = (-cy * fwd - sy * str) * n;
        const run = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 2 : 1;
        speed = (interior ? 1.6 : 2.6) * run * Math.min(1, len);
      } else if (runtime.tourIdx < path.length && !st.tour?.paused) {
        let wp = path[runtime.tourIdx];
        // New leg: route around furniture with A* if the straight line is blocked.
        if (interior && flat && !wp.routed && runtime.tourCap !== runtime.tourIdx) {
          wp.routed = true;
          const g = floorNav(flat.tower, flat.floor, st.furnishing);
          if (!lineClear(g, p.x, p.z, wp.x, wp.z)) {
            const route = findPath(g, p.x, p.z, wp.x, wp.z);
            if (route?.length) {
              const end = route[route.length - 1];
              // Stops inside furniture move to the nearest free spot.
              wp.x = end[0];
              wp.z = end[1];
              const mid = route.slice(0, -1).filter(([x, z]) => Math.hypot(x - p.x, z - p.z) > 0.3);
              if (mid.length) {
                path.splice(runtime.tourIdx, 0, ...mid.map(([x, z]) => ({ x, z, routed: true })));
                wp = path[runtime.tourIdx];
              }
            }
          }
        }
        if (runtime.tourCap === runtime.tourIdx) {
          // Linger until the narration finishes and the minimum pause has passed.
          runtime.tourWait -= dt;
          if (runtime.tourWait <= 0 && !narrator.speaking && !runtime.beatsPlaying) runtime.tourIdx++;
        } else {
          const dx = wp.x - p.x;
          const dz = wp.z - p.z;
          const d = Math.hypot(dx, dz);
          // Pass-through points are cut smoothly; stops are reached precisely.
          if (d < (wp.caption ? 0.25 : 0.55)) {
            if (wp.caption) {
              arriveAt(runtime.tourIdx);
              const voiced = !!wp.say && st.voice.enabled && narrator.available && !!st.tour;
              runtime.tourWait = (wp.pause ?? 1) + (voiced ? 0.3 : readingTime(wp.say ?? wp.caption));
            } else runtime.tourIdx++;
            stuck.current = { t: 0, d: Infinity, r: false };
          } else {
            mx = dx / d;
            mz = dz / d;
            // Ease in to stops; keep walking pace through corners.
            speed = wp.caption ? Math.min(interior ? 1.25 : 2.2, d * 1.6 + 0.25) : interior ? 1.25 : 2.2;
            if (d < stuck.current.d - 0.05) stuck.current = { ...stuck.current, t: 0, d };
            else if ((stuck.current.t += dt) > 1.2) {
              // Blocked: re-plan from here once, then hop over as a last resort.
              if (!stuck.current.r && interior && flat) {
                wp.routed = false;
                stuck.current = { t: 0, d: Infinity, r: true };
              } else {
                p.x = wp.x;
                p.z = wp.z;
                vel.current.x = vel.current.z = 0;
                stuck.current = { t: 0, d: Infinity, r: false };
              }
            }
          }
        }
        if (runtime.tourIdx >= path.length) {
          runtime.tourAll = [];
          runtime.tourIdx = 0;
          if (st.touring) useStore.setState({ touring: false, tour: null, caption: null });
        }
      }
    }

    // Accelerate / decelerate smoothly instead of snapping to the new direction.
    const v0 = vel.current;
    const k = Math.min(1, dt * (speed > 0 ? 5.5 : 9));
    v0.x += (mx * speed - v0.x) * k;
    v0.z += (mz * speed - v0.z) * k;
    const vs = Math.hypot(v0.x, v0.z);
    p.speed = vs;
    if (vs > 0.02) {
      let x = p.x + v0.x * dt;
      let z = p.z + v0.z * dt;
      [x, z] = resolveCircle(x, z, 0.28, interior || !path.length ? withFurn : walls);
      if (mode === 'walk') {
        const gate = Math.abs(x - GATE_X) < 6;
        x = THREE.MathUtils.clamp(x, SITE.minX + 1.5, SITE.maxX - 1.5);
        z = THREE.MathUtils.clamp(z, SITE.minZ + 1.5, gate ? SITE.maxZ + 14 : SITE.maxZ - 1.5);
      }
      // Sliding along a wall loses the blocked part of the velocity.
      if (dt > 0) {
        v0.x = THREE.MathUtils.lerp(v0.x, (x - p.x) / dt, 0.5);
        v0.z = THREE.MathUtils.lerp(v0.z, (z - p.z) / dt, 0.5);
      }
      p.x = x;
      p.z = z;
      if (vs > 0.15) {
        const targetYaw = Math.atan2(-v0.x, -v0.z);
        let dy = targetYaw - p.yaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        // Limited turn rate: people turn their body, they don't spin.
        const maxTurn = 7 * dt;
        p.yaw += THREE.MathUtils.clamp(dy * Math.min(1, dt * 9), -maxTurn, maxTurn);
      }
      bob.current += dt * vs * 1.6;
      if (path.length) {
        let dc = p.yaw - camYaw.current;
        dc = Math.atan2(Math.sin(dc), Math.cos(dc));
        camYaw.current += dc * Math.min(1, dt * 2.2);
      }
    }
    p.y = interior ? baseY : mode === 'walk' ? siteGround(p.x, p.z) : 0;

    // Which home / corridor zone the walker is in.
    if (interior && flat) {
      const here = flatAt(flat.tower, flat.floor, p.x, p.z);
      if (here) {
        if (here.id !== st.selectedId) useStore.setState({ selectedId: here.id });
        const xf = flatXform(here);
        const pp = worldToPlan(xf, p.x, p.z);
        runtime.plan.x = pp.x;
        runtime.plan.y = pp.y;
        runtime.plan.heading = p.yaw - xf.rot;
        runtime.plan.valid = true;
        const ri = roomAt(xf.layout, pp);
        const name = ri >= 0 ? xf.layout.rooms[ri].name : null;
        if (name && name !== st.currentRoom) useStore.setState({ currentRoom: name });
      } else {
        runtime.plan.valid = false;
        const zone = corridorArea(flat.tower, p.x, p.z);
        if (zone !== st.currentRoom) useStore.setState({ currentRoom: zone });
      }
      const [lx] = worldToTowerLocal(TOWER_BY_ID.get(flat.tower)!, p.x, p.z);
      const near = lx < LIFT_X1 + 3.2;
      if (near !== st.nearLift) useStore.setState({ nearLift: near });
    }

    // Camera
    if ((runtime.directing && performance.now() - runtime.userCam > 5000) || runtime.camOverride) return;
    if (runtime.dirYaw != null) {
      camYaw.current = runtime.dirYaw;
      pitch.current = third ? -0.12 : 0;
      runtime.dirYaw = null;
    }
    if (mode === 'balcony') {
      camera.rotation.set(pitch.current, camYaw.current, 0, 'YXZ');
      return;
    }
    const eye = interior ? baseY + 1.6 : p.y + 1.7;
    if (!third) {
      camera.position.set(p.x, eye + Math.sin(bob.current) * 0.025, p.z);
      camera.rotation.set(pitch.current, camYaw.current, 0, 'YXZ');
      if (speed === 0 && !path.length) p.yaw = camYaw.current;
      return;
    }
    const pit = THREE.MathUtils.clamp(pitch.current, -0.7, 0.45);
    v.head.set(p.x, (interior ? baseY : p.y) + 1.55, p.z);
    v.f.set(-Math.sin(camYaw.current) * Math.cos(pit), Math.sin(pit), -Math.cos(camYaw.current) * Math.cos(pit));
    const want = interior ? 2.1 : 4.4;
    let D = want;
    for (let t = 0.35; t <= want; t += 0.1) {
      if (pointBlocked(v.head.x - v.f.x * t, v.head.z - v.f.z * t, walls)) {
        D = Math.max(0.35, t - 0.2);
        break;
      }
    }
    const right = interior ? 0.25 : 0.45;
    // Spring arm: pull in fast when a wall gets in the way, ease back out slowly.
    armD.current += (D - armD.current) * Math.min(1, dt * (D < armD.current ? 18 : 2.5));
    const A = armD.current;
    const tx = v.head.x - v.f.x * A + Math.cos(camYaw.current) * right;
    const ty = v.head.y - v.f.y * A + (interior ? 0.15 : 0.35);
    const tz = v.head.z - v.f.z * A - Math.sin(camYaw.current) * right;
    if (!camInit.current || camPos.current.distanceTo(camera.position) > 0.01 || Math.hypot(camPos.current.x - tx, camPos.current.z - tz) > 4) {
      // First frame, or something else moved the camera (director, flights): start from there.
      camPos.current.copy(camera.position);
      camInit.current = true;
    }
    camPos.current.x += (tx - camPos.current.x) * Math.min(1, dt * 14);
    camPos.current.y += (ty - camPos.current.y) * Math.min(1, dt * 14);
    camPos.current.z += (tz - camPos.current.z) * Math.min(1, dt * 14);
    camera.position.copy(camPos.current);
    camera.lookAt(v.head.x + v.f.x * 2, v.head.y + v.f.y * 2, v.head.z + v.f.z * 2);
  });

  return null;
}
