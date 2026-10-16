"""RAG-conditioned diffusion: a retrieved-and-generated prompt drives an image model.

A composition of compositions — it chains two existing pipelines end to end:

    1. RAGGuidedGeneration: TF-IDF retrieval over the text corpus + a char
       TransformerLM continue ``prompt_seed`` (16 new characters)
    2. CLIPGuidedDiffusion.text_to_image: CLIP maps that text to the nearest
       digit class, and the class-conditional DDPM draws it with CFG

What it demonstrates: modules that speak "text" can be piped into one
another — a language pipeline produces the prompt that conditions a vision
pipeline, with no joint training.

Deliberately simplified — and worth reading literally: the RAG step returns
its WHOLE decoded sequence (the ``"[Context: <retrieved chunks>] <seed>"``
prompt followed by the continuation; characters outside the corpus
vocabulary decode to nothing), and ``text_to_class`` reads only its first
``text_seq_len`` (32) characters. So the digit chosen is decided by the
"Context:" prefix plus the start of the top retrieved chunk, not by the
generated words. The CLIP router only knows digit captions, so arbitrary
Shakespeare text maps to whichever digit embedding is closest; the result
is a plumbing demo, not semantic text-to-image.
"""
from __future__ import annotations

from mini_networks.core.logging.logger import Logger
from mini_networks.compositions.rag_guided_generation import (
    RAGGuidedGeneration,
    RAGGuidedGenerationConfig,
)
from mini_networks.compositions.clip_guided_diffusion import (
    CLIPGuidedDiffusion,
    CLIPGuidedDiffusionConfig,
)


class RAGConditionedDiffusionConfig(CLIPGuidedDiffusionConfig):
    """All CLIPGuidedDiffusion knobs plus ``prompt_seed`` (the RAG query).

    The RAG half runs on RAGGuidedGenerationConfig defaults; only
    ``fast_demo``, ``training_tier``, ``data_root`` and ``device`` are
    forwarded to it.
    """

    model_name: str = "rag_conditioned_diffusion"
    prompt_seed: str = "To be or not to be"


class RAGConditionedDiffusion:
    """RAGGuidedGeneration feeding CLIPGuidedDiffusion."""

    def __init__(self):
        """Hold one instance of each sub-pipeline."""
        self.rag = RAGGuidedGeneration()
        self.diff = CLIPGuidedDiffusion()

    def train(self, config: RAGConditionedDiffusionConfig, logger: Logger) -> None:
        """Train the RAG language model, then CLIP (+VAE) + diffusion, into one run.

        Both halves share ``logger``, so the run directory holds the RAG
        artifacts (``model.pt``, ``tokenizer.json``) next to ``clip.pt`` /
        ``unet.pt`` (and ``vae.pt`` when ``use_vae``).
        """
        rag_cfg = RAGGuidedGenerationConfig(
            fast_demo=config.fast_demo,
            training_tier=config.training_tier,
            data_root=config.data_root,
            device=config.device,
        )
        self.rag.train(rag_cfg, logger)
        self.diff.train_all(config, logger)

    def sample(self, config: RAGConditionedDiffusionConfig) -> tuple:
        """Generate a prompt from ``prompt_seed``, then images for it.

        Returns:
            ``(images [4,1,28,28] in [0,1], prompt str)``.
        """
        prompt = self.rag.generate(
            RAGGuidedGenerationConfig(
                fast_demo=config.fast_demo,
                training_tier=config.training_tier,
                data_root=config.data_root,
                device=config.device,
            ),
            config.prompt_seed,
            max_new_tokens=16,
        )
        images, _class_id = self.diff.text_to_image(prompt, config)
        return images, prompt
