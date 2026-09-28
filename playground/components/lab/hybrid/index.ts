// Public surface of the hybrid skin (papercraft diorama + pixel chrome), round 2.
// Other skins may import these read-only.
export { PixelWindow, PixelSprite, Typewriter, handCssUrl } from "./chrome.tsx";
export { SlimTitle, RegionMenu, type MenuRow } from "./menu.tsx";
export { LessonCard, type PartyMember } from "./card.tsx";
export { Diorama, Critter, SPOT_R, spotScale, boxOfPoints, type DioramaProps } from "./diorama.tsx";
export { HybridDefs, PaperBoat, PaperRoads, PaperMountains, PaperCities, PaperDressing, StickerSpot, GROUND, groundOf } from "./art.tsx";
export { PixelEmblem } from "./emblem.tsx";
export { regionOutlines, chaikin, islandD, octagonD, sampleEvery, starPts, bendRoute } from "./geometry.ts";
export { frameInto, landBox, nodeBox, unionBox, pointsBox, type Insets } from "./frame.ts";
export { frameSvg, frameUrl, spriteRects, HAND, STAR, CHECK, type FrameKind, type Sprite } from "./pixel-art.ts";
export { SW, UI, FAMILY, PAPER, familyInk, chromeSwatch, familyLabel, type FamilyInk } from "./palette.ts";
export { PixelNum, NumText, spell } from "./pixel-num.tsx";
export { ENCODING, EGGS } from "./encoding.ts";
