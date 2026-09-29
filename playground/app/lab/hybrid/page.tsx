"use client";

// Skin C · Papercraft map + pixel chrome, round 2 (layout v2).
// The diorama is the hero; the chrome is ONE pixel window at a time (menu in
// overview/region, the lesson card on a model) plus a slim title plate.
// Labels live in a screen-space overlay at constant size. Wiring follows
// /lab/stub: URL view → useWorld → camera → paint → ready → window.__lab.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ferryRoute, lineage, parkingSpot, pathToAtom, placeScreenLabels, type Box, type Pt, type ScreenLabel,
} from "@/lib/world";
import { useWorld } from "@/hooks/use-world";
import { useLesson } from "@/hooks/use-lesson";
import { useLabView } from "@/components/lab/shared/url-state";
import { LabMotion } from "@/components/lab/shared/still";
import { useCamera, type CamBox } from "@/components/lab/shared/camera";
import { cardModel, displayName, evidenceState, type EvidenceState } from "@/components/lab/shared/card-model";
import { Sparkline } from "@/components/lab/shared/lesson/sparkline";
import {
  DOUBLE_DESCENT_EGG, GROKKING_EGG, NEXT_ERA, NEXT_ERA_COPY, RUINS, dipDepth, forwardPassOrder, forwardPassSchedule,
  stationCounts, useKonami, useLiveTraining, useLongFocus, useRealLossCurve,
} from "@/components/lab/shared/eggs";
import { Diorama, LANDMARK_K, SPOT_R, TILT, boxOfPoints, proj, projBox, ruinsLayout, spotScale } from "@/components/lab/hybrid/diorama";
import { groundOf } from "@/components/lab/hybrid/art";
import { LessonCard, type PartyMember } from "@/components/lab/hybrid/card";
import { PixelSprite, PixelWindow, handCssUrl } from "@/components/lab/hybrid/chrome";
import { RegionMenu, SlimTitle, type MenuRow } from "@/components/lab/hybrid/menu";
import { frameInto, landBox, nodeBox, unionBox, type Insets } from "@/components/lab/hybrid/frame";
import { HAND } from "@/components/lab/hybrid/pixel-art";
import { UI, chromeSwatch, familyLabel } from "@/components/lab/hybrid/palette";
import { BigTree, SignBoard } from "@/components/lab/paper/art";
import { CompassRose, MapKey, UnchartedGlimpse } from "@/components/lab/hybrid/furniture";
import s from "@/components/lab/hybrid/hybrid.module.css";

const GAP = 16;

/** Points every `step` px along a polyline (sign placement obstacles). */
function samplePts(pts: Pt[], step: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], L = Math.hypot(b.x - a.x, b.y - a.y);
    for (let d = 0; d < L; d += step) out.push({ x: a.x + ((b.x - a.x) * d) / L, y: a.y + ((b.y - a.y) * d) / L });
  }
  if (pts.length) out.push(pts[pts.length - 1]);
  return out;
}
const MENU_W = 276;
const CARD_W = 380;
const TITLE_H = 56;         // slim title plate incl. its card rim

type Secret = { kind: "era"; id: string } | { kind: "ruin"; id: string };

export default function HybridPage() {
  const { view, update } = useLabView();
  const still = view?.still ?? true;
  const { world, taxonomy, evidence, runs, ready } = useWorld(view ? view.still : null);
  const [vp, setVp] = useState({ w: 1440, h: 900 });
  const [drawn, setDrawn] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [partyCursor, setPartyCursor] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [sailing, setSailing] = useState<string | null>(null);
  const [secret, setSecret] = useState<Secret | null>(null);
  // the learner panned or zoomed away from the framed view → secrets can surface
  const [roamed, setRoamed] = useState(false);

  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  const mobile = vp.w < 700;
  const ATOM_PX = mobile ? 13 : 24;

  // ── data ────────────────────────────────────────────────────────────────
  const byName = useMemo(() => new Map((world?.nodes ?? []).map((n) => [n.name, n])), [world]);
  const focusNode = view?.focus ? byName.get(view.focus) : undefined;
  const zoom = view && focusNode ? view.zoom : "overview";
  const family = zoom !== "overview" ? focusNode?.family ?? null : null;
  const focus = zoom !== "overview" ? focusNode ?? null : null;

  const states = useMemo(() => {
    const out: Record<string, EvidenceState> = {};
    for (const n of world?.nodes ?? []) out[n.name] = evidenceState(evidence.find((e) => e.name === n.name));
    return out;
  }, [world, evidence]);
  const stations = useMemo(() => stationCounts(runs), [runs]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const n of world?.nodes ?? []) c[n.family] = (c[n.family] ?? 0) + 1;
    return c;
  }, [world]);
  const families = useMemo(() => (world?.regions ?? []).map((r) => r.family), [world]);

  const menuRows: MenuRow[] = useMemo(() => {
    if (!world) return [];
    if (!family) return families.map((f): MenuRow => ({ key: f, kind: "family", label: familyLabel(f), family: f, meta: `${counts[f]} models` }));
    const models = world.nodes.filter((n) => n.family === family).sort((a, b) => a.depth - b.depth || a.name.localeCompare(b.name));
    return [
      { key: "__back", kind: "back", label: "All families", family, meta: "" },
      ...models.map((n): MenuRow => ({ key: n.name, kind: "model", label: n.name, family: n.family, meta: `LV ${n.depth + 1}`, atom: n.atom, state: states[n.name] })),
    ];
  }, [world, family, families, counts, states]);

  useEffect(() => {
    if (!menuRows.length) return;
    if (family && view?.focus) { const i = menuRows.findIndex((r) => r.key === view.focus); setCursor(i >= 0 ? i : 1); }
    else setCursor(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family, view?.focus, menuRows.length]);

  // lineage of the focus: every parent road individually, children, walk home
  // precomputed once at load, so a click never pays for graph walks mid-flight
  const lineageAll = useMemo(() => (world ? new Map(world.nodes.map((n) => [n.name, {
    walk: pathToAtom(world, n.name), lin: lineage(world, n.name), park: parkingSpot(world, n.name),
  }])) : null), [world]);
  const walk = focus ? lineageAll?.get(focus.name)?.walk ?? null : null;
  const lin = focus ? lineageAll?.get(focus.name)?.lin ?? null : null;
  const park = focus ? lineageAll?.get(focus.name)?.park ?? null : null;
  const quest: Pt[] = useMemo(() => {
    if (!walk || !park) return [];
    const pts = [...walk.points].reverse();              // root atom → focus
    pts[pts.length - 1] = { x: park.x, y: park.y };     // …ending at the parking spot, never on the spot
    return pts;
  }, [walk, park]);
  const lineageNames = useMemo(() => new Set<string>(focus && lin
    ? [focus.name, ...lin.parents.map((r) => r.from), ...lin.children.map((r) => r.to), ...(walk?.nodes ?? [])] : []), [focus, lin, walk]);
  const lineageRoads = useMemo(() => {
    const ids = new Set<string>(lin ? [...lin.parents, ...lin.children].map((r) => r.id) : []);
    const w = walk?.nodes ?? [];
    for (let i = 0; i + 1 < w.length; i++) ids.add(`${w[i + 1]}->${w[i]}`);
    return ids;
  }, [lin, walk]);

  const card = useMemo(() => {
    if (zoom !== "node" || !focusNode || !taxonomy) return null;
    return cardModel(focusNode.name, { taxonomy, evidence, runs, family: focusNode.family, depth: focusNode.depth });
  }, [zoom, focusNode, taxonomy, evidence, runs]);
  const lesson = useLesson(card?.name ?? null, { runs, evidence, still: view ? view.still : null });
  const party: PartyMember[] = useMemo(() => {
    if (!card) return [];
    const mk = (name: string, role: "parent" | "child"): PartyMember | null => {
      const n = byName.get(name);
      return n ? { name, role, family: n.family, depth: n.depth } : null;
    };
    return [...card.parents.map((p) => mk(p, "parent")), ...card.children.map((c) => mk(c, "child"))].filter((x): x is PartyMember => x !== null);
  }, [card, byName]);
  useEffect(() => { setPartyCursor(0); setSailing(null); }, [card?.name]);

  // ── boats: the selected pipeline sails its ferry route ──────────────────
  const ferry = useMemo(() => {
    if (!world || !sailing || !taxonomy) return null;
    const comp = taxonomy.compositions.find((c) => c.name === sailing);
    if (!comp) return null;
    const members = comp.composes.filter((m) => byName.has(m));
    let pts: Pt[];
    if (members.length >= 2) pts = ferryRoute(world, members).points;
    else {
      // a one-model pipeline: a round trip out of its family's nearest harbour
      const n = byName.get(members[0]);
      const hs = world.harbours.filter((h) => h.family === n?.family);
      if (!n || !hs.length) return null;
      const h = hs.sort((a, b) => Math.hypot(a.pt.x - n.center.x, a.pt.y - n.center.y) - Math.hypot(b.pt.x - n.center.x, b.pt.y - n.center.y))[0];
      const cx = (h.tile % world.cols) * world.tile + 8, cy = Math.floor(h.tile / world.cols) * world.tile + 8;
      const L = Math.hypot(h.pt.x - cx, h.pt.y - cy) || 1;
      const dx = (h.pt.x - cx) / L, dy = (h.pt.y - cy) / L;
      pts = [h.pt, { x: h.pt.x + dx * 150 - dy * 90, y: h.pt.y + dy * 150 + dx * 90 }, { x: h.pt.x + dx * 150 + dy * 90, y: h.pt.y + dy * 150 - dx * 90 }, h.pt];
    }
    let reference: Pt[] | null = null, crest: Pt | null = null;
    if (sailing === DOUBLE_DESCENT_EGG.composition) {
      // the double_descent egg: an open course straight out to sea whose wake
      // dips twice (dipDepth(t) × 70 world px), crest = the interpolation threshold
      const a = pts[0];
      const far = pts.reduce((m, q) => (Math.hypot(q.x - a.x, q.y - a.y) > Math.hypot(m.x - a.x, m.y - a.y) ? q : m), pts[0]);
      // a level course along the open sea (east or west, whichever way the
      // harbour faces), the wake dipping DOWN twice like the test-error curve
      const len = 560, amp = 110, N = 72;
      // pick the level course (direction × height) that stays most on open sea
      const seaAt = (q: Pt) => {
        const tx = Math.floor(q.x / world.tile), ty = Math.floor(q.y / world.tile);
        if (tx < 0 || ty < 0 || tx >= world.cols || ty >= world.rows) return true;
        return world.regionOf[ty * world.cols + tx] < 0;
      };
      let best = { dx: far.x >= a.x ? 1 : -1, oy: -60, score: -1 };
      for (const dx of [1, -1]) for (const oy of [-60, -140, -220, 80, 160]) {
        let sc = 0;
        for (let i = 0; i <= 24; i++) { const u = i / 24; if (seaAt({ x: a.x + dx * (40 + len * u), y: a.y + oy + dipDepth(u) * amp })) sc++; }
        if (sc > best.score) best = { dx, oy, score: sc };
      }
      const dx = best.dx;
      const start = { x: a.x + dx * 40, y: a.y + best.oy };
      reference = [start, { x: start.x + dx * len, y: start.y }];
      pts = [a, ...Array.from({ length: N + 1 }, (_, i) => {
        const u = i / N;
        return { x: start.x + dx * len * u, y: start.y + dipDepth(u) * amp };
      })];
      crest = { x: start.x + dx * len * 0.5, y: start.y + dipDepth(0.5) * amp };
    }
    const fams = [...new Set(members.map((m) => byName.get(m)?.family ?? ""))];
    return { points: pts, families: fams, reference, crest };
  }, [world, sailing, taxonomy, byName]);
  const [sailT, setSailT] = useState(1);
  useEffect(() => {
    if (!ferry) return;
    if (still) { setSailT(1); return; }
    const t0 = performance.now();
    const dur = 3200;
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / dur);
      setSailT(k);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    setSailT(0);
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [ferry, still]);

  // ── trains: models with a live run ride their lineage line ──────────────
  const live = useLiveTraining(runs);
  const [clock, setClock] = useState(0);
  useEffect(() => {
    if (still || !live.length) return;
    let raf = 0;
    const step = (now: number) => { setClock(now); raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [still, live.length]);
  const trains = useMemo(() => (world ? live.filter((m) => byName.has(m)).map((m, i) => ({
    points: [...pathToAtom(world, m).points].reverse(),
    t: still ? 0.6 : ((clock / 5000 + i * 0.3) % 1),
  })).filter((t) => t.points.length > 1) : []), [world, live, byName, clock, still]);

  // ── eggs ────────────────────────────────────────────────────────────────
  const [konami, setKonami] = useState<{ t0: number; gen: number } | null>(null);
  const schedule = useMemo(() => (world ? forwardPassSchedule(forwardPassOrder(world), 450) : {}), [world]);
  const waveLen = useMemo(() => Math.max(0, ...Object.values(schedule)) + 900, [schedule]);
  useKonami(() => setKonami({ t0: performance.now(), gen: 0 }), !still && drawn);
  const konamiT0 = konami?.t0;
  useEffect(() => {
    if (konamiT0 == null) return;
    // the rings run on CSS; React only steps the title toast once per generation
    const tick = setInterval(() => setKonami((k) => (k ? { ...k, gen: Math.min(3, k.gen + 1) } : k)), 450);
    const end = setTimeout(() => setKonami(null), waveLen);
    return () => { clearInterval(tick); clearTimeout(end); };
  }, [konamiT0, waveLen]);
  const konamiGen = konami ? konami.gen : null;
  const konamiProp = useMemo(() => (konamiT0 != null ? { t0: konamiT0, schedule } : null), [konamiT0, schedule]);

  const grokked = useLongFocus(still ? null : hovered, GROKKING_EGG.holdMs);

  // critter clicks: a ref counter so several synchronous clicks all count
  const clicks = useRef<{ n: number; last: number }>({ n: 0, last: 0 });
  const [trainUnlocked, setTrainUnlocked] = useState(false);
  const clickCritter = useCallback(() => {
    const now = Date.now();
    const c = clicks.current;
    c.n = now - c.last <= 2500 ? c.n + 1 : 1;
    c.last = now;
    if (c.n >= 7) setTrainUnlocked(true);
  }, []);
  const real = useRealLossCurve(runs, trainUnlocked && !still);
  const [trainP, setTrainP] = useState(0);
  useEffect(() => {
    if (!real.curve || !trainUnlocked) return;
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => { const k = Math.min(1, (now - t0) / 2600); setTrainP(k); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [real.curve, trainUnlocked]);
  useEffect(() => { setTrainUnlocked(false); clicks.current = { n: 0, last: 0 }; }, [focus?.name]);

  const steamers = useMemo(() => (taxonomy ? taxonomy.compositions.filter((c) => c.composes.length >= 3).length : 0), [taxonomy]);
  const critterProp = useMemo(() => (focus ? { training: trainUnlocked && Boolean(real.curve) } : null), [focus, trainUnlocked, real.curve]);
  const ferryProp = useMemo(() => (ferry ? { ...ferry, t: sailT } : null), [ferry, sailT]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const lessonM = useMemo(() => lesson, [lesson.lesson, lesson.curve, lesson.curveRun, lesson.samples, lesson.loading, lesson.error, lesson.champion?.label]);

  // ── camera: framed into what the chrome leaves free (in projected px) ─
  const oneWindowLeft = !mobile && zoom !== "node";
  const insets: Insets = mobile
    ? { l: 0, r: 0, t: TITLE_H + 8, b: zoom === "node" ? Math.round(vp.h * 0.55) + 12 : zoom === "overview" ? 200 : 16 }
    : secret
      ? { l: GAP, r: GAP + CARD_W + GAP, t: GAP + TITLE_H, b: GAP }
      : zoom === "overview"
      ? { l: 0, r: 0, t: 8, b: 0 }       // full-bleed sheet: land edge to edge, the chrome sits in the corners as map furniture
      : { l: oneWindowLeft ? GAP + MENU_W + GAP : GAP, r: zoom === "node" ? GAP + CARD_W + GAP : GAP, t: GAP + TITLE_H, b: GAP };
  const target: CamBox = useMemo(() => {
    if (!world) return { x: 0, y: 0, w: 1, h: 1 };
    let box: Box = zoom === "node" && focus ? nodeBox(world, focus.name, quest)
      : zoom === "region" && family ? world.camera.regions[family]
      : landBox(world);
    if (zoom === "node" && ferry && ferry.points.length > 1) box = unionBox([box, boxOfPoints(ferry.points, 60)]);
    if (secret) {
      const ib = secret.kind === "era" ? world.hiddenIsland.box : ruinsLayout(world).box;
      box = { x: ib.x - 160, y: ib.y - 120, w: ib.w + 320, h: ib.h + 240 };
    }
    let pb = projBox(box);
    // stand-up props rise above the ground: keep room for castles and set-pieces
    pb = { x: pb.x, y: pb.y - 70, w: pb.w, h: pb.h + 70 };
    if (mobile && zoom === "overview") {
      // phone: the land fills the height between title and menu; the sides
      // (coast and sea margin) may run off-screen — pan to see them
      const ih = vp.h - insets.t - insets.b;
      const k = ih / pb.h;          // fit the HEIGHT: the archipelago fills the screen, pan sideways for its ends
      const w = vp.w / k, h = ih / k;
      pb = { x: pb.x + pb.w / 2 - w / 2, y: pb.y + pb.h / 2 - h / 2, w, h };
    }
    if (mobile && zoom === "node" && focus && !ferry) {
      const iw = vp.w - insets.l - insets.r, ih = vp.h - insets.t - insets.b;
      const w = Math.min(pb.w, iw), h = Math.min(pb.h, ih);
      const c = proj(focus.center);
      pb = { x: c.x - w / 2, y: c.y - h / 2, w, h };
    }
    return frameInto(pb, vp.w, vp.h, insets);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, zoom, focus, family, quest, ferry, secret, mobile, vp.w, vp.h, insets.l, insets.r, insets.t, insets.b]);
  useEffect(() => { setRoamed(false); }, [target.x, target.y, target.w, target.h]);
  // until the first frame is drawn the camera JUMPS (its placeholder start box
  // is degenerate; flying from it took seconds under the per-frame step cap)
  const cam = useCamera({ world: world ? projBox(world.camera.all) : target, target, still: still || !drawn, minWidth: 240 });

  // Heavy work waits for the camera to settle: the map only gets a quantised
  // scale (spots re-render on zoom steps, not every tween frame) and labels /
  // signs are placed from a camera snapshot taken once it stops moving.
  const qScale = Math.round(cam.scale * 20) / 20;
  // the critter parks OUTSIDE the focus disc (lifted spot radius + 24 screen px),
  // due west of the spot, at the zoom it will be seen at (target scale)
  const targetScale = vp.w / Math.max(1, target.w);
  const parkOut: Pt | null = useMemo(() => {
    if (!focus || !park) return null;
    const R = (focus.atom ? SPOT_R.atom : SPOT_R.town) * 1.3 * spotScale(focus.atom, targetScale, ATOM_PX).k;
    const d = R + 24 / Math.max(targetScale, 0.1) + 14;
    return { x: focus.center.x - d, y: focus.center.y + 6 };
  }, [focus, park, targetScale, ATOM_PX]);
  const questOut: Pt[] = useMemo(() => (quest.length && parkOut ? [...quest, parkOut] : quest), [quest, parkOut]);
  const targetKey = `${Math.round(target.x)},${Math.round(target.y)},${Math.round(target.w)}`;
  const [settled, setSettled] = useState<{ box: CamBox; size: { w: number; h: number }; scale: number; key: string } | null>(null);
  useEffect(() => {
    const snap = { box: cam.box, size: cam.size, scale: cam.scale, key: targetKey };
    if (still) { setSettled(snap); return; }
    setSettled(null);
    const id = setTimeout(() => setSettled(snap), 140);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cam.box.x, cam.box.y, cam.box.w, cam.box.h, cam.size.w, cam.size.h, still, targetKey]);
  // the camera has landed on the current target: only now mount the heavy
  // focus layers (lesson card, step-back, lifted roads, a new family menu)
  const landed = still || (settled != null && settled.key === targetKey);

  useEffect(() => {
    if (!ready || !world) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setDrawn(true)));
    return () => cancelAnimationFrame(id);
  }, [ready, world]);

  // ── chrome rectangles (measured) — tags never print under a window ──────
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [chrome, setChrome] = useState<Box[]>([]);
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const rs = [...el.querySelectorAll("[data-chrome]")].map((c) => {
      const r = c.getBoundingClientRect();
      return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
    });
    const key = JSON.stringify(rs);
    setChrome((prev) => (JSON.stringify(prev) === key ? prev : rs));
  });
  const chromeKey = JSON.stringify(chrome);
  // the foreground tree cutout at the bottom-left corner (desktop) is chrome for placement
  const fixedChrome = useMemo(() => (mobile ? [] : [
    { x: 0, y: vp.h - 230, w: 190, h: 230 },
    ...(zoom === "overview" ? [{ x: vp.w - 150, y: vp.h - 150, w: 150, h: 150 }, { x: vp.w - 200, y: vp.h - 360, w: 200, h: 170 }] : []),
  ]), [mobile, vp.h, vp.w, zoom]);

  // ── region signs at whole-map zoom: in free land / sea near the set-piece,
  // never over a spot, a road, the set-piece itself, another sign or a window
  const signs = useMemo(() => {
    const C = settled;
    if (!C || !world || zoom !== "overview" || C.size.w <= 1) return [];
    const toS = (p: Pt) => { const q = proj(p); return { x: (q.x - C.box.x) * C.scale, y: (q.y - C.box.y) * C.scale }; };
    const rAtom = SPOT_R.atom * C.scale * spotScale(true, C.scale, ATOM_PX).k + 10;
    const rTown = SPOT_R.town * C.scale + 6;
    const spots = world.nodes.map((n) => ({ ...toS(n.center), r: n.atom ? rAtom + 14 : rTown }));
    const road: Pt[] = [];
    for (const r of world.roads) for (const q of samplePts(r.lanePoints, 18)) road.push(toS(q));
    const pieces = world.regions.filter((r) => r.setPiece).map((r) => {
      const sp = r.setPiece!, base = toS({ x: (sp.x + sp.w / 2) * world.tile, y: (sp.y + sp.h) * world.tile });
      const hh = 112 * C.scale, ww = hh;
      return { x: base.x - ww / 2, y: base.y - hh, w: ww, h: hh };
    });
    const placed: Box[] = [...chrome, ...fixedChrome];
    const out: { family: string; label: string; n: number; x: number; y: number; w: number; h: number }[] = [];
    const hit = (a: Box, b: Box, m: number) => a.x < b.x + b.w + m && b.x < a.x + a.w + m && a.y < b.y + b.h + m && b.y < a.y + a.h + m;
    for (const r of world.regions) {
      if (!r.setPiece) continue;
      const sp = r.setPiece;
      const c = toS({ x: (sp.x + sp.w / 2) * world.tile, y: (sp.y + sp.h + 1) * world.tile });
      const label = familyLabel(r.family);
      // SignBoard (cut-card banner on two posts): 52 design units tall, board 30 + posts 16
      const k = mobile ? 0.8 : 1;
      const w = Math.max(60, label.length * 11.2 + 28) * k, h = 48 * k;
      let best: Box | null = null;
      search: for (let rad = 0; rad <= (mobile ? 110 : 320); rad += mobile ? 8 : 16) {
        for (let a = 0; a < 16; a++) {
          const ang = (a / 16) * Math.PI * 2 + Math.PI / 2;           // start straight below the set-piece
          const b = { x: c.x + Math.cos(ang) * rad - w / 2, y: c.y + Math.sin(ang) * rad * 0.8 - h / 2, w, h };
          if (b.x < 24 || b.y < 24 || b.x + w > C.size.w - 24 || b.y + h > C.size.h - 24) continue;
          if (spots.some((q) => q.x > b.x - q.r && q.x < b.x + w + q.r && q.y > b.y - q.r && q.y < b.y + h + q.r)) continue;
          if (road.some((q) => q.x > b.x - 5 && q.x < b.x + w + 5 && q.y > b.y - 5 && q.y < b.y + h + 5)) continue;
          if (pieces.some((q) => hit(b, q, 2)) || placed.some((q) => hit(b, q, 8))) continue;
          best = b;
          break search;
        }
      }
      if (!best) continue;                                            // no free place: the menu names the family
      placed.push(best);
      out.push({ family: r.family, label, n: counts[r.family] ?? 0, x: best.x + w / 2, y: best.y + h / 2, w, h });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, zoom, settled, counts, mobile, ATOM_PX, chromeKey, fixedChrome]);

  // ── the focus disc: spot radius (lifted ×1.3) + 24px, kept clear of tags,
  // houses, the hand, bubbles and badges; plus the parked critter's box
  const focusDisc = useMemo(() => {
    const C = settled;
    if (!C || !focus || zoom === "overview") return null;
    const q = proj(focus.center);
    const r = (focus.atom ? SPOT_R.atom : SPOT_R.town) * 1.3 * spotScale(focus.atom, C.scale, ATOM_PX).k * C.scale + 24;
    const cx = (q.x - C.box.x) * C.scale, cy = (q.y - C.box.y) * C.scale;
    return { x: cx, y: cy, r };
  }, [settled, focus, zoom, ATOM_PX]);
  const critterBox = useMemo(() => {
    const C = settled;
    if (!C || !park || zoom === "overview") return null;
    const q = proj(parkOut ?? park), s2 = 42 * C.scale;
    const x = (q.x - C.box.x) * C.scale, y = (q.y - C.box.y) * C.scale;
    return { x: x - s2 * 0.45, y: y - s2, w: s2 * 0.9, h: s2 };
  }, [settled, park, parkOut, zoom]);

  // ── screen-space labels: constant size, priority placed, culled ─────────
  const labels: (ScreenLabel & { dim: boolean })[] = useMemo(() => {
    const C = settled;
    if (!C || !world || C.size.w <= 1) return [];
    // semantic zoom: at whole-map zoom atoms are drawn bigger than their
    // footprint, so their tags keep that much extra clearance
    const atomScreenR = SPOT_R.atom * C.scale * spotScale(true, C.scale, ATOM_PX).k;
    let gap = Math.max(4, atomScreenR - 2 * world.tile * C.scale + 6);
    // the focused spot is lifted ×1.3: its own tag clears the bigger plinth
    if (focus && zoom !== "overview") {
      const fr = (focus.atom ? SPOT_R.atom : SPOT_R.town) * 1.3 * spotScale(focus.atom, C.scale, ATOM_PX).k * C.scale;
      gap = Math.max(gap, fr * 0.72 - focus.foot.h * world.tile * TILT * C.scale / 2 + 8);
    }
    const blocks = [...chrome, ...signs.map((g) => ({ x: g.x - g.w / 2, y: g.y - g.h / 2, w: g.w, h: g.h })), ...fixedChrome];
    if (critterBox) blocks.push(critterBox);
    const disc = focusDisc ? { x: focusDisc.x - focusDisc.r, y: focusDisc.y - focusDisc.r * 0.75, w: focusDisc.r * 2, h: focusDisc.r * 1.5 } : null;
    // stand-up castles rise above an atom's footprint, set-pieces above their box
    for (const n of world.nodes) if (n.atom) {
      const R = SPOT_R.atom * C.scale * spotScale(true, C.scale, ATOM_PX).k * (n.name === focus?.name ? 1.3 : 1);
      const x = (n.center.x - C.box.x) * C.scale, y = (n.center.y * TILT - C.box.y) * C.scale;
      blocks.push({ x: x - R * 0.9, y: y - R * (LANDMARK_K + 0.3), w: 1.8 * R, h: R * (LANDMARK_K - 0.2) });   // the standing landmark
    }
    for (const r of world.regions) if (r.setPiece) {
      const sp = r.setPiece, hh = 112 * C.scale;
      const x = ((sp.x + sp.w / 2) * world.tile - C.box.x) * C.scale, y = ((sp.y + sp.h) * world.tile * TILT - C.box.y) * C.scale;
      blocks.push({ x: x - hh / 2, y: y - hh, w: hh, h: hh });
    }
    // tilted camera: world px → projected (y·TILT) → screen; windows and signs are obstacles
    const project = (q: Pt) => ({ x: (q.x - C.box.x) * C.scale, y: (q.y * TILT - C.box.y) * C.scale });
    const placed = placeScreenLabels(world, C.box, C.size, {
      font: { atom: 16, derived: 15 }, focus: focus?.name ?? null, edgeMargin: 24, gap, project, obstacles: blocks,
      measure: (t, f) => ({ w: 0.56 * f * t.length + 14, h: f + 10 }),
    });
    const hit = (a: Box, b: Box) => a.x < b.x + b.w + 4 && b.x < a.x + a.w + 4 && a.y < b.y + b.h + 4 && b.y < a.y + a.h + 4;
    const kept = placed
      .filter((l) => zoom !== "overview" || byName.get(l.node)?.atom)
      .filter((l) => !blocks.some((c) => hit(l, c)))
      // nothing but the focus's own tag inside the focus disc
      .filter((l) => l.node === focus?.name || !disc || !hit(l, disc));
    // capitals are always named (phone overview is too tight for the placer)
    for (const c of world.cities) if (c.capital && !kept.some((l) => l.node === c.node)) {
      const n = byName.get(c.node);
      if (!n) continue;
      const q = project(n.center), f = 15, w = 0.56 * f * c.node.length + 14, h = f + 10;
      const R = SPOT_R.atom * C.scale * spotScale(true, C.scale, ATOM_PX).k;
      const b = { node: c.node, x: q.x - w / 2, y: q.y + R * 0.8 + 4, w, h, font: f, anchor: "S" as const };
      if (!chrome.some((o) => hit(b, o)) && !kept.some((o) => hit(b, o))) kept.push(b);
    }
    return kept
      .map((l) => ({
        ...l,
        dim: (zoom === "node" && !lineageNames.has(l.node)) || (zoom === "region" && byName.get(l.node)?.family !== family),
      }));
  }, [world, settled, focus, zoom, chrome, signs, lineageNames, byName, family, focusDisc, critterBox, fixedChrome, ATOM_PX]);

  // ── harbour badges (screen): how many pipelines dock there; never under a
  // window or inside the focus disc
  const badges = useMemo(() => {
    const C = settled;
    if (!C || !world) return [];
    const sail = ferry ? ferry.families : [];
    const out: { key: string; x: number; y: number; n: number }[] = [];
    world.harbours.forEach((h, i) => {
      const n = Math.max(0, h.boats - (sail.includes(h.family) ? 1 : 0));
      if (!n) return;
      const q = proj({ x: h.pt.x + 28 + Math.min(3, n) * 34, y: h.pt.y + 20 });
      const x = (q.x - C.box.x) * C.scale, y = (q.y - C.box.y) * C.scale - 10;
      const b = { x: x - 14, y: y - 14, w: 28, h: 28 };
      const hit = (o: Box) => b.x < o.x + o.w && o.x < b.x + b.w && b.y < o.y + o.h && o.y < b.y + b.h;
      if (x < 12 || y < 12 || x > C.size.w - 12 || y > C.size.h - 12) return;
      if (chrome.some(hit) || fixedChrome.some(hit) || labels.some(hit) || signs.some((g) => hit({ x: g.x - g.w / 2, y: g.y - g.h / 2, w: g.w, h: g.h }))) return;
      if (focusDisc && Math.hypot(x - focusDisc.x, y - focusDisc.y) < focusDisc.r + 14) return;
      out.push({ key: `h${i}`, x, y, n });
    });
    return out;
  }, [settled, world, ferry, chrome, fixedChrome, focusDisc, signs, labels, mobile, zoom]);

  // ── actions ─────────────────────────────────────────────────────────────
  const entryAtom = useCallback((f: string) => {
    const nodes = world?.nodes ?? [];
    return nodes.filter((n) => n.family === f && n.atom).sort((a, b) => a.name.localeCompare(b.name))[0] ?? nodes.find((n) => n.family === f);
  }, [world]);
  const open = useCallback((name: string) => { setMenuOpen(false); setSecret(null); update({ zoom: "node", focus: name }); }, [update]);
  const pick = useCallback((r: MenuRow) => {
    if (r.kind === "back") { update({ zoom: "overview", focus: null }); return; }
    if (r.kind === "model") { open(r.key); return; }
    const root = entryAtom(r.family);
    if (root) { setMenuOpen(false); update({ zoom: "region", focus: root.name }); }
  }, [update, open, entryAtom]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("[data-critter]") && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); clickCritter(); return; }
      const sec = t?.closest?.("[data-secret]")?.getAttribute("data-secret");
      if (sec && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); const [k, id] = sec.split(":"); setSecret({ kind: k as "era" | "ruin", id }); return; }
      const mapNode = t?.closest?.("[data-node]")?.getAttribute("data-node");
      if (mapNode && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); open(mapNode); return; }
      const onControl = t && (t.tagName === "BUTTON" || t.getAttribute("role") === "button");
      const move = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
      if (secret && e.key === "Escape") { e.preventDefault(); setSecret(null); return; }
      if (zoom === "node" && card) {
        if (move && party.length) { e.preventDefault(); setPartyCursor((c) => (c + move + party.length) % party.length); }
        else if (e.key === "Enter" && !onControl && party[partyCursor]) { e.preventDefault(); open(party[partyCursor].name); }
        else if (e.key === "Escape") { e.preventDefault(); update({ zoom: "region" }); }
        return;
      }
      if (move && menuRows.length) { e.preventDefault(); setCursor((c) => (c + move + menuRows.length) % menuRows.length); }
      else if (e.key === "Enter" && !onControl && menuRows[cursor]) { e.preventDefault(); pick(menuRows[cursor]); }
      else if (e.key === "Escape") {
        e.preventDefault();
        if (menuOpen) setMenuOpen(false); else if (zoom === "region") update({ zoom: "overview", focus: null });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom, card, party, partyCursor, menuRows, cursor, pick, open, update, menuOpen, secret, clickCritter]);

  // window.__lab — the harness's hook onto the real interaction paths
  useEffect(() => {
    if (!drawn) return;
    const w = window as unknown as { __lab?: unknown };
    w.__lab = {
      select: (name: string) => open(name),
      view: (v: { zoom: "overview" | "region" | "node"; focus?: string }) => { setSecret(null); update({ zoom: v.zoom, focus: v.focus ?? null }); },
      critterClick: (n: number) => {
        if (!focus) return false;
        for (let i = 0; i < n; i++) clickCritter();
      },
    };
    return () => { delete w.__lab; };
  }, [drawn, open, update, clickCritter, focus]);

  // ── the pixel hand: outside the halo, on a side free of tag/critter/seal ─
  const hand = useMemo(() => {
    if (!world || !drawn) return null;
    let n: { name: string; center: Pt; atom: boolean } | undefined;
    if (zoom === "node") n = focus ?? undefined;
    else if (zoom === "region") { const r = menuRows[cursor]; n = r?.kind === "model" ? byName.get(r.key) : undefined; }
    else { const r = menuRows[cursor]; n = r?.kind === "family" ? entryAtom(r.family) : undefined; }
    if (!n) return null;
    const taken = new Set<string>(["up"]);                 // the champion seal sits top-right
    const tag = labels.find((l) => l.node === n!.name);
    if (tag) {
      if (tag.anchor.includes("W")) taken.add("left");
      if (tag.anchor.includes("E")) taken.add("right");
      if (tag.anchor.includes("S")) taken.add("down");
    }
    const pk = parkOut ?? park;
    if (pk && focus && n.name === focus.name) {
      const dx = pk.x - n.center.x, dy = pk.y - n.center.y;
      if (Math.abs(dx) >= Math.abs(dy) * 0.5) taken.add(dx < 0 ? "left" : "right");
      if (Math.abs(dy) >= Math.abs(dx) * 0.5) taken.add(dy < 0 ? "up" : "down");
    }
    // also skip a side whose hand box would land on any other name tag
    {
      const pc0 = proj(n.center);
      const cx0 = (pc0.x - cam.box.x) * cam.scale, cy0 = (pc0.y - cam.box.y) * cam.scale;
      const off0 = ((n.atom ? SPOT_R.atom : SPOT_R.town) * (focus?.name === n.name ? 1.3 : 1) * spotScale(n.atom, cam.scale, ATOM_PX).k + 24) * cam.scale + 4;
      const boxAt = (d: string) => d === "left" ? { x: cx0 - off0 - 42, y: cy0 - 17, w: 42, h: 33 } : d === "right" ? { x: cx0 + off0, y: cy0 - 17, w: 42, h: 33 }
        : d === "down" ? { x: cx0 - 17, y: cy0 + off0, w: 33, h: 42 } : { x: cx0 - 17, y: cy0 - off0 - 42, w: 33, h: 42 };
      for (const d of ["left", "right", "down", "up"]) {
        const b = boxAt(d);
        if (labels.some((l) => b.x < l.x + l.w && l.x < b.x + b.w && b.y < l.y + l.h && l.y < b.y + b.h)) taken.add(d);
      }
    }
    const side = (["left", "right", "down", "up"] as const).find((d) => !taken.has(d)) ?? "left";
    const halo = (n.atom ? SPOT_R.atom : SPOT_R.town) * (focus?.name === n.name ? 1.3 : 1) * spotScale(n.atom, cam.scale, ATOM_PX).k + 24;
    const pc = proj(n.center);
    const cx = (pc.x - cam.box.x) * cam.scale, cy = (pc.y - cam.box.y) * cam.scale;
    const off = halo * cam.scale + 4;
    const pos = side === "left" ? { x: cx - off, y: cy } : side === "right" ? { x: cx + off, y: cy } : side === "down" ? { x: cx, y: cy + off } : { x: cx, y: cy - off };
    return { ...pos, side };
  }, [world, drawn, zoom, focus, menuRows, cursor, byName, entryAtom, labels, park, cam.box.x, cam.box.y, cam.scale]);

  const toScreen = (p: Pt) => { const q = proj(p); return { x: (q.x - cam.box.x) * cam.scale, y: (q.y - cam.box.y) * cam.scale }; };
  const handUrl = useMemo(() => handCssUrl(), []);
  const HW = 14 * 3, HH = 11 * 3;
  const showMenu = !secret && (mobile ? menuOpen || zoom === "overview" : zoom !== "node");
  const grokNode = byName.get(GROKKING_EGG.model);
  const crumbs = useMemo(() => [
    ...(zoom !== "overview" ? [{ label: "All families", onClick: () => update({ zoom: "overview", focus: null }) }] : []),
    ...(family ? [{ label: familyLabel(family), onClick: zoom === "node" ? () => update({ zoom: "region" }) : undefined }] : []),
    ...(zoom === "node" && focus ? [{ label: displayName(focus.name) }] : []),
  ], [zoom, family, focus, update]);
  const crumbsShown = useMemo(() => (mobile ? crumbs.slice(-1) : crumbs), [mobile, crumbs]);
  const compositions = useMemo(() => (card && taxonomy ? taxonomy.compositions.filter((c) => c.composes.includes(card.name)) : []), [card, taxonomy]);
  const closeCard = useCallback(() => update({ zoom: "region" }), [update]);
  const toggleMenu = useCallback(() => setMenuOpen((o) => !o), []);
  const menuStyle = useMemo(() => (mobile ? undefined : { top: GAP + TITLE_H + 8, width: zoom === "overview" ? 336 : MENU_W }), [mobile, zoom]);
  const secretEra = secret?.kind === "era" ? NEXT_ERA.find((m) => m.id === secret.id) : null;
  const ruinSite = secret?.kind === "ruin" && world ? ruinsLayout(world).sites[Number(secret.id)] ?? null : null;
  const ruinList = ruinSite ? ruinSite.ids.map((id) => RUINS.find((r) => r.id === id)).filter((r): r is (typeof RUINS)[number] => Boolean(r)) : [];
  const secretRuin = ruinList.length ? ruinList : null;

  return (
    <LabMotion still={still}>
      <div ref={stageRef} data-lab-ready={drawn ? "1" : undefined} className={s.stage}
        style={{ ["--hybrid-hand" as string]: handUrl, ["--paper-display" as string]: "var(--font-hybrid-round)", background: "#1E62D9" }}>
        {/* the diorama */}
        <div ref={cam.ref} {...cam.handlers}
          onWheel={(e) => { setRoamed(true); cam.handlers.onWheel(e); }}
          onPointerMove={(e) => { if (e.buttons) setRoamed(true); cam.handlers.onPointerMove(e); }}
          onPointerDown={(e) => { if (!(e.target as Element).closest("[data-node],[data-critter],[data-secret]")) cam.handlers.onPointerDown(e); }}
          onClick={(e) => {
            const el = e.target as Element;
            if (el.closest("[data-critter]")) { clickCritter(); return; }
            const sec = el.closest("[data-secret]")?.getAttribute("data-secret");
            if (sec) { const [k, id] = sec.split(":"); setSecret({ kind: k as "era" | "ruin", id }); return; }
            const n = el.closest("[data-node]")?.getAttribute("data-node");
            if (n) open(n);
          }}
          className="absolute inset-0 touch-none cursor-grab active:cursor-grabbing">
          {world && (
            <svg viewBox={cam.viewBox} className="h-full w-full select-none" role="application" aria-label="Paper map of the model zoo"
              style={{ fontFamily: "var(--font-hybrid-round), system-ui, sans-serif" }}>
              <Diorama world={world} states={states} stations={stations} focus={focus} zoom={zoom}
                lineageNames={lineageNames} lineageRoads={lineageRoads} quest={questOut} scale={qScale} still={still}
                critter={critterProp}
                ferry={ferryProp} trains={trains}
                konami={konamiProp} atomPx={ATOM_PX} showSecrets={roamed || Boolean(secret)} onHover={setHovered}
                landed={landed} steamers={steamers} />
            </svg>
          )}
        </div>

        {/* region signs (overview): cut-card banners on posts, beside each family's set-piece */}
        {signs.length > 0 && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
            {signs.map((g) => (
              <SignBoard key={g.family} x={g.x} y={g.y + g.h / 2} size={mobile ? 42 : 52} text={g.label} ramp={groundOf(g.family).face} />
            ))}
          </svg>
        )}
        {/* harbour count badges */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {badges.map((b) => <span key={b.key} className={s.badge} style={{ left: b.x, top: b.y }}>{b.n}</span>)}
        </div>

        {/* foreground tree cutout overlapping the frame corner (depth only, no data) */}
        {!mobile && drawn && (
          <svg className="pointer-events-none absolute" style={{ left: -60, bottom: -40, width: 300, height: 300 }} aria-hidden>
            <BigTree x={130} y={300} size={260} />
          </svg>
        )}

        {/* overview corner furniture: compass rose + a glimpse of the uncharted island */}
        {!mobile && zoom === "overview" && drawn && !secret && (
          <>
            <div className="pointer-events-none absolute" style={{ right: 18, bottom: 16, zIndex: 6 }}><CompassRose size={128} /></div>
            <div className="absolute" style={{ right: -30, bottom: 190 }}>
              <UnchartedGlimpse onOpen={() => { setRoamed(true); setSecret({ kind: "era", id: NEXT_ERA[0].id }); }} />
            </div>
          </>
        )}

        {/* screen-space map tags (paper, Fredoka, constant size) */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {labels.map((l) => (
            <span key={l.node} className={`${s.tag} ${l.node === focus?.name ? s.tagFocus : ""} ${l.dim ? s.tagDim : ""} ${byName.get(l.node)?.atom ? s.tagAtom : ""}`}
              style={{ left: l.x, top: l.y, width: l.w, height: l.h, fontSize: l.font }}>
              {displayName(l.node)}
            </span>
          ))}
        </div>

        {hand && !(mobile && zoom === "overview") && (
          <div className={s.hand} style={{
            left: hand.side === "left" ? hand.x - HW : hand.side === "right" ? hand.x : hand.x - HW / 2,
            top: hand.side === "down" ? hand.y : hand.side === "up" ? hand.y - HH : hand.y - HH / 2,
          }}>
            <PixelSprite sprite={HAND} scale={3} style={{
              transform: hand.side === "right" ? "scaleX(-1)" : hand.side === "down" ? "rotate(-90deg)" : hand.side === "up" ? "rotate(90deg)" : undefined,
            }} />
          </div>
        )}

        {/* eggs: grokking clicks late (hover/focus the grokking spot for 4s) */}
        {grokNode && hovered === GROKKING_EGG.model && !still && (() => {
          const p = toScreen(grokNode.center);
          return (
            <PixelWindow kind="dialog" as="div" label="Grokking" className={s.bubble} style={{ left: Math.min(vp.w - 280, p.x + 30), top: Math.max(70, p.y - 150) }}>
              <div className="px-2 py-1">
                <p className={`${s.t16} ${grokked ? s.lime : ""}`}>{grokked ? GROKKING_EGG.after : GROKKING_EGG.before}</p>
                {grokked && (
                  <>
                    <p className={`${s.t14} ${s.dim} mt-1`}>{GROKKING_EGG.explain}</p>
                    <div className="mt-2">
                      <Sparkline points={GROKKING_EGG.sketch.val as unknown as [number, number][]} label="held-out accuracy" width={220} height={50}
                        palette={{ line: UI.good, axis: UI.panelHi, text: UI.dim }} showValues={false} />
                      <p className={`${s.t14} ${s.dim}`}>{GROKKING_EGG.sketch.note}</p>
                    </div>
                  </>
                )}
              </div>
            </PixelWindow>
          );
        })()}

        {/* eggs: the critter trains (7 clicks) on a REAL loss curve */}
        {trainUnlocked && real.curve && park && (() => {
          const p = toScreen(parkOut ?? park);
          // anchored on the critter's side, outside the focus disc
          const fr = focusDisc ?? { x: p.x + 1, y: p.y, r: 0 };
          const leftSide = p.x <= fr.x;
          const bx = leftSide ? fr.x - fr.r - 12 - 272 : fr.x + fr.r + 12;
          return (
            <PixelWindow kind="dialog" as="div" label="The critter trains" className={s.bubble}
              style={{ left: Math.max(8, Math.min(vp.w - 280, bx)), top: Math.max(70, Math.min(vp.h - 200, fr.y - 90)) }}>
              <div className="px-2 py-1">
                <p className={s.t16}>Training… this is a real loss curve.</p>
                <Sparkline points={real.curve.points} label={real.curve.key} progress={trainP} width={220} height={56}
                  palette={{ line: UI.gold, axis: UI.panelHi, text: UI.dim }} />
                <p className={`${s.t14} ${s.dim}`}>run {real.curve.runId}</p>
              </div>
            </PixelWindow>
          );
        })()}

        {/* slim title + (at most) one window */}
        {world && (
          <div className={mobile ? "absolute inset-x-2 top-2 z-30" : "absolute left-4 top-4 z-30"} style={mobile ? undefined : { maxWidth: `calc(100% - ${zoom === "node" ? CARD_W + 64 : 32}px)` }}>
            <SlimTitle models={world.nodes.length} families={families.length} crumbs={crumbsShown}
              onMenu={mobile && zoom !== "overview" ? toggleMenu : undefined} menuOpen={menuOpen}
              toast={konamiGen != null ? `Forward pass: generation ${konamiGen + 1}` : null} />
          </div>
        )}
        {world && showMenu && landed && (
          <RegionMenu title={family ? familyLabel(family) : "Jump to a family"} ribbonColor={family ? chromeSwatch(family) : undefined} rows={menuRows} cursor={cursor}
            onPick={pick} onHover={setCursor} touch={mobile} legend={!mobile && zoom === "overview" ? <MapKey /> : undefined} compact={zoom === "overview"}
            footer={mobile
              ? undefined
              : family ? "Arrow keys choose, Enter opens, Esc goes back." : "Arrow keys choose a family, Enter visits it."}
            className={mobile
              ? zoom === "overview" ? "fixed inset-x-2 bottom-2 z-30 flex" : "fixed inset-x-2 bottom-2 z-30 flex max-h-[45%]"
              : "absolute left-4 z-20 flex max-h-[calc(100%-104px)]"}
            style={menuStyle} />
        )}
        {card && !secret && landed && (
          <LessonCard card={card} lesson={lessonM} evidence={evidence} party={party} partyCursor={partyCursor} onParty={open}
            onHover={setPartyCursor} onClose={closeCard} still={still} mobile={mobile}
            compositions={compositions} sailing={sailing} onSail={setSailing} />
        )}
        {secretEra && (
          <PixelWindow as="aside" lifted label="Uncharted model" ribbon={{ text: "Uncharted", color: "#DCE9F7" }}
            className={mobile ? "absolute inset-x-2 bottom-2 z-20" : "absolute right-4 top-4 z-20 w-[380px]"}>
            <div className={`${s.pad} flex flex-col gap-3`}>
              <header className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className={s.t24}>{secretEra.name}</h2>
                  <p className={`${s.t14} ${s.dim}`}>{NEXT_ERA_COPY.caption}</p>
                </div>
                <button type="button" className={s.btn} onClick={() => setSecret(null)}>Close</button>
              </header>
              <p className={`${s.t16} ${s.measure}`}>{secretEra.teaser}</p>
              {byName.has(secretEra.buildsOn) && (
                <button type="button" className={`${s.btn} self-start`} onClick={() => open(secretEra.buildsOn)}>
                  Visit {displayName(secretEra.buildsOn)}, where it would grow from
                </button>
              )}
            </div>
          </PixelWindow>
        )}
        {secretRuin && (
          <PixelWindow as="aside" lifted label="Ruins" ribbon={{ text: "Ruins of retired models", color: "#E2D0A8" }}
            className={mobile ? "absolute inset-x-2 bottom-2 z-20 flex max-h-[55%]" : "absolute right-4 top-4 z-20 flex w-[380px] max-h-[calc(100%-32px)]"}
            bodyClassName={`${s.scroll} min-h-0 flex-1`}>
            <div className={`${s.pad} flex flex-col gap-4`}>
              <div className="flex justify-end"><button type="button" className={s.btn} onClick={() => setSecret(null)}>Close</button></div>
              {secretRuin.map((r) => (
                <section key={r.id}>
                  <h2 className={s.t18} style={{ fontWeight: 700 }}>{r.name}</h2>
                  <p className={`${s.t14} ${s.dim}`}>{r.path}</p>
                  <p className={`${s.t16} ${s.measure} mt-1`}>{r.epitaph}</p>
                  {r.successor && byName.has(r.successor) && (
                    <button type="button" className={`${s.btn} mt-2`} onClick={() => open(r.successor!)}>
                      Visit its successor, {displayName(r.successor)}
                    </button>
                  )}
                </section>
              ))}
            </div>
          </PixelWindow>
        )}
      </div>
    </LabMotion>
  );
}
