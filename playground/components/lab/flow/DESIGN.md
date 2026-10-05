# Kawaii DFD — design notes

A directed graph drawn as a calm data-flow sheet, in the manner of an IxDF DFD: boxes on a
strict grid, every edge an orthogonal ink line that never crosses, touches or hides behind
another, labels cut into the lines, whitespace doing the work. In the zoo, each box carries a
small creature (silhouette = family, face = evidence). That creature is the only playful note.

**Signature element: the router** (`lib/world/dfd.ts`). Every edge is drawn at rest, with one
weight, one elbow radius and an arrowhead at its own input port. The router guarantees 0
crossings, 0 overlaps and 0 box hits, and `dfd.test.ts` proves it. Any line that would take the
long way round becomes a labelled connector pair instead.

## Tokens (`tokens.ts`: the one style source)

| group | values |
|---|---|
| COLOR | sheet `#FCFCFA` · card `#FFF` · ink `#2E2742` (every line and word) · inkSoft `#5D5672` · rule `#E4E1EA` · head `#8A84A0` · accent `#2F5FD0` (the only accent: selection and lit lineage) · gold `#E2A322` (champion) |
| FAMILY | per group: strip (a pastel fill, never text) · body (the creature's fill) · deep (packets) · label |
| TYPE | name 13 (the floor at overview scale 1) · tag 12 · label 11 · address 9.5 · index 12 · lane 13 · head 12 · ui 13 · drawer 14/15/17/24 |
| BOX / RADIUS | box r 7 · strip 12 · atom cell 24 · pads 6/6/8 · ui 7 · panel 8 · sheet 14 |
| STROKE | edge 1.5 · lit 2.2 · box 1.25 · selected 2.2 · tag 1 |
| SHADOW / OPACITY | panel, drawer, sheet · dim box 0.26 · dim edge 0.16 |
| MOTION (ms) | camera 520 · fade 180 · hop 620 / 520 stagger · packet 900 + 900 rest · drawer 240 |

`FLOW_CSS_VARS` mirrors these for `flow.module.css` (no literals there). Geometry (8-px track
grid, box heights, paddings, name/label/tag px) is the router's; `tokens.ts` re-exports it. Type:
M PLUS Rounded 1c (`--flow-body`, 500/700/800); Mochiy Pop One for the page title only.

## Layout grid

- **Desktop.**
  - The sheet has two stacks of group lanes. Inside a stack, every generation (graph depth) is
    ONE column with one left x.
  - Rows sit on a 64-px pitch (48-px box + one 16-px track gap). The pitch drops to 56 when the
    sheet would exceed `maxHeight` (848).
  - Margins are 16 px, gutters 40 px (4 tracks), and the corridor between the stacks is 48 px.
  - Names wrap to two lines only while the sheet is wider than `maxWidth` (1424).
  - Island nodes (no edges) are 40-px chips on the lane's title row.
- **Phone.**
  - One 376-px column. Lanes are stacked, and each lane is a file tree: every node is directly
    followed by its brood and indented 16 px per generation.
  - Edges ride the left or right gutter.
  - A sticky ruler (`0 1 2 3 generation`) labels the indents.
- **Search.** The search chooses the stack split, lane order and row order. Desktop candidates
  are scored on the *finished* sheet: unplaced edges ≫ unlabelled ≫ wire + 600 px per
  connector pair + 40 px for each sibling line that pair cuts from a comb.

## Rules the router keeps (and tests)

1. Edges are orthogonal on the track grid, ≥ 8 px from every box. Vertical runs stay in
   gutters, and no line runs along a lane rule.
2. A fan-out is one Steiner tree per out-port (one bus with short taps). A child that lies wholly
   to the parent's left gets a second, left-side out-port.
3. **Detour rule.** A line is a detour when its route is longer than `DFD_DETOUR_MAX` (1.6) × the
   Manhattan distance between its box centres, or when it strays outside the stacks of its two
   ends. A detour, or a line that cannot be routed, becomes an **off-sheet connector pair**:
   - a stub leaves a free port on each box and ends in a tag;
   - the tag shows the far end's address (bold) and name, and is tinted with its family;
   - the tag's tip points along the flow;
   - the budget is `DFD_OFFSHEET_MAX` (2).
4. **One inline label per trunk** names a parent in *another* group: "4 transformer". It goes on
   the run that most of the trunk's cross-group lines share. A line of 160 px or less needs no
   label, and a bare address is never printed.

## Components (by role)

| file | draws / owns |
|---|---|
| `board.tsx` | data in, lineage lighting, URL views, docking (the page) |
| `sheet.tsx` | lanes and headers, and decides what is lit or dimmed; composes the parts below |
| `box.tsx` | one node: process (strip + address) / store (index cell) / chip |
| `edges.tsx` | `Edges` (at rest and lit), `Labels` (gaps), `Connectors` (stubs and tags) |
| `critter.tsx` | creature (silhouette + face) and the evidence mark |
| `top-bar.tsx`, `legend.tsx` | title bar and key |
| `use-camera.ts` | overview / region / node framing, drag, wheel |
| `ruler.tsx` | phone generation ruler |
| `drawer.tsx`, `packets.tsx` | detail drawer; packets riding the lit lineage |
| `pipelines.tsx`, `keeper.tsx` | composition list and caption; the keeper egg |
| `use-dfd.ts` | measures the real font, runs `buildDfd` once per graph on an idle frame |
| `encoding.ts` | **every mark → the data it encodes** (the full table lives there) |

## Motion

The camera eases between views; packets ride the lit lineage into a selection (roots first);
the Konami pass hops each generation. All frozen at frame 0 under `?still=1` / reduced motion.

## Lifting it into another project

1. **Copy these files:**
   - `lib/world/dfd.ts`, plus `graph.ts`, `rng.ts`, `types.ts` and `constants.ts` from
     `lib/world/` (the router is pure TS, with no DOM). `graph.ts` reads `lib/blueprint.ts`
     only for the zoo's group order and atom families; stub `FAMILY_BLOCKS`/`ATOMS` with your
     own, or leave them empty;
   - this folder's `tokens.ts`, `box.tsx`, `edges.tsx`, `sheet.tsx`, `critter.tsx`,
     `flow.module.css` and `use-dfd.ts`.

   `/lab/flow/specimen` is the smallest working page.
2. **The data shape:**

   ```ts
   const layout = buildDfd(
     { models: [{ name: "parser", builds_on: ["lexer"] }, { name: "lexer", builds_on: [] }] },
     { parser: "frontend", lexer: "frontend" },        // node → group (one lane per group)
     { mode: "desktop", measure },                     // measure(text, px) → width; optional
   );
   ```

   - Groups follow `FAMILY_BLOCKS` order when they are known, then go by name.
   - Names may use `_`, which is drawn as a space.
   - `layout.audit` must read 0/0/0. Render it with `<Sheet layout={layout} st={…} />`, or with
     the parts alone, as the specimen does.
3. **Replace these:**
   - `FAMILY` in `tokens.ts`: your groups' pastels and labels.
   - The `Body` shapes in `critter.tsx`: your glyph per group. Alternatively, drop the creature
     and widen `DFD_PAD`.
   - `evidenceState`: whatever per-node status you show. The face and the strip mark read it.
   - The drawer's content.

   Keep the router's constants unless you re-run `dfd.test.ts`: they keep the line work clean.
