import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { FLAT_BY_ID, PROJECT, towerName, unitOf } from '../data/project';
import type { Flat } from '../data/types';
import { useStore } from '../store/useStore';
import { priceOf, emi } from '../lib/pricing';
import { formatArea, formatINR, formatPrice, ordinal, roomSize, SQFT_TO_M2 } from '../lib/format';
import { FACING_LONG, FLOORS } from '../lib/geometry';
import { DIR_LONG, isVastuIdeal, roomDirection, vastuOf } from '../lib/vastu';
import { minutesLabel, sunlightOf } from '../lib/sun';
import { STATUS_UI } from '../lib/colors';
import { downloadBrochure } from '../lib/brochure';
import { FloorPlanSVG } from './FloorPlanSVG';
import { Slider } from './Controls';
import { Icon, type IconName } from './Icon';

function useDesktop() {
  const q = '(min-width: 768px)';
  const [d, setD] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setD(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return d;
}

export function FlatPanel() {
  const selectedId = useStore((s) => s.selectedId);
  const mode = useStore((s) => s.mode);
  const flat = selectedId ? FLAT_BY_ID.get(selectedId) : undefined;
  const desktop = useDesktop();
  const [full, setFull] = useState(false);
  const immersive = mode === 'walk' || mode === 'interior' || mode === 'balcony';

  useEffect(() => setFull(false), [selectedId]);

  const close = () => useStore.getState().selectFlat(null);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y < -60 || info.velocity.y < -400) setFull(true);
    else if (info.offset.y > 100 || info.velocity.y > 400) {
      if (full) setFull(false);
      else close();
    }
  };

  return (
    <AnimatePresence>
      {flat && !immersive && (
        desktop ? (
          <motion.aside
            key="desk"
            aria-label={`Flat ${flat.id} details`}
            initial={{ x: 440, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 440, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className="pointer-events-auto absolute bottom-4 right-4 z-20 flex w-[420px] flex-col overflow-hidden rounded-2xl border border-white/50 bg-white/92 shadow-2xl backdrop-blur-xl"
            style={{ top: 'calc(var(--hdr, 64px) + 12px)' }}
          >
            <FlatContent flat={flat} onClose={close} />
          </motion.aside>
        ) : (
          <motion.aside
            key="mob"
            aria-label={`Flat ${flat.id} details`}
            initial={{ y: '100%' }}
            animate={{ y: full ? '0%' : '48%' }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 34 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.25}
            onDragEnd={onDragEnd}
            className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 flex h-[88dvh] flex-col overflow-hidden rounded-t-3xl bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.25)]"
          >
            <button className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-slate-300" aria-label={full ? 'Collapse' : 'Expand'} onClick={() => setFull(!full)} />
            <FlatContent flat={flat} onClose={close} />
          </motion.aside>
        )
      )}
    </AnimatePresence>
  );
}

function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-t border-slate-100 px-4 py-4">
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-slate-900/[0.035] px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-[15px] font-semibold text-slate-900">{value}</div>
      {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

function Action({ icon, label, onClick, primary }: { icon: IconName; label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition ${
        primary ? 'bg-brand-700 text-white shadow hover:bg-brand-600' : 'bg-slate-900/5 text-slate-800 hover:bg-slate-900/10'
      }`}
    >
      <Icon name={icon} size={16} />
      {label}
    </button>
  );
}

function FlatContent({ flat, onClose }: { flat: Flat; onClose: () => void }) {
  const units = useStore((s) => s.units);
  const date = useStore((s) => s.sun.date);
  const compare = useStore((s) => s.compare);
  const { set, setMode, toggleCompare, showToast, setFilters, setPanel, selectFlat } = useStore.getState();
  const [hovered, setHovered] = useState<string | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const u = unitOf(flat);
  const p = priceOf(flat);
  const v = vastuOf(flat);
  const sun = useMemo(() => sunlightOf(flat, date), [flat, date]);
  const st = STATUS_UI[flat.status];

  const similar = useMemo(
    () =>
      PROJECT.flats
        .filter((f) => f.id !== flat.id && f.typeId === flat.typeId && f.status === 'available')
        .sort((a, b) => Math.abs(priceOf(a).total - p.total) - Math.abs(priceOf(b).total - p.total))
        .slice(0, 4),
    [flat, p.total],
  );

  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}?flat=${encodeURIComponent(flat.id)}`;
    try {
      if (navigator.share) await navigator.share({ title: `${PROJECT.name} · ${flat.id}`, text: `${u.label} · ${formatPrice(p.total)}`, url });
      else {
        await navigator.clipboard.writeText(url);
        showToast('Link copied to clipboard');
      }
    } catch {
      /* user cancelled share */
    }
  };

  return (
    <>
      <div className="flex items-start justify-between px-4 pb-3 pt-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Flat</div>
          <div className="text-2xl font-bold leading-none text-slate-900">{flat.id}</div>
          <div className="mt-1.5 text-[13px] text-slate-600">
            {u.label} · {FACING_LONG[flat.facing]} facing · {ordinal(flat.floor)} floor · <span className="capitalize">{flat.view[0]}</span> view
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${st.chip}`}>{st.label}</span>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-900/5">
            <Icon name="close" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5 px-4 pb-3 md:hidden">
        <button onClick={() => setMode('interior')} className="rounded-xl bg-slate-900/5 py-2 text-xs font-semibold text-slate-800">
          Walk inside
        </button>
        <button onClick={() => setMode('balcony')} className="rounded-xl bg-slate-900/5 py-2 text-xs font-semibold text-slate-800">
          Balcony view
        </button>
        <button onClick={() => set({ enquiryFor: flat.id })} className="rounded-xl bg-brand-700 py-2 text-xs font-semibold text-white">
          Enquire
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain" onPointerDown={(e) => e.stopPropagation()}>
        <div className="px-4 pb-3">
          <div className="rounded-2xl bg-slate-50 p-2 ring-1 ring-slate-100">
            <FloorPlanSVG flat={flat} hovered={hovered} onHover={setHovered} />
          </div>
          {u.duplex && (
            <p className="mt-2 text-xs text-slate-500">
              Upper level: {u.rooms.filter((r) => r.level).map((r) => r.name).join(', ')}.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 px-4 pb-4">
          <Fact label="Carpet area" value={formatArea(u.carpet, units)} sub={`Built-up ${formatArea(u.builtUp, units)}`} />
          <Fact label="Super built-up" value={formatArea(u.superBuiltUp, units)} sub={units === 'sqft' ? `${(u.superBuiltUp * SQFT_TO_M2).toFixed(1)} m²` : `${u.superBuiltUp} sq ft`} />
          <Fact label="Rate" value={`₹ ${Math.round(p.effectiveRate).toLocaleString('en-IN')}`} sub="per sq ft (incl. floor rise & PLC)" />
          <button className="text-left" onClick={() => setShowBreakdown(!showBreakdown)} aria-expanded={showBreakdown}>
            <Fact label="All-inclusive price" value={formatPrice(p.total)} sub={showBreakdown ? 'Hide breakdown' : 'View breakdown ▸'} />
          </button>
          {showBreakdown && (
            <div className="col-span-2 rounded-xl bg-slate-900/[0.035] p-3 text-[13px]">
              {(
                [
                  [`Base price (${u.superBuiltUp} × ₹${flat.baseRate.toLocaleString('en-IN')})`, p.base],
                  [`Floor rise (${Math.max(0, flat.floor - 1)} × ₹${PROJECT.pricing.floorRisePerFloor}/sq ft)`, p.floorRise],
                  ['PLC — corner / pool view', p.plc],
                  [`Car parking (${u.carParks})`, p.parking],
                  ['Club membership', p.club],
                  [`GST (${PROJECT.pricing.gstPct}%)`, p.gst],
                  [`Stamp duty & registration (${PROJECT.pricing.stampPct}%, est.)`, p.stamp],
                ] as [string, number][]
              ).map(([l, val]) => (
                <div key={l} className="flex justify-between gap-2 py-0.5">
                  <span className="text-slate-600">{l}</span>
                  <span className="tabular-nums text-slate-900">{formatINR(val)}</span>
                </div>
              ))}
              <div className="mt-1 flex justify-between border-t border-slate-200 pt-1.5 font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{formatINR(p.total)}</span>
              </div>
            </div>
          )}
          <Fact label="Floor" value={ordinal(flat.floor)} sub={`${towerName(flat.tower)} · of ${FLOORS}`} />
          <Fact label="Facing" value={FACING_LONG[flat.facing]} sub={flat.corner ? 'Corner flat' : 'Main balcony side'} />
          <Fact label="Balconies" value={String(u.balconies)} sub={u.duplex ? 'incl. private terrace' : undefined} />
          <Fact label="Car parks" value={String(u.carParks)} sub="Covered, basement" />
        </div>

        <Section
          title="Room schedule"
          right={
            <div className="flex rounded-lg bg-slate-900/5 p-0.5 text-[11px] font-semibold">
              {(['sqft', 'm2'] as const).map((k) => (
                <button key={k} onClick={() => set({ units: k })} className={`rounded-md px-2 py-0.5 ${units === k ? 'bg-white shadow' : 'text-slate-500'}`}>
                  {k === 'sqft' ? 'ft' : 'm'}
                </button>
              ))}
            </div>
          }
        >
          <div className="divide-y divide-slate-100">
            {u.rooms
              .filter((r) => !r.level)
              .map((r) => {
                const dir = roomDirection(flat, r);
                const ok = isVastuIdeal(r, dir);
                return (
                  <div
                    key={r.name}
                    onPointerEnter={() => setHovered(r.name)}
                    onPointerLeave={() => setHovered(null)}
                    className={`grid grid-cols-[1fr_auto_96px] items-center gap-2 rounded-lg px-1.5 py-1.5 text-[13px] ${hovered === r.name ? 'bg-brand-50' : ''}`}
                  >
                    <span className="font-medium text-slate-800">{r.name}</span>
                    <span className="tabular-nums text-slate-600">{roomSize(r.w, r.h, units)}</span>
                    <span className={`text-right text-xs ${ok ? 'font-semibold text-brand-700' : 'text-slate-500'}`}>
                      {ok && '✓ '}
                      {DIR_LONG[dir]}
                    </span>
                  </div>
                );
              })}
          </div>
          <p className="mt-2 text-[11px] text-slate-500">Indicative layout. Hover a room to highlight it on the plan.</p>
        </Section>

        <Section
          title="Vastu"
          right={
            <span className="flex text-amber-500" aria-label={`${v.stars} out of 5`}>
              {Array.from({ length: 5 }, (_, i) => (
                <Icon key={i} name="star" size={15} filled={i < v.stars} className={i < v.stars ? '' : 'text-slate-300'} />
              ))}
            </span>
          }
        >
          <p className="text-[13px] text-slate-700">{v.text}</p>
          <div className="mt-2 rounded-xl bg-amber-50 p-3 text-[13px]">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">Main door opens to the {FACING_LONG[v.entranceDir as keyof typeof FACING_LONG]}</div>
            <div className="mt-0.5 text-slate-800">Recommended entrance: {v.pada}</div>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {v.checks.map((c) => (
              <div key={c.label} className={`rounded-xl p-2 text-center text-[11px] ${c.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-900/[0.035] text-slate-600'}`}>
                <div className="font-semibold">
                  {c.ok ? '✓' : '•'} {c.label}
                </div>
                <div>{c.detail}</div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-slate-500">General vastu guidance. For a detailed assessment, consult a vastu expert.</p>
        </Section>

        <Section
          title="Sunlight"
          right={<span className="text-xs text-slate-500">{date}</span>}
        >
          <div className="flex items-center gap-3">
            <div className="text-2xl font-bold text-slate-900">{sun.hours.toFixed(1)} h</div>
            <div className="text-xs text-slate-500">direct sun on the façade</div>
            <div className="ml-auto flex gap-1">
              {sun.morning && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Morning sun</span>}
              {sun.evening && <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-800">Evening sun</span>}
            </div>
          </div>
          <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-slate-200" aria-hidden>
            {sun.strip.map((s) => (
              <div key={s.min} className={`flex-1 ${s.lit ? 'bg-amber-400' : 'bg-slate-300'}`} />
            ))}
          </div>
          {sun.strip.length > 0 && (
            <div className="mt-1 flex justify-between text-[10px] text-slate-500">
              <span>{minutesLabel(sun.strip[0].min)}</span>
              <span>Noon</span>
              <span>{minutesLabel(sun.strip[sun.strip.length - 1].min)}</span>
            </div>
          )}
          <button onClick={() => setPanel('sun')} className="mt-2 text-xs font-semibold text-brand-700 hover:underline">
            Change date / animate shadows →
          </button>
        </Section>

        <EmiCalculator total={p.total} />

        {similar.length > 0 && (
          <Section title="Similar available flats">
            <div className="flex flex-wrap gap-1.5">
              {similar.map((s) => (
                <button key={s.id} onClick={() => selectFlat(s.id)} className="rounded-xl bg-slate-900/5 px-2.5 py-1.5 text-left text-xs hover:bg-brand-50">
                  <div className="font-semibold text-slate-900">{s.id}</div>
                  <div className="text-slate-500">
                    {ordinal(s.floor)} · {s.facing} · {formatPrice(priceOf(s).total)}
                  </div>
                </button>
              ))}
            </div>
          </Section>
        )}

        <div className="h-24 md:h-4" />
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-slate-100 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Action icon="balcony" label="Step onto balcony" onClick={() => setMode('balcony')} />
        <Action icon="door" label="Walk inside" onClick={() => setMode('interior')} />
        <Action
          icon="similar"
          label="Similar flats"
          onClick={() => {
            setFilters({ configs: [flat.typeId], availableOnly: true });
            setPanel('filters');
            showToast(`Showing available ${u.label} flats`);
          }}
        />
        <Action icon={compare.includes(flat.id) ? 'check' : 'compare'} label={compare.includes(flat.id) ? 'In compare' : 'Add to compare'} onClick={() => toggleCompare(flat.id)} />
        <Action icon="share" label="Share" onClick={share} />
        <Action icon="download" label="Brochure" onClick={() => downloadBrochure(flat).catch(() => showToast('Could not create PDF'))} />
        <div className="col-span-2">
          <Action icon="phone" label={flat.status === 'sold' ? 'Enquire about resale / similar' : 'Enquire / Book site visit'} primary onClick={() => set({ enquiryFor: flat.id })} />
        </div>
      </div>
    </>
  );
}

function EmiCalculator({ total }: { total: number }) {
  const [down, setDown] = useState(20);
  const [rate, setRate] = useState(8.5);
  const [years, setYears] = useState(20);
  const loan = total * (1 - down / 100);
  const m = emi(loan, rate, years);
  const interest = m * years * 12 - loan;
  return (
    <Section title="EMI calculator">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <div className="text-2xl font-bold text-slate-900">{formatINR(m)}</div>
          <div className="text-xs text-slate-500">per month</div>
        </div>
        <div className="text-right text-xs text-slate-500">
          Loan {formatPrice(loan)}
          <br />
          Interest {formatPrice(interest)}
        </div>
      </div>
      <Row label="Down payment" value={`${down}% · ${formatPrice(total * (down / 100))}`}>
        <Slider label="Down payment percent" min={10} max={60} step={5} value={down} onChange={setDown} />
      </Row>
      <Row label="Interest rate" value={`${rate.toFixed(2)}%`}>
        <Slider label="Interest rate" min={6.5} max={12} step={0.05} value={rate} onChange={setRate} />
      </Row>
      <Row label="Tenure" value={`${years} years`}>
        <Slider label="Tenure in years" min={5} max={30} step={1} value={years} onChange={setYears} />
      </Row>
    </Section>
  );
}

function Row({ label, value, children }: { label: string; value: string; children: ReactNode }) {
  return (
    <div className="mb-2">
      <div className="mb-0.5 flex justify-between text-xs">
        <span className="text-slate-500">{label}</span>
        <span className="font-semibold text-slate-800">{value}</span>
      </div>
      {children}
    </div>
  );
}
