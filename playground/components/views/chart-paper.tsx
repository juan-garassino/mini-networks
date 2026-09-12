"use client";

import { motion } from "motion/react";
import type { TaxonomyResponse } from "@/lib/types";
import { ATOMS, symbolFor } from "@/lib/blueprint";
import { iconFor } from "@/lib/icons";

// Edition 5: the paper playhouse — every species is a scissored cutout taped
// into a storybook. Tilts, tape corners and sticker pills are deterministic
// (index arithmetic), so the static export and hydration always agree.
const FAMILY_STICKER: Record<string, string> = {
  perception: "var(--pen-3)", sequence: "#4dabf7", generative: "var(--redline)",
  representation: "var(--pen-4)", structure: "var(--pen-5)", decision: "#e46fa0",
};
const FAMILY_LABEL: Record<string, string> = {
  perception: "sees", sequence: "remembers", generative: "imagines",
  representation: "compares", structure: "connects", decision: "chooses",
};

export function ChartPaper({
  taxonomy, onSelect,
}: {
  taxonomy: TaxonomyResponse | null;
  onSelect: (name: string) => void;
}) {
  if (!taxonomy) return null;
  const familyOf = (name: string): string => {
    if (ATOMS[name]) return ATOMS[name].family;
    const m = taxonomy.models.find((x) => x.name === name);
    return m?.builds_on[0] ? familyOf(m.builds_on[0]) : "structure";
  };
  const ordered = [
    ...taxonomy.models.filter((m) => m.level === "elementary"),
    ...taxonomy.models.filter((m) => m.level === "derived"),
  ];

  return (
    <div className="h-full overflow-y-auto px-6 py-6 sm:px-12">
      <header className="mb-8 flex justify-center">
        <div className="pp-cutout relative -rotate-1 px-8 py-4 text-center">
          <span className="pp-tape" style={{ top: -8, left: 14, transform: "rotate(-6deg)" }} />
          <span className="pp-tape" style={{ top: -8, right: 14, transform: "rotate(7deg)" }} />
          <h1 className="bp-title text-3xl text-ink sm:text-4xl">The Little Book of Neural Networks</h1>
          <div className="mt-1 text-[13px] text-ink-dim">44 friendly creatures, cut from paper</div>
        </div>
      </header>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {ordered.map((m, i) => {
          const Icon = iconFor(m.name);
          const fam = familyOf(m.name);
          const rot = ((i * 7) % 5) - 2;
          return (
            <motion.button
              key={m.name}
              onClick={() => onSelect(m.name)}
              className="pp-cutout group p-4 text-left"
              initial={{ opacity: 0, scale: 0.85, rotate: rot }}
              animate={{ opacity: 1, scale: 1, rotate: rot }}
              transition={{ delay: Math.min(i * 0.02, 0.6), duration: 0.3 }}
              whileHover={{ scale: 1.05, rotate: 0, y: -4 }}
            >
              <span
                className="pp-tape"
                style={i % 2
                  ? { top: -9, right: 12, transform: "rotate(7deg)" }
                  : { top: -9, left: 12, transform: "rotate(-6deg)" }}
              />
              <div className="flex items-center justify-between">
                <span className="bp-title text-lg text-redline">{ATOMS[m.name]?.symbol ?? symbolFor(m.name)}</span>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                  style={{ background: FAMILY_STICKER[fam], transform: `rotate(${((i * 11) % 7) - 3}deg)` }}
                >
                  {FAMILY_LABEL[fam]}
                </span>
              </div>
              <div className="flex h-20 items-center justify-center">
                {Icon && <Icon size={52} strokeWidth={1.4} className="text-ink transition-colors group-hover:text-redline" />}
              </div>
              <div className="bp-title text-xl leading-tight text-ink">{m.name.replace(/_/g, " ")}</div>
              <div className="mt-1 line-clamp-2 text-[11px] leading-snug text-ink-dim">
                {m.introduces.length > 0 ? m.introduces.join(" · ") : m.note || m.description}
              </div>
              <div className="mt-2 text-[10px] font-bold text-ink-dim">
                {m.level === "elementary" ? "★ original!" : "☆ remix"}
              </div>
            </motion.button>
          );
        })}
      </div>

      <h2 className="bp-title mt-10 mb-4 text-center text-2xl text-ink">Recipe Book</h2>
      <div className="grid gap-5 pb-24 sm:grid-cols-2 lg:grid-cols-3">
        {taxonomy.compositions.map((c, i) => (
          <motion.button
            key={c.name}
            onClick={() => onSelect(c.name)}
            className="pp-bubble text-left"
            style={{ rotate: ((i * 5) % 3) - 1 }}
            whileHover={{ y: -3 }}
          >
            <span className="font-bold text-ink">{c.name.replace(/_/g, " ")}</span>
            <div className="text-[12px] text-ink-dim">mix {c.composes.join(" + ")}</div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
