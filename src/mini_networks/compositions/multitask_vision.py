"""Multitask vision: one shared CNN backbone, three task heads.

Hard parameter sharing (Caruana, 1997): a single feature extractor is trained
by the summed losses of three tasks on the same image — a 28x28 digit pasted
at a random spot on a 56x56 black canvas:

    canvas [B,1,56,56] -> backbone (2x conv+ReLU+maxpool) -> feat [B,2c,14,14]
      cls_head: global avg pool -> Linear                  -> [B,10] logits
      seg_head: conv -> conv 1x1 -> Sigmoid                -> [B,1,14,14] mask
                (upsampled bilinearly to 56x56 for the loss)
      det_head: global avg pool -> MLP -> Sigmoid          -> [B,4] box
    loss = CE(cls) + BCE(seg, ink>0 mask) + MSE(box, [x1,y1,x2,y2]/56)

What it demonstrates: the three classic vision outputs (what / which pixels
/ where) can share one representation, and their losses simply add.

Deliberately simplified: equal, unweighted loss terms (no uncertainty
weighting or gradient balancing); the target box is the pasted 28x28 tile,
not the tight box around the ink; the detection head works from globally
average-pooled features, which discards most explicit location information
(a real detector regresses from the spatial map); and one object per image.
"""
from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader

from mini_networks.core.config import BaseConfig
from mini_networks.core.data.registry import (
    _load_torchvision_dataset,
    make_binary_mask,
    place_on_canvas,
)
from mini_networks.core.logging.logger import Logger


class MultiTaskVisionConfig(BaseConfig):
    """Knobs: ``base_channels`` (backbone width c), ``canvas_size`` (side of
    the canvas the digit is pasted onto), ``dataset`` (``"mnist"``, anything
    else loads FashionMNIST)."""

    model_name: str = "multitask_vision"
    base_channels: int = 32
    num_classes: int = 10
    canvas_size: int = 56
    dataset: str = "mnist"


class MultiTaskDataset(Dataset):
    """Returns (canvas [1,S,S], class label, seg mask [S,S] long, bbox [4]).

    The digit is placed at a fresh random position every time an item is
    read (numpy global RNG), so positions differ across epochs. ``bbox`` is
    ``[x1, y1, x2, y2]`` of the pasted tile, normalised by ``canvas_size``.
    """

    def __init__(
        self,
        data_root: str,
        train: bool,
        canvas_size: int,
        fast_demo: bool,
        dataset: str,
        sample_limit: int | None = None,
    ):
        """Wrap MNIST (or FashionMNIST); 256 items under ``fast_demo``."""
        import torchvision
        import torchvision.transforms as T

        ds_cls = torchvision.datasets.MNIST if dataset == "mnist" else torchvision.datasets.FashionMNIST
        dataset_name = "MNIST" if dataset == "mnist" else "FashionMNIST"
        ds = _load_torchvision_dataset(
            ds_cls,
            data_root=data_root,
            train=train,
            transform=T.ToTensor(),
            name=dataset_name,
        )
        self._data = ds
        self.canvas_size = canvas_size
        base_limit = 256 if fast_demo else len(ds)
        self._limit = min(base_limit, sample_limit) if sample_limit is not None else base_limit

    def __len__(self) -> int:
        """Number of items exposed (dataset size capped by fast_demo / sample_limit)."""
        return self._limit

    def __getitem__(self, idx: int):
        """Paste item ``idx`` onto a canvas and derive its mask and box."""
        image, label = self._data[idx]
        canvas, bbox = place_on_canvas(image, self.canvas_size)
        mask = make_binary_mask(canvas, threshold=0.0)
        bbox_norm = torch.tensor([c / self.canvas_size for c in bbox], dtype=torch.float32)
        return canvas, int(label), mask, bbox_norm


class MultiTaskModel(nn.Module):
    """Shared conv backbone with classification, segmentation and box heads."""

    def __init__(self, base_channels: int = 32, num_classes: int = 10):
        super().__init__()
        c = base_channels
        self.backbone = nn.Sequential(
            nn.Conv2d(1, c, 3, padding=1), nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Conv2d(c, c * 2, 3, padding=1), nn.ReLU(),
            nn.MaxPool2d(2),
        )
        self.cls_head = nn.Sequential(
            nn.AdaptiveAvgPool2d((1, 1)),
            nn.Flatten(),
            nn.Linear(c * 2, num_classes),
        )
        self.seg_head = nn.Sequential(
            nn.Conv2d(c * 2, c, 3, padding=1),
            nn.ReLU(),
            nn.Conv2d(c, 1, 1),
            nn.Sigmoid(),
        )
        self.det_head = nn.Sequential(
            nn.AdaptiveAvgPool2d((1, 1)),
            nn.Flatten(),
            nn.Linear(c * 2, 64),
            nn.ReLU(),
            nn.Linear(64, 4),
            nn.Sigmoid(),
        )

    def forward(self, x: torch.Tensor):
        """[B,1,H,W] -> (logits [B,num_classes], mask probs [B,1,H/4,W/4],
        box [B,4] in [0,1])."""
        feat = self.backbone(x)
        logits = self.cls_head(feat)
        seg = self.seg_head(feat)
        bbox = self.det_head(feat)
        return logits, seg, bbox


class MultiTaskVision:
    """Trains a MultiTaskModel on random-placement canvases."""

    def __init__(self):
        self.model: MultiTaskModel | None = None

    def _build(self, config: MultiTaskVisionConfig) -> MultiTaskModel:
        """The three-headed model on ``config.device``."""
        return MultiTaskModel(base_channels=config.base_channels, num_classes=config.num_classes).to(config.device)

    def train(self, config: MultiTaskVisionConfig, logger: Logger) -> None:
        """Minimise cls + seg + det loss jointly.

        Logs the summed ``loss`` per epoch (individual terms are not logged);
        saves ``model.pt``.
        """
        ds = MultiTaskDataset(
            data_root=config.data_root,
            train=True,
            canvas_size=config.canvas_size,
            fast_demo=config.effective_fast_demo,
            dataset=config.dataset,
            sample_limit=config.dataset_sample_limit,
        )
        dl = DataLoader(ds, batch_size=config.effective_batch_size, shuffle=True, num_workers=0)
        model = self._build(config)
        self.model = model
        opt = torch.optim.Adam(model.parameters(), lr=config.learning_rate)

        for epoch in range(config.effective_epochs):
            model.train()
            total = 0.0
            for images, labels, masks, bboxes in dl:
                images = images.to(config.device)
                labels = labels.to(config.device)
                masks = masks.to(config.device)
                bboxes = bboxes.to(config.device)
                logits, seg, bbox = model(images)
                seg = F.interpolate(
                    seg,
                    size=masks.shape[-2:],
                    mode="bilinear",
                    align_corners=False,
                )
                cls_loss = F.cross_entropy(logits, labels)
                seg_loss = F.binary_cross_entropy(seg.squeeze(1), masks.float())
                det_loss = F.mse_loss(bbox, bboxes)
                loss = cls_loss + seg_loss + det_loss
                opt.zero_grad()
                loss.backward()
                opt.step()
                total += loss.item()
            logger.log_metrics(epoch, {"loss": total / max(1, len(dl))})

        torch.save(model.state_dict(), logger.artifact_path("model.pt"))
