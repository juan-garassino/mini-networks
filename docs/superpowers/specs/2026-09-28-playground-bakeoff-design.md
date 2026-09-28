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
