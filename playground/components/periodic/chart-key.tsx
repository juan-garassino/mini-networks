import { ElementTile } from "./element-tile";
import { KEY_LEVELS, KEY_PARTS } from "./encoding";

// The chart's key: one annotated sample tile, the three kinds of tile, and
// how to read the rows. Text comes from encoding.ts.
export function ChartKey({ sampleNumber }: { sampleNumber: number }) {
  return (
    <div className="pt-key">
      <h2 className="pt-key-title">Key</h2>
      <div className="pt-key-sample">
        <ElementTile name="transformer" number={sampleNumber} level="atom" />
        <ul>
          {KEY_PARTS.rows.map((p) => <li key={p.label}>{p.label}</li>)}
        </ul>
      </div>
      <ul className="pt-key-levels">
        {KEY_LEVELS.rows.map((l) => (
          <li key={l.sample}>
            <span className="pt-swatch" data-level={l.sample} />
            {l.label}
          </li>
        ))}
      </ul>
      {KEY_LEVELS.notes?.map((n) => <p key={n}>{n}</p>)}
    </div>
  );
}
