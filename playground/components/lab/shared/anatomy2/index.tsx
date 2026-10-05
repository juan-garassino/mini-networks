"use client";

// Anatomy v2 — mechanism-specific, truthful architecture diagrams.
//
//   <MechanismDiagram name="diffusion" theme="pixel" variant="full" t={380} still width={1120} />
//   <MechanismDiagram name="diffusion" theme="paper" variant="card" still />   // ~380px, links to the full view
//   hasDiagram(name)            → true when a mechanism diagram exists (else the
//                                 old generic Anatomy wireframe is the fallback)
//   anatomyHref(name, theme, from?) → "/lab/anatomy/?model=…&theme=…&from=…"
//
// Cards are separate compositions (190 art px wide, drawn ×2 = 380px) that keep
// one key view legible; the full diagrams are 560 art px wide (×2 = 1120px).
// Every diagram draws in an art-pixel viewBox (see each DIAGRAM entry's view)
// with crisp edges; pass `width` as an integer multiple of view.w for perfect
// pixels (1120 = ×2 for the 560-wide diagrams). Interaction: diffusion has a t
// scrubber (click a chain frame, drag the slider, or ←/→ with focus, shift =
// ×10); still=1 pins t=380 and renders no controls or motion.
//
// Files: registry.tsx (the 44 entries) · mechanism.tsx (renderers) · prims.tsx
// (pixel primitives) · pixel-font.ts · themes.ts + tokens.ts · tick.ts
// (motion) · specimen/ (the /lab/anatomy page chrome). DESIGN.md = the kit.
export { anatomyHref, diagramFor, hasDiagram, DIAGRAM_NAMES, type DiagramDef } from "./registry";
export { MechanismDiagram, type MechanismDiagramProps } from "./mechanism";
export type { ThemeName } from "./themes";
export { LEGIBLE, fallbackFor, isLegible, labelPx, legibleZooms } from "./legible";
