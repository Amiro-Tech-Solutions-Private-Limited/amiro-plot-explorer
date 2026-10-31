import type { TowerId } from '../data/types';
import type { Waypoint } from '../lib/floor';

export const runtime = {
  camBearing: 0,
  explode: { A1: 0, A2: 0, B1: 0, B2: 0 } as Record<TowerId, number>,
  joy: { x: 0, y: 0 },
  day: 1,
  /** Walking player (avatar) in world space. */
  player: { x: 30, z: 82, y: 0, yaw: Math.PI, speed: 0 },
  /** Player position in the current flat's drawing-plan coords (interior only). */
  plan: { x: 0, y: 0, heading: 0, valid: false },
  /** Auto-walk target in world space. */
  target: null as null | { x: number; z: number },
  /** Current auto-walk / tour path and progress. */
  tourAll: [] as Waypoint[],
  tourIdx: 0,
  /** Index of the last captioned step reached (-1 = none). */
  tourCap: -1,
  /** Seconds left to linger at the current captioned step. */
  tourWait: 0,
  /** Tour to start once the walker arrives on a floor via the lift. */
  pendingTour: null as null | 'floor',
  /** Beat playback (tourEngine) — the walker waits while true. */
  beatsPlaying: false,
  /** Active camera time for the current beat; pauses during manual look-around. */
  beatElapsed: 0,
  /** The Director owns the camera while true. */
  directing: false,
  /** Time (ms) the user last grabbed the camera; the Director backs off for a while. */
  userCam: 0,
  /** Yaw the Director ended on, so the walker camera continues from there. */
  dirYaw: null as null | number,
  /** Where the host should point / look (world space). */
  hostTarget: null as null | [number, number, number],
  /** A furniture drag is in progress (camera look-drag pauses). */
  designDrag: false,
  /** Something else (design top view) owns the camera. */
  camOverride: false,
  /** Live speech for lip-sync: text, char index of the current word and when it started. */
  speech: { text: '', char: 0, at: 0, active: false },
};
