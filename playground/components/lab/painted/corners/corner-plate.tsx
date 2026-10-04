"use client";

// Bottom-right corner: one plate, two faces. At the whole-map view it is the
// legend (the map's own evidence sprites and what they mean); zoomed in it
// turns into the minimap, because then the learner needs orientation, not a
// key. Same frame, same width.
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { CamBox } from "@/components/lab/shared/camera";
import type { EvidenceState } from "@/components/lab/shared/card-model";
import type { Material } from "../material";
import { EvidenceIcon } from "../pixel-icon";
import { plateStyle } from "./plate";

export type MinimapSource = { canvas: HTMLCanvasElement | null; version: number } | { img: string; pixelated: boolean };

const LEGEND: { s: EvidenceState; t: string }[] = [
  { s: "champion", t: "champion, passed the gate" },
  { s: "trained", t: "trained, no champion yet" },
  { s: "provisional", t: "new, bar still provisional" },
  { s: "untrained", t: "not trained yet" },
];

export function CornerPlate({ m, face, world, box, source, onCenter, width = 276, note, glyph }: {
  m: Material; face: "legend" | "minimap"; world: { w: number; h: number }; box: CamBox; source: MinimapSource; onCenter: (x: number, y: number) => void; width?: number;
  /** the legend's closing line (default: the painted maps' banner/stone note) */
  note?: string;
  /** the legend's swatch per state (default: the painted maps' own evidence sprites / dots) */
  glyph?: (s: EvidenceState) => ReactNode;
}) {
  return (
    <aside aria-label={face === "legend" ? "Legend" : "Minimap"} className="p-3" style={{ ...plateStyle(m), width, fontFamily: m.bodyFont, color: m.ink }}>
      {face === "legend" ? <Legend m={m} note={note} glyph={glyph} /> : <Minimap m={m} world={world} box={box} source={source} onCenter={onCenter} width={width - 24 - 4} />}
    </aside>
  );
}

function Legend({ m, note, glyph }: { m: Material; note?: string; glyph?: (s: EvidenceState) => ReactNode }) {
  return (
    <ul className="space-y-1.5" style={{ fontSize: 14 }}>
      {LEGEND.map(({ s, t }) => (
        <li key={s} className="flex items-center gap-2">
          {glyph ? glyph(s) : m.crisp
            ? <span className="flex w-10 items-center justify-center gap-1"><EvidenceIcon state={s} atom scale={1} /><EvidenceIcon state={s} atom={false} scale={2} /></span>
            : <span aria-hidden className="inline-block h-3 w-3 flex-none rounded-full" style={{ background: m.evidence[s].fill, border: `1.5px solid ${m.evidence[s].stroke}` }} />}
          <span>{t}</span>
        </li>
      ))}
      <li className="pt-1 leading-snug" style={{ color: m.inkSoft, fontSize: 13 }}>
        {note ?? (m.crisp ? "Banners fly over the atoms; the stones on the roads are models built from them." : "Signs mark the atoms; the markers on the roads are models built from them.")}
      </li>
    </ul>
  );
}

function Minimap({ m, world, box, source, onCenter, width }: {
  m: Material; world: { w: number; h: number }; box: CamBox; source: MinimapSource; onCenter: (x: number, y: number) => void; width: number;
}) {
  const wrap = useRef<HTMLDivElement | null>(null);
  const cv = useRef<HTMLCanvasElement | null>(null);
  const dragging = useRef(false);
  const [mw] = useState(width);
  const k = mw / world.w;
  const mh = Math.round(world.h * k);
  const srcCanvas = "canvas" in source ? source.canvas : null;
  const version = "canvas" in source ? source.version : 0;
  useEffect(() => {
    const ctx = cv.current?.getContext("2d");
    if (!ctx || !srcCanvas) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.clearRect(0, 0, mw, mh);
    ctx.drawImage(srcCanvas, 0, 0, mw, mh);
  }, [srcCanvas, version, mw, mh]);
  const centerAt = (cx: number, cy: number) => {
    const r = wrap.current?.getBoundingClientRect();
    if (r) onCenter((cx - r.left) / k, (cy - r.top) / k);
  };
  const vx = Math.max(0, box.x), vy = Math.max(0, box.y);
  const vw = Math.min(world.w, box.x + box.w) - vx, vh = Math.min(world.h, box.y + box.h) - vy;
  return (
    <div ref={wrap} role="slider" tabIndex={0} aria-label="Minimap: click or drag to move the view" aria-valuetext="part of the map in view"
      aria-valuenow={Math.round((vx / Math.max(1, world.w - vw)) * 100) || 0} aria-valuemin={0} aria-valuemax={100}
      className="relative cursor-pointer select-none overflow-hidden focus-visible:outline-2"
      style={{ width: mw, height: mh, border: `var(--ap, 2px) solid ${m.border}`, boxSizing: "content-box", background: m.sea }}
      onPointerDown={(e) => { dragging.current = true; (e.currentTarget as Element).setPointerCapture(e.pointerId); centerAt(e.clientX, e.clientY); }}
      onPointerMove={(e) => { if (dragging.current) centerAt(e.clientX, e.clientY); }}
      onPointerUp={() => { dragging.current = false; }} onPointerCancel={() => { dragging.current = false; }}>
      {"canvas" in source
        ? <canvas ref={cv} width={mw} height={mh} className="block" style={{ width: mw, height: mh }} aria-hidden />
        // eslint-disable-next-line @next/next/no-img-element -- local owner-supplied painting, tiny preview
        : <img src={source.img} alt="" draggable={false} className="block" style={{ width: mw, height: mh, imageRendering: source.pixelated ? "pixelated" : "auto" }} />}
      <div className="pointer-events-none absolute"
        style={{ left: vx * k, top: vy * k, width: Math.max(4, vw * k), height: Math.max(4, vh * k), outline: `2px solid ${m.crisp ? m.road : m.loud}`, boxShadow: "0 0 0 999px rgba(34,19,22,.35)" }} />
    </div>
  );
}
