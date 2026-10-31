import { runtime } from '../store/runtime';

/** Mouth shape: open = jaw drop (0..1), wide = lip spread (-1 round .. 1 wide). */
export interface Viseme {
  open: number;
  wide: number;
}

const REST: Viseme = { open: 0, wide: 0 };

function shapeOf(ch: string): Viseme {
  switch (ch) {
    case 'a':
      return { open: 0.95, wide: 0.3 };
    case 'e':
      return { open: 0.55, wide: 0.8 };
    case 'i':
    case 'y':
      return { open: 0.4, wide: 1 };
    case 'o':
      return { open: 0.75, wide: -0.8 };
    case 'u':
    case 'w':
    case 'q':
      return { open: 0.35, wide: -1 };
    case 'm':
    case 'b':
    case 'p':
      return { open: 0, wide: 0 };
    case 'f':
    case 'v':
      return { open: 0.12, wide: 0.4 };
    case 'l':
    case 't':
    case 'd':
    case 'n':
      return { open: 0.3, wide: 0.3 };
    case 's':
    case 'z':
    case 'c':
    case 'x':
      return { open: 0.15, wide: 0.7 };
    case 'r':
      return { open: 0.3, wide: -0.4 };
    case 'h':
    case 'k':
    case 'g':
      return { open: 0.45, wide: 0.1 };
    default:
      return { open: 0.3, wide: 0.2 };
  }
}

/** Approximate letters per second spoken at rate 1. */
const LPS = 13;

/**
 * Current mouth shape for the narrator's live speech. The speech engine reports the
 * character index of each word as it starts; we sweep through that word's letters.
 */
export function currentViseme(rate = 1): Viseme {
  const sp = runtime.speech;
  if (!sp.active || !sp.text) return REST;
  const t = (performance.now() - sp.at) / 1000;
  const k = Math.floor(t * LPS * rate);
  const ch = sp.text.charAt(sp.char + k).toLowerCase();
  if (!ch || !/[a-z]/.test(ch)) {
    // Between words: relax unless the next word is about to start.
    return k > 14 ? REST : { open: 0.08, wide: 0.1 };
  }
  return shapeOf(ch);
}
