// Biome vegetation + terrain props, three or more per family, all stand-up
// paper cutouts lit from the top-left. Base-centre at (0, 0), up negative.
//
//   perception (meadow)     RoundTree · EyeFlowers · FeltBush
//   sequence (desert)       Palm · Cactus · Dune
//   generative (volcanic)   BasaltRocks · PuffTree · Fumarole
//   representation (lake)   Reeds · LilyPond · Willow
//   structure (alpine)      Pine · SnowRock · CrystalCluster
//   decision (farmland)     Topiary · Haystack · Windmill
//   any                     Mountains · BigTree (foreground frame) · Tuft (bits)
import { memo, type ComponentType } from "react";
import { Art, type ArtProps, Cutout, Glint, LitEdge, StandUp, Stitch } from "./materials";
import { P, R, HI, LIT, MID, SHADE, DEEP, type Ramp } from "./palette";
import { blob, circ, ell, frond, poly, rect, rrect, rng } from "./geom";
import { Flower } from "./bits";
import { crystalFacets } from "./setpieces";

type Lobe = readonly [number, number, number];

/** A lobed canopy in four tones: the silhouette in shade, each lobe re-drawn
 *  up-left in mid, then lit caps, then tiny highlights — every lobe gets a
 *  shaded bottom-right rim, which is what makes paper foliage read as round. */
function Lobed({ lobes, ramp, k = 1 }: { lobes: readonly Lobe[]; ramp: Ramp; k?: number }) {
  const off = (dx: number, dy: number, dr: number) => blob(lobes.map(([x, y, r]) => [x + dx * k, y + dy * k, Math.max(0.5, r - dr * k)] as const));
  return (
    <g>
      <path d={blob(lobes)} fill={ramp[SHADE]} />
      <path d={off(-1.2, -1.4, 1.6)} fill={ramp[MID]} />
      <path d={blob(lobes.map(([x, y, r]) => [x - r * 0.28, y - r * 0.32, r * 0.5] as const))} fill={ramp[LIT]} />
      <path d={blob(lobes.map(([x, y, r]) => [x - r * 0.42, y - r * 0.48, r * 0.16] as const))} fill={ramp[HI]} />
    </g>
  );
}

// ── perception: meadow ─────────────────────────────────────────────────

export const RoundTree = memo(function RoundTree(p: ArtProps & { ramp?: Ramp }) {
  const ramp = p.ramp ?? R.leaf;
  const lobes: Lobe[] = [[-13, -34, 12], [0, -46, 14], [13, -35, 12], [-6, -26, 10], [8, -25, 10], [0, -34, 12]];
  const trunk = "M-4 0 Q-3 -10 -3 -22 L3 -22 Q3 -10 4.5 0 Q6 1 8 1 L-7 1 Q-5 1 -4 0Z";
  return (
    <Art design={62} {...p}>
      <StandUp d={[trunk, blob(lobes)]} foot={10} rim={2} depth={1.6}>
        <path d={trunk} fill={R.wood[MID]} />
        <path d="M-4 0 Q-3 -10 -3 -22 L0 -22 Q-0.5 -10 -1 1 L-7 1 Q-5 1 -4 0Z" fill={R.wood[LIT]} />
        <path d="M1 -6 q1 -3 0 -6 M-1.5 -14 q1 -2 0 -4" stroke={R.wood[DEEP]} strokeWidth={0.8} fill="none" strokeLinecap="round" />
        <Lobed lobes={lobes} ramp={ramp} />
        <path d="M-10 -38 l2 2 l2 -2 M4 -48 l2 2 l2 -2 M8 -30 l2 2 l2 -2" stroke={ramp[SHADE]} strokeWidth={0.8} fill="none" strokeLinecap="round" />
        <circle cx={-12} cy={-28} r={1.6} fill={R.red[LIT]} />
        <circle cx={6} cy={-38} r={1.6} fill={R.red[LIT]} />
        <circle cx={12} cy={-26} r={1.6} fill={R.red[MID]} />
      </StandUp>
    </Art>
  );
});

/** A clump of "eye" flowers — perception's echo: petals around a watching eye. */
export const EyeFlowers = memo(function EyeFlowers(p: ArtProps) {
  const heads: [number, number, number][] = [[-8, -18, 5.4], [5, -24, 6], [12, -12, 4.4]];
  const sil = [...heads.map(([x, y, r]) => circ(x, y, r * 1.35)), rect(-9, -14, 2, 14), rect(4, -19, 2, 19), rect(11, -8, 2, 8), "M-4 0 q-7 -4 -9 -10 q6 1 9 10Z M8 0 q7 -3 8 -9 q-6 2 -8 9Z"];
  return (
    <Art design={32} {...p}>
      <StandUp d={sil} foot={12} rim={1.6} depth={1.2}>
        <path d="M-8 0 Q-9 -8 -8 -14 M5 0 Q4 -12 5 -19 M12 0 Q13 -6 12 -8" stroke={R.leaf[SHADE]} strokeWidth={1.6} fill="none" strokeLinecap="round" />
        <path d="M-4 0 q-7 -4 -9 -10 q6 1 9 10Z M8 0 q7 -3 8 -9 q-6 2 -8 9Z" fill={R.leaf[LIT]} />
        {heads.map(([x, y, r], i) => (
          <g key={i}>
            {Array.from({ length: 8 }, (_, k) => {
              const a = (k * Math.PI) / 4;
              const lit = Math.cos(a) + Math.sin(a) < 0;
              return <ellipse key={k} cx={x + Math.cos(a) * r} cy={y + Math.sin(a) * r} rx={r * 0.46} ry={r * 0.3}
                transform={`rotate(${(a * 180) / Math.PI} ${x + Math.cos(a) * r} ${y + Math.sin(a) * r})`} fill={lit ? R.pink[LIT] : R.pink[MID]} />;
            })}
            <circle cx={x} cy={y} r={r * 0.72} fill="#FFFFFF" />
            <circle cx={x + r * 0.12} cy={y + r * 0.08} r={r * 0.42} fill={R.teal[MID]} />
            <circle cx={x + r * 0.16} cy={y + r * 0.1} r={r * 0.2} fill={P.ink} />
            <circle cx={x - r * 0.08} cy={y - r * 0.14} r={r * 0.1} fill="#FFFFFF" />
          </g>
        ))}
      </StandUp>
    </Art>
  );
});

/** A felt bush: knit texture, fuzzy edge, a few stitched highlights. */
export const FeltBush = memo(function FeltBush(p: ArtProps & { ramp?: Ramp }) {
  const ramp = p.ramp ?? R.grass;
  const lobes: Lobe[] = [[-12, -10, 9], [0, -16, 11], [12, -10, 9], [-4, -7, 8], [6, -6, 8]];
  const sil = blob(lobes);
  return (
    <Art design={28} {...p}>
      <StandUp d={sil} foot={16} rim={1.8} depth={1.6} material="felt" fuzz={ramp[MID]}>
        <Lobed lobes={lobes} ramp={ramp} />
        <Stitch d="M-15 -12 Q-12 -18 -6 -18 M-3 -22 Q2 -27 8 -22" color="#FFFFFF" w={0.8} />
        <circle cx={-6} cy={-12} r={1.5} fill={R.pink[LIT]} />
        <circle cx={7} cy={-14} r={1.5} fill={R.gold[LIT]} />
        <circle cx={1} cy={-8} r={1.5} fill={R.pink[LIT]} />
      </StandUp>
    </Art>
  );
});

// ── sequence: desert ───────────────────────────────────────────────────

export const Palm = memo(function Palm(p: ArtProps) {
  // twisted trunk: rings along a gentle S-curve
  const segs = 8;
  const pt = (t: number) => [Math.sin(t * 2.4) * 5 - t * 3, -t * 58] as const;
  const rings = Array.from({ length: segs }, (_, i) => {
    const [x0, y0] = pt(i / segs), [x1, y1] = pt((i + 1) / segs);
    const w0 = 4.6 - i * 0.25, w1 = 4.6 - (i + 1) * 0.25;
    return { d: poly(x0 - w0, y0, x0 + w0, y0, x1 + w1, y1 + 1.4, x1 - w1, y1 + 1.4), lit: poly(x0 - w0, y0, x0 - w0 * 0.1, y0 + 1, x1 - w1 * 0.1, y1 + 1.4, x1 - w1, y1 + 1.4), i };
  });
  const [tx, ty] = pt(1);
  const fr = [
    frond(tx, ty, tx - 30, ty + 14, 9, 7, 0.3), frond(tx, ty, tx + 30, ty + 12, 9, 7, 0.3),
    frond(tx, ty, tx - 24, ty - 8, 8, 6, 0.25), frond(tx, ty, tx + 26, ty - 6, 8, 6, 0.25),
    frond(tx, ty, tx - 13, ty + 23, 7, 5, 0.2), frond(tx, ty, tx + 15, ty + 21, 7, 5, 0.2), frond(tx, ty, tx + 2, ty - 17, 6.4, 4, 0.1),
  ];
  const trunkSil = rings.map((r) => r.d).join("");
  return (
    <Art design={80} {...p}>
      <StandUp d={[trunkSil, ...fr]} foot={10} rim={2} depth={1.6}>
        {rings.map((r) => <path key={r.i} d={r.d} fill={r.i % 2 ? R.wood[MID] : R.wood[SHADE]} />)}
        {rings.map((r) => <path key={`l${r.i}`} d={r.lit} fill={R.wood[LIT]} opacity={0.8} />)}
        {/* back fronds dark, front fronds lit */}
        <path d={fr[2] + fr[3] + fr[6]} fill={R.leaf[DEEP]} />
        <path d={fr[0]} fill={R.leaf[MID]} />
        <path d={fr[1]} fill={R.leaf[SHADE]} />
        <path d={fr[4]} fill={R.leaf[LIT]} />
        <path d={fr[5]} fill={R.leaf[MID]} />
        <path d={`M${tx} ${ty} Q${tx - 16} ${ty - 5} ${tx - 29} ${ty + 13} M${tx} ${ty} Q${tx + 16} ${ty - 6} ${tx + 29} ${ty + 11} M${tx} ${ty} Q${tx - 8} ${ty + 6} ${tx - 12} ${ty + 21}`}
          stroke={R.leaf[HI]} strokeOpacity={0.7} strokeWidth={0.9} fill="none" strokeLinecap="round" />
        <circle cx={tx - 3} cy={ty + 3.5} r={3.2} fill={R.wood[SHADE]} />
        <circle cx={tx + 3} cy={ty + 4} r={3.2} fill={R.wood[DEEP]} />
        <circle cx={tx - 4} cy={ty + 2.4} r={1} fill={R.wood[HI]} />
      </StandUp>
    </Art>
  );
});

/** A round saguaro cactus: vertical ribs (stripes), spines, red flowers. */
export const Cactus = memo(function Cactus(p: ArtProps) {
  const body = rrect(-8, -44, 16, 44, 8);
  const armL = "M-8 -18 H-14 Q-18 -18 -18 -22 V-32 Q-18 -36 -14 -36 Q-11 -36 -11 -32 V-25 H-8Z";
  const armR = "M8 -24 H14 Q18 -24 18 -28 V-36 Q18 -40 14 -40 Q11 -40 11 -36 V-31 H8Z";
  const all = [body, armL, armR];
  return (
    <Art design={50} {...p}>
      <StandUp d={all} foot={9} rim={2} depth={1.6}>
        <path d={all.join("")} fill={R.pine[LIT]} />
        <path d={all.join("")} fill="url(#pa-stripes)" />
        <path d={rrect(2, -44, 6, 44, 3)} fill={R.pine[SHADE]} opacity={0.75} />
        <path d="M14 -40 Q18 -40 18 -36 V-28 Q18 -24 14 -24 H14 V-40Z" fill={R.pine[SHADE]} opacity={0.6} />
        <path d="M-6.5 -36 Q-6.5 -42 -2 -43.4" stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={1.3} fill="none" strokeLinecap="round" />
        <path d="M-5 -30 l-2 -1 M-5 -20 l-2 -1 M-5 -10 l-2 -1 M5 -26 l2 -1 M5 -14 l2 -1 M-16 -30 l-2 -1 M16 -34 l2 -1" stroke="#FFFBE0" strokeWidth={0.7} strokeLinecap="round" />
        <Flower x={-1} y={-43} r={3.2} ramp={R.red} stem={1} />
        <Flower x={14} y={-39} r={2.4} ramp={R.red} stem={1} />
        <path d="M-12 0 Q0 -4 12 0Z" fill={R.sand[MID]} />
      </StandUp>
    </Art>
  );
});

/** A sand dune: lit windward slope, shaded lee, a crest line and ripples. */
export const Dune = memo(function Dune(p: ArtProps) {
  const sil = "M-46 0 Q-30 -8 -10 -20 Q0 -26 8 -22 Q24 -12 46 0Z";
  return (
    <Art design={28} {...p}>
      <Cutout d={sil} rim={1.8} depth={1.4} shadow="drop" lift={0.4}>
        <path d={sil} fill={R.sand[LIT]} />
        <path d="M-10 -20 Q0 -26 8 -22 Q24 -12 46 0 H4 Q2 -12 -10 -20Z" fill={R.sand[SHADE]} />
        <path d="M-40 -2 Q-26 -8 -14 -16 M-30 0 Q-20 -5 -8 -12" stroke={R.sand[MID]} strokeWidth={1.1} fill="none" strokeLinecap="round" />
        <path d="M-12 -19.5 Q-1 -27 8 -22" stroke={R.sand[HI]} strokeWidth={1.5} fill="none" strokeLinecap="round" />
        <path d="M14 -10 Q22 -8 30 -3" stroke={R.sand[DEEP]} strokeOpacity={0.5} strokeWidth={1} fill="none" strokeLinecap="round" />
      </Cutout>
    </Art>
  );
});

/** A stepped desert pyramid: four tiers, lit left faces, shaded right faces, a dark door. */
export const Pyramid = memo(function Pyramid(p: ArtProps) {
  const tiers = [0, 1, 2, 3].map((i) => {
    const w = 42 - i * 9.5, y0 = -i * 11, y1 = y0 - 11;
    return { i, w, y0, y1, sil: poly(-w, y0, w, y0, w - 2, y1, -w + 2, y1) };
  });
  return (
    <Art design={50} {...p}>
      <StandUp d={[...tiers.map((t) => t.sil), poly(-6, -44, 6, -44, 0, -50)]} foot={40} rim={2} depth={1.8}>
        {tiers.map((t) => (
          <g key={t.i}>
            <path d={poly(-t.w, t.y0, 0, t.y0, 0, t.y1, -t.w + 2, t.y1)} fill={R.sand[LIT]} />
            <path d={poly(0, t.y0, t.w, t.y0, t.w - 2, t.y1, 0, t.y1)} fill={R.sand[SHADE]} />
            <path d={`M${-t.w + 2} ${t.y1 + 0.6} H${t.w - 2}`} stroke={R.sand[HI]} strokeWidth={1.4} />
            <path d={`M${-t.w} ${t.y0 - 0.6} H${t.w}`} stroke={R.sand[DEEP]} strokeOpacity={0.45} strokeWidth={1} />
            <path d={`M${-t.w * 0.5} ${t.y0 - 5.5} H${-t.w * 0.2} M${t.w * 0.3} ${t.y0 - 5.5} H${t.w * 0.6}`} stroke={R.sand[DEEP]} strokeOpacity={0.35} strokeWidth={0.8} />
          </g>
        ))}
        <path d={poly(-6, -44, 0, -44, 0, -50)} fill={R.gold[LIT]} />
        <path d={poly(0, -44, 6, -44, 0, -50)} fill={R.gold[SHADE]} />
        <path d="M-5 0 V-7 A5 5 0 0 1 5 -7 V0Z" fill="#3A2340" />
      </StandUp>
    </Art>
  );
});

// ── generative: volcanic ───────────────────────────────────────────────

/** Hexagonal basalt columns with a glowing lava crack. */
export const BasaltRocks = memo(function BasaltRocks(p: ArtProps) {
  const col = (x: number, w: number, h: number) => ({
    front: poly(x - w, 0, x - w, -h, x + w * 0.2, -h - w * 0.3, x + w * 0.2, 0),
    side: poly(x + w * 0.2, 0, x + w * 0.2, -h - w * 0.3, x + w, -h, x + w, 0),
    top: poly(x - w, -h, x - w * 0.2, -h - w * 0.8, x + w, -h, x + w * 0.2, -h - w * 0.3),
  });
  const cols = [col(-10, 6, 22), col(3, 7, 32), col(15, 5.5, 16)];
  const sil = cols.map((c) => c.front + c.side + c.top);
  return (
    <Art design={40} {...p}>
      <StandUp d={sil} foot={16} rim={2} depth={1.6}>
        {cols.map((c, i) => (
          <g key={i}>
            <path d={c.front} fill={R.basalt[LIT]} />
            <path d={c.side} fill={R.basalt[SHADE]} />
            <path d={c.top} fill={R.basalt[HI]} />
          </g>
        ))}
        <path d={sil.join("")} fill="url(#pa-grit)" />
        <path d="M1 0 L2 -8 L0 -14 L3 -22" stroke={R.lava[MID]} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M1 0 L2 -8 L0 -14 L3 -22" stroke={R.lava[HI]} strokeWidth={0.9} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </StandUp>
    </Art>
  );
});

/** A tree whose crown is sample puffs — the generative biome's tree. */
export const PuffTree = memo(function PuffTree(p: ArtProps) {
  const lobes: Lobe[] = [[-9, -36, 9], [4, -44, 10], [11, -32, 8], [-2, -30, 8]];
  const trunk = "M-2.4 0 Q-1 -14 -3 -28 L1 -28 Q2 -14 2.6 0Z";
  return (
    <Art design={56} {...p}>
      <StandUp d={[trunk, blob(lobes)]} foot={8} rim={2} depth={1.6}>
        <path d={trunk} fill={R.wood[SHADE]} />
        <path d="M-2.4 0 Q-1 -14 -3 -28 L-1 -28 Q0 -14 0 0Z" fill={R.wood[MID]} />
        <path d="M-1 -20 L-8 -26 M1 -16 L7 -22" stroke={R.wood[SHADE]} strokeWidth={1.6} strokeLinecap="round" />
        <Lobed lobes={lobes} ramp={R.violet} />
        <circle cx={-10} cy={-40} r={2} fill="#FFFFFF" opacity={0.7} />
        <circle cx={3} cy={-50} r={2.2} fill="#FFFFFF" opacity={0.7} />
      </StandUp>
    </Art>
  );
});

/** A steaming vent: a rock ring with violet steam puffs. */
export const Fumarole = memo(function Fumarole(p: ArtProps) {
  const ring = "M-16 0 Q-15 -8 -8 -9 Q0 -11 8 -9 Q15 -8 16 0Z";
  const puffs = blob([[-2, -20, 6], [4, -26, 7], [-4, -32, 5], [3, -38, 4.2]]);
  return (
    <Art design={44} {...p}>
      <StandUp d={ring} foot={15} rim={2} depth={1.6}>
        <path d={ring} fill={R.basalt[MID]} />
        <path d="M-16 0 Q-15 -8 -8 -9 Q-4 -10 -2 -10 Q-8 -4 -8 0Z" fill={R.basalt[LIT]} />
        <path d="M8 -9 Q15 -8 16 0 H8Z" fill={R.basalt[SHADE]} />
        <ellipse cx={0} cy={-8.4} rx={7} ry={1.6} fill={R.lava[MID]} />
        <ellipse cx={-0.5} cy={-8.8} rx={4} ry={0.8} fill={R.lava[HI]} />
      </StandUp>
      <Cutout d={puffs} rim={1.4} depth={1} shadow="drop" lift={1.4}>
        <path d={puffs} fill="#F1E8FF" />
        <path d={blob([[1, -22, 4], [7, -24, 4]])} fill={R.violet[HI]} />
        <path d={blob([[-4, -22, 2.4], [2, -29, 2.6]])} fill="#FFFFFF" />
      </Cutout>
    </Art>
  );
});

// ── representation: lakeside ───────────────────────────────────────────

/** Cattail reeds standing in a little puddle. */
export const Reeds = memo(function Reeds(p: ArtProps) {
  const stems: [number, number, number][] = [[-8, 30, -2], [-3, 38, 1], [3, 34, 2], [8, 26, 3]];
  const heads = stems.map(([x, h, lean]) => rrect(x + lean - 1.8, -h, 3.6, 9, 1.8));
  return (
    <Art design={40} {...p}>
      <path d={ell(0, 0, 16, 4)} fill={R.teal[MID]} stroke={P.die} strokeWidth={1.4} />
      <path d="M-10 -0.5 H-2 M4 1 H10" stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={0.8} strokeLinecap="round" />
      <StandUp d={[...heads, ...stems.map(([x, h, lean]) => `M${x - 1} 0 L${x + lean - 1} ${-h} L${x + lean + 1} ${-h} L${x + 1} 0Z`)]} foot={0.1} rim={1.4} depth={1} shadow="ground">
        {stems.map(([x, h, lean], i) => <path key={i} d={`M${x} 0 L${x + lean} ${-h + 2}`} stroke={R.leaf[SHADE]} strokeWidth={1.2} strokeLinecap="round" />)}
        <path d="M-5 0 Q-10 -10 -14 -18 Q-8 -10 -3 0Z M5 0 Q10 -12 14 -20 Q8 -10 3 0Z" fill={R.leaf[MID]} />
        <path d="M-5 0 Q-10 -10 -14 -18 Q-9 -12 -6 -6Z" fill={R.leaf[LIT]} />
        {heads.map((d, i) => <path key={i} d={d} fill={i % 2 ? R.wood[SHADE] : R.wood[MID]} />)}
        {stems.map(([x, h, lean], i) => <path key={`h${i}`} d={`M${x + lean - 0.8} ${-h + 1} v6`} stroke={R.wood[HI]} strokeWidth={0.8} strokeLinecap="round" />)}
      </StandUp>
    </Art>
  );
});

/** A small lily pond lying flat: pads with a notch, one pink lotus. */
export const LilyPond = memo(function LilyPond(p: ArtProps) {
  const pad = (x: number, y: number, r: number, a: number) =>
    `M${x} ${y}L${x + Math.cos(a) * r} ${y + Math.sin(a) * r * 0.55}A${r} ${r * 0.55} 0 1 1 ${x + Math.cos(a + 0.5) * r} ${y + Math.sin(a + 0.5) * r * 0.55}Z`;
  return (
    <Art design={20} {...p}>
      <Cutout d={ell(0, -8, 30, 10)} rim={2} depth={0} shadow="none">
        <path d={ell(0, -8, 30, 10)} fill={R.sand[MID]} />
        <path d={ell(0.5, -7.6, 27, 8.4)} fill="url(#pa-lake)" />
        <path d="M-18 -10 H-8 M6 -4 H16" stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={1} strokeLinecap="round" />
        <path d={pad(-12, -6, 6, 0.3)} fill={R.leaf[MID]} />
        <path d={pad(10, -10, 5, 2.2)} fill={R.leaf[LIT]} />
        <path d={pad(2, -3, 4.4, 4)} fill={R.leaf[MID]} />
        <path d="M-12 -6 l-3 -1.6 M10 -10 l2 -2" stroke={R.leaf[DEEP]} strokeWidth={0.6} />
      </Cutout>
      <g>
        <path d="M-14 -8 Q-12 -14 -10 -8Z M-15 -8 Q-17 -12 -12 -9Z M-9 -8 Q-7 -12 -12 -9Z" fill={R.pink[LIT]} stroke={P.die} strokeWidth={0.5} />
        <circle cx={-12} cy={-9} r={0.9} fill={R.gold[LIT]} />
      </g>
    </Art>
  );
});

/** A weeping willow: a lobed dome and a fringe of hanging, swaying strands
 *  with gaps that show the trunk behind them. */
const WILLOW = (() => {
  const r = rng(11);
  const strands: { d: string; tone: number }[] = [];
  for (let i = 0; i < 11; i++) {
    const x = -19 + i * 3.8, top = -34 + Math.abs(x) * 0.28, len = 20 + r() * 12 - Math.abs(x) * 0.2, sway = (r() - 0.5) * 3;
    const b = top + len;
    strands.push({
      d: `M${x - 2.4} ${top} Q${x - 2.6 + sway} ${top + len * 0.55} ${x - 0.4 + sway} ${b} Q${x + 1.6 + sway} ${top + len * 0.5} ${x + 2.4} ${top}Z`,
      tone: x < -6 ? 0 : x < 8 ? 1 : 2,
    });
  }
  return strands;
})();
export const Willow = memo(function Willow(p: ArtProps) {
  const lobes: Lobe[] = [[-13, -40, 10], [0, -47, 12], [13, -40, 10], [-19, -32, 6.4], [19, -32, 6.4], [0, -36, 11]];
  const trunk = "M-3 0 Q-1 -12 -4 -30 L2 -30 Q2 -14 3.4 0 Q5 1 7 1 L-6 1 Q-4 1 -3 0Z";
  return (
    <Art design={60} {...p}>
      <StandUp d={[trunk, blob(lobes), ...WILLOW.map((w) => w.d)]} foot={12} rim={2} depth={1.6}>
        <path d={trunk} fill={R.wood[MID]} />
        <path d="M-3 0 Q-1 -12 -4 -30 L-1 -30 Q-0.4 -14 -0.4 1 L-6 1 Q-4 1 -3 0Z" fill={R.wood[LIT]} />
        {WILLOW.filter((_, i) => i % 2).map((w, i) => <path key={`b${i}`} d={w.d} fill={R.teal[DEEP]} />)}
        <Lobed lobes={lobes} ramp={R.teal} />
        {WILLOW.filter((_, i) => i % 2 === 0).map((w, i) => <path key={`f${i}`} d={w.d} fill={[R.teal[LIT], R.teal[MID], R.teal[SHADE]][w.tone]} />)}
        <path d="M-14 -44 Q-8 -50 -2 -51" stroke={R.teal[HI]} strokeWidth={1.2} fill="none" strokeLinecap="round" />
      </StandUp>
    </Art>
  );
});

// ── structure: alpine ──────────────────────────────────────────────────

/** A conifer as stacked zig-zag triangles, lit left halves, chevron bark. */
export const Pine = memo(function Pine(p: ArtProps & { snow?: boolean }) {
  const tier = (y: number, w: number, h: number) => {
    const teeth = 4, pts: number[] = [0, y - h];
    pts.push(w, y);
    for (let i = teeth * 2 - 1; i >= 1; i--) pts.push(-w + (i * 2 * w) / (teeth * 2), y - (i % 2 ? 3 : 0));
    pts.push(-w, y);
    return poly(...pts);
  };
  const tiers = [tier(-10, 14, 20), tier(-22, 11, 18), tier(-33, 8, 16)];
  const half = (y: number, w: number, h: number) => poly(0, y - h, 0, y - 1.5, -w * 0.25, y, -w, y);
  const trunk = rect(-2.6, -12, 5.2, 12);
  return (
    <Art design={50} {...p}>
      <StandUp d={[trunk, ...tiers]} foot={9} rim={2} depth={1.6}>
        <path d={trunk} fill={R.wood[SHADE]} />
        <path d={rect(-2.6, -12, 2.6, 12)} fill={R.wood[MID]} />
        <path d="M-2 -3 l2 -1.4 l2 1.4 M-2 -7 l2 -1.4 l2 1.4" stroke={R.wood[DEEP]} strokeWidth={0.7} fill="none" />
        {tiers.map((d, i) => <path key={i} d={d} fill={R.pine[SHADE]} />)}
        <path d={half(-10, 14, 20)} fill={R.pine[MID]} />
        <path d={half(-22, 11, 18)} fill={R.pine[MID]} />
        <path d={half(-33, 8, 16)} fill={R.pine[LIT]} />
        <path d="M-9 -12 l3 -3 l3 3 M3 -14 l3 -3 l3 3 M-5 -25 l3 -3 l3 3" stroke={R.pine[HI]} strokeOpacity={0.55} strokeWidth={0.7} fill="none" />
        {p.snow && <path d="M0 -49 L-5 -40 Q-3 -41 -1 -39 Q1 -42 3 -40 Q4 -41 5 -40Z" fill="#FFFFFF" />}
      </StandUp>
    </Art>
  );
});

/** A boulder with a snow cap that drips down its lit side. */
export const SnowRock = memo(function SnowRock(p: ArtProps) {
  const rock = "M-20 0 L-16 -14 L-6 -24 L6 -26 L16 -16 L20 0Z";
  const snow = "M-16 -14 L-6 -24 L6 -26 L16 -16 L13 -13 Q10 -16 8 -12 Q5 -16 2 -13 Q-1 -17 -4 -12 Q-7 -15 -9 -11 Q-12 -14 -16 -14Z";
  return (
    <Art design={30} {...p}>
      <StandUp d={rock} foot={18} rim={2} depth={1.6}>
        <path d={rock} fill={R.rock[MID]} />
        <path d="M-20 0 L-16 -14 L-6 -24 L-2 -10 L-8 0Z" fill={R.rock[LIT]} />
        <path d="M6 -26 L16 -16 L20 0 L8 0 L6 -12Z" fill={R.rock[SHADE]} />
        <path d={rock} fill="url(#pa-grit)" />
        <path d={snow} fill={R.snow[MID]} />
        <path d="M-16 -14 L-6 -24 L6 -26 L2 -18 Q-1 -17 -4 -12 Q-7 -15 -9 -11 Q-12 -14 -16 -14Z" fill="#FFFFFF" />
        <path d="M6 -26 L16 -16 L13 -13 Q10 -16 8 -12 Z" fill={R.snow[SHADE]} />
      </StandUp>
    </Art>
  );
});

/** A little cluster of pink crystals — structure's biome echo. */
export const CrystalCluster = memo(function CrystalCluster(p: ArtProps) {
  const cr = [crystalFacets(-6, 0, 8, 14, -0.4), crystalFacets(5, 0, 7, 10, 0.45), crystalFacets(0, 0, 10, 20, 0.02)];
  return (
    <Art design={32} {...p}>
      <StandUp d={cr.map((c) => c.sil)} foot={11} rim={1.8} depth={1.4}>
        {cr.map((c, i) => (
          <g key={i}>
            <path d={c.left} fill={R.pink[LIT]} />
            <path d={c.front} fill={R.pink[MID]} />
            <path d={c.right} fill={R.pink[SHADE]} />
            <path d={c.tipL} fill={R.pink[HI]} />
            <path d={c.tipF} fill={R.pink[LIT]} />
            <path d={c.tipR} fill={R.pink[MID]} />
          </g>
        ))}
        <Glint x={-1} y={-26} r={2.2} streak={false} />
        <path d="M-10 0 Q0 -3 10 0Z" fill={R.rock[SHADE]} />
      </StandUp>
    </Art>
  );
});

// ── decision: farmland ─────────────────────────────────────────────────

/** A felt topiary ball in a terracotta pot. */
export const Topiary = memo(function Topiary(p: ArtProps) {
  const pot = "M-7 0 L-9 -10 H9 L7 0Z";
  const ball = circ(0, -22, 10);
  return (
    <Art design={34} {...p}>
      <StandUp d={[pot, rect(-10, -12, 20, 3), ball]} foot={8} rim={1.8} depth={1.4}>
        <path d="M-0.8 -12 V-16" stroke={R.wood[MID]} strokeWidth={1.8} />
        <path d={pot} fill={R.orange[MID]} />
        <path d="M-7 0 L-9 -10 H-3 L-2 0Z" fill={R.orange[LIT]} />
        <path d="M3 0 L4 -10 H9 L7 0Z" fill={R.orange[SHADE]} />
        <path d={rect(-10, -12, 20, 3)} fill={R.orange[HI]} />
        <Cutout d={ball} rim={0} depth={0} shadow="none" material="felt" fuzz={R.lime[MID]} grain={false}>
          <Lobed lobes={[[0, -22, 10]]} ramp={R.lime} />
        </Cutout>
        <Stitch d="M-7 -26 Q-4 -31 1 -31" w={0.7} />
      </StandUp>
    </Art>
  );
});

export const Haystack = memo(function Haystack(p: ArtProps) {
  const sil = "M-18 0 Q-19 -14 -10 -22 Q0 -30 10 -22 Q19 -14 18 0Z";
  const straws = (() => {
    const r = rng(7); let d = "";
    for (let i = 0; i < 22; i++) { const x = -15 + r() * 30, y = -4 - r() * 20, a = (r() - 0.5) * 1.2; d += `M${x.toFixed(1)} ${y.toFixed(1)}l${(Math.sin(a) * 5).toFixed(1)} ${(-Math.cos(a) * 5).toFixed(1)}`; }
    return d;
  })();
  return (
    <Art design={30} {...p}>
      <StandUp d={sil} foot={16} rim={2} depth={1.6}>
        <path d={sil} fill={R.gold[MID]} />
        <path d="M-18 0 Q-19 -14 -10 -22 Q-4 -26 0 -27 Q-9 -16 -8 0Z" fill={R.gold[LIT]} />
        <path d="M8 0 Q10 -14 6 -24 Q16 -18 18 -8 Q18 -4 18 0Z" fill={R.gold[SHADE]} />
        <path d={straws} stroke={R.gold[DEEP]} strokeOpacity={0.55} strokeWidth={0.7} strokeLinecap="round" />
        <path d="M-17 -9 Q0 -4 17 -9" stroke={R.red[MID]} strokeWidth={1.4} fill="none" />
      </StandUp>
    </Art>
  );
});

export const Windmill = memo(function Windmill(p: ArtProps) {
  const body = poly(-9, 0, -6, -34, 6, -34, 9, 0);
  const cap = "M-8 -33 Q-8 -44 0 -45 Q8 -44 8 -33Z";
  const hub: [number, number] = [0, -38];
  const rotP = (a: number, u: number, v: number) => [hub[0] + u * Math.cos(a) - v * Math.sin(a), hub[1] + u * Math.sin(a) + v * Math.cos(a)];
  const blade = (a: number) => poly(...rotP(a, 3, -1.2), ...rotP(a, 27, -1.2), ...rotP(a, 27, 6.4), ...rotP(a, 7, 5.6));
  const spar = (a: number) => { const [x0, y0] = rotP(a, 0, 0), [x1, y1] = rotP(a, 28, 0); return `M${x0} ${y0}L${x1} ${y1}`; };
  const lattice = (a: number) => [9, 14, 19, 24].map((u) => { const [x0, y0] = rotP(a, u, -1), [x1, y1] = rotP(a, u, 6); return `M${x0} ${y0}L${x1} ${y1}`; }).join("")
    + (() => { const [x0, y0] = rotP(a, 5, 2.8), [x1, y1] = rotP(a, 27, 2.8); return `M${x0} ${y0}L${x1} ${y1}`; })();
  const angles = [0.3, 0.3 + Math.PI / 2, 0.3 + Math.PI, 0.3 + (3 * Math.PI) / 2];
  const blades = angles.map(blade);
  return (
    <Art design={66} {...p}>
      <StandUp d={[body, cap, ...blades]} foot={10} rim={2} depth={1.6}>
        <path d={body} fill={R.cream[LIT]} />
        <path d={poly(2, 0, 2, -34, 6, -34, 9, 0)} fill={R.cream[SHADE]} />
        <path d={body} fill="url(#pa-occl)" />
        <path d={cap} fill={R.red[MID]} />
        <path d="M-8 -33 Q-8 -44 0 -45 Q-4 -40 -3 -33Z" fill={R.red[LIT]} />
        <rect x={-2.6} y={-12} width={5.2} height={12} rx={2.6} fill={R.wood[MID]} />
        <rect x={-2} y={-26} width={4} height={5} fill={P.window} />
        {angles.map((a, i) => (
          <g key={i}>
            <path d={blades[i]} fill={i % 2 ? R.cream[LIT] : R.cream[HI]} />
            <path d={lattice(a)} stroke={R.wood[SHADE]} strokeWidth={0.8} />
            <path d={spar(a)} stroke={R.wood[DEEP]} strokeWidth={1.6} strokeLinecap="round" />
          </g>
        ))}
        <circle cx={hub[0]} cy={hub[1]} r={2.6} fill={R.wood[DEEP]} />
      </StandUp>
    </Art>
  );
});

// ── any biome ──────────────────────────────────────────────────────────

/** A range of layered paper peaks: a hazy back row, lit/shade faces, snow caps. */
export const Mountains = memo(function Mountains(p: ArtProps & { snow?: boolean }) {
  const snow = p.snow ?? true;
  const peak = (x: number, w: number, h: number) => ({
    sil: poly(x - w, 0, x, -h, x + w, 0),
    lit: poly(x - w, 0, x, -h, x - w * 0.12, 0),
    shade: poly(x + w * 0.1, 0, x, -h, x + w, 0),
    cap: poly(x - w * 0.34, -h * 0.66, x, -h, x + w * 0.34, -h * 0.66, x + w * 0.2, -h * 0.6, x + w * 0.08, -h * 0.68, x - w * 0.06, -h * 0.58, x - w * 0.2, -h * 0.66),
    capShade: poly(x, -h, x + w * 0.34, -h * 0.66, x + w * 0.2, -h * 0.6, x + w * 0.08, -h * 0.68, x + w * 0.02, -h * 0.64),
  });
  const back = [peak(-40, 34, 62), peak(34, 38, 70)];
  const front = [peak(-66, 34, 50), peak(-4, 46, 92), peak(62, 36, 56)];
  return (
    <Art design={96} {...p}>
      <Cutout d={back.map((k) => k.sil)} rim={2} depth={1.6} shadow="none">
        {back.map((k, i) => (
          <g key={i}>
            <path d={k.sil} fill="#AEB9D6" />
            <path d={k.shade} fill="#8F9BC0" />
            {snow && <path d={k.cap} fill="#EEF3FC" />}
          </g>
        ))}
      </Cutout>
      <StandUp d={front.map((k) => k.sil)} foot={86} rim={2.4} depth={2}>
        {front.map((k, i) => (
          <g key={i}>
            <path d={k.sil} fill={R.rock[MID]} />
            <path d={k.lit} fill={R.rock[LIT]} />
            <path d={k.shade} fill={R.rock[SHADE]} />
            {snow && <path d={k.cap} fill="#FFFFFF" />}
            {snow && <path d={k.capShade} fill={R.snow[SHADE]} />}
          </g>
        ))}
        <path d={front.map((k) => k.sil).join("")} fill="url(#pa-grit)" />
        <path d="M-12 -40 L-4 -30 M10 -44 L16 -34 M-70 -22 L-64 -14 M58 -26 L66 -16" stroke={R.rock[DEEP]} strokeWidth={1.2} strokeLinecap="round" />
        <LitEdge d="M-50 -40 L-4 -92" w={1.4} opacity={0.6} />
        <path d="M-100 0 Q-80 -8 -60 -4 Q-40 -9 -20 -3 Q0 -8 20 -3 Q40 -8 60 -4 Q80 -9 98 0Z" fill={R.grass[MID]} />
        <path d="M-100 0 Q-80 -8 -60 -4 Q-40 -9 -20 -3 L-20 0Z" fill={R.grass[LIT]} />
      </StandUp>
    </Art>
  );
});

/** A big foreground tree for frame overlap: many lobes, a forked trunk. */
export const BigTree = memo(function BigTree(p: ArtProps) {
  const lobes: Lobe[] = [
    [-60, -150, 42], [-10, -196, 52], [52, -160, 44], [-40, -104, 36], [30, -110, 40], [0, -140, 46], [-78, -118, 26], [80, -122, 28],
  ];
  const trunk = "M-14 0 Q-10 -40 -12 -80 Q-30 -100 -44 -110 L-38 -116 Q-22 -108 -6 -94 Q4 -110 22 -120 L26 -114 Q10 -100 8 -80 Q8 -40 16 0 Q24 4 30 4 L-30 4 Q-20 4 -14 0Z";
  return (
    <Art design={250} {...p}>
      <StandUp d={[trunk, blob(lobes)]} foot={40} rim={4} depth={4}>
        <path d={trunk} fill={R.wood[MID]} />
        <path d="M-14 0 Q-10 -40 -12 -80 Q-30 -100 -44 -110 L-40 -114 Q-20 -98 -4 -84 Q-2 -40 -2 4 L-30 4 Q-20 4 -14 0Z" fill={R.wood[LIT]} />
        <path d="M6 -10 Q9 -40 8 -80 Q10 -100 24 -118 L26 -114 Q12 -100 10 -80 Q10 -40 16 0Z" fill={R.wood[SHADE]} />
        <path d="M-6 -20 q3 -8 0 -16 M2 -50 q3 -8 0 -16 M-8 -64 q-3 -6 0 -12" stroke={R.wood[DEEP]} strokeWidth={1.6} fill="none" strokeLinecap="round" />
        <Lobed lobes={lobes} ramp={R.leaf} k={3} />
        <path d="M-70 -160 l5 5 l5 -5 M-20 -210 l5 5 l5 -5 M30 -176 l5 5 l5 -5 M-30 -120 l5 5 l5 -5 M40 -124 l5 5 l5 -5" stroke={R.leaf[SHADE]} strokeWidth={1.6} fill="none" strokeLinecap="round" />
        {[[-50, -128], [10, -170], [44, -140], [-20, -150], [66, -110]].map(([x, y], i) => (
          <g key={i}><circle cx={x} cy={y} r={4.2} fill={R.red[MID]} /><circle cx={x - 1.3} cy={y - 1.3} r={1.4} fill={R.red[HI]} /></g>
        ))}
      </StandUp>
    </Art>
  );
});

// ── registry ───────────────────────────────────────────────────────────
export const BIOME: Record<string, { C: ComponentType<ArtProps>; H: number; W: number; name: string }[]> = {
  perception: [{ C: RoundTree, H: 62, W: 34, name: "Round tree" }, { C: EyeFlowers, H: 32, W: 32, name: "Eye flowers" }, { C: FeltBush, H: 28, W: 44, name: "Felt bush" }],
  sequence: [{ C: Palm, H: 80, W: 66, name: "Palm" }, { C: Cactus, H: 50, W: 40, name: "Striped cactus" }, { C: Dune, H: 28, W: 96, name: "Dune" }, { C: Pyramid, H: 50, W: 90, name: "Stepped pyramid" }],
  generative: [{ C: BasaltRocks, H: 40, W: 40, name: "Basalt columns" }, { C: PuffTree, H: 56, W: 40, name: "Puff tree" }, { C: Fumarole, H: 44, W: 36, name: "Fumarole" }],
  representation: [{ C: Reeds, H: 40, W: 36, name: "Reeds" }, { C: LilyPond, H: 20, W: 64, name: "Lily pond" }, { C: Willow, H: 60, W: 50, name: "Willow" }],
  structure: [{ C: Pine, H: 50, W: 32, name: "Pine" }, { C: SnowRock, H: 30, W: 44, name: "Snow-capped rock" }, { C: CrystalCluster, H: 32, W: 28, name: "Crystal cluster" }],
  decision: [{ C: Topiary, H: 34, W: 24, name: "Felt topiary" }, { C: Haystack, H: 30, W: 40, name: "Haystack" }, { C: Windmill, H: 66, W: 60, name: "Windmill" }],
};

