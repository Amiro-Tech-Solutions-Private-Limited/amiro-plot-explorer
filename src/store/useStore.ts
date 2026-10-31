import { create } from 'zustand';
import type { Facing, TowerId, View } from '../data/types';
import { FLAT_BY_ID, PROJECT, unitOf } from '../data/project';
import { DEFAULT_FILTERS, matches, type Filters } from '../lib/filter';
import { balconyPose, DEFAULT_POSE, floorsPose, interiorPose, outsidePose, planPose, WALK_START, type Pose } from '../lib/poses';
import { todayIST } from '../lib/sun';
import { formatPrice } from '../lib/format';
import { priceOf } from '../lib/pricing';
import type { FlatDesign } from '../lib/design';
import { decodeDesign } from '../lib/design';

export const DESIGN_KEY = 'amiro.design.v1';

function loadDesigns(): Record<string, FlatDesign> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const o = JSON.parse(localStorage.getItem(DESIGN_KEY) ?? '{}') as Record<string, FlatDesign>;
    return o && typeof o === 'object' ? o : {};
  } catch {
    return {};
  }
}

export type Mode = 'orbit' | 'plan' | 'walk' | 'balcony' | 'interior' | 'floors';
export type Panel = null | 'filters' | 'sun' | 'compare';
export type Furnishing = 'auto' | 'sample' | 'lived' | 'bare';

export interface VoiceSettings {
  enabled: boolean;
  rate: number;
  voiceURI: string | null;
}

const computeMatch = (f: Filters) => new Set(PROJECT.flats.filter((x) => matches(x, f)).map((x) => x.id));

interface State {
  mode: Mode;
  panel: Panel;
  selectedId: string | null;
  hoveredId: string | null;
  filters: Filters;
  matchSet: Set<string>;
  statusColors: boolean;
  units: 'sqft' | 'm2';
  sun: { date: string; minutes: number; playing: boolean };
  floors: { tower: TowerId; isolated: number | null };
  compare: string[];
  interiorNight: boolean;
  fly: { pose: Pose; id: number } | null;
  flying: boolean;
  toast: { msg: string; id: number } | null;
  enquiryFor: string | null;
  chooser: string | null;
  ready: boolean;
  quality: 'high' | 'low';
  thirdPerson: boolean;
  avatar: 'm' | 'f';
  furnishing: Furnishing;
  roomTags: boolean;
  currentRoom: string | null;
  caption: string | null;
  touring: boolean;
  webglError: boolean;
  /** User-picked interior theme per flat id. */
  themes: Record<string, string>;
  voice: VoiceSettings;
  tour: { title: string; step: number; total: number; paused: boolean } | null;
  /** Beat currently being narrated ("show what you say"), with the spoken character index. */
  beat: { key: number; say: string; focus: string[]; shot: string; duration?: number; highlight?: string; host?: string; idx: number; total: number; char: number } | null;
  /** Director takes the camera during beats. */
  cinematic: boolean;
  /** Visitor's own furniture layouts per flat id ("Design your home"). */
  design: Record<string, FlatDesign>;
  designMode: boolean;
  /** Selected furniture group key ("Room::feature") in design mode. */
  designSel: string | null;
  /** Top-down camera over the current flat while designing. */
  designTop: boolean;
  nearLift: boolean;
  lift: { from: number; to: number } | null;

  setMode: (m: Mode) => void;
  selectFlat: (id: string | null, fly?: boolean) => void;
  hover: (id: string | null) => void;
  flyTo: (p: Pose) => void;
  setFlying: (v: boolean) => void;
  setPanel: (p: Panel) => void;
  setFilters: (f: Partial<Filters>) => void;
  clearFilters: () => void;
  toggleIn: <K extends 'towers' | 'configs' | 'facings' | 'views'>(key: K, v: Filters[K][number]) => void;
  setSun: (s: Partial<State['sun']>) => void;
  setFloorsTower: (t: TowerId) => void;
  isolateFloor: (f: number | null) => void;
  toggleCompare: (id: string) => void;
  showToast: (msg: string) => void;
  set: (p: Partial<State>) => void;
}

const aspect = () => (typeof window === 'undefined' ? 1.6 : window.innerWidth / window.innerHeight);

export const useStore = create<State>((set, get) => ({
  mode: 'orbit',
  panel: null,
  selectedId: null,
  hoveredId: null,
  filters: DEFAULT_FILTERS,
  matchSet: computeMatch(DEFAULT_FILTERS),
  statusColors: true,
  units: 'sqft',
  sun: { date: todayIST(), minutes: 10 * 60, playing: false },
  floors: { tower: 'A1', isolated: null },
  compare: [],
  interiorNight: false,
  fly: null,
  flying: false,
  toast: null,
  enquiryFor: null,
  chooser: null,
  ready: false,
  quality: 'high',
  thirdPerson: true,
  avatar: 'm',
  furnishing: 'auto',
  roomTags: true,
  currentRoom: null,
  caption: null,
  touring: false,
  webglError: false,
  themes: {},
  voice: { enabled: true, rate: 1, voiceURI: null },
  tour: null,
  beat: null,
  cinematic: true,
  design: loadDesigns(),
  designMode: false,
  designSel: null,
  designTop: false,
  nearLift: false,
  lift: null,

  flyTo: (pose) => set((s) => ({ fly: { pose, id: (s.fly?.id ?? 0) + 1 }, flying: true })),
  setFlying: (flying) => set({ flying }),

  setMode: (mode) => {
    const s = get();
    const flat = s.selectedId ? FLAT_BY_ID.get(s.selectedId) : undefined;
    switch (mode) {
      case 'orbit':
        s.flyTo(flat ? outsidePose(flat) : DEFAULT_POSE);
        break;
      case 'plan':
        s.flyTo(planPose(aspect()));
        break;
      case 'walk':
        s.flyTo(WALK_START);
        set({ thirdPerson: true });
        break;
      case 'balcony':
        if (!flat) return;
        s.flyTo(balconyPose(flat));
        break;
      case 'interior':
        if (!flat) return;
        s.flyTo(interiorPose(flat));
        set({ thirdPerson: false, roomTags: false, themes: s.themes[flat.id] ? s.themes : { ...s.themes, [flat.id]: 'northpark' } });
        break;
      case 'floors': {
        const tower = flat?.tower ?? s.floors.tower;
        const isolated = flat ? flat.floor : null;
        set({ floors: { tower, isolated } });
        s.flyTo(floorsPose(tower, isolated));
        break;
      }
    }
    set({ mode, panel: null, touring: false, caption: null, currentRoom: null, tour: null, beat: null, designMode: false, designSel: null, designTop: false });
  },

  selectFlat: (id, fly = true) => {
    const s = get();
    if (id && (s.mode === 'walk' || s.mode === 'interior' || s.mode === 'balcony') && fly) {
      const f = FLAT_BY_ID.get(id);
      if (f && s.mode === 'walk') {
        set({ selectedId: id });
        s.showToast(`${id} · ${unitOf(f).short} · ${formatPrice(priceOf(f).total)} — tap Exit to see details`);
      }
      return;
    }
    set({ selectedId: id, chooser: null });
    if (!id || !fly) return;
    const flat = FLAT_BY_ID.get(id);
    if (!flat) return;
    if (s.mode === 'floors') {
      set({ floors: { tower: flat.tower, isolated: flat.floor } });
      s.flyTo(floorsPose(flat.tower, flat.floor));
    } else if (s.mode === 'plan') {
      // stay in plan view
    } else {
      if (s.mode !== 'orbit') set({ mode: 'orbit' });
      s.flyTo(outsidePose(flat));
    }
  },

  hover: (hoveredId) => {
    if (get().hoveredId !== hoveredId) set({ hoveredId });
  },
  setPanel: (panel) => set((s) => ({ panel: s.panel === panel ? null : panel })),
  setFilters: (f) =>
    set((s) => {
      const filters = { ...s.filters, ...f };
      return { filters, matchSet: computeMatch(filters) };
    }),
  clearFilters: () => set({ filters: DEFAULT_FILTERS, matchSet: computeMatch(DEFAULT_FILTERS) }),
  toggleIn: (key, v) =>
    set((s) => {
      const arr = s.filters[key] as unknown[];
      const next = arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
      const filters = { ...s.filters, [key]: next };
      return { filters, matchSet: computeMatch(filters) };
    }),
  setSun: (p) => set((s) => ({ sun: { ...s.sun, ...p } })),
  setFloorsTower: (tower) => {
    set({ floors: { tower, isolated: null } });
    get().flyTo(floorsPose(tower, null));
  },
  isolateFloor: (isolated) => {
    const { tower } = get().floors;
    set({ floors: { tower, isolated } });
    get().flyTo(floorsPose(tower, isolated));
  },
  toggleCompare: (id) => {
    const { compare, showToast } = get();
    if (compare.includes(id)) return set({ compare: compare.filter((c) => c !== id) });
    if (compare.length >= 3) return showToast('You can compare up to 3 flats');
    set({ compare: [...compare, id] });
    showToast(`${id} added to compare (${compare.length + 1}/3)`);
  },
  showToast: (msg) => set((s) => ({ toast: { msg, id: (s.toast?.id ?? 0) + 1 } })),
  set: (p) => set(p),
}));

/* ---------- URL deep-linking ---------- */

const csv = (a: readonly string[]) => (a.length ? a.join(',') : null);
const range = (r: [number, number], d: [number, number]) => (r[0] === d[0] && r[1] === d[1] ? null : `${r[0]}-${r[1]}`);
const parseRange = (v: string | null, d: [number, number]): [number, number] => {
  if (!v) return d;
  const [a, b] = v.split('-').map(Number);
  return Number.isFinite(a) && Number.isFinite(b) ? [a, b] : d;
};
const parseList = <T extends string>(v: string | null, allowed: readonly T[]): T[] =>
  v ? (v.split(',').filter((x) => (allowed as readonly string[]).includes(x)) as T[]) : [];

const MODES_IN_URL: Mode[] = ['orbit', 'plan', 'floors'];

export function hydrateFromUrl() {
  const q = new URLSearchParams(window.location.search);
  const D = DEFAULT_FILTERS;
  const filters: Filters = {
    towers: parseList<TowerId>(q.get('tw'), PROJECT.towers.map((t) => t.id)),
    configs: parseList(q.get('cfg'), PROJECT.unitTypes.map((u) => u.id)),
    facings: parseList<Facing>(q.get('fc'), ['N', 'E', 'S', 'W', 'NE', 'NW', 'SE', 'SW']),
    floor: parseRange(q.get('fl'), D.floor),
    area: parseRange(q.get('ar'), D.area),
    budget: parseRange(q.get('bd'), D.budget),
    views: parseList<View>(q.get('vw'), ['pool', 'garden', 'road', 'city']),
    availableOnly: q.get('av') === '1',
    corner: q.get('cr') === '1',
    vastu: q.get('vs') === '1',
    high: q.get('hi') === '1',
  };
  const flat = q.get('flat');
  const mode = q.get('mode') as Mode | null;
  const units = q.get('u') === 'm2' ? 'm2' : 'sqft';
  useStore.setState({ filters, matchSet: computeMatch(filters), units, statusColors: q.get('st') !== '0' });
  const flatId = flat && FLAT_BY_ID.has(flat.toUpperCase()) ? flat.toUpperCase() : null;
  const lay = q.get('lay');
  if (flatId && lay && lay.length < 8000) {
    const d = decodeDesign(lay);
    if (d) useStore.setState((s) => ({ design: { ...s.design, [flatId]: { ...d, rev: Date.now() } } }));
  }
  return { flat: flatId, mode: mode && MODES_IN_URL.includes(mode) ? mode : null, lay: !!(flatId && lay) };
}

export function startUrlSync() {
  let t: number | undefined;
  return useStore.subscribe((s) => {
    window.clearTimeout(t);
    t = window.setTimeout(() => {
      const f = s.filters;
      const D = DEFAULT_FILTERS;
      const params: Record<string, string | null> = {
        flat: s.selectedId,
        mode: MODES_IN_URL.includes(s.mode) && s.mode !== 'orbit' ? s.mode : null,
        tw: csv(f.towers),
        cfg: csv(f.configs),
        fc: csv(f.facings),
        fl: range(f.floor, D.floor),
        ar: range(f.area, D.area),
        bd: range(f.budget, D.budget),
        vw: csv(f.views),
        av: f.availableOnly ? '1' : null,
        cr: f.corner ? '1' : null,
        vs: f.vastu ? '1' : null,
        hi: f.high ? '1' : null,
        u: s.units === 'm2' ? 'm2' : null,
        st: s.statusColors ? null : '0',
      };
      const q = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
      const qs = q.toString();
      const url = window.location.pathname + (qs ? `?${qs}` : '');
      if (url !== window.location.pathname + window.location.search) window.history.replaceState(null, '', url);
    }, 250);
  });
}
