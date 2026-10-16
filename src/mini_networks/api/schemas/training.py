"""Training request/response schemas for the /train router (and the shared JobStatus)."""
from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel


class TrainRequest(BaseModel):
    """Body of ``POST /train/{model}``: shared hyperparameters + model ``extra`` overrides.

    Fields plus ``extra`` are validated through the model's config class.
    ``training_tier`` is forwarded only to the cloud JobSpec (``fast_demo``
    forces S there); local runs use the config's own ``training_tier``
    (default M, or ``extra["training_tier"]``), with ``fast_demo`` forcing S.
    """

    epochs: int = 5
    batch_size: int = 32
    learning_rate: float = 1e-3
    fast_demo: bool = False
    training_tier: str = "M"  # S|M|L; forwarded as the cloud JobSpec tier
    data_root: str = "/tmp/mini_networks_data"
    device: str = "cpu"
    seed: int = 42
    # Model-specific overrides
    extra: dict[str, Any] = {}


class TrainResponse(BaseModel):
    """A started job: id, ``started`` (local) or ``dispatched`` (cloud), and its run dir."""

    job_id: str
    status: str = "started"
    output_dir: str


class JobStatus(BaseModel):
    """In-memory state of a training or composition job started through this API.

    ``dispatched`` means published to Pub/Sub (``MN_TRAIN_BACKEND=cloud``); the
    API never hears back, so progress is read from MLflow via ``/web``.
    ``epoch`` / ``loss`` are set only if the last logged metric was that key;
    ``metrics_tail`` holds the last 5 logged rows; ``error`` is a traceback.
    """

    job_id: str
    model: str
    status: Literal["pending", "running", "done", "failed", "dispatched"]
    epoch: Optional[int] = None
    loss: Optional[float] = None
    error: Optional[str] = None
    output_dir: Optional[str] = None
    metrics_tail: list[dict] = []
