import { useEffect, useRef, useState, type FormEvent } from 'react';
import { FLAT_BY_ID, PROJECT } from '../data/project';
import { useStore, type Mode, type Panel } from '../store/useStore';
import { activeFilterCount } from '../lib/filter';
import { Icon, type IconName } from './Icon';

export function parseFlatQuery(raw: string): { id?: string; digits?: string; error?: string } {
  const m = raw.trim().toUpperCase().match(/^(?:TOWER\s*)?([AB])?[\s\-/]*(\d{3,4})$/);
  if (!m) return { error: 'Try a flat number like A-1204 or 803' };
  const [, t, d] = m;
  if (t) {
    const id = `${t}-${d}`;
    return FLAT_BY_ID.has(id) ? { id } : { error: `Flat ${id} doesn't exist` };
  }
  const options = ['A', 'B'].filter((x) => FLAT_BY_ID.has(`${x}-${d}`));
  if (!options.length) return { error: `No flat numbered ${d}` };
  if (options.length === 1) return { id: `${options[0]}-${d}` };
  return { digits: d };
}

function ToolButton({ icon, label, active, onClick, badge }: { icon: IconName; label: string; active?: boolean; onClick: () => void; badge?: number }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`relative flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-medium transition ${
        active ? 'bg-brand-700 text-white shadow' : 'text-slate-700 hover:bg-slate-900/5'
      }`}
    >
      <Icon name={icon} size={17} />
      <span>{label}</span>
      {!!badge && (
        <span className={`ml-0.5 rounded-full px-1.5 text-[10px] font-bold ${active ? 'bg-white text-brand-700' : 'bg-brand-700 text-white'}`}>{badge}</span>
      )}
    </button>
  );
}

export function Header() {
  const [q, setQ] = useState('');
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--hdr', `${el.offsetHeight}px`));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const mode = useStore((s) => s.mode);
  const panel = useStore((s) => s.panel);
  const statusColors = useStore((s) => s.statusColors);
  const filters = useStore((s) => s.filters);
  const compare = useStore((s) => s.compare);
  const { setMode, setPanel, selectFlat, showToast, set } = useStore.getState();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = parseFlatQuery(q);
    if (r.error) return showToast(r.error);
    if (r.digits) return set({ chooser: r.digits });
    if (r.id) {
      selectFlat(r.id);
      setQ('');
      (document.activeElement as HTMLElement | null)?.blur();
    }
  };

  const modeBtn = (m: Mode, icon: IconName, label: string) => (
    <ToolButton key={m} icon={icon} label={label} active={mode === m} onClick={() => setMode(m)} />
  );
  const panelBtn = (p: Exclude<Panel, null>, icon: IconName, label: string, badge?: number) => (
    <ToolButton key={p} icon={icon} label={label} active={panel === p} onClick={() => setPanel(p)} badge={badge} />
  );

  return (
    <header ref={ref} className="pointer-events-auto absolute inset-x-0 top-0 z-30 border-b border-white/40 bg-white/75 shadow-sm backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 md:flex-nowrap md:px-4">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-900 text-base font-black text-white shadow" title={PROJECT.brand}>
            {PROJECT.brand.charAt(0)}
          </div>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold text-slate-900">
              {PROJECT.name} <span className="text-[11px] font-medium text-slate-400">by Genurise</span>
            </div>
            <div className="hidden text-[11px] text-slate-500 sm:block">
              {PROJECT.brand} · {PROJECT.locality}
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="ml-auto flex min-w-0 flex-1 items-center gap-1 rounded-xl bg-slate-900/5 py-1 pl-2.5 pr-1 md:ml-4 md:max-w-xs" role="search">
          <Icon name="search" size={16} className="shrink-0 text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Go to flat no. (A-1204)"
            aria-label="Flat number"
            maxLength={12}
            className="min-w-0 flex-1 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-slate-400"
          />
          <button disabled={!q.trim()} className="rounded-lg bg-brand-700 px-3 py-1 text-xs font-semibold text-white disabled:opacity-40">
            Go
          </button>
        </form>

        <nav aria-label="Explorer tools" className="no-scrollbar -mx-1 flex w-full items-center gap-0.5 overflow-x-auto md:ml-auto md:w-auto">
          {panelBtn('filters', 'filter', 'Filters', activeFilterCount(filters))}
          {panelBtn('sun', 'sun', 'Sun path')}
          <ToolButton icon="status" label="Status" active={statusColors} onClick={() => set({ statusColors: !statusColors })} />
          {modeBtn('walk', 'walk', 'Walk')}
          {modeBtn('orbit', 'cube', '3D')}
          {modeBtn('plan', 'plan', 'Plan')}
          {modeBtn('floors', 'layers', 'Floors')}
          {panelBtn('compare', 'compare', 'Compare', compare.length)}
        </nav>
      </div>
    </header>
  );
}
