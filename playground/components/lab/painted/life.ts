// Life on the pixel map: which painted pixels move, and how. Pure (no DOM)
// so .lab-shots/painted/*.ts can run it under node.
//
//   water    the blue water pixels (rivers, lagoons — not the parchment sea):
//            glints travel across them by stepping each pixel one rung up or
//            down its own ramp where a slow wave passes
//   foam     the near-white pixels touching water: they blink with the waves
//   lava     the hot pixels of the big lava flows: a slower, brighter pulse,
//            plus embers and smoke rising from the crater (the flow's top)
//   lights   small warm-yellow pixels in the buildings (windows, lanterns):
//            they flicker
//   foliage  small green blobs (trees, bushes): leaves rustle — sparse
//            highlight swaps, never a shift
//   falls    the painted waterfalls (landmark boxes): the water pours — a fast
//            wave running down through the blues and the white streaks
//   flags    small red things on a pole or tower top: they flutter
//   gulls    a few birds cross the parchment sea (drawn only over the sea)
//   splash   now and then a fish breaks the water: a ring that widens and goes
//
// Every class keeps the painting's own colours: a pixel only ever shows a
// colour from its ramp, so a still frame is still the owner's map.
import type { PixelMap } from "./pixelmap";

export interface LifeClass {
  /** pixel indices */
  px: Int32Array;
  /** per pixel: x, y and a phase in [0,1), precomputed for the frame loop */
  xs: Int16Array;
  ys: Int16Array;
  ph: Float32Array;
  /** palette index → position on this class's ramp (dark → light), -1 if not on it */
  rampPos: Int16Array;
  /** ramp positions → palette index */
  ramp: Uint8Array;
}

export interface Life {
  w: number;
  h: number;
  water: LifeClass;
  foam: Int32Array;
  /** per foam pixel: the palette index of the water beside it */
  foamUnder: Uint8Array;
  lava: LifeClass;
  lights: LifeClass;
  foliage: LifeClass;
  /** ember + smoke sources: the volcano's vents (landmarks), else the top of the thick lava flow */
  crater: Int32Array;
  /** lighthouse lamps: a beam sweeps from each */
  lamps: { x: number; y: number }[];
  falls: LifeClass;
  flags: LifeClass;
  /** the parchment sea (gulls fly only over it) */
  sea: Uint8Array;
  /** a bounding box of the sea for the gulls' flight paths */
  seaBox: { x: number; y: number; w: number; h: number };
  /** per-pixel hash in [0,1) for phases */
  noise: (p: number) => number;
}

const hsv = (r: number, g: number, b: number): [number, number, number] => {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) { h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
  return [h, mx ? d / mx : 0, mx];
};
const lum = (pm: PixelMap, i: number) => 0.3 * pm.palette[i * 3] + 0.59 * pm.palette[i * 3 + 1] + 0.11 * pm.palette[i * 3 + 2];

/** Palette indices passing a hue/sat/val test. */
function classify(pm: PixelMap, test: (h: number, s: number, v: number) => boolean): Uint8Array {
  const n = pm.hex.length, out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const [h, s, v] = hsv(pm.palette[i * 3], pm.palette[i * 3 + 1], pm.palette[i * 3 + 2]);
    out[i] = test(h, s, v) ? 1 : 0;
  }
  return out;
}

/** 4-connected components of the pixels where `inClass[idx[p]]`; returns the
 * label per pixel (-1 = none) and each component's size + bbox. */
function components(pm: PixelMap, inClass: Uint8Array, allow?: (p: number) => boolean) {
  const { w, h, idx } = pm;
  const label = new Int32Array(w * h).fill(-1);
  const comps: { size: number; x0: number; y0: number; x1: number; y1: number }[] = [];
  const st: number[] = [];
  for (let s = 0; s < w * h; s++) {
    if (label[s] >= 0 || !inClass[idx[s]] || (allow && !allow(s))) continue;
    const id = comps.length;
    const c = { size: 0, x0: w, y0: h, x1: -1, y1: -1 };
    comps.push(c);
    label[s] = id; st.push(s);
    while (st.length) {
      const p = st.pop()!;
      const x = p % w, y = (p / w) | 0;
      c.size++;
      if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
      const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w];
      for (const q of nb) {
        if (q < 0 || q >= w * h || label[q] >= 0 || !inClass[idx[q]] || (allow && !allow(q))) continue;
        label[q] = id; st.push(q);
      }
    }
  }
  return { label, comps };
}

function pick(pm: PixelMap, label: Int32Array, comps: { size: number; x0: number; y0: number; x1: number; y1: number }[], keep: (c: (typeof comps)[number]) => boolean): Int32Array {
  const ok = comps.map(keep);
  const out: number[] = [];
  for (let p = 0; p < label.length; p++) if (label[p] >= 0 && ok[label[p]]) out.push(p);
  return Int32Array.from(out);
}

function rampOf(pm: PixelMap, inClass: Uint8Array): { ramp: Uint8Array; rampPos: Int16Array } {
  const ids: number[] = [];
  for (let i = 0; i < inClass.length; i++) if (inClass[i]) ids.push(i);
  ids.sort((a, b) => lum(pm, a) - lum(pm, b));
  const rampPos = new Int16Array(pm.hex.length).fill(-1);
  ids.forEach((i, k) => { rampPos[i] = k; });
  return { ramp: Uint8Array.from(ids), rampPos };
}

export interface Landmarks {
  vents: readonly (readonly [number, number])[];
  lamps: readonly (readonly [number, number])[];
  falls?: readonly { x: number; y: number; w: number; h: number }[];
}

export function analyseLife(pm: PixelMap, sea: Uint8Array, lands: Int8Array, generative: number, landmarks?: Landmarks): Life {
  const { w, h, idx } = pm;
  const notSea = (p: number) => !sea[p];

  // water: saturated cyan/blue, from deep channel to bright surface
  // (a body of water is big, or meets the sea — blue roofs and domes are
  // neither; waterfalls are tall and narrow)
  const waterC = classify(pm, (hh, s, v) => hh >= 168 && hh <= 202 && s >= 0.45 && v >= 0.28);
  const whiteC = classify(pm, (_h, s, v) => s <= 0.3 && v >= 0.88);
  const wc = components(pm, waterC, notSea);
  const coastal = new Uint8Array(wc.comps.length);
  for (let p = 0; p < w * h; p++) {
    const id = wc.label[p];
    if (id < 0 || coastal[id]) continue;
    const x = p % w;
    if ((x > 0 && sea[p - 1]) || (x < w - 1 && sea[p + 1]) || (p >= w && sea[p - w]) || (p + w < w * h && sea[p + w])) coastal[id] = 1;
  }
  const water = pick(pm, wc.label, wc.comps, (c) => c.size >= 300 || coastal[wc.comps.indexOf(c)] === 1);
  // waterfalls: the blue and white pixels inside the hand-placed boxes
  const fallC = new Uint8Array(pm.hex.length);
  for (let i = 0; i < fallC.length; i++) fallC[i] = waterC[i] || whiteC[i] ? 1 : 0;
  const falls: number[] = [];
  for (const b of landmarks?.falls ?? []) {
    for (let y = Math.max(0, b.y); y < Math.min(h, b.y + b.h); y++) for (let x = Math.max(0, b.x); x < Math.min(w, b.x + b.w); x++) {
      const p = y * w + x;
      if (fallC[idx[p]] && !sea[p]) falls.push(p);
    }
  }
  const waterSet = new Uint8Array(w * h);
  for (const p of water) waterSet[p] = 1;
  // foam: near-white touching water
  const foam: number[] = [], foamUnder: number[] = [];
  for (let p = 0; p < w * h; p++) {
    if (!whiteC[idx[p]] || sea[p]) continue;
    const x = p % w;
    const q = x > 0 && waterSet[p - 1] ? p - 1 : x < w - 1 && waterSet[p + 1] ? p + 1 : p >= w && waterSet[p - w] ? p - w : p + w < w * h && waterSet[p + w] ? p + w : -1;
    if (q >= 0) { foam.push(p); foamUnder.push(idx[q]); }
  }

  // lava: hot orange/red/yellow, only the big flows of the generative land
  const lavaC = classify(pm, (hh, s, v) => ((hh <= 42) || hh >= 356) && s >= 0.6 && v >= 0.75);
  const lc = components(pm, lavaC, (p) => lands[p] === generative);
  const lava = pick(pm, lc.label, lc.comps, (c) => c.size >= 150);
  // crater: the summit of the volcano — the lava roads (2–3 px wide) join the
  // flow, so erode the lava by 2 px to keep only the thick flow, then take the
  // top rows of its biggest piece
  const lavaSet = new Uint8Array(w * h);
  for (const p of lava) lavaSet[p] = 1;
  const thick = new Uint8Array(w * h);
  for (const p of lava) {
    const x = p % w, y = (p / w) | 0;
    let ok = x >= 2 && y >= 2 && x < w - 2 && y < h - 2;
    for (let dy = -2; ok && dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (!lavaSet[p + dy * w + dx]) { ok = false; break; }
    thick[p] = ok ? 1 : 0;
  }
  const tc = components(pm, Uint8Array.from({ length: pm.hex.length }, () => 1), (p) => thick[p] === 1);
  let big = -1, bigN = 0;
  tc.comps.forEach((c, id) => { if (c.size > bigN) { bigN = c.size; big = id; } });
  const crater: number[] = [];
  if (landmarks?.vents.length) for (const [vx, vy] of landmarks.vents) crater.push(vy * w + vx);
  else if (big >= 0) {
    const top = tc.comps[big].y0;
    for (let p = 0; p < w * h; p++) if (tc.label[p] === big && ((p / w) | 0) <= top + 2) crater.push(p);
  }
  const lamps = (landmarks?.lamps ?? []).map(([x, y]) => ({ x, y }));

  // lights: tiny warm-yellow blobs
  const lightC = classify(pm, (hh, s, v) => hh >= 44 && hh <= 62 && s >= 0.38 && v >= 0.95);
  const lt = components(pm, lightC, notSea);
  const lights = pick(pm, lt.label, lt.comps, (c) => c.size <= 10 && (c.x1 - c.x0) <= 4 && (c.y1 - c.y0) <= 5);

  // foliage: green blobs, bush-sized, not the big grass fields
  const greenC = classify(pm, (hh, s, v) => hh >= 72 && hh <= 160 && s >= 0.3 && v >= 0.25 && v <= 0.85);
  const gc = components(pm, greenC, notSea);
  const foliage = pick(pm, gc.label, gc.comps, (c) => {
    const bw = c.x1 - c.x0 + 1, bh = c.y1 - c.y0 + 1;
    return c.size >= 10 && c.size <= 320 && Math.max(bw, bh) / Math.min(bw, bh) <= 2.5;
  });

  const noise = (p: number) => { let v = (p * 2654435761) >>> 0; v ^= v >>> 15; v = Math.imul(v, 2246822519) >>> 0; v ^= v >>> 13; return (v >>> 8) / 16777216; };
  // flags: a small pure-red thing with something dark right under it (a pole,
  // a tower top) — berries on bushes have green under them
  const redC = classify(pm, (hh, s, v) => (hh >= 352 || hh <= 4) && s >= 0.8 && v >= 0.6);
  const rc = components(pm, redC, notSea);
  const darkUnder = new Uint8Array(rc.comps.length);
  for (let p = 0; p < w * h; p++) {
    const id = rc.label[p];
    if (id < 0 || darkUnder[id]) continue;
    for (let d = 1; d <= 2; d++) {
      const q = p + d * w;
      if (q >= w * h || rc.label[q] === id) continue;
      const k = idx[q] * 3;
      if (0.3 * pm.palette[k] + 0.59 * pm.palette[k + 1] + 0.11 * pm.palette[k + 2] < 80) { darkUnder[id] = 1; break; }
    }
  }
  const flags = pick(pm, rc.label, rc.comps, (c) => c.size >= 5 && c.size <= 30 && c.x1 - c.x0 >= 2 && c.y1 - c.y0 >= 2 && darkUnder[rc.comps.indexOf(c)] === 1);
  const flagC = classify(pm, (hh, s, v) => (hh >= 348 || hh <= 6) && s >= 0.65 && v >= 0.45);

  let sx0 = w, sy0 = h, sx1 = 0, sy1 = 0;
  for (let p = 0; p < w * h; p++) if (sea[p]) { const x = p % w, y = (p / w) | 0; if (x < sx0) sx0 = x; if (x > sx1) sx1 = x; if (y < sy0) sy0 = y; if (y > sy1) sy1 = y; }

  const cls = (px: Int32Array, c: Uint8Array): LifeClass => {
    const xs = new Int16Array(px.length), ys = new Int16Array(px.length), ph = new Float32Array(px.length);
    for (let i = 0; i < px.length; i++) { xs[i] = px[i] % w; ys[i] = (px[i] / w) | 0; ph[i] = noise(px[i]); }
    return { px, xs, ys, ph, ...rampOf(pm, c) };
  };
  return { w, h, water: cls(water, waterC), foam: Int32Array.from(foam), foamUnder: Uint8Array.from(foamUnder), lava: cls(lava, lavaC), lights: cls(lights, lightC), foliage: cls(foliage, greenC), crater: Int32Array.from(crater), lamps, falls: cls(Int32Array.from(falls), fallC), flags: cls(flags, flagC), sea, seaBox: { x: sx0, y: sy0, w: sx1 - sx0 + 1, h: sy1 - sy0 + 1 }, noise };
}

// ————————————————————————————————————————————— one frame

export type RGB = readonly [number, number, number];

/** A traveller on the roads: a little cart carrying a model's evidence colour
 * from its parent to it (lineage flows downstream). */
export interface Traveller {
  pts: { x: number; y: number }[];
  len: number;
  /** art px per second */
  speed: number;
  /** 0..1, staggers the carts */
  phase: number;
  body: RGB;
  hi: RGB;
  /** on the selected model's lineage: no gap, brighter */
  lit: boolean;
}

export interface FramePaint {
  /** pixels we must not touch (our own markers, banners) */
  skip: Uint8Array | null;
  /** 0..1 ghost amount at a pixel (focus dim), or null when nothing is focused */
  ghost: ((p: number) => number) | null;
  ghostRGB: (r: number, g: number, b: number, a: number) => RGB;
}

const INK_RGB: RGB = [0x3a, 0x1d, 0x2a], SHADOW_RGB: RGB = [0x22, 0x13, 0x16];
const SMOKE: RGB[] = [[0x51, 0x54, 0x5d], [0x9a, 0x8e, 0x88], [0xd2, 0xce, 0xb9]]; // 63 · 42 · 81
const BEAM_HI: RGB = [0xfe, 0xed, 0x73], BEAM: RGB = [0xff, 0xfe, 0xbb]; // 108 · 93

function put(out: Uint8ClampedArray, w: number, h: number, x: number, y: number, c: RGB, fp: FramePaint) {
  if (x < 0 || y < 0 || x >= w || y >= h) return;
  const p = y * w + x;
  if (fp.skip?.[p]) return;
  const a = fp.ghost ? fp.ghost(p) : 0;
  const [r, g, b] = a > 0 ? fp.ghostRGB(c[0], c[1], c[2], a) : c;
  const q = p * 4;
  out[q] = r; out[q + 1] = g; out[q + 2] = b; out[q + 3] = 255;
}

/** Shift class pixels along their ramp where `wave(x, y, n) ` crosses the
 * thresholds: `up` → one rung lighter (two past `up2`), `down` → one darker. */
function ramped(out: Uint8ClampedArray, pm: PixelMap, c: LifeClass, fp: FramePaint, wave: (x: number, y: number, n: number) => number, up: number, down: number, up2 = Infinity) {
  const { w, h, idx, palette } = pm;
  const top = c.ramp.length - 1;
  const { px, xs, ys, ph, rampPos, ramp } = c;
  for (let i = 0; i < px.length; i++) {
    const p = px[i];
    const pos = rampPos[idx[p]];
    if (pos < 0) continue;
    const v = wave(xs[i], ys[i], ph[i]);
    let np = pos;
    if (v > up2) np = Math.min(top, pos + 2);
    else if (v > up) np = Math.min(top, pos + 1);
    else if (v < down) np = Math.max(0, pos - 1);
    if (np === pos) continue;
    const k = ramp[np] * 3;
    put(out, w, h, xs[i], ys[i], [palette[k], palette[k + 1], palette[k + 2]], fp);
  }
}

const TAU = Math.PI * 2;

/** Paint one frame of life at time t (seconds) into a cleared RGBA buffer. */
export function paintLife(out: Uint8ClampedArray, pm: PixelMap, life: Life, t: number, fp: FramePaint, travellers: Traveller[] = []) {
  const { w, h } = pm;
  const { noise } = life;
  // water: two crossing swells, glints where they add up (its own loop: the
  // biggest class, kept monomorphic so V8 inlines it)
  {
    const c = life.water, { px, xs, ys, ph, rampPos, ramp } = c, top = ramp.length - 1, { idx, palette } = pm;
    for (let i = 0; i < px.length; i++) {
      const pos = rampPos[idx[px[i]]];
      if (pos < 0) continue;
      const x = xs[i], y = ys[i], n = ph[i];
      const v = Math.sin(x * 0.21 + y * 0.34 - t * 1.7 + n * TAU) + 0.6 * Math.sin(x * 0.07 - y * 0.11 + t * 0.9 + n * 2);
      let np = pos;
      if (v > 1.45) np = Math.min(top, pos + 2);
      else if (v > 1.05) np = Math.min(top, pos + 1);
      else if (v < -1.15) np = Math.max(0, pos - 1);
      if (np === pos) continue;
      const k = ramp[np] * 3;
      put(out, w, h, x, y, [palette[k], palette[k + 1], palette[k + 2]], fp);
    }
  }
  // foam: a wave pulls it back now and then, showing the water under it
  for (let i = 0; i < life.foam.length; i++) {
    const p = life.foam[i], x = p % w, y = (p / w) | 0;
    if (Math.sin(t * 2.1 + x * 0.3 + y * 0.2 + noise(p) * TAU) > 0.78) {
      const k = life.foamUnder[i] * 3;
      put(out, w, h, x, y, [pm.palette[k], pm.palette[k + 1], pm.palette[k + 2]], fp);
    }
  }
  // lava: a slow bright pulse rolling down the flow
  ramped(out, pm, life.lava, fp, (x, y, n) => Math.sin(y * 0.22 - x * 0.08 - t * 1.4 + n * 2.5), 0.65, -0.9);
  // lights: each window flickers on its own clock
  ramped(out, pm, life.lights, fp, (_x, _y, n) => Math.sin(t * (2.5 + n * 5) + n * 40), Infinity, -0.93);
  // foliage: gusts cross the trees, lifting leaf highlights
  ramped(out, pm, life.foliage, fp, (x, y, n) => Math.sin(x * 0.45 + y * 0.3 + t * 2.3 + n * TAU) + 0.5 * Math.sin(x * 0.05 + t * 0.6), 1.15, -Infinity);

  // waterfalls: the water pours — a fast wave running down, bright at the lip
  ramped(out, pm, life.falls, fp, (x, y, n) => Math.sin(y * 0.7 + x * 0.3 - t * 9 + n * 2), 0.7, -0.7);
  // flags: a flutter running along the cloth
  ramped(out, pm, life.flags, fp, (x, y, n) => Math.sin(x * 1.3 + y * 0.5 - t * 7 + n * 2), 0.6, -0.6);
  // gulls over the sea: a few 2-frame birds on slow straight flights
  const GULLS = 5;
  for (let i = 0; i < GULLS; i++) {
    const n = noise(1000 + i * 97);
    const period = 40 + n * 25;
    const ph = ((t / period) + n) % 1;
    const yy = life.seaBox.y + (0.08 + ((i * 0.37 + n) % 1) * 0.84) * life.seaBox.h + Math.sin(t * 0.7 + i) * 3;
    const x0 = i % 2 ? life.seaBox.x + life.seaBox.w * (1 - ph) : life.seaBox.x + life.seaBox.w * ph;
    const x = Math.round(x0), y = Math.round(yy);
    const flap = Math.floor(t * 3 + i) % 2;
    const pts: [number, number][] = flap ? [[-2, -1], [-1, 0], [0, 0], [1, 0], [2, -1]] : [[-2, 0], [-1, -1], [0, 0], [1, -1], [2, 0]];
    let over = true;
    for (const [dx, dy] of pts) { const q = (y + dy) * w + x + dx; if (x + dx < 0 || x + dx >= w || y + dy < 0 || y + dy >= h || !life.sea[q]) { over = false; break; } }
    if (over) for (const [dx, dy] of pts) put(out, w, h, x + dx, y + dy, INK_RGB, fp);
  }
  // splashes: a fish breaks the water — a dot, a ring, gone (two at a time)
  if (life.water.px.length) {
    const top = life.water.ramp[life.water.ramp.length - 1] * 3;
    const hi: RGB = [pm.palette[top], pm.palette[top + 1], pm.palette[top + 2]];
    for (let i = 0; i < 2; i++) {
      const slot = Math.floor(t / 1.6 + i * 0.5);
      const ph = (t / 1.6 + i * 0.5) % 1;
      if (ph > 0.55) continue;
      const p = life.water.px[Math.floor(noise(slot * 31 + i) * life.water.px.length)];
      const cx = p % w, cy = (p / w) | 0;
      if (ph < 0.15) { put(out, w, h, cx, cy, hi, fp); put(out, w, h, cx, cy - 1, hi, fp); }
      else {
        const r = ph < 0.35 ? 1 : 2;
        for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) if (Math.abs(dx) + Math.abs(dy) === r) put(out, w, h, cx + dx, cy + dy, hi, fp);
      }
    }
  }

  // embers + smoke from every vent
  if (life.crater.length) {
    const C = life.crater.length;
    const lavaTop = life.lava.ramp;
    const EMBERS = 5 * C;
    for (let i = 0; i < EMBERS; i++) {
      const ph = (t * 0.42 + i / EMBERS) % 1;
      const src = life.crater[i % C];
      const sx = src % w, sy = (src / w) | 0;
      const x = Math.round(sx + Math.sin(ph * 9 + i) * 2.5), y = Math.round(sy - 1 - ph * 20);
      const k = lavaTop[ph < 0.35 ? lavaTop.length - 1 : ph < 0.7 ? Math.max(0, lavaTop.length - 3) : 1] * 3;
      const c: RGB = [pm.palette[k], pm.palette[k + 1], pm.palette[k + 2]];
      put(out, w, h, x, y, c, fp);
      if (ph < 0.25) put(out, w, h, x + 1, y, c, fp);
    }
    const PUFFS = 3;
    for (let v = 0; v < C; v++) {
      const cx = life.crater[v] % w, cy = (life.crater[v] / w) | 0;
      for (let i = 0; i < PUFFS; i++) {
        const ph = (t * 0.26 + i / PUFFS + v * 0.37) % 1;
        const x0 = Math.round(cx + ph * 12 + Math.sin(ph * 6 + i * 2 + v) * 2.5), y0 = Math.round(cy - 3 - ph * 30);
        const r = 1 + Math.floor(ph * 3.2);
        const c = SMOKE[ph < 0.3 ? 0 : ph < 0.65 ? 1 : 2];
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) + Math.abs(dy) > r) continue;
          if (ph > 0.5 && ((x0 + dx + y0 + dy) & 1)) continue; // thins out
          put(out, w, h, x0 + dx, y0 + dy, c, fp);
        }
      }
    }
  }

  // lighthouse beams: a ray sweeps round each lamp, fading with distance
  life.lamps.forEach((lp, i) => {
    const ang = t * 1.1 + i * 2.1;
    const dx = Math.cos(ang), dy = Math.sin(ang) * 0.6; // the sweep is seen from above, foreshortened
    put(out, w, h, lp.x, lp.y, BEAM_HI, fp);
    for (let r = 2; r <= 11; r++) {
      const x = Math.round(lp.x + dx * r), y = Math.round(lp.y + dy * r);
      if (r > 7 && ((x + y) & 1)) continue;
      put(out, w, h, x, y, r <= 5 ? BEAM_HI : BEAM, fp);
    }
  });

  // travellers: carts on the roads, parent → child
  for (const tr of travellers) {
    if (tr.len < 12) continue;
    const gap = tr.lit ? 0 : 60;
    const d = (t * tr.speed + tr.phase * (tr.len + gap)) % (tr.len + gap);
    if (d > tr.len) continue;
    const at = pointAt(tr.pts, d);
    const x = Math.round(at.x) - 2, y = Math.round(at.y) - 3;
    const bump = Math.floor(d / 3) % 2;
    // 4×3 cart: a load on top, the body, two wheels; 1-px shadow
    put(out, w, h, x + 1, y - bump, tr.hi, fp); put(out, w, h, x + 2, y - bump, tr.body, fp);
    for (let i = 0; i < 4; i++) put(out, w, h, x + i, y + 1 - bump, i === 1 ? tr.hi : tr.body, fp);
    put(out, w, h, x, y + 2, INK_RGB, fp); put(out, w, h, x + 3, y + 2, INK_RGB, fp);
    put(out, w, h, x + 1, y + 2, tr.body, fp); put(out, w, h, x + 2, y + 2, tr.body, fp);
    put(out, w, h, x + 1, y + 3, SHADOW_RGB, fp); put(out, w, h, x + 2, y + 3, SHADOW_RGB, fp);
  }
}

function pointAt(pts: { x: number; y: number }[], d: number): { x: number; y: number } {
  let left = d;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    if (left <= l || i === pts.length - 1) {
      const k = l ? Math.min(1, left / l) : 1;
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    }
    left -= l;
  }
  return pts[pts.length - 1] ?? { x: 0, y: 0 };
}
