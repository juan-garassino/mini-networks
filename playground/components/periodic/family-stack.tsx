import type { CSSProperties } from "react";
import { FAMILY_BLOCKS } from "@/lib/blueprint";
import { ElementTile } from "./element-tile";
import type { PlacedModel } from "./placed";
import type { PeriodicSkin } from "./skins";

// The narrow layout: each family block lifted out of the table as its own
// small table, same columns and generation rows (gaps stay gaps), flowing
// side by side as the width allows. Shown below the lg breakpoint.
export function FamilyStack({
  models, motion, onSelect,
}: {
  models: PlacedModel[];
  motion: PeriodicSkin["motion"];
  onSelect: (name: string) => void;
}) {
  return (
    <div className="pt-stack">
      {FAMILY_BLOCKS.map((b) => {
        const members = models.filter((m) => m.col >= b.cols[0] && m.col <= b.cols[1]);
        const width = b.cols[1] - b.cols[0] + 1;
        const style = { "--pt-cols": width, "--fam": `var(--pt-fam-${b.family})` } as CSSProperties;
        return (
          <section key={b.family} className="pt-family" style={style}>
            <div className="pt-famhead"><span>{b.label}</span></div>
            <div className="pt-grid">
              {members.map((m) => (
                <ElementTile
                  key={m.name}
                  name={m.name}
                  number={m.number}
                  level={m.level}
                  title={m.title}
                  onSelect={onSelect}
                  cell={{ col: m.col - b.cols[0] + 1, row: m.row }}
                  enter={{ delay: (m.row - 1) * motion.rowStagger, duration: motion.enter }}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
