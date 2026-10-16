// Steps 2–4 — atoms (4×4), derived models (2×2) and one set-piece per region.
import type { Box, Pt } from "./types.ts";
import { T } from "./types.ts";
import type { Graph } from "./graph.ts";
import type { RegionGrid } from "./regions.ts";
import {
  ATOM_BORDER_W, ATOM_EDGE_CAP, ATOM_GAP, ATOM_EDGE_MIN, ATOM_EDGE_W, ATOM_SIZE, ATOM_SPREAD_CAP, BORDER_NEAR_SLACK,
  DERIVED_EDGE_MIN, DERIVED_SIZE, FOOT_GAP, GEN_STEP, SETPIECE_BIG_MIN_TILES,
  SETPIECE_FOOT_GAP, SETPIECE_LINE_BUFFER, SETPIECE_SIZES_BIG, SETPIECE_SIZES_SMALL,
  SIBLING_CONE_DEG, LOOKAHEAD_MAX, TRUNK_FIRST, TRUNK_FIRST_ATOM, TRUNK_HALF, TRUNK_MIN_SEP, TRUNK_OFF, TRUNK_SPLIT,
  W_ATOM_ANCHOR, W_CROSS_BORDER, W_DESC_BORDER, W_NOISE, W_SECONDARY, W_SETPIECE_ANCHOR, W_SIBLING, W_TRUNK, W_TRUNK_OUT,
  W_TRUNK_AVOID, W_TRUNK_PULL, TRUNK_CROSS_KIDS,
} from "./constants.ts";
import { FAR, bfs, edgeDistance } from "./grid.ts";
import { FRAME_H, FRAME_W, PRESETS } from "./continent.ts";
import type { Preset } from "./continent.ts";
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

export function placeAll(g: Graph, rg: RegionGrid, preset: Preset = PRESETS.pixel): Placement {
  const { cols, rows, regionOf, terrain } = rg;
  const n = cols * rows;
  const famId = new Map(rg.regions.map((r) => [r.family, r.id]));
  // v3: reef tiles (sea with an owner) are ground for underwater regions
  const edge = edgeDistance(cols, rows, (i) => terrain[i] === T.LAND || terrain[i] === T.COAST || (terrain[i] === T.SEA && regionOf[i] >= 0));
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
  const nearCache = new Map<string, Int16Array>();
  const nearBorderField = (r: number, s: number, pb: Box | undefined): Int16Array => {
    const full = borderField(r, s);
    if (!pb) return full;
    const key = `${r}:${s}:${pb.x}:${pb.y}`;
    const hit = nearCache.get(key);
    if (hit) return hit;
    const pc = centerOf(pb);
    const border: number[] = [];
    for (let i = 0; i < n; i++) if (full[i] === 0) border.push(i);
    const d = border.map((i) => { const x = i % cols; return Math.hypot(x + 0.5 - pc.x, (i - x) / cols + 0.5 - pc.y); });
    const mn = Math.min(...d);
    const f = bfs(cols, rows, border.filter((_, k) => d[k] <= mn + BORDER_NEAR_SLACK));
    nearCache.set(key, f);
    return f;
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
  // candidates as flat arrays (x, y, score) — v2's grid is ~2.4× larger and
  // per-candidate objects dominated placement time
  interface Cands { x: number[]; y: number[]; score: number[]; size: number; length: number }
  const newCands = (size: number): Cands => ({ x: [], y: [], score: [], size, length: 0 });
  const pushCand = (c: Cands, x: number, y: number, score: number) => { c.x.push(x); c.y.push(y); c.score.push(score); c.length++; };
  const pickFeasible = (c: Cands, r: number, atoms: number, derivedN: number): Box | null => {
    if (!c.length) return null;
    const sc = c.score;
    const boxOf = (i: number): Box => ({ x: c.x[i], y: c.y[i], w: c.size, h: c.size });
    // the best candidate is almost always feasible: find it in O(n) and only
    // sort the rest when the lookahead rejects it
    let first = 0;
    for (let i = 1; i < c.length; i++) if (sc[i] < sc[first]) first = i;
    let order = [first];
    let sorted = false;
    for (let k = 0; k < Math.min(c.length, LOOKAHEAD_MAX); k++) {
      if (k === 1 && !sorted) {
        order = sc.map((_, i) => i).sort((a, b) => sc[a] - sc[b] || a - b);
        sorted = true;
      }
      const b = boxOf(order[k]);
      if (!atoms) {
        // cheap sufficient test: each later 2×2 kills at most (2·(gap+2)−1)² candidate spots
        const reach = gap + DERIVED_SIZE;
        let left = 0;
        for (let i = 0; i < c.length; i++) {
          const cx = c.x[i];
          const cy = c.y[i];
          if (cx <= b.x - reach || cx >= b.x + b.w + gap || cy <= b.y - reach || cy >= b.y + b.h + gap) left++;
        }
        if (left >= derivedN * (2 * reach - 1) ** 2) return b;
      }
      if (canPack(r, b, atoms, derivedN)) return b;
    }
    return boxOf(order[0]);
  };
  const tileAt = (p: Pt) => Math.min(n - 1, Math.max(0, Math.floor(p.y) * cols + Math.floor(p.x)));
  /** v3: authored reference spots (frame units) → tile coords. */
  const toTile = (p: [number, number]): Pt => ({ x: (p[0] * cols) / FRAME_W, y: (p[1] * rows) / FRAME_H });
  const anchorTile = (name: string): Pt | null => (preset.atomAnchors[name] ? toTile(preset.atomAnchors[name]) : null);

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
      const cands = newCands(ATOM_SIZE);
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
        // v3: the reference map's label spot pulls the atom (dominates spread/border terms)
        const an = anchorTile(a);
        const pull = an ? W_ATOM_ANCHOR * Math.hypot(c.x - an.x, c.y - an.y) : 0;
        pushCand(cands, x, y, -(ATOM_EDGE_W * Math.min(e, ATOM_EDGE_CAP) + (an ? 0 : spread) - ATOM_BORDER_W * border) + pull);
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
  // v2: a node waits for its cross-family parents (famDepth order could place
  // audio_transformer before audio_spectrogram, so it aimed at the wrong
  // stretch of the border and its bridge road crossed all of perception).
  for (let pass = 0; pass < derived.length; pass++) {
    let moved = false;
    for (let i = 0; i < derived.length; i++) {
      const m = derived[i];
      const late = g.parents.get(m)!.filter((p) => g.family.get(p) !== g.family.get(m))
        .map((p) => derived.indexOf(p)).filter((j) => j > i);
      if (!late.length) continue;
      derived.splice(i, 1);
      derived.splice(Math.max(...late), 0, m);
      moved = true;
      break;
    }
    if (!moved) break;
  }
  const cone = (SIBLING_CONE_DEG * Math.PI) / 180;

  // ── v3 trunk-and-branch ──────────────────────────────────────────────
  // A hub's same-family children line up along one or two TRUNKS leaving it
  // (not a radial fan): child k of a trunk sits TRUNK_OFF tiles to alternate
  // sides of the trunk line, staggered outward, so its road is a short branch
  // off a shared trunk road. Trunk bearings are chosen once per hub: open own
  // land ahead, continuing outward from the hub's own parent, and leaning
  // toward the borders its children must bridge.
  interface Plan { dirs: Pt[]; slot: Map<string, [number, number]>; first: number }
  const plans = new Map<string, Plan>();
  const order = new Map(derived.map((m, i) => [m, i]));
  const unit = (x: number, y: number): Pt => { const L = Math.hypot(x, y) || 1; return { x: x / L, y: y / L }; };
  /**
   * unit vector from the hub toward whatever pulls child `c`'s same-family
   * subtree: parents outside it (cross-family or secondary, once placed) and
   * the borders its cross-family children must bridge.
   */
  const borderDir = (r: number, f: string, hc: Pt): Pt | null => {
    const bf = borderField(r, famId.get(f)!);
    let bi = -1;
    let bd = Infinity;
    for (const i of regionTiles[r]) {
      if (bf[i] !== 0) continue;
      const x = i % cols;
      const d = Math.hypot(x + 0.5 - hc.x, (i - x) / cols + 0.5 - hc.y);
      if (d < bd) { bd = d; bi = i; }
    }
    if (bi < 0) return null;
    const x = bi % cols;
    return unit(x + 0.5 - hc.x, (bi - x) / cols + 0.5 - hc.y);
  };
  const pullOf = (c: string, r: number, hc: Pt, hub: string): Pt | null => {
    const fam = g.family.get(c)!;
    const sub = new Set<string>([c]);
    const st = [c];
    while (st.length) for (const ch of g.children.get(st.pop()!)!) if (g.family.get(ch) === fam && !sub.has(ch)) { sub.add(ch); st.push(ch); }
    let v = { x: 0, y: 0 };
    const add = (u: Pt | null, w = 1) => { if (u) v = { x: v.x + w * u.x, y: v.y + w * u.y }; };
    for (const d of sub) {
      for (const p of g.parents.get(d)!) {
        if (sub.has(p) || p === hub) continue;
        const pb = foot.get(p);
        if (pb) { const q = centerOf(pb); add(unit(q.x - hc.x, q.y - hc.y)); }
        else if (g.family.get(p) !== fam) add(borderDir(r, g.family.get(p)!, hc));
      }
      for (const ch of g.children.get(d)!) if (g.family.get(ch) !== fam) add(borderDir(r, g.family.get(ch)!, hc));
    }
    return v.x || v.y ? unit(v.x, v.y) : null;
  };
  const planFor = (hub: string, r: number): Plan => {
    const hit = plans.get(hub);
    if (hit) return hit;
    const hb = foot.get(hub)!;
    const hc = centerOf(hb);
    const kids = g.primaryChildren.get(hub)!.filter((c) => g.family.get(c) === g.family.get(hub) &&
      (TRUNK_CROSS_KIDS || !g.parents.get(c)!.some((p) => g.family.get(p) !== g.family.get(c))))
      .sort((a, b) => order.get(a)! - order.get(b)!);
    const nT = kids.length >= TRUNK_SPLIT ? 2 : 1;
    const first = g.atom.get(hub) ? TRUNK_FIRST_ATOM : TRUNK_FIRST;
    const perTrunk = Math.ceil(kids.length / nT);
    const pp = g.primary.get(hub);
    const out = pp && foot.has(pp) && g.family.get(pp) === g.family.get(hub)
      ? (() => { const q = centerOf(foot.get(pp)!); return unit(hc.x - q.x, hc.y - q.y); })() : null;
    const pulls = kids.map((c) => pullOf(c, r, hc, hub));
    // directions to keep clear: the hub's own bridges out, and the region's other atoms (their children need that land)
    const avoid: Pt[] = [];
    for (const ch of g.children.get(hub)!) if (g.family.get(ch) !== g.family.get(hub)) { const d = borderDir(r, g.family.get(ch)!, hc); if (d) avoid.push(d); }
    for (const o of g.membersOf.get(g.family.get(hub)!)!) {
      if (o === hub || !g.atom.get(o) || !foot.has(o)) continue;
      const q = centerOf(foot.get(o)!);
      if (Math.hypot(q.x - hc.x, q.y - hc.y) < 3 * GEN_STEP) avoid.push(unit(q.x - hc.x, q.y - hc.y));
    }
    const score = (ang: number) => {
      const d = { x: Math.cos(ang), y: Math.sin(ang) };
      const pe = { x: -d.y, y: d.x };
      const m = Math.max(Math.abs(d.x), Math.abs(d.y));
      const len = first + perTrunk * (TRUNK_HALF / m) + 2;
      let room = 0;
      for (let a = 3; a <= len; a += 1) {
        for (const l of [-TRUNK_OFF, 0, TRUNK_OFF]) {
          const x = Math.floor(hc.x + a * d.x + l * pe.x);
          const y = Math.floor(hc.y + a * d.y + l * pe.y);
          if (x < 0 || y < 0 || x >= cols || y >= rows) { room -= 2; continue; }
          const i = y * cols + x;
          if (regionOf[i] !== r || edge[i] < 2) room -= 2;
          else if (blocked[i]) room -= 1.5;
          else room += 1;
        }
      }
      let s = room / (3 * len);
      if (out) s += W_TRUNK_OUT * (d.x * out.x + d.y * out.y);
      for (const p of pulls) if (p) s += W_TRUNK_PULL * Math.max(0, d.x * p.x + d.y * p.y);
      for (const q of avoid) s -= W_TRUNK_AVOID * Math.max(0, d.x * q.x + d.y * q.y);
      return s;
    };
    const angs = Array.from({ length: 16 }, (_, k) => (k * Math.PI) / 8);
    const sc = angs.map(score);
    let b1 = 0;
    for (let k = 1; k < 16; k++) if (sc[k] > sc[b1] + 1e-9) b1 = k;
    const dirs = [{ x: Math.cos(angs[b1]), y: Math.sin(angs[b1]) }];
    if (nT === 2) {
      let b2 = -1;
      for (let k = 0; k < 16; k++) {
        const sep = Math.min(Math.abs(k - b1), 16 - Math.abs(k - b1));
        if (sep < TRUNK_MIN_SEP) continue;
        if (b2 < 0 || sc[k] > sc[b2] + 1e-9) b2 = k;
      }
      if (b2 >= 0) dirs.push({ x: Math.cos(angs[b2]), y: Math.sin(angs[b2]) });
    }
    // children with a pull ride the trunk that faces it; the rest balance the load
    const slot = new Map<string, [number, number]>();
    const load = dirs.map(() => 0);
    const cap = Math.ceil(kids.length / dirs.length);
    const pick = (c: string, p: Pt | null) => {
      let t = -1;
      for (let k = 0; k < dirs.length; k++) {
        if (load[k] >= cap) continue;
        const v = p ? dirs[k].x * p.x + dirs[k].y * p.y : -load[k];
        const bv = t < 0 ? -Infinity : p ? dirs[t].x * p.x + dirs[t].y * p.y : -load[t];
        if (v > bv + 1e-9) t = k;
      }
      if (t < 0) t = 0;
      slot.set(c, [t, load[t]++]);
    };
    kids.forEach((c, i) => { if (pulls[i]) pick(c, pulls[i]); });
    kids.forEach((c, i) => { if (!pulls[i]) pick(c, null); });
    const plan = { dirs, slot, first };
    plans.set(hub, plan);
    return plan;
  };

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
    // v3: trunk slot → desired centre (same-family primary only)
    let target: Pt | null = null;
    // nodes with a cross-family parent are border towns: they wait at their bridge, off the trunk
    const borderTown = !TRUNK_CROSS_KIDS && g.parents.get(m)!.some((p) => g.family.get(p) !== fam);
    if (pc && prim && g.family.get(prim) === fam && !borderTown) {
      const plan = planFor(prim, r);
      const sl = plan.slot.get(m);
      if (sl) {
        const d = plan.dirs[sl[0]];
        const mm = Math.max(Math.abs(d.x), Math.abs(d.y));
        const along = plan.first + sl[1] * (TRUNK_HALF / mm);
        const side = sl[1] % 2 === 0 ? 1 : -1;
        target = { x: pc.x + along * d.x - side * TRUNK_OFF * d.y, y: pc.y + along * d.y + side * TRUNK_OFF * d.x };
      }
    }
    const nseed = fnv1a(m);
    const cands = newCands(DERIVED_SIZE);
    for (const i of regionTiles[r]) {
      const x = i % cols;
      const y = (i - x) / cols;
      if (blocked[i] || fitEdge(x, y, DERIVED_SIZE, DERIVED_SIZE, r, DERIVED_EDGE_MIN, blocked) < 0) continue;
      const cx = x + DERIVED_SIZE / 2;
      const cy = y + DERIVED_SIZE / 2;
      let cost = 0;
      if (target) {
        cost += (W_TRUNK * ((cx - target.x) ** 2 + (cy - target.y) ** 2)) / GEN_STEP;
      } else if (pc) {
        const d = Math.hypot(cx - pc.x, cy - pc.y);
        cost += (d - GEN_STEP * k) ** 2 / GEN_STEP;
        const bearing = sibBearings.length ? Math.atan2(cy - pc.y, cx - pc.x) : 0;
        if (target) sibBearings.length = 0; // v3: trunks replace the sibling cone
        for (const b of sibBearings) {
          let diff = Math.abs(bearing - b);
          if (diff > Math.PI) diff = 2 * Math.PI - diff;
          if (diff < cone) { cost += W_SIBLING; break; }
        }
      }
      for (const s of secs) cost += (W_SECONDARY * Math.hypot(cx - s.x, cy - s.y)) / GEN_STEP;
      if (crossFields.length || descFields.length) {
        const ti = Math.min(n - 1, Math.max(0, Math.floor(cy) * cols + Math.floor(cx)));
        for (const f of crossFields) cost += (W_CROSS_BORDER * f[ti]) / GEN_STEP;
        for (const f of descFields) cost += (W_DESC_BORDER * f[ti]) / GEN_STEP;
      }
      cost += W_NOISE * hash2(x, y, nseed);
      pushCand(cands, x, y, cost);
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
    // v3: the landmark goes where the reference draws the region's label (edge distance still rewarded)
    const an = preset.setPieceAnchors[reg.family] ? toTile(preset.setPieceAnchors[reg.family]) : null;
    for (const [w, h] of sizes) {
      let best: Box | null = null;
      let bestE = -Infinity;
      for (const i of regionTiles[reg.id]) {
        const x = i % cols;
        const y = (i - x) / cols;
        const e0 = fitEdge(x, y, w, h, reg.id, 1, spBlock);
        if (e0 < 0) continue;
        const e = an ? Math.min(e0, 3) - W_SETPIECE_ANCHOR * Math.hypot(x + w / 2 - an.x, y + h / 2 - an.y) : e0;
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
