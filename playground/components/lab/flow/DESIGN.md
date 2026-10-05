# Kawaii DFD — design notes

A directed graph drawn as a calm data-flow sheet, in the manner of an IxDF DFD: boxes on a
strict grid, every edge an orthogonal ink line that never crosses, touches or hides behind
another, labels cut into the lines, whitespace doing the work. In the zoo, each box carries a
small creature (silhouette = family, face = evidence). That creature is the only playful note.

**Signature element: the router** (`lib/world/dfd.ts`). Every edge is drawn at rest, with one
weight, one elbow radius and an arrowhead at its own input port. The router guarantees 0
crossings, 0 overlaps, 0 box hits and no frames, and `dfd.test.ts` proves it. Lines between the
two halves, and any that would take the long way round, become labelled connector pairs.

## Tokens (`tokens.ts`: the one style source)

| group | values |
|---|---|
| COLOR | sheet `#FCFCFA` · card `#FFF` · ink `#2E2742` (every line and word) · inkSoft `#5D5672` · rule `#E4E1EA` · shelf `#F3F1F6` · head `#8A84A0` · accent `#2F5FD0` (the only accent) · gold `#E2A322` (champion) |
| FAMILY | per group: strip (a pastel fill, never text) · body (the creature's fill) · deep (packets) · label |
| TYPE | name 13 (the floor at overview scale 1) · tag 12 · label 11 · address 9.5 · index 12 · lane 13 · shelf 12 · head 12 · ui 13 · drawer 14/15/15 lede (500, not bold)/24 |
| BOX / RADIUS | box r 7 · strip 12 · atom cell 24 · pads 6/6/8 · ui 7 · panel 8 · sheet 14 · shelf 10 |
| STROKE | edge 1.5 · lit 2.2 · box 1.25 · selected 2.2 · tag 1 |
| SHADOW / OPACITY | panel, drawer, sheet · dim box 0.26 · dim edge 0.16 |
| MOTION (ms) | camera 520 · fade 180 · hop 620 / 520 stagger · packet 900 + 900 rest · drawer 240 |

`FLOW_CSS_VARS` mirrors these for `flow.module.css`. Geometry (track grid, box sizes, paddings,
text px) is the router's, re-exported. Type: M PLUS Rounded 1c 500/700/800; Mochiy Pop One, title.

## Layout grid

- **Desktop.** Two stacks of group lanes; inside a stack every generation (graph depth) is ONE
  column with one left x, and every box stands under its own generation's header. Rows on a
  64-px pitch (48-px box + a 16-px track gap; 56 when the sheet would exceed `maxHeight` 848).
  Margins 32 left (its one track sits 24 px in from the edge) / 16 right, gutters 40 (4 tracks),
  corridor 32 (no wire crosses it). Names wrap to two lines only while the sheet is wider than
  `maxWidth` (1424). Island nodes (no edges) are 40-px chips on the **shelf**, a tray across the
  top titled "Standalone atoms", ABOVE the column headers; a group made only of islands has no lane.
- **Phone.** One 376-px column of lanes, each a file tree (a node, then its brood, indented 16 px
  per generation); edges ride the side gutters; a sticky ruler (`0 1 2 3`) labels the indents.
- **Search.** Stack split, lane and row order, scored on the *finished* sheet: unplaced ≫ unlabelled
  ≫ wire + 600 per repair pair (+40 per sibling cut) + 200 per panel pair + 800 per frame.

## Rules the router keeps (and tests)

0. **Addresses count down the page.** An address is read off the finished sheet: atoms are
   numbered in reading order (the shelf, then the left stack and the right; lanes top → bottom),
   heirs in their parent's reading order, so every column (desktop) and file tree (phone) reads
   1.1, 1.2, … top to bottom. Addresses are per mode (graph-only addresses cost 5 detours).
1. Edges are orthogonal on the track grid, ≥ 8 px from every box. Vertical runs stay in
   gutters, and no line runs along a lane rule.
2. A fan-out is one Steiner tree per out-port (one bus with short taps). A child that lies wholly
   to the parent's left gets a second, left-side out-port.
3. **Detour rule.** A line is a detour when its route is longer than `DFD_DETOUR_MAX` (1.6) × the
   Manhattan distance between its box centres, or when it strays outside the stacks of its two
   ends. A detour, or a line that cannot be routed, becomes an **off-sheet connector pair**:
   a stub out of a free port on each box ends in a tag (the far end's address in bold + name,
   tinted with its family, tip along the flow); budget `DFD_OFFSHEET_MAX` (2). A pair never
   joins two boxes of one lane: `Router.salvage` first retries the line out of the parent's LEFT
   side round the margin track (the lane's left gutter; the sheet's edge is never a track).
   **Wires stay in their panel:** every line between the two stacks is a pair (`why: "panel"`,
   outside the budget). A parent's far ends share ONE out-tag, a line each; several children
   enter at a **hub** (a tag in a free grid cell of their stack feeding a routed comb). A pair
   whose tags find no spot is wired instead (and costs the arrangement).
4. **One inline label per trunk** names a parent in *another* group: "7 transformer". It goes on
   the run that most of the trunk's cross-group lines share. A line of 160 px or less needs no
   label, and a bare address is never printed (a hub's lines are named by the hub).
5. **No frames** (`framedBoxes`): one parent's runs must not draw a U whose open side other line
   work closes, round boxes: that reads as a group the data does not have. A frame costs the
   sheet; a repair pass moves the box at either end of the frame's base to another free row.
   (Where a parent and one of its children both feed two stacked boxes, an open U is forced by
   planarity: the zoo's transformer comb under kimi and deepseek.)

## Components (by role)

| file | draws / owns |
|---|---|
| `board.tsx` | data in, lineage lighting, URL views, docking (the page) |
| `sheet.tsx` | shelf, lanes and headers; decides what is lit or dimmed; composes the parts below |
| `box.tsx` | one node: process (strip + address) / store (index cell) / chip |
| `edges.tsx` | `Edges` (at rest and lit), `Labels` (gaps), `Connectors` (stubs, bundle and hub tags, each drawn once) |
| `critter.tsx` | creature (silhouette + face) and the evidence mark |
| `top-bar.tsx`, `legend.tsx` | title bar (back link, keeper, title, Key, Pipelines, Find) and the key popover |
| `use-camera.ts` | overview / region / node framing, drag, wheel |
| `ruler.tsx`, `drawer.tsx`, `packets.tsx` | phone generation ruler; detail drawer; packets riding the lit lineage |
| `pipelines.tsx`, `keeper.tsx` | composition list and caption; the keeper egg |
| `use-dfd.ts` | measures the real font, runs `buildDfd` once per graph on an idle frame |
| `encoding.ts` | **every mark → the data it encodes** (the full table lives there) |

**Views.** `overview` fits the sheet; `region` frames the focus's lane (a chip: the shelf); `node`
frames selection + ancestors + children left of the drawer, down to scale 0.85.

**Motion.** The camera eases between views; packets ride the lit lineage (roots first); the
Konami pass hops each generation. All frozen at frame 0 under `?still=1` / reduced motion.
**Loading.** `board.tsx`'s status line ("Waiting for the zoo's API…" / "Routing the sheet…")
carries `labLoading(loadPhase(…))` over the sheet and its title bar.

## Lifting it into another project

1. **Copy these files:**
   - `lib/world/dfd.ts` + `graph.ts`, `rng.ts`, `types.ts`, `constants.ts` (pure TS, no DOM);
     `graph.ts` reads `lib/blueprint.ts` only for group order (stub `FAMILY_BLOCKS`/`ATOMS`);
   - this folder's `tokens.ts`, `box.tsx`, `edges.tsx`, `sheet.tsx`, `critter.tsx`,
     `flow.module.css` and `use-dfd.ts`, with `lib/copy.ts` (names) and `lib/lab-contract.ts`.

   `/lab/flow/specimen` is the smallest working page.
2. **The data shape:**

   ```ts
   const layout = buildDfd({ models: [{ name: "parser", builds_on: ["lexer"] }, { name: "lexer", builds_on: [] }] },
     { parser: "frontend", lexer: "frontend" },   // node → group (one lane per group)
     { mode: "desktop", measure });               // measure(text, px) → width; optional
   ```

   Groups follow `FAMILY_BLOCKS` order when known, then go by name; `_` in a name is drawn as
   a space. `layout.audit` must read 0/0/0. Render with `<Sheet layout={layout} st={…} />`, or
   with the parts alone, as the specimen does.
3. **Replace these:** `FAMILY` in `tokens.ts` (your groups' pastels and labels); the `Body`
   shapes in `critter.tsx` (or drop the creature and widen `DFD_PAD`); `evidenceState` (the
   per-node status the face and strip mark read); the drawer's content.

   Keep the router's constants unless you re-run `dfd.test.ts`.
