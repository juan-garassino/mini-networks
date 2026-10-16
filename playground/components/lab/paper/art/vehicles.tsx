// Things that move: boats (compositions), the paper train (live training),
// and the bridges roads cross on. Base-centre at (0, 0) (a boat's waterline).
//
//   PaperBoat     a little sailboat: planked hull, stitched mainsail + jib, pennant — never a triangle
//   SteamBoat     a paddle steamer with a funnel and its trail of white smoke dots
//   SmokeTrail    the dotted puff trail on its own (drifts up-left, downwind)
//   PaperTrain    engine + goods car + coach on a short track
//   PlankBridge   a flat plank deck with posts and rails (orient h | v)
//   RopeBridge    a sagging plank bridge on rope rails
//   Pier          a harbour jetty: plank deck on posts, bollards, a lamp, crates (origin = shore end)
import { memo } from "react";
import { Art, type ArtProps, Cutout, Glint, LitEdge, SoftShadow, StandUp, Stitch } from "./materials";
import { P, R, HI, LIT, MID, SHADE, DEEP, type Ramp } from "./palette";
import { ell, poly, rect, rrect } from "./geom";

/** Wake + reflection under anything floating (lies flat on the sea). */
function Wake({ w }: { w: number }) {
  return (
    <g pointerEvents="none">
      <path d={ell(w * 0.08, 1, w * 0.62, w * 0.1)} fill="#0E3C8C" opacity={0.28} />
      <path d={`M${-w * 0.7} 2 Q${-w * 0.3} ${-2} 0 2 Q${w * 0.3} 5 ${w * 0.62} 1`} fill="none" stroke="#FFFFFF" strokeWidth={w * 0.05} strokeLinecap="round" />
      <path d={`M${-w * 0.92} 4 Q${-w * 0.8} 2 ${-w * 0.68} 5 M${-w * 1.05} 1 Q${-w * 0.96} -1 ${-w * 0.86} 1`} fill="none" stroke="#FFFFFF" strokeOpacity={0.8} strokeWidth={w * 0.04} strokeLinecap="round" />
    </g>
  );
}

export const PaperBoat = memo(function PaperBoat({ sail = R.cream, hull = R.red, flag = R.gold, ...p }: ArtProps & { sail?: Ramp; hull?: Ramp; flag?: Ramp }) {
  const hullD = "M-27 -13 L27 -15 Q24 -3 15 0 L-16 0 Q-25 -4 -27 -13Z";
  const main = "M0 -54 Q15 -40 18 -18 L0 -18Z";
  const jib = "M-3 -49 L-3 -18 L-22 -18 Q-13 -31 -3 -49Z";
  const mast = rect(-1.6, -56, 3.2, 44);
  return (
    <Art design={60} {...p}>
      <Wake w={30} />
      <Cutout d={[hullD, main, jib, mast]} rim={2} depth={1.6} shadow="drop" lift={0.5}>
        {/* hull: lit topside band, a white stripe, darker planked bottom */}
        <path d={hullD} fill={hull[MID]} />
        <path d="M-27 -13 L27 -15 L26.3 -11 L-25.8 -9Z" fill={hull[LIT]} />
        <path d="M-25.4 -8 L26 -10 L25.6 -8.4 L-24.8 -6.4Z" fill="#FFFFFF" />
        <path d="M-22 -3 L22 -3" stroke={hull[DEEP]} strokeOpacity={0.5} strokeWidth={0.8} />
        <path d="M14 -14 L27 -15 Q24 -3 15 0 L10 0Z" fill={hull[SHADE]} opacity={0.8} />
        <circle cx={-12} cy={-4.8} r={1.6} fill={R.gold[LIT]} />
        <circle cx={-4} cy={-5} r={1.6} fill={R.gold[LIT]} />
        <circle cx={4} cy={-5.2} r={1.6} fill={R.gold[LIT]} />
        {/* mast */}
        <path d={mast} fill={R.wood[MID]} />
        <path d={rect(-1.6, -56, 1.2, 44)} fill={R.wood[LIT]} />
        {/* mainsail: billowing, shade on the leech, seams stitched */}
        <path d={main} fill={sail[HI]} />
        <path d="M6 -46 Q15 -36 18 -18 L10 -18 Q10 -34 6 -46Z" fill={sail[MID]} />
        <Stitch d="M1 -44 Q8 -38 12 -30 M1 -34 Q8 -30 15 -24" color={sail[SHADE]} w={0.6} opacity={0.9} />
        <path d="M0 -18 H18" stroke={sail[SHADE]} strokeWidth={1} />
        {/* jib */}
        <path d={jib} fill="#FFFFFF" />
        <path d="M-3 -49 L-3 -18 L-8 -18 Q-6 -34 -3 -49Z" fill={sail[LIT]} />
        <path d="M-3 -49 L-20 -19" stroke={sail[MID]} strokeWidth={0.7} />
      </Cutout>
      <path d="M0 -56 L0 -62" stroke={R.wood[DEEP]} strokeWidth={1.2} />
      <path d="M0 -62 L9 -59.5 L0 -57Z" fill={flag[LIT]} stroke={P.die} strokeWidth={0.8} strokeLinejoin="round" />
    </Art>
  );
});

/** White smoke-puff dots trailing up-left from (x, y), shrinking. */
export function SmokeTrail({ x = 0, y = 0, n = 6, step = 9, r = 4.6, rise = 0.55 }: { x?: number; y?: number; n?: number; step?: number; r?: number; rise?: number }) {
  return (
    <g pointerEvents="none">
      {Array.from({ length: n }, (_, i) => {
        const cx = x - i * step, cy = y - i * step * rise - Math.sin(i * 1.3) * 2;
        const rr = r * (1 - i * 0.11);
        return (
          <g key={i}>
            <circle cx={cx + rr * 0.3} cy={cy + rr * 0.45} r={rr} fill={P.shadow} opacity={0.12} />
            <circle cx={cx} cy={cy} r={rr} fill="#FFFFFF" />
            <circle cx={cx + rr * 0.22} cy={cy + rr * 0.2} r={rr * 0.72} fill={R.snow[MID]} />
            <circle cx={cx - rr * 0.1} cy={cy - rr * 0.12} r={rr * 0.62} fill="#FFFFFF" />
          </g>
        );
      })}
    </g>
  );
}

export const SteamBoat = memo(function SteamBoat({ trail = true, ...p }: ArtProps & { trail?: boolean }) {
  const hullD = "M-40 -14 L40 -16 Q36 -3 26 0 L-30 0 Q-38 -5 -40 -14Z";
  const cabin = rect(-26, -30, 40, 15);
  const house = rect(-16, -42, 20, 12);
  const funnel = "M10 -30 L12 -58 L22 -58 L22 -30Z";
  const wheel = "M-15 -12 A13 13 0 0 1 11 -12Z";
  return (
    <Art design={64} {...p}>
      <Wake w={44} />
      {trail && <SmokeTrail x={10} y={-66} n={7} step={9} r={5} rise={0.4} />}
      <Cutout d={[hullD, cabin, house, funnel, wheel, rect(-30, -32, 48, 3)]} rim={2.2} depth={1.8} shadow="drop" lift={0.5}>
        <path d={hullD} fill={R.red[MID]} />
        <path d="M-40 -14 L40 -16 L39 -12 L-39 -10Z" fill="#FFFFFF" />
        <path d="M-38.6 -9.4 L38.8 -11.4 L38.4 -9.4 L-38 -7.6Z" fill={R.blue[MID]} />
        <path d="M24 -15 L40 -16 Q36 -3 26 0 L18 0Z" fill={R.red[SHADE]} />
        <LitEdge d="M-39 -15 L39 -17" w={1} />
        {/* cabin deck with portholes */}
        <path d={cabin} fill={R.cream[HI]} />
        <path d={rect(4, -30, 10, 15)} fill={R.cream[SHADE]} />
        {[-20, -12, -4].map((cx) => <g key={cx}><circle cx={cx} cy={-22.5} r={2.6} fill={R.gold[MID]} /><circle cx={cx} cy={-22.5} r={1.7} fill={P.window} /></g>)}
        <path d={rect(-30, -32, 48, 3)} fill={R.teal[MID]} />
        <path d={rect(-30, -32, 48, 1.1)} fill={R.teal[HI]} />
        {/* paddle box: a half-drum on the hull side, sunburst slats */}
        <path d={wheel} fill={R.red[MID]} />
        <path d="M-15 -12 A13 13 0 0 1 -2 -25 L-2 -12Z" fill={R.red[LIT]} />
        <path d="M-10.5 -12 A8.5 8.5 0 0 1 6.5 -12Z" fill={R.cream[HI]} />
        <path d="M-2 -12 L-2 -20.5 M-2 -12 L-8 -18 M-2 -12 L4 -18 M-2 -12 L-10.5 -12 M-2 -12 L6.5 -12" stroke={R.red[SHADE]} strokeWidth={1.2} />
        <path d="M-15 -12 H11" stroke={R.red[DEEP]} strokeWidth={1.6} />
        <path d="M-14 -13.5 A12 12 0 0 1 -6 -23.4" fill="none" stroke={R.red[HI]} strokeWidth={1} strokeLinecap="round" />
        <circle cx={-2} cy={-12} r={1.8} fill={R.gold[LIT]} />
        {/* wheelhouse */}
        <path d={house} fill="#FFFFFF" />
        <path d={rect(-2, -42, 6, 12)} fill={R.cream[MID]} />
        <path d={rect(-13, -39, 8, 5)} fill={P.window} />
        <path d="M-12 -35 L-8 -39" stroke="#9FB6E8" strokeWidth={0.8} />
        <path d={rect(-18, -44, 24, 2.6)} fill={R.red[LIT]} />
        {/* funnel: red, a white band, black cap */}
        <path d={funnel} fill={R.red[LIT]} />
        <path d="M17 -30 L17 -58 L22 -58 L22 -30Z" fill={R.red[SHADE]} />
        <path d="M11.2 -46 L22 -46 L22 -42 L11 -42Z" fill="#FFFFFF" />
        <path d="M11.8 -58 L22.4 -58 L22.4 -54 L11.6 -54Z" fill={P.ink} />
        <path d="M-34 -32 V-40 M-34 -40 L-24 -36" stroke={R.wood[DEEP]} strokeWidth={0.9} />
      </Cutout>
      <path d="M-34 -40 L-26 -38 L-34 -36Z" fill={R.gold[LIT]} />
    </Art>
  );
});

// ── the paper train ────────────────────────────────────────────────────

function Wheel({ cx, cy, r, ramp = R.red }: { cx: number; cy: number; r: number; ramp?: Ramp }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r + 0.9} fill={P.die} />
      <circle cx={cx} cy={cy} r={r} fill={P.ink} />
      <circle cx={cx} cy={cy} r={r * 0.72} fill={ramp[MID]} />
      <path d={`M${cx - r * 0.7} ${cy}H${cx + r * 0.7}M${cx} ${cy - r * 0.7}V${cy + r * 0.7}`} stroke={ramp[DEEP]} strokeWidth={r * 0.18} />
      <circle cx={cx} cy={cy} r={r * 0.22} fill={R.gold[LIT]} />
      <path d={`M${cx - r * 0.6} ${cy - r * 0.35}A${r * 0.72} ${r * 0.72} 0 0 1 ${cx - r * 0.1} ${cy - r * 0.7}`} stroke={ramp[HI]} strokeWidth={r * 0.14} fill="none" strokeLinecap="round" />
    </g>
  );
}

export const PaperTrain = memo(function PaperTrain({ cargo = [R.violet, R.teal, R.gold], smoke = true, ...p }: ArtProps & { cargo?: Ramp[]; smoke?: boolean }) {
  // engine at the right (heading right), goods car, coach
  const boiler = "M22 -24 H44 Q50 -24 50 -17 Q50 -10 44 -10 H22Z";
  const cab = rect(8, -32, 15, 22);
  const cabRoof = rect(6, -35, 19, 4);
  const funnel = "M40 -24 L38 -34 H46 L44 -24Z";
  const catcher = poly(48, -10, 56, -4, 48, -4);
  const goods = rect(-26, -20, 30, 12);
  const coach = rect(-62, -26, 32, 18);
  const coachRoof = "M-64 -26 Q-46 -32 -28 -26Z";
  const crates = cargo.map((_, i) => rect(-24 + i * 9.6, -27, 8, 8));
  return (
    <Art design={40} {...p}>
      {/* track */}
      <path d="M-70 2 H62" stroke={R.wood[SHADE]} strokeWidth={2.4} />
      <path d={Array.from({ length: 14 }, (_, i) => `M${-68 + i * 9.6} 1 v3`).join("")} stroke={R.wood[DEEP]} strokeWidth={2.4} />
      <path d="M-70 0.4 H62" stroke={R.rock[LIT]} strokeWidth={1} />
      {smoke && <SmokeTrail x={40} y={-40} n={5} step={8} r={4.4} rise={0.45} />}
      <StandUp d={[boiler, cab, cabRoof, funnel, catcher, goods, coach, coachRoof, ...crates, rect(-66, -10, 120, 4)]} foot={60} rim={1.8} depth={1.6}>
        {/* coupling bar */}
        <path d="M-64 -8 H52" stroke={R.rock[DEEP]} strokeWidth={2} />
        {/* coach */}
        <path d={coach} fill={R.teal[LIT]} />
        <path d={rect(-38, -26, 8, 18)} fill={R.teal[SHADE]} />
        <path d={coachRoof} fill={R.red[MID]} />
        <path d="M-64 -26 Q-55 -29 -46 -30 L-46 -26Z" fill={R.red[LIT]} />
        {[-58, -50, -42].map((x) => <path key={x} d={rrect(x, -22, 6, 6, 1.2)} fill={P.windowLit} stroke={P.die} strokeWidth={0.8} />)}
        <path d="M-62 -12 H-30" stroke={R.teal[DEEP]} strokeWidth={1} />
        {/* goods car with cargo crates */}
        {crates.map((d, i) => (
          <g key={i}>
            <path d={d} fill={cargo[i][LIT]} />
            <path d={rect(-24 + i * 9.6 + 5.5, -27, 2.5, 8)} fill={cargo[i][SHADE]} />
            <path d={`M${-24 + i * 9.6} -23 h8`} stroke={cargo[i][DEEP]} strokeWidth={0.6} />
          </g>
        ))}
        <path d={goods} fill={R.wood[MID]} />
        <path d={goods} fill="url(#pa-planks)" />
        <path d={rect(-2, -20, 6, 12)} fill={R.wood[SHADE]} />
        {/* engine: cab, boiler with bands, dome, funnel, cow-catcher */}
        <path d={cab} fill={R.red[LIT]} />
        <path d={rect(18, -32, 5, 22)} fill={R.red[SHADE]} />
        <path d={rrect(11, -29, 7, 7, 1.4)} fill={P.windowLit} stroke={P.die} strokeWidth={0.8} />
        <path d={cabRoof} fill={P.ink} />
        <path d={boiler} fill={R.blue[MID]} />
        <path d="M22 -24 H44 Q50 -24 50 -20 H22Z" fill={R.blue[LIT]} />
        <path d="M22 -13 H44 Q49 -13 50 -15 Q50 -10 44 -10 H22Z" fill={R.blue[DEEP]} />
        <path d="M28 -24 V-10 M36 -24 V-10" stroke={R.gold[MID]} strokeWidth={1.6} />
        <path d="M28 -24 Q28 -29 31 -29 Q34 -29 34 -24Z" fill={R.gold[LIT]} />
        <path d={funnel} fill={P.ink} />
        <path d="M37 -36 H47 V-33 H37Z" fill={R.rock[DEEP]} />
        <circle cx={49.4} cy={-17} r={2.2} fill={P.windowLit} />
        <path d={catcher} fill={R.red[MID]} />
        <Glint x={30} y={-20} r={1.6} streak={false} />
        {/* wheels */}
        {[-56, -38, -20, -4, 14, 30, 42].map((cx, i) => <Wheel key={i} cx={cx} cy={-4.4} r={i >= 4 ? 4.6 : 3.8} />)}
        <path d="M14 -4.4 L42 -4.4" stroke={R.rock[LIT]} strokeWidth={1.4} strokeLinecap="round" />
      </StandUp>
    </Art>
  );
});

// ── bridges ────────────────────────────────────────────────────────────

/** A flat plank bridge; `span` = deck length in design units (default 80). */
export const PlankBridge = memo(function PlankBridge({ span = 80, orient = "h", ...p }: ArtProps & { span?: number; orient?: "h" | "v" }) {
  const L = span / 2;
  if (orient === "v") {
    const deck = rect(-9, -span, 18, span);
    const planks = Array.from({ length: Math.floor(span / 5) }, (_, i) => `M-9 ${-span + 2.5 + i * 5}H9`).join("");
    return (
      <Art design={span} {...p}>
        <SoftShadow d={deck} transform="translate(4 3)" spread={2} />
        <path d={rect(9, -span, 3, span)} fill={R.wood[DEEP]} />
        <path d={deck} fill={P.die} stroke={P.die} strokeWidth={3} />
        <path d={deck} fill={R.wood[LIT]} />
        <path d={planks} stroke={R.wood[SHADE]} strokeWidth={0.9} />
        <path d={`M-9 0 V${-span}`} stroke={R.wood[HI]} strokeWidth={1} />
        {[-span + 2, -span / 2, -2].map((y) => <g key={y}><rect x={-12} y={y - 2} width={3} height={5} rx={1} fill={R.wood[SHADE]} /><rect x={9} y={y - 2} width={3} height={5} rx={1} fill={R.wood[DEEP]} /></g>)}
      </Art>
    );
  }
  const deck = poly(-L, -4, L, -4, L, 4, -L, 4);
  const planks = Array.from({ length: Math.floor(span / 5) }, (_, i) => `M${-L + 2.5 + i * 5} -4V4`).join("");
  const posts = [-L + 2, 0, L - 2];
  return (
    <Art design={24} {...p}>
      <SoftShadow d={deck} transform="translate(3 4)" spread={2} />
      <path d={rect(-L, 4, span, 3)} fill={R.wood[DEEP]} />
      <path d={deck} fill={P.die} stroke={P.die} strokeWidth={3} />
      <path d={deck} fill={R.wood[LIT]} />
      <path d={planks} stroke={R.wood[SHADE]} strokeWidth={0.9} />
      <path d={`M${-L} -3.4 H${L}`} stroke={R.wood[HI]} strokeWidth={0.9} />
      {/* rails: far rail thin, near rail bold */}
      <path d={`M${-L} -12 H${L}`} stroke={R.wood[SHADE]} strokeWidth={1.4} />
      {posts.map((x) => <path key={x} d={`M${x} -4 V-13`} stroke={R.wood[SHADE]} strokeWidth={1.8} strokeLinecap="round" />)}
      {posts.map((x) => <path key={`n${x}`} d={`M${x} 4 V-6`} stroke={R.wood[MID]} strokeWidth={2.4} strokeLinecap="round" />)}
      <path d={`M${-L} -5 H${L}`} stroke={R.wood[MID]} strokeWidth={1.8} strokeLinecap="round" />
      <path d={`M${-L} -5.6 H${L}`} stroke={R.wood[HI]} strokeWidth={0.6} />
    </Art>
  );
});

/** A rope bridge whose plank deck sags between two posts. */
export const RopeBridge = memo(function RopeBridge({ span = 100, ...p }: ArtProps & { span?: number }) {
  const L = span / 2, sag = span * 0.12;
  const y = (x: number) => sag * (1 - (x / L) ** 2);
  const n = Math.floor(span / 6);
  const planks = Array.from({ length: n }, (_, i) => {
    const x = -L + 3 + i * (span - 6) / (n - 1);
    const yy = y(x);
    return rrect(x - 3, yy - 2.6, 6, 5.2, 0.8);
  });
  const rope = (off: number) => `M${-L} ${-14 + off} Q0 ${sag * 2 - 14 + off} ${L} ${-14 + off}`;
  return (
    <Art design={34} {...p}>
      <path d={`M${-L} 0 Q0 ${sag * 2} ${L} 0`} fill="none" stroke={P.shadow} strokeOpacity={0.14} strokeWidth={8} transform="translate(3 6)" />
      <path d={`M${-L} 0 Q0 ${sag * 2} ${L} 0`} fill="none" stroke={R.wood[DEEP]} strokeWidth={1.2} />
      {planks.map((d, i) => <path key={i} d={d} fill={i % 3 === 1 ? R.wood[MID] : R.wood[LIT]} stroke={R.wood[DEEP]} strokeWidth={0.6} />)}
      <path d={rope(0)} fill="none" stroke={R.sand[SHADE]} strokeWidth={1.4} />
      {planks.map((_, i) => {
        if (i % 2) return null;
        const x = -L + 3 + i * (span - 6) / (n - 1);
        const top = -14 + y(x);
        return <path key={`v${i}`} d={`M${x} ${y(x) - 3} L${x} ${top}`} stroke={R.sand[MID]} strokeWidth={0.7} />;
      })}
      {[-L, L].map((x) => (
        <g key={x}>
          <path d={`M${x} 4 V-18`} stroke={P.die} strokeWidth={5} strokeLinecap="round" />
          <path d={`M${x} 4 V-18`} stroke={R.wood[MID]} strokeWidth={3.2} strokeLinecap="round" />
          <path d={`M${x - 0.8} 3 V-17`} stroke={R.wood[HI]} strokeWidth={0.8} strokeLinecap="round" />
        </g>
      ))}
      <path d={rope(3)} fill="none" stroke={R.sand[MID]} strokeWidth={1.2} />
    </Art>
  );
});


/** A harbour pier running out to sea (to the right) from the shore at x = 0.
 *  Flat deck on posts with foam rings, bollards, a lamp post and two crates. */
export const Pier = memo(function Pier({ length = 110, ...p }: ArtProps & { length?: number }) {
  const L = length;
  const deck = `M0 -6 H${L - 22} V-14 H${L} V8 H${L - 22} V4 H0Z`;
  const planks = Array.from({ length: Math.floor(L / 5) }, (_, i) => `M${2.5 + i * 5} ${i * 5 > L - 22 ? -14 : -6}V${i * 5 > L - 22 ? 8 : 4}`).join("");
  const posts = [18, 46, L - 36, L - 18, L - 2];
  return (
    <Art design={40} {...p}>
      {posts.map((x) => (
        <g key={x}>
          <ellipse cx={x} cy={x > L - 23 ? 12 : 8} rx={5} ry={1.8} fill="#FFFFFF" opacity={0.75} />
          <rect x={x - 2} y={x > L - 23 ? 4 : 1} width={4} height={8} fill={R.wood[DEEP]} />
        </g>
      ))}
      <SoftShadow d={deck} transform="translate(3 5)" spread={2} />
      <path d={deck} fill={P.die} stroke={P.die} strokeWidth={3} strokeLinejoin="round" />
      <path d={`M0 4 H${L - 22} V8 H${L} V11 H${L - 22} V7 H0Z`} fill={R.wood[DEEP]} />
      <path d={deck} fill={R.wood[LIT]} />
      <path d={planks} stroke={R.wood[SHADE]} strokeWidth={0.8} />
      <path d={`M0 -5.4 H${L - 22} M${L - 22} -13.4 H${L}`} stroke={R.wood[HI]} strokeWidth={0.9} />
      {/* bollards */}
      {[L - 18, L - 4].map((x) => <g key={x}><rect x={x - 2} y={-18} width={4} height={6} rx={1.4} fill={R.basalt[MID]} /><rect x={x - 2} y={-18} width={1.6} height={6} rx={0.8} fill={R.basalt[HI]} /></g>)}
      {/* crates */}
      <StandUp d={[rect(L - 16, -12, 9, 8), rect(L - 12, -19, 8, 7)]} foot={6} rim={1.2} depth={1}>
        <path d={rect(L - 16, -12, 9, 8)} fill={R.wood[MID]} />
        <path d={rect(L - 12, -19, 8, 7)} fill={R.orange[LIT]} />
        <path d={`M${L - 16} -12 L${L - 7} -4 M${L - 7} -12 L${L - 16} -4`} stroke={R.wood[DEEP]} strokeWidth={0.7} />
        <path d={rect(L - 7.5, -12, 0.5, 8)} fill={R.wood[DEEP]} />
      </StandUp>
      {/* lamp post */}
      <StandUp d={[rect(L - 30, -36, 2.4, 34), rrect(L - 33, -44, 8.4, 9, 2)]} foot={3} rim={1.2} depth={1}>
        <path d={rect(L - 30, -36, 2.4, 34)} fill={P.ink} />
        <path d={rrect(L - 33, -44, 8.4, 9, 2)} fill={P.ink} />
        <path d={rrect(L - 31.6, -42.6, 5.6, 6, 1.4)} fill={P.windowLit} />
      </StandUp>
    </Art>
  );
});
