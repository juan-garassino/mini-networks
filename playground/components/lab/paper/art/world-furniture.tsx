// Storybook map furniture: the title cartouche, family signboards with a
// subtitle line, model tags, a compass rose and a scale bar. Parchment card,
// ink frame, the storybook serif (STORY_FONT). These draw in the parent's
// units, anchored at their CENTRE (x, y) unless noted.
import { memo } from "react";
import { SoftShadow } from "./materials";
import { INK, S, HI, LIT, MID, SHADE, DEEP } from "./palette";
import { poly, rect, rng } from "./geom";
import { STORY_FONT } from "./storyfont";

/** Our six lands with their taxonomy line (sign subtitles). */
export const FAMILY_SIGN: Record<string, { title: string; subtitle: string }> = {
  perception: { title: "Perception", subtitle: "From raw data to understanding" },
  representation: { title: "Representation", subtitle: "Learning useful representations" },
  structure: { title: "Structure", subtitle: "Learning from graphs and scenes" },
  sequence: { title: "Sequence", subtitle: "Modelling order and time" },
  decision: { title: "Decision", subtitle: "Learning to act and choose" },
  generative: { title: "Generative", subtitle: "Creating new data and worlds" },
};

/** Serif text width estimate (no DOM measuring). */
const serifW = (s: string, fs: number) => [...s].reduce((w, c) => w + (c === " " ? 0.26 : /[mwMW]/.test(c) ? 0.82 : /[il.,'’]/.test(c) ? 0.28 : /[A-Z]/.test(c) ? 0.66 : 0.5), 0) * fs;

/** A torn parchment edge around a rect (deterministic wobble). */
function tornRect(x: number, y: number, w: number, h: number, seed: number, amp = 1.6) {
  const r = rng(seed);
  const pts: number[] = [];
  const run = (x0: number, y0: number, x1: number, y1: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const t = i / n, j = (r() - 0.5) * amp * 2;
      const nx = y1 - y0 ? 1 : 0, ny = x1 - x0 ? 1 : 0;
      pts.push(x0 + (x1 - x0) * t + nx * j, y0 + (y1 - y0) * t + ny * j);
    }
  };
  const nx = Math.max(6, Math.round(w / 9)), ny = Math.max(3, Math.round(h / 9));
  run(x, y, x + w, y, nx); run(x + w, y, x + w, y + h, ny); run(x + w, y + h, x, y + h, nx); run(x, y + h, x, y, ny);
  return poly(...pts);
}

/** The map's title cartouche: burnt-edged parchment, double ink frame, a big serif title. */
export const TitleCartouche = memo(function TitleCartouche({ x = 0, y = 0, title = "The Model Zoo", lines = ["Neural networks across six lands.", "Explore, connect and see how they relate."], w }: {
  x?: number; y?: number; title?: string; lines?: string[]; w?: number;
}) {
  const fs = 30, ls = 13;
  const W = w ?? Math.max(serifW(title, fs), ...lines.map((l) => serifW(l, ls))) + 44;
  const H = 30 + fs + lines.length * (ls * 1.35) + 8;
  const x0 = x - W / 2, y0 = y - H / 2;
  const edge = tornRect(x0, y0, W, H, 3, 2);
  return (
    <g pointerEvents="none">
      <SoftShadow d={edge} transform="translate(5 7)" spread={3} />
      <path d={edge} fill="url(#pa-parch)" stroke="#6A4127" strokeWidth={2.4} strokeLinejoin="round" />
      <path d={edge} fill="none" stroke="#2A1B14" strokeOpacity={0.35} strokeWidth={6} strokeLinejoin="round" style={{ mixBlendMode: "multiply" }} />
      <path d={rect(x0 + 8, y0 + 8, W - 16, H - 16)} fill="none" stroke={INK} strokeWidth={1.4} />
      <path d={rect(x0 + 11, y0 + 11, W - 22, H - 22)} fill="none" stroke={INK} strokeOpacity={0.5} strokeWidth={0.7} />
      {[[x0 + 8, y0 + 8], [x0 + W - 8, y0 + 8], [x0 + 8, y0 + H - 8], [x0 + W - 8, y0 + H - 8]].map(([cx, cy], i) => (
        <path key={i} d={poly(cx - 4, cy, cx, cy - 4, cx + 4, cy, cx, cy + 4)} fill={S.autumn[MID]} stroke={INK} strokeWidth={0.8} />
      ))}
      <text x={x0 + 22} y={y0 + 20 + fs * 0.82} fontSize={fs} fontWeight={800} fill={INK} style={{ fontFamily: STORY_FONT }}>{title}</text>
      {lines.map((l, i) => (
        <text key={i} x={x0 + 22} y={y0 + 26 + fs + (i + 0.8) * ls * 1.35} fontSize={ls} fontWeight={500} fill={INK} style={{ fontFamily: STORY_FONT }}>{l}</text>
      ))}
    </g>
  );
});

/** A family signboard: parchment, ink frame, serif title + a subtitle line. */
export const FamilySign = memo(function FamilySign({ x = 0, y = 0, family, title, subtitle, scale = 1 }: {
  x?: number; y?: number; family?: string; title?: string; subtitle?: string; scale?: number;
}) {
  const t = title ?? FAMILY_SIGN[family ?? ""]?.title ?? family ?? "";
  const sub = subtitle ?? FAMILY_SIGN[family ?? ""]?.subtitle ?? "";
  const fs = 20, ss = 11;
  const W = Math.max(serifW(t, fs), serifW(sub, ss)) + 30, H = sub ? 50 : 34;
  const edge = tornRect(-W / 2, -H / 2, W, H, t.length * 7 + 1, 1.2);
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} pointerEvents="none">
      <SoftShadow d={edge} transform="translate(3 5)" spread={2} />
      <path d={edge} fill={S.parch[MID]} transform="translate(1.4 2.4)" />
      <path d={edge} fill="url(#pa-parch)" stroke="#6A4127" strokeWidth={1.8} strokeLinejoin="round" />
      <path d={rect(-W / 2 + 5, -H / 2 + 5, W - 10, H - 10)} fill="none" stroke={INK} strokeOpacity={0.6} strokeWidth={0.8} />
      <text x={0} y={sub ? -3 : 7} textAnchor="middle" fontSize={fs} fontWeight={800} fill={INK} style={{ fontFamily: STORY_FONT }}>{t}</text>
      {sub && <text x={0} y={15} textAnchor="middle" fontSize={ss} fontWeight={500} fill={INK} style={{ fontFamily: STORY_FONT }}>{sub}</text>}
    </g>
  );
});

/** A small model name tag (the map's per-model label). */
export const ModelTag = memo(function ModelTag({ x = 0, y = 0, text }: { x?: number; y?: number; text: string }) {
  const fs = 12, W = serifW(text, fs) + 16, H = 21;
  return (
    <g transform={`translate(${x} ${y})`} pointerEvents="none">
      <path d={rect(-W / 2 + 1.6, -H / 2 + 2.4, W, H)} fill="#2A1B14" opacity={0.25} />
      <path d={rect(-W / 2, -H / 2, W, H)} fill="url(#pa-parch)" stroke="#6A4127" strokeWidth={1.2} />
      <text x={0} y={4.4} textAnchor="middle" fontSize={fs} fontWeight={700} fill={INK} style={{ fontFamily: STORY_FONT }}>{text}</text>
    </g>
  );
});

/** An 8-point compass rose with N/E/S/W. `r` = radius of the long points. */
export const CompassRose = memo(function CompassRose({ x = 0, y = 0, r = 34 }: { x?: number; y?: number; r?: number }) {
  const pt = (a: number, len: number, w: number, half: 0 | 1) => {
    const c = Math.cos(a), s = Math.sin(a), nc = Math.cos(a + (half ? Math.PI / 2 : -Math.PI / 2)), ns = Math.sin(a + (half ? Math.PI / 2 : -Math.PI / 2));
    return poly(0, 0, c * len, s * len, nc * w, ns * w);
  };
  const dirs = [0, 1, 2, 3].map((k) => -Math.PI / 2 + (k * Math.PI) / 2);
  const diag = dirs.map((a) => a + Math.PI / 4);
  const letters: [string, number, number][] = [["N", 0, -r - 10], ["E", r + 10, 4], ["S", 0, r + 16], ["W", -r - 10, 4]];
  return (
    <g transform={`translate(${x} ${y})`} pointerEvents="none">
      <circle r={r * 0.62} fill="none" stroke={INK} strokeWidth={1.2} />
      <circle r={r * 0.56} fill={S.parch[LIT]} opacity={0.6} stroke={INK} strokeOpacity={0.6} strokeWidth={0.6} />
      {diag.map((a, i) => <g key={`d${i}`}><path d={pt(a, r * 0.7, r * 0.12, 0)} fill={S.wood[SHADE]} stroke={INK} strokeWidth={0.7} /><path d={pt(a, r * 0.7, r * 0.12, 1)} fill={S.parch[HI]} stroke={INK} strokeWidth={0.7} /></g>)}
      {dirs.map((a, i) => <g key={`m${i}`}><path d={pt(a, r, r * 0.17, 0)} fill={i === 0 ? S.roofRed[MID] : S.wood[DEEP]} stroke={INK} strokeWidth={0.8} /><path d={pt(a, r, r * 0.17, 1)} fill={i === 0 ? S.roofRed[HI] : S.autumn[HI]} stroke={INK} strokeWidth={0.8} /></g>)}
      <circle r={r * 0.1} fill={S.autumn[MID]} stroke={INK} strokeWidth={0.8} />
      {letters.map(([l, lx, ly]) => <text key={l} x={lx} y={ly} textAnchor="middle" fontSize={r * 0.42} fontWeight={800} fill={INK} style={{ fontFamily: STORY_FONT }}>{l}</text>)}
    </g>
  );
});

/** A scale bar with alternating segments and a label (e.g. "22 pipelines"). (x, y) = left end. */
export const ScaleBar = memo(function ScaleBar({ x = 0, y = 0, w = 120, segments = 4, label = "22 pipelines" }: { x?: number; y?: number; w?: number; segments?: number; label?: string }) {
  const sw = w / segments;
  return (
    <g transform={`translate(${x} ${y})`} pointerEvents="none">
      {Array.from({ length: segments }, (_, i) => <rect key={i} x={i * sw} y={-3} width={sw} height={6} fill={i % 2 ? S.parch[HI] : INK} stroke={INK} strokeWidth={0.8} />)}
      {Array.from({ length: segments + 1 }, (_, i) => <path key={`t${i}`} d={`M${i * sw} -8 V3`} stroke={INK} strokeWidth={1} />)}
      <text x={0} y={20} fontSize={13} fontWeight={700} fill={INK} style={{ fontFamily: STORY_FONT }}>{label}</text>
    </g>
  );
});

