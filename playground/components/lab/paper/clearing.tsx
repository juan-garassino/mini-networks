"use client";

// The REGION view as a scene (owner reference, 2026-09-29): entering a family
// steps you into its biome clearing. Giant paper canopies frame every edge and
// corner, a glowing clearing is the stage, the family's models stand on paper
// stepping-stone discs joined by the lineage path of stones, each atom's
// landmark stands at its place, and cross-family links leave the clearing
// through the trees to a signpost naming the other family.
//
// Positions: every member's place is its WORLD position (lib/world) mapped by
// one smooth, order-preserving squash of the family's bounding box into the
// clearing ellipse; roads use the same map. Nothing is invented — only
// stylised. Design space: H = 900 units tall, W = 900·aspect (so it fills any
// viewport; 1 unit = vh/900 px).
import { memo, useMemo, type ReactNode } from "react";
import { samplePolyline, type Pt, type World, type WorldNode } from "@/lib/world";
import { iconFor } from "@/lib/icons";
import { displayName, type EvidenceState } from "@/components/lab/shared/card-model";
import {
  AtomLandmark, BasaltRocks, CrystalCluster, familyRamp, Flower, HI, LIT, MID, Palm, R, SHADE, DEEP, SignBoard, Tuft, type Ramp,
} from "./art";
import { familyName, PAPER } from "./encoding";

export const SCENE_H = 900;

// ── deterministic hash noise ────────────────────────────────────────────
const hash = (a: number, b: number) => {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1);
  h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13;
  return ((h >>> 0) % 10000) / 10000;
};

// ── biome of each family's clearing ──────────────────────────────────────
type TreeKind = "round" | "palm" | "puff" | "pine" | "crystal" | "acacia";
interface Biome {
  tree: TreeKind;
  canopy: Ramp;          // canopy ramp (hi lit mid shade deep)
  floor: string;         // deep forest floor between trees
  glow: [string, string]; // clearing centre → edge
  stone: [string, string]; // stepping stone top, side
}
const BIOMES: Record<string, Biome> = {
  perception:     { tree: "round",   canopy: R.leaf,   floor: "#10392E", glow: ["#E4F57A", "#9CCB45"], stone: ["#F2C27A", "#C98F4A"] },
  sequence:       { tree: "palm",    canopy: R.leaf,   floor: "#6B4526", glow: ["#FFF0B8", "#E8BF62"], stone: ["#FFE6A6", "#C79450"] },
  generative:     { tree: "puff",    canopy: R.violet, floor: "#2A1F3D", glow: ["#E9D8FF", "#A98BD8"], stone: ["#8B8C9E", "#4A4B61"] },
  representation: { tree: "pine",    canopy: R.pine,   floor: "#12394A", glow: ["#F2FAFF", "#B9DCEB"], stone: ["#DCE9F7", "#8EA3C4"] },
  structure:      { tree: "crystal", canopy: R.pink,   floor: "#3A1F35", glow: ["#FFE3F0", "#E6A2C7"], stone: ["#FFC7DE", "#C2407E"] },
  decision:       { tree: "acacia",  canopy: R.lime,   floor: "#3F3A18", glow: ["#F6F3B0", "#CBD66A"], stone: ["#F2D48A", "#B58C45"] },
};
export const biomeOf = (f: string) => BIOMES[f] ?? BIOMES.perception;

// ── layout ───────────────────────────────────────────────────────────────
export interface SceneMember { node: WorldNode; at: Pt }
export interface SceneExit { family: string; at: Pt; from: string[]; stones: Pt[] }
export interface SceneLayout {
  W: number; H: number; family: string;
  cx: number; cy: number; rx: number; ry: number;
  members: SceneMember[];
  /** road id → its stepping stones (scene units) */
  stones: { road: string; pts: Pt[] }[];
  exits: SceneExit[];
  map: (p: Pt) => Pt;
  trees: { x: number; y: number; s: number; v: number }[];
  props: { x: number; y: number; kind: number; s: number }[];
  tufts: { x: number; y: number; s: number; flower: boolean }[];
}

export function sceneLayout(world: World, family: string, aspect: number): SceneLayout {
  const H = SCENE_H, W = Math.round(H * Math.max(0.4, aspect));
  const phone = aspect < 0.8;
  const cx = W / 2, cy = H * (phone ? 0.44 : 0.53);
  const rx = W * (phone ? 0.44 : 0.36), ry = H * (phone ? 0.35 : 0.36);
  const nodes = world.nodes.filter((n) => n.family === family);
  const xs = nodes.map((n) => n.center.x), ys = nodes.map((n) => n.center.y);
  let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const span = Math.max(x1 - x0, y1 - y0, 1);
  const padX = Math.max(0, (span * 0.35 - (x1 - x0)) / 2) + 1, padY = Math.max(0, (span * 0.35 - (y1 - y0)) / 2) + 1;
  x0 -= padX; x1 += padX; y0 -= padY; y1 += padY;
  // square → disc (elliptical grid map), then into the stage ellipse
  const fitX = phone ? 0.84 : 0.8, fitY = 0.7;
  const map = (p: Pt): Pt => {
    const u = Math.max(-1.15, Math.min(1.15, ((p.x - x0) / (x1 - x0)) * 2 - 1));
    const v = Math.max(-1.15, Math.min(1.15, ((p.y - y0) / (y1 - y0)) * 2 - 1));
    const dx = u * Math.sqrt(Math.max(0, 1 - (v * v) / 2)), dy = v * Math.sqrt(Math.max(0, 1 - (u * u) / 2));
    return { x: cx + dx * rx * fitX, y: cy + dy * ry * fitY + (phone ? 0 : 10) };
  };
  const members = nodes.map((node) => ({ node, at: map(node.center) }));
  const inFam = new Set(nodes.map((n) => n.name));

  // stepping stones along intra-family roads (skip the discs at both ends)
  const stones: { road: string; pts: Pt[] }[] = [];
  for (const r of world.roads) {
    if (!inFam.has(r.from) || !inFam.has(r.to)) continue;
    const line = [map(nodes.find((n) => n.name === r.from)!.center), ...(r.lanePoints.length ? r.lanePoints : r.points).map(map),
      map(nodes.find((n) => n.name === r.to)!.center)];
    const s = samplePolyline(line);
    const pts: Pt[] = [];
    const step = 30;
    for (let d = 34; d < s.length - 30; d += step) {
      const p = s.at(d / s.length);
      // parallel lanes would lay two streams of stones side by side: share them
      if (stones.some((o) => o.pts.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 22))) continue;
      if (members.some((m) => Math.hypot(m.at.x - p.x, m.at.y - p.y) < 34)) continue;
      pts.push(p);
    }
    stones.push({ road: r.id, pts });
  }

  // exits: one per other family this family links to, on the clearing rim
  const byFam = new Map<string, string[]>();
  for (const r of world.roads) {
    const a = inFam.has(r.from), b = inFam.has(r.to);
    if (a === b) continue;
    const other = world.nodes.find((n) => n.name === (a ? r.to : r.from));
    const mine = a ? r.from : r.to;
    if (!other) continue;
    byFam.set(other.family, [...(byFam.get(other.family) ?? []), mine]);
  }
  const home = world.camera.regions[family];
  const exits: SceneExit[] = [];
  // a signboard's footprint (scene units; base at `at`), as paper-skin sizes it
  const signHalf = (fam: string) => ((11.2 * (familyName(fam).length + 3) + 28) * 1.1) / 2;
  const signBox = (fam: string, p: Pt) => ({ x0: p.x - signHalf(fam), x1: p.x + signHalf(fam), y0: p.y - 62, y1: p.y + 6 });
  // a member's body + its name tag below (so a sign never stands on a model)
  const onMember = (bx: { x0: number; x1: number; y0: number; y1: number }) => members.some((m) => {
    const hw = m.node.atom ? 70 : 46;
    return bx.x0 < m.at.x + hw && m.at.x - hw < bx.x1 && bx.y0 < m.at.y + 44 && m.at.y - (m.node.atom ? 150 : 96) < bx.y1;
  });
  const overlaps = (a: ReturnType<typeof signBox>, b: ReturnType<typeof signBox>) => a.x0 < b.x1 + 12 && b.x0 < a.x1 + 12 && a.y0 < b.y1 + 8 && b.y0 < a.y1 + 8;
  const taken: ReturnType<typeof signBox>[] = [];
  const fams = [...byFam.keys()].filter((f) => world.camera.regions[f] && home);
  fams.forEach((fam, i) => {
    const from = byFam.get(fam)!;
    const b = world.camera.regions[fam];
    const ang = Math.atan2((b.y + b.h / 2) - (home.y + home.h / 2), (b.x + b.w / 2) - (home.x + home.w / 2));
    const hw = signHalf(fam);
    // keep the whole signboard on screen and clear of the HUD corner
    const clamp = (p: Pt) => ({ x: Math.max(hw + 16, Math.min(W - hw - 16, p.x)), y: Math.max(170, Math.min(H - 24, p.y)) });
    let at: Pt;
    if (phone) {
      // a phone is too narrow for rim signs: they stand in a column under the clearing
      at = { x: cx, y: H - 20 - i * 60 };
    } else {
      // the rim point toward that family, nudged along the rim (then outward) until
      // the board stands clear of every model and every other board
      const cands: Pt[] = [];
      for (const e of [0.97, 1.08, 1.18]) for (const d of [0, 0.14, -0.14, 0.28, -0.28, 0.42, -0.42]) {
        cands.push(clamp({ x: cx + Math.cos(ang + d) * rx * e, y: cy + Math.sin(ang + d) * ry * e }));
      }
      at = cands.find((p) => !onMember(signBox(fam, p)) && !taken.some((t) => overlaps(t, signBox(fam, p))))
        ?? cands.find((p) => !taken.some((t) => overlaps(t, signBox(fam, p)))) ?? cands[0];
    }
    taken.push(signBox(fam, at));
    const pts: Pt[] = [];
    for (const m of [...new Set(from)]) {
      const src = members.find((x) => x.node.name === m)!.at;
      const s = samplePolyline([src, { x: (src.x + at.x) / 2, y: (src.y + at.y) / 2 + 18 }, at]);
      for (let d = 34; d < s.length - 10; d += 32) pts.push(s.at(d / s.length));
    }
    exits.push({ family: fam, at, from, stones: pts });
  });

  // canopy ring: fill the whole frame outside the stage, big near the edges
  const trees: SceneLayout["trees"] = [];
  const cell = phone ? 92 : 118;
  for (let gy = -1; gy <= Math.ceil(H / cell) + 1; gy++) {
    for (let gx = -1; gx <= Math.ceil(W / cell) + 1; gx++) {
      const jx = (hash(gx, gy) - 0.5) * cell * 0.7, jy = (hash(gy + 7, gx) - 0.5) * cell * 0.6;
      const x = gx * cell + jx + (gy % 2 ? cell / 2 : 0), y = gy * cell + jy;
      const e = Math.hypot((x - cx) / rx, (y - cy) / ry);
      if (e < 1.02) continue;
      const s = Math.min(1.5, 0.78 + (e - 1) * 0.55 + hash(gx * 3, gy) * 0.25);
      trees.push({ x, y, s, v: Math.floor(hash(gx, gy * 5) * 4) });
    }
  }
  // stage-edge trees that overlap into the clearing a little (depth)
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + hash(i, 3) * 0.2;
    const e = 1.04 + hash(i, 9) * 0.06;
    trees.push({ x: cx + Math.cos(a) * rx * e, y: cy + Math.sin(a) * ry * e, s: 0.72 + hash(i, 1) * 0.2, v: i % 4 });
  }
  // keep exit paths open: no tree on an exit
  const clearOf = (p: Pt) => exits.every((x) => Math.abs(p.x - x.at.x) > 150 || p.y < x.at.y - 150 || p.y > x.at.y + 190);
  // nor over a model: a canopy is ~150·s tall above its foot and ~120·s wide, and
  // a model's body + tag must stay readable (the clearing opens a glade instead)
  const clearOfMembers = (t: { x: number; y: number; s: number }) => members.every((m) =>
    Math.abs(m.at.x - t.x) > 62 * t.s + 40 || m.at.y + 48 < t.y - 150 * t.s || m.at.y - 60 > t.y + 10);
  const keptTrees = trees.filter((t) => clearOf(t) && clearOfMembers(t)).sort((a, b) => a.y - b.y);

  // dressing in free space near the rim (never on a member, stone or exit)
  const solids: Pt[] = [...members.map((m) => m.at), ...stones.flatMap((s) => s.pts), ...exits.flatMap((x) => [x.at, ...x.stones])];
  const free = (p: Pt, d: number) => solids.every((q) => Math.hypot(p.x - q.x, p.y - q.y) > d);
  const props: SceneLayout["props"] = [];
  for (let i = 0; i < 40 && props.length < 7; i++) {
    const a = hash(i, 11) * Math.PI * 2, e = 0.74 + hash(i, 12) * 0.2;
    const p = { x: cx + Math.cos(a) * rx * e, y: cy + Math.sin(a) * ry * e };
    if (!free(p, 78) || props.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 120)) continue;
    if (exits.some((x) => Math.abs(p.x - x.at.x) < 150 && Math.abs(p.y - x.at.y) < 110)) continue;
    props.push({ ...p, kind: props.length % 5, s: 0.9 + hash(i, 13) * 0.3 });
  }
  const tufts: SceneLayout["tufts"] = [];
  for (let i = 0; i < 160 && tufts.length < 46; i++) {
    const a = hash(i, 21) * Math.PI * 2, e = Math.sqrt(hash(i, 22)) * 0.95;
    const p = { x: cx + Math.cos(a) * rx * e, y: cy + Math.sin(a) * ry * e };
    if (!free(p, 30) || props.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 50)) continue;
    tufts.push({ ...p, s: 1.2 + hash(i, 23), flower: hash(i, 24) < 0.22 });
  }
  return { W, H, family, cx, cy, rx, ry, members, stones, exits, map, trees: keptTrees, props, tufts };
}

// ── trees ────────────────────────────────────────────────────────────────
const blob = (lobes: [number, number, number][]) =>
  lobes.map(([x, y, r]) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`).join("");

function Canopy({ ramp, v, acacia = false }: { ramp: Ramp; v: number; acacia?: boolean }) {
  // a 3/4 top-down paper canopy, base (trunk foot) at 0,0, ~150 tall
  const L: [number, number, number][][] = [
    [[-40, -92, 40], [4, -112, 46], [44, -88, 38], [-14, -70, 36], [26, -66, 34]],
    [[-44, -84, 36], [-6, -108, 44], [40, -96, 40], [0, -68, 38]],
    [[-36, -96, 42], [18, -110, 40], [46, -78, 34], [-20, -66, 34], [16, -64, 30]],
    [[-46, -90, 34], [-10, -104, 42], [34, -104, 36], [48, -74, 30], [0, -70, 38]],
  ];
  const lobes = acacia ? [[-56, -92, 24], [-20, -100, 30], [20, -102, 30], [56, -92, 24], [0, -90, 30]] as [number, number, number][] : L[v % 4];
  const d = blob(lobes);
  const lit = blob(lobes.map(([x, y, r]) => [x - r * 0.22, y - r * 0.26, r * 0.62] as [number, number, number]));
  const hi = blob(lobes.map(([x, y, r]) => [x - r * 0.38, y - r * 0.42, r * 0.26] as [number, number, number]));
  return (
    <g>
      {/* trunk + root flare */}
      <path d="M-14 0 Q-10 -30 -9 -62 L9 -62 Q10 -30 14 0 Q24 4 30 2 L10 -4 Q0 2 -10 -4 L-30 2 Q-24 4 -14 0Z" fill={R.wood[MID]} />
      <path d="M2 -62 L9 -62 Q10 -30 14 0 L6 -2 Z" fill={R.wood[DEEP]} />
      {/* cast shadow down-right, die-cut rim, body, underside shade, lit lobes, glints */}
      <path d={d} fill="rgba(6,16,20,0.35)" transform="translate(14 20)" />
      <path d={d} fill={PAPER.die} stroke={PAPER.die} strokeWidth={6} strokeLinejoin="round" />
      <path d={d} fill={ramp[SHADE]} />
      <path d={d} fill={ramp[DEEP]} transform="translate(4 10)" opacity={0.55} clipPath="none" />
      <path d={blob(lobes.map(([x, y, r]) => [x - 2, y - 4, r * 0.92] as [number, number, number]))} fill={ramp[MID]} />
      <path d={lit} fill={ramp[LIT]} />
      <path d={hi} fill={ramp[HI]} opacity={0.85} />
      <path d={d} fill="url(#pa-knit)" opacity={0.6} />
    </g>
  );
}

function Pine({ ramp, snow }: { ramp: Ramp; snow: boolean }) {
  const tier = (y: number, w: number, h: number, i: number) => (
    <g key={i}>
      <path d={`M${-w} ${y} L0 ${y - h} L${w} ${y} Q0 ${y + 10} ${-w} ${y}Z`} fill={ramp[SHADE]} />
      <path d={`M${-w} ${y} L0 ${y - h} L0 ${y + 5} Q${-w * 0.5} ${y + 6} ${-w} ${y}Z`} fill={ramp[MID]} />
      {snow && <path d={`M${-w * 0.55} ${y - h * 0.45} L0 ${y - h} L${w * 0.35} ${y - h * 0.62} L${w * 0.1} ${y - h * 0.55} L${-w * 0.2} ${y - h * 0.5}Z`} fill="#F5FAFF" />}
    </g>
  );
  return (
    <g>
      <rect x={-7} y={-18} width={14} height={20} fill={R.wood[SHADE]} />
      <path d="M-50 -14 L0 -150 L50 -14Z" fill="rgba(6,16,20,0.3)" transform="translate(16 12)" />
      <path d="M-52 -12 L0 -152 L52 -12Z" fill={PAPER.die} stroke={PAPER.die} strokeWidth={6} strokeLinejoin="round" />
      {[tier(-14, 52, 52, 0), tier(-48, 42, 48, 1), tier(-80, 32, 44, 2), tier(-108, 22, 44, 3)]}
    </g>
  );
}

const Tree = memo(function Tree({ kind, ramp, v, s }: { kind: TreeKind; ramp: Ramp; v: number; s: number }) {
  let node: ReactNode;
  switch (kind) {
    case "palm": node = v % 2 ? <Palm size={150} /> : <Canopy ramp={R.leaf} v={v} />; break;
    case "pine": node = <Pine ramp={ramp} snow={v % 3 !== 2} />; break;
    case "crystal": node = v % 2 ? <CrystalCluster size={110} /> : <Canopy ramp={ramp} v={v} />; break;
    case "puff": node = v === 3 ? <BasaltRocks size={80} /> : <Canopy ramp={ramp} v={v} />; break;
    case "acacia": node = <Canopy ramp={ramp} v={v} acacia />; break;
    default: node = <Canopy ramp={v === 3 ? R.teal : ramp} v={v} />;
  }
  return <g transform={`scale(${s})`}>{node}</g>;
});

// ── special props (clearing dressing, no data) ─────────────────────────────
function Prop({ kind }: { kind: number }) {
  switch (kind) {
    case 0: // red mushroom-tree
      return (
        <g>
          <path d="M-8 0 Q-6 -24 -5 -40 L5 -40 Q6 -24 8 0Z" fill="#F5EAD0" />
          <path d="M-46 -40 Q-44 -84 0 -86 Q44 -84 46 -40 Q24 -30 0 -32 Q-24 -30 -46 -40Z" fill={PAPER.die} stroke={PAPER.die} strokeWidth={5} />
          <path d="M-46 -40 Q-44 -84 0 -86 Q44 -84 46 -40 Q24 -30 0 -32 Q-24 -30 -46 -40Z" fill={R.red[MID]} />
          <path d="M-40 -46 Q-36 -78 0 -80 Q-18 -60 -40 -46Z" fill={R.red[LIT]} />
          <path d="M0 -32 Q24 -30 46 -40 Q30 -44 0 -40Z" fill={R.red[DEEP]} />
          {[[-22, -60, 6], [8, -70, 5], [24, -52, 4], [-6, -48, 4]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill={PAPER.die} />)}
        </g>
      );
    case 1: // twin pines
      return <g><g transform="translate(-18 0) scale(0.42)"><Pine ramp={R.pine} snow={false} /></g><g transform="translate(18 6) scale(0.36)"><Pine ramp={R.teal} snow={false} /></g></g>;
    case 2: // hollow trunk
      return (
        <g>
          <path d="M-26 0 Q-24 -30 -22 -42 L22 -42 Q24 -30 26 0Z" fill={PAPER.die} stroke={PAPER.die} strokeWidth={5} />
          <path d="M-26 0 Q-24 -30 -22 -42 L22 -42 Q24 -30 26 0Z" fill={R.wood[MID]} />
          <path d="M6 0 Q10 -30 8 -42 L22 -42 Q24 -30 26 0Z" fill={R.wood[SHADE]} />
          <ellipse cx={0} cy={-42} rx={22} ry={7} fill={R.wood[LIT]} />
          <ellipse cx={0} cy={-42} rx={14} ry={4} fill={R.wood[DEEP]} />
          <path d="M-8 0 Q-8 -18 0 -20 Q8 -18 8 0Z" fill="#2A1A10" />
        </g>
      );
    case 3: // ferns
      return (
        <g>
          {[-30, -10, 10, 30].map((a, i) => (
            <path key={i} d={`M0 0 Q${a * 0.6} -20 ${a} -34`} stroke={i % 2 ? R.leaf[SHADE] : R.leaf[LIT]} strokeWidth={7} strokeLinecap="round" fill="none" strokeDasharray="4 2" />
          ))}
        </g>
      );
    default: // flowers
      return <g><Flower x={-12} y={0} r={5} ramp={R.red} stem={10} /><Flower x={4} y={-2} r={6} ramp={R.gold} stem={12} /><Flower x={16} y={2} r={5} ramp={R.pink} stem={8} /></g>;
  }
}

// ── a model as a little paper character on its stepping-stone disc ─────────
const BODY = "M0 -44 C14 -44 20 -32 20 -20 C20 -8 13 -2 0 -2 C-13 -2 -20 -8 -20 -20 C-20 -32 -14 -44 0 -44Z";

export const Character = memo(function Character({ node, state, focused, dim }: { node: WorldNode; state: EvidenceState; focused: boolean; dim: boolean }) {
  const ramp = familyRamp(node.family);
  const Icon = iconFor(node.name);
  const sketch = state === "provisional";
  const hollow = state === "untrained";
  const disc = state === "champion" ? [R.gold[LIT], R.gold[SHADE]] : state === "trained" ? [R.blue[LIT], R.blue[DEEP]] : [PAPER.die, "#D8CCB0"];
  const body = sketch ? PAPER.die : hollow ? R.cream[LIT] : ramp[LIT];
  const bodyShade = sketch ? PAPER.die : hollow ? R.cream[MID] : ramp[MID];
  const k = focused ? 1.3 : 1;
  return (
    <g transform={`scale(${k})`} opacity={dim ? 0.45 : 1}>
      {/* the stepping-stone disc (evidence) with its thickness */}
      <ellipse cx={3} cy={6} rx={27} ry={11} fill="rgba(10,20,20,0.3)" />
      <ellipse cx={0} cy={3} rx={26} ry={10} fill={disc[1]} />
      <ellipse cx={0} cy={0} rx={26} ry={10} fill={disc[0]} stroke={sketch ? PAPER.pencil : hollow ? PAPER.face : PAPER.die}
        strokeWidth={2.4} strokeDasharray={sketch ? "4 3" : undefined} />
      {focused && <ellipse cx={0} cy={0} rx={33} ry={14} fill="none" stroke={PAPER.ink} strokeWidth={3} />}
      {state === "champion" && <path d="M18 -8 l2.4 5 5.4.6-4 3.7 1.1 5.3-4.9-2.7-4.9 2.7 1.1-5.3-4-3.7 5.4-.6Z" fill={R.gold[HI]} stroke={PAPER.die} strokeWidth={1.4} />}
      {/* body: die-cut rim, shaded right side, lit left */}
      <path d={BODY} fill={PAPER.die} stroke={PAPER.die} strokeWidth={5} strokeLinejoin="round" />
      <path d={BODY} fill={body} stroke={sketch ? PAPER.pencil : undefined} strokeWidth={sketch ? 1.8 : undefined} strokeDasharray={sketch ? "3 3" : undefined} />
      {!sketch && <path d="M4 -44 C16 -42 20 -32 20 -20 C20 -8 13 -2 4 -2 C10 -12 10 -32 4 -44Z" fill={bodyShade} />}
      {/* eyes */}
      <circle cx={-6} cy={-32} r={3} fill={PAPER.ink} /><circle cx={6} cy={-32} r={3} fill={PAPER.ink} />
      <circle cx={-5} cy={-33} r={1} fill={PAPER.die} /><circle cx={7} cy={-33} r={1} fill={PAPER.die} />
      {/* feet */}
      <ellipse cx={-8} cy={-2} rx={6} ry={3} fill={PAPER.ink} /><ellipse cx={8} cy={-2} rx={6} ry={3} fill={PAPER.ink} />
      {/* species emblem on the belly */}
      {Icon && <Icon x={-8} y={-24} width={16} height={16} color={sketch ? PAPER.pencil : hollow ? PAPER.face : PAPER.ink} strokeWidth={2.4} aria-hidden />}
    </g>
  );
});

// ── the scene ─────────────────────────────────────────────────────────────
export const ClearingStage = memo(function ClearingStage({ lay }: { lay: SceneLayout }) {
  const b = biomeOf(lay.family);
  const { W, H, cx, cy, rx, ry } = lay;
  const id = `clr-${lay.family}`;
  return (
    <g>
      <defs>
        <radialGradient id={`${id}-glow`} cx={cx} cy={cy} r={Math.max(rx, ry)} gradientUnits="userSpaceOnUse" gradientTransform={`translate(${cx} ${cy}) scale(1 ${ry / rx}) translate(${-cx} ${-cy})`}>
          <stop offset={0} stopColor={b.glow[0]} />
          <stop offset={0.8} stopColor={b.glow[1]} />
          <stop offset={1} stopColor={b.glow[1]} stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect x={-W} y={-H} width={W * 3} height={H * 3} fill={b.floor} />
      <ellipse cx={cx} cy={cy} rx={rx * 1.12} ry={ry * 1.12} fill={`url(#${id}-glow)`} />
      <ellipse cx={cx} cy={cy} rx={rx * 1.12} ry={ry * 1.12} fill="url(#pa-fibre)" opacity={0.8} />
    </g>
  );
});

export const ClearingVignette = memo(function ClearingVignette({ lay }: { lay: SceneLayout }) {
  const { W, H, cx, cy } = lay;
  const id = `vig-${lay.family}`;
  return (
    <g pointerEvents="none">
      <defs>
        <radialGradient id={id} cx={cx} cy={cy} r={Math.hypot(W, H) / 2} gradientUnits="userSpaceOnUse">
          <stop offset={0.45} stopColor="#06100C" stopOpacity={0} />
          <stop offset={1} stopColor="#06100C" stopOpacity={0.6} />
        </radialGradient>
      </defs>
      <rect x={0} y={0} width={W} height={H} fill={`url(#${id})`} />
    </g>
  );
});

export function Stones({ pts, ramp, trail }: { pts: Pt[]; ramp: [string, string]; trail: boolean }) {
  return (
    <g>
      {pts.map((p, i) => (
        <g key={i} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${((i * 37) % 30) - 15})`}>
          <ellipse cx={2} cy={4} rx={13} ry={7} fill="rgba(10,20,20,0.25)" />
          <ellipse cx={0} cy={2} rx={13} ry={7} fill={ramp[1]} />
          <ellipse cx={0} cy={0} rx={13} ry={7} fill={ramp[0]} />
          {trail && <circle cx={0} cy={0} r={3.2} fill={PAPER.ink} />}
        </g>
      ))}
    </g>
  );
}

/** Trees + props + landmarks + characters + signs, painted far → near. */
export function ClearingProps({ lay, states, focus, dimOthers, kin, onHover, onSelect, onExit }: {
  lay: SceneLayout; states: Record<string, EvidenceState>; focus: string | null; dimOthers: boolean; kin: string[] | null;
  onHover?: (n: string | null) => void; onSelect?: (n: string) => void; onExit?: (family: string) => void;
}) {
  const b = biomeOf(lay.family);
  const trees = useMemo(() => lay.trees.map((t, i) => ({
    key: `t${i}`, y: t.y, node: <g transform={`translate(${t.x.toFixed(1)} ${t.y.toFixed(1)})`}><Tree kind={b.tree} ramp={b.canopy} v={t.v} s={t.s} /></g>,
  })), [lay, b]);
  const items: { key: string; y: number; node: ReactNode }[] = [...trees];
  lay.props.forEach((p, i) => items.push({ key: `p${i}`, y: p.y, node: <g transform={`translate(${p.x} ${p.y}) scale(${p.s})`}><Prop kind={p.kind} /></g> }));
  lay.tufts.forEach((t, i) => items.push({ key: `u${i}`, y: t.y - 30, node: t.flower
    ? <Flower x={t.x} y={t.y} r={4} ramp={i % 2 ? R.red : R.pink} stem={8} />
    : <Tuft x={t.x} y={t.y} s={t.s} ramp={lay.family === "sequence" ? R.sand : lay.family === "generative" ? R.basalt : R.grass} /> }));
  const signs: { key: string; y: number; node: ReactNode }[] = [];
  lay.exits.forEach((x) => signs.push({ key: `x${x.family}`, y: x.at.y, node:
    <g transform={`translate(${x.at.x} ${x.at.y})`} onClick={onExit ? () => onExit(x.family) : undefined} style={{ cursor: "pointer" }}>
      <SignBoard text={`To ${familyName(x.family)}`} family={x.family} size={56} />
      <rect x={-70} y={-60} width={140} height={64} fill="transparent" />
    </g> }));
  const kinSet = kin ? new Set(kin) : null;
  for (const m of lay.members) {
    const st = states[m.node.name] ?? "untrained";
    const dim = dimOthers && !!kinSet && !kinSet.has(m.node.name);
    items.push({ key: `m${m.node.name}`, y: m.at.y, node: (
      <g transform={`translate(${m.at.x.toFixed(1)} ${m.at.y.toFixed(1)})`} opacity={dim ? 0.45 : 1} style={{ cursor: "pointer" }}
        onClick={onSelect ? () => onSelect(m.node.name) : undefined}
        onPointerEnter={onHover ? () => onHover(m.node.name) : undefined} onPointerLeave={onHover ? () => onHover(null) : undefined}>
        {m.node.atom
          ? <g transform={m.node.name === focus ? "scale(1.18)" : undefined}><AtomLandmark name={m.node.name} state={st} size={m.node.name === "transformer" || m.node.name === "classifier" ? 150 : 124} /></g>
          : <Character node={m.node} state={st} focused={m.node.name === focus} dim={false} />}
      </g>
    ) });
  }
  items.sort((a, c) => a.y - c.y);
  return <g>{items.map((it) => <g key={it.key}>{it.node}</g>)}{signs.map((it) => <g key={it.key}>{it.node}</g>)}</g>;
}

/** Tag geometry for the HTML overlay: below each member (atoms: below the landmark foot). */
export function sceneTags(lay: SceneLayout) {
  return lay.members.map((m) => ({ name: m.node.name, atom: m.node.atom, at: { x: m.at.x, y: m.at.y + (m.node.atom ? 14 : 16) }, text: displayName(m.node.name) }));
}
