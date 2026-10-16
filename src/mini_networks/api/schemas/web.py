"""Read-layer response schemas — normalized so the frontend is source-agnostic.

The same shapes are returned whether a run is read from the local ``runs/``
directory, from MLflow (``MN_RUN_SOURCE=mlflow``), or from the in-memory job store.
"""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

RunSourceName = Literal["local", "mlflow", "jobstore"]
RunStatus = Literal["pending", "running", "done", "failed", "dispatched", "unknown"]


class RunSummary(BaseModel):
    """One run in ``GET /web/runs``.

    ``id`` is ``<model>/<timestamp>`` for local runs, the MLflow run id for
    MLflow runs, and the job id for job-store entries. ``last_metrics`` holds
    the latest numeric value per metric key (local: values at ``last_step``);
    ``last_step`` is None for MLflow runs.
    """

    id: str
    model: str
    source: RunSourceName
    status: RunStatus
    run_name: str | None = None  # last path component / MLflow run name — dedup key
    created_at: str | None = None
    last_step: int | None = None
    last_metrics: dict[str, float] = Field(default_factory=dict)
    artifact_names: list[str] = Field(default_factory=list)


class MetricSeries(BaseModel):
    """One metric key's ``(step, value)`` points, sorted by step."""

    key: str
    points: list[tuple[int, float]]


class MetricsResponse(BaseModel):
    """``GET /web/runs/{id}/metrics``: one series per key; ``latest_step`` = highest step returned."""

    run_id: str
    series: list[MetricSeries] = Field(default_factory=list)
    latest_step: int | None = None


class ConfigResponse(BaseModel):
    """``GET /web/runs/{id}/config``: local ``config.yaml`` or MLflow params (string values)."""

    run_id: str
    config: dict[str, Any] = Field(default_factory=dict)


class SummaryResponse(BaseModel):
    """``GET /web/runs/{id}/summary``: local ``summary.json``, MLflow non-system tags, or ``{"status"}`` for a job."""

    run_id: str
    summary: dict[str, Any] = Field(default_factory=dict)


class ModelInfo(BaseModel):
    """One registry model in ``GET /web/models``: its config JSON schema and default values.

    The endpoint also returns taxonomy fields (level/introduces/builds_on) that
    this schema does not declare, so response filtering drops them.
    """

    name: str
    family: str | None = None
    config_schema: dict[str, Any] = Field(default_factory=dict)
    defaults: dict[str, Any] = Field(default_factory=dict)


class RunListResponse(BaseModel):
    """``GET /web/runs``: every run the active RunSource lists, plus job-store entries."""

    runs: list[RunSummary] = Field(default_factory=list)


class ModelEvidence(BaseModel):
    """Proof-it-works signals per model — what the playground flags/faces encode."""

    name: str
    champion: bool = False                    # pulled Production checkpoint under runs/champions/<model>
    champion_version: str | None = None       # registry version from champions/<model>/VERSION
    gate_metric: str | None = None            # EvalSpec.metric (None = S-style checks only)
    threshold_m: float | None = None          # M-tier gate bar
    higher_is_better: bool = True
    provisional: bool = False                 # bar not yet validated by an M cloud sweep
    run_count: int = 0
    best_metric: float | None = None          # best gate_metric across listed M/L runs, by direction


class EvidenceResponse(BaseModel):
    """``GET /web/evidence``: one ModelEvidence row per registered model, in registry order."""

    models: list[ModelEvidence] = Field(default_factory=list)


class FeedbackIn(BaseModel):
    """A note from the owner on a /lab page: text + pasted pictures + where they were."""

    skin: str
    url: str
    text: str = ""
    viewport: tuple[int, int] | None = None
    images: list[str] = Field(default_factory=list)  # data URLs (image/png|jpeg|webp|gif)


class FeedbackNote(BaseModel):
    """A stored lab note (``note.json``), with ``status`` / ``reply`` overlaid from ``status.json``."""

    id: str
    created_at: str
    skin: str
    url: str
    text: str
    viewport: tuple[int, int] | None = None
    images: list[str] = Field(default_factory=list)   # file names inside the note folder
    status: str = "new"                               # new | relayed | addressed
    reply: str | None = None


class FeedbackList(BaseModel):
    """``GET /web/feedback``: every stored note, newest first."""

    notes: list[FeedbackNote] = Field(default_factory=list)
