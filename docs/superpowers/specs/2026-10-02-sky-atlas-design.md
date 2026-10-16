# Star atlas: the Celestial Zoo (2026-10-02)

Owner: "I like the idea of a sky … like with constellations" → the eighth
design, /lab/sky. An ANTIQUE celestial chart (Cellarius / Uranometria), not a
planetarium: deep indigo night, gold and cream engraving ink, the paper-map
typefaces (IM Fell SC display, Alegreya body).

## Stage (SVG in lib/world px, the lab contract)
- Positions come ONLY from lib/world (`useWorld`, pixel preset): every model is
  a STAR at `node.center`; every family a CONSTELLATION over its
  `camera.regions[family]` box.
- Star glyph = evidence (the magnitude scale): champion 8-ray gold star with
  halo · trained 4-ray cream star · provisional hollow ring · untrained dim dot.
  Atoms are the named bright stars (labels always; derived names on hover /
  zoom via `world.labels`).
- Constellation lines = lineage edges (`world.roads`): same-family solid gold
  hairlines star-to-star; cross-family bridges dashed and fainter.
- Each constellation carries a hand-drawn FIGURE (figures.ts: unit-box SVG
  paths mapped onto the region box): Perception an eye, Sequence a serpent,
  Generative a phoenix-flame, Representation twin mirrors, Structure a crystal
  lattice, Decision a bow and arrow. Thin double stroke, low opacity — the one
  bold element; everything else quiet.
- Background: flat indigo + faint deterministic field stars + one soft dust band.
- Selection: the star rings, its lineage lines brighten, other constellations
  dim; its pipelines appear as dotted teal arcs between the composed stars.

## Chrome: the four corners, night material
- `material.ts` gains the `sky` material (indigo plates, gold rule, cream ink);
  the painted corners (Cartouche, Compass, ScaleBar, CornerPlate legend) and
  the Drawer are reused as-is — one UI, three materials. Top-right: "map only".
- Diagrams in the drawer use the dark anatomy theme.

## Files
`app/lab/sky/{layout,page}.tsx`, `components/lab/sky/{sky-skin.tsx,
figures.ts, encoding.ts}`, `lib/designs.ts` (+ Star atlas), CLAUDE.md.
Shoot with `node scripts/shoot.mjs --skin sky --round N` (generic states).
