"""Config for NanoRAG: retrieval (top_k, chunk size) and the size of the underlying
TransformerLM.
"""
from __future__ import annotations
from mini_networks.core.config import BaseConfig


class RAGConfig(BaseConfig):
    """Hyperparameters for :class:`NanoRAG` and its generator LM.

    The LM fields mirror ``TransformerConfig`` at a smaller default size;
    ``vocab_size`` is a fallback replaced by the dataset tokenizer's size.
    The TF-IDF index is built from the same ``text_file`` corpus the LM is
    trained on (Tiny Shakespeare when empty).
    """
    model_name: str = "rag"

    # Retrieval
    top_k: int = 3              # number of documents to retrieve
    chunk_size: int = 200       # characters per document chunk

    # Generation (uses TransformerLM underneath)
    d_model: int = 64
    n_layers: int = 2
    n_heads: int = 2
    d_ff: int = 128
    seq_len: int = 128
    vocab_size: int = 256
    dropout: float = 0.1

    dataset: str = "text_file"
    text_file: str = ""
