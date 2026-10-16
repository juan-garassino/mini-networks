"""Segment-then-detect: get boxes for free from a segmentation mask.

A two-stage pipeline where only the first stage learns:

    1. SegUNet (the zoo's segmentation U-Net) maps [B,1,28,28] -> per-pixel
       foreground probability [B,1,28,28], trained with BCE + Dice against
       the "ink > 0" mask of each MNIST digit
    2. threshold at 0.5 and take the min/max x,y of the foreground pixels
       -> box [x1, y1, x2, y2] normalised by the image size (``mask_to_bbox``)

What it demonstrates: with one object per image, detection reduces to
segmentation plus geometry — no box regression head, no anchors. Contrast
multitask_vision, which regresses boxes directly.

Deliberately simplified: one object per image (a multi-object version would
need connected components), the image is the raw 28x28 digit (no canvas
placement, so boxes only measure the ink extent), and stray foreground
pixels stretch the box since there is no outlier filtering.
"""
from __future__ import annotations

import torch
import torch.nn.functional as F

from mini_networks.core.config import BaseConfig
from mini_networks.core.data.registry import get_dataloader
from mini_networks.core.logging.logger import Logger
from mini_networks.models.segmentation.unet import SegUNet, dice_loss


class SegmentThenDetectConfig(BaseConfig):
    """Knobs: ``base_channels`` (U-Net width), ``dataset``."""

    model_name: str = "segment_then_detect"
    base_channels: int = 32
    dataset: str = "mnist"


def mask_to_bbox(mask: torch.Tensor) -> torch.Tensor:
    """mask: [B, H, W] -> bbox [B, 4] in (x1,y1,x2,y2) normalized.

    Coordinates are the min/max pixel indices of nonzero mask entries,
    divided by W (x) or H (y), so the right/bottom edge of a full-width mask
    is (W-1)/W rather than 1. An empty mask yields [0, 0, 0, 0].
    """
    bboxes = []
    for m in mask:
        ys, xs = torch.where(m > 0)
        if len(xs) == 0:
            bboxes.append(torch.tensor([0, 0, 0, 0], dtype=torch.float32))
            continue
        x1, x2 = xs.min().item(), xs.max().item()
        y1, y2 = ys.min().item(), ys.max().item()
        h, w = m.shape
        bboxes.append(torch.tensor([x1 / w, y1 / h, x2 / w, y2 / h], dtype=torch.float32))
    return torch.stack(bboxes, dim=0)


class SegmentThenDetect:
    """Train a binary SegUNet; derive boxes from its thresholded masks."""

    def __init__(self):
        self.model: SegUNet | None = None

    def _build(self, config: SegmentThenDetectConfig) -> SegUNet:
        """Binary SegUNet (sigmoid output) on ``config.device``."""
        return SegUNet(in_channels=1, out_channels=1, base_channels=config.base_channels).to(config.device)

    def train(self, config: SegmentThenDetectConfig, logger: Logger) -> None:
        """Train the U-Net with BCE + Dice; logs ``seg_loss``, saves ``seg_unet.pt``."""
        dl = get_dataloader(
            name=config.dataset,
            data_root=config.data_root,
            split="train",
            task="binary_segmentation",
            batch_size=config.effective_batch_size,
            fast_demo=config.effective_fast_demo,
            sample_limit=config.dataset_sample_limit,
        )
        model = self._build(config)
        self.model = model
        opt = torch.optim.Adam(model.parameters(), lr=config.learning_rate)

        for epoch in range(config.effective_epochs):
            model.train()
            total = 0.0
            for images, masks in dl:
                images, masks = images.to(config.device), masks.to(config.device)
                preds = model(images)
                loss = F.binary_cross_entropy(preds.squeeze(1), masks.float()) + dice_loss(
                    preds.squeeze(1), masks
                )
                opt.zero_grad()
                loss.backward()
                opt.step()
                total += loss.item()
            logger.log_metrics(epoch, {"seg_loss": total / max(1, len(dl))})

        torch.save(model.state_dict(), logger.artifact_path("seg_unet.pt"))

    @torch.no_grad()
    def infer_bbox(self, config: SegmentThenDetectConfig, images: torch.Tensor) -> torch.Tensor:
        """images [B,1,28,28] -> boxes [B,4] (CPU), via mask > 0.5 then ``mask_to_bbox``."""
        if self.model is None:
            raise RuntimeError("Train first.")
        model = self.model
        model.eval()
        images = images.to(config.device)
        preds = model(images).squeeze(1)
        masks = (preds > 0.5).float()
        return mask_to_bbox(masks.cpu())
