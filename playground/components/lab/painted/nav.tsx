"use client";

// Navigation for the painted map: zoom pad (+ / − / whole map), a jump row
// for the six lands, and a minimap whose viewport box can be clicked or
// dragged. Keyboard: + / − zoom, 0 whole map, arrows pan (handled by the skin).
import { useRef } from "react";
import type { CamBox } from "@/components/lab/shared/camera";
import { FAMILIES, IMAGE, type Family } from "./anchors";
import type { PaintedTheme } from "./theme";

const MINI_W = 176;

export function NavPad({ theme, imgSrc, pixelated, box, canIn, canOut, onZoom, onFit, onLand, onCenter }: {
  theme: PaintedTheme;
  imgSrc: string;
  pixelated: boolean;
  box: CamBox;
  canIn: boolean;
  canOut: boolean;
  onZoom: (dir: 1 | -1) => void;
  onFit: () => void;
  onLand: (f: Family) => void;
  onCenter: (x: number, y: number) => void;
}) {
  const mini = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);
  const k = MINI_W / IMAGE.w;
  const miniH = IMAGE.h * k;

  const centerAt = (clientX: number, clientY: number) => {
    const r = mini.current?.getBoundingClientRect();
    if (!r) return;
    onCenter((clientX - r.left) / k, (clientY - r.top) / k);
  };

  const btn = {
    background: theme.plateHi, color: theme.ink,
    border: `${theme.crisp ? 2 : 1.5}px solid ${theme.border}`, borderRadius: theme.radius,
  } as const;

  // viewport rectangle clipped to the image
  const vx = Math.max(0, box.x), vy = Math.max(0, box.y);
  const vw = Math.min(IMAGE.w, box.x + box.w) - vx, vh = Math.min(IMAGE.h, box.y + box.h) - vy;
  const whole = box.w >= IMAGE.w - 1 && box.h >= IMAGE.h - 1;

  return (
    <nav aria-label="Map navigation"
      className="absolute bottom-3 right-3 z-20 hidden flex-col gap-2 p-2 sm:flex"
      style={{ background: theme.plate, border: `${theme.crisp ? 2 : 1.5}px solid ${theme.border}`, borderRadius: theme.radius, color: theme.ink }}>
      <div
        ref={mini}
        role="slider"
        aria-label="Minimap: click or drag to move the view"
        aria-valuetext={whole ? "whole map in view" : "part of the map in view"}
        tabIndex={-1}
        className="relative cursor-pointer overflow-hidden"
        style={{ width: MINI_W, height: miniH, border: `1px solid ${theme.border}` }}
        onPointerDown={(e) => { dragging.current = true; (e.currentTarget as Element).setPointerCapture(e.pointerId); centerAt(e.clientX, e.clientY); }}
        onPointerMove={(e) => { if (dragging.current) centerAt(e.clientX, e.clientY); }}
        onPointerUp={() => { dragging.current = false; }}
        onPointerCancel={() => { dragging.current = false; }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- local owner-supplied painting, tiny preview */}
        <img src={imgSrc} alt="" draggable={false} className="block h-full w-full"
          style={{ imageRendering: pixelated ? "pixelated" : "auto" }} />
        {!whole && (
          <div className="pointer-events-none absolute"
            style={{ left: vx * k, top: vy * k, width: vw * k, height: vh * k, border: `2px solid ${theme.loud}`, boxShadow: "0 0 0 999px rgba(0,0,0,.28)" }} />
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => onZoom(1)} disabled={!canIn} aria-label="Zoom in" title="Zoom in (+)"
          className="h-8 w-8 text-[18px] leading-none disabled:opacity-40 focus-visible:outline-2" style={btn}>+</button>
        <button type="button" onClick={() => onZoom(-1)} disabled={!canOut} aria-label="Zoom out" title="Zoom out (−)"
          className="h-8 w-8 text-[18px] leading-none disabled:opacity-40 focus-visible:outline-2" style={btn}>−</button>
        <button type="button" onClick={onFit} title="Whole map (0)"
          className="h-8 flex-1 px-2 text-[13px] focus-visible:outline-2" style={btn}>Whole map</button>
      </div>
      <div className="grid grid-cols-3 gap-1" role="group" aria-label="Jump to a land">
        {FAMILIES.map((f) => (
          <button key={f} type="button" onClick={() => onLand(f)}
            className="px-1 py-0.5 text-[12px] capitalize focus-visible:outline-2" style={btn}>
            {f}
          </button>
        ))}
      </div>
      <p className="text-[11px]" style={{ color: theme.inkSoft }}>Drag to move. Wheel or +/− to zoom, arrows to pan.</p>
    </nav>
  );
}
