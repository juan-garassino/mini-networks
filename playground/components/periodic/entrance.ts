// The table's one entrance. Readiness and stillness are the shared lab contract
// (lib/lab-contract.ts):
//   - still (?still=1 or prefers-reduced-motion): NO entrance at all, every tile drawn final;
//   - otherwise tiles fade in row by row, then the f-block (the skin's motion tokens);
//   - data-lab-ready waits entranceEnd() seconds, then for the sheet and all its
//     ancestors to be opaque (the page's own sheet transition included).
import type { PeriodicSkin } from "./skins";

/** Seconds until the last tile of the entrance has landed. */
export function entranceEnd(m: PeriodicSkin["motion"], maxRow: number, maxCol: number, reactions: number): number {
  const table = (maxRow - 1) * m.rowStagger + maxCol * m.colStagger + m.enter;
  const fblock = m.reactionStart + Math.max(0, reactions - 1) * m.reactionStagger + m.enter;
  return Math.max(table, fblock);
}
