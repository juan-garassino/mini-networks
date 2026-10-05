# Night Map: design notes

A pixel-art star chart of a graph. Every node is a star, every group is a
nebula, every parent → child edge is an asterism line. It lives at `/lab/sky`
and is the night side of the painted pixel map (Day | Night tabs).

**The signature element** is the baked sky: one deterministic pixel painting
made from node positions alone (`bake.ts`). Each group gets a Bayer-dithered
nebula on its own hue-shifted ramp, grown from its stars and edges. Where two
groups meet, the weaker cloud carves a dark lane between them. A Milky Way of
dust fills the margins. Everything else stays quiet so the sky reads first.

## Tokens (`tokens.ts`, the only source of values)

| Token | What it holds |
|---|---|
| `NIGHT[0..4]` | the night ramp: deep sky, open sky (page colour), three dust steps |
| `FIELD[0..3]` | decorative field stars, cold dim blue → warm white |
| `FAMILY_INK[f].ramp` | 5-step nebula ramp per group, dark rim → bright core |
| `FAMILY_INK[f].tint` | 3 pastels per group: plaque border + line, emblem light, emblem pale |
| `GOLD` `MINT` `LILAC` `GREY` | evidence sprite ramps (sprite letters → colours) |
| `INK` | marks over the sky: lit lineage, ring, cross lineage, pipeline aqua, names, outline |
| `SKY_MATERIAL` | chrome for the shared corner components: indigo plates, brass rim, one filled gold |
| `FONT`, `SIGN_FONT`, `TYPE` | text voice (Pixelify + clear pixel digits), sign voice (Jersey 15), the type scale `[desktop, phone]` |
| `GRID` | `ap` (CSS px per art px, 2), `cell` (world px per sky px, 4), phone breakpoint, bake padding |
| `SPACE` | camera insets, node margin, word-to-edge gap, corner halo, plaque padding / spacing / reach, leader threshold, key plate |
| `LINE` | gap at stars, fan ring, fade distances and mix, dash, pipeline dots, leader stop + dim |
| `MOTION` | 12 fps, 120 s loop, twinkle / glint / comet / meteor periods |

Colour rule: a ramp is hue-shifted (cold dark end, warm light end), never just
darkened. A line or mark that has to recede is mixed toward its nebula's tone
or toward the night (`paint.ts` `mix` / `dim`). It never gets alpha, so every
pixel stays one flat colour.

## Type scale

Three voices, loaded by `app/lab/sky/layout.tsx`. Text: Pixelify Sans, with
the library's digit face over it for 0-9 (`lib/fonts.ts` `pixelDigits`, VT323 / Jersey 15;
the numerals rule, `lib/numerals.ts` `withDigits`): numerals are data and Pixelify's 5 reads
as S. Signs (cartouche title, tabs, plate titles): Jersey 15, whose C and Z
stay legible. Never set prose in the sign voice. Sizes are whole CSS px. Star
names 13 / 12 px (atom / derived; 11 / 10 on a phone), outlined 3 px in
`NIGHT[0]`. Plaques 15 px bold, sentence case, a 12 px Latin line at region zoom.

## Grids

- **Sky grid**: 1 sky px = 4 world px. Blitted pixelated, origin snapped to
  whole device px. At the overview the zoom snaps so one sky px is a whole
  number of device px.
- **Art grid**: 1 art px = 2 CSS px (4 device px on retina). All sprites,
  lines, rings and arcs land on whole art px. No antialiased stroke anywhere.
- **Chrome**: the painted maps' four corners (12 px margin on a phone, 20 px
  from `sm`). Plates register their live rects, so words never sit under them.

## Files and what each draws

| File | Role |
|---|---|
| `tokens.ts` | every value (above) |
| `bake.ts` | `bakeSky({stars, edges, box})` → RGBA + per-pixel owner/level + field stars; `ghostBake` sinks all but one group |
| `paint.ts` | `Pix` (batched art pixels), `bresenham`, `asterism` (a line that stops short), `arcPixels`, `stamp`, `dim`, `mix` |
| `sprites.ts` | evidence star sprites (atom + derived), 16×16 group emblems, constellation names, `ringOffsets` |
| `motion.ts` | pure `twinkle` / `glint` / `comet` / `meteor` of a frame number; frame 0 = nothing moves |
| `layers.tsx` | `SkyCanvas` (the bake at the camera), `SkyMarks` (lines, comets, arcs, leaders, stars, rings, life) |
| `layout.ts` | `placeWords`: plaques, names, pipeline arcs / chevrons, leaders, in one greedy obstacle pass |
| `plaque.tsx` | a group's sign (emblem, name, count, Latin line) + `plaqueWidth` |
| `chrome.tsx` | Day / Night tabs, the show-UI button, the off-screen partner `Chevron` |
| `key.tsx` | `StarKey` (bottom-right: rows from `encoding.ts` `KEY`, real sprites) and the phone's `PhoneStarKey` button |
| `icon.tsx` | a sprite as a small pixelated UI image (`SpriteIcon`, legend `StarPair`) |
| `sky-skin.tsx` | the page: data → frame coords → bake → camera → layers + words + corners + drawer |
| `specimen.tsx` | `?specimen=1`: sprites, one nebula, emblems and ramps at 4× |
| `encoding.ts` | the mark → data table: **every mark's meaning is listed there** |

## Marks → data

See `encoding.ts`. In short: nebula = group; sprite shape = evidence (gold
sparkle champion, mint gem trained, lilac ring provisional, grey point
untrained); large + always named = atom; line = builds_on edge; comet = its
direction; gold = selected lineage; dashed = secondary (focus only); dotted aqua
arc = pipeline partner; leader = a sign away from its stars. Field stars, Milky
Way and meteors are decoration and say so.

## Motion

A 12 fps flip-book (`MOTION`), never a glide. Field stars twinkle, champions
glint, comets run parent → child, a meteor crosses now and then. Frame 0 =
nothing moves; `?still=1`, `prefers-reduced-motion` and a hidden tab hold it.

## Views (the /lab contract)

`?zoom=overview|region|node&focus=<name>&still=1&ui=0`. Region fits the
group's nebula and ghosts the others. Node frames the selected star and its own
nebula left of the drawer (the star keeps `SPACE.nodeMargin` from the edge);
partners off screen are edge chevrons, which never slip under a corner plate. `data-lab-ready="1"` is set once the
camera has landed and the bake is painted (`lib/lab-contract.ts`), and `window.__lab.{select,view}`
drives it from scripts. Phone rule: the frame turns a quarter so a landscape
graph fills the tall screen; a sign looks within `SPACE.signReach` of its stars
first, else sits further out with a leader; the key folds behind a Key button.

## Lifting it into another project

1. Copy `tokens.ts`, `bake.ts`, `paint.ts`, `sprites.ts`, `motion.ts`,
   `layers.tsx`, `layout.ts` and `icon.tsx`. Bake, paint, sprites and motion
   are pure, so they run under node (`bake.test.ts` shows how). `tokens.ts` reads `lib/numerals.ts`.
2. Feed it this shape. Positions can come from any layout (force, dagre, hand):
   ```ts
   stars: { name; family; x; y; atom: boolean; parents: string[]; state: "champion"|"trained"|"provisional"|"untrained" }[]
   edges: { from: {x,y}; to: {x,y}; family }[]   // the primary edges that grow the nebulae
   box:   { x; y; w; h }                         // the area to bake, a margin around the stars
   ```
3. Replace in `tokens.ts`: the `FAMILY_INK` keys (one entry per group: 5 ramp
   steps + 3 tints, hue-shifted). Keep `NIGHT` unless you want another sky.
   Replace in `sprites.ts`: `EMBLEM_ROWS` and `CONSTELLATION` per group, and the
   evidence sprites if your node states differ (shape must carry the state).
4. Draw: `bakeSky` once per layout, then `<SkyCanvas>` for the sky and
   `<SkyMarks>` for the marks at your camera box. Call `placeWords` for names
   and signs, passing your own UI's rects as `corners`.
5. `sky-skin.tsx` is this app's wiring (the lib/world graph, the URL view, the
   painted map's corners and drawer). Use it as a reference, not a dependency.
   `SKY_MATERIAL` is only needed if you reuse those shared corner components.
