import { labLoading, type LoadPhase } from "@/lib/lab-contract";
import { Masthead } from "./masthead";
import type { PeriodicSkin } from "./skins";

// The table's loading surface (lib/lab-contract.ts LOADING): the skin's own sheet
// with its masthead where it will stay, and one status line in the skin's voice
// where the table lands. A console skin ("prompt") prints it after its command,
// with a block cursor that holds still under ?still=1 and reduced motion.
export function PeriodicLoading({ skin, phase }: { skin: PeriodicSkin; phase: LoadPhase }) {
  return (
    <div className="pt-sheet">
      <Masthead variant={skin.masthead} />
      <p {...labLoading(phase)} className="pt-loading" data-variant={skin.masthead}>
        {phase === "offline" ? skin.voice.offline : skin.voice.loading}
      </p>
    </div>
  );
}
