# Easter eggs that teach

Headless egg logic shared by every lab skin (spec R2-C / R2-E,
`docs/superpowers/specs/2026-09-28-playground-bakeoff-design.md`). This folder
owns **what** each egg is, **when** it triggers and **which data** it uses;
each skin draws the look in its own medium and lists the eggs it implements
in its `encoding.ts` "eggs" section, linking here.

Rules for every skin: discoverable without instructions, never in the way,
reachable by keyboard, and frozen under `still=1` (pass `null` / `false` to
the hooks so screenshots never change mid-shot).

| Egg | Trigger | Data | API |
|---|---|---|---|
| Grokking clicks late | hover **or** keyboard-focus the `grokking` spot for 4 s | copy + an *illustrative* curve shape from the grokking paper (labelled as such) | `useLongFocus(ref \| hoveredName, GROKKING_EGG.holdMs)`, `GROKKING_EGG` |
| Hidden "?" island | pan/scroll past the edge of the sea | the three next-era models (not in the taxonomy yet), each tied to the species it would grow from | `NEXT_ERA`, `NEXT_ERA_COPY` (`lib/world` `secretIsland()` places it) |
| Critter trains | click the critter 7 times (each within 2.5 s); Enter/Space counts as a click | a **real** clearly-decreasing loss series from `/web/runs` + `/web/runs/{id}/metrics` | `useCritterClicks(7)`, `useRealLossCurve(runs, unlocked)` + `<Sparkline progress>` |
| double_descent dips twice | select the `double_descent` composition (its ferry sails) | the route's vertical offset along its length: two dips, crest at the interpolation threshold | `DOUBLE_DESCENT_EGG`, `dipDepth(t)` |
| Konami forward pass | ↑ ↑ ↓ ↓ ← → ← → B A (keyboard; ignored inside inputs/textareas) | the zoo grouped by generation depth; each group lights up in turn and plays its anatomy | `useKonami(onUnlock)`, `forwardPassOrder(world \| taxonomy)`, `forwardPassSchedule(groups, 450)` |
| Ruins | the far islet | `legacy/` projects retired from the zoo, one-line epitaphs + their living successor | `RUINS` |
| Trains = training | automatic: any `running` run | models with a live run; run count per model for station boards | `useLiveTraining(runs)`, `stationCounts(runs)` |

## Details

**Grokking.** `models/grokking/model.py` (Power et al., arXiv 2201.02177): train
accuracy hits 100% within ~10³ steps while held-out accuracy sits at chance for
10–1000× longer, then jumps. The egg makes the learner wait: show
`GROKKING_EGG.before` while held, swap to `.after` (+ `.explain`) once
`useLongFocus` returns true. `GROKKING_EGG.sketch` is an illustration of the
paper's two curves — label it as such if you draw it; it is not a zoo run.

**Hidden island.** `NEXT_ERA` = VQ-VAE (from `vae`), flow matching (from
`diffusion`), gated PixelCNN (from `pixelcnn` — its model.py names the blind spot
Gated PixelCNN fixes). Draw silhouettes only (they have no pages, runs or
anatomy). "here be dragons" lives in `NEXT_ERA_COPY.warning`.

**Critter trains.** `useRealLossCurve` only fetches after unlock, at most once per
page session (shared cache with the lesson card). Choice: done runs whose last
metrics mention a loss, longest first; a series qualifies when the last
quarter's mean is ≥25% below the first quarter's and ≥60% of steps go down;
≥10 points is preferred. On the 2026-09-28 local runs no series has ≥10 points,
so it picks `lora/lora-20260305-205210` `pretrain_loss` (2.13 → 0.96 → 0.46, 3 points; verified against the live API).
If `curve` is `null`, keep the egg hidden — never fake a curve. Animate
`<Sparkline progress>` from 0 → 1 while the critter "trains"; show the run id.

**double_descent.** `compositions/double_descent.py`: sweep width on label-noised
MNIST — test error falls, rises at the interpolation threshold, falls again.
Offset each point of the composition's `ferryRoute` perpendicular to the course
by `dipDepth(t) × amplitude` (t = distance travelled / route length).
`DOUBLE_DESCENT_EGG.profile` is an illustrative error profile for a caption chart.

**Konami.** `forwardPassOrder` accepts a built `World` (uses `node.depth`) or the
taxonomy (computes depth). With the fixture: 16 atoms, then depth 1, 2, 3
(`audio_melspectrogram` is deepest). Drive `<Anatomy activeStage>` or a pulse per
spot at `forwardPassSchedule(...)[name]` ms. Replayable; does nothing under still.

**Ruins.** One per `legacy/` project (the numbered `0NN-*` folders are empty
placeholders of the same lineage) plus the three loose single-file scripts.
Epitaphs are grounded in the folder contents (e.g. the template README that
still asks to be documented, the August-2024 maze GIFs, the pretrained GPT-2
that `miniRAG` borrowed). Keep them respectful; no invented history.

## Tests

Pure logic is node-testable (relative `.ts` imports, no JSX):

```
node --test --experimental-strip-types --no-warnings "components/lab/shared/eggs/*.test.ts" lib/lessons.test.ts
```
