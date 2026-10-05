# The painted kit

An illustrated map is the interface. A painting (or a pixel map) fills the
viewport edge to edge; the data lives on it as marks on hand-mapped spots, and
everything that is not the map is cartographic furniture in the **four
corners**: title cartouche + search (top left), sheet tabs (top right), the
compass that navigates standing on the scale bar that measures (bottom left),
and a legend that turns into a minimap when you zoom (bottom right). Picking a
place opens a **reading panel** (the drawer, right; a bottom sheet on phones)
and hangs a **diagram plate** on the map beside it, tied by a leader line.

**Signature element:** the compass rose *is* the navigation. Its four long
points pan, its hub returns to the whole map, the zoom rail stands beside it,
and it sits on the scale bar exactly as on a printed sheet
(`corners/compass.tsx`).

Two materials share one component tree: `pixel` (the product) and `paper`
(a painted storybook map, a kept boilerplate). `/lab/sky` reuses the corners
and the drawer with its own material (`components/lab/sky/tokens.ts`).

## Tokens: `material.ts` is the only source

Every component reads colours, faces, sizes, gaps, borders, shadows and
timings from `material.ts`. Art modules (`pixel-art.ts`, `life.ts`,
`true-map.tsx`, `sea-furniture.ts`, `stage.tsx`, `pixel-icon.tsx`) are not
chrome: they carry the pixel map's own palette ramps beside their sprites.

| token | pixel | paper |
|---|---|---|
| `sea` (beyond the image) | `#f0e1ae` parchment | `#8fb7c9` sea blue |
| `plate` / `plateHi` | `#f0e1ae` / `#fdf4c1` | `#f1ddb8` / `#fff0d2` |
| `border` / `rule` | `#7a2424` maroon / `#e9deb0` bevel | `#4a3322` sepia / `#7a5a3a` |
| `ink` / `inkSoft` | `#3a1d2a` / `#715755` | `#2b1d12` / `#6a5139` |
| `loud` / `loudInk` (selected) | `#7a2424` / `#fdf4c1` | `#7a2e1c` / `#fff4dc` |
| `road` / `ring` | `#fdc771` / `#e91c1d` | `#f4b73e` / `#c0392b` |
| faces | Pixelify Sans, digits VT323 / Jersey 15 | Fell English SC signs, Alegreya text, digits Alegreya lining |
| `signScale` / `nameFont` | 1 / — | 1.2 (small caps run small) / Alegreya (a name keeps its case) |
| border | `--ap` (1 art px) solid | 2 px solid, radius 3 |
| shadow | `--ap --ap 0 #221316`, hard | `card.drop` 3 px hard sepia + laid-paper `card.grain` |
| evidence fills | champion `#fece66`, trained `#597b29`, provisional dashed, untrained `#9a8e88` | `#e9b52c`, `#5f9e5a`, dashed, `#cbbfa8` |

Every pixel token is an entry of the map's 128-colour palette (index in the
comment). `marks` holds the SVG overlay's inks (re-cut plates, seals, star,
critter) per map.

## Type scale (`TYPE`, CSS px)

Card: name 28 · section head 14 · body 15/1.4 · note 13/1.35 · meta 12 ·
chip 14 · stamp 13 · badge 11. Chrome: display 32 (20, 16 when quiet/phone) ·
lead 16 · plate title 15 · link 14 · tab 20 (14) · aside 14 (12) · button 13 ·
sheet title 24 · caption 12. The sign voice runs at `sign(m, px)` =
`px × signScale`. Running text keeps `DRAWER.measure` (19 em ≈ 38 chars).
Numbers are data: a face whose figures misread (Pixelify's 5 = S, Fell's
1 = I) gets a digits-only `unicode-range` face (`app/lab/painted/layout.tsx`).

## Corners, margins, spacing

`CORNER`: one outer margin (12 phone / 20 desktop), one inner padding (12),
one side column (324) for cartouche and legend/minimap; compass stands
`stack` (12, 8 quiet) above the scale bar; scale bar and legend share the
bottom edge. `SPACE` (card): section 24 · header→content 10 · sub-label 6 ·
lede 16. `DRAWER`: 440 with the diagram, 336 text-only, phone snaps
0.2 / 0.5 / 0.88 of the height.

## Focus mode

A land or a model open, or zoomed in by hand (`quiet`): the cartouche folds to
one row (title, Whole map, magnifier), the scale bar to a slim strip of 4-px
cells, the minimap to a 176-px inset, the compass and tabs smaller. No mark
changes meaning, only size; the corners re-stamp in place. The map itself
focuses too: pixel fades the other lands with a dithered band, paper washes
them with the stock's veil and dims their names. While the diagram plate is
up and no hole fits it, the scale bar folds away, then the minimap: the chrome
yields, the plate never clips.

## Label obstacle rules

- A label never sits half under anything: the diagram plate, its leader and
  the corner plates are **hard** (`labelHard`); a name that cannot clear them
  moves or is left off, never cut.
- Land signs keep their painted spot; one under the furniture steps to the
  nearest clear spot (a sign height up/down, a third of its width sideways).
- Paper: the painter's lettering is retouched out of the painting once
  (`heal.ts`: clone stamp for plates, a rim wash + grain for large chrome), so
  a plate we leave off leaves painting, not old letters. Titles are redrawn on
  our stock, set to fit, kept whole in view, and keep their whole-sheet screen
  size when zoomed; past ×1.4 every name is screen-steady.
- Openness has three levels: whole map = land signs only (hover names a
  model); in a land = that land's names; a model = its card + named lineage.

## Motion and life

`MOTION`: corners stamp on in turn (160 ms, `steps(2)`, 90 ms stagger),
re-stamp on a focus change (140 ms), the plate fades in on landing (180 ms,
`steps(3)`), the phone sheet eases (220 ms), roads march, the ring pulses.
Interface motion is stepped, never eased. The pixel map's life layer
(`life.ts`, a 12-fps canvas) breathes: water glints, lava, windows, gulls,
carts on every builds_on edge; every moving pixel keeps to its own colour
ramp and never covers a marker. Paper is still by design (a painting). All of
it freezes under `?still=1` and reduced motion.

## Marks → data

`encoding.ts` lists every mark and the datum it encodes; a mark not in that
table does not belong on the screen.

## Lifting it into another project

Files: `material.ts`, `corners/*`, `drawer.tsx`, `card.tsx`, `map-plate.tsx`,
`plate-place.ts`, `labels.ts`, `roads.ts`, `overlay.tsx`, `marker.tsx`,
`heal.ts`, `painted-skin.tsx`, `anchors.ts` (+ `app/lab/painted/layout.tsx`
for the faces). The pixel-only art modules come along only for a pixel map.

1. Put your painting in `public/` and add it to `IMAGES`.
2. Map it in `anchors.ts` as a `PaintedMap` (image px):
   - `anchors: { name: [x, y, why] }`, one spot per item, the why kept beside
     the number;
   - `junctions` + `roads: { a, b, via?, kind? }`, the painted roads, joining
     every anchor (lineage routes run on them);
   - `lands: { group: polygon }` and `signs: { group: [x, y] }`;
   - `baked: { kind, text, name?, box }`, the painter's own lettering:
     `family` titles to redraw, `model`/`invented` plates to re-letter,
     `chrome` (his compass, cartouche, scale bar) to paint out.
3. Write a `Material` in `material.ts` for your sheet: inks, faces (+ a
   digits face if its figures misread), plate construction (`crisp` for pixel
   art, `card` for cardstock), `marks`.
4. Replace the data: `useWorld` (taxonomy, evidence) feeds names, groups and
   evidence; the card reads `cardModel`; `FAMILY_TITLE` / `PAPER_*` hold the
   group words.
5. Swap the diagram plate's content (`MechanismDiagram`) for yours; the
   placement (`plate-place.ts`) only needs its size.
6. Rewrite `encoding.ts` for your marks.

Skins that reuse the corners pass their own `Material` and, for the card, an
optional `glyph` to the Drawer.
