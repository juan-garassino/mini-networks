// The playground's designs: eight designs, one layout idea and one shared
// component, fifteen pages in all. A design can have variants (skins of the
// same idea); each variant is its own page, judged on its own. `id` doubles as
// the thumbnail's file stem under public/local/designs/ (built live by
// scripts/designs.mjs from `shot`, gitignored).
//
// Board order is deliberate: designs with several variants first (each a full
// band), then the single-page designs as one 2-up grid, then the extras — so
// every row of the /lab/designs board fills edge to edge.
export interface Variant {
  id: string;
  name: string;
  pitch: string;
  href: string;
  /** the URL the thumbnail script shoots (a frozen, still=1 view of href) */
  shot: string;
}

export interface Design {
  id: string;
  kind: "design" | "layout";
  name: string;
  pitch: string;
  variants: Variant[];
}

export const DESIGNS: Design[] = [
  {
    id: "table", kind: "design", name: "Periodic table", pitch: "The 44 models as elements in a periodic table. Three skins of one chart.",
    variants: [
      { id: "blueprint", name: "Blueprint", pitch: "Cyanotype, white ink on blue.", href: "/?edition=blueprint", shot: "/?edition=blueprint" },
      { id: "wallchart", name: "Wall chart", pitch: "A printed classroom poster.", href: "/?edition=wallchart", shot: "/?edition=wallchart" },
      { id: "terminal", name: "Terminal", pitch: "Phosphor-green console text.", href: "/?edition=terminal", shot: "/?edition=terminal" },
    ],
  },
  {
    id: "paper-maps", kind: "design", name: "Paper maps", pitch: "The zoo as a painted or cut-paper world: six lands joined by roads.",
    variants: [
      { id: "painted-paper", name: "Painted paper map", pitch: "Your storybook painting with the four-corners UI and live data.", href: "/lab/painted/?map=paper", shot: "/lab/painted/?map=paper&zoom=overview&still=1" },
      { id: "lab-paper", name: "Papercraft, drawn in code", pitch: "Cut-paper storybook on the lib/world geography.", href: "/lab/paper/", shot: "/lab/paper/?zoom=overview&still=1" },
      { id: "lab-hybrid", name: "Paper and pixels", pitch: "The papercraft map with RPG dialog boxes.", href: "/lab/hybrid/", shot: "/lab/hybrid/?zoom=overview&still=1" },
      { id: "paper-edition", name: "Manila city map", pitch: "Districts, lots, routes and a compass.", href: "/?edition=paper", shot: "/?edition=paper" },
    ],
  },
  {
    id: "pixel-maps", kind: "design", name: "Pixel maps", pitch: "The same world in contemporary pixel art.",
    variants: [
      { id: "painted-pixel", name: "Painted pixel map", pitch: "Your pixel map with the four-corners UI and live data.", href: "/lab/painted/?map=pixel", shot: "/lab/painted/?map=pixel&zoom=overview&still=1" },
      { id: "lab-pixel", name: "Pixel, drawn in code", pitch: "Drawn in code from the reference geography.", href: "/lab/pixel/", shot: "/lab/pixel/?zoom=overview&still=1" },
    ],
  },
  {
    id: "plates", kind: "design", name: "Atlas plates", pitch: "Every model an engraved plate in a naturalist's atlas.",
    variants: [
      { id: "atlas-edition", name: "Atlas plates", pitch: "Plate grid with specimen captions.", href: "/?edition=atlas", shot: "/?edition=atlas" },
    ],
  },
  {
    id: "constellation", kind: "design", name: "Network Atlas", pitch: "The relationship graph as a full-screen editorial chart with a detail rail.",
    variants: [
      { id: "atlas", name: "Network Atlas", pitch: "Graph as a star chart with a detail rail.", href: "/atlas/", shot: "/atlas/" },
    ],
  },
  {
    id: "flow", kind: "design", name: "Kawaii flow", pitch: "Models as little creatures on a dataflow board, in depth × family lanes.",
    variants: [
      { id: "lab-flow", name: "Kawaii flow", pitch: "Depth × family lanes.", href: "/lab/flow/", shot: "/lab/flow/?zoom=overview&still=1" },
    ],
  },
  {
    id: "sky", kind: "design", name: "Star atlas", pitch: "An antique celestial chart: families are constellations, models are stars.",
    variants: [
      { id: "lab-sky", name: "The Celestial Zoo", pitch: "Indigo night, gold figures, lineage as constellation lines.", href: "/lab/sky/", shot: "/lab/sky/?zoom=overview&still=1" },
    ],
  },
  {
    id: "transit", kind: "layout", name: "Transit layout", pitch: "Lineage as transit lines: a layout the maps' roads could borrow.",
    variants: [
      { id: "metro", name: "Transit diagram", pitch: "Families as lines, models as stations.", href: "/?edition=metro", shot: "/?edition=metro" },
    ],
  },
];

/** Not a design: the mechanism diagrams every map's card opens. */
export const DIAGRAMS: Variant = {
  id: "anatomy", name: "How it works", pitch: "Pixel mechanism diagrams drawn from real champion outputs, opened from every map's card.",
  href: "/lab/anatomy/?model=transformer", shot: "/lab/anatomy/?model=transformer&still=1",
};

export const ALL_VARIANTS: Variant[] = [...DESIGNS.flatMap((d) => d.variants), DIAGRAMS];
