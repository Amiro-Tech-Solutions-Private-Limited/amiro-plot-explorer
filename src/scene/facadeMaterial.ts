import * as THREE from 'three';
import { FACADE_BAYS, WIN } from './textures';

/** Shared uniform: 0 by day, 1 at night. Updated once per frame from the sun. */
export const NIGHT = { value: 0 };

/**
 * Patches a façade material so random windows glow warm at night.
 * Requires a per-instance `aSeed` attribute on the geometry.
 */
export function withLitWindows<T extends THREE.MeshStandardMaterial>(mat: T, bays = FACADE_BAYS, litRatio = 0.42): T {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = NIGHT;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aSeed;\nvarying float vSeed;\nvarying vec2 vFUv;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvSeed = aSeed;\nvFUv = uv;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight;\nvarying float vSeed;\nvarying vec2 vFUv;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          float bx = vFUv.x * ${bays.toFixed(1)};
          float cell = floor(bx);
          float inBay = step(${WIN.u0.toFixed(2)}, fract(bx)) * step(fract(bx), ${WIN.u1.toFixed(2)});
          float inBand = step(${WIN.v0.toFixed(2)}, vFUv.y) * step(vFUv.y, ${WIN.v1.toFixed(2)});
          float h = fract(sin(cell * 12.9898 + vSeed * 78.233) * 43758.5453);
          float lit = step(h, ${litRatio.toFixed(2)}) * inBay * inBand;
          vec3 warm = mix(vec3(1.0, 0.78, 0.48), vec3(0.85, 0.9, 1.0), step(0.85, fract(h * 7.0)));
          totalEmissiveRadiance += warm * lit * uNight * 1.4;
        }`,
      );
  };
  mat.customProgramCacheKey = () => `lit-windows-${bays}-${litRatio}`;
  return mat;
}

export function seedAttribute(count: number, seed = 1) {
  const a = new Float32Array(count);
  let s = seed;
  for (let i = 0; i < count; i++) {
    s = (s * 16807) % 2147483647;
    a[i] = (s % 1000) / 10;
  }
  return new THREE.InstancedBufferAttribute(a, 1);
}
