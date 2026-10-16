"""Every registered model must have an inference probe.

`sweep --check` calls `_run_model_inference_probe` for each model; a model
without a branch there errors the whole gate item ("No inference probe
implemented"). This was the state of wgan/vqvae/cyclegan/swin/convlstm/dcrnn
after they were added. The trainer here is a stub — only the dispatch is
under test; real inference runs in the S-tier sweep.
"""
from __future__ import annotations

import pytest
import torch

from mini_networks.colab.probes import _run_model_inference_probe
from mini_networks.core.registry import MODEL_NAMES, get_model_registry


class _StubTrainer:
    def __init__(self):
        self.calls = []

    def infer(self, config, inputs):
        self.calls.append(inputs)
        return {"out": torch.ones(1)}


def _stub_batch(name: str):
    if name == "convlstm":
        return torch.zeros(2, 4, 1, 8, 8)  # clips [B, T, 1, H, W]
    return (torch.zeros(2, 1, 28, 28), torch.zeros(2, dtype=torch.long))


@pytest.mark.parametrize("name", MODEL_NAMES)
def test_every_model_has_an_inference_probe(name: str):
    ConfigClass, _, _ = get_model_registry()[name]
    config = ConfigClass(fast_demo=True)
    trainer = _StubTrainer()
    summary = _run_model_inference_probe(name, trainer, config, [_stub_batch(name)])
    assert trainer.calls, f"probe for {name} never called infer()"
    assert "out=" in summary
