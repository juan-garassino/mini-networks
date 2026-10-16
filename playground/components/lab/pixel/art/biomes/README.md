# Zone art library (round 4 — the owner's final pixel reference)

Owned by the illustrator; the builder integrates it. Redrawn **from scratch** after
`.lab-shots/refs/map-reference.png` (composition, set-pieces, colours; never pixels):
3/4 diorama — raised land slabs with thick layered cliffs, props standing up with a
ground shadow, one maroon-brown ink family. Specimen: `/lab/pixel/specimens/?part=biomes`
(`&zone=<key>` one zone · `&scenes=0|only|<scene>`). Deterministic (lattice hash / value
noise only), palette indices only (`CLEAR = 255`), no binaries.

## Palette — `palette.ts`
`BIOME_HEX` = the reference ramps (ink, paperR, light, olive, forestR, desert, cliffR, woodR,
stoneR, snowR, roofR, slate, goldR, water, basalt, iron, lavaR, lav, night, neonM, neonC,
reef, seabed), dark → light, registered once into the shared `PALETTE/RGB` at import
(idempotent; fold them into `art/palette.ts` any time — registration then no-ops).
`BR.<ramp>` = indices. `C(ramp, i)` also accepts BASE ramp names and redirects them to the
reference ramps by relative step (`REF_OF`), so older drawings speak the new colours.
`dk/lt` step along biome ramps. **`BIOME_INK`** = the reference ink: ring biome sprites with
`inkOutline(img, BIOME_INK)` (the parchment `tint` with that ink).

## Zones — `index.ts`
| zone | family | landmarks (atoms) | set-pieces / stamps |
|---|---|---|---|
| `forest` | perception | classifier Lens Keep (red roofs) · segmentation U-Town | pines, oaks, grove, timber houses ×3, windmill, water tower, pier, **giant treehouse** |
| `wildwest` | perception | tabular_classifier Ledger Saloon | saguaros, tumbleweed, scrub, skull, mesas, butte, arch, saloon, store, sheriff, water tower, windmill, wanted board, trough, boomtown cluster, track h/v, steam engine, car, **mine cart**, station |
| `snow` | representation | simclr Twin Snow Castle (red flags) | snowy pines, snow peaks S/M/L |
| `marble` | sequence | transformer Blue-Spired Cathedral · rnn Marble Loop | palms, columns, broken column, pool |
| `stilts` | sequence | mamba Stilt Town | hoodoos, desert windmill, scrub, tumbleweed |
| `forge` | generative | diffusion Steam Foundry · pixelcnn Block Furnace · vae Hourglass Furnace · gan Twin Forges | **volcano** (64×55), smokestack, basalt spires, lava pool |
| `village` | decision | alphazero Rook Church | oaks, cottages, **domed observatory** (Decision hub) |
| `sunken` | decision | reinforce Dome of Chance · rl_maze Sunken Labyrinth | corals ×5, kelp, ruin, glass-dome hut, bubbles, fish schools, turtle, jellyfish |
| `cyber` | structure | gnn Nexus Spire · nerf Orbit Line | towers ×6, twin towers, holo boards, kiosk, dish, hover car, hanging cables, floating chunk |
| `sea` | — | — | galleon, sloop, islets (pines / tuft / bare), lighthouse islet, sea serpent, wave dash, clouds ×3, compass rose, ruins + pipelines corner icons; `cartouche(w, h)` title frame |

API:
- `ZONES`, `FAMILY_ZONE`, `ZONE_OF_ATOM`, `zoneOf(name, family?)`.
- `biomeStamps(zoneOrFamily) → BiomeStamp[]` — `{ name, role, img, foot, note }`; same shape as
  composeAuthored's `Glyph` (`{img, foot}`) so `tryStamp` can place them. Roles: decor · relief · town · rail · city · reef · fauna.
- `biomeLandmark(atom, emblem9?) → Sprite | undefined` — **36×46, anchor (18, 43), 9×9 slot**
  (castle contract); undefined → keep `castleSprite`. Emblems: ink on cream banners/tablets, neon on holo panels.
- `biomeMarker(zone, state, emblem7?)` — 20×28, anchor (10, 26), 7×7 slot, evidence-dressed:
  `wildwest` tent + signpost · `sunken` clam + pearl · `cyber` holo pod; else undefined (`markerSprite`).
- Detail tiers: `atTier(sprite|stamp, f)` — f = 1 full · 2 ÷2 · 3 micro (palette-preserving, anchor/foot/slot scaled).
- Grounds: `biomeGround(zoneOrFamily) → { key, at(x, y, apt), paint(img, mask, {land, protect, water, apt, ox, oy, border}) }`.
  `at` is the calm interior colour (drop-in for composeAuthored's `ground` hook via
  `groundHook(zone, px, apt)`); `paint` adds the zone's marks: forest/snow/marble patches,
  wild-west dry washes + lit NW lip, forge **lava rivers**, sunken **bathymetry + caustics +
  sand ripples** (paint it over the SEA pixels of the submerged region), cyber **neon grid +
  rain + canal lip + lit wall with dusk spill** on land neighbours (`border:false` for the floating island).
- Diorama edges: `paintCliffs(img, land, {depth≈8, ramp, ox})` — thick layered cliff under every
  south-facing coast (lip, strata seam, cracks, ragged foot, foam dots), darker east rim.
  `paintUnderside(img, islandMask, {depth≈18})` — the floating island's hanging rock teeth,
  hanging cables with lanterns, neon drips.
- Placement: `Layout` (occupancy + y-sort + optional ink ring), `blobMask`, `cityBlocks(put, …)`
  (towers per street-grid lot, skyline rising to a peak, plazas, never in front of a landmark),
  `coralCluster(L, x, y, k)`, `boomtown()`.
- `SCENES` / `biomeVignette(scene)` — forest · wildwest · heartland · forge · sunken · cyber · sea,
  composed at near detail (reference layouts; shown at 3 screen px per art px).

## Builder notes
- Draw order per slab: zone ground (`paint`) → rivers/roads → `paintCliffs` → stamps + sprites
  y-sorted (sprite shadows via `SHADOW` first) → labels in DOM.
- Underwater: the sunken region is sea — paint `REEF` over its sea pixels AFTER the parchment
  sea/hatching; land coast strokes stay. Nothing in these ramps is in `isWaterIdx`, so
  `parchmentize()` leaves them alone.
- Floating island: its own land mask, `paint(…, {border:false})`, lit rim, then `paintUnderside`
  into the sea below; drop its cliffs.
- Hero set-pieces (treehouse 46×54, volcano 64×55, observatory 30×32) exceed the 36×46 castle
  box: anchor them bottom-centre in free land near their zone's hub.
