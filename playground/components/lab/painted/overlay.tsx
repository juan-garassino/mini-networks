"use client";

// The live layer over the painting, one SVG in IMAGE coordinates (viewBox
// 1536×1024) scaled with the image. Signs and the painter's re-cut plates are
// painted-scale (they grow with zoom, like the painter's own lettering) while
// the whole sheet is in view; tags, markers, rings and the critter are
// screen-steady (sizes divided by scale). Paper: the painting under this layer
// is the retouched one (heal.ts: the painter's model plates and chrome painted
// out), so a plate we do not draw leaves painting, not old lettering. Zoomed
// in (`steady`) every name is a screen-steady card, so the land in focus and
// the land beside it read at one size. A land in focus washes the rest of the
// painting (the paper map's focus fade).
// Every colour: material.ts (the material's `marks`).
import { memo, useId } from "react";
import { CRITTER } from "@/components/lab/shared/critter";
import { displayName, type EvidenceState } from "@/components/lab/shared/card-model";
import { IMAGE, insidePolygon, type BakedText, type Box, type Family, type PaintedMap, type Pt } from "./anchors";
import type { PlacedTag } from "./labels";
import { Mark } from "./marker";
import { FAMILY_TITLE, MOTION, PAPER_SUBLINE, PAPER_TITLE, type MapMaterial } from "./material";

export interface OverlayProps {
  map: PaintedMap;
  theme: MapMaterial;
  scale: number;
  heal: boolean;                 // paper + labels=ours: cover the painter's model plates with ours
  ours: boolean;                 // draw our signs
  tags: PlacedTag[];
  tagFont: number;               // image px
  markerR: number;               // image px
  states: Record<string, EvidenceState>;
  famCount: Record<string, number>;
  selected: string | null;
  hovered: string | null;
  lineage: { from: string; to: string; pts: Pt[] }[];
  lineageSet: Set<string>;
  critter: (Pt & { dir: number; walking: boolean; hop: number }) | null;
  still: boolean;
  onSelect: (name: string) => void;
  onHover: (name: string | null) => void;
  onCritter: () => void;
  /** image boxes drawn OVER the map (the "How it works" plate + its leader,
   * the corner plates): a painter's plate partly under them is left off (the
   * retouched painting runs on under it) rather than left half-covered */
  hard?: Box[];
  /** paper: the land titles, redrawn where the skin laid them out (in view, clear of the corners) */
  paperSigns?: PaperSign[];
  /** zoomed in: names at one screen size, the painter's plates painted out */
  steady?: boolean;
  /** a land's names are open beside the live tags: the plates take the tags' size */
  namesOpen?: boolean;
  /** the land in focus (region / node): the rest of the painting is washed */
  focusFam?: Family | null;
  familyOf?: (name: string) => string | undefined;
}

/** A paper land title as laid out by the skin: the painter's plate size, moved into view. */
export interface PaperSign { fam: Family; box: Box; count: number; /** its scale against the painted plate */ k: number }

const d = (pts: Pt[]) => pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("");
const hit = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** One type size for every painter's plate (image px) at the whole-sheet view:
 * the painter lettered his plates at whatever size fit, so ours set one size
 * and let the plate grow to the name — long two-word names break onto two lines. */
const PLATE_FONT = 14;
/** zoomed in (steady): a landmark's name in screen px, one step above the tags */
const STEADY_FONT = 15;
const EM = 0.5;                                  // Alegreya's mean advance, in em

function plateLines(text: string, maxW: number, f: number): string[] {
  if (text.length * f * EM <= maxW || !text.includes(" ")) return [text];
  const sp = [...text].flatMap((c, i) => (c === " " ? [i] : []));
  const mid = sp.reduce((a, b) => (Math.abs(b - text.length / 2) < Math.abs(a - text.length / 2) ? b : a));
  return [text.slice(0, mid), text.slice(mid + 1)];
}

/** A sheet of cardstock in SVG: the hard drop, the stock (or the loud fill),
 * the pressed inner rule, and its lines of type. `u` = one stroke unit. */
function Card({ box, m, sel, hov, lit, lines, f, u, rx, weight = 700 }: {
  box: Box; m: MapMaterial; sel: boolean; hov: boolean; lit: boolean; lines: string[]; f: number; u: number; rx: number;
  /** the type's weight: a plate's own (700), or the live tags' (500) when it stands among them */
  weight?: number;
}) {
  const { x, y, w, h } = box;
  const cx = x + w / 2, cy = y + h / 2, lh = f * 1.12;
  const fill = sel ? m.loud : hov ? m.plateHi : "url(#pp-plate)";
  return (
    <>
      <rect x={x + 1.25 * u} y={y + 1.5 * u} width={w} height={h} rx={rx} fill={m.marks.plateEdge} opacity={m.marks.plateDropAlpha} />
      <rect x={x} y={y} width={w} height={h} rx={rx} fill={fill} stroke={lit && !sel ? m.ring : m.marks.plateEdge} strokeWidth={lit && !sel ? 1.5 * u : u}
        filter={sel || hov ? undefined : "url(#pp-grain)"} />
      <rect x={x + 1.5 * u} y={y + 1.5 * u} width={Math.max(0, w - 3 * u)} height={Math.max(0, h - 3 * u)} rx={rx * 0.66} fill="none"
        stroke={sel ? m.loudInk : m.rule} strokeWidth={0.4 * u} opacity={0.6} />
      <text x={cx} y={cy - ((lines.length - 1) * lh) / 2 + f * 0.07} fontSize={f} fontFamily={m.tagFont} fontWeight={sel ? 700 : weight}
        fill={sel ? m.loudInk : m.ink} textAnchor="middle" dominantBaseline="central">
        {lines.map((l, i) => <tspan key={i} x={cx} dy={i ? lh : 0}>{l}</tspan>)}
      </text>
    </>
  );
}

/** A painter's plate under labels=ours (his lettering is already painted
 * out). At the whole-sheet view: our plate where his hung, at his plate's size
 * or more, carrying the real model name. With a land's names open beside the
 * live tags: the same plate at the tags' size, so a land reads at one label
 * size. Zoomed in (steady): the name is a screen-size card on the same spot.
 * A board the painter invented (no such model) carries nothing. Half under
 * the map plate or a corner plate: left off. */
function PaperPlate({ b, theme: m, S, steady, tagF, sel, hov, dim, lit, hard, onSelect, onHover }: {
  b: BakedText; theme: MapMaterial; S: number; steady: boolean;
  /** names open in a land beside the live tags: set at the tags' size (image px), one label size per land */
  tagF?: number;
  sel: boolean; hov: boolean; dim: boolean; lit: boolean;
  hard?: Box[]; onSelect: (n: string) => void; onHover: (n: string | null) => void;
}) {
  const name = b.name;
  // a board the painter lettered for a model the zoo does not have is painted
  // out (heal.ts) and left as painting: "no model yet" read as missing data
  if (!name) return null;
  const text = displayName(name);
  const cx = b.box.x + b.box.w / 2, cy = b.box.y + b.box.h / 2;
  let box: Box, f: number, lines: string[], u: number, rx: number;
  if (!steady && tagF) {
    // the live tag's size and padding (labels.ts specs), on the plate's stock
    f = tagF;
    lines = [text];
    const w = text.length * f * EM * 1.08 + 2 * f * 0.45, h = f * 1.55;
    box = { x: cx - w / 2, y: cy - h / 2, w, h };
    u = f / 14; rx = f * 0.25;
  } else if (steady) {
    f = STEADY_FONT / S;
    lines = plateLines(text, 150 / S, f);
    const tw = Math.max(...lines.map((l) => l.length)) * f * EM * 1.08;
    const w = tw + 18 / S, h = lines.length * f * 1.12 + 10 / S;
    box = { x: cx - w / 2, y: cy - h / 2, w, h };
    u = 2 / S; rx = 3 / S;
  } else {
    const pad = 4;
    f = PLATE_FONT;
    lines = plateLines(text, b.box.w * 1.15, f);
    const textW = Math.max(...lines.map((l) => l.length)) * f * EM;
    // the painter's plate, padded, is the floor; a long name widens it about its centre
    const w = Math.max(b.box.w + pad * 2, textW + 16), h = Math.max(b.box.h + pad * 2, lines.length * f * 1.12 + 12);
    box = { x: cx - w / 2, y: cy - h / 2, w, h };
    u = 2; rx = 3;
  }
  const cut = !sel && !lit && (hard ?? []).some((o) => hit(steady ? b.box : box, o));
  if (cut) return null;
  return (
    <>
      {/* dimmed with the stock's veil, not opacity: one plate never shows the map through it */}
      <g className="cursor-pointer" aria-hidden
        onClick={(e) => { e.stopPropagation(); onSelect(name); }}
        onPointerEnter={() => onHover(name)} onPointerLeave={() => onHover(null)}>
        <Card box={box} m={m} sel={sel} hov={hov} lit={lit} lines={lines} f={f} u={u} rx={rx} weight={!steady && tagF ? 500 : 700} />
        {dim && <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={rx} fill={m.marks.veil} opacity={m.marks.veilAlpha} />}
      </g>
    </>
  );
}

/** A wax seal with the land's live model count, pressed onto the plate's top
 * right corner (clear of the painter's subline, which runs to the plate's edge). */
const SEAL_R = 15, SEAL_FONT = 14;
const sealAt = (box: Box, k: number) => ({ x: box.x + box.w - 2 * k, y: box.y + 3 * k });
function FamilySeal({ box, count, theme: m, k }: { box: Box; count: number; theme: MapMaterial; k: number }) {
  const { x: cx, y: cy } = sealAt(box, k);
  return (
    <g aria-hidden transform={`translate(${cx} ${cy}) scale(${k}) translate(${-cx} ${-cy})`}>
      <circle cx={cx + 1.5} cy={cy + 2} r={SEAL_R} fill={m.marks.sealDrop} opacity={0.3} />
      <circle cx={cx} cy={cy} r={SEAL_R} fill={m.loud} stroke={m.marks.sealEdge} strokeWidth={2} />
      <circle cx={cx} cy={cy} r={SEAL_R - 4} fill="none" stroke={m.loudInk} strokeWidth={0.8} opacity={0.6} />
      <text x={cx} y={cy + 1} fontSize={SEAL_FONT} fontFamily={m.bodyFont} fontWeight={700} fill={m.loudInk} textAnchor="middle" dominantBaseline="central">{count}</text>
    </g>
  );
}

/** A land's title on our stock, at the painter's plate size (painted-scale):
 * the title in the sign voice, his subline under it, the seal on its corner.
 * Both lines are set to fit the plate, so neither runs off its edge. */
function LandTitle({ s, theme: m, dim }: { s: PaperSign; theme: MapMaterial; dim: boolean }) {
  const { x, y, w, h } = s.box, k = s.k;
  const title = PAPER_TITLE[s.fam], sub = PAPER_SUBLINE[s.fam];
  const f1 = Math.min(h * 0.42, (w - 28 * k) / (title.length * 0.62));
  const f2 = Math.min(h * 0.26, (w - 22 * k) / (sub.length * 0.46));
  return (
    <g aria-hidden pointerEvents="none">
      <rect x={x + 2.5 * k} y={y + 3 * k} width={w} height={h} rx={3 * k} fill={m.marks.plateEdge} opacity={m.marks.plateDropAlpha} />
      <rect x={x} y={y} width={w} height={h} rx={3 * k} fill="url(#pp-plate)" stroke={m.marks.plateEdge} strokeWidth={2 * k} filter="url(#pp-grain)" />
      <rect x={x + 3 * k} y={y + 3 * k} width={w - 6 * k} height={h - 6 * k} rx={2 * k} fill="none" stroke={m.rule} strokeWidth={0.8 * k} opacity={0.6} />
      <text x={x + w / 2} y={y + h * 0.4} fontSize={f1} fontFamily={m.signFont} fontWeight={700} fill={m.ink} textAnchor="middle" dominantBaseline="central">{title}</text>
      <text x={x + w / 2} y={y + h * 0.74} fontSize={f2} fontFamily={m.bodyFont} fill={m.inkSoft} textAnchor="middle" dominantBaseline="central">{sub}</text>
      {dim && <rect x={x} y={y} width={w} height={h} rx={3 * k} fill={m.marks.veil} opacity={m.marks.veilAlpha} />}
      <FamilySeal box={s.box} count={s.count} theme={m} k={k} />
    </g>
  );
}

function Marker({ name, at, r, state, theme, sel, hov, dim, onSelect, onHover }: {
  name: string; at: Pt; r: number; state: EvidenceState; theme: MapMaterial; sel: boolean; hov: boolean; dim: boolean;
  onSelect: (n: string) => void; onHover: (n: string | null) => void;
}) {
  const R = r * (sel ? 1.35 : hov ? 1.15 : 1);
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
      <Mark m={theme} state={state} R={R} sw={r / 5} />
    </g>
  );
}

function Tag({ t, theme, font: font0, sel, hov, dim, lit, onSelect, onHover }: {
  t: PlacedTag; theme: MapMaterial; font: number; sel: boolean; hov: boolean; dim: boolean; lit: boolean;
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
      {theme.card && <rect x={box.x + bw * 1.6} y={box.y + bw * 1.9} width={box.w} height={box.h} rx={font * 0.25} fill={theme.marks.plateEdge} opacity={theme.marks.plateDropAlpha} />}
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={theme.crisp ? 0 : font * 0.25}
        fill={fill} stroke={lit && !sel ? theme.ring : theme.border} strokeWidth={lit && !sel ? bw * 1.6 : bw}
        shapeRendering={theme.crisp ? "crispEdges" : undefined} />
      {theme.crisp && !sel && <rect x={box.x + bw} y={box.y + box.h - bw * 2} width={Math.max(0, box.w - bw * 2)} height={bw} fill={theme.marks.tagBevel} shapeRendering="crispEdges" />}
      <text x={cx} y={cy + font * 0.05} fontSize={font} fontFamily={theme.tagFont} fontWeight={sel ? 700 : 500}
        textAnchor="middle" dominantBaseline="central" fill={ink}>{t.text}</text>
    </g>
  );
}

function PixelSign({ at, fam, count, theme, scale }: { at: readonly [number, number]; fam: string; count: number; theme: MapMaterial; scale: number }) {
  // painted-scale, but tempered: grows as √zoom so a close-up stays about the model
  const k = 1 / Math.sqrt(Math.max(1, scale));
  const title = FAMILY_TITLE[fam].toUpperCase();
  const f = 15;
  const w = Math.round(title.length * f * 0.62 + 64), h = 26;
  const x = Math.round(at[0] - w / 2), y = Math.round(at[1] - h / 2);
  return (
    <g shapeRendering="crispEdges" aria-hidden transform={`translate(${at[0]} ${at[1]}) scale(${k}) translate(${-at[0]} ${-at[1]})`}>
      <rect x={x + 2} y={y + 2} width={w} height={h} fill={theme.marks.sign.drop} opacity={0.35} />
      <rect x={x} y={y} width={w} height={h} fill={theme.plate} stroke={theme.border} strokeWidth={2} />
      <rect x={x + 3} y={y + 3} width={w - 6} height={h - 6} fill="none" stroke={theme.marks.sign.rule} strokeWidth={1} />
      <text x={x + 10} y={y + h / 2 + 1} fontSize={f} fontFamily={theme.signFont} fontWeight={700} fill={theme.ink} dominantBaseline="central">{title}</text>
      <rect x={x + w - 38} y={y + 5} width={30} height={h - 10} fill={theme.border} />
      <text x={x + w - 23} y={y + h / 2 + 1} fontSize={12} fontFamily={theme.signFont} fontWeight={700} fill={theme.loudInk} textAnchor="middle" dominantBaseline="central">{count}</text>
    </g>
  );
}

function Critter({ c, theme, scale, onCritter }: { c: NonNullable<OverlayProps["critter"]>; theme: MapMaterial; scale: number; onCritter: () => void }) {
  const hScreen = scale < 1.5 ? 34 : scale < 2.5 ? 40 : 44;
  const k = hScreen / scale / 140;
  const hopY = c.hop ? (-Math.sin(c.hop * Math.PI) * 18) / scale : 0;
  const ink = theme.marks.critter;
  return (
    <g transform={`translate(${c.x} ${c.y + hopY}) scale(${k * c.dir} ${k}) translate(-60 -128)`}
      className="cursor-pointer" onClick={(e) => { e.stopPropagation(); onCritter(); }} aria-label="the perceptron critter" role="img">
      <ellipse cx={60} cy={126} rx={34} ry={8} fill={ink.shadow} opacity={0.25} />
      {CRITTER.feet.map((f, i) => <ellipse key={i} cx={f.cx} cy={f.cy} rx={11} ry={7} fill={ink.feet} />)}
      <path d={CRITTER.body} fill={ink.body} stroke={theme.border} strokeWidth={6} />
      <path d={CRITTER.antenna} fill="none" stroke={theme.border} strokeWidth={5} strokeLinecap="round" />
      <circle cx={CRITTER.antennaTip.cx} cy={CRITTER.antennaTip.cy} r={CRITTER.antennaTip.r} fill={ink.tip} stroke={theme.border} strokeWidth={4} />
      <circle cx={CRITTER.eye.cx} cy={CRITTER.eye.cy} r={CRITTER.eye.r} fill={ink.eye} stroke={theme.border} strokeWidth={4} />
      <circle cx={CRITTER.pupil.cx} cy={CRITTER.pupil.cy} r={CRITTER.pupil.r} fill={ink.pupil} />
      <path d={CRITTER.smile} fill="none" stroke={theme.border} strokeWidth={4} strokeLinecap="round" />
    </g>
  );
}

/** The paper focus fade: the painting outside the focused land washed with
 * the stock's veil, the land's outline feathered wide so no hard edge shows. */
function LandWash({ poly, theme: m }: { poly: readonly (readonly [number, number])[]; theme: MapMaterial }) {
  const id = useId().replace(/:/g, "");
  const path = poly.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join("") + "Z";
  return (
    <g aria-hidden pointerEvents="none">
      <mask id={`wash-${id}`} maskUnits="userSpaceOnUse" x={0} y={0} width={IMAGE.w} height={IMAGE.h}>
        <rect width={IMAGE.w} height={IMAGE.h} fill="#fff" />
        <path d={path} fill="#000" stroke="#000" strokeWidth={36} strokeLinejoin="round" filter="url(#pp-wash)" />
      </mask>
      <rect width={IMAGE.w} height={IMAGE.h} fill={m.marks.veil} opacity={m.marks.washAlpha} mask={`url(#wash-${id})`} />
    </g>
  );
}

export const PaintedOverlay = memo(function PaintedOverlay(p: OverlayProps) {
  const { map, theme, scale: S } = p;
  const hasSel = Boolean(p.selected);
  const edge = 8 / S, core = 4.5 / S;
  const steady = Boolean(p.steady && p.heal);
  const focusLand = p.focusFam ? map.lands[p.focusFam] : null;
  // a plate off the focused land (or, with a model open, off its lineage) is dimmed
  const offFocus = (b: BakedText) => {
    if (b.name && p.lineageSet.has(b.name)) return false;
    if (hasSel) return true;
    if (!focusLand) return false;
    return b.name ? p.familyOf?.(b.name) !== p.focusFam : !insidePolygon({ x: b.box.x + b.box.w / 2, y: b.box.y + b.box.h / 2 }, focusLand);
  };
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
        {/* healed patches: a feathered mask edge; the focus fade: a wide one */}
        <filter id="pp-feather" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.6" /></filter>
        <filter id="pp-wash" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="22" /></filter>
        <linearGradient id="pp-plate" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={theme.marks.plateTop} /><stop offset="1" stopColor={theme.marks.plateBottom} />
        </linearGradient>
      </defs>

      {p.heal && focusLand && <LandWash poly={focusLand} theme={theme} />}

      {p.ours && theme.id === "pixel" && Object.entries(map.signs).map(([f, at]) => <PixelSign key={f} at={at} fam={f} count={p.famCount[f] ?? 0} theme={theme} scale={S} />)}
      {p.ours && theme.id === "paper" && (p.paperSigns ?? []).map((s) => (
        <LandTitle key={s.fam} s={s} theme={theme} dim={Boolean(p.focusFam) && s.fam !== p.focusFam} />
      ))}

      {p.lineage.length > 0 && (
        <g fill="none" strokeLinejoin="round" strokeLinecap={theme.crisp ? "square" : "round"} pointerEvents="none">
          {p.lineage.map((l, i) => <path key={`e${i}`} d={d(l.pts)} stroke={theme.roadEdge} strokeWidth={edge} opacity={0.75} />)}
          {p.lineage.map((l, i) => (
            <path key={`c${i}`} d={d(l.pts)} stroke={theme.road} strokeWidth={core} strokeDasharray={`${10 / S} ${6 / S}`}
              style={p.still ? undefined : { animation: `painted-march ${MOTION.march}` }} />
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
        const pulse = p.still ? undefined : { animation: `painted-pulse ${MOTION.pulse}`, transformOrigin: "center", transformBox: "fill-box" as const };
        return (
          <g transform={`translate(${a[0]} ${a[1]})`} pointerEvents="none">
            {theme.crisp ? (
              <g shapeRendering="crispEdges">
                <rect x={-r} y={-r} width={r * 2} height={r * 2} fill="none" stroke={theme.roadEdge} strokeWidth={6 / S} />
                <rect x={-r} y={-r} width={r * 2} height={r * 2} fill="none" stroke={theme.ring} strokeWidth={3 / S} style={pulse} />
              </g>
            ) : (
              <>
                <circle r={r} fill="none" stroke={theme.marks.halo} strokeWidth={6 / S} />
                <circle r={r} fill="none" stroke={theme.ring} strokeWidth={3 / S} style={pulse} />
              </>
            )}
          </g>
        );
      })()}

      {p.heal && map.baked.map((b, i) => (b.kind === "model" || b.kind === "invented") && (
        <PaperPlate key={`pl${i}`} b={b} theme={theme} S={S} steady={steady} tagF={p.namesOpen ? p.tagFont : undefined} sel={Boolean(b.name) && p.selected === b.name} hov={Boolean(b.name) && p.hovered === b.name}
          dim={offFocus(b)} lit={hasSel && Boolean(b.name && p.lineageSet.has(b.name))} hard={p.hard}
          onSelect={p.onSelect} onHover={p.onHover} />
      ))}

      {p.tags.map((t) => (
        <Tag key={t.name} t={t} theme={theme} font={p.tagFont} sel={p.selected === t.name} hov={p.hovered === t.name}
          dim={(hasSel && !p.lineageSet.has(t.name) && p.hovered !== t.name) || (!hasSel && Boolean(p.focusFam) && p.familyOf?.(t.name) !== p.focusFam)}
          lit={hasSel && p.lineageSet.has(t.name)}
          onSelect={p.onSelect} onHover={p.onHover} />
      ))}

      {p.critter && <Critter c={p.critter} theme={theme} scale={S} onCritter={p.onCritter} />}
    </svg>
  );
});
