"use client";

// Local camera for the flow board. The shared camera fits a box uniformly;
// the flow board is tall and narrow (≈858×1952), so a uniform overview on a
// landscape screen shrinks 13px names to 6px. This camera lets x and y scale
// independently (bounded by `maxStretch`): positions still come only from
// buildFlow — they are just mapped with (sx, sy) — while creatures and text
// are drawn at their own screen size, so nothing is distorted.
// Everything else mirrors the shared camera: fly-to tween, drag-pan,
// wheel-zoom, instant jumps under still=1.
import { useCallback, useEffect, useRef, useState } from "react";

export interface CamBox { x: number; y: number; w: number; h: number }
/** screen = world · s + t (per axis). */
export interface View { sx: number; sy: number; tx: number; ty: number }

const FLY_MS = 700;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Fit a world box into a screen rect, allowing sx/sy to differ by ≤ maxStretch. */
export function fitView(box: CamBox, avail: CamBox, maxStretch: number, maxScale: number): View {
  let sx = avail.w / Math.max(box.w, 1);
  let sy = avail.h / Math.max(box.h, 1);
  if (sx > sy * maxStretch) sx = sy * maxStretch;
  if (sy > sx * maxStretch) sy = sx * maxStretch;
  sx = Math.min(sx, maxScale);
  sy = Math.min(sy, maxScale);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  return { sx, sy, tx: avail.x + avail.w / 2 - cx * sx, ty: avail.y + avail.h / 2 - cy * sy };
}

export function useStageSize() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, size };
}

export function useFlowCamera(target: View | null, still: boolean) {
  const [view, setView] = useState<View | null>(target);
  const viewRef = useRef(view);
  useEffect(() => { viewRef.current = view; }, [view]);

  const k = target ? `${target.sx.toFixed(4)} ${target.sy.toFixed(4)} ${target.tx.toFixed(1)} ${target.ty.toFixed(1)}` : "";
  const targetRef = useRef(target);
  targetRef.current = target;
  useEffect(() => {
    const to = targetRef.current;
    if (!to) return;
    const from = viewRef.current;
    if (still || !from) { setView(to); return; }
    const t0 = performance.now();
    let raf = 0;
    // Tween scales in log space so zooming feels even, then derive the
    // translation from a tweened world-centre (no swooping arc).
    const step = (now: number) => {
      const e = ease(Math.min(1, (now - t0) / FLY_MS));
      setView({
        sx: Math.exp(Math.log(from.sx) + (Math.log(to.sx) - Math.log(from.sx)) * e),
        sy: Math.exp(Math.log(from.sy) + (Math.log(to.sy) - Math.log(from.sy)) * e),
        tx: from.tx + (to.tx - from.tx) * e,
        ty: from.ty + (to.ty - from.ty) * e,
      });
      if (e < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [k, still]);

  // Drag-pan that still lets a plain click reach the creature under it:
  // capture the pointer only once the pointer has actually travelled.
  const drag = useRef<{ x: number; y: number; moved: boolean; id: number } | null>(null);
  const suppressClick = useRef(false);
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
  }, []);
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved) {
      if (Math.hypot(dx, dy) < 5) return;
      d.moved = true;
      (e.currentTarget as Element).setPointerCapture(d.id);
    }
    d.x = e.clientX;
    d.y = e.clientY;
    setView((v) => (v ? { ...v, tx: v.tx + dx, ty: v.ty + dy } : v));
  }, []);
  const onPointerUp = useCallback(() => {
    if (drag.current?.moved) suppressClick.current = true;
    drag.current = null;
  }, []);
  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (suppressClick.current) { e.stopPropagation(); suppressClick.current = false; }
  }, []);
  const onWheel = useCallback((e: React.WheelEvent) => {
    const rect = (e.currentTarget as Element).getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const f = Math.exp(-e.deltaY * 0.0015);
    setView((v) => {
      if (!v) return v;
      const g = Math.min(Math.max(f, 0.18 / Math.min(v.sx, v.sy)), 4 / Math.max(v.sx, v.sy));
      return { sx: v.sx * g, sy: v.sy * g, tx: mx - (mx - v.tx) * g, ty: my - (my - v.ty) * g };
    });
  }, []);

  return {
    view,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onClickCapture, onWheel },
  };
}
