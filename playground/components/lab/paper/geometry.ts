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
 * One path per region: its land tiles minus river channels and bridge decks,
 * so neighbouring families read as separate cardstock pieces with water
 * between them.
 */
export function regionOutlines(world: World): string[] {
  const { cols, rows, tile, terrain, regionOf } = world;
  return world.regions.map((r) => {
    const inSet = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= cols || y >= rows) return false;
      const i = y * cols + x;
      const t = terrain[i];
      return regionOf[i] === r.id && t !== T.SEA && t !== T.RIVER && t !== T.BRIDGE;
    };
    return loopD(traceLoops(inSet, cols, rows, tile).map((l) => chaikin(l, 3)));
  });
}

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
