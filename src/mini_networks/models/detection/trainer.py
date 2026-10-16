"""Detection trainer (dual-head CNN: classification + bounding box)."""
from __future__ import annotations

from typing import Any

import torch
from torch.utils.data import DataLoader

from mini_networks.core.config import BaseConfig
from mini_networks.core.data.registry import get_dataloader
from mini_networks.core.logging.logger import Logger
from mini_networks.core.runtime import DetectionTrainerBase
from mini_networks.models.detection.config import DetectionConfig
from mini_networks.models.detection.model import DigitDetector, detection_loss


class DetectionTrainer(DetectionTrainerBase):
    """Train DigitDetector on (canvas, label, bbox) batches.

    The DetectionTrainerBase loop is reused; `_loss` swaps in
    `detection_loss` so `bbox_loss_weight` applies. Checkpoint: `model.pt`.
    """

    def __init__(self):
        self.model: DigitDetector | None = None

    def _build(self, config: DetectionConfig) -> DigitDetector:
        return DigitDetector(num_classes=config.num_classes).to(config.device)

    def _forward(self, model: DigitDetector, batch, config: DetectionConfig):
        canvases, labels, bboxes = batch
        canvases = canvases.to(config.device)
        labels = labels.to(config.device)
        bboxes = bboxes.to(config.device)
        cls_logits, bbox_pred = model(canvases)
        return cls_logits, bbox_pred, labels, bboxes

    def _loss(
        self,
        class_logits: torch.Tensor,
        bbox_pred: torch.Tensor,
        labels: torch.Tensor,
        target_bbox: torch.Tensor,
        config: BaseConfig,
    ) -> torch.Tensor:
        assert isinstance(config, DetectionConfig)
        return detection_loss(
            class_logits, bbox_pred, labels, target_bbox, config.bbox_loss_weight
        )

    def evaluate(self, config: BaseConfig, dataloader: DataLoader, logger: Logger) -> dict:
        """Classification accuracy only -> {"eval_accuracy"}.

        Box quality is not scored here; iterates the whole loader (not capped
        by max_eval_batches).
        """
        assert isinstance(config, DetectionConfig)
        if self.model is None:
            self.model = self._build(config)
        model = self.model
        model.eval()
        correct = total = 0
        with torch.no_grad():
            for canvases, labels, _ in dataloader:
                canvases = canvases.to(config.device)
                labels = labels.to(config.device)
                cls_logits, _ = model(canvases)
                preds = cls_logits.argmax(dim=1)
                correct += (preds == labels).sum().item()
                total += labels.numel()
        return {"eval_accuracy": correct / max(1, total)}

    def infer(self, config: BaseConfig, inputs: Any) -> Any:
        """Canvases [B, 1, 56, 56] (bare tensor or {"images": ...}) ->
        {"class_probs": [B, num_classes], "bboxes": [B, 4] normalised x1,y1,x2,y2} (CPU tensors)."""
        assert isinstance(config, DetectionConfig)
        if self.model is None:
            raise RuntimeError("Model not loaded.")
        self.model.eval()
        with torch.no_grad():
            images = inputs if isinstance(inputs, torch.Tensor) else inputs["images"]
            images = images.to(config.device)
            cls_logits, bbox_pred = self.model(images)
            return {
                "class_probs": torch.softmax(cls_logits, dim=-1).cpu(),
                "bboxes": bbox_pred.cpu(),
            }


def make_detection_dataloader(config: DetectionConfig, split: str = "train") -> DataLoader:
    """(canvases [B, 1, S, S], labels [B], bboxes [B, 4]) with S = canvas_size.

    Each 28x28 digit is pasted at a fresh random offset per access; the box is
    the pasted 28x28 patch (not a tight fit to the ink), normalised by S.
    """
    return get_dataloader(
        name=config.dataset,
        data_root=config.data_root,
        split=split,
        task="detection",
        batch_size=config.effective_batch_size,
        fast_demo=config.effective_fast_demo,
        sample_limit=config.dataset_sample_limit,
        canvas_size=config.canvas_size,
    )
