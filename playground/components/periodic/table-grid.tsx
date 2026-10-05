import type { CSSProperties } from "react";
import { FAMILY_BLOCKS, PLACEMENT, TABLE_COLS, TABLE_ROWS } from "@/lib/blueprint";
import { ChartKey } from "./chart-key";
import { ElementTile } from "./element-tile";
import type { PlacedModel } from "./placed";
import type { PeriodicSkin } from "./skins";

// The wide layout: the authored 16-column table with its family heads, and
// the key set in the empty bay under the generative block (where a real
// periodic table keeps its legend). Shown from the lg breakpoint up.

const KEY_BAY = { cols: [7, 10], rows: [3, 5] } as const;

/** The key takes the bay only while no placed model sits in it. */
export const keyFitsBay = !Object.values(PLACEMENT).some(
  (p) => p.col >= KEY_BAY.cols[0] && p.col <= KEY_BAY.cols[1]
    && p.row >= KEY_BAY.rows[0] && p.row <= KEY_BAY.rows[1],
);

export function TableGrid({
  models, sampleNumber, motion, onSelect,
}: {
  models: PlacedModel[];
  sampleNumber: number;
  motion: PeriodicSkin["motion"];
  onSelect: (name: string) => void;
}) {
  const cols = { "--pt-cols": TABLE_COLS, "--pt-rows": TABLE_ROWS } as CSSProperties;
  return (
    <div className="pt-wide" style={cols}>
      <div className="pt-grid pt-famheads">
        {FAMILY_BLOCKS.map((b) => (
          <div
            key={b.family}
            className="pt-famhead"
            style={{ gridColumn: `${b.cols[0]} / ${b.cols[1] + 1}`, "--fam": `var(--pt-fam-${b.family})` } as CSSProperties}
          >
            <span>{b.label}</span>
          </div>
        ))}
      </div>
      <div className="pt-grid pt-table">
        {models.map((m) => (
          <ElementTile
            key={m.name}
            name={m.name}
            number={m.number}
            level={m.level}
            title={m.title}
            onSelect={onSelect}
            enter={{ delay: (m.row - 1) * motion.rowStagger + m.col * motion.colStagger, duration: motion.enter }}
            cell={{ col: m.col, row: m.row }}
          />
        ))}
        {keyFitsBay && (
          <div
            className="pt-bay"
            style={{
              gridColumn: `${KEY_BAY.cols[0]} / ${KEY_BAY.cols[1] + 1}`,
              gridRow: `${KEY_BAY.rows[0]} / ${KEY_BAY.rows[1] + 1}`,
            }}
          >
            <ChartKey sampleNumber={sampleNumber} />
          </div>
        )}
      </div>
    </div>
  );
}
