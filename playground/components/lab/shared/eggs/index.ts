// Easter eggs that teach (spec R2-C / R2-E) — headless. See README.md.
export { KONAMI, advanceKonami, konamiMatches, forwardPassOrder, forwardPassSchedule } from "./konami";
export {
  GROKKING_EGG, NEXT_ERA, NEXT_ERA_COPY, RUINS, DOUBLE_DESCENT_EGG, dipDepth,
  type NextEraModel, type Ruin,
} from "./data";
export { liveTrainingModels, stationCounts } from "./trains";
export {
  useKonami, useLongFocus, useCritterClicks, useRealLossCurve, useLiveTraining,
} from "./use-eggs";
export type { RealLossCurve } from "../lesson/curve";
