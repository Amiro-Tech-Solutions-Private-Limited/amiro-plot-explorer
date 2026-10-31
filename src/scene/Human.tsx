import { Component, Suspense, forwardRef, useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject, type ReactNode } from 'react';
import * as THREE from 'three';
import { useFrame, type GroupProps } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { currentViseme } from './visemes';
import type { Anim, AnimState, Look } from './Person';

/** CC0 characters by Quaternius (see public/models/LICENSES.md). */
export type ModelId = 'business' | 'woman1' | 'woman2' | 'woman3' | 'casual' | 'man';
export const MODEL_URL = (m: ModelId) => `${import.meta.env.BASE_URL}models/${m}.glb`;

const CLIPS: Record<Anim, RegExp[]> = {
  idle: [/\|Idle$/, /^Idle$/, /Man_Idle$/, /Man_Standing$/],
  walk: [/\|Walk$/, /^Walking$/, /Man_Walk$/],
  jog: [/\|Run$/, /^Running$/, /Man_Run$/],
  wave: [/\|Wave$/, /Man_Clapping$/],
  sit: [/^SitIdle$/, /Man_Sitting$/, /^Sitting$/],
  cook: [/\|Interact$/, /^PickUp$/],
  talk: [/\|Idle_Neutral$/, /\|Idle$/, /^Idle$/, /Man_Idle$/],
  point: [/\|Idle_Gun_Pointing$/, /\|Interact$/],
  present: [/\|Interact$/, /\|Idle_Neutral$/],
  namaste: [/\|Wave$/, /\|Idle$/],
};
/** Ground speed (m/s) at which the walk / run clips play at 1× without foot sliding. */
const NATIVE = { walk: 1.25, jog: 3.4 };

export const hasSit = (m: ModelId) => m === 'woman2' || m === 'man';

interface Prep {
  scale: number;
  lift: number;
  clips: Partial<Record<Anim, THREE.AnimationClip>>;
  mouth: THREE.Vector3 | null;
}
const prepCache = new Map<string, Prep>();

function findClip(list: THREE.AnimationClip[], a: Anim) {
  for (const re of CLIPS[a]) {
    const c = list.find((x) => re.test(x.name));
    if (c) return c;
  }
  return undefined;
}

/** Height-normalise once per model using the posed (skinned) bounds of the idle clip. */
function prepare(id: ModelId, scene: THREE.Object3D, anims: THREE.AnimationClip[]): Prep {
  const hit = prepCache.get(id);
  if (hit) return hit;
  const clips: Prep['clips'] = {};
  (Object.keys(CLIPS) as Anim[]).forEach((a) => (clips[a] = findClip(anims, a)));
  const probe = cloneSkinned(scene);
  const mixer = new THREE.AnimationMixer(probe);
  if (clips.idle) mixer.clipAction(clips.idle).play();
  mixer.update(0);
  probe.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(probe, true);
  const h = Math.max(0.1, box.max.y - box.min.y);
  // Mouth: a point on the front of the face, a quarter of the head height up from the chin.
  let mouth: THREE.Vector3 | null = null;
  const head = probe.getObjectByName('Head');
  if (head) {
    const hp = new THREE.Vector3();
    head.getWorldPosition(hp);
    const top = box.max.y;
    const chin = hp.y;
    const y = chin + (top - chin) * 0.28;
    let zMax = -Infinity;
    const v = new THREE.Vector3();
    probe.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (!m.isMesh) return;
      const pos = m.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        m.getVertexPosition(i, v);
        v.applyMatrix4(m.matrixWorld);
        if (Math.abs(v.y - y) < h * 0.012 && Math.abs(v.x - hp.x) < h * 0.012 && v.z > zMax) zMax = v.z;
      }
    });
    if (zMax > -Infinity) mouth = head.worldToLocal(new THREE.Vector3(hp.x, y, zMax + h * 0.002));
  }
  mixer.stopAllAction();
  const p = { scale: 1 / h, lift: -box.min.y / h, clips, mouth };
  prepCache.set(id, p);
  return p;
}

const tintCache = new Map<string, THREE.Material>();
function tinted(m: THREE.Material, tints: Record<string, string>) {
  const std = m as THREE.MeshStandardMaterial;
  const key = Object.entries(tints).find(([re]) => new RegExp(re, 'i').test(m.name));
  const out = (() => {
    if (!key) return m;
    const k = `${m.uuid}|${key[1]}`;
    let t = tintCache.get(k);
    if (!t) {
      t = std.clone();
      (t as THREE.MeshStandardMaterial).color.set(key[1]);
      tintCache.set(k, t);
    }
    return t;
  })();
  // Flat-shaded low-poly characters read better slightly matte.
  if ((out as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
    (out as THREE.MeshStandardMaterial).roughness = Math.max(0.6, (out as THREE.MeshStandardMaterial).roughness);
    (out as THREE.MeshStandardMaterial).metalness = 0;
  }
  return out;
}

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _pq = new THREE.Quaternion();
const _y = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);
const MOUTH_MAT = new THREE.MeshBasicMaterial({ color: '#2a0f0f' });
const MOUTH_GEO = new THREE.CircleGeometry(0.5, 20);

interface Props {
  model: ModelId;
  look: Look;
  anim: Anim;
  state?: MutableRefObject<AnimState>;
  talk?: boolean;
  target?: MutableRefObject<THREE.Vector3 | null>;
  phaseOffset?: number;
}

function GlbHuman({ model, look, anim, state, talk, target, phaseOffset = 0, outer }: Props & { outer: MutableRefObject<THREE.Group | null> }) {
  const gltf = useGLTF(MODEL_URL(model));
  const prep = useMemo(() => prepare(model, gltf.scene, gltf.animations), [model, gltf]);
  const tints = useMemo(() => {
    // woman2 is texture-mapped; colour multipliers would tint the whole atlas.
    if (model === 'woman2') return {};
    const t: Record<string, string> = { '^skin': look.skin };
    if (look.hair) t['^hair|eyebrows'] = look.hair;
    Object.assign(t, look.tints ?? {});
    return t;
  }, [look, model]);
  const obj = useMemo(() => {
    const o = cloneSkinned(gltf.scene);
    o.traverse((c) => {
      const m = c as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      // Skinned bounds don't follow the animation; avoid popping out near the camera.
      m.frustumCulled = false;
      m.material = Array.isArray(m.material) ? m.material.map((x) => tinted(x, tints)) : tinted(m.material, tints);
    });
    return o;
  }, [gltf, tints]);
  const mixer = useMemo(() => new THREE.AnimationMixer(obj), [obj]);
  const head = useMemo(() => obj.getObjectByName('Head') ?? null, [obj]);
  const mouth = useRef<THREE.Mesh>(null);
  const cur = useRef<{ a: Anim | null; act: THREE.AnimationAction | null }>({ a: null, act: null });
  const aim = useRef({ yaw: 0, pitch: 0 });

  useLayoutEffect(() => {
    if (!head || !prep.mouth || !talk) return;
    const m = new THREE.Mesh(MOUTH_GEO, MOUTH_MAT);
    m.position.copy(prep.mouth);
    head.updateWorldMatrix(true, false);
    head.getWorldScale(_v);
    m.scale.set(0.028 / prep.scale / _v.x, 0.004 / prep.scale / _v.y, 1);
    head.add(m);
    (mouth as MutableRefObject<THREE.Mesh | null>).current = m;
    return () => {
      head.remove(m);
    };
  }, [head, prep, talk]);

  useEffect(() => () => void mixer.stopAllAction(), [mixer]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    let a = state ? state.current.anim : anim;
    if (!prep.clips[a]) a = a === 'jog' && prep.clips.walk ? 'walk' : 'idle';
    const clip = prep.clips[a];
    if (a !== cur.current.a && clip) {
      const next = mixer.clipAction(clip);
      next.reset();
      next.time = (phaseOffset * 0.37) % clip.duration;
      next.setEffectiveWeight(1);
      next.play();
      if (cur.current.act) next.crossFadeFrom(cur.current.act, cur.current.a === null ? 0 : 0.3, true);
      cur.current = { a, act: next };
    }
    const speed = state ? state.current.speed : a === 'walk' ? NATIVE.walk : a === 'jog' ? NATIVE.jog : 0;
    if (cur.current.act) {
      // Stride rate follows ground speed so feet don't slide.
      cur.current.act.timeScale = a === 'walk' ? THREE.MathUtils.clamp(speed / NATIVE.walk, 0.55, 1.7) : a === 'jog' ? THREE.MathUtils.clamp(speed / NATIVE.jog, 0.6, 1.5) : 1;
    }
    mixer.update(dt);

    // Head look-at layered on top of the animation.
    const root = outer.current;
    const tgt = target?.current;
    let wy = 0;
    let wp = 0;
    if (root && tgt && a !== 'walk' && a !== 'jog') {
      root.updateWorldMatrix(true, false);
      _v.copy(tgt);
      root.worldToLocal(_v);
      const sc = look.scale ?? 1;
      _v.divideScalar(sc);
      wy = THREE.MathUtils.clamp(Math.atan2(_v.x, _v.z), -1.0, 1.0);
      wp = THREE.MathUtils.clamp(Math.atan2(_v.y - 1.55, Math.hypot(_v.x, _v.z)), -0.45, 0.35);
    }
    const k = Math.min(1, dt * 5);
    aim.current.yaw += (wy - aim.current.yaw) * k;
    aim.current.pitch += (wp - aim.current.pitch) * k;
    if (head && head.parent && (Math.abs(aim.current.yaw) > 0.002 || Math.abs(aim.current.pitch) > 0.002)) {
      head.parent.getWorldQuaternion(_pq);
      root?.getWorldQuaternion(_q);
      // Yaw about the character's up axis, pitch about its right axis, expressed in the bone's parent frame.
      _y.setFromAxisAngle(UP, aim.current.yaw);
      const right = _v.set(1, 0, 0).applyQuaternion(_y);
      const pitchQ = new THREE.Quaternion().setFromAxisAngle(right, -aim.current.pitch);
      const world = _q.clone().multiply(pitchQ.multiply(_y)).multiply(_q.clone().invert());
      const local = _pq.clone().invert().multiply(world).multiply(_pq);
      head.quaternion.premultiply(local);
    }

    if (mouth.current) {
      const vis = talk && a !== 'walk' && a !== 'jog' ? currentViseme() : { open: 0, wide: 0 };
      const ud = mouth.current.userData as { o?: number; w?: number };
      ud.o = (ud.o ?? 0) + (vis.open - (ud.o ?? 0)) * Math.min(1, dt * 22);
      ud.w = (ud.w ?? 0) + (vis.wide - (ud.w ?? 0)) * Math.min(1, dt * 18);
      head?.getWorldScale(_v);
      mouth.current.scale.set(((0.026 + ud.w * 0.006) / prep.scale) / _v.x, ((0.004 + ud.o * 0.024) / prep.scale) / _v.y, 1);
      mouth.current.visible = ud.o > 0.03;
    }
  });

  const s = prep.scale * 1.72 * (look.scale ?? (look.female ? 0.95 : 1));
  return <primitive object={obj} scale={s} position-y={prep.lift * s} />;
}

class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** A rigged, animated human (bundled GLB) with the procedural person as loading/error fallback. */
export const Human = forwardRef<THREE.Group, Props & { fallback: ReactNode } & GroupProps>(function Human(
  { model, look, anim, state, talk, target, phaseOffset, fallback, ...props },
  ref,
) {
  const outer = useRef<THREE.Group | null>(null);
  const setRef = (o: THREE.Group | null) => {
    outer.current = o;
    if (typeof ref === 'function') ref(o);
    else if (ref) ref.current = o;
  };
  return (
    <group ref={setRef} {...props}>
      <Boundary fallback={fallback}>
        <Suspense fallback={fallback}>
          <GlbHuman model={model} look={look} anim={anim} state={state} talk={talk} target={target} phaseOffset={phaseOffset} outer={outer} />
        </Suspense>
      </Boundary>
    </group>
  );
});

(['business', 'woman1', 'woman3', 'casual'] as ModelId[]).forEach((m) => useGLTF.preload(MODEL_URL(m)));
