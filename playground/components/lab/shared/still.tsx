"use client";

// still=1 freezes every Motion animation (screenshots must be deterministic):
// default transitions become instant and reduced motion is forced. Components
// that pass their own `transition` must ALSO use `initial={false}` under still
// — headless shots caught Motion fades at opacity 0 otherwise.
import type { ReactNode } from "react";
import { MotionConfig } from "motion/react";

export function LabMotion({ still, children }: { still: boolean; children: ReactNode }) {
  return (
    <MotionConfig reducedMotion={still ? "always" : "user"} transition={still ? { duration: 0 } : undefined}>
      {children}
    </MotionConfig>
  );
}
