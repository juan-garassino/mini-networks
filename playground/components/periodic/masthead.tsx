import type { PeriodicSkin } from "./skins";

// The sheet's head: a drawing's title (or, in a console skin, the command
// that printed the table) and the live totals as a small ruled count block.
export interface Counts { models: number; atoms: number; reactions: number }

export function Masthead({ variant, counts }: { variant: PeriodicSkin["masthead"]; counts: Counts }) {
  const cells: [number, string][] = [
    [counts.models, "models"],
    [counts.atoms, "atoms"],
    [counts.reactions, "reactions"],
  ];
  return (
    <header className="pt-masthead">
      {variant === "prompt" ? (
        <div>
          <p className="pt-prompt"><span>$</span> mini_networks list --table</p>
          <h1 className="pt-title">The periodic table of neural networks</h1>
        </div>
      ) : (
        <div>
          <h1 className="pt-title">The Periodic Table of Neural Networks</h1>
          <p className="pt-subtitle">Every model in mini_networks, by family and generation.</p>
        </div>
      )}
      <dl className="pt-counts">
        {cells.map(([n, label]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{n}</dd>
          </div>
        ))}
      </dl>
    </header>
  );
}
