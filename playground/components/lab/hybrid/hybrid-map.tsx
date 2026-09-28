"use client";

// The diorama for the hybrid skin = the papercraft skin's own exported map
// layers (read-only import), so the map IS skin A's map. If that import ever
// throws at render (the paper skin is being built concurrently), an error
// boundary swaps in this skin's own paper shim (./paper-map.tsx) so the
// page never blanks.
import { Component, useEffect, useMemo, useState, type ReactNode } from "react";
import { samplePolyline, type Pt, type World, type WorldNode } from "@/lib/world";
import type { EvidenceState } from "@/components/lab/shared/card-model";
import {
  BridgeLayer, DecorLayer, LabelLayer, LandLayer, PaperCritter, PaperDefs, RoadLayer, SeaLayer, SetPiece,
  SignLayer, Spot, fibreTile, regionOutlines,
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

/** Where the critter stops: on the road at the spot's door; atoms (no road)
 *  wait beside the castle on the side away from the name tag. */
function critterStop(world: World, focus: WorldNode, walk: Pt[]) {
  const r = focus.atom ? 40 : 26;
  const s = samplePolyline(walk);
  if (s.length > r + 4) { const k = 1 - r / s.length; return { park: s.at(k) as Pt, stop: k }; }
  const tag = world.labels.find((l) => l.node === focus.name);
  const side = tag && tag.anchor.includes("W") ? 1 : -1;
  return { park: { x: focus.center.x + side * r, y: focus.center.y + 8 }, stop: 1 };
}

function PaperMap({ world, states, focus, zoom, walk, walkNodes, still, scale, signScale, onRenderer }: MapProps) {
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
  const others = useMemo(() => {
    const keep = kin?.names ?? (familyNames ? new Set(familyNames) : null);
    return keep ? world.labels.map((l) => l.node).filter((n) => !keep.has(n)) : null;
  }, [world, kin, familyNames]);
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
      <LabelLayer world={world} minFont={minFont} focus={focusName} only={kin ? [...kin.names] : familyNames ?? undefined} />
      {zoom === "overview" && signScale > 0 && <SignLayer world={world} scale={signScale} minFont={minFont} />}
    </>
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
