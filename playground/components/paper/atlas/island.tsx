"use client";

// Territory helpers for the single-continent map: an organic blob coastline
// generated deterministically (index/seed arithmetic — no Math.random, so SSG +
// hydration agree), plus per-territory terrain, border and label.
import type { ReactNode } from "react";
import { Bush, Flower, Hill, Mountain, Pine, Pond, Reed, Rock, Tree } from "./terrain";

export type IsleSpec = {
  fam: string; name: string; color: string; biome: string; landmark: string;
  cx: number; cy: number; rx: number; ry: number; seed: number;
};

// smooth closed blob around a wobbled ellipse
export function blobPath(cx: number, cy: number, rx: number, ry: number, seed: number): string {
  const N = 18;
  const pts: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const w = 1 + 0.1 * Math.sin(i * 1.7 + seed) + 0.06 * Math.cos(i * 2.9 + seed * 1.7);
    pts.push([cx + Math.cos(a) * rx * w, cy + Math.sin(a) * ry * w]);
  }
  const mid = (p: [number, number], q: [number, number]): [number, number] => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const m0 = mid(pts[N - 1], pts[0]);
  let d = `M ${m0[0]} ${m0[1]}`;
  for (let i = 0; i < N; i++) {
    const cur = pts[i], nxt = pts[(i + 1) % N], m = mid(cur, nxt);
    d += ` Q ${cur[0]} ${cur[1]} ${m[0]} ${m[1]}`;
  }
  return d + " Z";
}

// deterministic scatter around the island margins (polar offsets: [radius%, angle])
const SCATTER: [number, number][] = [
  [0.72, 2.4], [0.78, 3.9], [0.74, 5.3], [0.68, 0.6], [0.8, 1.5],
  [0.7, 3.2], [0.82, 4.7], [0.66, 5.9], [0.76, 0.95],
];

function biomeTerrain(is: IsleSpec): ReactNode[] {
  const out: ReactNode[] = [];
  if (is.biome === "wetland") out.push(<Pond key="pond" x={is.cx} y={is.cy + is.ry * 0.5} rx={is.rx * 0.26} ry={is.ry * 0.13} />);
  if (is.biome === "heath") out.push(<Pond key="pond" x={is.cx} y={is.cy + is.ry * 0.48} rx={is.rx * 0.28} ry={is.ry * 0.14} />);
  if (is.biome === "mesa") out.push(<Mountain key="mt" x={is.cx + is.rx * 0.5} y={is.cy - is.ry * 0.1} s={0.9} snow={false} />);
  SCATTER.forEach(([rr, aa], i) => {
    const x = is.cx + Math.cos(aa) * is.rx * rr;
    const y = is.cy + Math.sin(aa) * is.ry * rr;
    const el =
      is.biome === "meadow" ? (i % 3 === 0 ? <Flower x={x} y={y} hue="#c0522f" /> : i % 3 === 1 ? <Tree x={x} y={y} s={0.92} /> : <Bush x={x} y={y} />)
      : is.biome === "wetland" ? (i % 2 ? <Reed x={x} y={y} /> : <Bush x={x} y={y} />)
      : is.biome === "mesa" ? (i % 2 ? <Rock x={x} y={y} /> : <Hill x={x} y={y} s={0.7} />)
      : is.biome === "heath" ? (i % 2 ? <Flower x={x} y={y} hue="#6c6a9e" /> : <Bush x={x} y={y} />)
      : is.biome === "forest" ? <Pine x={x} y={y} s={0.9} />
      : (i % 2 ? <Pine x={x} y={y} s={1} /> : <Tree x={x} y={y} s={0.85} />);
    out.push(<g key={i}>{el}</g>);
  });
  return out;
}

// ——— ONE continent, not six islands ———
// Regions are drawn enlarged (LAND_SCALE) so neighbours overlap into a single
// connected landmass. beach/ground paths are exposed so the caller can render
// them as UNIONS (all beaches in one group under the union-outline filter → a
// single coastline; all grounds overlapping → a gap-free interior).
export const LAND_SCALE = 1.16;
export const BEACH_RIM = 24;

export const beachPathOf = (is: IsleSpec) =>
  blobPath(is.cx, is.cy, is.rx * LAND_SCALE, is.ry * LAND_SCALE, is.seed);
export const groundPathOf = (is: IsleSpec) =>
  blobPath(is.cx, is.cy, is.rx * LAND_SCALE - BEACH_RIM, is.ry * LAND_SCALE - BEACH_RIM, is.seed);

// a soft dashed territory boundary inside the continent
export function RegionBorder({ is }: { is: IsleSpec }) {
  return <path d={groundPathOf(is)} fill="none" stroke={is.color} strokeWidth={1.6} strokeDasharray="6 7" opacity={0.4} />;
}

export function IslandTerrain({ is }: { is: IsleSpec }) {
  return <g>{biomeTerrain(is)}</g>;
}

export function IslandLabel({ is }: { is: IsleSpec }) {
  return (
    <text x={is.cx} y={is.cy - is.ry - 12} textAnchor="middle" fontFamily="var(--font-display)"
      fontSize={20} fontWeight={800} letterSpacing="0.14em" fill={is.color}
      style={{ paintOrder: "stroke", textTransform: "uppercase" }}
      stroke="#dfeaea" strokeWidth={5} strokeLinejoin="round">
      {is.name}
    </text>
  );
}
