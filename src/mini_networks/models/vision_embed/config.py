"""Config for the CNN embedding model: embedding size and contrastive temperature."""
from __future__ import annotations
from mini_networks.core.config import BaseConfig


class VisionEmbedConfig(BaseConfig):
    """Hyperparameters for :class:`VisionEmbedCNN`; ``temperature`` scales the similarity logits in the contrastive loss."""
    model_name: str = "vision_embed"
    embed_dim: int = 64
    temperature: float = 0.2
    dataset: str = "mnist"
