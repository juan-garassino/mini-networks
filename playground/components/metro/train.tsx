// One train per line, riding its longest drafted path outward from the origin.
// Live: SMIL along the path, fading in and out at the ends. Still (?still=1) or
// prefers-reduced-motion: parked mid-leg at MOTION.trainStillT, never on a tick.
import { TrainBody } from "./marks";
import { MOTION } from "./tokens";
import { trainPose, type MapLine, type Pt } from "./system";

export function Train({ line, live, stops }: { line: MapLine; live: boolean; stops: Pt[] }) {
  const path = line.paths[line.trainPath];
  if (!path || path.auto) return null;
  if (!live) {
    const p = trainPose(path, MOTION.trainStillT, stops);
    return <g className="metro-train"><TrainBody x={p.x} y={p.y} angle={(p.angle * 180) / Math.PI} color={line.color} /></g>;
  }
  const dur = Math.max(MOTION.trainMinDur, path.length / MOTION.trainSpeed);
  return (
    <g className="metro-train" opacity={0}>
      <TrainBody x={0} y={0} angle={0} color={line.color} />
      <animateMotion dur={`${dur}s`} repeatCount="indefinite" rotate="auto" path={path.d} />
      <animate attributeName="opacity" dur={`${dur}s`} repeatCount="indefinite" values={MOTION.trainFade.values} keyTimes={MOTION.trainFade.keyTimes} />
    </g>
  );
}
