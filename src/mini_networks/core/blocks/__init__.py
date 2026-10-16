"""Shared building blocks — the few pieces of code models genuinely share.

The zoo's convention is SELF-CONTAINED model files (copy-paste over
abstraction, so each model.py reads as one lesson); a block graduates here
only when it is an exact duplicate or an awkward cross-model import.

Inventory (consumers per block):
  cnn.py        ConvBNReLU            classifier, vision_embed, mobilenet (blocks),
                                      convnext
                DepthwiseSeparable    mobilenet
  mlp.py        MLP                   tabular_classifier
  norm.py       RMSNorm               kimi, deepseek
  ema.py        EMA                   diffusion, gan, wgan (trainers), gan_ada
  ssm.py        MambaBlock            mamba (re-exported), transformer's
                                      block_type="mamba" FFN (via .mix())
  attention.py  TransformerEncoderBlock   (no consumers — deletion candidate,
                                          kept pending an owner decision)

Training-side building blocks live beside this package: core/optim.py
(LR schedules: constant / warmup+cosine, chosen by config.lr_schedule).

Same-mechanism, deliberately NOT unified (variants differ): dice_loss
(segmentation vs sam reductions), InfoNCE (simclr vs clip), Fourier
features (sam random-gaussian vs nerf geometric), SiTU-GLU (kimi-only).
The conceptual sharing is recorded in core/taxonomy.py instead.
"""
