import type { Flat } from '../data/types';
import { towerOf, unitOf } from '../data/project';
import { interiorFor, profileWithTheme } from '../data/interiors';
import type { Furnishing } from '../store/useStore';
import { useStore } from '../store/useStore';
import { applyDesign } from './design';
import { furnish, type Furnished } from './furniture';
import { flatFrame, floorBaseY, frameRotation, localToWorld } from './geometry';
import { buildLayout, type FlatLayout } from './walls';

export interface FlatXform {
  layout: FlatLayout;
  gx: number;
  gz: number;
  rot: number;
  baseY: number;
}

const cache = new Map<string, FlatXform>();

/** World placement of a flat's drawing-plan frame (plan x → local x, plan y → local z). */
export function flatXform(flat: Flat): FlatXform {
  const hit = cache.get(flat.id);
  if (hit) return hit;
  const t = towerOf(flat);
  const fr = flatFrame(flat.index);
  const [gx, gz] = localToWorld(t, fr.ox, fr.oz);
  const x = {
    layout: buildLayout(flat.typeId, unitOf(flat).rooms, fr.mirror, interiorFor(flat).openKitchen),
    gx,
    gz,
    rot: frameRotation(t, fr),
    baseY: floorBaseY(flat.floor),
  };
  cache.set(flat.id, x);
  return x;
}

export function planToWorldXZ(x: FlatXform, px: number, py: number): [number, number] {
  const c = Math.cos(x.rot);
  const s = Math.sin(x.rot);
  return [x.gx + px * c + py * s, x.gz - px * s + py * c];
}

export function worldToPlan(x: FlatXform, wx: number, wz: number) {
  const c = Math.cos(x.rot);
  const s = Math.sin(x.rot);
  const dx = wx - x.gx;
  const dz = wz - x.gz;
  return { x: dx * c - dz * s, y: dx * s + dz * c };
}

export function kidsRoomOf(flat: Flat): string | null {
  if (interiorFor(flat).household !== 'kids') return null;
  const beds = unitOf(flat).rooms.filter((r) => r.kind === 'bed' && !r.level && !r.name.startsWith('Master'));
  return beds.length ? beds[beds.length - 1].name : null;
}

const furnCache = new Map<string, Furnished>();

export type FurnishMode = Exclude<Furnishing, 'auto'>;

/** 'auto' shows a staged sample flat for unsold homes and a lived-in home otherwise. */
export const effectiveFurnishing = (flat: Flat, mode: Furnishing): FurnishMode =>
  mode === 'auto' ? (flat.status === 'available' ? 'sample' : 'lived') : mode;

export function furnishedOf(flat: Flat, mode: Furnishing, themeId?: string): Furnished {
  const m = effectiveFurnishing(flat, mode);
  // Bare shells stay bare; otherwise the visitor's own layout is applied on top.
  const design = m === 'bare' ? undefined : useStore.getState().design[flat.id];
  const key = `${flat.id}|${m}|${themeId ?? ''}|${design?.rev ?? 0}`;
  const hit = furnCache.get(key);
  if (hit) return hit;
  const layout = flatXform(flat).layout;
  const f = applyDesign(furnish(layout, profileWithTheme(flat, themeId), m, kidsRoomOf(flat)), layout, design);
  furnCache.set(key, f);
  return f;
}
