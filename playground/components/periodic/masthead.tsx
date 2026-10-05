import { NOUNS, type ZooCounts } from "@/lib/copy";
import type { PeriodicSkin } from "./skins";

// The sheet's head: a drawing's title (or, in a console skin, the command
// that printed the table) and the live totals (lib/copy zooCounts) as a small
// ruled count block; the table calls its compositions reactions.
export function Masthead({ variant, counts }: { variant: PeriodicSkin["masthead"]; counts: ZooCounts }) {
  const cells: [number, string][] = [
    [counts.models, NOUNS.models[1]],
    [counts.atoms, NOUNS.atoms[1]],
    [counts.pipelines, NOUNS.reactions[1]],
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
