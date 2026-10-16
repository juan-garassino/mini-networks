"""Unified logger: writes metrics/config/artifacts into a single run directory.

When ``MN_MLFLOW_TRACKING_URI`` is set, every write is also mirrored to an MLflow
run (see ``mlflow_sink``). The file-writing path below is unchanged and remains
the source of truth, so the quality gate is unaffected whether or not MLflow is
enabled. The MLflow run is ended by ``close()`` (called at the trainer entry
points) with an ``atexit`` safety net, because ``log_summary`` is not reliably
called by every trainer loop.
"""
from __future__ import annotations

import atexit
import json
from datetime import datetime
from pathlib import Path
from typing import Any

import torch
import yaml

from mini_networks.core.logging.mlflow_sink import MLflowSink, is_mlflow_enabled


class Logger:
    """Per-run writer for the run contract read by the gate and the /web layer.

    Layout under ``run_dir``: ``metrics.jsonl`` (one ``{"step","key","value"}``
    object per line, append-only), ``config.yaml``, ``summary.json``,
    ``training_state.pt`` (resume state) and ``artifacts/`` (checkpoints,
    samples). ``run_dir`` is ``output_dir/<run_name or UTC timestamp>``, or
    ``output_dir`` itself when its basename already equals ``run_name``.

    When ``MN_MLFLOW_TRACKING_URI`` is set an ``MLflowSink`` mirrors every
    write; ``close()`` ends that run (also registered with ``atexit``). Usable
    as a context manager: an exception marks the MLflow run FAILED.
    """

    def __init__(self, output_dir: str, run_name: str | None = None):
        ts = run_name or datetime.utcnow().strftime("%Y%m%d-%H%M%S")
        base_dir = Path(output_dir)
        self.run_dir = base_dir if run_name and base_dir.name == run_name else base_dir / ts
        self.artifacts_dir = self.run_dir / "artifacts"
        self.run_dir.mkdir(parents=True, exist_ok=True)
        self.artifacts_dir.mkdir(parents=True, exist_ok=True)
        self._metrics_path = self.run_dir / "metrics.jsonl"
        self._config_path = self.run_dir / "config.yaml"
        self._state_path = self.run_dir / "training_state.pt"
        self._summary_path = self.run_dir / "summary.json"
        self._closed = False
        self._mlflow = (
            MLflowSink(run_name=self.run_dir.name, run_dir=self.run_dir, artifacts_dir=self.artifacts_dir)
            if is_mlflow_enabled()
            else None
        )
        if self._mlflow is not None:
            atexit.register(self.close)

    def log_config(self, config_dict: dict) -> None:
        """Overwrite ``config.yaml`` with ``config_dict`` (and log it as MLflow params)."""
        with open(self._config_path, "w") as f:
            yaml.dump(config_dict, f, default_flow_style=False)
        if self._mlflow is not None:
            self._mlflow.log_params(config_dict)

    def log_metric(self, step: int, key: str, value: Any) -> None:
        """Append one ``{"step", "key", "value"}`` line to ``metrics.jsonl``.

        ``value`` must be JSON-serialisable; only finite numbers reach MLflow.
        """
        entry = {"step": step, "key": key, "value": value}
        with open(self._metrics_path, "a") as f:
            f.write(json.dumps(entry) + "\n")
        if self._mlflow is not None:
            self._mlflow.log_metric(step, key, value)

    def log_metrics(self, step: int, metrics: dict) -> None:
        """Log every ``key: value`` in ``metrics`` at the same ``step``."""
        for key, value in metrics.items():
            self.log_metric(step, key, value)

    def artifact_path(self, name: str) -> Path:
        """Path for an artifact file named ``name`` under ``run_dir/artifacts/`` (not created)."""
        return self.artifacts_dir / name

    @property
    def mlflow_run_id(self) -> str | None:
        """MLflow run id when the sink is active (survives close()); else None."""
        return self._mlflow.run_id if self._mlflow is not None else None

    @property
    def state_path(self) -> Path:
        """Path of this run's ``training_state.pt`` (resume checkpoint)."""
        return self._state_path

    def log_summary(self, summary: dict[str, Any]) -> None:
        """Write ``summary.json`` (overwrites); mirrors entries to MLflow as tags + ``final_*`` metrics."""
        with open(self._summary_path, "w") as f:
            json.dump(summary, f, indent=2, sort_keys=True)
        if self._mlflow is not None:
            self._mlflow.set_tags({k: v for k, v in summary.items()})
            self._mlflow.log_final_metrics({k: v for k, v in summary.items()})

    def close(self, status: str = "FINISHED") -> None:
        """End the MLflow run (idempotent). No-op when MLflow is disabled."""
        if self._closed:
            return
        self._closed = True
        if self._mlflow is not None:
            self._mlflow.close(status)

    def __enter__(self) -> "Logger":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self.close("FAILED" if exc_type is not None else "FINISHED")

    def save_training_state(self, state: dict[str, Any]) -> None:
        """``torch.save`` ``state`` to ``training_state.pt`` (enables resume via core.checkpoints)."""
        torch.save(state, self._state_path)

    def load_training_state(self) -> dict[str, Any] | None:
        """Load ``training_state.pt`` onto CPU (``weights_only=True``), or None if absent."""
        if not self._state_path.exists():
            return None
        return torch.load(self._state_path, map_location="cpu", weights_only=True)

    def read_metrics(self) -> list[dict]:
        """Parse ``metrics.jsonl`` into a list of entry dicts (empty if no metrics yet)."""
        if not self._metrics_path.exists():
            return []
        lines = []
        with open(self._metrics_path) as f:
            for line in f:
                line = line.strip()
                if line:
                    lines.append(json.loads(line))
        return lines

    def latest_metrics(self, n: int = 10) -> list[dict]:
        """Return the last ``n`` metric entries (re-reads the whole file)."""
        all_metrics = self.read_metrics()
        return all_metrics[-n:]
