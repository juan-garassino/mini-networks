"use client";

// Right-hand detail panel for the selected node (Image 17's Transformer card):
// name, description, tags (mechanisms + level), Derives-from and Used-by lists.
import type { AtlasLayout, AtlasNode } from "./layout";
import { ATLAS_INK, ATLAS_INK_DIM, ATLAS_PAPER, REGION_BY_KEY } from "./theme";

function LinkRow({
  label, items, layout, onSelect,
}: {
  label: string; items: string[]; layout: AtlasLayout; onSelect: (n: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-4">
      <div className="text-[10px] uppercase tracking-[0.14em]" style={{ color: ATLAS_INK_DIM }}>{label}</div>
      <div className="mt-1.5 flex flex-col gap-1">
        {items.map((m) => (
          <button key={m} onClick={() => onSelect(m)}
            className="flex items-center gap-2 text-left text-[13px] hover:underline" style={{ color: ATLAS_INK }}>
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: layout.byName.get(m)?.color ?? ATLAS_INK_DIM }} />
            {m.replace(/_/g, " ")}
          </button>
        ))}
      </div>
    </div>
  );
}

export function AtlasDetail({
  node, layout, onSelect,
}: {
  node: AtlasNode | null; layout: AtlasLayout; onSelect: (n: string | null) => void;
}) {
  if (!node) return null;
  const region = REGION_BY_KEY[node.region];
  const usedBy = layout.usedBy.get(node.name) ?? [];
  const tags = [
    node.level === "elementary" ? "foundational" : "derived",
    ...node.introduces.slice(0, 3),
  ];

  return (
    <div className="absolute right-7 top-7 w-[300px] border p-5 shadow-[0_10px_30px_rgba(43,39,35,0.12)]"
      style={{ background: ATLAS_PAPER, borderColor: "#dcd4c4", fontFamily: "var(--font-jost), sans-serif" }}>
      <button onClick={() => onSelect(null)} className="absolute right-3 top-2 text-[16px]" style={{ color: ATLAS_INK_DIM }}>×</button>
      <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: region.color }}>{region.name}</div>
      <h2 className="mt-0.5 leading-tight" style={{ fontFamily: "var(--font-cormorant), serif", color: ATLAS_INK, fontSize: 27, fontWeight: 700 }}>
        {node.name.replace(/_/g, " ")}
      </h2>
      <p className="mt-2 text-[12.5px] leading-snug" style={{ color: ATLAS_INK }}>
        {node.description || node.note || "A model in the mini_networks zoo."}
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <span key={t} className="rounded-full border px-2.5 py-0.5 text-[10px]"
            style={{ borderColor: "#d3cab8", color: ATLAS_INK_DIM }}>{t.replace(/_/g, " ")}</span>
        ))}
      </div>
      <LinkRow label="Derives from" items={node.buildsOn} layout={layout} onSelect={onSelect} />
      <LinkRow label="Used by" items={usedBy} layout={layout} onSelect={onSelect} />
    </div>
  );
}
