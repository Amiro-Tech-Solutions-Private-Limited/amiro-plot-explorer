import * as THREE from 'three';

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!] as const;
}

function finish(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

const floorTex: Partial<Record<'tile' | 'wood' | 'wet', THREE.CanvasTexture>> = {};

let marble: THREE.CanvasTexture | null = null;
/** Calacatta-style marble with grey and gold veins (bathroom walls, backsplash). */
export function marbleTexture() {
  if (marble) return marble;
  const N = 512;
  const [c, g] = canvas(N, N);
  let s = 17;
  const r = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  g.fillStyle = '#f3f1ed';
  g.fillRect(0, 0, N, N);
  for (let k = 0; k < 14; k++) {
    const gold = r() < 0.3;
    g.strokeStyle = gold ? `rgba(176,128,70,${0.35 + r() * 0.3})` : `rgba(120,118,115,${0.18 + r() * 0.3})`;
    g.lineWidth = gold ? 2 + r() * 5 : 0.6 + r() * 2.2;
    g.beginPath();
    let x = r() * N;
    let y = -20;
    g.moveTo(x, y);
    while (y < N + 20) {
      x += (r() - 0.45) * 60;
      y += 20 + r() * 30;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  // Tile joints: 600 × 1200 panels.
  g.fillStyle = 'rgba(150,145,138,0.5)';
  g.fillRect(0, N / 2, N, 1.5);
  g.fillRect(N / 2, 0, 1.5, N);
  marble = new THREE.CanvasTexture(c);
  marble.colorSpace = THREE.SRGBColorSpace;
  marble.anisotropy = 8;
  return marble;
}

/** Neutral (near-white) floor textures; tinted per theme with instance colours. 1 texture = 1.6 m. */
export function floorTexture(kind: 'tile' | 'wood' | 'wet') {
  const hit = floorTex[kind];
  if (hit) return hit;
  const N = 512;
  const [c, g] = canvas(N, N);
  let s = kind === 'tile' ? 3 : kind === 'wood' ? 5 : 7;
  const r = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  if (kind === 'tile') {
    // Two 800 mm marble-finish tiles per side with soft veining and grout.
    for (let ty = 0; ty < 2; ty++) {
      for (let tx = 0; tx < 2; tx++) {
        const v = 240 + r() * 12;
        g.fillStyle = `rgb(${v},${v - 2},${v - 6})`;
        g.fillRect(tx * 256, ty * 256, 256, 256);
        for (let k = 0; k < 5; k++) {
          g.strokeStyle = `rgba(150,140,130,${0.08 + r() * 0.12})`;
          g.lineWidth = 0.6 + r() * 1.8;
          g.beginPath();
          let x = tx * 256 + r() * 256;
          let y = ty * 256;
          g.moveTo(x, y);
          for (let j = 0; j < 12; j++) {
            x += (r() - 0.5) * 50;
            y += 256 / 12;
            g.lineTo(x, y);
          }
          g.stroke();
        }
      }
    }
    g.fillStyle = 'rgba(120,112,100,0.55)';
    for (const p of [0, 256]) {
      g.fillRect(p, 0, 2, N);
      g.fillRect(0, p, N, 2);
    }
  } else if (kind === 'wood') {
    // 200 mm laminate planks with grain and staggered butt joints.
    const pw = N / 8;
    for (let i = 0; i < 8; i++) {
      const base = 225 + r() * 25;
      g.fillStyle = `rgb(${base},${base - 8},${base - 20})`;
      g.fillRect(i * pw, 0, pw, N);
      for (let k = 0; k < 40; k++) {
        g.strokeStyle = `rgba(110,80,50,${0.05 + r() * 0.12})`;
        g.lineWidth = 0.5 + r();
        const x = i * pw + r() * pw;
        g.beginPath();
        g.moveTo(x, 0);
        g.bezierCurveTo(x + (r() - 0.5) * 8, N * 0.3, x + (r() - 0.5) * 8, N * 0.6, x + (r() - 0.5) * 6, N);
        g.stroke();
      }
      g.fillStyle = 'rgba(70,50,35,0.45)';
      g.fillRect(i * pw, 0, 1.5, N);
      const j = (i % 2 ? 0.3 : 0.75) * N;
      g.fillRect(i * pw, j, pw, 1.5);
    }
  } else {
    // 300 mm anti-skid ceramic tiles.
    const ts = N / 5;
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        const v = 232 + r() * 16;
        g.fillStyle = `rgb(${v},${v},${v - 4})`;
        g.fillRect(x * ts, y * ts, ts, ts);
        for (let k = 0; k < 120; k++) {
          g.fillStyle = `rgba(90,90,90,${r() * 0.12})`;
          g.fillRect(x * ts + r() * ts, y * ts + r() * ts, 1.5, 1.5);
        }
      }
    }
    g.fillStyle = 'rgba(100,100,100,0.6)';
    for (let k = 0; k <= 5; k++) {
      g.fillRect(k * ts - 1, 0, 2, N);
      g.fillRect(0, k * ts - 1, N, 2);
    }
  }
  return (floorTex[kind] = finish(c));
}

let facade: THREE.CanvasTexture | null = null;
/** Glass curtain-wall pattern; multiplied by the per-flat instance colour. */
export function facadeTexture() {
  if (facade) return facade;
  const [c, g] = canvas(512, 128);
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.75, '#e9eef2');
  grad.addColorStop(1, '#dfe5ea');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 128);
  g.fillStyle = 'rgba(40,48,58,0.85)';
  for (let x = 0; x <= 512; x += 64) g.fillRect(x - 2, 0, 4, 128);
  g.fillStyle = 'rgba(40,48,58,0.55)';
  g.fillRect(0, 92, 512, 3);
  g.fillStyle = 'rgba(255,255,255,0.25)';
  for (let x = 0; x < 512; x += 64) g.fillRect(x + 8, 6, 10, 80);
  facade = new THREE.CanvasTexture(c);
  facade.colorSpace = THREE.SRGBColorSpace;
  facade.anisotropy = 4;
  return facade;
}

let core: THREE.CanvasTexture | null = null;
export function coreTexture() {
  if (core) return core;
  const [c, g] = canvas(256, 64);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 256, 64);
  g.fillStyle = '#9aa6b2';
  for (let x = 16; x < 256; x += 64) g.fillRect(x, 18, 32, 30);
  core = new THREE.CanvasTexture(c);
  core.colorSpace = THREE.SRGBColorSpace;
  return core;
}

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Bay layout shared with the night-light shader: 4 bays, punched window at u 0.24–0.76, v 0.3–0.8 of each bay. */
export const FACADE_BAYS = 4;
export const WIN = { u0: 0.24, u1: 0.76, v0: 0.3, v1: 0.8 };

let real: THREE.CanvasTexture | null = null;
/** North Park-style façade: cream plaster, punched windows in charcoal frames, slab bands and grooves. */
export function realFacadeTexture() {
  if (real) return real;
  const W = 1024;
  const H = 256;
  const [c, g] = canvas(W, H);
  const r = seeded(11);
  g.fillStyle = '#efe8dc';
  g.fillRect(0, 0, W, H);
  // Plaster texture and faint rain streaks under sills.
  for (let i = 0; i < 4000; i++) {
    g.fillStyle = `rgba(${120 + r() * 60},${110 + r() * 50},${100 + r() * 40},0.05)`;
    g.fillRect(r() * W, r() * H, 2, 2);
  }
  // Floor band at slab level.
  g.fillStyle = '#ddd3c3';
  g.fillRect(0, 0, W, Math.round(H * 0.07));
  g.fillStyle = 'rgba(0,0,0,0.12)';
  g.fillRect(0, Math.round(H * 0.07), W, 2);
  const bay = W / FACADE_BAYS;
  // Image v runs top→bottom in canvas, so window v0/v1 (from the bottom) are flipped here.
  const top = Math.round(H * (1 - WIN.v1));
  const bot = Math.round(H * (1 - WIN.v0));
  for (let b = 0; b < FACADE_BAYS; b++) {
    // Vertical groove between bays (the façade's vertical expression).
    g.fillStyle = 'rgba(70,64,58,0.22)';
    g.fillRect(b * bay - 3, 0, 6, H);
    const x0 = b * bay + bay * WIN.u0;
    const x1 = b * bay + bay * WIN.u1;
    // Reveal shadow.
    g.fillStyle = 'rgba(60,52,44,0.35)';
    g.fillRect(x0 - 8, top - 8, x1 - x0 + 16, bot - top + 16);
    const gg = g.createLinearGradient(0, top, 0, bot);
    gg.addColorStop(0, '#8fa3b0');
    gg.addColorStop(0.5, '#5d7080');
    gg.addColorStop(1, '#3d4b57');
    g.fillStyle = gg;
    g.fillRect(x0, top, x1 - x0, bot - top);
    g.save();
    g.beginPath();
    g.rect(x0, top, x1 - x0, bot - top);
    g.clip();
    g.fillStyle = 'rgba(255,255,255,0.16)';
    g.beginPath();
    const sx = x0 + r() * (x1 - x0) * 0.5;
    g.moveTo(sx, top);
    g.lineTo(sx + 30, top);
    g.lineTo(sx - 20, bot);
    g.lineTo(sx - 50, bot);
    g.fill();
    if (r() < 0.45) {
      g.fillStyle = ['rgba(236,226,206,0.9)', 'rgba(214,196,170,0.9)', 'rgba(240,240,236,0.9)'][Math.floor(r() * 3)];
      const cw = (x1 - x0) * (0.2 + r() * 0.3);
      g.fillRect(r() < 0.5 ? x0 : x1 - cw, top, cw, bot - top);
    }
    g.restore();
    // Charcoal UPVC frame with a centre mullion and fixed top light.
    g.fillStyle = '#2f3438';
    g.fillRect(x0 - 4, top - 4, x1 - x0 + 8, 5);
    g.fillRect(x0 - 4, bot - 1, x1 - x0 + 8, 5);
    g.fillRect(x0 - 4, top, 5, bot - top);
    g.fillRect(x1 - 1, top, 5, bot - top);
    g.fillRect((x0 + x1) / 2 - 2, top, 4, bot - top);
    g.fillRect(x0, top + (bot - top) * 0.25, x1 - x0, 3);
    // Sill.
    g.fillStyle = '#d8cfc1';
    g.fillRect(x0 - 10, bot + 4, x1 - x0 + 20, 6);
    g.fillStyle = 'rgba(90,80,70,0.08)';
    g.fillRect(x0 - 6, bot + 10, x1 - x0 + 12, H - bot - 14);
  }
  real = new THREE.CanvasTexture(c);
  real.colorSpace = THREE.SRGBColorSpace;
  real.anisotropy = 8;
  return real;
}

let city: THREE.CanvasTexture | null = null;
/** Generic city building façade (window grid), tiled on instanced boxes. */
export function cityTexture() {
  if (city) return city;
  const [c, g] = canvas(256, 256);
  const r = seeded(5);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const v = 70 + r() * 50;
      g.fillStyle = `rgb(${v},${v + 15},${v + 30})`;
      g.fillRect(x * 32 + 6, y * 32 + 8, 20, 18);
    }
    g.fillStyle = 'rgba(0,0,0,0.08)';
    g.fillRect(0, y * 32 + 28, 256, 4);
  }
  city = new THREE.CanvasTexture(c);
  city.colorSpace = THREE.SRGBColorSpace;
  city.wrapS = city.wrapT = THREE.RepeatWrapping;
  return city;
}

const labelCache = new Map<string, THREE.CanvasTexture>();
export function labelTexture(text: string, opts: { color?: string; bg?: string; font?: string; w?: number; h?: number } = {}) {
  const key = JSON.stringify([text, opts]);
  const hit = labelCache.get(key);
  if (hit) return hit;
  const w = opts.w ?? 512;
  const h = opts.h ?? 96;
  const [c, g] = canvas(w, h);
  if (opts.bg) {
    g.fillStyle = opts.bg;
    g.fillRect(0, 0, w, h);
  }
  g.fillStyle = opts.color ?? '#ffffff';
  g.font = opts.font ?? `700 ${Math.round(h * 0.55)}px "Inter Variable", system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  labelCache.set(key, t);
  return t;
}
