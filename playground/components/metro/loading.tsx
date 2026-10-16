// Transit's loading surface (lib/lab-contract.ts LOADING): the porcelain sheet,
// the system's name set as the phone header sets it, and one status line led
// by a stub of the key's neutral track, in Jost, where the map will land.
import { labLoading, type LoadPhase } from "@/lib/lab-contract";
import { GRID, SHEET, SPACE, TYPE, VOICE } from "./tokens";

const STUB = 26; // the key's sample track length (key.tsx)

export function MetroLoading({ phase, title }: { phase: LoadPhase; title: string }) {
  return (
    <div className="h-full overflow-hidden" style={{ fontFamily: TYPE.family }}>
      <div className="mx-auto px-4 pt-3 sm:px-6" style={{ maxWidth: SPACE.maxWidth }}>
        <h1 className="text-[22px] font-semibold leading-tight text-ink">{title}</h1>
        <p {...labLoading(phase)} className="mt-2 flex items-center gap-3 text-[13px] leading-snug text-ink-dim">
          <svg width={STUB + GRID.track} height={GRID.track} aria-hidden className="flex-none">
            <line x1={GRID.track / 2} x2={STUB + GRID.track / 2} y1={GRID.track / 2} y2={GRID.track / 2}
              stroke={SHEET.sampleTrack} strokeWidth={GRID.track} strokeLinecap="round" />
          </svg>
          {phase === "offline" ? VOICE.offline : VOICE.loading}
        </p>
      </div>
    </div>
  );
}
