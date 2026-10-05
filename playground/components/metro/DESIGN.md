# Transit: design notes

One connected system map in the Beck / Vignelli tradition. Groups are lines,
items are stations, and an item that belongs to two groups is an interchange
ring where you change. It lives at `/?edition=metro`.

**The signature element** is the octilinear drawing itself: every leg at
0°, 45° or 90° on one 20 px grid, one bend radius, pastel lines on a neutral
porcelain sheet, and an audit that holds the drawing to the genre (no
crossings, no overlaps, no line through a station it does not serve, no name
touching anything). The audit counts are on the SVG as `data-*`.

## Tokens (`tokens.ts`, the only source of values)

| Token | What it holds |
|---|---|
| `SHEET` | paper, paper-deep, ink, ink-dim, line-faint, accent (hover), sample track, bullet letter (ink), unknown line |
| `SHEET_VARS` / `applySheet` | the sheet as CSS vars (`--paper`, `--ink`, ...) painted on `<html>`, so shared chrome reads the same colours |
| `LINE_COLORS` | one pastel per line, each holds an ink letter |
| `TYPE` | the face, sizes (label 13, title 21, note 12, key 12.5, key heads 11, bullet 11), weights, glyph-width metrics |
| `GRID` | pitch 20, corner 14, track 6 |
| `MARK` | origin / ring / tick / terminus / train sizes, each with its `extent` toward the name; `labelClear` 4.5 |
| `SPACE` | cartouche padding, key columns + rows, phone min width + frame fade, page max width, tab row height |
| `MOTION` | train speed, still pose, fade, the dim on hover |

## Type scale

One face, Jost (a geometric sans in the Johnston lineage). Station names are
13 px, semibold for origins and interchanges (where you change), regular for
stations on one line. Bullet letters are 11 px ink on the pastel (white failed
contrast). The cartouche title is 21 px semibold over 12 px notes. No district
names: they floated in leftover space; line colour + key carry the family. A name always sits at
`mark extent + labelClear` from the station centre, measured per kind, so a
terminus bar never crowds its name.

## Layout grid

The sheet is `cols × rows` cells (69 × 40 here). Stations and bare corners
sit on whole cells. The cartouche is a reserved rect in the empty south-east.
On desktop the map fits the viewport height. Phone rule: the map keeps 1180 px
and pans sideways inside its frame (it opens on the knot; the frame's sides
fade over `SPACE.frameFade` so a name never ends in a hard cut), and the key
sits above it as HTML (`PhoneKey`), folded into a disclosure so the map leads.

## Components

| File | Draws |
|---|---|
| `system.ts` | the engine: `buildSystem(spec)` → px geometry, marks, label boxes, audit, fallback placement; `trainPose` |
| `layout.ts` | this zoo's drafting (`STATIONS`, `ROUTES`, `DISTRICTS`, `CARTOUCHE`) and `zooSpec(taxonomy)` |
| `map.tsx` | the SVG: area names, tracks (auto spurs dashed), trains, stations, then children |
| `station.tsx` | one station: mark, name, hit area, keyboard + tooltip |
| `train.tsx` | one train per line: SMIL when live, parked when still |
| `marks.tsx` | `Mark`, `TrainBody`, `KeyGlyph` (key sample = the real mark), `Bullet` |
| `key.tsx` | `Cartouche` (in-SVG key in the reserved rect) and `PhoneKey`, from the same data: per line `models` (its family) and `stops` (every station it calls at) |
| `tabs.tsx` | the Jost sheet row (Map / Reactions / Observatory + edition picker) that replaces the classic title block |
| `services.tsx` | through services: a list whose rows light their stations on the map |
| `metro-chart.tsx` | the page: header, key, map frame, under-construction list, services; `METRO_TITLE` (cartouche + phone header; the tab reads `Transit \| mini_networks`) |
| `hooks.ts` | the `?specimen=1` flag and the tab title (still: `lib/lab-contract.ts` `useStill`) |

## Marks

Every mark and what it encodes is in `encoding.ts` (`ENCODING`, `lib/encoding.ts`), and
the key renders `KEY` (`defineKey` rows naming their marks), so it cannot drift. The
dashed-spur row appears only when the fallback placed something.

## Motion

Only the trains move: one per line, riding its longest drafted path outward
from its origin, fading at each end. `?still=1` and `prefers-reduced-motion`
park every train mid-leg (`MOTION.trainStillT`), never on a station.
Hovering a through service dims the rest of the map (160 ms). Nothing loops
on page load.

## Views (the /lab contract)

`/?edition=metro&still=1` (and `&specimen=1`). The map's SVG carries
`data-lab-ready="1"` once it is laid out, Jost has loaded, the sheet fade is over and
two frames have painted it (`useLabReady`, `lib/lab-contract.ts`); the audit counts sit beside it as `data-*`.

## Lifting it into another project

Copy `components/metro/` except `layout.ts`, plus `lib/world/path.ts`
(`roundedD`, `polylineLength`, `samplePolyline`) and `lib/{lab-contract,copy,encoding}.ts`. Write your own drafting
file that returns a `SystemSpec`:

```ts
const spec: SystemSpec = {
  cols: 40, rows: 24,                                  // sheet in cells
  lines: [{ id: "web", name: "Web", color: "#6b8fd0" }],  // key order
  stations: [
    { id: "api", label: "api", lines: ["web"], origin: true, symbol: "Ap",
      at: { x: 4, y: 12, side: "w" } },                // drafted cell + name side
    { id: "auth", label: "auth", lines: ["web", "ops"], parents: ["api"] },  // no `at`: auto-placed
  ],
  routes: { web: [["api", [8, 12], "cache"]] },        // per line: paths of ids + bare corners
  areas: [{ id: "west", name: "West", x: 6, y: 20, anchor: "middle" }],
  reserved: [{ id: "cartouche", x: 26, y: 15, w: 13, h: 8 }],
};
const layout = buildSystem(spec);
```

`lines[0]` of a station is its own line and sets its mark colour. Two or more
lines make it an interchange. A station with no `at` is placed by the
fallback: a straight spur from a station already on its line (parents first),
at the nearest free cell where nothing gets worse in the audit, with each other
line joining by a short straight or one-elbow spur. A line it cannot reach
shows up in `audit.serviceMismatch`. It is never faked. Draft only what
matters and let the fallback hold the rest.

Replace: `tokens.ts` (sheet, line colours, face), `encoding.ts` (mark copy),
`METRO_TITLE` / `NOTE` in `metro-chart.tsx`, and the `Services` data. Keep the
audit at zero: `lib/world/metro.test.ts` shows the invariants worth testing.
