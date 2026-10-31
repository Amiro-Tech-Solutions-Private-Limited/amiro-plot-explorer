import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { POOL } from '../data/site';
import { Boxes, type IBox } from './Boxes';

const waterMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 } },
  transparent: true,
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    varying vec2 vUv;
    void main() {
      vec2 p = vUv * vec2(24.0, 12.0);
      float w = sin(p.x * 1.3 + uTime * 1.1) * sin(p.y * 1.7 - uTime * 0.8)
              + 0.6 * sin((p.x + p.y) * 2.3 + uTime * 1.7)
              + 0.4 * sin((p.x - p.y) * 3.1 - uTime * 1.3);
      float caustic = smoothstep(0.9, 1.6, w);
      vec3 deep = vec3(0.03, 0.45, 0.66);
      vec3 shallow = vec3(0.30, 0.80, 0.90);
      float edge = smoothstep(0.0, 0.08, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)));
      vec3 col = mix(shallow, deep, edge * 0.7 + 0.15 * sin(p.x * 0.25));
      col += caustic * 0.28;
      gl_FragColor = vec4(col, 0.93);
    }`,
});

const deckMat = new THREE.MeshStandardMaterial({ color: '#e6dfd1', roughness: 0.9 });
const rimMat = new THREE.MeshStandardMaterial({ color: '#f7f5f0', roughness: 0.7 });
const loungerMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7 });
const umbMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, side: THREE.DoubleSide });

export function Pool() {
  useFrame((_, dt) => {
    waterMat.uniforms.uTime.value += dt;
  });
  const loungers = useMemo(() => {
    const out: IBox[] = [];
    for (let i = 0; i < 5; i++) {
      const x = -6 + i * 4;
      out.push({ x, z: POOL.d / 2 + 2.6, y: 0.55, sx: 0.8, sy: 0.15, sz: 2, color: i % 2 ? '#f0f0ee' : '#2e8bc0' });
      out.push({ x, z: -POOL.d / 2 - 2.6, y: 0.55, sx: 0.8, sy: 0.15, sz: 2, color: i % 2 ? '#2e8bc0' : '#f0f0ee' });
    }
    return out;
  }, []);
  return (
    <group position={[POOL.x, 0, POOL.z]}>
      <mesh position={[0, 0.2, 0]} scale={[POOL.deckW, 0.4, POOL.deckD]} receiveShadow castShadow material={deckMat}>
        <boxGeometry />
      </mesh>
      <mesh position={[0, 0.42, 0]} scale={[POOL.w + 0.8, 0.06, POOL.d + 0.8]} material={rimMat} receiveShadow>
        <boxGeometry />
      </mesh>
      <mesh position={[0, 0.46, 0]} rotation-x={-Math.PI / 2} material={waterMat}>
        <planeGeometry args={[POOL.w, POOL.d]} />
      </mesh>
      <Boxes boxes={loungers} material={loungerMat} castShadow />
      {/* Kids' pool */}
      <mesh position={[-POOL.w / 2 - 3.6, 0.42, 0]} scale={[4.8, 0.06, 5.6]} material={rimMat} receiveShadow>
        <boxGeometry />
      </mesh>
      <mesh position={[-POOL.w / 2 - 3.6, 0.46, 0]} rotation-x={-Math.PI / 2} material={waterMat}>
        <planeGeometry args={[4, 4.8]} />
      </mesh>
      {[-6, 2, 10].map((x) => (
        <group key={x} position={[x, 0.4, POOL.d / 2 + 4.6]}>
          <mesh position={[0, 1.2, 0]} material={rimMat}>
            <cylinderGeometry args={[0.04, 0.04, 2.4, 6]} />
          </mesh>
          <mesh position={[0, 2.5, 0]} material={umbMat} castShadow>
            <coneGeometry args={[1.6, 0.6, 8, 1, true]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
