"use client";

// The constellation itself: translucent region fields, a hairline relationship
// web (derives-from + combine), concept satellites, and nodes sized by role.
// Hover dims everything except a node's neighbourhood; click selects.
import { useMemo, useState } from "react";
import type { AtlasEdge, AtlasLayout, AtlasNode } from "./layout";
import { CONCEPT_R } from "./layout";
import { ATLAS_INK, ATLAS_INK_DIM, HUB_INK, REGIONS } from "./theme";

function edgePath(a: AtlasNode, b: AtlasNode): string {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const nx = -(b.y - a.y), ny = b.x - a.x;
  const len = Math.hypot(nx, ny) || 1;
  const bow = Math.min(60, len * 0.12);
  return `M ${a.x} ${a.y} Q ${mx + (nx / len) * bow} ${my + (ny / len) * bow} ${b.x} ${b.y}`;
}

// region "field" — a soft blob hull around the region centre
function fieldPath(cx: number, cy: number, r: number, seed: number): string {
  const N = 14;
  const pts: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const w = 1 + 0.16 * Math.sin(i * 1.6 + seed) + 0.1 * Math.cos(i * 2.7 + seed);
    pts.push([cx + Math.cos(a) * r * w, cy + Math.sin(a) * r * w]);
  }
  const mid = (p: [number, number], q: [number, number]): [number, number] => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  let d = `M ${mid(pts[N - 1], pts[0])[0]} ${mid(pts[N - 1], pts[0])[1]}`;
  for (let i = 0; i < N; i++) {
    const c = pts[i], n = pts[(i + 1) % N], m = mid(c, n);
    d += ` Q ${c[0]} ${c[1]} ${m[0]} ${m[1]}`;
  }
  return d + " Z";
}

export function AtlasGraph({
  layout, W, H, selected, onSelect,
}: {
  layout: AtlasLayout; W: number; H: number;
  selected: string | null; onSelect: (n: string | null) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const focus = hover ?? selected;
  const near = useMemo(() => {
    if (!focus) return null;
    const s = new Set<string>([focus]);
    layout.adj.get(focus)?.forEach((n) => s.add(n));
    return s;
  }, [focus, layout]);

  const dim = (name: string) => (near && !near.has(name) ? 0.16 : 1);
  const edgeLit = (e: AtlasEdge) => !near || near.has(e.from) && near.has(e.to);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" onClick={() => onSelect(null)}
      style={{ fontFamily: "var(--font-jost), sans-serif" }}>
      <defs>
        <marker id="atl-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill={HUB_INK} />
        </marker>
        <filter id="atl-grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.5 0" /></filter>
      </defs>

      {/* region fields + names */}
      {REGIONS.map((reg, i) => {
        const cx = reg.cx * W, cy = reg.cy * H, r = reg.r * Math.min(W, H) * 1.25;
        const lit = !focus || layout.nodes.some((n) => n.region === reg.key && near?.has(n.name));
        return (
          <g key={reg.key} opacity={lit ? 1 : 0.4}>
            <path d={fieldPath(cx, cy, r, i + 1)} fill={reg.color} opacity={0.07} />
            <path d={fieldPath(cx, cy, r, i + 1)} fill="none" stroke={reg.color} strokeWidth={1} strokeDasharray="2 6" opacity={0.35} />
            <text x={cx} y={cy - r + 4} textAnchor="middle" fontSize={17} fontWeight={700}
              letterSpacing="0.18em" fill={reg.color} opacity={0.9}
              style={{ textTransform: "uppercase" }}>{reg.name}</text>
            <text x={cx} y={cy - r + 20} textAnchor="middle" fontSize={9} letterSpacing="0.14em"
              fill={reg.color} opacity={0.6} style={{ textTransform: "uppercase" }}>{reg.tagline}</text>
          </g>
        );
      })}

      {/* edges */}
      <g fill="none">
        {layout.edges.map((e, i) => {
          const a = layout.byName.get(e.from)!, b = layout.byName.get(e.to)!;
          const lit = edgeLit(e);
          if (e.type === "combine") {
            return <path key={i} d={edgePath(a, b)} stroke={a.color} strokeWidth={0.8}
              strokeDasharray="1.5 5" opacity={lit ? 0.4 : 0.05} />;
          }
          return <path key={i} d={edgePath(a, b)} stroke={e.hub ? HUB_INK : ATLAS_INK_DIM}
            strokeWidth={e.hub ? 1.1 : 0.8} opacity={lit ? (e.hub ? 0.7 : 0.42) : 0.05}
            markerEnd={e.hub ? "url(#atl-arrow)" : undefined} />;
        })}
      </g>

      {/* concept satellites */}
      <g>
        {layout.concepts.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r={CONCEPT_R} fill={c.color} opacity={near && !near.has(c.home) ? 0.08 : 0.5} />
        ))}
      </g>

      {/* nodes */}
      {layout.nodes.map((n) => {
        const isHub = n.kind === "hub";
        const isMile = n.kind === "milestone";
        const fill = isHub ? HUB_INK : n.color;
        const op = dim(n.name);
        const sel = selected === n.name;
        return (
          <g key={n.name} opacity={op} style={{ cursor: "pointer" }}
            onMouseEnter={() => setHover(n.name)} onMouseLeave={() => setHover(null)}
            onClick={(ev) => { ev.stopPropagation(); onSelect(n.name); }}>
            {(isMile || isHub) && <circle cx={n.x} cy={n.y} r={n.r + 4.5} fill="none" stroke={fill} strokeWidth={1.3} opacity={0.55} />}
            {sel && <circle cx={n.x} cy={n.y} r={n.r + 9} fill="none" stroke={fill} strokeWidth={1.2} strokeDasharray="2 3" />}
            <circle cx={n.x} cy={n.y} r={n.r} fill={fill} stroke="#f4f0e6" strokeWidth={1.4} />
            {(isHub || isMile || n.r >= 8 || focus === n.name) && (
              <text x={n.x + n.r + 5} y={n.y + 4} fontSize={isHub ? 15 : isMile ? 12 : 10.5}
                fontWeight={isHub || isMile ? 700 : 500} fill={ATLAS_INK}
                style={{ fontFamily: isHub || isMile ? "var(--font-cormorant), serif" : "var(--font-jost), sans-serif" }}>
                {n.name.replace(/_/g, " ")}
              </text>
            )}
          </g>
        );
      })}

      <rect x={0} y={0} width={W} height={H} filter="url(#atl-grain)" opacity={0.04} pointerEvents="none" />
    </svg>
  );
}
