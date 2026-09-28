// Tile-grid primitives: index helpers, a typed binary min-heap, BFS distance
// transforms and the octilinear A* over (tile, direction) used by roads.
import {
  COST_BRIDGE_REUSE, COST_COAST, COST_DIAG, COST_NEAR_FOREIGN_FOOT, COST_ORTHO, COST_RIVER, COST_TURN,
  HEURISTIC_W, MAX_BRIDGE_SPAN, ROAD_REUSE,
} from "./constants.ts";

/** 8 directions, clockwise from east (y grows downward). Even = orthogonal. */
export const DX = [1, 1, 0, -1, -1, -1, 0, 1];
export const DY = [0, 1, 1, 1, 0, -1, -1, -1];
export const NO_DIR = 8;
export const FAR = 32767;

export const isDiag = (d: number) => (d & 1) === 1;
export const turnSteps = (a: number, b: number) => {
  if (a === NO_DIR || b === NO_DIR) return 0;
  const t = Math.abs(a - b);
  return Math.min(t, 8 - t);
};

/** Binary min-heap keyed on (pri, tie) carrying an int payload (typed arrays, grows on demand). */
export class MinHeap {
  pri = new Float64Array(256);
  tie = new Float64Array(256);
  val = new Int32Array(256);
  size = 0;
  /** priority of the last popped entry */
  lastPri = 0;
  private grow() {
    const n = this.pri.length * 2;
    const p = new Float64Array(n); p.set(this.pri); this.pri = p;
    const t = new Float64Array(n); t.set(this.tie); this.tie = t;
    const v = new Int32Array(n); v.set(this.val); this.val = v;
  }
  push(pri: number, tie: number, val: number) {
    if (this.size === this.pri.length) this.grow();
    const P = this.pri, Tt = this.tie, V = this.val;
    let i = this.size++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (P[p] < pri || (P[p] === pri && Tt[p] <= tie)) break;
      P[i] = P[p]; Tt[i] = Tt[p]; V[i] = V[p];
      i = p;
    }
    P[i] = pri; Tt[i] = tie; V[i] = val;
  }
  pop(): number {
    const P = this.pri, Tt = this.tie, V = this.val;
    const top = V[0];
    this.lastPri = P[0];
    const n = --this.size;
    if (n > 0) {
      const pri = P[n], tie = Tt[n], val = V[n];
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        if (l >= n) break;
        const r = l + 1;
        const m = r < n && (P[r] < P[l] || (P[r] === P[l] && Tt[r] < Tt[l])) ? r : l;
        if (pri < P[m] || (pri === P[m] && tie <= Tt[m])) break;
        P[i] = P[m]; Tt[i] = Tt[m]; V[i] = V[m];
        i = m;
      }
      P[i] = pri; Tt[i] = tie; V[i] = val;
    }
    return top;
  }
}

/**
 * Multi-source BFS distance (8-neighbour ⇒ Chebyshev steps, 4-neighbour ⇒
 * Manhattan). Tiles with `passable(i) === false` are never entered (sources
 * always count). Unreached tiles hold FAR.
 */
export function bfs(
  cols: number, rows: number, sources: Iterable<number>,
  opts: { diag?: boolean; passable?: (i: number) => boolean } = {},
): Int16Array {
  const diag = opts.diag ?? true;
  const dist = new Int16Array(cols * rows).fill(FAR);
  const q = new Int32Array(cols * rows);
  let head = 0;
  let tail = 0;
  for (const s of sources) {
    if (dist[s] !== 0) {
      dist[s] = 0;
      q[tail++] = s;
    }
  }
  while (head < tail) {
    const i = q[head++];
    const x = i % cols;
    const y = (i - x) / cols;
    for (let d = 0; d < 8; d++) {
      if (!diag && isDiag(d)) continue;
      const nx = x + DX[d];
      const ny = y + DY[d];
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const j = ny * cols + nx;
      if (dist[j] !== FAR) continue;
      if (opts.passable && !opts.passable(j)) continue;
      dist[j] = dist[i] + 1;
      q[tail++] = j;
    }
  }
  return dist;
}

/**
 * Edge distance: for each `inside` tile, Chebyshev steps to the nearest tile
 * that is not inside (or off-grid). A tile touching the outside has 1;
 * outside tiles have 0.
 */
export function edgeDistance(cols: number, rows: number, inside: (i: number) => boolean): Int16Array {
  const src: number[] = [];
  const n = cols * rows;
  for (let i = 0; i < n; i++) if (!inside(i)) src.push(i);
  const dist = bfs(cols, rows, src);
  // off-grid counts as outside: clamp by distance to the frame
  for (let i = 0; i < n; i++) {
    const x = i % cols;
    const y = (i - x) / cols;
    const frame = Math.min(x + 1, y + 1, cols - x, rows - y);
    if (dist[i] > frame) dist[i] = frame;
  }
  return dist;
}

/** Everything the road A* needs; typed arrays are shared across searches. */
export interface RoadSearch {
  cols: number;
  rows: number;
  /** 1 = plain walkable tile (LAND/COAST/ROAD, not reserved). */
  walk: Uint8Array;
  /** 1 = river tile, 2 = river tile already bridged. */
  river: Uint8Array;
  road: Uint8Array;
  regionOf: Int8Array;
  /** 1 = coast tile (entering costs COST_COAST). */
  coast: Uint8Array;
  /** footprint-adjacency owner per tile: node index, -1 none, -2 several. */
  owner: Int16Array;
  /** node indices of the road's endpoints (their adjacency is free). */
  fromId: number;
  toId: number;
  /** region ids allowed in this search window. */
  allowRegion: Uint8Array;
  starts: number[];
  goal: Uint8Array;
  /** tile-coord box the heuristic aims at (goal footprint grown by 1). */
  hx0: number; hy0: number; hx1: number; hy1: number;
}

// scratch buffers reused between searches (grown on demand)
let G = new Float64Array(0);
let STAMP = new Int32Array(0);
let PARENT = new Int32Array(0);
let stampNow = 0;

/** Returns tile indices from a start tile to a goal tile, or null. */
export function astarRoad(s: RoadSearch): number[] | null {
  const { cols, rows, walk, river, road, regionOf, coast, owner, fromId, toId, allowRegion, goal } = s;
  const extra = (i: number) => {
    const o = owner[i];
    return (coast[i] ? COST_COAST : 0) + (o === -2 || (o >= 0 && o !== fromId && o !== toId) ? COST_NEAR_FOREIGN_FOOT : 0);
  };
  const nStates = cols * rows * 9;
  if (G.length < nStates) {
    G = new Float64Array(nStates);
    STAMP = new Int32Array(nStates);
    PARENT = new Int32Array(nStates);
    stampNow = 0;
  }
  stampNow++;
  const ok = (i: number) => walk[i] === 1 && allowRegion[regionOf[i]] === 1;
  const h = (x: number, y: number) => {
    const dx = Math.max(s.hx0 - x, 0, x - s.hx1);
    const dy = Math.max(s.hy0 - y, 0, y - s.hy1);
    const mn = Math.min(dx, dy);
    return HEURISTIC_W * (Math.max(dx, dy) - mn + COST_DIAG * mn);
  };
  const heap = new MinHeap();
  const relax = (state: number, g: number, par: number, x: number, y: number) => {
    if (STAMP[state] === stampNow && G[state] <= g) return;
    STAMP[state] = stampNow;
    G[state] = g;
    PARENT[state] = par;
    heap.push(g + h(x, y), state, state);
  };
  for (const t of s.starts) {
    if (!ok(t)) continue;
    const x = t % cols;
    relax(t * 9 + NO_DIR, extra(t), -1, x, (t - x) / cols);
  }
  while (heap.size) {
    const st = heap.pop();
    const g = G[st];
    const t = (st / 9) | 0;
    const d = st - t * 9;
    const x = t % cols;
    const y = (t - x) / cols;
    // stale entry check: a better g was recorded after this push
    if (heap.lastPri > g + h(x, y) + 1e-9) continue;
    if (goal[t]) {
      const out: number[] = [];
      let cur = st;
      while (cur !== -1) {
        const ct = (cur / 9) | 0;
        const par = PARENT[cur];
        out.push(ct);
        if (par !== -1) {
          // fill tiles skipped by a straight river macro-move
          const pt = (par / 9) | 0;
          const dir = cur - ct * 9;
          let k = ct - (DY[dir] * cols + DX[dir]);
          while (k !== pt) {
            out.push(k);
            k -= DY[dir] * cols + DX[dir];
          }
        }
        cur = par;
      }
      return out.reverse();
    }
    for (let nd = 0; nd < 8; nd++) {
      const nx = x + DX[nd];
      const ny = y + DY[nd];
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const u = ny * cols + nx;
      const turn = turnSteps(d, nd) * COST_TURN;
      if (ok(u)) {
        const diag = isDiag(nd);
        if (diag && (!ok(y * cols + nx) || !ok(ny * cols + x))) continue; // no corner cutting
        const base = diag ? COST_DIAG : COST_ORTHO;
        const g2 = g + base * (road[u] ? ROAD_REUSE : 1) + turn + extra(u);
        relax(u * 9 + nd, g2, st, nx, ny);
      } else if (river[u] && !isDiag(nd)) {
        // straight-through river crossing onto another region's land
        let cost = 0;
        let k = 0;
        let cx = nx;
        let cy = ny;
        while (k < MAX_BRIDGE_SPAN && cx >= 0 && cy >= 0 && cx < cols && cy < rows && river[cy * cols + cx]) {
          cost += COST_ORTHO + (river[cy * cols + cx] === 2 ? COST_BRIDGE_REUSE : COST_RIVER);
          k++;
          cx += DX[nd];
          cy += DY[nd];
        }
        if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) continue;
        const land = cy * cols + cx;
        if (!ok(land) || regionOf[land] === regionOf[t]) continue;
        if (!allowRegion[regionOf[u]]) continue;
        relax(land * 9 + nd, g + cost + COST_ORTHO + turn + extra(land), st, cx, cy);
      }
    }
  }
  return null;
}
