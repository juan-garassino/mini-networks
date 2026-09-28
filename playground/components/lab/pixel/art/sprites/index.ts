// Sprite library catalog. Every entry builds once (memoised) into a Sprite
// {img (palette indices), shadow mask, anchor, slot}. Rasterise with
// artToCanvas(sprite.img, scale) — or use spriteCanvas() which caches.
import type { EvidenceState } from "@/components/lab/shared/card-model";
import { artToCanvas } from "../raster";
import { CASTLES } from "./castles";
import { capital, marker, stampInto, type EmblemMaskLike } from "./markers";
import { critterSheet } from "./critter";
import {
  boat, bridge, cloud, compass, dragon, house, palm, pier, pine, questionStone, rock, ruins, snowPeak, train, treeClump,
} from "./props";
import { Painter, type Sprite } from "./paint";
import { RAMPS } from "../palette";

export type { Sprite } from "./paint";
export { Painter } from "./paint";
export { CASTLES, CASTLE_NOTES, CASTLE_W, CASTLE_H } from "./castles";
export { marker, capital, stampInto, MARKER_W, MARKER_H } from "./markers";
export { critterSheet, type CritterSheet } from "./critter";
export * as props from "./props";

const memo = new Map<string, Sprite>();
const once = (key: string, make: () => Sprite) => {
  let s = memo.get(key);
  if (!s) { s = make(); memo.set(key, s); }
  return s;
};

/** Atom castle for a mechanism atom (falls back to the classifier's Lens Tower). */
export function castleSprite(atom: string, emblem?: EmblemMaskLike): Sprite {
  const base = once(`castle:${atom}`, CASTLES[atom] ?? CASTLES.classifier);
  if (!emblem || !base.slot) return base;
  return once(`castle:${atom}:emblem`, () => withEmblem(base, emblem));
}

/** Derived-model marker for an evidence state, optionally with its emblem. */
export function markerSprite(state: EvidenceState, name?: string, emblem?: EmblemMaskLike): Sprite {
  return once(`marker:${state}:${emblem ? name : ""}`, () => marker(state, emblem));
}

/** Stamp an emblem into a sprite's slot (copy; the base stays clean): pale glyph + indigo drop. */
export function withEmblem(base: Sprite, emblem: EmblemMaskLike): Sprite {
  const p = new Painter(base.img.w, base.img.h);
  p.img.data.set(base.img.data);
  stampInto(p, base.slot!, emblem, RAMPS.foam[1], RAMPS.ocean[0]);
  return { ...base, img: p.img };
}

/** Named catalogue for the specimen sheet (and for the builder's lookup). */
export function catalogue(): { group: string; items: { name: string; note: string; sprite: Sprite }[] }[] {
  const crit = critterSheet();
  return [
    {
      group: "Settlements",
      items: [
        { name: "capital (red)", note: "capital cluster — hall, gold dome, lit windows", sprite: once("capital:0", () => capital(0)) },
        { name: "capital (blue)", note: "capital cluster, blue-roof variant", sprite: once("capital:1", () => capital(1)) },
        ...[0, 1, 2, 3].map((v) => ({ name: `house ${v}`, note: ["red gable cottage", "blue-roof townhouse", "thatched hut", "tower house"][v], sprite: once(`house:${v}`, () => house(v)) })),
        { name: "house (dark)", note: "unlit windows (night / untrained city)", sprite: once("house:0:dark", () => house(0, false)) },
      ],
    },
    {
      group: "Foliage & ground",
      items: [
        { name: "trees · meadow", note: "round canopies, perception", sprite: once("tree:meadow", () => treeClump("meadow")) },
        { name: "trees · savanna", note: "flat acacias, decision", sprite: once("tree:olive", () => treeClump("olive")) },
        { name: "trees · ember", note: "charred, generative", sprite: once("tree:ember", () => treeClump("ember")) },
        { name: "trees · frost", note: "frosted, representation", sprite: once("tree:frost", () => treeClump("frost")) },
        { name: "palm", note: "beaches, sequence dunes", sprite: once("palm", palm) },
        { name: "pine", note: "structure / highlands", sprite: once("pine", () => pine(false)) },
        { name: "pine · snow", note: "icy highlands", sprite: once("pine:snow", () => pine(true)) },
        { name: "rocks", note: "boulder pair", sprite: once("rock:0", () => rock(0)) },
        { name: "outcrop", note: "red rock", sprite: once("rock:1", () => rock(1, "rock")) },
        { name: "snow peak", note: "faceted, lit / shadow faces", sprite: once("peak", () => snowPeak()) },
      ],
    },
    {
      group: "Travel",
      items: [
        { name: "pier", note: "harbour dock", sprite: once("pier", pier) },
        { name: "boat", note: "hull + sail (one per pipeline)", sprite: once("boat", () => boat()) },
        { name: "boat ←", note: "mirrored", sprite: once("boat:flip", () => boat(true)) },
        { name: "engine", note: "live-run train", sprite: once("train:0", () => train(0)) },
        { name: "carriage", note: "train car", sprite: once("train:1", () => train(1)) },
        { name: "bridge —", note: "planks across a river", sprite: once("bridge:h", () => bridge("h")) },
        { name: "bridge |", note: "vertical", sprite: once("bridge:v", () => bridge("v")) },
      ],
    },
    {
      group: "Sky & lore",
      items: [
        ...[0, 1, 2].map((v) => ({ name: `cloud ${v}`, note: "cream tops, lavender underside", sprite: once(`cloud:${v}:1`, () => cloud(v)) })),
        { name: "cloud ×2", note: "cloud at k=2 (map clouds use k=3 and cast the water shadow)", sprite: once("cloud:1:2", () => cloud(1, 2)) },
        { name: "ruins", note: "retired models' islet", sprite: once("ruins", ruins) },
        { name: "? stone", note: "next-era silhouette", sprite: once("qstone", questionStone) },
        { name: "dragon", note: "here be dragons (friendly)", sprite: once("dragon", dragon) },
        { name: "compass", note: "N / W / E / S", sprite: once("compass", compass) },
      ],
    },
    {
      group: "Critter",
      items: [
        ...crit.walk.map((sp, i) => ({ name: `walk ${i}`, note: "4-frame walk", sprite: sp })),
        ...crit.idle.map((sp, i) => ({ name: `idle ${i}`, note: i ? "blink / breathe" : "idle", sprite: sp })),
        { name: "training", note: "squash + glowing Σ antenna", sprite: crit.train },
      ],
    },
  ];
}

const canvases = new WeakMap<Sprite, Map<number, HTMLCanvasElement>>();
/** Cached RGBA canvas of a sprite at integer scale. */
export function spriteCanvas(s: Sprite, scale = 1): HTMLCanvasElement {
  let m = canvases.get(s);
  if (!m) { m = new Map(); canvases.set(s, m); }
  let c = m.get(scale);
  if (!c) { c = artToCanvas(s.img, scale); m.set(scale, c); }
  return c;
}

/** Cloud sprites at size multiplier k (map overview clouds use k = 2; their masks cast the shadows). */
export const cloudSprites = (k = 3) => [0, 1, 2].map((v) => once(`cloud:${v}:${k}`, () => cloud(v, k)));
