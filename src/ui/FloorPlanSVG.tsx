import { useEffect, useMemo, useRef } from 'react';
import type { Flat } from '../data/types';
import { towerOf, unitOf } from '../data/project';
import { BALC_D, flatFrame, FLAT_D, FLAT_W } from '../lib/geometry';
import { flatXform } from '../lib/interiorFrame';
import { floorColor, interiorFor } from '../data/interiors';
import { feetInches } from '../lib/format';
import { runtime } from '../store/runtime';

/** North arrow angle (deg, clockwise from screen-up) in the plan drawing. */
function northAngle(flat: Flat) {
  const t = towerOf(flat);
  const s = flatFrame(flat.index).s;
  // plan +x → local s·X, plan +y → local s·Z; world north = (0, 0, -1)
  const r = t.rotationY;
  const px = s * Math.sin(r);
  const py = s * -Math.cos(r);
  return (Math.atan2(px, -py) * 180) / Math.PI;
}

export function FloorPlanSVG({
  flat,
  hovered,
  onHover,
  onRoomClick,
  live,
  compact,
}: {
  flat: Flat;
  hovered: string | null;
  onHover: (n: string | null) => void;
  onRoomClick?: (name: string, x: number, y: number) => void;
  /** Show the walking visitor's live position. */
  live?: boolean;
  compact?: boolean;
}) {
  const u = unitOf(flat);
  const fr = flatFrame(flat.index);
  const layout = flatXform(flat).layout;
  const theme = interiorFor(flat).theme;
  const north = useMemo(() => northAngle(flat), [flat]);
  const marker = useRef<SVGGElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!live) return;
    let raf = 0;
    const tick = () => {
      const p = runtime.plan;
      if (marker.current) {
        marker.current.style.display = p.valid ? '' : 'none';
        marker.current.setAttribute('transform', `translate(${p.x} ${p.y}) rotate(${(-p.heading * 180) / Math.PI})`);
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [live]);
  const pad = 1.6;
  const vb = `${-pad} ${-pad - 0.6} ${FLAT_W + pad * 2} ${FLAT_D + BALC_D + pad * 2 + 0.6}`;
  const T = 0.14;

  return (
    <svg ref={svg} viewBox={vb} className="h-auto w-full select-none" role="img" aria-label={`Floor plan of flat ${flat.id}`}>
      <defs>
        <pattern id="hatch" width="0.3" height="0.3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="0.3" stroke="#a8998a" strokeWidth="0.05" />
        </pattern>
      </defs>

      <text x={FLAT_W / 2} y={-0.95} textAnchor="middle" fontSize="0.42" fill="#64748b" letterSpacing="0.08">
        CORRIDOR · LIFT LOBBY
      </text>

      {layout.rooms.map((r) => {
        const hot = hovered === r.name;
        return (
          <g
            key={r.name}
            onPointerEnter={() => onHover(r.name)}
            onPointerLeave={() => onHover(null)}
            onClick={() => onRoomClick?.(r.name, r.x + r.w / 2, r.y + r.h / 2)}
            className={onRoomClick ? 'cursor-pointer' : 'cursor-default'}
          >
            <rect
              x={r.x}
              y={r.y}
              width={r.w}
              height={r.h}
              fill={r.kind === 'balcony' ? 'url(#hatch)' : floorColor(theme, r.kind)}
              opacity={hot ? 1 : 0.55}
              stroke={hot ? '#0b6b4c' : 'none'}
              strokeWidth={hot ? 0.1 : 0}
            />
            {r.kind === 'balcony' && <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="#d9cfc2" opacity={0.35} pointerEvents="none" />}
            <text
              x={r.x + r.w / 2}
              y={r.y + r.h / 2 + (r.h > 1.6 ? -0.05 : 0.15)}
              textAnchor="middle"
              fontSize={r.w < 2 || r.h < 1.6 ? 0.34 : 0.46}
              fontWeight={600}
              fill={hot ? '#064e3b' : '#1e293b'}
              pointerEvents="none"
            >
              {r.name.replace('Master Bedroom', 'Master').replace('Master Toilet', 'M. Toilet').replace('Family Lounge', 'Lounge')}
            </text>
            {!compact && r.h > 1.6 && r.w > 2 && (
              <text x={r.x + r.w / 2} y={r.y + r.h / 2 + 0.5} textAnchor="middle" fontSize="0.32" fill="#475569" pointerEvents="none">
                {feetInches(r.w)} × {feetInches(r.h)}
              </text>
            )}
          </g>
        );
      })}

      {layout.segs.map((s, i) => {
        const horiz = s.y1 === s.y2;
        if (s.kind === 'railing') return <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="#64748b" strokeWidth={0.06} />;
        if (s.kind === 'wall') return <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="#1f2937" strokeWidth={T} strokeLinecap="square" />;
        const g0 = s.gapC! - s.gapW! / 2;
        const g1 = s.gapC! + s.gapW! / 2;
        const a = horiz ? s.x1 : s.y1;
        const b = horiz ? s.x2 : s.y2;
        const f = horiz ? s.y1 : s.x1;
        const L = (p: number, q: number, k: string, sw = T) =>
          horiz ? <line key={k} x1={p} y1={f} x2={q} y2={f} stroke="#1f2937" strokeWidth={sw} /> : <line key={k} x1={f} y1={p} x2={f} y2={q} stroke="#1f2937" strokeWidth={sw} />;
        const parts = [L(a, g0, 'a'), L(g1, b, 'b')];
        if (s.kind === 'window') {
          parts.push(
            horiz ? (
              <g key="w">
                <line x1={g0} y1={f - 0.05} x2={g1} y2={f - 0.05} stroke="#38bdf8" strokeWidth={0.04} />
                <line x1={g0} y1={f + 0.05} x2={g1} y2={f + 0.05} stroke="#38bdf8" strokeWidth={0.04} />
              </g>
            ) : (
              <g key="w">
                <line x1={f - 0.05} y1={g0} x2={f - 0.05} y2={g1} stroke="#38bdf8" strokeWidth={0.04} />
                <line x1={f + 0.05} y1={g0} x2={f + 0.05} y2={g1} stroke="#38bdf8" strokeWidth={0.04} />
              </g>
            ),
          );
        } else if (s.kind === 'slide') {
          parts.push(L(g0, (g0 + g1) / 2 + 0.1, 's1', 0.05), L((g0 + g1) / 2 - 0.1, g1, 's2', 0.05));
        } else {
          // Door swing arc into the first room
          const w = g1 - g0;
          const r0 = layout.rooms[s.rooms[0]];
          const sign = horiz ? (r0.y + r0.h / 2 > f ? 1 : -1) : r0.x + r0.w / 2 > f ? 1 : -1;
          const d = horiz
            ? `M ${g0} ${f} L ${g0} ${f + sign * w} A ${w} ${w} 0 0 ${sign > 0 ? 0 : 1} ${g1} ${f}`
            : `M ${f} ${g0} L ${f + sign * w} ${g0} A ${w} ${w} 0 0 ${sign > 0 ? 1 : 0} ${f} ${g1}`;
          parts.push(<path key="d" d={d} fill="none" stroke={s.kind === 'entry' ? '#0b6b4c' : '#64748b'} strokeWidth={0.04} />);
        }
        return <g key={i}>{parts}</g>;
      })}

      {/* Entry marker */}
      {(() => {
        const e = layout.segs.find((s) => s.kind === 'entry');
        if (!e) return null;
        return (
          <g>
            <path d={`M ${e.gapC} ${-0.75} l 0.3 -0.35 h -0.6 z`} fill="#0b6b4c" transform={`rotate(180 ${e.gapC} ${-0.62})`} />
            <text x={e.gapC! + 0.45} y={-0.3} fontSize="0.32" fontWeight={700} fill="#0b6b4c">
              ENTRY
            </text>
          </g>
        );
      })()}

      {/* Dimensions */}
      <g stroke="#94a3b8" strokeWidth={0.03} fill="#475569" fontSize="0.36">
        <line x1={0} y1={FLAT_D + BALC_D + 0.6} x2={FLAT_W} y2={FLAT_D + BALC_D + 0.6} />
        <line x1={0} y1={FLAT_D + BALC_D + 0.45} x2={0} y2={FLAT_D + BALC_D + 0.75} />
        <line x1={FLAT_W} y1={FLAT_D + BALC_D + 0.45} x2={FLAT_W} y2={FLAT_D + BALC_D + 0.75} />
        <text x={FLAT_W / 2} y={FLAT_D + BALC_D + 1.15} textAnchor="middle" stroke="none">
          {feetInches(FLAT_W)}
        </text>
        {(() => {
          const x = fr.mirror ? -0.6 : FLAT_W + 0.6;
          return (
            <>
              <line x1={x} y1={0} x2={x} y2={FLAT_D} />
              <text x={x} y={FLAT_D / 2} textAnchor="middle" stroke="none" transform={`rotate(-90 ${x} ${FLAT_D / 2})`} dy={fr.mirror ? -0.15 : 0.45}>
                {feetInches(FLAT_D)}
              </text>
            </>
          );
        })()}
      </g>

      {/* North arrow */}
      <g transform={`translate(${fr.mirror ? FLAT_W + 0.75 : -0.75} ${-0.9}) rotate(${north})`}>
        <circle r={0.5} fill="white" stroke="#cbd5e1" strokeWidth={0.04} />
        <path d="M 0 -0.42 L 0.2 0.22 L 0 0.1 L -0.2 0.22 Z" fill="#dc2626" />
        <text y={-0.55} textAnchor="middle" fontSize="0.32" fontWeight={700} fill="#dc2626">
          N
        </text>
      </g>

      {live && (
        <g ref={marker} style={{ display: 'none' }} pointerEvents="none">
          <path d="M 0 0 L -0.9 -1.6 A 1.8 1.8 0 0 1 0.9 -1.6 Z" fill="#0ea5e9" opacity={0.3} />
          <circle r={0.32} fill="#0ea5e9" stroke="white" strokeWidth={0.1} />
        </g>
      )}
    </svg>
  );
}
