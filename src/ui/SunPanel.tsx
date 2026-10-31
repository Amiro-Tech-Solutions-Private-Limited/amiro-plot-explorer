import { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { istDate, minutesLabel, sunAt, sunTimes, todayIST } from '../lib/sun';
import { bearingLabel } from '../lib/geometry';
import { Chip, DropPanel, Label, Slider } from './Controls';
import { Icon } from './Icon';

export function SunPanel() {
  const sun = useStore((s) => s.sun);
  const { setSun, setPanel } = useStore.getState();
  const times = useMemo(() => sunTimes(sun.date), [sun.date]);
  const pos = useMemo(() => sunAt(istDate(sun.date, sun.minutes)), [sun.date, sun.minutes]);
  const year = sun.date.slice(0, 4);
  const presets = [
    { label: 'Today', date: todayIST() },
    { label: 'Summer (21 Jun)', date: `${year}-06-21` },
    { label: 'Equinox (21 Mar)', date: `${year}-03-21` },
    { label: 'Winter (21 Dec)', date: `${year}-12-21` },
  ];

  return (
    <DropPanel
      title="Sun path & shadows"
      onClose={() => {
        setSun({ playing: false });
        setPanel(null);
      }}
      className="md:w-[380px]"
    >
      <Label>Date</Label>
      <input
        type="date"
        value={sun.date}
        onChange={(e) => e.target.value && setSun({ date: e.target.value })}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
        aria-label="Date"
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <Chip key={p.label} active={sun.date === p.date} onClick={() => setSun({ date: p.date })}>
            {p.label}
          </Chip>
        ))}
        <Chip active={sun.minutes > times.sunset} onClick={() => setSun({ minutes: 20 * 60, playing: false })}>
          🌙 Night view
        </Chip>
      </div>

      <Label>Time of day (IST)</Label>
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSun({ playing: !sun.playing })}
          aria-label={sun.playing ? 'Pause' : 'Play day animation'}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-700 text-white shadow"
        >
          <Icon name={sun.playing ? 'pause' : 'play'} size={16} filled />
        </button>
        <div className="flex-1">
          <Slider
            label="Time of day"
            min={times.sunrise}
            max={times.sunset}
            step={5}
            value={Math.min(Math.max(sun.minutes, times.sunrise), times.sunset)}
            onChange={(minutes) => setSun({ minutes, playing: false })}
          />
          <div className="mt-1 flex justify-between text-[11px] text-slate-500">
            <span>Sunrise {minutesLabel(times.sunrise)}</span>
            <span>Sunset {minutesLabel(times.sunset)}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Stat label="Time" value={minutesLabel(sun.minutes)} />
        <Stat label="Altitude" value={`${Math.max(0, pos.altitude).toFixed(0)}°`} />
        <Stat label="Sun from" value={`${bearingLabel(pos.bearing)} · ${pos.bearing.toFixed(0)}°`} />
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Real-time shadows are computed for {sun.date} at the project's latitude. Pick a flat to see its direct-sunlight hours.
      </p>
    </DropPanel>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-900/5 px-2 py-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}
