import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Icon } from './Icon';

export function Chip({ active, onClick, children, title }: { active?: boolean; onClick: () => void; children: ReactNode; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-xl border px-3 py-1.5 text-[13px] font-medium transition ${
        active ? 'border-brand-700 bg-brand-700 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
      }`}
    >
      {children}
    </button>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <div className="mb-1.5 mt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 first:mt-0">{children}</div>;
}

export function RangeSlider({
  min,
  max,
  step,
  value,
  onChange,
  format,
  label,
}: {
  min: number;
  max: number;
  step: number;
  value: [number, number];
  onChange: (v: [number, number]) => void;
  format: (n: number) => string;
  label: string;
}) {
  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs font-medium text-slate-700">
        <span>{format(value[0])}</span>
        <span>{format(value[1])}</span>
      </div>
      <div className="dual-range relative h-6">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-slate-200" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-brand-600"
          style={{ left: `${pct(value[0])}%`, right: `${100 - pct(value[1])}%` }}
        />
        <input
          type="range"
          aria-label={`${label} minimum`}
          min={min}
          max={max}
          step={step}
          value={value[0]}
          onChange={(e) => onChange([Math.min(Number(e.target.value), value[1]), value[1]])}
        />
        <input
          type="range"
          aria-label={`${label} maximum`}
          min={min}
          max={max}
          step={step}
          value={value[1]}
          onChange={(e) => onChange([value[0], Math.max(Number(e.target.value), value[0])])}
        />
      </div>
    </div>
  );
}

export function Slider({
  min,
  max,
  step,
  value,
  onChange,
  label,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <input
      type="range"
      aria-label={label}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="single-range w-full"
      style={{ ['--p' as string]: `${((value - min) / (max - min)) * 100}%` }}
    />
  );
}

export function DropPanel({ title, onClose, children, className = '' }: { title: string; onClose: () => void; children: ReactNode; className?: string }) {
  return (
    <motion.section
      role="dialog"
      aria-label={title}
      initial={{ opacity: 0, y: -12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      className={`pointer-events-auto absolute inset-x-2 z-20 max-h-[calc(100dvh-var(--hdr,64px)-24px)] overflow-y-auto rounded-2xl border border-white/50 bg-white/90 p-4 shadow-2xl backdrop-blur-xl md:inset-x-auto md:right-4 ${className}`}
      style={{ top: 'calc(var(--hdr, 64px) + 8px)' }}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-slate-500 hover:bg-slate-900/5">
          <Icon name="close" />
        </button>
      </div>
      {children}
    </motion.section>
  );
}
