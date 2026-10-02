// Every design in the playground, one entry each, so they can be judged apart:
// the six classic editions at /, the Network Atlas, the lab skins, the two
// painted maps and the anatomy diagrams. `shot` = the thumbnail's file stem
// under public/local/designs/ (built by scripts/designs.mjs, gitignored).
export interface Design {
  id: string;
  group: "Classic editions" | "Atlas" | "Lab skins" | "Painted maps" | "Diagrams";
  name: string;
  pitch: string;
  href: string;
  /** which page the thumbnail script shoots; lab skins copy their latest round instead */
  shoot: { kind: "url"; path: string } | { kind: "lab"; skin: string; state: string };
}

export const DESIGNS: Design[] = [
  { id: "blueprint", group: "Classic editions", name: "Blueprint", pitch: "Cyanotype periodic table of neural networks, white ink on blue.", href: "/?edition=blueprint", shoot: { kind: "url", path: "/?edition=blueprint" } },
  { id: "wallchart", group: "Classic editions", name: "Wall chart", pitch: "The same table as a printed classroom poster.", href: "/?edition=wallchart", shoot: { kind: "url", path: "/?edition=wallchart" } },
  { id: "terminal", group: "Classic editions", name: "Terminal", pitch: "Phosphor-green console, the table as a text screen.", href: "/?edition=terminal", shoot: { kind: "url", path: "/?edition=terminal" } },
  { id: "metro", group: "Classic editions", name: "Metro", pitch: "Transit-diagram lines connecting the families.", href: "/?edition=metro", shoot: { kind: "url", path: "/?edition=metro" } },
  { id: "atlas-edition", group: "Classic editions", name: "Atlas edition", pitch: "The table set as an atlas plate.", href: "/?edition=atlas", shoot: { kind: "url", path: "/?edition=atlas" } },
  { id: "paper-edition", group: "Classic editions", name: "Paper edition", pitch: "Manila city map: districts, lots, routes and a compass.", href: "/?edition=paper", shoot: { kind: "url", path: "/?edition=paper" } },
  { id: "atlas", group: "Atlas", name: "Network Atlas", pitch: "Full-screen editorial constellation of the 44-model graph.", href: "/atlas/", shoot: { kind: "url", path: "/atlas/" } },
  { id: "lab-paper", group: "Lab skins", name: "Papercraft", pitch: "Cut-paper storybook overworld on the lib/world geography.", href: "/lab/paper/", shoot: { kind: "lab", skin: "paper", state: "overview" } },
  { id: "lab-pixel", group: "Lab skins", name: "Pixel (code-drawn)", pitch: "Pixel map drawn in code from the reference geography.", href: "/lab/pixel/", shoot: { kind: "lab", skin: "pixel", state: "overview" } },
  { id: "lab-hybrid", group: "Lab skins", name: "Paper and pixels", pitch: "The papercraft map with RPG dialog boxes.", href: "/lab/hybrid/", shoot: { kind: "lab", skin: "hybrid", state: "overview" } },
  { id: "lab-flow", group: "Lab skins", name: "Kawaii flow", pitch: "Models as creatures on a dataflow board.", href: "/lab/flow/", shoot: { kind: "lab", skin: "flow", state: "overview" } },
  { id: "painted-pixel", group: "Painted maps", name: "Painted pixel map", pitch: "Your pixel map, four-corners UI, live data layer.", href: "/lab/painted/?map=pixel", shoot: { kind: "lab", skin: "painted", state: "t-overview" } },
  { id: "painted-paper", group: "Painted maps", name: "Painted paper map", pitch: "Your storybook painting, same four-corners UI.", href: "/lab/painted/?map=paper", shoot: { kind: "lab", skin: "painted", state: "paper-overview" } },
  { id: "anatomy", group: "Diagrams", name: "How it works", pitch: "Pixel mechanism diagrams drawn from real champion outputs.", href: "/lab/anatomy/?model=transformer", shoot: { kind: "url", path: "/lab/anatomy/?model=transformer&still=1" } },
];

export const DESIGN_GROUPS = ["Classic editions", "Atlas", "Lab skins", "Painted maps", "Diagrams"] as const;
