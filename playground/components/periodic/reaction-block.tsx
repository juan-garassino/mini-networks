import { ElementTile } from "./element-tile";
import type { PlacedReaction } from "./placed";
import type { PeriodicSkin } from "./skins";

// The f-block: compositions, set apart below the table like the lanthanides.
// The tile run wraps on its own (11 across on the wide table, fewer on a phone).
export function ReactionBlock({
  reactions, motion, onSelect,
}: {
  reactions: PlacedReaction[];
  motion: PeriodicSkin["motion"];
  onSelect: (name: string) => void;
}) {
  return (
    <section className="pt-fblock" aria-label="Reactions">
      <div className="pt-fblock-label">
        <h2>✻ Reactions</h2>
        <p>Whole models wired into pipelines.</p>
        <p>Drawn in full on sheet 02.</p>
      </div>
      <div className="pt-fblock-tiles">
        {reactions.map((r, i) => (
          <ElementTile
            key={r.name}
            name={r.name}
            number={r.number}
            level="reaction"
            title={r.title}
            onSelect={onSelect}
            enter={{ delay: motion.reactionStart + i * motion.reactionStagger, duration: motion.enter }}
          />
        ))}
      </div>
    </section>
  );
}
