# Periodic table: one chart, three skins

The 44 mini_networks models as a periodic table: atoms in row 1, each lower row
a generation that builds on the rows above, families as column blocks,
compositions set apart as an f-block. **Signature element:** the element tile,
with its number, mechanism glyph, unique two-letter symbol and name, drawn the
same way in every skin. Only the ink changes. The boilerplate value is the
**skin system**: one table structure (the `.tsx` files here), N token sets
(`skins/*.ts`); a skin changes how a mark looks, never what it means.

Routes: `/?edition=blueprint`, `/?edition=wallchart`, `/?edition=terminal`
(`&still=1`: no entrance at all). `data-lab-ready="1"` fires only after the last
tile has landed and the sheet is fully opaque (`entrance.ts`).

## Symbols (unique across the chart: `lib/world/chart-symbols.test.ts`)

Atoms keep their hand-set chemistry symbols. Every other name, in chart order
(derived models by atomic number, then reactions by ✻ index), takes the first
candidate no earlier tile holds: (1) first letter + the initial of each later
word (`text_seq2seq` Ts); (2) first letter + its first different letter
(`resnet` Re); (3) first letter + each later consonant, then each later letter;
(4) three letters. Never a doubled letter. Code: `lib/blueprint.ts`
`symbolCandidates` / `symbolFor` / `reactionSymbols`; tiles get a reaction's
symbol from `placed.ts` (`tileSymbol` for the drawer).

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
| `family-head.tsx` | a family head's text: numeral span (a skin may hide it) + name |
| `entrance.ts` | `entranceEnd` (the entrance's length); still and ready are `lib/lab-contract.ts` |
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
| `type.display / body / name` | Big Shoulders / Martian Mono / Big Shoulders | Instrument Serif / Martian Mono / Instrument Serif | VT323 ×3 |
| `famhead` numeral · rule | none · hairline above | I–VI · tint band | none · dashed below |
| `type.textCase` | uppercase (CV) | none (Cv) | none |
| `border.atom / compound / reaction` | 1.5 solid / 1 solid faint / 1 dashed | same, oxblood mixes | 1 solid / 1 faint / 1 dashed |
| `fill` atom / compound | 80% / 40% paper-deep | 100% / 50% family tint | none |
| `interaction` | accent | accent | inverse video |
| `motion.enter / rowStagger` | 0.30s / 0.07s | 0.30s / 0.07s | 0.18s / 0.05s |
| `space.row / reactionRow` | 5.25 / 4.75rem | 5.25 / 4.75rem | 4.75 / 5rem (fits 900 px) |
| `masthead` | title | title | prompt |

The global names (`--paper --ink --line --redline …`) are the ones `globals.css`
maps to Tailwind colours, so the shared chrome (title block, drawer) follows the skin.

## Type scale (blueprint values; each skin sets its own)

Title 2.75rem, clamped down to 1.75rem on phones · atom symbol 27px · compound 23px ·
reaction 18px · family head 14px · tile number 10px · tile name 13px (reactions 12px)
in the skin's name face · small text 11px. The floor: no tile name below 11px. Names
wrap between words; only a word over 12 letters may hyphenate. Every skin's sheet,
f-block included, fits 1440×900 without scrolling.

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

See `encoding.ts` (`ENCODING`, shape `lib/encoding.ts`): column block = family, row = generation,
border style = level, number = atomic number / ✻n, glyph = mechanism, symbol =
chart symbol, accent = interaction only. The key renders `KEY_PARTS` and
`KEY_LEVELS` (`defineKey` rows naming their marks), so it cannot drift.

## Motion

One entry: tiles fade in row by row (`motion.rowStagger`) and column by column
(`motion.colStagger`). After that the f-block follows (`reactionStart`). Nothing
loops. Under `?still=1` or `prefers-reduced-motion` there is no entrance: every
tile is drawn final (`useStill` → `motion = null`). Hover and focus transitions
take 150ms and only recolour; they never move anything.

## Add a fourth skin

1. Copy `skins/terminal.ts` to `skins/<id>.ts` and fill every token (TypeScript
   refuses a missing one). A new face: load it in `app/layout.tsx` with `next/font`
   and pass its variable (`"--font-x"`) as `type.display` / `body` / `name`.
2. Register it in `PERIODIC_SKINS` (`skins/index.ts`), `EditionId` / `EDITIONS`
   (`components/title-block.tsx`) and `EDITION_IDS` (`app/(classic)/page.tsx`).
3. Shoot `/?edition=<id>&still=1` at 1440×900 and 390×844: the sheet must not scroll
   at 900 px. No CSS changes; if you reach for a CSS block, add a token instead.

## Lift it into another project

Copy `components/periodic/` and `lib/blueprint.ts` (placements, symbols, atomic
numbers), `lib/icons.tsx` (lucide-react glyphs) and `lib/{lab-contract,copy,encoding}.ts`. Import `periodic.css`
once, from the layout. Data shape: `{ models: { name, level: "elementary"|"derived",
introduces[], note }[], compositions: { name, composes[] }[] }`, the
`/web/taxonomy` response (`lib/types.ts`). Call
`applySkin(document.documentElement, PERIODIC_SKINS.blueprint)` in an effect and
render `<PeriodicTable taxonomy skin onSelect />`. Then replace the placements in
`lib/blueprint.ts` with your own items and families. Needs `motion` (motion/react).
