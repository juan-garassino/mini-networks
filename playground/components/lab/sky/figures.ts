// The constellation figures and the star glyphs of the Celestial Zoo.
//
// Every figure is built from its family's ACTUAL star positions (lib/world
// centres), in world px, the way an atlas engraver threads Draco through the
// stars of Draco: the serpent's body is a spline through the sequence stars,
// the eye's lid is a lens around the perception stars with its iris on the
// atom, the furnace's flame wraps the generative stars, the mirrors hold the
// representation stars on their rims, the lattice cell has the structure stars
// at its vertices, the arrow's shaft runs down the decision stars. Pure and
// deterministic: same stars → same engraving.

export interface Pt { x: number; y: number }
export interface Star extends Pt { atom: boolean; depth: number }

export interface Figure {
  /** the body: drawn as an engraved double rule */
  body: string[];
  /** closed shapes that take the hatching (a subset of the body, or extra) */
  hatch: string[];
  /** detail: single hairlines (lashes, scales, fletching, spokes) */
  detail: string[];
  /** world bbox of the whole figure (camera + label placement) */
  box: { x: number; y: number; w: number; h: number };
}

/** Latin name (set in capitals, like an atlas) + the English gloss (italic). */
export const CONSTELLATION: Record<string, { latin: string; gloss: string }> = {
  perception: { latin: "Oculus", gloss: "the Eye" },
  sequence: { latin: "Serpens", gloss: "the Serpent" },
  generative: { latin: "Fornax", gloss: "the Furnace" },
  representation: { latin: "Gemini", gloss: "the Mirrors" },
  structure: { latin: "Crystallus", gloss: "the Lattice" },
  decision: { latin: "Sagitta", gloss: "the Arrow" },
};

// ——— geometry
const f1 = (v: number) => Math.round(v * 10) / 10;
const P = (p: Pt) => `${f1(p.x)} ${f1(p.y)}`;
const add = (a: Pt, b: Pt, k = 1): Pt => ({ x: a.x + b.x * k, y: a.y + b.y * k });
const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const len = (a: Pt) => Math.hypot(a.x, a.y) || 1;
const unit = (a: Pt): Pt => { const l = len(a); return { x: a.x / l, y: a.y / l }; };
const perp = (a: Pt): Pt => ({ x: -a.y, y: a.x });
const dot = (a: Pt, b: Pt) => a.x * b.x + a.y * b.y;

function centroid(ps: Pt[]): Pt {
  const n = Math.max(1, ps.length);
  return { x: ps.reduce((s, p) => s + p.x, 0) / n, y: ps.reduce((s, p) => s + p.y, 0) / n };
}

/** Principal axis of a point set (unit vector), x-positive for determinism. */
function axisOf(ps: Pt[]): Pt {
  const c = centroid(ps);
  let sxx = 0, syy = 0, sxy = 0;
  for (const p of ps) { const dx = p.x - c.x, dy = p.y - c.y; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
  const a = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const v = { x: Math.cos(a), y: Math.sin(a) };
  return v.x < 0 || (v.x === 0 && v.y < 0) ? { x: -v.x, y: -v.y } : v;
}

/** Catmull-Rom → cubic Bézier path through the points (open or closed). */
export function spline(ps: Pt[], closed = false, tension = 0.5): string {
  if (ps.length < 2) return "";
  const n = ps.length;
  const at = (i: number) => (closed ? ps[(i + n) % n] : ps[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${P(ps[0])}`;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const c1 = add(p1, sub(p2, p0), tension / 3), c2 = add(p2, sub(p3, p1), -tension / 3);
    d += `C${P(c1)} ${P(c2)} ${P(p2)}`;
  }
  return closed ? `${d}Z` : d;
}

function ellipse(c: Pt, rx: number, ry: number, rot: number): string {
  const a = { x: Math.cos(rot) * rx, y: Math.sin(rot) * rx };
  const deg = (rot * 180) / Math.PI;
  return `M${P(add(c, a))}A${f1(rx)} ${f1(ry)} ${f1(deg)} 1 1 ${P(sub(c, a))}A${f1(rx)} ${f1(ry)} ${f1(deg)} 1 1 ${P(add(c, a))}Z`;
}

const circle = (c: Pt, r: number) => ellipse(c, r, r, 0);
const line = (a: Pt, b: Pt) => `M${P(a)}L${P(b)}`;
const poly = (ps: Pt[]) => `M${ps.map(P).join("L")}Z`;

function boxOf(ps: Pt[], pad = 0) {
  const xs = ps.map((p) => p.x), ys = ps.map((p) => p.y);
  const x = Math.min(...xs) - pad, y = Math.min(...ys) - pad;
  return { x, y, w: Math.max(...xs) + pad - x, h: Math.max(...ys) + pad - y };
}

/** Points along an open spline-ish polyline (for scales/ticks): every `step` px. */
function along(ps: Pt[], step: number): { p: Pt; t: Pt }[] {
  const out: { p: Pt; t: Pt }[] = [];
  let carry = step / 2;
  for (let i = 0; i < ps.length - 1; i++) {
    const a = ps[i], b = ps[i + 1], d = sub(b, a), L = len(d), u = unit(d);
    for (let s = carry; s < L; s += step) out.push({ p: add(a, u, s), t: u });
    carry = (carry - L) % step; if (carry < 0) carry += step;
  }
  return out;
}

// ——— the six figures (all sizes in world px; the map's tile is 16 px)

/** Oculus: an almond eye lying level, its pupil on the family's atom (the star every perception model builds on), lashes on the upper lid. */
function eye(st: Star[]): Figure {
  const c0 = centroid(st);
  // the atom with the most descendants nearby = the one nearest the centroid
  const atoms = st.filter((s) => s.atom);
  const o: Pt = (atoms.length ? atoms : st).reduce((best, s) => (len(sub(s, c0)) < len(sub(best, c0)) ? s : best));
  const half = 270, wide = 128;
  const a = { x: o.x - half, y: o.y }, b = { x: o.x + half, y: o.y };
  // a cubic almond: controls a fifth of the way in, 4/3 × the half-height out → widest point = wide
  const k = (wide * 4) / 3;
  const lidUp = `M${P(a)}C${P({ x: o.x - half * 0.55, y: o.y - k })} ${P({ x: o.x + half * 0.55, y: o.y - k })} ${P(b)}`;
  const lidDn = `C${P({ x: o.x + half * 0.55, y: o.y + k })} ${P({ x: o.x - half * 0.55, y: o.y + k })} ${P(a)}Z`;
  const iris = circle(o, wide * 0.78), pupil = circle(o, wide * 0.3);
  // lashes: short strokes standing off the upper lid, splayed outward from the centre
  const lashes: string[] = [];
  for (let i = 1; i <= 7; i++) {
    const t = i / 8, u = 1 - t;
    const p = {
      x: u * u * u * a.x + 3 * u * u * t * (o.x - half * 0.55) + 3 * u * t * t * (o.x + half * 0.55) + t * t * t * b.x,
      y: u * u * u * a.y + 3 * u * u * t * (o.y - k) + 3 * u * t * t * (o.y - k) + t * t * t * b.y,
    };
    const dir = unit({ x: (p.x - o.x) * 0.5, y: -wide });
    lashes.push(line(add(p, dir, 9), add(p, dir, 30)));
  }
  // the lower lid's crease, a hairline under the eye
  const crease = `M${P({ x: o.x - half * 0.7, y: o.y + wide * 0.55 })}Q${P({ x: o.x, y: o.y + wide * 1.45 })} ${P({ x: o.x + half * 0.7, y: o.y + wide * 0.55 })}`;
  return { body: [lidUp + lidDn, iris], hatch: [pupil], detail: [...lashes, crease], box: boxOf([...st, { x: a.x, y: o.y - wide - 30 }, { x: b.x, y: o.y + wide }], 24) };
}

/** Serpens: a body threaded through every star along the long axis, a head and forked tongue at the far end, scale ticks. */
function serpent(st: Star[]): Figure {
  const c = centroid(st), ax = axisOf(st);
  // a nearest-neighbour walk from the star furthest back along the long axis:
  // the body winds through every star without doubling back across itself
  const left = [...st];
  left.sort((p, q) => dot(sub(p, c), ax) - dot(sub(q, c), ax));
  const ord: Star[] = [left.shift()!];
  while (left.length) {
    const last = ord[ord.length - 1];
    let bi = 0;
    for (let i = 1; i < left.length; i++) if (len(sub(left[i], last)) < len(sub(left[bi], last))) bi = i;
    ord.push(left.splice(bi, 1)[0]);
  }
  // a tail point before the first star
  const tail = add(ord[0], unit(sub(ord[0], ord[1] ?? c)), 70);
  const pts: Pt[] = [tail, ...ord];
  const end = pts[pts.length - 1], dir = unit(sub(end, pts[pts.length - 2] ?? c)), side = perp(dir);
  const neck = add(end, dir, 40);
  const tip = add(neck, dir, 70);
  const head = `M${P(add(neck, side, -24))}Q${P(add(add(neck, dir, 40), side, -36))} ${P(tip)}Q${P(add(add(neck, dir, 40), side, 36))} ${P(add(neck, side, 24))}Z`;
  const eyeDot = circle(add(add(neck, dir, 34), side, -12), 4);
  const tongue = `${line(tip, add(tip, dir, 26))}${line(add(tip, dir, 26), add(add(tip, dir, 40), side, -11))}${line(add(tip, dir, 26), add(add(tip, dir, 40), side, 11))}${eyeDot}`;
  // scales: tiny ticks across the body, every 30 px along the polyline
  const scales = along(pts, 30).map(({ p, t }) => { const n = perp(t); return line(add(p, n, -6), add(p, n, 6)); });
  return { body: [spline([...pts, neck], false, 0.75)], hatch: [head], detail: [tongue, ...scales], box: boxOf([...pts, tip], 40) };
}

/** Fornax: a flame wrapping the stars (apex above the highest one), the crucible under the lowest. */
function furnace(st: Star[]): Figure {
  const c = centroid(st);
  const top = Math.min(...st.map((s) => s.y)), bot = Math.max(...st.map((s) => s.y));
  const left = Math.min(...st.map((s) => s.x)), right = Math.max(...st.map((s) => s.x));
  const w = right - left, cx = (left + right) / 2;
  const apex = { x: cx + w * 0.06, y: top - 120 };
  const base = bot + 34;
  const flame = spline([apex, { x: right + 60, y: c.y - 10 }, { x: right + 30, y: base }, { x: left - 30, y: base }, { x: left - 60, y: c.y - 10 }], true, 0.75);
  const inner = spline([{ x: cx - w * 0.04, y: top - 30 }, { x: cx + w * 0.22, y: c.y + 30 }, { x: cx, y: base - 6 }, { x: cx - w * 0.22, y: c.y + 30 }], true, 0.75);
  const cru = poly([{ x: left - 70, y: base }, { x: right + 70, y: base }, { x: right + 30, y: base + 62 }, { x: left - 30, y: base + 62 }]);
  const legs = `${line({ x: left - 10, y: base + 62 }, { x: left - 30, y: base + 92 })}${line({ x: right + 10, y: base + 62 }, { x: right + 30, y: base + 92 })}`;
  return { body: [flame, cru], hatch: [cru], detail: [inner, legs], box: boxOf([apex, { x: left - 70, y: base + 92 }, { x: right + 70, y: base + 92 }], 0) };
}

/** Gemini: two hand mirrors facing across a reflection axis; each mirror's rim passes by its half of the stars. */
function mirrors(st: Star[]): Figure {
  const c = centroid(st), ax = axisOf(st), nx = perp(ax);
  const ord = [...st].sort((p, q) => dot(sub(p, c), ax) - dot(sub(q, c), ax));
  const halves = [ord.slice(0, Math.ceil(ord.length / 2)), ord.slice(Math.ceil(ord.length / 2))].filter((h) => h.length);
  const rot = Math.atan2(nx.y, nx.x);
  const body: string[] = [], detail: string[] = [], hatch: string[] = [], ext: Pt[] = [];
  halves.forEach((h, i) => {
    const hc = centroid(h);
    const ry = Math.max(46, ...h.map((p) => Math.abs(dot(sub(p, hc), ax)))) + 14;
    const rx = Math.max(70, ...h.map((p) => Math.abs(dot(sub(p, hc), nx)))) + 18;
    body.push(ellipse(hc, rx, ry, rot));
    hatch.push(ellipse(hc, rx * 0.72, ry * 0.72, rot));
    // the handle points away from the twin
    const away = unit(i === 0 ? { x: -ax.x, y: -ax.y } : ax);
    const h0 = add(hc, away, ry), h1 = add(hc, away, ry + 80);
    detail.push(line(h0, h1), circle(h1, 7));
    ext.push(add(hc, nx, -rx), add(hc, nx, rx), h1);
  });
  // the reflection axis between the two mirrors, perpendicular to their line
  detail.push(line(add(c, nx, -150), add(c, nx, 150)));
  ext.push(add(c, nx, -150), add(c, nx, 150));
  return { body, hatch, detail, box: boxOf(ext, 12) };
}

/** Crystallus: a hexagonal cell with the stars on opposite vertices, its diagonals, and a ring of six satellite cells' edges. */
function lattice(st: Star[]): Figure {
  const ps: Pt[] = st.length >= 2 ? [st[0], st[1]] : st.length ? [st[0], add(st[0], { x: 120, y: 0 })] : [{ x: 0, y: 0 }, { x: 120, y: 0 }];
  const c = centroid(ps), r = len(sub(ps[1], ps[0])) / 2, a0 = Math.atan2(ps[0].y - c.y, ps[0].x - c.x);
  const hex = (cc: Pt, rr: number) => Array.from({ length: 6 }, (_, i) => ({ x: cc.x + rr * Math.cos(a0 + (i * Math.PI) / 3), y: cc.y + rr * Math.sin(a0 + (i * Math.PI) / 3) }));
  const v = hex(c, r);
  const diag = [0, 1, 2].map((i) => line(v[i], v[i + 3])).join("");
  // two neighbour cells sharing the edges beside the stars: a strip of honeycomb, so it reads as a crystal
  const outer: string[] = [];
  for (const i of [1, 4]) {
    const mid = centroid([v[i], v[(i + 1) % 6]]);
    const nc = add(c, sub(mid, c), 2);
    outer.push(poly(hex(nc, r)));
  }
  return { body: [poly(v)], hatch: [poly(hex(c, r * 0.36))], detail: [diag, ...outer], box: boxOf([...v, ...[1, 4].flatMap((i) => hex(add(c, sub(centroid([v[i], v[(i + 1) % 6]]), c), 2), r))], 6) };
}

/** Sagitta: the shaft down the stars' long axis (pointing from the atoms to their descendants), a head, fletching, a drawn bow. */
function arrow(st: Star[]): Figure {
  const c = centroid(st);
  let ax = axisOf(st);
  // point the arrow from the shallow (atom) end toward the deep end
  const deep = centroid(st.filter((s) => !s.atom).length ? st.filter((s) => !s.atom) : st);
  const shallow = centroid(st.filter((s) => s.atom).length ? st.filter((s) => s.atom) : st);
  if (dot(sub(deep, shallow), ax) < 0) ax = { x: -ax.x, y: -ax.y };
  const nx = perp(ax);
  const pr = st.map((p) => dot(sub(p, c), ax));
  const tail = add(c, ax, Math.min(...pr) - 60), head = add(c, ax, Math.max(...pr) + 70);
  const shaft = line(tail, head);
  const tip = `M${P(add(add(head, ax, -54), nx, -24))}L${P(add(head, ax, 12))}L${P(add(add(head, ax, -54), nx, 24))}L${P(add(head, ax, -40))}Z`;
  const fl: string[] = [];
  for (let i = 0; i < 3; i++) {
    const p = add(tail, ax, 12 + i * 18);
    fl.push(line(p, add(add(p, ax, -26), nx, -22)), line(p, add(add(p, ax, -26), nx, 22)));
  }
  // the bow: a bent limb on the side with more stars, drawn through the farthest star's offset
  const pn = st.map((p) => dot(sub(p, c), nx));
  const sgn = pn.reduce((s, v) => s + v, 0) >= 0 ? 1 : -1;
  const reach = Math.max(80, ...pn.map((v) => v * sgn)) + 40;
  const grip = add(c, ax, Math.min(...pr) + 40);
  const b0 = add(grip, ax, -(Math.max(...pr) - Math.min(...pr)) * 0.2), b1 = add(grip, ax, (Math.max(...pr) - Math.min(...pr)) * 0.75);
  const bowMid = add(centroid([b0, b1]), nx, sgn * reach);
  const bow = `M${P(b0)}Q${P(add(bowMid, nx, sgn * reach * 0.6))} ${P(b1)}`;
  const string = line(b0, b1);
  return { body: [shaft, bow], hatch: [tip], detail: [...fl, string], box: boxOf([tail, head, b0, b1, add(bowMid, nx, sgn * reach * 0.3), add(head, nx, -20), add(head, nx, 20)], 20) };
}

const MAKERS: Record<string, (s: Star[]) => Figure> = {
  perception: eye, sequence: serpent, generative: furnace, representation: mirrors, structure: lattice, decision: arrow,
};

/** The family's engraved figure, threaded through its stars (null when the family has none). */
export function figureFor(family: string, stars: Star[]): Figure | null {
  const make = MAKERS[family];
  if (!make || !stars.length) return null;
  return make(stars);
}

/** An n-ray star outline centred at 0,0 with outer radius r and inner radius r·k. */
export function starPath(n: number, r: number, k = 0.42): string {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (Math.PI / n) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * k;
    pts.push(`${(Math.cos(a) * rr).toFixed(2)},${(Math.sin(a) * rr).toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
}

/** Deterministic field stars (the faint background sky), unit coordinates. */
export function fieldStars(count: number, seed = 3): { x: number; y: number; r: number; a: number }[] {
  let s = seed >>> 0 || 1;
  const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const out = [];
  for (let i = 0; i < count; i++) out.push({ x: rnd(), y: rnd(), r: 0.4 + rnd() * rnd() * 1.4, a: 0.25 + rnd() * 0.6 });
  return out;
}
