"use client";

// The sky's gentle motion: a few field stars scintillate and, now and then, a
// meteor crosses the plate. Stepped like the pixel world (≤ 12 fps, a flip-book,
// never a glide). Frame 0 is the canonical still: under ?still=1 and
// prefers-reduced-motion the layer renders frame 0 only (no meteor, base
// opacities). Decoration only — encodes no data (see encoding.ts).
import { memo, useEffect, useState } from "react";

const FPS = 10;           // under the map's 12-fps ceiling
const LOOP = FPS * 60;    // a one-minute loop
const METEOR_EVERY = FPS * 14, METEOR_FRAMES = 9;

/** A frame counter at ≤ 12 fps, frozen at 0 when still / reduced motion / hidden tab. */
function useSkyTick(still: boolean): number {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (still || typeof window === "undefined") return;
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null;
    let raf = 0, last = performance.now(), acc = 0;
    const period = 1000 / FPS;
    const loop = (now: number) => {
      acc += now - last; last = now;
      if (acc >= period) { const k = Math.floor(acc / period); acc -= k * period; setFrame((f) => (f + k) % LOOP); }
      raf = requestAnimationFrame(loop);
    };
    const start = () => { last = performance.now(); acc = 0; raf = requestAnimationFrame(loop); };
    const stop = () => cancelAnimationFrame(raf);
    const onVis = () => { stop(); if (!document.hidden && !mq?.matches) start(); };
    const onMq = () => { if (mq?.matches) { stop(); setFrame(0); } else start(); };
    if (!mq?.matches) start();
    document.addEventListener("visibilitychange", onVis);
    mq?.addEventListener?.("change", onMq);
    return () => { stop(); document.removeEventListener("visibilitychange", onVis); mq?.removeEventListener?.("change", onMq); };
  }, [still]);
  return still ? 0 : frame;
}

export interface TwinkleStar { x: number; y: number; r: number; a: number }

/** Deterministic hash → [0,1). */
const h = (i: number) => { let s = (i + 1) * 2654435761; s ^= s >>> 15; s = Math.imul(s, 2246822519); s ^= s >>> 13; return ((s >>> 0) % 10000) / 10000; };

export const SkyLife = memo(function SkyLife({ stars, box, S, color, still }: {
  /** world-px field stars chosen to scintillate */
  stars: TwinkleStar[];
  /** the painted sky box (meteors cross it) */
  box: { x: number; y: number; w: number; h: number };
  S: number; color: string; still: boolean;
}) {
  const frame = useSkyTick(still);
  // scintillation: each star has its own slow period (3–7 s) and phase, quantized to 4 levels
  const tw = stars.map((s, i) => {
    if (frame === 0) return s.a;
    const period = FPS * (3 + h(i) * 4);
    const k = Math.round(((Math.sin(((frame / period) + h(i + 99)) * Math.PI * 2) + 1) / 2) * 3) / 3;
    return s.a * (0.35 + 0.65 * k);
  });
  // a meteor every 14 s, on a deterministic path per pass; never at frame 0
  const pass = Math.floor(frame / METEOR_EVERY), local = frame % METEOR_EVERY;
  const meteor = frame > 0 && local < METEOR_FRAMES ? (() => {
    const sx = box.x + box.w * (0.2 + h(pass * 3) * 0.6), sy = box.y + box.h * (0.18 + h(pass * 3 + 1) * 0.3);
    const ang = (Math.PI / 180) * (20 + h(pass * 3 + 2) * 25);
    const step = 34 / S; // ~34 screen px per frame
    const head = { x: sx + Math.cos(ang) * step * local, y: sy + Math.sin(ang) * step * local };
    const tail = { x: head.x - Math.cos(ang) * step * Math.min(local + 1, 4), y: head.y - Math.sin(ang) * step * Math.min(local + 1, 4) };
    const fade = local > METEOR_FRAMES - 3 ? (METEOR_FRAMES - local) / 3 : 1;
    return { head, tail, fade };
  })() : null;
  return (
    <g pointerEvents="none" data-sky-life={frame}>
      {stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r / Math.sqrt(S)} fill={color} opacity={tw[i]} />)}
      {meteor && (
        <g opacity={meteor.fade}>
          <line x1={meteor.tail.x} y1={meteor.tail.y} x2={meteor.head.x} y2={meteor.head.y} stroke="url(#sky-meteor)" strokeWidth={1.6 / S} strokeLinecap="round" />
          <circle cx={meteor.head.x} cy={meteor.head.y} r={1.4 / S} fill={color} />
        </g>
      )}
    </g>
  );
});
