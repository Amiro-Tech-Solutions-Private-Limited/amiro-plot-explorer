import { forwardRef, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { useFrame, type GroupProps } from '@react-three/fiber';
import { currentViseme } from './visemes';
import { hasSit, Human, type ModelId } from './Human';

export type Anim = 'idle' | 'walk' | 'jog' | 'sit' | 'wave' | 'cook' | 'talk' | 'point' | 'present' | 'namaste';

export interface Look {
  skin: string;
  shirt: string;
  pants: string;
  hair: string;
  shoes?: string;
  female?: boolean;
  /** Overall scale; 1 ≈ 1.72 m adult, 0.65 ≈ child. */
  scale?: number;
  beard?: boolean;
  /** Blazer / lanyard look for staff. */
  blazer?: string;
  lips?: string;
  /** Rigged character to use (public/models); falls back to the procedural body. */
  model?: ModelId;
  /** Material-name regex → colour overrides for the rigged character. */
  tints?: Record<string, string>;
}

export interface AnimState {
  anim: Anim;
  /** Ground speed in m/s; drives the stride rate. */
  speed: number;
}

const geo = {
  thigh: new THREE.CapsuleGeometry(0.075, 0.33, 4, 10),
  shin: new THREE.CapsuleGeometry(0.06, 0.32, 4, 10),
  upperArm: new THREE.CapsuleGeometry(0.055, 0.22, 4, 10),
  foreArm: new THREE.CapsuleGeometry(0.045, 0.2, 4, 10),
  torso: new THREE.CapsuleGeometry(0.16, 0.26, 6, 14),
  pelvis: new THREE.CapsuleGeometry(0.14, 0.06, 4, 12),
  head: new THREE.SphereGeometry(0.1, 24, 18),
  jaw: new THREE.SphereGeometry(0.082, 20, 12, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55),
  hair: new THREE.SphereGeometry(0.108, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
  fringe: new THREE.SphereGeometry(0.106, 20, 8, -Math.PI * 0.42, Math.PI * 0.84, Math.PI * 0.18, Math.PI * 0.16),
  longHair: new THREE.CapsuleGeometry(0.085, 0.18, 4, 12),
  bun: new THREE.SphereGeometry(0.045, 12, 10),
  neck: new THREE.CylinderGeometry(0.042, 0.05, 0.1, 12),
  hand: new THREE.SphereGeometry(0.042, 12, 10),
  thumb: new THREE.CapsuleGeometry(0.014, 0.035, 3, 6),
  shoe: new THREE.CapsuleGeometry(0.048, 0.15, 4, 10),
  skirt: new THREE.CylinderGeometry(0.17, 0.26, 0.42, 16, 1, true),
  shoulder: new THREE.SphereGeometry(0.068, 12, 10),
  eyeWhite: new THREE.SphereGeometry(0.016, 12, 10),
  iris: new THREE.CircleGeometry(0.0085, 14),
  pupil: new THREE.CircleGeometry(0.0042, 10),
  lid: new THREE.SphereGeometry(0.0175, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.5),
  brow: new THREE.CapsuleGeometry(0.0045, 0.03, 2, 6),
  nose: new THREE.ConeGeometry(0.014, 0.04, 10),
  ear: new THREE.SphereGeometry(0.022, 10, 8),
  mouth: new THREE.CircleGeometry(0.02, 18),
  lip: new THREE.CapsuleGeometry(0.0065, 0.03, 3, 8),
  teeth: new THREE.BoxGeometry(0.03, 0.007, 0.005),
  collar: new THREE.TorusGeometry(0.06, 0.014, 6, 16, Math.PI * 1.3),
  lapel: new THREE.BoxGeometry(0.05, 0.22, 0.012),
  beard: new THREE.SphereGeometry(0.086, 16, 10, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.4),
  badge: new THREE.BoxGeometry(0.05, 0.065, 0.006),
};
for (const g of [geo.thigh, geo.shin, geo.upperArm, geo.foreArm]) {
  g.computeBoundingBox();
  const h = g.boundingBox!.max.y;
  g.translate(0, -h, 0);
}
geo.nose.rotateX(Math.PI / 2 + 0.35);
geo.lip.rotateZ(Math.PI / 2);
geo.shoe.rotateX(Math.PI / 2);
geo.collar.rotateX(Math.PI / 2);
geo.collar.rotateY(Math.PI * 0.85);

const EYE_WHITE = new THREE.MeshStandardMaterial({ color: '#f4f1ec', roughness: 0.25 });
const PUPIL = new THREE.MeshBasicMaterial({ color: '#0a0806' });
const MOUTH = new THREE.MeshBasicMaterial({ color: '#3a1414' });
const TEETH = new THREE.MeshStandardMaterial({ color: '#f2efe8', roughness: 0.4 });
const BADGE = new THREE.MeshStandardMaterial({ color: '#f7f3e8', roughness: 0.5 });
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const DOWN = new THREE.Vector3(0, -1, 0);

const matCache = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: string, rough = 0.75) {
  const k = `${color}|${rough}`;
  let m = matCache.get(k);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: rough, side: THREE.DoubleSide });
    matCache.set(k, m);
  }
  return m;
}

interface Rig {
  hips: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  lHip: THREE.Group;
  rHip: THREE.Group;
  lKnee: THREE.Group;
  rKnee: THREE.Group;
  lSh: THREE.Group;
  rSh: THREE.Group;
  lEl: THREE.Group;
  rEl: THREE.Group;
  jaw: THREE.Group;
  mouth: THREE.Mesh;
  upperLip: THREE.Mesh;
  lowerLip: THREE.Group;
  lLid: THREE.Mesh;
  rLid: THREE.Mesh;
  lEye: THREE.Group;
  rEye: THREE.Group;
  lBrow: THREE.Mesh;
  rBrow: THREE.Mesh;
}

/** Low-poly procedural human with code-driven animation (no external assets). */
export const ProcPerson = forwardRef<
  THREE.Group,
  {
    look: Look;
    anim?: Anim;
    state?: MutableRefObject<AnimState>;
    phaseOffset?: number;
    /** Lip-sync to the narrator's live speech. */
    talk?: boolean;
    /** World point to look at (and point at for 'point'). */
    target?: MutableRefObject<THREE.Vector3 | null>;
    /** Skip the detailed face for far-away crowds. */
    simple?: boolean;
  } & GroupProps
>(function Person({ look, anim = 'idle', state, phaseOffset = 0, talk = false, target, simple = false, ...props }, ref) {
  const rig = useRef<Partial<Rig>>({});
  const root = useRef<THREE.Group | null>(null);
  const phase = useRef(phaseOffset);
  const blend = useRef(0);
  const blink = useRef({ next: 1.5 + Math.random() * 3, t: 0 });
  const mouthS = useRef({ open: 0, wide: 0 });
  const headAim = useRef({ y: 0, x: 0 });
  const r = (k: keyof Rig) => (o: THREE.Object3D | null) => {
    if (o) (rig.current as Record<string, THREE.Object3D>)[k] = o;
  };
  const m = useMemo(
    () => ({
      skin: mat(look.skin, 0.55),
      shirt: mat(look.shirt),
      pants: mat(look.pants),
      hair: mat(look.hair, 0.85),
      shoes: mat(look.shoes ?? '#2a2a2a', 0.45),
      lips: mat(look.lips ?? new THREE.Color(look.skin).lerp(new THREE.Color('#8a3b3b'), 0.35).getStyle(), 0.5),
      brow: mat(new THREE.Color(look.hair).multiplyScalar(0.8).getStyle(), 0.9),
      iris: new THREE.MeshBasicMaterial({ color: '#3b2516' }),
      blazer: look.blazer ? mat(look.blazer, 0.7) : null,
    }),
    [look],
  );

  useFrame((_, rawDt) => {
    const g = rig.current as Rig;
    if (!g.hips) return;
    const dt = Math.min(rawDt, 0.05);
    const a = state ? state.current.anim : anim;
    const speed = state ? state.current.speed : a === 'walk' ? 1.3 : a === 'jog' ? 3 : 0;
    const moving = a === 'walk' || a === 'jog';
    blend.current += ((moving ? 1 : 0) - blend.current) * Math.min(1, dt * 8);
    const b = blend.current;
    phase.current += dt * (moving ? Math.max(1.2, speed) * 4.2 : 1.6);
    const p = phase.current;
    const jog = a === 'jog' || speed > 3;
    const amp = (jog ? 0.75 : 0.5) * b;

    const s = Math.sin(p);
    const c = Math.cos(p);
    // Legs
    g.lHip.rotation.x = s * amp;
    g.rHip.rotation.x = -s * amp;
    g.lKnee.rotation.x = Math.max(0, -c) * (jog ? 1.2 : 0.7) * b;
    g.rKnee.rotation.x = Math.max(0, c) * (jog ? 1.2 : 0.7) * b;
    // Arms
    g.lSh.rotation.set(-s * amp * 0.8, 0, -0.08);
    g.rSh.rotation.set(s * amp * 0.8, 0, 0.08);
    g.lEl.rotation.x = -(jog ? 1.3 : 0.25) * b - 0.1;
    g.rEl.rotation.x = -(jog ? 1.3 : 0.25) * b - 0.1;
    g.hips.position.y = 0.95 + Math.abs(Math.cos(p)) * 0.035 * b;
    g.hips.rotation.y = s * 0.08 * b;
    g.torso.rotation.set(jog ? 0.12 * b : 0, -s * 0.12 * b, 0);
    g.head.rotation.set(0, 0, 0);

    if (!moving) {
      const breath = Math.sin(p * 0.9) * 0.015;
      g.torso.rotation.x += breath;
      if (a === 'sit') {
        g.hips.position.y = 0.5;
        g.lHip.rotation.x = g.rHip.rotation.x = -Math.PI / 2;
        g.lKnee.rotation.x = g.rKnee.rotation.x = Math.PI / 2;
        g.lSh.rotation.x = g.rSh.rotation.x = -0.35;
        g.lEl.rotation.x = g.rEl.rotation.x = -0.9;
      } else if (a === 'wave') {
        g.rSh.rotation.set(-2.6, 0, 0.35 + Math.sin(p * 4) * 0.25);
        g.rEl.rotation.x = -0.6;
      } else if (a === 'cook') {
        g.lSh.rotation.x = -0.7 + Math.sin(p * 2.5) * 0.08;
        g.rSh.rotation.x = -0.8 - Math.sin(p * 3.1) * 0.12;
        g.lEl.rotation.x = g.rEl.rotation.x = -1.0;
        g.torso.rotation.x += 0.08;
        g.head.rotation.x = 0.35;
      } else if (a === 'talk') {
        g.rSh.rotation.set(-0.5 + Math.sin(p * 1.7) * 0.2, 0, 0.2);
        g.rEl.rotation.x = -1.1 + Math.sin(p * 2.3) * 0.2;
        g.head.rotation.y = Math.sin(p * 0.7) * 0.25;
      } else if (a === 'present') {
        // Open-palm "here it is" gesture with both hands.
        g.lSh.rotation.set(-0.55, 0, -0.55 + Math.sin(p * 1.3) * 0.05);
        g.rSh.rotation.set(-0.55, 0, 0.55 - Math.sin(p * 1.3) * 0.05);
        g.lEl.rotation.x = g.rEl.rotation.x = -0.7;
      } else if (a === 'namaste') {
        g.lSh.rotation.set(-0.45, 0, 0.55);
        g.rSh.rotation.set(-0.45, 0, -0.55);
        g.lEl.rotation.set(-1.9, 0, 0);
        g.rEl.rotation.set(-1.9, 0, 0);
        g.torso.rotation.x += 0.12;
        g.head.rotation.x = 0.25;
      }
    }

    // Look at / point at a world target.
    const tgt = target?.current;
    const rt = root.current;
    let wantY = 0;
    let wantX = 0;
    if (tgt && rt && !moving) {
      rt.updateWorldMatrix(true, false);
      _v.copy(tgt);
      rt.worldToLocal(_v);
      const sc = look.scale ?? (look.female ? 0.94 : 1);
      _v.divideScalar(sc);
      const hy = 1.73;
      wantY = THREE.MathUtils.clamp(Math.atan2(_v.x, _v.z), -1.1, 1.1);
      wantX = THREE.MathUtils.clamp(-Math.atan2(_v.y - hy, Math.hypot(_v.x, _v.z)), -0.5, 0.5);
      if (a === 'point') {
        // Aim the right arm at the target (shoulder at ~1.45 m).
        _v.set(_v.x + 0.215, _v.y - 1.45, _v.z).normalize();
        _q.setFromUnitVectors(DOWN, _v);
        g.rSh.quaternion.copy(_q);
        g.rEl.rotation.set(-0.08, 0, 0);
        g.torso.rotation.y = wantY * 0.25;
        wantY *= 0.75;
      }
    }
    headAim.current.y += (wantY - headAim.current.y) * Math.min(1, dt * 5);
    headAim.current.x += (wantX - headAim.current.x) * Math.min(1, dt * 5);
    if (tgt) {
      g.head.rotation.y = headAim.current.y;
      g.head.rotation.x = headAim.current.x;
    }

    if (simple || !g.jaw) return;
    // Blink every few seconds.
    const bl = blink.current;
    bl.t += dt;
    let lid = 0.1;
    if (bl.t > bl.next) {
      const k = (bl.t - bl.next) / 0.14;
      lid = k < 1 ? 0.1 + Math.sin(k * Math.PI) * 0.9 : 0.1;
      if (k >= 1) {
        bl.t = 0;
        bl.next = 2 + Math.random() * 3.5;
      }
    }
    g.lLid.rotation.x = g.rLid.rotation.x = -0.6 + lid * 2.17;
    // Eyes follow the target a little more than the head does.
    const ey = THREE.MathUtils.clamp((wantY - headAim.current.y) * 0.6, -0.35, 0.35);
    g.lEye.rotation.y = g.rEye.rotation.y = ey;

    // Lip-sync.
    const speaking = talk && a !== 'walk' && a !== 'jog';
    const vis = speaking ? currentViseme() : { open: 0, wide: 0 };
    const ms = mouthS.current;
    ms.open += (vis.open - ms.open) * Math.min(1, dt * 22);
    ms.wide += (vis.wide - ms.wide) * Math.min(1, dt * 18);
    g.jaw.rotation.x = ms.open * 0.16;
    g.mouth.scale.set(0.75 + ms.wide * 0.3, 0.12 + ms.open * 0.9, 1);
    g.upperLip.scale.set(1 + ms.wide * 0.25, 1, 1);
    g.lowerLip.position.y = -0.052 - ms.open * 0.016;
    g.lowerLip.scale.set(1 + ms.wide * 0.25, 1, 1);
    const browUp = speaking ? Math.max(0, Math.sin(p * 1.9)) * 0.004 : 0;
    g.lBrow.position.y = g.rBrow.position.y = 0.04 + browUp;
  });

  const female = !!look.female;
  const top = m.blazer ?? m.shirt;
  const setRoot = (o: THREE.Group | null) => {
    root.current = o;
    if (typeof ref === 'function') ref(o);
    else if (ref) ref.current = o;
  };
  return (
    <group ref={setRoot} {...props}>
      <group scale={look.scale ?? (female ? 0.94 : 1)}>
        <group ref={r('hips')} position={[0, 0.95, 0]}>
          <mesh geometry={geo.pelvis} material={m.pants} scale={[1.05, 1, 0.75]} rotation-z={Math.PI / 2} castShadow />
          {female && <mesh geometry={geo.skirt} material={m.pants} position={[0, -0.18, 0]} castShadow />}
          {[-1, 1].map((side) => (
            <group key={side} ref={r(side < 0 ? 'lHip' : 'rHip')} position={[side * 0.095, -0.02, 0]}>
              <mesh geometry={geo.thigh} material={m.pants} castShadow />
              <group ref={r(side < 0 ? 'lKnee' : 'rKnee')} position={[0, -0.46, 0]}>
                <mesh geometry={geo.shin} material={female ? m.skin : m.pants} castShadow />
                <mesh geometry={geo.shoe} material={m.shoes} position={[0, -0.44, 0.05]} scale={[1, 1, 0.75]} castShadow />
              </group>
            </group>
          ))}
          <group ref={r('torso')} position={[0, 0.06, 0]}>
            <mesh geometry={geo.torso} material={top} position={[0, 0.27, 0]} scale={[1.05, 1, 0.66]} castShadow />
            {m.blazer && (
              <>
                <mesh geometry={geo.lapel} material={m.shirt} position={[0, 0.42, 0.1]} scale={[0.9, 0.7, 1]} />
                {[-1, 1].map((s) => (
                  <mesh key={s} geometry={geo.lapel} material={m.blazer!} position={[s * 0.045, 0.4, 0.108]} rotation-z={s * 0.32} />
                ))}
                <mesh geometry={geo.badge} material={BADGE} position={[0.085, 0.36, 0.112]} />
              </>
            )}
            {!simple && <mesh geometry={geo.collar} material={m.shirt} position={[0, 0.57, 0.005]} />}
            <mesh geometry={geo.neck} material={m.skin} position={[0, 0.61, 0]} />
            <group ref={r('head')} position={[0, 0.72, 0]}>
              <mesh geometry={geo.head} material={m.skin} scale={[0.92, 1.05, 1]} castShadow />
              <mesh geometry={geo.hair} material={m.hair} position={[0, 0.014, -0.01]} scale={[0.95, 1.02, 1.04]} />
              {!female && !simple && <mesh geometry={geo.fringe} material={m.hair} position={[0, 0.012, 0]} scale={[0.95, 1.05, 1]} />}
              {female && <mesh geometry={geo.longHair} material={m.hair} position={[0, -0.09, -0.065]} scale={[1.25, 1.05, 0.6]} />}
              {female && !simple && <mesh geometry={geo.bun} material={m.hair} position={[0, 0.03, -0.1]} />}
              {!simple && (
                <>
                  <group ref={r('jaw')} position={[0, -0.02, 0]}>
                    <mesh geometry={geo.jaw} material={m.skin} position={[0, 0.005, 0.006]} scale={[0.9, 1, 1]} />
                    {look.beard && <mesh geometry={geo.beard} material={m.hair} position={[0, 0.006, 0.01]} scale={[0.93, 1, 1]} />}
                  </group>
                  {[-1, 1].map((s) => (
                    <group key={s}>
                      <group ref={r(s < 0 ? 'lEye' : 'rEye')} position={[s * 0.034, 0.012, 0.086]}>
                        <mesh geometry={geo.eyeWhite} material={EYE_WHITE} scale={[1, 0.78, 0.75]} />
                        <mesh geometry={geo.iris} material={m.iris} position={[0, 0, 0.0122]} />
                        <mesh geometry={geo.pupil} material={PUPIL} position={[0, 0, 0.0124]} />
                        <mesh ref={r(s < 0 ? 'lLid' : 'rLid')} geometry={geo.lid} material={m.skin} scale={[1.05, 1, 1]} />
                      </group>
                      <mesh ref={r(s < 0 ? 'lBrow' : 'rBrow')} geometry={geo.brow} material={m.brow} position={[s * 0.036, 0.04, 0.092]} rotation-z={Math.PI / 2 - s * 0.12} />
                      <mesh geometry={geo.ear} material={m.skin} position={[s * 0.09, 0.002, 0]} scale={[0.4, 1, 0.7]} />
                    </group>
                  ))}
                  <mesh geometry={geo.nose} material={m.skin} position={[0, -0.01, 0.1]} />
                  <mesh ref={r('mouth')} geometry={geo.mouth} material={MOUTH} position={[0, -0.046, 0.0915]} />
                  <mesh geometry={geo.teeth} material={TEETH} position={[0, -0.041, 0.0918]} />
                  <mesh ref={r('upperLip')} geometry={geo.lip} material={m.lips} position={[0, -0.039, 0.093]} />
                  <group ref={r('lowerLip')} position={[0, -0.052, 0.092]}>
                    <mesh geometry={geo.lip} material={m.lips} scale={[0.9, 1.15, 1]} />
                  </group>
                </>
              )}
            </group>
            {[-1, 1].map((side) => (
              <group key={side} ref={r(side < 0 ? 'lSh' : 'rSh')} position={[side * 0.215, 0.5, 0]}>
                <mesh geometry={geo.shoulder} material={top} position={[0, -0.01, 0]} scale={[1, 0.85, 0.9]} castShadow />
                <mesh geometry={geo.upperArm} material={top} castShadow />
                <group ref={r(side < 0 ? 'lEl' : 'rEl')} position={[0, -0.32, 0]}>
                  <mesh geometry={geo.foreArm} material={m.blazer ? top : m.skin} castShadow />
                  <mesh geometry={geo.hand} material={m.skin} position={[0, -0.3, 0.005]} scale={[0.75, 1.2, 0.5]} />
                  {!simple && <mesh geometry={geo.thumb} material={m.skin} position={[-side * 0.028, -0.28, 0.018]} rotation-z={side * 0.5} />}
                </group>
              </group>
            ))}
          </group>
        </group>
      </group>
    </group>
  );
});

export const LOOKS: Record<string, Look> = {
  avatarM: { skin: '#b9825c', shirt: '#2d6cdf', pants: '#2b3441', hair: '#1c1410', shoes: '#f2f2f2', model: 'casual', tints: { lightblue: '#2d6cdf' } },
  avatarF: { skin: '#c99272', shirt: '#d9475f', pants: '#3a3f6b', hair: '#2a1a12', female: true, shoes: '#f2f2f2', model: 'woman1', tints: { '^white$': '#d9475f', orange: '#3a3f6b' } },
  host: { skin: '#b97d55', shirt: '#f3f4f6', blazer: '#1e2a44', pants: '#1f2933', hair: '#141010', shoes: '#111', beard: true, model: 'business', tints: { '^suit$': '#1e2a44', '^tie$': '#0f766e' } },
  hostF: { skin: '#c48d68', shirt: '#f4efe6', blazer: '#1e2a44', pants: '#1f2933', hair: '#2b1b14', female: true, shoes: '#111', lips: '#a3454c', model: 'woman3', tints: { limegreen: '#1e2a44', '^red$': '#2b1b14', gold: '#c9a14a' } },
  guard: { skin: '#a8714a', shirt: '#2f3b52', pants: '#2f3b52', hair: '#111', shoes: '#111', model: 'business', tints: { '^suit$': '#3b4a63', '^tie$': '#1f2937', '^white$': '#a9b4c2' } },
  jogger1: { skin: '#b07a52', shirt: '#f2994a', pants: '#222', hair: '#1a1210', model: 'man', tints: { shirt: '#f2994a', pants: '#222222' } },
  jogger2: { skin: '#d0a07c', shirt: '#27ae60', pants: '#34495e', hair: '#3b2a1f', female: true, model: 'woman1', tints: { '^white$': '#27ae60', orange: '#34495e' } },
  jogger3: { skin: '#9c6a45', shirt: '#eb5757', pants: '#222', hair: '#0f0f0f', model: 'man', tints: { shirt: '#eb5757', pants: '#1f2937' } },
  elder: { skin: '#c08e68', shirt: '#f4f1ea', pants: '#e9e2d0', hair: '#d9d9d9', beard: true, model: 'casual', tints: { lightblue: '#f4f1ea', red_dark: '#e9e2d0', '^white$': '#e9e2d0' } },
  kid1: { skin: '#c9966f', shirt: '#f2c94c', pants: '#2d9cdb', hair: '#1d1410', scale: 0.62, model: 'man', tints: { shirt: '#f2c94c', pants: '#2d9cdb' } },
  kid2: { skin: '#c18a64', shirt: '#bb6bd9', pants: '#eb5757', hair: '#21160f', scale: 0.58, female: true, model: 'woman1', tints: { '^white$': '#bb6bd9', orange: '#eb5757' } },
  mom: { skin: '#c99470', shirt: '#9b51e0', pants: '#5b3c88', hair: '#24170f', female: true, model: 'woman3', tints: { limegreen: '#9b2c5a', '^red$': '#24170f' } },
  dad: { skin: '#b0764f', shirt: '#56ccf2', pants: '#4f4f4f', hair: '#15100c', beard: true, model: 'casual', tints: { lightblue: '#56ccf2' } },
};

type PersonProps = {
  look: Look;
  anim?: Anim;
  state?: MutableRefObject<AnimState>;
  phaseOffset?: number;
  talk?: boolean;
  target?: MutableRefObject<THREE.Vector3 | null>;
  simple?: boolean;
} & GroupProps;

/** A person: rigged character when the look names one, otherwise (and while loading) the procedural body. */
export const Person = forwardRef<THREE.Group, PersonProps>(function Person({ look, anim = 'idle', state, phaseOffset, talk, target, simple, ...props }, ref) {
  const fallback = <ProcPerson look={look} anim={anim} state={state} phaseOffset={phaseOffset} talk={talk} target={target} simple={simple} />;
  if (!look.model) return <ProcPerson ref={ref} look={look} anim={anim} state={state} phaseOffset={phaseOffset} talk={talk} target={target} simple={simple} {...props} />;
  const model: ModelId = anim === 'sit' && !hasSit(look.model) ? (look.female ? 'woman2' : 'man') : look.model;
  return <Human ref={ref} model={model} look={look} anim={anim} state={state} talk={talk} target={target} phaseOffset={phaseOffset} fallback={fallback} {...props} />;
});
