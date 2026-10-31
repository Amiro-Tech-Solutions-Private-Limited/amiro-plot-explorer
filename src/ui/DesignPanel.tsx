import { useMemo, useState } from 'react';
import { FLAT_BY_ID } from '../data/project';
import { useStore } from '../store/useStore';
import { flatXform, furnishedOf } from '../lib/interiorFrame';
import { CATALOG, CATALOG_BY_ID, CATEGORY_LABEL, type Category } from '../lib/catalog';
import { clearances, encodeDesign, groupsOf, MIN_CLEAR, roomSpace, type Group } from '../lib/design';
import {
  addItem,
  canRedo,
  canUndo,
  designOf,
  emptyRoom,
  recolorGroup,
  redoDesign,
  removeGroup,
  replaceGroup,
  resetDesign,
  rotateGroup,
  undoDesign,
} from '../lib/designStore';
import { fitsAt } from '../scene/DesignLayer';
import type { Flat, Room } from '../data/types';

const btn = 'rounded-lg px-2 py-1.5 text-xs font-semibold transition disabled:opacity-35';
const ghost = `${btn} bg-slate-900/5 hover:bg-slate-900/10 text-slate-700`;
const primary = `${btn} bg-brand-700 text-white hover:bg-brand-600`;

const sqft = (m2: number) => Math.round(m2 * 10.764);
const ftIn = (m: number) => {
  const inches = Math.round(m * 39.37);
  return `${Math.floor(inches / 12)}′${inches % 12}″`;
};

/** Find a free spot for a footprint in a room (grid search, 0° / 90°). */
function findSpot(flat: Flat, room: Room, w: number, d: number, groups: Group[], cat: Category | null) {
  for (const rot of [0, Math.PI / 2]) {
    const hx = (rot ? d : w) / 2;
    const hz = (rot ? w : d) / 2;
    const xs: number[] = [];
    const zs: number[] = [];
    for (let x = room.x + hx + 0.1; x <= room.x + room.w - hx - 0.1 + 1e-6; x += 0.1) xs.push(x);
    for (let z = room.y + hz + 0.1; z <= room.y + room.h - hz - 0.1 + 1e-6; z += 0.1) zs.push(z);
    // Prefer the centre, then spiral outwards.
    const cx = room.x + room.w / 2;
    const cz = room.y + room.h / 2;
    const pts = xs.flatMap((x) => zs.map((z) => [x, z] as [number, number])).sort((a, b) => Math.hypot(a[0] - cx, a[1] - cz) - Math.hypot(b[0] - cx, b[1] - cz));
    for (const [x, z] of pts) {
      const g: Group = { key: '__probe', room: room.name, feature: 'probe', category: cat, label: '', cx: x, cz: z, hx: w / 2, hz: d / 2, rot, h: 1, front: rot };
      if (fitsAt(g, groups, 0, 0, flat)) return { x, z, rot };
    }
  }
  return null;
}

function useFlatGroups(flat: Flat | undefined) {
  const furnishing = useStore((s) => s.furnishing);
  const themes = useStore((s) => s.themes);
  const design = useStore((s) => (flat ? s.design[flat.id] : undefined));
  return useMemo(() => (flat ? groupsOf(furnishedOf(flat, furnishing, themes[flat.id]).pieces, flatXform(flat).layout, design) : []), [flat, furnishing, themes, design]);
}

export function DesignPanel() {
  const mode = useStore((s) => s.mode);
  const on = useStore((s) => s.designMode);
  const sel = useStore((s) => s.designSel);
  const top = useStore((s) => s.designTop);
  const selectedId = useStore((s) => s.selectedId);
  const currentRoom = useStore((s) => s.currentRoom);
  useStore((s) => (selectedId ? s.design[selectedId]?.rev : 0));
  const flat = selectedId ? FLAT_BY_ID.get(selectedId) : undefined;
  const groups = useFlatGroups(flat);
  const [tab, setTab] = useState<'item' | 'add' | 'fit'>('item');
  const [cat, setCat] = useState<Category>('sofa');
  const [fit, setFit] = useState({ w: 180, d: 90, h: 80 });
  const [fitMsg, setFitMsg] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  if (mode !== 'interior' || !on || !flat) return null;

  const L = flatXform(flat).layout;
  const g = groups.find((x) => x.key === sel) ?? null;
  const roomName = g?.room ?? (currentRoom && L.rooms.some((r) => r.name === currentRoom) ? currentRoom : L.rooms.find((r) => r.kind === 'living')?.name);
  const room = L.rooms.find((r) => r.name === roomName);
  const space = room ? roomSpace(room, groups) : null;
  const cl = g && room ? clearances(g, room, groups) : [];
  const need = g?.category ? MIN_CLEAR[g.category] ?? 0 : 0;
  const front = cl.find((c) => c.dir === 'front');
  const swaps = g?.category ? CATALOG.filter((c) => c.category === g.category && c.category !== 'custom') : [];
  const swatches = g ? (g.catalog ? CATALOG_BY_ID.get(g.catalog)?.colors : g.category === 'sofa' || g.category === 'bed' || g.category === 'chair' ? CATALOG_BY_ID.get('sofa3')!.colors : null) : null;
  const S = useStore.getState();

  const add = (id: string, size?: { w: number; d: number; h: number }) => {
    if (!room) return;
    const c = CATALOG_BY_ID.get(id)!;
    const w = size ? size.w : c.w;
    const d = size ? size.d : c.d;
    const spot = findSpot(flat, room, w, d, groups, c.category);
    if (!spot) {
      S.showToast(`No free spot for a ${Math.round(w * 100)}×${Math.round(d * 100)} cm item in the ${room.name.toLowerCase()} — try another room or move things`);
      return null;
    }
    addItem(flat.id, { cat: id, room: room.name, x: spot.x, z: spot.z, rot: spot.rot, size });
    setTab('item');
    return spot;
  };

  const share = async () => {
    const url = `${location.origin}${location.pathname}?flat=${flat.id}&lay=${encodeDesign(designOf(flat.id))}`;
    try {
      await navigator.clipboard.writeText(url);
      S.showToast('Layout link copied — open it to see this furniture layout');
    } catch {
      window.prompt('Copy this link', url);
    }
  };

  return (
    <div className="pointer-events-auto absolute left-2 top-[calc(var(--hdr,64px)+8px)] z-20 w-[300px] max-w-[calc(100vw-16px)] rounded-2xl bg-white/95 text-slate-800 shadow-2xl ring-1 ring-black/5 backdrop-blur md:left-4">
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
        <div className="flex-1 leading-tight">
          <div className="text-sm font-semibold">🛋 Design your home</div>
          <div className="text-[11px] text-slate-500">{flat.id} · drag furniture · tap to select</div>
        </div>
        <button className={ghost} onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? '–' : '+'}
        </button>
        <button className={primary} onClick={() => useStore.setState({ designMode: false, designSel: null, designTop: false })}>
          Done
        </button>
      </div>
      {open && (
        <div className="max-h-[calc(100dvh-var(--hdr,64px)-190px)] overflow-y-auto px-3 py-2">
          <div className="mb-2 grid grid-cols-4 gap-1">
            <button className={top ? primary : ghost} onClick={() => useStore.setState({ designTop: !top })} title="Top view">
              ⬒ Top
            </button>
            <button className={ghost} disabled={!canUndo(flat.id)} onClick={() => undoDesign(flat.id)} title="Undo (Ctrl+Z)">
              ↶ Undo
            </button>
            <button className={ghost} disabled={!canRedo(flat.id)} onClick={() => redoDesign(flat.id)} title="Redo (Ctrl+Y)">
              ↷ Redo
            </button>
            <button className={ghost} onClick={share} title="Copy a link to this layout">
              🔗 Share
            </button>
          </div>

          {room && space && (
            <div className="mb-2 rounded-xl bg-slate-50 p-2">
              <div className="flex items-baseline justify-between">
                <div className="text-xs font-semibold">{room.name}</div>
                <div className="text-[11px] text-slate-500">
                  {ftIn(room.w)} × {ftIn(room.h)} · {sqft(space.area)} ft²
                </div>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-emerald-100">
                <div className={`h-full ${space.pct > 55 ? 'bg-red-400' : space.pct > 40 ? 'bg-amber-400' : 'bg-brand-600'}`} style={{ width: `${Math.min(100, space.pct)}%` }} />
              </div>
              <div className="mt-1 flex justify-between text-[11px]">
                <span>
                  Free floor: <b>{sqft(space.free)} ft²</b> ({space.free.toFixed(1)} m²)
                </span>
                <span className="text-slate-500">{Math.round(space.pct)}% used</span>
              </div>
              <div className="mt-1.5 flex gap-1">
                <button className={`${ghost} flex-1`} onClick={() => emptyRoom(flat.id, room.name, groups.map((x) => x.key))}>
                  Empty room
                </button>
                <button className={`${ghost} flex-1`} onClick={() => resetDesign(flat.id)}>
                  Reset to sample
                </button>
              </div>
            </div>
          )}

          <div className="mb-2 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-0.5">
            {(
              [
                ['item', 'Selected'],
                ['add', 'Add'],
                ['fit', 'Will it fit?'],
              ] as const
            ).map(([k, l]) => (
              <button key={k} className={`${btn} ${tab === k ? 'bg-white shadow text-slate-900' : 'text-slate-600'}`} onClick={() => setTab(k)}>
                {l}
              </button>
            ))}
          </div>

          {tab === 'item' &&
            (g ? (
              <div>
                <div className="flex items-baseline justify-between">
                  <div className="text-sm font-semibold">{g.label}</div>
                  <div className="text-[11px] text-slate-500">
                    {Math.round(g.hx * 200)}×{Math.round(g.hz * 200)} cm
                  </div>
                </div>
                {front && need > 0 && (
                  <div className={`mt-1 rounded-lg px-2 py-1 text-[11px] ${front.gap >= need ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>
                    {front.gap >= need ? '✓' : '⚠'} {ftIn(front.gap)} ({Math.round(front.gap * 100)} cm) free in front — {front.gap >= need ? 'comfortable to walk' : `aim for at least ${Math.round(need * 100)} cm`}
                  </div>
                )}
                <div className="mt-2 grid grid-cols-4 gap-1">
                  <button className={ghost} onClick={() => rotateGroup(flat.id, g.key, Math.PI / 12)}>
                    ⟲ 15°
                  </button>
                  <button className={ghost} onClick={() => rotateGroup(flat.id, g.key, -Math.PI / 12)}>
                    ⟳ 15°
                  </button>
                  <button className={ghost} onClick={() => rotateGroup(flat.id, g.key, Math.PI / 2)}>
                    ↻ 90°
                  </button>
                  <button className={`${btn} bg-red-50 text-red-700 hover:bg-red-100`} onClick={() => removeGroup(flat.id, g.key)}>
                    🗑
                  </button>
                </div>
                {swatches && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {swatches.map((c) => (
                      <button key={c} className="h-6 w-6 rounded-full ring-2 ring-white shadow" style={{ background: c }} onClick={() => recolorGroup(flat.id, g.key, c)} aria-label={`Colour ${c}`} />
                    ))}
                  </div>
                )}
                {swaps.length > 0 && (
                  <>
                    <div className="mb-1 mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Replace with…</div>
                    <div className="grid grid-cols-2 gap-1">
                      {swaps.map((c) => (
                        <button
                          key={c.id}
                          className={`${g.catalog === c.id ? primary : ghost} text-left`}
                          onClick={() => {
                            const probe: Group = { ...g, hx: c.w / 2, hz: c.d / 2, rot: g.front };
                            if (!fitsAt(probe, groups.filter((x) => x.key !== g.key), 0, 0, flat)) S.showToast(`${c.name} (${Math.round(c.w * 100)}×${Math.round(c.d * 100)} cm) overlaps something here — move it after swapping`);
                            replaceGroup(flat.id, g.key, c.id);
                          }}
                        >
                          <div>{c.name}</div>
                          <div className="text-[10px] font-normal opacity-70">
                            {Math.round(c.w * 100)}×{Math.round(c.d * 100)} cm
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">Tap a piece of furniture to move, rotate, swap or remove it. Drag it to a new spot — it snaps to walls and turns red if it doesn’t fit.</div>
            ))}

          {tab === 'add' && (
            <div>
              <div className="mb-1.5 flex flex-wrap gap-1">
                {(Object.keys(CATEGORY_LABEL) as Category[])
                  .filter((c) => c !== 'custom' && CATALOG.some((x) => x.category === c))
                  .map((c) => (
                    <button key={c} className={`${cat === c ? primary : ghost} !py-1`} onClick={() => setCat(c)}>
                      {CATEGORY_LABEL[c]}
                    </button>
                  ))}
              </div>
              <div className="grid grid-cols-2 gap-1">
                {CATALOG.filter((c) => c.category === cat).map((c) => (
                  <button key={c.id} className={`${ghost} text-left`} onClick={() => add(c.id)}>
                    <div>{c.name}</div>
                    <div className="text-[10px] font-normal opacity-70">
                      {Math.round(c.w * 100)}×{Math.round(c.d * 100)} cm
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-1.5 text-[11px] text-slate-500">Adds to the {room?.name.toLowerCase()} at the first free spot.</div>
            </div>
          )}

          {tab === 'fit' && room && (
            <div>
              <div className="text-xs text-slate-600">Enter your own furniture’s size to see if it fits in the {room.name.toLowerCase()}.</div>
              <div className="mt-2 grid grid-cols-3 gap-1">
                {(['w', 'd', 'h'] as const).map((k) => (
                  <label key={k} className="text-[11px] text-slate-500">
                    {k === 'w' ? 'Width' : k === 'd' ? 'Depth' : 'Height'} (cm)
                    <input
                      type="number"
                      min={10}
                      max={k === 'h' ? 280 : 400}
                      value={fit[k]}
                      onChange={(e) => setFit({ ...fit, [k]: Math.max(10, Math.min(k === 'h' ? 280 : 400, Number(e.target.value) || 0)) })}
                      className="mt-0.5 w-full rounded-lg bg-slate-100 px-2 py-1 text-sm text-slate-900 outline-none"
                    />
                  </label>
                ))}
              </div>
              <button
                className={`${primary} mt-2 w-full`}
                onClick={() => {
                  const size = { w: fit.w / 100, d: fit.d / 100, h: fit.h / 100 };
                  const spot = add('custom', size);
                  if (!spot) {
                    setFitMsg(`✗ A ${fit.w}×${fit.d} cm item doesn’t fit anywhere in the ${room.name.toLowerCase()} with the current furniture.`);
                    return;
                  }
                  const free = roomSpace(room, groups).free - size.w * size.d;
                  setFitMsg(`✓ Fits. Placed it for you — about ${sqft(Math.max(0, free))} ft² of floor stays free. Drag it around to try other spots.`);
                }}
              >
                Check & place
              </button>
              {fitMsg && <div className={`mt-2 rounded-lg px-2 py-1.5 text-[11px] ${fitMsg.startsWith('✓') ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{fitMsg}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
