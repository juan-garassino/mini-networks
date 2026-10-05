"use client";

// The live layer over the painting, one SVG in IMAGE coordinates (viewBox
// 1536×1024) scaled with the image. Plates, signs and the cartouche are
// painted-scale (they grow with zoom, like the painter's own lettering); tags,
// markers, rings and the critter are screen-steady (sizes divided by scale).
import { memo, useId } from "react";
import { CRITTER } from "@/components/lab/shared/critter";
import { displayName, type EvidenceState } from "@/components/lab/shared/card-model";
import { IMAGE, type BakedText, type Box, type PaintedMap, type Pt } from "./anchors";
import type { PlacedTag } from "./labels";
import { FAMILY_TITLE, PAPER_TITLE, type Material } from "./material";

export interface OverlayProps {
  map: PaintedMap;
  theme: Material;
  scale: number;
  heal: boolean;                 // paper + labels=ours: cover the painter's model plates with ours
  ours: boolean;                 // draw our signs / cartouche
  tags: PlacedTag[];
  tagFont: number;               // image px
  markerR: number;               // image px
  states: Record<string, EvidenceState>;
  famCount: Record<string, number>;
  counts: { models: number; pipelines: number; champions: number; lands: number };
  selected: string | null;
  hovered: string | null;
  lineage: { from: string; to: string; pts: Pt[] }[];
  lineageSet: Set<string>;
  critter: (Pt & { dir: number; walking: boolean; hop: number }) | null;
  still: boolean;
  onSelect: (name: string) => void;
  onHover: (name: string | null) => void;
  onCritter: () => void;
  /** image boxes drawn OVER the map (the "How it works" plate + its leader): a
   * painter's plate partly under them keeps its blank cardstock (it hides the
   * old lettering) but loses its name — never a half-covered label */
  hard?: Box[];
  /** the painting's URL (paper): a half-covered plate is healed with a clone of it */
  painting?: string;
}

const d = (pts: Pt[]) => pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("");

/** One type size for every model plate (image px): the painter lettered his
 * plates at whatever size fit, so ours set one size and let the plate grow to
 * the name instead — long two-word names break onto two lines. */
const PLATE_FONT = 14;
const EM = 0.5;                                  // Alegreya's mean advance, in em

function plateLines(text: string, maxW: number): string[] {
  if (text.length * PLATE_FONT * EM <= maxW || !text.includes(" ")) return [text];
  const sp = [...text].flatMap((c, i) => (c === " " ? [i] : []));
  const mid = sp.reduce((a, b) => (Math.abs(b - text.length / 2) < Math.abs(a - text.length / 2) ? b : a));
  return [text.slice(0, mid), text.slice(mid + 1)];
}

/** Our plate laid over the painter's plate (padded so a few px of mapping
 * error never shows the old lettering): the real model name, or an honest
 * "no model yet" where the painter invented one. Acts as that model's tag.
 * Cut cardstock: a hard unblurred offset drop, a pressed inner rule. */
function PaperPlate({ b, theme, sel, hov, dim, lit, hard, heal, onSelect, onHover }: {
  b: BakedText; theme: Material; sel: boolean; hov: boolean; dim: boolean; lit: boolean; hard?: Box[]; heal?: HealSrc;
  onSelect: (n: string) => void; onHover: (n: string | null) => void;
}) {
  const pad = 4;
  const name = b.name;
  const text = name ? displayName(name) : "no model yet";
  const f = name ? PLATE_FONT : PLATE_FONT * 0.78;
  const lines = name ? plateLines(text, b.box.w * 1.15) : [text];
  const textW = Math.max(...lines.map((l) => l.length)) * f * EM;
  const lh = f * 1.12;
  // the painter's plate, padded, is the floor; a long name widens it about its centre
  const w = Math.max(b.box.w + pad * 2, textW + 16), h = Math.max(b.box.h + pad * 2, lines.length * lh + 12);
  const cx = b.box.x + b.box.w / 2, cy = b.box.y + b.box.h / 2;
  const x = cx - w / 2, y = cy - h / 2;
  const fill = sel ? theme.loud : hov ? theme.plateHi : "url(#pp-plate)";
  const cut = !sel && !lit && (hard ?? []).some((o) => x < o.x + o.w && o.x < x + w && y < o.y + o.h && o.y < y + h);
  if (cut) return heal ? <Heal box={{ x, y, w, h }} heal={heal} /> : <rect x={x} y={y} width={w} height={h} rx={3} fill="url(#pp-plate)" filter="url(#pp-grain)" aria-hidden />;
  return (
    // never dim with opacity: the painter's lettering underneath would show through
    <g className={name ? "cursor-pointer" : undefined} aria-hidden
      onClick={name ? (e) => { e.stopPropagation(); onSelect(name); } : undefined}
      onPointerEnter={name ? () => onHover(name) : undefined} onPointerLeave={name ? () => onHover(null) : undefined}>
      <rect x={x + 2.5} y={y + 3} width={w} height={h} rx={3} fill="#3a2616" opacity={0.6} />
      <rect x={x} y={y} width={w} height={h} rx={3} fill={fill} stroke={lit && !sel ? theme.ring : "#3a2616"} strokeWidth={lit && !sel ? 3 : 2} filter={sel || hov ? undefined : "url(#pp-grain)"} />
      <rect x={x + 3} y={y + 3} width={w - 6} height={h - 6} rx={2} fill="none" stroke={sel ? theme.loudInk : "#7a5a3a"} strokeWidth={0.8} opacity={0.6} />
      <text x={cx} y={cy - ((lines.length - 1) * lh) / 2 + 1} fontSize={f} fontFamily={theme.tagFont} fontWeight={name ? 700 : 400}
        fontStyle={name ? undefined : "italic"} fill={sel ? theme.loudInk : name ? theme.ink : theme.inkSoft} textAnchor="middle" dominantBaseline="central">
        {lines.map((l, i) => <tspan key={i} x={cx} dy={i ? lh : 0}>{l}</tspan>)}
      </text>
      {dim && <rect x={x} y={y} width={w} height={h} rx={3} fill="#e9dcc4" opacity={0.55} />}
    </g>
  );
}

/** What a healed patch is cloned from: the painting, and the painter's own
 * lettering boxes (a patch never clones another plate or a title). */
interface HealSrc { painting: string; baked: readonly BakedText[] }

const HEAL_PAD = 8;   // the patch overlaps the old plate by this much, feathered
/** Where to clone a patch for `box` from: the nearest same-size stretch of the
 * painting beside it that holds no lettering — below first (the painter hung
 * his plates under the buildings, so below is ground or water), then left,
 * right, above. Image px offset, or null. Exported for tests. */
export function healSource(box: Box, baked: readonly { box: Box }[], img: { w: number; h: number }): { dx: number; dy: number } | null {
  const p = HEAL_PAD + 4;
  const steps = [[0, 1], [-1, 0], [1, 0], [0, -1], [-1, 1], [1, 1]] as const;
  for (const reach of [1, 1.6]) for (const [sx, sy] of steps) {
    const dx = sx * (box.w + p) * reach, dy = sy * (box.h + p) * reach;
    const src = { x: box.x + dx - p, y: box.y + dy - p, w: box.w + 2 * p, h: box.h + 2 * p };
    if (src.x < 0 || src.y < 0 || src.x + src.w > img.w || src.y + src.h > img.h) continue;
    if (baked.some((t) => src.x < t.box.x + t.box.w && t.box.x < src.x + src.w && src.y < t.box.y + t.box.h && t.box.y < src.y + src.h)) continue;
    return { dx, dy };
  }
  return null;
}

/** A painter's plate the map plate (or a corner plate) half covers: rather
 * than a blank card that reads as an empty sign, the plate is painted out —
 * a feathered patch of the painting beside it is cloned over it (a restorer's
 * clone stamp), softened a touch so the seam melts into the brushwork. */
function Heal({ box, heal }: { box: Box; heal: HealSrc }) {
  const id = useId().replace(/:/g, "");
  const src = healSource(box, heal.baked, IMAGE);
  const r = { x: box.x - HEAL_PAD, y: box.y - HEAL_PAD, w: box.w + 2 * HEAL_PAD, h: box.h + 2 * HEAL_PAD };
  if (!src) return <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={3} fill="url(#pp-plate)" filter="url(#pp-grain)" aria-hidden />;
  return (
    <g aria-hidden pointerEvents="none">
      <mask id={`heal-${id}`} maskUnits="userSpaceOnUse" x={r.x - 8} y={r.y - 8} width={r.w + 16} height={r.h + 16}>
        <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={6} fill="#fff" filter="url(#pp-feather)" />
      </mask>
      <image href={heal.painting} x={-src.dx} y={-src.dy} width={IMAGE.w} height={IMAGE.h} preserveAspectRatio="none"
        mask={`url(#heal-${id})`} filter="url(#pp-soften)" />
    </g>
  );
}

function Refill({ b }: { b: BakedText }) {
  const pad = 3;
  return <rect x={b.box.x - pad} y={b.box.y - pad} width={b.box.w + pad * 2} height={b.box.h + pad * 2}
    fill={b.kind === "count" ? "#dfc7a2" : "#ecd3ae"} filter="url(#pp-grain)" />;
}

/** A wax seal with the land's live model count, pinned to the painter's plate. */
function FamilySeal({ box, count, theme }: { box: Box; count: number; theme: Material }) {
  const cx = box.x + box.w - 4, cy = box.y + box.h - 2, r = 15;
  return (
    <g aria-hidden>
      <circle cx={cx + 1.5} cy={cy + 2} r={r} fill="#2b1d12" opacity={0.3} />
      <circle cx={cx} cy={cy} r={r} fill={theme.loud} stroke="#4a1a10" strokeWidth={2} />
      <circle cx={cx} cy={cy} r={r - 4} fill="none" stroke={theme.loudInk} strokeWidth={0.8} opacity={0.6} />
      <text x={cx} y={cy + 1} fontSize={14} fontFamily={theme.bodyFont} fontWeight={700} fill={theme.loudInk} textAnchor="middle" dominantBaseline="central">{count}</text>
    </g>
  );
}

const star = (R: number) =>
  `M0 ${-R * 0.62} L${R * 0.19} ${-R * 0.12} L${R * 0.62} ${-R * 0.12} L${R * 0.27} ${R * 0.16} L${R * 0.4} ${R * 0.62} L0 ${R * 0.33} L${-R * 0.4} ${R * 0.62} L${-R * 0.27} ${R * 0.16} L${-R * 0.62} ${-R * 0.12} L${-R * 0.19} ${-R * 0.12} Z`;

function Marker({ name, at, r, state, theme, sel, hov, dim, onSelect, onHover }: {
  name: string; at: Pt; r: number; state: EvidenceState; theme: Material; sel: boolean; hov: boolean; dim: boolean;
  onSelect: (n: string) => void; onHover: (n: string | null) => void;
}) {
  const ev = theme.evidence[state];
  const R = r * (sel ? 1.35 : hov ? 1.15 : 1);
  const sw = r / 5;
  return (
    <g
      transform={`translate(${at.x} ${at.y})`}
      opacity={dim ? 0.62 : 1}
      role="button"
      tabIndex={0}
      aria-label={`${displayName(name)} — ${state}`}
      className="cursor-pointer outline-none"
      onClick={(e) => { e.stopPropagation(); onSelect(name); }}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(name); } }}
      onPointerEnter={() => onHover(name)}
      onPointerLeave={() => onHover(null)}
      onFocus={() => onHover(name)}
      onBlur={() => onHover(null)}
    >
      <circle r={R * 2.1} fill="transparent" />
      {theme.crisp ? (
        <g shapeRendering="crispEdges">
          <rect x={-R} y={-R} width={R * 2} height={R * 2} fill={ev.fill} stroke={ev.stroke} strokeWidth={sw}
            strokeDasharray={ev.dash ? `${sw * 2} ${sw * 1.5}` : undefined} />
          {state === "champion" && <path d={star(R)} fill="#6b1d1d" />}
          {state === "trained" && <rect x={-R * 0.3} y={-R * 0.3} width={R * 0.6} height={R * 0.6} fill="#e9f7df" />}
        </g>
      ) : (
        <g>
          <circle r={R} fill={ev.fill} stroke={ev.stroke} strokeWidth={sw} strokeDasharray={ev.dash ? `${sw * 2.2} ${sw * 1.6}` : undefined} />
          {state === "champion" && <path d={star(R)} fill="#4a3322" />}
          {state === "trained" && <circle r={R * 0.35} fill="#f4fbef" />}
        </g>
      )}
    </g>
  );
}

function Tag({ t, theme, font: font0, sel, hov, dim, lit, onSelect, onHover }: {
  t: PlacedTag; theme: Material; font: number; sel: boolean; hov: boolean; dim: boolean; lit: boolean;
  onSelect: (n: string) => void; onHover: (n: string | null) => void;
}) {
  // the selected model's tag grows a quarter: with the ring, the loudest thing on the map
  const g = sel ? 1.25 : 1;
  const box = { x: t.box.x + t.box.w * (1 - g) / 2, y: t.box.y + t.box.h * (1 - g) / 2, w: t.box.w * g, h: t.box.h * g };
  const font = font0 * g;
  const bw = theme.crisp ? font / 11 / g : font / 14 / g; // ≈ one art px on pixel
  const fill = sel ? theme.loud : hov ? theme.plateHi : theme.plate;
  const ink = sel ? theme.loudInk : theme.ink;
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  const lx = Math.max(box.x, Math.min(t.at.x, box.x + box.w)), ly = Math.max(box.y, Math.min(t.at.y, box.y + box.h));
  return (
    <g opacity={dim ? 0.5 : 1} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); onSelect(t.name); }}
      onPointerEnter={() => onHover(t.name)} onPointerLeave={() => onHover(null)} aria-hidden>
      {t.leader && <line x1={t.at.x} y1={t.at.y} x2={lx} y2={ly} stroke={theme.border} strokeWidth={bw} strokeDasharray={`${bw * 2} ${bw * 2}`} opacity={0.8} />}
      {theme.card && <rect x={box.x + bw * 1.6} y={box.y + bw * 1.9} width={box.w} height={box.h} rx={font * 0.25} fill="#3a2616" opacity={0.6} />}
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={theme.crisp ? 0 : font * 0.25}
        fill={fill} stroke={lit && !sel ? theme.ring : theme.border} strokeWidth={lit && !sel ? bw * 1.6 : bw}
        shapeRendering={theme.crisp ? "crispEdges" : undefined} />
      {theme.crisp && !sel && <rect x={box.x + bw} y={box.y + box.h - bw * 2} width={Math.max(0, box.w - bw * 2)} height={bw} fill="#e3cf9f" shapeRendering="crispEdges" />}
      <text x={cx} y={cy + font * 0.05} fontSize={font} fontFamily={theme.tagFont} fontWeight={sel ? 700 : 500}
        textAnchor="middle" dominantBaseline="central" fill={ink}>{t.text}</text>
    </g>
  );
}

function PixelSign({ at, fam, count, theme, scale }: { at: readonly [number, number]; fam: string; count: number; theme: Material; scale: number }) {
  // painted-scale, but tempered: grows as √zoom so a close-up stays about the model
  const k = 1 / Math.sqrt(Math.max(1, scale));
  const title = FAMILY_TITLE[fam].toUpperCase();
  const f = 15;
  const w = Math.round(title.length * f * 0.62 + 64), h = 26;
  const x = Math.round(at[0] - w / 2), y = Math.round(at[1] - h / 2);
  return (
    <g shapeRendering="crispEdges" aria-hidden transform={`translate(${at[0]} ${at[1]}) scale(${k}) translate(${-at[0]} ${-at[1]})`}>
      <rect x={x + 2} y={y + 2} width={w} height={h} fill="#3b1a10" opacity={0.35} />
      <rect x={x} y={y} width={w} height={h} fill={theme.plate} stroke={theme.border} strokeWidth={2} />
      <rect x={x + 3} y={y + 3} width={w - 6} height={h - 6} fill="none" stroke="#d9bf86" strokeWidth={1} />
      <text x={x + 10} y={y + h / 2 + 1} fontSize={f} fontFamily={theme.signFont} fontWeight={700} fill={theme.ink} dominantBaseline="central">{title}</text>
      <rect x={x + w - 38} y={y + 5} width={30} height={h - 10} fill={theme.border} />
      <text x={x + w - 23} y={y + h / 2 + 1} fontSize={12} fontFamily={theme.signFont} fontWeight={700} fill={theme.loudInk} textAnchor="middle" dominantBaseline="central">{count}</text>
    </g>
  );
}

function Critter({ c, theme, scale, onCritter }: { c: NonNullable<OverlayProps["critter"]>; theme: Material; scale: number; onCritter: () => void }) {
  const hScreen = scale < 1.5 ? 34 : scale < 2.5 ? 40 : 44;
  const k = hScreen / scale / 140;
  const hopY = c.hop ? (-Math.sin(c.hop * Math.PI) * 18) / scale : 0;
  return (
    <g transform={`translate(${c.x} ${c.y + hopY}) scale(${k * c.dir} ${k}) translate(-60 -128)`}
      className="cursor-pointer" onClick={(e) => { e.stopPropagation(); onCritter(); }} aria-label="the perceptron critter" role="img">
      <ellipse cx={60} cy={126} rx={34} ry={8} fill="#000" opacity={0.25} />
      {CRITTER.feet.map((f, i) => <ellipse key={i} cx={f.cx} cy={f.cy} rx={11} ry={7} fill="#2e2a3a" />)}
      <path d={CRITTER.body} fill={theme.id === "pixel" ? "#7fd0ff" : "#f4d8a6"} stroke={theme.border} strokeWidth={6} />
      <path d={CRITTER.antenna} fill="none" stroke={theme.border} strokeWidth={5} strokeLinecap="round" />
      <circle cx={CRITTER.antennaTip.cx} cy={CRITTER.antennaTip.cy} r={CRITTER.antennaTip.r} fill="#ffd23f" stroke={theme.border} strokeWidth={4} />
      <circle cx={CRITTER.eye.cx} cy={CRITTER.eye.cy} r={CRITTER.eye.r} fill="#fff" stroke={theme.border} strokeWidth={4} />
      <circle cx={CRITTER.pupil.cx} cy={CRITTER.pupil.cy} r={CRITTER.pupil.r} fill="#1b1b28" />
      <path d={CRITTER.smile} fill="none" stroke={theme.border} strokeWidth={4} strokeLinecap="round" />
    </g>
  );
}

export const PaintedOverlay = memo(function PaintedOverlay(p: OverlayProps) {
  const { map, theme, scale: S } = p;
  const hasSel = Boolean(p.selected);
  const edge = 8 / S, core = 4.5 / S;
  const familyPlates = new Map(map.baked.filter((b) => b.kind === "family").map((b) => [b.text, b.box]));
  return (
    <svg viewBox={`0 0 ${IMAGE.w} ${IMAGE.h}`} width="100%" height="100%" className="absolute inset-0 block"
      role="group" aria-label="Live layer: the models on the painted map">
      <defs>
        <filter id="pp-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.55  0 0 0 0 0.42  0 0 0 0 0.28  0 0 0 0.12 0" result="g" />
          <feComposite in="g" in2="SourceGraphic" operator="in" result="gi" />
          <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="gi" /></feMerge>
        </filter>
        {/* healed patches: a feathered mask edge, and a slight softening of the clone */}
        <filter id="pp-feather" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.6" /></filter>
        <filter id="pp-soften" x="0" y="0" width="100%" height="100%"><feGaussianBlur stdDeviation="0.9" /></filter>
        <linearGradient id="pp-plate" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4ddb6" /><stop offset="1" stopColor="#e5c595" />
        </linearGradient>
      </defs>

      {p.heal && map.baked.filter((b) => b.kind === "subtitle" || b.kind === "count").map((b, i) => <Refill key={i} b={b} />)}

      {/* the title + counts live in the sidebar now; the map keeps only its family signs */}
      {p.ours && theme.id === "pixel" && Object.entries(map.signs).map(([f, at]) => <PixelSign key={f} at={at} fam={f} count={p.famCount[f] ?? 0} theme={theme} scale={S} />)}
      {p.ours && theme.id === "paper" && (
        <>
          {Object.keys(map.signs).map((f) => {
            const box = familyPlates.get(PAPER_TITLE[f]);
            return box ? <FamilySeal key={f} box={box} count={p.famCount[f] ?? 0} theme={theme} /> : null;
          })}
          <text fontSize={15} fontFamily={theme.bodyFont} fill={theme.ink} aria-hidden>
            <tspan x={56} y={84}>{p.counts.models} neural networks across six lands,</tspan>
            <tspan x={56} y={104}>{p.counts.pipelines} pipelines, {p.counts.champions} champions.</tspan>
            <tspan x={56} y={124}>Pick one and follow its roots.</tspan>
          </text>
          <text x={map.pipelines.x} y={map.pipelines.y + 5} fontSize={16} fontFamily={theme.bodyFont} fontWeight={700} fill={theme.ink} textAnchor="middle" aria-hidden>
            {p.counts.pipelines} pipelines
          </text>
        </>
      )}

      {p.lineage.length > 0 && (
        <g fill="none" strokeLinejoin="round" strokeLinecap={theme.crisp ? "square" : "round"} pointerEvents="none">
          {p.lineage.map((l, i) => <path key={`e${i}`} d={d(l.pts)} stroke={theme.roadEdge} strokeWidth={edge} opacity={0.75} />)}
          {p.lineage.map((l, i) => (
            <path key={`c${i}`} d={d(l.pts)} stroke={theme.road} strokeWidth={core} strokeDasharray={`${10 / S} ${6 / S}`}
              style={p.still ? undefined : { animation: "painted-march 0.9s linear infinite" }} />
          ))}
        </g>
      )}

      {Object.entries(map.anchors).map(([name, a]) => (
        <Marker key={name} name={name} at={{ x: a[0], y: a[1] }} r={p.markerR} state={p.states[name] ?? "untrained"} theme={theme}
          sel={p.selected === name} hov={p.hovered === name} dim={hasSel && !p.lineageSet.has(name)}
          onSelect={p.onSelect} onHover={p.onHover} />
      ))}

      {p.selected && map.anchors[p.selected] && (() => {
        const a = map.anchors[p.selected];
        const r = p.markerR * 2.6;
        const pulse = p.still ? undefined : { animation: "painted-pulse 1.4s ease-in-out infinite", transformOrigin: "center", transformBox: "fill-box" as const };
        return (
          <g transform={`translate(${a[0]} ${a[1]})`} pointerEvents="none">
            {theme.crisp ? (
              <g shapeRendering="crispEdges">
                <rect x={-r} y={-r} width={r * 2} height={r * 2} fill="none" stroke={theme.roadEdge} strokeWidth={6 / S} />
                <rect x={-r} y={-r} width={r * 2} height={r * 2} fill="none" stroke={theme.ring} strokeWidth={3 / S} style={pulse} />
              </g>
            ) : (
              <>
                <circle r={r} fill="none" stroke="#fff8e6" strokeWidth={6 / S} />
                <circle r={r} fill="none" stroke={theme.ring} strokeWidth={3 / S} style={pulse} />
              </>
            )}
          </g>
        );
      })()}

      {p.heal && map.baked.filter((b) => b.kind === "model" || b.kind === "invented").map((b, i) => (
        <PaperPlate key={`pl${i}`} b={b} theme={theme} sel={Boolean(b.name) && p.selected === b.name} hov={Boolean(b.name) && p.hovered === b.name}
          dim={hasSel && !(b.name && p.lineageSet.has(b.name))} lit={hasSel && Boolean(b.name && p.lineageSet.has(b.name))} hard={p.hard}
          heal={p.painting ? { painting: p.painting, baked: map.baked } : undefined}
          onSelect={p.onSelect} onHover={p.onHover} />
      ))}

      {p.tags.map((t) => (
        <Tag key={t.name} t={t} theme={theme} font={p.tagFont} sel={p.selected === t.name} hov={p.hovered === t.name}
          dim={hasSel && !p.lineageSet.has(t.name) && p.hovered !== t.name} lit={hasSel && p.lineageSet.has(t.name)}
          onSelect={p.onSelect} onHover={p.onHover} />
      ))}

      {p.critter && <Critter c={p.critter} theme={theme} scale={S} onCritter={p.onCritter} />}
    </svg>
  );
});
