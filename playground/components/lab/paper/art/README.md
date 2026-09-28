# Paper art library (`components/lab/paper/art`)

Sticker-Star-fidelity illustration for the paper skin: TSX/SVG only, deterministic
(no `Math.random`; `rng(seed)` where variety is needed), zero SVG filters.
Specimen sheet: `/lab/paper/specimens/` (`?group=`, `?item=`, `?scale=1,2,4`,
`?view=diorama`, `?still=1`). Review shots and notes: `.lab-shots/paper-art/r1..r5/`.

## Light and material contract

- **One key light, top-left.** Left/top faces use `lit`, right faces `shade`, undersides
  `deep`. Cast shadows fall **down-right** (`CAST` matrix: x' = x − 0.5·y, y' = −0.18·y);
  every stand-up also gets a `ContactShadow` (ambient occlusion) at its base.
- **Ramps** (`palette.ts`, `R.*`): 5 steps `[hi, lit, mid, shade, deep]`, hue-shifted
  (warm highlights, cool shades). `FAMILY_RAMP` maps family → ramp. `P.*` = neutral paper.
- **`<ArtDefs/>`** — render ONCE per document inside any `<svg>` (ids `pa-*`).
  Overlay patterns (translucent, any base colour): `pa-fibre`, `pa-grit`, `pa-knit`,
  `pa-corrugate`, `pa-bricks`, `pa-stone`, `pa-tiles`, `pa-shingle`, `pa-planks`,
  `pa-stripes`, `pa-dots`, `pa-hatch`. Surfaces (opaque, world px — for the map's ground
  layers): `pa-grass`, `pa-meadow`, `pa-sand`, `pa-sea` (3-tone scallops + crest lines),
  `pa-cobble`. Gradients: `pa-rim`, `pa-gloss`, `pa-turn`, `pa-occl`, `pa-glow`, `pa-beam`,
  `pa-lake`, `pa-cloud`.

### Primitives (`materials.tsx`)

| API | What it draws |
|---|---|
| `<Art x y size design flip>` | places a design-space drawing: base-centre at (x, y), `size` = rendered height |
| `<Cutout d rim depth material shadow lift grain fuzz>` | side thickness face (down-right) → die-cut rim with rim-light gradient → children (faces) → fibre grain → finish. `d` = silhouette path or pieces (drawn as a union). `material`: `paper` · `card` (corrugated side) · `felt` (knit + fuzzy dashed edge, pass `fuzz`) · `sticker` (gloss hotspot). `shadow`: `drop` (floating/lying) · `ground` (cast) · `none` |
| `<StandUp foot … />` | a Cutout standing on the ground: `ContactShadow` + cast shadow |
| `<SoftShadow d transform spread>` | filter-free soft shadow: 3 opaque unions in translucent groups |
| `<ContactShadow rx ry>` | AO pool under a base |
| `<Glint> <LitEdge> <Stitch>` | specular sparkle, warm lit edge line, running stitch |

## Assets → what they encode (hand to `encoding.ts`)

All stand-ups: base-centre at (0, 0), up negative, `size` = px tall. Suggested on-map
heights are the catalogue's `map` field (`catalog.tsx` is the machine-readable list).

| Component | Encodes | design H |
|---|---|---|
| `SET_PIECES[family].C` — `LighthouseEye`, `ClockTower` (`train`), `KilnVolcano`, `MirrorTowers`, `CrystalLattice`, `DiceKeep` | the family's signature mechanism | 196–262 |
| `LevelSpot {name, state, r}` | a derived model; `state` = `champion` (gold star seal) · `trained` (glossy blue) · `untrained` (hollow paper face, blue emblem) · `provisional` (pencil sketch) | **flat**: (x, y) = face centre, `r` radius |
| `AtomSpot {name, state, r, family, castle}` | an atom: two-tier spot + castle (roofs = family ramp) | flat, castle rises ≈1.9 r |
| `CapitalSpot {…}` | a hub atom: city + spire behind | flat, rises ≈2.7 r |
| `Emblem {name}` / `StarSeal` | `iconFor(name)` printed crisp, un-squashed / champion seal | — |
| `BIOME[family][]` (3–4 each): RoundTree · EyeFlowers · FeltBush / Palm · Cactus · Dune · Pyramid / BasaltRocks · PuffTree · Fumarole / Reeds · LilyPond · Willow / Pine · SnowRock · CrystalCluster / Topiary · Haystack · Windmill | the family's biome | 20–80 |
| `Mountains {snow}`, `BigTree`, `Tuft` | relief, foreground frame overlap, ground dressing | 96, 250, ~10 |
| `Cottage` · `Townhouse` · `Shop` · `RoundHouse` · `CityBlock {variant}` | town dressing / hubs | 40–72 |
| `PaperBoat {sail hull}` · `SteamBoat {trail}` · `SmokeTrail` · `Pier {length}` | compositions at sea, harbour | 60, 64 |
| `PaperTrain {cargo smoke}` · `TokenTrain {tokens}` | live training / sequence prop | 40, 30 |
| `PlankBridge {span orient}` · `RopeBridge {span}` | cross-family roads | 24 / span, 34 |
| `PaperCloud {variant}` + `CloudShadow` (ground layer) | weather/depth | 50 |
| `CritterArt {pose facing}` · `CritterWalk {still}` · `CRITTER_WALK` | you; poses `idle`, `walk0–3`, `train` (easter egg) | 130 |
| `FogIsland` · `PaperDragon {silhouette}` · `Ruins` | secrets: "?" island, here be dragons, retired models | 96, 74, 62 |
| `SignBoard {text family}` | region name | 52 (width follows text) |
| `ArtDiorama` | the harmony proof (specimen only; a staging reference) | — |

## Perf notes

- No filters anywhere; shadows are layered translucent copies; patterns are small cached tiles.
- Element counts per asset (from `r5/all-counts.json`): set-pieces 130–250, derived spot
  20–50, atom 145–155, capital ~345, biome props 15–100 (EyeFlowers 89, Willow 97), houses
  55–85, clouds 45, critter 57. A full map (6 set-pieces, 16 atoms, ~28 derived, ~60 props)
  is ≈ 9–11k SVG nodes: keep these layers `memo`'d and outside the camera tween (viewBox-only
  updates), thin decor (e.g. one prop per 3–4 decor cells), and use `LevelSpot` for derived.
- Drop the `grain` overlay (`grain={false}`) on tiny props if profiling shows pattern cost.

## Integration notes for the builder

1. Mount `<ArtDefs/>` once in the map `<svg>` (next to `PaperDefs`; ids don't collide).
2. Spots are FLAT (centre-anchored); everything else is BASE-anchored. Sort stand-ups by
   base y (painter's order) as `diorama.tsx` does.
3. Tilted ground: draw ground layers in `scale(1, tilt)`; place props at projected points,
   un-squashed (see `diorama.tsx` `at()`).
4. Cast shadows extend ≈0.5·H to the right and 0.18·H below the base — leave room or let
   them overlap roads (they're translucent).
5. `still=1`: nothing in the library animates on its own except `CritterWalk` (pass `still`).
