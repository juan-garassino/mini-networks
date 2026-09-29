"use client";

// Papercraft overworld skin (/lab/paper), round 2. Wiring: URL view → useWorld
// → camera → paint world geometry → screen-space tags → lesson booklet →
// data-lab-ready → window.__lab. Every position comes from lib/world; every
// mark is declared in encoding.ts (eggs included).
import { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
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
import { pieceAnchor } from "./set-pieces";
import { FerryVoyage, HarbourPiers, SecretIslands, Train } from "./flavour";
import { Billboards, SET_PIECE_H, type Bill } from "./billboards";
import { diorama, FLAT } from "./diorama";
import { PaperCritter } from "./critter";
import { PaperCard } from "./card";
import { PaperHud, PaperKey } from "./hud";
import { PaperTags } from "./tags";
import { CritterTraining, GrokkingNote, Note, RuinNote } from "./eggs";
import { familyName, inkOf, PAPER } from "./encoding";
import { ArtDefs, CompassRose, ScaleBar } from "./art";
import { buildStory, StoryGround, StoryProps, StoryRoads } from "./storybook";
import { FamilySigns, signBoxes } from "./signs";
import { biomeOf, ClearingProps, ClearingStage, ClearingVignette, SCENE_H, sceneLayout, sceneTags, Stones } from "./clearing";
import styles from "./paper.module.css";

const CARD_W = 430 + 24 + 24;        // desktop booklet width + margins (screen px)
const SHEET = 0.45;                   // phone bottom sheet height fraction
const MAX_NODE_SCALE = 1.6;           // screen px per world px in the node view
const DIM = "rgba(24,32,52,0.27)";    // node view: everything off the family tree steps back one value

/** Scene tags: below each member, else above it, else culled; focus first. */
function placeSceneTags(tags: { name: string; atom: boolean; at: Pt; text: string }[], toS: (p: Pt) => Pt,
  focus: string | null, vp: { w: number; h: number }, blocks: Box[] = []) {
  const out: { t: (typeof tags)[number]; p: Pt }[] = [];
  const boxes: Box[] = [...blocks];
  const order = [...tags].sort((a, b) => Number(b.name === focus) - Number(a.name === focus) || Number(b.atom) - Number(a.atom));
  for (const t of order) {
    const f = t.atom ? 16 : 14, w = 0.56 * f * t.text.length + 18, h = 26;
    const below = toS(t.at), above = toS({ x: t.at.x, y: t.at.y - (t.atom ? 150 : 84) });
    for (const p of [below, above]) {
      const b = { x: p.x - w / 2, y: p.y, w, h };
      if (b.x < 8 || b.x + w > vp.w - 8 || b.y < 8 || b.y + h > vp.h - 8) continue;
      if (boxes.some((o) => b.x < o.x + o.w + 3 && o.x < b.x + b.w + 3 && b.y < o.y + o.h + 2 && o.y < b.y + b.h + 2)) continue;
      boxes.push(b); out.push({ t, p });
      break;
    }
  }
  return out;
}

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
  const { world, taxonomy, evidence, runs, ready } = useWorld(view ? view.still : null, "paper");

  const [fibre, setFibre] = useState<string | null>(null);
  useEffect(() => { setFibre(fibreTile()); }, []);

  const [vp, setVp] = useState({ w: 1440, h: 900 });
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  const story = useMemo(() => (world ? buildStory(world) : null), [world]);
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
    if (!desktop) {
      // phone: the whole map would be ~0.3× (8px spots) — frame the central 60%
      // of the land instead; drag to see the rest
      const w = overviewBox.w * 0.6, cx = overviewBox.x + overviewBox.w / 2, cy = overviewBox.y + overviewBox.h / 2;
      return frame({ x: cx - w / 2, y: cy - w * 0.9, w, h: w * 1.8 }, vp.w, vp.h, { top, right: 0, bottom: 56 });
    }
    return frame({ x: overviewBox.x - p, y: overviewBox.y - p, w: overviewBox.w + p * 2, h: overviewBox.h + p * 2 }, vp.w, vp.h,
      { top: 0, right: 0, bottom: 0 });
  }, [world, overviewBox, zoom, focusNode, vp.w, vp.h, hudH, desktop]);

  // zoom-out reaches the secret islands (camera.all), never further
  const cam = useCamera({ world: world?.camera.all ?? target, target, still, minWidth: 260 });

  // Semantic zoom (quantised so memoised layers re-render only on a step):
  // at the whole-map zoom atoms/capitals hold a ~48px octagon, derived models
  // shrink to small dots that grow back into spots as you zoom in, and
  // set-pieces / mountains / harbours scale up so each island reads as a place.
  // The zoom factors follow the SETTLED scale (the camera's destination, then
  // debounced after drags/wheel), never the per-frame tween: rebuilding ~10k
  // SVG nodes on every quantum step stalled the fly-to.
  const q = (v: number) => Math.round(v * 20) / 20;
  // Rebuilt only once the camera has rested (220ms after the last frame), and
  // as a transition so the rebuild never blocks a camera frame.
  const [settled, setSettled] = useState(cam.scale);
  useEffect(() => {
    const id = setTimeout(() => startTransition(() => setSettled(cam.scale)), still ? 0 : 220);
    return () => clearTimeout(id);
  }, [cam.scale, still]);
  const zk = useMemo(() => {
    const sc = settled;
    return {
      atom: q(Math.min(2.2, Math.max(1, 48 / (63 * sc)))),
      derived: q(Math.min(1, Math.max(0.45, (sc - 0.4) / 0.3))),
      place: q(Math.min(1.7, Math.max(1, 0.75 / sc))),
    };
  }, [q(settled)]); // eslint-disable-line react-hooks/exhaustive-deps

  // The diorama: the flat map is the ground plane, tilted away from the
  // viewer (CSS perspective); stand-up props are billboards at projected bases.
  const dio = useMemo(() => diorama(Math.max(1, cam.size.w), Math.max(1, cam.size.h), FLAT), [cam.size.w, cam.size.h]);
  const place = useCallback((p: Pt) => {
    const f = { x: (p.x - cam.box.x) * cam.scale, y: (p.y - cam.box.y) * cam.scale };
    const q = dio.project(f);
    return { x: q.x, y: q.y, k: q.k * cam.scale };
  }, [dio, cam.box.x, cam.box.y, cam.scale]);
  const camKey = `${cam.box.x.toFixed(1)},${cam.box.y.toFixed(1)},${cam.box.w.toFixed(1)},${cam.size.w},${cam.size.h}`;
  // The heavy layers (ground ~thousands of paths, ~1000 billboards) render at
  // the camera's REST pose only; while the camera moves they are moved by a
  // single CSS transform (exact for the flat ground, near-exact for props),
  // and re-rendered once it rests. Name tags are placed at rest too.
  const [rest, setRest] = useState({ key: camKey, box: cam.box, scale: cam.scale });
  useEffect(() => {
    const now = { key: camKey, box: cam.box, scale: cam.scale };
    if (still) { setRest(now); return; }
    const id = setTimeout(() => startTransition(() => setRest(now)), 140);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camKey, still]);
  const restKey = rest.key;
  const moving = restKey !== camKey;
  // The camera has LANDED on its target: the lesson card and the node-view
  // lift/dim mount only then, so nothing heavy mounts mid-flight.
  const landed = useMemo(() => {
    if (moving) return false;
    const f = fitBox(target, Math.max(1, cam.size.w), Math.max(1, cam.size.h));
    return Math.abs(f.x - rest.box.x) < 2 && Math.abs(f.y - rest.box.y) < 2 && Math.abs(f.w - rest.box.w) < 2;
  }, [moving, target, cam.size.w, cam.size.h, rest]);
  const restPlace = useCallback((p: Pt) => {
    const f = { x: (p.x - rest.box.x) * rest.scale, y: (p.y - rest.box.y) * rest.scale };
    const q = dio.project(f);
    return { x: q.x, y: q.y, k: q.k * rest.scale };
  }, [dio, rest]);
  // flat-space delta rest → now: f_now = f_rest·k + d
  const fk = cam.scale / Math.max(1e-6, rest.scale);
  const fd = { x: (rest.box.x - cam.box.x) * cam.scale, y: (rest.box.y - cam.box.y) * cam.scale };
  const groundCss = moving
    ? `translate(${dio.ground.x * fk + fd.x - dio.ground.x}px, ${dio.ground.y * fk + fd.y - dio.ground.y}px) scale(${fk})`
    : undefined;
  // screen-space delta for the billboards, fitted at two points near the centre
  const propCss = useMemo(() => {
    if (!moving) return undefined;
    const a = { x: cam.box.x + cam.box.w / 2, y: cam.box.y + cam.box.h * 0.6 }, b = { x: a.x + cam.box.w / 4, y: a.y };
    const ra = restPlace(a), rb = restPlace(b), na = place(a), nb = place(b);
    const k = Math.hypot(nb.x - na.x, nb.y - na.y) / Math.max(1e-6, Math.hypot(rb.x - ra.x, rb.y - ra.y));
    return `translate(${na.x - ra.x * k}px, ${na.y - ra.y * k}px) scale(${k})`;
  }, [moving, cam.box, restPlace, place]);
  const groundBox = `${rest.box.x + dio.ground.x / rest.scale} ${rest.box.y + dio.ground.y / rest.scale} ${dio.ground.w / rest.scale} ${dio.ground.h / rest.scale}`;

  // hover / keyboard focus: region view lifts that spot's family tree
  const [hovered, setHovered] = useState<string | null>(null);
  const hoverNode = zoom === "region" && hovered && world ? world.nodes.find((n) => n.name === hovered) : undefined;
  // sticky: once landed for this view, panning away keeps the card open
  const [landedFor, setLandedFor] = useState<string | null>(null);
  const viewKey = `${zoom}:${focus}`;
  useEffect(() => { if (landed) setLandedFor(viewKey); }, [landed, viewKey]);
  const arrived = still || landedFor === viewKey;
  const treeNode = zoom === "node" ? (arrived ? focusNode : undefined) : hoverNode;

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
    // two frames after the data (the map is painted) — with a timer fallback:
    // headless virtual time can starve rAF while the card mounts
    let inner = 0;
    const id = requestAnimationFrame(() => { inner = requestAnimationFrame(() => setDrawn(true)); });
    const t = setTimeout(() => setDrawn(true), 150);
    return () => { cancelAnimationFrame(id); cancelAnimationFrame(inner); clearTimeout(t); };
  }, [ready, world, fibre]);

  const [comp, setComp] = useState<string | null>(null);
  const [ruin, setRuin] = useState<string | null>(null);
  // the clearing fades in only after the learner navigates (no fade on page load)
  const navigated = useRef(false);
  const go = useCallback((v: Parameters<typeof update>[0]) => { navigated.current = true; update(v); }, [update]);
  const select = useCallback((name: string) => { setComp(null); setRuin(null); go({ zoom: "node", focus: name }); }, [go]);
  const toRegion = useCallback(() => { setComp(null); go({ zoom: "region" }); }, [go]);
  const toWorld = useCallback(() => { setComp(null); go({ zoom: "overview", focus: null }); }, [go]);
  const toFamily = useCallback((fam: string) => {
    const atom = world ? regionAtom(world, fam) : null;
    if (atom) go({ zoom: "region", focus: atom });
  }, [world, go]);

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
    const ri = world.ruinsIsland.slots.findIndex((p) => Math.hypot(p.x - wx, p.y - 14 - wy) < Math.max(28, 18 / cam.scale));
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
        go({ zoom: v.zoom, focus: v.zoom === "overview" ? null : f });
      },
      critterClick: (n: number) => {
        if (!park) return false;
        for (let i = 0; i < n; i++) setTimeout(() => clickRef.current(), i * 70);
      },
    };
    return () => { delete w.__lab; };
  }, [drawn, select, update, view?.focus, park]);

  // ── the region SCENE (biome clearing) ─────────────────────────────────
  const [sceneFam, setSceneFam] = useState<string | null>(null);
  useEffect(() => {
    if (zoom === "overview") { setSceneFam(null); return; }
    if (still || arrived) setSceneFam(active);
  }, [zoom, active, still, arrived]);
  const sceneOn = zoom !== "overview" && !!active && (sceneFam === active || still);
  const aspect = vp.w / Math.max(1, vp.h);
  const lay = useMemo(() => (world && active ? sceneLayout(world, active, aspect) : null), [world, active, aspect]);
  const sk = vp.h / SCENE_H;                       // scene unit → px
  const sceneZoom = useMemo(() => {
    if (!lay || zoom !== "node" || !focus) return { z: 1, tx: 0, ty: 0 };
    const m = lay.members.find((x) => x.node.name === focus);
    if (!m) return { z: 1, tx: 0, ty: 0 };
    const z = desktop ? 1.15 : 1.3;
    const target = desktop ? { x: (vp.w - CARD_W) / 2, y: vp.h * 0.56 } : { x: vp.w / 2, y: vp.h * 0.3 };
    // the forest floor extends past the scene, so the focus can always be centred
    return { z, tx: target.x - m.at.x * sk * z, ty: target.y - m.at.y * sk * z };
  }, [lay, zoom, focus, desktop, vp.w, vp.h, sk]);
  const sceneToScreen = useCallback((p: Pt) => ({ x: p.x * sk * sceneZoom.z + sceneZoom.tx, y: p.y * sk * sceneZoom.z + sceneZoom.ty }), [sk, sceneZoom]);
  const sceneWalk = useMemo(() => (lay && walk ? [...walk.points].reverse().map(lay.map) : []), [lay, walk]);
  const scenePark = useMemo(() => {
    const m = lay && focus ? lay.members.find((x) => x.node.name === focus) : undefined;
    return m ? { x: m.at.x - (m.node.atom ? 74 : 40), y: m.at.y + 6 } : null;
  }, [lay, focus]);
  const trailRoads = useMemo(() => new Set(lineage), [lineage]);

  const card = useMemo(() => {
    if (zoom !== "node" || !focusNode || !taxonomy) return null;
    return cardModel(focusNode.name, { taxonomy, evidence, runs, family: focusNode.family, depth: focusNode.depth });
  }, [zoom, focusNode, taxonomy, evidence, runs]);

  const models = useMemo(() => (world ? world.nodes.map((n) => n.name).sort() : []), [world]);
  const orderedNodes = useMemo(() => (world ? [...world.nodes].sort((a, b) => a.center.y - b.center.y) : []), [world]);
  const spotR = useCallback((n: string) => (world?.nodes.find((x) => x.name === n)?.atom ? SPOT_R.atom : SPOT_R.derived), [world]);
  const toScreen = (p: Pt) => {
    if (sceneOn && lay) {
      const m = world?.nodes.find((n) => Math.hypot(n.center.x - p.x, n.center.y - p.y) < 60 && n.family === active);
      if (m) { const a = lay.members.find((x) => x.node.name === m.name)!.at; return sceneToScreen({ x: a.x, y: a.y - 60 }); }
    }
    const q = place(p); return { x: q.x, y: q.y };
  };
  const zkLazy = useDeferredValue(zk);
  // (the storybook map draws its stand-ups in world space: StoryProps)
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
    const tall = SET_PIECE_H * zk.place, wide = tall * 0.95;
    return { family: r.family, box: { x: a.x - wide / 2, y: a.y - tall, w: wide, h: tall + 8 } };
  }) : []), [world, zk.place]);
  const obstacles = useMemo(() => {
    const out: Box[] = zoom === "overview" && world ? signBoxes(world, Math.min(2.2, Math.max(1, (1 / Math.max(0.3, settled)) * 1.15))) : [];
    if (park) out.push({ x: park.x - 16, y: park.y - 50, w: 32, h: 54 });
    if (focusNode && focus && states[focus] === "champion") {
      const R = spotR(focus), c = focusNode.center, h = focusNode.atom ? 36 : 26;
      out.push({ x: c.x + 0.74 * R * 1.3 - 4, y: c.y - (0.5 * R + h) * 1.3 - 4, w: h * 0.62 * 1.3 + 10, h: h * 1.3 + 6 });
    }
    return out;
  }, [park, focusNode, focus, states, spotR, zoom, world, settled]);
  // chrome no tag may sit under: the HUD, and the foreground tree's canopy
  const chrome = useMemo(() => {
    const out: Box[] = [];
    if (hudH) out.push({ x: 0, y: 0, w: desktop ? 460 : vp.w, h: hudH + 6 });
    if (zoom === "overview") {
      out.push({ x: 0, y: vp.h - 120, w: 230, h: 120 });               // compass + scale bar
      out.push({ x: vp.w - 130, y: vp.h - 60, w: 130, h: 60 });        // map key button
    }
    return out;
  }, [hudH, desktop, zoom, vp.w, vp.h]);
  const regionSigns = useMemo(() => (zoom === "overview" && cam.scale >= 0.3
    ? pieceBoxes.map((p) => ({ text: familyName(p.family), color: inkOf(p.family).edge, box: p.box }))
    : null), [zoom, pieceBoxes, cam.scale >= 0.3]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <LabMotion still={still}>
      <div data-lab-ready={drawn ? "1" : undefined} className={`${styles.stage} relative h-full w-full overflow-hidden`}>
        <div ref={cam.ref} {...cam.handlers} onPointerDown={onPointerDown} onPointerUp={onPointerUp}
          className="absolute inset-0 touch-none select-none">
          {world && story && (
            <>
              {/* the ground plane: flat map, tilted */}
              <div className="absolute" style={{
                left: dio.ground.x, top: dio.ground.y, width: dio.ground.w, height: dio.ground.h,
                transform: dio.css.transform, transformOrigin: dio.css.transformOrigin,
              }}>
                <svg viewBox={groundBox} width={dio.ground.w} height={dio.ground.h} className="block" role="application" aria-label="Paper map of the model zoo"
                  style={{ transform: groundCss, transformOrigin: "0 0" }}>
                  <PaperDefs fibre={fibre} />
                  <ArtDefs />
                  <StoryGround world={world} story={story} />
                  <SecretIslands world={world} />
                  <StoryRoads story={story} trail={kin ? kin.roads.filter((r) => lineage.includes(r)) : lineage} />
                  <StoryProps world={world} story={story} states={states} focus={zoom === "overview" ? null : focus} />
                  <FamilySigns world={world} show={zoom === "overview"} scale={1 / Math.max(0.3, settled)} />
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
                      <rect x={rest.box.x - rest.box.w * 2} y={rest.box.y - rest.box.h * 2} width={rest.box.w * 5} height={rest.box.h * 5} fill={DIM} pointerEvents="none" />
                      <g pointerEvents="none">
                        <StoryRoads story={story} trail={lineage} />
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
              <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${Math.max(1, cam.size.w)} ${Math.max(1, cam.size.h)}`} aria-hidden
                style={{ transform: propCss, transformOrigin: "0 0" }}>
                {/* node view: props off the family tree step back with the ground */}
                <ArtDefs />

              </svg>
              {/* small live pieces follow the camera every frame */}
              <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${Math.max(1, cam.size.w)} ${Math.max(1, cam.size.h)}`} aria-hidden>
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

        {sceneOn && lay && (
          <div className={`${styles.scene} absolute inset-0 z-[6] overflow-hidden`} key={lay.family}
            style={{ animation: still || !navigated.current ? "none" : undefined, background: biomeOf(lay.family).floor }}>
            <div className="absolute left-0 top-0" style={{
              width: vp.w, height: vp.h, transformOrigin: "0 0",
              transform: `translate(${sceneZoom.tx}px, ${sceneZoom.ty}px) scale(${sceneZoom.z})`,
              transition: still ? "none" : "transform 650ms cubic-bezier(0.33, 1, 0.68, 1)",
            }}>
              <svg viewBox={`0 0 ${lay.W} ${lay.H}`} width={vp.w} height={vp.h} preserveAspectRatio="xMidYMid slice" role="application" style={{ overflow: "visible" }}
                aria-label={`${familyName(lay.family)} clearing`}>
                <ArtDefs />
                <PaperDefs fibre={fibre} />
                <ClearingStage lay={lay} />
                {lay.stones.map((st) => <Stones key={st.road} pts={st.pts} ramp={biomeOf(lay.family).stone} trail={trailRoads.has(st.road)} />)}
                {lay.exits.map((x) => <Stones key={x.family} pts={x.stones} ramp={biomeOf(lay.family).stone} trail={false} />)}
                <ClearingProps lay={lay} states={states} focus={focus} dimOthers={zoom === "node"} kin={kin?.names ?? null}
                  onHover={setHovered} onSelect={select} onExit={toFamily} />
                {focus && scenePark && (
                  <g>
                    <PaperCritter key={`s-${focus}`} path={sceneWalk} still={still} park={scenePark} place={(p) => ({ x: p.x, y: p.y, k: 1.1 })} training={critter.unlocked} />
                    <circle cx={scenePark.x} cy={scenePark.y - 24} r={26} fill="transparent" style={{ cursor: "pointer" }} onClick={() => critter.click()} />
                  </g>
                )}
                <ClearingVignette lay={lay} />
              </svg>
            </div>
            {/* name tags + keyboard targets for every member */}
            {placeSceneTags(sceneTags(lay), sceneToScreen, focus, vp, lay.exits.map((x) => {
              const w = (11.2 * (familyName(x.family).length + 3) + 28) * 1.1, a = sceneToScreen({ x: x.at.x - w / 2, y: x.at.y - 58 }), b = sceneToScreen({ x: x.at.x + w / 2, y: x.at.y });
              return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
            })).map(({ t, p }) => {
              const hot = t.name === focus;
              const f = t.atom ? 16 : 14;
              const w = 0.56 * f * t.text.length + 18;
              const muted = zoom === "node" && kin && !kin.names.includes(t.name);
              return (
                <button key={t.name} type="button" onClick={() => select(t.name)}
                  onFocus={() => setHovered(t.name)} onBlur={() => setHovered(null)}
                  className={`${styles.chip} absolute whitespace-nowrap rounded-md px-2 leading-6 focus-visible:outline-3 focus-visible:outline-[#2B2118]`}
                  style={{ left: p.x - w / 2, top: p.y, fontSize: f, fontWeight: t.atom ? 600 : 500,
                    background: hot ? PAPER.ink : PAPER.die, color: hot ? PAPER.die : PAPER.ink, opacity: muted ? 0.6 : 1 }}>
                  {t.text}
                </button>
              );
            })}
          </div>
        )}

        {/* storybook furniture: compass rose + scale bar with the real pipeline count */}
        {world && zoom === "overview" && (
          <svg aria-hidden className="pointer-events-none absolute bottom-2 left-3 z-[4]" width={240} height={124} viewBox="0 0 240 124">
            <ArtDefs />
            <CompassRose x={48} y={50} r={34} />
            <ScaleBar x={160} y={88} w={110} label={`${taxonomy?.compositions.length ?? 22} pipelines`} />
          </svg>
        )}
        {world && !sceneOn && (
          <PaperTags world={world} place={place} version={restKey} hidden={moving} size={cam.size} focus={focus} kin={kin?.names ?? null}
            counts={stableCounts} obstacles={obstacles} spotR={(n) => spotR(n) * (world.nodes.find((x) => x.name === n)?.atom ? zk.atom : zk.derived)}
            atomsOnly={!desktop} regionSigns={null}
            screenObstacles={chrome} />
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

        <PaperHud hudRef={hudRef} storybook zoom={zoom} family={active} focus={focus} models={models}
          families={world ? world.regions.map((r) => r.family) : []}
          onWorld={toWorld} onRegion={toRegion} onFamily={toFamily} onFind={select} />
        {zoom === "overview" && <div className="absolute bottom-0 right-0 z-10"><PaperKey hideOnMobile={false} startOpen={zoom === "overview"} /></div>}
        {card && arrived && (
          <PaperCard card={card} still={still} onPick={select} onClose={toRegion}
            runs={runs} evidence={evidence} comp={comp} onComp={setComp} ready={drawn} />
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
