// Pixel skin ART system (round 3 — contemporary pixel art). See README.md.
export {
  PALETTE, PALETTE_SIZE, RAMPS, RGB, CLEAR, INK, PAPER, SHADOW, BIOMES, FALLBACK_BIOME,
  LEGACY_HEX, LEGACY_MAP, biomeOf, darker, lighter, shade, step, type Biome, type RampName,
} from "./palette";
export { artBlank, artBlit, artFlipX, artToCanvas, remapWhere, type ArtImage } from "./raster";
export { bayer4, ditherStep, fbm3, ridged } from "./noise";
export {
  ART_PER_TILE, BANDS, CLOUD_SHADOW_OFFSET, LIGHT, bakeCloudShadow, chamfer, cloudSpots, renderTerrain,
  renderTerrainPreview, shadeLand, shadeWater, slopeLight, stampCanopy, toArt,
  type LandSample, type TerrainArt, type TerrainOptions, type WaterSample,
} from "./terrain-shade";
export {
  CASTLES, CASTLE_NOTES, CASTLE_W, CASTLE_H, MARKER_W, MARKER_H, Painter, capital, castleSprite, catalogue,
  cloudSprites, critterSheet, marker, markerSprite, props, spriteCanvas, stampInto, withEmblem,
  type CritterSheet, type Sprite,
} from "./sprites";
export { emblemMasks, type EmblemMask } from "./emblem";
