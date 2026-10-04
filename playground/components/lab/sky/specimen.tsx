"use client";

// /lab/sky/?specimen=1 — the Night Map's signature pieces on their own, at 4×:
// the four evidence stars (atom + derived), one family nebula baked on its
// ramp with two asterism lines stopping short of their stars and its sign
// plaque, every emblem, and every ramp. The finish is judged here first.
import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { MATERIALS } from "@/components/lab/painted/material";
import { plateStyle } from "@/components/lab/painted/corners/plate";
import { bakeSky, type BakeStar } from "./bake";
import { FAMILY_INK, FIELD, GOLD, INK, LILAC, MINT, GREY, NIGHT } from "./palette";
import { Pix, asterism, stamp } from "./paint";
import { emblem, starSprite, CONSTELLATION, ringOffsets, starRadius } from "./sprites";
import { SpriteIcon, StarPair } from "./icon";
import type { EvidenceState } from "@/components/lab/shared/card-model";

const m = MATERIALS.sky;
const Z = 4; // css px per art px
const STATES: EvidenceState[] = ["champion", "trained", "provisional", "untrained"];

// a small sequence constellation (frame px): an atom hub and four derived stars
const STARS: (BakeStar & { state: EvidenceState })[] = [
  { name: "transformer", family: "sequence", x: 300, y: 210, atom: true, state: "champion" },
  { name: "moe", family: "sequence", x: 420, y: 140, atom: false, state: "untrained" },
  { name: "rag", family: "sequence", x: 210, y: 320, atom: false, state: "champion" },
  { name: "kimi", family: "sequence", x: 520, y: 230, atom: false, state: "provisional" },
  { name: "rnn", family: "sequence", x: 410, y: 330, atom: true, state: "trained" },
];
const EDGES: [number, number][] = [[0, 1], [0, 2], [1, 3]];
const BOX = { x: 0, y: 0, w: 720, h: 440 };

export function SkySpecimen() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const bake = useMemo(() => bakeSky({ stars: STARS, edges: EDGES.map(([a, b]) => ({ from: STARS[a], to: STARS[b], family: "sequence" })), box: BOX }), []);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = bake.w * Z * dpr; cv.height = bake.h * Z * dpr;
    const ctx = cv.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    const off = document.createElement("canvas");
    off.width = bake.w; off.height = bake.h;
    off.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(bake.rgba), bake.w, bake.h), 0, 0);
    ctx.drawImage(off, 0, 0, cv.width, cv.height);
    // marks on the same grid (1 art px = 1 sky px here)
    const lines = new Pix(Z, dpr, bake.w, bake.h), stars = new Pix(Z, dpr, bake.w, bake.h);
    const at = (s: BakeStar): [number, number] => [Math.round((s.x - bake.x) / bake.cell), Math.round((s.y - bake.y) / bake.cell)];
    EDGES.forEach(([a, b], i) => {
      const A = STARS[a], B = STARS[b];
      const c = i === 0 ? INK.lit : FAMILY_INK.sequence.tint[0];
      for (const [x, y] of asterism(at(A), at(B), starRadius(A.state, A.atom) + 2, starRadius(B.state, B.atom) + 2)) lines.add(x, y, c);
    });
    for (const s of STARS) { const [x, y] = at(s); stamp(stars, starSprite(s.state, s.atom), x, y); }
    const [sx, sy] = at(STARS[0]);
    for (const [dx, dy] of ringOffsets(starRadius("champion", true) + 3, "broken")) stars.add(sx + dx, sy + dy, INK.ring);
    lines.flush(ctx); stars.flush(ctx);
  }, [bake]);

  const fam = (f: string) => FAMILY_INK[f];
  const swatch = (c: string): CSSProperties => ({ width: 28, height: 28, background: c, display: "inline-block" });
  return (
    <div data-lab-ready="1" className="min-h-full w-full overflow-auto p-8" style={{ background: NIGHT[1], color: m.ink, fontFamily: m.bodyFont, ["--ap" as string]: "2px" } as CSSProperties}>
      <h1 style={{ fontFamily: m.signFont, fontWeight: 700, fontSize: 28, color: m.border }}>Night Map specimen</h1>
      <div className="mt-6 flex flex-wrap items-start gap-10">
        <section>
          <h2 className="mb-3" style={{ fontSize: 16, color: m.inkSoft }}>Evidence stars, atom and derived, at 4×</h2>
          <div className="flex flex-col gap-4 p-5" style={{ background: NIGHT[1], border: `2px solid ${NIGHT[3]}` }}>
            {STATES.map((s) => (
              <div key={s} className="flex items-center gap-6">
                <span className="flex w-28 items-center gap-4"><SpriteIcon s={starSprite(s, true)} scale={Z} /><SpriteIcon s={starSprite(s, false)} scale={Z} /></span>
                <span style={{ fontSize: 16 }}>{s}</span>
                <StarPair state={s} />
              </div>
            ))}
          </div>
        </section>
        <section>
          <h2 className="mb-3" style={{ fontSize: 16, color: m.inkSoft }}>A sequence nebula, lines stopping short, the selection ring</h2>
          <div className="relative" style={{ width: bake.w * Z, height: bake.h * Z }}>
            <canvas ref={ref} style={{ width: bake.w * Z, height: bake.h * Z, imageRendering: "pixelated", display: "block" }} />
            <Plaque family="sequence" count={12} style={{ position: "absolute", left: 60, top: 64 }} latin />
          </div>
        </section>
      </div>
      <section className="mt-8">
        <h2 className="mb-3" style={{ fontSize: 16, color: m.inkSoft }}>Emblems at 4× and every ramp</h2>
        <div className="flex flex-wrap gap-6">
          {Object.keys(FAMILY_INK).map((f) => (
            <div key={f} className="flex flex-col gap-2">
              <div className="p-2" style={{ background: m.plateHi, border: `2px solid ${fam(f).tint[0]}` }}><SpriteIcon s={emblem(f)!} scale={Z} /></div>
              <div className="flex">{fam(f).ramp.map((c, i) => <span key={i} style={swatch(c)} />)}</div>
              <div className="flex">{fam(f).tint.map((c, i) => <span key={i} style={swatch(c)} />)}</div>
              <span style={{ fontSize: 14 }}>{f}</span>
            </div>
          ))}
          <div className="flex flex-col gap-2">
            <div className="flex">{NIGHT.map((c, i) => <span key={i} style={swatch(c)} />)}</div>
            <div className="flex">{FIELD.map((c, i) => <span key={i} style={swatch(c)} />)}</div>
            <div className="flex">{[GOLD, MINT, LILAC, GREY].flatMap((r) => Object.values(r)).map((c, i) => <span key={i} style={{ ...swatch(c), width: 14 }} />)}</div>
            <span style={{ fontSize: 14 }}>night, field, evidence</span>
          </div>
        </div>
      </section>
    </div>
  );
}

/** A family's night sign: emblem, NAME + count, the Latin name under it at region zoom. */
export function Plaque({ family, count, latin = false, compact = false, style, onClick, dimmed = false }: {
  family: string; count: number; latin?: boolean; compact?: boolean; style?: CSSProperties; onClick?: () => void; dimmed?: boolean;
}) {
  const ink = FAMILY_INK[family];
  const c = CONSTELLATION[family];
  const fs = compact ? 12 : 15;
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick} aria-label={onClick ? `${family}, ${count} models: open the constellation` : undefined}
      className="flex items-center text-left leading-none focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        ...plateStyle(m, { shadow: true }), border: `var(--ap) solid ${ink.tint[0]}`,
        padding: compact ? "3px 6px 3px 4px" : "4px 8px 4px 5px", gap: compact ? 5 : 7, whiteSpace: "nowrap",
        opacity: dimmed ? 0.55 : 1, ...style,
      }}>
      <SpriteIcon s={emblem(family)!} scale={compact ? 1 : 1.5} />
      <span className="flex flex-col" style={{ gap: 3 }}>
        <span style={{ fontSize: fs, fontWeight: 700, letterSpacing: "0.06em", color: m.ink }}>
          {family.toUpperCase()} <span style={{ color: ink.tint[1] }}>{count}</span>
        </span>
        {latin && c && <span style={{ fontSize: fs - 3, color: m.inkSoft }}>{c.latin}, {c.gloss}</span>}
      </span>
    </Tag>
  );
}
