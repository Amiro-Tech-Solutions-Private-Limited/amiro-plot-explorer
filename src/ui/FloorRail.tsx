import { PROJECT } from '../data/project';
import { useStore } from '../store/useStore';
import { useMatchSet } from '../store/hooks';
import { STATUS_COLOR, FILTERED_OUT } from '../lib/colors';
import { FLOORS } from '../lib/geometry';

export function FloorRail() {
  const floors = useStore((s) => s.floors);
  const selectedId = useStore((s) => s.selectedId);
  const { isolateFloor, setFloorsTower } = useStore.getState();
  const matchSet = useMatchSet();
  const flats = PROJECT.flats.filter((f) => f.tower === floors.tower);

  return (
    <aside
      aria-label="Floor selector"
      className="pointer-events-auto absolute right-2 z-10 flex max-h-[calc(100dvh-var(--hdr,64px)-120px)] w-[124px] flex-col rounded-2xl bg-white/85 p-2 shadow-xl ring-1 ring-black/5 backdrop-blur md:right-4"
      style={{ top: 'calc(var(--hdr, 64px) + 12px)' }}
    >
      <div className="mb-2 grid grid-cols-2 gap-1">
        {PROJECT.towers.map((t) => t.id).map((t) => (
          <button
            key={t}
            onClick={() => setFloorsTower(t)}
            className={`rounded-lg py-1 text-xs font-bold ${floors.tower === t ? 'bg-brand-700 text-white' : 'bg-slate-900/5 text-slate-700'}`}
            aria-pressed={floors.tower === t}
          >
            {t}
          </button>
        ))}
      </div>
      <button
        onClick={() => isolateFloor(null)}
        className={`mb-1 rounded-lg px-2 py-1 text-[11px] font-semibold ${floors.isolated == null ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-900/5'}`}
      >
        All floors
      </button>
      <div className="no-scrollbar flex-1 overflow-y-auto">
        {Array.from({ length: FLOORS }, (_, i) => FLOORS - i).map((fl) => {
          const row = flats.filter((f) => f.floor === fl).sort((a, b) => a.index - b.index);
          const active = floors.isolated === fl;
          return (
            <button
              key={fl}
              onClick={() => isolateFloor(fl)}
              aria-pressed={active}
              className={`flex w-full items-center justify-between rounded-lg px-2 py-1 text-xs ${active ? 'bg-brand-700 text-white' : 'text-slate-700 hover:bg-slate-900/5'}`}
            >
              <span className="w-5 text-left font-semibold tabular-nums">{fl}</span>
              <span className="flex gap-1">
                {row.map((f) => (
                  <span
                    key={f.id}
                    title={`${f.id} · ${f.status}`}
                    className={`h-2.5 w-2.5 rounded-full ${f.id === selectedId ? 'ring-2 ring-offset-1 ring-sky-400' : ''}`}
                    style={{ background: matchSet.has(f.id) ? STATUS_COLOR[f.status] : FILTERED_OUT }}
                  />
                ))}
              </span>
            </button>
          );
        })}
        <div className="px-2 py-1 text-xs text-slate-400">G · Lobby</div>
      </div>
    </aside>
  );
}
