"use client";

// The paper edition's original critter cast — hand-drawn inline SVG, no image
// assets (repo rule: no binaries in git). All animation is transform/opacity
// only, and every position/duration is a literal or index arithmetic so the
// static export and hydration always agree (no Math.random).
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

const STROKE = "var(--line)";
const CREAM = "#fffdf5";

const QUIPS = [
  "loss is going down!!",
  "just one more epoch",
  "my gradients feel smooth today",
  "have you tried a bigger batch?",
  "backprop tickles",
  "i am 87% confident. ish.",
];

export function QuipBubble() {
  const [q, setQ] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setQ((v) => (v + 1) % QUIPS.length), 6000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="pp-bubble mb-2 whitespace-nowrap text-[13px] leading-tight">
      <AnimatePresence mode="wait">
        <motion.span
          key={q}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.25 }}
          className="inline-block"
        >
          {QUIPS[q]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

// A single-eyed perceptron: inputs in, one big look, one opinion out.
export function PerceptronBlob({ className }: { className?: string }) {
  return (
    <div className={className}>
      <QuipBubble />
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <svg width="110" height="128" viewBox="0 0 120 140" fill="none">
          {/* Σ antenna */}
          <path d="M60 30 C58 22 63 18 61 12" stroke={STROKE} strokeWidth={3} strokeLinecap="round" />
          <circle cx={62} cy={11} r={9} fill="var(--pp-sun)" stroke={STROKE} strokeWidth={2.5} />
          <text x={62} y={15} textAnchor="middle" fontSize={11} fontWeight="bold" fill={STROKE}>Σ</text>
          {/* body */}
          <path
            d="M60 28 C89 26 103 50 101 78 C99 104 83 118 60 118 C37 118 21 104 19 78 C17 50 31 30 60 28 Z"
            fill={CREAM} stroke={STROKE} strokeWidth={3} strokeLinejoin="round"
          />
          {/* the one big eye */}
          <circle cx={60} cy={72} r={16} fill="#fff" stroke={STROKE} strokeWidth={2.5} />
          <circle cx={63} cy={74} r={6} fill={STROKE} />
          <circle cx={66} cy={71} r={2} fill="#fff" />
          {/* eyelid blink */}
          <motion.rect
            x={44} y={56} width={32} height={32} rx={16}
            fill={CREAM}
            style={{ transformBox: "fill-box", originY: 0 }}
            animate={{ scaleY: [0, 0, 1, 0, 0] }}
            transition={{ duration: 4.2, times: [0, 0.9, 0.93, 0.96, 1], repeat: Infinity }}
          />
          {/* blush + smile */}
          <circle cx={38} cy={88} r={4} fill="var(--redline)" opacity={0.35} />
          <circle cx={82} cy={88} r={4} fill="var(--redline)" opacity={0.35} />
          <path d="M52 96 Q60 102 68 96" stroke={STROKE} strokeWidth={2.5} strokeLinecap="round" />
          {/* stick legs */}
          <path d="M46 118 L42 132" stroke={STROKE} strokeWidth={3} strokeLinecap="round" />
          <path d="M74 118 L78 132" stroke={STROKE} strokeWidth={3} strokeLinecap="round" />
          <ellipse cx={40} cy={134} rx={7} ry={3.5} fill={STROKE} />
          <ellipse cx={80} cy={134} rx={7} ry={3.5} fill={STROKE} />
        </svg>
      </motion.div>
    </div>
  );
}

// A 3×3 convolution kernel out for its daily slide across the input.
export function KernelCritter() {
  const cells: [number, number][] = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) cells.push([16 + c * 31, 30 + r * 31]);
  return (
    <motion.div
      className="absolute bottom-[2%] left-0"
      animate={{ x: ["-15vw", "112vw"] }}
      transition={{ duration: 55, repeat: Infinity, ease: "linear" }}
    >
      <motion.svg
        width="96" height="104" viewBox="0 0 120 130" fill="none"
        style={{ transformBox: "fill-box", originY: 1 }}
        animate={{ rotate: [-2, 2, -2] }}
        transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* legs (two alternating pairs) */}
        <motion.g
          style={{ transformBox: "fill-box", originY: 0 }}
          animate={{ rotate: [12, -12, 12] }}
          transition={{ duration: 0.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <path d="M34 118 L28 130" stroke={STROKE} strokeWidth={3} strokeLinecap="round" />
          <path d="M74 118 L68 130" stroke={STROKE} strokeWidth={3} strokeLinecap="round" />
        </motion.g>
        <motion.g
          style={{ transformBox: "fill-box", originY: 0 }}
          animate={{ rotate: [-12, 12, -12] }}
          transition={{ duration: 0.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <path d="M52 118 L48 131" stroke={STROKE} strokeWidth={3} strokeLinecap="round" />
          <path d="M92 118 L88 131" stroke={STROKE} strokeWidth={3} strokeLinecap="round" />
        </motion.g>
        {/* 3×3 body */}
        {cells.map(([x, y], i) => (
          <rect
            key={i}
            x={x} y={y} width={26} height={26} rx={6}
            fill={i === 4 ? "var(--redline)" : CREAM}
            stroke={STROKE} strokeWidth={2.5}
          />
        ))}
        {/* eyes peeking over the top row */}
        <circle cx={44} cy={26} r={8} fill="#fff" stroke={STROKE} strokeWidth={2.5} />
        <circle cx={76} cy={26} r={8} fill="#fff" stroke={STROKE} strokeWidth={2.5} />
        <circle cx={46.5} cy={27} r={3} fill={STROKE} />
        <circle cx={78.5} cy={27} r={3} fill={STROKE} />
      </motion.svg>
    </motion.div>
  );
}

// A snail whose shell is the loss curve: spiralling inward toward the minimum.
export function GradientSnail({ className }: { className?: string }) {
  return (
    <motion.div
      className={className}
      animate={{ x: [0, -50, 0] }}
      transition={{ duration: 46, repeat: Infinity, ease: "easeInOut" }}
    >
      <svg width="140" height="98" viewBox="0 0 160 112" fill="none">
        {/* slime trail */}
        <path d="M148 104 L28 104" stroke={STROKE} strokeWidth={2} strokeLinecap="round" strokeDasharray="1 8" opacity={0.5} />
        {/* body, head facing left */}
        <path
          d="M18 98 Q12 80 34 76 Q40 58 50 66 L54 78 L118 82 Q140 84 142 94 Q144 101 132 102 L26 102 Q16 102 18 98 Z"
          fill={CREAM} stroke={STROKE} strokeWidth={3} strokeLinejoin="round"
        />
        {/* eyestalks */}
        <motion.g
          style={{ transformBox: "fill-box", originY: 1 }}
          animate={{ rotate: [-6, 6, -6] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <path d="M40 62 Q38 48 32 42" stroke={STROKE} strokeWidth={2.5} strokeLinecap="round" />
          <path d="M48 62 Q50 48 56 44" stroke={STROKE} strokeWidth={2.5} strokeLinecap="round" />
          <circle cx={31} cy={39} r={5} fill="#fff" stroke={STROKE} strokeWidth={2} />
          <circle cx={57} cy={41} r={5} fill="#fff" stroke={STROKE} strokeWidth={2} />
          <circle cx={30} cy={40} r={2} fill={STROKE} />
          <circle cx={56} cy={42} r={2} fill={STROKE} />
        </motion.g>
        {/* loss-curve shell */}
        <motion.g
          style={{ transformBox: "fill-box", originX: 0.5, originY: 0.5 }}
          animate={{ rotate: [-3, 3, -3] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        >
          <circle cx={98} cy={56} r={32} fill="var(--pp-sun)" stroke={STROKE} strokeWidth={3} />
          <path
            d="M124 50 A26 26 0 1 0 98 84 A20 20 0 0 0 118 62 A14 14 0 1 0 92 56 A8 8 0 0 0 102 62"
            stroke={STROKE} strokeWidth={2.5} strokeLinecap="round" fill="none"
          />
          {/* epochs on the way down the loss spiral */}
          <circle cx={122} cy={44} r={2.5} fill={STROKE} />
          <circle cx={104} cy={82} r={2.5} fill={STROKE} />
          <circle cx={100} cy={60} r={2.5} fill={STROKE} />
        </motion.g>
      </svg>
    </motion.div>
  );
}
