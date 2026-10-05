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
| faces | Pixelify Sans (digits + Z: VT323 / Jersey 15); sentences Atkinson Hyperlegible Next (`textFont`) | Fell English SC signs, Alegreya text, digits Alegreya lining |
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
sheet title 24 · caption 12. Sentences (card prose, notes, gate rows, the
plate's caption) use `textFace(m)`; the pixel face voices names, buttons and
headings. Signs run at `sign(m, px)`; running text keeps `DRAWER.measure`
(19 em). A face whose figures misread (Pixelify's 5 = S, its Z = 2; Fell's
1 = I) gets a `unicode-range` override face (`app/lab/painted/layout.tsx`).

## Corners, margins, spacing

`CORNER`: one outer margin (12 phone / 20 desktop), one padding (12), one side
column (324) for cartouche and legend/minimap; the compass stands `stack`
(12, 8 quiet) on the scale bar; scale bar and legend share the bottom edge;
every sheet tab hangs to `tab` (36, 26 quiet); the open one is inked and pressed, not longer.
A control that cannot act is sunk flat (`disabledStyle`), never a ghost.
`SPACE` (card): section 24 · header→content 10 · sub-label 6 · lede 16.
`DRAWER`: 440 with the diagram, 336 text-only, phone snaps 0.2 / 0.5 / 0.88.

**Phones** (`PHONE`, < 640 px): one top bar in every view
(`corners/phone-bar.tsx`). The overview fills the screen under the bar with
the lands at the largest crisp scale (×1.5 at 390×844 @2x; only land signs
show there); the corners float over it and it pans sideways from its middle
("−" steps out to all of it). Lands go in at whole crisp scales (between
two, names drop to 7.5 px). Every land sign is whole near its spot or an
edge chip (`corners/edge-signs.tsx`, pixel and paper): a sign whose spot is
off screen, or that would slide a third of its width to stay whole, becomes
a chip; chips are hard for names. None while a card is open. A **Key**
button (bottom right) unfolds the map key. The sheet's top is the corners'
floor; pulled up full, the bottom stack steps away.

## Focus mode

A land or a model open, or zoomed in by hand (`quiet`): the cartouche folds to
one row (title, Whole map, magnifier), the scale bar to a slim strip of 4-px
cells, the minimap to a 176-px inset, the compass and tabs smaller. No mark
changes meaning, only size; the corners re-stamp in place. The map itself
focuses too: pixel fades the other lands with a dithered band, paper washes
them with the stock's veil and dims their names. While the diagram plate is
up and no hole fits it, the scale bar folds away, then the minimap: the chrome
yields, the plate never clips.

## The diagram plate (`map-plate.tsx`)

One chrome row (title, the real-vs-illustrative badge, Enlarge, Close) over
the drawing on its mat; the drawer holds the prose. It keeps the diagram
kit's legibility floor (anatomy2 `legible.ts`): the full drawing at the
smallest crisp zoom whose labels read (×1.5 on a retina screen), never ×1.
It stays a vignette: at most half the visible map's area, and it may not push
the map below ×2 (pixel) or one step out of the land (paper). Otherwise the
card at ×2 takes its place; a tap or Enlarge opens the full drawing. So
1440×900 and 1920×1080 show the full drawing, 1280×800 the card; phones keep
the card in the sheet. The pixel map hangs it in the kit's `dusk` theme
(`Material.diagram`): pixel's pastel roles on a warm umber ground, so the
plate reads as part of the map (plum read as pasted in); paper uses `paper`.

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
  size when zoomed; past ×1.4 every name is screen-steady. With a land's
  names open, the painter's plates take the live tags' size and weight: one
  label size per land. Boards he lettered for models the zoo lacks stay painting.
- Openness has three levels: whole map = land signs only (hover names a
  model); in a land = that land's names; a model = its card + named lineage.

## Loading a view

A view opens framed. Until everything its framing depends on is in (data,
picture, fonts, the corners and the plate measured — each re-plans it) and its
target has held for `SETTLE_MS`, the page is veiled and the camera jumps. The
veil is the library's loading surface (`corners/unrolling.tsx`, `labLoading`):
from the first paint the cartouche stands in its corner on the map's ground
(parchment; paper: a blurred 192-px copy of the painting) with one status
line ("Unrolling the map…"; offline, how to start the API) over a bar of four
segments, one per real step. Then the veil lifts in one cut, already in focus
mode; the cartouche stays put and the other corners stamp on together. `data-lab-ready` (lib/lab-contract.ts `useLabReady`) waits for
the reveal, the camera's `landed` and the stamp-on.

## Motion and life

`MOTION`: corners stamp on together (160 ms, `steps(2)`; the cartouche is already there),
re-stamp on a focus change (140 ms), the plate fades in on landing (180 ms,
`steps(3)`), the phone sheet eases (220 ms), roads march, the ring pulses.
Interface motion is stepped, never eased. The pixel map's life layer
(`life.ts`, a 12-fps canvas) breathes: water glints, lava, windows, gulls,
carts on every builds_on edge; every moving pixel keeps to its own colour
ramp and never covers a marker. Paper is still by design (a painting). All of
it freezes under `?still=1` and reduced motion.

## Marks → data

`encoding.ts` lists every mark and its datum in the library's shape
(`defineEncoding`, lib/encoding.ts); a mark not in it does not belong. The
corner legend renders `KEY` / `PAPER_KEY` (`defineKey`), so it cannot drift.
Counts come from lib/copy.ts `zooCounts`, pixel digits from lib/numerals.ts
`withDigits`, ready + the test hook from lib/lab-contract.ts.

## Lifting it into another project

Files: `material.ts`, `corners/*`, `drawer.tsx`, `card.tsx`, `map-plate.tsx`,
`plate-place.ts`, `labels.ts`, `roads.ts`, `overlay.tsx`, `marker.tsx`,
`heal.ts`, `painted-skin.tsx`, `anchors.ts` (+ `app/lab/painted/layout.tsx`
for the faces); the pixel art modules only for a pixel map.

1. Put your painting in `public/` and add it to `IMAGES`.
2. Map it in `anchors.ts` as a `PaintedMap` (image px): `anchors` (one spot
   per item, its why beside it), `junctions` + `roads` joining every anchor,
   `lands` polygons + `signs`, and `baked` (the painter's lettering: titles to
   redraw, plates to re-letter, his chrome to paint out).
3. Write a `Material`: inks, faces (+ a digits face if its figures misread,
   a `textFont` for sentences), plate construction (`crisp` / `card`), `marks`.
4. Replace the data: `useLabData` (hooks/use-lab-data.ts, no layout) feeds
   names, groups, evidence; the card reads `cardModel`; `FAMILY_TITLE` /
   `PAPER_*` hold the group words.
5. Swap the plate's `MechanismDiagram` for yours (placement needs its size;
   `plateFits` in `painted-skin.tsx` lists what it may show, best first).
6. Rewrite `encoding.ts`. Skins reusing the corners pass their own `Material`
   and, for the card, an optional `glyph` to the Drawer.
