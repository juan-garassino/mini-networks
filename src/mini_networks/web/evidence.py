"""Per-model evidence for the playground: champion, gate bar, provisional flag, runs.

Joins three sources the frontend should not have to know about: the EvalSpec
gate (core/evalspec.py), pulled registry champions (runs/champions/, see
cloud/champions.py) and the listed runs of the active RunSource.
"""
from __future__ import annotations

import logging
from collections.abc import Callable, Iterable
from pathlib import Path

from mini_networks.api.schemas.web import ModelEvidence, RunSummary
from mini_networks.cloud.champions import CHAMPIONS_DIRNAME, has_champion
from mini_networks.core.evalspec import EVAL_SPECS
from mini_networks.core.registry import MODEL_NAMES

log = logging.getLogger(__name__)


def _metric_value(run: RunSummary, metric: str) -> float | None:
    """The run's last logged value of ``metric`` (bare or ``eval_``-prefixed), else None."""
    # evaluate() keys are logged either bare or eval_-prefixed depending on the trainer.
    for key in (metric, f"eval_{metric}"):
        if key in run.last_metrics:
            return run.last_metrics[key]
    return None


def _champion_version(model: str, champions_root: Path) -> str | None:
    """Registry version string from ``<root>/champions/<model>/VERSION``; None if absent or empty."""
    path = champions_root / CHAMPIONS_DIRNAME / model / "VERSION"
    try:
        return path.read_text().strip() or None
    except OSError:
        return None


# Only M/L runs are comparable to the M bar: S-tier nano smoke runs (1 batch)
# would read as "fails the gate" for models whose champion passed it.
GATE_TIERS = ("M", "L")


def build_evidence(
    runs: Iterable[RunSummary],
    champions_root: str | Path,
    tier_of: Callable[[RunSummary], str | None] = lambda run: None,
) -> list[ModelEvidence]:
    """One ModelEvidence row per name in ``MODEL_NAMES`` (registry order).

    Args:
        runs: every run the active RunSource lists; grouped by ``run.model``.
            ``run_count`` counts all of them, whatever their tier.
        champions_root: the runs base that holds ``champions/<model>/artifacts``
            (written by ``main.py pull-champions``); a champion exists when that
            folder has a ``*.pt`` file.
        tier_of: resolves a run's effective training tier. Only runs it maps to
            M or L (``GATE_TIERS``) feed ``best_metric``; the default maps every
            run to None, so ``best_metric`` stays None unless a resolver is given.

    Returns:
        Rows carrying the EvalSpec gate metric, its M threshold and direction,
        the provisional flag, and the best gate value across M/L runs (max or
        min by ``higher_is_better``). Models without an EvalSpec get neutral
        defaults.
    """
    root = Path(champions_root)
    by_model: dict[str, list[RunSummary]] = {}
    for run in runs:
        by_model.setdefault(run.model, []).append(run)

    rows: list[ModelEvidence] = []
    for name in MODEL_NAMES:
        spec = EVAL_SPECS.get(name)
        model_runs = by_model.get(name, [])
        champion = has_champion(name, root)
        best = None
        if spec is not None and spec.metric:
            values = [
                v for r in model_runs
                if (v := _metric_value(r, spec.metric)) is not None and tier_of(r) in GATE_TIERS
            ]
            if values:
                best = max(values) if spec.higher_is_better else min(values)
        rows.append(ModelEvidence(
            name=name,
            champion=champion,
            champion_version=_champion_version(name, root) if champion else None,
            gate_metric=spec.metric if spec else None,
            threshold_m=spec.thresholds.get("M") if spec else None,
            higher_is_better=spec.higher_is_better if spec else True,
            provisional=spec.provisional if spec else False,
            run_count=len(model_runs),
            best_metric=best,
        ))
    return rows
