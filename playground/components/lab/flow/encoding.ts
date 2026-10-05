// Every visual mark of skin D (Kawaii DFD) and the data it encodes, in the
// library's one shape (lib/encoding.ts): name → { mark (how it is drawn),
// encodes, source, kind }. Anything drawn that is not in this table must be cut.
import { defineEncoding } from "../../../lib/encoding.ts";

export const ENCODING = defineEncoding({
  // ——— the grid
  "grid (desktop)": {
    mark: "box position (desktop): two stacks of family lanes; inside a stack every generation is ONE column whose boxes share one left x across all its lanes; rows on a uniform 64-px pitch (56 when the sheet would not fit)",
    encodes: "lane = family, column = generation depth (Atoms, Gen 1…), row = order chosen so lines need not cross; only models with lines are on the grid",
    source: "lib/world/dfd.ts sheetDesktop + orderDesktop (stack split + lane order searched, scored by the finished sheet)",
  },
  "grid (phone)": {
    mark: "box position (phone): one column of boxes between two routing gutters; lanes stacked; inside a lane a file tree (each model directly followed by its brood), indented 16 px per generation",
    encodes: "family lane; parent → brood by reading order; indent = generation",
    source: "lib/world/dfd.ts phoneSheet (pre-order walk of the primary-parent tree)",
  },
  "generation ruler": {
    mark: "generation ruler (phone, sticky under the top bar): digits 0 1 2 3 over the indents",
    encodes: "which indent is which generation (0 = atom)",
    source: "layout.headers (phone)",
    kind: "chrome",
  },
  "lane rule": {
    mark: "swim-lane rule + lane name and count (\"Perception 15\")",
    encodes: "family lane and how many models it holds",
    source: "graph.membersOf",
  },
  "column header": {
    mark: "column header row (Atoms / Gen 1 / Gen 2 / Gen 3), desktop",
    encodes: "generation depth of the column under it, aligned in both stacks",
    source: "graph.depth",
    kind: "chrome",
  },
  // ——— boxes
  "store box": {
    mark: "store box: a left index cell in the family pastel holding a number",
    encodes: "atom (depth 0, starts a lineage); the number is its lineage address, counted in reading order (left stack then right, lanes top → bottom, chips first), so atom numbers count down the page",
    source: "sheetAddresses() → lineageAddresses(g, reading order)",
  },
  chip: {
    mark: "chip: a smaller store (40 px, 22-px creature) on the lane's title row, right of the lane name, left-aligned to a column x for order only; the caption \"standalone atoms\" under the lane name",
    encodes: "an atom nothing builds on yet (no edges in or out): it starts no line, so it does not take a grid row — and the column header above it does not apply to it",
    source: "isIsland() + DFD_SHELF_TEXT in lib/world/dfd.ts",
  },
  "process box": {
    mark: "process box: a family-pastel header strip holding an address like 4.1.2",
    encodes: "derived model; the address is its primary-parent chain (4.1.2 = 2nd heir of 4.1, which is the 1st heir of atom 4); heirs are numbered in reading order, so inside a lane every column (desktop) and the file tree (phone) count down the page",
    source: "sheetAddresses() over primary parents (tested: dfd.test.ts \"addresses count down the page\")",
  },
  "pastel tint": {
    mark: "pastel tint of the strip / index cell",
    encodes: "family (mint perception, sky sequence, peach generative, lavender representation, butter structure, pink decision)",
    source: "graph.family",
  },
  "creature silhouette": {
    mark: "creature silhouette (eyeball with lashes, token caterpillar, egg, mirror twins, crystal, dice bot)",
    encodes: "family",
    source: "graph.family",
  },
  "creature face": {
    mark: "creature face: happy arcs + open smile / dot eyes + smile / dot eyes + wobbly mouth + sweat drop / closed eyes on a paler body",
    encodes: "evidence: champion / trained locally / provisional quality bar / not trained yet",
    source: "evidenceState(/web/evidence)",
  },
  "evidence mark": {
    mark: "evidence mark at the strip's right end (gold star / ink dot / half disc / dashed ring)",
    encodes: "the same evidence state, readable at a glance in the header",
    source: "evidenceState()",
  },
  "box name": {
    mark: "model name in the box (13 px, one or two lines)",
    encodes: "model name as words",
    source: "taxonomy.models[].name",
  },
  // ——— edges
  edge: {
    mark: "edge: one ink line, one weight, orthogonal with rounded elbows of one radius, filled arrowhead at its own input port on the child",
    encodes: "a builds_on edge, parent → child; ALL edges drawn at rest, none crossing, touching or running on another parent's line, none within one track of a box (audited: data-crossings / data-overlaps on the board)",
    source: "lib/world/dfd.ts router + auditDfd",
  },
  trunk: {
    mark: "a shared trunk that splits on rounded T-junctions",
    encodes: "one parent's fan-out to several children",
    source: "router: one Steiner tree per parent",
  },
  "inline label": {
    mark: "inline label in a gap cut into the line (\"4 transformer\"), ONE per trunk (the lines leaving one out-port), on the run most of its cross-family lines share; on a vertical gutter line the text is turned to read up the line",
    encodes: "the trunk's parent sits in ANOTHER family: its address and name; a cross-family line ≤ 160 px needs none (its parent is at the other end)",
    source: "placeLabels() on cross-family trunks",
  },
  "back line": {
    mark: "a line leaving a box's LEFT side",
    encodes: "a second trunk for children wholly to the left (the other stack): the backward line crosses straight over",
    source: "Router.outOpts (back)",
  },
  "margin line": {
    mark: "a line leaving an atom's LEFT side and riding the 8-px margin track (the lane's left gutter)",
    encodes: "a same-lane child the parent's own comb cannot reach without a crossing (the zoo: transformer → text diffusion, past mamba's line): one clean elbow instead of a connector pair inside one lane",
    source: "Router.salvage",
  },
  "connector pair": {
    mark: "off-sheet connector pair: a short stub out of a free port on each end, ending in a tag (address bold + name) whose tip points along the flow; the tag is tinted with the far end's family; the in-end's stub carries the arrowhead",
    encodes: "a line that would detour (routed > 1.6 × the Manhattan distance between the box centres, or straying outside its two stacks) or could not route at all; the tag names the far end (budget 2, never inside one lane; the zoo: audio spectrogram → audio transformer on desktop, diffusion → text diffusion on the phone)",
    source: "finish() + placePair() in lib/world/dfd.ts (DFD_DETOUR_MAX, DFD_OFFSHEET_MAX)",
  },
  // ——— interaction
  "lit lineage": {
    mark: "accent lines + full-strength boxes, everything else faded",
    encodes: "the hovered / focused / selected model, all its ancestors with the edges between them, and its children",
    source: "builds_on closure",
    kind: "interaction",
  },
  "selection outline": {
    mark: "accent outline + halo on a box",
    encodes: "the selected model (?zoom=node&focus=)",
    source: "url-state",
    kind: "interaction",
  },
  "pipeline members": {
    mark: "accent outline + numbered disc on a box's corner, other boxes faded",
    encodes: "a pipeline being shown: its members in order",
    source: "taxonomy.compositions[].composes",
    kind: "interaction",
  },
  "pipeline caption": {
    mark: "pipeline caption plate (bottom-left)",
    encodes: "what the shown pipeline does",
    source: "COMPOSITION_LESSONS",
    kind: "chrome",
  },
  packet: {
    mark: "packet: a small rounded square riding a lit line",
    encodes: "data flowing from an ancestor into the selected model, one generation after another (roots first); tint = the family it leaves",
    source: "lineage hop counts; frozen at frame 0 under ?still=1 / reduced motion",
    kind: "motion",
  },
  drawer: {
    mark: "drawer (desktop: docked right, full height; phone: bottom sheet ≤ 55%)",
    encodes: "the selected model: what it is, one forward pass, family line, proof it works, pipelines",
    source: "cardModel, useLesson, anatomy2 / schematics, /web/evidence",
    kind: "chrome",
  },
  "evidence meter": {
    mark: "evidence meter in the drawer (track + bar tick)",
    encodes: "best local metric vs the M-tier bar; dashed track = no local score yet",
    source: "/web/evidence best_metric, threshold_m",
  },
  key: {
    mark: "key: a popover behind the top bar's 'Key' button (desktop and phone), with the faces; its cross-family sample is the sheet's own first inline label",
    encodes: "legend for every mark above",
    source: "legend.tsx, this table",
    kind: "chrome",
  },
});

// Easter eggs (shared logic: components/lab/shared/eggs/README.md).
export const EGGS = defineEncoding({
  "grokking bubble": {
    mark: "grokking's bubble",
    encodes: "hover or focus grokking: it says it is memorising; hold 4 s and it 'clicks' (the paper's finding, labelled as an illustration)",
    source: "useLongFocus, GROKKING_EGG",
    kind: "interaction",
  },
  keeper: {
    mark: "the keeper in the top bar trains after 7 pokes",
    encodes: "a REAL clearly-falling loss curve from a local run, drawn live; hidden if no run qualifies",
    source: "useCritterClicks, useRealLossCurve",
    kind: "interaction",
  },
  "konami forward pass": {
    mark: "Konami forward pass",
    encodes: "↑↑↓↓←→←→BA: each generation's boxes hop in turn, atoms first",
    source: "useKonami, forwardPassOrder/Schedule",
    kind: "motion",
  },
});
