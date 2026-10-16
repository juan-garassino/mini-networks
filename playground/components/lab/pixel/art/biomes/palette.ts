// Biome palette extension (round 4 — Wild West · Cyberpunk · Reef).
//
// The frontier (Decision) is painted entirely from the EXISTING ramps (rock,
// sand, savanna, wood, roof, gold, meadow, olive). The neon city (Sequence) and
// the reef (Structure) need colours the day map never had: a night asphalt, two
// neon ramps and a muted bathymetric teal. They are hue-shifted like the base
// ramps (shadows toward violet/indigo, lights toward warm/white) and are
// deliberately NOT the base ocean/shallow indices, so `isWaterIdx()` /
// `parchmentize()` never mistake the city or the reef for sea.
//
// Registration appends these hexes to the shared PALETTE/RGB tables once, at
// import (idempotent: an entry already present — e.g. once the builder folds
// BIOME_HEX into art/palette.ts — is simply reused). SHADOW gets a darker
// neighbour for every new index so cast shadows keep working.
import { PALETTE, RAMPS, RGB, SHADOW, darker as baseDarker, lighter as baseLighter } from "../palette";

export const BIOME_HEX = {
  // ——— the owner's FINAL pixel reference (2026-09-29): calm, parchment-toned; every ramp
  // bottoms out in a maroon-brown / blackened tone so selective outlines read as one ink family
  ink: ["#2a1012", "#4e2a24", "#6e3d36"],
  paperR: ["#c6bb90", "#dccb9e", "#ecdbae", "#f5e8c2"],
  light: ["#e2eaf7", "#f7f5ea"],
  olive: ["#253129", "#465e3c", "#6a8f4f", "#8ea350", "#99b054", "#aeb464", "#dacf93"],
  forestR: ["#191615", "#253129", "#3f4a33", "#485d45", "#536235", "#6a8f4f", "#8ea350"],
  desert: ["#66382e", "#93483d", "#bd784a", "#d88a52", "#f4b86f", "#fac27d", "#f5e0af"],
  cliffR: ["#241d18", "#4e2a24", "#6e3d36", "#85483c", "#a5623c", "#bd784a"],
  woodR: ["#2c1312", "#541e1a", "#5b2f23", "#934c32", "#b36240", "#dcb882"],
  stoneR: ["#2f2a28", "#564142", "#6d6c57", "#a39a82", "#dcc190", "#f0eddf"],
  snowR: ["#41536e", "#85a6bf", "#a9b8c2", "#e2eaf7", "#eee9da", "#f7f7eb"],
  roofR: ["#3d1414", "#6e2022", "#a74538", "#c94e43", "#e07a5a"],
  slate: ["#232a3a", "#343c49", "#386483", "#5d8d8f", "#7eb6bf"],
  goldR: ["#5e3b1c", "#a4602b", "#dd8c4e", "#f2c36a", "#fbe3a0"],
  water: ["#33575e", "#407a71", "#489693", "#57adac", "#83bd9b", "#d4e2bd"],
  basalt: ["#290f14", "#472024", "#592d2f", "#6e3432", "#875243"],
  iron: ["#1f1719", "#382a2e", "#4f4247", "#6b5e60", "#928473"],
  lavaR: ["#91392d", "#d13a22", "#e85731", "#f29a4e", "#fbd98a"],
  lav: ["#3d2933", "#5d3547", "#8c5a86", "#b07aa6", "#d6a8c8", "#eed6e2"],
  // ——— neon (cyber island) — the one deliberately luminous set, teal + pink like the reference
  night: ["#1d1622", "#2c1c25", "#3d2933", "#4a5059", "#5c757e"],
  neonM: ["#5d2046", "#9c3470", "#d0569a", "#f0a8c8"],
  neonC: ["#22505a", "#3a8e8a", "#6ab1ab", "#c8ece0"],
  // ——— underwater (bathymetry) + seabed
  reef: ["#242c32", "#33575e", "#407a71", "#489693", "#57adac", "#6abab4", "#83bd9b"],
  seabed: ["#9a836f", "#c9ba88", "#dbcd95"],
} as const;

export type BiomeRampName = keyof typeof BIOME_HEX;

const added = new Set<number>();
function register(hex: string): number {
  let i = PALETTE.indexOf(hex);
  if (i < 0) {
    added.add(PALETTE.length);
    i = PALETTE.length;
    if (i >= 255) throw new Error("biome palette overflow (255 = CLEAR)");
    PALETTE.push(hex);
    RGB.push([parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]);
  }
  return i;
}

/** Biome ramps as palette indices, dark → light. */
export const BR = Object.fromEntries(
  Object.entries(BIOME_HEX).map(([k, v]) => [k, v.map(register)]),
) as Record<BiomeRampName, number[]>;

// darker/lighter along the biome ramps; base ramps otherwise
const home = new Map<number, { r: number[]; i: number }>();
for (const r of Object.values(BR)) r.forEach((idx, i) => { if (added.has(idx) && !home.has(idx)) home.set(idx, { r, i }); });

export function dk(idx: number, n = 1): number {
  const h = home.get(idx);
  return h ? h.r[Math.max(0, h.i - n)] : baseDarker(idx, n);
}
export function lt(idx: number, n = 1): number {
  const h = home.get(idx);
  return h ? h.r[Math.min(h.r.length - 1, h.i + n)] : baseLighter(idx, n);
}

// cast shadows over the NEW colours only (shared entries keep their base-ramp shadow)
for (const idx of added) SHADOW[idx] = dk(idx);
SHADOW[BR.neonM[2]] = BR.neonM[1]; SHADOW[BR.neonC[2]] = BR.neonC[1];

/**
 * Base-ramp names are REDIRECTED to the reference palette (by relative step), so
 * every biome drawing speaks the desaturated reference colours; biome ramps pass through.
 */
export const REF_OF: Partial<Record<keyof typeof RAMPS, BiomeRampName>> = {
  rock: "cliffR", cliff: "cliffR", sand: "desert", savanna: "desert", wood: "woodR", roof: "roofR", gold: "goldR",
  glow: "goldR", stone: "stoneR", meadow: "forestR", forest: "forestR", olive: "olive", pine: "forestR", sage: "forestR",
  magic: "lav", foam: "light", snow: "snowR", shallow: "water", ocean: "slate", banner: "slate", paper: "paperR",
  ink: "ink", ui: "ink", lava: "lavaR", frost: "snowR", ochreP: "desert", rustP: "cliffR", snowP: "snowR",
};

/** Shorthand: ramp step → palette index (negative = from the light end); base names use REF_OF. */
export function C(ramp: BiomeRampName | keyof typeof RAMPS, i: number): number {
  const own = (BR as Record<string, number[]>)[ramp];
  if (own) {
    const k = i < 0 ? own.length + i : i;
    return own[Math.max(0, Math.min(own.length - 1, k))];
  }
  const base = RAMPS[ramp as keyof typeof RAMPS];
  const to = BR[REF_OF[ramp as keyof typeof RAMPS] as BiomeRampName];
  const k = Math.max(0, Math.min(base.length - 1, i < 0 ? base.length + i : i));
  if (!to) return base[k];
  return to[Math.round((k / Math.max(1, base.length - 1)) * (to.length - 1))];
}

/** The reference ink (outline ring for biome sprites: `inkOutline(img, BIOME_INK)`). */
export const BIOME_INK = BR.ink[0];
