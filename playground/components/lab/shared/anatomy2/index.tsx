"use client";

// Anatomy v2 — mechanism-specific, truthful architecture diagrams.
//
//   <MechanismDiagram name="diffusion" theme="pixel" variant="full" t={380} still width={1120} />
//   <MechanismDiagram name="diffusion" theme="paper" variant="card" still />   // ~380px, links to the full view
//   hasDiagram(name)            → true when a mechanism diagram exists (else the
//                                 old generic Anatomy wireframe is the fallback)
//   anatomyHref(name, theme, from?) → "/lab/anatomy/?model=…&theme=…&from=…"
//
// Cards are separate compositions (190 art px wide, drawn ×2 = 380px) that keep
// one key view legible; the full diagrams are 560 art px wide (×2 = 1120px).
// Every diagram draws in an art-pixel viewBox (see each DIAGRAM entry's view)
// with crisp edges; pass `width` as an integer multiple of view.w for perfect
// pixels (1120 = ×2 for the 560-wide diagrams). Interaction: diffusion has a t
// scrubber (click a chain frame, drag the slider, or ←/→ with focus, shift =
// ×10); still=1 pins t=380 and renders no controls or motion.
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type MutableRefObject, type ReactNode } from "react";
import { Anatomy } from "@/components/lab/shared/lesson/anatomy";
import { schematicFor } from "@/lib/schematics";
import { THEMES, type Theme, type ThemeName } from "./themes";
import { DIFFUSION_CARD_VIEW, DIFFUSION_VIEW, DiffusionCard, DiffusionDiagram } from "./diagrams/diffusion";
import { TRANSFORMER_CARD_VIEW, TRANSFORMER_VIEW, TransformerCard, TransformerDiagram } from "./diagrams/transformer";
import { CLASSIFIER_CARD_VIEW, CLASSIFIER_VIEW, ClassifierCard, ClassifierDiagram } from "./diagrams/classifier";
import { VAE_CARD_VIEW, VAE_VIEW, VAECard, VAEDiagram } from "./diagrams/vae";
import { GAN_CARD_VIEW, GAN_VIEW, GANCard, GANDiagram } from "./diagrams/gan";
import { CLIP_CARD_VIEW, CLIP_VIEW, CLIPCard, CLIPDiagram } from "./diagrams/clip";
import type { KeyHandler } from "./diagrams/types";

export type { ThemeName } from "./themes";

interface DiagramDef {
  view: { w: number; h: number };
  /** does it take the t scrubber? */
  scrub?: boolean;
  /** has its own interaction (clicks / keys) when not still */
  interactive?: boolean;
  /** one-line hint for keyboard users */
  keysHint?: string;
  title: string;
  /** what is computed vs illustrative — one or two plain sentences */
  truth: string;
  render: (p: { theme: Theme; t: number; onT?: (t: number) => void; still: boolean; keys: MutableRefObject<KeyHandler | null> }) => ReactNode;
  /** the compact card composition */
  card: { view: { w: number; h: number }; render: (p: { theme: Theme; t: number }) => ReactNode };
  /** 2–4 words on how real the card is, shown under it */
  badge: string;
}

const DIAGRAMS: Record<string, DiagramDef> = {
  diffusion: {
    view: DIFFUSION_VIEW,
    scrub: true,
    title: "diffusion — noise a digit, learn to predict the noise",
    truth:
      "Computed live: the forward chain on a real MNIST test digit with the model's own schedule (1000 steps, β 1e-4→0.02, one fixed ε), the x_t mix, and the 128-d sinusoidal time embedding at t. The predicted noise and its MSE are the real network: the local mini-diffusion champion run on this exact x_t (trained at 200 steps, so t maps to t/5; exported every 25 steps). Drawn from the code: blocks, resolutions, channel counts, skips and where t enters.",
    render: ({ theme, t, onT }) => <DiffusionDiagram theme={theme} t={t} onT={onT} />,
    card: { view: DIFFUSION_CARD_VIEW, render: ({ theme, t }) => <DiffusionCard theme={theme} t={t} /> },
    badge: "real champion output",
  },
  transformer: {
    view: TRANSFORMER_VIEW,
    interactive: true,
    keysHint: "↑/↓ pick a character, ←/→ pick a head",
    title: "transformer — each character reads earlier ones, then guesses the next",
    truth:
      "All real: the Tiny Shakespeare line tokenised with the model's own 65-character vocabulary, then the local mini-transformer champion's attention for every block and head, its top guess for each next character (lit when right), and the cross-entropy. Drawn from the code: 4 blocks, 4 heads of 32 channels, d_model 128, feed-forward 256, causal mask.",
    render: ({ theme, still, keys }) => <TransformerDiagram theme={theme} still={still} keys={keys} />,
    card: { view: TRANSFORMER_CARD_VIEW, render: ({ theme }) => <TransformerCard theme={theme} /> },
    badge: "real champion attention",
  },
  classifier: {
    view: CLASSIFIER_VIEW,
    title: "classifier — small filters find strokes, pooling shrinks, ten scores decide",
    truth:
      "All real: a MNIST test 7 through the local mini-classifier champion — four of its 32 learned 3×3 kernels with their feature maps, four of the 64 second-layer maps, the max-pools of those maps, and the ten logits. Drawn from the code: two conv + BN + ReLU + pool stages, flatten 3136, a 64-unit layer, 10 outputs.",
    render: ({ theme }) => <ClassifierDiagram theme={theme} />,
    card: { view: CLASSIFIER_CARD_VIEW, render: ({ theme }) => <ClassifierCard theme={theme} /> },
    badge: "real champion maps",
  },
  vae: {
    view: VAE_VIEW,
    interactive: true,
    keysHint: "click a digit on the plane, or ←/→",
    title: "vae — squeeze an image to a fuzzy point, rebuild it from there",
    truth:
      "Real: the ten MNIST test digits, the encoder/decoder shapes (28→14→7, 32 and 64 channels, a 32-number latent) and β = 0.0015 from the config. Stand-in, and labelled so: the latent plane and the reconstructions use a 2-component PCA of these digits — what a linear VAE learns — because the local trained checkpoint has collapsed (every μ≈0, σ≈1). The σ ring is an illustrative radius.",
    render: ({ theme, still, keys }) => <VAEDiagram theme={theme} still={still} keys={keys} />,
    card: { view: VAE_CARD_VIEW, render: ({ theme }) => <VAECard theme={theme} /> },
    badge: "latent is a PCA stand-in",
  },
  gan: {
    view: GAN_VIEW,
    title: "gan — a forger and a judge train against each other",
    truth:
      "Real: the MNIST digits, and the samples, the judge's scores and both losses from the locally registered gan champion. Caveat: that champion predates today's convolutional code — its generator and judge are the older fully-connected versions — so the samples come from that network while the blocks show the current code (100 → 256×7×7 → 128×14×14 → 28×28; judge 64 → 128 → 1).",
    render: ({ theme }) => <GANDiagram theme={theme} />,
    card: { view: GAN_CARD_VIEW, render: ({ theme }) => <GANCard theme={theme} /> },
    badge: "early champion, MLP era",
  },
  clip: {
    view: CLIP_VIEW,
    title: "clip — two encoders learn one space where a digit and its caption meet",
    truth:
      "All real: six MNIST test digits and six of the model's own training captions through the local mini-clip champion — every cosine similarity, the learned scale, and the contrastive loss for this batch. The lit diagonal is where each image should match; a red frame marks a row that picked the wrong caption. Drawn from the code: a 3-conv image encoder and a 2-layer text transformer, both ending in 128 numbers of unit length.",
    render: ({ theme }) => <CLIPDiagram theme={theme} />,
    card: { view: CLIP_CARD_VIEW, render: ({ theme }) => <CLIPCard theme={theme} /> },
    badge: "real champion similarities",
  },
};

/** Link to the full specimen view; `from` (a same-site path) powers its back link. */
export function anatomyHref(name: string, theme: ThemeName = "pixel", from?: string): string {
  const p = new URLSearchParams({ model: name, theme });
  if (from && from.startsWith("/") && !from.startsWith("//")) p.set("from", from);
  return `/lab/anatomy/?${p}`;
}

export function hasDiagram(name: string): boolean {
  return name in DIAGRAMS;
}

export const DIAGRAM_NAMES = Object.keys(DIAGRAMS);

export function diagramFor(name: string): DiagramDef | null {
  return DIAGRAMS[name] ?? null;
}

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
  className?: string;
}

export function MechanismDiagram({
  name, theme = "pixel", variant = "full", href, onOpen, t: tProp, onTChange, still = false, width, controls = true, caption = true, fit = true, className,
}: MechanismDiagramProps) {
  if (variant === "card") return <MechanismCard name={name} theme={theme} href={href} onOpen={onOpen} t={still ? 380 : tProp ?? 380} width={width} caption={caption} className={className} />;
  return <MechanismFull name={name} theme={theme} t={tProp} onTChange={onTChange} still={still} width={width} controls={controls} caption={caption} fit={fit} className={className} />;
}

function MechanismCard({ name, theme, href, onOpen, t, width, caption, className }: {
  name: string; theme: ThemeName; href?: string; onOpen?: () => boolean | void; t: number; width?: number; caption: boolean; className?: string;
}) {
  const def = DIAGRAMS[name];
  const th = THEMES[theme];
  const [from, setFrom] = useState<string | undefined>(undefined);
  useEffect(() => { setFrom(window.location.pathname + window.location.search); }, []);
  const link = href ?? anatomyHref(name, theme, from);
  const w = width ?? (def ? def.card.view.w * 2 : 380);
  const onClick = (e: MouseEvent) => { if (onOpen && onOpen()) e.preventDefault(); };
  const body = def ? (
    <svg viewBox={`0 0 ${def.card.view.w} ${def.card.view.h}`} width={w} height={Math.round((w * def.card.view.h) / def.card.view.w)}
      shapeRendering="crispEdges" role="img" aria-label={def.title}
      style={{ display: "block", width: "100%", height: "auto", imageRendering: "pixelated" }}>
      {def.card.render({ theme: th, t })}
    </svg>
  ) : (
    <div style={{ background: th.ground, padding: 8 }}>
      <Anatomy stages={schematicFor(name)} animate={false} size={w - 16} labelPx={13}
        palette={{ node: th.accent, edge: th.wire, active: th.wireHot, text: th.text, accent: th.loss, fill: th.panel }}
        title={`${name} — one forward pass`} />
    </div>
  );
  return (
    <figure className={className} style={{ margin: 0, width: w, maxWidth: "100%" }}>
      <a href={link} onClick={onClick} aria-label={`Open the full diagram: how ${name} works`}
        style={{ display: "block", lineHeight: 0, outlineOffset: 2, color: th.wireHot }}>
        {body}
      </a>
      {caption && (
        <figcaption style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, lineHeight: 1.4, padding: "6px 2px 0", color: th.textDim }}>
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
  const [tLocal, setTLocal] = useState(tProp ?? 380);
  const keys = useRef<KeyHandler | null>(null);
  const t = still ? 380 : onTChange && tProp !== undefined ? tProp : tLocal;
  const setT = useCallback((v: number) => {
    const c = Math.max(1, Math.min(1000, Math.round(v)));
    setTLocal(c);
    onTChange?.(c);
  }, [onTChange]);

  if (!def) {
    // fallback: the old generic wireframe, painted in this theme
    return (
      <figure className={className} style={{ margin: 0, background: th.ground, padding: 12, width }}>
        <Anatomy stages={schematicFor(name)} animate={!still} size={width ? width - 24 : 440} labelPx={13}
          palette={{ node: th.accent, edge: th.wire, active: th.wireHot, text: th.text, accent: th.loss, fill: th.panel }}
          title={`${name} — one forward pass`} />
      </figure>
    );
  }

  const w = width ?? def.view.w * 2;
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
        <p style={{ color: th.textDim, fontSize: 12, margin: "8px 2px 0" }}>Click or focus the drawing: {def.keysHint}.</p>
      )}
      {interactive && controls && def.scrub && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 2px 0", color: th.text, fontSize: 13 }}>
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
        <figcaption style={{ color: th.text, fontSize: 13, lineHeight: 1.5, padding: "10px 2px 0", maxWidth: "72ch" }}>
          {def.truth}
        </figcaption>
      )}
      <style>{`
.anatomy2-focus:focus-visible{box-shadow:0 0 0 2px ${th.wireHot}}
.anatomy2-range{-webkit-appearance:none;appearance:none;height:14px;background:transparent;cursor:ew-resize}
.anatomy2-range::-webkit-slider-runnable-track{height:2px;background:${th.frame}}
.anatomy2-range::-moz-range-track{height:2px;background:${th.frame}}
.anatomy2-range::-webkit-slider-thumb{-webkit-appearance:none;width:10px;height:10px;margin-top:-4px;background:${th.wireHot};border:0;border-radius:0}
.anatomy2-range::-moz-range-thumb{width:10px;height:10px;background:${th.wireHot};border:0;border-radius:0}
.anatomy2-range:focus-visible{outline:2px solid ${th.wireHot};outline-offset:2px}`}</style>
    </figure>
  );
}
