import { useEffect, useMemo, useState } from 'react';
import { FLAT_BY_ID, towerName, unitOf } from '../data/project';
import { THEMES, profileWithTheme } from '../data/interiors';
import { flatXform } from '../lib/interiorFrame';
import { interiorTour } from '../lib/tours';
import { startTour, stopTour } from '../lib/tourEngine';
import { useStore } from '../store/useStore';
import { runtime } from '../store/runtime';
import { Icon } from './Icon';
import { floorFlats } from '../lib/floor';
import { interiorPose } from '../lib/poses';
import type { Furnishing } from '../store/useStore';
import { roomViewPose } from '../lib/roomView';

/** A home visit keeps the view primary and puts rooms, styling and tools within reach. */
export function HomeExperience() {
  const selectedId = useStore(s => s.selectedId);
  const currentRoom = useStore(s => s.currentRoom);
  const touring = useStore(s => s.touring);
  const night = useStore(s => s.interiorNight);
  const designMode = useStore(s => s.designMode);
  const themes = useStore(s => s.themes);
  const design = useStore(s => s.design);
  const furnishing = useStore(s => s.furnishing);
  const [drawer, setDrawer] = useState<'rooms' | 'style' | null>(null);
  useEffect(() => {
    const update = () => document.documentElement.style.setProperty('--hdr', window.innerWidth <= 640 ? '72px' : '82px');
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  const flat = selectedId ? FLAT_BY_ID.get(selectedId) : undefined;
  const stops = useMemo(() => flat ? interiorTour(flat, { x: 6, y: 1 }).filter(s => s.present) : [], [flat, themes, design, furnishing]);
  useEffect(() => {
    if (!flat || useStore.getState().touring || !useStore.getState().flying) return;
    const stop = stops.find(s => s.caption?.startsWith('Living '));
    if (!stop) return;
    useStore.getState().flyTo(roomViewPose(flat, 'Living', stop));
  }, [flat?.id]);
  if (!flat) return null;
  const theme = profileWithTheme(flat, themes[flat.id]).theme;
  const room = flatXform(flat).layout.rooms.find(r => r.name === currentRoom);
  const set = useStore.getState().set;
  const visit = (index: number) => {
    const stop = stops[index];
    if (!stop) return;
    stopTour();
    const name = stop.caption!.split(' · ')[0];
    set({ currentRoom: name, designTop: false, thirdPerson: false });
    runtime.plan.valid = false;
    useStore.getState().flyTo(roomViewPose(flat, name, stop));
    setDrawer(null);
  };
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { useStore.getState().showToast('Fullscreen is unavailable in this browser.'); }
  };
  return (
    <>
      <header className="home-header pointer-events-auto">
        <button className="home-back" onClick={() => { stopTour(); useStore.getState().setMode('orbit'); }} aria-label="Back to property"><Icon name="exit" size={17} /></button>
        <div className="home-brand"><span>AMIRO <i>/</i> NORTH PARK</span><strong>{unitOf(flat).label} <span>Residence {flat.id}</span></strong></div>
        <div className="home-address">{towerName(flat.tower)}<span>Floor {flat.floor} · {theme.name}</span></div>
        <button className="home-gallery-link" onClick={() => { stopTour(); set({ presentation: 'gallery' }); }}>Gallery ↗</button>
        <button className="home-icon" onClick={fullscreen} aria-label="Toggle fullscreen" title="Fullscreen">⛶</button>
      </header>
      {!touring && !designMode && <div className="home-room-title"><span>YOUR PRIVATE VIEWING</span><h1>{currentRoom ?? 'Welcome home'}</h1><p>{room ? `${room.w.toFixed(1)} × ${room.h.toFixed(1)} m · ${night ? 'Evening ambience' : 'Natural daylight'}` : 'Explore at your own pace'}</p></div>}
      {drawer && !designMode && <section className="home-drawer pointer-events-auto" aria-label={drawer === 'rooms' ? 'Explore rooms' : 'Interior styles'}>
        <div className="home-drawer-heading"><div><span>{drawer === 'rooms' ? 'FIND YOUR WAY' : 'MAKE IT YOURS'}</span><h2>{drawer === 'rooms' ? 'Explore the home' : 'Materials & atmosphere'}</h2></div><button className="home-icon" onClick={() => setDrawer(null)} aria-label="Close panel">×</button></div>
        {drawer === 'rooms' ? <>
          <div className="home-residences" aria-label="Homes on this floor">{floorFlats(flat.tower, flat.floor).map(home => <button key={home.id} className={home.id === flat.id ? 'selected' : ''} onClick={() => { if (home.id === flat.id) return; stopTour(); set({ selectedId: home.id, currentRoom: null, designSel: null, designTop: false, themes: themes[home.id] ? themes : { ...themes, [home.id]: 'northpark' } }); useStore.getState().flyTo(interiorPose(home)); setDrawer(null); }}>{home.id}</button>)}</div>
          <div className="home-room-list">{stops.map((s, i) => { const name = s.caption!.split(' · ')[0]; return <button key={name} className={currentRoom === name ? 'selected' : ''} onClick={() => visit(i)}><span className="home-room-number">{String(i + 1).padStart(2, '0')}</span><span>{name}</span><span className="home-room-arrow">↗</span></button>; })}</div>
        </> : <>
          <div className="home-style-list">{THEMES.map(t => <button key={t.id} className={theme.id === t.id ? 'selected' : ''} onClick={() => set({ themes: { ...themes, [flat.id]: t.id } })}><span className="home-swatches">{[t.sofa, t.woodLight, t.walls[0]].map((color,i) => <i key={i} style={{ background: color }} />)}</span><span>{t.name}</span>{theme.id === t.id && <span>✓</span>}</button>)}</div>
          <button className="home-light-toggle" onClick={() => set({ interiorNight: !night })}><Icon name={night ? 'sun' : 'moon'} size={17} />{night ? 'Switch to daylight' : 'See the home at dusk'}</button>
          <label className="home-furnishing">Presentation<select value={furnishing} onChange={e => set({ furnishing: e.target.value as Furnishing })}><option value="auto">As listed</option><option value="sample">Show home</option><option value="lived">Lived in</option><option value="bare">Unfurnished</option></select></label>
        </>}
      </section>}
      <nav className="home-dock pointer-events-auto" aria-label="Home viewing controls">
        <button className={drawer === 'rooms' ? 'active' : ''} onClick={() => setDrawer(drawer === 'rooms' ? null : 'rooms')} aria-expanded={drawer === 'rooms'}><Icon name="door" size={18} /><span>Rooms</span></button>
        <button className={drawer === 'style' ? 'active' : ''} onClick={() => setDrawer(drawer === 'style' ? null : 'style')} aria-expanded={drawer === 'style'}><span className="home-style-dot" style={{ background: theme.sofa }} /><span>Interiors</span></button>
        <button className="home-tour-button" onClick={() => { setDrawer(null); if (touring) stopTour(); else { set({ designMode: false, designTop: false }); startTour(interiorTour(flat, { x: runtime.plan.x, y: runtime.plan.y }), `${flat.id} · Private viewing`); } }}><Icon name={touring ? 'pause' : 'play'} size={16} filled /><span>{touring ? 'End tour' : 'Take a tour'}</span></button>
        <button className={designMode ? 'active' : ''} onClick={() => { stopTour(); setDrawer(null); set({ designMode: !designMode, designTop: false, designSel: null }); }}><Icon name="plan" size={18} /><span>Design</span></button>
        <button onClick={fullscreen}><span className="text-xl">⛶</span><span>Fullscreen</span></button>
      </nav>
      {!touring && !designMode && !drawer && <div className="home-gesture-hint">Drag to look around <span>·</span> Click the floor to move <span>·</span> Choose a room to explore</div>}
    </>
  );
}
