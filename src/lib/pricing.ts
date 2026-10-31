import type { Flat } from '../data/types';
import { PROJECT, unitOf } from '../data/project';

export interface PriceBreakdown {
  sba: number;
  base: number;
  floorRise: number;
  plc: number;
  parking: number;
  club: number;
  agreement: number;
  gst: number;
  stamp: number;
  total: number;
  effectiveRate: number;
}

const cache = new Map<string, PriceBreakdown>();

export function priceOf(flat: Flat): PriceBreakdown {
  const hit = cache.get(flat.id);
  if (hit) return hit;
  const p = PROJECT.pricing;
  const u = unitOf(flat);
  const sba = u.superBuiltUp;
  const base = sba * flat.baseRate;
  const floorRise = sba * p.floorRisePerFloor * Math.max(0, flat.floor - 1);
  const plc = sba * ((flat.corner ? p.cornerPLC : 0) + (flat.view.includes('pool') ? p.poolViewPLC : 0));
  const parking = u.carParks * p.parking;
  const club = p.club;
  const agreement = base + floorRise + plc + parking + club;
  const gst = (agreement * p.gstPct) / 100;
  const stamp = (agreement * p.stampPct) / 100;
  const res = {
    sba,
    base,
    floorRise,
    plc,
    parking,
    club,
    agreement,
    gst,
    stamp,
    total: agreement + gst + stamp,
    effectiveRate: (base + floorRise + plc) / sba,
  };
  cache.set(flat.id, res);
  return res;
}

export function emi(principal: number, annualRatePct: number, years: number) {
  const r = annualRatePct / 12 / 100;
  const n = years * 12;
  if (r === 0) return principal / n;
  const k = Math.pow(1 + r, n);
  return (principal * r * k) / (k - 1);
}

export const PRICE_RANGE = (() => {
  const totals = PROJECT.flats.map((f) => priceOf(f).total);
  return [Math.floor(Math.min(...totals) / 1e5) * 1e5, Math.ceil(Math.max(...totals) / 1e5) * 1e5] as [number, number];
})();

export const AREA_RANGE = (() => {
  const a = PROJECT.unitTypes.map((u) => u.carpet);
  return [Math.min(...a), Math.max(...a)] as [number, number];
})();
