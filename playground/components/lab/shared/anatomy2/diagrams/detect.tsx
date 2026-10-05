"use client";

// Detect family — "where is it", two ways.
//   detection  models/detection/model.py (DigitDetector, 1,145,358 params):
//              ONE MNIST digit pasted on a black 56×56 canvas →
//              conv3×3 1→32 +ReLU @56 → pool → conv 32→64 +ReLU @28 → pool →
//              [64,14,14] → conv 64→128 +ReLU @14 → AdaptiveAvgPool(4) →
//              flatten 2048, shared by a class head (2048→256→10) and a box
//              head (2048→256→4→sigmoid, x1 y1 x2 y2 / 56). No BatchNorm, no
//              grid, no anchors. Loss = CE + 1.0·MSE(box); IoU is a readout,
//              the gate scores the class only. Builds on the classifier;
//              introduces bbox-regression → the box head, its 4 numbers and
//              the predicted box are the hot marks.
//   sam        models/sam/model.py (MiniSAM): two digits composited by max on
//              56×56; a 3-conv stride-2 encoder → 196 image tokens × 64; a
//              click/box → Fourier(y,x) + type embedding → prompt token(s);
//              tokens = [3 mask | 1 IoU | P prompt]; 2 TwoWayBlocks (tokens
//              read the image, MLP, then the image reads the tokens; post-LN,
//              no token self-attention); 2 ConvTranspose up to 16×56×56;
//              mask_h = Linear_h(mask token h) · up; IoU token → 3 scores.
//              Builds on segmentation + transformer; introduces promptable
//              decoding + two-way attention → the click path, the prompt
//              chip and the four two-way combs are hot.
//
// REAL (data/detection-champion.ts, mini-detection v1 run 8161d574, CPU
//   inference): 8 canvases, true/pred xyxy boxes, IoU, softmax, argmax, one
//   14×14 map (DET_MAP_CH after conv2+pool2, picked for interior contrast). CE = −ln p(label) and the box
//   MSE are derived here from those numbers, exactly.
// EXACT (computed here, no checkpoint): the sam composite of two real
//   MNIST_DIGITS (7 at window (2,6), 3 at (20,14) — hand-picked placement),
//   masks = pixel > 0, interior_click (COM snapped to the nearest ink pixel),
//   and every IoU between those masks.
// STAND-IN (labelled on the drawing): sam's candidate masks (A, B, A∪B), the
//   IoU scores (= their exact IoU vs target A), the attention heat and the
//   Fourier frequencies (seeded N(0,1), like the frozen buffer).
import { useEffect, useMemo, useState, type MutableRefObject, type ReactNode } from "react";
import { DET_BOX_PRED, DET_BOX_TRUE, DET_CANVAS, DET_DIGIT_IDX, DET_IOU, DET_LABELS, DET_MAP_CH, DET_MAPS, DET_PRED, DET_PROBS } from "../data/detection-champion";
import { MNIST_DIGITS, type MnistDigit } from "../data/mnist-digits";
import { gaussian, resize, unNib } from "../math";
import { textWidth } from "../pixel-font";
import { Bars, Diamond, Frame, Node, PText, Thumb, Wire } from "../prims";
import { useTick } from "../tick";
import { rampIndex, type Theme } from "../themes";
import type { KeyHandler } from "./types";

export const DETECT_VIEW = { w: 560, h: 316 };
export const DETECT_CARD_VIEW = { w: 190, h: 86 }; // caption moved to card.caption

/** house number format: two decimals, leading zero dropped under 1 */
const fmt = (v: number) => (v >= 0.995 ? "1.00" : v.toFixed(2).replace(/^0/, ""));
const argmax = (a: readonly number[]) => a.reduce((b, v, i) => (v > a[b] ? i : b), 0);

type Rect = { x: number; y: number; w: number; h: number };
/** normalized xyxy → integer art-pixel rect on a thumb at (X, Y), S px wide */
function boxPx(b: readonly number[], X: number, Y: number, S: number): Rect {
  const x1 = Math.round(b[0] * S), y1 = Math.round(b[1] * S), x2 = Math.round(b[2] * S), y2 = Math.round(b[3] * S);
  return { x: X + x1, y: Y + y1, w: x2 - x1, h: y2 - y1 };
}

/** the true box: a dotted outline (the 28×28 paste window) */
function TrueBox({ r, fill }: { r: Rect; fill: string }) {
  const x2 = r.x + r.w - 1, y2 = r.y + r.h - 1;
  return <Wire pts={[[r.x, r.y], [x2, r.y], [x2, y2], [r.x, y2], [r.x, r.y]]} fill={fill} step={2} />;
}

/** "and the other channels": two offset frames behind a map (classifier idiom) */
function Stack({ x, y, s, theme: T }: { x: number; y: number; s: number; theme: Theme }) {
  return (
    <g>
      {[2, 1].map((k) => <Frame key={k} x={x + k * 2 - 1} y={y - k * 2 - 1} w={s + 2} h={s + 2} fill={T.textDim} />)}
      <rect x={x} y={y} width={s} height={s} fill={T.ground} />
    </g>
  );
}

/** text with literal underscores (the pixel font reads `_x` as a subscript) */
function Ident({ x, y, text, fill }: { x: number; y: number; text: string; fill: string }) {
  const parts = text.split("_");
  const out: ReactNode[] = [];
  let cx = x;
  parts.forEach((p, i) => {
    const s = i < parts.length - 1 ? `${p}_` : p; // a trailing "_" renders as the glyph
    out.push(<PText key={i} x={cx} y={y} text={s} fill={fill} />);
    cx += textWidth(s) + 1;
  });
  return <g>{out}</g>;
}

/** a 5-px click marker with a 1-px halo in the image's own background */
function Click({ cx, cy, fill, theme: T }: { cx: number; cy: number; fill: string; theme: Theme }) {
  return (
    <g>
      <rect x={cx - 3} y={cy - 1} width={7} height={3} fill={T.ramp[0]} />
      <rect x={cx - 1} y={cy - 3} width={3} height={7} fill={T.ramp[0]} />
      <rect x={cx - 2} y={cy} width={5} height={1} fill={fill} />
      <rect x={cx} y={cy - 2} width={1} height={5} fill={fill} />
    </g>
  );
}

// ═════════════════════════ detection ═════════════════════════

const HERO = 7; // item 7 = MNIST test 0, the 7 (the classifier spine's digit)
// rows
const D_HEAD = 6, D_HEAD2 = 16, CY = 84, CLS_Y = 64, BOX_Y = 104, LABEL_Y = 120, NOTE_Y = 134;
// columns: a constant 12-px rhythm from the canvas to the softmax
const DX = { in: 16, c1: 84, c2: 99, map: 119, c3: 159, avg: 189, flat: 216, head: 228, out: 278, say: 334, hero: 380, dia: 524 };
const HERO_Y = 28, HS = 112;                   // hero canvas: 56×56 at px=2
const TR = { top: 46, h: 24 };                 // softmax tracks
const NUM_X = [282, 304, 326, 348];            // the 4 box numbers
const PANEL = { x: 10, y: 170, w: 540, h: 124 };
const STRIP_Y = 194, STRIP_CAP = 254;
const sx = (k: number) => 24 + k * 66;

function DetectionDiagram({ theme: T, still, keys: keysRef }: { theme: Theme; still: boolean; keys?: MutableRefObject<KeyHandler | null> }) {
  const [picked, setPicked] = useState(HERO);
  const sel = still ? HERO : picked;
  const frame = useTick(3, 3, still);
  const v = useMemo(() => ({
    canvas: DET_CANVAS.map((s) => unNib(s, 0, 1).map((x) => x * 2 - 1)),
    maps: DET_MAPS.map((s) => unNib(s, 0, 1).map((x) => x * 2 - 1)),
  }), []);

  useEffect(() => {
    if (!keysRef || still) return;
    keysRef.current = (e) => {
      if (e.key === "ArrowRight") { setPicked((s) => (s + 1) % 8); return true; }
      if (e.key === "ArrowLeft") { setPicked((s) => (s + 7) % 8); return true; }
      return false;
    };
    return () => { keysRef.current = null; };
  }, [keysRef, still]);

  const probs: readonly number[] = DET_PROBS[sel];
  const label = DET_LABELS[sel], guess = DET_PRED[sel];
  const bt: readonly number[] = DET_BOX_TRUE[sel], bp: readonly number[] = DET_BOX_PRED[sel];
  const ce = -Math.log(Math.max(1e-6, probs[label]));
  const mse = bt.reduce((a, t, i) => a + (bp[i] - t) ** 2, 0) / 4;
  const tr = boxPx(bt, DX.hero, HERO_Y, HS), pr = boxPx(bp, DX.hero, HERO_Y, HS);
  // the box wire lands on the predicted box's left edge (jogs if the box sits high)
  const ty = Math.min(pr.y + pr.h - 4, Math.max(pr.y + 3, BOX_Y));
  const tx = pr.x - 2;
  const landing: [number, number][] = ty === BOX_Y
    ? [[277, BOX_Y], [tx, BOX_Y]]
    : [[277, BOX_Y], [DX.hero - 6, BOX_Y], [DX.hero - 6, ty], [tx, ty]];
  const ious: readonly number[] = DET_IOU;
  const right = DET_PRED.filter((p, k) => p === DET_LABELS[k]).length;
  const interactive = !still;
  const lx = DX.out + 5 * label + 1; // the true label's track: where CE reads p

  return (
    <g>
      <rect x={0} y={0} width={DETECT_VIEW.w} height={DETECT_VIEW.h} fill={T.ground} />

      {/* header rows */}
      <PText x={DX.in} y={D_HEAD} text="canvas" fill={T.textDim} />
      <PText x={DX.c1} y={D_HEAD} text="backbone: conv+ReLU, no BN" fill={T.textDim} />
      <PText x={DX.head} y={D_HEAD} text="heads" fill={T.textDim} />
      <PText x={DX.out} y={D_HEAD} text="softmax" fill={T.textDim} />
      <PText x={DX.hero} y={D_HEAD} text="where it lands" fill={T.textDim} />
      <PText x={DX.in} y={D_HEAD2} text={`test ${DET_DIGIT_IDX[sel]}`} fill={T.textDim} />
      <PText x={DX.map} y={D_HEAD2} text={`ch ${DET_MAP_CH}`} fill={T.textDim} />

      {/* backbone: bar height = resolution (56 / 28 / 14), 1 bar = 32 ch */}
      <Thumb x={DX.in} y={CY - 28} data={v.canvas[sel]} n={56} px={1} theme={T} />
      <Wire pts={[[74, CY], [82, CY]]} fill={T.accentLo} step={1} />
      <Bars x={DX.c1} y={CY - 28} bars={1} h={56} theme={T} bw={3} gap={2} />
      <Wire pts={[[89, CY], [97, CY]]} fill={T.accentLo} step={1} />
      <Bars x={DX.c2} y={CY - 14} bars={2} h={28} theme={T} bw={3} gap={2} />
      <Wire pts={[[109, CY], [116, CY]]} fill={T.accentLo} step={1} />
      <Stack x={DX.map} y={CY - 14} s={28} theme={T} />
      <Thumb x={DX.map} y={CY - 14} data={v.maps[sel]} n={14} px={2} theme={T} />
      <Wire pts={[[149, CY], [157, CY]]} fill={T.accentLo} step={1} />
      <Bars x={DX.c3} y={CY - 7} bars={4} h={14} theme={T} bw={3} gap={2} />
      <Wire pts={[[179, CY], [187, CY]]} fill={T.accentLo} step={1} />
      {Array.from({ length: 16 }, (_, i) => (
        <rect key={`a${i}`} x={DX.avg + (i % 4) * 4} y={CY - 8 + Math.floor(i / 4) * 4} width={3} height={3} fill={T.accentLo} />
      ))}
      <Wire pts={[[206, CY], [214, CY]]} fill={T.accentLo} step={1} />
      <rect x={DX.flat} y={CY - 28} width={1} height={56} fill={T.accentHi} />

      {/* channel subscripts: one baseline */}
      <PText x={DX.in + 28} y={LABEL_Y} text="_{1}" fill={T.textDim} anchor="middle" />
      <PText x={DX.c1 + 1} y={LABEL_Y} text="_{32}" fill={T.textDim} anchor="middle" />
      <PText x={DX.c2 + 4} y={LABEL_Y} text="_{64}" fill={T.textDim} anchor="middle" />
      <PText x={DX.map + 14} y={LABEL_Y} text="_{64}" fill={T.textDim} anchor="middle" />
      <PText x={DX.c3 + 9} y={LABEL_Y} text="_{128}" fill={T.textDim} anchor="middle" />
      <PText x={DX.avg + 7} y={LABEL_Y} text="_{4×4}" fill={T.textDim} anchor="middle" />
      <PText x={DX.flat} y={LABEL_Y} text="_{2048}" fill={T.textDim} anchor="middle" />
      <PText x={DX.head + 19} y={LABEL_Y} text="_{256}" fill={T.textDim} anchor="middle" />

      {/* the fork: class head (inherited, accent) up, box head (introduced, hot) down */}
      <PText x={DX.head} y={CLS_Y - 18} text="class" fill={T.textDim} />
      <Wire pts={[[217, CLS_Y], [226, CLS_Y]]} fill={T.accentLo} step={1} />
      <Bars x={DX.head} y={CLS_Y - 7} bars={8} h={14} theme={T} bw={3} gap={2} />
      <Wire pts={[[267, CLS_Y], [276, CLS_Y]]} fill={T.accentLo} step={1} />
      <PText x={DX.head} y={BOX_Y - 18} text="box" fill={T.wireHot} />
      <Wire pts={[[217, BOX_Y], [226, BOX_Y]]} fill={T.wireHot} step={3} phase={frame} />
      <Bars x={DX.head} y={BOX_Y - 7} bars={8} h={14} theme={T} bw={3} gap={2} />
      <Wire pts={[[267, BOX_Y], [268, BOX_Y]]} fill={T.wireHot} step={1} />
      <PText x={270} y={BOX_Y - 3} text="σ" fill={T.wireHot} />
      <Wire pts={landing} fill={T.wireHot} step={3} phase={frame} />

      {/* softmax over 10 classes (real) */}
      {probs.map((p, k) => {
        const x = DX.out + k * 5, fh = Math.round(p * TR.h), hot = k === guess;
        return (
          <g key={`p${k}`}>
            <rect x={x} y={TR.top} width={3} height={TR.h} fill={T.panel} />
            {fh > 0 && <rect x={x} y={TR.top + TR.h - fh} width={3} height={fh} fill={hot ? T.accentHi : T.accent} />}
            <PText x={x} y={TR.top + TR.h + 2} text={`_{${k}}`} fill={hot ? T.wireHot : T.textDim} />
          </g>
        );
      })}
      <PText x={DX.say} y={TR.top} text="says" fill={T.textDim} />
      <PText x={DX.say + textWidth("says ") + 1} y={TR.top} text={String(guess)} fill={T.wireHot} />
      <PText x={DX.say} y={TR.top + 10} text={`p ${fmt(probs[guess])}`} fill={T.textDim} />
      {guess !== label && <PText x={DX.say} y={TR.top + 20} text={`is ${label}`} fill={T.loss} />}

      {/* the 4 box numbers (real, x first) */}
      {["x1", "y1", "x2", "y2"].map((h, i) => <PText key={h} x={NUM_X[i]} y={BOX_Y - 20} text={h} fill={T.textDim} />)}
      {bp.map((b, i) => <PText key={`n${i}`} x={NUM_X[i]} y={BOX_Y - 10} text={fmt(b)} fill={T.wireHot} />)}

      {/* hero canvas ×2: dotted true box, the hot predicted box */}
      <Thumb x={DX.hero} y={HERO_Y} data={v.canvas[sel]} n={56} px={2} theme={T} />
      <Frame x={pr.x} y={pr.y} w={pr.w} h={pr.h} fill={T.wireHot} />
      <TrueBox r={tr} fill={T.textDim} />
      <PText x={DX.hero} y={HERO_Y + HS + 6} text={`IoU ${fmt(DET_IOU[sel])}`} fill={T.text} />
      <PText x={DX.hero} y={HERO_Y + HS + 16} text="measured, not in the loss" fill={T.textDim} />

      {/* the objective: CE reads the true label's p, MSE reads the box */}
      <Wire pts={[[lx, TR.top - 2], [lx, 24], [DX.dia, 24], [DX.dia, CY - 8]]} fill={T.wire} />
      <Wire pts={[[495, CY], [516, CY]]} fill={T.wire} />
      <Diamond cx={DX.dia} cy={CY} theme={T} />
      <PText x={DX.dia + 1} y={CY + 10} text="CE+MSE" fill={T.loss} anchor="middle" />
      <PText x={DX.dia + 1} y={CY + 20} text={fmt(ce + mse)} fill={T.loss} anchor="middle" />
      <PText x={DX.dia + 1} y={CY + 30} text={`box ${mse.toExponential(0)}`} fill={T.textDim} anchor="middle" />
      <PText x={DX.dia + 1} y={CY + 40} text="gate acc" fill={T.textDim} anchor="middle" />

      {/* honesty notes */}
      <PText x={DX.in} y={NOTE_Y} text="no grid, no anchors: one digit, one box" fill={T.textDim} />
      <PText x={DX.in} y={NOTE_Y + 10} text="both heads read the same 2048 numbers" fill={T.textDim} />
      <PText x={DX.in} y={NOTE_Y + 20} text={`ch ${DET_MAP_CH} is 0 on the ink: the digit is the gap`} fill={T.textDim} />

      {/* the 8-canvas strip: boxes land, classes mostly do not */}
      <rect x={PANEL.x} y={PANEL.y} width={PANEL.w} height={PANEL.h} fill={T.panel} />
      <Frame x={PANEL.x} y={PANEL.y} w={PANEL.w} h={PANEL.h} fill={T.frame} />
      <PText x={20} y={PANEL.y + 8}
        text={`eight test canvases: every box lands (IoU ${fmt(Math.min(...ious))}-${fmt(Math.max(...ious))}), the class only ${right} of 8`}
        fill={T.wireHot} />
      {DET_CANVAS.map((_, k) => {
        const x = sx(k);
        const t = boxPx(DET_BOX_TRUE[k], x, STRIP_Y, 56), p = boxPx(DET_BOX_PRED[k], x, STRIP_Y, 56);
        const wrong = DET_PRED[k] !== DET_LABELS[k];
        return (
          <g key={`s${k}`} onClick={interactive ? () => setPicked(k) : undefined} style={interactive ? { cursor: "pointer" } : undefined}>
            <Thumb x={x} y={STRIP_Y} data={v.canvas[k]} n={56} px={1} theme={T} />
            <Frame x={p.x} y={p.y} w={p.w} h={p.h} fill={T.accentHi} />
            <TrueBox r={t} fill={T.textDim} />
            <PText x={x} y={STRIP_CAP} text={String(DET_PRED[k])} fill={wrong ? T.loss : T.text} />
            <PText x={x + 56} y={STRIP_CAP} text={fmt(DET_IOU[k])} fill={k === sel ? T.text : T.textDim} anchor="end" />
            {k === sel && <rect x={x} y={STRIP_CAP + 9} width={56} height={1} fill={T.text} />}
          </g>
        );
      })}
      <PText x={24} y={STRIP_CAP + 14} text="left: the class guess (wrong ones in the loss colour)   right: IoU" fill={T.textDim} />
      <PText x={24} y={STRIP_CAP + 26} text="champion, 500 test canvases (probe): class acc .62 (gate M .55, L .80), mean IoU .91" fill={T.textDim} />

      <PText x={16} y={DETECT_VIEW.h - 14} text="1 bar = 32 ch, height = resolution   map: ground colour = 0 after ReLU   dotted = true 28×28 box   line = predicted" fill={T.textDim} />
    </g>
  );
}

// ————— card: one digit forks into what + where —————
function DetectionCard({ theme: T }: { theme: Theme }) {
  const c = useMemo(() => unNib(DET_CANVAS[HERO], 0, 1).map((x) => x * 2 - 1), []);
  const probs: readonly number[] = DET_PROBS[HERO];
  const am = argmax(probs);
  const tr = boxPx(DET_BOX_TRUE[HERO], 4, 24, 56), pr = boxPx(DET_BOX_PRED[HERO], 4, 24, 56);
  return (
    <g>
      <rect x={0} y={0} width={DETECT_CARD_VIEW.w} height={DETECT_CARD_VIEW.h} fill={T.ground} />
      <Thumb x={4} y={24} data={c} n={56} px={1} theme={T} />
      <Frame x={pr.x} y={pr.y} w={pr.w} h={pr.h} fill={T.wireHot} />
      <TrueBox r={tr} fill={T.textDim} />
      <Wire pts={[[62, 52], [66, 52]]} fill={T.accentLo} step={1} />
      <rect x={68} y={24} width={1} height={56} fill={T.accentHi} />
      {/* what: the class head (inherited) */}
      <Wire pts={[[69, 32], [80, 32]]} fill={T.accentLo} step={1} />
      {probs.map((p, k) => {
        const h = Math.round(p * 24);
        return (
          <g key={k}>
            <rect x={82 + k * 4} y={20} width={3} height={24} fill={T.panel} />
            {h > 0 && <rect x={82 + k * 4} y={44 - h} width={3} height={h} fill={k === am ? T.accentHi : T.accent} />}
            <PText x={82 + k * 4} y={46} text={`_{${k}}`} fill={k === am ? T.wireHot : T.textDim} />
          </g>
        );
      })}
      {/* where: the box head (introduced) */}
      <Wire pts={[[69, 72], [80, 72]]} fill={T.wireHot} step={1} />
      {DET_BOX_PRED[HERO].map((b, i) => <PText key={i} x={82 + i * 18} y={69} text={fmt(b)} fill={T.wireHot} />)}
    </g>
  );
}

// ═════════════════════════ sam ═════════════════════════

const SN = 56;
const PLACE_A = { r: 2, c: 6 }, PLACE_B = { r: 20, c: 14 }; // hand-picked windows (TS cannot replay the torch seed)
const FREQ_SEED = 11;                                         // stand-in for the frozen N(0,1) freq buffer

function placeDigit(d: MnistDigit, r: number, c: number): Float32Array {
  const out = new Float32Array(SN * SN);
  for (let y = 0; y < 28; y++)
    for (let x = 0; x < 28; x++) out[(r + y) * SN + c + x] = parseInt(d.hex.slice(2 * (y * 28 + x), 2 * (y * 28 + x) + 2), 16) / 255;
  return out;
}

/** trainer.interior_click: centre of mass snapped to the nearest ink pixel (first on ties) → (y, x) */
function interiorClick(m: Float32Array): [number, number] {
  const fg: [number, number][] = [];
  for (let y = 0; y < SN; y++) for (let x = 0; x < SN; x++) if (m[y * SN + x] > 0) fg.push([y, x]);
  const cy = fg.reduce((a, p) => a + p[0], 0) / fg.length, cx = fg.reduce((a, p) => a + p[1], 0) / fg.length;
  let best = 0, bd = Infinity;
  fg.forEach((p, i) => { const d = (p[0] - cy) ** 2 + (p[1] - cx) ** 2; if (d < bd) { bd = d; best = i; } });
  return fg[best];
}

function maskIoU(a: Float32Array, b: Float32Array): number {
  let i = 0, u = 0;
  for (let k = 0; k < a.length; k++) { const p = a[k] > 0, q = b[k] > 0; if (p && q) i++; if (p || q) u++; }
  return u ? i / u : 0;
}

function samScene() {
  const a = placeDigit(MNIST_DIGITS[7], PLACE_A.r, PLACE_A.c); // MNIST test 0, the 7
  const b = placeDigit(MNIST_DIGITS[3], PLACE_B.r, PLACE_B.c); // MNIST test 18, a 3
  const comp = a.map((v, i) => Math.max(v, b[i]));              // make_composite_image: elementwise max
  const mA = a.map((v) => (v > 0 ? 1 : 0)), mB = b.map((v) => (v > 0 ? 1 : 0));
  const mU = mA.map((v, i) => Math.max(v, mB[i]));
  const sym = (m: Float32Array) => m.map((v) => v * 2 - 1);
  const clickA = interiorClick(mA), clickB = interiorClick(mB);
  const rA = resize(mA, SN, SN, 14), rB = resize(mB, SN, SN, 14);
  const norm = (m: Float32Array) => { let mx = 1e-6; for (const v of m) mx = Math.max(mx, v); return m.map((v) => v / mx); };
  // Fourier features of the click A, (y, x)/56 @ F[2,16] · 2π → [sin; cos]
  const F = gaussian(32, FREQ_SEED);
  const [py, px] = [clickA[0] / SN, clickA[1] / SN];
  const ang = Array.from({ length: 16 }, (_, j) => 2 * Math.PI * (py * F[j] + px * F[16 + j]));
  const four = [...ang.map(Math.sin), ...ang.map(Math.cos)];
  return {
    comp: sym(comp), g0: resize(comp, SN, SN, 14).map((v) => v * 2 - 1),
    mA: sym(mA), mB: sym(mB), mU: sym(mU),
    h1: norm(rA.map((v, i) => v + 0.3 * rB[i])), h2: norm(rA),
    clickA, clickB, four,
    ious: [1, maskIoU(mA, mB), maskIoU(mA, mU)],
  };
}

// rows
const S_HEAD = 6, IY = 44, LABEL_IMG = 76, TOK_HEAD = 88, LABEL_TOK = 149, LEGEND_Y = 159;
const ROWS = [98, 108, 118, 128, 138];                   // mask 1, mask 2, mask 3, IoU, prompt (tops, 8 tall)
const rc = (r: number) => ROWS[r] + 4;
const ROW_END = ROWS[4] + 7;                             // last pixel row of the token rows (145)
const BUS_Y = 166, THUMB_Y = 174, CAP_Y = 234, MIN_Y = 244, NOTES = [258, 268, 278];
const BPANEL = { x: 10, y: 170, w: 140, h: 74 };         // the click-B pair
// columns
const SX = { in: 16, e1: 82, e2: 98, e3: 124, g0: 150, chip: 150, ct1: 380, ct2: 396, lin: 380, node: 414, out: 446, tgt: 404, dia: 522 };
const BLK = [186, 286];
// inside a block (offsets from its x): the two hot combs and the per-row cells
const B = { down: 2, attn: 7, mlp: 28, img: 64, up: 77 };
const CAND = [188, 250, 312];
const STRIP_X = 42, LIN_X = 110, TYPE_X = 134;
const SCORE = { x: 398, pitch: 5, top: ROWS[3], h: ROW_END - ROWS[3] + 1 }; // 3 IoU-head columns

/** a 6/4/2-px arrowhead on a 2-px comb at x..x+1, pointing down (tip at y+2) or up (tip at y) */
function Head({ x, y, dir, fill }: { x: number; y: number; dir: "down" | "up"; fill: string }) {
  const rows = dir === "down" ? [6, 4, 2] : [2, 4, 6];
  return <g>{rows.map((w, i) => <rect key={i} x={x + 1 - w / 2} y={y + i} width={w} height={1} fill={fill} />)}</g>;
}

function SamDiagram({ theme: T, still }: { theme: Theme; still: boolean }) {
  const frame = useTick(3, 3, still);
  const s = useMemo(() => samScene(), []);
  const cands = [s.mA, s.mB, s.mU];
  const pick = argmax(s.ious);
  const [ay, ax] = s.clickA, [by, bx] = s.clickB;
  const labels = ["mask 1", "mask 2", "mask 3", "IoU"];
  const hot0 = "_{0}+";

  return (
    <g>
      <rect x={0} y={0} width={DETECT_VIEW.w} height={DETECT_VIEW.h} fill={T.ground} />

      {/* headers */}
      <PText x={SX.in} y={S_HEAD} text="image" fill={T.textDim} />
      <PText x={SX.e1} y={S_HEAD} text="encoder" fill={T.textDim} />
      {BLK.map((x, k) => (
        <g key={`hd${k}`}>
          <PText x={x} y={S_HEAD} text={`block ${k + 1}`} fill={T.textDim} />
          <PText x={x + 36} y={S_HEAD} text="two-way" fill={T.wireHot} />
        </g>
      ))}
      <PText x={SX.ct1} y={S_HEAD} text="up" fill={T.textDim} />
      <PText x={STRIP_X} y={TOK_HEAD} text="prompt" fill={T.textDim} />
      <PText x={SX.chip} y={TOK_HEAD} text="tokens" fill={T.textDim} />

      {/* image lane: composite → stride-2 convs → 196 tokens (no pools, no skips) */}
      <Thumb x={SX.in} y={IY - 28} data={s.comp} n={56} px={1} theme={T} />
      <Click cx={SX.in + ax} cy={IY - 28 + ay} fill={T.wireHot} theme={T} />
      <Wire pts={[[74, IY], [80, IY]]} fill={T.accentLo} step={1} />
      <Bars x={SX.e1} y={IY - 14} bars={2} h={28} theme={T} bw={3} gap={2} />
      <Wire pts={[[92, IY], [96, IY]]} fill={T.accentLo} step={1} />
      <Bars x={SX.e2} y={IY - 7} bars={4} h={14} theme={T} bw={3} gap={2} />
      <Wire pts={[[118, IY], [122, IY]]} fill={T.accentLo} step={1} />
      <Bars x={SX.e3} y={IY - 7} bars={4} h={14} theme={T} bw={3} gap={2} />
      <Wire pts={[[144, IY], [147, IY]]} fill={T.accentLo} step={1} />
      <Thumb x={SX.g0} y={IY - 14} data={s.g0} n={14} px={2} theme={T} />
      <PText x={SX.in + 28} y={LABEL_IMG} text="_{1}" fill={T.textDim} anchor="middle" />
      <PText x={SX.e1 + 4} y={LABEL_IMG} text="_{32}" fill={T.textDim} anchor="middle" />
      <PText x={SX.e2 + 9} y={LABEL_IMG} text="_{64}" fill={T.textDim} anchor="middle" />
      <PText x={SX.e3 + 9} y={LABEL_IMG} text="_{64}" fill={T.textDim} anchor="middle" />
      <PText x={SX.g0 + 14} y={LABEL_IMG} text="_{196×64}" fill={T.textDim} anchor="middle" />
      <PText x={SX.ct1 + 4} y={LABEL_IMG} text="_{32}" fill={T.textDim} anchor="middle" />
      <PText x={SX.ct2 + 1} y={LABEL_IMG} text="_{16}" fill={T.textDim} anchor="middle" />

      {/* prompt lane: click (y, x) → Fourier [sin; cos] → Linear → + type → the prompt token */}
      <Wire pts={[[37, 75], [37, rc(4)], [STRIP_X - 2, rc(4)]]} fill={T.wireHot} />
      {s.four.map((f, i) => <rect key={`f${i}`} x={STRIP_X + i * 2} y={ROWS[4] + 1} width={2} height={7} fill={T.ramp[rampIndex(f)]} />)}
      <Bars x={LIN_X} y={ROWS[4] + 1} bars={4} h={7} theme={T} bw={3} gap={1} />
      <PText x={127} y={ROWS[4] + 1} text="+" fill={T.textDim} />
      {[0, 1, 2, 3].map((k) => <rect key={`ty${k}`} x={TYPE_X + k * 3} y={ROWS[4] + 1} width={2} height={7} fill={k === 0 ? T.wireHot : T.panel} />)}
      {/* one label row under the prompt row, one legend row under that */}
      <PText x={STRIP_X} y={LABEL_TOK} text="sin;cos (y,x)" fill={T.textDim} />
      <PText x={LIN_X + 7} y={LABEL_TOK} text="_{64}" fill={T.textDim} anchor="middle" />
      <PText x={TYPE_X} y={LABEL_TOK} text="type" fill={T.textDim} />
      <PText x={STRIP_X} y={LEGEND_Y} text={`(${fmt(ay / SN)},${fmt(ax / SN)})`} fill={T.text} />
      <PText x={TYPE_X - 19} y={LEGEND_Y} text={hot0} fill={T.wireHot} />
      <PText x={TYPE_X - 19 + textWidth(hot0) + 1} y={LEGEND_Y} text=" _{1}− _{2,3}box" fill={T.textDim} />

      {/* the token list: [3 mask | 1 IoU | 1 prompt], each 64-d; their threads */}
      {ROWS.map((r, i) => (
        <Wire key={`th${i}`} pts={[[i === 4 ? 169 : 167, rc(i)], [i === 4 ? 362 : 378, rc(i)]]} fill={T.wire} />
      ))}
      {ROWS.map((r, i) => (
        <g key={`chip${i}`}>
          {i < 4 && <PText x={146} y={r + 1} text={labels[i]} fill={T.textDim} anchor="end" />}
          {[0, 1, 2, 3].map((c) => <rect key={c} x={SX.chip + c * 4} y={r + 1} width={3} height={7} fill={c === 0 ? T.accentHi : T.accent} />)}
        </g>
      ))}
      <Frame x={SX.chip - 2} y={ROWS[4] - 1} w={20} h={10} fill={T.wireHot} />

      {/* image spine through the two blocks and up */}
      <Wire pts={[[180, IY], [183, IY]]} fill={T.accentLo} step={1} />
      {BLK.map((x0, k) => (
        <g key={`sp${k}`}>
          <Wire pts={[[x0 + 30, IY], [x0 + 62, IY]]} fill={T.accentLo} step={1} />
          <Wire pts={[[x0 + 83, IY], [k === 0 ? BLK[1] - 3 : SX.ct1 - 2, IY]]} fill={T.accentLo} step={1} />
        </g>
      ))}
      <Bars x={SX.ct1} y={IY - 14} bars={2} h={28} theme={T} bw={3} gap={2} />
      <Wire pts={[[390, IY], [394, IY]]} fill={T.accentLo} step={1} />
      <Bars x={SX.ct2} y={IY - 28} bars={1} h={56} theme={T} bw={3} gap={2} />

      {/* two two-way blocks: the down-comb = tokens read the image (a tooth into each
          row's attn cell, one cell per row = no token self-attention); the up-comb =
          the image reads the tokens (a tooth out of each row, into the image update) */}
      {BLK.map((x0, k) => (
        <g key={`blk${k}`}>
          <Thumb x={x0} y={IY - 14} data={k === 0 ? s.h1 : s.h2} n={14} px={2} theme={T} heat />
          {ROWS.map((r, i) => (
            <g key={`c${i}`}>
              <Bars x={x0 + B.attn} y={r} bars={4} h={8} theme={T} bw={3} gap={1} />
              <Bars x={x0 + B.mlp} y={r} bars={8} h={8} theme={T} bw={3} gap={1} />
              <rect x={x0 + B.down + 2} y={rc(i)} width={2} height={1} fill={T.wireHot} />
              <rect x={x0 + B.up - 2} y={rc(i)} width={2} height={1} fill={T.wireHot} />
            </g>
          ))}
          <Bars x={x0 + B.img} y={IY - 7} bars={4} h={14} theme={T} bw={3} gap={2} />
          <Wire pts={[[x0 + B.down, IY + 17], [x0 + B.down, ROW_END]]} fill={T.wireHot} w={2} step={3} phase={frame} />
          <Head x={x0 + B.down} y={ROW_END + 1} dir="down" fill={T.wireHot} />
          <Wire pts={[[x0 + B.up, ROW_END], [x0 + B.up, IY + 12]]} fill={T.wireHot} w={2} step={3} phase={frame} />
          <Head x={x0 + B.up} y={IY + 9} dir="up" fill={T.wireHot} />
        </g>
      ))}
      <PText x={BLK[0] + 6} y={IY + 18} text="mask 1→image" fill={T.textDim} />
      <PText x={BLK[0] + 6} y={IY + 28} text="stand-in" fill={T.textDim} />

      {/* heads: mask_h = Linear_h(mask token h) · up features; IoU token → 3 scores */}
      {[0, 1, 2].map((h) => (
        <g key={`lh${h}`}>
          <Bars x={SX.lin} y={ROWS[h]} bars={1} h={8} theme={T} bw={3} gap={1} />
          <Wire pts={[[385, rc(h)], [SX.node, rc(h)]]} fill={T.wire} />
        </g>
      ))}
      <Wire pts={[[SX.node, rc(2)], [SX.node, 91]]} fill={T.wire} />
      <Wire pts={[[401, IY], [SX.node, IY], [SX.node, 77]]} fill={T.accentLo} step={1} />
      <Node cx={SX.node} cy={84} glyph="·" theme={T} />
      <PText x={452} y={81} text="mask = token · up" fill={T.textDim} />
      <Bars x={SX.lin} y={ROWS[3]} bars={4} h={8} theme={T} bw={3} gap={1} />
      {s.ious.map((v, h) => {
        const x = SCORE.x + h * SCORE.pitch, fh = Math.round(v * SCORE.h);
        return (
          <g key={`sc${h}`}>
            <rect x={x} y={SCORE.top} width={3} height={SCORE.h} fill={T.panel} />
            {fh > 0 && <rect x={x} y={SCORE.top + SCORE.h - fh} width={3} height={fh} fill={h === pick ? T.accentHi : T.accent} />}
            <PText x={x} y={LABEL_TOK} text={`_{${h + 1}}`} fill={h === pick ? T.text : T.textDim} />
          </g>
        );
      })}
      <PText x={SCORE.x - 3} y={LABEL_TOK} text="stand-in" fill={T.textDim} anchor="end" />
      {/* iou_pred → the +MSE term (hops the candidate bus) */}
      <Wire pts={[[SCORE.x + 15, 137], [SX.out - 3, 137]]} fill={T.wire} />
      <Wire pts={[[SX.out + 3, 137], [SX.dia, 137], [SX.dia, 194]]} fill={T.wire} />

      {/* 3 candidate masks (stand-ins) on one bus, the exact target */}
      <Wire pts={[[420, 84], [SX.out, 84], [SX.out, BUS_Y], [CAND[0] + 28, BUS_Y]]} fill={T.wire} />
      {CAND.map((x, h) => (
        <g key={`cd${h}`}>
          <Wire pts={[[x + 28, BUS_Y], [x + 28, THUMB_Y - 3]]} fill={T.wire} />
          <Thumb x={x} y={THUMB_Y} data={cands[h]} n={56} px={1} theme={T} />
          {h === pick && <Frame x={x - 2} y={THUMB_Y - 2} w={60} h={60} fill={T.accentHi} />}
          <PText x={x} y={CAP_Y} text={`_{${h + 1}} ${fmt(s.ious[h])}`} fill={h === pick ? T.text : T.textDim} />
          <Wire pts={[[x + 44, CAP_Y - 1], [x + 44, MIN_Y]]} fill={T.wire} />
        </g>
      ))}
      <Thumb x={SX.tgt} y={THUMB_Y} data={s.mA} n={56} px={1} theme={T} />
      <PText x={SX.tgt} y={CAP_Y} text="target A" fill={T.textDim} />
      <Wire pts={[[SX.tgt + 44, CAP_Y - 1], [SX.tgt + 44, MIN_Y]]} fill={T.wire} />
      <Wire pts={[[CAND[0] + 44, MIN_Y], [490, MIN_Y], [490, 202], [SX.dia - 8, 202]]} fill={T.wire} />
      <Diamond cx={SX.dia} cy={202} theme={T} />
      <PText x={SX.dia + 1} y={212} text="BCE+Dice" fill={T.loss} anchor="middle" />
      <PText x={SX.dia + 1} y={222} text="min of 3" fill={T.loss} anchor="middle" />
      <PText x={SX.dia + 1} y={232} text="+MSE IoU" fill={T.loss} anchor="middle" />
      <PText x={CAND[0]} y={MIN_Y + 4} text="IoU vs target A; only the best head gets mask gradient" fill={T.textDim} />

      {/* promptability: same image, click B → the other target */}
      <rect x={BPANEL.x} y={BPANEL.y} width={BPANEL.w} height={BPANEL.h} fill={T.panel} />
      <Frame x={BPANEL.x} y={BPANEL.y} w={BPANEL.w} h={BPANEL.h} fill={T.frame} />
      <Thumb x={16} y={THUMB_Y} data={s.comp} n={56} px={1} theme={T} />
      <Click cx={16 + bx} cy={THUMB_Y + by} fill={T.text} theme={T} />
      <Wire pts={[[75, THUMB_Y + 28], [81, THUMB_Y + 28]]} fill={T.wire} />
      <Thumb x={84} y={THUMB_Y} data={s.mB} n={56} px={1} theme={T} />
      <PText x={16} y={CAP_Y} text="click B → mask B" fill={T.text} />

      {/* honesty */}
      <PText x={16} y={NOTES[0]} text="no local sam checkpoint: masks are targets, not predictions (candidates: A, B, A+B)" fill={T.loss} />
      <Ident x={16} y={NOTES[1]} text="gate eval_iou: the mask vs the clicked digit (M .45, L .70, provisional)" fill={T.textDim} />
      <Ident x={16} y={NOTES[2]} text={`wrong_prompt_iou: the same mask vs the other digit (here A vs B overlap ${fmt(s.ious[1])})`} fill={T.textDim} />

      <PText x={16} y={DETECT_VIEW.h - 14} text="1 bar = 16 ch, height = resolution   ↓ tokens read the image   ↑ the image reads the tokens   heat, freq: stand-in" fill={T.textDim} />
    </g>
  );
}

// ————— card: one image, two clicks, two masks —————
const CARD_X = [3, 67, 131]; // mask A (hot frame 1 px in) · image · mask B
function SamCard({ theme: T }: { theme: Theme }) {
  const s = useMemo(() => samScene(), []);
  const [ay, ax] = s.clickA, [by, bx] = s.clickB;
  const Y = 16, mid = CARD_X[1] + 28;
  return (
    <g>
      <rect x={0} y={0} width={DETECT_CARD_VIEW.w} height={DETECT_CARD_VIEW.h} fill={T.ground} />
      {/* one header row carries the direction: mask A ← image → mask B */}
      <PText x={CARD_X[0]} y={4} text="mask A" fill={T.wireHot} />
      <PText x={mid - 21} y={4} text="←" fill={T.wireHot} />
      <PText x={mid} y={4} text="image" fill={T.textDim} anchor="middle" />
      <PText x={mid + 15} y={4} text="→" fill={T.textDim} />
      <PText x={CARD_X[2]} y={4} text="mask B" fill={T.textDim} />
      <Thumb x={CARD_X[0]} y={Y} data={s.mA} n={56} px={1} theme={T} />
      <Frame x={CARD_X[0] - 2} y={Y - 2} w={60} h={60} fill={T.wireHot} />
      <Thumb x={CARD_X[1]} y={Y} data={s.comp} n={56} px={1} theme={T} />
      <Click cx={CARD_X[1] + ax} cy={Y + ay} fill={T.wireHot} theme={T} />
      <Click cx={CARD_X[1] + bx} cy={Y + by} fill={T.text} theme={T} />
      <Thumb x={CARD_X[2]} y={Y} data={s.mB} n={56} px={1} theme={T} />
    </g>
  );
}

// Structurally the registry's DiagramDef (index.tsx keeps that interface private).
interface DetectDef {
  view: { w: number; h: number };
  scrub?: boolean;
  interactive?: boolean;
  keysHint?: string;
  title: string;
  truth: string;
  render: (p: { theme: Theme; t: number; onT?: (t: number) => void; still: boolean; keys: MutableRefObject<KeyHandler | null> }) => ReactNode;
  card: { view: { w: number; h: number }; render: (p: { theme: Theme; t: number }) => ReactNode; caption?: string };
  badge: string;
}

export const DETECT_DEFS: Record<string, DetectDef> = {
  detection: {
    view: DETECT_VIEW,
    interactive: true,
    keysHint: "←/→ pick a canvas, or click one",
    title: "detection — one backbone, two heads: what the digit is and where it sits",
    truth: `Real: eight MNIST test digits on 56×56 canvases run through the local mini-detection champion (class probabilities, true vs predicted box, IoU, backbone channel ${DET_MAP_CH} after the second pool), with CE + MSE computed here from those outputs; IoU is only a measure and the gate scores the class (M .55, L .80). Structural: the plain conv + ReLU backbone, the 4×4 average pool and the one 2048 vector feeding a class head (256 → 10) and a box head (256 → 4 → sigmoid); the 500-canvas accuracy .62 and mean IoU .91 are a CPU probe of the same checkpoint.`,
    badge: "real champion boxes",
    render: ({ theme, still, keys }) => <DetectionDiagram theme={theme} still={still} keys={keys} />,
    card: { view: DETECT_CARD_VIEW, render: ({ theme }) => <DetectionCard theme={theme} />, caption: `IoU ${fmt(DET_IOU[HERO])}, says ${DET_PRED[HERO]}` },
  },
  sam: {
    view: DETECT_VIEW,
    title: "sam — a click picks which mask to draw; prompt and image attend both ways",
    truth: "Exact, computed here: two real MNIST digits composited by max (placement hand-picked), the click points, the target masks and their IoUs, drawn on the structure of models/sam/model.py (3-conv encoder to 14×14×64 tokens, Fourier + type prompt tokens, two two-way blocks, ConvTranspose up, three mask heads and an IoU head). There is no local sam checkpoint, so the candidate masks, IoU scores, attention heat and Fourier frequencies are stand-ins, and the gate bars (eval_iou M .45, L .70) are provisional.",
    badge: "structure; targets exact",
    render: ({ theme, still }) => <SamDiagram theme={theme} still={still} />,
    card: { view: DETECT_CARD_VIEW, render: ({ theme }) => <SamCard theme={theme} />, caption: "the click picks the digit" },
  },
};
