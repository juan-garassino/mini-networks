"use client";

import { motion } from "motion/react";
import type { TaxonModel, TaxonomyResponse } from "@/lib/types";
import { ATOMS, FAMILY_BLOCKS, PLACEMENT, symbolFor } from "@/lib/blueprint";
import { AtlasDefs } from "@/components/paper/atlas/defs";
import { beachPathOf, groundPathOf, IslandLabel, IslandTerrain, RegionBorder, type IsleSpec } from "@/components/paper/atlas/island";
import { Landmark } from "@/components/paper/atlas/landmarks";
import { BorderFrame, CompassRose, Galleon, ScaleBar, ScrollBanner, SeaSerpent } from "@/components/paper/atlas/furniture";

// Edition 5: "The mini_networks Overworld" — ONE continent, not an archipelago.
// The six families are territories WITHIN a single landmass (soft dashed
// borders, not sea between them); the continent has one coastline. Species are
// hex waypoints on grid roads that fill each territory; compositions are land
// trails. Membership from the authored PLACEMENT/FAMILY_BLOCKS. Deterministic.
const VB_W = 1500;
const VB_H = 1080;
const INK = "#3a2d20";

// Territory centres/sizes tuned so their enlarged (LAND_SCALE) blobs overlap
// into one connected continent, with Structure as the central land-bridge.
const ISLES: IsleSpec[] = [
  { fam: "perception", name: "Perception Meadows", color: "#3f6f3f", biome: "meadow", landmark: "observatory", cx: 400, cy: 400, rx: 300, ry: 235, seed: 1 },
  { fam: "sequence", name: "Sequence Wetlands", color: "#356470", biome: "wetland", landmark: "clock", cx: 1085, cy: 385, rx: 285, ry: 226, seed: 2 },
  { fam: "structure", name: "Woven Marches", color: "#9c6b28", biome: "forest", landmark: "lattice", cx: 748, cy: 548, rx: 122, ry: 108, seed: 3 },
  { fam: "generative", name: "Generative Mesa", color: "#a53c22", biome: "mesa", landmark: "kiln", cx: 1132, cy: 800, rx: 226, ry: 190, seed: 4 },
  { fam: "decision", name: "Crossroads Pines", color: "#356e6a", biome: "pines", landmark: "signpost", cx: 792, cy: 850, rx: 236, ry: 176, seed: 5 },
  { fam: "representation", name: "Mirror Heath", color: "#524f83", biome: "heath", landmark: "mirrors", cx: 360, cy: 828, rx: 208, ry: 176, seed: 6 },
];

const blockForCol = (col: number) =>
  FAMILY_BLOCKS.find((b) => col >= b.cols[0] && col <= b.cols[1])?.family ?? "structure";
const familyForName = (name: string) => {
  const col = PLACEMENT[name]?.col;
  if (col != null) return blockForCol(col);
  return ATOMS[name]?.family ?? "structure";
};

const hex = (cx: number, cy: number, r: number) =>
  [0, 1, 2, 3, 4, 5].map((k) => {
    const a = ((60 * k - 90) * Math.PI) / 180;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(" ");

export function ChartPaper({
  taxonomy, onSelect,
}: {
  taxonomy: TaxonomyResponse | null;
  onSelect: (name: string) => void;
}) {
  if (!taxonomy) return null;
  const rowCol = (n: string) => PLACEMENT[n] ?? { row: 9, col: 9 };

  // spread each territory's members across a grid that fills its footprint
  const pos = new Map<string, { x: number; y: number; m: TaxonModel; fam: string }>();
  const roads: Record<string, string> = {};
  const landmarkAt: Record<string, [number, number]> = {};
  for (const is of ISLES) {
    const ms = taxonomy.models
      .filter((m) => familyForName(m.name) === is.fam)
      .sort((a, b) => rowCol(a.name).row - rowCol(b.name).row || rowCol(a.name).col - rowCol(b.name).col);
    const n = ms.length;
    const usableW = is.rx * 1.5;
    const usableH = is.ry * 1.16;
    const cols = Math.max(1, Math.round(Math.sqrt((n * usableW) / usableH)));
    const rows = Math.max(1, Math.ceil(n / cols));
    const cStep = usableW / cols;
    const rStep = usableH / rows;
    const fieldCx = is.cx;
    const fieldCy = is.cy + is.ry * 0.2;
    const x0 = fieldCx - usableW / 2 + cStep / 2;
    const y0 = fieldCy - usableH / 2 + rStep / 2;
    landmarkAt[is.fam] = [is.cx, y0 - rStep * 0.55 - is.ry * 0.12];
    const pts: [number, number][] = [];
    ms.forEach((m, k) => {
      const row = Math.floor(k / cols);
      const inRow = row === rows - 1 ? n - row * cols : cols;
      const cRaw = k % cols;
      const col = row % 2 === 0 ? cRaw : inRow - 1 - cRaw;
      const rowOffset = ((cols - inRow) * cStep) / 2;
      const x = x0 + col * cStep + rowOffset;
      const y = y0 + row * rStep;
      pos.set(m.name, { x, y, m, fam: is.fam });
      pts.push([x, y]);
    });
    roads[is.fam] = pts.map((p, i) => {
      if (i === 0) return `M ${p[0]} ${p[1]}`;
      const a = pts[i - 1];
      return `L ${p[0]} ${a[1]} L ${p[0]} ${p[1]}`;
    }).join(" ");
  }

  // compositions → orthogonal LAND trails between the territories they link
  const trails = taxonomy.compositions.flatMap((c, ci) => {
    const stops = c.composes.map((n) => pos.get(n)).filter(Boolean) as { x: number; y: number }[];
    if (stops.length < 2) return [];
    let d = `M ${stops[0].x} ${stops[0].y}`;
    for (let i = 1; i < stops.length; i++) {
      const a = stops[i - 1], b = stops[i];
      d += (ci + i) % 2 === 0 ? ` L ${b.x} ${a.y} L ${b.x} ${b.y}` : ` L ${a.x} ${b.y} L ${b.x} ${b.y}`;
    }
    const color = ISLES.find((r) => r.fam === pos.get(c.composes[0])?.fam)?.color ?? "#4a6a70";
    return [{ d, color, name: c.name, composes: c.composes }];
  });

  const beachPaths = ISLES.map(beachPathOf);
  const groundPaths = ISLES.map(groundPathOf);

  return (
    <div className="h-full overflow-auto p-2 sm:p-3">
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="mx-auto block h-auto w-full max-w-[1560px]"
        style={{ fontFamily: "var(--font-draft), cursive" }}>
        <AtlasDefs />
        <clipPath id="a-land">
          {groundPaths.map((d, i) => <path key={i} d={d} />)}
        </clipPath>

        {/* ——— sea ——— */}
        <rect x={0} y={0} width={VB_W} height={VB_H} fill="url(#a-sea)" />
        <rect x={0} y={0} width={VB_W} height={VB_H} fill="url(#a-waves)" />
        <rect x={0} y={0} width={VB_W} height={VB_H} fill="url(#a-weave)" />

        {/* ——— ONE continent: union coastline + beach, then territory grounds ——— */}
        <g filter="url(#a-shadow)">
          <g filter="url(#a-outline)">
            {beachPaths.map((d, i) => <path key={i} d={d} fill="url(#a-sand)" />)}
          </g>
        </g>
        {ISLES.map((is, i) => <path key={is.fam} d={groundPaths[i]} fill={`url(#a-ground-${is.biome})`} />)}
        <rect x={0} y={0} width={VB_W} height={VB_H} fill="url(#a-weave)" clipPath="url(#a-land)" />
        {ISLES.map((is) => <RegionBorder key={is.fam} is={is} />)}

        {/* territory terrain (kept within each territory core) */}
        {ISLES.map((is) => <IslandTerrain key={is.fam} is={is} />)}

        {/* composition trails across the land */}
        {trails.map((t, i) => (
          <path key={i} className="map-route" d={t.d} fill="none" stroke={t.color}
            strokeWidth={1.8} strokeDasharray="2 8" strokeLinecap="round" opacity={0.5}
            onClick={() => onSelect(t.name)}>
            <title>{t.name.replace(/_/g, " ")} — {t.composes.join(" + ")}</title>
          </path>
        ))}

        {/* landmarks + lineage roads + labels */}
        {ISLES.map((is) => (
          <g key={is.fam}>
            <Landmark kind={is.landmark} x={landmarkAt[is.fam][0]} y={landmarkAt[is.fam][1]} />
            <path d={roads[is.fam]} fill="none" stroke="#a8763095" strokeWidth={16} strokeLinejoin="round" strokeLinecap="round" filter="url(#a-shadow-sm)" />
            <path d={roads[is.fam]} fill="none" stroke="#c99a4e" strokeWidth={11} strokeLinejoin="round" strokeLinecap="round" />
            <path d={roads[is.fam]} fill="none" stroke="#eac986" strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />
            <IslandLabel is={is} />
          </g>
        ))}

        {/* ——— towns ——— */}
        {[...pos.values()].map(({ x, y, m, fam }) => {
          const color = ISLES.find((r) => r.fam === fam)!.color;
          const elem = m.level === "elementary";
          const label = m.name.replace(/_/g, " ");
          return (
            <g key={m.name} className="map-town" onClick={() => onSelect(m.name)}>
              <title>{label}</title>
              <polygon points={hex(x, y, 22)} fill={INK} opacity={0.18} transform="translate(0 4)" />
              <polygon className="map-town-dot" points={hex(x, y, 22)} fill={elem ? color : "#f3ecd8"} stroke={INK} strokeWidth={2.4} />
              <polygon points={hex(x, y - 1, 17)} fill="none" stroke={elem ? "rgba(255,255,255,0.45)" : color} strokeWidth={elem ? 1.6 : 2.6} />
              <text x={x} y={y + 5.5} textAnchor="middle" fontFamily="var(--font-display)" fontSize={15} fontWeight={800} fill={elem ? "#fff" : color}>
                {ATOMS[m.name]?.symbol ?? symbolFor(m.name)}
              </text>
              <text x={x} y={y + 39} textAnchor="middle" fontSize={12.5} fill={INK}
                style={{ paintOrder: "stroke" }} stroke="#f4efe0" strokeWidth={3.4} strokeLinejoin="round">
                {label.length > 17 ? label.slice(0, 16) + "…" : label}
              </text>
            </g>
          );
        })}

        {/* drifting clouds in the surrounding sea */}
        {[[760, 84, 1.1, 30, 42], [130, 96, 0.85, 24, 46], [1400, 250, 0.95, -24, 50], [90, 560, 0.8, 20, 48], [1420, 980, 0.9, -22, 52]].map(([cx, cy, s, dr, du], i) => (
          <motion.g key={i} animate={{ x: [0, dr as number, 0] }} transition={{ duration: du as number, repeat: Infinity, ease: "easeInOut" }} opacity={0.9}>
            <g transform={`translate(${cx} ${cy}) scale(${s})`} filter="url(#a-shadow-sm)">
              <path d="M0 14 Q-5 0 12 0 Q16 -14 34 -7 Q50 -16 60 0 Q76 0 70 14 Z" fill="#f4f0e6" stroke="#d8cdb4" strokeWidth={2} strokeLinejoin="round" />
            </g>
          </motion.g>
        ))}

        {/* ——— map furniture (on the surrounding sea) ——— */}
        <SeaSerpent x={1120} y={92} />
        <ScrollBanner x={44} y={30} models={taxonomy.models.length} comps={taxonomy.compositions.length} />
        <CompassRose x={92} y={VB_H - 96} r={58} />
        <Galleon x={840} y={96} />
        <ScaleBar x={VB_W - 172} y={VB_H - 44} />

        <BorderFrame w={VB_W} h={VB_H} />
        <rect x={0} y={0} width={VB_W} height={VB_H} filter="url(#a-grain)" opacity={0.05} pointerEvents="none" />
      </svg>
    </div>
  );
}
