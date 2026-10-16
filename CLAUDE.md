# CLAUDE.md — mini_networks

> **021-bootcamp dependency**: `mini-networks` is used as an editable uv dependency in `005-products/021-bootcamp/` (phases 3, 6). Weeks 6, 7, and 13 import directly from `mini_networks.ch0X` for lab exercises. Do not break the public API of existing chapter modules.

Educational ML lab: 50 models and 23 cross-model compositions sharing one
runtime contract, one data registry, one logging format, and one quality gate.
Owner-facing reference lab with a graphical **playground** (Observatory).
Nano S-tier runs locally (CPU) for the gate/dev; **M/L training runs on GCP
ephemeral Cloud Run Jobs** (single-train via Pub/Sub, or ONE parallel L4 sweep
job that gates every item as its own task) writing to the **global
`garassino-mlflow` tracker** (Cloud Run + Cloud SQL +
gs://garassino-ml-mlflow-artifacts via --serve-artifacts; deployed from the
desktop garassino-ml workspace — the earlier Neon-DSN plan is superseded).
Gate-passing M/L checkpoints are registered as `mini-<model>` with
champion/challenger promotion. Colab is optional. Design specs:
`docs/superpowers/specs/2026-06-12-ultimate-educational-resource-design.md`
and `…/2026-06-24-playground-and-gcp-training-design.md`.

## Architecture (src/mini_networks/)

```
core/
  config.py          BaseConfig (pydantic v2) + tier system (see below)
  tiers.py           the single visible tier-budget table (S/M/L caps) + per-item
                     M overrides via budget() — every override carries a why-comment
  blocks/            shared building blocks (norm/RMSNorm, ema, attention, cnn,
                     mlp) graduated from per-model copies (PR #16)
  runtime.py         BaseTrainer ABC: train/evaluate/infer/load_checkpoint
                     + SupervisedTrainer / ContrastiveTrainer / reconstruction bases
  evalspec.py        EvalSpec + EVAL_SPECS — quality-gate thresholds, 1 entry per item
  taxonomy.py        atoms/molecules DAG: MODEL_TAXONOMY (level/introduces/
                     builds_on), MECHANISMS, COMPOSITION_TAXONOMY; drives
                     `main.py list` + /web/models taxonomy fields (docs/14)
  sweep_report.py    CheckResult + report.{md,json} writers (stdlib-only)
  checkpoints.py     latest_run_dir / find_resumable_run
  data/registry.py   get_dataset/get_dataloader — MNIST task modes, text, audio, tabular
  logging/logger.py  Logger → runs/<name>/<ts>/{metrics.jsonl,config.yaml,artifacts/}
  logging/mlflow_sink.py  optional env-gated MLflow mirror (MN_MLFLOW_TRACKING_URI);
                     Logger dual-writes; ended by Logger.close() + atexit net
  logging/mlflow_registry.py  champion/challenger Model Registry: gate-passing
                     M/L ckpts → `mini-<model>` versions, promoted on the gate
                     metric (MN_MLFLOW_REGISTER=1; never fails a run)
  diffusion/sampling.py  shared DDPM sample_loop (guidance + callbacks)
models/<name>/       config.py + model.py + trainer.py per model
                     (kimi + deepseek are mini frontier LMs — arXiv 2607.24653 /
                     2606.19348 — on the transformer text lineage; see docs/06)
compositions/        multi-model pipelines (each exposes train/sample or compare)
web/                 read-layer: metrics.py (pivot) + sources.py (Local/MLflow/
                     Composite RunSource) + model_catalog.py — reader of the contract
                     evidence.py: /web/evidence — per model champion (+version),
                     EvalSpec gate metric + M bar, provisional flag, run count
                     feedback.py: /web/feedback — the owner's lab notes + pictures
                     (Feedback tab on every /lab page) → playground/.lab-shots/
                     feedback/<id>/{note.json,img-N.*,status.json}; the agent
                     relays each note and writes status.json (refused when
                     MN_DISABLE_TRAIN=1)
cloud/               publisher.py: JobSpec + Pub/Sub publisher (cloud train dispatch)
                     sweep_shard.py: task-index→item sharding for the parallel
                     sweep job + GCS shard upload + report merge
                     champions.py: pull Production mini-<model> checkpoints to
                     runs/champions/<model>/artifacts (POST /infer falls back
                     to these when no run/checkpoint is named)
playground/ (repo root)  Next.js 16 + React 19 + TS + Tailwind v4 + Recharts +
                     Motion. "Periodic Table of Neural Networks" cyanotype-
                     blueprint UI (sheets: Chart/Reactions/Observatory +
                     element spec-sheet drawer; taxonomy-driven via
                     /web/taxonomy). 66 per-species glyphs, six edition themes
                     behind a toggle (blueprint/wall chart/terminal/metro/atlas/
                     paper — manila city-map: districts, lots, routes, compass;
                     metro = ONE connected Beck-style system map: a line is a
                     family's service (its models + every model built on
                     them), interchange rings where families meet; stations
                     + paths authored on one grid in the painted maps'
                     geography, audited to 0 crossings/overlaps/label
                     collisions (data-* on the SVG; lib/world/metro.test.ts),
                     ?specimen=1 = the knot crop; components/metro/: a
                     liftable kit — system.ts = generic octilinear engine
                     (SystemSpec in → geometry + audit; a station with no
                     drafted cell is auto-placed on a dashed spur), layout.ts
                     = this zoo's drafting, tokens.ts = every value (sheet
                     colours painted on <html> by applySheet), map/station/
                     train/marks/key/services.tsx, DESIGN.md),
                     blueprint/wall chart/terminal = three token skins of ONE
                     table (components/periodic/: skins/*.ts → CSS vars via
                     applySkin on <html>, periodic.css, encoding.ts; the
                     drawer's spec tile reuses element-tile; DESIGN.md: a
                     fourth skin = one tokens file),
                     animated per-species forward-pass anatomy (PRs #18–#22).
                     Static-exported (output:'export' → playground/out) and
                     served by FastAPI StaticFiles at /. Pure client of
                     /web,/train,/infer. Source committed; out/ + node_modules
                     gitignored (build with `make playground`). Read
                     playground/AGENTS.md before UI work — this Next.js version
                     differs from training data.
                     Design library: playground/DESIGN-LIBRARY.md + lib/lab-contract.ts.
                     Route groups: app/(classic)/ = the edition UI at / and
                     /atlas (blueprint.css scoped there; the atlas edition's
                     plates and the /atlas Network Atlas — ?focus=<model>,
                     key column + docked detail rail — declare their marks in
                     components/atlas/encoding.ts, which the key renders); app/lab/ = the
                     design bake-off stage (spec 2026-09-28-playground-bakeoff):
                     /lab/{paper,pixel,hybrid,flow} skins + /lab/stub reference,
                     all painting lib/world/ — the pure deterministic layout
                     contract (geographic world: regions/roads/bridges/labels/
                     camera; flow: depth x family lanes). Views are URL-driven
                     (?zoom=overview|region|node&focus=<model>&still=1); skins
                     set data-lab-ready when drawn; every mark is declared in
                     components/lab/<skin>/encoding.ts.
                     /lab/flow = the Kawaii DFD (spec .lab-shots/rework/flow/brief.md,
                     owner reference: an IxDF data-flow diagram; boilerplate guide
                     components/lab/flow/DESIGN.md): lib/world/dfd.ts lays models on
                     a strict grid (desktop: two stacks of family lanes x generation
                     columns, one left x per column, 48-px boxes; phone: one file
                     tree indented 16 px per generation under a sticky generation
                     ruler) and routes every builds_on edge orthogonally (one elbow
                     radius, arrowhead at its own input port) with ZERO crossings/
                     overlaps/box hits — desktop by a maze router (arrangements
                     scored by the finished sheet; a child wholly to the left gets a
                     left-side out-port), phone by a two-page channel annealer.
                     Route-quality rule: a line > 1.6x the Manhattan distance between
                     its box centres (or straying outside its two stacks) becomes an
                     off-sheet connector pair (stub + tag naming the far end, budget
                     2, priced as wire); island atoms (no edges) are chips on their
                     lane's title row; ONE inline label per trunk, never a bare
                     address. dfd.test.ts proves it on the fixture + 5 shuffles + 5
                     perturbations; the board carries data-crossings / data-overlaps
                     / data-detours. tokens.ts is the one style source; components
                     split by role (box, edges, sheet, top-bar, legend, use-camera,
                     ruler, pipelines, keeper, drawer, packets). Node view frames
                     the selection + ancestors + the nearest children that fit at
                     names ≥ 13 px; docked drawer (phone: bottom sheet ≤55%);
                     /lab/flow/specimen = the router alone (?mode=mobile).
                     /lab/painted = the owner's two painted maps (pixel 768×512
                     128-colour, paper 1536×1024; local, gitignored under
                     playground/public/local/) with the live data layer, in the
                     "four corners" layout (spec 2026-10-02-painted-four-corners):
                     the map owns the whole viewport (pixel sea extended to the
                     edges with the map's own sea furniture — stage.tsx +
                     sea-furniture.ts; paper cover-cropped and never framed
                     past its edge; paper plates are cut cardstock — hard
                     offset drop + a CSS-only laid-paper print, material
                     `card` token), chrome only in the
                     corners (corners/: cartouche + search, Pixel/Paper sheet
                     tabs, compass navigation + scale bar of models by evidence,
                     legend↔minimap plate) on ONE system (corners/plate.tsx
                     CORNER_W/CORNER_PAD: same margin + padding, cartouche and
                     legend share a column width, the compass stands on the
                     scale bar and scale bar + legend share the bottom edge;
                     while the map plate needs their corner the scale bar,
                     then the minimap, fold away; FOCUS MODE — a land or model
                     open, or zoomed in — quiets them: one-row cartouche with
                     a search magnifier, slim scale strip, 176-px minimap
                     inset, smaller compass + tabs, re-stamped in place), a
                     right drawer for the selected model (drawer.tsx +
                     card.tsx: a reading panel on one type scale, card.tsx
                     TYPE + a 19em measure — place, name, evidence stamp +
                     gloss, introduces, then three ruled sections: Lineage
                     (built on / leads to as a signposted road), Pipelines,
                     Quality gate; sticky way back, a fade while more lies
                     below; full-stage diagram view);
                     on desktop the "How <model> works" diagram is a MAP PLATE
                     hung beside the castle on a leader line (map-plate.tsx:
                     full animated diagram at 1 art px = 1 CSS px — ×1.5/×2
                     only at whole device px within half the visible map —
                     in a compact frame, scrubber/keys
                     kept, Enlarge → full stage, Close keeps the selection;
                     plate-place.ts composes camera scale + castle spot + plate
                     side so the pair fits the visible map clear of the corner
                     plates and the lineage; Esc = enlarged → plate → deselect;
                     ?plate=0 starts closed; phones keep the diagram in the
                     sheet; sky keeps it in its drawer via `diagramOn`; the
                     text-only drawer is DRAWER_W_MAP 336 px, sky's 440 —
                     camera + plate read drawerWidth(diagramOn); plate + leader
                     + corner plates are HARD for labels: a name they would cut
                     moves or is left out, except the selection + its lineage;
                     paper keeps the plate off the painter's land titles);
                     one component tree, two materials (material.ts = the kit's
                     ONE tokens module: colours, faces + digit faces, TYPE,
                     SPACE, CORNER, DRAWER, MOTION; the kit's design contract +
                     how to lift it: components/lab/painted/DESIGN.md). Paper:
                     the painting is retouched once on load (heal.ts paints out
                     the painter's cartouche, compass, scale bar and lettering);
                     land titles are redrawn whole in view, names go
                     screen-steady when zoomed, digits are Alegreya lining
                     figures under Fell SC (--font-paper-digits). The pixel
                     map is alive (life.ts → a 12-fps canvas above the focus
                     layer): water glints + foam, waterfalls, lava pulse with
                     embers + smoke from the volcano's vents, window flicker,
                     leaf rustle, flag flutter, gulls, fish splashes, lighthouse
                     beams, and carts travelling every builds_on edge
                     parent → child in the child's evidence colour (lit on the
                     selected lineage). Pixel classes come from the palette +
                     connected components; hand-placed features (vents, lamps,
                     waterfall boxes) live in anchors.ts `landmarks`; every moving pixel keeps to
                     its own colour ramp, never covers our markers, and ghosts
                     itself by the focus field; still=1 / reduced-motion → frame 0.
                     ?map=pixel|paper; ?dev=1 reveals the render/labels tray;
                     "map only" tab / key h / ?ui=0 hides every plate + the drawer.
                     Labels open in three levels: whole map = land signs only
                     (hover names a model), in a land = that land's names, a
                     model = its card (drawer) + named lineage.
                     /lab/sky = the Night Map (the Celestial Zoo; reworked
                     2026-10-04 from the vector atlas): the zoo after dark as a
                     pixel-art star chart on lib/world positions. sky/bake.ts bakes
                     the sky once (1 sky px = 4 world px, pixelated): night ramp,
                     dithered Milky Way margins, field stars, and one Bayer-dithered
                     nebula per family on its hue-shifted ramp (tokens.ts) — the
                     nebula IS the family (bake.test.ts: every star inside its own).
                     A screen canvas on a 2-px art grid (paint.ts) draws the evidence
                     sprites (sprites.ts: sparkle/gem/broken ring/point, atoms large),
                     1-px asterism lines stopping short of their stars (a fan parent
                     keeps a wider ring; long lines sink into their nebula's tone
                     mid-run; overview: primary in-family only; focus adds dashed
                     secondary/cross),
                     dotted pipeline arcs, the broken selection ring, and the 12-fps
                     life (motion.ts: twinkle, champion glint, parent→child comets,
                     meteor; frame 0 under still/reduced motion). Night sign plaques
                     (16×16 emblem + Family count, sentence case) sit on each
                     nebula's top-left (taken: the free spot nearest their stars on
                     no neighbour's cloud, with a dotted leader when set away);
                     off-screen pipeline partners get named edge chevrons. Portrait
                     phones turn the chart a quarter and fit the stars, so the sky
                     fills the screen. Chrome:
                     the painted four corners + drawer fed tokens.ts SKY_MATERIAL
                     (Pixelify, crisp, brass rim), Day | Night tabs; words keep out
                     of the corner plates' measured rects. ?specimen=1 = the sprite /
                     nebula / emblem specimen sheet. Boilerplate: sky/tokens.ts is
                     the one value source; layers.tsx (canvases), layout.ts (word
                     placement), plaque.tsx / chrome.tsx (HTML furniture);
                     sky/DESIGN.md = tokens, grids, mark table, how to bake any
                     graph into a night chart.
                     /lab/designs = the design board (lib/designs.ts: seven designs —
                     periodic table ×3 skins via /?edition=<id>, paper maps ×4, pixel
                     maps ×2 as full bands, then atlas plates, Network Atlas, Kawaii
                     flow, star atlas as one 2-up grid — + the transit layout idea and
                     anatomy as a component; 15 pages) with a verdict contact strip and
                     per-page keep/drop (localStorage + posted to the feedback inbox as
                     skin "designs"); thumbnails shot LIVE (still=1, one CDP Chrome
                     slot) by `node scripts/designs.mjs` into gitignored
                     public/local/designs/{<id>.jpg,shots.json}.
                     /lab/anatomy = "How it works": components/lab/shared/anatomy2/
                     pixel mechanism diagrams, a liftable diagram kit (DESIGN.md):
                     registry.tsx (DIAGRAMS, full view + card each) → mechanism.tsx
                     (MechanismDiagram), prims.tsx + pixel-font.ts, themes.ts
                     (pixel/paper) + tokens.ts + encoding.ts, tick.ts useTick; the
                     page chrome is specimen/ (pixel-face names, shelved index,
                     grouped select on phones). Baked real outputs in
                     data/*-champion.ts via scripts/export_champions.py.
                     All 44 models have a rich diagram (generic fallback unused;
                     ?variant=card = contact sheet). Drawing contract: anatomy2/STYLE.md;
                     per-group expert→designer→critic dossiers in
                     .lab-shots/anatomy/dossier/ (shots: .lab-shots/anatomy/shoot-anatomy.mjs).
infra/gcp/           Dockerfile.train (ARG TORCH_INDEX: cpu|cu121) + entrypoint.sh
                     (MODE=train|sweep-task) + terraform/ (train job, L4 sweep
                     job, topic, trigger, IAM) + function/ (see its README)
colab/
  catalog.py         COMPOSITIONS list, descriptions, categories (MODELS aliases core registry)
  probes.py          per-model inference probes + output validation
  showcase.py        per-item human-viewable inference showcases (grids, text,
                     pred-vs-true, kNN) — saved when args.showcase_dir is set
  runners.py         run_model/run_composition + COMPOSITION_RUNNERS dict
  menu.py            rich TUI + `python -m mini_networks.colab.launcher` CLI
  launcher.py        thin facade keeping the historical import surface
  gate.py            quality-gate runner behind `sweep --check`
api/                 FastAPI: routers/{training,inference,compositions,web}, in-memory
                     jobs; main.py mounts /web read-layer + the SPA at /
main.py (repo root)  argparse CLI: serve|train|evaluate|compose|sweep|
                     sweep-task|sweep-report|sweep-samples|pull-champions|
                     showcase|menu|list. train takes --dataset (fashion_mnist|
                     kmnist|tri_mnist) + --num_classes for flavor runs.
```

Read-layer principle: the playground is a pure **reader of the run contract**.
Trainers never change — they call `Logger`, which (when `MN_MLFLOW_TRACKING_URI`
is set) also mirrors to MLflow. `MN_RUN_SOURCE` (local|mlflow) selects what the
`/web` endpoints read; `MN_TRAIN_BACKEND` (local|cloud) selects whether
`POST /train` runs in-process or publishes to Pub/Sub.

Registry: `core/registry.py::get_model_registry()` (cached) maps
`name → (ConfigClass, TrainerClass, dataloader_fn)`; `MODEL_NAMES` is the
static name list (sync-tested). Compositions dispatch through
`runners.COMPOSITION_RUNNERS` (sync-tested against the catalog).
Supervised vision trainers (classifier/resnet/vit/mobilenet/convnext)
implement only `_build`; `_forward`/`infer` live on `SupervisedTrainer`,
and they share `core/data/registry.py::make_classification_dataloader`.

## Tier system (BaseConfig)

| Tier | Means | Budgets |
|---|---|---|
| S | nano smoke run (CPU, CI) | 1 epoch, 1 train batch, batch≤16, 32 samples, 1 eval batch, diffusion timesteps capped to 25 |
| M | "actually learns" bar (L4 cloud sweep) | ≤5 epochs, 100 batches, batch≤64, 4096 samples, timesteps≤200 (re-sized 2026-07-10; do NOT run full M locally — the owner's machine is slow) |
| L | full budget | config values as-is |

`--fast_demo` forces S. Use `config.effective_*` properties (epochs, batch_size,
timesteps, …) — never raw fields — so every code path honors the tier.
`config.effective_timesteps` must be used for BOTH scheduler construction and
sampling so the noise chain stays consistent.

## Quality gate

`python main.py sweep --check [--training_tier S|M|L]` — trains every selected
item, then per item: finiteness + loss-trend S-checks from metrics.jsonl,
checkpoint round-trip through a fresh trainer (`load_checkpoint`), EvalSpec
metric on the loaded weights (threshold gates at M/L only), inference probe.
Writes `runs/sweep/<ts>/report.{md,json}`; non-zero exit on any non-pass.

- Thresholds live in `core/evalspec.py`. **Threshold honesty rule:** changing a
  number requires a justification comment next to it.
- diffusion/gan/pixelcnn are scored by a trained MNIST classifier
  (`gate.judge_samples`: confidence × class coverage); the gate trains or
  reuses the judge automatically.
- Single-item rerun: `--models <name> --skip-compositions`.

## Commands

- `uv sync` / `uv sync --dev` — install
- `make test` — fast suite (slow marker deselected via addopts)
- `make validate-s` — full S-tier check sweep (what CI runs)
- `python main.py train --model <name> --fast_demo` — one nano training (run via `uv run python main.py …`)
- **Testing / verification: `docs/TESTING.md`** — how to run one mini, all smoke tests, one mini's test, the Colab notebooks, and a per-model table (all 50 models: what it demonstrates · train command · gate metric to verify)
- `python main.py sweep --check --fast_demo --models clip,gan --skip-compositions` — targeted gate
- `python main.py serve` — FastAPI on :8000; playground at `/` (serves `playground/out`), API docs at `/docs`
- `MN_MLFLOW_TRACKING_URI=<tracker> python main.py pull-champions [--models a,b]` — download every Production `mini-<model>` checkpoint to `runs/champions/`; `/infer/<model>` then serves them by default (needs the `cloud` extra + GCS read access)
- `make playground` — build the Next.js UI to `playground/out` (rebuild after UI changes; CI builds it for deploy)
- `make playground-dev` — Next dev server on :3000 with hot reload (proxies API to :8000 via `NEXT_PUBLIC_API_BASE`); bound to 0.0.0.0 with the API base on the Mac's LAN IP so a phone on the same network works (next.config.ts allows the Mac's private IPs as dev origins; the API's dev CORS accepts private-network origins). After a network change, restart it.
- `make playground-ports` — one address per UI over the running dev server (playground/scripts/ports.mjs, `--list` prints the table): :3001 pixel map, :3002 paper map, :3003 star atlas, :3004 flow, :3005 transit, :3006–3008 periodic table blueprint/wall chart/terminal, :3009 diagram specimens, :3010 design board
- `cd playground && npm test` — lib/world layout invariants (node --test + strip-types, no deps)
- `make lab-shoot SKIN=<skin> ROUND=<n>` — headless screenshots of a /lab skin (4 states × desktop/mobile → gitignored `playground/.lab-shots/<skin>/r<n>/`; ≤2 Chrome at once; `--typecheck`/`--check-only`/`--dpr 2` (the owner's retina scale — use it for the pixel map) via `node scripts/shoot.mjs`; the painted skin's extra states live in `.lab-shots/painted/shoot-painted.mjs`)
- `make lab-board` — build `playground/.lab-shots/board.html`, the round-by-round bake-off comparison page
- `uv run python playground/scripts/export_champions.py [--models a,b] [--force] [--list]` — regenerate the anatomy diagrams' real-output data (`playground/components/lab/shared/anatomy2/data/<model>-champion.ts`: nibble-hex constants + `<PREFIX>_VERSION`) from the local `runs/champions/` checkpoints, CPU inference on ≤8 real items per model (no training, no cloud); default = every champion without a data file
- Lab feedback loop: the owner writes notes (+ pasted pictures) in the Feedback tab on any `/lab/<skin>` page; read new ones in `playground/.lab-shots/feedback/*/note.json` (images beside them), relay to the skin's builder, then write `status.json` `{"status":"relayed"|"addressed","reply":"…"}` so the tab shows the loop closing
- `make -C infra/gcp validate` — terraform fmt-check + validate (static, no cloud)
- `make -C infra/gcp build-train[-gpu]` / `dry-run[-sweep]` — build the CPU/cu121 images / run MODE=train or one MODE=sweep-task shard against a local sqlite MLflow
- `make -C infra/gcp sweep TIER=M [ITEMS=a,b,c]` — execute the parallel L4 gate sweep (one Cloud Run task per item); `make -C infra/gcp sweep-report SWEEP=<id>` merges the shards into report.{md,json}
- `make -C infra/gcp sweep-samples SWEEP=<id> [DEST=~/Downloads]` — download every item's inference showcase (sample grids / pred-vs-true / generated text / kNN accuracy; produced by `colab/showcase.py`, uploaded by each sweep task to `…/sweeps/<id>/samples/<item>/`)
- `uv run pytest tests/ -m slow` — slow API tests (full trainings via TestClient)

### Env vars (playground + cloud)

- `MN_MLFLOW_TRACKING_URI` — enable the Logger's MLflow sink. Cloud contract: the global tracker URL `https://garassino-mlflow-mjz4n7eeia-ew.a.run.app` (public; leave `MN_MLFLOW_ARTIFACT_ROOT` unset so artifacts proxy through --serve-artifacts). Local dev may use `sqlite:///…` + `MN_MLFLOW_ARTIFACT_ROOT`.
- `MN_MLFLOW_EXPERIMENT` — experiment name (default `mini-networks`).
- `MN_MLFLOW_REGISTER=1` — gate hook registers gate-passing M/L checkpoints as `mini-<model>` with champion/challenger promotion on the gate metric.
- `MN_RUN_SOURCE` = `local` (default) | `mlflow` — what `/web` reads.
- `MN_TRAIN_BACKEND` = `local` (default) | `cloud` — `POST /train` runs locally vs publishes to Pub/Sub.
- `MN_PUBSUB_TOPIC` / `GOOGLE_CLOUD_PROJECT` — cloud train publisher.
- `MN_SWEEP_BUCKET` / `MN_SWEEP_PREFIX` / `SWEEP_ID` / `ITEMS` / `CLOUD_RUN_TASK_INDEX` — sweep-task sharding + shard upload (bucket unset = local-only dry-run).
- Cloud/MLflow deps live in the `cloud` extra (`uv sync --extra cloud`); all imports are lazy so the base install + `smoke-import` stay light.

## CI (.github/workflows/)

- `ci.yml` — `smoke-import` (imports every module), `test` (`make test-ci`),
  `sweep-s` (full S-tier check sweep, report uploaded as artifact). All blocking.
- `build-train-image.yml` — on push to main touching train-image paths: builds
  BOTH train images (cpu + cu121) and pushes to AR as `:latest` only (no SHA
  tags — storage cost). Wait for the CI build of your sha before
  `make -C infra/gcp refresh-jobs`, or the jobs pick up a stale image.
- `infra.yml` — terraform-validate on `infra/gcp/**` changes.

## Conventions

- Python 3.11, uv-managed, torch pinned `>=2.1,<2.3` + numpy `<2` (old x86_64 mac)
- `from __future__ import annotations` everywhere; argparse only; stdlib logging
  (`log = logging.getLogger(__name__)` — `logger` is reserved for the metrics Logger
  parameter in trainers)
- `torch.load` always with `weights_only=True`
- Tests: pytest, flat `tests/`, stub/skip pattern for download-gated datasets
  (`tests/conftest.py::dataset_or_skip`)
- `legacy/` is reference-only; its datasets/venvs are untracked (history was
  rewritten 2026-06-12 to purge binaries — do not re-add binary data to git)
- The owner's machine is slow: locally run only targeted tests and single
  S-tier (nano) runs; full sweeps belong to CI (S) or the cloud sweep job (M/L).

## Working state

- Phases 0–3 done. **Capstone M-tier sweep m-full-4: 53/53 pass (2026-07-11)**
  on the 35-model era; thresholds carry evidence comments from the triage
  rounds; all era champions registered as `mini-<model>` Production and served
  locally via `pull-champions` + the `/infer` fallback.
- Zoo since grown to **50 models + 23 compositions**. Models 36–44 (kimi,
  deepseek, grokking, text_diffusion, rpp_classifier, gnn, sam, nerf,
  alphazero) and compositions 20–22 (mode_connect, double_descent, vlm) landed
  with S-tier gates only — their evalspec bars are marked PROVISIONAL until a
  cloud M sweep validates them.
- **Cloud pause (since 2026-07-31): no Cloud Run dispatch — train or sweep —
  without an explicit ask.** Validate changes via local S-tier micro runs.
- Taxonomy DAG shipped (16 atoms / 28 derived / 21 composed, `core/taxonomy.py`,
  PR #15); shared blocks graduated to `core/blocks/` (PR #16).
- Public showcase app: https://mini-networks-app-mjz4n7eeia-ew.a.run.app —
  Cloud Run `mini-networks-app` (min-0, `MN_DISABLE_TRAIN=1` guards /train +
  /compose, champions pulled at container start).
- Plan B (Sandbox, Lab-compare, Lessons) is future work.
- Self-improve loop (2026-10-16, local CPU M runs, no cloud): sweeps used to
  pass a fixed epochs/batch (cloud 10/64, local sweep 2/32) that silently
  clipped every per-model M override above them; `None` now lets the tier
  budget decide (`core.config.budget_kwargs`). Tuned + checked on held-out
  independent runs: swin, alphazero, vqvae (dead-code restarts), convlstm,
  nerf, wgan (40-epoch M). Randomness is NOT parametrized: training is
  unseeded and changes are judged over several independent runs (a seeded
  gate was tried and reverted). gnn's provisional M bar re-set 0.75 ->
  0.5 from 5-graph evidence (owner-approved; gate runs 0.64-0.68). sam 10-epoch
  M (0.74-0.76). deepseek passes M on CPU (0.83 vs 2.8);
  text_diffusion now does too (2.79/2.56 vs 3.2, M sample_limit 16384); kimi
  (~11 GB at batch 64, hours on CPU) still needs the next cloud M sweep.
- Known instability fixes applied 2026-07-10: text_seq2seq causal mask +
  shifted teacher forcing + honest eval divisor; pixelcnn Bernoulli BCE +
  true raster-scan sampling; optional `BaseConfig.max_grad_norm` clipping.
- Two teaching minis added (derived molecules): `wgan` (builds_on gan —
  Wasserstein critic + weight clipping + n_critic + RMSProp, the minimal fix to
  gan's on-purpose mode collapse; ports martinarjovsky/WassersteinGAN) and
  `vqvae` (builds_on vae — discrete codebook + straight-through estimator;
  ports the VQ/STE atom from nerdyrodent/VQGAN-CLIP). Both CPU-runnable via
  `python main.py train --model {wgan,vqvae}`.
- Four more teaching minis added (derived molecules, all CPU-smoke-runnable):
  `cyclegan` (builds_on gan — unpaired MNIST↔Fashion translation: 2 resnet
  generators + 2 PatchGANs + cycle/identity loss + image pool; ports junyanz
  cycle_gan_model.py + image_pool.py), `swin` (builds_on vit, transformer —
  windowed + shifted-window attention + patch-merging hierarchy; ports
  microsoft/Swin-Transformer), `convlstm` (builds_on rnn, classifier —
  LSTM gates as convs for Moving-MNIST next-frame prediction + Bernoulli
  scheduled sampling; ports NVlabs/conv-tt-lstm ConvLSTMCell), and `dcrnn`
  (builds_on gnn, rnn — diffusion-convolution GRU + inverse-sigmoid scheduled
  sampling for sensor-graph forecasting; ports liyaguang/DCRNN dcrnn_cell.py).
  Registry is now 50 models. See `docs/TESTING.md`.
- Composition added (composes `gan`): `gan_ada` — Adaptive Discriminator
  Augmentation (StyleGAN2-ADA, NeurIPS 2020; ports NVlabs/stylegan2-ada-pytorch).
  A non-leaking augmentation pipeline (`AdaptiveAugment`: x-flip + integer
  translation + 90° rotation + brightness, a minimal subset of the paper's 18
  transforms) applied to reals AND fakes at probability p, plus the
  E[sign(D_real)] heuristic controller (`ada_update_p`) that steers p toward a
  target (~0.6) — the load-bearing "ADA" idea. p is tracked (`p_history`,
  logged as `ada_p`) for tests/logging. S-tier gate only (finite-loss check);
  EvalSpec bar is metric=None until a data-starved M sweep sets one.
  CPU-runnable; compositions total is now 23. See `docs/TESTING.md`.
