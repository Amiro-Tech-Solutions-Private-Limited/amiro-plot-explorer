import { useStore } from '../store/useStore';
import { runtime } from '../store/runtime';

/**
 * Offline voice narration via the Web Speech API. Long text is split into sentences
 * because some browsers silently stop very long utterances.
 */
let speaking = false;
let queue: { text: string; offset: number }[] = [];
let token = 0;
let opts: SpeakOpts = {};

export interface SpeakOpts {
  /** Character index (in the full text) of the word being spoken. */
  onWord?: (char: number) => void;
  onEnd?: () => void;
}

export function englishVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  return window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('en'));
}

function pickVoice(): SpeechSynthesisVoice | null {
  const { voiceURI } = useStore.getState().voice;
  const list = englishVoices();
  if (voiceURI) {
    const v = list.find((x) => x.voiceURI === voiceURI);
    if (v) return v;
  }
  return list.find((v) => v.lang === 'en-IN') ?? list.find((v) => /india/i.test(v.name)) ?? list.find((v) => v.lang === 'en-GB') ?? list[0] ?? null;
}

function next(my: number) {
  if (my !== token) return;
  const item = queue.shift();
  if (!item) {
    speaking = false;
    runtime.speech.active = false;
    const end = opts.onEnd;
    opts = {};
    end?.();
    return;
  }
  const u = new SpeechSynthesisUtterance(item.text);
  const v = pickVoice();
  if (v) u.voice = v;
  u.lang = v?.lang ?? 'en-IN';
  u.rate = useStore.getState().voice.rate;
  const word = (c: number) => {
    if (my !== token) return;
    runtime.speech.char = c;
    runtime.speech.at = performance.now();
    opts.onWord?.(item.offset + c);
  };
  u.onstart = () => {
    if (my !== token) return;
    runtime.speech.text = item.text;
    runtime.speech.active = true;
    word(0);
  };
  u.onboundary = (e) => {
    if (e.name !== 'sentence') word(e.charIndex);
  };
  u.onend = () => next(my);
  u.onerror = () => next(my);
  window.speechSynthesis.speak(u);
}

export const narrator = {
  get speaking() {
    return speaking;
  },
  get available() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  },
  /** Returns false when voice is off/unavailable (callers then fall back to timers). */
  speak(text: string, o: SpeakOpts = {}) {
    narrator.cancel();
    if (!narrator.available || !useStore.getState().voice.enabled || !text) return false;
    queue = [];
    const re = /[^.!?]+[.!?]*/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const lead = m[0].length - m[0].trimStart().length;
      const s = m[0].trim();
      if (s) queue.push({ text: s, offset: m.index + lead });
    }
    if (!queue.length) queue = [{ text, offset: 0 }];
    opts = o;
    speaking = true;
    const my = ++token;
    next(my);
    return true;
  },
  cancel() {
    token++;
    queue = [];
    opts = {};
    speaking = false;
    runtime.speech.active = false;
    if (narrator.available) window.speechSynthesis.cancel();
  },
  pause() {
    if (narrator.available) window.speechSynthesis.pause();
  },
  resume() {
    if (narrator.available) window.speechSynthesis.resume();
  },
};

/** Rough reading time when voice is off, so captions stay up long enough. */
export const readingTime = (text: string) => Math.min(8, 1.2 + text.split(/\s+/).length / 3.2);
