# Anatomy v2 — style bible

> Per-group design dossiers (expert / creative / designer / critic sections, one file per group) live in `playground/.lab-shots/anatomy/dossier/<group>.md` (gitignored; all 44 models now have a diagram).

How the 26 pixel "How it works" diagrams are drawn, extracted from the code in
`diagrams/*.tsx` as it stands (2026-10-03). Coordinates below are real ones.
Field correctness (does the drawing match `models/<name>/model.py`?) is the
field expert's job; this file is the design contract.

## 1. The grid

- Art pixels. Every full view is `{ w: 560, h: 316 }` (all 26 declare exactly
  this); every card is 190 wide × 100–124 tall (classifier/vae/unet 100, gan/
  recur/lm/rl 104, vision/gnn 110, diffusion 112, twins 116, clip 118,
  transformer 124). Rendered ×2 (1120 / 380 CSS px) with
  `shapeRendering="crispEdges"` + `imageRendering: pixelated`.
- Integers only. `Math.round` anything computed (`xT = Math.round(tx(tt))`,
  `px = (v) => Math.round(PLANE.x + PLANE.s / 2 + v * R)`). Fractional rects
  (`GrokCard` 0.75×0.6 cells, `DSCard` pitch 5.5) and `+0.5` stroked lines
  (`gnn.tsx` edges, `strokeWidth 0.5`) anti-alias and break the grammar.
- Margins: input at `x = 16`; right-anchored text at `w − 14/16`; footer legend
  at `y = h − 14`; headers at `y = 12…18`; family inset panel at `x = 10`,
  `w = 540`.
- Text rows are 10 px apart (5×7 face + 3). Subscript/mini face (`_{64}`) is
  3×5 and sits 4 px lower. `s = 2` exists for exactly one headline number per
  drawing (`T 380` in diffusion).

## 2. Primitive grammar (prims.tsx)

| Primitive | Means | How it is used |
|---|---|---|
| `Wire` | a tensor moving | `step=2` (default, dotted) in `T.wire` = data/routing; `step=1` in `T.accentLo` = the spine between network blocks (`<Wire pts={[[58,CY],[68,CY]]} fill={T.accentLo} step={1}/>`); `T.wireHot` = the live state / selected path / the thing this model introduces; `T.loss` `step=3` = gradient flowing back (gan: `[[498,221],[498,290],[110,290],[110,CY+72]]`). Stop 2–3 px short of what you enter (`EH.x − 2`, `X.filt − 2`). `phase` marches the dots (§8). |
| `PText` | a label | `y` is the TOP of the glyph. `T.text` for names of things, `T.textDim` for everything explanatory, `T.wireHot` for the selected/introduced word, `T.loss` only for loss names/values and honesty warnings. Channel counts are mini subscripts under the block: `` `_{${b.ch}}` ``. |
| `Thumb` | an image/map/kernel | 28×28 at `px=2` → 56 px (`TH = 56`) in full views, `px=1` → 28 px in cards; kernels `n=3 px=4`; attention `n=7 px=12 heat`. Values −1..1 → `theme.ramp`; 0..1 → `heat`. The frame is drawn 1 px outside; the paper shadow is +2,+2. |
| `Frame` | an outline | selection in `T.wireHot` at `x−2, y−2, TH+4` (diffusion chain, `x_t`); panels in `T.frame`; a wrong pick in `T.loss` (clip rows, mobilenet negative weights). One hot Frame per drawing. |
| `Bars` | a layer of channels | `bw=3 gap=2` full, `bw=1 gap=1` card. Height = resolution × 3 (`28→84, 14→42, 7→21`, diffusion `LEVEL`), card height = resolution. The 1-channel output is a 1-px sliver (`<rect width={1} height={84} fill={T.accentHi}/>`). `dim` = context; `detail` = lit feature pixels. The footer says the scale: `1 bar = 16 channels` (diffusion, vae) or `32` (transformer, classifier). |
| `Diamond` | the objective | `r=6`, `r=5` where tight. Under it: the loss NAME then the VALUE, both `T.loss`, `anchor="middle"` (`MSE` / `.09`, `CE` / `0.12`, `InfoNCE` / `1.61`). |
| `Node` | an op on two wires | `−`, `+`, `z`; `hot` when the op is what is introduced (resnet/convnext `+`). |

Values < 1 drop the leading zero (`.toFixed(2).replace(/^0/, "")`); counts and
probabilities >1 keep it. Bars for scores: track `T.panel` 3–5 px tall, fill
`T.accent`, the argmax `T.accentHi` and its label `T.wireHot`.

## 3. Layout conventions

Data flows left → right. Input tensor at `x = 16`, vertically centred on the
spine (`CY`), network as Bars whose heights are the resolution, output Thumb,
then the Diamond at the right edge (`520…528`): classifier `(520, 220)`,
diffusion `(528, 206)`, vae `(524, CY+48)`, clip `(526, M.y+90)`, gan two
diamonds at `x = 498`. Where the flow lands elsewhere the Diamond follows it
(transformer: under the guess column at `BOT + 14`; recur: after the last
step) — but never float it.

```
 full 560×316                                      family 560×316
 ┌──────────────────────────────────────────┐      ┌──────────────────────────────┐
 │16 headers (textDim) ............ 12..18  │      │ SPINE  in → maps → logits ◇  │ y ≤ 110
 │ ▣ input ─▮▮─▮▮▮▮─▮▮▮▮▮▮▮▮─▮▮─▮ ▣ out ──◇ │      │ arch line (textDim)   y≈116  │
 │   x=16     bars h = 84/42/21        loss │      ├──────────────────────────────┤ panel x10 y134
 │   _{32}  _{64}   _{128}   coeffs  name   │      │ "inside block 2: …" (wireHot)│ w540 h172
 │ ...................................      │      │  the ONE introduced block,   │
 │ footer legend (textDim)        y = h−14  │      │  real maps, hot = new part   │
 └──────────────────────────────────────────┘      └──────────────────────────────┘
```

Family insets: vision panel `rect 10,134 540×172`, lm `10,112 540×194`, unet
`10,158 540×148`, gnn `10,212 540×94`; inset title at `(20, panel.y + 8)` in
`T.wireHot`; inset origin `x = 24`.

Where the words live: `DiagramDef.title` is the page heading, `truth` is the
figcaption (what is computed vs illustrative — one or two sentences), `badge`
sits under the card. Inside the SVG only a footer legend (`"1 bar = 32
channels   4 blocks, 4 heads…"`, `"map: dark = 0 after ReLU…"`) and short
honesty notes. Prose paragraphs belong in `truth`, not in eight `PText` rows.

## 3b. Alignment (owner, 2026-10-04: "things should be a bit more aligned")

The drawing reads as a printed plate, not a scatter. Before shipping, every
mark must sit on one of a few shared lines:

- **Rows are shared.** Every label of the same kind in a view sits on ONE
  baseline: all channel subscripts (`_{32}`, `_{128}`, `attn`) on one `LABEL_Y`
  row, all thumb captions on one row under the thumbs, all column headers on
  one header row. Never stagger a label to dodge a neighbour — move the
  neighbour or shorten the text.
- **Blocks share edges per level.** Bars at the same resolution share top AND
  bottom; a U-Net's levels step by a constant `dy`, and encoder/decoder bars
  of one level are mirror images on the same rows.
- **Thumbs share a row.** Input and output thumbs (and their frames) have the
  same `y`, the same size and the same caption row; a hot Frame is drawn at
  exactly `x−2, y−2, TH+4` on every thumb that gets one.
- **Captions start at their object's left edge** (or centre on it for a
  column); never at an arbitrary x.
- **Wires are orthogonal and land on centres.** Bus lines run on whole rows;
  a branch drops vertically onto the centre of the block it feeds; skips are
  rectangles, not slopes, unless the slope IS the data (a U-Net's descent).
- **Spacing is a rhythm.** Gaps between consecutive blocks are equal unless a
  gap means something (a resolution change); a size step is a constant.
- Use named constants (`ROW_LABEL`, `ROW_THUMB`, `LEVEL_Y[l]`) instead of
  per-mark literals, so alignment is structural.

## 4. Card vs full

The card is the one memorable shape; the full view explains it.

```
 card 190×~104                                    diffusion card: the chain
 ┌──────────────────────────────┐                ┌───────────────────────────┐
 │ ▣ in ▸ [ONE KEY VIEW]  ▮▮▮▮  │ ≤ 3 text rows   │ ▣→▣→▣→▣→▣  _{0}…_{1000}   │
 │        heat / plane / maze   │ px=1 thumbs     │ ▣x_t ─▮▮▮▮▮▮─ ▣Ɛ_θ ─◇ .09 │
 │ caption (textDim)   y≈90–96  │ one hot thing   │ T 380                 vs ε │
 └──────────────────────────────┘                └───────────────────────────┘
```

- Card = the inset's key view: transformer one head's triangle + guesses, clip
  the 6×6 matrix, vae the plane, gan real/fake + D bars, vision `S.Mini`
  (the introduced block) + logits, rl the maze + path.
- `px=1` thumbs, `bw=1 gap=1` bars, heat cells ≥ 3 px, ≤ 3 text rows, one
  caption at `y ≈ 90–96`, no footer legend, no loss name unless the value is
  the point. The card never duplicates the badge ("real champion: says 7"
  under a badge reading "real champion maps" is a duplicate).
- Cards receive no `still` and must never animate.

## 5. Children reuse the parent; the loud colour marks what is introduced

The taxonomy (`core/taxonomy.py`, `introduces`/`builds_on`) decides what is
loud. The loud colour is **`T.wireHot`** (royal blue in pixel, ink in paper) —
not gold: `ramp[6]` is a DATA colour (the goal cell, community 3).

- Vision family: one `SPECS` spine (test 7 → one real map per stage → 10
  logits → CE diamond, `SY = 26`) for resnet/mobilenet/convnext/vit; the inset
  opens the one introduced block and only its new part is hot — resnet `skip,
  1×1 s2` wire + `+` Node `hot`; mobilenet `one filter per channel` / `mixes
  channels`; convnext `1×1 up ×4, GELU, 1×1 down` + skip; vit `CLS attention`.
- Skips: hot in unet (`skip: copy + concat`, `T.wireHot`) because that is what
  it introduces; dim `T.wire` in diffusion (`skip = concat`, `textDim`) because
  there the U-Net is inherited and the noise chain is the point. Same shape,
  different emphasis — that is the rule.
- LM family: `CHIPS[name].hot` lights only the introduced layer type (kimi:
  gated full + global; deepseek: HCA); the inherited transformer chips stay
  `T.accentLo`.
- Inherited parts keep the parent's exact shapes: `Bars bw=3 gap=2`, 56-px
  thumbs, `textDim` headers, the Diamond + name + value.

## 6. Real vs illustrative

Three tiers, each visible in three places (badge, `truth`, the drawing):

| Tier | Badge wording | On the drawing |
|---|---|---|
| champion output | `real champion maps / attention / path` | nothing extra — numbers are the proof |
| exact maths, no checkpoint | `real graph, exact averaging`, `structure; values exact` | `(no local gnn checkpoint: weights not shown)` in `T.textDim` |
| illustrative pick / stand-in | `structure; routes illustrative`, `latent is a PCA stand-in` | a `T.textDim` note beside the invented thing (`stand-in: PCA of these 10 digits`) |

Caveats that change how to read the numbers are `T.loss` text (alphazero `no
local alphazero checkpoint…`, dino `targets are nearly flat`). Illustrative
data is never drawn in `T.wireHot` — moe's seeded routes in `wireHot` break
this; `T.accent` + the note is the honest reading.

## 7. Themes and legibility

- Paint only with `Theme` tokens. A theme is a palette swap plus `shadow`:
  paper puts a hard +2,+2 shadow under Thumbs and +1,+1 under Bars; pixel has
  none. Even the Diamond's 1-px core is a token (`theme.spark`). The
  `"#ffffff"` uses (transformer/recur ok-glyphs, gnn labelled nodes, deepseek
  window text) are drift — on paper they are white boxes on cream.
- Data uses `ramp` (−1..1, plum→rose→peach→cream in pixel) or `heat` (0..1); the network
  uses the `accent` trio; wiring the `wire` pair; `loss`/`lossHi` the
  objective. Never draw data in accent blue, never draw a block in the ramp.
  Accepted exception: gnn's four communities borrow `accentHi, loss, ramp[6],
  ramp[3]` as a categorical set — there is no categorical token.
- **Legibility floor** (`legible.ts`, `LEGIBLE.minLabelPx = 10`): never show
  a drawing whose 7-px caps land under 10 CSS px. ×1 (7 px) fails; ×1.5
  (10.5 px, 3 device px on a retina screen) passes. A host with no room for
  the full drawing at a legible crisp zoom shows the card at ×2 instead, the
  full drawing one tap away (`<MechanismDiagram minLabelPx>` does this).
- At card scale (×2) the 5×7 face is 10 px, mini is 6 px: mini only for
  indices (`_{k}`), never for words. A 28×28 digit at `px=1` is the floor; a
  14×14 map at `px=1` reads as texture only. Heat cells ≥ 3 art px.
- Nothing overlaps: Thumbs keep their 1-px frame gap, wires stop 2–3 px short,
  score bars have their own `panel` track.

## 8. Animation (tick.ts)

Nothing animates by default; `still` must freeze every drawing. When motion
earns its place:

```tsx
const frame = useTick(3, 3, still);          // 3 fps, frames 0 → 1 → 2 → 0
<Wire pts={spine} fill={T.wireHot} step={3} phase={frame} />   // dots march a→b
<Thumb data={chain[frame]} … />                                 // x_t steps
```

- `useTick(fps, frames, still)` returns the frame, driven by rAF, frozen at 0
  while `still`, when `prefers-reduced-motion` matches, and paused while the
  tab is hidden. `fps` is clamped to 6 (`MAX_FPS`): a flip-book, never a glide.
- Loops are 2–3 frames (4 at most). Frame 0 is the canonical, complete drawing
  — it is what screenshots and reduced-motion viewers get.
- Motion must show data moving: dots advancing along the wire the tensor
  takes, the recurrent state handed to the next cell, a chain frame stepping,
  the routed expert changing. Not: pulsing diamonds, blinking titles, colour
  cycling, anything on labels.
- One moving thing per drawing; it rides the hot wire. Cards never tick.

## 9. Anti-patterns seen in the weaker drawings

1. Text walls: moe's 7-row column at `x+370`, text_diffusion's 8 rows at
   `x+340`, alphazero's four 12-px footer rows — the figcaption's job.
2. Fractional geometry (GrokCard, DSCard, gnn edges) and the no-op
   `transform="translate(0 0)"` in `LMCard`.
3. Hardcoded `#ffffff` outside the Diamond core.
4. A diagram with no Diamond: `lm.tsx` ends with `void Diamond;` — the balance
   loss is text only. Every model trains against something; draw where.
5. Illustrative data in the loud colour (moe routes).
6. Card captions that restate the badge; card chips that are only coloured
   rects (`LMCard` row) carrying no information beyond a count.
7. Inconsistent caveat weight: gan's "champion v1: older MLP G and D" in
   `textDim` while alphazero's equivalent is `loss` — same tier, same colour.
8. Rows 9 px apart or mini-face words at card size.

## Critic checklist

Score a new diagram yes/no on each (design only; correctness is the field
expert's list):

1. Full view is 560×316, card 190×100–124; every coordinate is an integer.
2. Reads left → right: input at `x = 16`, output, then a Diamond with loss
   name and value where the flow lands (right edge by default).
3. Paints only with `Theme` tokens — no literal colour but the Diamond core;
   checked in BOTH pixel and paper (shadows clear, nothing white-on-cream).
4. Data in `ramp`/`heat`, network in `accent`, wiring in `wire`, objective in
   `loss` — no tensor drawn in accent blue.
5. Inherited parts use the parent's exact shapes (bars `bw=3 gap=2`, 56-px
   thumbs, textDim headers); only what the taxonomy says it `introduces` is in
   `T.wireHot`, and there is exactly one hot Frame.
6. Nothing illustrative is drawn in `T.wireHot`; every stand-in has a
   `textDim` note beside it and the badge/`truth` agree with the drawing.
7. One footer legend row explains every encoding used (bar scale, brightness,
   what a bar length means).
8. No run of more than 4 consecutive `PText` rows of prose; rows 10 px apart;
   mini face only for indices.
9. Nothing overlaps; wires stop 2–3 px short; thumbs keep their frame gap.
10. The card is one memorable shape with ≤ 3 text rows and does not restate
    the badge; `px=1` thumbs, `bw=1` bars, heat cells ≥ 3 px.
11. Numbers follow the house format (`toFixed(2)`, leading zero dropped under
    1, `_{n}` channel subscripts, argmax in `accentHi` + `wireHot` label).
12. `still=1` renders the complete canonical frame; any motion uses `useTick`
    at ≤ 6 fps with 2–3 frames and shows data moving on the hot wire; the
    card does not animate.
13. Honesty caveats that change the reading are `T.loss` text; provenance
    notes are `textDim` — and the same tier gets the same weight everywhere.
14. Aligned (§3b): labels of a kind share one baseline, thumbs share a row,
    same-level blocks share top and bottom, wires are orthogonal and land on
    centres, block gaps are a constant rhythm.
