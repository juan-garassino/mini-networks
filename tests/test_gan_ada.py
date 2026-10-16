"""Unit + integration tests for the gan_ada composition (StyleGAN2-ADA port).

Three load-bearing behaviours, written test-first:
  1. the E[sign(D_real)] controller RAISES p when the overfitting signal r_t is
     high and LOWERS it when r_t is low/negative, always clamped to [0, 1];
  2. the augmentation pipeline fires at approximately rate p (statistical,
     seeded) and is shape-preserving (device-agnostic, CPU here);
  3. a one-step training smoke run updates p and produces no NaN.

The controller heuristic and the augmentation subset are the "ADA" idea; these
tests pin them independently of the full GAN training loop.
"""
import math
import os
import tempfile

import torch

from mini_networks.core.logging.logger import Logger
from mini_networks.compositions.gan_ada import (
    AdaptiveAugment,
    GANADA,
    GANADAConfig,
    ada_update_p,
)

DATA_ROOT = os.environ.get("MINI_TEST_DATA_ROOT", "/tmp/mini_networks_test_data")


# --------------------------------------------------------------- the controller

class TestADAController:
    """r_t = E[sign(D(x_real))]; p is nudged toward `target` each interval."""

    def test_raises_p_when_overfitting(self):
        # r_t well above target => D is confident on reals => overfitting =>
        # augment harder => p must go UP.
        p_new = ada_update_p(
            p=0.0, r_t=1.0, target=0.6, batch_size=64, interval=4, ada_kimg=100
        )
        assert p_new > 0.0

    def test_lowers_p_when_underfitting(self):
        # r_t below target (D not overfitting) => back off => p must go DOWN.
        p_new = ada_update_p(
            p=0.5, r_t=-1.0, target=0.6, batch_size=64, interval=4, ada_kimg=100
        )
        assert p_new < 0.5

    def test_negative_r_t_lowers_p(self):
        # A negative sign-mean is the strongest "not overfitting" signal.
        assert ada_update_p(0.3, -0.5, 0.6, 64, 4, 100) < 0.3

    def test_p_clamped_to_unit_interval(self):
        # Cannot fall below 0 …
        assert ada_update_p(0.0, -1.0, 0.6, 64, 4, 1) == 0.0
        # … nor climb above 1.
        assert ada_update_p(1.0, 1.0, 0.6, 64, 4, 1) == 1.0

    def test_step_scales_with_batch_and_interval(self):
        # The adjustment magnitude follows the StyleGAN2-ADA schedule
        # (batch*interval / (kimg*1000)); a bigger throughput => bigger step.
        small = ada_update_p(0.5, 1.0, 0.6, batch_size=8, interval=4, ada_kimg=100)
        large = ada_update_p(0.5, 1.0, 0.6, batch_size=64, interval=4, ada_kimg=100)
        assert (large - 0.5) > (small - 0.5) > 0.0

    def test_r_t_at_target_barely_moves(self):
        # sign-mean exactly at target => the adjustment sign is neutral (0 step).
        p_new = ada_update_p(0.5, 0.6, 0.6, 64, 4, 100)
        assert math.isclose(p_new, 0.5, abs_tol=1e-9)


# --------------------------------------------------------------- augmentation

class TestAdaptiveAugment:
    def test_shape_preserving(self):
        aug = AdaptiveAugment(p=1.0, seed=0)
        x = torch.randn(8, 1, 28, 28)
        out = aug(x)
        assert out.shape == x.shape
        assert out.dtype == x.dtype

    def test_p_zero_is_identity(self):
        aug = AdaptiveAugment(p=0.0, seed=0)
        x = torch.randn(16, 1, 28, 28)
        out = aug(x)
        assert torch.allclose(out, x)

    def test_applied_at_approximately_rate_p(self):
        # Per-image, aug fires with probability p. Count how many images the
        # pipeline actually changed and check the empirical rate ~ p.
        p = 0.5
        aug = AdaptiveAugment(p=p, seed=1234)
        n = 400
        x = torch.randn(n, 1, 28, 28)
        out = aug(x)
        changed = (~torch.isclose(out, x).flatten(1).all(dim=1)).float().mean().item()
        assert abs(changed - p) < 0.1, f"empirical aug rate {changed} vs p={p}"

    def test_device_agnostic_stays_on_input_device(self):
        aug = AdaptiveAugment(p=1.0, seed=0)
        x = torch.randn(4, 1, 28, 28)  # cpu
        out = aug(x)
        assert out.device == x.device

    def test_p_is_mutable_for_the_controller(self):
        aug = AdaptiveAugment(p=0.1, seed=0)
        aug.p = 0.9
        assert aug.p == 0.9


# --------------------------------------------------------------- integration

class TestGANADAIntegration:
    def test_one_train_step_updates_p_no_nan(self):
        cfg = GANADAConfig(fast_demo=True, data_root=DATA_ROOT, device="cpu")
        comp = GANADA()
        with tempfile.TemporaryDirectory() as tmpdir:
            logger = Logger(tmpdir, "test")
            comp.train(cfg, logger)
            # p was tracked and left in the unit interval.
            assert 0.0 <= comp.augment.p <= 1.0
            # a real ADA run adjusts p at least once (interval capped at S).
            assert comp.p_history, "p was never tracked"
            for p in comp.p_history:
                assert 0.0 <= p <= 1.0
            # sampling works and is finite.
            out = comp.sample(cfg, n=2)
            assert out.shape == (2, 1, 28, 28)
            assert torch.isfinite(out).all()
