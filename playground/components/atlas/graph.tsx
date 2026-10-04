"use client";

// The constellation itself: translucent region fields, a hairline relationship
// web (derives-from + combine), concept satellites, and nodes sized by role.
// Hover dims everything except a node's neighbourhood; click selects.
import { useMemo, useState } from "react";
import type { AtlasEdge, AtlasLayout, AtlasNode } from "./layout";
import { CONCEPT_R } from "./layout";
import { ATLAS_INK, ATLAS_INK_DIM, HUB_INK, REGION_BY_KEY } from "./theme";

// gentle quadratic bow from a to b; `stop` trims the end so an arrowhead lands
// on the parent's rim instead of inside its disc
function edgePath(a: AtlasNode, b: AtlasNode, stop = 0): string {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const nx = -(b.y - a.y), ny = b.x - a.x;
  const len = Math.hypot(nx, ny) || 1;
  const bow = Math.min(60, len * 0.12);
  const qx = mx + (nx / len) * bow, qy = my + (ny / len) * bow;
  const tx = b.x - qx, ty = b.y - qy, tl = Math.hypot(tx, ty) || 1;
  return `M ${a.x} ${a.y} Q ${qx} ${qy} ${b.x - (tx / tl) * stop} ${b.y - (ty / tl) * stop}`;
}

// region "field" — a soft blob hull around the region centre
function fieldPath(cx: number, cy: number, r: number, seed: number): string {
  const N = 14;
  const pts: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const w = 1 + 0.06 * Math.sin(i * 1.6 + seed) + 0.04 * Math.cos(i * 2.7 + seed);
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

type Label = { x: number; y: number; anchor: "start" | "end" | "middle"; size: number; atom: boolean };

// Deterministic label placement: each name tries the side facing away from its
// field's centre, then the other side, then above, then below, and takes the
// first spot that clears every node disc and every label already placed.
// Widths are estimated from the face (Cormorant bold ≈ .5em, Jost ≈ .55em).
function placeLabels(layout: AtlasLayout): Map<string, Label> {
  const boxes: { x0: number; y0: number; x1: number; y1: number }[] = [];
  const out = new Map<string, Label>();
  const hits = (b: { x0: number; y0: number; x1: number; y1: number }, self: string) =>
    boxes.some((o) => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0) ||
    layout.nodes.some((n) => n.name !== self &&
      n.x + n.r + 2 > b.x0 && n.x - n.r - 2 < b.x1 && n.y + n.r + 2 > b.y0 && n.y - n.r - 2 < b.y1);
  // big nodes first so atoms keep their preferred spots
  const order = [...layout.nodes].sort((a, b) => b.r - a.r || a.name.localeCompare(b.name));
  for (const n of order) {
    const isHub = n.kind === "hub";
    const ringed = isHub || n.kind === "milestone";
    const atom = n.level === "elementary";
    const size = isHub ? 17 : atom ? 14 : 10.5;
    const w = n.name.length * size * (atom ? 0.5 : 0.55);
    const gap = n.r + (ringed ? 9 : 5);
    const f = layout.fields.find((x) => x.key === n.region);
    const preferLeft = !isHub && f ? n.x < f.cx - 4 : false;
    const side = (left: boolean): Label => ({ x: left ? n.x - gap : n.x + gap, y: n.y + size * 0.32, anchor: left ? "end" : "start", size, atom });
    const tries: Label[] = [
      side(preferLeft), side(!preferLeft),
      { x: n.x, y: n.y - gap - 3, anchor: "middle", size, atom },
      { x: n.x, y: n.y + gap + size * 0.75, anchor: "middle", size, atom },
    ];
    const box = (l: Label) => {
      const x0 = l.anchor === "start" ? l.x : l.anchor === "end" ? l.x - w : l.x - w / 2;
      return { x0, y0: l.y - size * 0.78, x1: x0 + w, y1: l.y + size * 0.22 };
    };
    const pick = tries.find((l) => !hits(box(l), n.name)) ?? tries[0];
    boxes.push(box(pick));
    out.set(n.name, pick);
  }
  return out;
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

  const labels = useMemo(() => placeLabels(layout), [layout]);
  const dim = (name: string) => (near && !near.has(name) ? 0.16 : 1);
  const edgeLit = (e: AtlasEdge) => !near || near.has(e.from) && near.has(e.to);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" onClick={() => onSelect(null)}
      style={{ fontFamily: "var(--font-jost), sans-serif" }}>
      <defs>
        <marker id="atl-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill={HUB_INK} />
        </marker>
        <marker id="atl-arrow-dim" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill={ATLAS_INK_DIM} />
        </marker>
      </defs>

      {/* region fields (fitted around the family's members) + names */}
      {layout.fields.map((f, i) => {
        const reg = REGION_BY_KEY[f.key];
        const lit = !focus || layout.nodes.some((n) => n.region === f.key && near?.has(n.name));
        return (
          <g key={f.key} opacity={lit ? 1 : 0.4}>
            <path d={fieldPath(f.cx, f.cy, f.r, i + 1)} fill={reg.color} opacity={0.075} />
            <path d={fieldPath(f.cx, f.cy, f.r, i + 1)} fill="none" stroke={reg.color} strokeWidth={1} strokeDasharray="2 6" opacity={0.4} />
            <text x={f.cx} y={f.cy - f.r * 1.06 - 16} textAnchor="middle" fontSize={16} fontWeight={600}
              letterSpacing="0.2em" fill={reg.color} style={{ textTransform: "uppercase" }}>{reg.name}</text>
            <text x={f.cx} y={f.cy - f.r * 1.06 - 3} textAnchor="middle" fontSize={9.5} letterSpacing="0.12em"
              fill={reg.color} opacity={0.75}>{reg.tagline}</text>
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
          return <path key={i} d={edgePath(a, b, b.r + 3)} stroke={e.hub ? HUB_INK : ATLAS_INK_DIM}
            strokeWidth={e.hub ? 1.1 : 0.85} opacity={lit ? (e.hub ? 0.66 : 0.5) : 0.05}
            markerEnd={e.hub ? "url(#atl-arrow)" : "url(#atl-arrow-dim)"} />;
        })}
      </g>

      {/* concept satellites */}
      <g>
        {layout.concepts.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r={CONCEPT_R} fill={c.color} opacity={near && !near.has(c.home) ? 0.08 : 0.5} />
        ))}
      </g>

      {/* nodes — every model labelled, positions from placeLabels() */}
      {layout.nodes.map((n) => {
        const isHub = n.kind === "hub";
        const isMile = n.kind === "milestone";
        const fill = isHub ? HUB_INK : n.color;
        const op = dim(n.name);
        const sel = selected === n.name;
        const ringed = isHub || isMile;
        const lab = labels.get(n.name)!;
        return (
          <g key={n.name} data-atlas-node={n.name} opacity={op} style={{ cursor: "pointer", outline: "none" }}
            role="button" tabIndex={0} aria-label={`${n.name.replace(/_/g, " ")}, ${n.level} model`}
            onMouseEnter={() => setHover(n.name)} onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(n.name)} onBlur={() => setHover(null)}
            onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onSelect(n.name); } }}
            onClick={(ev) => { ev.stopPropagation(); onSelect(n.name); }}>
            <circle cx={n.x} cy={n.y} r={n.r + 10} fill="transparent" />
            {ringed && <circle cx={n.x} cy={n.y} r={n.r + 4.5} fill="none" stroke={fill} strokeWidth={1.3} opacity={0.55} />}
            {(sel || hover === n.name) && <circle cx={n.x} cy={n.y} r={n.r + (ringed ? 10 : 6)} fill="none" stroke={fill} strokeWidth={1.2} strokeDasharray="2 3" opacity={sel ? 1 : 0.6} />}
            <circle cx={n.x} cy={n.y} r={n.r} fill={fill} stroke="#f4f0e6" strokeWidth={1.4} />
            <text x={lab.x} y={lab.y} textAnchor={lab.anchor}
              fontSize={lab.size} fontWeight={lab.atom ? 700 : 500} fill={ATLAS_INK}
              stroke="#f2eee3" strokeWidth={3} strokeLinejoin="round" paintOrder="stroke"
              style={{ fontFamily: lab.atom ? "var(--font-cormorant), serif" : "var(--font-jost), sans-serif" }}>
              {n.name.replace(/_/g, " ")}
            </text>
          </g>
        );
      })}

    </svg>
  );
}
