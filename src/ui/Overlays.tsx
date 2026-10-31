import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../store/useStore';
import { runtime } from '../store/runtime';
import { isTouch } from '../store/hooks';
import { FLAT_BY_ID, PROJECT } from '../data/project';
import { Icon } from './Icon';

/** Dev-only: `?ref=1` overlays the developer's hero render to match massing and colours. */
export function RefCompare() {
  const [op, setOp] = useState(0.45);
  if (!import.meta.env.DEV || !new URLSearchParams(window.location.search).has('ref')) return null;
  return (
    <>
      <img src="/.ref/banner.webp" alt="" className="pointer-events-none absolute inset-0 z-[60] h-full w-full object-cover" style={{ opacity: op }} />
      <label className="pointer-events-auto absolute bottom-2 right-2 z-[61] rounded-lg bg-white/90 px-2 py-1 text-xs">
        Reference <input type="range" min={0} max={1} step={0.05} value={op} onChange={(e) => setOp(Number(e.target.value))} />
      </label>
    </>
  );
}

export function Joystick() {
  const mode = useStore((s) => s.mode);
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const active = (mode === 'walk' || mode === 'interior') && isTouch();
  useEffect(() => () => void Object.assign(runtime.joy, { x: 0, y: 0 }), []);
  if (!active) return null;
  const R = 44;
  const update = (e: RPointerEvent) => {
    const r = base.current!.getBoundingClientRect();
    let x = e.clientX - (r.left + r.width / 2);
    let y = e.clientY - (r.top + r.height / 2);
    const l = Math.hypot(x, y);
    if (l > R) {
      x = (x / l) * R;
      y = (y / l) * R;
    }
    setKnob({ x, y });
    runtime.joy.x = x / R;
    runtime.joy.y = -y / R;
  };
  const end = () => {
    setKnob({ x: 0, y: 0 });
    runtime.joy.x = 0;
    runtime.joy.y = 0;
  };
  return (
    <div
      ref={base}
      className="pointer-events-auto absolute bottom-24 left-6 z-20 h-28 w-28 touch-none rounded-full bg-white/25 ring-2 ring-white/50 backdrop-blur"
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        update(e);
      }}
      onPointerMove={(e) => e.buttons && update(e)}
      onPointerUp={end}
      onPointerCancel={end}
      aria-label="Movement joystick"
    >
      <div
        className="absolute left-1/2 top-1/2 h-12 w-12 rounded-full bg-white/90 shadow-lg"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
      />
    </div>
  );
}

export function HintToast() {
  const [show, setShow] = useState(() => !localStorage.getItem('sr-hint'));
  const ready = useStore((s) => s.ready);
  const mode = useStore((s) => s.mode);
  const dismiss = () => {
    localStorage.setItem('sr-hint', '1');
    setShow(false);
  };
  return (
    <AnimatePresence>
      {show && ready && mode === 'orbit' && (
        <motion.div
          initial={{ opacity: 0, y: 20, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: 20, x: '-50%' }}
          className="pointer-events-auto absolute bottom-4 left-1/2 z-10 flex w-max max-w-[92vw] items-center gap-3 rounded-full bg-slate-900/80 py-2 pl-4 pr-2 text-xs text-white shadow-xl backdrop-blur md:text-sm"
        >
          <span>Tap any flat to see its details · drag to rotate · pinch to zoom</span>
          <button onClick={dismiss} aria-label="Dismiss hint" className="rounded-full p-1 hover:bg-white/15">
            <Icon name="close" size={14} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Toast() {
  const toast = useStore((s) => s.toast);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!toast) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 2600);
    return () => clearTimeout(t);
  }, [toast]);
  return (
    <AnimatePresence>
      {visible && toast && (
        <motion.div
          key={toast.id}
          role="status"
          initial={{ opacity: 0, y: -10, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: -10, x: '-50%' }}
          className="pointer-events-none absolute left-1/2 z-50 w-max max-w-[92vw] rounded-full bg-slate-900/90 px-4 py-2 text-center text-sm text-white shadow-xl"
          style={{ top: 'calc(var(--hdr, 64px) + 12px)' }}
        >
          {toast.msg}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Loader() {
  const ready = useStore((s) => s.ready);
  const webglError = useStore((s) => s.webglError);
  const [p, setP] = useState(8);
  useEffect(() => {
    if (ready) return setP(100);
    const t = setInterval(() => setP((v) => Math.min(92, v + (92 - v) * 0.12)), 120);
    return () => clearInterval(t);
  }, [ready]);
  return (
    <AnimatePresence>
      {!(ready && p >= 100) || webglError ? (
        <motion.div
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="absolute inset-0 z-[100] grid place-items-center bg-gradient-to-br from-brand-900 via-brand-700 to-brand-600 text-white"
        >
          <div className="flex w-72 flex-col items-center text-center">
            <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-white/15 text-3xl font-black shadow-xl ring-1 ring-white/30">{PROJECT.brand.charAt(0)}</div>
            <div className="text-lg font-semibold">{PROJECT.brand}</div>
            <div className="text-sm text-white/85">
              {PROJECT.name} · {PROJECT.developer}
            </div>
            {webglError ? (
              <>
                <div className="mb-4 mt-1 text-sm text-white/80">Your browser or device can't display 3D (WebGL is unavailable). Try an up-to-date Chrome, Edge or Safari, or enable hardware acceleration.</div>
                <button onClick={() => window.location.reload()} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-brand-700">
                  Retry
                </button>
              </>
            ) : (
              <>
                <div className="mb-5 text-xs text-white/70">Preparing your 3D tour…</div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                  <div className="h-full rounded-full bg-white transition-all duration-300" style={{ width: `${p}%` }} />
                </div>
              </>
            )}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function SearchChooser() {
  const digits = useStore((s) => s.chooser);
  const { selectFlat, set } = useStore.getState();
  if (!digits) return null;
  const options = ['A', 'B'].map((t) => `${t}-${digits}`).filter((id) => FLAT_BY_ID.has(id));
  return (
    <div
      role="dialog"
      aria-label="Choose tower"
      className="pointer-events-auto absolute left-1/2 z-40 w-[min(92vw,320px)] -translate-x-1/2 rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-black/5"
      style={{ top: 'calc(var(--hdr, 64px) + 12px)' }}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold">Which tower is flat {digits} in?</div>
        <button onClick={() => set({ chooser: null })} aria-label="Close" className="text-slate-400">
          <Icon name="close" size={16} />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {options.map((id) => (
          <button key={id} onClick={() => selectFlat(id)} className="rounded-xl bg-brand-700 py-2 text-sm font-semibold text-white hover:bg-brand-600">
            {id}
          </button>
        ))}
      </div>
    </div>
  );
}
