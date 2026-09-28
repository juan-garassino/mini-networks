// Steps 2–4 — atoms (4×4), derived models (2×2) and one set-piece per region.
import type { Box, Pt } from "./types.ts";
import { T } from "./types.ts";
import type { Graph } from "./graph.ts";
import type { RegionGrid } from "./regions.ts";
import {
  ATOM_BORDER_W, ATOM_EDGE_CAP, ATOM_GAP, ATOM_EDGE_MIN, ATOM_EDGE_W, ATOM_SIZE, ATOM_SPREAD_CAP, BORDER_NEAR_SLACK,
  DERIVED_EDGE_MIN, DERIVED_SIZE, FOOT_GAP, GEN_STEP, SETPIECE_BIG_MIN_TILES,
  SETPIECE_FOOT_GAP, SETPIECE_LINE_BUFFER, SETPIECE_SIZES_BIG, SETPIECE_SIZES_SMALL,
  SIBLING_CONE_DEG, LOOKAHEAD_MAX, W_CROSS_BORDER, W_DESC_BORDER, W_NOISE, W_SECONDARY, W_SIBLING,
} from "./constants.ts";
import { FAR, bfs, edgeDistance } from "./grid.ts";
import { fnv1a, hash2 } from "./rng.ts";

export interface Placement {
  /** name → footprint (tiles). */
  foot: Map<string, Box>;
  /** region id → set-piece (tiles) or null. */
  setPiece: (Box | null)[];
  /** hard failures (a node that found no legal spot). */
  failures: string[];
}

const centerOf = (b: Box): Pt => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

export function placeAll(g: Graph, rg: RegionGrid): Placement {
  const { cols, rows, regionOf, terrain } = rg;
  const n = cols * rows;
  const famId = new Map(rg.regions.map((r) => [r.family, r.id]));
  const edge = edgeDistance(cols, rows, (i) => terrain[i] === T.LAND || terrain[i] === T.COAST);
  const blocked = new Uint8Array(n); // footprint tiles dilated by FOOT_GAP
  const foot = new Map<string, Box>();
  const failures: string[] = [];

  const borderCache = new Map<string, Int16Array>();
  /** distance field to the border of region r with region s (or to s if they don't touch). */
  const borderField = (r: number, s: number): Int16Array => {
    const key = `${r}:${s}`;
    let f = borderCache.get(key);
    if (f) return f;
    const src: number[] = [];
    for (let i = 0; i < n; i++) {
      if (regionOf[i] !== r) continue;
      const x = i % cols;
      if ((x + 1 < cols && regionOf[i + 1] === s) || (x > 0 && regionOf[i - 1] === s) ||
          (i + cols < n && regionOf[i + cols] === s) || (i >= cols && regionOf[i - cols] === s)) src.push(i);
    }
    if (!src.length) for (let i = 0; i < n; i++) if (regionOf[i] === s) src.push(i);
    f = bfs(cols, rows, src);
    borderCache.set(key, f);
    return f;
  };

  /**
   * Distance field to the stretch of the r|s border nearest the cross-family
   * parent (border tiles within BORDER_NEAR_SLACK of the closest one), so the
   * child waits at the crossing its parent can actually reach.
   */
  const nearBorderField = (r: number, s: number, pb: Box | undefined): Int16Array => {
    const full = borderField(r, s);
    if (!pb) return full;
    const pc = centerOf(pb);
    const border: number[] = [];
    for (let i = 0; i < n; i++) if (full[i] === 0) border.push(i);
    const d = border.map((i) => { const x = i % cols; return Math.hypot(x + 0.5 - pc.x, (i - x) / cols + 0.5 - pc.y); });
    const mn = Math.min(...d);
    return bfs(cols, rows, border.filter((_, k) => d[k] <= mn + BORDER_NEAR_SLACK));
  };
  /** min edge-distance over the box, or -1 if any tile is illegal. */
  const fitEdge = (x: number, y: number, w: number, h: number, r: number, edgeMin: number, block: Uint8Array) => {
    if (x < 0 || y < 0 || x + w > cols || y + h > rows) return -1;
    let mn = FAR;
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        const i = yy * cols + xx;
        if (regionOf[i] !== r || block[i] || edge[i] < edgeMin) return -1;
        if (edge[i] < mn) mn = edge[i];
      }
    }
    return mn;
  };
  const occupy = (name: string, b: Box) => {
    foot.set(name, b);
    stamp(blocked, b);
  };
  const regionTiles: number[][] = rg.regions.map(() => []);
  for (let i = 0; i < n; i++) if (regionOf[i] >= 0) regionTiles[regionOf[i]].push(i);
  const derivedLeft = rg.regions.map((reg) => g.membersOf.get(reg.family)!.filter((m) => !g.atom.get(m)).length);
  let gap = ATOM_GAP; // atom phase; switched to FOOT_GAP once derived models are placed
  const stamp = (block: Uint8Array, b: Box) => {
    for (let yy = b.y - gap; yy < b.y + b.h + gap; yy++) {
      for (let xx = b.x - gap; xx < b.x + b.w + gap; xx++) {
        if (xx >= 0 && yy >= 0 && xx < cols && yy < rows) block[yy * cols + xx] = 1;
      }
    }
  };
  /** Can `atoms` 4×4 + `derivedN` 2×2 footprints still be packed (scan-order greedy) after placing `b`? */
  const canPack = (r: number, b: Box, atoms: number, derivedN: number) => {
    if (!atoms && !derivedN) return true;
    const tmp = blocked.slice();
    stamp(tmp, b);
    const need: [number, number][] = [];
    for (let k = 0; k < atoms; k++) need.push([ATOM_SIZE, ATOM_EDGE_MIN]);
    for (let k = 0; k < derivedN; k++) need.push([DERIVED_SIZE, DERIVED_EDGE_MIN]);
    let from = 0;
    let lastSize = -1;
    const tiles = regionTiles[r];
    for (const [s, em] of need) {
      if (s !== lastSize) from = 0; // same-size items can never fit before the previous hit
      lastSize = s;
      let hit = -1;
      for (let k = from; k < tiles.length; k++) {
        const i = tiles[k];
        const x = i % cols;
        if (fitEdge(x, (i - x) / cols, s, s, r, em, tmp) >= 0) { hit = i; from = k; break; }
      }
      if (hit < 0) return false;
      const x = hit % cols;
      stamp(tmp, { x, y: (hit - x) / cols, w: s, h: s });
    }
    return true;
  };
  /** Lowest-score candidate that keeps the rest of the region packable (lazy lookahead). */
  const pickFeasible = (cands: { box: Box; score: number }[], r: number, atoms: number, derivedN: number): Box | null => {
    if (!cands.length) return null;
    const order = cands.map((c, i) => i).sort((a, b) => cands[a].score - cands[b].score || a - b);
    for (let k = 0; k < Math.min(order.length, LOOKAHEAD_MAX); k++) {
      const b = cands[order[k]].box;
      if (!atoms) {
        // cheap sufficient test: each later 2×2 kills at most (2·(gap+2)−1)² candidate spots
        const reach = gap + DERIVED_SIZE;
        let left = 0;
        for (const c of cands) {
          if (c.box.x <= b.x - reach || c.box.x >= b.x + b.w + gap || c.box.y <= b.y - reach || c.box.y >= b.y + b.h + gap) left++;
        }
        if (left >= derivedN * (2 * reach - 1) ** 2) return b;
      }
      if (canPack(r, b, atoms, derivedN)) return b;
    }
    return cands[order[0]].box;
  };
  const tileAt = (p: Pt) => Math.min(n - 1, Math.max(0, Math.floor(p.y) * cols + Math.floor(p.x)));

  // ── atoms ────────────────────────────────────────────────────────────
  const descendants = (a: string) => {
    const seen = new Set<string>([a]);
    const stack = [a];
    while (stack.length) {
      for (const c of g.children.get(stack.pop()!)!) if (!seen.has(c)) { seen.add(c); stack.push(c); }
    }
    return seen;
  };
  for (const reg of rg.regions) {
    const r = reg.id;
    const atoms = g.membersOf.get(reg.family)!.filter((m) => g.atom.get(m));
    const desc = new Map(atoms.map((a) => [a, descendants(a)]));
    atoms.sort((a, b) => desc.get(b)!.size - desc.get(a)!.size || (a < b ? -1 : 1));
    const placedAtoms: Pt[] = [];
    let atomsLeft = atoms.length;
    for (const a of atoms) {
      // borders needed: cross-family edges touching the atom's same-family subtree
      const need = new Set<number>();
      for (const d of desc.get(a)!) {
        if (g.family.get(d) !== reg.family) continue;
        for (const e of g.edges) {
          if (!e.cross || (e.from !== d && e.to !== d)) continue;
          const other = e.from === d ? e.to : e.from;
          need.add(famId.get(g.family.get(other)!)!);
        }
      }
      const fields = [...need].sort((x, y) => x - y).map((s) => borderField(r, s));
      const cands: { box: Box; score: number }[] = [];
      for (const i of regionTiles[r]) {
        const x = i % cols;
        const y = (i - x) / cols;
        const e = fitEdge(x, y, ATOM_SIZE, ATOM_SIZE, r, ATOM_EDGE_MIN, blocked);
        if (e < 0) continue;
        const c = { x: x + ATOM_SIZE / 2, y: y + ATOM_SIZE / 2 };
        let spread = 0;
        if (placedAtoms.length) {
          spread = Infinity;
          for (const p of placedAtoms) spread = Math.min(spread, Math.hypot(p.x - c.x, p.y - c.y));
          spread = Math.min(spread, ATOM_SPREAD_CAP);
        }
        let border = 0;
        if (fields.length) {
          const ti = tileAt(c);
          for (const f of fields) border += f[ti];
          border /= fields.length;
        }
        cands.push({ box: { x, y, w: ATOM_SIZE, h: ATOM_SIZE }, score: -(ATOM_EDGE_W * Math.min(e, ATOM_EDGE_CAP) + spread - ATOM_BORDER_W * border) });
      }
      atomsLeft--;
      const best = pickFeasible(cands, r, atomsLeft, derivedLeft[r]);
      if (!best) { failures.push(`no room for atom ${a}`); continue; }
      occupy(a, best);
      placedAtoms.push(centerOf(best));
    }
  }

  // ── derived ──────────────────────────────────────────────────────────
  gap = FOOT_GAP;
  blocked.fill(0);
  for (const b of foot.values()) stamp(blocked, b);
  const derived = g.names.filter((m) => !g.atom.get(m));
  const kids = (p: string | null) => (p ? g.primaryChildren.get(p)!.length : 0);
  // spec order (depth, primary's child count desc, name) — depth counted inside
  // the family first, and one tie-break
  // inserted before name: nodes tied to another family (cross parent or child)
  // choose first, so they get the spots near their border.
  const crossTies = (m: string) =>
    g.edges.filter((e) => e.cross && (e.from === m || e.to === m)).length;
  derived.sort((a, b) =>
    g.famDepth.get(a)! - g.famDepth.get(b)! || // generation inside the family (see GEN_STEP)
    g.depth.get(a)! - g.depth.get(b)! ||
    kids(g.primary.get(b)!) - kids(g.primary.get(a)!) ||
    crossTies(b) - crossTies(a) ||
    (a < b ? -1 : 1));
  const cone = (SIBLING_CONE_DEG * Math.PI) / 180;
  for (const m of derived) {
    const fam = g.family.get(m)!;
    const r = famId.get(fam)!;
    const prim = g.primary.get(m)!;
    const pBox = foot.get(prim);
    const pc = pBox ? centerOf(pBox) : null;
    // generations from the primary, counted inside the family (see GEN_STEP)
    const k = prim && g.family.get(prim) === fam ? Math.max(1, g.famDepth.get(m)! - g.famDepth.get(prim)!) : 1;
    const secs = g.parents.get(m)!.filter((p) => p !== prim && g.family.get(p) === fam && foot.has(p))
      .map((p) => centerOf(foot.get(p)!));
    const crossFields = g.parents.get(m)!.filter((p) => g.family.get(p) !== fam)
      .map((p) => nearBorderField(r, famId.get(g.family.get(p)!)!, foot.get(p)));
    // pull toward the borders this node's cross-family children will need
    const descFields = [...new Set(g.children.get(m)!.filter((c) => g.family.get(c) !== fam).map((c) => g.family.get(c)!))]
      .sort().map((f) => borderField(r, famId.get(f)!));
    const sibBearings = pc
      ? g.primaryChildren.get(prim)!.filter((s) => s !== m && foot.has(s))
          .map((s) => { const c = centerOf(foot.get(s)!); return Math.atan2(c.y - pc.y, c.x - pc.x); })
      : [];
    const nseed = fnv1a(m);
    const cands: { box: Box; score: number }[] = [];
    for (const i of regionTiles[r]) {
      const x = i % cols;
      const y = (i - x) / cols;
      if (fitEdge(x, y, DERIVED_SIZE, DERIVED_SIZE, r, DERIVED_EDGE_MIN, blocked) < 0) continue;
      const c = { x: x + DERIVED_SIZE / 2, y: y + DERIVED_SIZE / 2 };
      let cost = 0;
      if (pc) {
        const d = Math.hypot(c.x - pc.x, c.y - pc.y);
        cost += (d - GEN_STEP * k) ** 2 / GEN_STEP;
        const bearing = Math.atan2(c.y - pc.y, c.x - pc.x);
        for (const b of sibBearings) {
          let diff = Math.abs(bearing - b);
          if (diff > Math.PI) diff = 2 * Math.PI - diff;
          if (diff < cone) { cost += W_SIBLING; break; }
        }
      }
      for (const s of secs) cost += (W_SECONDARY * Math.hypot(c.x - s.x, c.y - s.y)) / GEN_STEP;
      if (crossFields.length) {
        const ti = tileAt(c);
        for (const f of crossFields) cost += (W_CROSS_BORDER * f[ti]) / GEN_STEP;
      }
      if (descFields.length) {
        const ti = tileAt(c);
        for (const f of descFields) cost += (W_DESC_BORDER * f[ti]) / GEN_STEP;
      }
      cost += W_NOISE * hash2(x, y, nseed);
      cands.push({ box: { x, y, w: DERIVED_SIZE, h: DERIVED_SIZE }, score: cost });
    }
    derivedLeft[r]--;
    const best = pickFeasible(cands, r, 0, derivedLeft[r]);
    if (!best) { failures.push(`no room for ${m}`); continue; }
    occupy(m, best);
  }

  // ── set-pieces ───────────────────────────────────────────────────────
  const spBlock = new Uint8Array(n);
  for (const b of foot.values()) {
    for (let yy = b.y - SETPIECE_FOOT_GAP; yy < b.y + b.h + SETPIECE_FOOT_GAP; yy++) {
      for (let xx = b.x - SETPIECE_FOOT_GAP; xx < b.x + b.w + SETPIECE_FOOT_GAP; xx++) {
        if (xx >= 0 && yy >= 0 && xx < cols && yy < rows) spBlock[yy * cols + xx] = 1;
      }
    }
  }
  const segs: [Pt, Pt][] = [];
  for (const e of g.edges) {
    const a = foot.get(e.from);
    const b = foot.get(e.to);
    if (a && b) segs.push([centerOf(a), centerOf(b)]);
  }
  const setPiece: (Box | null)[] = rg.regions.map((reg) => {
    const sizes = reg.tiles >= SETPIECE_BIG_MIN_TILES ? SETPIECE_SIZES_BIG : SETPIECE_SIZES_SMALL;
    for (const [w, h] of sizes) {
      let best: Box | null = null;
      let bestE = -1;
      for (let i = 0; i < n; i++) {
        if (regionOf[i] !== reg.id) continue;
        const x = i % cols;
        const y = (i - x) / cols;
        const e = fitEdge(x, y, w, h, reg.id, 1, spBlock);
        if (e <= bestE) continue;
        const buf = SETPIECE_LINE_BUFFER;
        const box = { x: x - buf, y: y - buf, w: w + 2 * buf, h: h + 2 * buf };
        if (segs.some(([p, q]) => segmentHitsBox(p, q, box))) continue;
        bestE = e;
        best = { x, y, w, h };
      }
      if (best) return best;
    }
    return null;
  });

  for (const b of foot.values()) paint(terrain, cols, b, T.FOOT);
  for (const b of setPiece) if (b) paint(terrain, cols, b, T.SETPIECE);
  return { foot, setPiece, failures };
}

function paint(terrain: Uint8Array, cols: number, b: Box, v: number) {
  for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) terrain[y * cols + x] = v;
}

/** Liang–Barsky: does segment pq intersect the (closed) box? */
export function segmentHitsBox(p: Pt, q: Pt, b: Box): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  // each constraint has the form t·den ≥ num
  const clip = (den: number, num: number) => {
    if (den === 0) return num <= 0;
    const t = num / den;
    if (den > 0) { if (t > t1) return false; if (t > t0) t0 = t; }
    else { if (t < t0) return false; if (t < t1) t1 = t; }
    return true;
  };
  return clip(dx, b.x - p.x) && clip(-dx, p.x - (b.x + b.w)) &&
    clip(dy, b.y - p.y) && clip(-dy, p.y - (b.y + b.h)) && t0 <= t1;
}
