"use client";

// Papercraft overworld skin (/lab/paper). Wiring follows the stub: URL view →
// useWorld → camera → paint world geometry → card → data-lab-ready. Every
// position comes from lib/world; every mark is declared in encoding.ts.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { pathToAtom, samplePolyline, type Box, type World, type WorldNode } from "@/lib/world";
import { useWorld } from "@/hooks/use-world";
import { useLabView, type Zoom } from "@/components/lab/shared/url-state";
import { LabMotion } from "@/components/lab/shared/still";
import { fitBox, useCamera, type CamBox } from "@/components/lab/shared/camera";
import { cardModel, evidenceState, type EvidenceState } from "@/components/lab/shared/card-model";
import { fibreTile, regionOutlines } from "./geometry";
import { BridgeLayer, LabelLayer, LandLayer, PaperDefs, RoadLayer, SeaLayer, SignLayer, Spot } from "./map-layers";
import { DecorLayer, SetPiece } from "./set-pieces";
import { PaperCritter } from "./critter";
import { PaperCard } from "./card";
import { PaperHud, PaperKey } from "./hud";
import { PAPER } from "./encoding";
import styles from "./paper.module.css";

const CARD_W = 372 + 20 + 20;        // desktop note width + margins (screen px)
const SHEET = 0.5;                    // mobile bottom sheet height fraction
const MAX_NODE_SCALE = 1.8;           // screen px per world px in the node view

const union = (boxes: Box[]): Box => {
  const x0 = Math.min(...boxes.map((b) => b.x)), y0 = Math.min(...boxes.map((b) => b.y));
  const x1 = Math.max(...boxes.map((b) => b.x + b.w)), y1 = Math.max(...boxes.map((b) => b.y + b.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
};

/** Region → the atom the learner lands on (the one with the most roads). */
function regionAtom(world: World, family: string): string | null {
  const atoms = world.nodes.filter((n) => n.family === family && n.atom);
  if (!atoms.length) return world.nodes.find((n) => n.family === family)?.name ?? null;
  const deg = (n: WorldNode) => world.roads.filter((r) => r.from === n.name).length;
  return atoms.sort((a, b) => deg(b) - deg(a) || a.name.localeCompare(b.name))[0].name;
}

/** Camera box for a node: its lineage neighbourhood, framed in the part of
 *  the screen the card does not cover. */
function nodeTarget(world: World, node: WorldNode, vw: number, vh: number): CamBox {
  const tight = world.camera.nodes[node.name].box;
  const desktop = vw >= 640;
  // desktop frames the lineage neighbourhood; the phone frames the spot so
  // its name tags stay ≥13px (the card lists the lineage)
  const kin = desktop ? world.nodes.filter((n) => node.parents.includes(n.name) || n.parents.includes(node.name)) : [];
  const pad = 70;
  const around = union([tight, ...kin.map((n) => ({ x: n.center.x - pad, y: n.center.y - pad, w: pad * 2, h: pad * 2 }))]);
  const minW = tight.w * (desktop ? 2.5 : 1.5), minH = tight.h * (desktop ? 2.5 : 1.5);
  const cx = around.x + around.w / 2, cy = around.y + around.h / 2;
  const w = Math.max(around.w, minW), h = Math.max(around.h, minH);
  let t = { x: cx - w / 2, y: cy - h / 2, w, h };
  const avail = desktop ? { w: Math.max(200, vw - CARD_W), h: vh } : { w: vw, h: vh * (1 - SHEET) };
  t = fitBox(t, avail.w, avail.h);
  // never closer than MAX_NODE_SCALE: the learner should still see the roads around
  if (avail.w / t.w > MAX_NODE_SCALE) {
    const k = (avail.w / t.w) / MAX_NODE_SCALE;
    t = { x: t.x + t.w / 2 - (t.w * k) / 2, y: t.y + t.h / 2 - (t.h * k) / 2, w: t.w * k, h: t.h * k };
  }
  const scale = avail.w / t.w;
  return { x: t.x, y: t.y, w: vw / scale, h: vh / scale };
}

export function PaperSkin() {
  const { view, update } = useLabView();
  const still = view?.still ?? true;
  const { world, taxonomy, evidence, runs, ready } = useWorld(view ? view.still : null);

  const [fibre, setFibre] = useState<string | null>(null);
  useEffect(() => { setFibre(fibreTile()); }, []);

  const [vp, setVp] = useState({ w: 1440, h: 900 });
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  const outlines = useMemo(() => (world ? regionOutlines(world) : []), [world]);
  const states = useMemo(() => {
    const m: Record<string, EvidenceState> = {};
    for (const n of world?.nodes ?? []) m[n.name] = evidenceState(evidence.find((e) => e.name === n.name));
    return m;
  }, [world, evidence]);

  const focusNode = world && view?.focus ? world.nodes.find((n) => n.name === view.focus) : undefined;
  const zoom: Zoom = view && focusNode ? view.zoom : "overview";
  const active = zoom !== "overview" && focusNode ? focusNode.family : null;
  const focus = zoom !== "overview" && focusNode ? focusNode.name : null;

  const overviewBox = useMemo(() => (world ? union(Object.values(world.camera.regions)) : null), [world]);
  const target: CamBox = useMemo(() => {
    if (!world || !overviewBox) return { x: 0, y: 0, w: 1, h: 1 };
    if (zoom === "node" && focusNode) return nodeTarget(world, focusNode, vp.w, vp.h);
    if (zoom === "region" && focusNode) return world.camera.regions[focusNode.family];
    const p = 24;
    return { x: overviewBox.x - p, y: overviewBox.y - p, w: overviewBox.w + p * 2, h: overviewBox.h + p * 2 };
  }, [world, overviewBox, zoom, focusNode, vp.w, vp.h]);

  const cam = useCamera({ world: world?.camera.world ?? target, target, still, minWidth: 200 });

  // Lineage: roads on the focused model's walk back to its root atom.
  const walk = useMemo(() => (world && focus ? pathToAtom(world, focus) : null), [world, focus]);
  const lineage = useMemo(() => {
    if (!walk) return [];
    const ids: string[] = [];
    for (let i = 0; i + 1 < walk.nodes.length; i++) ids.push(`${walk.nodes[i + 1]}->${walk.nodes[i]}`);
    return ids;
  }, [walk]);
  // Node view: the focused model's family tree (parents, children, the walk
  // back to its atom) is lifted above a sheet of vellum laid over the map.
  const kin = useMemo(() => {
    if (!world || !focusNode || zoom !== "node") return null;
    const names = new Set<string>([focusNode.name, ...focusNode.parents, ...(walk?.nodes ?? [])]);
    for (const n of world.nodes) if (n.parents.includes(focusNode.name)) names.add(n.name);
    const roads = world.roads
      .filter((r) => r.to === focusNode.name || r.from === focusNode.name || lineage.includes(r.id))
      .map((r) => r.id);
    const others = world.labels.map((l) => l.node).filter((n) => !names.has(n));
    return { names: [...names], roads, others };
  }, [world, focusNode, zoom, walk, lineage]);
  const critterPath = useMemo(() => (walk ? [...walk.points].reverse() : []), [walk]);

  // The pop-up moment: each time the camera enters a region, its set-piece
  // folds up. Never under still=1.
  const [pops, setPops] = useState<Record<string, number>>({});
  const lastActive = useRef<string | null>(null);
  useEffect(() => {
    if (active && active !== lastActive.current && !still) setPops((p) => ({ ...p, [active]: (p[active] ?? 0) + 1 }));
    lastActive.current = active;
  }, [active, still]);

  // Ready only after data, the fibre tile and our first painted frame.
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    if (!ready || !world || !fibre) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setDrawn(true)));
    return () => cancelAnimationFrame(id);
  }, [ready, world, fibre]);

  const select = useCallback((name: string) => update({ zoom: "node", focus: name }), [update]);
  const toRegion = useCallback(() => update({ zoom: "region" }), [update]);
  const toWorld = useCallback(() => update({ zoom: "overview", focus: null }), [update]);
  const toFamily = useCallback((fam: string) => {
    const atom = world ? regionAtom(world, fam) : null;
    if (atom) update({ zoom: "region", focus: atom });
  }, [world, update]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (zoom === "node") toRegion(); else if (zoom === "region") toWorld();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom, toRegion, toWorld]);

  // Click = a pointer that went down and up without dragging. Hit-test in
  // world coordinates (spots first, then the region under the pointer), so
  // drag-pan and click never fight over pointer capture.
  const down = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => { down.current = { x: e.clientX, y: e.clientY }; cam.handlers.onPointerDown(e); };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = down.current;
    down.current = null;
    cam.handlers.onPointerUp();
    if (!d || !world || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) return;
    const rect = (e.currentTarget as Element).getBoundingClientRect();
    const wx = cam.box.x + (e.clientX - rect.left) / cam.scale;
    const wy = cam.box.y + (e.clientY - rect.top) / cam.scale;
    let best: WorldNode | null = null, bestD = Infinity;
    for (const n of world.nodes) {
      const dd = Math.hypot(n.center.x - wx, n.center.y - wy);
      if (dd < (n.atom ? 36 : 22) && dd < bestD) { best = n; bestD = dd; }
    }
    if (best) { select(best.name); return; }
    const tx = Math.floor(wx / world.tile), ty = Math.floor(wy / world.tile);
    if (tx < 0 || ty < 0 || tx >= world.cols || ty >= world.rows) return;
    const r = world.regionOf[ty * world.cols + tx];
    if (r < 0) return;
    const fam = world.regions[r].family;
    if (zoom === "overview" || fam !== active) toFamily(fam);
  };

  const card = useMemo(() => {
    if (zoom !== "node" || !focusNode || !taxonomy) return null;
    return cardModel(focusNode.name, { taxonomy, evidence, runs, family: focusNode.family, depth: focusNode.depth });
  }, [zoom, focusNode, taxonomy, evidence, runs]);

  const minFont = cam.scale * 13 >= 12.5 ? 13 : cam.scale * 15 >= 12.5 ? 15 : 99;
  const models = useMemo(() => (world ? world.nodes.map((n) => n.name).sort() : []), [world]);
  const orderedNodes = useMemo(() => (world ? [...world.nodes].sort((a, b) => a.center.y - b.center.y) : []), [world]);

  // The critter stops on the road at the spot's door, never on its face.
  // An atom has no road behind it: it waits beside the castle, on the side
  // away from its name tag.
  const { park, stop } = useMemo(() => {
    if (!focusNode || !world) return { park: { x: 0, y: 0 }, stop: 1 };
    const r = focusNode.atom ? 40 : 26;
    const s = samplePolyline(critterPath);
    if (s.length > r + 4) { const k = 1 - r / s.length; return { park: s.at(k), stop: k }; }
    const tag = world.labels.find((l) => l.node === focusNode.name);
    const side = tag && tag.anchor.includes("W") ? 1 : -1;
    return { park: { x: focusNode.center.x + side * r, y: focusNode.center.y + 8 }, stop: 1 };
  }, [focusNode, critterPath, world]);

  return (
    <LabMotion still={still}>
      <div data-lab-ready={drawn ? "1" : undefined} className={`${styles.stage} relative h-full w-full overflow-hidden`}>
        <div ref={cam.ref} {...cam.handlers} onPointerDown={onPointerDown} onPointerUp={onPointerUp}
          className="absolute inset-0 touch-none select-none">
          {world && (
            <svg viewBox={cam.viewBox} className="h-full w-full" role="application" aria-label="Paper map of the model zoo">
              <PaperDefs fibre={fibre} />
              <SeaLayer world={world} />
              <LandLayer world={world} outlines={outlines} fibre={Boolean(fibre)} />
              <DecorLayer world={world} />
              <RoadLayer world={world} lineage={lineage} />
              <BridgeLayer world={world} />
              {world.regions.map((r) => (
                <SetPiece key={r.id} world={world} region={r} pop={pops[r.family] ?? 0} still={still} />
              ))}
              <g>
                {orderedNodes.filter((n) => n.name !== focus && !kin?.names.includes(n.name)).map((n) => (
                  <Spot key={n.name} node={n} state={states[n.name]} focused={false} onSelect={select} />
                ))}
              </g>
              {kin && (
                <>
                  <LabelLayer world={world} minFont={minFont} focus={null} only={kin.others} />
                  <rect x={cam.box.x - 10} y={cam.box.y - 10} width={cam.box.w + 20} height={cam.box.h + 20} fill={PAPER.die} opacity={0.5} />
                  <RoadLayer world={world} lineage={lineage} only={kin.roads} />
                  <BridgeLayer world={world} only={kin.roads} />
                </>
              )}
              <g>
                {orderedNodes.filter((n) => n.name !== focus && kin?.names.includes(n.name)).map((n) => (
                  <Spot key={n.name} node={n} state={states[n.name]} focused={false} onSelect={select} />
                ))}
                {focusNode && focus && <Spot key={`f-${focus}`} node={focusNode} state={states[focus]} focused onSelect={select} />}
              </g>
              {focusNode && focus && <PaperCritter key={focus} path={critterPath} stop={stop} still={still} park={park} />}
              <LabelLayer world={world} minFont={minFont} focus={focus} only={kin?.names} />
              {zoom === "overview" && cam.scale >= 0.5 && <SignLayer world={world} scale={cam.scale} minFont={minFont} />}
            </svg>
          )}
        </div>

        <PaperHud zoom={zoom} family={active} focus={focus} models={models}
          families={world ? world.regions.map((r) => r.family) : []}
          onWorld={toWorld} onRegion={toRegion} onFamily={toFamily} onFind={select} />
        {zoom !== "node" && <PaperKey hideOnMobile={false} startOpen={zoom === "overview"} />}
        {card && <PaperCard card={card} still={still} onPick={select} onClose={toRegion} />}
        {!world && (
          <p className={`${styles.card} absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl px-4 py-3 text-[15px]`}>
            Unfolding the map… waiting for the model server on port 8000.
          </p>
        )}
      </div>
    </LabMotion>
  );
}
