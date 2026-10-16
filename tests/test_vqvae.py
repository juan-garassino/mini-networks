"""VQ-VAE quantizer: dead-code restarts keep the codebook from collapsing."""
import torch

from mini_networks.models.vqvae.model import VQVAE, VectorQuantizer


def test_first_training_step_seeds_every_code_from_the_batch():
    """usage starts at 0, so step one re-seeds every code with an encoder vector."""
    torch.manual_seed(0)
    vq = VectorQuantizer(num_embeddings=8, embedding_dim=4).train()
    z_e = torch.randn(2, 4, 3, 3) * 5.0  # far from the tiny uniform init
    vq(z_e)
    flat = z_e.permute(0, 2, 3, 1).reshape(-1, 4)
    for code in vq.codebook.weight:
        assert (flat - code).abs().sum(dim=1).min() < 1e-5


def test_dead_code_is_restarted_but_eval_never_moves_codes():
    torch.manual_seed(0)
    vq = VectorQuantizer(num_embeddings=4, embedding_dim=2).train()
    vq.usage.fill_(1.0)
    vq.usage[3] = 0.0                       # code 3 is dead
    vq.codebook.weight.data[3] = 1e6        # and unreachable
    z_e = torch.randn(1, 2, 4, 4)
    vq(z_e)
    assert vq.codebook.weight[3].abs().max() < 1e3   # moved onto the data

    vq.eval()
    vq.usage.zero_()                        # everything "dead", but eval
    before = vq.codebook.weight.detach().clone()
    vq(z_e)
    assert torch.equal(before, vq.codebook.weight)


def test_usage_buffer_is_not_in_checkpoints():
    assert "quantizer.usage" not in VQVAE().state_dict() and not any(
        k.endswith("usage") for k in VQVAE().state_dict())
