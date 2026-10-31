import { useStore } from '../store/useStore';
import { runtime } from '../store/runtime';
import { narrator, readingTime } from './narrator';
import type { Beat, Waypoint } from './floor';

let play = 0;
let serial = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

function endBeats() {
  play++;
  if (timer) clearTimeout(timer);
  timer = undefined;
  runtime.beatsPlaying = false;
  runtime.directing = false;
  if (useStore.getState().beat) useStore.setState({ beat: null });
}

/**
 * "Show what you say": plays a list of beats one sentence at a time. Each beat sets what the
 * Director frames and what gets highlighted while the narrator speaks it.
 */
export function playBeats(beats: Beat[]) {
  endBeats();
  if (!beats.length) return;
  const my = play;
  runtime.beatsPlaying = true;
  let i = 0;
  const step = () => {
    if (my !== play) return;
    if (i >= beats.length) {
      endBeats();
      return;
    }
    const b = beats[i];
    const key = ++serial;
    const idx = i;
    useStore.setState({ beat: { key, say: b.say, focus: b.focus, shot: b.shot, highlight: b.highlight, host: b.host, idx, total: beats.length, char: 0 } });
    runtime.directing = useStore.getState().cinematic;
    runtime.userCam = 0;
    const done = () => {
      if (my !== play) return;
      // Hold while paused (timer fallback when voice is off).
      if (useStore.getState().tour?.paused) {
        timer = setTimeout(done, 300);
        return;
      }
      i++;
      timer = setTimeout(step, 450);
    };
    const voiced = narrator.speak(b.say, {
      onWord: (c) => {
        const cur = useStore.getState().beat;
        if (cur && cur.key === key) useStore.setState({ beat: { ...cur, char: c } });
      },
      onEnd: done,
    });
    if (!voiced) {
      // Reveal the subtitle word by word without a voice.
      const words = [...b.say.matchAll(/\S+/g)].map((m) => m.index ?? 0);
      const total = readingTime(b.say) * 1000;
      words.forEach((c, k) =>
        setTimeout(() => {
          const cur = useStore.getState().beat;
          if (my === play && cur && cur.key === key) useStore.setState({ beat: { ...cur, char: c } });
        }, (k / words.length) * total),
      );
      timer = setTimeout(done, total + 600);
    }
  };
  step();
}

/** Narrated tour state machine driven by PlayerControls each frame. */
export function startTour(steps: Waypoint[], title: string) {
  endBeats();
  narrator.cancel();
  runtime.tourAll = steps;
  runtime.tourIdx = 0;
  runtime.tourCap = -1;
  runtime.tourWait = 0;
  useStore.setState({ touring: true, caption: null, tour: { title, step: 0, total: steps.filter((s) => s.caption).length, paused: false } });
}

/** Silent auto-walk (click-to-walk, mini-map taps, flat switcher). */
export function walkPath(steps: Waypoint[]) {
  stopTour();
  runtime.tourAll = steps;
  runtime.tourIdx = 0;
  runtime.tourCap = -1;
  runtime.tourWait = 0;
}

export function stopTour() {
  endBeats();
  narrator.cancel();
  runtime.tourAll = [];
  runtime.tourIdx = 0;
  runtime.tourCap = -1;
  runtime.tourWait = 0;
  useStore.setState({ touring: false, caption: null, tour: null });
}

export function togglePause() {
  const t = useStore.getState().tour;
  if (!t) return;
  if (t.paused) narrator.resume();
  else narrator.pause();
  useStore.setState({ tour: { ...t, paused: !t.paused } });
}

function jumpTo(i: number) {
  const s = runtime.tourAll[i];
  if (!s) return;
  endBeats();
  narrator.cancel();
  runtime.player.x = s.x;
  runtime.player.z = s.z;
  runtime.tourIdx = i;
  runtime.tourWait = 0;
  const t = useStore.getState().tour;
  if (t?.paused) useStore.setState({ tour: { ...t, paused: false } });
}

export function nextStep() {
  const i = runtime.tourAll.findIndex((s, k) => k > Math.max(runtime.tourCap, runtime.tourIdx - 1) && s.caption);
  if (i >= 0) jumpTo(i);
}

export function prevStep() {
  let i = runtime.tourCap - 1;
  while (i >= 0 && !runtime.tourAll[i].caption) i--;
  if (i >= 0) jumpTo(i);
}

/** Called when the walker reaches a captioned step. */
export function arriveAt(i: number) {
  const s = runtime.tourAll[i];
  runtime.tourCap = i;
  const t = useStore.getState().tour;
  const n = runtime.tourAll.slice(0, i + 1).filter((x) => x.caption).length;
  useStore.setState({ caption: s.caption ?? null, tour: t ? { ...t, step: n } : null });
  if (s.beats?.length && t) playBeats(s.beats);
  else if (s.say && t) narrator.speak(s.say);
  s.action?.();
}

/** Chapters = captioned steps of the running tour. */
export function chapters() {
  return runtime.tourAll.map((s, i) => ({ i, caption: s.caption })).filter((c): c is { i: number; caption: string } => !!c.caption);
}

export function gotoChapter(i: number) {
  jumpTo(i);
}
