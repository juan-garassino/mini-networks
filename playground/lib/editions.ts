// The classic editions at "/" (?edition=<id>): their ids, names, and the tokens
// each paints on <html>. One source for both painters: the boot script in
// app/(classic)/layout.tsx (before first paint, so no edition ever flashes
// another's loader) and the Editions effect (app/(classic)/editions.tsx, on a
// switch). Pure data, no DOM import, safe in a server component.
import { PERIODIC_SKINS, isPeriodicSkin, skinVars } from "@/components/periodic/skins";
import { SHEET_VARS } from "@/components/metro/tokens";

export type SheetId = "chart" | "reactions" | "observatory";
export type EditionId = "blueprint" | "wallchart" | "terminal" | "metro" | "atlas" | "paper";

export const EDITION_IDS: EditionId[] = ["blueprint", "wallchart", "terminal", "metro", "atlas", "paper"];
export const DEFAULT_EDITION: EditionId = "blueprint";
/** localStorage key of the last chosen edition. */
export const EDITION_KEY = "mn-edition";

export const EDITION_LABEL: Record<EditionId, string> = {
  blueprint: "Blueprint", wallchart: "Wall chart", terminal: "Terminal",
  metro: "Transit", atlas: "Atlas", paper: "Paper",
};

export function isEdition(id: string | null | undefined): id is EditionId {
  return !!id && (EDITION_IDS as string[]).includes(id);
}

/** ?edition=<id> first (every edition has its own link), then the saved one. */
export function pickEdition(search: string, saved: string | null): EditionId {
  const q = new URLSearchParams(search).get("edition");
  return isEdition(q) ? q : isEdition(saved) ? saved : DEFAULT_EDITION;
}

/** What an edition paints on <html>: CSS custom properties and data-* attributes. */
export interface EditionPaint { vars: Record<string, string>; data: Record<string, string> }

/** The periodic skins paint their whole token set; every other edition keeps its
 * own palette (transit: metro/tokens SHEET_VARS; atlas, paper: blueprint.css) and
 * borrows only the blueprint's tile tokens, for the drawer's element tile. */
export function editionPaint(id: EditionId): EditionPaint {
  if (isPeriodicSkin(id)) {
    const s = PERIODIC_SKINS[id];
    return {
      vars: skinVars(s),
      data: { "data-pt-interaction": s.interaction, ...(s.type.singleWeight && { "data-pt-single-weight": "" }) },
    };
  }
  const tiles = Object.fromEntries(Object.entries(skinVars(PERIODIC_SKINS.blueprint)).filter(([k]) => k.startsWith("--pt-")));
  return { vars: { ...tiles, ...(id === "metro" ? SHEET_VARS : {}) }, data: {} };
}

/** Paint an edition on an element (the <html>); returns the undo. */
export function paintEdition(el: HTMLElement, p: EditionPaint): () => void {
  for (const [k, v] of Object.entries(p.vars)) el.style.setProperty(k, v);
  for (const [k, v] of Object.entries(p.data)) el.setAttribute(k, v);
  return () => {
    for (const k of Object.keys(p.vars)) el.style.removeProperty(k);
    for (const k of Object.keys(p.data)) el.removeAttribute(k);
  };
}

/** The boot script's source (inline, before first paint): pick the edition the
 * same way pickEdition does, paint it, and show only that edition's boot
 * shell (the server renders one per edition, each under data-boot-for). */
export function editionBootScript(): string {
  const paints = Object.fromEntries(EDITION_IDS.map((id) => [id, editionPaint(id)]));
  return `(function(){try{var P=${JSON.stringify(paints)},d=document.documentElement,s=null;`
    + `try{s=localStorage.getItem(${JSON.stringify(EDITION_KEY)})}catch(e){}`
    + `var q=new URLSearchParams(location.search).get("edition"),`
    + `id=P.hasOwnProperty(q)?q:P.hasOwnProperty(s)?s:${JSON.stringify(DEFAULT_EDITION)},p=P[id],k;`
    + `d.setAttribute("data-edition",id);for(k in p.vars)d.style.setProperty(k,p.vars[k]);for(k in p.data)d.setAttribute(k,p.data[k]);`
    + `var st=document.createElement("style");st.textContent='[data-boot-for]:not([data-boot-for="'+id+'"]){display:none!important}';`
    + `document.head.appendChild(st)}catch(e){}})()`;
}
