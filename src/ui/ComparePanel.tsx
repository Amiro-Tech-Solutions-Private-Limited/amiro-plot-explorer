import { FLAT_BY_ID, unitOf } from '../data/project';
import { useStore } from '../store/useStore';
import { priceOf } from '../lib/pricing';
import { formatArea, formatPrice, ordinal } from '../lib/format';
import { FACING_LONG } from '../lib/geometry';
import { vastuOf } from '../lib/vastu';
import { sunlightOf } from '../lib/sun';
import { STATUS_UI } from '../lib/colors';
import { DropPanel } from './Controls';
import { Icon } from './Icon';

export function ComparePanel() {
  const ids = useStore((s) => s.compare);
  const units = useStore((s) => s.units);
  const date = useStore((s) => s.sun.date);
  const { setPanel, toggleCompare, selectFlat } = useStore.getState();
  const flats = ids.map((id) => FLAT_BY_ID.get(id)!).filter(Boolean);

  const rows: { label: string; get: (i: number) => string; best?: 'min' | 'max'; num?: (i: number) => number }[] = [
    { label: 'Status', get: (i) => STATUS_UI[flats[i].status].label },
    { label: 'Configuration', get: (i) => unitOf(flats[i]).label },
    { label: 'Floor', get: (i) => ordinal(flats[i].floor), best: 'max', num: (i) => flats[i].floor },
    { label: 'Facing', get: (i) => FACING_LONG[flats[i].facing] },
    { label: 'View', get: (i) => flats[i].view.join(', ') },
    { label: 'Carpet area', get: (i) => formatArea(unitOf(flats[i]).carpet, units), best: 'max', num: (i) => unitOf(flats[i]).carpet },
    { label: 'Super built-up', get: (i) => formatArea(unitOf(flats[i]).superBuiltUp, units) },
    { label: 'Rate / sq ft', get: (i) => `₹ ${Math.round(priceOf(flats[i]).effectiveRate).toLocaleString('en-IN')}` },
    { label: 'All-inclusive price', get: (i) => formatPrice(priceOf(flats[i]).total), best: 'min', num: (i) => priceOf(flats[i]).total },
    { label: 'Vastu', get: (i) => '★'.repeat(vastuOf(flats[i]).stars) + '☆'.repeat(5 - vastuOf(flats[i]).stars), best: 'max', num: (i) => vastuOf(flats[i]).stars },
    { label: 'Direct sun', get: (i) => `${sunlightOf(flats[i], date).hours.toFixed(1)} h`, best: 'max', num: (i) => sunlightOf(flats[i], date).hours },
    { label: 'Car parks', get: (i) => String(unitOf(flats[i]).carParks) },
  ];

  return (
    <DropPanel title="Compare flats" onClose={() => setPanel(null)} className="md:w-[640px]">
      {flats.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-500">
          <Icon name="compare" size={28} className="mx-auto mb-2 text-slate-400" />
          Open any flat and tap <b>Add to compare</b> to pin up to 3 flats here.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead>
              <tr>
                <th className="w-32" />
                {flats.map((f) => (
                  <th key={f.id} className="px-2 pb-2">
                    <div className="flex items-center justify-between gap-1 rounded-xl bg-slate-900/5 px-2.5 py-1.5">
                      <button className="font-bold text-brand-700 hover:underline" onClick={() => selectFlat(f.id)}>
                        {f.id}
                      </button>
                      <button aria-label={`Remove ${f.id}`} onClick={() => toggleCompare(f.id)} className="text-slate-400 hover:text-slate-700">
                        <Icon name="close" size={14} />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                let bestIdx = -1;
                if (r.best && r.num && flats.length > 1) {
                  const vals = flats.map((_, i) => r.num!(i));
                  const target = r.best === 'min' ? Math.min(...vals) : Math.max(...vals);
                  if (vals.filter((v) => v === target).length === 1) bestIdx = vals.indexOf(target);
                }
                return (
                  <tr key={r.label} className="border-t border-slate-100">
                    <td className="py-2 pr-2 text-xs font-medium text-slate-500">{r.label}</td>
                    {flats.map((f, i) => (
                      <td key={f.id} className={`px-2 py-2 capitalize ${i === bestIdx ? 'font-semibold text-brand-700' : 'text-slate-800'}`}>
                        {r.get(i)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </DropPanel>
  );
}
