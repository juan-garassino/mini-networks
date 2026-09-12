"use client";

// The paper edition's storybook backdrop: cut-paper hills, sun, clouds and the
// critter cast. Lives behind every sheet (mounted once in page.tsx, OUTSIDE the
// sheet AnimatePresence so the walking kernel never resets on sheet switches).
// pointer-events-none + aria-hidden: scenery may never block a click.
import { motion } from "motion/react";
import { GradientSnail, KernelCritter, PerceptronBlob } from "./critters";

const STROKE = "var(--line)";
const CREAM = "#fffdf5";

const PETALS = ["var(--redline)", "var(--pen-4)", "var(--pp-sun)"];

function Cloud({ x, y, drift, duration }: { x: number; y: number; drift: number; duration: number }) {
  return (
    <motion.g
      animate={{ x: [0, drift, 0] }}
      transition={{ duration, repeat: Infinity, ease: "easeInOut" }}
      opacity={0.92}
    >
      <path
        d={`M${x} ${y + 26} Q${x - 2} ${y + 10} ${x + 16} ${y + 10} Q${x + 20} ${y - 4} ${x + 38} ${y}
            Q${x + 50} ${y - 10} ${x + 62} ${y + 2} Q${x + 80} ${y - 2} ${x + 84} ${y + 12}
            Q${x + 98} ${y + 14} ${x + 94} ${y + 26} Z`}
        fill={CREAM} stroke={STROKE} strokeWidth={3.5} strokeLinejoin="round"
      />
    </motion.g>
  );
}

function Flower({ x, y, hue }: { x: number; y: number; hue: string }) {
  return (
    <g>
      <path d={`M${x} ${y} Q${x + 2} ${y - 8} ${x} ${y - 14}`} stroke={STROKE} strokeWidth={2} strokeLinecap="round" fill="none" />
      {[0, 72, 144, 216, 288].map((deg) => (
        <circle
          key={deg}
          cx={x + 4.5 * Math.cos((deg * Math.PI) / 180)}
          cy={y - 17 + 4.5 * Math.sin((deg * Math.PI) / 180)}
          r={3.2}
          fill={hue} stroke={STROKE} strokeWidth={1.2}
        />
      ))}
      <circle cx={x} cy={y - 17} r={2.4} fill={CREAM} stroke={STROKE} strokeWidth={1.2} />
    </g>
  );
}

function Tuft({ x, y }: { x: number; y: number }) {
  return (
    <g stroke={STROKE} strokeWidth={2} strokeLinecap="round">
      <path d={`M${x} ${y} Q${x - 3} ${y - 8} ${x - 5} ${y - 11}`} fill="none" />
      <path d={`M${x + 3} ${y} Q${x + 3} ${y - 9} ${x + 3} ${y - 12}`} fill="none" />
      <path d={`M${x + 6} ${y} Q${x + 9} ${y - 7} ${x + 11} ${y - 10}`} fill="none" />
    </g>
  );
}

export function PaperScenery() {
  // deterministic scatter — index arithmetic only, so SSG and hydration agree
  const flowers = Array.from({ length: 7 }, (_, i) => ({
    x: 90 + ((i * 167) % 1040),
    y: 726 + ((i * 53) % 48),
    hue: PETALS[i % 3],
  }));
  const tufts = Array.from({ length: 5 }, (_, i) => ({
    x: 180 + ((i * 233) % 900),
    y: 748 + ((i * 37) % 30),
  }));

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMax slice">
        {/* sun, slowly wheeling */}
        <motion.g
          style={{ transformBox: "fill-box", originX: 0.5, originY: 0.5 }}
          animate={{ rotate: 360 }}
          transition={{ duration: 90, repeat: Infinity, ease: "linear" }}
        >
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <line
              key={deg}
              x1={1050 + 56 * Math.cos((deg * Math.PI) / 180)}
              y1={110 + 56 * Math.sin((deg * Math.PI) / 180)}
              x2={1050 + 74 * Math.cos((deg * Math.PI) / 180)}
              y2={110 + 74 * Math.sin((deg * Math.PI) / 180)}
              stroke={STROKE} strokeWidth={4} strokeLinecap="round"
            />
          ))}
          <circle cx={1050} cy={110} r={42} fill="var(--pp-sun)" stroke={STROKE} strokeWidth={4} />
        </motion.g>

        <Cloud x={110} y={120} drift={34} duration={34} />
        <Cloud x={500} y={70} drift={-42} duration={43} />
        <Cloud x={860} y={150} drift={28} duration={52} />

        {/* three cut-paper hill bands, white-edged like scissored sheets */}
        <path
          d="M0 690 Q150 610 320 662 Q490 706 650 654 Q810 610 980 668 Q1090 702 1200 648 L1200 800 L0 800 Z"
          fill="var(--pp-grass-1)" stroke={CREAM} strokeWidth={7}
        />
        <path
          d="M0 690 Q150 610 320 662 Q490 706 650 654 Q810 610 980 668 Q1090 702 1200 648 L1200 800 L0 800 Z"
          fill="none" stroke={STROKE} strokeWidth={3}
        />
        <path
          d="M0 742 Q200 692 400 730 Q600 762 800 722 Q1000 686 1200 736 L1200 800 L0 800 Z"
          fill="var(--pp-grass-2)" stroke={CREAM} strokeWidth={7}
        />
        <path
          d="M0 742 Q200 692 400 730 Q600 762 800 722 Q1000 686 1200 736 L1200 800 L0 800 Z"
          fill="none" stroke={STROKE} strokeWidth={3}
        />
        <path
          d="M0 786 Q300 756 600 780 Q900 800 1200 770 L1200 800 L0 800 Z"
          fill="var(--pp-grass-3)" stroke={CREAM} strokeWidth={6}
        />

        {flowers.map((f, i) => <Flower key={i} {...f} />)}
        {tufts.map((t, i) => <Tuft key={i} {...t} />)}
      </svg>

      <PerceptronBlob className="absolute bottom-[5%] left-[4%]" />
      <KernelCritter />
      <GradientSnail className="absolute bottom-[4%] right-[5%]" />
    </motion.div>
  );
}
