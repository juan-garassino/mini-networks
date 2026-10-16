"""Config for the tabular classifiers (linear / MLP / Transformer) on Iris-sized data."""
from __future__ import annotations
from typing import Literal
from mini_networks.core.config import BaseConfig


class TabularClassifierConfig(BaseConfig):
    """Hyperparameters for the tabular classifier ladder.

    ``model_type`` picks TabularLinear, TabularMLP or TabularTransformer;
    ``hidden_dim`` is the MLP width or the Transformer's d_model. With
    ``require_downloads=True`` the Iris CSV must be downloadable (or already
    cached under ``data_root``).
    """
    model_name: str = "tabular_classifier"
    n_features: int = 4
    n_classes: int = 3
    model_type: Literal["mlp", "linear", "transformer"] = "mlp"
    hidden_dim: int = 64
    dataset: str = "iris"
    require_downloads: bool = True
