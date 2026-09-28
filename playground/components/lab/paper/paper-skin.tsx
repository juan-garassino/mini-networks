"use client";

// Papercraft overworld skin (/lab/paper), round 2. Wiring: URL view → useWorld
// → camera → paint world geometry → screen-space tags → lesson booklet →
// data-lab-ready → window.__lab. Every position comes from lib/world; every
// mark is declared in encoding.ts (eggs included).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ferryRoute, parkingSpot, pathToAtom, samplePolyline, type Box, type Pt, type World, type WorldNode,
} from "@/lib/world";
import { useWorld } from "@/hooks/use-world";
import { useLabView, type Zoom } from "@/components/lab/shared/url-state";
import { LabMotion } from "@/components/lab/shared/still";
import { fitBox, useCamera, type CamBox } from "@/components/lab/shared/camera";
import { cardModel, evidenceState, type EvidenceState } from "@/components/lab/shared/card-model";
import {
  forwardPassOrder, forwardPassSchedule, GROKKING_EGG, stationCounts, useCritterClicks, useKonami,
  useLiveTraining, useLongFocus, useRealLossCurve,
} from "@/components/lab/shared/eggs";
import { fibreTile, octagon, pts, regionOutlines } from "./geometry";
import { BridgeLayer, Flag, LandLayer, PaperDefs, RoadLayer, SeaLayer, Spot, SPOT_R } from "./map-layers";
import { PIECE_TOP, pieceAnchor } from "./set-pieces";
import { FerryVoyage, HarbourPiers, SecretIslands, Train } from "./flavour";
import { Billboards, worldBills, type Bill } from "./billboards";
import { diorama, TILT } from "./diorama";
import { PaperCritter } from "./critter";
import { PaperCard } from "./card";
import { PaperHud, PaperKey } from "./hud";
import { PaperTags } from "./tags";
import { CritterTraining, GrokkingNote, Note, RuinNote } from "./eggs";
import { familyName, inkOf, PAPER } from "./encoding";
import { ArtDefs } from "./art";
import styles from "./paper.module.css";

const CARD_W = 430 + 24 + 24;        // desktop booklet width + margins (screen px)
const SHEET = 0.45;                   // phone bottom sheet height fraction
const MAX_NODE_SCALE = 1.6;           // screen px per world px in the node view
const DIM = "rgba(24,32,52,0.27)";    // node view: everything off the family tree steps back one value

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

/** Fit `t` into the screen part not covered by chrome, then grow to the
 *  full viewport so the camera box covers the whole screen. */
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
 *  itself (phone; the booklet lists the lineage). */
function nodeBox(world: World, node: WorldNode, desktop: boolean): CamBox {
  const tight = world.camera.nodes[node.name].box;
  const kin = desktop ? world.nodes.filter((n) => node.parents.includes(n.name) || n.parents.includes(node.name)) : [];
  const pad = 80;
  const around = union([tight, ...kin.map((n) => ({ x: n.center.x - pad, y: n.center.y - pad, w: pad * 2, h: pad * 2 }))]);
  const minW = tight.w * (desktop ? 2.6 : 1.7), minH = tight.h * (desktop ? 2.6 : 1.7);
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
  const counts = useMemo(() => stationCounts(runs), [runs]);
  const countKey = JSON.stringify(counts);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableCounts = useMemo(() => counts, [countKey]);

  const focusNode = world && view?.focus ? world.nodes.find((n) => n.name === view.focus) : undefined;
  const zoom: Zoom = view && focusNode ? view.zoom : "overview";
  const active = zoom !== "overview" && focusNode ? focusNode.family : null;
  const focus = zoom !== "overview" && focusNode ? focusNode.name : null;
  const desktop = vp.w >= 640;

  // HUD height = top inset for every camera target (nothing framed under it)
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
    const top = hudH + 8;
    if (zoom === "node" && focusNode) {
      return frame(nodeBox(world, focusNode, desktop), vp.w, vp.h,
        { top, right: desktop ? CARD_W : 0, bottom: desktop ? 0 : vp.h * SHEET }, MAX_NODE_SCALE);
    }
    if (zoom === "region" && focusNode) return frame(world.camera.regions[focusNode.family], vp.w, vp.h, { top, right: 0, bottom: 0 });
    const p = 24;
    return frame({ x: overviewBox.x - p, y: overviewBox.y - p, w: overviewBox.w + p * 2, h: overviewBox.h + p * 2 }, vp.w, vp.h,
      { top: desktop ? 0 : top, right: 0, bottom: 0 });
  }, [world, overviewBox, zoom, focusNode, vp.w, vp.h, hudH, desktop]);

  // zoom-out reaches the secret islands (camera.all), never further
  const cam = useCamera({ world: world?.camera.all ?? target, target, still, minWidth: 260 });

  // Semantic zoom (quantised so memoised layers re-render only on a step):
  // at the whole-map zoom atoms/capitals hold a ~48px octagon, derived models
  // shrink to small dots that grow back into spots as you zoom in, and
  // set-pieces / mountains / harbours scale up so each island reads as a place.
  const q = (v: number) => Math.round(v * 20) / 20;
  const zk = useMemo(() => {
    const sc = cam.scale;
    return {
      atom: q(Math.min(2.2, Math.max(1, 48 / (63 * sc)))),
      derived: q(Math.min(1, Math.max(0.45, (sc - 0.4) / 0.3))),
      place: q(Math.min(1.7, Math.max(1, 0.75 / sc))),
    };
  }, [cam.scale >= 0 ? q(cam.scale) : 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // The diorama: the flat map is the ground plane, tilted away from the
  // viewer (CSS perspective); stand-up props are billboards at projected bases.
  const dio = useMemo(() => diorama(Math.max(1, cam.size.w), Math.max(1, cam.size.h), TILT), [cam.size.w, cam.size.h]);
  const place = useCallback((p: Pt) => {
    const f = { x: (p.x - cam.box.x) * cam.scale, y: (p.y - cam.box.y) * cam.scale };
    const q = dio.project(f);
    return { x: q.x, y: q.y, k: q.k * cam.scale };
  }, [dio, cam.box.x, cam.box.y, cam.scale]);
  const camKey = `${cam.box.x.toFixed(1)},${cam.box.y.toFixed(1)},${cam.box.w.toFixed(1)},${cam.size.w},${cam.size.h}`;
  const groundBox = `${cam.box.x + dio.ground.x / cam.scale} ${cam.box.y + dio.ground.y / cam.scale} ${dio.ground.w / cam.scale} ${dio.ground.h / cam.scale}`;

  // hover / keyboard focus: region view lifts that spot's family tree
  const [hovered, setHovered] = useState<string | null>(null);
  const hoverNode = zoom === "region" && hovered && world ? world.nodes.find((n) => n.name === hovered) : undefined;
  const treeNode = zoom === "node" ? focusNode : hoverNode;

  const walk = useMemo(() => (world && focus ? pathToAtom(world, focus) : null), [world, focus]);
  const treeName = treeNode?.name ?? focus;
  const treeWalk = useMemo(() => (world && treeName ? pathToAtom(world, treeName) : null), [world, treeName]);
  const lineage = useMemo(() => {
    if (!treeWalk) return [];
    const ids: string[] = [];
    for (let i = 0; i + 1 < treeWalk.nodes.length; i++) ids.push(`${treeWalk.nodes[i + 1]}->${treeWalk.nodes[i]}`);
    return ids;
  }, [treeWalk]);
  const kin = useMemo(() => {
    if (!world || !treeNode) return null;
    const names = new Set<string>([treeNode.name, ...treeNode.parents, ...(treeWalk?.nodes ?? [])]);
    for (const n of world.nodes) if (n.parents.includes(treeNode.name)) names.add(n.name);
    const roads = world.roads
      .filter((r) => r.to === treeNode.name || r.from === treeNode.name || lineage.includes(r.id))
      .map((r) => r.id);
    return { names: [...names], roads };
  }, [world, treeNode, treeWalk, lineage]);
  const loud = useMemo(() => (kin ? kin.names : focus ? [focus] : []), [kin, focus]);

  // Critter: walks the roads from the root atom, parks at parkingSpot.
  const park = useMemo(() => (world && focus ? parkingSpot(world, focus) : null), [world, focus]);
  const critterPath = useMemo(() => (walk ? [...walk.points].reverse() : []), [walk]);
  const stop = useMemo(() => {
    if (!park || critterPath.length < 2) return 1;
    const s = samplePolyline(critterPath);
    let best = 1, bd = Infinity;
    for (let i = 0; i <= 200; i++) {
      const p = s.at(i / 200);
      const d = Math.hypot(p.x - park.x, p.y - park.y);
      if (d < bd - 0.01) { bd = d; best = i / 200; }
    }
    return best;
  }, [park, critterPath]);

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

  const [comp, setComp] = useState<string | null>(null);
  const [ruin, setRuin] = useState<string | null>(null);
  const select = useCallback((name: string) => { setComp(null); setRuin(null); update({ zoom: "node", focus: name }); }, [update]);
  const toRegion = useCallback(() => { setComp(null); update({ zoom: "region" }); }, [update]);
  const toWorld = useCallback(() => { setComp(null); update({ zoom: "overview", focus: null }); }, [update]);
  const toFamily = useCallback((fam: string) => {
    const atom = world ? regionAtom(world, fam) : null;
    if (atom) update({ zoom: "region", focus: atom });
  }, [world, update]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (ruin) setRuin(null); else if (zoom === "node") toRegion(); else if (zoom === "region") toWorld();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom, toRegion, toWorld, ruin]);

  // ── eggs ─────────────────────────────────────────────────────────────
  const critter = useCritterClicks(7);
  const clickRef = useRef(critter.click);
  useEffect(() => { clickRef.current = critter.click; }, [critter.click]);
  const trainCurve = useRealLossCurve(runs, critter.unlocked);
  useEffect(() => { critter.reset(); /* a new focus is a new critter walk */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  const grokHeld = useLongFocus(!still && hovered === GROKKING_EGG.model ? GROKKING_EGG.model : null, GROKKING_EGG.holdMs);

  const [konami, setKonami] = useState(0);
  const schedule = useMemo(() => (world ? forwardPassSchedule(forwardPassOrder(world), 450) : {}), [world]);
  const konamiDone = useMemo(() => Math.max(0, ...Object.values(schedule)) + 1100, [schedule]);
  useKonami(() => setKonami((k) => k + 1), !still);
  const [konamiOn, setKonamiOn] = useState(false);
  useEffect(() => {
    if (!konami) return;
    setKonamiOn(true);
    const id = setTimeout(() => setKonamiOn(false), konamiDone);
    return () => clearTimeout(id);
  }, [konami, konamiDone]);

  const live = useLiveTraining(runs);
  const trains = useMemo(() => (world ? live.map((m) => ({ m, line: [...pathToAtom(world, m).points].reverse() })) : []), [world, live]);

  const ferry = useMemo(() => {
    if (!world || !comp || !taxonomy) return null;
    const c = taxonomy.compositions.find((x) => x.name === comp);
    return c ? ferryRoute(world, c.composes).points : null;
  }, [world, comp, taxonomy]);

  // Click = pointer down/up without a drag. Hit-test in world coordinates:
  // critter, spots, ruins, then the region under the pointer.
  const down = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => { down.current = { x: e.clientX, y: e.clientY }; cam.handlers.onPointerDown(e); };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = down.current;
    down.current = null;
    cam.handlers.onPointerUp();
    if (!d || !world || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) return;
    const rect = (e.currentTarget as Element).getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    // the critter stands up: hit-test it in screen space around its body
    if (park) {
      const c = place(park);
      if (Math.abs(sx - c.x) < 22 * c.k && sy < c.y + 4 && sy > c.y - 46 * c.k) { critter.click(); return; }
    }
    const flat = dio.unproject({ x: sx, y: sy });
    const wx = cam.box.x + flat.x / cam.scale;
    const wy = cam.box.y + flat.y / cam.scale;
    let best: WorldNode | null = null, bestD = Infinity;
    for (const n of world.nodes) {
      const dd = Math.hypot(n.center.x - wx, n.center.y - wy);
      if (dd < (n.atom ? SPOT_R.atom + 6 : SPOT_R.derived + 6) && dd < bestD) { best = n; bestD = dd; }
    }
    if (best) { select(best.name); return; }
    const ri = world.ruinsIsland.slots.findIndex((p) => Math.hypot(p.x - wx, p.y - 10 - wy) < 22);
    if (ri >= 0) { setRuin(world.ruinsIsland.names[ri]); return; }
    setRuin(null);
    const tx = Math.floor(wx / world.tile), ty = Math.floor(wy / world.tile);
    if (tx < 0 || ty < 0 || tx >= world.cols || ty >= world.rows) return;
    const r = world.regionOf[ty * world.cols + tx];
    if (r < 0) return;
    const fam = world.regions[r].family;
    if (zoom === "overview" || fam !== active) toFamily(fam);
  };

  // window.__lab test hook (scripts/README-shoot.md): the real paths, animated.
  useEffect(() => {
    if (!drawn) return;
    const w = window as unknown as { __lab?: unknown };
    w.__lab = {
      select: (name: string) => select(name),
      view: (v: { zoom: Zoom; focus?: string }) => {
        const f = v.focus ?? view?.focus ?? null;
        update({ zoom: v.zoom, focus: v.zoom === "overview" ? null : f });
      },
      critterClick: (n: number) => {
        if (!park) return false;
        for (let i = 0; i < n; i++) setTimeout(() => clickRef.current(), i * 70);
      },
    };
    return () => { delete w.__lab; };
  }, [drawn, select, update, view?.focus, park]);

  const card = useMemo(() => {
    if (zoom !== "node" || !focusNode || !taxonomy) return null;
    return cardModel(focusNode.name, { taxonomy, evidence, runs, family: focusNode.family, depth: focusNode.depth });
  }, [zoom, focusNode, taxonomy, evidence, runs]);

  const models = useMemo(() => (world ? world.nodes.map((n) => n.name).sort() : []), [world]);
  const orderedNodes = useMemo(() => (world ? [...world.nodes].sort((a, b) => a.center.y - b.center.y) : []), [world]);
  const spotR = useCallback((n: string) => (world?.nodes.find((x) => x.name === n)?.atom ? SPOT_R.atom : SPOT_R.derived), [world]);
  const toScreen = (p: Pt) => { const q = place(p); return { x: q.x, y: q.y }; };
  const spotCtx = useMemo(() => ({ states, focus, hover: hovered, kin: kin?.names ?? null }), [states, focus, hovered, kin]);
  const { bills, kinBills } = useMemo(() => (world ? worldBills(world, zk, pops, still, spotCtx) : { bills: [], kinBills: [] }),
    [world, zk, pops, still, spotCtx]);
  // the champion flag stands on the focused / hovered spot only
  const flagBills = useMemo(() => {
    if (!world) return [];
    const out: Bill[] = [];
    for (const name of [focus, hovered]) {
      const n = name ? world.nodes.find((x) => x.name === name) : undefined;
      if (!n || states[n.name] !== "champion" || out.some((b) => b.key === `f-${n.name}`)) continue;
      const R = spotR(n.name) * (n.name === focus ? 1.3 : n.atom ? zk.atom : zk.derived);
      out.push({ key: `f-${n.name}`, at: { x: n.center.x + R * 0.7, y: n.center.y - R * 0.3 }, node: <Flag x={0} y={0} h={n.atom ? 40 : 30} /> });
    }
    return out;
  }, [world, focus, hovered, states, spotR, zk]);
  const grokNode = world?.nodes.find((n) => n.name === GROKKING_EGG.model);

  // solid things no name tag may cover (world px)
  const pieceBoxes = useMemo(() => (world ? world.regions.filter((r) => r.setPiece).map((r) => {
    const a = pieceAnchor(world, r);
    const tall = (PIECE_TOP[r.family] ?? 100) * a.s * zk.place;
    return { family: r.family, box: { x: a.x - 50 * a.sx * zk.place, y: a.y - tall, w: 100 * a.sx * zk.place, h: tall + 8 } };
  }) : []), [world, zk.place]);
  const obstacles = useMemo(() => {
    const out: Box[] = pieceBoxes.map((p) => p.box);
    if (park) out.push({ x: park.x - 16, y: park.y - 50, w: 32, h: 54 });
    if (focusNode && focus && states[focus] === "champion") {
      const R = spotR(focus), c = focusNode.center, h = focusNode.atom ? 36 : 26;
      out.push({ x: c.x + 0.74 * R * 1.3 - 4, y: c.y - (0.5 * R + h) * 1.3 - 4, w: h * 0.62 * 1.3 + 10, h: h * 1.3 + 6 });
    }
    return out;
  }, [pieceBoxes, park, focusNode, focus, states, spotR]);
  const regionSigns = useMemo(() => (zoom === "overview" && cam.scale >= 0.3
    ? pieceBoxes.map((p) => ({ text: familyName(p.family), color: inkOf(p.family).edge, box: p.box }))
    : null), [zoom, pieceBoxes, cam.scale >= 0.3]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <LabMotion still={still}>
      <div data-lab-ready={drawn ? "1" : undefined} className={`${styles.stage} relative h-full w-full overflow-hidden`}>
        <div ref={cam.ref} {...cam.handlers} onPointerDown={onPointerDown} onPointerUp={onPointerUp}
          className="absolute inset-0 touch-none select-none">
          {world && (
            <>
              {/* the ground plane: flat map, tilted */}
              <div className="absolute" style={{
                left: dio.ground.x, top: dio.ground.y, width: dio.ground.w, height: dio.ground.h,
                transform: dio.css.transform, transformOrigin: dio.css.transformOrigin,
              }}>
                <svg viewBox={groundBox} width={dio.ground.w} height={dio.ground.h} className="block" role="application" aria-label="Paper map of the model zoo">
                  <PaperDefs fibre={fibre} />
                  <SeaLayer world={world} />
                  <SecretIslands world={world} />
                  <HarbourPiers world={world} k={zk.place} />
                  <LandLayer world={world} outlines={outlines} fibre={Boolean(fibre)} />
                  <RoadLayer world={world} lineage={kin ? [] : lineage} loud={loud} />
                  <BridgeLayer world={world} />
                  {/* every spot stays mounted in one place (keyboard focus survives);
                      the lifted family tree is redrawn above the dim sheet as ghosts */}
                  <g>
                    {orderedNodes.filter((n) => n.name !== focus).map((n) => (
                      <Spot key={n.name} node={n} state={states[n.name]} focused={false} onSelect={select} onHover={setHovered}
                        k={n.atom ? zk.atom : zk.derived} flag={false} bare />
                    ))}
                    {focusNode && focus && <Spot key={focus} node={focusNode} state={states[focus]} focused={!kin} onSelect={select} onHover={setHovered} flag={false} bare />}
                  </g>
                  {kin && (
                    <>
                      <rect x={cam.box.x - cam.box.w} y={cam.box.y - cam.box.h} width={cam.box.w * 3} height={cam.box.h * 3} fill={DIM} pointerEvents="none" />
                      <g pointerEvents="none">
                        <RoadLayer world={world} lineage={lineage} only={kin.roads} loud={loud} />
                        <BridgeLayer world={world} only={kin.roads} />
                        {treeNode && treeNode.name !== focus && <Spot node={treeNode} state={states[treeNode.name]} focused onSelect={select} ghost flag={false} bare />}
                        {focusNode && focus && <Spot node={focusNode} state={states[focus]} focused onSelect={select} ghost flag={false} bare />}
                      </g>
                    </>
                  )}
                  {konamiOn && (
                    <g key={konami} pointerEvents="none" aria-hidden>
                      {world.nodes.map((n) => (
                        <polygon key={n.name} className={styles.pulse} style={{ animationDelay: `${schedule[n.name] ?? 0}ms` }}
                          points={pts(octagon(n.center.x, n.center.y, (n.atom ? SPOT_R.atom : SPOT_R.derived) + 6))}
                          fill="none" stroke={PAPER.gold} strokeWidth={6} />
                      ))}
                    </g>
                  )}
                </svg>
              </div>
              {/* stand-up props: billboards in screen space, far → near */}
              <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${Math.max(1, cam.size.w)} ${Math.max(1, cam.size.h)}`} aria-hidden>
                {/* node view: props off the family tree step back with the ground */}
                <ArtDefs />
                <g opacity={kin ? 0.55 : 1}><Billboards bills={bills} place={place} /></g>
                {kinBills.length > 0 && <Billboards bills={kinBills} place={place} />}
                {trains.map((t) => <Train key={t.m} line={t.line} still={still} place={place} />)}
                {ferry && focusNode && <FerryVoyage key={comp} route={ferry} dips={comp === "double_descent"} still={still} family={focusNode.family} place={place} />}
                <Billboards bills={flagBills} place={place} />
                {focusNode && focus && park && (
                  <PaperCritter key={focus} path={critterPath} stop={stop} still={still} park={park} place={place} training={critter.unlocked} />
                )}
              </svg>
            </>
          )}
        </div>

        {world && (
          <PaperTags world={world} place={place} version={camKey} size={cam.size} focus={focus} kin={kin?.names ?? null}
            counts={stableCounts} obstacles={obstacles} spotR={(n) => spotR(n) * (world.nodes.find((x) => x.name === n)?.atom ? zk.atom : zk.derived)}
            atomsOnly={zoom === "overview"} regionSigns={regionSigns} />
        )}

        {/* eggs */}
        {grokNode && hovered === GROKKING_EGG.model && !still && (
          <GrokkingNote at={toScreen({ x: grokNode.center.x, y: grokNode.center.y - SPOT_R.derived - 6 })} clicked={grokHeld} />
        )}
        {critter.unlocked && park && (
          <CritterTraining at={toScreen({ x: park.x, y: park.y - 44 })} curve={trainCurve.curve} loading={trainCurve.loading} still={still} />
        )}
        {ruin && world && (() => {
          const i = world.ruinsIsland.names.indexOf(ruin);
          const p = world.ruinsIsland.slots[i];
          return p ? <RuinNote at={toScreen({ x: p.x, y: p.y - 30 })} id={ruin} /> : null;
        })()}
        {konamiOn && (
          <Note at={{ x: vp.w / 2, y: vp.h - 40 }} width={340}>
            <p className="font-semibold">A forward pass across the whole zoo</p>
            <p className="text-[14px]">The first models light up, then every generation that builds on them, in order.</p>
          </Note>
        )}

        <PaperHud hudRef={hudRef} zoom={zoom} family={active} focus={focus} models={models}
          families={world ? world.regions.map((r) => r.family) : []}
          onWorld={toWorld} onRegion={toRegion} onFamily={toFamily} onFind={select} />
        {zoom !== "node" && <PaperKey hideOnMobile={false} startOpen={zoom === "overview"} />}
        {card && (
          <PaperCard card={card} still={still} onPick={select} onClose={toRegion}
            runs={runs} evidence={evidence} comp={comp} onComp={setComp} />
        )}
        {!world && (
          <p className={`${styles.card} absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl px-4 py-3 text-[15px]`}>
            Unfolding the map… waiting for the model server on port 8000.
          </p>
        )}
      </div>
    </LabMotion>
  );
}
