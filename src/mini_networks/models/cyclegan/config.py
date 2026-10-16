from __future__ import annotations
from mini_networks.core.config import BaseConfig


class CycleGANConfig(BaseConfig):
    model_name: str = "cyclegan"
    image_size: int = 28
    in_channels: int = 1
    # CycleGAN (Zhu et al. 2017) learns UNPAIRED translation between two image
    # domains A and B with no example pairs: two generators G:A->B and F:B->A and
    # two PatchGAN discriminators. The `gan` mini has ONE generator matching a
    # single distribution; the whole delta here is the cycle-consistency
    # constraint that makes an unpaired mapping well-posed (junyanz
    # cycle_gan_model.py:114-180).
    #
    # Toy domains kept CPU-tier: domain A = MNIST digits, domain B = FashionMNIST
    # clothes, both 28x28 grayscale. There is no "correct" pairing between a 7 and
    # a sneaker — exactly the unpaired setting the cycle loss is built for.
    dataset_a: str = "mnist"
    dataset_b: str = "fashion_mnist"
    ngf: int = 16  # generator base width (tiny: 2 resnet blocks over a 7x7 map)
    ndf: int = 16  # PatchGAN discriminator base width
    n_resnet_blocks: int = 2
    # lambda_cycle: weight on the cycle-consistency L1 loss ‖F(G(a)) - a‖ + the
    # reverse. 10.0 is the paper default (cycle_gan_model.py:56) — it dominates
    # the objective so the two generators must be near-inverses of each other,
    # which is what stops G from ignoring its input and just emitting a
    # convincing B-sample (mode collapse into the target domain).
    lambda_cycle: float = 10.0
    # lambda_identity: weight (as a fraction of lambda_cycle) on the identity loss
    # ‖G(b) - b‖: feeding a real B into the A->B generator should return it
    # unchanged. Regularizes color/tone; 0.5 is the paper default
    # (cycle_gan_model.py:57, applied as lambda_cycle * lambda_identity).
    lambda_identity: float = 0.5
    # image_pool_size: the history buffer of past fakes used for D updates. The
    # discriminator trains against a 50-image mix of current and previous
    # generator outputs (junyanz util/image_pool.py) so it can't overfit to the
    # single latest batch — a cheap, load-bearing stabilizer.
    image_pool_size: int = 50
    lr: float = 2e-4
    dataset: str = "mnist"  # BaseConfig field; unused (we load A and B explicitly)
