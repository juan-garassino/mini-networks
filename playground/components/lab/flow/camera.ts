"use client";

// Local camera for the flow board. The shared camera fits a box uniformly;
// the flow board is tall and narrow (≈858×1952), so a uniform overview on a
// landscape screen shrinks 13px names to 6px. This camera lets x and y scale
// independently (bounded by `maxStretch`): positions still come only from
// buildFlow — they are just mapped with (sx, sy) — while creatures and text
// are drawn at their own screen size, so nothing is distorted.
// Everything else mirrors the shared camera: fly-to tween, drag-pan,
// wheel-zoom, instant jumps under still=1.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

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

/**
 * The camera never re-renders the board per frame. The board is drawn once
 * for the SETTLED view; while flying / dragging / wheeling, a single matrix on
 * the board group (gRef) maps settled → current. When motion stops the view
 * settles (one React render: labels are placed for the new frame) and the
 * matrix resets to identity in the same layout pass (no flash).
 */
export function useFlowCamera(target: View | null, still: boolean) {
  const gRef = useRef<SVGGElement | null>(null);
  const cur = useRef<View | null>(null);
  const settledRef = useRef<View | null>(null);
  const [settled, setSettled] = useState<View | null>(null);
  // elements that must hide while the camera moves (e.g. the card's speech tail) —
  // toggled on the DOM directly so a flight never re-renders the board
  const hideWhileMoving = useRef<HTMLElement | SVGElement | null>(null);
  const setMoving = useCallback((m: boolean) => {
    const el = hideWhileMoving.current;
    if (el) el.style.visibility = m ? "hidden" : "";
  }, []);

  const apply = useCallback(() => {
    const g = gRef.current, c = cur.current, s = settledRef.current;
    if (!g || !c || !s) return;
    const k = c.sx / s.sx;
    const tx = c.tx - s.tx * k, ty = c.ty - s.ty * k;
    if (Math.abs(k - 1) < 1e-6 && Math.abs(tx) < 0.01 && Math.abs(ty) < 0.01) g.removeAttribute("transform");
    else g.setAttribute("transform", `matrix(${k} 0 0 ${k} ${tx} ${ty})`);
  }, []);
  useLayoutEffect(() => { settledRef.current = settled; apply(); }, [settled, apply]);
  const settle = useCallback(() => {
    if (cur.current) setSettled({ ...cur.current });
    setMoving(false);
  }, [setMoving]);

  const k = target ? `${target.sx.toFixed(4)} ${target.sy.toFixed(4)} ${target.tx.toFixed(1)} ${target.ty.toFixed(1)}` : "";
  const targetRef = useRef(target);
  targetRef.current = target;
  useEffect(() => {
    const to = targetRef.current;
    if (!to) return;
    const from = cur.current;
    if (still || !from || !settledRef.current) { cur.current = to; settle(); return; }
    setMoving(true);
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const e = ease(Math.min(1, (now - t0) / FLY_MS));
      const sx = Math.exp(Math.log(from.sx) + (Math.log(to.sx) - Math.log(from.sx)) * e);
      cur.current = { sx, sy: sx, tx: from.tx + (to.tx - from.tx) * e, ty: from.ty + (to.ty - from.ty) * e };
      apply();
      if (e < 1) raf = requestAnimationFrame(step);
      else { cur.current = to; settle(); }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [k, still, apply, settle, setMoving]);

  // Drag-pan that still lets a plain click reach the creature under it.
  const drag = useRef<{ x: number; y: number; moved: boolean; id: number } | null>(null);
  const suppressClick = useRef(false);
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
  }, []);
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !cur.current) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved) {
      if (Math.hypot(dx, dy) < 5) return;
      d.moved = true;
      (e.currentTarget as Element).setPointerCapture(d.id);
    }
    d.x = e.clientX;
    d.y = e.clientY;
    cur.current = { ...cur.current, tx: cur.current.tx + dx, ty: cur.current.ty + dy };
    apply();
  }, [apply]);
  const onPointerUp = useCallback(() => {
    if (drag.current?.moved) { suppressClick.current = true; settle(); }
    drag.current = null;
  }, [settle]);
  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (suppressClick.current) { e.stopPropagation(); suppressClick.current = false; }
  }, []);
  const wheelT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onWheel = useCallback((e: React.WheelEvent) => {
    const v = cur.current;
    if (!v) return;
    const rect = (e.currentTarget as Element).getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const f = Math.exp(-e.deltaY * 0.0015);
    const g = Math.min(Math.max(f, 0.12 / v.sx), 3 / v.sx);
    cur.current = { sx: v.sx * g, sy: v.sy * g, tx: mx - (mx - v.tx) * g, ty: my - (my - v.ty) * g };
    apply();
    clearTimeout(wheelT.current);
    wheelT.current = setTimeout(settle, 180);
  }, [apply, settle]);

  return {
    view: settled,
    gRef,
    hideWhileMoving,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onClickCapture, onWheel },
  };
}
