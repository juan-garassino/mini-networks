// Skin D · Kawaii DFD — the reusable surface (see DESIGN.md). The board is the page; the
// sheet + its parts render any DfdLayout from lib/world/dfd.ts; tokens are the one style source.
export { FlowBoard } from "./board";
export { Sheet, type SheetState } from "./sheet";
export { Box } from "./box";
export { Connectors, Edges, Labels } from "./edges";
export { Critter, EvidenceMark } from "./critter";
export { ENCODING as FLOW_ENCODING } from "./encoding";
export * as FLOW_TOKENS from "./tokens";
