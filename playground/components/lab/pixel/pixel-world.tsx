"use client";

// Skin B · 16-bit overworld. One <canvas> blits the cached autotiled terrain
// (terrain.ts) at an integer zoom (view.ts); DOM overlays carry every word
// (Pixelify Sans, never baked into the canvas), the hit targets and the
// JRPG status card. Positions come only from lib/world.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { pathToAtom, samplePolyline, type World, type WorldNode } from "@/lib/world";
import { useWorld } from "@/hooks/use-world";
import { useLabView, type Zoom } from "@/components/lab/shared/url-state";
import { LabMotion } from "@/components/lab/shared/still";
import { useCamera, type CamBox } from "@/components/lab/shared/camera";
import { cardModel, displayName, evidenceState } from "@/components/lab/shared/card-model";
import { CRITTER } from "@/components/lab/shared/critter";
import type { ModelEvidence, TaxonomyResponse } from "@/lib/types";
import { familyLabel } from "./palette";
import { flipX, flipY, sprite, toCanvas } from "./raster";
import { CORNER } from "./sprites";
import { critterFrames } from "./critter-sprite";
import { buildLayers, spotlight, TS, type Layers, type NodeLook } from "./terrain";
import { snapTile, toScreen, xformFor, type Stage, type Xform } from "./view";
import { StatusCard } from "./status-card";
import { PixelNum } from "./pixel-num";
import { cullChips, placeSigns, type Rect } from "./signs";
import { Legend } from "./legend";
import { TitleWindow } from "./title-window";
import styles from "./pixel.module.css";

const CARD_W = 380 + 16 + 8; // desktop card + right margin + breathing room
const SHEET = 0.52;          // mobile bottom sheet height (fraction of viewport)
const MOBILE_TOP = 112;
const TITLE_GUTTER = 120;    // desktop overview: sea kept free for the title window      // mobile title window height
const MOBILE_KEY = 60;       // mobile: the key is a collapsed button at the bottom

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

function padBox(b: CamBox, f: number, c: { x: number; y: number }): CamBox {
  const w = b.w * f, h = b.h * f;
  return { x: c.x - w / 2, y: c.y - h / 2, w, h };
}

/** Land bounds (regions ∪ labels) — the overview frames the islands, not the empty sea margin. */
function landBox(world: World): CamBox {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of world.regions) {
    x0 = Math.min(x0, r.bbox.x * TS); y0 = Math.min(y0, r.bbox.y * TS);
    x1 = Math.max(x1, (r.bbox.x + r.bbox.w) * TS); y1 = Math.max(y1, (r.bbox.y + r.bbox.h) * TS);
  }
  for (const l of world.labels) {
    x0 = Math.min(x0, l.box.x); y0 = Math.min(y0, l.box.y);
    x1 = Math.max(x1, l.box.x + l.box.w); y1 = Math.max(y1, l.box.y + l.box.h);
  }
  return { x: x0 - 8, y: y0 - 8, w: x1 - x0 + 16, h: y1 - y0 + 16 };
}

/**
 * Region zoom: fit the region's NODES (footprints + name labels), never below
 * ×2, cropping in "cover" style; the centre is pulled toward the focused model
 * so it always stays on screen. Drag pans to the rest of the land.
 */
function regionTarget(world: World, focus: WorldNode, stage: Stage): CamBox {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const grow = (b: CamBox) => { x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); };
  const names = new Set<string>();
  for (const n of world.nodes) if (n.family === focus.family) {
    names.add(n.name);
    grow({ x: n.foot.x * TS, y: n.foot.y * TS, w: n.foot.w * TS, h: n.foot.h * TS });
  }
  for (const l of world.labels) if (names.has(l.node)) grow(l.box);
  const bw = x1 - x0 + 32, bh = y1 - y0 + 32;
  const sw = Math.max(stage.w, 2), sh = Math.max(stage.h, 2);
  const k = Math.max(2, snapTile(Math.min(sw / bw, sh / bh)) / 16);
  const w = sw / k, h = sh / k;
  const clamp = (c: number, f: number, half: number) => Math.min(Math.max(c, f - half * 0.6), f + half * 0.6);
  const cx = clamp((x0 + x1) / 2, focus.center.x, w / 2), cy = clamp((y0 + y1) / 2, focus.center.y, h / 2);
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

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
    // mobile overview: the world sits between the title window and the map key
    if (mobile && zoom === "overview") return { x: 0, y: MOBILE_TOP, w: vp.w, h: Math.max(120, vp.h - MOBILE_TOP - MOBILE_KEY) };
    // desktop overview: nudge the islands east so the title window sits on open sea
    if (zoom === "overview" && vp.w >= 1200) return { x: TITLE_GUTTER, y: 0, w: vp.w - TITLE_GUTTER, h: vp.h };
    if (!cardOpen) return { x: 0, y: 0, w: vp.w, h: vp.h };
    return mobile ? { x: 0, y: 0, w: vp.w, h: Math.round(vp.h * (1 - SHEET)) } : { x: 0, y: 0, w: Math.max(200, vp.w - CARD_W), h: vp.h };
  }, [cardOpen, mobile, zoom, vp.w, vp.h]);

  const target: CamBox = useMemo(() => {
    if (!world) return { x: 0, y: 0, w: 1, h: 1 };
    if (zoom === "node" && focusNode) return padBox(world.camera.nodes[focusNode.name].box, 2.5, focusNode.center);
    if (zoom === "region" && focusNode) return regionTarget(world, focusNode, stage);
    return landBox(world);
  }, [world, zoom, focusNode, stage]);

  const cam = useCamera({ world: world?.camera.world ?? target, target, still });
  const xf: Xform = xformFor(cam.box, stage);

  // ——— evidence looks & cached layers ———
  const looks = useMemo(() => looksFrom(world, evidence, taxonomy), [world, evidence, taxonomy]);
  const lookSig = useMemo(() => [...looks].map(([k, v]) => `${k}:${v.state}:${v.filled}:${v.mech}`).join(","), [looks]);
  const [layers, setLayers] = useState<Layers | null>(null);
  useEffect(() => {
    if (!world || !ready) return;
    setLayers(buildLayers(world, looks));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, ready, lookSig]);

  const regionId = zoom === "region" && focusNode ? world?.regions.find((r) => r.family === focusNode.family)?.id ?? -1 : -1;
  const spot = useMemo(() => (layers && regionId >= 0 ? spotlight(layers, regionId) : null), [layers, regionId]);

  // ——— sprites for the live layer ———
  const critter = useMemo(() => {
    if (typeof document === "undefined") return null;
    const frames = critterFrames().map((rows) => sprite(rows));
    return { right: frames.map(toCanvas), left: frames.map((f) => toCanvas(flipX(f))), w: frames[0].w, h: frames[0].h };
  }, []);
  const corners = useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = sprite(CORNER);
    return [toCanvas(c), toCanvas(flipX(c)), toCanvas(flipY(c)), toCanvas(flipX(flipY(c)))];
  }, []);

  // ——— motion: water / sign frame, critter walk ———
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const animate = !still && !reduced;
  const [frame, setFrame] = useState<0 | 1>(0);
  useEffect(() => {
    if (!animate) { setFrame(0); return; }
    const id = setInterval(() => setFrame((f) => (f ? 0 : 1)), 650);
    return () => clearInterval(id);
  }, [animate]);

  const walk = useRef<{ pos: { x: number; y: number }; dir: 1 | -1; step: number } | null>(null);
  // lineage trail: the route from the root atom, revealed up to `walked` px
  const trail = useRef<{ at: (t: number) => { x: number; y: number }; length: number; walked: number } | null>(null);
  const drawRef = useRef<() => void>(() => {});
  useEffect(() => {
    trail.current = null;
    if (!world || !focusNode) { walk.current = null; drawRef.current(); return; }
    const path = pathToAtom(world, focusNode.name);
    const pts = [...path.points].reverse(); // root atom → focused model
    // atoms (no road to walk) stand at their own gate
    const park = pts.length < 2 || path.length < 1
      ? { x: focusNode.center.x + 20, y: focusNode.center.y + focusNode.foot.h * TS * 0.5 + 2 }
      : null;
    if (park) { walk.current = { pos: park, dir: -1, step: 0 }; drawRef.current(); return; }
    const s = samplePolyline(pts);
    const stop = s.length; // walk all the way onto the focused node
    trail.current = { at: s.at, length: s.length, walked: 0 };
    const place = (d: number) => {
      if (trail.current) trail.current.walked = d;
      const t = s.length ? d / s.length : 1;
      const p = s.at(t);
      const ahead = s.at(Math.min(1, t + 0.01));
      const dir: 1 | -1 = ahead.x < p.x - 0.01 ? -1 : 1;
      walk.current = { pos: { x: p.x, y: p.y }, dir, step: Math.max(0, Math.floor(d / 7)) % 4 };
    };
    // parked pose: standing on the node's front-right edge, the dot still visible
    const parkAt = () => { place(stop); walk.current = { pos: { x: focusNode.center.x + 12, y: focusNode.center.y + 16 }, dir: -1, step: 0 }; };
    if (!animate) { parkAt(); drawRef.current(); return; }
    const speed = Math.max(CRITTER.walkSpeed, stop / 3.2);
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      // rAF timestamps can precede t0 (frame start) → clamp at 0
      const d = Math.min(stop, Math.max(0, ((now - t0) / 1000) * speed));
      place(d);
      if (d >= stop) parkAt();
      drawRef.current();
      if (d < stop) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [world, focusNode, animate]);

  // ——— canvas painting ———
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawn, setDrawn] = useState(false);
  const feet = useMemo(() => (world?.nodes ?? []).map((n) => ({ x: n.foot.x * TS, y: n.foot.y * TS, w: n.foot.w * TS, h: n.foot.h * TS })), [world]);
  const latest = useRef({ xf, layers, frame, spot, focusNode, vp, critter, corners, feet });
  latest.current = { xf, layers, frame, spot, focusNode, vp, critter, corners, feet };

  const draw = useCallback(() => {
    const c = canvasRef.current;
    const L = latest.current;
    if (!c || !L.layers || L.vp.w === 0) return;
    const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
    const W = L.vp.w * dpr, H = L.vp.h * dpr;
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#29366f";
    ctx.fillRect(0, 0, W, H);
    const { tile, ox, oy } = L.xf;
    const layer = tile >= 16 ? L.layers.full[L.frame] : tile === 8 ? L.layers.mid : L.layers.far;
    const ts = tile >= 16 ? 16 : tile;
    const p = (tile / ts) * dpr;
    ctx.drawImage(layer, ox * dpr, oy * dpr, layer.width * p, layer.height * p);
    if (L.spot && tile >= 16) {
      // the dither continues past the world's edge so the spotlight has no seam
      const pc = document.createElement("canvas");
      pc.width = pc.height = 2 * p;
      const pctx = pc.getContext("2d")!;
      pctx.fillStyle = "#29366f"; pctx.fillRect(0, 0, 2 * p, 2 * p);
      pctx.fillStyle = "#1a1c2c"; pctx.fillRect(0, 0, p, p); pctx.fillRect(p, p, p, p);
      const pat = ctx.createPattern(pc, "repeat")!;
      pat.setTransform(new DOMMatrix().translate(ox * dpr, oy * dpr));
      ctx.fillStyle = pat;
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(layer, ox * dpr, oy * dpr, layer.width * p, layer.height * p);
      ctx.drawImage(L.spot, ox * dpr, oy * dpr, L.spot.width * p, L.spot.height * p);
    }

    const cs = Math.max(1, tile / 16) * dpr; // sprite scale on the live layer
    const n = L.focusNode;
    if (n && L.corners && tile >= 8) {
      const a = toScreen(L.xf, { x: n.foot.x * TS, y: n.foot.y * TS });
      const b = toScreen(L.xf, { x: (n.foot.x + n.foot.w) * TS, y: (n.foot.y + n.foot.h) * TS });
      const bs = Math.max(2, tile / 16) * dpr; // cursor is UI: never smaller than ×2
      const pad = 4 * bs, cw = 10 * bs, ch = 8 * bs;
      const [tl, tr, bl, br] = L.corners;
      const x0 = a.x * dpr - pad, y0 = a.y * dpr - pad, x1 = b.x * dpr + pad, y1 = b.y * dpr + pad;
      ctx.drawImage(tl, Math.round(x0), Math.round(y0), cw, ch);
      ctx.drawImage(tr, Math.round(x1 - cw), Math.round(y0), cw, ch);
      ctx.drawImage(bl, Math.round(x0), Math.round(y1 - ch), cw, ch);
      ctx.drawImage(br, Math.round(x1 - cw), Math.round(y1 - ch), cw, ch);
    }
    const tr = trail.current;
    if (tr && tile >= 16 && tr.length > 0) {
      // gold footprints behind the critter: the lineage route back to the root atom
      const bs = Math.max(2, tile / 16) * dpr;
      const GAP = 14;
      const feet = L.feet;
      for (let d = GAP; d <= tr.walked; d += GAP) {
        const wp = tr.at(d / tr.length);
        // no footprints on top of castles / dots the route passes through
        if (feet.some((f) => wp.x > f.x - 4 && wp.x < f.x + f.w + 4 && wp.y > f.y - 4 && wp.y < f.y + f.h + 4)) continue;
        const q = toScreen(L.xf, wp);
        // 4×4 art-px footprint: ink rim with clipped corners, 2×2 gold core
        const x = Math.round(q.x * dpr - 2 * bs), y = Math.round(q.y * dpr - 2 * bs);
        ctx.fillStyle = "#1a1c2c";
        ctx.fillRect(x + bs, y, 2 * bs, 4 * bs);
        ctx.fillRect(x, y + bs, 4 * bs, 2 * bs);
        ctx.fillStyle = "#ffcd75"; ctx.fillRect(x + bs, y + bs, 2 * bs, 2 * bs);
      }
    }
    const w = walk.current;
    if (w && L.critter && tile >= 16) {
      const sp = toScreen(L.xf, w.pos);
      const img = (w.dir < 0 ? L.critter.left : L.critter.right)[w.step];
      const dw = L.critter.w * cs, dh = L.critter.h * cs;
      ctx.drawImage(img, Math.round(sp.x * dpr - dw / 2), Math.round(sp.y * dpr - dh + 3 * cs), dw, dh);
    }
    if (!drawn) setDrawn(true);
  }, [drawn]);
  drawRef.current = draw;
  // layout effect: the canvas repaints in the same commit as the DOM labels,
  // so names never swim against the map during a fly-to
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

  // the shared camera starts a drag only after 4px; we only remember that a
  // drag happened so the release does not also count as a node click
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

  const card = useMemo(() => {
    if (!cardOpen || !focusNode || !taxonomy) return null;
    return cardModel(focusNode.name, { taxonomy, evidence, runs, family: focusNode.family, depth: focusNode.depth });
  }, [cardOpen, focusNode, taxonomy, evidence, runs]);
  const atoms = useMemo(() => new Set((world?.nodes ?? []).filter((n) => n.atom).map((n) => n.name)), [world]);

  // ——— overlay geometry ———
  const tile = xf.tile;
  const labelFont = (f: number) => (tile >= 32 ? f + 2 : f);
  const labels = useMemo(() => (world && tile >= 8
    ? world.labels.filter((l) => tile >= 16 || nodeOf.get(l.node)?.atom)
    : []), [world, tile, nodeOf]);

  // screen rects of the floating windows (signs / chips avoid them)
  const uiRects = useMemo<Rect[]>(() => (mobile
    ? [{ x: 0, y: 0, w: vp.w, h: MOBILE_TOP }]
    : [{ x: 0, y: 0, w: 344, h: zoom === "overview" ? 196 : 262 }]), [mobile, vp.w, zoom]);

  // overlays whose centre falls under the card / sheet are not drawn
  const inStage = (x: number, y: number) => x >= stage.x - 8 && x <= stage.x + stage.w + 8 && y >= stage.y - 40 && y <= stage.y + stage.h + 40
    || !cardOpen;

  // region signboards: on the set-piece plaza, nudged off labels / nodes / each other
  const signs = useMemo(() => {
    if (!world) return [];
    const twoLine = tile >= 16;
    const font = twoLine ? 16 : 14;
    const obstacles: Rect[] = [...uiRects];
    // set-piece monuments are data (the family's mechanism glyph): signs must not cover them
    for (const r of world.regions) if (r.setPiece) {
      const sp = r.setPiece, g = 32 * xf.k; // glyph art 16px drawn ×2 in world px
      const c = toScreen(xf, { x: (sp.x + sp.w / 2) * TS, y: (sp.y + sp.h / 2) * TS });
      obstacles.push({ x: c.x - g / 2 - 2, y: c.y - g / 2 - 2, w: g + 4, h: g + 4, weight: 50 });
    }
    for (const l of labels) {
      const a = toScreen(xf, l.box);
      const f = labelFont(l.font);
      const w = 0.6 * f * l.text.length + 8, h = 1.35 * f + 4;
      const bw = l.box.w * xf.k, bh = l.box.h * xf.k;
      const x = l.anchor.includes("W") ? a.x + bw - w : l.anchor.includes("E") ? a.x : a.x + (bw - w) / 2;
      const y = l.anchor.includes("N") ? a.y + bh - h : l.anchor.includes("S") ? a.y : a.y + (bh - h) / 2;
      obstacles.push({ x, y, w, h, weight: 20 });
    }
    for (const n of world.nodes) {
      const a = toScreen(xf, { x: n.foot.x * TS, y: n.foot.y * TS });
      const focus = n.name === focusNode?.name;
      const pad = focus ? 24 : twoLine ? 6 : 1;
      obstacles.push({
        x: a.x - pad, y: a.y - pad, w: n.foot.w * TS * xf.k + 2 * pad, h: n.foot.h * TS * xf.k + 2 * pad,
        weight: focus ? 60 : twoLine ? 20 : 2, // far zoom: stay by the plaza rather than flee tiny nodes
      });
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
    return items.map((it) => ({ ...it, ...(at.get(it.id) ?? { x: it.anchor.x, y: it.anchor.y }) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, labels, xf.tile, xf.ox, xf.oy, vp.w, vp.h, uiRects, focusNode]);

  // far zoom (mobile overview): the 16 atom names as chips at their castles,
  // biggest lineages first, overlapping ones culled
  const chips = useMemo(() => {
    if (!world || tile > 4) return [];
    const kids = new Map<string, number>();
    for (const r of world.roads) kids.set(r.from, (kids.get(r.from) ?? 0) + 1);
    const atomsBySize = world.nodes.filter((n) => n.atom).sort((a, b) => (kids.get(b.name) ?? 0) - (kids.get(a.name) ?? 0) || a.name.localeCompare(b.name));
    const signRects: Rect[] = signs.map((g) => ({ x: g.x, y: g.y, w: g.w, h: g.h }));
    return cullChips(atomsBySize.map((n) => {
      const c = toScreen(xf, n.center);
      const text = displayName(n.name);
      return { id: n.name, cx: c.x, top: c.y + 6, w: Math.ceil(0.6 * 13 * text.length + 10), h: 20 };
    }), [...signRects, ...uiRects], { x: stage.x + 2, y: stage.y, w: stage.w - 4, h: stage.h });
  }, [world, tile, xf, signs, uiRects, stage]);

  // data check: the number printed on each sign must equal its region's node count
  useEffect(() => {
    if (!world) return;
    const total = signs.reduce((a, g) => a + (g.count ?? 0), 0);
    if (signs.some((g) => g.count != null) && total !== world.nodes.filter((n) => world.regions.some((r) => r.setPiece && r.family === n.family)).length) {
      console.error(`pixel: sign counts sum to ${total}, world has ${world.nodes.length} nodes`);
    }
    document.querySelectorAll<HTMLElement>("[data-sign-count]").forEach((el) => {
      const shown = Number(el.textContent?.match(/\d+/)?.[0]);
      if (shown !== Number(el.dataset.signCount)) console.error(`pixel: sign shows ${shown}, region has ${el.dataset.signCount}`);
    });
  }, [signs, world]);

  return (
    <LabMotion still={still}>
      <div ref={rootRef} className={styles.root} data-lab-ready={drawn && ready ? "1" : undefined}>
        <div
          className={styles.stage}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={cam.handlers.onWheel}
        >
          <canvas ref={canvasRef} className={styles.canvas} role="img" aria-label="Tile map of the model zoo: six lands, one per model family" />
          <div ref={cam.ref} className="pointer-events-none absolute left-0 top-0" style={{ width: Math.max(2, stage.w), height: Math.max(2, stage.h) }} />

          {signs.filter((g) => inStage(g.x + g.w / 2, g.y + g.h / 2)).map((g) => (
            <div key={g.id} className={styles.sign} style={{ left: g.x, top: g.y, width: g.w, fontSize: g.font }}>
              {g.name}
              {g.count != null && <span className="block text-[16px] font-normal" data-sign-count={g.count}><PixelNum value={g.count} /> models</span>}
            </div>
          ))}

          {chips.map((c) => (
            <button key={c.id} type="button" className={styles.chip}
              style={{ left: c.x, top: c.top, width: c.w, height: c.h }}
              onClick={() => onNode(c.id)}>{displayName(c.id)}</button>
          ))}

          {labels.map((l) => {
            const a = toScreen(xf, l.box);
            if (!inStage(a.x + (l.box.w * xf.k) / 2, a.y + (l.box.h * xf.k) / 2)) return null;
            // keep the text on the node side of its (scaled) box
            const justify = l.anchor.includes("W") ? "flex-end" : l.anchor.includes("E") ? "flex-start" : "center";
            const align = l.anchor.includes("N") ? "flex-end" : l.anchor.includes("S") ? "flex-start" : "center";
            const n = nodeOf.get(l.node);
            const focus = focusNode?.name === l.node;
            return (
              <div key={l.node} aria-hidden
                className={`${styles.label} ${n?.atom ? styles.labelAtom : ""} ${focus ? styles.labelFocus : ""}`}
                style={{ left: a.x, top: a.y, width: l.box.w * xf.k, height: l.box.h * xf.k, fontSize: labelFont(l.font), justifyContent: justify, alignItems: align }}
                onClick={() => onNode(l.node)}>
                <span className={focus ? styles.plate : undefined}>{displayName(l.text)}</span>
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
                onClick={() => onNode(n.name)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); go(n.name); } }} />
            );
          })}
        </div>

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
        {!(mobile && cardOpen) && <Legend mobile={mobile} defaultOpen={zoom === "overview" && !mobile} />}
        {card && (
          <StatusCard card={card} looks={looks} atoms={atoms} onPick={go} onClose={() => update({ zoom: "region" })} />
        )}
      </div>
    </LabMotion>
  );
}
