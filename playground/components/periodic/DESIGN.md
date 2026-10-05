# Periodic table: one chart, three skins

The 44 mini_networks models as a periodic table: atoms in row 1, each lower row
a generation that builds on the rows above, families as column blocks,
compositions set apart as an f-block. **Signature element:** the element tile,
with its number, mechanism glyph, two-letter symbol and name, drawn the same
way in every skin. Only the ink changes.

The boilerplate value is the **skin system**. There is one table structure (the
`.tsx` files here) and N token sets (`skins/*.ts`). A skin can change how a mark
looks but never what it means.

Routes: `/?edition=blueprint`, `/?edition=wallchart`, `/?edition=terminal`
(`&still=1` freezes motion). The chart sets `data-lab-ready="1"` once it has drawn.

## Files

| File | Draws / does |
|---|---|
| `skins/types.ts` | `PeriodicSkin`, the contract: every token a skin may set |
| `skins/{blueprint,wallchart,terminal}.ts` | the three token sets (the only colour literals) |
| `skins/index.ts` | `PERIODIC_SKINS` registry, `skinVars()` turns tokens into CSS vars, `applySkin()` paints them on `<html>` |
| `periodic.css` | every rule, reading only `--pt-*` / `--skin-*` / global colour vars |
| `periodic-table.tsx` | the sheet: masthead, wide table, family stack, f-block, key |
| `masthead.tsx` | title (or shell prompt) and the ruled count block (models / atoms / reactions) |
| `table-grid.tsx` | wide layout (≥1024px): 16 columns, family heads, the key in the empty bay |
| `family-stack.tsx` | narrow layout: each family as its own small table, same rows |
| `reaction-block.tsx` | the f-block of compositions (11 across when wide, wrapping when narrow) |
| `element-tile.tsx` | one tile, used by the table, the key and the spec-sheet drawer (`size="spec"`) |
| `chart-key.tsx` | annotated sample tile and the three tile kinds |
| `placed.ts` | taxonomy → `PlacedModel[]` / `PlacedReaction[]` (the shape both layouts draw) |
| `encoding.ts` | mark → data table, plus the key's text |

## Tokens (per skin; see `skins/types.ts` for every field)

| Group | Blueprint | Wall chart | Terminal |
|---|---|---|---|
| `color.paper / ink` | `#0a2540` / `#dff3ff` | `#efe3c8` / `#2b1d12` | `#050805` / `#7dff9a` |
| `color.line / lineFaint` | `#9fdcf5` / `#1d4468` | `#5b2320` / `#c9b58e` | `#4ddc72` / `#174a28` |
| `color.accent` (interaction only) | `#f2c27e` soft amber | `#8a1f1c` oxblood | `#e9d47e` amber cursor |
| `family` tints | none (single ink) | six pastels | none |
| `type.display / body` | Big Shoulders / Martian Mono | Instrument Serif / Martian Mono | VT323 / VT323 |
| `type.textCase` | uppercase (CV) | none (Cv) | none |
| `border.atom / compound / reaction` | 1.5 solid / 1 solid faint / 1 dashed | same, oxblood mixes | 1 solid / 1 faint / 1 dashed |
| `fill` atom / compound | 80% / 40% paper-deep | 100% / 50% family tint | none |
| `interaction` | accent | accent | inverse video |
| `motion.enter / rowStagger` | 0.30s / 0.07s | 0.30s / 0.07s | 0.18s / 0.05s |
| `masthead` | title | title | prompt |

The global names (`--paper --ink --line --redline …`) are the ones `globals.css`
maps to Tailwind colours, so the shared chrome (title block, drawer) follows the skin.

## Type scale (blueprint values; each skin sets its own)

Title 2.75rem, clamped down to 1.75rem on phones · atom symbol 27px · compound 23px ·
reaction 18px · family head 10px · tile number 9px · tile name 8.5px, capped at
`nameFit` (12cqi), so a 12-letter word fits one tile line · small text 10px.
VT323 runs about 25% small, so the terminal raises every size and zooms the chrome.

## Layout grid

- Wide (≥1024px): 16 equal columns, gap `space.gap`, rows `space.row` (5.25rem).
  Family heads span their column blocks (`lib/blueprint` `FAMILY_BLOCKS`). The key
  sits in the empty bay (cols 7–10, rows 3–5). The f-block uses the same 16-column
  grid: its label takes cols 1–2 and its tiles cols 3–13.
- Narrow: families flow left-aligned as separate tables, `space.stackCell` wide
  (5rem), keeping their generation rows. The f-block wraps, and the key follows it.
- Everything is left-aligned. The only right-aligned item is the f-block label,
  which sits flush against its tiles.

## Mark → data

See `encoding.ts` (`TABLE_ENCODING`): column block = family, row = generation,
border style = level, number = atomic number / ✻n, glyph = mechanism, symbol =
chart symbol, accent = interaction only. The key renders `KEY_PARTS` and
`KEY_LEVELS`, so it cannot drift from the marks.

## Motion

One entry: tiles fade in row by row (`motion.rowStagger`) and column by column
(`motion.colStagger`). After that the f-block follows (`reactionStart`). Nothing
loops. `?still=1` and `prefers-reduced-motion` both go through the page's
`<MotionConfig reducedMotion>`. That leaves only the opacity fade, which is
over within a second. Hover and focus transitions
take 150ms and only recolour; they never move anything.

## Add a fourth skin

1. Copy `skins/terminal.ts` to `skins/<id>.ts`, rename the export and fill every
   token. TypeScript refuses a skin with a missing field.
2. If it needs a new face, load it in `app/layout.tsx` with `next/font` and pass its
   variable (`"--font-x"`) as `type.display` / `type.body`.
3. Register it in `PERIODIC_SKINS` (`skins/index.ts`) and add the id to `EditionId` /
   `EDITIONS` in `components/title-block.tsx` and `EDITION_IDS` in `app/(classic)/page.tsx`.
4. Shoot `/?edition=<id>&still=1` at 1440×900 and 390×844. No CSS changes are needed.
   If you reach for a CSS block, add a token to `types.ts` instead.

## Lift it into another project

Copy `components/periodic/` and `lib/blueprint.ts` (placements, symbols, atomic
numbers), plus `lib/icons.tsx` for the glyphs (lucide-react). Import `periodic.css`
once, from the layout. Data shape: `{ models: { name, level: "elementary"|"derived",
introduces[], note }[], compositions: { name, composes[] }[] }`, the
`/web/taxonomy` response (`lib/types.ts`). Call
`applySkin(document.documentElement, PERIODIC_SKINS.blueprint)` in an effect and
render `<PeriodicTable taxonomy skin onSelect />`. Then replace the placements in
`lib/blueprint.ts` with your own items and families. Needs `motion` (motion/react).
