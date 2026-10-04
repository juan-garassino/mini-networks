// A tiny bitmap font for the anatomy diagrams, drawn as SVG path data so
// every label is crisp at integer scale (no font loading, no anti-aliasing).
//
// Main face: 5×7 cap height, lowercase with 2-row descenders (rows 7–8).
// Mini face: 3×5, used for subscripts — write `x_{t-1}` or `x_0`.
// Specials: "ε" epsilon · "Ɛ" epsilon-hat (ε̂, the network's prediction) ·
// "ᾱ" alpha-bar · "√" radical · "→ ← ↑ ↓" arrows · "·" dot · "×" times.
// Numerals copy components/lab/pixel/pixel-num.tsx so data reads the same.

type Glyph = string[];

const G: Record<string, Glyph> = {
  "0": [".xxx.", "x...x", "x..xx", "x.x.x", "xx..x", "x...x", ".xxx."],
  "1": ["..x..", ".xx..", "..x..", "..x..", "..x..", "..x..", ".xxx."],
  "2": [".xxx.", "x...x", "....x", "...x.", "..x..", ".x...", "xxxxx"],
  "3": ["xxxxx", "...x.", "..x..", "...x.", "....x", "x...x", ".xxx."],
  "4": ["...x.", "..xx.", ".x.x.", "x..x.", "xxxxx", "...x.", "...x."],
  "5": ["xxxxx", "x....", "xxxx.", "....x", "....x", "x...x", ".xxx."],
  "6": ["..xx.", ".x...", "x....", "xxxx.", "x...x", "x...x", ".xxx."],
  "7": ["xxxxx", "....x", "...x.", "..x..", ".x...", ".x...", ".x..."],
  "8": [".xxx.", "x...x", "x...x", ".xxx.", "x...x", "x...x", ".xxx."],
  "9": [".xxx.", "x...x", "x...x", ".xxxx", "....x", "...x.", ".xx.."],
  A: [".xxx.", "x...x", "x...x", "xxxxx", "x...x", "x...x", "x...x"],
  B: ["xxxx.", "x...x", "x...x", "xxxx.", "x...x", "x...x", "xxxx."],
  C: [".xxx.", "x...x", "x....", "x....", "x....", "x...x", ".xxx."],
  D: ["xxxx.", "x...x", "x...x", "x...x", "x...x", "x...x", "xxxx."],
  E: ["xxxxx", "x....", "x....", "xxxx.", "x....", "x....", "xxxxx"],
  F: ["xxxxx", "x....", "x....", "xxxx.", "x....", "x....", "x...."],
  G: [".xxx.", "x...x", "x....", "x.xxx", "x...x", "x...x", ".xxxx"],
  H: ["x...x", "x...x", "x...x", "xxxxx", "x...x", "x...x", "x...x"],
  I: ["xxx", ".x.", ".x.", ".x.", ".x.", ".x.", "xxx"],
  J: ["..xxx", "...x.", "...x.", "...x.", "...x.", "x..x.", ".xx.."],
  K: ["x...x", "x..x.", "x.x..", "xx...", "x.x..", "x..x.", "x...x"],
  L: ["x....", "x....", "x....", "x....", "x....", "x....", "xxxxx"],
  M: ["x...x", "xx.xx", "x.x.x", "x.x.x", "x...x", "x...x", "x...x"],
  N: ["x...x", "x...x", "xx..x", "x.x.x", "x..xx", "x...x", "x...x"],
  O: [".xxx.", "x...x", "x...x", "x...x", "x...x", "x...x", ".xxx."],
  P: ["xxxx.", "x...x", "x...x", "xxxx.", "x....", "x....", "x...."],
  Q: [".xxx.", "x...x", "x...x", "x...x", "x.x.x", "x..x.", ".xx.x"],
  R: ["xxxx.", "x...x", "x...x", "xxxx.", "x.x..", "x..x.", "x...x"],
  S: [".xxxx", "x....", "x....", ".xxx.", "....x", "....x", "xxxx."],
  T: ["xxxxx", "..x..", "..x..", "..x..", "..x..", "..x..", "..x.."],
  U: ["x...x", "x...x", "x...x", "x...x", "x...x", "x...x", ".xxx."],
  V: ["x...x", "x...x", "x...x", "x...x", "x...x", ".x.x.", "..x.."],
  W: ["x...x", "x...x", "x...x", "x.x.x", "x.x.x", "x.x.x", ".x.x."],
  X: ["x...x", "x...x", ".x.x.", "..x..", ".x.x.", "x...x", "x...x"],
  Y: ["x...x", "x...x", ".x.x.", "..x..", "..x..", "..x..", "..x.."],
  Z: ["xxxxx", "....x", "...x.", "..x..", ".x...", "x....", "xxxxx"],
  a: ["....", "....", ".xx.", "...x", ".xxx", "x..x", ".xxx"],
  b: ["x...", "x...", "xxx.", "x..x", "x..x", "x..x", "xxx."],
  c: ["....", "....", ".xx.", "x...", "x...", "x...", ".xx."],
  d: ["...x", "...x", ".xxx", "x..x", "x..x", "x..x", ".xxx"],
  e: ["....", "....", ".xx.", "x..x", "xxxx", "x...", ".xx."],
  f: ["..x", ".x.", "xxx", ".x.", ".x.", ".x.", ".x."],
  g: ["....", "....", ".xxx", "x..x", "x..x", "x..x", ".xxx", "...x", ".xx."],
  h: ["x...", "x...", "xxx.", "x..x", "x..x", "x..x", "x..x"],
  i: [".x", "..", "xx", ".x", ".x", ".x", ".x"],
  j: ["..x", "...", ".xx", "..x", "..x", "..x", "..x", "..x", "xx."],
  k: ["x...", "x...", "x..x", "x.x.", "xx..", "x.x.", "x..x"],
  l: ["xx", ".x", ".x", ".x", ".x", ".x", ".x"],
  m: [".....", ".....", "xx.x.", "x.x.x", "x.x.x", "x.x.x", "x.x.x"],
  n: ["....", "....", "xxx.", "x..x", "x..x", "x..x", "x..x"],
  o: ["....", "....", ".xx.", "x..x", "x..x", "x..x", ".xx."],
  p: ["....", "....", "xxx.", "x..x", "x..x", "x..x", "xxx.", "x...", "x..."],
  q: ["....", "....", ".xxx", "x..x", "x..x", "x..x", ".xxx", "...x", "...x"],
  r: ["...", "...", "x.x", "xx.", "x..", "x..", "x.."],
  s: ["....", "....", ".xxx", "x...", ".xx.", "...x", "xxx."],
  t: [".x.", ".x.", "xxx", ".x.", ".x.", ".x.", "..x"],
  u: ["....", "....", "x..x", "x..x", "x..x", "x..x", ".xxx"],
  v: ["...", "...", "x.x", "x.x", "x.x", "x.x", ".x."],
  w: [".....", ".....", "x...x", "x...x", "x.x.x", "x.x.x", ".x.x."],
  x: ["...", "...", "x.x", "x.x", ".x.", "x.x", "x.x"],
  y: ["....", "....", "x..x", "x..x", "x..x", "x..x", ".xxx", "...x", ".xx."],
  z: ["....", "....", "xxxx", "...x", "..x.", ".x..", "xxxx"],
  " ": ["...", "...", "...", "...", "...", "...", "..."],
  ".": [".", ".", ".", ".", ".", ".", "x"],
  ",": ["..", "..", "..", "..", "..", ".x", ".x", "x."],
  ":": [".", ".", "x", ".", ".", "x", "."],
  ";": ["..", "..", ".x", "..", "..", ".x", ".x", "x."],
  "'": ["x", "x", ".", ".", ".", ".", "."],
  "!": ["x", "x", "x", "x", "x", ".", "x"],
  "?": [".xxx.", "x...x", "....x", "...x.", "..x..", ".....", "..x.."],
  "-": ["...", "...", "...", "xxx", "...", "...", "..."],
  "−": ["....", "....", "....", "xxxx", "....", "....", "...."],
  "+": [".....", "..x..", "..x..", "xxxxx", "..x..", "..x..", "....."],
  "=": ["....", "....", "xxxx", "....", "xxxx", "....", "...."],
  "×": [".....", ".....", "x...x", ".x.x.", "..x..", ".x.x.", "x...x"],
  "·": [".", ".", ".", "x", ".", ".", "."],
  "(": [".x", "x.", "x.", "x.", "x.", "x.", ".x"],
  ")": ["x.", ".x", ".x", ".x", ".x", ".x", "x."],
  "[": ["xx", "x.", "x.", "x.", "x.", "x.", "xx"],
  "]": ["xx", ".x", ".x", ".x", ".x", ".x", "xx"],
  "/": ["....x", "....x", "...x.", "..x..", ".x...", "x....", "x...."],
  "_": ["....", "....", "....", "....", "....", "....", "xxxx"],
  "%": ["xx..x", "xx..x", "...x.", "..x..", ".x...", "x..xx", "x..xx"],
  "~": [".....", ".....", ".x...", "x.x.x", "...x.", ".....", "....."],
  "|": ["x", "x", "x", "x", "x", "x", "x"],
  "<": ["...x", "..x.", ".x..", "x...", ".x..", "..x.", "...x"],
  ">": ["x...", ".x..", "..x.", "...x", "..x.", ".x..", "x..."],
  "→": ["......", "...x..", "....x.", "xxxxxx", "....x.", "...x..", "......"],
  "←": ["......", "..x...", ".x....", "xxxxxx", ".x....", "..x...", "......"],
  "↑": ["..x..", ".xxx.", "x.x.x", "..x..", "..x..", "..x..", "..x.."],
  "↓": ["..x..", "..x..", "..x..", "..x..", "x.x.x", ".xxx.", "..x.."],
  "√": ["...xxx", "...x..", "...x..", "...x..", "x.x...", ".xx...", "..x..."],
  "ε": ["....", "....", ".xxx", "x...", ".xx.", "x...", ".xxx"],
  "Ɛ": [".x..", "x.x.", ".xxx", "x...", ".xx.", "x...", ".xxx"],
  "α": [".....", ".....", ".xx.x", "x..x.", "x..x.", "x..x.", ".xx.x"],
  "ᾱ": ["xxxxx", ".....", ".xx.x", "x..x.", "x..x.", "x..x.", ".xx.x"],
  "β": [".xx.", "x..x", "x.x.", "x..x", "x..x", "xxx.", "x...", "x..."],
  "μ": ["....", "....", "x..x", "x..x", "x..x", "xxx.", "x...", "x..."],
  "σ": [".....", ".....", ".xxxx", "x..x.", "x..x.", "x..x.", ".xx.."],
  "θ": [".xx.", "x..x", "x..x", "xxxx", "x..x", "x..x", ".xx."],
  "⊕": [".xxx.", "x.x.x", "x.x.x", "xxxxx", "x.x.x", "x.x.x", ".xxx."],
  "∇": ["xxxxx", "x...x", "x...x", ".x.x.", ".x.x.", "..x..", "..x.."],
  "π": [".....", ".....", "xxxxx", ".x.x.", ".x.x.", ".x.x.", ".x..x"],
  "γ": [".....", ".....", "x...x", ".x.x.", "..x..", "..x..", ".x...", ".x..."],
  "′": ["x", "x", ".", ".", ".", ".", "."],
  "Â": ["..x..", ".x.x.", ".xxx.", "x...x", "xxxxx", "x...x", "x...x"],
  "½": ["x...", "x...", "x...", "..xx", "...x", "..x.", "..xx"],
  "÷": [".....", "..x..", ".....", "xxxxx", ".....", "..x..", "....."],
  "⁻": ["xx", "..", "..", "..", "..", "..", ".."],
  "¹": [".x", "xx", ".x", ".x", "..", "..", ".."],
  "ᵏ": ["x..", "x.x", "xx.", "x.x", "...", "...", "..."],
  "Σ": ["xxxxx", "x....", ".x...", "..x..", ".x...", "x....", "xxxxx"],
  "^": ["..x..", ".x.x.", "x...x", ".....", ".....", ".....", "....."],
  "#": [".x.x.", ".x.x.", "xxxxx", ".x.x.", "xxxxx", ".x.x.", ".x.x."],
  "²": ["xx.", "..x", ".x.", "xxx", "...", "...", "..."],
  "↵": ["....x", "....x", ".x..x", "xxxxx", ".x...", ".....", "....."],
  "✓": [".....", "....x", "....x", "...x.", "x.x..", ".x...", "....."],
  // alignment group (rlhf / grpo / dpo): ratio, chosen⁺ / rejected⁻, bounds
  // ρ: a ROUND bowl (p's is square) whose stem hooks back right at the foot, so it never reads as p
  "ρ": ["....", "....", ".xx.", "x..x", "x..x", "x..x", "xxx.", "x...", ".xxx"],
  "⁺": [".x.", "xxx", ".x.", "...", "...", "...", "..."],
  "▲": [".....", "..x..", "..x..", ".xxx.", ".xxx.", "xxxxx", "....."],
  "▼": [".....", "xxxxx", ".xxx.", ".xxx.", "..x..", "..x..", "....."],
  "≥": ["x...", ".x..", "..x.", ".x..", "x...", "....", "xxxx"],
  "≤": ["...x", "..x.", ".x..", "..x.", "...x", "....", "xxxx"],
  // adapt group (lora): the low-rank update ΔW
  "Δ": ["..x..", "..x..", ".x.x.", ".x.x.", "x...x", "x...x", "xxxxx"],
  // rpp group: the prior strengths λ_conv / λ_free
  "λ": ["xx...", "..x..", "..x..", ".x.x.", ".x.x.", "x...x", "x...x"],
};

// 3×5 mini face for subscripts (baseline-aligned with the main face's row 6).
const M: Record<string, Glyph> = {
  "0": ["xxx", "x.x", "x.x", "x.x", "xxx"],
  "1": [".x.", "xx.", ".x.", ".x.", "xxx"],
  "2": ["xx.", "..x", ".x.", "x..", "xxx"],
  "3": ["xx.", "..x", ".x.", "..x", "xx."],
  "4": ["x.x", "x.x", "xxx", "..x", "..x"],
  "5": ["xxx", "x..", "xx.", "..x", "xx."],
  "6": [".xx", "x..", "xxx", "x.x", "xxx"],
  "7": ["xxx", "..x", ".x.", ".x.", ".x."],
  "8": ["xxx", "x.x", "xxx", "x.x", "xxx"],
  "9": ["xxx", "x.x", "xxx", "..x", "xx."],
  t: [".x.", "xxx", ".x.", ".x.", "..x"],
  T: ["xxx", ".x.", ".x.", ".x.", ".x."],
  i: ["x", ".", "x", "x", "x"],
  j: [".x", "..", ".x", ".x", "x."],
  k: ["x..", "x.x", "xx.", "x.x", "x.x"],
  q: ["xxx", "x.x", "xxx", "..x", "..x"],
  v: ["...", "x.x", "x.x", "x.x", ".x."],
  θ: ["xxx", "x.x", "xxx", "x.x", "xxx"],
  "-": ["...", "...", "xxx", "...", "..."],
  "+": ["...", ".x.", "xxx", ".x.", "..."],
  ",": ["..", "..", "..", ".x", "x."],
  ".": [".", ".", ".", ".", "x"],
  "×": ["...", "x.x", ".x.", "x.x", "..."],
  a: ["...", "xx.", "..x", "xxx", "xxx"],
  g: ["xxx", "x.x", "xxx", "..x", "xx."],
  // π_{ref}: the frozen reference policy (alignment group)
  r: ["...", "x.x", "xx.", "x..", "x.."],
  e: [".x.", "x.x", "xxx", "x..", ".xx"],
  f: [".xx", "x..", "xxx", "x..", "x.."],
};

export const FONT_H = 7;

interface Run { ch: string; mini: boolean }

function runs(text: string): Run[] {
  const out: Run[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "_" && i + 1 < text.length) {
      if (text[i + 1] === "{") {
        const end = text.indexOf("}", i + 2);
        const body = end < 0 ? text.slice(i + 2) : text.slice(i + 2, end);
        for (const c of body) out.push({ ch: c, mini: true });
        i = end < 0 ? text.length : end;
      } else {
        out.push({ ch: text[i + 1], mini: true });
        i++;
      }
      continue;
    }
    out.push({ ch, mini: false });
  }
  return out;
}

/** Width in font pixels (before scale). */
export function textWidth(text: string): number {
  let w = 0;
  for (const r of runs(text)) {
    const g = (r.mini ? M[r.ch] : G[r.ch]) ?? (r.mini ? M["-"] : G[" "]);
    w += g[0].length + 1;
  }
  return Math.max(0, w - 1);
}

/**
 * SVG path data for `text` with its top-left at (x, y), `s` units per font
 * pixel. Anchor: "start" | "middle" | "end" shifts x by the measured width.
 */
export function textPath(text: string, x: number, y: number, s = 1, anchor: "start" | "middle" | "end" = "start"): string {
  const w = textWidth(text) * s;
  let cx = anchor === "middle" ? x - Math.round(w / 2) : anchor === "end" ? x - w : x;
  let d = "";
  for (const r of runs(text)) {
    const g = (r.mini ? M[r.ch] : G[r.ch]) ?? (r.mini ? M["-"] : G[" "]);
    const oy = r.mini ? y + 4 * s : y; // mini sits with its baseline 2px below the main baseline
    g.forEach((row, gy) => {
      let runStart = -1;
      for (let gx = 0; gx <= row.length; gx++) {
        const on = row[gx] === "x";
        if (on && runStart < 0) runStart = gx;
        if (!on && runStart >= 0) {
          d += `M${cx + runStart * s} ${oy + gy * s}h${(gx - runStart) * s}v${s}h${-(gx - runStart) * s}z`;
          runStart = -1;
        }
      }
    });
    cx += (g[0].length + 1) * s;
  }
  return d;
}
