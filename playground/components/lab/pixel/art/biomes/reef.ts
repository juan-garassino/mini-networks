// THE REEF — Structure underwater in the central bay (round 4). Seen from
// above through water: the parchment sea turns into bathymetric teal (pale
// reef crest at the rim, deeper inward), calm caustic ripples, sand flats with
// ripples, coral clusters in four shapes (branching, fan, brain, tube), kelp,
// bubbles, fish schools and a sunken ruin. Light still falls from the top-left
// (it comes down through the surface as shafts).
import type { EvidenceState } from "@/components/lab/shared/card-model";
import { stampInto, type EmblemMaskLike } from "../sprites/markers";
import type { Sprite } from "../sprites/paint";
import { BR, C } from "./palette";
import { Pen, stampOf, type BiomeStamp } from "./kit";
import type { Layout } from "./vignette";

const R = BR.reef, SB = BR.seabed;
const CO = [0, 1, 2, 3, 4].map((i) => C("roof", i));        // coral reds → orange
const MG = [0, 1, 2].map((i) => C("magic", i));             // violet → pink
const GD = [0, 1, 2, 3, 4].map((i) => C("gold", i));
const SV = [0, 1, 2, 3, 4, 5].map((i) => C("savanna", i));
const KP = [0, 1, 2, 3, 4].map((i) => C("sage", i));        // kelp: parchment sage (muted under water)
const ST = [0, 1, 2, 3, 4, 5].map((i) => C("stone", i));
const FOAM = C("foam", 1), FOAM0 = C("foam", 0);
export const REEF_KEEP = new Set([FOAM, FOAM0, GD[4]]);

// ——————————————————————————— corals ———————————————————————————

/** Staghorn (branching) coral: forked branches, lit tips, shadowed roots. 11×9. */
function branching(hue: "red" | "violet" = "red"): Sprite {
  const p = new Pen(12, 10);
  const [d, m, l, t] = hue === "red" ? [CO[1], CO[2], CO[3], CO[4]] : [MG[0], MG[1], MG[2], FOAM0];
  p.art(0, 0, [
    ".t...t..t...",
    ".l.t.l..l.t.",
    ".ll.l.l.l.l.",
    "..l.lm..ml..",
    "t.lmm.m.m..t",
    "l..m..mm..l.",
    ".mm.m.m.mm..",
    "...mmmmmm...",
    "....dddd....",
    "...dddddd...",
  ], { t, l, m, d });
  return p.done2({ x: 6, y: 9 }, { keep: REEF_KEEP, shadow: [6, 9, 5, 1] });
}

/** Sea fan (gorgonian): a lattice fan on a short stem. 11×10. */
function fan(): Sprite {
  const p = new Pen(11, 10);
  p.art(0, 0, [
    "...l.l.l...",
    ".l.lmlml.m.",
    "l.lm.m.mm.m",
    ".lmlmmmmdm.",
    "l.mm.m.md.d",
    ".m.mmmdd.d.",
    "..m.mdd.d..",
    "....dd.....",
    ".....d.....",
    "....sss....",
  ], { l: MG[2], m: MG[1], d: MG[0], s: ST[1] });
  return p.done2({ x: 5, y: 9 }, { keep: REEF_KEEP, rim: false, shadow: [5, 9, 4, 1] });
}

/** Brain coral: an ochre dome with meandering grooves. 9×7. */
function brain(): Sprite {
  const p = new Pen(10, 8);
  p.blob(4, 3, 4, 3, SV[4], SV[3], SV[2]);
  p.art(1, 1, [".g..gg.", "g.gg..g", ".g..gg.", "gg.g..g", "..g.g.."], { g: SV[1] });
  p.hl(1, 7, 7, SV[0]);
  return p.done2({ x: 4, y: 7 }, { keep: REEF_KEEP, rim: false, shadow: [4, 7, 4, 1] });
}

/** Tube sponges: open-topped cylinders, dark mouths. 9×9. */
function tubes(): Sprite {
  const p = new Pen(10, 10);
  const tube = (x: number, top: number, h: number) => {
    for (let y = top; y < top + h; y++) { p.set(x, y, GD[3]); p.set(x + 1, y, GD[2]); p.set(x + 2, y, GD[1]); }
    p.hl(x, x + 2, top, GD[4]); p.set(x + 1, top, C("rock", 1));
  };
  tube(3, 0, 9); tube(0, 3, 6); tube(6, 2, 7);
  return p.done2({ x: 5, y: 8 }, { keep: REEF_KEEP, rim: false, shadow: [5, 8, 4, 1] });
}

/** Kelp: 2–3 wavy strands with bladders. */
function kelp(v: 0 | 1): Sprite {
  const H = v ? 11 : 15;
  const p = new Pen(8, H + 1);
  const strand = (x0: number, h: number, ph: number) => {
    for (let y = 0; y < h; y++) {
      const x = Math.round(x0 + Math.sin((y + ph) * 0.55) * 1.2);
      p.set(x, H - y, y > h - 3 ? KP[3] : KP[2]); p.set(x + 1, H - y, KP[1]);
      if (y % 4 === 2) p.set(x - 1, H - y, KP[4]);                      // lit blade
    }
  };
  strand(1, H - 2, 0); strand(4, H, 2); if (!v) strand(6, H - 5, 1);
  return p.done2({ x: 4, y: H }, { rim: false });
}

function bubbles(): Sprite {
  const p = new Pen(6, 9);
  p.art(0, 0, [".oo...", "o..o..", ".oo...", "....o.", "...o.o", "....o.", "..o...", ".o.o..", "..o..."], { o: R[6] });
  p.set(1, 0, FOAM); p.set(4, 3, FOAM); p.set(2, 6, FOAM);
  return p.done2({ x: 2, y: 8 }, { rim: false, outline: false, keep: REEF_KEEP });
}

/** A school of small fish on a curving path (gold or silver). */
function school(hue: "gold" | "silver"): Sprite {
  const p = new Pen(16, 8);
  const [a, b] = hue === "gold" ? [GD[4], GD[2]] : [FOAM, R[5]];
  const fish: [number, number][] = [[1, 5], [4, 3], [5, 6], [8, 2], [9, 5], [12, 1], [12, 4]];
  for (const [x, y] of fish) { p.set(x, y, a); p.set(x + 1, y, a); p.set(x - 1, y, b); p.set(x + 2, y, R[1]); }
  return p.done2({ x: 8, y: 7 }, { rim: false, outline: false, keep: REEF_KEEP });
}

function turtle(): Sprite {
  const p = new Pen(10, 8);
  p.art(0, 0, [
    "..f....f..",
    "...sSSs...",
    ".hsSsSSsf.",
    "hhSsSSsS..",
    ".hsSSsSs..",
    "...sSSs...",
    "..f....f..",
  ], { s: KP[2], S: KP[3], h: KP[4], f: KP[1] });
  return p.done2({ x: 5, y: 7 }, { rim: false });
}

/** Sunken ruin: toppled columns, a broken pediment, weed on the stones. 24×14. */
function ruin(): Sprite {
  const p = new Pen(25, 15);
  // standing column stumps
  for (const [x, h] of [[2, 9], [8, 6], [19, 10]] as const) {
    for (let y = 14 - h; y < 14; y++) { p.set(x, y, ST[4]); p.set(x + 1, y, ST[3]); p.set(x + 2, y, ST[2]); }
    p.hl(x - 1, x + 3, 14 - h, ST[5]); p.hl(x - 1, x + 3, 13, ST[1]);
  }
  // fallen pediment
  p.art(9, 8, ["....ttttt...", "..ttSSSSStt.", "ttSSSSSSSSSs", "ssssssssssss"], { t: ST[5], S: ST[3], s: ST[1] });
  // toppled drum
  p.blob(14, 13, 2, 1, ST[4], ST[3], ST[2]);
  // weed
  for (const [x, y] of [[4, 4], [20, 3], [11, 7]] as const) { p.vl(x, y, y + 3, KP[2]); p.set(x + 1, y + 1, KP[3]); }
  return p.done2({ x: 12, y: 14 }, { keep: REEF_KEEP, shadow: [12, 14, 11, 1.2] });
}

// ——————————————————————————— landmarks (36×46) ———————————————————————————
const LW = 36, LH = 46, GY = 43, CX = 18;

/** Stone tablet (11×11) with a nacre 9×9 face — the emblem slot. */
function tablet(p: Pen, x: number, y: number) {
  p.f(x, y, 11, 11, ST[2]); p.hl(x, x + 10, y, ST[4]); p.vl(x, y, y + 10, ST[4]); p.hl(x, x + 10, y + 10, ST[1]); p.vl(x + 10, y, y + 10, ST[1]);
  p.f(x + 1, y + 1, 9, 9, R[6]);
  return { x: x + 1, y: y + 1, w: 9, h: 9 };
}

function seabedPlinth(p: Pen, x0: number, x1: number) {
  for (let x = x0; x <= x1; x++) { p.set(x, GY - 1, x % 5 === 0 ? SB[0] : SB[2]); p.set(x, GY, SB[0]); }
}

const SS = BR.stoneR;
/** Glass dome: pale rim, see-through body, highlight arc, optional interior drawn by the caller first. */
function glassDome(p: Pen, cx: number, base: number, r: number) {
  for (let dy = -r; dy <= 0; dy++) for (let dx = -r; dx <= r; dx++) {
    const d = Math.hypot(dx, dy * 1.05);
    if (d > r) continue;
    const edge = d > r - 1.2;
    const cur = p.get(cx + dx, base + dy);
    p.set(cx + dx, base + dy, edge ? (dx < 0 ? FOAM0 : R[5]) : cur !== 255 && d < r - 2 ? cur : dx < -r / 3 && dy < -r / 3 ? R[6] : R[5]);
  }
  for (let a = 200; a < 255; a += 5) { const t = (a * Math.PI) / 180; p.set(Math.round(cx + Math.cos(t) * (r - 2)), Math.round(base + Math.sin(t) * (r - 2)), FOAM); }
  p.hl(cx - r, cx + r, base, SS[2]);
}

/** reinforce · policy gradient — the DOME OF CHANCE: a sunken palace under a glass dome; inside, a golden die (a policy that rolls). */
function domePalace(): Sprite {
  const p = new Pen(LW, LH);
  // slim towers with small domes
  for (const x of [2, 28]) {
    for (let y = 16; y < 38; y++) { p.set(x, y, SS[4]); p.set(x + 1, y, SS[3]); p.set(x + 2, y, SS[3]); p.set(x + 3, y, SS[2]); p.set(x + 4, y, SS[1]); }
    p.blob(x + 2, 15, 3, 2, R[6], R[5], R[4], FOAM); p.set(x + 2, 11, GD[3]); p.set(x + 2, 12, GD[2]);
    p.f(x + 1, 22, 2, 3, R[2]);
  }
  // palace body
  for (let y = 22; y < 38; y++) for (let x = 7; x < 29; x++) p.set(x, y, x === 7 ? SS[5] : x > 26 ? SS[2] : y % 4 === 3 && (x + y) % 5 === 0 ? SS[2] : SS[3]);
  for (const x of [10, 15, 21, 25]) { p.f(x, 26, 2, 5, R[1]); p.set(x, 26, R[3]); }
  p.hl(6, 29, 22, SS[5]); p.hl(6, 29, 21, SS[4]);
  // the die inside the dome, then the glass over it
  p.art(15, 12, [".tt..", "tFFS.", "FrFS.", "FFrS.", ".ss.."], { t: GD[4], F: GD[3], S: GD[2], s: GD[1], r: C("roof", 1) });
  glassDome(p, 18, 21, 11);
  // front stair descending left, coral at its foot
  for (let k = 0; k < 6; k++) p.hl(4 + k * 2 - 4, 12 + k * 2 - 4, 38 + k, k % 2 ? SS[3] : SS[4]);
  const slot = tablet(p, 19, 29);
  seabedPlinth(p, 1, 34);
  p.art(28, 37, [".t.t.", "t.t.t", ".ttt.", "..d.."], { t: CO[3], d: CO[1] });
  return p.done2({ x: CX, y: GY }, { slot, keep: new Set([...REEF_KEEP, R[6], R[5]]), shadow: [CX, GY - 1, 17, 2] });
}

/** rl_maze · value-based RL — the SUNKEN LABYRINTH: temple walls laid out as a maze, a gold value trail to the domed goal shrine. */
function sunkenMaze(): Sprite {
  const p = new Pen(LW, LH);
  const maze = [
    "###############.",
    "#.....#.......#.",
    "#.###.#.#####.#.",
    "#.#...#.#...#.#.",
    "#.#.###.#.#.#.#.",
    "#.#.....#.#...#.",
    "#.#######.#####.",
    "#.........#.....",
    "###########.....",
  ];
  const ox = 2, oy = 18, cw = 2, ch = 2;
  // floor
  for (let y = oy; y < oy + maze.length * ch + 3; y++) for (let x = ox; x < ox + 32; x++) p.set(x, y, SB[1]);
  // walls: 3/4 = lit top + 2-px face below
  maze.forEach((row, r) => { for (let c = 0; c < row.length; c++) if (row[c] === "#") {
    const x = ox + c * cw, y = oy + r * ch;
    p.f(x, y - 1, cw, ch, SS[4]); p.hl(x, x + cw - 1, y - 1, SS[5]); p.f(x, y + 1, cw, 1, SS[2]);
  } });
  // value trail
  for (const [c, r] of [[1, 7], [3, 7], [5, 7], [7, 7], [9, 7], [9, 5], [9, 3], [11, 3], [13, 1]] as const) p.set(ox + c * cw, oy + r * ch, GD[4]);
  // goal shrine (right), a small glass dome on a plinth
  for (let y = 28; y < 36; y++) for (let x = 24; x < 34; x++) p.set(x, y, x === 24 ? SS[5] : x > 32 ? SS[2] : SS[3]);
  p.set(29, 23, GD[3]); p.set(29, 24, GD[4]);
  glassDome(p, 29, 28, 5);
  for (const [x, y] of [[4, 12], [20, 10], [33, 14]] as const) { p.vl(x, y, y + 5, KP[2]); p.set(x + 1, y + 1, KP[3]); p.set(x - 1, y + 3, KP[3]); }
  const slot = tablet(p, 4, 30);
  seabedPlinth(p, 1, 34);
  return p.done2({ x: CX, y: GY }, { slot, keep: new Set([...REEF_KEEP, R[6], R[5]]), shadow: [CX, GY - 1, 17, 2] });
}

/** Jellyfish: translucent bell, frilled rim, trailing tentacles. */
function jellyfish(hue: "lav" | "gold" = "lav"): Sprite {
  const p = new Pen(9, 15);
  const [a, b, c] = hue === "lav" ? [MG[2], MG[1], MG[0]] : [GD[4], GD[3], GD[2]];
  p.blob(4, 4, 3.5, 3, FOAM0, a, b);
  p.hl(1, 7, 6, b); for (let x = 1; x <= 7; x += 2) p.set(x, 7, a);
  for (const [x, ph] of [[2, 0], [4, 1], [6, 2]] as const) for (let y = 8; y < 14; y++) p.set(x + Math.round(Math.sin((y + ph) * 0.9) * 0.8), y, y > 11 ? c : b);
  return p.done2({ x: 4, y: 14 }, { rim: false, outline: false, keep: REEF_KEEP });
}

/** Small glass-domed dwelling for the sunken city. 16×14. */
function domeHut(): Sprite {
  const p = new Pen(16, 14);
  for (let y = 8; y < 13; y++) for (let x = 2; x < 14; x++) p.set(x, y, x === 2 ? SS[5] : x > 12 ? SS[2] : SS[3]);
  p.f(7, 10, 2, 3, R[1]);
  glassDome(p, 8, 8, 6);
  p.hl(1, 14, 13, SB[0]);
  return p.done2({ x: 8, y: 13 }, { keep: new Set([...REEF_KEEP, R[6], R[5]]), shadow: [8, 13, 7, 1] });
}

// ——————————————————————————— derived marker (20×28, 7×7) ———————————————————————————

/** Giant clam with a pearl; the emblem sits on the nacre of the raised upper shell. */
export function reefMarker(state: EvidenceState, emblem?: EmblemMaskLike): Sprite {
  const p = new Pen(20, 28);
  const dim = state === "untrained";
  const shell = dim ? [ST[0], ST[1], ST[2]] : [MG[0], MG[1], MG[2]];
  // raised upper shell: a fluted fan (semicircle) hinged at the back, a nacre face inside
  const cx = 10, hy = 15;
  if (state !== "untrained") {
    for (let dy = -10; dy <= 0; dy++) for (let dx = -9; dx <= 9; dx++) {
      const d = Math.hypot(dx, dy * 1.05);
      if (d > 9.5) continue;
      const rib = Math.round((Math.atan2(dy, dx) * 180) / Math.PI / 18) % 2 === 0;
      p.set(cx + dx, hy + dy, d > 8.3 ? shell[0] : rib ? shell[2] : shell[1]);
    }
    p.f(6, 6, 9, 8, shell[0]); p.f(7, 7, 7, 7, dim ? ST[1] : R[6]);
  }
  // lower shell: a shallow fluted bowl
  for (let y = 16; y < 24; y++) {
    const half = Math.round(9.5 * Math.cos(((y - 16) / 8) * Math.PI * 0.46));
    for (let dx = -half; dx <= half; dx++) p.set(cx + dx, y, (dx + 21) % 3 === 0 ? shell[0] : dx < 0 ? shell[2] : shell[1]);
  }
  p.hl(1, 19, 16, shell[2]);
  // pearl
  const pearl = state === "champion" ? [GD[2], GD[3], GD[4]] : dim ? [ST[1], ST[2], ST[3]] : [R[5], R[6], FOAM];
  p.blob(10, 16, 2, 2, pearl[2], pearl[1], pearl[0], state === "untrained" ? undefined : FOAM);
  const slot = { x: 7, y: 7, w: 7, h: 7 };
  if (emblem && state !== "provisional" && !dim) stampInto(p, slot, emblem, shell[0], undefined);
  if (state === "provisional") p.art(8, 8, [".###.", "....#", "..##.", ".....", "..#.."], { "#": shell[0] });
  if (state === "champion") for (const [x, y] of [[2, 3], [18, 6], [16, 1]] as const) { p.set(x, y, FOAM); p.set(x - 1, y, GD[4]); p.set(x + 1, y, GD[4]); p.set(x, y - 1, GD[4]); p.set(x, y + 1, GD[4]); }
  if (state === "trained") { p.set(3, 8, FOAM); p.set(2, 5, R[6]); p.set(4, 2, R[6]); }   // rising bubbles
  p.hl(2, 18, 24, SB[0]); p.hl(3, 17, 25, SB[1]);
  return p.done2({ x: 10, y: 26 }, { slot, keep: REEF_KEEP, shadow: [10, 26, 8, 2] });
}

// ——————————————————————————— catalogue ———————————————————————————
const memo = new Map<string, Sprite>();
const once = (k: string, f: () => Sprite) => { let s = memo.get(k); if (!s) { s = f(); memo.set(k, s); } return s; };

export const REEF_LANDMARKS: Record<string, { make: () => Sprite; note: string }> = {
  reinforce: { make: domePalace, note: "Dome of Chance — a sunken palace under a glass dome; inside, a golden die (a policy that rolls)" },
  rl_maze: { make: sunkenMaze, note: "Sunken Labyrinth — temple walls laid out as a maze, a gold value trail to the domed goal shrine" },
};

export function reefSprites() {
  return {
    staghorn: once("r:stag", () => branching("red")), staghornV: once("r:stagv", () => branching("violet")),
    fan: once("r:fan", fan), brain: once("r:brain", brain), tubes: once("r:tubes", tubes),
    kelp: once("r:kelp0", () => kelp(0)), kelpS: once("r:kelp1", () => kelp(1)),
    bubbles: once("r:bub", bubbles), schoolG: once("r:sg", () => school("gold")), schoolS: once("r:ss", () => school("silver")),
    turtle: once("r:turtle", turtle), ruin: once("r:ruin", ruin),
    jelly: once("r:jelly", () => jellyfish("lav")), jellyG: once("r:jellyG", () => jellyfish("gold")), domeHut: once("r:dome", domeHut),
  };
}

export function reefStamps(): BiomeStamp[] {
  const s = reefSprites();
  return [
    stampOf("staghorn coral", "reef", s.staghorn, "branching, coral-red, lit tips"),
    stampOf("staghorn · violet", "reef", s.staghornV, "branching, violet"),
    stampOf("sea fan", "reef", s.fan, "gorgonian lattice on a stem"),
    stampOf("brain coral", "reef", s.brain, "ochre dome, meandering grooves"),
    stampOf("tube sponges", "reef", s.tubes, "gold tubes, dark mouths"),
    stampOf("kelp", "reef", s.kelp, "three wavy strands, lit blades"),
    stampOf("kelp · short", "reef", s.kelpS, "two strands"),
    stampOf("sunken ruin", "reef", s.ruin, "column stumps, fallen pediment, weed"),
    stampOf("bubbles", "fauna", s.bubbles, "rising, no outline"),
    stampOf("fish school · gold", "fauna", s.schoolG, "seven fish on a curve"),
    stampOf("fish school · silver", "fauna", s.schoolS, "silver school"),
    stampOf("sea turtle", "fauna", s.turtle, "one per reef, near the ruin"),
    stampOf("jellyfish", "fauna", s.jelly, "translucent bell, trailing tentacles"),
    stampOf("jellyfish · gold", "fauna", s.jellyG, "gold variant"),
    stampOf("glass-dome hut", "reef", s.domeHut, "sunken-city dwelling"),
  ];
}

export const reefLandmark = (atom: string): Sprite | undefined => {
  const e = REEF_LANDMARKS[atom];
  return e ? once(`r:lm:${atom}`, e.make) : undefined;
};

/** Coral cluster: a deliberate group (fan behind, brain + staghorn + tubes in front). */
export function coralCluster(L: Layout, x: number, y: number, k: number) {
  const s = reefSprites();
  const sets = [[s.fan, s.staghorn, s.brain], [s.tubes, s.staghornV, s.brain], [s.fan, s.tubes, s.staghorn]];
  const set = sets[k % sets.length];
  L.put(set[0], x, y - 3, { pad: 0 }); L.put(set[1], x - 7, y + 2, { pad: 0 }); L.put(set[2], x + 7, y + 3, { pad: 0 });
}
