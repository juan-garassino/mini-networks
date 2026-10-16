"""Training endpoints: POST /train/{model}, GET /train/, GET /train/{job_id}/{status,metrics}.

``MN_TRAIN_BACKEND`` = ``local`` (default: train in a FastAPI background task,
Logger output under ``$MINI_NETWORKS_RUNS``) | ``cloud`` (publish a JobSpec to
Pub/Sub for the Cloud Run train job). ``MN_DISABLE_TRAIN=1`` refuses new jobs.
Job state lives in the in-memory store of ``api.dependencies``.
"""
from __future__ import annotations

import json
import os
import traceback
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException

from mini_networks.api.dependencies import (
    get_job,
    get_model_registry,
    list_jobs,
    make_job_id,
    make_output_dir,
    register_job,
    update_job,
)
from mini_networks.api.schemas.training import JobStatus, TrainRequest, TrainResponse
from mini_networks.cloud.publisher import JobSpec, get_publisher
from mini_networks.core.logging.logger import Logger

router = APIRouter()


def _runs_base() -> str:
    """``$MINI_NETWORKS_RUNS`` or ``runs`` — read per request, unlike the compositions router."""
    return os.environ.get("MINI_NETWORKS_RUNS", "runs")


def _train_backend() -> str:
    """``$MN_TRAIN_BACKEND``: ``local`` (default) or ``cloud``."""
    return os.environ.get("MN_TRAIN_BACKEND", "local")


def _run_training(job_id: str, model_name: str, config, trainer, dataloader_fn, output_dir: str):
    """Background task: train on the ``train`` split, then mark the job done (or failed + traceback).

    Closes the Logger either way so an MLflow mirror run ends FINISHED/FAILED.
    """
    logger = None
    try:
        update_job(job_id, status="running")
        logger = Logger(output_dir=output_dir, run_name=job_id)
        dataloader = dataloader_fn(config, split="train")
        trainer.train(config, dataloader, logger)
        metrics = logger.latest_metrics(5)
        last = metrics[-1] if metrics else {}
        update_job(
            job_id,
            status="done",
            epoch=last.get("value") if last.get("key") == "epoch" else None,
            loss=last.get("value") if last.get("key") == "loss" else None,
            metrics_tail=metrics,
        )
        logger.close()
    except Exception:
        update_job(job_id, status="failed", error=traceback.format_exc())
        if logger is not None:
            logger.close(status="FAILED")


@router.post("/{model_name}", response_model=TrainResponse)
async def start_training(
    model_name: str,
    request: TrainRequest,
    background_tasks: BackgroundTasks,
):
    """Start training ``model_name``; returns at once with the job id.

    The request fields plus ``extra`` are validated through the model's config
    class; an invalid override raises inside the handler (HTTP 500). With ``MN_TRAIN_BACKEND=local``
    the run trains in a background task (status ``started``); with ``cloud`` a
    JobSpec is published to Pub/Sub (status ``dispatched``) and progress is
    only visible via ``/web`` (MLflow). The job's run dir is
    ``<runs>/<model>/<job_id>``.

    Errors: 403 when ``MN_DISABLE_TRAIN=1``; 404 for an unknown model.
    """
    # Public showcase deployments set MN_DISABLE_TRAIN=1: anonymous visitors
    # must not dispatch GPU jobs or in-process trainings.
    if os.environ.get("MN_DISABLE_TRAIN") == "1":
        raise HTTPException(status_code=403, detail="training is disabled on this deployment")
    registry = get_model_registry()
    if model_name not in registry:
        raise HTTPException(status_code=404, detail=f"Unknown model: {model_name}")

    ConfigClass, TrainerClass, dataloader_fn = registry[model_name]
    job_id = make_job_id(model_name)
    output_dir = make_output_dir(_runs_base(), model_name, job_id)

    # Build config from request (validates model-specific overrides in both modes).
    config_data = {
        "epochs": request.epochs,
        "batch_size": request.batch_size,
        "learning_rate": request.learning_rate,
        "fast_demo": request.fast_demo,
        "data_root": request.data_root,
        "device": request.device,
        "seed": request.seed,
        "output_dir": output_dir,
        **request.extra,
    }
    config = ConfigClass(**config_data)
    register_job(job_id, model_name, output_dir)

    if _train_backend() == "cloud":
        # Publish to the queue; the ephemeral Cloud Run Job trains and writes its
        # status to MLflow. We never hear back — the read-layer reflects progress.
        spec = JobSpec(
            model=model_name,
            tier="S" if request.fast_demo else request.training_tier,
            hparams={
                "epochs": request.epochs,
                "batch_size": request.batch_size,
                "learning_rate": request.learning_rate,
                **request.extra,
            },
            run_name=job_id,
        )
        get_publisher().publish(spec)
        update_job(job_id, status="dispatched")
        return TrainResponse(job_id=job_id, status="dispatched", output_dir=output_dir)

    trainer = TrainerClass()
    background_tasks.add_task(
        _run_training, job_id, model_name, config, trainer, dataloader_fn, output_dir
    )
    return TrainResponse(job_id=job_id, status="started", output_dir=output_dir)


@router.get("/", response_model=list[JobStatus])
async def list_runs():
    """Every job (training and composition) started since this server process began."""
    return list_jobs()


@router.get("/{job_id}/status", response_model=JobStatus)
async def get_run_status(job_id: str):
    """The job's current in-memory status. 404 when the job id is unknown to this process."""
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Job not found: {job_id}")
    return job


@router.get("/{job_id}/metrics")
async def get_run_metrics(job_id: str):
    """``{"metrics": [...]}``: every LONG ``{step, key, value}`` row of the job's metrics.jsonl.

    Empty list before the first log line (or for a cloud-dispatched job, whose
    metrics are written elsewhere). 404 when the job id is unknown.
    """
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Job not found: {job_id}")
    if job.output_dir is None:
        return {"metrics": []}
    # Direct file read — constructing a Logger here would mkdir and (if MLflow is
    # enabled) spuriously open a tracking run just to read metrics.
    metrics_path = os.path.join(job.output_dir, "metrics.jsonl")
    rows: list[dict] = []
    if os.path.exists(metrics_path):
        with open(metrics_path) as f:
            for line in f:
                line = line.strip()
                if line:
                    rows.append(json.loads(line))
    return {"metrics": rows}
