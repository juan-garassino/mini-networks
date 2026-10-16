"use client";

// Tensor packets riding the lit lineage: when a model is selected, one rounded
// square per ancestor edge leaves its parent's out-port and follows the routed
// line into the child — roots first, one generation after another — so the data
// visibly flows down the family line into the selection. Tinted by the family it
// leaves. Positions are written to the DOM per frame (no React re-render); under
// ?still=1 / reduced motion the packets hold frame 0 (each at its route's start).
import { useEffect, useMemo, useRef } from "react";
import type { Pt } from "@/lib/world";
import { COLOR, MOTION } from "./tokens";

export interface PacketRoute { id: string; points: Pt[]; color: string; hop: number }

const HOP_MS = MOTION.packetHop;
const REST_MS = MOTION.packetRest;

function sampler(pts: Pt[]) {
  const seg: number[] = [0];
  for (let i = 1; i < pts.length; i++) seg.push(seg[i - 1] + Math.abs(pts[i].x - pts[i - 1].x) + Math.abs(pts[i].y - pts[i - 1].y));
  const L = seg[seg.length - 1] || 1;
  return (t: number): Pt => {
    const d = Math.max(0, Math.min(1, t)) * L;
    let i = 1;
    while (i < seg.length - 1 && seg[i] < d) i++;
    const a = pts[i - 1], b = pts[i], k = (d - seg[i - 1]) / ((seg[i] - seg[i - 1]) || 1);
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
  };
}

export function Packets({ routes, frozen, runKey, size = 7 }: { routes: PacketRoute[]; frozen: boolean; runKey: string; size?: number }) {
  const refs = useRef<(SVGRectElement | null)[]>([]);
  const fns = useMemo(() => routes.map((r) => sampler(r.points)), [routes]);
  const H = Math.max(0, ...routes.map((r) => r.hop));
  const cycle = (H + 1) * HOP_MS + REST_MS;
  useEffect(() => {
    if (frozen || !routes.length) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = (now - t0) % cycle;
      routes.forEach((r, i) => {
        const el = refs.current[i];
        if (!el) return;
        const local = (t - (H - r.hop) * HOP_MS) / HOP_MS;
        const on = local >= 0 && local <= 1;
        el.style.opacity = on ? "1" : "0";
        if (on) {
          const p = fns[i](local < 0.5 ? 2 * local * local : 1 - Math.pow(-2 * local + 2, 2) / 2);
          el.setAttribute("x", String(p.x - size / 2));
          el.setAttribute("y", String(p.y - size / 2));
        }
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [routes, fns, frozen, cycle, H, size, runKey]);
  return (
    <g pointerEvents="none" aria-hidden>
      {routes.map((r, i) => {
        const p0 = r.points[0];
        // frame 0: the first generation's packets sit at their out-ports, the rest wait
        const visible = r.hop === H;
        return (
          <rect key={`${runKey}:${r.id}`} ref={(el) => { refs.current[i] = el; }} x={p0.x - size / 2} y={p0.y - size / 2} width={size} height={size} rx={2}
            fill={r.color} stroke={COLOR.card} strokeWidth={1.2} style={{ opacity: visible ? 1 : 0 }} />
        );
      })}
    </g>
  );
}
