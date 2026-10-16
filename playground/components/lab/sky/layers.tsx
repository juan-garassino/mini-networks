"use client";

// The Night Map's two canvases, stacked under the words:
//
//   SkyCanvas   the baked sky (bake.ts) blitted at the camera, pixelated, its
//               origin snapped to whole device px; one cached source canvas
//               per ghost (a focused family sinks the others into the night)
//   SkyMarks    the marks on the art grid (paint.ts) + the 12-fps life layer
//               (motion.ts): lineage lines with comets, pipeline arcs, the
//               evidence star sprites, champion glints, selection / hover
//               rings, twinkling field stars and the odd meteor
//
// Both are pure views of their props: no layout, no data fetching.
import { memo, useEffect, useRef, useState } from "react";
import type { CamBox } from "@/components/lab/shared/camera";
import type { EvidenceState } from "@/components/lab/shared/card-model";
import { ghostBake, type Bake } from "./bake";
import { FAMILY_INK, FIELD, GOLD, GREY, INK, LILAC, LINE, MINT } from "./tokens";
import { Pix, arcPixels, asterism, bresenham, dim, mix, stamp } from "./paint";
import { reticleOffsets, ringOffsets, starRadius, starSprite } from "./sprites";
import { FPS, LOOP, comet, glint, meteor, twinkle } from "./motion";

/** A model in FRAME coords (lib/world, turned a quarter on a portrait phone). */
export interface FStar { name: string; family: string; x: number; y: number; atom: boolean; parents: string[]; state: EvidenceState }

/** One lineage line as the marks canvas draws it. `sink`: the colour a long
 * line's middle sinks toward (its nebula's own tone), or null to keep full ink. */
export interface Line { id: string; a: FStar; b: FStar; ink: string; pattern: "solid" | "dash"; sink: string | null; comet: { busy: boolean; ink: string[] } | null }

/** Comet head → tail, bright → dark, on the child's own sprite ramp. */
export const EVIDENCE_RUN: Record<EvidenceState, string[]> = {
  champion: [GOLD.w, GOLD["4"], GOLD["3"], GOLD["2"]],
  trained: [MINT["4"], MINT["3"], MINT["2"], MINT["1"]],
  provisional: [LILAC["3"], LILAC["3"], LILAC["2"], LILAC["1"]],
  untrained: [GREY["2"], GREY["2"], GREY["1"], GREY["1"]],
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const canvasStyle = (vw: number, vh: number) => ({ width: vw, height: vh, imageRendering: "pixelated" as const });

/** A frame counter at FPS, frozen at 0 when still (the lab contract's useStill:
 * ?still=1 or reduced motion) or the tab is hidden. */
function useSkyTick(still: boolean): number {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (still || typeof window === "undefined") return;
    let raf = 0, last = performance.now(), acc = 0;
    const period = 1000 / FPS;
    const loop = (now: number) => {
      acc += now - last; last = now;
      if (acc >= period) { const k = Math.floor(acc / period); acc -= k * period; setFrame((f) => (f + Math.min(k, 3)) % LOOP || 1); }
      raf = requestAnimationFrame(loop);
    };
    const start = () => { last = performance.now(); acc = 0; raf = requestAnimationFrame(loop); };
    const stop = () => cancelAnimationFrame(raf);
    const onVis = () => { stop(); if (!document.hidden) start(); };
    start();
    document.addEventListener("visibilitychange", onVis);
    return () => { stop(); document.removeEventListener("visibilitychange", onVis); };
  }, [still]);
  return still ? 0 : frame;
}

/** The baked sky, drawn at the camera. `onPaint` fires after every draw (the skin's ready flag). */
export const SkyCanvas = memo(function SkyCanvas({ bake, ghost, box, vw, vh, dpr, sea, onPaint }: {
  bake: Bake; ghost: string | null; box: CamBox; vw: number; vh: number; dpr: number; sea: string; onPaint: () => void;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const cache = useRef(new Map<string, HTMLCanvasElement>());
  useEffect(() => { cache.current = new Map(); }, [bake]);
  useEffect(() => {
    const cv = ref.current;
    if (!cv || vw <= 1) return;
    const key = ghost ?? "";
    let src = cache.current.get(key);
    if (!src) {
      src = document.createElement("canvas");
      src.width = bake.w; src.height = bake.h;
      src.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(ghost ? ghostBake(bake, ghost) : bake.rgba), bake.w, bake.h), 0, 0);
      cache.current.set(key, src);
    }
    const W = Math.round(vw * dpr), H = Math.round(vh * dpr);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const ctx = cv.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = sea;
    ctx.fillRect(0, 0, W, H);
    const k = (vw / box.w) * dpr; // device px per frame px
    const cellPx = bake.cell * k;
    const ox = Math.round((bake.x - box.x) * k), oy = Math.round((bake.y - box.y) * k);
    ctx.drawImage(src, ox, oy, Math.round(bake.w * cellPx), Math.round(bake.h * cellPx));
    onPaint();
  }, [bake, ghost, box, vw, vh, dpr, sea, onPaint]);
  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 block" style={canvasStyle(vw, vh)} />;
});

/** The marks + the life layer, on the art grid (1 art px = `ap` CSS px). */
export const SkyMarks = memo(function SkyMarks({ stars, lines, arcs, leaders, box, vw, vh, dpr, ap, bake, selected, hovered, dimFam, still }: {
  stars: FStar[]; lines: Line[]; arcs: { a: FStar; b: FStar }[]; box: CamBox; vw: number; vh: number; dpr: number; ap: number; bake: Bake;
  /** sign leaders in SCREEN px: plaque edge → its nearest own star */
  leaders: { f: string; x0: number; y0: number; x1: number; y1: number }[];
  selected: string | null; hovered: string | null; dimFam: string | null; still: boolean;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const frame = useSkyTick(still);
  useEffect(() => {
    const cv = ref.current;
    if (!cv || vw <= 1) return;
    const W = Math.round(vw * dpr), H = Math.round(vh * dpr);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const ctx = cv.getContext("2d")!;
    ctx.clearRect(0, 0, W, H);
    const S = vw / box.w;
    const cols = Math.ceil(vw / ap), rows = Math.ceil(vh / ap);
    const art = (s: { x: number; y: number }): [number, number] => [Math.round(((s.x - box.x) * S) / ap), Math.round(((s.y - box.y) * S) / ap)];
    const ink = (f: string) => (dimFam && f !== dimFam ? (c: string) => dim(c) : undefined);

    // twinkle: a few field stars step along the field ramp (sky grid)
    if (frame > 0) {
      const k = S * dpr, cell = bake.cell * k;
      bake.field.forEach((f, i) => {
        const d = twinkle(i, frame);
        if (!d) return;
        const x = Math.round((bake.x + f.bx * bake.cell - box.x) * k), y = Math.round((bake.y + f.by * bake.cell - box.y) * k);
        if (x < -cell || y < -cell || x > W || y > H) return;
        ctx.fillStyle = FIELD[clamp(f.tone + d, 0, 3)];
        ctx.fillRect(x, y, Math.max(1, Math.round(cell)), Math.max(1, Math.round(cell)));
      });
    }

    // a parent with a fan of children keeps a wider clear ring, so its lines
    // meet a halo instead of knotting into the sprite
    const fan = new Map<string, number>();
    for (const l of lines) fan.set(l.a.name, (fan.get(l.a.name) ?? 0) + 1);
    const halo = (s: FStar) => starRadius(s.state, s.atom) + LINE.gap + Math.min(LINE.fanMax, Math.floor((fan.get(s.name) ?? 0) / LINE.fanPerPx));

    const under = new Pix(ap, dpr, cols, rows), over = new Pix(ap, dpr, cols, rows), top = new Pix(ap, dpr, cols, rows);
    // lineage lines (+ comets running parent → child). A sinking line keeps
    // full ink near both stars and sinks two flat steps into its nebula's tone
    // in its middle: a busy parent's fan reads as short spokes, the stars first
    lines.forEach((l, i) => {
      const px = asterism(art(l.a), art(l.b), halo(l.a), halo(l.b));
      const n = px.length;
      const steps = l.sink ? [l.ink, mix(l.ink, l.sink, LINE.fadeMix[0]), mix(l.ink, l.sink, LINE.fadeMix[1])] : [l.ink, l.ink, l.ink];
      px.forEach(([x, y], j) => {
        if (l.pattern === "dash" && j % LINE.dash[1] >= LINE.dash[0]) return;
        const d = Math.min(j, n - 1 - j);
        under.add(x, y, steps[d > LINE.fadeFar ? 2 : d > LINE.fadeNear ? 1 : 0]);
      });
      if (l.comet) {
        const h = comet(i, n, frame, l.comet.busy);
        if (h >= 0) for (let t = 0; t < 4; t++) { const p = px[h - t]; if (p) over.add(p[0], p[1], l.comet.ink[t]); }
      }
    });
    // pipeline arcs: dotted pastel aqua, star to star
    for (const a of arcs) {
      const px = arcPixels(art(a.a), art(a.b), starRadius(a.a.state, a.a.atom) + 3, starRadius(a.b.state, a.b.atom) + 3);
      px.forEach(([x, y], j) => { if (j % LINE.pipeDot === 0) under.add(x, y, INK.pipe); });
    }
    // sign leaders: a dotted line in the family's pastel from a sign set away
    // from its nebula to its nearest star (stopping short of the sprite)
    for (const L of leaders) {
      const A: [number, number] = [Math.round(L.x0 / ap), Math.round(L.y0 / ap)], B: [number, number] = [Math.round(L.x1 / ap), Math.round(L.y1 / ap)];
      const c = dim(FAMILY_INK[L.f]?.tint[0] ?? INK.cross, LINE.leaderDim);
      bresenham(A[0], A[1], B[0], B[1]).forEach(([x, y], j, all) => { if (j % 2 === 0 && all.length - j > LINE.leaderStop) under.add(x, y, c); });
    }
    // the stars
    stars.forEach((s, i) => {
      const [x, y] = art(s);
      if (x < -8 || y < -8 || x > cols + 8 || y > rows + 8) return;
      stamp(over, starSprite(s.state, s.atom), x, y, ink(s.family));
      if (s.state === "champion") {
        const g = glint(i, frame);
        if (g) {
          top.add(x, y, GOLD.w);
          const r = starRadius("champion", s.atom);
          for (let k = 1; k <= g - 1; k++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) top.add(x + dx * (r + k), y + dy * (r + k), k === g - 1 ? GOLD["3"] : GOLD["4"]);
        }
      }
      if (s.name === selected) {
        for (const [dx, dy] of reticleOffsets(starRadius(s.state, s.atom), LINE.reticle.ring, LINE.reticle.tick)) top.add(x + dx, y + dy, INK.ring);
      } else if (s.name === hovered) {
        for (const [dx, dy] of ringOffsets(starRadius(s.state, s.atom) + LINE.reticle.ring, "dotted")) top.add(x + dx, y + dy, INK.name);
      }
    });
    // a meteor now and then (decoration)
    const met = meteor(frame, cols, rows);
    if (met) for (const p of met) under.add(p.x, p.y, FIELD[p.k]);
    under.flush(ctx); over.flush(ctx); top.flush(ctx);
  }, [stars, lines, arcs, leaders, box, vw, vh, dpr, ap, bake, selected, hovered, dimFam, frame]);
  return <canvas ref={ref} aria-hidden data-sky-life={frame} className="pointer-events-none absolute inset-0 block" style={canvasStyle(vw, vh)} />;
});
