"""Composition request/response schemas for the /compose router."""
from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel


class ComposeTrainRequest(BaseModel):
    """Body of ``POST /compose/{composition}``: shared hyperparameters + ``extra`` overrides.

    The fields (and ``output_dir``) are merged with ``extra`` into the
    composition's own config class, so ``extra`` keys must be fields of it.
    """

    epochs: int = 5
    batch_size: int = 32
    learning_rate: float = 1e-3
    fast_demo: bool = False
    data_root: str = "/tmp/mini_networks_data"
    device: str = "cpu"
    seed: int = 42
    # Composition-specific overrides
    extra: dict[str, Any] = {}


class ComposeTrainResponse(BaseModel):
    """A started composition job: its id (``<composition>-<UTC ts>``) and run directory."""

    job_id: str
    status: str = "started"
    output_dir: str


class ComposeInferRequest(BaseModel):
    """Body of ``POST /compose/{composition}/infer``.

    ``inputs`` keys are composition-specific (e.g. ``prompt``, ``n_samples``,
    ``max_new_tokens``, ``images``). ``checkpoint`` only keys the pipeline cache;
    it is not loaded.
    """

    inputs: dict[str, Any] = {}
    checkpoint: Optional[str] = None


class ComposeInferResponse(BaseModel):
    """Composition output with tensors converted to nested lists.

    ``outputs`` is a dict, list or scalar depending on the composition; some
    return ``{"status": "trained"}`` as a placeholder.
    """

    composition: str
    outputs: dict[str, Any] | list | str | int | float | None
