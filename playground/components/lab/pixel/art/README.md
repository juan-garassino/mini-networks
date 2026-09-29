# Pixel skin — art system (round 3, contemporary pixel art)

Owned by the illustrator; the map builder integrates it. Specimen sheet:
`/lab/pixel/specimens/?still=1` (`&part=palette|castles|sprites|terrain|crops`).
Review shots + notes: `playground/.lab-shots/pixel-art/rN/`.

Everything paints **palette indices** (`CLEAR = 255`) and converts to RGBA only
at the end (`artToCanvas(img, scale)`), so no off-palette colour reaches the
screen. Deterministic: seeded noise only.

## Palette — `palette.ts`
63 colours, the de-duplicated union of hue-shifted ramps (dark → light;
shadows cool/blue-purple/maroon, highlights warm/yellow; no pure black — ink is
the deepest ocean indigo `#1e1f4e`).

| ramp | use |
|---|---|
| `ocean` (5) | deep sea `#3f4fa3` = step 3; step 2 current spirals; 0–1 cloud shadow |
| `shallow` (6) + `foam` (2) | cyan halo `#39c5f0` = step 3; step 5 swirl lines / inner halo; foam dots |
| `sand`, `meadow` (7), `savanna`, `frost`, `snow`, `stone`, `rock`, `lava`, `magic` | terrain + biomes |
| `roof`, `gold`, `banner`, `wood`, `glow`, `forest`, `pine`, `olive`, `cliff` | sprites (derived ramps share entries) |
| `ui` | ink + paper |

**Palette swap now:** `LEGACY_MAP[sweetieIdx]` → new palette index (and
`LEGACY_HEX`) maps every Sweetie-16 colour of the retired skin to its role in the
new ramps (ink→indigo ink, blue→deep ocean, sky→cyan halo, green→grass, gold→gold,
slate/charcoal→stone, …), so the whole skin can switch palettes in one step.

Helpers: `shade(ramp, t∈[0,1])`, `step(ramp, i)`, `darker/lighter(idx, n)`,
`SHADOW` (256-entry remap: every index → darker/cooler neighbour; used for cast
shadows), `biomeOf(family)` → `Biome {low, mid, high, peak, forest, canopy}`.

Family biomes: perception lush meadow · decision dry savanna (rock peaks, no
snow) · sequence dunes + stone · generative volcanic (rust ground, lava cracks,
ash cones with a glowing crater, lava in the shallows) · representation icy
highlands (frost → snow) · structure crystal grey-violet (violet/pink peaks).
Secret islands: `?` island = crystal, ruins islet = dunes.

## Terrain — `terrain-shade.ts`
- `ART_PER_TILE = 8` → 1 art px = 2 world px; the 132×99-tile world = 1056×792 art px
  (`extent: "all"` adds both secret islands: 1360×984).
- `renderTerrain(world, { artPerTile?, extent?: "grid"|"all", seed?, clouds?, canopies? }) → TerrainArt`
  `{ img, origin (world px of art px 0,0), px (world px per art px), height, land, region, timings }`.
  `toArt(terrain, worldPt)` converts world px → art px.
- Pure kernels (per art pixel): `shadeLand(LandSample)`, `shadeWater(WaterSample)`,
  `slopeLight(gx, gy)`, `ditherStep(v, x, y, band)`, `stampCanopy(img, x, y, r, biome)`.
- Height = distance-to-coast rise + seeded hills + `world.mountains` ridges +
  **massifs only in wild land** (far from roads/footprints). Roads/footprints
  are "quiet": capped at the grass band, slope light ×0.4 — nodes sit on calm ground.
- Bands: beach < 0.15 · biome ground · forest-able 0.3–0.6 (procedural canopy
  clumps) · rock ≥ 0.64 · snow ≥ 0.85. One top-left light; Bayer seams only
  at band edges (±0.014 h); flat ground broken into organic clusters by a
  low-frequency warp (no wide dither fields).
- Family borders: broad meander warp + ordered-dither mixing across ~6 art px; rivers are
  natural borders (warp never crosses one) and meander ±0.45 tile around their tile chain.
- Biome dressing only in FREE cells (away from roads, footprints AND label boxes): sandstone
  outcrops, scrub, wadis (dunes); acacia clumps, grass tufts, dry riverbeds (savanna); copses +
  tufts (meadow); crystal shards; boulders. Rolling hills with slope light everywhere.
- Ponds: 1–2 in the largest free interiors (shaded bank, sand rim, sparkle diamond).
- Secret islands: `isletBlobs(island)` → compact lumpy islets (≤ 3 slots each; the ruins
  box becomes a short archipelago), cliff lips like the main coast; the `?` island wears fog wisps.
- Water: foam dot line at the shore, second broken foam row, bright inner halo,
  warped-contour swirl lines, stepped blue rim dithered into the deep, sparse
  darker current spirals. South/east coasts: a 4 px maroon cliff face (lit lip
  row, strata seams) with foam at its foot; land casts a shadow down-right onto the halo.
- Clouds: `bakeCloudShadow(img, cloudImg, x, y)` remaps the silhouette offset by
  `CLOUD_SHADOW_OFFSET` (down, a touch right) through `SHADOW` — call before
  drawing the cloud. `cloudSpots(world, terrain, imgs)` = one cloud per sea slot
  + one half-hiding the `?` island.
- `renderTerrainPreview(world, scale, { imgs })` → `{ canvas, art }` (specimen).
- Perf: one full-world pass. Node bench under load avg ~340 (≈25× slower than
  idle): ~9–10 s grid / ~11–14 s all → est. 0.4–0.6 s idle. Render once, cache
  the canvas (or run in a worker); never per frame.

## Sprites — `sprites/*`
`Sprite = { img, shadow? (ground-contact mask), anchor (foot point), slot? (emblem window) }`.
All drawn with `Painter` (ramp-shaded primitives: cylinder, wall, crenels,
cone, gable, ball, dome, window, door, flag, string-art rows, mask) and
finished with a rim light (lit edges) + selective outline (shadow side only,
darkest step of the touching material).

| asset | size (art px) | encodes |
|---|---|---|
| `castleSprite(atom, emblem9?)` ×16 (`CASTLES`, `CASTLE_NOTES`) | 36×46, anchor bottom-centre, 9×9 banner slot | atom mechanism (silhouette) + species emblem |
| `markerSprite(state, name, emblem7?)` | 20×28, 7×7 slot | derived model + evidence: champion (gold + star) / trained (blue + pennant) / provisional (scaffold + ? board) / untrained (dim, cracked) |
| `capital(v)` | 52×40 | capital city (hub atoms) |
| `props.house(v 0–3, lit)` | 14×16 | city blocks (unlit = untrained / night) |
| `props.treeClump(meadow|olive|ember|frost)`, `palm`, `pine(snow)`, `rock(v, ramp)`, `snowPeak` | 24×20 … 28×20 | biome dressing |
| `props.pier`, `props.boat(flip)` | 28×12, 18×18 | harbours; one boat per pipeline |
| `props.train(0 engine / 1 car)`, `props.bridge(h|v)` | 18×12, 20×10 | live runs; river crossings |
| `props.cloud(v, k)` | 34×17 × k (map uses k = 3) | sky; masks cast the water shadow |
| `props.ruins`, `props.questionStone`, `props.dragon`, `props.compass` | 24×20, 14×18, 40×30, 42×42 | ruins islet, next-era silhouettes, "here be dragons", N/W/E/S |
| `critterSheet()` → `walk[4]`, `idle[2]`, `train` | 26×30, anchor (13, 28) | the one-eyed perceptron blob (shared geometry) |

`emblemMasks(names, sizes)` rasterises `lib/icons` glyphs to 1-bit masks
(same `{size, bits}` shape as `components/lab/pixel/emblems.ts`, either works).
`spriteCanvas(sprite, scale)` caches RGBA canvases. `catalogue()` lists every
prop for the specimen sheet.

## Composing a map frame (builder)
1. **Terrain canvas** — `renderTerrain(world, { extent: "all" })` once → `artToCanvas`; blit at
   integer zoom (world zoom k ⇒ art px = 2k screen px). Bake cloud shadows here
   only if clouds are static; for drifting clouds draw the SHADOW as its own
   pass (remap under the moving mask, or a pre-baked indigo silhouette).
2. **Roads / lanes / chevrons** — on top of terrain (terrain keeps road tiles quiet).
3. **Sprite ground shadows** (`sprite.shadow` through `SHADOW`), then **sprites**
   y-sorted by anchor: castles on atom footprints (anchor = footprint bottom-centre),
   markers on derived footprints, capital beside hub castles, houses on `world.cities`
   blocks, piers + boats at `world.harbours`, trees on `world.decor`, critter.
4. **Clouds** (overview only) over the sea slots.
5. **Name-plates / numerals** as DOM overlay in screen space (never in the art).

## Authored map — `art/authored/` (round 4, "human designed")
The overview is no longer grown from noise: one authored source rendered at any
level of detail, at ONE fixed on-screen pixel size (the builder's adaptive
resolution; the specimens show 4 screen px per art px).

- `authoredLand(world, artPerTile)` → `{ w, h, origin, px, land, region, river, civic, frame }`
  - world land smoothed at tile scale (no staircase, no noise) + hand-placed
    `GESTURES` (capes, bays/fjords, islet tails, tile coords) + a ≤1-px hand wobble;
  - every road / footprint / set-piece / bridge / river / harbour / city block /
    label tile is PROTECTED (1-tile margin): the mask is nudged, never a node;
  - `region` = world regions (nearest-region fill for added land; rivers stay the
    border: river + region share one meander displacement); −2 "?" island, −3 ruins.
  - `civic` (rivers excluded) = where decoration must not go (< 0.3 is free).
- `composeAuthored(world, artPerTile, { sea: "paper" | "clear", decor })` → `AuthoredMap`
  (= AuthoredLand + `img` palette indices + `heroes` (world px) + `timings`). Layers:
  flat family ground with a few large clean tone zones · coastal ochre lowland band
  (meadow/savanna) · meandering river strokes · heroes · border ranges · clusters near
  models · sparse calm hills · N/W sand lip · S/E cliff lip + ink coast stroke ·
  paper sea with hatching ONLY in a band along the coast.
- `HEROES` (tile coords, nudged into free land): snowy spine (Representation),
  volcano (Generative), lake (Perception), oasis (Sequence), mesa (Decision),
  crystal spires ×2 (Structure).
- Stamps (`stamps.ts`, literal pixel art): forest S/M/L, peak S/M/L, hill, hill L,
  dune, pond, lake, volcano, mesa, palm, acacia, pine, snowy pine, crystal spires,
  rocks, tuft; `stampImage`, `paintStamp`, `recolour`. Drawn-to-size glyphs for
  near LODs (`gen.ts`): `cone` (peak / volcano), `mesa`, `lake`, `spires`, `forest`.
- LOD: 2 art px/tile = overview (≈ 340×246 art px for camera.all), 3–4 = region,
  8 = node. Stamps keep their pixel size; heroes/ranges switch hand stamp → drawn
  glyph as the footprint (in tiles) grows. Perf (node, load ≈ 300): apt 2 ≈ 1 s,
  apt 4 ≈ 3 s, apt 8 ≈ 11 s → compose per level once, cache, never per frame.
- Builder composes: `composeAuthored` image → roads/lanes → sprites (castles,
  markers, cities, boats) → labels (DOM). Boats/ferries: `land` is authoritative
  for "is this pixel water" (capes may cover a little former sea).
