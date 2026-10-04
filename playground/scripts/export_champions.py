"""Export real champion outputs for the playground's pixel mechanism diagrams.

The anatomy diagrams (playground/components/lab/shared/anatomy2/) bake real
model outputs into TypeScript constants under anatomy2/data/<model>-champion.ts.
This script is the generator: for every model with a local registry champion
(runs/champions/<model>/artifacts/model.pt, pulled by `python main.py
pull-champions`) it loads the checkpoint into a fresh trainer, runs a tiny,
representative CPU inference on real inputs (<= --n items) and writes the file.

    uv run python playground/scripts/export_champions.py                 # every champion lacking a data file
    uv run python playground/scripts/export_champions.py --models pixelcnn,detection --force
    uv run python playground/scripts/export_champions.py --list          # what would run, and why not

Encoding (decoded by unNib() / hexBytes() in anatomy2/math.ts):
  * nibble strings — one hex char per value, 16 levels over [lo, hi], row-major
    (value -> floor((v - lo) / (hi - lo) * 16) clamped to 0..15; the decoder
    returns bin centres). Images use [0, 1]; signed maps use [-1, 1] after
    dividing by max|.|; probabilities use [0, 1].
  * everything else is JSON (json.dumps) with floats rounded to 3 decimals,
    emitted as `export const NAME = ... as const;`.
  * <PREFIX>_VERSION is the champion's runs/champions/<model>/VERSION line
    ("mini-<model> v<n> run <mlflow run id>").

No training, no cloud: CPU inference only, on the already-downloaded datasets
under data/. Models whose champion is missing (or whose probe fails) are
skipped with a log line and the run continues.
"""
from __future__ import annotations

import argparse
import json
import logging
import math
import os
import re
import sys
import time
import zlib
from pathlib import Path
from typing import Any, Callable

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "src"))
os.chdir(REPO)  # BaseConfig derives data_root / checkpoint_root from cwd

DEFAULT_OUT = REPO / "playground" / "components" / "lab" / "shared" / "anatomy2" / "data"
CHAMPIONS = REPO / "runs" / "champions"

log = logging.getLogger("export_champions")

# MNIST test-set index of the first occurrence of each digit 0..9 — the same
# digits anatomy2/data/mnist-digits.ts carries, so diagrams can pair them.
MNIST_FIRST_IDX = [3, 2, 1, 18, 4, 8, 11, 0, 61, 7]
IRIS_FEATURES = ["sepal length", "sepal width", "petal length", "petal width"]
IRIS_CLASSES = ["setosa", "versicolor", "virginica"]
FASHION_CLASSES = ["T-shirt/top", "Trouser", "Pullover", "Dress", "Coat",
                   "Sandal", "Shirt", "Sneaker", "Bag", "Ankle boot"]


# ----------------------------------------------------------------------------
# encoding helpers
# ----------------------------------------------------------------------------

def nib(values: Any, lo: float = -1.0, hi: float = 1.0) -> str:
    """Nibble-hex string: one hex char per value, 16 levels over [lo, hi], row-major."""
    import torch

    flat = torch.as_tensor(values, dtype=torch.float32).flatten().tolist()
    span = max(hi - lo, 1e-9)
    out = []
    for v in flat:
        k = int(math.floor((v - lo) / span * 16)) if math.isfinite(v) else 0
        out.append("0123456789abcdef"[min(15, max(0, k))])
    return "".join(out)


def nib_sym(values: Any) -> tuple[str, float]:
    """Signed map -> nibbles over [-1, 1] after dividing by max|.|; returns (hex, max)."""
    import torch

    t = torch.as_tensor(values, dtype=torch.float32)
    m = float(t.abs().max().clamp_min(1e-6))
    return nib(t / m, -1.0, 1.0), m


def nib_pos(values: Any) -> tuple[str, float]:
    """Non-negative map -> nibbles over [0, 1] after dividing by its max; returns (hex, max)."""
    import torch

    t = torch.as_tensor(values, dtype=torch.float32).clamp_min(0)
    m = float(t.max().clamp_min(1e-6))
    return nib(t / m, 0.0, 1.0), m


def rnd(obj: Any, nd: int = 3) -> Any:
    """Recursively round floats (tensors become lists) for compact JSON."""
    import torch

    if isinstance(obj, torch.Tensor):
        return rnd(obj.detach().cpu().tolist(), nd)
    if isinstance(obj, float):
        v = round(obj, nd)
        return 0.0 if v == 0 else v
    if isinstance(obj, dict):
        return {k: rnd(v, nd) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [rnd(v, nd) for v in obj]
    return obj


class TsFile:
    """Collects `export const` lines and writes a *-champion.ts in the house format."""

    def __init__(self, model: str, prefix: str, version: str, what: str, notes: list[str] | None = None):
        self.model, self.prefix, self.version = model, prefix, version
        self.what, self.notes = what, notes or []
        self.consts: list[tuple[str, Any, str]] = []

    def add(self, name: str, value: Any, comment: str) -> None:
        self.consts.append((f"{self.prefix}_{name}", value, comment))

    def write(self, out_dir: Path) -> Path:
        lines = [
            "// GENERATED by playground/scripts/export_champions.py: the local champion",
            f"// checkpoint run on real inputs, CPU inference only. {self.version}: {self.what}",
        ]
        lines += [f"// {n}" for n in self.notes]
        lines += [
            "// Nibble strings: one hex char per value, 16 levels over [lo, hi] — decode",
            "// with unNib() in ../math.ts.",
            f"// Regenerate: uv run python playground/scripts/export_champions.py --models {self.model} --force",
            f'export const {self.prefix}_VERSION = {json.dumps(self.version)} as const;',
        ]
        for name, value, comment in self.consts:
            lines.append(f"// {name}: {comment}")
            lines.append(f"export const {name} = {json.dumps(value, ensure_ascii=False)} as const;")
        path = out_dir / f"{self.model}-champion.ts"
        path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        return path


# ----------------------------------------------------------------------------
# champion loading
# ----------------------------------------------------------------------------

def champion_version(model: str) -> str | None:
    p = CHAMPIONS / model / "VERSION"
    if not p.exists() or not any((CHAMPIONS / model / "artifacts").glob("*.pt")):
        return None
    return p.read_text().strip()


def load_champion(model: str):
    """-> (config, trainer, dataloader_fn) with the champion weights loaded.

    The default config (training_tier M, fast_demo False) is used on purpose:
    tier only changes budgets, and diffusion-style samplers need the SAME
    effective_timesteps the champion trained with (S would cap it at 25)."""
    from mini_networks.core.registry import get_model_registry

    ConfigClass, TrainerClass, dl_fn = get_model_registry()[model]
    config = ConfigClass(**CONFIG_FROM_CHECKPOINT.get(model, lambda _p: {})(CHAMPIONS / model / "artifacts"))
    trainer = TrainerClass()
    trainer.load_checkpoint(config, CHAMPIONS / model / "artifacts")
    return config, trainer, dl_fn


def _pixelcnn_config(artifacts: Path) -> dict[str, Any]:
    """The registered pixelcnn champion may predate the 8-layer/64-filter rewrite
    (m-vision-7): read filters + depth off the state dict so the module matches."""
    import torch

    state = torch.load(artifacts / "model.pt", map_location="cpu", weights_only=True)
    n_filters = int(state["net.0.weight"].shape[0])
    n_layers = sum(1 for k in state if k.endswith(".mask"))
    return {"n_filters": n_filters, "n_layers": n_layers}


# model -> fn(artifacts_dir) -> Config kwargs that make the module match the checkpoint
CONFIG_FROM_CHECKPOINT: dict[str, Callable[[Path], dict[str, Any]]] = {"pixelcnn": _pixelcnn_config}


def seed_all(seed: int) -> None:
    import numpy as np
    import torch

    torch.manual_seed(seed)
    np.random.seed(seed)


def mnist_test():
    from mini_networks.core.data.registry import get_dataset

    return get_dataset("mnist", str(REPO / "data"), split="test", task="classification")


def iris_test():
    from mini_networks.core.data.registry import get_dataset

    # 30 class-sorted rows (10 per class), standardized with the split's own stats.
    return get_dataset("iris", str(REPO / "data"), split="test", fast_demo=False, require_downloads=True)


def iris_pick(n: int) -> list[int]:
    """n test rows spread across the three classes (rows 0-9/10-19/20-29)."""
    per = [n // 3 + (1 if i < n % 3 else 0) for i in range(3)]
    return [10 * c + j for c in range(3) for j in range(per[c])]


def text_dataset(config):
    from mini_networks.core.data.registry import get_dataset

    # Full Tiny Shakespeare (fast_demo would truncate the text and change the
    # char vocabulary the checkpoint was trained with).
    return get_dataset("text_file", config.data_root, split="train", file_path=config.text_file,
                       seq_len=config.seq_len, fast_demo=False)


def ensure_tokenizer(trainer, config) -> Any:
    """pull-champions copies only *.pt, so rag/rlhf arrive without tokenizer.json —
    rebuild the char tokenizer from the corpus (sorted(set(text)), deterministic)."""
    ds = text_dataset(config)
    tok = ds.tokenizer
    emb = trainer.model.token_embed.weight.shape[0]
    if emb != ds.vocab_size:
        raise RuntimeError(f"vocab mismatch: checkpoint {emb} vs corpus {ds.vocab_size}")
    if getattr(trainer, "tokenizer", None) is None:
        trainer.tokenizer = tok
    return ds


def audio_batch(config, n: int):
    """n FSDD TEST clips with distinct spoken digits 0..n-1 -> (waves [n,1,T], labels, files)."""
    from mini_networks.core.data.registry import get_dataset
    import torch

    ds = get_dataset("speech_digits", config.data_root, split="test", sample_len=config.sample_len,
                     require_downloads=True, fast_demo=False)
    want = set(range(min(n, 10)))
    waves, labels, files = [], [], []
    for i, path in enumerate(ds._files):
        label = int(os.path.basename(path).split("_")[0])
        if label in want:
            w, _ = ds[i]
            waves.append(w)
            labels.append(label)
            files.append(os.path.basename(path))
            want.discard(label)
        if not want:
            break
    order = sorted(range(len(labels)), key=lambda k: labels[k])
    return (torch.stack([waves[k] for k in order]), [labels[k] for k in order], [files[k] for k in order])


def log_spec_64x32(waves, n_fft: int, hop: int) -> list[str]:
    """log-magnitude STFT per clip, 129 bins -> 64 (drop Nyquist, mean-pool pairs),
    per-clip min-max to [0, 1], rows = frequency (low -> high), cols = time."""
    import torch
    from mini_networks.core.data.audio import stft_mag

    mag = stft_mag(waves, n_fft=n_fft, hop_length=hop)  # [B, 129, T]
    lg = (mag + 1e-6).log()[:, :128].reshape(mag.size(0), 64, 2, -1).mean(2)  # [B, 64, T]
    out = []
    for s in lg:
        s = (s - s.min()) / (s.max() - s.min() + 1e-6)
        out.append(nib(s, 0.0, 1.0))
    return out


# ----------------------------------------------------------------------------
# per-model exporters: (config, trainer, dl_fn, n, seed) -> TsFile
# ----------------------------------------------------------------------------

def export_tabular_classifier(config, trainer, dl_fn, n: int, seed: int) -> TsFile:
    import torch

    ds = iris_test()
    idx = iris_pick(n)
    x = torch.stack([ds[i][0] for i in idx])
    y = [int(ds[i][1]) for i in idx]
    hidden: list[torch.Tensor] = []
    hooks = [m.register_forward_hook(lambda _m, _i, o: hidden.append(o)) for m in trainer.model.modules()
             if isinstance(m, torch.nn.Linear)]
    out = trainer.infer(config, {"features": x})
    for h in hooks:
        h.remove()
    logits = torch.tensor(out["logits"])
    probs = torch.softmax(logits, -1)
    xa = torch.stack([ds[i][0] for i in range(len(ds))])
    ya = torch.tensor([int(ds[i][1]) for i in range(len(ds))])
    acc = float((trainer.model(xa).argmax(-1) == ya).float().mean())
    hid, hmax = nib_pos(torch.relu(hidden[-2])) if len(hidden) >= 2 else ("", 0.0)
    f = TsFile("tabular_classifier", "TAB", champion_version("tabular_classifier"),
               f"{config.model_type} ({config.n_features}→{config.hidden_dim}→{config.n_classes}) on {len(idx)} Iris TEST rows "
               f"(index-parity split, dataset-standardized features).")
    f.add("FEATURE_NAMES", IRIS_FEATURES, "the 4 iris measurements, in feature order")
    f.add("CLASS_NAMES", IRIS_CLASSES, "label order 0..2")
    f.add("ROWS", idx, f"test-split row index of each item [{len(idx)}]")
    f.add("X", rnd(x), f"standardized features [{len(idx)}][4]")
    f.add("Y", y, f"true class [{len(idx)}]")
    f.add("LOGITS", rnd(logits), f"[{len(idx)}][3]")
    f.add("PROBS", rnd(probs), f"softmax [{len(idx)}][3]")
    f.add("PRED", out["predictions"], f"argmax [{len(idx)}]")
    f.add("HIDDEN", [hid[i * hidden[-2].shape[1]:(i + 1) * hidden[-2].shape[1]] for i in range(len(idx))],
          f"ReLU'd last hidden layer per row, nibbles over [0, HIDDEN_MAX] [{len(idx)}] x {hidden[-2].shape[1]}")
    f.add("HIDDEN_MAX", rnd(hmax), "scale of HIDDEN")
    f.add("TEST_ACC", rnd(acc), f"accuracy over the whole {len(ds)}-row test split")
    return f


def export_pixelcnn(config, trainer, dl_fn, n: int, seed: int) -> TsFile:
    import torch
    import torch.nn.functional as F

    k = min(n, 4)  # raster sampling = 784 sequential forward passes; keep the batch small
    out = trainer.infer(config, {"n_samples": k, "seed": seed})
    samples = out["samples"]  # [k,1,28,28] binary
    with torch.no_grad():
        p_samp = torch.sigmoid(trainer.model(samples))
        ds = mnist_test()
        real_idx = [MNIST_FIRST_IDX[7], MNIST_FIRST_IDX[2]]
        real = torch.stack([(ds[i][0] > 0.5).float() for i in real_idx])
        real_labels = [int(ds[i][1]) for i in real_idx]
        p_real = torch.sigmoid(trainer.model(real))
        nll = [float(F.binary_cross_entropy(p_real[i:i + 1], real[i:i + 1])) for i in range(len(real_idx))]
    first = trainer.model.net[0]
    from mini_networks.models.pixelcnn.config import PixelCNNConfig

    cur = PixelCNNConfig()
    era = ([f"NOTE this registered champion predates the {cur.n_layers}-layer/{cur.n_filters}-filter rewrite (m-vision-7): "
            f"it is the {config.n_layers}-layer/{config.n_filters}-filter PixelCNN, rebuilt from the checkpoint's shapes."]
           if (config.n_layers, config.n_filters) != (cur.n_layers, cur.n_filters) else [])
    f = TsFile("pixelcnn", "PCNN", champion_version("pixelcnn"),
               f"{config.n_layers}-layer / {config.n_filters}-filter masked CNN: {k} raster-scan samples (seed {seed}) "
               f"and the per-pixel Bernoulli p(x_i=1 | x_<i) it assigns, on its own samples and on two binarized MNIST test digits.", era)
    if era:
        f.add("ERA", f"{config.n_layers}-layer/{config.n_filters}-filter (pre m-vision-7) champion", "which architecture this checkpoint is")
    f.add("ARCH", {"filters": config.n_filters, "layers": config.n_layers, "kernel": 3}, "model shape")
    f.add("MASK_A", first.mask[0, 0].int().tolist(), "layer-1 mask (centre pixel hidden) [3][3]")
    f.add("MASK_B", trainer.model.net[2].mask[0, 0].int().tolist() if hasattr(trainer.model.net[2], "mask") else
          [[1, 1, 1], [1, 1, 0], [0, 0, 0]], "later-layer mask (centre pixel visible) [3][3]")
    f.add("SAMPLES", [nib(s, 0, 1) for s in samples], f"binary samples, nibbles over [0,1] [{k}] x 784 (28x28 row-major)")
    f.add("SAMPLE_PROB", [nib(p, 0, 1) for p in p_samp], f"p(x_i=1 | x_<i) evaluated on each finished sample [{k}] x 784")
    f.add("REAL_IDX", real_idx, "MNIST test indices of the real digits")
    f.add("REAL_LABEL", real_labels, "their labels")
    f.add("REAL", [nib(r, 0, 1) for r in real], f"binarized (>0.5) real digits [{len(real_idx)}] x 784")
    f.add("REAL_PROB", [nib(p, 0, 1) for p in p_real], f"p(x_i=1 | x_<i) on the real digits [{len(real_idx)}] x 784")
    f.add("REAL_NLL", rnd(nll), "mean per-pixel BCE (nats) on each real digit")
    return f


def export_detection(config, trainer, dl_fn, n: int, seed: int) -> TsFile:
    import torch
    from mini_networks.core.data.registry import get_dataset

    seed_all(seed)  # place_on_canvas uses np.random
    ds = get_dataset("mnist", config.data_root, split="test", task="detection", canvas_size=config.canvas_size)
    idx = MNIST_FIRST_IDX[:n]
    items = [ds[i] for i in idx]
    x = torch.stack([it[0] for it in items])
    labels = [int(it[1]) for it in items]
    true_box = torch.stack([it[2] for it in items])
    maps: list[torch.Tensor] = []
    h = trainer.model.backbone[5].register_forward_hook(lambda _m, _i, o: maps.append(o))
    out = trainer.infer(config, {"images": x})
    h.remove()
    probs, pred_box = out["class_probs"], out["bboxes"]
    pred = probs.argmax(-1).tolist()

    def iou(a, b):
        ix = max(0.0, min(a[2], b[2]) - max(a[0], b[0]))
        iy = max(0.0, min(a[3], b[3]) - max(a[1], b[1]))
        inter = ix * iy
        ua = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
        return inter / max(ua, 1e-9)

    ious = [iou(true_box[i].tolist(), pred_box[i].tolist()) for i in range(len(idx))]
    fm = maps[0]  # [B,64,14,14] after conv2+pool
    # the channel that sees the DIGIT, not the zero-padding border: largest
    # spatial std over the interior (rows/cols 1..12), averaged over the items
    inner = fm[:, :, 1:13, 1:13].flatten(2)  # [B,64,144]
    contrast = (inner.std(2) / fm.flatten(2).amax(2).clamp_min(1e-6)).mean(0)
    ch = int(contrast.argmax())
    f = TsFile("detection", "DET", champion_version("detection"),
               f"dual-head CNN (one class head, one box head; no grid, no anchors) on {len(idx)} MNIST test digits placed at random (np seed {seed}) on a "
               f"{config.canvas_size}px canvas: class probabilities, predicted vs true box (normalized xyxy), IoU, and one backbone map.")
    f.add("CANVAS_SIZE", config.canvas_size, "canvas side in px")
    f.add("DIGIT_IDX", idx, f"MNIST test index of each placed digit [{len(idx)}]")
    f.add("CANVAS", [nib(c, 0, 1) for c in x], f"canvases, nibbles over [0,1] [{len(idx)}] x {config.canvas_size ** 2} (row-major)")
    f.add("LABELS", labels, "true digit")
    f.add("BOX_TRUE", rnd(true_box), "true [x1,y1,x2,y2] / canvas")
    f.add("BOX_PRED", rnd(pred_box), "predicted [x1,y1,x2,y2] (sigmoid head)")
    f.add("PROBS", rnd(probs), f"class softmax [{len(idx)}][10]")
    f.add("PRED", pred, "argmax class")
    f.add("IOU", rnd(ious), "box IoU per item")
    f.add("MAP_CH", ch, "backbone channel shown (highest interior std/max, mean over the items, of 64 after conv2+pool)")
    f.add("MAPS", [nib_pos(fm[i, ch])[0] for i in range(len(idx))], f"that 14x14 ReLU map per item, nibbles over [0, max] [{len(idx)}] x 196")
    return f


def export_lora(config, trainer, dl_fn, n: int, seed: int) -> TsFile:
    import torch
    from mini_networks.core.data.registry import get_dataset

    dataset, names = "fashion_mnist", FASHION_CLASSES
    try:
        ds = get_dataset(dataset, config.data_root, split="test", task="classification")
    except Exception as e:  # offline: FashionMNIST not cached
        log.warning("lora: FashionMNIST unavailable (%s) — falling back to MNIST digits", e)
        dataset, names = "mnist", [str(i) for i in range(10)]
        ds = mnist_test()
    targets = torch.as_tensor(ds.targets)
    idx = [int((targets == c).nonzero()[0]) for c in range(n)]
    x = torch.stack([ds[i][0] for i in idx])
    y = [int(ds[i][1]) for i in idx]
    out = trainer.infer(config, {"images": x})
    m = trainer.model
    saved = (m.fc1.scale, m.fc2.scale)
    m.fc1.scale = m.fc2.scale = 0.0  # adapters off -> the frozen MNIST backbone alone
    base = trainer.infer(config, {"images": x})
    m.fc1.scale, m.fc2.scale = saved
    delta = []
    for name, fc in (("fc1", m.fc1), ("fc2", m.fc2)):
        d = (fc.lora_B @ fc.lora_A) * fc.scale
        delta.append({"name": name, "shape": list(fc.weight.shape), "rank": int(fc.lora_A.shape[0]),
                      "normW": round(float(fc.weight.norm()), 3), "normDelta": round(float(d.norm()), 3)})
    a2, a2m = nib_sym(m.fc2.lora_A)
    b2, b2m = nib_sym(m.fc2.lora_B)
    b1, b1m = nib_sym(m.fc1.lora_B)
    f = TsFile("lora", "LORA", champion_version("lora"),
               f"CNN pre-trained on MNIST, LoRA (rank {config.lora_rank}, alpha {config.lora_alpha}) fine-tuned on FashionMNIST; "
               f"{len(idx)} {dataset} TEST items (first of each class), logits with the adapters on vs off, and the low-rank factors.")
    f.add("DATASET", dataset, "which test set the items come from")
    f.add("CLASS_NAMES", names, "label order")
    f.add("IDX", idx, "test-set index per item")
    f.add("X", [nib(img, 0, 1) for img in x], f"inputs, nibbles over [0,1] [{len(idx)}] x 784")
    f.add("Y", y, "true class")
    f.add("LOGITS", rnd(out["logits"]), f"adapters ON [{len(idx)}][10]")
    f.add("PRED", out["predictions"], "argmax, adapters on")
    f.add("BASE_LOGITS", rnd(base["logits"]), f"adapters OFF (scale=0): the frozen MNIST weights alone [{len(idx)}][10]")
    f.add("BASE_PRED", base["predictions"], "argmax, adapters off")
    f.add("RANK", config.lora_rank, "r")
    f.add("ALPHA", config.lora_alpha, "alpha (scale = alpha / r)")
    f.add("DELTA", delta, "per LoRA layer: ||W||_F vs ||B A * scale||_F")
    f.add("FC2_A", a2, f"fc2 lora_A, nibbles over ±FC2_A_MAX [{m.fc2.lora_A.shape[0]}x{m.fc2.lora_A.shape[1]}]")
    f.add("FC2_A_MAX", rnd(a2m), "scale of FC2_A")
    f.add("FC2_B", b2, f"fc2 lora_B, nibbles over ±FC2_B_MAX [{m.fc2.lora_B.shape[0]}x{m.fc2.lora_B.shape[1]}]")
    f.add("FC2_B_MAX", rnd(b2m), "scale of FC2_B")
    f.add("FC1_B", b1, f"fc1 lora_B, nibbles over ±FC1_B_MAX [{m.fc1.lora_B.shape[0]}x{m.fc1.lora_B.shape[1]}] (A is {list(m.fc1.lora_A.shape)}, omitted)")
    f.add("FC1_B_MAX", rnd(b1m), "scale of FC1_B")
    return f


def _audio_common(f: TsFile, config, trainer, waves, labels, files) -> None:
    import torch

    out = trainer.infer(config, waves)
    logits = torch.tensor(out["logits"])
    f.add("FILES", files, "FSDD recording per item (<digit>_<speaker>_<take>.wav)")
    f.add("LABELS", labels, "spoken digit")
    f.add("SAMPLE_RATE", 8000, "FSDD is 8 kHz; sample_len 4000 = 0.5 s")
    f.add("LOGITS", rnd(logits), f"[{len(labels)}][{config.n_classes}]")
    f.add("PROBS", rnd(torch.softmax(logits, -1)), "softmax")
    f.add("PRED", out["predictions"], "argmax")


def export_audio_classifier(config, trainer, dl_fn, n: int, seed: int) -> TsFile:
    import torch

    waves, labels, files = audio_batch(config, n)
    feats: list[torch.Tensor] = []
    h = trainer.model.net.register_forward_hook(lambda _m, _i, o: feats.append(o))
    f = TsFile("audio_classifier", "AUD", champion_version("audio_classifier"),
               f"1-D CNN on RAW waveforms: {len(labels)} FSDD TEST clips (one per digit), the waveform it sees, its 128-d pooled features, logits.")
    _audio_common(f, config, trainer, waves, labels, files)
    h.remove()
    w = waves.squeeze(1)
    pooled = w.reshape(w.size(0), 400, -1).mean(-1)
    wmax = pooled.abs().amax(1).clamp_min(1e-6)
    f.add("WAVE", [nib(pooled[i] / wmax[i], -1, 1) for i in range(len(labels))],
          f"waveform mean-pooled 4000→400 samples, / WAVE_MAX, nibbles over [-1,1] [{len(labels)}] x 400")
    f.add("WAVE_MAX", rnd(wmax), "per-clip scale of WAVE")
    feat = feats[0].flatten(1)  # [B,128] after AdaptiveAvgPool1d
    fx, fmax = nib_pos(feat)
    f.add("FEAT", [fx[i * 128:(i + 1) * 128] for i in range(len(labels))], f"pooled conv features before the head, nibbles over [0, FEAT_MAX] [{len(labels)}] x 128")
    f.add("FEAT_MAX", rnd(fmax), "scale of FEAT")
    return f


def export_audio_spectrogram(config, trainer, dl_fn, n: int, seed: int) -> TsFile:
    waves, labels, files = audio_batch(config, n)
    f = TsFile("audio_spectrogram", "ASPEC", champion_version("audio_spectrogram"),
               f"2-D CNN on STFT magnitude (n_fft {config.n_fft}, hop {config.hop_length}): {len(labels)} FSDD TEST clips, their log-spectrograms, logits.")
    _audio_common(f, config, trainer, waves, labels, files)
    f.add("DIMS", [64, 32], "SPEC rows (frequency, low→high; 129 bins → 64 by dropping Nyquist + pair-mean) x cols (time frames)")
    f.add("SPEC", log_spec_64x32(waves, config.n_fft, config.hop_length),
          f"log|STFT| per clip, per-clip min-max to [0,1], nibbles, row-major [{len(labels)}] x 2048")
    return f


def export_audio_melspectrogram(config, trainer, dl_fn, n: int, seed: int) -> TsFile:
    from mini_networks.core.data.audio import mel_filterbank, mel_spec

    waves, labels, files = audio_batch(config, n)
    f = TsFile("audio_melspectrogram", "AMEL", champion_version("audio_melspectrogram"),
               f"2-D CNN on a {config.n_mels}-band mel spectrogram (n_fft {config.n_fft}, hop {config.hop_length}): {len(labels)} FSDD TEST clips, their log-mels, logits.")
    _audio_common(f, config, trainer, waves, labels, files)
    mel = mel_spec(waves, n_fft=config.n_fft, hop_length=config.hop_length, n_mels=config.n_mels)[:, 0]  # [B,64,T]
    lg = (mel + 1e-6).log()
    f.add("DIMS", [config.n_mels, int(lg.shape[-1])], "MEL rows (mel band, low→high) x cols (time frames)")
    f.add("MEL", [nib((s - s.min()) / (s.max() - s.min() + 1e-6), 0, 1) for s in lg],
          f"log-mel per clip, per-clip min-max to [0,1], nibbles, row-major [{len(labels)}] x {config.n_mels * lg.shape[-1]}")
    fb = mel_filterbank(config.n_fft, config.n_mels)
    f.add("FB_PEAK_BIN", fb.argmax(1).tolist(), f"STFT bin where each of the {config.n_mels} triangular mel filters peaks (of {config.n_fft // 2 + 1}); mel_filterbank assumes 16 kHz")
    return f


def export_audio_transformer(config, trainer, dl_fn, n: int, seed: int) -> TsFile:
    waves, labels, files = audio_batch(config, n)
    f = TsFile("audio_transformer", "ATF", champion_version("audio_transformer"),
               f"{config.n_layers}-layer transformer encoder over {config.n_fft // 2 + 1}-d STFT frames (d_model {config.d_model}, {config.n_heads} heads, mean-pooled): "
               f"{len(labels)} FSDD TEST clips, the frame sequence it reads, logits.")
    _audio_common(f, config, trainer, waves, labels, files)
    spec = log_spec_64x32(waves, config.n_fft, config.hop_length)
    f.add("N_FRAMES", int(spec[0].__len__() // 64), "tokens per clip (time frames)")
    f.add("FRAME_DIM", config.n_fft // 2 + 1, "input_dim per frame before the Linear → d_model projection")
    f.add("D_MODEL", config.d_model, "transformer width")
    f.add("DIMS", [64, len(spec[0]) // 64], "FRAMES rows (frequency, 129 → 64 as in ASPEC_SPEC) x cols (frames = tokens)")
    f.add("FRAMES", spec, f"log|STFT| per clip (the token sequence, transposed for display), min-max [0,1], nibbles [{len(labels)}] x {len(spec[0])}")
    return f


def capture_attention(mhas: list) -> tuple[list, Callable[[], None]]:
    """Make each nn.MultiheadAttention in `mhas` also return its per-head weights.

    The torch encoder/decoder layers call their attention with need_weights=False
    (and the encoder layer's fused fast path skips the module entirely under
    no_grad), so we wrap forward() to force need_weights=True,
    average_attn_weights=False and record weights [B, heads, q, k] per call, in
    module order. Run the probe forward with grad ENABLED (no fast path), then
    call the returned restore()."""
    store: list = [None] * len(mhas)
    originals = [m.forward for m in mhas]

    def wrap(i, orig):
        def fwd(*a, **kw):
            kw["need_weights"] = True
            kw["average_attn_weights"] = False
            out, w = orig(*a, **kw)
            store[i] = w.detach()
            return out, w
        return fwd

    for i, m in enumerate(mhas):
        m.forward = wrap(i, originals[i])

    def restore() -> None:
        for m, orig in zip(mhas, originals):
            m.forward = orig
    return store, restore


def export_text_token_classifier(config, trainer, dl_fn, n: int, seed: int) -> TsFile:
    import torch
    from mini_networks.core.data.text import vowel_labels

    ds = text_dataset(config)

    def run(text: str):
        ids = torch.tensor([ds.stoi[c] for c in text], dtype=torch.long)
        with torch.no_grad():
            logits = trainer.model(ids.unsqueeze(0))[0]
        p = torch.softmax(logits, -1)[:, 1]
        true = vowel_labels(ids, ds.itos)
        return ids.tolist(), rnd(p), true.tolist(), (p > 0.5).long().tolist()

    line = "Speak, speak."
    l_ids, l_p, l_true, l_pred = run(line)
    text = ds.text[: config.seq_len]
    t_ids, t_p, t_true, t_pred = run(text)
    acc = sum(int(a == b) for a, b in zip(t_pred, t_true)) / len(t_true)
    f = TsFile("text_token_classifier", "TOK", champion_version("text_token_classifier"),
               f"{config.n_layers}-layer encoder (d_model {config.d_model}) tagging each character vowel/other; on 'Speak, speak.' and the first "
               f"{config.seq_len} chars of Tiny Shakespeare (a real training window). Char ids = index in sorted(set(text)), {ds.vocab_size} chars.")
    f.add("VOCAB", ds.vocab_size, "character vocabulary size")
    f.add("LINE", line, "short input")
    f.add("LINE_IDS", l_ids, f"char ids [{len(l_ids)}]")
    f.add("LINE_P", l_p, "p(vowel) per char")
    f.add("LINE_TRUE", l_true, "true vowel flag per char")
    f.add("LINE_PRED", l_pred, "predicted flag (p > 0.5)")
    f.add("TEXT", text, f"a {config.seq_len}-char training window (the corpus opening)")
    f.add("TEXT_P", t_p, "p(vowel) per char")
    f.add("TEXT_TRUE", t_true, "true vowel flag per char")
    f.add("TEXT_ACC", rnd(acc), "token accuracy on TEXT")
    # attention on LINE: every layer x head, the full (unmasked) square
    layers = trainer.model.encoder.layers
    store, restore = capture_attention([l.self_attn for l in layers])
    try:
        ids = torch.tensor([ds.stoi[c] for c in line], dtype=torch.long).unsqueeze(0)
        with torch.enable_grad():  # grad on -> no fused fast path, self_attn.forward runs
            trainer.model(ids)
    finally:
        restore()
    T = len(line)
    future = torch.triu(torch.ones(T, T), 1)
    f.add("ATTN", [[nib(store[l][0, h], 0.0, 1.0) for h in range(store[l].shape[1])] for l in range(len(layers))],
          f"encoder self-attention on LINE, [layer][head] -> {T}x{T} row-major (query rows, key cols), nibbles [0, 1]; NO causal mask")
    f.add("ATTN_FUTURE", [[rnd(float((store[l][0, h] * future).sum(-1).mean())) for h in range(store[l].shape[1])] for l in range(len(layers))],
          "mean attention mass a query puts on LATER keys (k > i), [layer][head]; a causal LM has exactly 0")
    return f


def export_text_seq2seq(config, trainer, dl_fn, n: int, seed: int) -> TsFile:
    import torch
    from mini_networks.core.data.text import split_seq_halves

    ds = text_dataset(config)
    x, _ = ds[0]  # the corpus opening, a real training window
    src, tgt = split_seq_halves(x)
    dec = lambda ids: "".join(ds.itos[int(i)] for i in ids)  # noqa: E731
    dlayers = trainer.model.transformer.decoder.layers
    store, restore = capture_attention([l.self_attn for l in dlayers] + [l.multihead_attn for l in dlayers])
    try:
        with torch.no_grad():
            logits = trainer.model(src.unsqueeze(0), tgt[:-1].unsqueeze(0))[0]  # predicts tgt[1:]
    finally:
        restore()
    nl = len(dlayers)
    d_self, d_cross = store[:nl], store[nl:]
    p = torch.softmax(logits, -1)
    top = p.argmax(-1)
    true_p = p.gather(1, tgt[1:].unsqueeze(1)).squeeze(1)
    seed_all(seed)
    sampled = trainer.infer(config, {"src": src, "temperature": 0.8})["predictions"][0]
    f = TsFile("text_seq2seq", "S2S", champion_version("text_seq2seq"),
               f"encoder-decoder transformer ({config.n_layers}+{config.n_layers} layers, d_model {config.d_model}) continuing the first half of a "
               f"{config.seq_len}-char window with the second half. Teacher-forced next-char predictions on the true target, plus one sampled decode (T=0.8, seed {seed}).")
    f.add("VOCAB", ds.vocab_size, "character vocabulary size (ids = index in sorted(set(text)))")
    f.add("SRC", dec(src), f"encoder input [{len(src)} chars]")
    f.add("SRC_IDS", src.tolist(), "its char ids")
    f.add("TGT", dec(tgt), f"true continuation [{len(tgt)} chars]; the decoder is seeded with TGT[0] (= the char after SRC)")
    f.add("PRED", [ds.itos[int(i)] for i in top], f"teacher-forced top-1 char for TGT[1..] [{len(top)}]")
    f.add("PRED_P", rnd(p.max(-1).values), "its probability")
    f.add("TRUE_P", rnd(true_p), "probability of the true char")
    f.add("SAMPLED", dec(sampled), f"sampled decode from SRC's last char [{len(sampled)} chars]")
    f.add("TEMPERATURE", 0.8, "sampling temperature used for SAMPLED")
    nq, nk = d_cross[0].shape[-2], d_cross[0].shape[-1]
    f.add("SELF", [[nib(w[0, h], 0.0, 1.0) for h in range(w.shape[1])] for w in d_self],
          f"decoder self-attention (causal) on the teacher-forced pass, [layer][head] -> {nq}x{nq}, nibbles [0, 1]")
    f.add("CROSS_HI", 0.25, "upper end of the CROSS nibble range (real weights stay <= ~.25; 1/32 = .031 is uniform)")
    f.add("CROSS", [[nib(w[0, h], 0.0, 0.25) for h in range(w.shape[1])] for w in d_cross],
          f"decoder cross-attention (Q tgt, K/V encoder memory), [layer][head] -> {nq}x{nk} row-major, nibbles [0, CROSS_HI]; no mask")
    ent = lambda w: float((-(w * w.clamp_min(1e-12).log()).sum(-1)).mean())  # noqa: E731
    f.add("CROSS_MAXW", [[rnd(float(w[0, h].max())) for h in range(w.shape[1])] for w in d_cross],
          "largest single cross-attention weight, [layer][head]")
    f.add("CROSS_ENTROPY", [[rnd(ent(w[0, h])) for h in range(w.shape[1])] for w in d_cross],
          f"mean row entropy (nats) of cross-attention, [layer][head]; uniform over {nk} keys = ln {nk} = {math.log(nk):.2f}")
    return f


def export_rag(config, trainer, dl_fn, n: int, seed: int) -> TsFile:
    import torch

    ds = ensure_tokenizer(trainer, config)
    query = "hear me speak"
    scored = trainer.rag.index.retrieve(query, top_k=config.top_k)
    prompt = trainer.rag.build_prompt(query)
    ids = trainer.tokenizer.encode(prompt)
    seed_all(seed)
    with torch.no_grad():
        full = trainer.model.generate(torch.tensor([ids]), max_new_tokens=64, temperature=0.8)
    generated = trainer.tokenizer.decode(full[0, len(ids):].tolist())
    f = TsFile("rag", "RAG", champion_version("rag"),
               f"TF-IDF retriever over {config.chunk_size}-char chunks of Tiny Shakespeare + a {config.n_layers}-layer char LM (seq_len {config.seq_len}): "
               f"the top-{config.top_k} chunks for a query, the augmented prompt, and 64 generated chars (T=0.8, seed {seed}).",
               ["The LM only attends to the LAST seq_len chars of the prompt — the retrieved context is mostly cut off; that is the lesson."])
    f.add("QUERY", query, "the question")
    f.add("QUERY_TERMS", trainer.rag.index._tokenize(query), "TF-IDF tokens of the query ([a-z0-9]+)")
    f.add("TOP_K", config.top_k, "chunks retrieved")
    f.add("CHUNK_SIZE", config.chunk_size, "chars per indexed chunk")
    f.add("N_CHUNKS", len(trainer.rag.index.documents), "chunks in the index")
    f.add("VOCAB_WORDS", len(trainer.rag.index._word2idx), "TF-IDF vocabulary size")
    f.add("SCORES", rnd([s for s, _ in scored]), "cosine(query, chunk) of the retrieved chunks")
    f.add("CHUNKS", [d for _, d in scored], f"the retrieved chunks [{len(scored)}]")
    f.add("PROMPT", prompt, f"'[Context: c1 | c2 | c3] query' fed to the LM [{len(prompt)} chars]")
    f.add("SEQ_LEN", config.seq_len, "LM context window (chars)")
    f.add("GENERATED", generated, "the 64 generated chars")
    f.add("VOCAB", ds.vocab_size, "character vocabulary size")
    return f


def export_rlhf(config, trainer, dl_fn, n: int, seed: int) -> TsFile:
    import torch
    from mini_networks.models.rlhf.model import _ARCHAIC, _COMMON, shakespearean_score

    ds = ensure_tokenizer(trainer, config)
    prompt = "Thou art "
    ids = trainer.tokenizer.encode(prompt)
    x = torch.tensor([ids])
    p_chosen, p_top, p_prompt = [], [], []
    seed_all(seed)
    temperature = 1.0
    with torch.no_grad():
        for _ in range(64):  # TransformerLM.generate, with the sampled probabilities recorded
            logits, _ = trainer.model(x[:, -config.seq_len:])
            probs = torch.softmax(logits[:, -1, :] / temperature, -1)
            nxt = torch.multinomial(probs, 1)
            p_chosen.append(float(probs[0, nxt[0, 0]]))
            p_top.append(float(probs[0].max()))
            x = torch.cat([x, nxt], 1)
    generated = trainer.tokenizer.decode(x[0, len(ids):].tolist())
    words = re.findall(r"[a-z']+", generated.lower())
    band = lambda w: ("archaic" if w in _ARCHAIC else "suffix" if w.endswith(("eth", "est", "'st", "'d"))  # noqa: E731
                      else "common" if w in _COMMON else "none")
    nw = max(1, len(words))
    parts = {"realFrac": sum(w in _COMMON or w in _ARCHAIC for w in words) / nw,
             "suffixFrac": sum(w.endswith(("eth", "est", "'st", "'d")) for w in words) / nw,
             "archaic": sum(w in _ARCHAIC for w in words) / nw}
    f = TsFile("rlhf", "RLHF", champion_version("rlhf"),
               f"PPO-tuned char LM ({config.n_layers} layers, d_model {config.d_model}; KL coef {config.kl_coef}, clip {config.ppo_clip}): 64 chars sampled "
               f"after '{prompt.strip()}' (T=1.0, seed {seed}), the probability of every sampled char, and the dense Shakespearean reward with its three bands.",
               ["Reward = min(1, 0.25·realFrac + 0.25·min(1, 4·suffixFrac) + 0.5·min(1, 5·archaic)) over the generated words (models/rlhf/model.py)."])
    f.add("PROMPT", prompt, "prompt text")
    f.add("PROMPT_IDS", ids, "its char ids")
    f.add("GENERATED", generated, "64 sampled chars")
    f.add("P_CHOSEN", rnd(p_chosen), "policy probability of each sampled char [64]")
    f.add("P_TOP", rnd(p_top), "the policy's top-1 probability at each step [64]")
    f.add("TEMPERATURE", temperature, "sampling temperature")
    f.add("WORDS", [[w, band(w)] for w in words], "each generated word with the reward band it hits (archaic | suffix | common | none)")
    f.add("REWARD_PARTS", rnd(parts), "the three band fractions")
    f.add("REWARD", rnd(shakespearean_score(generated)), "shakespearean_score(GENERATED)")
    f.add("KL_COEF", config.kl_coef, "KL(π‖π_ref) weight in the PPO objective")
    f.add("PPO_CLIP", config.ppo_clip, "PPO ratio clip ε")
    f.add("VOCAB", ds.vocab_size, "character vocabulary size")
    _rlhf_stand_in(f, config, trainer, ds, seed)
    return f


def _rlhf_stand_in(f: TsFile, config, trainer, ds, seed: int) -> None:
    """grpo / dpo have no local champions: run THEIR rollout code shape with the
    rlhf champion as a stand-in policy, so the anatomy can show real text. The
    trainers' first prompt (16-char corpus window), M budget (16 new chars,
    T=1.0, eval mode), rewards via the same decode + shakespearean_score.
    Seeded after the main sample so the constants above never change."""
    import torch
    from mini_networks.models.rlhf.model import shakespearean_score
    from mini_networks.models.rlhf.trainer import _log_probs_of_tokens

    tok, model = trainer.tokenizer, trainer.model
    prompt_ids = tok.encode(ds.text)[:16]
    raw = lambda ids: "".join(ds.itos[i] for i in ids)  # noqa: E731 — keeps '\n' (id 0), which decode drops
    model.eval()

    def roll():
        with torch.no_grad():
            full = model.generate(torch.tensor([prompt_ids]), max_new_tokens=16, temperature=1.0)
            lp = float(_log_probs_of_tokens(model, full).sum())
        resp = full[0, len(prompt_ids):].tolist()
        return raw(resp), float(shakespearean_score(tok.decode(resp))), lp

    seed_all(seed + 1)
    group = [roll() for _ in range(4)]
    r = torch.tensor([g[1] for g in group])
    adv = (r - r.mean()) / (r.std() + 1e-6)  # GRPOTrainer._grpo_update, unbiased std
    seed_all(seed + 2)
    tied, pair = 0, None
    while pair is None and tied < 16:  # DPOTrainer._collect_pairs: two samples, ties skipped
        a, b = roll(), roll()
        if a[1] == b[1]:
            tied += 1
        else:
            pair = sorted([a, b], key=lambda c: c[1], reverse=True)
    f.add("STANDIN_PROMPT", raw(prompt_ids), "grpo/dpo stand-in: the trainers' first prompt (16-char corpus window)")
    f.add("GROUP", [g[0] for g in group], f"grpo stand-in: G=4 responses of 16 chars from the rlhf champion (seed {seed + 1}, T=1.0, '\\n' kept)")
    f.add("GROUP_REWARDS", rnd([g[1] for g in group]), "shakespearean_score of each (decode drops '\\n', as in training)")
    f.add("GROUP_ADV", rnd(adv), "(r - mean) / (std_unbiased + 1e-6), exactly GRPOTrainer")
    if pair is not None:
        f.add("PAIR", [p[0] for p in pair], f"dpo stand-in: [chosen, rejected] 16-char responses (seed {seed + 2}) after {tied} tied pairs skipped")
        f.add("PAIR_REWARDS", rnd([p[1] for p in pair]), "their scores: used only to sort, never in the loss")
        f.add("PAIR_TIED", tied, "tied pairs skipped before this one")
        f.add("PAIR_LOGP", rnd([p[2] for p in pair], 2), "Σ log π over the 31 terms of each [prompt + response] (eval mode); at step 0 π_ref is the same net, so lr = lp and m = 0")


def export_tabular_diffusion(config, trainer, dl_fn, n: int, seed: int) -> TsFile:
    import torch
    from mini_networks.core.diffusion.sampling import sample_loop

    T = config.effective_timesteps
    snaps = [t for t in (199, 150, 100, 50, 25, 10, 0) if t < T]
    traj: dict[str, Any] = {}

    def cb(x, t, step, _state):
        if t in snaps:
            traj[str(t)] = rnd(x)
        return None

    torch.manual_seed(seed)
    traj[str(T)] = rnd(torch.randn(n, config.n_features))  # == sample_loop's initial draw under the same seed
    final = sample_loop(scheduler=trainer.scheduler, predict_noise=lambda x, tb, t, _: trainer.model(x, tb),
                        shape=(n, config.n_features), device=config.device, timesteps=T, seed=seed, step_callback=cb)
    ds = iris_test()
    real = torch.stack([ds[i][0] for i in range(len(ds))])
    real_y = [int(ds[i][1]) for i in range(len(ds))]
    nn_cls = [real_y[int(((real - s) ** 2).sum(1).argmin())] for s in final]
    ac = trainer.scheduler.alphas_cumprod
    max_abs = float(final.abs().max())
    diverged = max_abs > 10.0  # standardized features live in roughly [-3, 3]
    notes = ([f"NOTE the chain DIVERGES (max |x| = {max_abs:.0f} vs real |x| <= 3.1): the champion under-predicts eps and the "
              "200-step ancestral loop amplifies it — this is the trainer's own infer() behaviour on the registered checkpoint, "
              "exported as-is (its evalspec bar is PROVISIONAL). SNAP_T values near T are still well-behaved."]
             if diverged else [])
    f = TsFile("tabular_diffusion", "TDIFF", champion_version("tabular_diffusion"),
               f"DDPM over the 4 standardized Iris features (T={T}, linear betas {config.beta_start}→{config.beta_end} scaled 1000/T): "
               f"{n} samples with the denoising trajectory at a few t, the real test rows for comparison, and each sample's nearest real class.", notes)
    f.add("DIVERGED", diverged, "true when the final samples left the data range (see header note)")
    f.add("MAX_ABS", rnd(max_abs), "max |x| over the final samples")
    f.add("FEATURE_NAMES", IRIS_FEATURES, "feature order")
    f.add("CLASS_NAMES", IRIS_CLASSES, "label order")
    f.add("T", T, "chain length")
    f.add("BETA", [config.beta_start, config.beta_end], "linear beta range before the 1000/T scaling")
    f.add("SNAP_T", [T] + snaps, "timesteps recorded in TRAJ (T = initial noise, then x after the step at t)")
    f.add("ABAR", rnd([1.0] + [float(ac[t]) for t in snaps]), "ᾱ at each SNAP_T (1 for the pure-noise start)")
    f.add("TRAJ", traj, f"{{t: [{n}][4]}} sample states")
    f.add("SAMPLES", rnd(final), f"final samples [{n}][4]")
    f.add("NN_CLASS", nn_cls, "class of the nearest real test row to each sample")
    f.add("REAL", rnd(real[iris_pick(n)]), f"{n} real standardized test rows (spread over the classes)")
    f.add("REAL_Y", [real_y[i] for i in iris_pick(n)], "their classes")
    return f


EXPORTERS: dict[str, Callable[..., TsFile]] = {
    "tabular_classifier": export_tabular_classifier,
    "pixelcnn": export_pixelcnn,
    "detection": export_detection,
    "lora": export_lora,
    "audio_classifier": export_audio_classifier,
    "audio_spectrogram": export_audio_spectrogram,
    "audio_melspectrogram": export_audio_melspectrogram,
    "audio_transformer": export_audio_transformer,
    "text_token_classifier": export_text_token_classifier,
    "text_seq2seq": export_text_seq2seq,
    "rag": export_rag,
    "rlhf": export_rlhf,
    "tabular_diffusion": export_tabular_diffusion,
}


# ----------------------------------------------------------------------------
# CLI
# ----------------------------------------------------------------------------

def plan(models: list[str] | None, out_dir: Path, force: bool) -> list[tuple[str, str | None]]:
    """-> [(model, skip_reason | None)]."""
    from mini_networks.core.registry import MODEL_NAMES

    rows = []
    for m in models or MODEL_NAMES:
        if m not in MODEL_NAMES:
            rows.append((m, "unknown model"))
        elif champion_version(m) is None:
            rows.append((m, "no local champion under runs/champions/ (not pulled, or none registered)"))
        elif m not in EXPORTERS:
            rows.append((m, "no exporter in this script" + (" (data file already exists)" if (out_dir / f"{m}-champion.ts").exists() else "")))
        elif (out_dir / f"{m}-champion.ts").exists() and not force and not models:
            rows.append((m, "data file exists (pass --models or --force to regenerate)"))
        else:
            rows.append((m, None))
    return rows


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--models", default="", help="comma-separated model names (default: every model with a local champion and no data file)")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT, help="directory for the <model>-champion.ts files")
    ap.add_argument("--n", type=int, default=8, help="items per model (<= 8 keeps CPU inference tiny)")
    ap.add_argument("--seed", type=int, default=2026, help="base seed for sampling / placement (each model adds a stable crc32 offset)")
    ap.add_argument("--force", action="store_true", help="overwrite existing data files")
    ap.add_argument("--list", action="store_true", help="print the plan and exit")
    args = ap.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")

    models = [m.strip() for m in args.models.split(",") if m.strip()] or None
    rows = plan(models, args.out, args.force)
    if args.list:
        for m, why in rows:
            print(f"{'RUN ' if why is None else 'SKIP'} {m:24s} {why or ''}")
        return 0

    args.out.mkdir(parents=True, exist_ok=True)
    t_all = time.time()
    written, skipped = [], []
    for m, why in rows:
        if why:
            if models or m in EXPORTERS:
                log.info("skip %s: %s", m, why)
            skipped.append((m, why))
            continue
        t0 = time.time()
        # Stable per-model seed: the same --seed must not hand every text model the
        # same random stream (rag and rlhf sampled near-identical strings).
        model_seed = args.seed + zlib.crc32(m.encode()) % 1000
        try:
            seed_all(model_seed)
            config, trainer, dl_fn = load_champion(m)
            ts = EXPORTERS[m](config, trainer, dl_fn, args.n, model_seed)
            path = ts.write(args.out)
            log.info("wrote %s (%d consts, %.1f KB) in %.1fs", path.relative_to(REPO), len(ts.consts),
                     path.stat().st_size / 1024, time.time() - t0)
            written.append(m)
        except Exception as e:  # keep going: one broken probe must not block the rest
            log.exception("FAILED %s after %.1fs: %s: %s", m, time.time() - t0, type(e).__name__, e)
            skipped.append((m, f"probe failed: {type(e).__name__}: {e}"))
    log.info("done in %.1fs — wrote %d: %s", time.time() - t_all, len(written), ", ".join(written) or "-")
    for m, why in skipped:
        if models or m in EXPORTERS:
            log.info("skipped %s: %s", m, why)
    return 0 if written or not rows else 1


if __name__ == "__main__":
    raise SystemExit(main())
