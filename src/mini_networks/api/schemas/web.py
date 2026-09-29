"""Read-layer response schemas — normalized so the frontend is source-agnostic.

The same shapes are returned whether a run is read from the local ``runs/``
directory, from MLflow (Neon + GCS), or from the in-memory job store.
"""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

RunSourceName = Literal["local", "mlflow", "jobstore"]
RunStatus = Literal["pending", "running", "done", "failed", "dispatched", "unknown"]


class RunSummary(BaseModel):
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
    key: str
    points: list[tuple[int, float]]


class MetricsResponse(BaseModel):
    run_id: str
    series: list[MetricSeries] = Field(default_factory=list)
    latest_step: int | None = None


class ConfigResponse(BaseModel):
    run_id: str
    config: dict[str, Any] = Field(default_factory=dict)


class SummaryResponse(BaseModel):
    run_id: str
    summary: dict[str, Any] = Field(default_factory=dict)


class ModelInfo(BaseModel):
    name: str
    family: str | None = None
    config_schema: dict[str, Any] = Field(default_factory=dict)
    defaults: dict[str, Any] = Field(default_factory=dict)


class RunListResponse(BaseModel):
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
    models: list[ModelEvidence] = Field(default_factory=list)


class FeedbackIn(BaseModel):
    """A note from the owner on a /lab page: text + pasted pictures + where they were."""

    skin: str
    url: str
    text: str = ""
    viewport: tuple[int, int] | None = None
    images: list[str] = Field(default_factory=list)  # data URLs (image/png|jpeg|webp|gif)


class FeedbackNote(BaseModel):
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
    notes: list[FeedbackNote] = Field(default_factory=list)
