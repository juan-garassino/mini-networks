"use client";

// The pixel chrome: a 9-slice RPG window printed on a die-cut paper card,
// the pixel hand, and the typewriter line. Reusable by any skin (exported
// from ./index.ts).
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import s from "./hybrid.module.css";
import { frameUrl, spriteRects, HAND, type FrameKind, type Sprite } from "./pixel-art.ts";

export function PixelWindow({
  kind = "window", title, ribbon, lifted, className, style, bodyClassName, children, as = "section", label,
}: {
  /** header ribbon: text on the family's cardstock colour */
  ribbon?: { text: ReactNode; color: string };
  kind?: FrameKind;
  title?: ReactNode;
  lifted?: boolean;
  className?: string;
  style?: CSSProperties;
  bodyClassName?: string;
  children: ReactNode;
  as?: "section" | "aside" | "nav" | "header" | "div";
  label?: string;
}) {
  const Tag = as;
  return (
    <Tag data-chrome="1" aria-label={label} className={`${s.card} ${lifted ? s.cardLifted : ""} ${className ?? ""}`} style={style}>
      <div className={`${s.win} ${bodyClassName ?? ""}`} style={{ borderImageSource: frameUrl(kind) }}>
        {ribbon && <div className={s.ribbon} style={{ background: ribbon.color }}>{ribbon.text}</div>}
        {title != null && <div className={`${s.t15} ${s.gold} px-2 pt-0.5`}>{title}</div>}
        {children}
      </div>
    </Tag>
  );
}

/** Inline SVG of a string-array sprite at an integer scale. */
export function PixelSprite({ sprite, scale = 3, flip, className, style }: {
  sprite: Sprite; scale?: number; flip?: boolean; className?: string; style?: CSSProperties;
}) {
  const r = spriteRects(sprite);
  return (
    <svg aria-hidden width={r.w * scale} height={r.h * scale} viewBox={`0 0 ${r.w} ${r.h}`}
      shapeRendering="crispEdges" className={className}
      style={{ ...style, transform: flip ? "scaleX(-1)" : undefined }}>
      {r.rects.map((q, i) => <rect key={i} x={q.x} y={q.y} width={q.w} height={1} fill={q.fill} />)}
    </svg>
  );
}

/** CSS url() of the hand sprite, for ::before cursors inside menus. */
export function handCssUrl(): string {
  const r = spriteRects(HAND);
  const body = r.rects.map((q) => `<rect x="${q.x}" y="${q.y}" width="${q.w}" height="1" fill="${q.fill}"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r.w} ${r.h}" shape-rendering="crispEdges">${body}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/**
 * One line typed out a character at a time — the narrator's voice. Under
 * still (or reduced motion) the full line prints at once, no caret.
 */
export function Typewriter({ text, still, className }: { text: string; still: boolean; className?: string }) {
  const [n, setN] = useState(still ? text.length : 0);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  useEffect(() => {
    if (still || reduced) { setN(text.length); return; }
    setN(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setN(i);
      if (i >= text.length) clearInterval(id);
    }, 22);
    return () => clearInterval(id);
  }, [text, still, reduced]);
  return (
    <p className={className} aria-label={text}>
      <span aria-hidden>{text.slice(0, n)}</span>
    </p>
  );
}
