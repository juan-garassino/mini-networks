"""Checkpoint helpers for timestamped runs and automatic resume."""
from __future__ import annotations

from pathlib import Path


def latest_run_dir(base_dir: str | Path) -> Path | None:
    """Return the newest subdirectory of ``base_dir``, or None if there is none.

    "Newest" is the lexicographically last name, which is the latest run
    because run directories are named by sortable timestamp.
    """
    root = Path(base_dir)
    if not root.exists():
        return None
    candidates = [path for path in root.iterdir() if path.is_dir()]
    if not candidates:
        return None
    return sorted(candidates)[-1]


def find_resumable_run(base_dir: str | Path) -> Path | None:
    """Return the latest run dir if it holds a ``training_state.pt``, else None.

    Only the newest run is considered; an older run with saved state is not
    resumed if a newer run without one exists.
    """
    run_dir = latest_run_dir(base_dir)
    if run_dir is None:
        return None
    state_path = run_dir / "training_state.pt"
    if not state_path.exists():
        return None
    return run_dir
