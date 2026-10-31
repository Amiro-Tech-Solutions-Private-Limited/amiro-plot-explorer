import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { EffectComposer, N8AO, Vignette, Bloom } from '@react-three/postprocessing';
import { TOWERS } from '../data/project';
import { useStore } from '../store/useStore';
import { DEFAULT_POSE } from '../lib/poses';
import { TowerBlock } from './TowerBlock';
import { Site } from './SiteNP';
import { Pool } from './Pool';
import { Vegetation } from './Vegetation';
import { Cityscape } from './Cityscape';
import { Sun } from './Sun';
import { CameraRig } from './CameraRig';
import { Highlight, HoverTip } from './Highlight';
import { Labels } from './Labels';
import { InteriorScene } from './InteriorScene';
import { Avatar, SitePeople } from './People';
import { BeatFX, Director } from './Director';

function Effects() {
  const quality = useStore((s) => s.quality);
  const mode = useStore((s) => s.mode);
  if (quality === 'low') return null;
  return (
    <EffectComposer multisampling={4}>
      <N8AO halfRes aoRadius={mode === 'interior' ? 0.8 : 3} intensity={mode === 'interior' ? 1.5 : 2.2} distanceFalloff={1} />
      <Bloom mipmapBlur luminanceThreshold={1} intensity={0.6} />
      <Vignette eskil={false} offset={0.25} darkness={0.45} />
    </EffectComposer>
  );
}

export function Scene() {
  const quality = useStore((s) => s.quality);
  const set = useStore((s) => s.set);
  return (
    <Canvas
      shadows
      dpr={quality === 'high' ? [1, 2] : [1, 1.25]}
      camera={{ position: DEFAULT_POSE.pos, fov: DEFAULT_POSE.fov, near: 0.1, far: 3500 }}
      gl={{ antialias: true, powerPreference: 'high-performance', stencil: false }}
      onCreated={() => requestAnimationFrame(() => requestAnimationFrame(() => set({ ready: true })))}
      onPointerMissed={(e) => {
        if (e.type === 'click' && useStore.getState().mode === 'orbit') useStore.getState().hover(null);
      }}
    >
      <PerformanceMonitor onDecline={() => set({ quality: 'low' })} flipflops={2} />
      <Suspense fallback={null}>
        <Sun />
        <Site />
        <Pool />
        <Vegetation />
        <Cityscape />
        {TOWERS.map((t) => (
          <TowerBlock key={t.id} tower={t} />
        ))}
        <InteriorScene />
        <Avatar />
        <SitePeople />
        <Highlight />
        <HoverTip />
        <Labels />
        <BeatFX />
        <Effects />
      </Suspense>
      <CameraRig />
      <Director />
    </Canvas>
  );
}
