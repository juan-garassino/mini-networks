// Region signboards: anchored on the region's set-piece plaza (world data),
// nudged between a few fixed candidate spots so a sign never covers a name
// label, a node or another sign. Pure screen-space geometry.
export interface Rect { x: number; y: number; w: number; h: number }

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
    for (const dy of [16, -16, 32, -32, 48, -48]) cands.push({ x: cx, y: A.y + A.h / 2 - s.h / 2 + dy, w: s.w, h: s.h });
    let best = cands[0], bestCost = Infinity;
    for (const c of cands) {
      let cost = 0;
      for (const o of obstacles) cost += overlap(c, o);
      for (const p of placed) cost += 4 * overlap(c, p);
      const out = Math.max(0, bounds.x - c.x) + Math.max(0, c.x + c.w - bounds.x - bounds.w);
      cost += out * s.h * 2;
      if (cost < bestCost) { bestCost = cost; best = c; }
      if (cost === 0) break;
    }
    placed.push(best);
    out.set(s.id, { x: best.x, y: best.y });
  }
  return out;
}
