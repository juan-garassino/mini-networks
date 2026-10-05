# Pixel diagram kit: design notes

A small library for drawing how a system works as a pixel plate: data enters
on the left, passes through the system's own blocks, and lands on a diamond
that names what it is judged by. Here it draws 44 neural networks (the "How it
works" diagrams, specimen page `/lab/anatomy`), but nothing in the kit is
about ML. A build pipeline, a payment flow or a compiler draws with the same
eight primitives.

**The signature element** is the 5×7 pixel face (`pixel-font.ts`), drawn as
SVG path data on an integer grid. The diagrams label with it, and the page
chrome is set in it too (`PixelLabel`: model names, shelf heads, switches),
so page and plate read as one printed object. Everything else stays quiet.

## Files

| File | Role |
|---|---|
| `tokens.ts` | the one import for values: `ART`, `PIXEL`, `TYPE`, `SPACE`, `BORDER`, `MOTION`, re-exports `THEMES` |
| `themes.ts` | colour: a `Theme` is 14 role tokens + an 8-step data `ramp` + an 8-step `heat`; `pixel` (plum dusk) and `paper` (cut card with hard shadows) |
| `encoding.ts` | every mark → primitive → token → meaning |
| `prims.tsx` | `Wire`, `PText`, `Thumb`, `Frame`, `Bars`, `Diamond`, `Node`, plus `PixelLabel` / `displayName` for chrome |
| `pixel-font.ts` | the face: `textPath`, `textWidth`, `_{sub}` mini face |
| `tick.ts` | `useTick(fps, frames, still)`: the only motion primitive |
| `registry.tsx` | one `DiagramDef` per name (+ `*_DEFS` from `diagrams/<family>.tsx`) |
| `mechanism.tsx` | `<MechanismDiagram>` (variant full or card): renders a registry entry |
| `specimen/` | the page chrome: `specimen.tsx` (layout), `plate.tsx`, `card-sheet.tsx`, `controls.tsx`, `groups.ts`, `view.ts` (URL), `styles.ts` |
| `STYLE.md` | the drawing contract and the 14-point critic checklist |
| `diagrams/`, `data/` | this project's drawings and their exported numbers |

## Tokens

| Token | Holds |
|---|---|
| `ART` | full view 560×316 art px, card 190 wide, ×2 canonical scale, 10-px text row, 7-px glyph |
| `PIXEL` | pixel-face multiples for chrome: wordmark 3, plate name 4, heads 2, card names 2 |
| `TYPE` | prose face (`--font-anatomy-prose`, Atkinson Hyperlegible Next); lede 19/1.4, body 15/1.6, nav 14, hint 13, small 12; measure 68ch |
| `SPACE` | 16-px gutter; 4 / 8 / 16 / 24 / 40 steps; index column 240; card column 380 |
| `BORDER` | hair 1, focus 2, radius 0 (all pixel work is square) |
| `MOTION` | max 6 fps; still t = 380 |
| `Theme` | ground, panel, frame, wire, wireHot, accent/Hi/Lo, text, textDim, loss/Hi, shadow, spark, ramp[8], heat[8] |

## Type scale

Two faces, clearly apart. The pixel face carries every name and heading at
integer scales only (×2 = 14 px cap, ×3, ×4), lowercase. Prose (what a model
does, what is real, hints) is Atkinson Hyperlegible Next, chosen for adult
legibility next to pixel type: 19 lede, 15/1.6 body, 13 hints. No all-caps,
no eyebrows. Inside a drawing, only the pixel face (STYLE.md §1).

## Layout grid

Drawings live on an art-pixel viewBox and are shown at an integer scale:
×2 (1120 px) when it fits, else ×1. Below 560 px the drawing keeps ×1 and
scrolls sideways in its own strip; the words never scroll.
Wide (≥ 1432 px): `index 240 | 40 | plate 1120`, the index sticky.
Narrow: masthead + switches, one grouped `<select>`, then the plate.
The plate: name (pixel ×4), lede, drawing, then "what is real" as
`216 | truth (68ch)` on a hairline, then prev / next on a hairline.
Card sheet: shelves with a count, cards in as many 380-px columns as fit,
centred, each under its name.

## Marks

See `encoding.ts` (and STYLE.md §2 for coordinates). In short: wires move
data (dotted) or link blocks (solid); one colour, `wireHot`, marks what is
live or new; data is painted only in `ramp`/`heat`, blocks only in `accent`,
the objective only in `loss`. Chrome follows the same rule: the current
index entry and pressed switch are `wireHot`, everything else `text`/`textDim`.

## Motion

Nothing moves unless it shows data moving. `useTick` returns frame 0 under
`still`, under `prefers-reduced-motion`, and while the tab is hidden; frame 0
is the complete drawing. 2–3 frame loops, ≤ 6 fps, one moving thing per
drawing on the hot wire. Cards never tick. The page chrome has no motion.

## Lifting it into another project

1. Copy `pixel-font.ts`, `themes.ts`, `tokens.ts`, `encoding.ts`, `prims.tsx`,
   `tick.ts`, `mechanism.tsx`, `registry.tsx`, `index.tsx`, `specimen/`.
   React 19 only; no CSS framework. Also `lib/lab-contract.ts` (`useStill`), `lib/copy.ts`
   (`displayName`) and `lib/encoding.ts`.
2. Empty `registry.tsx` and add your entries. The data shape:
   ```ts
   { view: { w: 560, h: 316 }, title: "build — compile, test, ship",
     truth: "what is real vs illustrative, one or two sentences",
     badge: "2–4 words", scrub?: boolean, interactive?: boolean, keysHint?: string,
     render: ({ theme, t, onT, still, keys }) => <svg children/>,
     card: { view: { w: 190, h: 110 }, render: ({ theme, t }) => <svg children/> } }
   ```
   `title` is `name — lede`; the specimen shows the lede under the name.
3. Draw with prims only, in art pixels, integers, left to right, ending on a
   `Diamond` (your objective: latency, cost, error). Check it against STYLE.md's
   checklist and `encoding.ts`.
4. Replace `specimen/groups.ts` shelves with your own (unknown names fall into
   "more"), and the prose font in `app/lab/anatomy/layout.tsx`.
5. Delete the generic fallback in `mechanism.tsx` (`Anatomy` + `schematicFor`
   are this repo's) and `diagrams/`, `data/`.
6. New palette = one more `Theme` entry; keep every role, check both themes.

URL contract: `?model=&theme=pixel|paper&t=&still=1&from=&variant=card`;
the page sets `data-lab-ready="1"` once painted (`useLabReady`, `lib/lab-contract.ts`).
