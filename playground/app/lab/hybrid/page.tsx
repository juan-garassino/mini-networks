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
import { Diorama, SPOT_R, TILT, boxOfPoints, proj, projBox, spotScale } from "@/components/lab/hybrid/diorama";
import { groundOf } from "@/components/lab/hybrid/art";
import { LessonCard, type PartyMember } from "@/components/lab/hybrid/card";
import { PixelSprite, PixelWindow, handCssUrl } from "@/components/lab/hybrid/chrome";
import { RegionMenu, SlimTitle, type MenuRow } from "@/components/lab/hybrid/menu";
import { frameInto, landBox, nodeBox, unionBox, type Insets } from "@/components/lab/hybrid/frame";
import { HAND } from "@/components/lab/hybrid/pixel-art";
import { UI, familyLabel } from "@/components/lab/hybrid/palette";
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
  const walk = useMemo(() => (world && focus ? pathToAtom(world, focus.name) : null), [world, focus]);
  const lin = useMemo(() => (world && focus ? lineage(world, focus.name) : null), [world, focus]);
  const park = useMemo(() => (world && focus ? parkingSpot(world, focus.name) : null), [world, focus]);
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
    if (sailing === DOUBLE_DESCENT_EGG.composition) {
      // the double_descent egg: the course dips twice
      const b = pts;
      const cum = b.slice(1).reduce((a, q, i) => a + Math.hypot(q.x - b[i].x, q.y - b[i].y), 0);
      const amp = Math.min(70, cum * 0.12);
      const dense: Pt[] = [];
      for (let i = 1; i < b.length; i++) for (let k = 0; k < 12; k++) {
        const u = k / 12; dense.push({ x: b[i - 1].x + (b[i].x - b[i - 1].x) * u, y: b[i - 1].y + (b[i].y - b[i - 1].y) * u });
      }
      dense.push(b[b.length - 1]);
      pts = dense.map((q, i) => ({ x: q.x, y: q.y + dipDepth(i / (dense.length - 1)) * amp }));
    }
    const fams = [...new Set(members.map((m) => byName.get(m)?.family ?? ""))];
    return { points: pts, families: fams };
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

  const critterProp = useMemo(() => (focus ? { training: trainUnlocked && Boolean(real.curve) } : null), [focus, trainUnlocked, real.curve]);
  const ferryProp = useMemo(() => (ferry ? { ...ferry, t: sailT } : null), [ferry, sailT]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const lessonM = useMemo(() => lesson, [lesson.lesson, lesson.curve, lesson.curveRun, lesson.samples, lesson.loading, lesson.error, lesson.champion?.label]);

  // ── camera: framed into what the chrome leaves free (in projected px) ─
  const oneWindowLeft = !mobile && zoom !== "node";
  const insets: Insets = mobile
    ? { l: 0, r: 0, t: TITLE_H + 8, b: zoom === "node" ? Math.round(vp.h * 0.55) + 12 : zoom === "overview" ? 200 : 16 }
    : { l: oneWindowLeft ? GAP + MENU_W + GAP : GAP, r: zoom === "node" ? GAP + CARD_W + GAP : GAP, t: GAP + TITLE_H, b: GAP };
  const target: CamBox = useMemo(() => {
    if (!world) return { x: 0, y: 0, w: 1, h: 1 };
    let box: Box = zoom === "node" && focus ? nodeBox(world, focus.name, quest)
      : zoom === "region" && family ? world.camera.regions[family]
      : landBox(world);
    if (zoom === "node" && ferry && ferry.points.length > 1) box = unionBox([box, boxOfPoints(ferry.points, 60)]);
    if (secret) {
      const isl = secret.kind === "era" ? world.hiddenIsland : world.ruinsIsland;
      box = { x: isl.box.x - 120, y: isl.box.y - 120, w: isl.box.w + 240, h: isl.box.h + 240 };
    }
    let pb = projBox(box);
    // stand-up props rise above the ground: keep room for castles and set-pieces
    pb = { x: pb.x, y: pb.y - 70, w: pb.w, h: pb.h + 70 };
    if (mobile && zoom === "overview") {
      // phone: the land fills the height between title and menu; the sides
      // (coast and sea margin) may run off-screen — pan to see them
      const ih = vp.h - insets.t - insets.b;
      const k = Math.min(ih / pb.h, (vp.w / pb.w) * 2.5);
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
  const cam = useCamera({ world: world ? projBox(world.camera.all) : target, target, still, minWidth: 240 });

  // Heavy work waits for the camera to settle: the map only gets a quantised
  // scale (spots re-render on zoom steps, not every tween frame) and labels /
  // signs are placed from a camera snapshot taken once it stops moving.
  const qScale = Math.round(cam.scale * 20) / 20;
  const [settled, setSettled] = useState<{ box: CamBox; size: { w: number; h: number }; scale: number } | null>(null);
  useEffect(() => {
    const snap = { box: cam.box, size: cam.size, scale: cam.scale };
    if (still) { setSettled(snap); return; }
    setSettled(null);
    const id = setTimeout(() => setSettled(snap), 140);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cam.box.x, cam.box.y, cam.box.w, cam.box.h, cam.size.w, cam.size.h, still]);

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
    const placed: Box[] = [...chrome];
    const out: { family: string; label: string; n: number; x: number; y: number; w: number; h: number }[] = [];
    const hit = (a: Box, b: Box, m: number) => a.x < b.x + b.w + m && b.x < a.x + a.w + m && a.y < b.y + b.h + m && b.y < a.y + a.h + m;
    for (const r of world.regions) {
      if (!r.setPiece) continue;
      const sp = r.setPiece;
      const c = toS({ x: (sp.x + sp.w / 2) * world.tile, y: (sp.y + sp.h + 1) * world.tile });
      const label = familyLabel(r.family);
      const w = label.length * (mobile ? 8.5 : 11) + (mobile ? 22 : 34), h = mobile ? 26 : 50;
      let best: Box | null = null;
      search: for (let rad = 0; rad <= (mobile ? 150 : 320); rad += mobile ? 10 : 16) {
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
  }, [world, zoom, settled, counts, mobile, ATOM_PX, chromeKey]);

  // ── screen-space labels: constant size, priority placed, culled ─────────
  const labels: (ScreenLabel & { dim: boolean })[] = useMemo(() => {
    const C = settled;
    if (!C || !world || C.size.w <= 1) return [];
    // semantic zoom: at whole-map zoom atoms are drawn bigger than their
    // footprint, so their tags keep that much extra clearance
    const atomScreenR = SPOT_R.atom * C.scale * spotScale(true, C.scale, ATOM_PX).k;
    const gap = Math.max(4, atomScreenR - 2 * world.tile * C.scale + 6);
    const blocks = [...chrome, ...signs.map((g) => ({ x: g.x - g.w / 2, y: g.y - g.h / 2, w: g.w, h: g.h }))];
    // stand-up castles rise above an atom's footprint, set-pieces above their box
    for (const n of world.nodes) if (n.atom) {
      const R = SPOT_R.atom * C.scale * spotScale(true, C.scale, ATOM_PX).k * (n.name === focus?.name ? 1.3 : 1);
      const x = (n.center.x - C.box.x) * C.scale, y = (n.center.y * TILT - C.box.y) * C.scale;
      blocks.push({ x: x - R, y: y - R * 2.1, w: 2 * R, h: R * 1.6 });
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
    return placed
      .filter((l) => zoom !== "overview" || byName.get(l.node)?.atom)
      .filter((l) => !blocks.some((c) => hit(l, c)))
      .map((l) => ({
        ...l,
        dim: (zoom === "node" && !lineageNames.has(l.node)) || (zoom === "region" && byName.get(l.node)?.family !== family),
      }));
  }, [world, settled, focus, zoom, chrome, signs, lineageNames, byName, family]);

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
    if (park && focus && n.name === focus.name) {
      const dx = park.x - n.center.x, dy = park.y - n.center.y;
      if (Math.abs(dx) >= Math.abs(dy) * 0.5) taken.add(dx < 0 ? "left" : "right");
      if (Math.abs(dy) >= Math.abs(dx) * 0.5) taken.add(dy < 0 ? "up" : "down");
    }
    const side = (["left", "right", "down", "up"] as const).find((d) => !taken.has(d)) ?? "left";
    const halo = (n.atom ? SPOT_R.atom : SPOT_R.town) * (focus?.name === n.name ? 1.3 : 1) * spotScale(n.atom, cam.scale, ATOM_PX).k + 12;
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
  const menuStyle = useMemo(() => (mobile ? undefined : { top: GAP + TITLE_H + 8, width: MENU_W }), [mobile]);
  const secretEra = secret?.kind === "era" ? NEXT_ERA.find((m) => m.id === secret.id) : null;
  const secretRuin = secret?.kind === "ruin" ? RUINS.find((r) => r.id === secret.id) : null;

  return (
    <LabMotion still={still}>
      <div ref={stageRef} data-lab-ready={drawn ? "1" : undefined} className={s.stage}
        style={{ ["--hybrid-hand" as string]: handUrl, background: "#1E62D9" }}>
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
                lineageNames={lineageNames} lineageRoads={lineageRoads} quest={quest} scale={qScale} still={still}
                critter={critterProp}
                ferry={ferryProp} trains={trains}
                konami={konamiProp} atomPx={ATOM_PX} showSecrets={roamed || Boolean(secret)} onHover={setHovered} />
            </svg>
          )}
        </div>

        {/* region signs (overview): vivid printed plates on each family's set-piece */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {signs.map((g) => (
            <span key={g.family} className={`${s.sign} ${mobile ? s.signSmall : ""}`} style={{ left: g.x, top: g.y, background: groundOf(g.family).face[3] }}>
              {g.label}{!mobile && <span className={s.signCount}>{g.n} models</span>}
            </span>
          ))}
        </div>

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
          const p = toScreen(park);
          return (
            <PixelWindow kind="dialog" as="div" label="The critter trains" className={s.bubble} style={{ left: Math.max(8, Math.min(vp.w - 280, p.x - 130)), top: Math.max(70, p.y - 170) }}>
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
        {world && showMenu && (
          <RegionMenu title={family ? familyLabel(family) : "Jump to a family"} rows={menuRows} cursor={cursor}
            onPick={pick} onHover={setCursor} touch={mobile} compact={mobile && zoom === "overview"}
            footer={mobile
              ? undefined
              : family ? "Arrow keys choose, Enter opens, Esc goes back." : "Arrow keys choose a family, Enter visits it."}
            className={mobile
              ? zoom === "overview" ? "fixed inset-x-2 bottom-2 z-30 flex" : "fixed inset-x-2 bottom-2 z-30 flex max-h-[45%]"
              : "absolute left-4 z-20 flex max-h-[calc(100%-104px)]"}
            style={menuStyle} />
        )}
        {card && !secret && (
          <LessonCard card={card} lesson={lessonM} evidence={evidence} party={party} partyCursor={partyCursor} onParty={open}
            onHover={setPartyCursor} onClose={closeCard} still={still} mobile={mobile}
            compositions={compositions} sailing={sailing} onSail={setSailing} />
        )}
        {(secretEra || secretRuin) && (
          <PixelWindow as="aside" lifted label={secretEra ? "Uncharted model" : "Ruin"}
            className={mobile ? "absolute inset-x-2 bottom-2 z-20" : "absolute right-4 top-4 z-20 w-[380px]"}>
            <div className={`${s.pad} flex flex-col gap-3`}>
              <header className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className={s.t24}>{secretEra ? secretEra.name : secretRuin!.name}</h2>
                  <p className={`${s.t14} ${s.dim}`}>{secretEra ? NEXT_ERA_COPY.caption : `Ruin of ${secretRuin!.path}`}</p>
                </div>
                <button type="button" className={s.btn} onClick={() => setSecret(null)}>Close</button>
              </header>
              <p className={`${s.t16} ${s.measure}`}>{secretEra ? secretEra.teaser : secretRuin!.epitaph}</p>
              {(secretEra ? secretEra.buildsOn : secretRuin!.successor) && byName.has((secretEra ? secretEra.buildsOn : secretRuin!.successor)!) && (
                <button type="button" className={`${s.btn} self-start`} onClick={() => open((secretEra ? secretEra.buildsOn : secretRuin!.successor)!)}>
                  {secretEra ? `Visit ${displayName(secretEra.buildsOn)}, where it would grow from` : `Visit its successor, ${displayName(secretRuin!.successor!)}`}
                </button>
              )}
            </div>
          </PixelWindow>
        )}
      </div>
    </LabMotion>
  );
}
