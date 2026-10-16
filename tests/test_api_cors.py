"""CORS for the playground dev servers (src/mini_networks/api/main.py).

The Next dev server (and the per-UI ports) fetch the API cross-origin; the
owner also opens them from a phone on the same private network.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    from mini_networks.api.main import create_app

    return TestClient(create_app())


@pytest.mark.parametrize(
    "origin",
    [
        "http://localhost:3000",
        "http://127.0.0.1:3004",
        "http://192.168.1.56:3001",
        "http://172.20.10.4:3000",
        "http://10.0.0.7:3009",
    ],
)
def test_dev_and_private_network_origins_allowed(client, origin):
    r = client.get("/web/taxonomy", headers={"Origin": origin})
    assert r.headers.get("access-control-allow-origin") == origin


@pytest.mark.parametrize(
    "origin",
    [
        "http://example.com:3000",
        "https://192.168.1.56:3000",
        "http://172.32.0.1:3000",
        "http://8.8.8.8:3000",
        "http://192.168.1.56.evil.com:3000",
    ],
)
def test_public_origins_refused(client, origin):
    r = client.get("/web/taxonomy", headers={"Origin": origin})
    assert "access-control-allow-origin" not in r.headers
