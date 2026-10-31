import { useMemo } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import type { Flat, RoomKind } from '../data/types';
import { floorColor, profileWithTheme } from '../data/interiors';
import { flatXform, furnishedOf } from '../lib/interiorFrame';
import { wallBoxes } from '../lib/walls';
import type { Furnishing } from '../store/useStore';
import { useStore } from '../store/useStore';
import { Boxes, type IBox } from './Boxes';
import { Pieces } from './Pieces';
import { floorTexture, surfaceTexture } from './textures';

/** Floor material whose UVs come from the instance's plan position, so tiles stay 1:1 in every room. */
function planarFloor(kind: 'tile' | 'wood' | 'wet', roughness: number) {
  const m = new THREE.MeshStandardMaterial({ map: floorTexture(kind), roughness, metalness: 0.02 });
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vPUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\nvPUv = (instanceMatrix * vec4(position, 1.0)).xz / 1.6;\n#else\nvPUv = position.xz;\n#endif');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vPUv;')
      .replace('#include <map_fragment>', 'diffuseColor *= texture2D(map, vPUv);');
  };
  m.customProgramCacheKey = () => `planar-floor-${kind}`;
  return m;
}

export const MATS = {
  wall: new THREE.MeshStandardMaterial({ color: '#ffffff', bumpMap: surfaceTexture('plaster'), bumpScale: 0.004, roughness: 0.92 }),
  glass: new THREE.MeshStandardMaterial({ color: '#b9dcf0', roughness: 0.03, metalness: 0.2, transparent: true, opacity: 0.22, depthWrite: false }),
  rail: new THREE.MeshStandardMaterial({ color: '#3d434b', roughness: 0.35, metalness: 0.7 }),
  frame: new THREE.MeshStandardMaterial({ color: '#3b4046', roughness: 0.4, metalness: 0.5 }),
  skirt: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 }),
  ceiling: new THREE.MeshStandardMaterial({ color: '#f7f5f0', roughness: 0.95 }),
  tile: planarFloor('tile', 0.32),
  wood: planarFloor('wood', 0.45),
  wet: planarFloor('wet', 0.6),
};

const FLOOR_KIND = (k: RoomKind, themeId: string): 'tile' | 'wood' | 'wet' => {
  if (themeId === 'northpark') return k === 'balcony' ? 'wood' : k === 'toilet' || k === 'utility' || k === 'store' ? 'wet' : 'tile';
  return k === 'bed' || k === 'study' ? 'wood' : k === 'toilet' || k === 'balcony' || k === 'utility' || k === 'store' ? 'wet' : 'tile';
};

/**
 * One furnished home generated from its plan, in drawing-plan coords.
 * Used full-height for the walk-through and half-height for the dollhouse.
 */
export function HomeModel({
  flat,
  wallH,
  furnishing,
  themeId,
  tint,
  detail = true,
  castShadow = false,
  open = false,
  onFloorClick,
}: {
  flat: Flat;
  wallH: number;
  furnishing: Furnishing;
  themeId?: string;
  tint?: string;
  detail?: boolean;
  castShadow?: boolean;
  /** No ceilings or ceiling fittings, for looking in from above. */
  open?: boolean;
  onFloorClick?: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const profile = profileWithTheme(flat, themeId);
  const { layout } = flatXform(flat);
  const t = profile.theme;
  const rev = useStore((s) => s.design[flat.id]?.rev ?? 0);

  const built = useMemo(() => {
    const boxes = wallBoxes(layout.segs, wallH, detail);
    const tintC = tint ? new THREE.Color(tint) : null;
    const floors: Record<'tile' | 'wood' | 'wet', IBox[]> = { tile: [], wood: [], wet: [] };
    for (const r of layout.rooms) {
      const c = new THREE.Color(t.id === 'northpark' && r.kind === 'balcony' ? '#8a6446' : floorColor(t, r.kind));
      if (tintC) c.lerp(tintC, 0.4);
      floors[FLOOR_KIND(r.kind, t.id)].push({ x: r.x + r.w / 2, z: r.y + r.h / 2, y: 0.01, sx: r.w, sz: r.h, sy: 0.02, color: `#${c.getHexString()}` });
    }
    const wallColor = t.walls[profile.seed % t.walls.length];
    const pick = (m: string, color?: string) => boxes.filter((b) => b.mat === m).map((b) => ({ ...b, color }));
    const f = furnishedOf(flat, furnishing, themeId);
    const pieces = detail && !open ? f.pieces : f.pieces.filter((p) => p.y - p.sy / 2 < (open ? 2.3 : wallH - 0.05) && p.y + p.sy / 2 < wallH + 0.6);
    return {
      floors,
      ceilings: detail && !open ? layout.rooms.filter((r) => r.kind !== 'balcony').map((r) => ({ x: r.x + r.w / 2, z: r.y + r.h / 2, y: wallH + 0.005, sx: r.w, sz: r.h, sy: 0.01 })) : [],
      walls: pick('wall', wallColor),
      skirt: pick('skirt', t.wood),
      sill: pick('sill', '#d8d4cc'),
      frame: pick('frame'),
      glass: pick('glass'),
      rail: pick('rail'),
      pieces,
    };
  }, [layout, wallH, detail, tint, t, profile.seed, flat, furnishing, themeId, rev, open]);

  return (
    <group>
      <Boxes boxes={built.floors.tile} material={MATS.tile} receiveShadow onClick={onFloorClick} />
      <Boxes boxes={built.floors.wood} material={MATS.wood} receiveShadow onClick={onFloorClick} />
      <Boxes boxes={built.floors.wet} material={MATS.wet} receiveShadow onClick={onFloorClick} />
      <Boxes boxes={built.walls} material={MATS.wall} castShadow={castShadow} receiveShadow />
      <Boxes boxes={built.ceilings} material={MATS.ceiling} />
      <Boxes boxes={built.skirt} material={MATS.skirt} />
      <Boxes boxes={built.sill} material={MATS.skirt} />
      <Boxes boxes={built.frame} material={MATS.frame} />
      <Boxes boxes={built.rail} material={MATS.rail} />
      <Pieces pieces={built.pieces} shadows={castShadow} />
      <Boxes boxes={built.glass} material={MATS.glass} />
    </group>
  );
}
