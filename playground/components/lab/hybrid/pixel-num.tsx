"use client";

// Numbers in the chrome are drawn from a 5×7 bitmap digit set, not typed:
// at chrome sizes Pixelify Sans' 2 reads as 8 and its 5 as S (verified in a
// type specimen), and a misread "LV 2" or "2.5" bar is a data error.
import type { CSSProperties } from "react";

const GLYPHS: Record<string, string[]> = {
  "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["#####", "...#.", "..#..", "...#.", "....#", "#...#", ".###."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
  ".": ["..", "..", "..", "..", "..", "##", "##"],
  "-": ["....", "....", "....", "####", "....", "....", "...."],
};

/** Digits (and . -) as crisp pixel art; `scale` 2 = 14px tall. */
export function PixelNum({ value, scale = 2, className, style }: {
  value: string | number; scale?: number; className?: string; style?: CSSProperties;
}) {
  const text = String(value);
  const rects: { x: number; y: number; w: number }[] = [];
  let x = 0;
  for (const ch of text) {
    const g = GLYPHS[ch];
    if (!g) { x += 3; continue; }
    g.forEach((row, y) => {
      let i = 0;
      while (i < row.length) {
        if (row[i] !== "#") { i++; continue; }
        let e = i + 1;
        while (e < row.length && row[e] === "#") e++;
        rects.push({ x: x + i, y, w: e - i });
        i = e;
      }
    });
    x += g[0].length + 1;
  }
  const w = Math.max(1, x - 1);
  return (
    <svg role="img" aria-label={text} width={w * scale} height={7 * scale} viewBox={`0 0 ${w} 7`}
      shapeRendering="crispEdges" className={className}
      style={{ display: "inline-block", verticalAlign: "-1px", margin: "0 2px", ...style }}>
      {rects.map((r, i) => <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill="currentColor" />)}
    </svg>
  );
}

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
/** Small counts in running (typed) sentences are spelled out. */
export const spell = (n: number) => WORDS[n] ?? String(n);

/** A label with every number in it swapped for PixelNum. */
export function NumText({ text, scale = 2 }: { text: string; scale?: number }) {
  const parts = text.split(/(-?\d+(?:\.\d+)?)/);
  return (
    <>
      {parts.map((p, i) => (i % 2 ? <PixelNum key={i} value={p} scale={scale} /> : p ? <span key={i}>{p}</span> : null))}
    </>
  );
}
