// AtomLandmark — one distinct stand-up paper landmark per atom, each a
// readable metaphor for the mechanism the atom introduces (defs in
// landmarks-a.tsx / landmarks-b.tsx), with the glossy emblem plaque carrying
// iconFor(name) and the evidence state:
//   champion    gold star seal on the plaque
//   trained     glossy blue plaque
//   untrained   hollow paper plaque, blue emblem
//   provisional the whole landmark as an unfinished pencil sketch
// Base-centre (x, y), `size` px tall. Unknown names fall back to AtomSpot.
import { memo } from "react";
import { ATOMS } from "@/lib/blueprint";
import { Art, StandUp } from "./materials";
import { familyRamp, P } from "./palette";
import { AtomSpot, type SpotState } from "./spots";
import { Plaque } from "./landmark-kit";
import { LANDMARKS_A, type LandmarkDef } from "./landmarks-a";
import { LANDMARKS_B } from "./landmarks-b";

export type { LandmarkDef };
export const LANDMARKS: Record<string, LandmarkDef> = { ...LANDMARKS_A, ...LANDMARKS_B };

export interface AtomLandmarkProps {
  name: string;
  state: SpotState;
  /** rendered height in px (defaults to the landmark's design height) */
  size?: number;
  x?: number;
  y?: number;
}

export const AtomLandmark = memo(function AtomLandmark({ name, state, size, x = 0, y = 0 }: AtomLandmarkProps) {
  const def = LANDMARKS[name];
  if (!def) return <AtomSpot name={name} state={state} x={x} y={y - (size ?? 90) * 0.3} r={(size ?? 90) / 3.2} />;
  const fam = familyRamp(ATOMS[name]?.family ?? "");
  const [px, py, ps] = def.plaque;
  const foot = def.W * 0.42;
  return (
    <Art x={x} y={y} size={size} design={def.H}>
      {state === "provisional" ? (
        <g>
          {/* pencil sketch: blank card, a ghost of the drawing, hatching, dashed outline */}
          {def.sil.map((d, i) => <path key={i} d={d} fill={P.die} stroke={P.die} strokeWidth={4} strokeLinejoin="round" />)}
          <g opacity={0.16}>{def.body(fam)}</g>
          <path d={def.sil.join("")} fill="url(#pa-hatch)" opacity={0.6} />
          {def.sil.map((d, i) => <path key={`o${i}`} d={d} fill="none" stroke={P.pencil} strokeWidth={1.1} strokeDasharray="4 2.4" strokeLinejoin="round" />)}
          <g transform="translate(1.2 -0.8)" opacity={0.35}>
            {def.sil.map((d, i) => <path key={`c${i}`} d={d} fill="none" stroke={P.pencil} strokeWidth={0.6} />)}
          </g>
        </g>
      ) : (
        <StandUp d={def.sil} foot={foot} rim={3} depth={3}>
          {def.body(fam)}
        </StandUp>
      )}
      <Plaque name={name} x={px} y={py} s={ps * 1.35} state={state} />
    </Art>
  );
});
