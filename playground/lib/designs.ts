// The playground's designs, seven links: six designs and one layout idea.
// A design can have variants (skins of the same idea); each variant is its own
// page, judged on its own. `id` doubles as the thumbnail's file stem under
// public/local/designs/ (built by scripts/designs.mjs, gitignored).
export interface Variant {
  id: string;
  name: string;
  pitch: string;
  href: string;
  /** what the thumbnail script shoots; lab skins copy their latest round instead */
  shoot: { kind: "url"; path: string } | { kind: "lab"; skin: string; state: string };
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
    id: "table", kind: "design", name: "Periodic table", pitch: "The 44 models as elements in a periodic table, three skins of one chart.",
    variants: [
      { id: "blueprint", name: "Blueprint", pitch: "Cyanotype, white ink on blue.", href: "/?edition=blueprint", shoot: { kind: "url", path: "/?edition=blueprint" } },
      { id: "wallchart", name: "Wall chart", pitch: "A printed classroom poster.", href: "/?edition=wallchart", shoot: { kind: "url", path: "/?edition=wallchart" } },
      { id: "terminal", name: "Terminal", pitch: "Phosphor-green console text.", href: "/?edition=terminal", shoot: { kind: "url", path: "/?edition=terminal" } },
    ],
  },
  {
    id: "plates", kind: "design", name: "Atlas plates", pitch: "Every model an engraved plate in a naturalist's atlas.",
    variants: [
      { id: "atlas-edition", name: "Atlas plates", pitch: "Plate grid, specimen captions.", href: "/?edition=atlas", shoot: { kind: "url", path: "/?edition=atlas" } },
    ],
  },
  {
    id: "constellation", kind: "design", name: "Network Atlas", pitch: "Full-screen editorial constellation of the relationship graph.",
    variants: [
      { id: "atlas", name: "Network Atlas", pitch: "Graph as a star chart with a detail rail.", href: "/atlas/", shoot: { kind: "url", path: "/atlas/" } },
    ],
  },
  {
    id: "flow", kind: "design", name: "Kawaii flow", pitch: "Models as little creatures on a dataflow board; tensors parade from the ancestors.",
    variants: [
      { id: "lab-flow", name: "Kawaii flow", pitch: "Depth × family lanes.", href: "/lab/flow/", shoot: { kind: "lab", skin: "flow", state: "overview" } },
    ],
  },
  {
    id: "paper-maps", kind: "design", name: "Paper maps", pitch: "The zoo as a painted or cut-paper world, six lands and roads.",
    variants: [
      { id: "painted-paper", name: "Painted paper map", pitch: "Your storybook painting, four-corners UI, live data.", href: "/lab/painted/?map=paper", shoot: { kind: "lab", skin: "painted", state: "paper-overview" } },
      { id: "lab-paper", name: "Papercraft (code-drawn)", pitch: "Cut-paper storybook on the lib/world geography.", href: "/lab/paper/", shoot: { kind: "lab", skin: "paper", state: "overview" } },
      { id: "lab-hybrid", name: "Paper and pixels", pitch: "The papercraft map with RPG dialog boxes.", href: "/lab/hybrid/", shoot: { kind: "lab", skin: "hybrid", state: "overview" } },
      { id: "paper-edition", name: "Manila city map", pitch: "Districts, lots, routes and a compass.", href: "/?edition=paper", shoot: { kind: "url", path: "/?edition=paper" } },
    ],
  },
  {
    id: "pixel-maps", kind: "design", name: "Pixel maps", pitch: "The same world in contemporary pixel art.",
    variants: [
      { id: "painted-pixel", name: "Painted pixel map", pitch: "Your pixel map, four-corners UI, live data.", href: "/lab/painted/?map=pixel", shoot: { kind: "lab", skin: "painted", state: "t-overview" } },
      { id: "lab-pixel", name: "Pixel (code-drawn)", pitch: "Drawn in code from the reference geography.", href: "/lab/pixel/", shoot: { kind: "lab", skin: "pixel", state: "overview" } },
    ],
  },
  {
    id: "transit", kind: "layout", name: "Transit layout", pitch: "Lineage as transit lines, a layout the maps' roads could borrow.",
    variants: [
      { id: "metro", name: "Transit diagram", pitch: "Families as lines, models as stations.", href: "/?edition=metro", shoot: { kind: "url", path: "/?edition=metro" } },
    ],
  },
];

/** Not a design: the mechanism diagrams every map's card opens. */
export const DIAGRAMS: Variant = {
  id: "anatomy", name: "How it works", pitch: "Pixel mechanism diagrams drawn from real champion outputs.",
  href: "/lab/anatomy/?model=transformer", shoot: { kind: "url", path: "/lab/anatomy/?model=transformer&still=1" },
};

export const ALL_VARIANTS: Variant[] = [...DESIGNS.flatMap((d) => d.variants), DIAGRAMS];
