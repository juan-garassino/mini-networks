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
const SHEET = 0.45;                   // mobile bottom sheet height fraction
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

interface Insets { top: number; right: number; bottom: number }

/** Fit `t` into the part of the screen not covered by chrome (HUD on top,
 *  card on the right, sheet at the bottom), then grow it to the full viewport
 *  so the camera box covers the whole screen. */
function frame(t: CamBox, vw: number, vh: number, inset: Insets, maxScale = Infinity): CamBox {
  const avail = { w: Math.max(200, vw - inset.right), h: Math.max(160, vh - inset.top - inset.bottom) };
  let f = fitBox(t, avail.w, avail.h);
  if (avail.w / f.w > maxScale) {
    const k = (avail.w / f.w) / maxScale;
    f = { x: f.x + f.w / 2 - (f.w * k) / 2, y: f.y + f.h / 2 - (f.h * k) / 2, w: f.w * k, h: f.h * k };
  }
  const scale = avail.w / f.w;
  return { x: f.x, y: f.y - inset.top / scale, w: vw / scale, h: vh / scale };
}

/** Camera box for a node: its lineage neighbourhood (desktop) or the spot
 *  itself (phone, so its tags stay ≥13px; the card lists the lineage). */
function nodeBox(world: World, node: WorldNode, desktop: boolean): CamBox {
  const tight = world.camera.nodes[node.name].box;
  const kin = desktop ? world.nodes.filter((n) => node.parents.includes(n.name) || n.parents.includes(node.name)) : [];
  const pad = 70;
  const around = union([tight, ...kin.map((n) => ({ x: n.center.x - pad, y: n.center.y - pad, w: pad * 2, h: pad * 2 }))]);
  const minW = tight.w * (desktop ? 2.5 : 1.5), minH = tight.h * (desktop ? 2.5 : 1.5);
  const cx = around.x + around.w / 2, cy = around.y + around.h / 2;
  const w = Math.max(around.w, minW), h = Math.max(around.h, minH);
  return { x: cx - w / 2, y: cy - h / 2, w, h };
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

  // The HUD's measured height is a top inset for every camera target, so no
  // tag or spot is framed under it.
  const [hudH, setHudH] = useState(0);
  const hudRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = hudRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHudH(Math.round(el.getBoundingClientRect().bottom)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const overviewBox = useMemo(() => (world ? union(Object.values(world.camera.regions)) : null), [world]);
  const target: CamBox = useMemo(() => {
    if (!world || !overviewBox) return { x: 0, y: 0, w: 1, h: 1 };
    const desktop = vp.w >= 640;
    const top = hudH + 8;
    if (zoom === "node" && focusNode) {
      return frame(nodeBox(world, focusNode, desktop), vp.w, vp.h,
        { top, right: desktop ? CARD_W : 0, bottom: desktop ? 0 : vp.h * SHEET }, MAX_NODE_SCALE);
    }
    if (zoom === "region" && focusNode) return frame(world.camera.regions[focusNode.family], vp.w, vp.h, { top, right: 0, bottom: 0 });
    const p = 24;
    // whole map: the HUD sits over open sea in the corner, and the full
    // height keeps atom tags ≥13px — no inset on desktop
    return frame({ x: overviewBox.x - p, y: overviewBox.y - p, w: overviewBox.w + p * 2, h: overviewBox.h + p * 2 }, vp.w, vp.h,
      { top: desktop ? 0 : top, right: 0, bottom: 0 });
  }, [world, overviewBox, zoom, focusNode, vp.w, vp.h, hudH]);

  const cam = useCamera({ world: world?.camera.world ?? target, target, still, minWidth: 200 });

  // Hovering / keyboard-focusing a spot in the region view lifts its family
  // tree the same way the node view does.
  const [hovered, setHovered] = useState<string | null>(null);
  const hoverNode = zoom === "region" && hovered && world ? world.nodes.find((n) => n.name === hovered) : undefined;
  const treeNode = zoom === "node" ? focusNode : hoverNode;

  // Lineage: roads on the walk back to the root atom (of the tree's model,
  // else of the focus).
  const walk = useMemo(() => (world && focus ? pathToAtom(world, focus) : null), [world, focus]);
  const treeName = treeNode?.name ?? focus;
  const treeWalk = useMemo(() => (world && treeName ? pathToAtom(world, treeName) : null), [world, treeName]);
  const lineage = useMemo(() => {
    if (!treeWalk) return [];
    const ids: string[] = [];
    for (let i = 0; i + 1 < treeWalk.nodes.length; i++) ids.push(`${treeWalk.nodes[i + 1]}->${treeWalk.nodes[i]}`);
    return ids;
  }, [treeWalk]);
  // The family tree (parents, children, the walk back to its atom) is lifted
  // above a sheet of vellum laid over the map.
  const kin = useMemo(() => {
    if (!world || !treeNode) return null;
    const names = new Set<string>([treeNode.name, ...treeNode.parents, ...(treeWalk?.nodes ?? [])]);
    for (const n of world.nodes) if (n.parents.includes(treeNode.name)) names.add(n.name);
    const roads = world.roads
      .filter((r) => r.to === treeNode.name || r.from === treeNode.name || lineage.includes(r.id))
      .map((r) => r.id);
    const others = world.labels.map((l) => l.node).filter((n) => !names.has(n));
    return { names: [...names], roads, others };
  }, [world, treeNode, treeWalk, lineage]);
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
              {/* every spot stays mounted in one place (keyboard focus survives the
                  vellum); the lifted family tree is redrawn above it as ghosts */}
              <g>
                {orderedNodes.filter((n) => n.name !== focus).map((n) => (
                  <Spot key={n.name} node={n} state={states[n.name]} focused={false} onSelect={select}
                    onHover={zoom === "region" ? setHovered : undefined} />
                ))}
                {focusNode && focus && <Spot key={focus} node={focusNode} state={states[focus]} focused onSelect={select}
                  onHover={zoom === "region" ? setHovered : undefined} />}
              </g>
              {kin && (
                <>
                  <LabelLayer world={world} minFont={minFont} focus={null} only={kin.others} />
                  <rect x={cam.box.x - 10} y={cam.box.y - 10} width={cam.box.w + 20} height={cam.box.h + 20} fill={PAPER.die} opacity={0.5} pointerEvents="none" />
                  <g pointerEvents="none">
                    <RoadLayer world={world} lineage={lineage} only={kin.roads} />
                    <BridgeLayer world={world} only={kin.roads} />
                    {orderedNodes.filter((n) => kin.names.includes(n.name)).map((n) => (
                      <Spot key={n.name} node={n} state={states[n.name]} focused={n.name === focus || n.name === treeNode?.name}
                        onSelect={select} ghost />
                    ))}
                  </g>
                </>
              )}
              {focusNode && focus && <PaperCritter key={focus} path={critterPath} stop={stop} still={still} park={park} />}
              <LabelLayer world={world} minFont={minFont} focus={focus} only={kin?.names} />
              {zoom === "overview" && cam.scale >= 0.5 && <SignLayer world={world} scale={cam.scale} minFont={minFont} />}
            </svg>
          )}
        </div>

        <PaperHud hudRef={hudRef} zoom={zoom} family={active} focus={focus} models={models}
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
