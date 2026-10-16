// Region signboards: anchored on the region's set-piece plaza (world data),
// nudged between a few fixed candidate spots so a sign never covers a name
// label, a node or another sign. Pure screen-space geometry.
export interface Rect { x: number; y: number; w: number; h: number; weight?: number }

const overlap = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

export interface SignIn { id: number; anchor: Rect; w: number; h: number }

/** Returns the top-left of each sign. Candidates around the anchor, first clear one wins. */
export function placeSigns(signs: SignIn[], obstacles: Rect[], bounds: Rect): Map<number, { x: number; y: number }> {
  const placed: Rect[] = [];
  const out = new Map<number, { x: number; y: number }>();
  for (const s of signs) {
    const A = s.anchor;
    const cx = A.x + A.w / 2 - s.w / 2;
    const ys = [
      A.y + A.h - s.h / 2,       // straddling the plaza's front edge
      A.y + A.h / 2 - s.h / 2,   // centred on the plaza
      A.y + A.h + 2,             // just below
      A.y - s.h / 2,             // straddling the back edge
      A.y - s.h - 2,             // just above
    ];
    const cands: Rect[] = [];
    for (const dx of [0, -s.w / 3, s.w / 3]) for (const y of ys) cands.push({ x: cx + dx, y, w: s.w, h: s.h });
    // beside the plaza, then a widening ring around it
    const midY = A.y + A.h / 2 - s.h / 2;
    cands.push({ x: A.x - s.w - 2, y: midY, w: s.w, h: s.h }, { x: A.x + A.w + 2, y: midY, w: s.w, h: s.h });
    for (const r of [24, 48, 72, 96]) for (let a = 0; a < 16; a++) {
      const t = (a / 16) * Math.PI * 2;
      cands.push({ x: cx + Math.cos(t) * r * 1.6, y: A.y + A.h + 2 + Math.sin(t) * r, w: s.w, h: s.h });
    }
    let best = cands[0], bestCost = Infinity;
    for (const c of cands) {
      let cost = 0;
      for (const o of obstacles) cost += overlap(c, o) * (o.weight ?? 1);
      for (const p of placed) cost += 4 * overlap(c, p);
      const outX = Math.max(0, bounds.x - c.x) + Math.max(0, c.x + c.w - bounds.x - bounds.w);
      const outY = Math.max(0, bounds.y - c.y) + Math.max(0, c.y + c.h - bounds.y - bounds.h);
      cost += (outX * s.h + outY * s.w) * 40; // a sign cut by the screen edge is unreadable
      // prefer staying near the plaza: a sign far from its land names nothing
      cost += 8 * Math.hypot(c.x + c.w / 2 - (A.x + A.w / 2), c.y + c.h / 2 - (A.y + A.h));
      if (cost < bestCost) { bestCost = cost; best = c; }
    }
    placed.push(best);
    out.set(s.id, { x: best.x, y: best.y });
  }
  return out;
}

export interface ChipIn { id: string; cx: number; top: number; w: number; h: number }

/** Greedy chips (mobile atom names): first come keeps its spot, later overlapping chips are culled. */
export function cullChips(chips: ChipIn[], obstacles: Rect[], bounds: Rect): (ChipIn & { x: number })[] {
  const kept: (ChipIn & { x: number })[] = [];
  const taken: Rect[] = [...obstacles];
  for (const c of chips) {
    const r = { x: c.cx - c.w / 2, y: c.top, w: c.w, h: c.h };
    if (r.x < bounds.x || r.y < bounds.y || r.x + r.w > bounds.x + bounds.w || r.y + r.h > bounds.y + bounds.h) continue;
    if (taken.some((o) => overlap(r, o) > 0)) continue;
    taken.push({ ...r, x: r.x - 2, w: r.w + 4 });
    kept.push({ ...c, x: r.x });
  }
  return kept;
}
