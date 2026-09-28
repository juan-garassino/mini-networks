// Puffy layered paper clouds (ref-paper.md: "grey-blue with lighter tops …
// overlapping land and sea, casting soft shadows"). A cloud floats: its
// shadow lands far below-right on the ground, so the builder can draw
// <CloudShadow> on the ground layer and <PaperCloud> on the top layer.
import { memo } from "react";
import { Art, type ArtProps, Cutout, SoftShadow } from "./materials";
import { blob } from "./geom";

type Lobe = readonly [number, number, number];
const CLOUDS: { back: Lobe[]; front: Lobe[] }[] = [
  {
    back: [[-34, -22, 16], [-10, -34, 22], [18, -30, 19], [40, -18, 13]],
    front: [[-42, -10, 11], [-22, -14, 15], [2, -18, 18], [26, -14, 15], [46, -9, 10], [0, -8, 16]],
  },
  {
    back: [[-18, -28, 16], [8, -36, 20], [30, -22, 13]],
    front: [[-30, -10, 11], [-10, -16, 15], [14, -18, 16], [34, -10, 11], [2, -8, 14]],
  },
  {
    back: [[-44, -18, 13], [-22, -30, 18], [4, -34, 20], [30, -26, 16], [52, -14, 11]],
    front: [[-54, -8, 9], [-36, -12, 13], [-12, -16, 16], [14, -16, 17], [38, -12, 13], [58, -7, 8], [0, -7, 14]],
  },
];

/** The ground shadow of a cloud (draw it on the ground layer). */
export function CloudShadow({ x = 0, y = 0, size = 50, variant = 0 }: { x?: number; y?: number; size?: number; variant?: number }) {
  const c = CLOUDS[variant % CLOUDS.length];
  const k = size / 50;
  return (
    <g transform={`translate(${x} ${y}) scale(${k} ${k * 0.55})`} pointerEvents="none">
      <SoftShadow d={[blob(c.back), blob(c.front)]} spread={6} opacity={0.9} />
    </g>
  );
}

export const PaperCloud = memo(function PaperCloud({ variant = 0, castShadow = false, ...p }: ArtProps & { variant?: number; /** also draw its ground shadow (specimens) */ castShadow?: boolean }) {
  const c = CLOUDS[variant % CLOUDS.length];
  // Layered card, Sticker-Star style: every tone is a UNION of lobes laid a
  // little up-left of the one below — edges only ever show on silhouettes,
  // so the cloud reads as stacked paper, never as bubbles.
  const shift = (ls: readonly Lobe[], dx: number, dy: number, k = 1) => blob(ls.map(([x, y, r]) => [x + dx, y + dy, r * k] as const));
  const back = blob(c.back), backLit = shift(c.back, -2, -3);
  const front = blob(c.front), frontLit = shift(c.front, -2.5, -3.5);
  const mean = c.front.reduce((a, l) => a + l[1], 0) / c.front.length;
  // the cap: upper lobes bridged by in-between circles so it is one band
  const upper = c.front.filter((l) => l[1] <= mean).sort((a, b) => a[0] - b[0]);
  const bridged: Lobe[] = [];
  upper.forEach((l, i) => {
    bridged.push(l);
    const n = upper[i + 1];
    if (n) bridged.push([(l[0] + n[0]) / 2, (l[1] + n[1]) / 2 - 1, ((l[2] + n[2]) / 2) * 0.92]);
  });
  const cap = shift(bridged, -4, -6, 0.74);
  return (
    <Art design={50} {...p}>
      {castShadow && <CloudShadow x={30} y={46} size={50} variant={variant} />}
      <Cutout d={[back, backLit, front, frontLit]} rim={2.6} depth={2.4} shadow="drop" lift={1.2}>
        <path d={back} fill="#9FACD0" />
        <path d={backLit} fill="#C3CDE8" />
        <path d={front} fill="#AFBBDC" />
        <path d={frontLit} fill="#DDE4F5" />
        <path d={cap} fill="#F7F9FE" />
      </Cutout>
    </Art>
  );
});
