// Public surface of the paper skin (the hybrid skin may import these read-only).
export { PaperSkin } from "./paper-skin";
export { PaperCard } from "./card";
export { PaperCritter } from "./critter";
export { PaperHud, PaperKey } from "./hud";
export {
  BridgeLayer, Emblem, Flag, LabelLayer, LandLayer, PaperDefs, RoadLayer, SeaLayer, SignLayer, Spot, SPOT_R,
} from "./map-layers";
export { DecorLayer, PieceArt, PropArt, SetPiece, pieceAnchor, PIECE_TOP } from "./set-pieces";
export { fibreTile, regionOutlines, octagon, extruded } from "./geometry";
export { ENCODING, EGGS, FAMILY_INK, FAMILY_COPY, PAPER, inkOf, familyName } from "./encoding";
export type { Encoding, FamilyInk } from "./encoding";
// round 3 — the diorama: tilted ground + projection, stand-up billboards, screen tags
export { diorama, TILT, FLAT } from "./diorama";
export type { Diorama, Tilt } from "./diorama";
export { Billboards, worldBills } from "./billboards";
export type { Bill, Place } from "./billboards";
export { PaperTags, standingBox } from "./tags";
export { CityLayer, FerryVoyage, HarbourLayer, HarbourPiers, MountainLayer, SecretIslands, Train, Boat } from "./flavour";
