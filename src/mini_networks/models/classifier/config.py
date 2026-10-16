"""Config for the SmallCNN image classifier (MNIST by default; any 28x28 1-channel flavor)."""
from __future__ import annotations
from mini_networks.core.config import BaseConfig


class ClassifierConfig(BaseConfig):
    """SmallCNN on 28x28 grayscale images.

    `dataset` + `num_classes` select the flavor (e.g. fashion_mnist / kmnist
    with 10 classes, tri_mnist with 30) via `main.py train --dataset`.
    """

    model_name: str = "classifier"
    hidden_dim: int = 64     # width of the hidden Linear(3136 -> hidden_dim) layer
    num_classes: int = 10
    dataset: str = "mnist"
