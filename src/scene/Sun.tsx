import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { Environment, Lightformer, Sky } from '@react-three/drei';
import { useStore } from '../store/useStore';
import { istDate, sunAt } from '../lib/sun';
import { runtime } from '../store/runtime';
import { NIGHT } from './facadeMaterial';
import { FLAT_BY_ID } from '../data/project';
import { flatCenter } from '../lib/poses';

const WARM = new THREE.Color('#ffb070');
const NOON = new THREE.Color('#fff5e6');

export function Sun() {
  const date = useStore((s) => s.sun.date);
  const minutes = useStore((s) => s.sun.minutes);
  const night = useStore((s) => s.mode === 'interior' && s.interiorNight);
  const quality = useStore((s) => s.quality);
  const light = useRef<THREE.DirectionalLight>(null);
  const scene = useThree((s) => s.scene);

  const sun = useMemo(() => sunAt(istDate(date, night ? 20 * 60 + 30 : minutes)), [date, minutes, night]);
  const alt = sun.altitude;
  const day = THREE.MathUtils.clamp((alt + 2) / 12, 0, 1);
  runtime.day = day;
  NIGHT.value = 1 - day;
  const focus = useStore((s) => (s.mode === 'interior' && s.selectedId ? FLAT_BY_ID.get(s.selectedId) : undefined));
  const fc = useMemo(() => (focus ? flatCenter(focus) : null), [focus]);

  const color = useMemo(() => WARM.clone().lerp(NOON, THREE.MathUtils.clamp(alt / 30, 0, 1)), [alt]);
  const intensity = alt > 0 ? 0.6 + 2.6 * THREE.MathUtils.clamp(alt / 35, 0, 1) : 0;

  useEffect(() => {
    const l = light.current;
    if (!l) return;
    scene.add(l.target);
    return () => {
      scene.remove(l.target);
    };
  }, [scene]);

  // Tight shadow frustum around the flat when walking inside, wide for the site.
  useEffect(() => {
    const l = light.current;
    if (!l) return;
    const ext = fc ? 22 : 135;
    l.target.position.set(fc ? fc[0] : 0, fc ? fc[1] : 0, fc ? fc[2] : -10);
    l.target.updateMatrixWorld();
    const cam = l.shadow.camera;
    cam.left = cam.bottom = -ext;
    cam.right = cam.top = ext;
    cam.updateProjectionMatrix();
    l.shadow.bias = fc ? -0.0002 : -0.0003;
  }, [fc]);

  const D = 240;
  const pos: [number, number, number] = fc
    ? [fc[0] + sun.x * 120, fc[1] + Math.max(sun.y, 0.02) * 120, fc[2] + sun.z * 120]
    : [sun.x * D, Math.max(sun.y, 0.02) * D, sun.z * D - 10];
  const mapSize = quality === 'high' ? 4096 : 2048;

  return (
    <>
      <Sky distance={4000} sunPosition={[sun.x, sun.y, sun.z]} turbidity={7} rayleigh={alt < 8 ? 2.2 : 1.1} mieCoefficient={0.004} mieDirectionalG={0.85} />
      <directionalLight
        ref={light}
        position={pos}
        intensity={intensity}
        color={color}
        castShadow
        shadow-mapSize-width={mapSize}
        shadow-mapSize-height={mapSize}
        shadow-camera-left={-135}
        shadow-camera-right={135}
        shadow-camera-top={135}
        shadow-camera-bottom={-135}
        shadow-camera-near={10}
        shadow-camera-far={600}
        shadow-bias={-0.0003}
        shadow-normalBias={0.05}
      />
      <hemisphereLight args={[day < 0.3 ? '#6d7fa8' : '#dbe9ff', fc ? '#d8cfc2' : '#a39d86', 0.05 + 0.65 * day]} />
      <ambientLight intensity={0.03 + 0.12 * day} color={day < 0.3 ? '#7f8fb3' : '#ffffff'} />
      <Environment files={`${import.meta.env.BASE_URL}hdri/sky_1k.hdr`} resolution={256} frames={1} environmentIntensity={0.08 + 0.55 * day}>
        <Lightformer form="rect" intensity={2} position={[0, 30, 0]} rotation-x={Math.PI / 2} scale={[80, 80, 1]} color="#eaf2ff" />
        <Lightformer form="rect" intensity={1.2} position={[60, 10, 0]} rotation-y={-Math.PI / 2} scale={[60, 20, 1]} color="#fff3e0" />
        <Lightformer form="rect" intensity={0.8} position={[-60, 10, 0]} rotation-y={Math.PI / 2} scale={[60, 20, 1]} color="#dfeaff" />
        <Lightformer form="rect" intensity={0.6} position={[0, -20, 0]} rotation-x={-Math.PI / 2} scale={[120, 120, 1]} color="#7d8f68" />
        <Lightformer form="rect" intensity={1.4} position={[0, 6, -70]} scale={[160, 10, 1]} color="#f4f7ff" />
      </Environment>
      <fog attach="fog" args={[day > 0.3 ? '#d6e2ec' : '#1d2433', 300, 1400]} />
    </>
  );
}
