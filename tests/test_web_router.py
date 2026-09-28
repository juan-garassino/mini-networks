"""Read-layer HTTP contract via TestClient over a fixture runs/ tree."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(runs_dir, monkeypatch):
    monkeypatch.setenv("MINI_NETWORKS_RUNS", str(runs_dir))
    monkeypatch.setenv("MN_RUN_SOURCE", "local")
    monkeypatch.delenv("MN_MLFLOW_TRACKING_URI", raising=False)
    from mini_networks.api.main import create_app

    return TestClient(create_app())


def test_list_runs(client):
    body = client.get("/web/runs").json()
    ids = {r["id"] for r in body["runs"]}
    assert {"vae/vae-001", "gan/gan-001", "clip/212716/212716"} <= ids


def test_metrics_endpoint(client):
    body = client.get("/web/runs/vae/vae-001/metrics").json()
    series = {s["key"]: s["points"] for s in body["series"]}
    assert series["loss"] == [[0, 1.5], [1, 0.8]]


def test_metrics_since(client):
    body = client.get("/web/runs/vae/vae-001/metrics", params={"since": 0}).json()
    series = {s["key"]: s["points"] for s in body["series"]}
    assert series["loss"] == [[1, 0.8]]


def test_config_and_summary(client):
    assert client.get("/web/runs/vae/vae-001/config").json()["config"]["batch_size"] == 64
    assert client.get("/web/runs/vae/vae-001/summary").json()["summary"]["status"] == "completed"


def test_artifact_served(client):
    r = client.get("/web/runs/vae/vae-001/artifacts/sample.png")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("image/png")


def test_unknown_run_404(client):
    assert client.get("/web/runs/nope/nope/metrics").status_code == 404


def test_models_endpoint(client):
    from mini_networks.core.registry import MODEL_NAMES

    names = {m["name"] for m in client.get("/web/models").json()}
    assert names == set(MODEL_NAMES)
    sample = client.get("/web/models").json()[0]
    assert "config_schema" in sample and "defaults" in sample


def test_evidence_endpoint(client, runs_dir):
    from mini_networks.core.registry import MODEL_NAMES

    champ = runs_dir / "champions" / "vae" / "artifacts"
    champ.mkdir(parents=True)
    (champ / "model.pt").write_bytes(b"weights")
    (runs_dir / "champions" / "vae" / "VERSION").write_text("3\n")

    rows = {m["name"]: m for m in client.get("/web/evidence").json()["models"]}
    # run_count must agree with /web/runs, which also lists the process-global
    # in-memory job store (other tests may have left jobs there).
    listed = [r["model"] for r in client.get("/web/runs").json()["runs"]]
    assert set(rows) == set(MODEL_NAMES)

    vae = rows["vae"]
    assert vae["champion"] is True and vae["champion_version"] == "3"
    assert vae["gate_metric"] == "eval_loss" and vae["higher_is_better"] is False
    assert vae["threshold_m"] == 0.12
    assert vae["run_count"] == listed.count("vae") >= 1

    assert rows["gan"]["champion"] is False and rows["gan"]["champion_version"] is None
    assert rows["kimi"]["provisional"] is True
    assert rows["classifier"]["provisional"] is False
    assert all(rows[n]["run_count"] == listed.count(n) for n in MODEL_NAMES)


def test_evidence_best_metric_respects_direction():
    from mini_networks.api.schemas.web import RunSummary
    from mini_networks.web.evidence import build_evidence

    runs = [
        RunSummary(id=f"vae/{i}", model="vae", source="local", status="done",
                   last_metrics={"eval_loss": v})
        for i, v in enumerate([0.3, 0.1, 0.2])
    ] + [
        RunSummary(id="classifier/a", model="classifier", source="local", status="done",
                   last_metrics={"eval_accuracy": 0.9}),
    ]
    rows = {e.name: e for e in build_evidence(runs, champions_root="/nonexistent", tier_of=lambda r: "M")}
    assert rows["vae"].best_metric == 0.1          # lower is better for losses
    assert rows["classifier"].best_metric == 0.9   # eval_-prefixed key fallback


def test_evidence_ignores_smoke_runs_for_the_bar():
    from mini_networks.api.schemas.web import RunSummary
    from mini_networks.web.evidence import build_evidence

    runs = [
        RunSummary(id="classifier/s", model="classifier", source="local", status="done",
                   last_metrics={"accuracy": 0.125}),
        RunSummary(id="classifier/m", model="classifier", source="local", status="done",
                   last_metrics={"accuracy": 0.91}),
        RunSummary(id="vae/s", model="vae", source="local", status="done",
                   last_metrics={"eval_loss": 0.05}),
    ]
    tiers = {"classifier/s": "S", "classifier/m": "M", "vae/s": "S"}
    rows = {e.name: e for e in build_evidence(runs, champions_root="/nonexistent", tier_of=lambda r: tiers[r.id])}
    # S-tier nano runs are not comparable to the M bar — they still count as runs.
    assert rows["classifier"].best_metric == 0.91 and rows["classifier"].run_count == 2
    assert rows["vae"].best_metric is None and rows["vae"].run_count == 1
