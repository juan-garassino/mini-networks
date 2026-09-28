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

/** A tile the set-piece may grow over: land, coast or open sea — never a
 *  spot, road, bridge, river, another set-piece or a name tag. */
function freeTile(world: World, x: number, y: number, own: Region): boolean {
  const { cols, rows, tile, terrain } = world;
  if (x < 0 || y < 0 || x >= cols || y >= rows) return false;
  const t = terrain[y * cols + x];
  if (t !== T.LAND && t !== T.COAST && t !== T.SEA && !(t === T.SETPIECE && inBox(own, x, y))) return false;
  const rx = x * tile, ry = y * tile;
  return !world.labels.some((l) => l.box.x < rx + tile && l.box.x + l.box.w > rx && l.box.y < ry + tile && l.box.y + l.box.h > ry);
}
const inBox = (r: Region, x: number, y: number) => {
  const b = r.setPiece!;
  return x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
};

/** Free rows above and symmetric free columns beside a set-piece box. */
function room(world: World, r: Region) {
  const b = r.setPiece!;
  let up = 0;
  for (let k = 1; k <= 4; k++) {
    let ok = true;
    for (let x = b.x; x < b.x + b.w && ok; x++) ok = freeTile(world, x, b.y - k, r);
    if (!ok) break;
    up = k;
  }
  let side = 0;
  for (let k = 1; k <= 2; k++) {
    let ok = true;
    for (let y = b.y - up; y < b.y + b.h && ok; y++) ok = freeTile(world, b.x - k, y, r) && freeTile(world, b.x + b.w - 1 + k, y, r);
    if (!ok) break;
    side = k;
  }
  return { up, side };
}

/** Base-centre anchor and scale. The piece grows into free margin (rows above,
 *  columns beside — land or sea, never onto a spot, road or tag), up to 1.6×
 *  what its own box allows. */
export function pieceAnchor(world: World, r: Region) {
  const b = r.setPiece!;
  const tile = world.tile;
  const top = PIECE_TOP[r.family] ?? 110;
  const s0 = Math.min((b.w * tile) / 100, (b.h * tile - 8) / top);
  const { up, side } = room(world, r);
  const w = (b.w + side * 2) * tile;
  const h = (b.h + up) * tile - 8;
  const s = Math.min(w / 100, h / top, s0 * 1.6);
  // pieces are tall: let the card spread up to 1.3× wider than tall
  const sx = Math.min(w / 100, s * 1.3);
  return { x: (b.x + b.w / 2) * tile, y: (b.y + b.h) * tile - 6, s, sx };
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
// 12-unit design box, base at y = 0. Each biome prop is a tiny echo of its
// family's set-piece mechanism (ENCODING "small paper props").
const PROPS: Record<string, Facet[]> = {
  // eye-flower: perception looks
  perception: [{ d: "M0 0 Q-1 -5 0 -9", tone: "dark", stroke: true }, { d: circle(0, -11, 4), tone: "dark" }, { d: circle(0.6, -11, 1.7), tone: "light" }],
  // token train: sequence reads one token after another
  sequence: [{ d: "M-9 0 h5 v-5 h-5Z M-2.5 0 h5 v-5 h-5Z M4 0 h5 v-5 h-5Z", tone: "dark" }],
  // sample puff: generative makes new samples
  generative: [{ d: circle(-3.5, -5, 3.6) + circle(2, -7, 4.4) + circle(5.5, -3.5, 3), tone: "light" }],
  // mirrored reeds on a pond: representation pairs two views
  representation: [{ d: "M-8 0 Q0 -3 8 0 Q0 3 -8 0Z", tone: "light" }, { d: "M-3 -1 Q-4 -7 -2 -13 M3 -1 Q4 -7 2 -13", tone: "dark", stroke: true }],
  // linked shards: structure is nodes and links
  structure: [{ d: "M-5 -3 L4 -10", tone: "dark", stroke: true }, { d: "M-5 0 L-8 -4 L-5 -8 L-2 -4Z", tone: "light" }, { d: "M4 -6 L1 -10 L4 -14 L7 -10Z", tone: "dark" }],
  // a die: decision is choice under chance
  decision: [{ d: "M-5 0 h10 v-10 h-10Z", tone: "dark" }, { d: circle(-2.2, -7.5, 1.1) + circle(0, -5, 1.1) + circle(2.2, -2.5, 1.1), tone: "light" }],
};

export const DecorLayer = memo(function DecorLayer({ world }: { world: World }) {
  // Every world.decor cell gets its family's prop; variant is not drawn.
  const items = world.decor.filter((d) => PROPS[d.region]);
  const rimmed = (key: string, fc: Facet, fill: string, w: number) =>
    fc.stroke
      ? <path key={key} d={fc.d} fill="none" stroke={fill} strokeWidth={w + 1.8} strokeLinecap="round" />
      : <path key={key} d={fc.d} fill={fill} stroke={w ? fill : undefined} strokeWidth={w || undefined} strokeLinejoin="round" />;
  return (
    <g aria-hidden>
      {items.map((d) => {
        const c = tileCenter(world, d.tile);
        const ink = inkOf(d.region);
        const fs = PROPS[d.region];
        return (
          <g key={d.tile} transform={`translate(${c.x} ${c.y + 6}) scale(${d.scale})`}>
            {/* quiet: tone-on-tone with a hairline-free thin rim, so the biome reads
                without competing with spots */}
            {fs.map((fc, i) => rimmed(`r${i}`, fc, "rgba(255,253,246,0.55)", 1.6))}
            {fs.map((fc, i) => rimmed(`f${i}`, fc, toneFill(fc.tone, ink), 0))}
          </g>
        );
      })}
    </g>
  );
});
