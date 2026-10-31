import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useStore, type Mode } from '../store/useStore';
import { runtime } from '../store/runtime';
import { bearingFromVec } from '../lib/geometry';
import { DEFAULT_POSE } from '../lib/poses';
import { PlayerControls } from './PlayerControls';
import { reducedMotion } from '../store/hooks';

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const ORBIT_MODES: Mode[] = ['orbit', 'plan', 'floors'];

interface Anim {
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  fromT: THREE.Vector3;
  toT: THREE.Vector3;
  fromFov: number;
  toFov: number;
  t: number;
  dur: number;
}

export function CameraRig() {
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const fly = useStore((s) => s.fly);
  const mode = useStore((s) => s.mode);
  const flying = useStore((s) => s.flying);
  const setFlying = useStore((s) => s.setFlying);
  const anim = useRef<Anim | null>(null);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const dir = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const c = controls.current;
    if (c) c.target.set(...DEFAULT_POSE.target);
  }, []);

  useEffect(() => {
    if (!fly) return;
    const c = controls.current;
    camera.getWorldDirection(dir);
    const fromT = c && ORBIT_MODES.includes(useStore.getState().mode) && c.enabled ? c.target.clone() : camera.position.clone().addScaledVector(dir, 20);
    const toPos = new THREE.Vector3(...fly.pose.pos);
    const toT = new THREE.Vector3(...fly.pose.target);
    const dist = camera.position.distanceTo(toPos) + fromT.distanceTo(toT) * 0.5;
    anim.current = {
      fromPos: camera.position.clone(),
      toPos,
      fromT: fromT.distanceTo(camera.position) < 0.01 ? camera.position.clone().addScaledVector(dir, 20) : fromT,
      toT,
      fromFov: camera.fov,
      toFov: fly.pose.fov,
      t: 0,
      dur: reducedMotion() ? 0.05 : THREE.MathUtils.clamp(0.8 + dist / 260, 0.9, 2.2),
    };
    if (c) c.enabled = false;
  }, [fly, camera, dir]);

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const orbit = ORBIT_MODES.includes(mode);
    c.enabled = orbit && !flying;
    const plan = mode === 'plan';
    c.enableRotate = !plan;
    c.screenSpacePanning = true;
    c.mouseButtons = { LEFT: plan ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: plan ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN };
    c.touches = { ONE: plan ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    c.maxDistance = plan ? 1600 : 650;
    c.minDistance = mode === 'floors' ? 12 : 10;
  }, [mode, flying]);

  useFrame((_, dt) => {
    const a = anim.current;
    if (a) {
      a.t = Math.min(1, a.t + Math.min(dt, 0.05) / a.dur);
      const k = ease(a.t);
      camera.position.lerpVectors(a.fromPos, a.toPos, k);
      tmp.lerpVectors(a.fromT, a.toT, k);
      camera.lookAt(tmp);
      const fov = THREE.MathUtils.lerp(a.fromFov, a.toFov, k);
      if (Math.abs(fov - camera.fov) > 1e-3) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
      if (controls.current) controls.current.target.copy(tmp);
      if (a.t >= 1) {
        anim.current = null;
        setFlying(false);
      }
    }
    camera.getWorldDirection(dir);
    runtime.camBearing = bearingFromVec(dir.x, dir.z);

    // Scale the near plane with viewing distance so flat ground layers don't z-fight from far away.
    const m = useStore.getState().mode;
    const near = ORBIT_MODES.includes(m) && controls.current
      ? THREE.MathUtils.clamp(camera.position.distanceTo(controls.current.target) * 0.008, 0.1, 6)
      : 0.1;
    if (Math.abs(near - camera.near) / camera.near > 0.15) {
      camera.near = near;
      camera.updateProjectionMatrix();
    }
  });

  const walkActive = !flying && (mode === 'walk' || mode === 'interior' || mode === 'balcony');

  return (
    <>
      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        maxPolarAngle={Math.PI / 2 - 0.04}
        rotateSpeed={0.6}
        zoomSpeed={0.9}
      />
      <PlayerControls active={walkActive} />
    </>
  );
}
