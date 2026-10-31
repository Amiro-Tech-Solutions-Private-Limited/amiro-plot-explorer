export const PANORAMA_SWEEP_SECONDS = 40;
export const PANORAMA_SETTLE_SECONDS = 2;
export const PANORAMA_DURATION = PANORAMA_SWEEP_SECONDS + PANORAMA_SETTLE_SECONDS * 2;
export const PANORAMA_EYE_HEIGHT = 1.6;

/** One complete turn, with gentle acceleration and a stationary hold at either end. */
export function panoramaYaw(start: number, elapsed: number) {
  const t = Math.max(0, Math.min(1, (elapsed - PANORAMA_SETTLE_SECONDS) / PANORAMA_SWEEP_SECONDS));
  return start + Math.PI * 2 * t * t * (3 - 2 * t);
}
