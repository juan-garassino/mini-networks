"""Shared diffusion sampling loop with optional guidance hooks."""
from __future__ import annotations

from typing import Callable, Any

import torch


PredictFn = Callable[[torch.Tensor, torch.Tensor, int, dict[str, Any] | None], torch.Tensor]
GuidanceFn = Callable[
    [torch.Tensor, torch.Tensor, int, torch.Tensor, dict[str, Any] | None], torch.Tensor
]
StepCallback = Callable[[torch.Tensor, int, int, dict[str, Any] | None], torch.Tensor | None]


def sample_loop(
    *,
    scheduler,
    predict_noise: PredictFn,
    shape: tuple[int, ...],
    device: str | torch.device,
    timesteps: int,
    seed: int | None = None,
    guidance_fn: GuidanceFn | None = None,
    step_callback: StepCallback | None = None,
    state: dict[str, Any] | None = None,
    logger: Any | None = None,
    log_every: int = 0,
) -> torch.Tensor:
    """Run the reverse diffusion chain from pure noise and return ``x_0``.

    Starts at ``x_T ~ N(0, I)`` with ``shape`` and walks ``t = timesteps-1 .. 0``.
    Pass ``config.effective_timesteps`` as ``timesteps`` so the chain matches
    the one the scheduler was built (and trained) with.

    Args:
        scheduler: object with ``step(eps, t, x) -> x_{t-1}``.
        predict_noise: ``(x, t_batch, t, state) -> eps``.
        guidance_fn: optional ``(x, t_batch, t, eps, state) -> eps`` hook
            (e.g. classifier / CFG guidance) applied before each step.
        step_callback: optional ``(x, t, step_idx, state)``; a non-None return
            replaces ``x`` (e.g. inpainting re-projection).
        state: free-form dict threaded through every hook.
        seed: if set, reseeds the global torch RNG before drawing ``x_T``.
        logger / log_every: when both set, log ``sample_t`` every
            ``log_every`` steps via ``logger.log_metrics``.
    """
    if seed is not None:
        torch.manual_seed(seed)
    x = torch.randn(shape, device=device)
    batch = shape[0]
    for step_idx, t in enumerate(reversed(range(timesteps))):
        t_batch = torch.full((batch,), t, device=device, dtype=torch.long)
        eps = predict_noise(x, t_batch, t, state)
        if guidance_fn is not None:
            eps = guidance_fn(x, t_batch, t, eps, state)
        x = scheduler.step(eps, t, x)
        if logger is not None and log_every and step_idx % log_every == 0:
            logger.log_metrics(step_idx, {"sample_t": int(t), "step": step_idx})
        if step_callback is not None:
            updated = step_callback(x, t, step_idx, state)
            if updated is not None:
                x = updated
    return x
