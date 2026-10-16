"""Compositions: multi-model pipelines built from the zoo's atoms.

A model in ``models/`` teaches one mechanism; a composition wires two or more
of them together to show what the combination can do that neither can alone.
Each module here owns one pipeline and a ``<Name>Config(BaseConfig)``, so the
tier system (S/M/L budgets via ``config.effective_*``), Logger artifacts and
the quality gate apply exactly as for single models. The public entry points
are methods on the composition class — ``train`` / ``train_all`` / ``run``
to fit, then ``sample`` / ``generate`` / ``compare`` / ``infer`` to use —
dispatched by name through ``colab.runners.COMPOSITION_RUNNERS`` (sync-tested
against ``colab.catalog.COMPOSITIONS``).

The pipelines, grouped by the idea they demonstrate:

  guidance at sampling/training time
      classifier_guided_diffusion, clip_guided_diffusion, classifier_guided_gan,
      clip_guided_gan
  chaining models through text
      transformer_clip_diffusion, rag_guided_generation,
      rag_conditioned_diffusion
  compression and efficient training
      latent_diffusion, diffusion_distillation, lora_lm
  multimodal encoders
      audio_text_contrastive, audio_text_dual_encoder,
      tabular_text_cross_attention, tabular_text_dual_encoder,
      multimodal_fusion_baseline, image_captioning, vlm
  vision task structure
      multitask_vision, segment_then_detect
  side-by-side and phenomena
      gan_diffusion_comparison, mode_connect, double_descent
  RL meets language modelling
      rl_rlhf_maze (standalone; not in the catalog list)

``base.py`` holds the shared template for the four contrastive
(modality, caption) compositions. This package deliberately re-exports
nothing: import each composition from its own module.
"""
