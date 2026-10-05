import { ElementTile } from "./element-tile";
import { KEY_LEVELS, KEY_PARTS, KEY_ROWS_NOTE } from "./encoding";

// The chart's key: one annotated sample tile, the three kinds of tile, and
// how to read the rows. Text comes from encoding.ts.
export function ChartKey({ sampleNumber }: { sampleNumber: number }) {
  return (
    <div className="pt-key">
      <h2 className="pt-key-title">Key</h2>
      <div className="pt-key-sample">
        <ElementTile name="transformer" number={sampleNumber} level="atom" />
        <ul>
          {KEY_PARTS.map((p) => <li key={p}>{p}</li>)}
        </ul>
      </div>
      <ul className="pt-key-levels">
        {KEY_LEVELS.map((l) => (
          <li key={l.level}>
            <span className="pt-swatch" data-level={l.level} />
            {l.label}
          </li>
        ))}
      </ul>
      <p>{KEY_ROWS_NOTE}</p>
    </div>
  );
}
