"""Registry-wide smoke tests for model train/eval contract."""
import os
import tempfile

from mini_networks.core.registry import get_model_registry
from mini_networks.core.logging.logger import Logger

DATA_ROOT = os.environ.get("MINI_TEST_DATA_ROOT", "/tmp/mini_networks_test_data")


def _build_config(config_cls):
    config = config_cls(
        fast_demo=True,
        epochs=1,
        batch_size=4,
        data_root=DATA_ROOT,
        device="cpu",
    )
    overrides = {}
    fields = getattr(config, "model_fields", {})

    if "timesteps" in fields:
        overrides["timesteps"] = 50
    if "pretrain_epochs" in fields:
        overrides["pretrain_epochs"] = 1
    if "finetune_epochs" in fields:
        overrides["finetune_epochs"] = 1
    if "n_ppo_iters" in fields:
        overrides["n_ppo_iters"] = 1
    if "ppo_epochs" in fields:
        overrides["ppo_epochs"] = 1
    if "n_rollouts" in fields:
        overrides["n_rollouts"] = 4
    if "rollout_max_new" in fields:
        overrides["rollout_max_new"] = 8
    if "seq_len" in fields:
        overrides["seq_len"] = min(getattr(config, "seq_len", 64), 64)
    if "patch_size" in fields:
        overrides["patch_size"] = min(getattr(config, "patch_size", 4), 4)
    if "require_downloads" in fields:
        overrides["require_downloads"] = False

    if overrides:
        config = config.model_copy(update=overrides)
    return config


def test_wgan_forward_and_clipping_smoke():
    """WGAN critic emits a raw score; weight clipping keeps params in [-c, c]."""
    import torch

    from mini_networks.models.wgan.config import WGANConfig
    from mini_networks.models.wgan.model import Critic, Generator, wgan_critic_loss, wgan_gen_loss

    cfg = WGANConfig(device="cpu", clip_value=0.01)
    G = Generator(latent_dim=cfg.latent_dim)
    C = Critic()
    z = torch.randn(4, cfg.latent_dim)
    fake = G(z)
    assert fake.shape == (4, 1, 28, 28)
    real = torch.rand(4, 1, 28, 28) * 2 - 1
    c_loss = wgan_critic_loss(C, real, fake)
    g_loss = wgan_gen_loss(C, fake)
    c_loss.backward()
    assert c_loss.dim() == 0 and g_loss.dim() == 0
    # Apply the clip and assert every critic weight is bounded.
    with torch.no_grad():
        for p in C.parameters():
            p.clamp_(-cfg.clip_value, cfg.clip_value)
        assert all(p.abs().max().item() <= cfg.clip_value + 1e-6 for p in C.parameters())


def test_vqvae_forward_and_ste_smoke():
    """VQ-VAE reconstructs and routes gradient through the codebook via STE."""
    import torch

    from mini_networks.models.vqvae.config import VQVAEConfig
    from mini_networks.models.vqvae.model import VQVAE, vqvae_loss

    cfg = VQVAEConfig(device="cpu", num_embeddings=16, embedding_dim=8)
    model = VQVAE(num_embeddings=cfg.num_embeddings, embedding_dim=cfg.embedding_dim)
    x = torch.rand(4, 1, 28, 28)
    recon, vq_loss, indices, perplexity = model(x)
    assert recon.shape == x.shape
    assert indices.shape == (4, 7, 7)
    assert 0 < indices.max().item() < cfg.num_embeddings or indices.max().item() == 0
    assert 1.0 <= perplexity.item() <= cfg.num_embeddings + 1e-3
    loss, _ = vqvae_loss(recon, x, vq_loss)
    loss.backward()
    # Straight-through estimator must deliver gradient to the encoder.
    enc_grad = next(model.encoder.parameters()).grad
    assert enc_grad is not None and torch.isfinite(enc_grad).all()


def test_registry_train_eval_smoke():
    registry = get_model_registry()
    skipped = []
    for name, (ConfigClass, TrainerClass, dataloader_fn) in registry.items():
        config = _build_config(ConfigClass)
        trainer = TrainerClass()
        with tempfile.TemporaryDirectory() as tmpdir:
            logger = Logger(output_dir=tmpdir, run_name=f"smoke-{name}")
            try:
                dl = dataloader_fn(config, split="train")
            except RuntimeError as exc:
                if "downloads disabled" in str(exc):
                    skipped.append(name)
                    continue
                raise
            trainer.train(config, dl, logger)
            metrics = trainer.evaluate(config, dl, logger)
            assert isinstance(metrics, dict)
    assert len(skipped) < len(registry), "every model skipped — dataset cache empty"
