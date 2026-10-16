// Composed zone vignettes (specimen + reference layouts for the builder): each a
// raised diorama slab on the parchment sea — zone ground, layered cliffs, set
// pieces placed by hand, decor scattered in free ground. Deterministic.
import { fbm3 } from "../noise";
import { artBlank, type ArtImage } from "../raster";
import { BR } from "./palette";
import { biomeGround, paintCliffs, paintUnderside } from "./ground";
import { Layout, blobMask } from "./vignette";
import { boomtown, westLandmark, westMarker, westSprites } from "./west";
import { cityBlocks, neonLandmark, neonMarker, neonSprites } from "./cyber";
import { coralCluster, reefLandmark, reefMarker, reefSprites } from "./reef";
import { townLandmark, townSprites } from "./town";
import { sandsLandmark, sandsSprites } from "./sands";
import { forgeLandmark, forgeSprites } from "./forge";
import { seaSprites } from "./sea";

const W = 210, H = 124;

/** Paper sea + an island slab (zone ground, ink coast, diorama cliffs). */
function island(zone: string, cx: number, cy: number, rx: number, ry: number, seed: number, cliff = 9) {
  const land = blobMask(W, H, cx, cy, rx, ry, seed);
  const img = artBlank(W, H, BR.paperR[2]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (y % 3 === 0 && (x + y) % 9 < 4 && fbm3(x, y, 0x5ea, 30) > 0.72) img.data[y * W + x] = BR.paperR[1];
  biomeGround(zone)!.paint(img, land, { land, apt: 3 });
  paintCliffs(img, land, { depth: cliff });
  const free = (x: number, y: number) => {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H || !land[yy * W + xx]) return false;
    }
    return true;
  };
  return { img, land, L: new Layout(W, H, free) };
}

/** Perception heartland: forest, the treehouse, the Lens Keep town, a windmill; a lighthouse islet and a ship offshore. */
function forestScene(): ArtImage {
  const { img, L } = island("forest", 96, 58, 84, 48, 0xf0e5);
  const t = townSprites(), s = seaSprites();
  L.put(t.treehouse, 44, 64, { force: true, ink: true });
  L.put(townLandmark("classifier")!, 118, 84, { force: true, ink: true });
  L.put(t.windmill, 150, 50, { force: true }); L.put(westSprites().waterTower, 164, 58, { force: true });
  L.put(t.house0, 92, 94, { force: true }); L.put(t.house2, 148, 92, { force: true }); L.put(t.house1, 76, 80, { force: true });
  L.scatter(t.grove, 4, 21); L.scatter(t.pine, 12, 22); L.scatter(t.pineS, 10, 23); L.scatter(t.oak, 5, 24); L.scatter(t.oakS, 5, 25);
  L.put(s.lighthouse, 192, 108, { force: true }); L.put(s.sloop, 186, 26, { force: true }); L.put(s.isletS, 12, 112, { force: true });
  L.draw(img);
  return img;
}

/** The Wild West plateau: mesas behind, the boomtown on the rail line, station + train + mine cart, the Ledger Saloon. */
function westScene(): ArtImage {
  const { img, L } = island("wildwest", 104, 58, 96, 50, 0xf00d);
  const s = westSprites();
  L.put(s.mesaL, 48, 30, { force: true }); L.put(s.butte, 70, 26, { force: true }); L.put(s.mesaS, 170, 34, { force: true });
  L.put(s.arch, 140, 34, { force: true });
  for (let x = 22; x < 190; x += 12) L.put(s.trackH, x, 84, { force: true });
  L.put(s.station, 112, 79, { force: true });
  L.put(s.mineCart, 40, 85, { force: true }); L.put(s.car, 146, 85, { force: true }); L.put(s.loco, 164, 85, { force: true });
  L.put(boomtown(), 66, 72, { force: true });
  L.put(westLandmark("tabular_classifier")!, 176, 76, { force: true, ink: true });
  L.put(westMarker("champion"), 126, 104, { force: true, ink: true });
  L.scatter(s.saguaro, 3, 1); L.scatter(s.saguaroM, 3, 2); L.scatter(s.saguaroS, 3, 3);
  L.scatter(s.tumbleweed, 3, 4); L.scatter(s.scrub, 5, 5); L.scatter(s.skull, 1, 6);
  L.draw(img);
  return img;
}

/** The lava forge: basalt slab, lava rivers, the four forges, smokestacks, spires. */
function forgeScene(): ArtImage {
  const { img, L } = island("forge", 104, 58, 96, 50, 0xf0f0, 9);
  const f = forgeSprites();
  L.put(f.volcano, 104, 58, { force: true, ink: true });
  L.put(forgeLandmark("pixelcnn")!, 40, 64, { force: true, ink: true });
  L.put(forgeLandmark("diffusion")!, 64, 104, { force: true, ink: true });
  L.put(forgeLandmark("vae")!, 112, 106, { force: true, ink: true });
  L.put(forgeLandmark("gan")!, 164, 96, { force: true, ink: true });
  L.put(f.smokestack, 160, 50, { force: true });
  L.scatter(f.spire, 4, 31); L.scatter(f.spireS, 6, 32); L.scatter(f.lavaPool, 2, 33);
  L.draw(img);
  return img;
}

/** Heartland sampler: the transformer cathedral on the green, the marble loop, the stilt town, the snow castle. */
function sandsScene(): ArtImage {
  const land = blobMask(W, H, 104, 60, 98, 52, 0x5a4d);
  const img = artBlank(W, H, BR.paperR[2]);
  // three zones side by side on one slab: snow (north-west), marble (centre), stilts (east)
  const snow = new Uint8Array(W * H), marble = new Uint8Array(W * H), stilts = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!land[i]) continue;
    const b = x + (fbm3(x, y, 0x77, 16) - 0.5) * 18;
    if (b < 62 && y < 70) snow[i] = 1; else if (b < 140) marble[i] = 1; else stilts[i] = 1;
  }
  biomeGround("snow")!.paint(img, snow, { apt: 3 }); biomeGround("marble")!.paint(img, marble, { apt: 3 }); biomeGround("stilts")!.paint(img, stilts, { apt: 3 });
  paintCliffs(img, land, { depth: 9 });
  const L = new Layout(W, H, (x, y) => x > 1 && y > 1 && x < W - 2 && y < H - 2 && land[y * W + x] === 1 && land[(y + 2) * W + x] === 1);
  const t = townSprites(), s = sandsSprites();
  L.put(t.peakL, 30, 34, { force: true }); L.put(t.peakM, 52, 30, { force: true }); L.put(t.peakS, 16, 44, { force: true });
  L.put(townLandmark("simclr")!, 40, 70, { force: true, ink: true });
  L.put(sandsLandmark("transformer")!, 96, 58, { force: true, ink: true });
  L.put(sandsLandmark("rnn")!, 120, 104, { force: true, ink: true });
  L.put(sandsLandmark("mamba")!, 176, 78, { force: true, ink: true });
  L.scatter(t.pineSnow, 6, 41, (x, y) => snow[y * W + x] === 1); L.scatter(t.pineSnowS, 5, 42, (x, y) => snow[y * W + x] === 1);
  L.scatter(s.palm, 4, 43, (x, y) => marble[y * W + x] === 1); L.scatter(s.columnB, 2, 44, (x, y) => marble[y * W + x] === 1);
  L.scatter(s.hoodoo, 3, 45, (x, y) => stilts[y * W + x] === 1); L.scatter(s.hoodooS, 3, 46, (x, y) => stilts[y * W + x] === 1);
  L.scatter(t.pine, 4, 47, (x, y) => marble[y * W + x] === 1 && x < 110);
  L.draw(img);
  return img;
}

/** Decision: the green village (church, observatory) on the shore and the SUNKEN CITY in the bay beside it. */
function sunkenScene(): ArtImage {
  const land = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const coast = 38 + Math.sin(x * 0.04) * 5 + (fbm3(x, 0, 0x11, 18) - 0.5) * 10;
    land[y * W + x] = y < coast ? 1 : 0;
  }
  const img = artBlank(W, H, BR.paperR[2]);
  biomeGround("village")!.paint(img, land, { land, apt: 3 });
  paintCliffs(img, land, { depth: 7 });
  const mask = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const ex = Math.abs((x - 108) / 98), ey = Math.abs((y - 88) / 36);
    if (!land[i] && img.data[i] === BR.paperR[2] && Math.pow(ex, 2.4) + Math.pow(ey, 2.4) + (fbm3(x, y, 0x77, 20) - 0.5) * 0.8 < 1) mask[i] = 1;
  }
  biomeGround("sunken")!.paint(img, mask, { apt: 3 });
  const onLand = new Layout(W, H, (x, y) => land[y * W + x] === 1 && land[Math.min(H - 1, y + 3) * W + x] === 1);
  const t = townSprites();
  onLand.put(townLandmark("alphazero")!, 60, 34, { force: true, ink: true });
  onLand.put(t.observatory, 156, 26, { force: true, ink: true });
  onLand.put(t.house0, 104, 24, { force: true }); onLand.put(t.oak, 16, 26, { force: true }); onLand.put(t.oakS, 186, 24, { force: true }); onLand.put(t.pineS, 124, 18, { force: true });
  onLand.draw(img);
  const L = new Layout(W, H, (x, y) => mask[y * W + x] === 1);
  const r = reefSprites();
  L.put(reefLandmark("reinforce")!, 62, 104, { force: true, ink: true });
  L.put(reefLandmark("rl_maze")!, 152, 108, { force: true, ink: true });
  L.put(reefMarker("champion"), 106, 116, { force: true, ink: true });
  L.put(r.domeHut, 112, 74, { force: true }); L.put(r.ruin, 196, 84, { force: true });
  L.put(r.jelly, 100, 56, { force: true }); L.put(r.jellyG, 190, 60, { force: true }); L.put(r.jelly, 24, 76, { force: true });
  coralCluster(L, 26, 104, 0); coralCluster(L, 186, 110, 1); coralCluster(L, 128, 96, 2);
  L.scatter(r.kelp, 4, 11); L.scatter(r.kelpS, 3, 12); L.put(r.schoolG, 150, 70, { force: true }); L.scatter(r.bubbles, 2, 13);
  L.draw(img);
  return img;
}

/** Structure: the FLOATING CYBER ISLAND over the paper sea — neon grid deck, towers, the Nexus Spire, hanging underside. */
function cyberScene(): ArtImage {
  const land = blobMask(W, H, 104, 50, 92, 38, 0xbeef);
  const img = artBlank(W, H, BR.paperR[2]);
  biomeGround("cyber")!.paint(img, land, { land, apt: 3, border: false });
  // lit rim: the deck edge catches neon, north/west in cyan, south/east in magenta
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    if (!land[i]) continue;
    if (!land[i - W] || !land[i - 1]) img.data[i] = BR.neonC[2];
    else if (!land[i + W] || !land[i + 1]) img.data[i] = BR.neonM[1];
  }
  paintUnderside(img, land, { depth: 18 });
  const L = new Layout(W, H, (x, y) => {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (!land[Math.min(H - 1, Math.max(0, y + dy)) * W + Math.min(W - 1, Math.max(0, x + dx))]) return false;
    return true;
  });
  L.put(neonLandmark("gnn")!, 84, 62, { force: true, ink: true });
  L.put(neonLandmark("nerf")!, 150, 70, { force: true, ink: true });
  L.put(neonMarker("trained"), 118, 80, { force: true, ink: true });
  cityBlocks((s, x, y) => {
    for (let dx = -2; dx <= 2; dx++) if (L.occ[y * W + x + dx] || L.occ[(y - 4) * W + x + dx]) return false;
    return L.put(s, x, y, { force: true });
  }, W, H, { x: 84, y: 50 }, (x, y) => L.free(x, y), 3, 0, 0, [{ x0: 66, y0: 16, x1: 102, y1: 62 }, { x0: 132, y0: 24, x1: 168, y1: 70 }, { x0: 108, y0: 52, x1: 128, y1: 80 }]);
  const n = neonSprites();
  L.put(n.chunk, 16, 30, { force: true }); L.put(n.chunk, 198, 40, { force: true }); L.put(n.car, 60, 14, { force: true });
  L.draw(img);
  const s = seaSprites();
  const sea = new Layout(W, H, () => true);
  sea.put(s.cloud1, 186, 118, { force: true }); sea.put(s.rock, 20, 116, { force: true });
  sea.draw(img);
  return img;
}

/** Sea furniture on the paper: ships, islets, lighthouse, clouds, compass, cartouche, corner icons. */
function seaScene(): ArtImage {
  const img = artBlank(W, H, BR.paperR[2]);
  const L = new Layout(W, H, () => true);
  const s = seaSprites();
  L.put(s.ship, 40, 40, { force: true }); L.put(s.sloop, 88, 30, { force: true }); L.put(s.shipL, 150, 104, { force: true });
  L.put(s.islet, 120, 50, { force: true }); L.put(s.isletS, 190, 40, { force: true }); L.put(s.rock, 70, 100, { force: true });
  L.put(s.lighthouse, 30, 108, { force: true }); L.put(s.serpent, 60, 72, { force: true }); L.put(s.tuft, 160, 60, { force: true });
  for (const [x, y] of [[20, 20], [140, 30], [100, 60], [170, 76], [60, 100], [120, 112], [200, 60]] as const) L.put(s.wave, x, y, { force: true });
  L.put(s.cloud0, 170, 16, { force: true }); L.put(s.cloud2, 100, 90, { force: true });
  L.put(s.compass, 190, 90, { force: true });
  L.put(s.ruins, 196, 118, { force: true }); L.put(s.pipelines, 120, 120, { force: true });
  L.draw(img);
  return img;
}

export const SCENES: Record<string, { title: string; make: () => ArtImage }> = {
  forest: { title: "Perception heartland — forest, treehouse, Lens Keep town, windmill, lighthouse", make: forestScene },
  wildwest: { title: "Wild West plateau — boomtown, rail + mine cart, Ledger Saloon, mesas", make: westScene },
  heartland: { title: "Snow · marble · stilts — twin snow castle, blue-spired cathedral, marble loop, stilt town", make: sandsScene },
  forge: { title: "Lava forge — steam foundry, block furnace, hourglass furnace, twin forges", make: forgeScene },
  sunken: { title: "Decision — the green village (church, observatory) and the sunken city in the bay", make: sunkenScene },
  cyber: { title: "Structure — the floating cyber island", make: cyberScene },
  sea: { title: "Sea furniture — ships, islets, lighthouse, clouds, compass, corner icons", make: seaScene },
};
