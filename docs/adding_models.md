# Adding a Model or a Composition

Every item in the zoo plugs into the same runtime contract, registry, gate and
read-layer. Adding one is mostly bookkeeping across a handful of tables, and
**sync tests fail loudly if you miss one** — so the checklist below doubles as
"what the tests will ask you for".

Worked examples worth copying: `models/gnn/` (small, self-contained, own
dataset), `models/resnet/` (supervised vision: only `_build`), and
`compositions/vlm.py` (a composition with its own metric).

---

## Part 1 — a model

### 1. The package: `src/mini_networks/models/<name>/`

```
__init__.py   one-line docstring: what the package is (exports nothing)
config.py     <Name>Config(BaseConfig)
model.py      the nn.Module(s); module docstring = the lesson
trainer.py    <Name>Trainer(BaseTrainer) + make_<name>_dataloader
```

**`config.py`** — subclass `core.config.BaseConfig` (pydantic v2). Set
`model_name: str = "<name>"` (the tier table and run names key on it) and a
`dataset`. Comment any knob whose meaning isn't obvious from its name.

**`model.py`** — open with the house-style module docstring (see
`models/vae/model.py`): the key idea + paper, this implementation's tensor
shapes, the governing equations, and what is *deliberately simplified*. Every
`forward` documents input → output shapes. Reuse `core/blocks/`
(norms, attention, conv, MLP, EMA) before writing a new block.

**`trainer.py`** — implement the `core.runtime.BaseTrainer` contract:

| Method | Must |
|---|---|
| `train(config, dataloader, logger)` | log per-epoch metrics via `logger.log_metrics` (at least `loss`), save weights to `logger.artifact_path("model.pt")` |
| `evaluate(config, dataloader, logger) -> dict` | return the metric your EvalSpec gates on; stop after `config.max_eval_batches` (use `self._iter_eval_batches`) |
| `infer(config, inputs) -> Any` | accept a dict, return a dict/tensor the probe can validate |
| `load_checkpoint(config, artifacts_dir)` | inherited default loads `model.pt` into `self._build(config)`; override for multi-file layouts |

Rules that keep every tier honest:

- Read budgets **only** through `config.effective_*` / `config.max_*`
  (`effective_epochs`, `effective_batch_size`, `max_train_batches`,
  `dataset_sample_limit`, `effective_timesteps`, …) — never raw fields.
- Supervised image classifiers can subclass `SupervisedTrainer` and implement
  only `_build`; use `core/data/registry.py::make_classification_dataloader`.
- `torch.load(..., weights_only=True)` always.

**`make_<name>_dataloader(config, split="train")`** — go through
`core.data.registry.get_dataloader` so tiers, sample limits and caching apply.
New dataset? See [adding_datasets.md](adding_datasets.md).

### 2. Register it (all sync-tested)

| File | Add | Test that checks |
|---|---|---|
| `core/registry.py` | name in `MODEL_NAMES` **and** `name: (Config, Trainer, make_dataloader)` in `get_model_registry()` — same position in both | `test_sweep_check.py` (list equality, order matters) |
| `core/evalspec.py` | an `EVAL_SPECS` entry — `_acc(m, l)`, `_loss(m, l)`, `_judge(m, l)` or a custom `EvalSpec`; mark `provisional=True` until an M cloud sweep validates the bar, and put a justification comment next to every number | `test_sweep_check.py` |
| `core/taxonomy.py` | `MODEL_TAXONOMY` entry: `_e(("mechanism",))` for an atom, or `_d(("parent",), ("new-mechanism",), "note")` for a molecule; new mechanisms also go in `MECHANISMS` | `test_taxonomy.py` |
| `colab/catalog.py` | a one-line `DESCRIPTIONS` entry and a `CATEGORY` | read by `main.py list`, the menu and `/web` |
| `colab/probes.py` | a branch in `_run_model_inference_probe` (or add the name to `batch_models` if one real batch item is a valid input) — unknown models raise | the gate's inference probe |

Optional:

- `core/tiers.py` — a `MODEL_OVERRIDES[name]` entry if M's default budget is
  wrong for this model. **Every override carries a why-comment.**
- `colab/showcase.py` — add the name to `VISION_CLS` / `EMBEDDERS` /
  `SAMPLERS` / `TEXT_LMS` (or a branch) so sweeps save a human-viewable
  showcase.

### 3. Test and gate it (locally: S tier only)

```bash
uv run pytest -q tests/test_<name>.py tests/test_sweep_check.py tests/test_taxonomy.py
python main.py train --model <name> --fast_demo
python main.py sweep --check --fast_demo --models <name> --skip-compositions
```

Write `tests/test_<name>.py` with forward-shape tests and a tiny train →
`load_checkpoint` → `infer` round-trip; use `tests/conftest.py::dataset_or_skip`
for anything that downloads. Do **not** run full M locally — M bars are
validated by the cloud sweep (`make -C infra/gcp sweep TIER=M ITEMS=<name>`,
only on an explicit ask while the cloud pause holds).

### 4. Document it

- Add the model to the right chapter in `docs/` (and its results block —
  `<!-- results:start items=... -->`, filled by `scripts/render_results.py`).
- Add a line to the model list in `README.md`.
- The playground picks it up from `/web/models` + `/web/taxonomy`
  automatically; a bespoke "how it works" diagram lives in
  `playground/components/lab/shared/anatomy2/` (see its `DESIGN.md`).

---

## Part 2 — a composition

A composition combines existing models into one pipeline (guidance,
distillation, captioning, …). It lives in one module and has no registry
entry of its own — it is dispatched by name through the runners table.

1. **`src/mini_networks/compositions/<name>.py`** — a `<Name>Config(BaseConfig)`
   and a pipeline class with a training entry point (`train` / `train_all`)
   plus its demo method (`sample`, `generate`, `compare`, …). Module docstring:
   which models it combines, the pipeline with shapes, what it demonstrates,
   what is simplified. Same `effective_*` rule as models.
2. **`colab/runners.py`** — a `_run_<name>(fast_demo, training_tier, data_root,
   device, checkpoint_root) -> dict` that builds the config, makes its logger
   with `_make_composition_logger("<name>", checkpoint_root)`, runs the
   pipeline and returns a dict **including `"run_dir"`** (the gate reads that
   run's `metrics.jsonl`). Add it to `COMPOSITION_RUNNERS`.
3. **`colab/catalog.py`** — the name in `COMPOSITIONS`, plus `DESCRIPTIONS`.
4. **`core/evalspec.py`** — `_composition(metric=..., loss_keys=(...))`;
   `loss_keys` are the metrics.jsonl keys the S-tier trend check reads.
5. **`core/taxonomy.py`** — `COMPOSITION_TAXONOMY["<name>"] = ("model_a", "model_b")`.
6. **Test + gate**: `tests/test_<name>.py`, then
   `python main.py sweep --check --fast_demo --skip-models --compositions <name>`.
7. **Document**: `docs/11-compositions.md` and the README list.

---

## Checklist

- [ ] package with docstrings (module, classes, `forward` shapes)
- [ ] budgets only via `config.effective_*`
- [ ] `MODEL_NAMES` + `get_model_registry()` (same order) — or `COMPOSITION_RUNNERS` + `COMPOSITIONS`
- [ ] `EVAL_SPECS` entry with justified numbers (`provisional=True` until M-validated)
- [ ] taxonomy entry
- [ ] catalog description (+ category for models)
- [ ] inference probe branch (models)
- [ ] `tests/test_<name>.py`; S-tier gate passes locally
- [ ] docs chapter + README line
