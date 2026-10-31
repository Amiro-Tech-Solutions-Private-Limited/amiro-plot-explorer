import { lazy, Suspense, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Header } from './ui/Header';
import { FiltersPanel } from './ui/FiltersPanel';
import { SunPanel } from './ui/SunPanel';
import { ComparePanel } from './ui/ComparePanel';
import { Compass, Legend } from './ui/Legend';
import { FloorRail } from './ui/FloorRail';
import { FlatPanel } from './ui/FlatPanel';
import { EnquiryModal } from './ui/EnquiryModal';
import { HintToast, Joystick, Loader, RefCompare, SearchChooser, Toast } from './ui/Overlays';
import { LiftUI, ModeBar, RoomHUD, SiteMiniMap, TourCaption, TourPanel } from './ui/WalkUI';
import { DesignPanel } from './ui/DesignPanel';
import { redoDesign, undoDesign } from './lib/designStore';
import { hydrateFromUrl, startUrlSync, useStore } from './store/useStore';
import { isMobile } from './store/hooks';
import { sunTimes } from './lib/sun';
import { HomeExperience } from './ui/HomeExperience';
import { ProjectGallery } from './ui/ProjectGallery';
const Scene = lazy(() => import('./scene/Scene').then(module => ({ default: module.Scene })));

function useSunPlayback() {
  const playing = useStore((s) => s.sun.playing);
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const { sun, setSun } = useStore.getState();
      const { sunrise, sunset } = sunTimes(sun.date);
      let m = sun.minutes + dt * 50;
      if (m > sunset || m < sunrise) m = sunrise;
      setSun({ minutes: m });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
}

export default function App() {
  const presentation = useStore((s) => s.presentation);
  const panel = useStore((s) => s.panel);
  const mode = useStore((s) => s.mode);
  const ready = useStore((s) => s.ready);
  const immersive = mode === 'walk' || mode === 'interior' || mode === 'balcony';

  useEffect(() => {
    const probe = document.createElement('canvas');
    if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) useStore.setState({ webglError: true });
    if (isMobile() || (navigator.hardwareConcurrency ?? 8) <= 4) useStore.setState({ quality: 'low' });
    const { flat, mode, lay } = hydrateFromUrl();
    const stop = startUrlSync();
    if (flat) {
      useStore.getState().selectFlat(flat, false);
    }
    const t = setTimeout(() => {
      const s = useStore.getState();
      if (flat && lay) {
        // Shared furniture layout: open the home in design mode.
        s.setMode('interior');
        s.set({ designMode: true });
      } else if (mode && mode !== 'orbit') s.setMode(mode);
      else if (flat) s.selectFlat(flat);
    }, 600);
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState();
      if (s.presentation === 'gallery') return;
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.tagName === 'SELECT')) return;
      const immersiveNow = s.mode === 'walk' || s.mode === 'interior' || s.mode === 'balcony';
      if (s.designMode && s.selectedId && (e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'y' || e.key === 'Z')) {
        e.preventDefault();
        if (e.key === 'y' || (e.key === 'Z' && e.shiftKey)) redoDesign(s.selectedId);
        else undoDesign(s.selectedId);
        return;
      }
      if (e.key === 'Escape' && s.designMode) {
        s.set(s.designSel ? { designSel: null } : { designMode: false, designTop: false });
        return;
      }
      if (e.key !== 'Escape') {
        if (immersiveNow || e.ctrlKey || e.metaKey || e.altKey || s.enquiryFor) return;
        const k = e.key.toLowerCase();
        if (k === 'f') s.setPanel('filters');
        else if (k === 's') s.setPanel('sun');
        else if (k === 'c') s.setPanel('compare');
        else if (k === 'p') s.setMode('plan');
        else if (k === 'o' || k === '3') s.setMode('orbit');
        else if (k === 'l') s.setMode('floors');
        else if (k === 'w') s.setMode('walk');
        return;
      }
      if (s.enquiryFor) s.set({ enquiryFor: null });
      else if (s.panel) s.set({ panel: null });
      else if (s.mode === 'walk' || s.mode === 'interior' || s.mode === 'balcony') s.setMode('orbit');
      else if (s.selectedId) s.selectFlat(null);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      stop();
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  useSunPlayback();

  if (presentation === 'gallery') return <ProjectGallery />;

  return (
    <div className="fixed inset-0 overflow-hidden bg-slate-200 font-sans text-slate-900">
      <div className="absolute inset-0">
        <Suspense fallback={null}><Scene /></Suspense>
      </div>

      <div className="pointer-events-none absolute inset-0">
        {mode === 'interior' ? <HomeExperience /> : <Header />}
        <AnimatePresence>
          {panel === 'filters' && <FiltersPanel key="f" />}
          {panel === 'sun' && <SunPanel key="s" />}
          {panel === 'compare' && <ComparePanel key="c" />}
        </AnimatePresence>

        {mode === 'floors' && <FloorRail />}

        {!immersive && ready && (
          <div className="pointer-events-auto absolute bottom-4 left-3 z-10 flex flex-col items-start gap-2 md:left-4">
            <Compass />
            <Legend />
          </div>
        )}

        <FlatPanel />
        {mode !== 'interior' && <ModeBar />}
        <DesignPanel />
        <TourCaption />
        <TourPanel />
        {mode !== 'interior' && <RoomHUD />}
        <SiteMiniMap />
        <LiftUI />
        <Joystick />
        <HintToast />
        <SearchChooser />
        <Toast />
        <RefCompare />
      </div>

      <EnquiryModal />
      <Loader />
    </div>
  );
}
