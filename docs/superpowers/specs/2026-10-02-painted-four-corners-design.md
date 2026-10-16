# Painted skin: four corners (2026-10-02)

Owner verdict on /lab/painted r13: "the pixels are good but the UI is not".
One UI for BOTH owner maps (pixel 768×512/128 colours, paper 1536×1024):
the map is the interface; everything else is cartographic furniture drawn in
the map's own material. Pixelify Sans everywhere on the pixel map, set
intentionally (integer sizes on the art-pixel grid, 32/24/20/17/14, body 400,
measure ≤ 56ch, short copy); IM Fell SC + Alegreya on paper.

## 1. Stage
- No page background: the map owns every pixel of the viewport.
- Pixel: largest crisp scale that fits, then the parchment sea extends to the
  viewport edges, dressed with sparse furniture stamped from the map's own
  sea pixels (connected components of the sea mask: clouds, ships, serpent,
  islets), seeded placement, each stamp ≤ 2×. The image edge disappears.
- Paper: cover-crop + soft paper vignette at the edges.
- Lands list, minimap panel, settings panel: gone. render/labels → `?dev=1` tray.

## 2. Four corners (one component tree, `material.ts` tokens per edition)
- TL cartouche: title · one live sentence ("44 models in six lands, 32 proven")
  · search as its bottom row. Land focused → that land's sentence + "Whole map".
- TR sheet tabs: Pixel / Paper hanging from the top edge; active tab lowered.
- BL compass + scale bar (signature): compass rose IS navigation (centre =
  whole map, points pan, zoom rail beside). Scale bar: one tick per model in
  land order, filled by evidence (gold champion / green trained / dashed
  provisional / grey untrained); hover names, click focuses. Second thin row
  of ticks = pipelines.
- BR one plate, two faces: legend at overview, minimap when zoomed.

## 3. Drawer (replaces the sidebar)
Only when a model is selected: 440 px from the right; camera refits to the
remaining width; other lands fade (dithered). Order: evidence glyph + name ·
family line · evidence sentence · How it works (card diagram, full width,
tall; "Open full diagram" takes the stage, "Back to the map" returns) · one
sentence · introduces · Built on / Leads to signposts · pipelines · metric vs
bar. Esc / back closes. Mobile: the peek/half/full bottom sheet.

## 4. Motion
One load moment (sea extends, corners stamp in, 2 frames, no easing);
crisp-snapped camera flights; `?still=1` disables all.

## 5. Encoding
`encoding.ts` declares every mark → data (banner count, marker glyph, lit
road, scale-bar tick, tab, cartouche sentence, minimap box).

## 6. Files
`material.ts` (replaces theme.ts), `stage.tsx` + `sea-furniture.ts`,
`corners/{cartouche,sheet-tabs,compass,scale-bar,corner-plate}.tsx`,
`drawer.tsx` (absorbs the bottom sheet), `encoding.ts`; `sidebar.tsx` deleted.
Tests: node tests for stamp extraction + tick order; `make lab-shoot
SKIN=painted`; typecheck. Docs: project CLAUDE.md playground paragraph.
