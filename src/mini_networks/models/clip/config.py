"""Config for mini CLIP: MNIST digits paired with char-level text captions.

Defaults: 128-d shared embedding, a 2-layer / 2-head / 64-d text Transformer
over 32 byte-level tokens, initial temperature 0.07 (learned thereafter).
"""
from __future__ import annotations
from mini_networks.core.config import BaseConfig


class CLIPConfig(BaseConfig):
    """Contrastive image-text model; both towers project into `embed_dim`."""

    model_name: str = "clip"
    embed_dim: int = 128       # shared image/text embedding size (L2-normalised)
    image_size: int = 28       # informational: the image tower is a CNN, no patching
    patch_size: int = 4        # unused by the CNN image encoder (kept for config compat)
    vocab_size: int = 256      # byte-level: token id = ord(char) % vocab_size, 0 = pad
    text_seq_len: int = 32     # captions padded/truncated to this many tokens
    text_d_model: int = 64
    text_n_heads: int = 2
    text_n_layers: int = 2
    temperature: float = 0.07  # INITIAL softmax temperature; learned as log(1/T)
    dataset: str = "mnist"     # the loader is MNIST-only (task="clip") regardless
