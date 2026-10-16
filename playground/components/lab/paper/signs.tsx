"use client";

// Family signboards (storybook furniture) pinned on each land: the sign sits
// on the family's own land near its top, where no model stands. World px; the
// sign is counter-scaled so it reads at a constant ~1.3× design size on screen.
import { memo } from "react";
import type { Box, Pt, World } from "@/lib/world";
import { FAMILY_SIGN, FamilySign } from "./art";

const SIGN_W = 230, SIGN_H = 52;       // design size (FamilySign at scale 1, generous)

function inside(p: Pt, poly: Pt[]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

/** One anchor per family: scan the land from its top down, the first spot clear of models. */
export function signAnchors(world: World, k: number): { family: string; at: Pt }[] {
  const out: { family: string; at: Pt }[] = [];
  for (const s of world.shapes) {
    const xs = s.poly.map((p) => p.x), ys = s.poly.map((p) => p.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const w = SIGN_W * k, h = SIGN_H * k;
    let best: Pt | null = null;
    for (let v = 0.12; v < 0.9 && !best; v += 0.06) {
      for (const u of [0.5, 0.38, 0.62, 0.26, 0.74]) {
        const p = { x: x0 + u * (x1 - x0), y: y0 + v * (y1 - y0) };
        if (!inside(p, s.poly)) continue;
        const clear = world.nodes.every((n) => Math.abs(n.center.x - p.x) > w / 2 + (n.atom ? 50 : 26) || n.center.y < p.y - h / 2 - 30 || n.center.y > p.y + h / 2 + (n.atom ? 120 : 30));
        if (clear && !out.some((o) => Math.abs(o.at.x - p.x) < w && Math.abs(o.at.y - p.y) < h * 1.4)) { best = p; break; }
      }
    }
    out.push({ family: s.family, at: best ?? { x: (x0 + x1) / 2, y: y0 + 0.2 * (y1 - y0) } });
  }
  return out;
}

/** World boxes of the signs (as standing boxes: base = bottom edge), for tag avoidance. */
export function signBoxes(world: World, k: number): Box[] {
  return signAnchors(world, k).map(({ at }) => ({ x: at.x - (SIGN_W * k) / 2, y: at.y - (SIGN_H * k) / 2, w: SIGN_W * k, h: SIGN_H * k }));
}

export const FamilySigns = memo(function FamilySigns({ world, show, scale }: { world: World; show: boolean; scale: number }) {
  if (!show) return null;
  const k = Math.min(2.2, Math.max(1, scale * 1.15));
  return (
    <g aria-hidden pointerEvents="none">
      {signAnchors(world, k).map(({ family, at }) => FAMILY_SIGN[family]
        ? <FamilySign key={family} x={at.x} y={at.y} family={family} scale={k} /> : null)}
    </g>
  );
});
