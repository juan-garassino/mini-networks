"""run_model seeds Python/NumPy/torch from config.seed: same seed, same run."""
import os
import tempfile

from mini_networks.colab.runners import run_model

DATA_ROOT = os.environ.get("MINI_TEST_DATA_ROOT", "/tmp/mini_networks_test_data")


def _losses(model: str, root: str, **kw) -> list[float]:
    logger = run_model(model, fast_demo=True, data_root=DATA_ROOT, device="cpu",
                       checkpoint_root=root, resume=False, **kw)
    return [m["value"] for m in logger.read_metrics() if m["key"] == "loss"]


def test_same_seed_reproduces_training(skip_if_dataset_missing):
    with skip_if_dataset_missing(), tempfile.TemporaryDirectory() as a, \
            tempfile.TemporaryDirectory() as b, tempfile.TemporaryDirectory() as c:
        first = _losses("gnn", a)
        assert first == _losses("gnn", b)            # bit-identical rerun
        assert first != _losses("gnn", c, seed=7)    # and the seed matters
