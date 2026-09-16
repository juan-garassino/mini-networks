from __future__ import annotations
from mini_networks.core.config import BaseConfig


class WGANConfig(BaseConfig):
    model_name: str = "wgan"
    latent_dim: int = 100
    image_size: int = 28
    in_channels: int = 1
    # WGAN (Arjovsky et al. 2017) trades the vanilla GAN's JS-divergence game
    # for the Wasserstein distance — the minimal fix to the mode collapse the
    # `gan` mini shows on purpose. Three deltas vs `gan`, all below:
    #   1. weight clipping  2. n_critic schedule  3. RMSProp (not Adam).
    # The clip bound: clamp each critic weight to [-c, c] to enforce the
    # 1-Lipschitz constraint the Wasserstein dual needs (WassersteinGAN
    # main.py:184-186, defaults ±0.01). Too large -> constraint slack, loss
    # stops tracking distance; too small -> vanishing gradients / capacity loss.
    clip_value: float = 0.01
    # n_critic: critic (D) steps per generator (G) step. The paper trains the
    # critic near-optimal before each G step so the Wasserstein estimate is
    # accurate (main.py:174-181). 5 is the paper default.
    n_critic: int = 5
    # n_critic_warmup: for the first `warmup_gen_iters` generator iterations
    # (and periodically) the critic is trained harder — main.py:174-181 uses
    # 100 steps for gen_iter < 25 and every 500th. Kept modest here so a CPU
    # mini run stays cheap; the schedule is the teachable part, not the count.
    n_critic_warmup: int = 20
    warmup_gen_iters: int = 25
    # RMSProp over Adam: the paper reports momentum destabilizes the critic,
    # so Adam is opt-in behind a flag (main.py:156-162). lr 5e-5 is the paper's.
    lr: float = 5e-5
    use_adam: bool = False
    dataset: str = "mnist"
