import { PROJECT } from '../data/project';
import type { Facing, View } from '../data/types';
import { useStore } from '../store/useStore';
import { useMatchSet } from '../store/hooks';
import { AREA_RANGE, PRICE_RANGE } from '../lib/pricing';
import { formatPrice } from '../lib/format';
import { Chip, DropPanel, Label, RangeSlider } from './Controls';
import { FLOORS } from '../lib/geometry';

const FACINGS: Facing[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const VIEWS: { id: View; label: string }[] = [
  { id: 'pool', label: 'Pool' },
  { id: 'garden', label: 'Garden' },
  { id: 'road', label: 'Road' },
  { id: 'city', label: 'City' },
];

export function FiltersPanel() {
  const f = useStore((s) => s.filters);
  const { toggleIn, setFilters, clearFilters, setPanel } = useStore.getState();
  const n = useMatchSet().size;
  const total = PROJECT.flats.length;

  return (
    <DropPanel title="Find a flat" onClose={() => setPanel(null)} className="md:w-[400px]">
      <Label>Tower</Label>
      <div className="flex flex-wrap gap-1.5">
        {PROJECT.towers.map((t) => (
          <Chip key={t.id} active={f.towers.includes(t.id)} onClick={() => toggleIn('towers', t.id)}>
            {t.name}
          </Chip>
        ))}
      </div>

      <Label>Configuration</Label>
      <div className="flex flex-wrap gap-1.5">
        {PROJECT.unitTypes.map((u) => (
          <Chip key={u.id} active={f.configs.includes(u.id)} onClick={() => toggleIn('configs', u.id)}>
            {u.label}
          </Chip>
        ))}
      </div>

      <Label>Facing</Label>
      <div className="grid grid-cols-4 gap-1.5">
        {FACINGS.map((d) => (
          <Chip key={d} active={f.facings.includes(d)} onClick={() => toggleIn('facings', d)}>
            {d}
          </Chip>
        ))}
      </div>

      <Label>Floor</Label>
      <RangeSlider label="Floor" min={1} max={FLOORS} step={1} value={f.floor} onChange={(floor) => setFilters({ floor })} format={(v) => `Floor ${v}`} />

      <Label>Carpet area</Label>
      <RangeSlider
        label="Carpet area"
        min={AREA_RANGE[0]}
        max={AREA_RANGE[1]}
        step={10}
        value={f.area}
        onChange={(area) => setFilters({ area })}
        format={(v) => `${v.toLocaleString('en-IN')} sq ft`}
      />

      <Label>Budget (all-inclusive)</Label>
      <RangeSlider
        label="Budget"
        min={PRICE_RANGE[0]}
        max={PRICE_RANGE[1]}
        step={100000}
        value={f.budget}
        onChange={(budget) => setFilters({ budget })}
        format={(v) => formatPrice(v)}
      />

      <Label>View</Label>
      <div className="flex flex-wrap gap-1.5">
        {VIEWS.map((v) => (
          <Chip key={v.id} active={f.views.includes(v.id)} onClick={() => toggleIn('views', v.id)}>
            {v.label}
          </Chip>
        ))}
      </div>

      <Label>Quick toggles</Label>
      <div className="flex flex-wrap gap-1.5">
        <Chip active={f.availableOnly} onClick={() => setFilters({ availableOnly: !f.availableOnly })}>
          Available only
        </Chip>
        <Chip active={f.corner} onClick={() => setFilters({ corner: !f.corner })}>
          Corner flats
        </Chip>
        <Chip active={f.vastu} onClick={() => setFilters({ vastu: !f.vastu })} title="Vastu score 4★ and above">
          Vastu-compliant
        </Chip>
        <Chip active={f.high} onClick={() => setFilters({ high: !f.high })}>
          Higher floors (&gt;15)
        </Chip>
      </div>

      <div className="sticky -bottom-4 -mx-4 -mb-4 mt-4 flex items-center justify-between border-t border-slate-200 bg-white/95 px-4 py-3">
        <span className="text-sm text-slate-700">
          <b className="text-slate-900">{n}</b> of {total} flats match
        </span>
        <button onClick={clearFilters} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-50">
          Clear all
        </button>
      </div>
    </DropPanel>
  );
}
