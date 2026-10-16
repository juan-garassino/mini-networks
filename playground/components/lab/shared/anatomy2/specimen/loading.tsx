"use client";

// The specimen's loading plate (DESIGN-LIBRARY.md § Loading): until the page
// has read its URL and measured the screen (the drawings are bundled, so the
// only phase is "layout"), it paints its own ground with the masthead where it
// will stay and one status line in the kit's bitmap voice where the plate
// lands. Static export: the server cannot read ?theme=, so it is the pixel
// ground; the wide/narrow placement is CSS so it matches before hydration.
import { labLoading, loadPhase } from "@/lib/lab-contract";
import { PixelLabel } from "../prims";
import { DIAGRAMS } from "../registry";
import { ART, PIXEL, SPACE, THEMES, TYPE, WIDE_MIN } from "../tokens";

/** The kit's voice. Only the "layout" phase occurs (no API to wait on). */
const VOICE = "inking the plates...";

export function SpecimenLoading({ count }: { count: number }) {
  const th = THEMES.pixel;
  const phase = loadPhase(DIAGRAMS, { laidOut: false }) ?? "layout";
  const drawW = ART.full.w * ART.scale;
  return (
    <main className="anx-boot" style={{ position: "absolute", inset: 0, overflow: "hidden", background: th.ground, color: th.text, fontFamily: TYPE.prose }}>
      <style>{`
.anx-boot-grid{max-width:${drawW}px;margin:0 auto;padding:${SPACE.l}px ${SPACE.gutter}px;box-sizing:content-box}
.anx-boot-status{margin:${SPACE.xl}px 0 0;color:${th.textDim}}
@media (min-width:${WIDE_MIN}px){
  .anx-boot-grid{max-width:none;display:grid;grid-template-columns:${SPACE.index}px ${drawW}px;gap:${SPACE.xl}px;justify-content:center;padding:${SPACE.xl}px ${SPACE.gutter}px}
  .anx-boot-status{margin:0}
}`}</style>
      <div className="anx-boot-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: SPACE.s + 2 }}>
          <PixelLabel text="how it works" s={PIXEL.wordmark} />
          <p style={{ margin: 0, color: th.textDim, fontSize: TYPE.hint.size, lineHeight: TYPE.hint.line }}>
            {count} models, each drawn from its own code and run.
          </p>
        </div>
        <p {...labLoading(phase)} className="anx-boot-status">
          <PixelLabel text={VOICE} s={PIXEL.head} />
        </p>
      </div>
    </main>
  );
}
