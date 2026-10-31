import { useStore } from './useStore';

export function useMatchSet() {
  return useStore((s) => s.matchSet);
}

export const isTouch = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
export const isMobile = () => typeof window !== 'undefined' && window.innerWidth < 768;
export const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
