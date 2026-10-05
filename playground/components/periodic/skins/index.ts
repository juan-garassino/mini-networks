import { blueprint } from "./blueprint";
import { terminal } from "./terminal";
import type { FamilyId, PeriodicSkin } from "./types";
import { wallchart } from "./wallchart";

export type { FamilyId, PeriodicSkin } from "./types";

/** Every periodic-table skin. Add a fourth here (see ../DESIGN.md). */
export const PERIODIC_SKINS = { blueprint, wallchart, terminal } as const satisfies Record<string, PeriodicSkin>;
export type PeriodicSkinId = keyof typeof PERIODIC_SKINS;

export function isPeriodicSkin(id: string): id is PeriodicSkinId {
  return id in PERIODIC_SKINS;
}

const FAMILIES: FamilyId[] = ["perception", "sequence", "generative", "representation", "structure", "decision"];

/** A skin as CSS custom properties. The global names (--paper, --ink, …) are
 * the ones globals.css maps to Tailwind colours, so the shared chrome (title
 * block, spec-sheet drawer) follows the skin too; --pt-* are the table's own. */
export function skinVars(s: PeriodicSkin): Record<string, string> {
  const v: Record<string, string> = {
    "--paper": s.color.paper,
    "--paper-deep": s.color.paperDeep,
    "--ink": s.color.ink,
    "--ink-dim": s.color.inkDim,
    "--line": s.color.line,
    "--line-faint": s.color.lineFaint,
    "--redline": s.color.accent,
    "--pt-display": `var(${s.type.display})`,
    "--pt-body": `var(${s.type.body})`,
    "--pt-case": s.type.textCase,
    "--pt-famhead": s.type.size.famhead,
    "--pt-title": s.type.size.title,
    "--pt-sym-atom": s.type.size.symbolAtom,
    "--pt-sym-compound": s.type.size.symbolCompound,
    "--pt-sym-reaction": s.type.size.symbolReaction,
    "--pt-number": s.type.size.number,
    "--pt-name": s.type.size.name,
    "--pt-name-fit": s.type.size.nameFit,
    "--pt-small": s.type.size.small,
    "--pt-row": s.space.row,
    "--pt-reaction-row": s.space.reactionRow,
    "--pt-stack-cell": s.space.stackCell,
    "--pt-gap": s.space.gap,
    "--pt-pad": s.space.tilePad,
    "--pt-border-atom": s.border.atom,
    "--pt-border-compound": s.border.compound,
    "--pt-border-reaction": s.border.reaction,
    "--pt-fam-rule": s.border.famRule,
    "--pt-fam-band": s.border.famBand,
    "--pt-fill-atom": s.fill.atom,
    "--pt-fill-compound": s.fill.compound,
    "--pt-fill-reaction": s.fill.reaction,
    "--pt-fill-under": s.fill.under,
    "--pt-sym-compound-ink": s.compoundSymbol,
    "--pt-radius": s.radius.tile,
    "--pt-shadow": s.shadow.tile,
    "--skin-backdrop": s.backdrop.image,
    "--skin-backdrop-size": s.backdrop.size,
    "--skin-grain": String(s.backdrop.grain),
    "--skin-title-tracking": s.type.titleTracking,
    "--skin-chrome-zoom": String(s.chrome.zoom),
    "--skin-drawer-zoom": String(s.chrome.drawerZoom),
    "--skin-stamp-tilt": s.chrome.stampTilt,
  };
  // the chrome's faces follow the skin only when it names a different face
  // (re-pointing a next/font variable at itself would be a cycle)
  if (s.type.display !== "--font-display") v["--font-display"] = `var(${s.type.display})`;
  if (s.type.body !== "--font-draft") v["--font-draft"] = `var(${s.type.body})`;
  for (const f of FAMILIES) if (s.family) v[`--pt-fam-${f}`] = s.family[f];
  return v;
}

/** Paint a skin onto an element (the <html>); returns the undo.
 * `tableOnly` paints just the --pt-* tile tokens, for pages that keep their
 * own palette but still draw an element tile (the spec-sheet drawer on the
 * other editions): the tile then inks itself in that page's colours. */
export function applySkin(el: HTMLElement, s: PeriodicSkin, { tableOnly = false } = {}): () => void {
  const vars = Object.entries(skinVars(s)).filter(([k]) => !tableOnly || k.startsWith("--pt-"));
  for (const [k, val] of vars) el.style.setProperty(k, val);
  if (!tableOnly) {
    el.dataset.ptInteraction = s.interaction;
    if (s.type.singleWeight) el.dataset.ptSingleWeight = "";
  }
  return () => {
    for (const [k] of vars) el.style.removeProperty(k);
    delete el.dataset.ptInteraction;
    delete el.dataset.ptSingleWeight;
  };
}
