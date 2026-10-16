"""Read-layer endpoints: the Observatory reads runs through these.

Backed by a pluggable RunSource (local runs/ or MLflow) selected by
``MN_RUN_SOURCE`` (``local`` default | ``mlflow``) and unioned with the
in-memory job store; the frontend never knows which. Run ids may contain ``/`` (local ids are
``model/timestamp``), hence the ``:path`` converter.
"""
from __future__ import annotations

import os

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from mini_networks.api.schemas.web import (
    ConfigResponse,
    EvidenceResponse,
    FeedbackIn,
    FeedbackList,
    FeedbackNote,
    MetricsResponse,
    ModelInfo,
    RunListResponse,
    SummaryResponse,
)
from mini_networks.web.evidence import build_evidence
from mini_networks.web.feedback import list_notes, save_note
from mini_networks.web.lessons import list_lessons, read_lesson
from mini_networks.web.model_catalog import list_model_infos
from mini_networks.web.sources import RunNotFound, RunSource, get_run_source

router = APIRouter()


@router.get("/runs", response_model=RunListResponse)
async def list_runs(source: RunSource = Depends(get_run_source)):
    """Every run of the active source, plus API jobs it does not list yet (``source="jobstore"``)."""
    return RunListResponse(runs=source.list_runs())


@router.get("/runs/{run_id:path}/metrics", response_model=MetricsResponse)
async def run_metrics(run_id: str, since: int | None = None, source: RunSource = Depends(get_run_source)):
    """Per-key ``(step, value)`` series for a run; non-numeric values are dropped.

    ``since`` returns only steps strictly greater than it (incremental polling
    of live runs). ``run_id`` may contain ``/``. 404 when the run is unknown.
    """
    try:
        return source.get_metrics(run_id, since)
    except RunNotFound:
        raise HTTPException(status_code=404, detail=f"Run not found: {run_id}")


@router.get("/runs/{run_id:path}/config", response_model=ConfigResponse)
async def run_config(run_id: str, source: RunSource = Depends(get_run_source)):
    """The run's config: local ``config.yaml`` or MLflow params (string values). 404 when unknown."""
    try:
        return source.get_config(run_id)
    except RunNotFound:
        raise HTTPException(status_code=404, detail=f"Run not found: {run_id}")


@router.get("/runs/{run_id:path}/summary", response_model=SummaryResponse)
async def run_summary(run_id: str, source: RunSource = Depends(get_run_source)):
    """The run's summary: local ``summary.json``, MLflow tags, or ``{"status"}`` for a job. 404 when unknown."""
    try:
        return source.get_summary(run_id)
    except RunNotFound:
        raise HTTPException(status_code=404, detail=f"Run not found: {run_id}")


@router.get("/runs/{run_id:path}/artifacts/{name}")
async def run_artifact(run_id: str, name: str, source: RunSource = Depends(get_run_source)):
    """Download one artifact file of a run (media type guessed from its name).

    Local names are confined to the run's ``artifacts/`` folder. 404 when the
    run or artifact is missing (job-store-only runs have no artifacts).
    """
    try:
        path, media = source.open_artifact(run_id, name)
    except RunNotFound:
        raise HTTPException(status_code=404, detail=f"Artifact not found: {run_id}/{name}")
    return FileResponse(path, media_type=media, filename=name)


@router.get("/models", response_model=list[ModelInfo])
async def models():
    """Every registered model's config JSON schema and defaults (drives the Lab/Sandbox forms)."""
    return list_model_infos()


@router.get("/evidence", response_model=EvidenceResponse)
async def evidence(source: RunSource = Depends(get_run_source)):
    """Champion / gate bar / provisional flag / run count per model.

    ``best_metric`` only counts runs whose effective tier is M or L, read from
    each run's config (``fast_demo`` → S, else ``training_tier``); this costs
    one config read per listed run. Champions are looked up under
    ``$MINI_NETWORKS_RUNS/champions/`` whichever source lists the runs.
    """
    # Champions live next to local runs (pull-champions writes <runs>/champions/)
    # whichever RunSource lists the runs.
    champions_root = os.environ.get("MINI_NETWORKS_RUNS", "runs")

    def tier_of(run) -> str | None:
        # Effective tier as BaseConfig computes it: fast_demo forces S.
        try:
            cfg = source.get_config(run.id).config
        except RunNotFound:
            return None
        return "S" if cfg.get("fast_demo") else cfg.get("training_tier")

    return EvidenceResponse(models=build_evidence(source.list_runs(), champions_root, tier_of))


@router.post("/feedback", response_model=FeedbackNote)
async def post_feedback(payload: FeedbackIn):
    """The owner's lab feedback (text + pictures) → playground/.lab-shots/feedback/.

    Stored under ``$MN_FEEDBACK_DIR`` when set. Returns the saved note.
    Errors: 403 when ``MN_DISABLE_TRAIN=1``; 400 for an empty note, more than
    8 pictures, or a picture that is not a png/jpeg/webp/gif base64 data URL
    of at most 12 MB.
    """
    # Public showcase deployments set MN_DISABLE_TRAIN=1: no anonymous writes.
    if os.environ.get("MN_DISABLE_TRAIN") == "1":
        raise HTTPException(status_code=403, detail="forbidden")
    try:
        return save_note(payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/feedback", response_model=FeedbackList)
async def get_feedback():
    """Every stored lab note, newest first, with the agent's status/reply when written."""
    return FeedbackList(notes=list_notes())


@router.get("/taxonomy")
async def taxonomy():
    """Atoms/molecules DAG + compositions for the playground's chart view.

    Returns ``{mechanisms: {name: {description, home}}, models: [{name, level,
    introduces, builds_on, note, description}], compositions: [{name,
    composes, description}]}`` from ``core/taxonomy.py`` and
    ``colab/catalog.py``.
    """
    from mini_networks.colab.catalog import COMPOSITIONS, DESCRIPTIONS
    from mini_networks.core.taxonomy import (
        COMPOSITION_TAXONOMY,
        MECHANISMS,
        MODEL_TAXONOMY,
    )
    return {
        "mechanisms": {k: {"description": m.description, "home": m.home}
                       for k, m in MECHANISMS.items()},
        "models": [
            {
                "name": name,
                "level": t.level,
                "introduces": list(t.introduces),
                "builds_on": list(t.builds_on),
                "note": t.note,
                "description": DESCRIPTIONS.get(name, ""),
            }
            for name, t in MODEL_TAXONOMY.items()
        ],
        "compositions": [
            {
                "name": name,
                "composes": list(COMPOSITION_TAXONOMY.get(name, ())),
                "description": DESCRIPTIONS.get(name, ""),
            }
            for name in COMPOSITIONS
        ],
    }


@router.get("/lessons")
async def lessons():
    """Curriculum chapters ``[{id, num, title}]`` from ``docs/NN-*.md`` (or ``$MN_DOCS_DIR``)."""
    return list_lessons()


@router.get("/lessons/{lesson_id}")
async def lesson(lesson_id: str):
    """``{id, markdown}`` for one chapter. 404 for an unknown id or a path outside the chapters."""
    try:
        return {"id": lesson_id, "markdown": read_lesson(lesson_id)}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Lesson not found: {lesson_id}")
