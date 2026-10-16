"use client";

// The one-eyed perceptron critter (geometry: components/lab/shared/critter.ts)
// as a stand-up paper cutout. Poses:
//   "idle"                         standing, blinking-ready, eye to the viewer
//   "walk0" … "walk3"              a 4-frame walk cycle (contact, pass, contact, pass)
//   "train"                        the easter-egg pose: headband, tiny arms, a dumbbell overhead
// Base-centre (between the feet) at (0, 0); `facing` -1 mirrors the body but
// keeps the key light top-left (the shading is re-drawn, not flipped).
import { memo, useEffect, useState } from "react";
import { CRITTER } from "@/components/lab/shared/critter";
import { Art, type ArtProps, ContactShadow, SoftShadow } from "./materials";
import { CAST, P, R, HI, LIT, MID, SHADE, DEEP } from "./palette";

export type CritterPose = "idle" | "walk0" | "walk1" | "walk2" | "walk3" | "train";
export const CRITTER_WALK: CritterPose[] = ["walk0", "walk1", "walk2", "walk3"];

// per pose: body bob (y), body lean (deg), foot x-offsets + lifts
const POSE: Record<CritterPose, { bob: number; lean: number; feet: [number, number, number, number] }> = {
  idle: { bob: 0, lean: 0, feet: [0, 0, 0, 0] },
  walk0: { bob: 1.5, lean: 3, feet: [-9, 0, 9, 0] },
  walk1: { bob: -5, lean: 1, feet: [2, -7, -2, 0] },
  walk2: { bob: 1.5, lean: 3, feet: [9, 0, -9, 0] },
  walk3: { bob: -5, lean: 1, feet: [-2, 0, 2, -7] },
  train: { bob: 2, lean: 0, feet: [-6, 0, 6, 0] },
};

const BASE_Y = 129;   // feet bottom in the 120×140 critter box

export const CritterArt = memo(function CritterArt({ pose = "idle", facing = 1, ...p }: ArtProps & { pose?: CritterPose; facing?: 1 | -1 }) {
  const ps = POSE[pose];
  const [f0x, f0y, f1x, f1y] = ps.feet;
  const feet = CRITTER.feet.map((f, i) => ({ cx: f.cx + (i ? f1x : f0x), cy: f.cy + (i ? f1y : f0y) }));
  const body = CRITTER.body;
  const train = pose === "train";
  // body group: bob + lean about the feet
  const bodyT = `translate(0 ${ps.bob}) rotate(${ps.lean * facing} 60 118)`;
  const sil = (
    <>
      <path d={body} transform={bodyT} />
      <path d={CRITTER.antenna} transform={bodyT} fill="none" />
      <circle {...CRITTER.antennaTip} transform={bodyT} />
      {feet.map((f, i) => <ellipse key={i} cx={f.cx} cy={f.cy} rx={12} ry={7.5} />)}
    </>
  );
  return (
    <Art design={130} {...p}>
      <ContactShadow rx={30} ry={6} />
      {/* cast shadow: the silhouette laid down-right on the ground */}
      <g transform={`${CAST} translate(-60 ${-BASE_Y})`}>
        <SoftShadow d={[body, `M${feet[0].cx - 12} ${feet[0].cy}a12 7.5 0 1 0 24 0a12 7.5 0 1 0 -24 0Z`]} spread={4} opacity={0.8} />
      </g>
      <g transform={`scale(${facing} 1) translate(-60 ${-BASE_Y})`}>
        {/* side thickness, then the die-cut rim */}
        <g transform="translate(3 4)" fill={P.dieShade} stroke={P.dieShade} strokeWidth={11} strokeLinecap="round" strokeLinejoin="round">{sil}</g>
        <g fill={P.die} stroke="url(#pa-rim)" strokeWidth={11} strokeLinecap="round" strokeLinejoin="round">{sil}</g>
        {/* feet */}
        {feet.map((f, i) => (
          <g key={i}>
            <ellipse cx={f.cx} cy={f.cy} rx={11} ry={7} fill={R.wood[DEEP]} />
            <ellipse cx={f.cx - 2} cy={f.cy - 2} rx={7} ry={3.6} fill={R.wood[MID]} />
          </g>
        ))}
        <g transform={bodyT}>
          {/* antenna + Σ tip */}
          <path d={CRITTER.antenna} fill="none" stroke={P.ink} strokeWidth={5} strokeLinecap="round" />
          <circle {...CRITTER.antennaTip} fill={R.red[MID]} />
          <path d="M55 5 a8 8 0 0 1 12 -2" fill="none" stroke={R.red[HI]} strokeWidth={2.4} strokeLinecap="round" />
          <circle cx={65} cy={14} r={5} fill={R.red[SHADE]} opacity={0.5} />
          <path d="M65.4 7.4 H58.6 L62.4 11 L58.6 14.6 H65.4" fill="none" stroke="#FFFFFF" strokeWidth={1.7} strokeLinejoin="round" strokeLinecap="round" />
          {/* body: yellow paper, a shaded right crescent, a lit left cheek of light */}
          <path d={body} fill={R.gold[LIT]} />
          <path d="M60 28 C89 26 103 50 101 78 C99 104 83 118 60 118 C80 110 92 96 92 76 C92 54 82 36 60 28Z" fill={R.gold[MID]} />
          <path d="M84 96 C78 108 70 114 60 118 C80 116 94 106 99 88 C95 92 90 95 84 96Z" fill={R.gold[SHADE]} />
          <path d="M34 52 C38 40 48 34 58 33 C48 38 40 46 37 58Z" fill={R.gold[HI]} />
          <circle cx={40} cy={48} r={4} fill="#FFFFFF" opacity={0.85} />
          <path d={body} fill="url(#pa-fibre)" />
          {/* eye */}
          <circle cx={CRITTER.eye.cx} cy={CRITTER.eye.cy + 1.5} r={CRITTER.eye.r + 2} fill={R.gold[SHADE]} opacity={0.55} />
          <circle {...CRITTER.eye} fill="#FFFFFF" />
          <path d={`M${CRITTER.eye.cx - 13} ${CRITTER.eye.cy + 8} A16 16 0 0 0 ${CRITTER.eye.cx + 12} ${CRITTER.eye.cy + 10}`} fill="none" stroke={R.snow[SHADE]} strokeWidth={3} />
          <circle cx={CRITTER.pupil.cx + (pose.startsWith("walk") ? 2 : 0)} cy={CRITTER.pupil.cy} r={CRITTER.pupil.r + 2.4} fill={R.teal[MID]} />
          <circle cx={CRITTER.pupil.cx + (pose.startsWith("walk") ? 2 : 0)} cy={CRITTER.pupil.cy} r={CRITTER.pupil.r - 1} fill={P.ink} />
          <circle cx={CRITTER.pupil.cx - 2.5} cy={CRITTER.pupil.cy - 4} r={2.4} fill="#FFFFFF" />
          <circle {...CRITTER.eye} fill="none" stroke={P.ink} strokeWidth={3.4} />
          {/* cheeks + smile */}
          <ellipse cx={38} cy={92} rx={6} ry={3.6} fill={R.pink[LIT]} opacity={0.75} />
          <ellipse cx={82} cy={92} rx={6} ry={3.6} fill={R.pink[MID]} opacity={0.6} />
          <path d={train ? "M52 97 Q60 104 68 97 Q60 100 52 97Z" : CRITTER.smile} fill={train ? P.ink : "none"} stroke={P.ink} strokeWidth={4.4} strokeLinecap="round" strokeLinejoin="round" />
          {train && <TrainGear />}
        </g>
      </g>
    </Art>
  );
});

/** Headband, tiny arms up, a dumbbell overhead, a sweat drop. */
function TrainGear() {
  return (
    <g>
      <path d="M22 52 Q60 36 98 52 L99 60 Q60 44 21 60Z" fill={R.red[MID]} stroke={P.die} strokeWidth={2} />
      <path d="M22 52 Q60 36 98 52 L98 55 Q60 40 22 55Z" fill={R.red[HI]} opacity={0.7} />
      <path d="M98 56 L110 50 L108 62Z" fill={R.red[SHADE]} />
      {/* arms */}
      <path d="M24 74 Q12 58 22 34 M96 74 Q108 58 98 34" fill="none" stroke={P.die} strokeWidth={9} strokeLinecap="round" />
      <path d="M24 74 Q12 58 22 34 M96 74 Q108 58 98 34" fill="none" stroke={R.gold[SHADE]} strokeWidth={5} strokeLinecap="round" />
      {/* dumbbell */}
      <path d="M16 30 H104" stroke={P.die} strokeWidth={8} strokeLinecap="round" />
      <path d="M16 30 H104" stroke={R.rock[SHADE]} strokeWidth={4} strokeLinecap="round" />
      {[[8, 30], [112, 30]].map(([x, y], i) => (
        <g key={i}>
          <rect x={x - 7} y={y - 13} width={14} height={26} rx={4} fill={P.die} />
          <rect x={x - 5} y={y - 11} width={10} height={22} rx={3} fill={R.blue[MID]} />
          <rect x={x - 5} y={y - 11} width={4} height={22} rx={2} fill={R.blue[LIT]} />
        </g>
      ))}
      <path d="M104 70 Q100 76 104 80 Q108 76 104 70Z" fill="#9FD8FF" stroke={P.die} strokeWidth={1.4} />
    </g>
  );
}


/** The walk cycle playing in place (8 poses/s); frozen on "idle" when `still`. */
export function CritterWalk({ still = false, fps = 8, ...p }: ArtProps & { still?: boolean; fps?: number; facing?: 1 | -1 }) {
  const [k, setK] = useState(0);
  useEffect(() => {
    if (still) return;
    const id = window.setInterval(() => setK((v) => (v + 1) % CRITTER_WALK.length), 1000 / fps);
    return () => window.clearInterval(id);
  }, [still, fps]);
  return <CritterArt {...p} pose={still ? "idle" : CRITTER_WALK[k]} />;
}
