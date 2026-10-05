"use client";

// Phones: a land whose sign lies off the screen keeps a small plate on the
// edge nearest it, at its height (or across, on the top / bottom edge),
// pointing at it with a stepped chevron: its name and its count badge, as the
// land sign carries them. Pressing it opens that land. Stacked plates on one
// edge keep PHONE.edgeGap between them and stay between the top bar and the
// compass (top / bottom: the band they leave free).
import type { Family } from "../anchors";
import { FAMILY_TITLE, PHONE, TYPE, type Material } from "../material";
import { plateStyle } from "./plate";

export type EdgeSide = "l" | "r" | "u" | "d";
const EDGE_M = 6;   // from the screen's edge
export interface EdgeSign { f: Family; side: EdgeSide; at: number; count: number }

/** a stepped pixel chevron (5-unit grid) pointing to `side` */
function Chevron({ m, side }: { m: Material; side: EdgeSide }) {
  const rot = { l: 180, r: 0, u: -90, d: 90 }[side];
  return (
    <svg aria-hidden width={8} height={10} viewBox="0 0 4 5" shapeRendering="crispEdges" style={{ display: "block", transform: `rotate(${rot}deg)`, flex: "none" }}>
      <g fill={m.border}><rect x="0" y="0" width="1" height="5" /><rect x="1" y="1" width="1" height="3" /><rect x="2" y="2" width="1" height="1" /></g>
    </svg>
  );
}

/** Where each edge sign goes (CSS px, `x` from the left; `w` estimated from
 * the name): pure, so the skin can keep the map's labels off the chips too. */
export function placeEdgeSigns(signs: EdgeSign[], titles: Record<string, string>, w: number, h: number, top: number, bottom: number) {
  const H = PHONE.control, gap = PHONE.edgeGap, M = EDGE_M;
  const lo = top, hi = h - bottom - H;
  const placed: { s: EdgeSign; x: number; y: number; w: number; h: number }[] = [];
  // a plate's width, estimated from the name (+ chevron, badge, padding)
  const est = (s: EdgeSign) => Math.round(titles[s.f].length * TYPE.asideSmall * 0.66) + 48;
  const clash = (x: number, y: number, s: EdgeSign) => placed.some((p) =>
    x < p.x + p.w + gap && p.x < x + est(s) + gap && y < p.y + H + gap && p.y < y + H + gap);
  // per edge, in order along it, each pushed past the one before; the top and
  // bottom ones then step inward past any side plate they would meet
  for (const side of ["l", "r", "u", "d"] as const) {
    let next = -Infinity;
    for (const s of signs.filter((q) => q.side === side).sort((a, b) => a.at - b.at)) {
      if (side === "l" || side === "r") {
        const y = Math.min(hi, Math.max(lo, s.at - H / 2, next));
        next = y + H + gap;
        placed.push({ s, x: side === "l" ? M : w - M - est(s), y, w: est(s), h: H });
      } else {
        // centred on the land, kept whole on the screen
        const x = Math.max(M, Math.min(w - M - est(s), s.at - est(s) / 2));
        let y = side === "u" ? lo : hi;
        for (let i = 0; i < 6 && clash(x, y, s); i++) y += (side === "u" ? 1 : -1) * (H + gap);
        placed.push({ s, x, y, w: est(s), h: H });
      }
    }
  }
  return placed;
}

export function EdgeSigns({ m, signs, titles = FAMILY_TITLE, w, h, top, bottom, onLand }: {
  m: Material;
  signs: EdgeSign[];
  /** the land's name in the map's own words (paper: the painter's titles) */
  titles?: Record<string, string>;
  /** the free area (CSS px): the screen, the band between top and h - bottom */
  w: number; h: number; top: number; bottom: number;
  onLand: (f: Family) => void;
}) {
  const H = PHONE.control, M = EDGE_M;
  const placed = placeEdgeSigns(signs, titles, w, h, top, bottom);
  return (
    <>
      {placed.map(({ s, x, y }) => (
        <button key={s.f} type="button" onClick={() => onLand(s.f)} aria-label={`${titles[s.f]}, ${s.count} models: open this land`}
          className="pointer-events-auto absolute inline-flex items-center gap-1.5 px-1.5 leading-none focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ ...plateStyle(m), top: y, ...(s.side === "r" ? { right: M } : { left: x }), height: H,
            fontFamily: m.signFont, fontWeight: 700, fontSize: TYPE.asideSmall, color: m.crisp ? m.border : m.ink }}>
          {s.side !== "r" && <Chevron m={m} side={s.side} />}
          <span>{titles[s.f]}</span>
          <span className="px-1 py-0.5 leading-none" style={{ background: m.border, color: m.loudInk, fontSize: TYPE.badge, fontVariantNumeric: "tabular-nums" }}>{s.count}</span>
          {s.side === "r" && <Chevron m={m} side={s.side} />}
        </button>
      ))}
    </>
  );
}
