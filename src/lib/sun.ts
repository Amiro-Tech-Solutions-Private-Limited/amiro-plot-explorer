import SunCalc from 'suncalc';
import type { Flat } from '../data/types';
import { PROJECT, TOWERS, towerOf } from '../data/project';
import { DEG, dirFromBearing, flatFrame, FLAT_D, FLAT_W, floorBaseY, planToWorld, ROOF_Y, TOWER_HX, TOWER_HZ, BALC_D } from './geometry';

const IST_OFFSET_MIN = 330;

export function todayIST() {
  const d = new Date(Date.now() + IST_OFFSET_MIN * 60000);
  return d.toISOString().slice(0, 10);
}

/** IST wall-clock minutes on a date → Date. */
export function istDate(dateStr: string, minutes: number) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + (minutes - IST_OFFSET_MIN) * 60000);
}

export function toISTMinutes(date: Date) {
  const utcMin = date.getUTCHours() * 60 + date.getUTCMinutes();
  return (utcMin + IST_OFFSET_MIN) % 1440;
}

export function minutesLabel(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export interface SunState {
  /** Unit vector pointing to the sun, world space. */
  x: number;
  y: number;
  z: number;
  altitude: number;
  bearing: number;
}

export function sunAt(date: Date): SunState {
  const p = SunCalc.getPosition(date, PROJECT.lat, PROJECT.lng);
  // suncalc azimuth is measured from south, clockwise towards west.
  const bearing = ((p.azimuth / DEG + 180) % 360 + 360) % 360;
  const [dx, dz] = dirFromBearing(bearing);
  const c = Math.cos(p.altitude);
  return { x: dx * c, y: Math.sin(p.altitude), z: dz * c, altitude: p.altitude / DEG, bearing };
}

export function sunTimes(dateStr: string) {
  const t = SunCalc.getTimes(istDate(dateStr, 12 * 60), PROJECT.lat, PROJECT.lng);
  return { sunrise: toISTMinutes(t.sunrise), sunset: toISTMinutes(t.sunset) };
}

function rayHitsTower(ox: number, oy: number, oz: number, d: SunState, skip: string) {
  for (const t of TOWERS) {
    if (t.id === skip) continue;
    const r = t.rotationY;
    const c = Math.cos(r);
    const s = Math.sin(r);
    const px = ox - t.position[0];
    const pz = oz - t.position[2];
    // world → local (inverse rotation)
    const lx = px * c - pz * s;
    const lz = px * s + pz * c;
    const dlx = d.x * c - d.z * s;
    const dlz = d.x * s + d.z * c;
    let tmin = 0;
    let tmax = 1e4;
    const slab = (o: number, dir: number, lo: number, hi: number) => {
      if (Math.abs(dir) < 1e-9) return o >= lo && o <= hi;
      let t1 = (lo - o) / dir;
      let t2 = (hi - o) / dir;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      return tmin <= tmax;
    };
    if (slab(lx, dlx, -TOWER_HX, TOWER_HX) && slab(lz, dlz, -TOWER_HZ - BALC_D, TOWER_HZ + BALC_D) && slab(oy, d.y, 0, ROOF_Y + 3)) return true;
  }
  return false;
}

export interface SunlightReport {
  hours: number;
  morning: boolean;
  evening: boolean;
  /** 0/1 per sample across the day, for a timeline strip. */
  strip: { min: number; lit: boolean }[];
}

const cache = new Map<string, SunlightReport>();

export function sunlightOf(flat: Flat, dateStr: string): SunlightReport {
  const key = `${flat.id}|${dateStr}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const tower = towerOf(flat);
  const frame = flatFrame(flat.index);
  const [cx, cz] = planToWorld(tower, frame, FLAT_W / 2, FLAT_D / 2);
  const [fx, fz] = dirFromBearing(flat.facingBearing);
  // Outer side façade normal: from tower centre outward along local x.
  const [sx, sz] = (() => {
    const [ex, ez] = planToWorld(tower, frame, frame.mirror ? FLAT_W : 0, FLAT_D / 2);
    const l = Math.hypot(ex - cx, ez - cz);
    return [(ex - cx) / l, (ez - cz) / l];
  })();
  const y = floorBaseY(flat.floor) + 1.5;
  const front = { x: cx + fx * (FLAT_D / 2 + BALC_D + 0.3), z: cz + fz * (FLAT_D / 2 + BALC_D + 0.3) };
  const side = { x: cx + sx * (FLAT_W / 2 + 0.3), z: cz + sz * (FLAT_W / 2 + 0.3) };

  const { sunrise, sunset } = sunTimes(dateStr);
  const step = 15;
  const strip: SunlightReport['strip'] = [];
  let litMin = 0;
  let morning = false;
  let evening = false;
  for (let m = sunrise; m <= sunset; m += step) {
    const s = sunAt(istDate(dateStr, m));
    let lit = false;
    if (s.altitude > 3) {
      const hl = Math.hypot(s.x, s.z) || 1;
      const ff = (fx * s.x + fz * s.z) / hl;
      const fs = (sx * s.x + sz * s.z) / hl;
      if (ff > 0.08 && !rayHitsTower(front.x, y, front.z, s, flat.tower)) lit = true;
      else if (fs > 0.08 && !rayHitsTower(side.x, y, side.z, s, flat.tower)) lit = true;
    }
    strip.push({ min: m, lit });
    if (lit) {
      litMin += step;
      if (m < 12 * 60) morning = true;
      if (m >= 14 * 60) evening = true;
    }
  }
  const res = { hours: litMin / 60, morning, evening, strip };
  cache.set(key, res);
  return res;
}
