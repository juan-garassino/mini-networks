# Paper edition — cut-paper storybook theme for the playground

**Date:** 2026-09-12 · **Status:** approved, implemented on `feat/paper-edition`

## What

A sixth playground edition, `paper`: a Paper Mario-inspired cut-paper storybook
treatment (inspired by Kevin Ngo's Paper Mario IDE tweet). Full-app coverage —
every sheet, the spec-sheet drawer and the title block restyle; the Chart sheet
gets a bespoke view like terminal/metro/atlas.

## Decisions (user-selected)

1. **Depth:** full-app treatment (not a CSS-only reskin).
2. **Mascots:** original critters only — Nintendo IP (Mario/Goomba/etc.) is
   off-limits. Cast: a one-eyed perceptron blob (with speech-bubble quips), a
   walking 3×3 convolution kernel, a gradient-descent snail whose shell is a
   converging loss-curve spiral.
3. **Architecture:** CSS-first. One `[data-edition="paper"]` token block in
   `globals.css` themes all sheets; `<PaperScenery>` (inline-SVG hills/sun/
   clouds/critters) mounts app-wide behind the sheets; only `chart-paper.tsx`
   is a bespoke view. No per-sheet component forks.

## Key elements

- **Tokens:** cream paper / warm brown ink / coral `--redline`; sky-gradient
  body; fonts Luckiest Guy (display) + Patrick Hand (draft) via next/font.
- **Primitives:** `.pp-cutout` (wobbly border + cut-paper shadow), `.pp-tape`,
  `.pp-bubble` (speech bubble with tail); scoped `bp-frame/bp-title/bp-stamp`
  overrides (hand-drawn game-window frame).
- **Targeted improvement:** Observatory pens + offline dot + `STATUS_INK.failed`
  tokenized as `--pen-3/4/5`/`--alert` (`:root` defaults equal the old hexes —
  the five existing editions are pixel-unchanged; paper overrides with a
  crayon palette).
- **Constraints:** zero binary assets (all art is inline SVG in TSX — repo
  no-binaries rule); deterministic render (no `Math.random`, index arithmetic
  only); scenery outside the sheet `AnimatePresence` so the walking critter
  never resets; `pointer-events-none` + `aria-hidden` on scenery.

Implementation plan (files, CSS draft, verification):
`~/.claude/plans/lets-see-it-done-playful-map.md` (session artifact); the
durable record is the diff of PR `feat/paper-edition`.

## Revision 2026-09-13 — storybook → adult "paper city map"

Seen live, v1 read as childish (sky/hills diorama, big critter stickers,
Luckiest Guy logo) and wasted the space in one giant ruled sheet. User
redirect: "just a paper", "more panels not one big one", "a playground for
adults, like a city map". v2 keeps the edition machinery and the token
approach but changes the aesthetic:

- **Aesthetic:** a flat manila survey map. Families are **districts**, models
  are **lots**, compositions are **routes**. Muted survey palette (kraft board
  + graticule, cream panels, vermilion accent), Big Shoulders signage + Patrick
  Hand annotations. Removed Luckiest Guy.
- **Layout:** multi-panel — cartouche + legend + compass header, six district
  panels of lots, a routes panel, a scale-bar/surveyor's-mark margin. Generous
  negative space; no wobble/tape/stickers.
- **Critters:** reduced to one tiny `CritterCameo` (~34px, gentle bob, no
  bubble). `scenery.tsx` deleted.
- **Robustness fix:** `page.tsx` now retries the taxonomy fetch every 3s until
  the API answers (a tab opened before `serve` was up used to stay empty).
- The tokenization/regression guarantees from v1 still hold: all CSS scoped
  under `[data-edition="paper"]`; the other five editions are unchanged.
