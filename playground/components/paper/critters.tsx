"use client";

// The paper edition's one remaining mascot: a small surveyor's-mark cameo of
// the one-eyed perceptron, tucked in a map corner. Inline SVG (no binaries),
// a single gentle bob — no bubbles, no legs, nothing childish.
import { motion } from "motion/react";

const STROKE = "var(--line)";
const CREAM = "#f7f1e2";

export function CritterCameo({ size = 36 }: { size?: number }) {
  return (
    <motion.svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 60 60"
      fill="none"
      animate={{ y: [0, -2.5, 0] }}
      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
    >
      {/* antenna node */}
      <path d="M30 12 C29 8 32 6 31 3" stroke={STROKE} strokeWidth={2} strokeLinecap="round" />
      <circle cx={31} cy={3.5} r={3} fill="var(--pen-5)" stroke={STROKE} strokeWidth={1.5} />
      {/* body */}
      <circle cx={30} cy={34} r={20} fill={CREAM} stroke={STROKE} strokeWidth={2.5} />
      {/* the one eye */}
      <circle cx={30} cy={32} r={8} fill="#fff" stroke={STROKE} strokeWidth={2} />
      <circle cx={32} cy={33} r={3} fill={STROKE} />
      <circle cx={33.5} cy={31.5} r={1} fill="#fff" />
      {/* calm smile */}
      <path d="M24 43 Q30 47 36 43" stroke={STROKE} strokeWidth={2} strokeLinecap="round" />
    </motion.svg>
  );
}
