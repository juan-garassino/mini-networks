"use client";

// Shared camera for every skin: fits a target box (world px) into the
// viewport, tweens between targets (the "fly-to"), and lets the learner pan
// (drag) and zoom (wheel/pinch-free trackpad). SVG skins use `viewBox`;
// canvas skins use `scale`/`offset`. Under still=1 it jumps, never tweens.
import { useCallback, useEffect, useRef, useState } from "react";

export interface CamBox { x: number; y: number; w: number; h: number }

const FLY_MS = 700;
// ms of animation per frame, at most: one long block (mounting a card) can't
// skip the flight, yet a slow machine's steady ~0.5s frames still land in ~3s.
const MAX_STEP = 120;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Grow the target to the viewport's aspect ratio, centred, so nothing is cropped.
export function fitBox(target: CamBox, vw: number, vh: number): CamBox {
  if (vw <= 1 || vh <= 1) return target;      // not measured yet
  const aspect = vw / Math.max(vh, 1);
  let { w, h } = target;
  if (w / h > aspect) h = w / aspect; else w = h * aspect;
  return { x: target.x + target.w / 2 - w / 2, y: target.y + target.h / 2 - h / 2, w, h };
}

export function useCamera({ world, target, still, minWidth = 240, targetViewport, clamp }: {
  world: CamBox;
  target: CamBox;
  still: boolean;
  minWidth?: number;
  /** Keep the world covering the visible part of the viewport while dragging:
   * the part left of `right` and above `bottom` (CSS px covered by a drawer or
   * sheet). An axis where the world is smaller than the view stays centred. */
  clamp?: { right: number; bottom: number };
  /** The viewport size the skin computed `target` for. Skins that size their
   * target from the measured viewport pass it: until it matches the camera's
   * own measurement the camera jumps instead of flying, so the first real
   * framing never starts from a placeholder box. */
  targetViewport?: { w: number; h: number };
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 1, h: 1 });
  const [box, setBox] = useState<CamBox>(target);
  const boxRef = useRef(box);
  const framed = useRef(false);
  useEffect(() => { boxRef.current = box; }, [box]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fly to the (aspect-fitted) target whenever it or the viewport changes.
  const tx = target.x, ty = target.y, tw = target.w, th = target.h;
  const ready = !targetViewport || (targetViewport.w === size.w && targetViewport.h === size.h);
  useEffect(() => {
    const to = fitBox({ x: tx, y: ty, w: tw, h: th }, size.w, size.h);
    const from = boxRef.current;
    const firstFrame = !framed.current;
    // Jump (no flight) under still=1, before the viewport is measured, on the
    // first real framing (the previous box was computed for an unmeasured
    // viewport — flying from it starts hugely zoomed in), or from a placeholder.
    if (still || size.w <= 1 || !ready || firstFrame || from.w <= 1 || from.h <= 1) {
      if (size.w > 1 && ready) framed.current = true;
      setBox(to);
      return;
    }
    // Progress advances by at most MAX_STEP per frame: when a skin blocks the
    // main thread (e.g. mounting the card), the flight is delayed rather than
    // skipped — wall-clock progress turned every fly-to into a cut.
    let elapsed = 0;
    let last = performance.now();
    let raf = 0;
    const step = (now: number) => {
      elapsed += Math.min(now - last, MAX_STEP);
      last = now;
      const k = ease(Math.min(1, elapsed / FLY_MS));
      setBox({
        x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k,
        w: from.w + (to.w - from.w) * k, h: from.h + (to.h - from.h) * k,
      });
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [tx, ty, tw, th, size.w, size.h, still, ready]);

  // Capture only once the press becomes a drag (>4px): capturing on press
  // retargets pointerup to the container and swallows clicks on map children.
  const drag = useRef<{ x: number; y: number; dragging: boolean } | null>(null);
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, dragging: false };
  }, []);
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current) return;
    if (!drag.current.dragging) {
      if (Math.hypot(e.clientX - drag.current.x, e.clientY - drag.current.y) < 4) return;
      drag.current.dragging = true;
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    }
    const k = boxRef.current.w / size.w;
    const dx = (e.clientX - drag.current.x) * k, dy = (e.clientY - drag.current.y) * k;
    drag.current = { x: e.clientX, y: e.clientY, dragging: true };
    setBox((b) => {
      let x = b.x - dx, y = b.y - dy;
      if (clamp) {
        const wv = b.w * Math.max(0.1, (size.w - clamp.right) / size.w), hv = b.h * Math.max(0.1, (size.h - clamp.bottom) / size.h);
        x = wv >= world.w ? world.x + (world.w - wv) / 2 : Math.min(Math.max(x, world.x), world.x + world.w - wv);
        y = hv >= world.h ? world.y + (world.h - hv) / 2 : Math.min(Math.max(y, world.y), world.y + world.h - hv);
      }
      return { ...b, x, y };
    });
  }, [size.w, size.h, clamp, world]);
  const onPointerUp = useCallback(() => { drag.current = null; }, []);
  const onWheel = useCallback((e: React.WheelEvent) => {
    const rect = (e.currentTarget as Element).getBoundingClientRect();
    const fx = (e.clientX - rect.left) / rect.width, fy = (e.clientY - rect.top) / rect.height;
    setBox((b) => {
      const f = Math.exp(e.deltaY * 0.0015);
      const w = Math.min(Math.max(b.w * f, minWidth), world.w * 1.2);
      const h = w * (b.h / b.w);
      return { x: b.x + (b.w - w) * fx, y: b.y + (b.h - h) * fy, w, h };
    });
  }, [minWidth, world.w]);

  const scale = size.w / box.w;
  return {
    ref,
    box,
    size,
    viewBox: `${box.x} ${box.y} ${box.w} ${box.h}`,
    scale,                                   // screen px per world px
    offset: { x: -box.x * scale, y: -box.y * scale },
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onWheel },
  };
}
