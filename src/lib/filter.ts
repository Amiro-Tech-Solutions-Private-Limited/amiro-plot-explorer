import type { Facing, Flat, TowerId, View } from '../data/types';
import { priceOf, AREA_RANGE, PRICE_RANGE } from './pricing';
import { unitOf } from '../data/project';
import { vastuOf } from './vastu';
import { FLOORS } from './geometry';

export interface Filters {
  towers: TowerId[];
  configs: string[];
  facings: Facing[];
  floor: [number, number];
  area: [number, number];
  budget: [number, number];
  views: View[];
  availableOnly: boolean;
  corner: boolean;
  vastu: boolean;
  high: boolean;
}

export const DEFAULT_FILTERS: Filters = {
  towers: [],
  configs: [],
  facings: [],
  floor: [1, FLOORS],
  area: [...AREA_RANGE],
  budget: [...PRICE_RANGE],
  views: [],
  availableOnly: false,
  corner: false,
  vastu: false,
  high: false,
};

export function matches(f: Flat, q: Filters) {
  if (q.towers.length && !q.towers.includes(f.tower)) return false;
  if (q.configs.length && !q.configs.includes(f.typeId)) return false;
  if (q.facings.length && !q.facings.includes(f.facing)) return false;
  if (f.floor < q.floor[0] || f.floor > q.floor[1]) return false;
  const u = unitOf(f);
  if (u.carpet < q.area[0] || u.carpet > q.area[1]) return false;
  const p = priceOf(f).total;
  if (p < q.budget[0] || p > q.budget[1]) return false;
  if (q.views.length && !q.views.some((v) => f.view.includes(v))) return false;
  if (q.availableOnly && f.status !== 'available') return false;
  if (q.corner && !f.corner) return false;
  if (q.high && f.floor <= 15) return false;
  if (q.vastu && vastuOf(f).stars < 4) return false;
  return true;
}

export function activeFilterCount(q: Filters) {
  let n = q.towers.length + q.configs.length + q.facings.length + q.views.length;
  if (q.floor[0] !== 1 || q.floor[1] !== FLOORS) n++;
  if (q.area[0] !== AREA_RANGE[0] || q.area[1] !== AREA_RANGE[1]) n++;
  if (q.budget[0] !== PRICE_RANGE[0] || q.budget[1] !== PRICE_RANGE[1]) n++;
  n += [q.availableOnly, q.corner, q.vastu, q.high].filter(Boolean).length;
  return n;
}
