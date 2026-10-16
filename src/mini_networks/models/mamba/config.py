"""Config for NanoMamba: model width, depth, conv kernel and (unused) state size."""
from __future__ import annotations
from mini_networks.core.config import BaseConfig


class MambaConfig(BaseConfig):
    """Hyperparameters for :class:`NanoMamba`.

    ``d_conv`` is the causal depthwise conv kernel size. ``d_state`` is
    accepted but not used by the simplified scan (one scalar state per
    channel). ``vocab_size`` is a fallback replaced by the dataset
    tokenizer's size on real text.
    """
    model_name: str = "mamba"
    d_model: int = 128
    n_layers: int = 4
    d_state: int = 16
    d_conv: int = 4
    seq_len: int = 128
    vocab_size: int = 256
    dropout: float = 0.1
    dataset: str = "text_file"
    text_file: str = ""
