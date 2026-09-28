"use client";

// The diorama for the hybrid skin = the papercraft skin's own exported map
// layers (read-only import), so the map IS skin A's map. If that import ever
// throws at render (the paper skin is being built concurrently), an error
// boundary swaps in this skin's own paper shim (./paper-map.tsx) so the
// page never blanks.
import { Component, useEffect, useMemo, useState, type ReactNode } from "react";
import { samplePolyline, type Box, type Pt, type World, type WorldNode } from "@/lib/world";
import type { EvidenceState } from "@/components/lab/shared/card-model";
import {
  BridgeLayer, DecorLayer, LabelLayer, LandLayer, PaperCritter, PaperDefs, RoadLayer, SeaLayer, SetPiece,
  SignLayer, Spot, fibreTile, regionOutlines, familyName, inkOf, PAPER,
} from "@/components/lab/paper";
import {
  Bridges, Critter, Decor, Labels, Land, Nodes, Roads, Signs, WalkHome,
} from "./paper-map.tsx";

export interface MapProps {
  world: World;
  states: Record<string, EvidenceState>;
  /** focused model (region/node zoom), else null */
  focus: WorldNode | null;
  zoom: "overview" | "region" | "node";
  /** critter walk: root atom → focused node (px) */
  walk: Pt[];
  /** node names of the walk home, focused node first (pathToAtom().nodes) */
  walkNodes: string[];
  still: boolean;
  scale: number;
  counts: Record<string, number>;
  signGrow: number;
  /** camera scale the paper signs are sized for (18px type at this scale); 0 hides them */
  signScale: number;
  onOpen: (name: string) => void;
  /** phone overview: compact family signs at island centres, kept on screen */
  phoneSigns?: { view: Box } | null;
  /** world-px rectangles covered by chrome windows: name tags under them are hidden */
  occluders: Box[];
  /** reports which renderer is live, for the encoding table */
  onRenderer?: (r: "paper" | "shim") => void;
}

class MapBoundary extends Component<{ fallback: ReactNode; onFail: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFail(); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export function HybridMap(p: MapProps) {
  return (
    <MapBoundary fallback={<ShimMap {...p} />} onFail={() => p.onRenderer?.("shim")}>
      <PaperMap {...p} />
    </MapBoundary>
  );
}

/** Where the critter stops: on the road one step short of the spot's halo
 *  (so it never covers the focused spot); atoms (no road behind them) wait
 *  beside the castle on the side away from the name tag. */
export function critterStop(world: World, focus: WorldNode, walk: Pt[]) {
  const r = (focus.atom ? 40 : 26) + 34;
  const s = samplePolyline(walk);
  if (s.length > r + 4) { const k = 1 - r / s.length; return { park: s.at(k) as Pt, stop: k }; }
  const tag = world.labels.find((l) => l.node === focus.name);
  const side = tag && tag.anchor.includes("W") ? 1 : -1;
  return { park: { x: focus.center.x + side * r, y: focus.center.y + 8 }, stop: 1 };
}

const hits = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function PaperMap({ world, states, focus, zoom, walk, walkNodes, still, scale, signScale, occluders, phoneSigns, onRenderer }: MapProps) {
  const [fibre, setFibre] = useState<string | null>(null);
  useEffect(() => { setFibre(fibreTile()); onRenderer?.("paper"); }, [onRenderer]);
  const outlines = useMemo(() => regionOutlines(world), [world]);
  const lineage = useMemo(() => {
    const ids: string[] = [];
    for (let i = 0; i + 1 < walkNodes.length; i++) ids.push(`${walkNodes[i + 1]}->${walkNodes[i]}`);
    return ids;
  }, [walkNodes]);
  const ordered = useMemo(() => [...world.nodes].sort((a, b) => a.center.y - b.center.y), [world]);
  const focusName = focus?.name ?? null;
  const stop = useMemo(() => (focus ? critterStop(world, focus, walk) : null), [world, focus, walk]);
  const minFont = scale * 13 >= 12.5 ? 13 : scale * 15 >= 12.5 ? 15 : 99;

  // Hierarchy by vellum (the paper skin's own material): in a region, a
  // sheet over every OTHER island; on a model, a sheet over everything
  // outside its family tree (parents, children, walk home), which is lifted
  // back on top — same rule as the paper skin's node view.
  const kin = useMemo(() => {
    if (!focus || zoom !== "node") return null;
    const names = new Set<string>([focus.name, ...focus.parents, ...walkNodes]);
    for (const n of world.nodes) if (n.parents.includes(focus.name)) names.add(n.name);
    const roads = world.roads.filter((r) => r.to === focus.name || r.from === focus.name || lineage.includes(r.id)).map((r) => r.id);
    return { names, roads };
  }, [world, focus, zoom, walkNodes, lineage]);
  const family = zoom === "region" && focus ? focus.family : null;
  const familyNames = useMemo(
    () => (family ? world.nodes.filter((n) => n.family === family).map((n) => n.name) : null), [world, family]);
  // Tags whose box falls under a chrome window are not printed (no half-tags
  // peeking out from behind the menu or the status window).
  const clear = useMemo(() => {
    const ok = new Set<string>();
    for (const l of world.labels) if (l.node === focusName || !occluders.some((o) => hits(l.box, o))) ok.add(l.node);
    return ok;
  }, [world, occluders, focusName]);
  const keepTop = useMemo(() => kin?.names ?? (familyNames ? new Set(familyNames) : null), [kin, familyNames]);
  const topTags = useMemo(
    () => world.labels.map((l) => l.node).filter((n) => clear.has(n) && (!keepTop || keepTop.has(n))),
    [world, clear, keepTop]);
  const others = useMemo(
    () => (keepTop ? world.labels.map((l) => l.node).filter((n) => clear.has(n) && !keepTop.has(n)) : null),
    [world, clear, keepTop]);
  const W = world.camera.world;
  const sheet = <rect x={W.x - W.w} y={W.y - W.h} width={W.w * 3} height={W.h * 3} fill={VELLUM} opacity={0.5} />;
  const lifted = (n: WorldNode) => (kin ? kin.names.has(n.name) : false);

  return (
    <>
      <PaperDefs fibre={fibre} />
      <SeaLayer world={world} />
      <LandLayer world={world} outlines={outlines} fibre={Boolean(fibre)} />
      <DecorLayer world={world} />
      <RoadLayer world={world} lineage={lineage} />
      <BridgeLayer world={world} />
      {world.regions.map((r) => <SetPiece key={r.id} world={world} region={r} pop={0} still />)}
      <g>
        {ordered.filter((n) => n.name !== focusName && !lifted(n)).map((n) => (
          <Spot key={n.name} node={n} state={states[n.name] ?? "untrained"} focused={false} onSelect={noop} />
        ))}
      </g>
      {others && <LabelLayer world={world} minFont={minFont} focus={null} only={others} />}
      {family && world.regions.filter((r) => r.family !== family).map((r) => (
        <path key={r.id} d={outlines[r.id]} fill={VELLUM} opacity={0.55} stroke={VELLUM} strokeWidth={10} strokeLinejoin="round" />
      ))}
      {kin && (
        <>
          {sheet}
          <RoadLayer world={world} lineage={lineage} only={kin.roads} />
          <BridgeLayer world={world} only={kin.roads} />
        </>
      )}
      <g>
        {ordered.filter((n) => n.name !== focusName && lifted(n)).map((n) => (
          <Spot key={n.name} node={n} state={states[n.name] ?? "untrained"} focused={false} onSelect={noop} />
        ))}
        {focus && <Spot key={`f-${focus.name}`} node={focus} state={states[focus.name] ?? "untrained"} focused onSelect={noop} />}
      </g>
      {focus && zoom === "node" && stop && (
        <PaperCritter key={focus.name} path={walk} stop={stop.stop} still={still} park={stop.park} />
      )}
      <LabelLayer world={world} minFont={minFont} focus={focusName} only={topTags} />
      {zoom === "overview" && phoneSigns && <PhoneSigns world={world} scale={scale} view={phoneSigns.view} />}
      {zoom === "overview" && !phoneSigns && signScale > 0 && <SignLayer world={world} scale={signScale} minFont={minFont} />}
    </>
  );
}
/**
 * Phone overview signs: the paper sign style (family edge colour, die-cut
 * rim, white letters) at 13px on screen, centred on each island's camera box
 * and clamped inside the viewport, so all six names fit a 390px map.
 */
function PhoneSigns({ world, scale, view }: { world: World; scale: number; view: Box }) {
  const px = 13 / scale;
  const pad = 6 / scale;
  return (
    <g aria-hidden pointerEvents="none">
      {world.regions.map((r) => {
        const b = world.camera.regions[r.family];
        if (!b) return null;
        const text = familyName(r.family);
        const w = text.length * px * 0.58 + px * 1.1, h = px * 1.6;
        const x = Math.min(Math.max(b.x + b.w / 2 - w / 2, view.x + pad), view.x + view.w - w - pad);
        const y = b.y + b.h / 2 - h / 2;
        return (
          <g key={r.id}>
            <rect x={x + px * 0.1} y={y + px * 0.2} width={w} height={h} rx={px * 0.35} fill={PAPER.shadow} />
            <rect x={x} y={y} width={w} height={h} rx={px * 0.35} fill={inkOf(r.family).edge} stroke={PAPER.die} strokeWidth={px * 0.2} />
            <text x={x + w / 2} y={y + h / 2 + px * 0.05} textAnchor="middle" dominantBaseline="central" fontSize={px}
              fontWeight={600} fill={PAPER.die}>{text}</text>
          </g>
        );
      })}
    </g>
  );
}

/** Tracing-paper white laid over what is out of focus. */
const VELLUM = "#FFFDF6";
// Spot's Enter handler calls onSelect; the page opens nodes by delegated
// click/keydown on [data-node] instead, so both renderers behave the same.
const noop = () => {};

/** Fallback renderer: this skin's own paper shim. */
function ShimMap({ world, states, focus, zoom, walk, still, scale, counts, signGrow, signScale, onOpen }: MapProps) {
  const minFont = scale * 13 >= 12.5 ? 13 : scale * 15 >= 12.5 ? 15 : 99;
  const focusName = focus && zoom !== "overview" ? focus.name : null;
  return (
    <>
      <Land world={world} />
      <Decor world={world} />
      <Roads roads={world.roads} />
      <Bridges world={world} />
      {focus && <WalkHome points={walk} />}
      {signScale > 0 && <Signs world={world} counts={counts} grow={signGrow} />}
      <Nodes nodes={world.nodes} states={states} focus={focusName} onOpen={onOpen} />
      <Labels world={world} minFont={minFont} focus={focusName} />
      {focus && zoom === "node" && (
        <Critter path={walk} still={still} walkKey={focus.name} stopShort={focus.atom ? 36 : 22} park={{ x: -40, y: 20 }} />
      )}
    </>
  );
}
