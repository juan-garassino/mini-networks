// Pure geometry for the paper skin: turns world tiles into scissor-cut
// outlines and level-spot shapes. Styling only — never moves a position.
import { T, type Pt, type World } from "@/lib/world";

const f = (n: number) => (Math.round(n * 10) / 10).toString();

/**
 * Outline of a tile set as closed px loops (boundary edges chained, collinear
 * points dropped), clockwise in screen space.
 */
function traceLoops(inSet: (x: number, y: number) => boolean, cols: number, rows: number, tile: number): Pt[][] {
  // directed boundary edges keyed by their start vertex "x,y"
  const out = new Map<string, [number, number][]>();
  const add = (ax: number, ay: number, bx: number, by: number) => {
    const k = `${ax},${ay}`;
    const list = out.get(k);
    if (list) list.push([bx, by]); else out.set(k, [[bx, by]]);
  };
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!inSet(x, y)) continue;
      if (!inSet(x, y - 1)) add(x, y, x + 1, y);
      if (!inSet(x + 1, y)) add(x + 1, y, x + 1, y + 1);
      if (!inSet(x, y + 1)) add(x + 1, y + 1, x, y + 1);
      if (!inSet(x - 1, y)) add(x, y + 1, x, y);
    }
  }
  const loops: Pt[][] = [];
  for (const [startKey, list] of out) {
    while (list.length) {
      const [sx, sy] = startKey.split(",").map(Number);
      const loop: [number, number][] = [[sx, sy]];
      let cur = list.pop()!;
      let guard = 0;
      while (!(cur[0] === sx && cur[1] === sy) && guard++ < 100000) {
        loop.push(cur);
        const next = out.get(`${cur[0]},${cur[1]}`);
        if (!next || !next.length) break;
        cur = next.pop()!;
      }
      // drop collinear vertices
      const simp: Pt[] = [];
      const n = loop.length;
      for (let i = 0; i < n; i++) {
        const a = loop[(i - 1 + n) % n], b = loop[i], c = loop[(i + 1) % n];
        if ((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) !== 0) simp.push({ x: b[0] * tile, y: b[1] * tile });
      }
      if (simp.length >= 3) loops.push(simp);
    }
  }
  return loops;
}

/** Chaikin corner cutting on a closed loop — a scissor-cut, rounded coast. */
function chaikin(pts: Pt[], iterations: number): Pt[] {
  let p = pts;
  for (let it = 0; it < iterations; it++) {
    const q: Pt[] = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      q.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
      q.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    p = q;
  }
  return p;
}

const loopD = (loops: Pt[][]) =>
  loops.map((l) => `M${l.map((p) => `${f(p.x)} ${f(p.y)}`).join("L")}Z`).join("");

/**
 * One path per region: ALL its land tiles (river and bridge tiles included),
 * so neighbouring families abut — no pale gap between them. Borders are then
 * dressed as seams (hedge / stone wall) or one real river (see borders()).
 */
export function regionOutlines(world: World): string[] {
  const { cols, rows, tile, terrain, regionOf } = world;
  return world.regions.map((r) => {
    const inSet = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= cols || y >= rows) return false;
      const i = y * cols + x;
      return regionOf[i] === r.id && terrain[i] !== T.SEA;
    };
    return loopD(traceLoops(inSet, cols, rows, tile).map((l) => chaikin(l, 3)));
  });
}

/** The union of all land: the card every region sits on (hides smoothing slivers). */
export function landOutline(world: World): string {
  const { cols, rows, tile, terrain } = world;
  const inSet = (x: number, y: number) => x >= 0 && y >= 0 && x < cols && y < rows && terrain[y * cols + x] !== T.SEA;
  return loopD(traceLoops(inSet, cols, rows, tile).map((l) => chaikin(l, 3)));
}

/** Moving-average smoothing of an open polyline (endpoints kept): removes the
 *  tile staircase before Chaikin rounds what is left. */
export function smoothOpen(pts: Pt[], half: number, passes: number): Pt[] {
  let p = pts;
  for (let k = 0; k < passes; k++) {
    p = p.map((q, i) => {
      if (i === 0 || i === p.length - 1) return q;
      const h = Math.min(half, i, p.length - 1 - i);
      let x = 0, y = 0;
      for (let j = i - h; j <= i + h; j++) { x += p[j].x; y += p[j].y; }
      return { x: x / (2 * h + 1), y: y / (2 * h + 1) };
    });
  }
  return p;
}

/** Chaikin on an OPEN polyline (endpoints kept). */
export function chaikinOpen(pts: Pt[], iterations: number): Pt[] {
  let p = pts;
  for (let it = 0; it < iterations; it++) {
    if (p.length < 3) return p;
    const q: Pt[] = [p[0]];
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i], b = p[i + 1];
      q.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
      q.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    q.push(p[p.length - 1]);
    p = q;
  }
  return p;
}

export interface Border {
  a: string; b: string;
  /** smoothed px polylines along the shared edge */
  lines: Pt[][];
  /** per line: does its END touch the sea (after orienting so at most the end does) */
  mouth: boolean[];
}

/** Shared edges between each pair of families, chained and smoothed. */
export function borders(world: World): Border[] {
  const { cols, rows, tile, terrain, regionOf } = world;
  const land = (x: number, y: number) => x >= 0 && y >= 0 && x < cols && y < rows && terrain[y * cols + x] !== T.SEA;
  const reg = (x: number, y: number) => (land(x, y) ? regionOf[y * cols + x] : -1);
  const pairs = new Map<string, [number, number][][]>();          // "a|b" → list of [v1, v2] edges (vertex coords)
  const add = (ra: number, rb: number, e: [number, number][]) => {
    const k = ra < rb ? `${ra}|${rb}` : `${rb}|${ra}`;
    if (!pairs.has(k)) pairs.set(k, []);
    pairs.get(k)!.push(e);
  };
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const r = reg(x, y);
    if (r < 0) continue;
    const rr = reg(x + 1, y), rd = reg(x, y + 1);
    if (rr >= 0 && rr !== r) add(r, rr, [[x + 1, y], [x + 1, y + 1]]);
    if (rd >= 0 && rd !== r) add(r, rd, [[x, y + 1], [x + 1, y + 1]]);
  }
  const seaCorner = (vx: number, vy: number) => !land(vx - 1, vy - 1) || !land(vx, vy - 1) || !land(vx - 1, vy) || !land(vx, vy);
  const out: Border[] = [];
  for (const [k, edges] of pairs) {
    const [ia, ib] = k.split("|").map(Number);
    const adj = new Map<string, string[]>();
    const key = (v: [number, number]) => `${v[0]},${v[1]}`;
    for (const [u, v] of edges) {
      adj.set(key(u), [...(adj.get(key(u)) ?? []), key(v)]);
      adj.set(key(v), [...(adj.get(key(v)) ?? []), key(u)]);
    }
    const used = new Set<string>();
    const ek = (a: string, b: string) => (a < b ? `${a}/${b}` : `${b}/${a}`);
    const starts = [...adj.keys()].sort((a, b) => (adj.get(a)!.length === 1 ? -1 : 0) - (adj.get(b)!.length === 1 ? -1 : 0));
    const lines: Pt[][] = [], mouth: boolean[] = [];
    for (const s0 of starts) {
      for (const n0 of adj.get(s0)!) {
        if (used.has(ek(s0, n0))) continue;
        const chain = [s0];
        let prev = s0, cur = n0;
        used.add(ek(s0, n0));
        for (;;) {
          chain.push(cur);
          const nx = (adj.get(cur) ?? []).find((n) => n !== prev && !used.has(ek(cur, n)));
          if (!nx) break;
          used.add(ek(cur, nx));
          prev = cur; cur = nx;
        }
        if (chain.length < 3) continue;
        let vs = chain.map((c) => c.split(",").map(Number) as [number, number]);
        const s = seaCorner(...vs[0]), e = seaCorner(...vs[vs.length - 1]);
        if (s && !e) vs = vs.reverse();
        lines.push(chaikinOpen(smoothOpen(vs.map(([x, y]) => ({ x: x * tile, y: y * tile })), 4, 3), 2));
        mouth.push(s !== e || (s && e));
      }
    }
    if (lines.length) out.push({ a: world.regions[ia].family, b: world.regions[ib].family, lines, mouth });
  }
  return out;
}

/** The one real river: the longest border line reaching the sea, preferring
 *  one that comes down from Representation's highlands. */
export function pickRiver(bs: Border[]): { pair: [string, string]; line: Pt[] } | null {
  const len = (l: Pt[]) => l.reduce((s, p, i) => (i ? s + Math.hypot(p.x - l[i - 1].x, p.y - l[i - 1].y) : 0), 0);
  let best: { pair: [string, string]; line: Pt[]; score: number } | null = null;
  for (const b of bs) b.lines.forEach((l, i) => {
    if (!b.mouth[i]) return;
    const score = len(l) * (b.a === "representation" || b.b === "representation" ? 2 : 1);
    if (!best || score > best.score) best = { pair: [b.a, b.b], line: l, score };
  });
  return best ? { pair: (best as { pair: [string, string] }).pair, line: (best as { line: Pt[] }).line } : null;
}

/** A ribbon polygon along `line`, narrow at the source, widening to the mouth. */
export function ribbon(line: Pt[], w0: number, w1: number, extend = 0): string {
  const L: Pt[] = [...line];
  if (extend && L.length > 1) {
    const a = L[L.length - 2], b = L[L.length - 1], d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    L.push({ x: b.x + ((b.x - a.x) / d) * extend, y: b.y + ((b.y - a.y) / d) * extend });
  }
  const n = L.length, left: Pt[] = [], right: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = L[Math.max(0, i - 1)], b = L[Math.min(n - 1, i + 1)];
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
    const t = i / (n - 1), w = (w0 + (w1 - w0) * t * t) / 2;
    left.push({ x: L[i].x - (dy / d) * w, y: L[i].y + (dx / d) * w });
    right.push({ x: L[i].x + (dy / d) * w, y: L[i].y - (dx / d) * w });
  }
  const f = (p: Pt) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  return `M${left.map(f).join("L")}L${right.reverse().map(f).join("L")}Z`;
}

export const lineD = (l: Pt[]) => `M${l.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("L")}`;

/** Regular octagon (flat top) as polygon points, centred on (cx, cy). */
export function octagon(cx: number, cy: number, r: number): Pt[] {
  const pts: Pt[] = [];
  for (let k = 0; k < 8; k++) {
    const a = Math.PI / 8 + (k * Math.PI) / 4;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return pts;
}

/** Octagon extruded downward by `t` px — the silhouette of a thick card spot. */
export function extruded(cx: number, cy: number, r: number, t: number): Pt[] {
  const top = octagon(cx, cy, r);
  const bottom = octagon(cx, cy + t, r);
  return hull([...top, ...bottom]);
}

function hull(points: Pt[]): Pt[] {
  const p = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Pt[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: Pt[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  upper.pop(); lower.pop();
  return lower.concat(upper);
}

export const pts = (p: Pt[]) => p.map((q) => `${f(q.x)},${f(q.y)}`).join(" ");

/** Bridge deck rectangle in px, stretched a little onto both banks. */
export function bridgeDeck(world: World, tiles: number[], axis: "h" | "v") {
  const { cols, tile } = world;
  const xs = tiles.map((i) => i % cols), ys = tiles.map((i) => Math.floor(i / cols));
  const x0 = Math.min(...xs) * tile, x1 = (Math.max(...xs) + 1) * tile;
  const y0 = Math.min(...ys) * tile, y1 = (Math.max(...ys) + 1) * tile;
  const over = 5, pad = 1;
  return axis === "h"
    ? { x: x0 - over, y: y0 + pad, w: x1 - x0 + over * 2, h: y1 - y0 - pad * 2 }
    : { x: x0 + pad, y: y0 - over, w: x1 - x0 - pad * 2, h: y1 - y0 + over * 2 };
}

/** Tile centre (px) of a tile index. */
export function tileCenter(world: World, i: number): Pt {
  return { x: ((i % world.cols) + 0.5) * world.tile, y: (Math.floor(i / world.cols) + 0.5) * world.tile };
}

/**
 * The paper-fibre tile, drawn once to a small canvas at runtime (no binary
 * asset). Returns a data URL used as an SVG <pattern> image.
 */
export function fibreTile(size = 160): string | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  if (!g) return null;
  let s = 0x9e3779b9;
  const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 10000) / 10000; };
  for (let i = 0; i < 260; i++) {
    const x = rnd() * size, y = rnd() * size;
    const len = 4 + rnd() * 14, a = rnd() * Math.PI;
    const light = rnd() < 0.55;
    g.strokeStyle = light ? `rgba(255,253,246,${0.1 + rnd() * 0.16})` : `rgba(43,33,24,${0.05 + rnd() * 0.08})`;
    g.lineWidth = 0.6 + rnd() * 0.9;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + (rnd() - 0.5) * 4, y + Math.sin(a) * len * 0.5 + (rnd() - 0.5) * 4,
      x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }
  for (let i = 0; i < 500; i++) {
    g.fillStyle = rnd() < 0.5 ? "rgba(255,253,246,0.18)" : "rgba(43,33,24,0.07)";
    g.fillRect(rnd() * size, rnd() * size, 1, 1);
  }
  return c.toDataURL("image/png");
}
