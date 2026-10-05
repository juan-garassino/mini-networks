# The design library

Every kept design draws the same zoo (`/web/taxonomy`, `/web/evidence`) and doubles as a
boilerplate for other web projects. Each has its own `DESIGN.md` (tokens, type, grid, marks,
how to lift it). This page holds what they **share**: the lab contract, the encoding shape,
the numerals rule, names and counts, titles and the drawer pattern.

## Index

Ports: `scripts/ports.mjs` (`make playground-ports`, over the dev server on :3000). The painted
kit (pixel and paper map) adopts the conventions below next round (see *Painted kit*).

| Design | URL | Port | What it is |
|---|---|---|---|
| [Pixel map](components/lab/painted/DESIGN.md) | `/lab/painted/?map=pixel` | 3001 | The product: the owner's painted pixel world, live data in four corners. |
| [Paper map](components/lab/painted/DESIGN.md) | `/lab/painted/?map=paper` | 3002 | The same kit on the storybook painting. |
| [Star atlas](components/lab/sky/DESIGN.md) | `/lab/sky/` | 3003 | The Night Map: nebulae are families, stars are models, lines are lineage. |
| [Kawaii flow](components/lab/flow/DESIGN.md) | `/lab/flow/` | 3004 | A data-flow sheet: family lanes, generation columns, zero-crossing wires. |
| [Transit](components/metro/DESIGN.md) | `/?edition=metro` | 3005 | One octilinear system map: a line per family, interchange rings. |
| [Periodic table](components/periodic/DESIGN.md) | `/?edition=blueprint` `wallchart` `terminal` | 3006–3008 | One table, three token skins. |
| [Pixel diagrams](components/lab/shared/anatomy2/DESIGN.md) | `/lab/anatomy/` | 3009 | "How it works": one mechanism diagram per model; every drawer embeds it. |

## Contract: ready and still (`lib/lab-contract.ts`)

- **Still** = `?still=1` **or** `prefers-reduced-motion`, read with `useStill()`. Still means
  **frame 0**: every loop holds its first frame, nothing enters (no fade, stagger or slide), the
  camera jumps instead of flying. `useStillParam()` is `?still=1` alone, the screenshot flag:
  it also stops data polling, hides lab furniture and pins diagrams at their still frame
  without controls.
- **Ready** = `data-lab-ready="1"` on the design's root, set **once**, by
  `useLabReady(settled, rootRef, afterMs?)`. Pass `settled` only when the data is in, the layout
  is computed, the camera has landed (`useCamera(...).landed`) and any entrance is over
  (`afterMs` = its length). The hook then waits for the fonts, for every ancestor to be opaque,
  and for two painted frames.
- **Hook and views**: `installLabHook({ select, view })` once ready (`window.__lab`); `useLabView()`
  for `?zoom=overview|region|node&focus=<model>`; `LabMotion still={still}` freezes Motion.

```tsx
const still = useStill();
const ready = useLabReady(Boolean(data && layout && cam.landed), rootRef);
useEffect(() => (ready ? installLabHook({ select, view }) : undefined), [ready, select, view]);
return <LabMotion still={still}><div ref={rootRef} data-lab-ready={ready}>…</div></LabMotion>;
```

## Encoding shape (`lib/encoding.ts`)

Each design's `encoding.ts` exports `ENCODING = defineEncoding({ "<mark name>": { encodes,
mark?, kind?, source?, token?, prim? } })`. `kind` is `data` (default), `interaction`, `motion`,
`chrome` or `decoration`; a drawn mark that is none of these is cut. A legend is
`defineKey(ENCODING, { title?, rows: [{ mark, sample, label }], notes? })`. TypeScript rejects
a row whose `mark` is not in the encoding. The key component renders the rows and draws each
`sample` with the design's real mark, so the key cannot drift. `lib/world/library-encodings.test.ts`
audits every design.

## Numerals (`lib/numerals.ts`, `lib/fonts.ts`)

Numbers are data, so a digit must never read as a letter. A design that sets text in a **pixel
face** puts `pixelDigits.variable` (`--font-pixel-digits`: VT323 for regular weights, Jersey 15
for bold, digits only, sized to Pixelify's cap height) on its route layout. It builds every
pixel stack with `withDigits("var(--font-pixel), monospace")`. Designs whose faces already have
clear digits keep them: the periodic skins (Martian Mono, VT323), transit (Jost), Kawaii flow
(M PLUS Rounded), the diagram kit (5×7 bitmap; Atkinson prose). Never small-cap a numeral.

## Names, counts, titles (`lib/copy.ts`)

- `displayName(id)`: underscores become spaces. Case belongs to the design (CSS), not the string.
- `zooCounts(taxonomy, evidence?, family?)` returns `{ models, atoms, pipelines, families, proven }`.
  `NOUNS` and `countOf()` give the words. A design may name pipelines in its own vocabulary
  (periodic "reactions", transit "through services") but takes the number from here.
- Titles: the root layout sets the template `%s | mini_networks`. Each route exports
  `metadata.title` (a server `layout.tsx` or `page.tsx`, never a client page). A design switched
  in place on the client uses `pageTitle(name)`, as transit does.

## Drawer pattern

Shared: selecting a model writes `?zoom=node&focus=<model>`, and the drawer follows the URL.
On desktop it docks right and the camera refits to the width left. On a phone it is a bottom
sheet. Under still it is simply there, with no entrance. × and a tap on empty ground close it. Top to
bottom: the design's own evidence glyph + `displayName` + place line, a one-sentence lede,
the **pixel diagram** (`MechanismDiagram`, card with "Open full diagram"), lineage (built on /
leads to), proof (champion, bar, best metric), then pipelines.

| Design | Drawer | Glyph | Differs |
|---|---|---|---|
| Periodic, transit | `components/element-sheet.tsx`, right sheet `max-w-lg` over a dimmed overlay | element tile | classic spec sheet: network-flow schematic and an inference box; full width on a phone |
| Star atlas | painted kit `Drawer` (440 px right; peek / half / full phone sheet) | star sprite | night material; full diagram takes over the stage |
| Kawaii flow | `components/lab/flow/drawer.tsx`, full-height right; phone sheet ≤ 55 % | creature | DFD address, evidence meter, pipelines shown on the sheet |
| Pixel diagrams | none: it *is* the drawer's diagram | n/a | `variant="card"` in drawers, `"full"` on its page |

A new design reuses the painted kit's `Drawer` (it has corners) or the flow drawer's order (its
own chrome). The classic `ElementSheet` is legacy, so do not copy it.

## Starting a new design

1. Copy the nearest design's folder as the skeleton: canvas world → star atlas; graph sheet →
   Kawaii flow; schematic → transit; grid → periodic.
2. Add `app/<route>/layout.tsx` with `metadata.title` and the design's fonts (plus
   `pixelDigits` for a pixel face). Keep the page itself a thin client component.
3. Put every value in one `tokens.ts`, then write `encoding.ts` before drawing. Each mark gets a
   row with a kind; each key renders from `defineKey`.
4. Wire the contract: `useLabView`, `useStill`, `useLabReady`, `installLabHook`. Take counts and
   names from `lib/copy.ts`.
5. Write `DESIGN.md` (≤ 120 lines). Add the route to `scripts/ports.mjs` and the table above.
   Shoot it with `still=1` at 1440×900 @2x and 390×844.

## Painted kit: what it adopts next

`components/lab/painted/**` keeps its own copies until its round. It needs: `useLabReady` with
the camera's `landed` in `painted-skin.tsx` (a node deep link is ready only once landed);
`encoding.ts` as `defineEncoding`, with the key and legend plates rendered from `defineKey`
(paper's key has drifted); `pixelDigits` from `lib/fonts.ts` in place of its copy in
`app/lab/painted/layout.tsx` (move the font files to a shared folder then); cartouche counts
from `zooCounts`; and a `metadata.title` for `/lab/painted`, which shows only "mini_networks".

## Not part of the library

Dropped designs, kept only as reference. Do not lift them or adopt conventions in them:
papercraft map (`/lab/paper`), paper-and-pixels hybrid (`/lab/hybrid`), the code-drawn pixel
map (`/lab/pixel`), the manila city map (`/?edition=paper`), atlas plates (`/?edition=atlas`),
the Network Atlas (`/atlas`), and the `/lab/stub` reference.
