# Playground bake-off — four designed skins on one world contract

**Date:** 2026-09-28 · **Status:** approved (brainstorming + plan), executing on `feat/playground-bakeoff`
**Supersedes:** the paper edition (`2026-09-12-paper-edition-design.md`) and the six-edition toggle, once a winner is picked.

## Why

A vision audit of the running playground found that every edition *looks random*:
positions, colours and roads encode nothing; the paper overworld squeezes 44 nodes onto
a rigid road grid pasted onto blobs with ~9px labels, props covering nodes, composition
"routes" drawn as dashed rectangles, the map overflowing its frame, and flat 1px clip-art
where the reference (Paper Mario: Sticker Star overworld) gets its charm from paper
thickness, texture, a zoomed camera and saturated colour. Templated tics everywhere:
ALL-CAPS tracked labels, `A · B · C` meta strings, fake "SHT 01" numbering. Plus a real
bug: `AnimatePresence mode="wait"` keyed on sheet+edition freezes to a blank sheet.

## Decisions (user)

- Four prototypes as a **bake-off**, each a **vertical slice on real data** at its own route;
  built by parallel subagents that iterate with **vision** (headless screenshots).
- The **winner replaces all six editions and `/atlas`**; losers are deleted.
- Audience: **learners exploring the zoo**. Success: find any model in <10s, read its lineage
  by following roads, see proof it works in one click. Every mark encodes data.
- No Nintendo IP — original critters only. No binary assets in git. Light rendering (slow Intel Mac).

## The world contract (shared by all skins)

One pure module, `playground/lib/world/`, turns taxonomy + family map + evidence into
positions. Skins only paint; **no renderer invents a position**.

Family membership = `lib/blueprint.ts` PLACEMENT column → FAMILY_BLOCKS (curated; vit is
perception, rlhf/dpo/grpo decision, clip/dino representation). Unknown future models fall
back to their ATOMS family, else first parent's family (recursive).

Live data facts (2026-09-28): 44 models (16 atoms, 28 derived), 41 `builds_on` edges, max
depth 3, 22 compositions. Family sizes: perception 15, sequence 12, decision 6, generative 5,
representation 4, structure 2. Hubs: transformer 13 children, classifier ~8. Exactly **8
cross-family edges** — perception–sequence ×3 (vit, sam, audio_transformer),
sequence–representation (clip), sequence–decision (rlhf), sequence–generative
(text_diffusion), perception–representation (dino), perception–generative
(tabular_diffusion). Structure has none (→ an islet).

| Map element | Encodes |
|---|---|
| Region | family; area ∝ model count; partner families share a border |
| Landmark node (large) | atom (16) — root of its region |
| Standard node | derived model (28) |
| Road | `builds_on` edge; road distance from the atom ∝ generation |
| Bridge | cross-family edge (8) |
| Flag / face | evidence from `/web/evidence`: champion / has runs / provisional bar |
| Ferry route | composition — drawn only when selected |
| Set-piece | one per region (its signature mechanism); decor only in free cells |

Flow layout (skin D): columns = generation depth 0–3, lanes = families, pipes = `builds_on`.

### Geographic algorithm — `buildWorld(tax, fam, opts?)`

Files (flat; every relative import ends in `.ts`, no `@/`): `types.ts`, `constants.ts`
(every tunable, commented), `rng.ts` (fnv1a, mulberry32, hashed value-noise), `graph.ts`
(sorted models, family, depth, primary parent, `warnings`), `grid.ts` (index helpers, BFS
distance transform, octilinear A* over (tile, dir)), `regions.ts`, `place.ts`, `roads.ts`,
`labels.ts`, `decor.ts`, `world.ts` (`buildWorld`, `pathToAtom`, `ferryRoute`),
`flow.ts` (`buildFlow`), `path.ts` (`roundedD(points,r)`, `samplePolyline(points) → {length, at(t)}`),
`__fixtures__/taxonomy.json` (live snapshot), `world.test.ts`, `flow.test.ts`.

Key types:

```ts
type Pt = { x: number; y: number };  type Box = Pt & { w: number; h: number };
type FamilyMap = Record<string, string>;
interface World { cols; rows; tile: 16; terrain: Uint8Array /*SEA,LAND,COAST,RIVER,ROAD,BRIDGE,FOOT,SETPIECE*/;
  regionOf: Int8Array; regions: Region[]; nodes: WorldNode[]; roads: Road[]; bridges: Bridge[];
  labels: Label[]; decor: Decor[]; seaSlots: Box[]; camera: CameraAnchors; warnings: string[] }
interface Region { family; id; islet: boolean; tiles: number; targetTiles; seed: Pt; setPiece: Box|null; bbox: Box }
interface WorldNode { name; family; depth; atom: boolean; primary: string|null; foot: Box /*tiles*/; center: Pt /*px*/ }
interface Road { id; from; to; kind: "primary"|"secondary"|"bridge"; tiles: number[]; points: Pt[]; length }
interface Bridge { roadId; tiles: number[]; axis: "h"|"v"; regions: [string,string] }
interface Label { node; text; font: 13|15; box: Box; anchor: "S"|"N"|"E"|"W"|"SE"|"NE"|"SW"|"NW" }
interface Decor { tile; region; variant: number; scale: number }
interface CameraAnchors { world: Box; regions: Record<string,Box>; nodes: Record<string,{ focus: Pt; box: Box }> }
interface FlowLayout { width; height; lanes: {family;y;h}[]; columns: {depth;x}[];
  nodes: {name;family;depth;lane;col;order;box:Box}[]; pipes: {from;to;points:Pt[];length;crossLane:boolean}[]; crossings }
```

0. **Graph.** depth = 1+max(parent depth). Primary parent = same-family parent, else deepest,
   else first listed. A family with zero cross-family edges becomes an islet (data-derived).
1. **Regions.** Target tiles = `42·max(n,4)+20`. Grid 4:3 sized for 62% land (~66×50).
   Authored seed fractions (the *only* authored layout): sequence (.52,.50) centre,
   perception (.20,.50) W, representation (.47,.17) N, generative (.47,.84) S, decision (.82,.50) E,
   structure islet (.88,.14); unknown families take spare islet slots. This satisfies all 6
   required adjacencies. Simultaneous growth from one global min-heap over 4-neighbours,
   cost `dist(tile,seed)/sqrt(target) + 0.15·noise`, tie-break (region idx, tile idx), stop at
   target; 2-tile sea margin; 2-tile moat around islets. Fill enclosed sea holes <12 tiles.
   A tile is RIVER if a 4-neighbour belongs to a higher-id region (1-tile river borders).
   COAST = land touching sea.
2. **Atoms** (4×4 footprint): candidates at edge-distance ≥3; maximise
   `2·min(edgeDist,5) + dist to placed atoms − 0.3·mean dist to borders needed by cross-family descendants`.
3. **Derived** (2×2), ordered by (depth, primary's child count desc, name); minimise
   `(d(primary) − 6k)²/6 + 0.5·d(same-family secondaries)/6 + 1.5·d(border with each cross-family parent region)/6 + 2·[within 35° of a sibling's bearing] + 0.2·noise(tile, hash(name))`
   (k = depth difference). Hard: inside region, edge-dist ≥1, ≥3-tile gap to all footprints.
4. **Set-piece:** 6×5 if region ≥400 tiles else 4×4 (fallback 3×3, else null); ≥2 tiles from
   footprints, off every node→parent line (1-tile buffer); pick max edge-distance.
5. **Roads:** A* over (tile, dir), 8 directions, no corner-cutting; costs ortho 1, diag 1.45,
   +0.6 per 45° turn, ×0.4 on existing ROAD (trunk sharing — no starbursts), +2 adjacent to a
   foreign footprint, +1 coast, RIVER only straight-through at +8 (+1 if already a bridge).
   Heuristic 0.4×octile. Order: primary edges by depth → same-family secondaries →
   cross-family. Search window: region bbox (same family), both regions (cross-family), then
   all land. Start/end on free tiles adjacent to the footprints. Compress to `points` at
   direction changes. RIVER tiles on a path become `Bridge`s.
6. **Labels:** `w = 0.6·font·chars + 8`, `h = 1.35·font + 4` (`opts.measure` override).
   8 anchors at 4px offset, then 8 more one tile out; order atoms first then longest text.
   Hard: in world, no overlap with footprints/set-pieces/bridges/labels. Soft: road ×4,
   sea/river ×1, foreign region ×2, anchor preference S0 N.3 E/W.5 diagonals.8.
7. **Decor:** exclude footprints, set-pieces, roads, bridges, rivers and label-touched tiles,
   all dilated by 1; PRNG-shuffled (seed hash(family)); keep with p=0.45 if no decor within 1.
   `seaSlots` = the 3 largest empty sea squares (for furniture).
8. **Retry:** on any hard failure, multiply per-model area ×1.1 and rerun (≤3); else `warnings`.
9. **Camera:** region boxes = tiles ∪ labels padded 1 tile; node boxes = foot ∪ label padded 3.
   `pathToAtom(world, name)` concatenates reversed primary roads to the root atom (critter walk).
   `ferryRoute(world, members)` = A* in member order with costs road 0.6 / sea 0.8 / land 2,
   returning points + a per-point `sea` flag.

### Flow algorithm — `buildFlow(tax, fam)`

1. Column = depth. Lane order = the best of all 6! permutations minimising
   Σ weight·|lane delta| over cross-lane edges (tie → FAMILY_BLOCKS order).
2. Seed order within each (lane, column) cell by PLACEMENT row then name; 4 barycenter sweeps
   (L→R by parents' mean y, R→L by children's); count crossings (pairwise straight
   segments); keep the best.
3. Geometry: column width 220, node 150×44, row pitch 64, lane gap 24; nodes centred in lane;
   out-ports distributed along the right edge sorted by target y.
4. Pipes: adjacent columns → H–V(gutter)–H; longer spans → first gutter, nearest free
   horizontal channel between rows/lanes, target gutter. Tracks 6px apart, greedy interval
   colouring. Rounded corners via `path.ts` (r = min(10, half segment)); `samplePolyline`
   drives the tensor-blob animation.

### Tests

`node --test --experimental-strip-types --no-warnings "lib/world/*.test.ts"` (`npm test`);
tsconfig `"allowImportingTsExtensions": true` (legal with `noEmit`). Type-only imports use
`import type`; fixtures read via `readFileSync(new URL(…, import.meta.url))`.

World: (1) every model placed once, family matches; (2) a synthetic `mystery_net ← gan`
lands in generative with a routed road; (3) footprints disjoint, in own region, never on
RIVER/SEA; (4) region tiles within ±15% of target, 4-connected, the 6 required pairs share
a border, the islet has no 8-neighbour foreign tile; (5) one road per `builds_on` edge,
consecutive 8-neighbour tiles, no corner cuts, anchored at both footprints, all walkable,
RIVER only inside a Bridge, every cross-family road has ≥1 bridge; (6) labels disjoint from
each other/footprints/set-pieces, in world, font ≥13; (7) no decor within 1 tile of
anything; (8) determinism — deep-equal across runs, cloned input, shuffled `models`;
(9) `pathToAtom` continuous and ends at the right root (tabular_diffusion → diffusion);
(10) every composition's `ferryRoute` visits all members; (11) median build time logged,
assert <100ms (target 30ms).
Flow: column = depth, lane = family; boxes disjoint and inside lanes; one pipe per edge,
anchored at ports, axis-aligned, crossing no foreign box; crossings ≤ seed order and ≤ a
frozen bound; deterministic under input permutation; sequence not in an edge lane.

## Evidence endpoint

`GET /web/evidence` → per model `{name, champion, champion_version, gate_metric,
threshold_m, higher_is_better, provisional, run_count, best_metric}`. Champion = pulled
Production checkpoint under `runs/champions/<model>` (`cloud/champions.py::has_champion`).
`provisional` is a new `EvalSpec` flag set on the entries already marked PROVISIONAL in
comments — no threshold changes.

## The four skins

Each spends its boldness on **one** signature element; everything else is quiet. Banned
everywhere: ALL-CAPS tracked labels, middle-dot meta strings, fake numbering, decoration
that encodes nothing. Copy is sentence case, learner-facing.

**A · Papercraft overworld** — `/lab/paper`. Sea `#1E6FD9`, meadow `#6CC24A`, road gold
`#F2B632`, die-cut white `#FFFDF6`, ink `#2B2118`, flag red `#E23D3D`. Lilita One (region
signs cut from card) + Fredoka (labels/UI). Signature: *real paper depth* — every cutout has
a white die-cut rim + two-layer cardstock-edge shadow; zooming into a region pops its
set-piece up like a pop-up book (the one orchestrated moment). One runtime-generated
paper-fibre tile. Octagon level-nodes with visible thickness, fat gold roads.

**B · 16-bit overworld** — `/lab/pixel`. Sweetie-16 palette (all art snaps to it).
Pixelify Sans only. Signature: autotiled terrain from the region masks, 2-frame water,
4-frame critter walk. Model card = JRPG status screen with real stats (LV = generation,
gate-metric bar vs threshold, champion as "equipped"). Sprites are TS string arrays
rendered to canvas at runtime; `image-rendering: pixelated`, integer scale.

**C · Papercraft map + pixel chrome** — `/lab/hybrid`. A's map with B's 9-slice RPG dialog
boxes for the card, menus and title. Reuses A/B via their exported components.

**D · Kawaii flow** — `/lab/flow`. Lilac grid `#F3F0FF`, plum ink `#3B2E5A`, one pastel per
family (mint `#8FE3C0`, peach `#FFB38A`, sky `#9CC9FF`, butter `#FFE27A`, bubblegum `#FF9CCB`,
lavender `#C6B2FF`). Mochiy Pop One (creature names) + M PLUS Rounded 1c (body). Every
model is a creature: body shape = family (round eyeball, token caterpillar, egg-cloud,
mirror twins, crystal, dice-bot); face = evidence (crown + sparkle eyes = champion, sweat
drop = provisional, zzz = no runs). Signature: on selection, tensor blobs parade from its
ancestors down the pipes into it. Idle motion: a rare blink only.

**Shared:** the original perceptron-blob critter (`components/paper/critters.tsx`) walks roads
in A/B/C. The model card shows: plain description, lineage (parents → model → children,
clickable), mechanism introduced, evidence (metric vs bar, sparkline, run sample image if
any), compositions it appears in.

## Protocol (parallel builders with vision)

- One working tree (Next 16 allows one `next dev` per project; slow machine). Builders own
  `app/lab/<skin>/**`, `components/lab/<skin>/**`, `.lab-shots/<skin>/**`; everything else is
  frozen — shared needs are shimmed locally and logged to `.lab-shots/<skin>/shared-requests.md`.
  CSS = Tailwind utilities or CSS Modules only. ≤2 `next/font` families in the skin's layout.
  No git writes, no installs, no binaries, never start/stop servers or build.
- Every mark is declared in `components/lab/<skin>/encoding.ts` (visual → data field).
- `app/(classic)/` holds the legacy shell; `app/lab/layout.tsx` is bare full-bleed.
- `scripts/shoot.mjs` (headless Chrome, ≤2 concurrent, JPEG q70) captures states
  `overview | region | node | dense` at 1440×900 (+ 390×844 for overview/node) into
  `.lab-shots/<skin>/r<N>/` (gitignored). Views are URL-driven: `?zoom=&focus=&still=1`;
  skins set `data-lab-ready="1"` when drawn.
- **Loop:** min 3, max 6 rounds: shoot → read every image → score → fix only the two lowest
  criteria → `notes.md` (≤5 bullets) + `scores.json`.
- **Rubric (1–5):** legibility (≥13px, contrast) · data integrity (every mark in encoding.ts)
  · fidelity to reference · depth/craft · hierarchy & focus · no collisions/clipping ·
  motion restraint · mobile. Stop from round 3 when all ≥4 and mean ≥4.3, or no gain for 2
  rounds, or round 6.
- Then four fresh-context critics (one per skin) → one fix round. Then static build, final
  shots on :8000, `make lab-board` → comparison board, published privately; the user picks.

## Graduation (after the pick — own short plan)

Winner becomes `/` and its system is applied to every surface (map, model card, Reactions,
Observatory, nav). Delete the other editions, the edition toggle, the `(classic)` shell,
`/atlas`, `components/atlas`, `components/paper/atlas`, losing skins, `/lab/_stub`, unused
fonts/CSS. No public redeploy without an explicit ask (cloud pause).

## Round 2 (2026-09-28 evening) — from 40% to done

**Why:** the owner reviewed all four live: "good, but ~40% there". Owner notes:
*more spacing · less overlapping, better connections · more details · hidden easter
eggs*. The orchestrator's live + code audit agreed and found: node gaps of 3 tiles,
labels sitting on roads, hub corridors braiding, only one parent path readable (kimi
builds on transformer + moe + mamba; mamba invisible), no direction cue, critter
parked ON the focused spot; no skin uses metric curves, inference, compositions as
ferry routes, or the classic app's per-species forward-pass anatomy; "proof it
works" is a label; nothing to discover; self-scores 0.4–0.9 above critics; live
motion never verified by an agent. **All four skins continue; paper and pixel are
the favourites** (first claim on shared work, most rounds).

### R2-A · Layout v2 (lib/world, shared — fixes spacing / overlap / connections for all)
- Spacing ~2×: larger generation step and footprint gap; world grows; invariant:
  min node-centre distance and label-to-node clearance thresholds.
- Labels never on roads (hard constraint; wider anchor rings).
- Road lanes: roads sharing tiles get parallel lane offsets — no two drawn roads
  coincide; hubs branch at distinct junctions (no starburst, no braid).
- Direction: each road exposes chevron points (parent → child).
- `lineage(world, name)` → every parent road, child road, ancestors, descendants.
- `parkingSpot(world, name)` — beside the spot on its incoming road, never on it.
- New invariant tests for each rule; camera anchors updated.

### R2-B · Lesson card content (shared data + headless hooks; each skin styles it)
- `lib/lessons.ts`: per model a plain-language "what it is / why it exists / the
  one idea it adds" (≤60 words, learner voice), distilled from each model.py
  educational header + docs chapters — no jargon without an explanation.
- Anatomy: reuse `lib/schematics.ts` (every species) via a skinnable renderer
  (palette/stroke props) derived from `components/network-flow.tsx`.
- `useLesson(name)`: metric curve of the best/latest run (`getMetrics`), sample
  artifacts, champion info — graceful when empty.
- "Try it": inference presets only where a one-click request is meaningful
  (derived from `colab/probes.py`), against the served champion; honest loading /
  error states (slow machine).
- Compositions: selecting one draws `ferryRoute` (map skins) / highlights pipes
  (flow).

### R2-C · Easter eggs that teach (shared registry, rendered per skin)
Grounded in real model behaviour, discoverable without instructions, never in the
way: grokking "clicks" only after a long hover/focus (delayed generalization); a
hidden "?" island of next-era models (VQ-VAE, flow matching, gated pixelcnn) past
the edge of the sea; clicking the critter 7× makes it train — a tiny loss curve from
a REAL run; double_descent's ferry route dips twice; the Konami code runs a forward
pass across the whole zoo in depth order. Each egg is declared in the skin's
encoding.ts under an "eggs" section.

### R2-D · Harness + bar
- `shoot.mjs --motion`: CDP frame capture of live (non-still) interactions into a
  contact-sheet JPEG (fly-to, critter walk, pop-up, parade) so agents SEE motion.
- Critic-led stop rule: a fresh critic scores each skin's final round; ≥4.5 mean
  and nothing <4 to stop; max 2 critic cycles per skin. Builders keep
  self-scoring for iteration only.
- Order: R2-A, R2-B/C, R2-D in parallel (shared code) → the four builders resume
  on the new foundation → critics → fix → board → owner picks.

### R2-E · World flavour the owner asked for — "boats, trains, almost a city, some Lord of the Rings stuff"
Every flavour element encodes data (no decoration-only props):
- **Boats = compositions.** A composition's `ferryRoute` is a boat line between
  islands; harbours on each coast dock one boat per composition touching that family;
  selecting a composition sails it.
- **Trains = training.** Roads are also rails; a train runs a model's lineage line
  while that model has a live `running` run; each spot's station shows its run count.
- **Cities = hubs.** Atoms are cities whose footprint/building count scales with the
  number of models that build on them (transformer, classifier = capitals); derived
  models are towns.
- **Epic-fantasy cartography** (genre only — no Tolkien names, scripts, characters or
  maps): inked mountain ranges along family borders, the critter's walk drawn as a
  dotted quest route, "here be dragons" off the hidden ? island, and `legacy/`'s
  retired models as ancient ruins on a far islet.
Skins translate each into their medium (papercraft boats/trains, 16-bit sprites,
flow: tensor "trains" in pipes and ferries between lanes).
Easter eggs approved by the owner: grokking clicks late · hidden ? island · critter
trains after 7 clicks (real loss curve) · Konami forward pass (+ double_descent's
route dips twice).

## Round 3 direction (owner, 2026-09-28 late) — illustration quality
Owner: "getting there, but the drawings are too simple — look at the quality Paper Mario
has. And for the pixel, don't go 16-bit — contemporary pixel art." Illustration is now a
separate discipline with its own agents and a specimen-sheet review loop.

### Paper — Sticker Star fidelity through a material + light system
- **One key light** (top-left) for everything: each cutout gets a soft cast shadow
  down-right + a contact shadow where it meets the ground; highlight edge on the lit side.
- **Materials as reusable components**: paper (matte, visible fibre grain), cardboard
  (thick pieces show a corrugated side face), felt/knit (fuzzy edge), glossy sticker
  (level spots: specular highlight + white die-cut rim), printed patterns on every surface
  (grass stripes, sand dunes, tiled walls, windows, 2–3-tone scalloped waves, stitched
  road edges with a darker border).
- **Diorama, not flat map**: the ground plane is gently tilted (2.5D — vertical squash /
  perspective on the ground layer) and props STAND UP as billboard cutouts with visible
  thickness and a base shadow; foreground props (big trees, clouds) overlap edges for depth.
- **Scale contrast + detail density**: large landmark set-pieces, mid props, small
  detail clusters; biome dressing is allowed as decoration (it encodes the family/biome).
- Ambient motion allowed if slow and peripheral (waves, drifting cloud shadows);
  frozen under still=1; nothing twitches near the focus.

### Pixel — contemporary pixel art (not 16-bit)
- References: Eastward, Sea of Stars, Hyper Light Drifter, Octopath-style lighting.
- **Hue-shifted ramps** (5–7 steps per material; shadows cool, highlights warm), no
  16-colour cap — a curated palette of ~48–64 colours built from ramps.
- **Light**: a height/normal field from the terrain (distance to coast / relief) shaded by
  one light direction, quantised to ramp steps with ordered dithering only at band edges.
- **Selective outlines** (darker hue of the object, shadow side only — never flat black),
  hand-placed clusters, readable silhouettes.
- **Water with depth**: shallow→deep ramp, foam line, reflections of coastal props,
  palette-cycled shimmer/caustics.
- **Hero sprites at 32×32+** (castles per mechanism, capitals, critter walk cycle, boats,
  trains, houses, trees per biome) as TS pixel arrays with ramp palettes; procedural
  foliage/terrain shaded by the same light.
- Atmospheric grade (subtle warm/cool gradient, soft vignette), crisp integer scaling.

### Process
- Illustrator agents own `components/lab/<skin>/art/**` + a specimen page
  `app/lab/<skin>/specimens/` (every asset on a neutral ground at 1×/2×/4×); vision
  review per asset against the reference descriptions; builders integrate art exports.
- Hybrid inherits paper's art; its chrome moves to contemporary pixel style. Flow's
  creatures get the same material/light treatment (sticker gloss, shading, soft shadow).

## Round 4 (2026-09-29 afternoon) — continent v3 + Wild West + Cyberpunk
Owner: "we need to review the layout and the shape of the continent. Also I would like a
wild west part and a cyberpunk part!" Problems confirmed by the owner: too blobby/generic,
poor use of the screen, arbitrary/crowded paths inside, families don't feel like places.
- **Decision = Wild West** (RL frontier: rewards, gambling, gold rush): canyon mesas, red
  desert, a saloon boomtown, railroad + station, cacti, tumbleweeds, wanted posters; dice
  keep → saloon/casino, maze fort → canyon labyrinth, rook → frontier fort.
- **Sequence = Cyberpunk** (the LLM frontier): a neon megacity at night inside the map —
  grid streets, towers with lit windows, holo signs, magenta/cyan neon; transformer's spire
  as the neon capital tower, kimi/deepseek/moe as arcologies. Its night palette is a
  deliberate pocket, framed by its border.
- **Continent v3 (lib/world)**: a designed silhouette instead of grown blobs (a memorable
  shape with a central bay/inland sea, peninsulas per family), sized to the viewport aspect
  (16:10) so land fills the frame; each family a distinct geography with natural borders
  (mountain ranges, rivers, straits); roads follow valleys/coasts with fewer crossings,
  hub fans replaced by trunk-and-branch; invariants stay (spacing, labels off roads,
  lanes, determinism).
- **Update:** the owner chose the silhouette — the C-shaped parchment continent (bay open to
  the east, north-east arm with an islet tail, southern desert lobe). **Structure = underwater**:
  a sunken reef city inside the bay (gnn → coral reef network, nerf → glass light temple).

## Round 5 (2026-09-29) — redraw the owner's reference map from scratch
Owner found "the perfect reference" (a rich 3/4-view pixel diorama of the zoo) + a palette
reference (less saturated). Decision: HAND-REDRAW it in our pixel system (never ship the
image; local copies live gitignored in playground/.lab-shots/refs/), ADAPT labels/data to the
real taxonomy. Supersedes Round 4's biome assignment. Geography per the reference:
Representation snowy peaks (top-centre), Perception the west (forest, treehouse, windmill,
medieval towns, lighthouse islets, a wild-west plateau in the south-west), Sequence the
centre + north-east (blue-domed cathedral, ancient ruins, a desert stilt town), Generative
the southern lava forge, Decision the east (green village + an underwater domed city in the
south-east bay), Structure a floating cyberpunk island top-right. lib/world v3 reproduces
this geography; the pixel illustrator redraws its set-pieces in the palette reference.
