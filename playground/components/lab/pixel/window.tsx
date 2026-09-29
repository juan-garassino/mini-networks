"use client";

// Contemporary pixel panel (round 3): hue-shifted indigo with a lit top edge
// and soft layered depth — CSS only (see .win in pixel.module.css).
import type { CSSProperties, ReactNode } from "react";
import styles from "./pixel.module.css";

export function PixelWindow({ children, className = "", style, as = "div", ...rest }: {
  children: ReactNode;
  className?: string;
  /** kept for API compatibility (ignored in the contemporary look). */
  fill?: number;
  style?: CSSProperties;
  as?: "div" | "section" | "aside" | "nav" | "header";
} & Record<string, unknown>) {
  const Tag = as as "div";
  const { fill: _fill, ...pass } = rest as { fill?: number };
  void _fill;
  return (
    <Tag {...pass} className={`${styles.win} ${className}`} style={style}>
      {children}
    </Tag>
  );
}
