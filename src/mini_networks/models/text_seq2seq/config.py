"""Config for the encoder-decoder Transformer on the src/tgt-halves text task."""
from __future__ import annotations
from mini_networks.core.config import BaseConfig


class TextSeq2SeqConfig(BaseConfig):
    """Hyperparameters for :class:`Seq2SeqTransformer`.

    ``n_layers`` is used for both the encoder and the decoder. ``seq_len`` is
    the full text window: the source and target are its two halves.
    ``vocab_size`` is a fallback replaced by the dataset's vocabulary size.
    """
    model_name: str = "text_seq2seq"
    d_model: int = 64
    n_heads: int = 2
    n_layers: int = 2
    d_ff: int = 128
    seq_len: int = 64
    vocab_size: int = 256
    dataset: str = "text_file"
    text_file: str = ""
