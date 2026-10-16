"""Shared base configuration using Pydantic v2."""
from __future__ import annotations

import os
from typing import Literal

from pydantic import BaseModel, Field


class BaseConfig(BaseModel):
    """Fields every model config shares, plus the tier-aware budget accessors.

    Trainers must read budgets through the ``effective_*`` / ``max_*``
    properties (never the raw ``epochs``/``batch_size`` fields) so every code
    path honours the S/M/L caps in ``core/tiers.py``. ``fast_demo=True``
    forces tier S regardless of ``training_tier``.
    """

    model_name: str = "base"  # also the key for per-model overrides in core/tiers.py
    data_root: str = Field(default_factory=lambda: os.path.join(os.getcwd(), "data"))
    output_dir: str = Field(default_factory=lambda: os.path.join(os.getcwd(), "runs"))
    checkpoint_root: str = Field(default_factory=lambda: os.path.join(os.getcwd(), "runs"))
    run_name: str | None = None
    resume: bool = True
    training_tier: Literal["S", "M", "L"] = "M"  # S nano smoke / M "learns" bar / L full
    batch_size: int = 32
    epochs: int = 10
    learning_rate: float = 1e-3
    device: str = "cpu"
    seed: int = 42
    fast_demo: bool = False
    # Optional global gradient clipping (None = off). Stability knob for M/L
    # triage; per-model defaults belong in the model's Config subclass.
    max_grad_norm: float | None = None

    @property
    def effective_tier(self) -> Literal["S", "M", "L"]:
        """The tier actually in force: "S" when ``fast_demo`` is set, else ``training_tier``."""
        return "S" if self.fast_demo else self.training_tier

    @property
    def effective_fast_demo(self) -> bool:
        """True when running at tier S (via ``fast_demo`` or ``training_tier="S"``)."""
        return self.effective_tier == "S"

    def _budget(self, key: str) -> int | None:
        """Look up ``key`` in the tier table for this model + effective tier (None = uncapped)."""
        # Lazy import keeps config importable without pulling the tier table early.
        from mini_networks.core.tiers import budget
        return budget(self.model_name, self.effective_tier, key)

    @property
    def effective_epochs(self) -> int:
        """``epochs`` capped by the tier budget (per-model overrides applied)."""
        cap = self._budget("epochs")
        return self.epochs if cap is None else min(self.epochs, cap)

    @property
    def effective_batch_size(self) -> int:
        """``batch_size`` capped by the tier's ``batch_cap``."""
        cap = self._budget("batch_cap")
        return self.batch_size if cap is None else min(self.batch_size, cap)

    @property
    def dataset_sample_limit(self) -> int | None:
        """Max dataset items to load at this tier (None = whole dataset)."""
        return self._budget("sample_limit")

    def tier_epochs(self, full_epochs: int, medium_cap: int = 2) -> int:
        """Scale a caller-supplied epoch count by tier: S -> 1, M -> min(full, medium_cap), L -> full.

        Independent of the tier table; used where a trainer has its own epoch
        notion separate from ``epochs``.
        """
        if self.effective_tier == "S":
            return 1
        if self.effective_tier == "M":
            return min(full_epochs, medium_cap)
        return full_epochs

    @property
    def max_train_batches(self) -> int | None:
        """Per-epoch cap on training batches at this tier (None = uncapped)."""
        return self._budget("train_batches")

    @property
    def max_eval_batches(self) -> int | None:
        """Cap on evaluation batches at this tier (None = uncapped)."""
        return self._budget("eval_batches")

    def limit_steps(self, full_steps: int, s_cap: int, m_cap: int) -> int:
        """Cap a step-based budget by tier: min(full, s_cap) at S, min(full, m_cap) at M, full at L."""
        if self.effective_tier == "S":
            return min(full_steps, s_cap)
        if self.effective_tier == "M":
            return min(full_steps, m_cap)
        return full_steps

    @property
    def effective_timesteps(self) -> int:
        """Tier-capped diffusion chain length. Subclasses define `timesteps`;
        train and sample must both use this so the noise chain is consistent."""
        full = getattr(self, "timesteps", 0)
        cap = self._budget("timesteps")
        return full if cap is None else min(full, cap)
