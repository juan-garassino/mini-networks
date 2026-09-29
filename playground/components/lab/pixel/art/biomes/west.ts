// THE FRONTIER — Decision as the Wild West (round 4). RL is the frontier:
// rewards, gambling, gold-rush odds. Red-orange desert under the same top-left
// sun: canyon mesas with layered strata (lit left faces, maroon shadow faces),
// saguaros, tumbleweeds, a sandstone arch, a boomtown on a boardwalk, a
// railroad with a steam train, and three landmark forts for the atoms.
// Built only from the EXISTING ramps (rock, sand, savanna, wood, roof, gold,
// meadow, stone) so it sits on the parchment map like any other land.
import type { EvidenceState } from "@/components/lab/shared/card-model";
import { stampInto, type EmblemMaskLike } from "../sprites/markers";
import type { Sprite } from "../sprites/paint";
import { C } from "./palette";
import { Pen, cluster, stampOf, type BiomeStamp } from "./kit";

// ——— material shorthands (palette indices)
const W = { d0: C("wood", 0), d1: C("wood", 1), d2: C("wood", 2), m: C("wood", 3), l: C("wood", 4), h: C("wood", 5) };
const RK = [0, 1, 2, 3, 4, 5].map((i) => C("rock", i));
const SD = [0, 1, 2, 3, 4, 5].map((i) => C("sand", i));
const CA = { k: C("meadow", 1), d: C("meadow", 2), m: C("meadow", 3), l: C("meadow", 4), h: C("meadow", 5), f: C("roof", 3) };
const GD = [0, 1, 2, 3, 4].map((i) => C("gold", i));
const RF = [0, 1, 2, 3, 4].map((i) => C("roof", i));
const ST = [0, 1, 2, 3, 4, 5].map((i) => C("stone", i));
const CREAM = SD[5], PAPER = C("paper", 3);

// ——————————————————————————— decor ———————————————————————————

/** Saguaro: 3-px ribbed trunk (lit / body / shade), arms that elbow up. */
function saguaro(v: 0 | 1 | 2): Sprite {
  const H = [13, 10, 7][v], Wd = 9;
  const p = new Pen(Wd, H + 1);
  const col = (x: number, y0: number, y1: number) => {
    for (let y = y0; y <= y1; y++) { p.set(x, y, CA.l); p.set(x + 1, y, CA.m); p.set(x + 2, y, CA.d); }
    p.set(x + 1, y0 - 1, CA.m); p.set(x, y0, CA.h);                           // rounded, lit crown
  };
  const arm = (x: number, top: number, join: number) => {                       // 2-px arm
    for (let y = top; y <= join; y++) { p.set(x, y, CA.l); p.set(x + 1, y, CA.d); }
    p.set(x, top - 1, CA.m);
  };
  const tx = 3;
  col(tx, 1, H - 1);
  if (v === 0) {
    arm(0, 4, 7); p.hl(0, tx - 1, 8, CA.m); p.set(0, 8, CA.l);                  // left arm, elbow row 8
    arm(7, 3, 5); p.hl(tx + 3, 8, 6, CA.m); p.set(8, 6, CA.d);                  // right arm, elbow row 6
    p.set(1, 3, CA.f); p.set(tx + 1, 0, CA.f);                                  // blossoms
  } else if (v === 1) {
    arm(7, 3, 5); p.hl(tx + 3, 8, 6, CA.m); p.set(8, 6, CA.d);
    p.set(tx + 1, 0, CA.f);
  } else {
    arm(0, 3, 4); p.hl(0, tx - 1, 5, CA.m);
  }
  // ribs: every other row a darker notch on the body column
  for (let y = 2; y < H - 1; y += 2) p.set(tx + 1, y, CA.d);
  return p.done2({ x: tx + 1, y: H - 1 }, { shadow: [tx + 1, H - 1, 3, 1] });
}

function tumbleweed(): Sprite {
  const p = new Pen(7, 6);
  const a = C("savanna", 3), b = C("savanna", 1), c = C("savanna", 2);
  p.art(0, 0, [
    "..aca..",
    ".a.b.c.",
    "ac.a.bc",
    "c.b.a.b",
    ".bc.cb.",
    "..bbb..",
  ], { a, b, c });
  return p.done2({ x: 3, y: 5 }, { rim: false, outline: false, shadow: [3, 5, 3, 1] });
}

function scrub(): Sprite {
  const p = new Pen(7, 4);
  const a = C("olive", 4), b = C("olive", 3), c = C("olive", 2);
  p.art(0, 0, [
    ".a.a...",
    "aabab.a",
    "babcbab",
    ".cbc.c.",
  ], { a, b, c });
  return p.done2({ x: 3, y: 3 }, { rim: false });
}

/** Cow skull on a rock — tiny set dressing. */
function skull(): Sprite {
  const p = new Pen(7, 4);
  p.art(0, 0, [
    "c.....c",
    ".cwwwc.",
    "..wkw..",
    "..sws..",
  ], { c: SD[4], w: C("foam", 1), k: RK[1], s: SD[3] });
  return p.done2({ x: 3, y: 3 }, { rim: false });
}

// ——————————————————————————— relief ———————————————————————————

/**
 * Mesa / butte: flat cap (cream lit edge), front face in horizontal STRATA
 * bands (2 rows each, one pale band), the left third lit, the right third in
 * maroon shadow, and a talus skirt 1 px wider at the foot.
 */
function mesa(w: number, capH: number, faceH: number): Sprite {
  const p = new Pen(w + 2, capH + faceH + 2);
  const x0 = 1, x1 = w;
  // cap (top surface)
  for (let y = 0; y < capH; y++) for (let x = x0 + 1; x <= x1 - 1; x++) p.set(x, y, y === 0 ? SD[5] : x < x0 + 3 ? SD[5] : SD[4]);
  p.hl(x0 + 1, x1 - 1, capH - 1, SD[3]);
  // face with strata
  const bands = [[RK[4], RK[3], RK[2]], [RK[5], RK[4], RK[3]], [SD[4], SD[3], RK[3]], [RK[4], RK[3], RK[2]], [RK[3], RK[2], RK[1]]];
  for (let r = 0; r < faceH; r++) {
    const b = bands[Math.floor(r / 2) % bands.length];
    const y = capH + r;
    const inset = r >= faceH - 2 ? -1 : 0;                      // talus skirt
    for (let x = x0 + inset; x <= x1 - inset; x++) {
      const u = (x - x0) / Math.max(1, x1 - x0);
      const v = u < 0.3 ? b[0] : u < 0.7 ? b[1] : b[2];
      p.set(x, y, v);
    }
  }
  // a few vertical erosion gullies in the shadow part
  for (let x = x0 + Math.round(w * 0.55); x < x1; x += 3) for (let y = capH + 1; y < capH + faceH - 1; y++) if ((x + y) % 2 === 0) p.set(x, y, RK[1]);
  p.set(x0 + Math.round(w * 0.3), capH + 2, RK[2]); p.set(x0 + Math.round(w * 0.3), capH + 3, RK[2]);
  return p.done2({ x: Math.round((w + 2) / 2), y: capH + faceH }, { rim: false, shadow: [Math.round((w + 2) / 2), capH + faceH, w / 2 + 1, 1.5] });
}

/** Sandstone arch: two legs + an arc, strata stripes, lit left. */
function arch(): Sprite {
  const p = new Pen(15, 11);
  const cx = 7, cy = 10;
  for (let y = 0; y <= 10; y++) for (let x = 0; x < 15; x++) {
    const ex = (x - cx) / 7.2, ey = (y - cy) / 10.2;
    const ix = (x - cx) / 4.1, iy = (y - cy) / 7.2;
    if (ex * ex + ey * ey > 1 || ix * ix + iy * iy < 1) continue;
    const u = x / 14;
    const band = y % 3 === 2;
    const v = u < 0.35 ? (band ? RK[4] : RK[5]) : u < 0.7 ? (band ? RK[3] : RK[4]) : (band ? RK[2] : RK[3]);
    p.set(x, y, v);
  }
  p.hl(5, 9, 0, SD[5]);
  return p.done2({ x: 7, y: 10 }, { rim: false, shadow: [7, 10, 7, 1.2] });
}

// ——————————————————————————— boomtown ———————————————————————————

/** Plank wall with horizontal seams every 2 rows (weathered wood). */
function planks(p: Pen, x: number, y: number, w: number, h: number, light = false) {
  const body = light ? W.l : W.m, lit = light ? W.h : W.l, seam = light ? W.m : W.d2;
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    let v = c === 0 ? lit : c === w - 1 ? W.d2 : body;
    if (r % 3 === 2 && c > 0 && c < w - 1 && (c + r * 2) % 9 !== 0) v = seam;   // board seams, broken at the joints
    p.set(x + c, y + r, v);
  }
}

function glowWin(p: Pen, x: number, y: number, w = 2, h = 2, lit = true) {
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) p.set(x + c, y + r, lit ? (r === 0 && c === 0 ? GD[4] : GD[3]) : W.d1);
  p.hl(x - 1, x + w, y + h, W.h);                                   // sill
}

/** Saloon: false-front facade with a sign board, balcony, batwing doors. 18×20. */
function saloon(): Sprite {
  const p = new Pen(19, 21);
  planks(p, 1, 7, 16, 13);                                       // body
  p.f(3, 0, 12, 7, W.m); p.vl(3, 0, 6, W.l); p.vl(14, 0, 6, W.d2);  // false front
  p.hl(2, 15, 0, W.h); p.set(2, 1, W.l); p.set(15, 1, W.d2);       // cornice
  p.f(4, 2, 10, 4, CREAM); p.hl(4, 13, 5, SD[4]);                  // sign board
  for (const x of [5, 6, 8, 10, 11, 12]) { p.set(x, 3, RF[1]); p.set(x, 4, x === 6 || x === 11 ? CREAM : RF[1]); }
  glowWin(p, 3, 8); glowWin(p, 8, 8, 2, 2, false); glowWin(p, 13, 8);
  p.hl(0, 17, 11, W.h); p.hl(0, 17, 12, W.d1);                      // balcony deck + shade
  for (let x = 1; x <= 16; x += 3) p.set(x, 10, W.l);             // rail posts
  p.hl(0, 17, 10, W.l);
  // batwing doors
  p.f(7, 14, 4, 5, W.d0); p.f(7, 15, 2, 2, W.h); p.f(9, 15, 2, 2, W.l);
  glowWin(p, 2, 14, 3, 3); glowWin(p, 13, 14, 3, 3);
  for (const x of [1, 16]) p.vl(x, 13, 19, W.d1);                  // porch posts
  p.hl(0, 18, 20, W.d2); p.hl(0, 18, 19, W.l);                      // boardwalk
  return p.done2({ x: 9, y: 20 }, { shadow: [9, 20, 9, 1.5] });
}

/** General store: false front + striped awning + barrels. 16×17. */
function store(): Sprite {
  const p = new Pen(17, 18);
  planks(p, 1, 5, 14, 12, true);
  p.f(2, 0, 12, 5, W.l); p.vl(2, 0, 4, W.h); p.vl(13, 0, 4, W.m); p.hl(1, 14, 0, W.h);
  p.f(3, 1, 10, 3, RF[3]); for (let x = 4; x <= 11; x += 2) p.set(x, 2, CREAM);   // painted sign
  // striped awning
  for (let x = 0; x <= 15; x++) { p.set(x, 8, x % 4 < 2 ? RF[3] : CREAM); p.set(x, 9, x % 4 < 2 ? RF[2] : SD[4]); }
  p.hl(0, 15, 10, W.d1);
  p.f(6, 12, 3, 5, W.d0); p.set(6, 12, W.m);
  glowWin(p, 2, 12, 3, 2); glowWin(p, 11, 12, 3, 2);
  // barrels
  for (const bx of [12, 14]) { p.f(bx, 14, 2, 3, W.d2); p.set(bx, 14, W.m); p.set(bx, 15, GD[1]); }
  p.hl(0, 16, 17, W.d2); p.hl(0, 16, 16, W.l);
  return p.done2({ x: 8, y: 17 }, { shadow: [8, 17, 8, 1.5] });
}

/** Sheriff's office: adobe block, flat roof beams, barred window, gold star. 14×13. */
function sheriff(): Sprite {
  const p = new Pen(15, 14);
  const a = [RK[5], RK[4], RK[3], SD[4]];
  for (let y = 2; y < 13; y++) for (let x = 1; x < 14; x++) p.set(x, y, x === 1 ? a[3] : x >= 12 ? a[2] : a[1]);
  p.hl(1, 13, 2, SD[4]); p.hl(0, 14, 1, SD[5]);                        // parapet
  for (const x of [2, 5, 8, 11]) p.set(x, 3, W.d1);                  // vigas (roof beams)
  // star
  p.art(6, 4, ["..g..", "ggggg", ".ggg.", ".g.g."], { g: GD[3] }); p.set(8, 4, GD[4]);
  p.f(2, 8, 3, 3, W.d0); for (let x = 2; x <= 4; x++) p.set(x, 9, ST[3]); p.set(3, 8, ST[4]); p.set(3, 10, ST[3]);  // barred window
  p.f(9, 8, 3, 5, W.d1); p.set(9, 8, W.m); p.set(11, 10, GD[3]);    // door
  p.hl(0, 14, 13, W.d2);
  return p.done2({ x: 7, y: 13 }, { shadow: [7, 13, 7, 1.5] });
}

/** Water tower: wooden tank on trestle legs, conical cap. 11×19. */
function waterTower(): Sprite {
  const p = new Pen(12, 20);
  // cap
  p.art(1, 0, ["....cc....", "..cccddd..", "ccccdddddd"], { c: RF[2], d: RF[1] });
  // tank
  for (let y = 3; y < 10; y++) for (let x = 1; x < 11; x++) p.set(x, y, x < 3 ? W.l : x > 8 ? W.d2 : W.m);
  for (const y of [4, 8]) p.hl(1, 10, y, ST[2]);                     // iron hoops
  // legs + cross braces
  for (const x of [2, 9]) p.vl(x, 10, 19, W.d2);
  for (const x of [4, 7]) p.vl(x, 10, 19, W.d1);
  p.ln(2, 11, 9, 16, W.d1); p.ln(9, 11, 2, 16, W.d1);
  p.vl(10, 10, 12, ST[1]);                                            // spout
  return p.done2({ x: 6, y: 19 }, { shadow: [6, 19, 5, 1.2] });
}

/** Windmill: lattice tower, fan wheel of blades, tail vane. 13×20. */
function windmill(): Sprite {
  const p = new Pen(14, 21);
  const cx = 6, cy = 5;
  // lattice tower
  for (let y = 9; y <= 20; y++) {
    const s = Math.round(1 + (y - 9) * 0.3);
    p.set(cx - s, y, W.l); p.set(cx + s, y, W.d2);
    if (y % 3 === 0) p.hl(cx - s, cx + s, y, W.d1);
  }
  // fan: 8 blades round a hub
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    for (let r = 2; r <= 5; r++) p.set(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), k < 4 ? CREAM : SD[3]);
  }
  p.set(cx, cy, ST[1]); p.set(cx + 1, cy, ST[2]);
  p.hl(cx + 2, cx + 7, cy + 1, W.d1); p.art(cx + 6, cy - 2, ["rr", "rr", "rr", "r."], { r: RF[3] });   // tail vane
  return p.done2({ x: cx, y: 20 }, { shadow: [cx, 20, 4, 1.2] });
}

/** Wanted-poster board: plank board on posts, two posters with faces. 11×10. */
function wantedBoard(): Sprite {
  const p = new Pen(11, 11);
  p.f(0, 1, 11, 6, W.m); p.hl(0, 10, 1, W.l); p.hl(0, 10, 6, W.d2);
  for (const x of [1, 9]) p.vl(x, 7, 10, W.d2);
  for (const [x, y] of [[1, 2], [6, 2]] as const) {
    p.f(x, y, 4, 4, PAPER); p.hl(x, x + 3, y + 3, SD[4]);
    p.set(x + 1, y + 1, RK[1]); p.set(x + 2, y + 1, RK[1]);           // face
    p.hl(x + 1, x + 2, y + 2, RF[2]);                                    // "WANTED" red bar
  }
  return p.done2({ x: 5, y: 10 }, { shadow: [5, 10, 5, 1] });
}

/** Hitching post + a horse-trough. 9×5. */
function trough(): Sprite {
  const p = new Pen(10, 6);
  p.hl(0, 8, 1, W.l); p.vl(0, 1, 5, W.d2); p.vl(8, 1, 5, W.d2);
  p.f(2, 3, 5, 2, W.m); p.hl(3, 5, 3, C("shallow", 3));
  return p.done2({ x: 4, y: 5 }, { rim: false });
}

// ——————————————————————————— railroad ———————————————————————————

/** Straight track tile (h: 12×5, v: 5×12): sleepers + two steel rails. */
function track(dir: "h" | "v"): Sprite {
  const p = new Pen(dir === "h" ? 12 : 5, dir === "h" ? 5 : 12);
  if (dir === "h") {
    for (let x = 0; x < 12; x += 3) p.vl(x, 0, 4, W.d2);
    p.hl(0, 11, 1, ST[4]); p.hl(0, 11, 3, ST[3]);
  } else {
    for (let y = 0; y < 12; y += 3) p.hl(0, 4, y, W.d2);
    p.vl(1, 0, 11, ST[4]); p.vl(3, 0, 11, ST[3]);
  }
  return p.done2({ x: dir === "h" ? 6 : 2, y: dir === "h" ? 4 : 11 }, { rim: false, outline: false });
}

/** Steam locomotive: boiler, funnel stack, cab, cow-catcher, red wheels, smoke. 20×14. */
function locomotive(): Sprite {
  const p = new Pen(21, 15);
  // smoke puffs (drifting back)
  p.blob(3, 2, 2, 1.5, C("foam", 1), C("snow", 4), C("snow", 3));
  p.blob(7, 1, 1.5, 1, C("snow", 4), C("snow", 3), C("snow", 2));
  // funnel
  p.art(2, 3, ["kkkk", ".kk.", ".kk."], { k: ST[1] }); p.set(2, 3, ST[2]);
  // boiler
  for (let y = 6; y < 11; y++) for (let x = 1; x < 13; x++) p.set(x, y, y === 6 ? ST[2] : y === 10 ? ST[0] : y === 7 ? ST[3] : ST[1]);
  p.set(0, 8, GD[3]); p.set(0, 9, GD[2]);                            // headlamp
  for (const x of [5, 9]) p.vl(x, 6, 10, GD[2]);                      // brass bands
  p.art(6, 4, ["gg", "gg"], { g: GD[3] });                           // steam dome
  // cab
  p.f(13, 3, 7, 8, RF[2]); p.vl(13, 3, 10, RF[3]); p.vl(19, 3, 10, RF[1]);
  p.hl(12, 20, 2, ST[1]); p.f(15, 5, 3, 2, GD[3]);
  // cow-catcher + wheels
  p.art(0, 11, ["kk..........", ".k.........."], { k: ST[0] });
  for (const [wx, r] of [[4, 1.5], [9, 1.5], [15, 2]] as const) p.blob(wx, 12, r, r, RF[3], RF[2], RF[1]);
  p.hl(3, 16, 12, ST[1]);                                              // coupling rod
  return p.done2({ x: 10, y: 14 }, { keep: new Set([C("foam", 1)]), shadow: [10, 14, 9, 1.2] });
}

/** Mine cart on rails: riveted iron tub heaped with ore (gold glints). 11×9. */
function mineCart(): Sprite {
  const p = new Pen(12, 9);
  p.art(0, 0, ["...oooo.....", ".ooOoOoo....", "oOoooOoOo..."], { o: RK[1], O: GD[3] });
  p.f(1, 3, 10, 4, ST[2]); p.hl(1, 10, 3, ST[4]); p.vl(1, 3, 6, ST[3]); p.vl(10, 3, 6, ST[1]);
  for (const x of [3, 8]) p.set(x, 5, ST[4]);
  for (const x of [3, 8]) p.blob(x, 7, 1.2, 1.2, ST[2], ST[1], ST[0]);
  return p.done2({ x: 6, y: 8 }, { shadow: [6, 8, 5, 1] });
}

function railcar(): Sprite {
  const p = new Pen(16, 11);
  p.f(0, 2, 16, 6, W.m); p.hl(0, 15, 2, W.h); p.vl(0, 2, 7, W.l); p.vl(15, 2, 7, W.d2);
  p.hl(0, 15, 1, RF[2]); p.hl(1, 14, 0, RF[3]);                         // roof
  for (let x = 2; x < 14; x += 3) glowWin(p, x, 4, 2, 1);
  p.hl(0, 15, 8, ST[1]);
  for (const x of [3, 12]) p.blob(x, 9, 1.2, 1.2, ST[2], ST[1], ST[0]);
  return p.done2({ x: 8, y: 10 }, { shadow: [8, 10, 8, 1] });
}

/** Station: covered platform, hanging sign, water barrel. 24×15. */
function station(): Sprite {
  const p = new Pen(25, 16);
  p.art(0, 0, ["..rrrrrrrrrrrrrrrrrrrr...", ".rrrrrrrrrrrrrrrrrrrrrr..", "RRRRRRRRRRRRRRRRRRRRRRRR."], { r: RF[3], R: RF[1] });
  for (let x = 1; x < 23; x++) p.set(x, 1, x % 3 === 0 ? RF[2] : RF[3]);
  planks(p, 2, 3, 12, 9, true);                                       // depot
  glowWin(p, 4, 5, 2, 2); glowWin(p, 9, 5, 2, 2); p.f(6, 8, 2, 4, W.d0);
  for (const x of [15, 22]) p.vl(x, 3, 12, W.d2);                      // canopy posts
  p.f(16, 4, 5, 2, CREAM); p.hl(17, 19, 4, RF[1]); p.vl(18, 3, 3, W.d1);  // sign
  p.f(0, 12, 24, 2, W.l); p.hl(0, 23, 12, W.h); p.hl(0, 23, 14, W.d2); // platform
  return p.done2({ x: 12, y: 14 }, { shadow: [12, 14, 12, 1.2] });
}

// ——————————————————————————— landmarks (36×46, emblem slot 9×9) ———————————————————————————
const LW = 36, LH = 46, GY = 43, CX = 18;

/** Wooden shingle sign (11×11) with a 9×9 cream emblem window hanging from a bracket. */
function shingle(p: Pen, x: number, y: number, face = CREAM) {
  p.hl(x + 1, x + 9, y - 2, W.d1); p.set(x + 2, y - 1, W.d1); p.set(x + 8, y - 1, W.d1);
  p.f(x, y, 11, 11, W.d2); p.hl(x, x + 10, y, W.l); p.vl(x, y, y + 10, W.l);
  p.f(x + 1, y + 1, 9, 9, face);
  return { x: x + 1, y: y + 1, w: 9, h: 9 };
}

function ground(p: Pen, x0: number, x1: number) {
  p.hl(x0, x1, GY, W.d2); p.hl(x0, x1, GY - 1, W.l); p.hl(x0, x1, GY - 2, W.h);   // boardwalk / plinth
}

/** tabular_classifier · mlp — the LEDGER SALOON: a false-front saloon under a big table-of-cells board. */
function ledgerSaloon(): Sprite {
  const p = new Pen(LW, LH);
  // the big LEDGER board on posts: a table of cells, gold header row (tabular data)
  const dx = 7, dy = 1;
  p.f(dx, dy, 20, 11, W.d2); p.hl(dx, dx + 19, dy, W.l); p.vl(dx, dy, dy + 10, W.l);
  p.f(dx + 1, dy + 1, 18, 9, CREAM); p.f(dx + 1, dy + 1, 18, 2, GD[3]);
  for (let x = dx + 1; x < dx + 19; x += 6) p.vl(x, dy + 1, dy + 9, RK[2]);
  for (const y of [dy + 3, dy + 6]) p.hl(dx + 1, dx + 18, y, RK[2]);
  for (const [x, y] of [[3, 4], [9, 4], [15, 7], [4, 7], [10, 7]] as const) p.hl(dx + x, dx + x + 2, dy + y, RK[1]);
  for (const x of [dx + 3, dx + 16]) p.vl(x, dy + 11, 13, W.d1);
  // facade: stepped false front
  planks(p, 4, 14, 28, 27);
  p.f(7, 12, 22, 3, W.m); p.hl(6, 29, 11, W.h); p.vl(7, 12, 14, W.l);
  p.hl(3, 32, 14, W.h);
  // marquee bulbs along the cornice (gambling hall)
  for (let x = 5; x <= 31; x += 2) p.set(x, 15, GD[4]);
  // upper floor: windows + balcony
  glowWin(p, 7, 18, 3, 3); glowWin(p, 16, 18, 3, 3, false); glowWin(p, 25, 18, 3, 3);
  p.hl(3, 32, 23, W.l); p.hl(3, 32, 24, W.h); p.hl(3, 32, 25, W.d0);
  for (let x = 4; x <= 31; x += 3) p.set(x, 22, W.l);
  p.hl(3, 32, 22, W.l);
  // ground floor: batwing doors, card-table windows
  p.f(15, 32, 6, 9, W.d0); p.f(15, 33, 3, 4, W.h); p.f(18, 33, 3, 4, W.l); p.set(17, 33, W.m);
  glowWin(p, 6, 30, 4, 4); glowWin(p, 26, 30, 4, 4);
  for (const x of [4, 31]) p.vl(x, 26, 40, W.d1);
  // emblem shingle hanging under the balcony
  const slot = shingle(p, 22, 28 - 1);
  p.clearPx(0, 0);
  ground(p, 1, 34);
  // hitching rail
  p.hl(0, 3, 38, W.l); p.vl(0, 38, 41, W.d2);
  return p.done2({ x: CX, y: GY }, { slot, shadow: [CX, GY - 1, 19, 3] });
}

// ——————————————————————————— derived markers (20×28, 7×7 emblem) ———————————————————————————

/** Frontier camp: a canvas tent + a signpost with the emblem board, dressed by evidence state. */
export function westMarker(state: EvidenceState, emblem?: EmblemMaskLike): Sprite {
  const p = new Pen(20, 28);
  const dim = state === "untrained";
  const can = dim ? [SD[1], SD[2], SD[3]] : [SD[3], SD[4], SD[5]];
  // tent (A-frame, lit left flank)
  if (state !== "provisional") {
    for (let r = 0; r < 11; r++) {
      const half = Math.round(r * 0.75);
      for (let dx = -half; dx <= half; dx++) p.set(7 + dx, 14 + r, dx < 0 ? can[2] : dx === 0 ? can[1] : can[0]);
    }
    p.f(6, 21, 3, 4, dim ? RK[1] : W.d0);                              // doorway
    if (dim) { p.set(9, 17, SD[0]); p.set(10, 18, SD[0]); }            // a tear
  } else {
    p.ln(7, 14, 0, 24, W.m); p.ln(7, 14, 14, 24, W.d2); p.vl(7, 14, 24, W.d1);   // bare frame
  }
  p.vl(7, 12, 14, W.d1);
  // signpost + board with the emblem
  p.vl(15, 12, 25, W.d2); p.vl(14, 12, 25, W.l);
  const board = dim ? W.d2 : state === "champion" ? GD[3] : W.m;
  p.f(9, 2, 11, 10, board); p.hl(9, 19, 2, dim ? W.d2 : state === "champion" ? GD[4] : W.l); p.vl(9, 2, 11, state === "champion" ? GD[4] : W.l);
  p.f(10, 3, 9, 8, dim ? W.d1 : CREAM);
  const slot = { x: 11, y: 3, w: 7, h: 7 };
  if (emblem && state !== "provisional") stampInto(p, slot, emblem, dim ? W.m : RK[1], dim ? undefined : SD[3]);
  if (state === "provisional") p.art(12, 4, [".###.", "....#", "..##.", ".....", "..#.."], { "#": RF[1] });
  if (state === "champion") p.art(12, 0, ["..g..", "ggggg", ".g.g."], { g: GD[4] });
  if (state === "trained") { p.vl(2, 9, 13, W.d1); p.f(1, 12, 3, 2, GD[3]); p.set(1, 12, GD[4]); p.art(8, 10, ["rr", "r."], { r: RF[3] }); } // lit lantern
  p.hl(3, 17, 25, W.d2); p.hl(3, 17, 24, dim ? SD[1] : SD[3]);
  return p.done2({ x: 10, y: 26 }, { slot, shadow: [10, 26, 8, 2] });
}

// ——————————————————————————— catalogue ———————————————————————————

const memo = new Map<string, Sprite>();
const once = (k: string, f: () => Sprite) => { let s = memo.get(k); if (!s) { s = f(); memo.set(k, s); } return s; };

export const WEST_LANDMARKS: Record<string, { make: () => Sprite; note: string }> = {
  tabular_classifier: { make: ledgerSaloon, note: "Ledger Saloon — a false-front saloon under a big table-of-cells board, water tower out back" },
};

/** A composed boomtown on its boardwalk (saloon, store, sheriff, water tower, windmill, posters). 64×24. */
export function boomtown(): Sprite {
  return once("west:boomtown", () => cluster(66, 26, [
    { s: westSprites().waterTower, x: 6, y: 19 },
    { s: westSprites().windmill, x: 61, y: 20 },
    { s: westSprites().store, x: 16, y: 23 },
    { s: westSprites().saloon, x: 33, y: 24 },
    { s: westSprites().sheriff, x: 50, y: 23 },
    { s: westSprites().wanted, x: 60, y: 25 },
    { s: westSprites().trough, x: 25, y: 25 },
  ], { x: 33, y: 24 }));
}

export function westSprites() {
  return {
    saguaro: once("w:sag0", () => saguaro(0)), saguaroM: once("w:sag1", () => saguaro(1)), saguaroS: once("w:sag2", () => saguaro(2)),
    tumbleweed: once("w:tw", tumbleweed), scrub: once("w:scrub", scrub), skull: once("w:skull", skull),
    mesaL: once("w:mesaL", () => mesa(24, 4, 11)), mesaS: once("w:mesaS", () => mesa(14, 3, 8)), butte: once("w:butte", () => mesa(7, 2, 13)),
    arch: once("w:arch", arch),
    saloon: once("w:saloon", saloon), store: once("w:store", store), sheriff: once("w:sheriff", sheriff),
    waterTower: once("w:wt", waterTower), windmill: once("w:wm", windmill), wanted: once("w:wanted", wantedBoard), trough: once("w:trough", trough),
    trackH: once("w:trackH", () => track("h")), trackV: once("w:trackV", () => track("v")),
    loco: once("w:loco", locomotive), mineCart: once("w:cart", mineCart), car: once("w:car", railcar), station: once("w:station", station),
  };
}

export function westStamps(): BiomeStamp[] {
  const s = westSprites();
  return [
    stampOf("saguaro", "decor", s.saguaro, "two-armed saguaro, pink blossoms"),
    stampOf("saguaro · one arm", "decor", s.saguaroM, "saguaro, one arm"),
    stampOf("saguaro · young", "decor", s.saguaroS, "small saguaro"),
    stampOf("tumbleweed", "decor", s.tumbleweed, "tangled ball, no outline (rolls)"),
    stampOf("scrub", "decor", s.scrub, "sage-olive creosote clump"),
    stampOf("cow skull", "decor", s.skull, "bleached skull — sparse set dressing"),
    stampOf("mesa L", "relief", s.mesaL, "flat cap, strata bands, maroon shadow face, talus"),
    stampOf("mesa S", "relief", s.mesaS, "small mesa"),
    stampOf("butte", "relief", s.butte, "tall narrow butte"),
    stampOf("rock arch", "relief", s.arch, "sandstone arch, strata stripes"),
    stampOf("saloon", "town", s.saloon, "false-front facade, sign board, balcony, batwing doors"),
    stampOf("general store", "town", s.store, "striped awning, barrels"),
    stampOf("sheriff", "town", s.sheriff, "adobe office, gold star, barred window"),
    stampOf("water tower", "town", s.waterTower, "tank on trestle legs"),
    stampOf("windmill", "town", s.windmill, "lattice tower, fan wheel, red tail vane"),
    stampOf("wanted board", "town", s.wanted, "two WANTED posters on a plank board"),
    stampOf("trough", "town", s.trough, "hitching rail + water trough"),
    stampOf("boomtown", "town", boomtown(), "composed main street on a boardwalk (use as one cluster)"),
    stampOf("track —", "rail", s.trackH, "12-px repeat, sleepers every 3 px"),
    stampOf("track |", "rail", s.trackV, "12-px repeat"),
    stampOf("steam engine", "rail", s.loco, "funnel stack, brass bands, red cab + wheels, smoke"),
    stampOf("rail car", "rail", s.car, "lit windows"),
    stampOf("mine cart", "rail", s.mineCart, "iron tub heaped with ore"),
    stampOf("station", "rail", s.station, "depot + covered platform + sign"),
  ];
}

export const westLandmark = (atom: string): Sprite | undefined => {
  const e = WEST_LANDMARKS[atom];
  return e ? once(`w:lm:${atom}`, e.make) : undefined;
};
