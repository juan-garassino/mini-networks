"""Run sources: read training runs from the local ``runs/`` tree or from MLflow,
normalized to the same schemas, plus a Composite that unions the in-memory job
store (for freshly-dispatched cloud jobs) with the persistent source.

Selected by env: ``MN_RUN_SOURCE`` = ``local`` (default) | ``mlflow``.
``LocalRunsSource`` reads ``$MINI_NETWORKS_RUNS`` (default ``runs``) laid out by
the Logger as ``<model>/<ts>/{metrics.jsonl,config.yaml,artifacts/}`` (plus an
optional ``summary.json``);
``MLflowSource`` reads ``$MN_MLFLOW_TRACKING_URI`` / ``$MN_MLFLOW_EXPERIMENT``.
All MLflow imports are lazy so the base package imports without it.
"""
from __future__ import annotations

import logging
import mimetypes
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yaml

from mini_networks.api.schemas.web import (
    ConfigResponse,
    MetricSeries,
    MetricsResponse,
    RunSummary,
    SummaryResponse,
)
from mini_networks.web.metrics import pivot_long_to_series, read_jsonl, tail_latest

log = logging.getLogger(__name__)

_RUN_MARKERS = ("metrics.jsonl", "config.yaml", "summary.json", "training_state.pt")


class RunNotFound(KeyError):
    """Raised by a source when a run id cannot be resolved."""


class RunSource:
    """Interface implemented by every source. Methods raise RunNotFound on miss."""

    def list_runs(self) -> list[RunSummary]:  # pragma: no cover - interface
        """Every run this source can see, as normalized RunSummary rows."""
        raise NotImplementedError

    def get_metrics(self, run_id: str, since: int | None = None) -> MetricsResponse:  # pragma: no cover
        """Per-key metric series for a run; ``since`` keeps only steps > since."""
        raise NotImplementedError

    def get_config(self, run_id: str) -> ConfigResponse:  # pragma: no cover
        """The run's training config as a flat-ish dict."""
        raise NotImplementedError

    def get_summary(self, run_id: str) -> SummaryResponse:  # pragma: no cover
        """The run's end-of-run summary (status and any extra fields the source has)."""
        raise NotImplementedError

    def open_artifact(self, run_id: str, name: str) -> tuple[Path, str]:  # pragma: no cover
        """A local filesystem path to artifact ``name`` plus its guessed media type."""
        raise NotImplementedError


def _series_response(run_id: str, rows: list[dict], since: int | None) -> MetricsResponse:
    """Pivot LONG metric rows into a MetricsResponse; ``latest_step`` = max last step over all series."""
    pivoted = pivot_long_to_series(rows, since)
    series = [MetricSeries(key=k, points=pts) for k, pts in pivoted]
    last = max((pts[-1][0] for _, pts in pivoted if pts), default=None)
    return MetricsResponse(run_id=run_id, series=series, latest_step=last)


# --------------------------------------------------------------------------- #
# Local runs/ directory
# --------------------------------------------------------------------------- #
def _looks_like_run(d: Path) -> bool:
    """A directory holding at least one of ``_RUN_MARKERS`` (metrics/config/summary/training state)."""
    return d.is_dir() and any((d / m).exists() for m in _RUN_MARKERS)


class LocalRunsSource(RunSource):
    """Runs on disk under ``runs_base``, else ``$MINI_NETWORKS_RUNS``, else ``./runs``.

    Run ids are paths relative to that base, normally ``<model>/<timestamp>``
    (one more level when a run was nested under a second timestamp dir).
    """

    def __init__(self, runs_base: str | None = None):
        self.base = Path(runs_base or os.environ.get("MINI_NETWORKS_RUNS", "runs"))

    def _iter_run_dirs(self):
        """Yield run directories two levels deep (``<model>/<ts>``), or three when nested."""
        if not self.base.exists():
            return
        for model_dir in sorted(self.base.iterdir()):
            if not model_dir.is_dir():
                continue
            for ts_dir in sorted(model_dir.iterdir()):
                if not ts_dir.is_dir():
                    continue
                if _looks_like_run(ts_dir):
                    yield ts_dir
                else:  # double-timestamp nesting: descend one level
                    for child in sorted(ts_dir.iterdir()):
                        if _looks_like_run(child):
                            yield child

    def _resolve(self, run_id: str) -> Path:
        """``base / run_id`` when it looks like a run, else RunNotFound."""
        d = self.base / run_id
        if _looks_like_run(d):
            return d
        raise RunNotFound(run_id)

    # A local run is only plausibly "live" if its metrics file was touched very
    # recently; many trainers never write summary.json, so a stale metrics file
    # without a summary just means the process finished and didn't summarize —
    # not that it's still running (which is what made old runs show a "REC" dot).
    _LIVE_WINDOW_S = 120

    def _status(self, d: Path) -> str:
        """``done``/``failed`` from summary.json; else ``running`` if metrics.jsonl
        changed within ``_LIVE_WINDOW_S`` seconds, ``done`` if older, ``unknown``
        when neither file exists."""
        summary_path = d / "summary.json"
        if summary_path.exists():
            try:
                import json

                status = json.loads(summary_path.read_text()).get("status", "completed")
            except Exception:
                status = "completed"
            return "failed" if status == "failed" else "done"
        metrics = d / "metrics.jsonl"
        if metrics.exists():
            import time

            recent = (time.time() - metrics.stat().st_mtime) < self._LIVE_WINDOW_S
            return "running" if recent else "done"
        return "unknown"

    def _summary_for(self, d: Path) -> RunSummary:
        """Build a RunSummary from the run dir: model = first id segment, created_at =
        dir mtime (UTC), last step/metrics from the tail of metrics.jsonl, artifact
        names from ``artifacts/``."""
        rid = str(d.relative_to(self.base))
        rows = read_jsonl(d / "metrics.jsonl")
        last_step, last_metrics = tail_latest(rows)
        artifacts_dir = d / "artifacts"
        names = sorted(p.name for p in artifacts_dir.iterdir()) if artifacts_dir.exists() else []
        created = datetime.fromtimestamp(d.stat().st_mtime, tz=timezone.utc).isoformat()
        return RunSummary(
            id=rid,
            model=Path(rid).parts[0],
            source="local",
            status=self._status(d),
            run_name=d.name,
            created_at=created,
            last_step=last_step,
            last_metrics=last_metrics,
            artifact_names=names,
        )

    def list_runs(self) -> list[RunSummary]:
        """Every run directory under the base, sorted by model then timestamp."""
        return [self._summary_for(d) for d in self._iter_run_dirs()]

    def get_metrics(self, run_id: str, since: int | None = None) -> MetricsResponse:
        d = self._resolve(run_id)
        # Reads <run>/metrics.jsonl; a missing file yields empty series.
        return _series_response(run_id, read_jsonl(d / "metrics.jsonl"), since)

    def get_config(self, run_id: str) -> ConfigResponse:
        d = self._resolve(run_id)
        # <run>/config.yaml as written by Logger; {} when absent or empty.
        cfg_path = d / "config.yaml"
        config = yaml.safe_load(cfg_path.read_text()) if cfg_path.exists() else {}
        return ConfigResponse(run_id=run_id, config=config or {})

    def get_summary(self, run_id: str) -> SummaryResponse:
        d = self._resolve(run_id)
        # <run>/summary.json; {} when the trainer never wrote one.
        import json

        s_path = d / "summary.json"
        summary = json.loads(s_path.read_text()) if s_path.exists() else {}
        return SummaryResponse(run_id=run_id, summary=summary or {})

    def open_artifact(self, run_id: str, name: str) -> tuple[Path, str]:
        d = self._resolve(run_id)
        # Resolve and require the result to stay inside <run>/artifacts/, so a
        # name like "../config.yaml" cannot escape the artifacts folder.
        path = (d / "artifacts" / name).resolve()
        artifacts_root = (d / "artifacts").resolve()
        if artifacts_root not in path.parents or not path.exists():
            raise RunNotFound(f"{run_id}/{name}")
        media = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        return path, media


# --------------------------------------------------------------------------- #
# MLflow, read via MlflowClient on MN_MLFLOW_TRACKING_URI (the global tracker's
# HTTP URL in the cloud contract, or a local sqlite:/// URI in dev)
# --------------------------------------------------------------------------- #
_MLFLOW_STATUS = {
    "RUNNING": "running",
    "FINISHED": "done",
    "FAILED": "failed",
    "KILLED": "failed",
    "SCHEDULED": "pending",
}


class MLflowSource(RunSource):
    """Runs of one MLflow experiment, read through ``MlflowClient``.

    Tracker: ``tracking_uri`` or ``$MN_MLFLOW_TRACKING_URI``; experiment:
    ``experiment`` or ``$MN_MLFLOW_EXPERIMENT`` (default ``mini-networks``).
    mlflow is imported on construction, so it needs the ``cloud`` extra only
    when selected. Run ids are MLflow run ids.
    """

    def __init__(self, tracking_uri: str | None = None, experiment: str | None = None):
        from mlflow.tracking import MlflowClient

        self._client = MlflowClient(tracking_uri=tracking_uri or os.environ.get("MN_MLFLOW_TRACKING_URI"))
        self._experiment = experiment or os.environ.get("MN_MLFLOW_EXPERIMENT", "mini-networks")

    def _exp_id(self) -> str | None:
        """Experiment id for the configured name, or None if it does not exist yet."""
        exp = self._client.get_experiment_by_name(self._experiment)
        return exp.experiment_id if exp else None

    def _get_run(self, run_id: str):
        """``MlflowClient.get_run``, with any client error mapped to RunNotFound."""
        try:
            return self._client.get_run(run_id)
        except Exception:
            raise RunNotFound(run_id)

    def _summary_for(self, run) -> RunSummary:
        """Normalize an MLflow run. The model comes from the parent dir of the
        ``run_dir`` tag the Logger sets, else the run-name prefix before ``-``.
        ``last_metrics`` = MLflow's latest value per key; ``last_step`` is not
        tracked (None); artifact names are the top-level artifact paths."""
        tags = run.data.tags or {}
        run_dir = tags.get("run_dir", "")
        model = Path(run_dir).parent.name if run_dir else (run.info.run_name or "").split("-")[0]
        created = (
            datetime.fromtimestamp(run.info.start_time / 1000, tz=timezone.utc).isoformat()
            if run.info.start_time
            else None
        )
        return RunSummary(
            id=run.info.run_id,
            model=model or "unknown",
            source="mlflow",
            status=_MLFLOW_STATUS.get(run.info.status, "unknown"),
            run_name=run.info.run_name,
            created_at=created,
            last_step=None,
            last_metrics={k: float(v) for k, v in (run.data.metrics or {}).items()},
            artifact_names=[a.path for a in self._client.list_artifacts(run.info.run_id)],
        )

    def list_runs(self) -> list[RunSummary]:
        """All runs in the configured experiment; ``[]`` when it does not exist."""
        exp_id = self._exp_id()
        if exp_id is None:
            return []
        return [self._summary_for(r) for r in self._client.search_runs([exp_id])]

    def get_metrics(self, run_id: str, since: int | None = None) -> MetricsResponse:
        run = self._get_run(run_id)
        # One get_metric_history call per logged key, flattened back to the LONG
        # row format so the local and MLflow paths share the same pivot.
        rows: list[dict] = []
        for key in (run.data.metrics or {}):
            for m in self._client.get_metric_history(run_id, key):
                rows.append({"step": m.step, "key": key, "value": m.value})
        return _series_response(run_id, rows, since)

    def get_config(self, run_id: str) -> ConfigResponse:
        run = self._get_run(run_id)
        # MLflow params are strings, so config values here are str, not typed.
        return ConfigResponse(run_id=run_id, config=dict(run.data.params or {}))

    def get_summary(self, run_id: str) -> SummaryResponse:
        run = self._get_run(run_id)
        # The run's tags minus MLflow's own ``mlflow.*`` system tags.
        tags = {k: v for k, v in (run.data.tags or {}).items() if not k.startswith("mlflow.")}
        return SummaryResponse(run_id=run_id, summary=tags)

    def open_artifact(self, run_id: str, name: str) -> tuple[Path, str]:
        self._get_run(run_id)
        # MLflow downloads the artifact to a local temp dir; that path is served.
        try:
            local = self._client.download_artifacts(run_id, name)
        except Exception:
            raise RunNotFound(f"{run_id}/{name}")
        media = mimetypes.guess_type(name)[0] or "application/octet-stream"
        return Path(local), media


# --------------------------------------------------------------------------- #
# Composite: persistent source ∪ in-memory job store (cloud dispatched stubs)
# --------------------------------------------------------------------------- #
# JobStatus.status values already match RunStatus; anything else maps to "unknown".
_JOBSTATUS = {"pending": "pending", "running": "running", "done": "done",
              "failed": "failed", "dispatched": "dispatched"}


class CompositeSource(RunSource):
    """``persistent`` (local or MLflow) plus in-memory API jobs it does not know yet.

    Lets a freshly ``POST /train``-ed (or cloud-``dispatched``) job appear in
    the run list before the persistent store has a record of it; such jobs
    report ``source="jobstore"``, empty metrics/config and a ``{"status"}``
    summary. Every read tries the persistent source first. Artifacts are only
    ever served from the persistent source.
    """

    def __init__(self, persistent: RunSource):
        self._persistent = persistent

    def list_runs(self) -> list[RunSummary]:
        from mini_networks.api.dependencies import list_jobs

        runs = self._persistent.list_runs()
        # A job is skipped once its id matches a persistent run's id or run_name
        # (cloud runs are dispatched with run_name = job id).
        known = {r.run_name for r in runs if r.run_name} | {r.id for r in runs}
        for job in list_jobs():
            if job.job_id in known:
                continue  # persistent store already has the authoritative status
            tail = {m["key"]: float(m["value"]) for m in job.metrics_tail
                    if isinstance(m.get("value"), (int, float))}
            runs.append(RunSummary(
                id=job.job_id, model=job.model, source="jobstore",
                status=_JOBSTATUS.get(job.status, "unknown"), run_name=job.job_id,
                last_metrics=tail,
            ))
        return runs

    def get_metrics(self, run_id: str, since: int | None = None) -> MetricsResponse:
        try:
            return self._persistent.get_metrics(run_id, since)
        except RunNotFound:
            self._require_job(run_id)
            return MetricsResponse(run_id=run_id, series=[], latest_step=None)

    def get_config(self, run_id: str) -> ConfigResponse:
        try:
            return self._persistent.get_config(run_id)
        except RunNotFound:
            self._require_job(run_id)
            return ConfigResponse(run_id=run_id, config={})

    def get_summary(self, run_id: str) -> SummaryResponse:
        try:
            return self._persistent.get_summary(run_id)
        except RunNotFound:
            job = self._require_job(run_id)
            return SummaryResponse(run_id=run_id, summary={"status": job.status})

    def open_artifact(self, run_id: str, name: str) -> tuple[Path, str]:
        return self._persistent.open_artifact(run_id, name)

    def _require_job(self, run_id: str):
        """The in-memory JobStatus for ``run_id``, else RunNotFound."""
        from mini_networks.api.dependencies import get_job

        job = get_job(run_id)
        if job is None:
            raise RunNotFound(run_id)
        return job


def get_run_source() -> RunSource:
    """FastAPI dependency: a CompositeSource over MLflowSource when
    ``MN_RUN_SOURCE=mlflow``, else over LocalRunsSource (the default).

    Built per request, so env changes take effect without a restart.
    """
    kind = os.environ.get("MN_RUN_SOURCE", "local")
    persistent: RunSource = MLflowSource() if kind == "mlflow" else LocalRunsSource()
    return CompositeSource(persistent)
