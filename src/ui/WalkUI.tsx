import { useEffect, useMemo, useRef, useState, type MouseEvent as RMouseEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FLAT_BY_ID, PROJECT, TOWER_BY_ID, TOWERS, towerName, unitOf } from '../data/project';
import { CLUB, PLAY, POOL, RING, SITE } from '../data/site';
import { ELECTRICAL, flooringSpec, HOUSEHOLD_LABEL, profileWithTheme, THEMES } from '../data/interiors';
import type { TowerId } from '../data/types';
import { useStore, type Furnishing } from '../store/useStore';
import { runtime } from '../store/runtime';
import { isTouch } from '../store/hooks';
import { flatXform, planToWorldXZ } from '../lib/interiorFrame';
import { bearingFromVec, bearingLabel, CORE_HALF, FACING_LONG, flatFrame, FLAT_D, FLAT_W, FLOORS, planToLocal, TOWER_HX, TOWER_HZ, BALC_D } from '../lib/geometry';
import { floorTour, interiorTour, roomCaption, siteTour } from '../lib/tours';
import { floorFlats, floorRoute, LIFT_X1, STAIR_X0, worldToTowerLocal } from '../lib/floor';
import { chapters, gotoChapter, nextStep, prevStep, startTour, stopTour, togglePause, walkPath } from '../lib/tourEngine';
import { englishVoices, narrator } from '../lib/narrator';
import { enterFloor, rideLift } from '../lib/lift';
import { STATUS_COLOR } from '../lib/colors';
import { Icon } from './Icon';
import { interiorPose } from '../lib/poses';

const pill = 'flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition';
const ghost = `${pill} bg-white/15 hover:bg-white/25`;
const on = `${pill} bg-white text-slate-900`;

/** Best floor in a tower for a showcase: most available homes, mid-to-high floors first. */
function showcaseFloor(tower: TowerId) {
  let best = 8;
  let score = -1;
  for (let f = 4; f <= FLOORS - 1; f++) {
    const s = PROJECT.flats.filter((x) => x.tower === tower && x.floor === f && x.status === 'available').length * 10 + f;
    if (s > score) {
      score = s;
      best = f;
    }
  }
  return best;
}

function TourMenu({ onClose }: { onClose: () => void }) {
  const mode = useStore((s) => s.mode);
  const selectedId = useStore((s) => s.selectedId);
  const flat = selectedId ? FLAT_BY_ID.get(selectedId) : undefined;
  const item = 'w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-slate-100';
  const go = (fn: () => void) => {
    fn();
    onClose();
  };
  const complete = () => {
    const tower: TowerId = flat?.tower ?? 'A1';
    const floor = showcaseFloor(tower);
    const steps = siteTour();
    const last = steps[steps.length - 1];
    steps.push({ x: last.x, z: last.z, caption: `Taking the lift to floor ${floor}…`, say: `Let's go up to floor ${floor}.`, pause: 0.2, action: () => window.setTimeout(() => enterFloor(tower, floor, true), 300) });
    startTour(steps, 'Complete tour');
  };
  return (
    <div className="absolute bottom-full left-1/2 mb-2 w-64 -translate-x-1/2 rounded-2xl bg-white p-1.5 text-slate-800 shadow-2xl">
      {mode === 'interior' && flat && (
        <>
          <button className={item} onClick={() => go(() => startTour(interiorTour(flat, runtime.plan.valid ? { x: runtime.plan.x, y: runtime.plan.y } : { x: 6, y: 1 }), `${flat.id} tour`))}>
            <b>This home</b> — room by room with narration
          </button>
          <button className={item} onClick={() => go(() => startTour(floorTour(flat.tower, flat.floor, runtime.player), `Floor ${flat.floor} tour`))}>
            <b>This floor</b> — all 4 homes, entering available ones
          </button>
        </>
      )}
      {mode === 'walk' && (
        <>
          <button className={item} onClick={() => go(() => startTour(siteTour(), 'Site tour'))}>
            <b>Site tour</b> — gate, clubhouse, pool, play area
          </button>
          <button className={item} onClick={() => go(complete)}>
            <b>Complete tour</b> — site → lift → floor → homes
          </button>
        </>
      )}
    </div>
  );
}

export function ModeBar() {
  const mode = useStore((s) => s.mode);
  const selectedId = useStore((s) => s.selectedId);
  const night = useStore((s) => s.interiorNight);
  const third = useStore((s) => s.thirdPerson);
  const avatar = useStore((s) => s.avatar);
  const furnishing = useStore((s) => s.furnishing);
  const roomTags = useStore((s) => s.roomTags);
  const touring = useStore((s) => s.touring);
  const themes = useStore((s) => s.themes);
  const nearLift = useStore((s) => s.nearLift);
  const designMode = useStore((s) => s.designMode);
  const [menu, setMenu] = useState(false);
  const [lift, setLift] = useState(false);
  const { setMode, set } = useStore.getState();
  const touch = isTouch();
  if (mode !== 'walk' && mode !== 'balcony' && mode !== 'interior') return null;
  const flat = selectedId ? FLAT_BY_ID.get(selectedId) : undefined;
  const title = mode === 'walk' ? 'Walking the site' : mode === 'balcony' ? `Balcony view · ${selectedId}` : `${flat ? towerName(flat.tower) : ''} · Floor ${flat?.floor}`;
  const hint =
    mode === 'balcony'
      ? 'Drag to look around'
      : touch
        ? 'Joystick to move · drag to look · tap the map to walk'
        : 'WASD · Shift to run · drag to look · click floor or map to walk';

  const cycleTheme = () => {
    if (!flat) return;
    const cur = profileWithTheme(flat, themes[flat.id]).theme.id;
    const next = THEMES[(THEMES.findIndex((t) => t.id === cur) + 1) % THEMES.length];
    set({ themes: { ...themes, [flat.id]: next.id } });
    useStore.getState().showToast(`${flat.id}: ${next.name} interior`);
  };

  return (
    <div className="pointer-events-auto absolute bottom-3 left-1/2 z-20 flex w-max max-w-[97vw] -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 rounded-2xl bg-slate-900/85 px-3 py-2 text-white shadow-2xl backdrop-blur">
      <div className="mr-1 min-w-[130px] leading-tight">
        <div className="whitespace-nowrap text-sm font-semibold">{title}</div>
        <div className="max-w-[240px] text-[11px] text-white/70">{hint}</div>
      </div>
      {mode !== 'balcony' && (
        <div className="relative">
          <button className={touring ? on : ghost} onClick={() => (touring ? stopTour() : setMenu(!menu))} aria-expanded={menu}>
            <Icon name={touring ? 'pause' : 'play'} size={14} filled /> {touring ? 'Stop tour' : 'Guided tour ▾'}
          </button>
          {menu && !touring && <TourMenu onClose={() => setMenu(false)} />}
        </div>
      )}
      {mode === 'interior' && flat && <FlatSwitcher />}
      {mode !== 'balcony' && (
        <>
          <button className={ghost} onClick={() => set({ thirdPerson: !third })} title="Switch camera">
            <Icon name={third ? 'eye' : 'walk'} size={14} /> {third ? '1st person' : '3rd person'}
          </button>
          {third && (
            <button className={ghost} onClick={() => set({ avatar: avatar === 'm' ? 'f' : 'm' })} title="Change avatar">
              {avatar === 'm' ? '♂' : '♀'}
            </button>
          )}
        </>
      )}
      {mode === 'interior' && (
        <>
          <select
            value={furnishing}
            onChange={(e) => set({ furnishing: e.target.value as Furnishing })}
            className="rounded-xl bg-white/15 px-2 py-1.5 text-xs font-semibold text-white outline-none"
            aria-label="Furnishing"
          >
            <option className="text-slate-900" value="auto">Auto (sample / lived-in)</option>
            <option className="text-slate-900" value="sample">Sample flat</option>
            <option className="text-slate-900" value="lived">Lived-in</option>
            <option className="text-slate-900" value="bare">Bare shell</option>
          </select>
          <button className={ghost} onClick={cycleTheme} title="Try another interior style">
            🎨 Interior
          </button>
          <button
            className={designMode ? on : ghost}
            onClick={() => {
              if (touring) stopTour();
              set({ designMode: !designMode, designSel: null, designTop: false });
            }}
            title="Move, swap and add furniture to see how much space is left"
            aria-pressed={designMode}
          >
            🛋 Design
          </button>
          <button className={roomTags ? on : ghost} onClick={() => set({ roomTags: !roomTags })} aria-pressed={roomTags}>
            Labels
          </button>
          <button className={ghost} onClick={() => set({ interiorNight: !night })} aria-pressed={night}>
            <Icon name={night ? 'sun' : 'moon'} size={14} />
          </button>
          <div className="relative">
            <button className={lift ? on : ghost} onClick={() => setLift(!lift)}>
              ⇅ Lift
            </button>
            {lift && !nearLift && <LiftPanel onClose={() => setLift(false)} />}
          </div>
          <button className={ghost} onClick={() => setMode('balcony')}>
            <Icon name="balcony" size={14} />
          </button>
        </>
      )}
      {mode === 'balcony' && selectedId && (
        <button className={ghost} onClick={() => setMode('interior')}>
          <Icon name="door" size={14} /> Walk inside
        </button>
      )}
      <button onClick={() => setMode('orbit')} className={on}>
        <Icon name="exit" size={14} /> Exit
      </button>
    </div>
  );
}

/** ◀ A-1201 · A-1202 · A-1203 · A-1204 ▶ — opens another home directly. */
function FlatSwitcher() {
  const selectedId = useStore((s) => s.selectedId);
  const flat = selectedId ? FLAT_BY_ID.get(selectedId) : undefined;
  if (!flat) return null;
  const flats = floorFlats(flat.tower, flat.floor);
  const i = flats.findIndex((f) => f.id === flat.id);
  const goto = (f: (typeof flats)[number]) => {
    if (f.id === flat.id) return;
    stopTour();
    useStore.setState({ selectedId: f.id, currentRoom: null, nearLift: false, designSel: null, designTop: false });
    runtime.plan.valid = false;
    useStore.getState().flyTo(interiorPose(f));
  };
  return (
    <div className="flex items-center rounded-xl bg-white/10 p-0.5" role="group" aria-label="Homes on this floor">
      <button className={`${pill} hover:bg-white/15`} onClick={() => goto(flats[(i + flats.length - 1) % flats.length])} aria-label="Previous home">
        ◀
      </button>
      {flats.map((f) => (
        <button key={f.id} className={f.id === flat.id ? on : `${pill} hover:bg-white/15`} onClick={() => goto(f)} title={`${f.id} · ${unitOf(f).short} · ${f.status}`}>
          <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[f.status] }} />
          {String(f.index).padStart(2, '0')}
        </button>
      ))}
      <button className={`${pill} hover:bg-white/15`} onClick={() => goto(flats[(i + 1) % flats.length])} aria-label="Next home">
        ▶
      </button>
    </div>
  );
}

function LiftPanel({ onClose }: { onClose?: () => void }) {
  const selectedId = useStore((s) => s.selectedId);
  const flat = selectedId ? FLAT_BY_ID.get(selectedId) : undefined;
  if (!flat) return null;
  const floors = Array.from({ length: FLOORS }, (_, k) => FLOORS - k);
  const press = (f: number) => {
    const s = useStore.getState();
    if (!s.nearLift) {
      walkPath(floorRoute(flat.tower, flat.floor, runtime.player, null));
      s.showToast('Walking to the lift… press the floor again when you arrive');
      return;
    }
    rideLift(f);
    onClose?.();
  };
  return (
    <div className="absolute bottom-full right-0 mb-2 w-44 rounded-2xl bg-slate-800 p-2 text-white shadow-2xl ring-1 ring-white/10">
      <div className="mb-1.5 text-center text-[11px] font-semibold text-white/70">{towerName(flat.tower)} lift</div>
      <div className="grid grid-cols-3 gap-1">
        {floors.map((f) => {
          const avail = PROJECT.flats.filter((x) => x.tower === flat.tower && x.floor === f && x.status === 'available').length;
          return (
            <button
              key={f}
              onClick={() => press(f)}
              className={`rounded-full py-1.5 text-xs font-bold ${f === flat.floor ? 'bg-amber-400 text-slate-900' : 'bg-white/10 hover:bg-white/20'}`}
              title={`${avail} available`}
            >
              {f}
              {avail > 0 && f !== flat.floor && <span className="ml-0.5 text-[9px] text-emerald-300">•</span>}
            </button>
          );
        })}
        <button onClick={() => press(0)} className="col-span-3 rounded-full bg-white/10 py-1.5 text-xs font-bold hover:bg-white/20">
          G · Lobby
        </button>
      </div>
    </div>
  );
}

/** Shows when standing in the lift lobby, and animates the ride between floors. */
export function LiftUI() {
  const mode = useStore((s) => s.mode);
  const nearLift = useStore((s) => s.nearLift);
  const lift = useStore((s) => s.lift);
  const touring = useStore((s) => s.touring);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!lift) return;
    setShown(lift.from);
    const step = lift.to > lift.from ? 1 : -1;
    const n = Math.abs(lift.to - lift.from);
    let k = 0;
    const t = window.setInterval(() => {
      k++;
      setShown(lift.from + step * Math.min(k, n));
      if (k >= n) window.clearInterval(t);
    }, Math.max(60, 1500 / Math.max(1, n)));
    return () => window.clearInterval(t);
  }, [lift]);
  if (mode !== 'interior') return null;
  return (
    <>
      <AnimatePresence>
        {lift && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} className="pointer-events-auto absolute inset-0 z-40 grid place-items-center bg-slate-950/85">
            <div className="text-center text-white">
              <div className="mx-auto mb-3 grid h-24 w-24 place-items-center rounded-2xl bg-black text-5xl font-bold text-amber-400 shadow-inner ring-2 ring-slate-700">
                {shown === 0 ? 'G' : shown}
              </div>
              <div className="text-sm text-white/70">{lift.to > lift.from ? '▲ Going up' : '▼ Going down'} to {lift.to === 0 ? 'the lobby' : `floor ${lift.to}`}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {nearLift && !lift && !touring && useStore.getState().currentRoom === 'Lift lobby' && (
        <div className="pointer-events-auto absolute left-3 top-1/2 z-20 -translate-y-1/2">
          <LiftPanelInline />
        </div>
      )}
    </>
  );
}

function LiftPanelInline() {
  return (
    <div className="relative">
      <div className="relative w-44">
        <div className="[&>div]:static [&>div]:mb-0">
          <LiftPanel />
        </div>
      </div>
    </div>
  );
}

export function TourPanel() {
  const tour = useStore((s) => s.tour);
  const voice = useStore((s) => s.voice);
  const cinematic = useStore((s) => s.cinematic);
  const panorama = useStore((s) => s.beat?.shot === 'panorama');
  const [settings, setSettings] = useState(false);
  const [chap, setChap] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    const load = () => setVoices(englishVoices());
    load();
    if (narrator.available) window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => {
      if (narrator.available) window.speechSynthesis.removeEventListener('voiceschanged', load);
    };
  }, []);
  if (!tour) return null;
  const setVoice = (p: Partial<typeof voice>) => useStore.setState({ voice: { ...voice, ...p } });
  const btn = 'grid h-8 w-8 place-items-center rounded-full bg-white/10 hover:bg-white/20';
  return (
    <div className="pointer-events-auto absolute left-1/2 z-30 w-[min(94vw,420px)] -translate-x-1/2 rounded-2xl bg-slate-900/90 p-2.5 text-white shadow-2xl backdrop-blur max-md:!top-[calc(var(--hdr,64px)+42px)]" style={{ top: 'calc(var(--hdr, 64px) + 10px)' }} role="region" aria-label="Guided tour">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold">{tour.title}</div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${(tour.step / Math.max(1, tour.total)) * 100}%` }} />
          </div>
          <div className="mt-0.5 text-[10px] text-white/60">
            Step {tour.step} of {tour.total}
          </div>
        </div>
        <button className={btn} onClick={prevStep} aria-label="Previous step">
          ⏮
        </button>
        <button className={btn} onClick={togglePause} aria-label={tour.paused ? 'Resume' : 'Pause'}>
          <Icon name={tour.paused ? 'play' : 'pause'} size={13} filled />
        </button>
        <button className={btn} onClick={nextStep} aria-label="Next step">
          ⏭
        </button>
        <button className={btn} onClick={() => setVoice({ enabled: !voice.enabled })} aria-label={voice.enabled ? 'Mute narration' : 'Unmute narration'} aria-pressed={voice.enabled}>
          {voice.enabled ? '🔊' : '🔇'}
        </button>
        <button
          className={`${btn} ${cinematic ? '!bg-amber-400 text-slate-900' : ''}`}
          onClick={() => {
            useStore.setState({ cinematic: !cinematic });
            runtime.directing = !cinematic && !!useStore.getState().beat;
          }}
          aria-label="Cinematic camera"
          aria-pressed={cinematic}
          title={cinematic ? 'Cinematic camera on — the camera shows what is being described' : 'Cinematic camera off'}
        >
          🎬
        </button>
        <button className={btn} onClick={() => setChap(!chap)} aria-label="Chapters" aria-expanded={chap}>
          ☰
        </button>
        <button className={btn} onClick={() => setSettings(!settings)} aria-label="Voice settings" aria-expanded={settings}>
          ⚙
        </button>
        <button className={btn} onClick={stopTour} aria-label="Stop tour">
          <Icon name="close" size={13} />
        </button>
      </div>
      {panorama && (
        <div className="mt-2 rounded-lg bg-white/5 px-2 py-1.5 text-[11px] text-white/75">
          {cinematic ? '360° room tour · Drag to look around · Pause to stay here' : 'Free look · Drag to explore every direction'}
        </div>
      )}
      {chap && (
        <ol className="mt-2 max-h-56 overflow-y-auto border-t border-white/10 pt-1.5 text-[11.5px]">
          {chapters().map((c, k) => (
            <li key={c.i}>
              <button
                onClick={() => gotoChapter(c.i)}
                className={`w-full truncate rounded-lg px-2 py-1 text-left hover:bg-white/10 ${k + 1 === tour.step ? 'bg-white/15 font-semibold text-amber-300' : 'text-white/85'}`}
              >
                {k + 1}. {c.caption.split(' — ')[0]}
              </button>
            </li>
          ))}
        </ol>
      )}
      {settings && (
        <div className="mt-2 grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1.5 border-t border-white/10 pt-2 text-[11px]">
          <span className="text-white/60">Voice</span>
          <select value={voice.voiceURI ?? ''} onChange={(e) => setVoice({ voiceURI: e.target.value || null })} className="rounded-lg bg-white/10 px-2 py-1 text-white outline-none">
            <option className="text-slate-900" value="">Auto (Indian English if available)</option>
            {voices.map((v) => (
              <option key={v.voiceURI} className="text-slate-900" value={v.voiceURI}>
                {v.name} ({v.lang})
              </option>
            ))}
          </select>
          <span className="text-white/60">Speed</span>
          <input type="range" min={0.8} max={1.3} step={0.05} value={voice.rate} onChange={(e) => setVoice({ rate: Number(e.target.value) })} aria-label="Narration speed" />
          {!narrator.available && <span className="col-span-2 text-amber-300">This browser has no speech voices — captions only.</span>}
        </div>
      )}
      <div className="sr-only" aria-live="polite">
        {useStore.getState().caption}
      </div>
    </div>
  );
}

export function TourCaption() {
  const caption = useStore((s) => s.caption);
  const beat = useStore((s) => s.beat);
  const mode = useStore((s) => s.mode);
  const show = !!caption && (mode === 'walk' || mode === 'interior');
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key={caption}
          initial={{ opacity: 0, y: 12, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, x: '-50%' }}
          className="pointer-events-none absolute bottom-32 left-1/2 z-20 w-max max-w-[min(92vw,720px)] rounded-2xl bg-slate-950/80 px-4 py-2.5 text-center text-white shadow-xl backdrop-blur md:bottom-24"
        >
          <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-300">{caption!.split(' — ')[0]}</div>
          {beat ? <Karaoke text={beat.say} char={beat.char} /> : <div className="text-sm">{caption!.split(' — ')[1] ?? ''}</div>}
          {beat && beat.total > 1 && (
            <div className="mt-1 flex justify-center gap-1">
              {Array.from({ length: beat.total }, (_, i) => (
                <span key={i} className={`h-1 w-4 rounded-full ${i <= beat.idx ? 'bg-amber-300' : 'bg-white/25'}`} />
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Subtitle with the words already spoken lit up. */
function Karaoke({ text, char }: { text: string; char: number }) {
  const words = useMemo(() => {
    const all = [...text.matchAll(/\S+\s*/g)].map((m) => ({ w: m[0], at: m.index ?? 0 }));
    const active = Math.max(0, all.findIndex((w, i) => w.at <= char && (all[i + 1]?.at ?? Infinity) > char));
    return all.slice(Math.floor(active / 16) * 16, Math.floor(active / 16) * 16 + 16);
  }, [text, char]);
  return (
    <div className="text-[15px] leading-snug">
      {words.map((x, i) => (
        <span key={i} className={x.at <= char ? (words[i + 1]?.at > char || i === words.length - 1 ? 'font-semibold text-amber-200' : 'text-white') : 'text-white/45'}>
          {x.w}
        </span>
      ))}
    </div>
  );
}

/** Tells the visitor which room they are in, with size, vastu and handover specs. */
export function RoomHUD() {
  const mode = useStore((s) => s.mode);
  const selectedId = useStore((s) => s.selectedId);
  const room = useStore((s) => s.currentRoom);
  const units = useStore((s) => s.units);
  const touring = useStore((s) => s.touring);
  const themes = useStore((s) => s.themes);
  const [open, setOpen] = useState(true);
  const flat = selectedId ? FLAT_BY_ID.get(selectedId) : undefined;

  useEffect(() => {
    if (!room) return;
    setOpen(true);
    const t = setTimeout(() => setOpen(false), 4500);
    return () => clearTimeout(t);
  }, [room]);

  const info = useMemo(() => {
    if (!flat || !room) return null;
    const xf = flatXform(flat);
    const L = xf.layout;
    const idx = L.rooms.findIndex((r) => r.name === room);
    if (idx < 0) return null;
    const r = L.rooms[idx];
    const chips: string[] = [];
    for (const s of L.segs) {
      if (!s.rooms.includes(idx)) continue;
      const other = s.rooms[0] === idx ? s.rooms[1] : s.rooms[0];
      const o = other != null ? L.rooms[other] : null;
      if (s.kind === 'door' && o?.kind === 'toilet' && r.kind === 'bed') chips.push('Attached toilet');
      if (s.kind === 'slide') chips.push('Balcony access');
      if (s.kind === 'door' && o?.kind === 'utility') chips.push('Utility access');
    }
    if (r.kind === 'bed') chips.push('Wardrobe space', 'AC point');
    if (r.kind === 'living') chips.push('TV wall', 'AC point');
    if (r.kind === 'kitchen') chips.push(r.open ? 'Open kitchen' : 'Closed kitchen', 'Chimney & hob');
    let windowDir: string | null = null;
    const win = L.segs.find((s) => s.kind === 'window' && s.rooms[0] === idx && s.rooms[1] == null);
    if (win) {
      const [wx, wz] = planToWorldXZ(xf, (win.x1 + win.x2) / 2, (win.y1 + win.y2) / 2);
      const [cx, cz] = planToWorldXZ(xf, r.x + r.w / 2, r.y + r.h / 2);
      windowDir = FACING_LONG[bearingLabel(bearingFromVec(wx - cx, wz - cz))];
    }
    const prof = profileWithTheme(flat, themes[flat.id]);
    return {
      caption: roomCaption(flat, room, units),
      chips: [...new Set(chips)],
      windowDir,
      height: (xf.baseY + 1.6).toFixed(0),
      flooring: flooringSpec(prof.theme, r.kind),
      electrical: ELECTRICAL[r.kind] ?? '',
      home: `${prof.theme.name} theme · ${HOUSEHOLD_LABEL[prof.household]}`,
    };
  }, [flat, room, units, themes]);

  if (mode !== 'interior' || !room || !flat) return null;
  const tour = useStore.getState().tour;
  if (!info) {
    return (
      <div className="pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 rounded-2xl bg-slate-900/85 px-4 py-2 text-sm font-semibold text-white shadow-xl" style={{ top: `calc(var(--hdr, 64px) + ${tour ? 92 : 10}px)` }}>
        📍 {room} · Floor {flat.floor}
      </div>
    );
  }
  const [head, ...rest] = info.caption.split(' · ');
  return (
    <div className="pointer-events-auto absolute left-1/2 z-20 w-max max-w-[94vw] -translate-x-1/2" style={{ top: `calc(var(--hdr, 64px) + ${tour ? 92 : 10}px)` }}>
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 rounded-2xl bg-slate-900/85 px-4 py-2 text-left text-white shadow-xl backdrop-blur" aria-expanded={open}>
        <span className="grid h-6 w-6 place-items-center rounded-full bg-sky-500 text-[11px]">●</span>
        <span className="text-sm font-semibold">
          {head} <span className="font-normal text-white/60">· {flat.id}</span>
        </span>
        {!open && <span className="text-xs text-white/60">· details</span>}
      </button>
      <AnimatePresence>
        {open && !touring && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="mt-1.5 max-w-[420px] rounded-2xl bg-white/95 p-3 text-xs text-slate-700 shadow-xl">
            <div className="text-[13px] font-medium text-slate-900">{rest.join(' · ')}</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {info.chips.map((c) => (
                <span key={c} className="rounded-full bg-brand-50 px-2 py-0.5 font-semibold text-brand-700">
                  {c}
                </span>
              ))}
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold">{info.height} m above ground</span>
              {info.windowDir && <span className="rounded-full bg-sky-50 px-2 py-0.5 font-semibold text-sky-700">Window faces {info.windowDir}</span>}
            </div>
            <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
              <span className="text-slate-500">Flooring</span>
              <span>{info.flooring}</span>
              {info.electrical && (
                <>
                  <span className="text-slate-500">Points</span>
                  <span>{info.electrical}</span>
                </>
              )}
              <span className="text-slate-500">Home</span>
              <span>{info.home}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Whole-floor map: corridor, lifts and all four homes with live position; tap to walk. */
export function FloorMiniMap() {
  const mode = useStore((s) => s.mode);
  const selectedId = useStore((s) => s.selectedId);
  const [min, setMin] = useState(() => window.innerWidth < 768);
  const marker = useRef<SVGGElement>(null);
  const flat = selectedId ? FLAT_BY_ID.get(selectedId) : undefined;
  const tower = flat ? TOWER_BY_ID.get(flat.tower)! : null;
  const flats = useMemo(() => (flat ? floorFlats(flat.tower, flat.floor) : []), [flat?.tower, flat?.floor]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mode !== 'interior' || !tower) return;
    let raf = 0;
    const tick = () => {
      const p = runtime.player;
      const [lx, lz] = worldToTowerLocal(tower, p.x, p.z);
      marker.current?.setAttribute('transform', `translate(${lx} ${lz}) rotate(${((-(p.yaw - tower.rotationY)) * 180) / Math.PI})`);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [mode, tower, min]);

  if (mode !== 'interior' || !flat || !tower) return null;
  const vb = `${-TOWER_HX - 0.6} ${-TOWER_HZ - BALC_D - 0.6} ${TOWER_HX * 2 + 1.2} ${(TOWER_HZ + BALC_D) * 2 + 1.2}`;
  const rect = (f: (typeof flats)[number], x: number, y: number, w: number, h: number) => {
    const fr = flatFrame(f.index);
    const [ax, az] = planToLocal(fr, x, y);
    const [bx, bz] = planToLocal(fr, x + w, y + h);
    return { x: Math.min(ax, bx), y: Math.min(az, bz), w: Math.abs(bx - ax), h: Math.abs(bz - az) };
  };
  const walkTo = (f: (typeof flats)[number], px: number, py: number) => walkPath(floorRoute(f.tower, f.floor, runtime.player, f, { x: px, y: py }));
  return (
    <div className="pointer-events-auto absolute right-3 z-10 w-48 rounded-2xl bg-white/90 p-1.5 shadow-xl ring-1 ring-black/5 backdrop-blur md:w-64" style={{ top: 'calc(var(--hdr, 64px) + 10px)' }}>
      <button onClick={() => setMin(!min)} className="flex w-full items-center justify-between px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
        Floor {flat.floor} map · tap to walk <span>{min ? '▾' : '▴'}</span>
      </button>
      {!min && (
        <svg viewBox={vb} className="w-full" role="img" aria-label={`Map of floor ${flat.floor}`}>
          <rect x={-TOWER_HX} y={-CORE_HALF} width={TOWER_HX * 2} height={CORE_HALF * 2} fill="#e9e3d8" />
          <rect x={-TOWER_HX} y={-CORE_HALF} width={LIFT_X1 + TOWER_HX} height={CORE_HALF * 2} fill="#b9bfc5" />
          <rect x={STAIR_X0} y={-CORE_HALF} width={TOWER_HX - STAIR_X0} height={CORE_HALF * 2} fill="#e8a39b" />
          <text x={(LIFT_X1 - TOWER_HX) / 2} y={0.5} fontSize={1.2} textAnchor="middle" fill="#334155" fontWeight={700}>
            LIFT
          </text>
          {flats.map((f) => {
            const L = flatXform(f).layout;
            const outer = rect(f, 0, 0, FLAT_W, FLAT_D);
            return (
              <g key={f.id}>
                {L.rooms.map((r) => {
                  // Layout rooms are already mirrored; undo so planToLocal mirrors them back once.
                  const src = flatFrame(f.index).mirror ? { ...r, x: FLAT_W - r.x - r.w } : r;
                  const q = rect(f, src.x, src.y, src.w, src.h);
                  return (
                    <rect
                      key={r.name}
                      {...{ x: q.x, y: q.y, width: q.w, height: q.h }}
                      fill={r.kind === 'balcony' ? '#d9cfc2' : f.id === flat.id ? '#f8fafc' : '#eef2f6'}
                      stroke="#94a3b8"
                      strokeWidth={0.08}
                      className="cursor-pointer hover:fill-sky-100"
                      onClick={() => walkTo(f, r.x + r.w / 2, r.y + r.h / 2)}
                    />
                  );
                })}
                <rect x={outer.x} y={outer.y} width={outer.w} height={outer.h} fill="none" stroke={STATUS_COLOR[f.status]} strokeWidth={0.45} pointerEvents="none" />
                <text x={outer.x + outer.w / 2} y={outer.y + outer.h / 2 + 0.6} fontSize={1.6} textAnchor="middle" fontWeight={700} fill="#0f172a" pointerEvents="none">
                  {String(f.index).padStart(2, '0')}
                </text>
              </g>
            );
          })}
          <g ref={marker} pointerEvents="none">
            <path d="M 0 0 L -1.2 -2.4 A 2.6 2.6 0 0 1 1.2 -2.4 Z" fill="#0ea5e9" opacity={0.35} />
            <circle r={0.6} fill="#0ea5e9" stroke="white" strokeWidth={0.2} />
          </g>
        </svg>
      )}
    </div>
  );
}

export function SiteMiniMap() {
  const mode = useStore((s) => s.mode);
  const marker = useRef<SVGGElement>(null);
  const [min, setMin] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    if (mode !== 'walk') return;
    let raf = 0;
    const tick = () => {
      const p = runtime.player;
      marker.current?.setAttribute('transform', `translate(${p.x} ${p.z}) rotate(${(-p.yaw * 180) / Math.PI})`);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [mode, min]);
  if (mode !== 'walk') return null;
  const vb = `${SITE.minX - 4} ${SITE.minZ - 4} ${SITE.maxX - SITE.minX + 8} ${SITE.maxZ - SITE.minZ + 14}`;
  const onClick = (e: RMouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    walkPath([{ x: p.x, z: p.y }]);
  };
  return (
    <div className="pointer-events-auto absolute right-3 z-10 w-44 rounded-2xl bg-white/90 p-1.5 shadow-xl ring-1 ring-black/5 backdrop-blur md:w-56" style={{ top: 'calc(var(--hdr, 64px) + 10px)' }}>
      <button onClick={() => setMin(!min)} className="flex w-full items-center justify-between px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
        Site map · tap to walk <span>{min ? '▾' : '▴'}</span>
      </button>
      {!min && (
        <svg viewBox={vb} className="w-full cursor-crosshair rounded-xl" onClick={onClick} role="img" aria-label="Site map">
          <rect x={SITE.minX} y={SITE.minZ} width={SITE.maxX - SITE.minX} height={SITE.maxZ - SITE.minZ} fill="#9cc27a" stroke="#8c7b68" strokeWidth={1.5} />
          <rect x={RING.minX} y={RING.minZ} width={RING.maxX - RING.minX} height={RING.maxZ - RING.minZ} fill="none" stroke="#4b5058" strokeWidth={RING.width} />
          <rect x={-RING.width / 2} y={RING.maxZ} width={RING.width} height={SITE.maxZ - RING.maxZ} fill="#4b5058" />
          {TOWERS.map((t) => (
            <g key={t.id} transform={`translate(${t.position[0]} ${t.position[2]}) rotate(${(-t.rotationY * 180) / Math.PI})`}>
              <rect x={-TOWER_HX} y={-TOWER_HZ - BALC_D} width={TOWER_HX * 2} height={(TOWER_HZ + BALC_D) * 2} fill="#e9e4db" stroke="#7a6f62" strokeWidth={0.8} />
              <text textAnchor="middle" dy={4} fontSize={11} fontWeight={700} fill="#334155" transform={`rotate(${(t.rotationY * 180) / Math.PI})`}>
                {t.id}
              </text>
            </g>
          ))}
          <rect x={POOL.x - POOL.w / 2} y={POOL.z - POOL.d / 2} width={POOL.w} height={POOL.d} fill="#3fa7c9" />
          <rect x={CLUB.x - CLUB.w / 2} y={CLUB.z - CLUB.d / 2} width={CLUB.w} height={CLUB.d} fill="#f6f4ef" stroke="#7a6f62" strokeWidth={0.8} />
          <rect x={PLAY.x - PLAY.w / 2} y={PLAY.z - PLAY.d / 2} width={PLAY.w} height={PLAY.d} fill="#f0a35c" />
          <g ref={marker}>
            <path d="M 0 0 L -9 -18 A 20 20 0 0 1 9 -18 Z" fill="#0ea5e9" opacity={0.35} />
            <circle r={3.5} fill="#0ea5e9" stroke="white" strokeWidth={1.2} />
          </g>
        </svg>
      )}
    </div>
  );
}
