// The legibility floor: a diagram is never shown so small that its labels
// stop being read. Diagrams draw in art px with a 7-px-tall pixel face, so a
// drawing shown at zoom z (CSS px per art px) sets its labels at 7·z CSS px.
// Below LEGIBLE.minLabelPx (×1 = 7 px: crisp on a retina screen, but too small
// to read comfortably) a host shows the full drawing larger, or — when there
// is no room for that — the card composition at LEGIBLE.cardZoom with the
// full drawing one click away. Every zoom stays crisp: a whole number of
// device px per art px (×1.5 on a dpr-2 screen = 3 device px).
//
//   legibleZooms(dpr)                 → [1.5, 2] on dpr 2, [2] on dpr 1
//   isLegible(zoom)                   → labels ≥ the floor at this zoom
//   fitZoom(avail, viewW, dpr)        → the largest of those that fits, or null
//   fallbackFor(width, viewW)         → "full" | "card": what MechanismDiagram
//                                       renders when given minLabelPx
// Pure, no React (tested by diagrams/fit-zoom.test.ts and
// components/lab/painted/plate-legible.test.ts).
import { FONT_H } from "./pixel-font.ts";

/** Never show a drawing whose labels fall below minLabelPx CSS px (cap height
 * = FONT_H × zoom). ×1 = 7 px fails; ×1.5 (3 device px on a retina screen) =
 * 10.5 px passes. tokens.ts re-exports this. */
export const LEGIBLE = {
  minLabelPx: 10,  // cap height, CSS px
  maxZoom: 2,      // a host never needs more than the canonical ×2
  cardZoom: 2,     // the card composition's scale (ART.scale: 14-px caps)
} as const;

/** CSS px of a pixel-face cap at this zoom (CSS px per art px). */
export const labelPx = (zoom: number): number => FONT_H * zoom;

/** Labels at this zoom meet the floor. */
export const isLegible = (zoom: number, min: number = LEGIBLE.minLabelPx): boolean => labelPx(zoom) >= min - 1e-6;

/** A zoom that puts every art px on whole device px. */
export const isCrisp = (zoom: number, dpr: number): boolean => Math.abs(zoom * dpr - Math.round(zoom * dpr)) < 1e-6;

/** The crisp zooms that meet the floor, smallest first, up to `max` (CSS px per art px). */
export function legibleZooms(dpr: number, max: number = LEGIBLE.maxZoom, min: number = LEGIBLE.minLabelPx): number[] {
  const d = Math.max(1, Math.round(dpr * 2) / 2);
  const out: number[] = [];
  for (let i = 1; i / d <= max + 1e-6; i++) {
    const z = i / d;
    if (isCrisp(z, d) && isLegible(z, min)) out.push(z);
  }
  return out;
}

/** What a full drawing `width` CSS px wide shows under the floor: itself, or its card. */
export function fallbackFor(width: number, viewW: number, min: number = LEGIBLE.minLabelPx): "full" | "card" {
  return isLegible(width / viewW, min) ? "full" : "card";
}

/** The largest crisp, legible zoom at which `viewW` art px fit in `avail` CSS
 * px (≤ max), or null when even the smallest legible zoom is too wide. The
 * specimen sizes its drawing and its cards with this:
 *   fitZoom(1248, 560, 2) → 2 · fitZoom(992, 560, 2) → 1.5 · fitZoom(358, 560, 2) → null
 *   fitZoom(358, 190, 3) → 5/3 (316.67 CSS px = 950 device px) */
export function fitZoom(avail: number, viewW: number, dpr: number, max: number = LEGIBLE.maxZoom, min: number = LEGIBLE.minLabelPx): number | null {
  const fits = legibleZooms(dpr, max, min).filter((z) => z * viewW <= avail + 1e-6);
  return fits.length ? fits[fits.length - 1] : null;
}
