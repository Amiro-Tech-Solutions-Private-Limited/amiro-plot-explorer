import { useEffect, useRef } from 'react';
import { PROJECT } from '../data/project';
import { useMatchSet } from '../store/hooks';
import { useStore } from '../store/useStore';
import { runtime } from '../store/runtime';
import { STATUS_UI } from '../lib/colors';
import type { Status } from '../data/types';

export function Compass() {
  const ref = useRef<SVGGElement>(null);
  useEffect(() => {
    let raf = 0;
    let last = NaN;
    const tick = () => {
      const b = runtime.camBearing;
      if (ref.current && Math.abs(b - last) > 0.2) {
        ref.current.setAttribute('transform', `rotate(${-b} 40 40)`);
        last = b;
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="h-[72px] w-[72px] rounded-full bg-white/85 shadow-lg ring-1 ring-black/5 backdrop-blur" title="Compass" aria-label="Compass">
      <svg viewBox="0 0 80 80" className="h-full w-full">
        <g ref={ref}>
          <circle cx="40" cy="40" r="30" fill="none" stroke="#cbd5e1" strokeDasharray="2 4" />
          <path d="M40 12 L46 40 L40 36 L34 40 Z" fill="#dc2626" />
          <path d="M40 68 L46 40 L40 44 L34 40 Z" fill="#94a3b8" />
          <text x="40" y="10" textAnchor="middle" fontSize="9" fontWeight="700" fill="#dc2626">N</text>
          <text x="73" y="43" textAnchor="middle" fontSize="8" fill="#475569">E</text>
          <text x="40" y="78" textAnchor="middle" fontSize="8" fill="#475569">S</text>
          <text x="7" y="43" textAnchor="middle" fontSize="8" fill="#475569">W</text>
        </g>
      </svg>
    </div>
  );
}

export function Legend() {
  const matchSet = useMatchSet();
  const statusColors = useStore((s) => s.statusColors);
  const counts: Record<Status, number> = { available: 0, booked: 0, sold: 0 };
  for (const f of PROJECT.flats) if (matchSet.has(f.id)) counts[f.status]++;
  return (
    <div className={`rounded-2xl bg-white/85 px-3 py-2 shadow-lg ring-1 ring-black/5 backdrop-blur transition ${statusColors ? '' : 'opacity-60'}`}>
      {(Object.keys(counts) as Status[]).map((s) => (
        <div key={s} className="flex items-center justify-between gap-4 py-0.5 text-[13px]">
          <span className="flex items-center gap-2 text-slate-700">
            <span className={`h-2.5 w-2.5 rounded-full ${STATUS_UI[s].dot}`} />
            {STATUS_UI[s].label}
          </span>
          <b className="tabular-nums text-slate-900">{counts[s]}</b>
        </div>
      ))}
    </div>
  );
}
