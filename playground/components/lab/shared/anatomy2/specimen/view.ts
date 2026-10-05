// The specimen page's URL contract:
//   ?model=<name>&theme=pixel|paper&t=<1..1000>&still=1&from=<path>&variant=card
// variant=card shows every card (review sheet); from=<same-site path> adds a
// back link. Parsing never throws; unknown values fall back.
import { MOTION, type ThemeName } from "../tokens";

export interface View { model: string; theme: ThemeName; t: number; still: boolean; from: string | null; cards: boolean }

export const DEFAULT_MODEL = "diffusion";

// only same-site paths (no protocol-relative or absolute URLs)
export function safeFrom(v: string | null): string | null {
  return v && v.startsWith("/") && !v.startsWith("//") ? v : null;
}

export function parseView(search: string): View {
  const p = new URLSearchParams(search);
  const t = Number(p.get("t"));
  return {
    model: p.get("model") || DEFAULT_MODEL,
    theme: p.get("theme") === "paper" ? "paper" : "pixel",
    t: Number.isFinite(t) && t >= 1 && t <= 1000 ? Math.round(t) : MOTION.stillT,
    still: p.get("still") === "1",
    from: safeFrom(p.get("from")),
    cards: p.get("variant") === "card",
  };
}

/** The query string for `v`, keeping any unrelated params already in `base`. */
export function viewSearch(v: View, base: string, withT: boolean): string {
  const p = new URLSearchParams(base);
  p.set("model", v.model);
  p.set("theme", v.theme);
  if (withT) p.set("t", String(v.t));
  if (v.cards) p.set("variant", "card"); else p.delete("variant");
  return `?${p}`;
}
