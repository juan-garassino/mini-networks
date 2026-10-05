// The Night Map's words, placed in screen px every time the camera settles:
// the family sign plaques, the star names, the selected star's pipeline arcs
// (partners on screen) and edge chevrons (partners off screen), and a leader
// from any sign that had to sit away from its own stars.
//
// One greedy pass over a shared obstacle list (corner plates, star rings, arc
// pixels, every word already placed), most important first, so no word ever
// sits on a star, a ring, an arc, a corner plate or another word. Pure: the
// skin hands in the camera, the stars and the measured corner rects.
import type { CamBox } from "@/components/lab/shared/camera";
import { displayName } from "@/components/lab/shared/card-model";
import type { Bake } from "./bake";
import type { FStar } from "./layers";
import { arcPixels } from "./paint";
import { plaqueWidth } from "./plaque";
import { chevronSize, type ChevronDir } from "./chrome";
import { starRadius } from "./sprites";
import { GRID, LINE, SPACE, TYPE } from "./tokens";

export type Box = { x: number; y: number; w: number; h: number };
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const union = (bs: Box[]): Box => {
  const x = Math.min(...bs.map((b) => b.x)), y = Math.min(...bs.map((b) => b.y));
  return { x, y, w: Math.max(...bs.map((b) => b.x + b.w)) - x, h: Math.max(...bs.map((b) => b.y + b.h)) - y };
};
export const pad = (b: Box, p: number, top = p): Box => ({ x: b.x - p, y: b.y - top, w: b.w + 2 * p, h: b.h + p + top });
const hit = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const area = (a: Box, b: Box) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

export interface WordsInput {
  stars: FStar[];
  byName: Map<string, FStar>;
  /** families in sign order, with their star hulls (frame px) and model counts */
  families: string[];
  hulls: Partial<Record<string, Box>>;
  famCount: Record<string, number>;
  focusFam: string | null;
  selected: string | null;
  hovered: string | null;
  lineage: Set<string>;
  partners: { name: string; via: string[] }[];
  /** drawn lineage lines with one end off screen: the far star and the star on screen */
  ends: { name: string; from: string }[];
  /** frame px → screen px, snapped to the art grid */
  scr: (p: { x: number; y: number }) => { x: number; y: number };
  cam: CamBox;
  /** screen px per frame px */
  S: number;
  bake: Bake | null;
  vw: number; vh: number;
  /** the screen left visible by the drawer / sheet */
  visW: number; visH: number;
  mobile: boolean;
  /** a region / node view, or zoomed in by hand: other families' signs keep to their anchors */
  regionish: boolean;
  zoomedIn: boolean;
  /** the corner plates' measured rects (screen px) */
  corners: Box[];
}

export interface Placed {
  plaques: { f: string; x: number; y: number; w: number; h: number }[];
  labels: { s: FStar; x: number; y: number; fs: number; anchor: "middle" | "start" | "end" }[];
  arcs: { a: FStar; b: FStar }[];
  /** an off-screen end: a pipeline partner ("pipe") or the far end of a drawn lineage line ("line") */
  chevrons: { name: string; x: number; y: number; dir: ChevronDir; kind: "pipe" | "line" }[];
  /** a sign set away from its stars → its nearest own star (screen px) */
  leaders: { f: string; x0: number; y0: number; x1: number; y1: number }[];
}

export function placeWords(I: WordsInput): Placed {
  const { stars, byName, scr, S, cam, bake, visW, visH, mobile, regionish, selected, hovered, focusFam } = I;
  const AP = GRID.ap;
  const corners = I.corners.map((c) => pad(c, SPACE.cornerHalo));
  const obstacles: (Box & { star?: string })[] = [...corners];
  const partnerSet = new Set(I.partners.map((p) => p.name));
  for (const s of stars) {
    // the selection / hover ring sits 3 art px out: keep words clear of it too
    const p = scr(s), r = (starRadius(s.state, s.atom) + (s.name === selected ? LINE.reticle.ring + LINE.reticle.tick + 2 : s.name === hovered ? 5 : 2)) * AP;
    obstacles.push({ x: p.x - r, y: p.y - r, w: 2 * r, h: 2 * r, star: s.name });
  }

  // ——— partners: on screen → an arc; off screen → a named chevron on the edge, toward it
  const arcs: Placed["arcs"] = [];
  const chevrons: Placed["chevrons"] = [];
  /** a named plate hugging the screen edge (just inside it), on the ray from `a` toward `b` */
  const chevronToward = (name: string, a: { x: number; y: number }, b: { x: number; y: number }, kind: "pipe" | "line") => {
    const { w: cw, h: ch } = chevronSize(name, mobile);
    const inner = { x0: 8 + cw / 2, y0: (mobile ? 140 : 70) + ch / 2, x1: visW - 8 - cw / 2, y1: visH - (mobile ? 110 : 80) - ch / 2 };
    const dx = b.x - a.x, dy = b.y - a.y;
    let t = 1;
    if (dx > 0) t = Math.min(t, (inner.x1 - a.x) / dx); else if (dx < 0) t = Math.min(t, (inner.x0 - a.x) / dx);
    if (dy > 0) t = Math.min(t, (inner.y1 - a.y) / dy); else if (dy < 0) t = Math.min(t, (inner.y0 - a.y) / dy);
    t = Math.max(0, t);
    const dir: ChevronDir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "r" : "l") : dy > 0 ? "d" : "u";
    let c = { x: clamp(a.x + dx * t, inner.x0, inner.x1), y: clamp(a.y + dy * t, inner.y0, inner.y1) };
    // a chevron never stacks on another or slips under a corner plate: it takes the nearest free
    // spot along its own edge (across a top / bottom edge, down a side), either way
    const cbox = (q: { x: number; y: number }) => ({ x: q.x - cw / 2, y: q.y - ch / 2, w: cw, h: ch });
    const blocked = (q: { x: number; y: number }) => chevrons.some((o) => Math.abs(o.x - q.x) < (cw + chevronSize(o.name, mobile).w) / 2 + 6 && Math.abs(o.y - q.y) < ch + 4) || corners.some((o) => hit(cbox(q), o));
    const along = dir === "u" || dir === "d" ? { x: 1, y: 0 } : { x: 0, y: 1 };
    const step = (k: number) => ({ x: clamp(c.x + along.x * 24 * k, inner.x0, inner.x1), y: clamp(c.y + along.y * (ch + 6) * k, inner.y0, inner.y1) });
    for (let k = 1; k <= 24 && blocked(c); k++) {
      // the side toward the screen's middle first, then the other
      const toward = (dir === "u" || dir === "d" ? c.x < visW / 2 : c.y < visH / 2) ? 1 : -1;
      const q = [step(toward * k), step(-toward * k)].find((p) => !blocked(p));
      if (q) c = q;
    }
    chevrons.push({ name, ...c, dir, kind });
    obstacles.push({ x: c.x - cw / 2, y: c.y - ch / 2, w: cw, h: ch });
  };
  const sel = selected ? byName.get(selected) : undefined;
  if (sel) {
    const a = scr(sel);
    for (const p of I.partners) {
      const st = byName.get(p.name)!;
      const b = scr(st);
      const M = 18;
      if (b.x > M && b.y > M && b.x < visW - M && b.y < visH - M) {
        arcs.push({ a: sel, b: st });
        // no sign or name sits on an arc: its pixels are obstacles too
        const art = (q: { x: number; y: number }): [number, number] => [Math.round((q.x - AP / 2) / AP), Math.round((q.y - AP / 2) / AP)];
        arcPixels(art(a), art(b), starRadius(sel.state, sel.atom) + 3, starRadius(st.state, st.atom) + 3).forEach(([x, y], j) => { if (j % 3 === 0) obstacles.push({ x: x * AP - 2, y: y * AP - 2, w: AP + 4, h: AP + 4 }); });
        continue;
      }
      chevronToward(p.name, a, b, "pipe");
    }
  }
  // a drawn lineage line that leaves the screen ends in the same named plate (its far star)
  for (const e of I.ends) {
    const from = byName.get(e.from), far = byName.get(e.name);
    if (!from || !far || chevrons.some((c) => c.name === e.name)) continue;
    chevronToward(e.name, scr(from), scr(far), "line");
  }

  // ——— the night signs: one per nebula, anchored on its top-left (the focused family's first)
  const plaqueH = mobile ? SPACE.plaqueH.phone : regionish ? SPACE.plaqueH.zoom : SPACE.plaqueH.overview;
  const plaques: Placed["plaques"] = [];
  const leaders: Placed["leaders"] = [];
  const snap = (v: number) => Math.round(v / AP) * AP;
  const E = SPACE.edge;
  const order = I.families.filter((f) => I.hulls[f]).sort((p, r) => Number(r === focusFam) - Number(p === focusFam) || (I.famCount[r] ?? 0) - (I.famCount[p] ?? 0));
  for (const f of order) {
    const h = I.hulls[f]!;
    const tl = scr({ x: h.x, y: h.y }), br = scr({ x: h.x + h.w, y: h.y + h.h });
    const pw = plaqueWidth(f, I.famCount[f] ?? 0, { compact: mobile, latin: regionish && !mobile });
    const g = Math.max(mobile ? 8 : 12, 26 * S);
    const above = tl.y - g - plaqueH, below = br.y + g + 8, span = Math.max(0, br.x - tl.x + 2 * g - pw);
    const raw = [
      { x: tl.x - g, y: above },
      { x: tl.x - g + span / 3, y: above },
      { x: tl.x - g + (2 * span) / 3, y: above },
      { x: br.x + g - pw, y: above },
      { x: tl.x - g, y: below },
      { x: br.x + g - pw, y: below },
      { x: tl.x - g - pw - 4, y: tl.y - plaqueH / 2 },
      { x: br.x + g + 4, y: tl.y - plaqueH / 2 },
    ];
    const cands = raw.map((q) => ({ x: snap(q.x), y: snap(q.y), inside: q.x >= E && q.y >= E && q.x + pw <= visW - E && q.y + plaqueH <= visH - E }));
    const box = (q: { x: number; y: number }) => ({ x: q.x, y: q.y, w: pw, h: plaqueH });
    // zoomed in, another family's sign keeps to its anchor side (above the nebula) or stays away
    const allowed = regionish && f !== focusFam ? cands.slice(0, 4) : cands;
    // a sign belongs to the nebula whose stars are nearest it
    const own = stars.filter((s) => s.family === f).map(scr), rest = stars.filter((s) => s.family !== f).map(scr);
    const gapTo = (p: { x: number; y: number }, q: { x: number; y: number }) => Math.hypot(Math.max(q.x - p.x, 0, p.x - (q.x + pw)), Math.max(q.y - p.y, 0, p.y - (q.y + plaqueH)));
    const near = (pts: { x: number; y: number }[], q: { x: number; y: number }) => Math.min(...pts.map((p) => gapTo(p, q)));
    // …and never sits on another family's cloud (the share of its area painted
    // in a neighbour's nebula, read off the bake): a sign reads as part of the colour under it
    const fi = bake ? bake.families.indexOf(f) : -1;
    const foreign = (q: { x: number; y: number }) => {
      if (!bake) return 0;
      let n = 0, o = 0;
      for (let y = q.y + 2; y < q.y + plaqueH; y += 6) for (let x = q.x + 2; x < q.x + pw; x += 6) {
        n++;
        const bx = Math.floor((cam.x + x / S - bake.x) / bake.cell), by = Math.floor((cam.y + y / S - bake.y) / bake.cell);
        if (bx < 0 || by < 0 || bx >= bake.w || by >= bake.h) continue;
        const k = by * bake.w + bx;
        // any step of a neighbour's cloud counts, its dithered rim included
        if (bake.owner[k] >= 0 && bake.owner[k] !== fi && bake.level[k] >= 1) o++;
      }
      return n ? o / n : 0;
    };
    const owned = (q: { x: number; y: number }) => !rest.length || near(rest, q) >= near(own, q) + 6;
    const clean = (q: { x: number; y: number }) => regionish || foreign(q) <= 0.12;
    let pick: { x: number; y: number } | undefined = allowed.find((q) => q.inside && !obstacles.some((o) => hit(box(q), o)) && (regionish || (owned(q) && clean(q))));
    if (!pick && !(regionish && f !== focusFam)) {
      // the anchor is taken (a packed phone sky): the free spot nearest the
      // family's stars that sits on the least of a neighbour's cloud. A spot
      // whose closest star is a neighbour's costs more, but is allowed: the
      // leader drawn below ties the sign back to its own stars
      const a0 = cands[0];
      const R = mobile ? 220 : 180;
      // two rings: first a free spot within signReach of the family's own
      // stars (on a packed phone sky a sign beside its stars, even over a
      // neighbour's rim, reads as theirs; one across the sky never does),
      // then the wider search, where a neighbour's cloud costs the most
      const search = (reach: number, foreignCost: number) => {
        let best: { q: { x: number; y: number }; cost: number } | null = null;
        for (let y = tl.y - plaqueH - R; y <= br.y + R; y += 8) {
          for (let x = tl.x - pw - R; x <= br.x + R; x += 8) {
            const q = { x: snap(x), y: snap(y) };
            if (q.x < E || q.y < E || q.x + pw > visW - E || q.y + plaqueH > visH - E) continue;
            const d = near(own, q);
            if (d > reach || obstacles.some((o) => hit(box(q), o))) continue;
            const cost = d * 2 + Math.hypot(q.x - a0.x, q.y - a0.y) * 0.5 + foreign(q) * foreignCost + (owned(q) ? 0 : 80);
            if (!best || cost < best.cost) best = { q, cost };
          }
        }
        return best?.q;
      };
      pick = (mobile ? search(SPACE.signReach, 160) : undefined) ?? search(Infinity, 520);
    }
    if (!pick) {
      // zoomed in, another family's sign with no clean spot is left out; the
      // whole sky (or the focused family) takes the least crowded spot
      if (regionish && f !== focusFam) continue;
      const clampd = cands.map((q) => ({ x: snap(clamp(q.x, 6, visW - pw - 6)), y: snap(clamp(q.y, 6, visH - plaqueH - 6)) }));
      pick = clampd.map((q) => ({ q, cost: obstacles.reduce((s2, o) => s2 + area(box(q), o), 0) })).sort((p, r) => p.cost - r.cost)[0].q;
    }
    obstacles.push(pad(box(pick), SPACE.plaqueApart));
    plaques.push({ f, ...pick, w: pw, h: plaqueH });
    // a sign that had to sit away from its stars gets a leader to the nearest one
    const nearest = own.reduce((b, p) => (gapTo(p, pick!) < gapTo(b, pick!) ? p : b), own[0]);
    if (nearest && gapTo(nearest, pick) > SPACE.leaderAt) {
      const x0 = clamp(nearest.x, pick.x, pick.x + pw), y0 = clamp(nearest.y, pick.y, pick.y + plaqueH);
      leaders.push({ f, x0, y0, x1: nearest.x, y1: nearest.y });
    }
  }

  // ——— star names: atoms always; derived on hover, selection, lineage, partners, focus or zoom
  const show = (s: FStar) => s.atom || s.name === selected || s.name === hovered || I.lineage.has(s.name) || partnerSet.has(s.name) || (focusFam ? s.family === focusFam : I.zoomedIn);
  const rank = (s: FStar) => (s.name === selected ? 0 : s.name === hovered ? 1 : partnerSet.has(s.name) ? 2 : s.atom ? 3 : I.lineage.has(s.name) ? 4 : 5);
  const k = mobile ? 1 : 0;
  const labels: Placed["labels"] = [];
  for (const s of stars.filter(show).sort((p, r) => rank(p) - rank(r) || p.name.localeCompare(r.name))) {
    const p = scr(s);
    if (p.x < -40 || p.y < -20 || p.x > I.vw + 40 || p.y > I.vh + 20) continue;
    const fs = s.atom ? TYPE.starAtom[k] : TYPE.starDerived[k];
    const w = displayName(s.name).length * fs * TYPE.em + 4, hh = fs + 4;
    const r = (starRadius(s.state, s.atom) + (s.name === selected || s.name === hovered ? 4 : 1)) * AP + 3;
    const cands: { x: number; y: number; anchor: "middle" | "start" | "end"; box: Box }[] = [
      { x: p.x, y: p.y + r + fs * 0.85, anchor: "middle", box: { x: p.x - w / 2, y: p.y + r, w, h: hh } },
      { x: p.x, y: p.y - r - 3, anchor: "middle", box: { x: p.x - w / 2, y: p.y - r - hh, w, h: hh } },
      { x: p.x + r + 2, y: p.y + fs * 0.35, anchor: "start", box: { x: p.x + r, y: p.y - hh / 2, w, h: hh } },
      { x: p.x - r - 2, y: p.y + fs * 0.35, anchor: "end", box: { x: p.x - r - w, y: p.y - hh / 2, w, h: hh } },
    ];
    // a name is never cut by the screen edge (or the drawer)
    const free = cands.find((c) => c.box.x >= 2 && c.box.x + c.box.w <= visW - 2 && !obstacles.some((o) => o.star !== s.name && hit(c.box, o)));
    const c = free ?? (rank(s) <= 2 ? cands[0] : null);
    if (!c) continue;
    obstacles.push(c.box);
    labels.push({ s, x: c.x, y: c.y, fs, anchor: c.anchor });
  }
  return { plaques, labels, arcs, chevrons, leaders };
}
