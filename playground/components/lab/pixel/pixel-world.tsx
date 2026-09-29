"use client";

// Skin B · 16-bit overworld (round 2). One <canvas> blits the cached,
// autotiled terrain (terrain.ts) at an integer zoom (view.ts) and draws the
// live layer: the focused lineage in gold with chevrons, the focused model on
// a plinth at +1 scale, the quest route, the critter, sailing ferries,
// running trains and the Konami wave. DOM overlays carry every word on pixel
// name-plates placed in SCREEN space (placeScreenLabels, constant size).
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ferryRoute, lineage, parkingSpot, pathToAtom, placeScreenLabels, samplePolyline,
  type Pt, type World, type WorldNode,
} from "@/lib/world";
import { useWorld } from "@/hooks/use-world";
import { useLesson } from "@/hooks/use-lesson";
import { useLabView, type Zoom } from "@/components/lab/shared/url-state";
import { LabMotion } from "@/components/lab/shared/still";
import { useCamera, type CamBox } from "@/components/lab/shared/camera";
import { cardModel, displayName, evidenceState } from "@/components/lab/shared/card-model";
import { CRITTER } from "@/components/lab/shared/critter";
import {
  DOUBLE_DESCENT_EGG, GROKKING_EGG, NEXT_ERA, NEXT_ERA_COPY, RUINS, dipDepth, forwardPassOrder, forwardPassSchedule,
  stationCounts, useKonami, useLiveTraining, useLongFocus, useRealLossCurve,
} from "@/components/lab/shared/eggs";
import { Sparkline } from "@/components/lab/shared/lesson/sparkline";
import type { ModelEvidence, TaxonomyResponse } from "@/lib/types";
import { familyLabel } from "./palette";
import type { NodeLook } from "./terrain";
import { artFlipX, artToCanvas, critterSheet, emblemMasks, props, RAMPS, PALETTE, type Sprite } from "./art";
import { buildArtLayers, chevronOffsets, islandSlots, nodeSprite, regionCut, roadPolys, type ArtEmblems, type ArtLayers } from "./world-art";
import { snapTile, toScreen, xformFor, type Stage, type Xform } from "./view";
import { StatusCard } from "./status-card";
import { placeSigns, type Rect } from "./signs";
import { Legend } from "./legend";
import { TitleWindow } from "./title-window";
import { PixelWindow } from "./window";
import { PixelNum } from "./pixel-num";
import styles from "./pixel.module.css";

const CARD_W = 400 + 16 + 8;
const SHEET = 0.52;
const MOBILE_TOP = 112;
const MOBILE_KEY = 60;
const TITLE_GUTTER = 120;
const TS = 16;
const hex = (i: number) => PALETTE[i];
const GOLD = hex(RAMPS.gold[3]), INK = hex(RAMPS.ui[0]);
// each parent of the focus gets its own lit colour (primary first); children are foam-white
export const PARENT_TONES = [hex(RAMPS.gold[3]), hex(RAMPS.shallow[4]), hex(RAMPS.meadow[6]), hex(RAMPS.lava[2])];
const CHILD_TONE = hex(RAMPS.foam[1]);
/** A sprite as a canvas with its anchor (art px). */
type Stamp = { c: HTMLCanvasElement; ax: number; ay: number };
const stamp = (s: Sprite, flip = false): Stamp => ({ c: artToCanvas(flip ? artFlipX(s.img) : s.img), ax: flip ? s.img.w - 1 - s.anchor.x : s.anchor.x, ay: s.anchor.y });

export function looksFrom(world: World | null, evidence: ModelEvidence[], taxonomy?: TaxonomyResponse | null): Map<string, NodeLook> {
  const m = new Map<string, NodeLook>();
  if (!world) return m;
  for (const n of world.nodes) {
    const ev = evidence.find((e) => e.name === n.name);
    const state = evidenceState(ev);
    const mech = taxonomy?.models.find((x) => x.name === n.name)?.introduces[0];
    m.set(n.name, { state, filled: state === "champion" || (ev?.run_count ?? 0) > 0, mech });
  }
  return m;
}

function padBox(b: CamBox, f: number, c: Pt): CamBox {
  const w = b.w * f, h = b.h * f;
  return { x: c.x - w / 2, y: c.y - h / 2, w, h };
}

/** Region zoom: fit the region's nodes (+labels) at ≥×2, cover-style, pulled toward the focus. */
function regionTarget(world: World, focus: WorldNode, stage: Stage): CamBox {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const grow = (b: CamBox) => { x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); };
  for (const n of world.nodes) if (n.family === focus.family) grow({ x: n.foot.x * TS, y: n.foot.y * TS, w: n.foot.w * TS, h: n.foot.h * TS });
  const bw = x1 - x0 + 64, bh = y1 - y0 + 64;
  const sw = Math.max(stage.w, 2), sh = Math.max(stage.h, 2);
  const k = Math.max(1, snapTile(Math.min(sw / bw, sh / bh)) / 16);
  const w = sw / k, h = sh / k;
  const clamp = (c: number, f: number, half: number) => Math.min(Math.max(c, f - half * 0.55), f + half * 0.55);
  const cx = clamp((x0 + x1) / 2, focus.center.x, w / 2), cy = clamp((y0 + y1) / 2, focus.center.y, h / 2);
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

const hit = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export function PixelWorld() {
  const { view, update } = useLabView();
  const still = view?.still ?? true;
  const { world, taxonomy, evidence, runs, ready } = useWorld(view ? view.still : null);

  // ——— viewport & stage ———
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [vp, setVp] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setVp({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const mobile = vp.w > 0 && vp.w < 640;

  const nodeOf = useMemo(() => new Map((world?.nodes ?? []).map((n) => [n.name, n])), [world]);
  const focusNode: WorldNode | undefined = view?.focus ? nodeOf.get(view.focus) : undefined;
  const zoom: Zoom = view?.zoom ?? "overview";
  const cardOpen = zoom === "node" && !!focusNode;

  const stage: Stage = useMemo(() => {
    if (mobile && zoom === "overview") return { x: 0, y: MOBILE_TOP, w: vp.w, h: Math.max(120, vp.h - MOBILE_TOP - MOBILE_KEY) };
    if (zoom === "overview" && vp.w >= 1200) return { x: TITLE_GUTTER, y: 0, w: vp.w - TITLE_GUTTER, h: vp.h };
    if (!cardOpen) return { x: 0, y: 0, w: vp.w, h: vp.h };
    return mobile ? { x: 0, y: 0, w: vp.w, h: Math.round(vp.h * (1 - SHEET)) } : { x: 0, y: 0, w: Math.max(200, vp.w - CARD_W), h: vp.h };
  }, [cardOpen, mobile, zoom, vp.w, vp.h]);

  const target: CamBox = useMemo(() => {
    if (!world) return { x: 0, y: 0, w: 1, h: 1 };
    if (zoom === "node" && focusNode) return padBox(world.camera.nodes[focusNode.name].box, 2.2, focusNode.center);
    if (zoom === "region" && focusNode) return regionTarget(world, focusNode, stage);
    return world.camera.world;
  }, [world, zoom, focusNode, stage]);

  const cam = useCamera({ world: world?.camera.all ?? target, target, still, minWidth: 180 });
  const xf: Xform = xformFor(cam.box, stage, 32);

  // ——— identity: species emblems (async raster), evidence looks, cached layers ———
  const [emblems, setEmblems] = useState<ArtEmblems | null>(null);
  useEffect(() => {
    if (!taxonomy) return;
    let alive = true;
    const names = [...taxonomy.models.map((m) => m.name), ...taxonomy.compositions.map((c) => c.name)];
    emblemMasks(names, [7, 9]).then((e) => { if (alive) setEmblems(e); });
    return () => { alive = false; };
  }, [taxonomy]);

  const looks = useMemo(() => looksFrom(world, evidence, taxonomy), [world, evidence, taxonomy]);
  const lookSig = useMemo(() => [...looks].map(([k, v]) => `${k}:${v.state}:${v.filled}`).join(","), [looks]);
  const [layers, setLayers] = useState<ArtLayers | null>(null);
  useEffect(() => {
    if (!world || !ready || !emblems) return;
    setLayers(buildArtLayers(world, looks, emblems));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, ready, lookSig, emblems]);

  const regionId = zoom === "region" && focusNode ? world?.regions.find((r) => r.family === focusNode.family)?.id ?? -1 : -1;
  const spot = useMemo(() => (layers && regionId >= 0 ? regionCut(layers, regionId) : null), [layers, regionId]);

  // ——— focus: lineage + the loud sprite ———
  const lin = useMemo(() => (world && focusNode ? lineage(world, focusNode.name) : null), [world, focusNode]);
  const kin = useMemo(() => new Set(lin ? [...lin.parents.map((r) => r.from), ...lin.children.map((r) => r.to)] : []), [lin]);
  const kinTone = useMemo(() => new Map<string, string>(lin
    ? [...lin.children.map((r) => [r.to, CHILD_TONE] as [string, string]), ...lin.parents.map((r, i) => [r.from, PARENT_TONES[i % PARENT_TONES.length]] as [string, string])]
    : []), [lin]);
  const polys = useMemo(() => (world ? new Map(roadPolys(world).map((p) => [p.road.id, p.pts])) : new Map<string, Pt[]>()), [world]);
  const focusSprite = useMemo(() => {
    if (!focusNode || !emblems || typeof document === "undefined") return null;
    const look = looks.get(focusNode.name) ?? { state: "untrained" as const, filled: false };
    return stamp(nodeSprite(focusNode, look, emblems));
  }, [focusNode, emblems, looks]);

  // ——— live-layer sprites ———
  const critter = useMemo(() => {
    if (typeof document === "undefined") return null;
    const sh = critterSheet();
    return { right: sh.walk.map((f) => stamp(f)), left: sh.walk.map((f) => stamp(f, true)), idle: stamp(sh.idle[0], true), train: stamp(sh.train, true), w: sh.walk[0].img.w, h: sh.walk[0].img.h };
  }, []);
  const small = useMemo(() => {
    if (typeof document === "undefined") return null;
    return { boat: stamp(props.boat()), boatL: stamp(props.boat(true)), train: stamp(props.train(0)), trainL: stamp(props.train(0), true) };
  }, []);

  // ——— motion: one rAF driver while anything is animating ———
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const animate = !still && !reduced;
  const drawRef = useRef<(now?: number) => void>(() => {});
  const active = useRef(new Set<string>());
  const rafId = useRef(0);
  const loop = useCallback(() => {
    if (rafId.current) return;
    const step = (now: number) => {
      rafId.current = 0;
      drawRef.current(now);
      if (active.current.size) rafId.current = requestAnimationFrame(step);
    };
    rafId.current = requestAnimationFrame(step);
  }, []);
  const startAnim = useCallback((k: string) => { active.current.add(k); loop(); }, [loop]);
  const stopAnim = useCallback((k: string) => { active.current.delete(k); }, []);
  useEffect(() => () => cancelAnimationFrame(rafId.current), []);

  // critter: walk from the root atom to the focused model, park at parkingSpot (never on the spot)
  const walk = useRef<{ at: (t: number) => Pt & { angle: number }; len: number; t0: number; speed: number; park: Pt } | null>(null);
  useEffect(() => {
    if (!world || !focusNode) { walk.current = null; drawRef.current(); return; }
    const park = parkingSpot(world, focusNode.name);
    const path = pathToAtom(world, focusNode.name);
    const pts = [...path.points].reverse();
    if (pts.length > 1) pts[pts.length - 1] = { x: park.x, y: park.y };
    const s = samplePolyline(pts.length > 1 ? pts : [park, park]);
    // the critter sets off once the camera has landed (fly ≈ 700ms) and takes ≥1.6s,
    // so the walk is the one orchestrated moment after a selection
    const LAND = 750;
    const speed = Math.min(Math.max(120, s.length / 3.2), Math.max(60, s.length / 1.6));
    walk.current = { at: s.at, len: s.length, t0: performance.now() + LAND, speed, park };
    if (!animate || s.length < 1) { walk.current.t0 = -1e9; drawRef.current(); return; }
    startAnim("walk");
    const done = setTimeout(() => stopAnim("walk"), LAND + (s.length / speed) * 1000 + 100);
    return () => { clearTimeout(done); stopAnim("walk"); };
  }, [world, focusNode, animate, startAnim, stopAnim]);

  // ferry: a selected composition sails its route (double_descent dips twice)
  const [sailing, setSailing] = useState<string | null>(null);
  useEffect(() => { setSailing(null); }, [focusNode?.name]);
  const sail = useRef<{ pts: Pt[]; at: (t: number) => Pt & { angle: number }; len: number; t0: number; dd: boolean } | null>(null);
  useEffect(() => {
    if (!world || !taxonomy || !sailing) { sail.current = null; drawRef.current(); return; }
    const comp = taxonomy.compositions.find((c) => c.name === sailing);
    if (!comp) return;
    const route = ferryRoute(world, comp.composes);
    let pts = route.points;
    const dd = sailing === DOUBLE_DESCENT_EGG.composition;
    if (dd) {
      // the double-descent egg: the course dips twice (dipDepth), crest at the interpolation threshold
      const s0 = samplePolyline(pts);
      pts = Array.from({ length: 80 }, (_, i) => {
        const t = i / 79, p = s0.at(t);
        const amp = 42 * dipDepth(t);
        return { x: p.x - Math.sin(p.angle) * amp, y: p.y + Math.cos(p.angle) * amp };
      });
    }
    const s = samplePolyline(pts);
    sail.current = { pts, at: s.at, len: s.length, t0: animate ? performance.now() : -1e9, dd };
    if (!animate) { drawRef.current(); return; }
    startAnim("sail");
    const done = setTimeout(() => stopAnim("sail"), (s.length / 220) * 1000 + 200);
    return () => { clearTimeout(done); stopAnim("sail"); };
  }, [world, taxonomy, sailing, animate, startAnim, stopAnim]);

  // trains = live training: a train runs the lineage line of every model with a running run
  const live = useLiveTraining(runs);
  const stations = useMemo(() => stationCounts(runs), [runs]);
  const trains = useMemo(() => (world ? live.map((m) => {
    const p = pathToAtom(world, m);
    return { model: m, ...samplePolyline([...p.points].reverse()) };
  }).filter((t) => t.length > 0) : []), [world, live]);
  // no live run right now → one engine waits, parked, at the busiest station (most logged runs)
  const parked = useMemo(() => {
    if (!world || live.length) return null;
    const best = Object.entries(stations).filter(([m]) => world.nodes.some((n) => n.name === m)).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0];
    if (!best) return null;
    const road = world.roads.find((r) => r.to === best[0] && r.lanePoints.length > 1) ?? world.roads.find((r) => r.from === best[0] && r.lanePoints.length > 1);
    if (!road) return null;
    const s = samplePolyline(road.lanePoints);
    const t = road.to === best[0] ? Math.max(0, 1 - 40 / Math.max(s.length, 1)) : Math.min(1, 40 / Math.max(s.length, 1));
    return { model: best[0], runs: best[1], at: s.at(t) };
  }, [world, live, stations]);
  useEffect(() => {
    if (!trains.length || !animate) { drawRef.current(); return; }
    startAnim("trains");
    return () => stopAnim("trains");
  }, [trains, animate, startAnim, stopAnim]);

  // Konami: a forward pass across the zoo in generation order
  const konami = useRef<{ t0: number; at: Record<string, number>; end: number } | null>(null);
  const onKonami = useCallback(() => {
    if (!world || !animate) return;
    const at = forwardPassSchedule(forwardPassOrder(world), 450);
    konami.current = { t0: performance.now(), at, end: Math.max(...Object.values(at)) + 900 };
    startAnim("konami");
    setTimeout(() => { stopAnim("konami"); konami.current = null; drawRef.current(); }, konami.current.end + 50);
  }, [world, animate, startAnim, stopAnim]);
  useKonami(onKonami, animate);

  // critter egg: 7 clicks → it trains on a REAL loss curve
  // counter in refs (no stale closures between rapid clicks); the real curve is
  // prefetched once per session so the bubble fills within ~1s of the 7th click
  const clicks = useRef({ n: 0, last: 0 });
  const [critterUnlocked, setCritterUnlocked] = useState(false);
  const critterEgg = useMemo(() => ({
    click: () => {
      const now = Date.now();
      clicks.current.n = now - clicks.current.last <= 2500 ? clicks.current.n + 1 : 1;
      clicks.current.last = now;
      if (clicks.current.n >= 7) setCritterUnlocked(true);
    },
  }), []);
  const realCurve = useRealLossCurve(runs, !still && ready);
  const [trainT, setTrainT] = useState(0);
  useEffect(() => {
    if (!critterUnlocked) { setTrainT(0); return; }
    if (!realCurve.curve || !animate) { setTrainT(realCurve.curve ? 1 : 0); return; }
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => { const t = Math.min(1, (now - t0) / 2600); setTrainT(t); if (t < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [realCurve.curve, animate, critterUnlocked]);

  // grokking egg: hold (hover / keyboard focus) the grokking spot 4 s
  const [hovered, setHovered] = useState<string | null>(null);
  const grokked = useLongFocus(!still && hovered === GROKKING_EGG.model ? hovered : null, GROKKING_EGG.holdMs);
  const [epitaph, setEpitaph] = useState<string | null>(null);
  const [teaser, setTeaser] = useState<string | null>(null);

  // ——— canvas painting ———
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawn, setDrawn] = useState(false);
  const kinSprites = useMemo(() => {
    if (!world || !emblems || !lin || typeof document === "undefined") return null;
    const names = [...new Set([...lin.parents.map((r) => r.from), ...lin.children.map((r) => r.to)])];
    return new Map(names.map((name) => {
      const m = nodeOf.get(name)!;
      const look = looks.get(name) ?? { state: "untrained" as const, filled: false };
      return [name, { s: stamp(nodeSprite(m, look, emblems)), node: m }] as const;
    }));
  }, [world, emblems, lin, looks, nodeOf]);
  const latest = useRef({ xf, layers, spot, focusNode, vp, critter, small, lin, polys, focusSprite, zoom, trains, nodeOf, cardOpen, stage, kinSprites, world, parked });
  latest.current = { xf, layers, spot, focusNode, vp, critter, small, lin, polys, focusSprite, zoom, trains, nodeOf, cardOpen, stage, kinSprites, world, parked };

  const draw = useCallback((nowArg?: number) => {
    const c = canvasRef.current;
    const L = latest.current;
    if (!c || !L.layers || L.vp.w === 0) return;
    const now = nowArg ?? performance.now();
    const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
    const W = L.vp.w * dpr, H = L.vp.h * dpr;
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const dimAll = (L.zoom === "node" && !!L.focusNode) || (!!L.spot && L.zoom === "region");
    ctx.fillStyle = hex(dimAll ? RAMPS.ocean[2] : RAMPS.ocean[3]); // sea beyond the art extent matches the (dimmed) layer
    ctx.fillRect(0, 0, W, H);
    const { tile, ox, oy, k } = L.xf;
    const S = (q: Pt) => ({ x: (q.x * k + ox) * dpr, y: (q.y * k + oy) * dpr });
    // art px on screen: tile/8 (full layer), far layer (÷2) at tile 4
    const far = tile < 8;
    const ap = (far ? tile / 4 : tile / 8) * dpr;
    // focus steps everything else back ONE ramp step (colour math, no veil):
    // node view → whole map one step darker, the lineage redrawn loud on top;
    // region view → the region's land is cut back in at full value along its coast.
    const stepBack = (L.zoom === "node" && !!L.focusNode) || (!!L.spot && L.zoom === "region" && !far);
    const Ly = L.layers;
    const layer = far ? (stepBack ? Ly.farDim : Ly.far) : (stepBack ? Ly.dim : Ly.full);
    const o = S(Ly.origin);
    ctx.drawImage(layer, Math.round(o.x), Math.round(o.y), layer.width * ap, layer.height * ap);
    if (L.spot && L.zoom === "region" && !far) ctx.drawImage(L.spot, Math.round(o.x), Math.round(o.y), L.spot.width * ap, L.spot.height * ap);
    const u = Math.max(1, tile / 8) * dpr;   // one art px on screen (≥1)
    const bs = Math.max(2, tile / 8) * dpr;  // UI marks never smaller than ×2
    const n = L.focusNode;
    const drawStamp = (st: Stamp, at: Pt, scale: number) => {
      const q = S(at);
      ctx.drawImage(st.c, Math.round(q.x - st.ax * scale), Math.round(q.y - st.ay * scale), st.c.width * scale, st.c.height * scale);
    };
    const footOf = (m: WorldNode): Pt => ({ x: m.center.x, y: (m.foot.y + m.foot.h) * TS });

    // node view: the direct kin come back at full value (their own sprites)
    if (n && L.zoom === "node" && !far && L.kinSprites) for (const { s: st, node } of L.kinSprites.values()) drawStamp(st, footOf(node), u);

    // the focused lineage: every parent road (own colour, primary gold) and child road (white),
    // each on its own lane, ink-edged, with ink chevrons parent → child
    if (L.lin && L.zoom === "node" && !far) {
      const lit = [
        ...L.lin.children.map((r) => [r, CHILD_TONE] as const),
        ...L.lin.parents.map((r, i) => [r, PARENT_TONES[i % PARENT_TONES.length]] as const).reverse(),
      ];
      for (const [r, tone] of lit) {
        const pts = L.polys.get(r.id) ?? [];
        for (const [size, col] of [[3 * u, INK], [u, tone]] as [number, string][]) {
          ctx.fillStyle = col;
          for (let i = 1; i < pts.length; i++) {
            const a = pts[i - 1], b = pts[i];
            const len = Math.hypot(b.x - a.x, b.y - a.y), step = 1 / Math.max(k, 0.25);
            for (let d = 0; d <= len; d += step) {
              const q = S({ x: a.x + ((b.x - a.x) * d) / len, y: a.y + ((b.y - a.y) * d) / len });
              ctx.fillRect(Math.round(q.x - size / 2), Math.round(q.y - size / 2), Math.round(size), Math.round(size));
            }
          }
        }
        if (tile >= 16) for (const ch of r.chevrons) {
          const c0 = S(ch);
          ctx.fillStyle = INK;
          ctx.fillStyle = tone;
          for (const [x, y] of chevronOffsets(ch.angle, 2)) ctx.fillRect(Math.round(c0.x + x * u - u / 2), Math.round(c0.y + y * u - u / 2), Math.ceil(u), Math.ceil(u));
        }
      }
    }

    // harbours: up to 3 big boats per dock (one per pipeline), the rest counted on a plate
    if (L.small && tile >= 8 && L.world) for (const h of L.world.harbours) {
      const nB = Math.min(tile >= 24 ? 3 : 1, h.boats); // overview: one boat + ×N plate (quieter coasts)
      const st = L.small.boat, sc = Math.max(u, 2 * dpr);
      for (let i = 0; i < nB; i++) {
        const q = S(h.pt);
        const x = q.x + (i - (nB - 1) / 2) * (st.c.width + 2) * sc;
        ctx.drawImage(st.c, Math.round(x - st.ax * sc), Math.round(q.y - st.ay * sc), st.c.width * sc, st.c.height * sc);
      }
    }

    // quest route: the critter's walk from the root atom, dotted in gold behind it
    const w = walk.current;
    // rAF timestamps can precede t0 → clamp at 0
    const walked = w ? Math.max(0, Math.min(w.len, w.t0 < 0 ? w.len : ((now - w.t0) / 1000) * w.speed)) : 0;
    if (w && tile >= 16 && w.len > 0) {
      for (let d = 20; d <= walked - 20; d += 16) {
        const s = S(w.at(d / w.len));
        const x = Math.round(s.x - 2 * bs / 2), y = Math.round(s.y - 2 * bs / 2);
        ctx.fillStyle = INK; ctx.fillRect(x, y, 2 * bs, 2 * bs);
        ctx.fillStyle = CHILD_TONE; ctx.fillRect(x + bs / 2, y + bs / 2, bs, bs);
      }
    }

    // focus: plinth + the model's own sprite one scale step louder + gold corner brackets
    if (n && L.focusSprite && !far) {
      const fs = u + dpr;
      const st = L.focusSprite;
      const foot = S(footOf(n));
      const sw = st.c.width * fs, sh = st.c.height * fs;
      const left = foot.x - st.ax * fs, top = foot.y - st.ay * fs;
      const pw = sw + 6 * bs;
      ctx.fillStyle = INK; ctx.fillRect(Math.round(foot.x - pw / 2), Math.round(foot.y), Math.round(pw), Math.round(3 * bs));
      ctx.fillStyle = GOLD; ctx.fillRect(Math.round(foot.x - pw / 2 + bs), Math.round(foot.y + bs / 2), Math.round(pw - 2 * bs), Math.round(bs));
      ctx.drawImage(st.c, Math.round(left), Math.round(top), sw, sh);
      const x0 = left - 3 * bs, y0 = top - 3 * bs, x1 = left + sw + 3 * bs, y1 = foot.y + 4 * bs, arm = 5 * bs, th = bs;
      for (const [cx, cy, dx, dy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]] as const) {
        ctx.fillStyle = INK;
        ctx.fillRect(Math.round(dx > 0 ? cx - th : cx - arm), Math.round(dy > 0 ? cy - th : cy - 2 * th), Math.round(arm + th), Math.round(3 * th));
        ctx.fillRect(Math.round(dx > 0 ? cx - th : cx - 2 * th), Math.round(dy > 0 ? cy - th : cy - arm), Math.round(3 * th), Math.round(arm + th));
        ctx.fillStyle = GOLD;
        ctx.fillRect(Math.round(dx > 0 ? cx : cx - arm + th), Math.round(dy > 0 ? cy : cy - th), Math.round(arm - th), Math.round(th));
        ctx.fillRect(Math.round(dx > 0 ? cx : cx - th), Math.round(dy > 0 ? cy : cy - arm + th), Math.round(th), Math.round(arm - th));
      }
    }

    // ferry sailing a composition
    const sl = sail.current;
    if (sl && L.small && tile >= 8) {
      ctx.fillStyle = CHILD_TONE;
      for (let d = 0; d <= sl.len; d += 10) { const s = S(sl.at(d / sl.len)); ctx.fillRect(Math.round(s.x - bs / 2), Math.round(s.y - bs / 2), bs, bs); }
      const t = sl.t0 < 0 ? 0 : Math.min(1, ((now - sl.t0) / 1000) * 220 / Math.max(sl.len, 1));
      const q = sl.at(t), s = S(q);
      const st = Math.cos(q.angle) < 0 ? L.small.boatL : L.small.boat;
      const sc = Math.max(u, 2 * dpr);
      ctx.drawImage(st.c, Math.round(s.x - st.ax * sc), Math.round(s.y - st.ay * sc), st.c.width * sc, st.c.height * sc);
    }
    // no live run: the engine waits, parked, at the busiest station
    if (L.small && tile >= 8 && L.parked) {
      const q = L.parked.at, s = S(q);
      const st = Math.cos(q.angle) < 0 ? L.small.trainL : L.small.train;
      const sc = Math.max(u, 2 * dpr);
      ctx.drawImage(st.c, Math.round(s.x - st.ax * sc), Math.round(s.y - st.ay * sc), st.c.width * sc, st.c.height * sc);
    }

    // trains on the rails of models that are training right now
    if (L.small && tile >= 8) for (const tr of L.trains) {
      const t = animate ? ((now / 1000) * 120 / tr.length) % 1 : 0.5;
      const q = tr.at(t), s = S(q);
      const st = Math.cos(q.angle) < 0 ? L.small.trainL : L.small.train;
      const sc = Math.max(u, 2 * dpr);
      ctx.drawImage(st.c, Math.round(s.x - st.ax * sc), Math.round(s.y - st.ay * sc), st.c.width * sc, st.c.height * sc);
    }
    // no live run: the engine waits, parked, at the busiest station
    if (L.small && tile >= 8 && L.parked) {
      const q = L.parked.at, s = S(q);
      const st = Math.cos(q.angle) < 0 ? L.small.trainL : L.small.train;
      const sc = Math.max(u, 2 * dpr);
      ctx.drawImage(st.c, Math.round(s.x - st.ax * sc), Math.round(s.y - st.ay * sc), st.c.width * sc, st.c.height * sc);
    }

    // Konami forward pass: each generation lights up in turn
    const kz = konami.current;
    if (kz) {
      const el = now - kz.t0;
      for (const [name, at] of Object.entries(kz.at)) {
        const m = L.nodeOf.get(name);
        if (!m || el < at || el > at + 700) continue;
        const a = S({ x: m.foot.x * TS - 6, y: m.foot.y * TS - 6 }), b = S({ x: (m.foot.x + m.foot.w) * TS + 6, y: (m.foot.y + m.foot.h) * TS + 6 });
        const th = Math.max(2, bs);
        ctx.fillStyle = GOLD;
        ctx.fillRect(Math.round(a.x), Math.round(a.y), Math.round(b.x - a.x), th); ctx.fillRect(Math.round(a.x), Math.round(b.y - th), Math.round(b.x - a.x), th);
        ctx.fillRect(Math.round(a.x), Math.round(a.y), th, Math.round(b.y - a.y)); ctx.fillRect(Math.round(b.x - th), Math.round(a.y), th, Math.round(b.y - a.y));
      }
    }

    // the critter
    if (w && L.critter && tile >= 16) {
      const arrived = walked >= w.len - 0.5;
      const q = arrived ? w.park : w.at(walked / Math.max(w.len, 1));
      const s = S(q);
      const dir = arrived ? -1 : Math.cos(w.at(walked / Math.max(w.len, 1)).angle) < 0 ? -1 : 1;
      const step = arrived ? 0 : Math.floor(walked / 7) % 4;
      const st = arrived ? L.critter.idle : (dir < 0 ? L.critter.left : L.critter.right)[step];
      const cu = Math.max(dpr, u - dpr);    // the critter reads one step smaller than the map art
      const hopY = now - hop.current < 200 ? -3 * cu : 0;
      ctx.drawImage(st.c, Math.round(s.x - st.ax * cu), Math.round(s.y - st.ay * cu + hopY), st.c.width * cu, st.c.height * cu);
    }
    if (!drawn) setDrawn(true);
  }, [drawn, animate]);
  drawRef.current = draw;
  useLayoutEffect(() => { draw(); });

  // ——— interaction ———
  const go = useCallback((name: string) => update({ zoom: "node", focus: name }), [update]);
  const back = useCallback(() => {
    if (zoom === "node") update({ zoom: "region" });
    else if (zoom === "region") update({ zoom: "overview" });
  }, [zoom, update]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") back(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [back]);

  const press = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);
  const onPointerDown = (e: React.PointerEvent) => { press.current = { x: e.clientX, y: e.clientY }; moved.current = false; cam.handlers.onPointerDown(e); };
  const onPointerMove = (e: React.PointerEvent) => {
    const p = press.current;
    if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) >= 4) moved.current = true;
    cam.handlers.onPointerMove(e);
  };
  const onPointerUp = () => { press.current = null; cam.handlers.onPointerUp(); };
  const onNode = (name: string) => { if (!moved.current) go(name); };

  // test hook for scripts/shoot.mjs --motion (real interaction paths only)
  const critterClickRef = useRef(critterEgg.click);
  critterClickRef.current = critterEgg.click;
  // each click: the critter hops (the answer to the action), and the egg counter advances
  const hop = useRef(0);
  const onCritter = useCallback(() => {
    critterClickRef.current();
    hop.current = performance.now();
    if (animate) { startAnim("hop"); setTimeout(() => { stopAnim("hop"); drawRef.current(); }, 220); }
  }, [animate, startAnim, stopAnim]);
  useEffect(() => {
    if (!drawn || !ready) return;
    const w = window as unknown as { __lab?: unknown };
    w.__lab = {
      select: (name: string) => go(name),
      view: (v: { zoom: Zoom; focus?: string }) => update({ zoom: v.zoom, ...(v.focus ? { focus: v.focus } : {}) }),
      critterClick: (n: number) => {
        if (!walk.current) return false;
        // one click per tick, exactly like a person clicking (each click re-renders the counter)
        for (let i = 0; i < n; i++) setTimeout(() => onCritter(), i * 60);
      },
    };
    return () => { delete w.__lab; };
  }, [drawn, ready, go, update, onCritter]);

  // the card opens once the camera has landed (never pops over a moving map)
  const [landedFor, setLandedFor] = useState<string | null>(null);
  useEffect(() => {
    if (!cardOpen || !focusNode) return;
    if (!animate) { setLandedFor(focusNode.name); return; }
    const id = setTimeout(() => setLandedFor(focusNode.name), 720);
    return () => clearTimeout(id);
  }, [cardOpen, focusNode, animate]);
  const card = useMemo(() => {
    if (!cardOpen || !focusNode || !taxonomy) return null;
    return cardModel(focusNode.name, { taxonomy, evidence, runs, family: focusNode.family, depth: focusNode.depth });
  }, [cardOpen, focusNode, taxonomy, evidence, runs]);
  const lesson = useLesson(cardOpen && focusNode ? focusNode.name : null, { runs, evidence, still: view ? view.still : null });
  const atoms = useMemo(() => new Set((world?.nodes ?? []).filter((n) => n.atom).map((n) => n.name)), [world]);
  const stats = useMemo(() => {
    if (!world) return { desc: new Map<string, number>(), maxDesc: 1, maxRuns: 1 };
    const desc = new Map(world.nodes.map((n) => [n.name, lineage(world, n.name).descendants.length]));
    return { desc, maxDesc: Math.max(1, ...desc.values()), maxRuns: Math.max(1, ...evidence.map((e) => e.run_count)) };
  }, [world, evidence]);

  // ——— overlay geometry (screen space) ———
  const tile = xf.tile;
  const uiRects = useMemo<Rect[]>(() => {
    const r: Rect[] = mobile ? [{ x: 0, y: 0, w: vp.w, h: MOBILE_TOP }] : [{ x: 0, y: 0, w: 344, h: zoom === "overview" ? 200 : 196 }];
    r.push(mobile ? { x: 0, y: vp.h - 56, w: 130, h: 56 } : { x: vp.w - 130, y: vp.h - 56, w: 130, h: 56 }); // "Map key" button
    return r;
  }, [mobile, vp.w, vp.h, zoom]);
  const labelText = useMemo(() => new Map((world?.labels ?? []).map((l) => [l.text, l.node])), [world]);
  const plates = useMemo(() => {
    if (!world || vp.w === 0) return [];
    const camBox = { x: -xf.ox / xf.k, y: -xf.oy / xf.k, w: vp.w / xf.k, h: vp.h / xf.k };
    const measure = (t: string, f: number) => {
      const node = labelText.get(t);
      void node;
      return { w: Math.ceil(0.62 * f * displayName(t).length) + 14, h: f + 10 };
    };
    let out = placeScreenLabels(world, camBox, vp, { font: tile <= 4 ? { atom: 14, derived: 13 } : { atom: 16, derived: 14 }, focus: focusNode?.name ?? null, measure, edgeMargin: 24 });
    // node view: the focus plate sits centred under its plinth (never on the critter,
    // which parks beside the model); other plates yield to it and to the critter
    if (focusNode && zoom === "node" && tile >= 16 && world) {
      const fp = out.find((l) => l.node === focusNode.name);
      if (fp && focusSprite) {
        // 18px plate ABOVE the enlarged sprite + its brackets, off the lineage rail
        const c = toScreen(xf, { x: focusNode.center.x, y: (focusNode.foot.y + focusNode.foot.h) * TS });
        const u = Math.max(1, tile / 8), fs = u + 1, bs = Math.max(2, tile / 8);
        const top = c.y - focusSprite.ay * fs - 3 * bs;
        fp.font = 18; fp.h = 28; fp.w = Math.ceil(0.62 * 18 * displayName(focusNode.name).length) + 16;
        fp.x = Math.round(c.x - fp.w / 2); fp.y = Math.round(top - fp.h - 6);
      }
      const park = parkingSpot(world, focusNode.name);
      const ps = toScreen(xf, park);
      const cs = Math.max(1, tile / 8 - 1);
      const crit = { x: ps.x - 14 * cs, y: ps.y - 30 * cs, w: 28 * cs, h: 32 * cs };
      out = out.filter((l) => l.node === focusNode.name || (!hit(l, crit) && !(fp && hit(l, fp))));
    }
    return out
      .filter((l) => (tile > 4 || nodeOf.get(l.node)?.atom))
      .filter((l) => l.node === focusNode?.name || !uiRects.some((u) => hit(l, u)))
      .filter((l) => !cardOpen || (l.x + l.w <= stage.x + stage.w - 8 && l.y + l.h <= stage.y + stage.h - 8));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, xf.tile, xf.ox, xf.oy, vp.w, vp.h, focusNode, uiRects, cardOpen, stage, zoom, focusSprite]);

  const signs = useMemo(() => {
    if (!world) return [];
    const twoLine = tile >= 16;
    const font = twoLine ? 16 : 14;
    const obstacles: Rect[] = [...uiRects];
    for (const r of world.regions) if (r.setPiece) {
      const sp = r.setPiece, g = 32 * xf.k;
      const c = toScreen(xf, { x: (sp.x + sp.w / 2) * TS, y: (sp.y + sp.h / 2) * TS });
      obstacles.push({ x: c.x - g / 2 - 2, y: c.y - g / 2 - 2, w: g + 4, h: g + 4, weight: 50 });
    }
    for (const l of plates) obstacles.push({ x: l.x - 8, y: l.y - 8, w: l.w + 16, h: l.h + 16, weight: 25 });
    for (const n of world.nodes) {
      const a = toScreen(xf, { x: n.foot.x * TS, y: n.foot.y * TS });
      const focus = n.name === focusNode?.name, pad = focus ? 56 : 4; // the focus sprite is drawn one scale step larger + brackets
      obstacles.push({ x: a.x - pad, y: a.y - pad, w: n.foot.w * TS * xf.k + 2 * pad, h: n.foot.h * TS * xf.k + 2 * pad, weight: focus ? 60 : twoLine ? 20 : 2 });
    }
    const items = world.regions.filter((r) => r.setPiece).map((r) => {
      const sp = r.setPiece!;
      const a = toScreen(xf, { x: sp.x * TS, y: sp.y * TS });
      const name = familyLabel(r.family);
      return {
        id: r.id, name, font,
        count: twoLine ? world.nodes.filter((n) => n.family === r.family).length : null,
        anchor: { x: a.x, y: a.y, w: sp.w * TS * xf.k, h: sp.h * TS * xf.k },
        w: Math.ceil(0.62 * font * name.length + 22), h: twoLine ? 44 : 24,
      };
    });
    const at = placeSigns(items, obstacles, { x: 4, y: 4, w: vp.w - 8, h: vp.h - 8 });
    return items.map((it) => ({ ...it, ...(at.get(it.id) ?? { x: it.anchor.x, y: it.anchor.y }) }))
      .filter((g) => !cardOpen || g.x + g.w <= stage.x + stage.w);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, plates, xf.tile, xf.ox, xf.oy, vp.w, vp.h, uiRects, focusNode, cardOpen, stage]);

  // harbour signs: the pipeline count on a small wooden board ≥16px from the boats,
  // tried right / left / below, dropped when it would touch a name, a sign or a window
  const harbourSigns = useMemo(() => {
    if (!world || tile < 8) return [];
    const taken: Rect[] = [...uiRects, ...plates.map((l) => ({ x: l.x - 4, y: l.y - 4, w: l.w + 8, h: l.h + 8 })),
      ...signs.map((g) => ({ x: g.x - 4, y: g.y - 4, w: g.w + 8, h: g.h + 8 }))];
    const out: { key: number; x: number; y: number; w: number; boats: number }[] = [];
    for (const h of world.harbours) {
      const shown = Math.min(tile >= 24 ? 3 : 1, h.boats);
      if (h.boats <= shown) continue;
      const q = toScreen(xf, h.pt);
      const bs = Math.max(2, tile / 8), half = (shown * 20 * bs) / 2, w = 74, hh = 22;
      const cands = [
        { x: q.x + half + 16, y: q.y - hh }, { x: q.x - half - 16 - w, y: q.y - hh }, { x: q.x - w / 2, y: q.y + 16 },
      ];
      const pick = cands.find((c) => c.x > 4 && c.y > 4 && c.x + w < vp.w - 4 && c.y + hh < vp.h - 4
        && !taken.some((t) => hit({ ...c, w, h: hh }, t)));
      if (!pick) continue;
      taken.push({ ...pick, w, h: hh });
      out.push({ key: h.tile, x: pick.x, y: pick.y, w, boats: h.boats });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, xf.tile, xf.ox, xf.oy, plates, signs, uiRects, vp.w, vp.h]);

  useEffect(() => {
    if (!world) return;
    document.querySelectorAll<HTMLElement>("[data-sign-count]").forEach((el) => {
      const shown = Number(el.textContent?.match(/\d+/)?.[0]);
      if (shown !== Number(el.dataset.signCount)) console.error(`pixel: sign shows ${shown}, region has ${el.dataset.signCount}`);
    });
  }, [signs, world]);

  const critterScreen = (() => {
    const w = walk.current;
    if (!w || tile < 16 || !critter) return null;
    const s = toScreen(xf, w.park);
    const cs = Math.max(1, tile / 8 - 1);
    return { x: s.x - critter.idle.ax * cs, y: s.y - critter.idle.ay * cs, w: critter.w * cs, h: critter.h * cs };
  })();
  const grokNode = world ? nodeOf.get(GROKKING_EGG.model) : undefined;

  return (
    <LabMotion still={still}>
      <div ref={rootRef} className={styles.root} data-lab-ready={drawn && ready && layers ? "1" : undefined}>
        <div
          className={styles.stage}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={cam.handlers.onWheel}
        >
          <canvas ref={canvasRef} className={styles.canvas} role="img"
            aria-label="Tile map of the model zoo: six lands, one per model family; roads are lineage, cities are atoms, boats are pipelines" />
          <div ref={cam.ref} className="pointer-events-none absolute" style={{ left: stage.x, top: stage.y, width: Math.max(2, stage.w), height: Math.max(2, stage.h) }} />

          {signs.map((g) => (
            <div key={g.id} className={styles.sign} style={{ left: g.x, top: g.y, width: g.w, fontSize: g.font }}>
              {g.name}
              {g.count != null && <span className="block text-[16px] font-normal" data-sign-count={g.count}><PixelNum value={g.count} /> models</span>}
            </div>
          ))}

          {plates.map((l) => {
            const node = nodeOf.get(l.node);
            const focus = focusNode?.name === l.node;
            const cls = focus ? styles.plateFocus : kin.has(l.node) ? `${styles.plateKin} ${node?.atom ? styles.plateAtom : ""}` : node?.atom ? styles.plateAtom : "";
            const dim = cardOpen && !focus && !kin.has(l.node);
            return (
              <div key={l.node} aria-hidden className={`${styles.plate} ${cls} ${dim ? styles.plateDim : ""}`}
                style={{ left: l.x, top: l.y, height: l.h, fontSize: l.font,
                  ...(kinTone.has(l.node) && !focus ? { boxShadow: `inset 0 0 0 2px ${kinTone.get(l.node)}, 0 2px 0 #1e1f4e` } : {}) }}
                onClick={() => onNode(l.node)}>
                <span>{displayName(l.node)}</span>

              </div>
            );
          })}

          {world && world.nodes.map((n) => {
            const a = toScreen(xf, { x: n.foot.x * TS, y: n.foot.y * TS });
            const s = TS * xf.k;
            return (
              <button key={n.name} type="button" className={styles.hit}
                style={{ left: a.x, top: a.y, width: n.foot.w * s, height: n.foot.h * s }}
                aria-label={`${displayName(n.name)}, ${n.atom ? "atom" : "derived model"} in ${familyLabel(n.family)}`}
                onMouseEnter={() => setHovered(n.name)} onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(n.name)} onBlur={() => setHovered(null)}
                onClick={() => onNode(n.name)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); go(n.name); } }} />
            );
          })}

          {/* the secret islands: next-era silhouettes and the ruins of legacy/ */}
          {world && tile >= 8 && world.hiddenIsland.names.map((id, i) => {
            const s = toScreen(xf, islandSlots(world.hiddenIsland)[i]);
            const m = NEXT_ERA.find((x) => x.id === id);
            return (
              <button key={id} type="button" className={styles.plate} style={{ left: s.x - 12, top: s.y + 8, height: 22, fontSize: 14 }}
                onClick={() => setTeaser(teaser === id ? null : id)} aria-label={`uncharted: ${m?.name ?? id}`}>?</button>
            );
          })}
          {world && tile >= 8 && (() => {
            const s = toScreen(xf, world.hiddenIsland.dragons);
            return <div className={styles.dragons} style={{ left: s.x - 40, top: s.y + 24 }}>{NEXT_ERA_COPY.warning}</div>;
          })()}
          {world && tile >= 8 && world.ruinsIsland.names.map((id, i) => {
            const s = toScreen(xf, islandSlots(world.ruinsIsland)[i]);
            const r = RUINS.find((x) => x.id === id);
            return (
              <button key={id} type="button" className={styles.plate} style={{ left: s.x - 30, top: s.y + 10, height: 22, fontSize: 14 }}
                onClick={() => setEpitaph(epitaph === id ? null : id)}>{r?.name ?? id}</button>
            );
          })}

          {harbourSigns.map((h) => (
            <div key={h.key} className={styles.sign} title={`${h.boats} pipelines use this land`}
              style={{ left: h.x, top: h.y, width: h.w, fontSize: 14, padding: "1px 6px 2px" }}>
              <PixelNum value={h.boats} scale={2} /> boats
            </div>
          ))}

          {critterScreen && (
            <button type="button" aria-label="The critter (click it)" className={styles.hit}
              style={{ left: critterScreen.x, top: critterScreen.y, width: critterScreen.w, height: critterScreen.h }}
              onClick={(e) => { e.stopPropagation(); onCritter(); }} />
          )}
        </div>

        {/* egg bubbles */}
        {teaser && world && (() => {
          const m = NEXT_ERA.find((x) => x.id === teaser)!;
          const s = toScreen(xf, islandSlots(world.hiddenIsland)[world.hiddenIsland.names.indexOf(teaser)]);
          return (
            <PixelWindow className={styles.bubble} style={{ left: Math.min(vp.w - 320, s.x - 60), top: Math.max(8, s.y - 150) }}>
              <p className="text-[16px] font-bold text-[#f5c24a]">{m.name}</p>
              <p className="text-[16px] leading-snug">{m.teaser}</p>
              <p className="mt-1 text-[15px] text-[#bccbe8]">{NEXT_ERA_COPY.caption} It would grow from {displayName(m.buildsOn)}.</p>
            </PixelWindow>
          );
        })()}
        {epitaph && world && (() => {
          const r = RUINS.find((x) => x.id === epitaph)!;
          const s = toScreen(xf, islandSlots(world.ruinsIsland)[world.ruinsIsland.names.indexOf(epitaph)]);
          return (
            <PixelWindow className={styles.bubble} style={{ left: Math.max(8, s.x - 60), top: Math.max(8, s.y - 160) }}>
              <p className="text-[16px] font-bold text-[#f5c24a]">{r.name}</p>
              <p className="text-[16px] leading-snug">{r.epitaph}</p>
              {r.successor && <p className="mt-1 text-[15px] text-[#bccbe8]">Lives on as {displayName(r.successor)}.</p>}
            </PixelWindow>
          );
        })()}
        {grokNode && hovered === GROKKING_EGG.model && !still && (() => {
          const s = toScreen(xf, grokNode.center);
          return (
            <PixelWindow className={styles.bubble} style={{ left: Math.min(vp.w - 320, s.x + 24), top: Math.max(8, s.y - 120) }}>
              <p className="text-[16px] leading-snug">{grokked ? GROKKING_EGG.after : GROKKING_EGG.before}</p>
              {grokked && <p className="mt-1 text-[15px] leading-snug text-[#bccbe8]">{GROKKING_EGG.explain}</p>}
              {grokked && (
                <div className="mt-2">
                  <Sparkline points={GROKKING_EGG.sketch.val as unknown as [number, number][]} label="held-out accuracy" width={260} height={56} showValues={false}
                    palette={{ line: GOLD, axis: "#4a60b6", text: "#bccbe8" }} title={GROKKING_EGG.sketch.note} />
                  <p className="text-[14px] text-[#bccbe8]">Illustration of the paper&apos;s curve, not a zoo run.</p>
                </div>
              )}
            </PixelWindow>
          );
        })()}
        {critterUnlocked && critterScreen && (
          <PixelWindow className={styles.bubble} style={{ left: Math.min(vp.w - 320, critterScreen.x + critterScreen.w + 8), top: Math.max(8, critterScreen.y - 40) }}>
            <p className="text-[16px] font-bold text-[#f5c24a]">Training…</p>
            {realCurve.curve ? (
              <>
                <Sparkline points={realCurve.curve.points} progress={trainT} label={realCurve.curve.key.replace(/_/g, " ")} width={260} height={60}
                  palette={{ line: GOLD, axis: "#4a60b6", text: "#bccbe8", dot: "#fff6e0" }} title="a real loss curve from a logged run" />
                <p className="text-[14px] text-[#bccbe8]">A real run: {realCurve.curve.model}, {realCurve.curve.runId.slice(0, 24)}</p>
              </>
            ) : realCurve.loading ? (
              <p className="text-[15px] text-[#bccbe8]">Finding a real loss curve in the run log…</p>
            ) : (
              <p className="text-[15px] text-[#bccbe8]">No logged run has a clearly falling loss yet, so nothing to replay.</p>
            )}
          </PixelWindow>
        )}

        <TitleWindow
          taxonomyNames={world?.nodes.map((n) => n.name) ?? []}
          zoom={zoom}
          focus={focusNode ?? null}
          regionCount={focusNode ? world?.nodes.filter((n) => n.family === focusNode.family).length ?? 0 : 0}
          mobile={mobile}
          onPick={go}
          onZoom={(z) => update({ zoom: z })}
          hidden={mobile && cardOpen}
        />
        {!(mobile && cardOpen) && <Legend mobile={mobile} defaultOpen={false} />}
        {card && emblems && landedFor === card.name && (
          <StatusCard card={card} looks={looks} atoms={atoms} emblems={emblems} lesson={lesson} evidence={evidence} still={still}
            descendants={stats.desc.get(card.name) ?? 0} maxDescendants={stats.maxDesc} maxRuns={stats.maxRuns}
            sailing={sailing} onSail={setSailing}
            onPick={go} onClose={() => update({ zoom: "region" })} />
        )}
      </div>
    </LabMotion>
  );
}
