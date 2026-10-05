"use client";

// Renders a registry entry: <MechanismDiagram variant="full" | "card" />.
// Sizes, type and focus styling come from tokens.ts; colours from the theme.
import { useCallback, useRef, useState, useSyncExternalStore, type KeyboardEvent, type MouseEvent } from "react";
import { Anatomy } from "@/components/lab/shared/lesson/anatomy";
import { schematicFor } from "@/lib/schematics";
import { ART, BORDER, MOTION, SPACE, THEMES, TYPE, type ThemeName } from "./tokens";
import { DIAGRAMS, anatomyHref } from "./registry";
import { LEGIBLE, fallbackFor } from "./legible";
import type { KeyHandler } from "./diagrams/types";

// the card's back-link target: the page it sits on (client only; undefined on the server)
const noSubscribe = () => () => {};
const currentPath = () => window.location.pathname + window.location.search;
const noPath = () => undefined;

export interface MechanismDiagramProps {
  name: string;
  theme?: ThemeName;
  /** "full" (default): the whole mechanism; "card": one compact key view that links to the full page */
  variant?: "full" | "card";
  /** card only: where a tap goes (default anatomyHref(name, theme, <current path>)) */
  href?: string;
  /** card only: intercept the tap (e.g. open your own modal); return true to cancel navigation */
  onOpen?: () => boolean | void;
  /** diffusion timestep (1..1000); uncontrolled start value when onTChange is absent */
  t?: number;
  onTChange?: (t: number) => void;
  /** still=1: fixed t=380, no controls, no motion */
  still?: boolean;
  /** rendered width in px (height follows the diagram's aspect) */
  width?: number;
  /** show the scrubber row (default true unless still) */
  controls?: boolean;
  /** show the "what's real" sentence under the drawing (default true) */
  caption?: boolean;
  /** shrink to the container (max-width 100%, default true); false keeps `width` exact */
  fit?: boolean;
  /** full only, the legibility floor (legible.ts): when `width` would set the
   * labels below this many CSS px, render the card at LEGIBLE.cardZoom instead
   * (its tap → `onOpen` / `href`: the full drawing one click away). Pass
   * LEGIBLE.minLabelPx; omit to always draw the full view at `width`. */
  minLabelPx?: number;
  className?: string;
}

export function MechanismDiagram({
  name, theme = "pixel", variant = "full", href, onOpen, t: tProp, onTChange, still = false, width, controls = true, caption = true, fit = true, minLabelPx, className,
}: MechanismDiagramProps) {
  const def = DIAGRAMS[name];
  if (variant === "full" && def && width && minLabelPx && fallbackFor(width, def.view.w, minLabelPx) === "card") {
    return <MechanismCard name={name} theme={theme} href={href} onOpen={onOpen} t={MOTION.stillT} width={def.card.view.w * LEGIBLE.cardZoom} caption={caption} className={className} />;
  }
  if (variant === "card") return <MechanismCard name={name} theme={theme} href={href} onOpen={onOpen} t={still ? MOTION.stillT : tProp ?? MOTION.stillT} width={width} caption={caption} className={className} />;
  return <MechanismFull name={name} theme={theme} t={tProp} onTChange={onTChange} still={still} width={width} controls={controls} caption={caption} fit={fit} className={className} />;
}

function MechanismCard({ name, theme, href, onOpen, t, width, caption, className }: {
  name: string; theme: ThemeName; href?: string; onOpen?: () => boolean | void; t: number; width?: number; caption: boolean; className?: string;
}) {
  const def = DIAGRAMS[name];
  const th = THEMES[theme];
  const from = useSyncExternalStore(noSubscribe, currentPath, noPath);
  const link = href ?? anatomyHref(name, theme, from);
  const w = width ?? (def ? def.card.view.w * ART.scale : SPACE.card);
  const onClick = (e: MouseEvent) => { if (onOpen && onOpen()) e.preventDefault(); };
  const body = def ? (
    <svg viewBox={`0 0 ${def.card.view.w} ${def.card.view.h}`} width={w} height={Math.round((w * def.card.view.h) / def.card.view.w)}
      shapeRendering="crispEdges" role="img" aria-label={def.title}
      style={{ display: "block", width: "100%", height: "auto", imageRendering: "pixelated" }}>
      {def.card.render({ theme: th, t })}
    </svg>
  ) : (
    <div style={{ background: th.ground, padding: SPACE.s }}>
      <Anatomy stages={schematicFor(name)} animate={false} size={w - 2 * SPACE.s} labelPx={13}
        palette={{ node: th.accent, edge: th.wire, active: th.wireHot, text: th.text, accent: th.loss, fill: th.panel }}
        title={`${name} — one forward pass`} />
    </div>
  );
  return (
    <figure className={className} style={{ margin: 0, width: w, maxWidth: "100%" }}>
      <a href={link} onClick={onClick} aria-label={`Open the full diagram: how ${name} works`}
        style={{ display: "block", lineHeight: 0, outlineOffset: BORDER.focus, color: th.wireHot }}>
        {body}
      </a>
      {caption && (
        <figcaption style={{ display: "flex", justifyContent: "space-between", gap: SPACE.s, fontSize: TYPE.small.size, lineHeight: TYPE.small.line, padding: `${SPACE.s - 2}px 2px 0`, color: th.textDim }}>
          <span>{def ? def.badge : "generic sketch"}</span>
          <a href={link} onClick={onClick} style={{ color: th.wireHot, textDecoration: "none", whiteSpace: "nowrap" }}>Open full diagram</a>
        </figcaption>
      )}
    </figure>
  );
}

function MechanismFull({
  name, theme, t: tProp, onTChange, still, width, controls, caption, fit, className,
}: {
  name: string; theme: ThemeName; t?: number; onTChange?: (t: number) => void; still: boolean; width?: number;
  controls: boolean; caption: boolean; fit: boolean; className?: string;
}) {
  const def = DIAGRAMS[name];
  const th = THEMES[theme];
  const [tLocal, setTLocal] = useState(tProp ?? MOTION.stillT);
  const keys = useRef<KeyHandler | null>(null);
  const t = still ? MOTION.stillT : onTChange && tProp !== undefined ? tProp : tLocal;
  const setT = useCallback((v: number) => {
    const c = Math.max(1, Math.min(1000, Math.round(v)));
    setTLocal(c);
    onTChange?.(c);
  }, [onTChange]);

  if (!def) {
    // fallback: the old generic wireframe, painted in this theme
    return (
      <figure className={className} style={{ margin: 0, background: th.ground, padding: SPACE.m - SPACE.xs, width }}>
        <Anatomy stages={schematicFor(name)} animate={!still} size={width ? width - 2 * (SPACE.m - SPACE.xs) : 440} labelPx={13}
          palette={{ node: th.accent, edge: th.wire, active: th.wireHot, text: th.text, accent: th.loss, fill: th.panel }}
          title={`${name} — one forward pass`} />
      </figure>
    );
  }

  const w = width ?? def.view.w * ART.scale;
  const h = Math.round((w * def.view.h) / def.view.w);
  const interactive = !still && (def.scrub || def.interactive);
  const onKey = (e: KeyboardEvent) => {
    if (!interactive) return;
    if (keys.current) { if (keys.current(e)) e.preventDefault(); return; }
    const step = e.shiftKey ? 100 : 10;
    if (e.key === "ArrowRight") { e.preventDefault(); setT(t + step); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); setT(t - step); }
    else if (e.key === "Home") { e.preventDefault(); setT(1); }
    else if (e.key === "End") { e.preventDefault(); setT(1000); }
  };

  return (
    <figure className={className} style={{ margin: 0, width: w, maxWidth: fit ? "100%" : undefined }}>
      <div
        tabIndex={interactive ? 0 : undefined}
        onKeyDown={onKey}
        role={interactive ? "group" : undefined}
        aria-label={interactive ? `${def.title}. ${def.scrub ? `Left and right arrows move t (now ${t}).` : def.keysHint ?? ""}` : undefined}
        style={{ outline: "none", lineHeight: 0 }}
        className="anatomy2-focus"
      >
        <svg
          viewBox={`0 0 ${def.view.w} ${def.view.h}`}
          width={w}
          height={h}
          shapeRendering="crispEdges"
          role="img"
          aria-label={def.title}
          style={{ display: "block", width: "100%", height: "auto", imageRendering: "pixelated" }}
        >
          {def.render({ theme: th, t, onT: interactive && def.scrub ? setT : undefined, still, keys })}
        </svg>
      </div>
      {interactive && controls && def.keysHint && (
        <p style={{ color: th.textDim, fontSize: TYPE.small.size, lineHeight: TYPE.small.line, margin: `${SPACE.s}px 2px 0` }}>Click or focus the drawing: {def.keysHint}.</p>
      )}
      {interactive && controls && def.scrub && (
        <div style={{ display: "flex", alignItems: "center", gap: SPACE.m - SPACE.xs, padding: `${SPACE.s + 2}px 2px 0`, color: th.text, fontSize: TYPE.hint.size }}>
          <label htmlFor={`t-${name}`} style={{ whiteSpace: "nowrap" }}>timestep t</label>
          <input
            id={`t-${name}`} type="range" min={1} max={1000} step={1} value={t}
            onChange={(e) => setT(Number(e.target.value))}
            className="anatomy2-range"
            style={{ flex: 1 }}
          />
          <output style={{ minWidth: 36, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{t}</output>
        </div>
      )}
      {caption && (
        <figcaption style={{ color: th.text, fontSize: TYPE.hint.size, lineHeight: TYPE.hint.line, padding: `${SPACE.s + 2}px 2px 0`, maxWidth: TYPE.measure }}>
          {def.truth}
        </figcaption>
      )}
      <style>{`
.anatomy2-focus:focus-visible{box-shadow:0 0 0 ${BORDER.focus}px ${th.wireHot}}
.anatomy2-range{-webkit-appearance:none;appearance:none;height:14px;background:transparent;cursor:ew-resize}
.anatomy2-range::-webkit-slider-runnable-track{height:2px;background:${th.frame}}
.anatomy2-range::-moz-range-track{height:2px;background:${th.frame}}
.anatomy2-range::-webkit-slider-thumb{-webkit-appearance:none;width:10px;height:10px;margin-top:-4px;background:${th.wireHot};border:0;border-radius:${BORDER.radius}}
.anatomy2-range::-moz-range-thumb{width:10px;height:10px;background:${th.wireHot};border:0;border-radius:${BORDER.radius}}
.anatomy2-range:focus-visible{outline:${BORDER.focus}px solid ${th.wireHot};outline-offset:${BORDER.focus}px}`}</style>
    </figure>
  );
}
