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


def test_cyclegan_forward_and_cycle_smoke():
    """CycleGAN's two generators round-trip a->B->a; PatchGAN emits a logit map; pool queries."""
    import torch

    from mini_networks.models.cyclegan.model import (
        PatchDiscriminator, ResnetGenerator, lsgan_d_loss, lsgan_g_loss,
    )
    from mini_networks.models.cyclegan.trainer import ImagePool

    G = ResnetGenerator(in_channels=1, ngf=16, n_blocks=2)
    Fnet = ResnetGenerator(in_channels=1, ngf=16, n_blocks=2)
    D = PatchDiscriminator(in_channels=1, ndf=16)
    a = torch.rand(4, 1, 28, 28) * 2 - 1
    fake_b = G(a)
    rec_a = Fnet(fake_b)
    assert fake_b.shape == a.shape and rec_a.shape == a.shape
    logits = D(a)
    assert logits.shape == (4, 1, 7, 7)  # PatchGAN outputs a MAP, not a scalar
    g_loss = lsgan_g_loss(D, fake_b)
    d_loss = lsgan_d_loss(D, a, fake_b)
    (g_loss + d_loss).backward()
    assert g_loss.dim() == 0 and d_loss.dim() == 0
    # Image pool returns a batch of the same shape and eventually recycles fakes.
    pool = ImagePool(pool_size=4)
    out = pool.query(fake_b.detach())
    assert out.shape == fake_b.shape


def test_swin_forward_and_shift_mask_smoke():
    """Swin classifies 28x28; window partition/reverse round-trips; a shifted block builds a mask."""
    import torch

    from mini_networks.models.swin.config import SwinConfig
    from mini_networks.models.swin.model import (
        MiniSwin, SwinBlock, window_partition, window_reverse,
    )

    cfg = SwinConfig(device="cpu")
    model = MiniSwin(
        patch_size=cfg.patch_size, window_size=cfg.window_size, embed_dim=cfg.embed_dim,
        depths=tuple(cfg.depths), num_heads=cfg.num_heads, num_classes=cfg.num_classes,
    )
    x = torch.rand(4, 1, 28, 28)
    logits = model(x)
    assert logits.shape == (4, 10)
    logits.sum().backward()
    # window_partition/reverse must be exact inverses.
    feat = torch.rand(2, 7, 7, cfg.embed_dim)
    win = window_partition(feat, 7)
    assert torch.allclose(window_reverse(win, 7, 7, 7), feat, atol=1e-5)
    # A shifted block precomputes a non-trivial attention mask (the -100 fills).
    # Use resolution 8 with window 4 so the 9-region mask partitions cleanly.
    shifted = SwinBlock(cfg.embed_dim, 8, cfg.num_heads, window_size=4, shift_size=2, mlp_ratio=2.0)
    assert shifted.attn_mask is not None and (shifted.attn_mask == -100.0).any()
    tokens = torch.rand(2, 8 * 8, cfg.embed_dim)
    assert shifted(tokens).shape == tokens.shape


def test_convlstm_forward_and_rollout_smoke():
    """ConvLSTM cell carries a spatial state; the net rolls out future frames."""
    import torch

    from mini_networks.models.convlstm.model import ConvLSTMCell, ConvLSTMNet

    cell = ConvLSTMCell(in_channels=1, hidden_dim=8, kernel_size=3)
    h, c = cell.init_state(4, (32, 32), device="cpu")
    h2, c2 = cell(torch.rand(4, 1, 32, 32), (h, c))
    assert h2.shape == (4, 8, 32, 32) and c2.shape == (4, 8, 32, 32)

    net = ConvLSTMNet(in_channels=1, hidden_dim=8, n_layers=1)
    context = torch.rand(4, 5, 1, 32, 32)
    future = torch.rand(4, 5, 1, 32, 32)
    mask = (torch.rand(5, 4) < 0.5).float()
    preds = net(context, n_predict=5, future_frames=future, sampling_mask=mask)
    assert preds.shape == future.shape
    ((preds - future) ** 2).mean().backward()
    # Open-loop rollout (no teacher forcing) also produces the right shape.
    assert net(context, n_predict=5).shape == future.shape


def test_dcrnn_forward_and_diffusion_smoke():
    """DCGRU diffuses over graph supports; the DCRNN forecasts a horizon of steps."""
    import torch

    from mini_networks.models.dcrnn.model import DCRNN, DiffusionConv
    from mini_networks.models.dcrnn.trainer import _build_graph

    n_nodes = 20
    supports, adj = _build_graph(n_nodes, seed=11)
    assert len(supports) == 2 and adj.shape == (n_nodes, n_nodes)
    # A K-step diffusion conv maps node features to a new node feature dim.
    conv = DiffusionConv(in_dim=1, out_dim=8, n_supports=2, max_diffusion_step=2)
    out = conv(torch.rand(4, n_nodes, 1), supports)
    assert out.shape == (4, n_nodes, 8)

    model = DCRNN(node_dim=1, hidden_dim=16, n_supports=2, max_diffusion_step=2)
    past = torch.rand(4, 12, n_nodes, 1)
    future = torch.rand(4, 6, n_nodes, 1)
    preds = model(past, supports, horizon=6, targets=future, teacher_prob=0.5)
    assert preds.shape == (4, 6, n_nodes, 1)
    ((preds - future) ** 2).mean().backward()


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
