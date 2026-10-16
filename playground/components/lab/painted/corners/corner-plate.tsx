"use client";

// Bottom-right corner: one plate, two faces. At the whole-map view it is the
// legend (the map's own evidence sprites and what they mean); zoomed in it
// turns into the minimap, because then the learner needs orientation, not a
// key. Same frame, same width. quiet (focus mode): the minimap shrinks to a
// small inset on half padding. The legend carries the corner plates' one
// title treatment ("Map key", the sign voice).
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { CamBox } from "@/components/lab/shared/camera";
import type { EvidenceState } from "@/components/lab/shared/card-model";
import { CHROME, CORNER, PHONE, TYPE, sign, type Material } from "../material";
import { EvidenceIcon } from "../pixel-icon";
import { MarkIcon } from "../marker";
import { plateStyle, plateTitle } from "./plate";
import { KEY, PAPER_KEY } from "../encoding";

export type MinimapSource = { canvas: HTMLCanvasElement | null; version: number } | { img: string; pixelated: boolean };

// the legend's rows come from encoding.ts (KEY / PAPER_KEY): each names the
// mark it explains and the evidence state it draws, so the key cannot drift
type LegendKey = typeof KEY | typeof PAPER_KEY;

export function CornerPlate({ m, face, world, box, source, onCenter, width = CORNER.w, note, glyph, quiet = false }: {
  m: Material; face: "legend" | "minimap"; world: { w: number; h: number }; box: CamBox; source: MinimapSource; onCenter: (x: number, y: number) => void; width?: number;
  /** the legend's closing line (default: the painted maps' banner/stone note) */
  note?: string;
  /** the legend's swatch per state (default: the painted maps' own evidence sprites / dots) */
  glyph?: (s: EvidenceState) => ReactNode;
  /** focus mode: half padding (the skin passes the small width) */
  quiet?: boolean;
}) {
  const pad = quiet ? CORNER.padQuiet : CORNER.pad;
  return (
    <aside aria-label={face === "legend" ? "Legend" : "Minimap"} style={{ ...plateStyle(m), width, padding: pad, fontFamily: m.bodyFont, color: m.ink }}>
      {/* minimap: the plate's inner width less both frames (the plate's and its own, ≤ 3 px a side) */}
      {face === "legend" ? <Legend m={m} note={note} glyph={glyph} /> : <Minimap m={m} world={world} box={box} source={source} onCenter={onCenter} width={width - 2 * pad - 12} />}
    </aside>
  );
}

function Legend({ m, note, glyph }: { m: Material; note?: string; glyph?: (s: EvidenceState) => ReactNode }) {
  const key: LegendKey = m.crisp ? KEY : PAPER_KEY;
  return (
    <>
    <h2 className="mb-2.5" style={plateTitle(m)}>{key.title}</h2>
    <ul className="space-y-1.5" style={{ fontSize: TYPE.link }}>
      {key.rows.map(({ mark, sample, label }) => {
        const s = sample as EvidenceState;
        return (
          <li key={sample} className="flex items-center gap-2">
            {glyph ? glyph(s) : mark === "atom banner" || mark === "road stone"
              // banner + stone; an untrained model has no banner (atom or not it is
              // the same grey stone on the map), so its row shows the stone alone
              ? <span className="flex w-10 items-center justify-center gap-1">{mark === "atom banner" && <EvidenceIcon state={s} atom scale={1} />}<EvidenceIcon state={s} atom={false} scale={2} /></span>
              : <MarkIcon m={m} state={s} size={16} />}
            <span>{label}</span>
          </li>
        );
      })}
      <li className="pt-1 leading-snug" style={{ color: m.inkSoft, fontSize: TYPE.note }}>
        {note ?? key.notes?.join(" ")}
      </li>
    </ul>
    </>
  );
}

function Minimap({ m, world, box, source, onCenter, width }: {
  m: Material; world: { w: number; h: number }; box: CamBox; source: MinimapSource; onCenter: (x: number, y: number) => void; width: number;
}) {
  const wrap = useRef<HTMLDivElement | null>(null);
  const cv = useRef<HTMLCanvasElement | null>(null);
  const dragging = useRef(false);
  const mw = width;
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
        style={{ left: vx * k, top: vy * k, width: Math.max(4, vw * k), height: Math.max(4, vh * k), outline: `2px solid ${m.crisp ? m.road : m.loud}`, boxShadow: `0 0 0 999px ${CHROME.minimapVeil}` }} />
    </div>
  );
}

/** Phones: the legend folds behind one "Key" button in the bottom-right
 * corner (as the star atlas does); pressed, the key unfolds above it. The
 * unfolded plate is not part of the corner's measured box, so the land signs
 * do not move when it opens: it lies over the map until it is closed. */
export function PhoneKey({ m, maxW }: { m: Material; maxW: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      {open && (
        <div className="absolute bottom-full right-0" style={{ marginBottom: PHONE.edgeGap + 2 }}>
          <aside aria-label="Legend" style={{ ...plateStyle(m), width: Math.min(CORNER.w, maxW), padding: CORNER.pad, fontFamily: m.bodyFont, color: m.ink }}>
            <Legend m={m} />
          </aside>
        </div>
      )}
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={open ? "Close the map key" : "Open the map key"}
        className="px-2.5 leading-none focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ ...plateStyle(m, { loud: open }), height: PHONE.control, fontFamily: m.signFont, fontWeight: 700, fontSize: sign(m, TYPE.tabSmall) }}>
        {/* one label, open or shut (pressed = open): the button never grows into the scale bar */}
        Key
      </button>
    </div>
  );
}
