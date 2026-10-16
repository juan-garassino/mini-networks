"""Shared dependencies: job store and model registry.

The job store is a process-local dict guarded by a lock: jobs started via
``POST /train`` / ``POST /compose`` live only as long as the server process,
and are also surfaced in ``/web/runs`` by ``web.sources.CompositeSource``.
"""
from __future__ import annotations

import threading
from datetime import datetime
from pathlib import Path

from mini_networks.api.schemas.training import JobStatus


# In-memory job store
_jobs: dict[str, JobStatus] = {}
_lock = threading.Lock()


def register_job(job_id: str, model: str, output_dir: str) -> None:
    """Add a ``pending`` JobStatus for a new training/composition job (replaces any same id)."""
    with _lock:
        _jobs[job_id] = JobStatus(
            job_id=job_id,
            model=model,
            status="pending",
            output_dir=output_dir,
        )


def update_job(job_id: str, **kwargs) -> None:
    """Set JobStatus fields (status, epoch, loss, error, metrics_tail, ...); unknown ids are ignored."""
    with _lock:
        if job_id in _jobs:
            job = _jobs[job_id]
            for k, v in kwargs.items():
                setattr(job, k, v)


def get_job(job_id: str) -> JobStatus | None:
    """The live JobStatus for ``job_id`` (mutated in place by updates), or None."""
    return _jobs.get(job_id)


def list_jobs() -> list[JobStatus]:
    """Every job registered since this process started (the store is not persisted)."""
    return list(_jobs.values())


def make_job_id(model: str) -> str:
    """``<model>-<UTC YYYYmmdd-HHMMSS>``; also used as the run name of the job's run."""
    ts = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
    return f"{model}-{ts}"


def make_output_dir(base: str, model: str, job_id: str) -> str:
    """Create and return ``<base>/<model>/<job_id>`` (the Logger output dir for the job)."""
    path = Path(base) / model / job_id
    path.mkdir(parents=True, exist_ok=True)
    return str(path)


# Model registry moved to core (api re-exports it for back-compat)
from mini_networks.core.registry import get_model_registry  # noqa: E402,F401
