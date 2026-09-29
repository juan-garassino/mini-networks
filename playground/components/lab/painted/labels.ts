// Greedy tag placement for the 44 model tags over the painting, in image px
// for the current camera scale (tags keep a steady SCREEN size, so the image
// footprint shrinks as you zoom in and the layout is recomputed per level).
// Candidates: 8 compass slots next to the marker, then the same slots pushed
// further out (drawn with a short leader). Score = overlap with placed tags,
// markers and fixed plates; lowest wins, earlier (louder) tags choose first.
import type { Box, Pt } from "./anchors";

export interface TagSpec { name: string; text: string; at: Pt; w: number; h: number; priority: number }
export interface PlacedTag { name: string; text: string; box: Box; leader: boolean; at: Pt }

const overlapArea = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

export function placeTags(specs: TagSpec[], opts: {
  markerR: number;
  obstacles: Box[];
  bounds: Box;
}): PlacedTag[] {
  const { markerR, obstacles, bounds } = opts;
  const placed: PlacedTag[] = [];
  const markers: Box[] = specs.map((s) => ({ x: s.at.x - markerR, y: s.at.y - markerR, w: markerR * 2, h: markerR * 2 }));
  const order = [...specs].sort((a, b) => b.priority - a.priority);
  for (const s of order) {
    const g = markerR + Math.max(2, s.h * 0.12);
    const slots: [number, number][] = [
      [0, g + s.h / 2], [g + s.w / 2, 0], [-(g + s.w / 2), 0], [0, -(g + s.h / 2)],
      [g * 0.7 + s.w / 2, g * 0.7 + s.h / 2], [-(g * 0.7 + s.w / 2), g * 0.7 + s.h / 2],
      [g * 0.7 + s.w / 2, -(g * 0.7 + s.h / 2)], [-(g * 0.7 + s.w / 2), -(g * 0.7 + s.h / 2)],
    ];
    let best: { box: Box; score: number; leader: boolean } | null = null;
    for (const [tier, push] of [[0, 1], [1, 1.9], [2, 2.8]] as const) {
      for (const [i, [dx, dy]] of slots.entries()) {
        const px = dx === 0 ? 0 : Math.sign(dx) * (Math.abs(dx) + (push - 1) * s.h * 1.2);
        const py = dy === 0 ? 0 : Math.sign(dy) * (Math.abs(dy) + (push - 1) * s.h * 1.2);
        const box = { x: s.at.x + px - s.w / 2, y: s.at.y + py - s.h / 2, w: s.w, h: s.h };
        let score = tier * 40 + i * 2;
        if (box.x < bounds.x || box.y < bounds.y || box.x + box.w > bounds.x + bounds.w || box.y + box.h > bounds.y + bounds.h) score += 1e6;
        for (const p of placed) score += overlapArea(box, p.box) * 8;
        for (const [mi, m] of markers.entries()) if (specs[mi] !== s) score += overlapArea(box, m) * 12;
        for (const o of obstacles) score += overlapArea(box, o) * 4;
        if (!best || score < best.score) best = { box, score, leader: tier > 0 };
      }
      if (best && best.score < 60) break; // clean slot found at this tier
    }
    placed.push({ name: s.name, text: s.text, box: best!.box, leader: best!.leader, at: s.at });
  }
  return placed;
}

/** Rough advance width of a string in a given font family, per px of size. */
export function textWidth(text: string, px: number, family: "pixel" | "paper"): number {
  // Pixelify Sans is near-monospaced at ~0.58em; Alegreya SC averages ~0.62em.
  const em = family === "pixel" ? 0.58 : 0.6;
  let w = 0;
  for (const ch of text) w += ch === " " ? 0.35 : /[ilj.,']/.test(ch) ? 0.34 : /[mwMW]/.test(ch) ? 0.9 : em;
  return w * px;
}
