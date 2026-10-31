import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { MAIN_ROAD, SITE } from '../data/site';
import { cityTexture } from './textures';
import { NIGHT } from './facadeMaterial';

const COLORS = ['#e3ddd3', '#d2d6db', '#ece5da', '#c4cbd3', '#dccfbf', '#cfc7bc', '#b9c4cc'];

function cityMaterial() {
  const m = new THREE.MeshStandardMaterial({ map: cityTexture(), roughness: 0.75, metalness: 0.05 });
  m.onBeforeCompile = (s) => {
    s.uniforms.uNight = NIGHT;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vCUv;\nvarying float vRoof;')
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vec4 cw = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
        vec3 wn = normalize(mat3(instanceMatrix) * objectNormal);
        vCUv = vec2((abs(wn.x) > 0.5 ? cw.z : cw.x) / 4.0, cw.y / 3.2);
        vRoof = step(0.5, wn.y);`,
      );
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight;\nvarying vec2 vCUv;\nvarying float vRoof;')
      .replace(
        '#include <map_fragment>',
        `vec4 texelColor = texture2D(map, vCUv / 8.0 * vec2(1.0, 1.0));
        texelColor = mix(texelColor, vec4(0.75, 0.75, 0.74, 1.0), vRoof);
        diffuseColor *= texelColor;`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          vec2 cell = floor(vCUv);
          float h = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
          vec2 f = fract(vCUv);
          float win = step(0.2, f.x) * step(f.x, 0.8) * step(0.25, f.y) * step(f.y, 0.8) * (1.0 - vRoof);
          totalEmissiveRadiance += vec3(1.0, 0.82, 0.55) * step(h, 0.35) * win * uNight * 1.2;
        }`,
      );
  };
  m.customProgramCacheKey = () => 'city-facade';
  return m;
}

const CAR_COLORS = ['#d9dde1', '#1f2329', '#a12a2a', '#2a4f8c', '#f2f2f2', '#6b7078', '#c58b2b', '#2e7d4f'];

function Traffic() {
  const body = useRef<THREE.InstancedMesh>(null);
  const cabin = useRef<THREE.InstancedMesh>(null);
  const lights = useRef<THREE.InstancedMesh>(null);
  const cars = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        lane: i % 2 ? 1 : -1,
        x: -600 + ((i * 97) % 1200),
        v: 9 + ((i * 13) % 7),
        c: CAR_COLORS[i % CAR_COLORS.length],
        bus: i % 7 === 3,
      })),
    [],
  );
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const tmp = useMemo(() => ({ p: new THREE.Vector3(), s: new THREE.Vector3() }), []);

  useLayoutEffect(() => {
    const c = new THREE.Color();
    cars.forEach((car, i) => body.current!.setColorAt(i, c.set(car.bus ? '#e8b923' : car.c)));
    body.current!.instanceColor!.needsUpdate = true;
  }, [cars]);

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05);
    cars.forEach((car, i) => {
      car.x += car.v * d * car.lane;
      if (car.x > 620) car.x = -620;
      if (car.x < -620) car.x = 620;
      const z = MAIN_ROAD.z + car.lane * 2.8;
      const L = car.bus ? 10 : 4.3;
      const H = car.bus ? 2.8 : 0.85;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), car.lane > 0 ? Math.PI / 2 : -Math.PI / 2);
      m.compose(tmp.p.set(car.x, H / 2 + 0.3, z), q, tmp.s.set(car.bus ? 2.5 : 1.8, H, L));
      body.current!.setMatrixAt(i, m);
      m.compose(tmp.p.set(car.x, car.bus ? 0 : 1.15, z), q, tmp.s.set(car.bus ? 0 : 1.6, 0.55, car.bus ? 0 : 2.3));
      cabin.current!.setMatrixAt(i, m);
      m.compose(tmp.p.set(car.x + car.lane * (L / 2 + 0.02), 0.75, z), q, tmp.s.set(1.5, 0.15, 0.05));
      lights.current!.setMatrixAt(i, m);
    });
    body.current!.instanceMatrix.needsUpdate = true;
    cabin.current!.instanceMatrix.needsUpdate = true;
    lights.current!.instanceMatrix.needsUpdate = true;
    (lights.current!.material as THREE.MeshBasicMaterial).color.setScalar(0.4 + NIGHT.value * 2);
  });

  return (
    <group>
      <instancedMesh ref={body} args={[undefined, undefined, cars.length]} castShadow frustumCulled={false}>
        <boxGeometry />
        <meshStandardMaterial roughness={0.3} metalness={0.6} />
      </instancedMesh>
      <instancedMesh ref={cabin} args={[undefined, undefined, cars.length]} frustumCulled={false}>
        <boxGeometry />
        <meshStandardMaterial color="#1d2733" roughness={0.1} metalness={0.5} />
      </instancedMesh>
      <instancedMesh ref={lights} args={[undefined, undefined, cars.length]} frustumCulled={false}>
        <boxGeometry />
        <meshBasicMaterial color="#fff2c8" toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

export function Cityscape() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const mat = useMemo(cityMaterial, []);
  const blocks = useMemo(() => {
    let s = 99;
    const r = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
    const out: { x: number; z: number; w: number; d: number; h: number; c: string }[] = [];
    let tries = 0;
    while (out.length < 300 && tries++ < 6000) {
      const a = r() * Math.PI * 2;
      const rad = 150 + Math.pow(r(), 0.8) * 430;
      const x = Math.cos(a) * rad;
      const z = Math.sin(a) * rad;
      if (x > SITE.minX - 25 && x < SITE.maxX + 25 && z > SITE.minZ - 25 && z < SITE.maxZ + 25) continue;
      if (Math.abs(z - MAIN_ROAD.z) < 22) continue;
      const w = 14 + r() * 24;
      const d = 14 + r() * 20;
      const near = rad < 260;
      const h = Math.round((near ? 6 + r() * 22 : 12 + r() * 60) / 3.2) * 3.2;
      if (out.some((b) => Math.abs(b.x - x) < (b.w + w) / 2 + 5 && Math.abs(b.z - z) < (b.d + d) / 2 + 5)) continue;
      out.push({ x, z, w, d, h, c: COLORS[Math.floor(r() * COLORS.length)] });
    }
    return out;
  }, []);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const c = new THREE.Color();
    blocks.forEach((b, i) => {
      m.compose(new THREE.Vector3(b.x, b.h / 2, b.z), q, new THREE.Vector3(b.w, b.h, b.d));
      ref.current!.setMatrixAt(i, m);
      ref.current!.setColorAt(i, c.set(b.c));
    });
    ref.current!.instanceMatrix.needsUpdate = true;
    ref.current!.instanceColor!.needsUpdate = true;
    ref.current!.computeBoundingSphere();
  }, [blocks]);

  return (
    <group>
      <instancedMesh ref={ref} args={[undefined, mat, blocks.length]} receiveShadow>
        <boxGeometry />
      </instancedMesh>
      <Traffic />
    </group>
  );
}
