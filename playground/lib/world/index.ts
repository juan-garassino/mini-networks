// Public API of the world contract — skins import from "@/lib/world".
export { buildWorld, pathToAtom, ferryRoute, lineage, parkingSpot } from "./world.ts";
export { buildFlow } from "./flow.ts";
export { placeScreenLabels } from "./screen-labels.ts";
export type { ScreenLabelOptions } from "./screen-labels.ts";
export { familyMapFromBlueprint } from "./graph.ts";
export { roundedD, samplePolyline, polylineLength, offsetPolyline, chevronsAlong } from "./path.ts";
export { T } from "./types.ts";
export { WORLD_VERSION } from "./constants.ts";
export {
  ATOM_ANCHORS, BAY, BORDER_KINDS, FLOAT_ISLAND, FRAME_H, FRAME_W, ISLETS, OUTLINE, PAPER, PIXEL, PRESETS, SEABED, SETPIECE_ANCHORS,
  SKELETONS, ZONES, smoothClosed,
} from "./continent.ts";
export type { Preset, PresetName } from "./continent.ts";
export type {
  Anchor, Border, BorderKind, Box, Bridge, Islet, IsletKind, Shape, Zone, ZoneKind, CameraAnchors, Chevron, City, Decor, FamilyMap, FerryRoute, FlowLayout, FlowNode, FlowPipe,
  Harbour, Label, Lineage, PathResult, Pt, Region, Road, RoadKind, ScreenLabel, SecretIsland, Terrain, World, WorldNode, WorldOptions,
} from "./types.ts";
