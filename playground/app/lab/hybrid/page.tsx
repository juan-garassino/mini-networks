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
import { Diorama, SPOT_R, boxOfPoints, spotScale } from "@/components/lab/hybrid/diorama";
import { groundOf } from "@/components/lab/hybrid/art";
import { LessonCard, type PartyMember } from "@/components/lab/hybrid/card";
import { PixelSprite, PixelWindow, handCssUrl } from "@/components/lab/hybrid/chrome";
import { RegionMenu, SlimTitle, type MenuRow } from "@/components/lab/hybrid/menu";
import { frameInto, landBox, nodeBox, unionBox, type Insets } from "@/components/lab/hybrid/frame";
import { HAND } from "@/components/lab/hybrid/pixel-art";
import { UI, familyLabel } from "@/components/lab/hybrid/palette";
import s from "@/components/lab/hybrid/hybrid.module.css";

const GAP = 16;
const MENU_W = 300;
const CARD_W = 420;
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
  const [konami, setKonami] = useState<{ t0: number; t: number } | null>(null);
  const schedule = useMemo(() => (world ? forwardPassSchedule(forwardPassOrder(world), 450) : {}), [world]);
  const waveLen = useMemo(() => Math.max(0, ...Object.values(schedule)) + 900, [schedule]);
  useKonami(() => setKonami({ t0: performance.now(), t: 0 }), !still && drawn);
  useEffect(() => {
    if (!konami) return;
    let raf = 0;
    const step = (now: number) => {
      const t = now - konami.t0;
      if (t > waveLen) { setKonami(null); return; }
      setKonami((k) => (k ? { ...k, t } : k));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [konami?.t0, waveLen]);
  const konamiGen = konami ? Math.min(3, Math.floor(konami.t / 450)) : null;

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

  // ── camera: framed into what the chrome leaves free ─────────────────────
  const oneWindowLeft = !mobile && zoom !== "node";
  const insets: Insets = mobile
    ? { l: 8, r: 8, t: TITLE_H + 8, b: zoom === "node" ? Math.round(vp.h * 0.55) + 12 : zoom === "overview" ? 300 : 16 }
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
    if (mobile && zoom === "node" && focus && !ferry) {
      const iw = vp.w - insets.l - insets.r, ih = vp.h - insets.t - insets.b;
      const w = Math.min(box.w, iw), h = Math.min(box.h, ih);
      box = { x: focus.center.x - w / 2, y: focus.center.y - h / 2, w, h };
    }
    return frameInto(box, vp.w, vp.h, insets);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, zoom, focus, family, quest, ferry, secret, mobile, vp.w, vp.h, insets.l, insets.r, insets.t, insets.b]);
  const cam = useCamera({ world: world?.camera.all ?? target, target, still, minWidth: 240 });

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

  // ── region signs at whole-map zoom (screen space, on each set-piece) ────
  const signs = useMemo(() => {
    if (!world || zoom !== "overview" || cam.size.w <= 1) return [];
    const toS = (p: Pt) => ({ x: (p.x - cam.box.x) * cam.scale, y: (p.y - cam.box.y) * cam.scale });
    const rAtom = SPOT_R.atom * cam.scale * spotScale(true, cam.scale, ATOM_PX).k + 8;
    const rTown = SPOT_R.town * cam.scale * 0.7 + 4;
    const spots = world.nodes.map((n) => ({ ...toS(n.center), r: n.atom ? rAtom : rTown }));
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    const out: { family: string; label: string; n: number; x: number; y: number; w: number; h: number }[] = [];
    for (const r of world.regions) {
      if (!r.setPiece) continue;
      const sp = r.setPiece;
      const c = toS({ x: (sp.x + sp.w / 2) * world.tile, y: (sp.y + sp.h / 2) * world.tile });
      const label = familyLabel(r.family);
      const w = label.length * (mobile ? 8.5 : 11) + (mobile ? 22 : 34), h = mobile ? 26 : 50;
      // the sign is pinned to the family's set-piece; if it would cover a
      // model, it slides to the nearest free side (never onto a spot)
      const cands = [[0, 0], [0, -h * 0.8], [0, h * 0.8], [-w * 0.6, 0], [w * 0.6, 0], [0, -h * 1.6], [0, h * 1.6]]
        .filter(([dx]) => c.x + dx + w / 2 <= cam.size.w - 24 && c.x + dx - w / 2 >= 24);
      if (!cands.length) cands.push([0, 0]);
      let best = cands[0];
      for (const [dx, dy] of cands) {
        const b = { x: c.x + dx - w / 2, y: c.y + dy - h / 2, w, h };
        const clash = spots.some((q) => q.x > b.x - q.r && q.x < b.x + b.w + q.r && q.y > b.y - q.r && q.y < b.y + b.h + q.r)
          || placed.some((o) => b.x < o.x + o.w + 6 && o.x < b.x + b.w + 6 && b.y < o.y + o.h + 6 && o.y < b.y + b.h + 6);
        if (!clash) { best = [dx, dy]; break; }
      }
      const b = { x: c.x + best[0] - w / 2, y: c.y + best[1] - h / 2, w, h };
      // never cut by the viewport edge (24px margin, like the name tags)
      b.x = Math.min(Math.max(b.x, 24), cam.size.w - w - 24);
      b.y = Math.min(Math.max(b.y, 24), cam.size.h - h - 24);
      placed.push(b);
      out.push({ family: r.family, label, n: counts[r.family] ?? 0, x: b.x + w / 2, y: b.y + h / 2, w, h });
    }
    return out;
  }, [world, zoom, cam.box.x, cam.box.y, cam.scale, cam.size.w, cam.size.h, counts, mobile, ATOM_PX]);

  // ── screen-space labels: constant size, priority placed, culled ─────────
  const labels: (ScreenLabel & { dim: boolean })[] = useMemo(() => {
    if (!world || cam.size.w <= 1) return [];
    // semantic zoom: at whole-map zoom atoms are drawn bigger than their
    // footprint, so their tags keep that much extra clearance
    const atomScreenR = SPOT_R.atom * cam.scale * spotScale(true, cam.scale, ATOM_PX).k;
    const gap = Math.max(4, atomScreenR - 2 * world.tile * cam.scale + 6);
    const placed = placeScreenLabels(world, cam.box, cam.size, {
      font: { atom: 16, derived: 15 }, focus: focus?.name ?? null, edgeMargin: 24, gap,
      measure: (t, f) => ({ w: 0.56 * f * t.length + 14, h: f + 10 }),
    });
    const blocks = [...chrome, ...signs.map((g) => ({ x: g.x - g.w / 2, y: g.y - g.h / 2, w: g.w, h: g.h }))];
    const hit = (a: Box, b: Box) => a.x < b.x + b.w + 4 && b.x < a.x + a.w + 4 && a.y < b.y + b.h + 4 && b.y < a.y + a.h + 4;
    return placed
      .filter((l) => zoom !== "overview" || byName.get(l.node)?.atom)
      .filter((l) => !blocks.some((c) => hit(l, c)))
      .map((l) => ({
        ...l,
        dim: (zoom === "node" && !lineageNames.has(l.node)) || (zoom === "region" && byName.get(l.node)?.family !== family),
      }));
  }, [world, cam.box, cam.size, focus, zoom, chrome, signs, lineageNames, byName, family]);

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
    const cx = (n.center.x - cam.box.x) * cam.scale, cy = (n.center.y - cam.box.y) * cam.scale;
    const off = halo * cam.scale + 4;
    const pos = side === "left" ? { x: cx - off, y: cy } : side === "right" ? { x: cx + off, y: cy } : side === "down" ? { x: cx, y: cy + off } : { x: cx, y: cy - off };
    return { ...pos, side };
  }, [world, drawn, zoom, focus, menuRows, cursor, byName, entryAtom, labels, park, cam.box.x, cam.box.y, cam.scale]);

  const toScreen = (p: Pt) => ({ x: (p.x - cam.box.x) * cam.scale, y: (p.y - cam.box.y) * cam.scale });
  const handUrl = useMemo(() => handCssUrl(), []);
  const HW = 14 * 3, HH = 11 * 3;
  const showMenu = !secret && (mobile ? menuOpen || zoom === "overview" : zoom !== "node");
  const grokNode = byName.get(GROKKING_EGG.model);
  const crumbs = [
    ...(zoom !== "overview" ? [{ label: "All families", onClick: () => update({ zoom: "overview", focus: null }) }] : []),
    ...(family ? [{ label: familyLabel(family), onClick: zoom === "node" ? () => update({ zoom: "region" }) : undefined }] : []),
    ...(zoom === "node" && focus ? [{ label: displayName(focus.name) }] : []),
  ];
  const compositions = card && taxonomy ? taxonomy.compositions.filter((c) => c.composes.includes(card.name)) : [];
  const secretEra = secret?.kind === "era" ? NEXT_ERA.find((m) => m.id === secret.id) : null;
  const secretRuin = secret?.kind === "ruin" ? RUINS.find((r) => r.id === secret.id) : null;

  return (
    <LabMotion still={still}>
      <div ref={stageRef} data-lab-ready={drawn ? "1" : undefined} className={s.stage}
        style={{ ["--hybrid-hand" as string]: handUrl, background: "#1E62D9" }}>
        {/* the diorama */}
        <div ref={cam.ref} {...cam.handlers}
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
                lineageNames={lineageNames} lineageRoads={lineageRoads} quest={quest} scale={cam.scale} still={still}
                critter={focus ? { training: trainUnlocked && Boolean(real.curve) } : null}
                ferry={ferry ? { ...ferry, t: sailT } : null} trains={trains}
                konami={konami ? { t: konami.t, schedule } : null} atomPx={ATOM_PX} onHover={setHovered} />
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
            <SlimTitle models={world.nodes.length} families={families.length} crumbs={mobile ? crumbs.slice(-1) : crumbs}
              onMenu={mobile && zoom !== "overview" ? () => setMenuOpen((o) => !o) : undefined} menuOpen={menuOpen}
              toast={konamiGen != null ? `Forward pass: generation ${konamiGen + 1}` : null} />
          </div>
        )}
        {world && showMenu && (
          <RegionMenu title={family ? familyLabel(family) : "Jump to a family"} rows={menuRows} cursor={cursor}
            onPick={pick} onHover={setCursor} touch={mobile}
            footer={mobile
              ? zoom === "overview" ? "Castles are atoms, where a family starts. A gold star marks a champion." : undefined
              : family ? "Arrow keys choose, Enter opens, Esc goes back." : "Arrow keys choose a family, Enter visits it."}
            className={mobile
              ? zoom === "overview" ? "fixed inset-x-2 bottom-2 z-30 flex max-h-[34%]" : "fixed inset-x-2 bottom-2 z-30 flex max-h-[45%]"
              : "absolute left-4 z-20 flex max-h-[calc(100%-104px)]"}
            style={mobile ? undefined : { top: GAP + TITLE_H + 8, width: MENU_W }} />
        )}
        {card && !secret && (
          <LessonCard card={card} lesson={lesson} evidence={evidence} party={party} partyCursor={partyCursor} onParty={open}
            onHover={setPartyCursor} onClose={() => update({ zoom: "region" })} still={still} mobile={mobile}
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
