"use client";

// The desktop camera: one uniform scale over the sheet and three URL-driven views —
//   overview: the whole sheet, fitted to the stage;
//   region:   the focused model's lane band;
//   node:     the selection + every ancestor + as many children as still fit at scale ≥ 1
//             (names stay ≥ 13 px), in the area left of the docked drawer.
// Views ease in over MOTION.camera ms (instant when frozen); drag pans, the wheel zooms.
import { useEffect, useMemo, useRef, useState } from "react";
import type { DfdBox, DfdLayout } from "@/lib/world/dfd";
import { hopsUp, type DrawnGraph } from "./lineage";
import { MOTION, SPACE } from "./tokens";

export interface Cam { s: number; tx: number; ty: number }
type R = { x: number; y: number; w: number; h: number };
type Zoom = "overview" | "region" | "node";

/** Node view: never frame so wide that names drop below their 13 px. */
const NODE_MIN_S = 1;

const fit = (r: R, a: R, max: number, min = 0): Cam => {
  const sc = Math.max(min, Math.min(max, a.w / r.w, a.h / r.h));
  return { s: sc, tx: a.x + (a.w - r.w * sc) / 2 - r.x * sc, ty: a.y + (a.h - r.h * sc) / 2 - r.y * sc };
};
const union = (rs: R[]): R => {
  const x0 = Math.min(...rs.map((r) => r.x)), y0 = Math.min(...rs.map((r) => r.y));
  const x1 = Math.max(...rs.map((r) => r.x + r.w)), y1 = Math.max(...rs.map((r) => r.y + r.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
};
const pad = (r: R, p: number): R => ({ x: r.x - p, y: r.y - p, w: r.w + 2 * p, h: r.h + 2 * p });

/** The stage element and its size (ResizeObserver). */
export function useStage() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  return { ref, size };
}

export function useReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setR(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return r;
}

export function useCamera({ layout, g, active, stage, zoom, focus, frozen, onBackground }: {
  layout: DfdLayout | null; g: DrawnGraph | null; active: boolean; stage: { w: number; h: number };
  zoom: Zoom; focus: DfdBox | null; frozen: boolean;
  /** a click on the sheet that hit no box and did not drag */
  onBackground: () => void;
}) {
  const target: Cam | null = useMemo(() => {
    if (!layout || !active || stage.w <= 0 || !g) return null;
    const i = SPACE.stageInset;
    const all: R = { x: i, y: i / 2, w: stage.w - 2 * i, h: stage.h - i };
    const over = fit({ x: 0, y: 0, w: layout.width, h: layout.height }, all, 1.25);
    if (zoom === "region" && focus) {
      const lane = layout.lanes.find((l) => l.family === focus.family)!;
      return fit(pad(lane, SPACE.lanePad), all, 2.2, over.s);
    }
    if (zoom === "node" && focus) {
      const n = SPACE.nodeInset;
      const avail: R = { x: n, y: n / 2, w: stage.w - SPACE.drawerW - 2 * n, h: stage.h - n };
      const c = { x: focus.x + focus.w / 2, y: focus.y + focus.h / 2 };
      const far = (b: R) => Math.abs(b.x + b.w / 2 - c.x) + Math.abs(b.y + b.h / 2 - c.y);
      const core = [...hopsUp(g.parents, focus.name).keys()].map((m) => g.box.get(m)!);
      const kids = (g.children.get(focus.name) ?? []).map((m) => g.box.get(m)!).sort((a, b) => far(a) - far(b));
      const scaleOf = (rs: R[]) => { const r = pad(union(rs), SPACE.framePad); return Math.min(avail.w / r.w, avail.h / r.h); };
      // a hub's far children are dropped nearest-last; their lit lines lead off the frame
      let k = kids.length;
      while (k > 0 && scaleOf([...core, ...kids.slice(0, k)]) < NODE_MIN_S) k--;
      const r = pad(union([...core, ...kids.slice(0, k)]), SPACE.framePad);
      return fit(r, avail, 1.9, Math.min(over.s, avail.w / r.w));
    }
    return over;
  }, [layout, active, stage.w, stage.h, zoom, focus, g]);

  const [cam, setCam] = useState<Cam | null>(null);
  const camRef = useRef<Cam | null>(null);
  useEffect(() => { camRef.current = cam; }, [cam]);
  useEffect(() => {
    if (!target) return;
    const from = camRef.current;
    if (!from || frozen) { setCam(target); return; }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / MOTION.camera), e = 1 - Math.pow(1 - k, 3);
      setCam({ s: from.s + (target.s - from.s) * e, tx: from.tx + (target.tx - from.tx) * e, ty: from.ty + (target.ty - from.ty) * e });
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, frozen]);

  // drag to pan; a still click on the background is handed back
  const drag = useRef<{ x: number; y: number; cam: Cam; moved: boolean } | null>(null);
  const handlers = {
    onPointerDown: (e: React.PointerEvent) => { if (cam) drag.current = { x: e.clientX, y: e.clientY, cam, moved: false }; },
    onPointerMove: (e: React.PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (!d.moved && Math.hypot(dx, dy) < 4) return;
      d.moved = true;
      setCam({ ...d.cam, tx: d.cam.tx + dx, ty: d.cam.ty + dy });
    },
    onPointerUp: (e: React.PointerEvent) => {
      const d = drag.current;
      drag.current = null;
      if (d && !d.moved && (e.target as Element).closest?.("[data-model]") == null) onBackground();
    },
    onPointerLeave: () => { drag.current = null; },
  };

  // wheel zoom around the pointer (a non-passive listener, so the page does not scroll);
  // the svg mounts once the first camera exists, hence `placed`
  const svgRef = useRef<SVGSVGElement | null>(null);
  const placed = cam !== null;
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const c = camRef.current;
      if (!c) return;
      const r = el.getBoundingClientRect();
      const px = e.clientX - r.left, py = e.clientY - r.top;
      const ns = Math.max(0.5, Math.min(3, c.s * Math.exp(-e.deltaY * 0.0015)));
      const f = ns / c.s;
      setCam({ s: ns, tx: px - (px - c.tx) * f, ty: py - (py - c.ty) * f });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [layout, active, placed]);

  return { cam, svgRef, handlers };
}
