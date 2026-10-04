"use client";

import type { TaxonModel, TaxonomyResponse } from "@/lib/types";
import { symbolFor } from "@/lib/blueprint";

// Edition: the taxonomy as a phosphor terminal — `tree` on the left pane,
// the reactions table on the right (stacked on narrow screens).
//
// Marks, all data: tree glyphs (├─ └─ │) = primary builds_on lineage;
// [Sy] = chart symbol; bright name = model; # comment = mechanisms it
// introduces; ✻n = reaction index, "= a + b" = the models it composes.
// Hover / focus = inverse video, the terminal's own selection.

const ROW = "group grid w-full items-baseline text-left outline-none hover:bg-line focus-visible:bg-line";
const INV = "group-hover:text-paper-deep group-focus-visible:text-paper-deep";

function TreeRow({
  name, prefix, note, onSelect,
}: {
  name: string;
  prefix: string;
  note: string;
  onSelect: (name: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(name)}
      className={`${ROW} grid-cols-[var(--term-name)_minmax(0,1fr)] gap-x-[1ch]`}
      title={note ? `${name} # ${note}` : name}
    >
      <span className="truncate whitespace-pre">
        <span className={`text-ink-dim ${INV}`}>{prefix}</span>
        <span className={`text-line ${INV}`}>[{symbolFor(name)}]</span>{" "}
        <span className={`text-ink ${INV}`}>{name}</span>
      </span>
      <span className={`truncate text-ink-dim ${INV}`}>{note && `# ${note}`}</span>
    </button>
  );
}

function Prompt({ cmd }: { cmd: string }) {
  return (
    <div className="text-ink-dim">
      <span className="text-line">$</span> {cmd}
    </div>
  );
}

export function ChartTerminal({
  taxonomy, onSelect,
}: {
  taxonomy: TaxonomyResponse | null;
  onSelect: (name: string) => void;
}) {
  if (!taxonomy) return null;
  const childrenOf = (parent: string) =>
    taxonomy.models.filter((m) => m.builds_on[0] === parent);
  const atoms = taxonomy.models.filter((m) => m.level === "elementary");
  const noteOf = (m: TaxonModel) => m.introduces.join(", ") || m.note || "";

  // real `tree` glyphs: each ancestor that still has siblings below draws a │
  const renderTree = (name: string, rails: string): React.ReactNode[] => {
    const kids = childrenOf(name);
    return kids.flatMap((k, i) => {
      const last = i === kids.length - 1;
      return [
        <TreeRow key={k.name} name={k.name} onSelect={onSelect}
          prefix={`${rails}${last ? "└─ " : "├─ "}`} note={noteOf(k)} />,
        ...renderTree(k.name, `${rails}${last ? "   " : "│  "}`),
      ];
    });
  };

  return (
    <div className="term-sheet h-full overflow-y-auto px-5 py-5 font-draft text-[17px] leading-[1.32] sm:px-8 sm:text-[19px]">
      <div className="grid gap-x-12 gap-y-8 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <section className="min-w-0">
          <Prompt cmd="mini_networks list --tree" />
          <div className="mb-[1.32em] text-ink">
            {taxonomy.models.length} species · {atoms.length} atoms · {taxonomy.compositions.length} reactions
          </div>
          {atoms.map((a) => (
            <div key={a.name} className="mb-[0.66em]">
              <TreeRow name={a.name} prefix="" note={noteOf(a)} onSelect={onSelect} />
              {renderTree(a.name, "")}
            </div>
          ))}
        </section>

        <section className="min-w-0">
          <Prompt cmd="mini_networks reactions --list" />
          <div className="mb-[1.32em] text-ink">
            {taxonomy.compositions.length} reactions · whole models wired into pipelines
          </div>
          {taxonomy.compositions.map((c, i) => (
            <button
              key={c.name}
              onClick={() => onSelect(c.name)}
              className={`${ROW} grid-cols-[4ch_var(--term-rx)_minmax(0,1fr)] gap-x-[1ch]`}
              title={`${c.name} = ${c.composes.join(" + ")}`}
            >
              <span className={`text-right tabular-nums text-redline ${INV}`}>✻{i + 1}</span>
              <span className={`truncate text-ink ${INV}`}>{c.name}</span>
              <span className={`truncate text-ink-dim ${INV}`}>= {c.composes.join(" + ")}</span>
            </button>
          ))}
          <div className="mt-[1.32em] text-ink-dim">
            <span className="text-line">$</span> <span className="bp-live text-redline">▮</span>
          </div>
        </section>
      </div>
    </div>
  );
}
