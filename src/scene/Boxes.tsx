import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

export interface IBox {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  color?: string;
  ry?: number;
  rx?: number;
}

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const m = new THREE.Matrix4();
const q = new THREE.Quaternion();
const p = new THREE.Vector3();
const s = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);
const col = new THREE.Color();
const eul = new THREE.Euler(0, 0, 0, 'YXZ');

/** Static instanced boxes; supports per-instance colours. */
export function Boxes({
  boxes,
  material,
  castShadow = false,
  receiveShadow = false,
  onClick,
}: {
  boxes: IBox[];
  material: THREE.Material;
  castShadow?: boolean;
  receiveShadow?: boolean;
  onClick?: (e: import('@react-three/fiber').ThreeEvent<MouseEvent>) => void;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = boxes.length;
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    boxes.forEach((b, i) => {
      p.set(b.x, b.y, b.z);
      s.set(b.sx, b.sy, b.sz);
      if (b.rx) q.setFromEuler(eul.set(b.rx, b.ry ?? 0, 0));
      else q.setFromAxisAngle(up, b.ry ?? 0);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
      if (b.color) mesh.setColorAt(i, col.set(b.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [boxes]);
  const key = useMemo(() => `${count}-${boxes.some((b) => b.color)}`, [count, boxes]);
  if (!count) return null;
  return (
    <instancedMesh
      key={key}
      ref={ref}
      args={[unitBox, material, count]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      onClick={onClick}
    />
  );
}
