"""Inference request/response schemas for the /infer router."""
from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel


class InferRequest(BaseModel):
    """Body of ``POST /infer/{model}``.

    Weights come from ``checkpoint`` (a path the trainer's ``load_checkpoint``
    accepts), else ``run_id`` (a local run's ``artifacts/``), else a pulled
    champion, else an untrained model. ``inputs`` is model-specific; list
    values under ``images`` / ``features`` become float tensors.
    ``n_samples`` / ``temperature`` fill ``inputs`` when absent there, and a
    non-empty ``prompt`` overrides ``inputs["prompt"]``.
    """

    checkpoint: Optional[str] = None
    run_id: Optional[str] = None  # resolve a local run's artifacts/ as the checkpoint
    inputs: dict[str, Any] = {}
    # Optional model-specific params
    n_samples: int = 4
    temperature: float = 1.0
    prompt: str = ""


class InferResponse(BaseModel):
    """The trainer's ``infer`` output dict, tensors converted to nested lists."""

    model: str
    outputs: dict[str, Any]
