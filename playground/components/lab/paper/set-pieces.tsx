// Flat-faceted paper set-pieces (one per family, on world.regions[].setPiece)
// and the tiny biome props that sit on world.decor cells. Drawn in a 100-wide
// design space with the base at y = 0 (up is negative), then scaled into the
// set-piece box. Every shape is a card cutout: rim pass, edge pass, faces.
import { memo, type CSSProperties } from "react";
import { T, type Region, type World } from "@/lib/world";
import { inkOf, PAPER, type FamilyInk } from "./encoding";
import { tileCenter } from "./geometry";
import styles from "./paper.module.css";

type Tone = "face" | "light" | "dark" | "die" | "ink" | "gold" | "glow" | "water" | "lava" | "dieShade";
interface Facet { d: string; tone: Tone; stroke?: boolean }

const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`;

// Each piece = 3–5 main facets (+ small ink details). What it depicts is the
// family's signature mechanism — see ENCODING "pop-up set-piece".
const PIECES: Record<string, Facet[][]> = {
  // lighthouse eye — perception: a tower whose lamp is an eye, beams out
  perception: [
    [{ d: "M36 -84 L2 -100 L2 -66 Z", tone: "glow" }, { d: "M64 -84 L98 -100 L98 -66 Z", tone: "glow" }],
    [{ d: "M36 0 L42 -72 L50 -72 L50 0 Z", tone: "light" }, { d: "M50 0 L50 -72 L58 -72 L64 0 Z", tone: "dark" }],
    [{ d: circle(50, -84, 15), tone: "die" }, { d: circle(50, -84, 8), tone: "face" }, { d: circle(51, -84, 3.6), tone: "ink" }],
    [{ d: "M34 -97 L50 -116 L66 -97 Z", tone: "dark" }],
  ],
  // clock tower — sequence: order and time steps
  sequence: [
    [{ d: "M30 0 L30 -70 L50 -70 L50 0 Z", tone: "light" }, { d: "M50 0 L50 -70 L70 -70 L70 0 Z", tone: "dark" }],
    [{ d: "M25 -70 L50 -104 L50 -70 Z", tone: "gold" }, { d: "M50 -70 L50 -104 L75 -70 Z", tone: "lava" }],
    [{ d: circle(50, -48, 13), tone: "die" }, { d: "M50 -48 L50 -58 M50 -48 L58 -44", tone: "ink", stroke: true }],
    [{ d: "M42 0 L42 -14 Q50 -22 58 -14 L58 0 Z", tone: "ink" }],
  ],
  // paper kiln / volcano — generative: puffs out samples
  generative: [
    [{ d: "M6 0 L40 -54 L50 -54 L50 0 Z", tone: "light" }, { d: "M50 0 L50 -54 L60 -54 L94 0 Z", tone: "dark" }],
    [{ d: "M40 -54 L60 -54 L55 -46 L45 -46 Z", tone: "lava" }],
    [{ d: circle(50, -70, 10), tone: "die" }],
    [{ d: circle(36, -86, 8), tone: "die" }],
    [{ d: circle(60, -100, 7), tone: "die" }],
  ],
  // twin mirror towers over a lake — representation: two views, one meaning
  representation: [
    [{ d: "M2 0 Q50 -16 98 0 Q50 16 2 0 Z", tone: "water" }],
    [{ d: "M20 -2 L20 -60 L29 -74 L38 -60 L38 -2 Z", tone: "light" }, { d: "M22 2 L36 2 L33 14 L25 14 Z", tone: "glow" }],
    [{ d: "M62 -2 L62 -60 L71 -74 L80 -60 L80 -2 Z", tone: "dark" }, { d: "M64 2 L78 2 L75 14 L67 14 Z", tone: "glow" }],
    [{ d: "M29 -44 Q50 -64 71 -44", tone: "gold", stroke: true }],
  ],
  // crystal lattice — structure: nodes and links
  structure: [
    [{ d: "M24 -46 L50 -84 L80 -42", tone: "die", stroke: true }],
    [{ d: "M50 0 L38 -42 L50 -84 Z", tone: "light" }, { d: "M50 0 L62 -42 L50 -84 Z", tone: "dark" }],
    [{ d: "M24 0 L14 -24 L24 -46 L33 -22 Z", tone: "face" }],
    [{ d: "M78 0 L70 -22 L80 -42 L90 -20 Z", tone: "face" }],
    [{ d: circle(24, -46, 4) + circle(50, -84, 4) + circle(80, -42, 4), tone: "ink" }],
  ],
  // dice keep — decision: choices under chance
  decision: [
    [{ d: "M24 0 L24 -54 L50 -54 L50 0 Z", tone: "light" }, { d: "M50 0 L50 -54 L76 -54 L76 0 Z", tone: "dark" },
      { d: "M42 0 L42 -16 Q50 -24 58 -16 L58 0 Z", tone: "ink" }],
    [{ d: "M22 -54 h9 v-9 h-9Z M38 -54 h9 v-9 h-9Z M53 -54 h9 v-9 h-9Z M69 -54 h9 v-9 h-9Z", tone: "dark" }],
    [{ d: "M50 -98 L67 -88 L50 -78 L33 -88 Z", tone: "die" }, { d: "M33 -88 L50 -78 L50 -60 L33 -70 Z", tone: "dieShade" },
      { d: "M50 -78 L67 -88 L67 -70 L50 -60 Z", tone: "dieShade" }],
    [{ d: circle(50, -88, 2.6) + circle(40, -76, 2.2) + circle(44, -70, 2.2) + circle(58, -78, 2.2) + circle(62, -70, 2.2), tone: "ink" }],
  ],
};

function toneFill(t: Tone, ink: FamilyInk): string {
  switch (t) {
    case "face": return ink.face;
    case "light": return ink.light;
    case "dark": return ink.dark;
    case "die": return PAPER.die;
    case "dieShade": return "#EADFC6";
    case "ink": return PAPER.ink;
    case "gold": return PAPER.gold;
    case "glow": return "#FFE89A";
    case "water": return PAPER.seaLight;
    case "lava": return PAPER.flag;
  }
}

/** Standing height of each piece in design units (for sign placement). */
export const PIECE_TOP: Record<string, number> = {
  perception: 116, sequence: 104, generative: 108, representation: 74, structure: 84, decision: 98,
};

/**
 * Free tile rows directly above a set-piece box (land only, no footprint,
 * road, river or label) — a tall piece may rise into them without covering
 * anything. Capped at 5 rows.
 */
function roomAbove(world: World, r: Region): number {
  const b = r.setPiece!;
  const { cols, tile, terrain } = world;
  let rows = 0;
  for (let k = 1; k <= 5; k++) {
    const y = b.y - k;
    if (y < 0) break;
    let ok = true;
    for (let x = b.x; x < b.x + b.w && ok; x++) {
      const t = terrain[y * cols + x];
      if (t !== T.LAND && t !== T.COAST) ok = false;
    }
    const rx = b.x * tile, ry = y * tile, rw = b.w * tile;
    if (ok && world.labels.some((l) => l.box.x < rx + rw && l.box.x + l.box.w > rx && l.box.y < ry + tile && l.box.y + l.box.h > ry)) ok = false;
    if (!ok) break;
    rows = k;
  }
  return rows;
}

/** Base-centre anchor and scale that keep the standing piece inside its box
 *  (plus any free rows above it). */
export function pieceAnchor(world: World, r: Region) {
  const b = r.setPiece!;
  const w = b.w * world.tile;
  const h = (b.h + roomAbove(world, r)) * world.tile - 8;
  const top = PIECE_TOP[r.family] ?? 110;
  // Height usually binds (boxes are square, pieces are tall): let the card
  // spread up to 1.3× wider than tall so it still fills the box width.
  const s = Math.min(w / 100, h / top);
  const sx = Math.min(w / 100, s * 1.3);
  return { x: (b.x + b.w / 2) * world.tile, y: (b.y + b.h) * world.tile - 6, s, sx };
}

export const SetPiece = memo(function SetPiece({ world, region, pop, still }: {
  world: World; region: Region; pop: number; still: boolean;
}) {
  const facets = PIECES[region.family];
  if (!region.setPiece || !facets) return null;
  const ink = inkOf(region.family);
  const { x, y, s, sx } = pieceAnchor(world, region);
  const rimW = 8 / s;
  const all = facets.flat();
  const animate = !still && pop > 0;
  const shape = (fc: Facet, key: string | number, fill: string, stroke: string | undefined, sw: number) =>
    fc.stroke
      ? <path key={key} d={fc.d} fill="none" stroke={stroke ?? fill} strokeWidth={sw + 5 / s} strokeLinecap="round" strokeLinejoin="round" />
      : <path key={key} d={fc.d} fill={fill} stroke={stroke} strokeWidth={stroke ? sw : undefined} strokeLinejoin="round" />;

  return (
    <g transform={`translate(${x} ${y}) scale(${sx} ${s})`} aria-hidden>
      {/* ground shadow on the land */}
      <ellipse cx={0} cy={1} rx={46} ry={7} fill={PAPER.shadow} />
      <g transform="translate(-50 0)">
        <g key={pop} className={animate ? styles.popup : undefined}>
          {/* cast shadow + card edge + die-cut rim, then the facets */}
          <g transform={`translate(${5 / s} ${3 / s})`}>{all.map((fc, i) => shape(fc, i, PAPER.shadow, PAPER.shadow, rimW))}</g>
          <g>{all.map((fc, i) => shape(fc, i, PAPER.die, PAPER.die, rimW))}</g>
          {facets.map((group, gi) => (
            <g key={gi} className={animate ? styles.flap : undefined}
              style={animate ? ({ animationDelay: `${180 + gi * 90}ms` } as CSSProperties) : undefined}>
              {group.map((fc, i) => fc.stroke
                ? <path key={i} d={fc.d} fill="none" stroke={toneFill(fc.tone, ink)} strokeWidth={4 / s + 2} strokeLinecap="round" strokeLinejoin="round" />
                : <path key={i} d={fc.d} fill={toneFill(fc.tone, ink)} />)}
              {/* felt: the family-coloured facets are knitted, the white/ink details stay card */}
              {group.filter((fc) => !fc.stroke && (fc.tone === "light" || fc.tone === "dark" || fc.tone === "face")).map((fc, i) => (
                <path key={`k${i}`} d={fc.d} fill="url(#paper-knit)" />
              ))}
            </g>
          ))}
        </g>
      </g>
    </g>
  );
});

// ── biome props on decor cells ──────────────────────────────────────────
// 12-unit design box, base at y = 0. Shape = family biome (ENCODING).
const PROPS: Record<string, (ink: FamilyInk) => Facet[]> = {
  perception: () => [{ d: circle(-2.5, -6, 5) + circle(3.5, -8, 4.2), tone: "dark" }, { d: circle(-3.5, -7.5, 2), tone: "light" }],
  sequence: () => [{ d: "M-6 0 L0 -15 L0 0 Z", tone: "light" }, { d: "M0 0 L0 -15 L6 0 Z", tone: "dark" }],
  generative: () => [{ d: "M-7 0 L-2 -8 L1 0 Z", tone: "light" }, { d: "M-2 -8 L6 0 L1 0 Z", tone: "dark" }],
  representation: () => [{ d: "M-4 0 Q-6 -8 -5 -14 M0 0 L0 -16 M4 0 Q6 -8 5 -13", tone: "dark", stroke: true }],
  structure: () => [{ d: "M0 0 L-4 -7 L0 -15 Z", tone: "light" }, { d: "M0 0 L4 -7 L0 -15 Z", tone: "dark" }],
  decision: () => [{ d: "M-5 0 L-2.5 -7 L2.5 -7 L5 0 Z", tone: "dark" }, { d: circle(0, -10, 3.4), tone: "light" }],
};

export const DecorLayer = memo(function DecorLayer({ world }: { world: World }) {
  // Half the decor cells (even variants) — enough to set the biome without
  // scattering props everywhere.
  const items = world.decor.filter((d) => d.variant % 2 === 0 && PROPS[d.region]);
  const rimmed = (key: string, fc: Facet, fill: string, w: number) =>
    fc.stroke
      ? <path key={key} d={fc.d} fill="none" stroke={fill} strokeWidth={w + 1.8} strokeLinecap="round" />
      : <path key={key} d={fc.d} fill={fill} stroke={w ? fill : undefined} strokeWidth={w || undefined} strokeLinejoin="round" />;
  return (
    <g aria-hidden>
      {items.map((d) => {
        const c = tileCenter(world, d.tile);
        const ink = inkOf(d.region);
        const fs = PROPS[d.region](ink);
        return (
          <g key={d.tile} transform={`translate(${c.x} ${c.y + 6}) scale(${d.scale})`}>
            <g transform="translate(1.5 2)">{fs.map((fc, i) => rimmed(`s${i}`, fc, PAPER.shadow, 3))}</g>
            {fs.map((fc, i) => rimmed(`r${i}`, fc, PAPER.die, 3))}
            {fs.map((fc, i) => rimmed(`f${i}`, fc, toneFill(fc.tone, ink), 0))}
          </g>
        );
      })}
    </g>
  );
});
