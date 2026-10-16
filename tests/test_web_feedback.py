"""Lab feedback inbox: the owner's notes + pictures from /lab pages reach disk."""
from __future__ import annotations

import base64
import json

import pytest
from fastapi.testclient import TestClient

PNG_1PX = "data:image/png;base64," + base64.b64encode(
    bytes.fromhex(
        "89504e470d0a1a0a0000000d4948445200000001000000010806000000"
        "1f15c4890000000d49444154789c6300010000000500010d0a2db40000000049454e44ae426082"
    )
).decode()


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("MN_FEEDBACK_DIR", str(tmp_path / "fb"))
    monkeypatch.delenv("MN_DISABLE_TRAIN", raising=False)
    from mini_networks.api.main import create_app

    return TestClient(create_app())


def test_post_saves_note_and_images(client, tmp_path):
    r = client.post("/web/feedback", json={
        "skin": "paper", "url": "http://localhost:3000/lab/paper/?zoom=node&focus=clip",
        "text": "roads too thin", "viewport": [1440, 900], "images": [PNG_1PX, PNG_1PX],
    })
    assert r.status_code == 200
    note = r.json()
    assert note["status"] == "new" and note["skin"] == "paper" and len(note["images"]) == 2

    folder = tmp_path / "fb" / note["id"]
    saved = json.loads((folder / "note.json").read_text())
    assert saved["text"] == "roads too thin" and saved["url"].endswith("focus=clip")
    assert (folder / note["images"][0]).read_bytes().startswith(b"\x89PNG")

    listed = client.get("/web/feedback").json()["notes"]
    assert [n["id"] for n in listed] == [note["id"]]


def test_status_file_is_reported(client, tmp_path):
    note = client.post("/web/feedback", json={"skin": "pixel", "url": "u", "text": "more trees"}).json()
    (tmp_path / "fb" / note["id"] / "status.json").write_text(
        json.dumps({"status": "relayed", "reply": "sent to the pixel builder"}))
    listed = client.get("/web/feedback").json()["notes"]
    assert listed[0]["status"] == "relayed" and listed[0]["reply"] == "sent to the pixel builder"


def test_rejects_non_image_payload_and_empty_note(client):
    assert client.post("/web/feedback", json={"skin": "flow", "url": "u", "text": "x",
                                              "images": ["data:text/html;base64,PGI+"]}).status_code == 400
    assert client.post("/web/feedback", json={"skin": "flow", "url": "u", "text": "  "}).status_code == 400


def test_disabled_on_public_showcase(client, monkeypatch):
    monkeypatch.setenv("MN_DISABLE_TRAIN", "1")
    assert client.post("/web/feedback", json={"skin": "paper", "url": "u", "text": "hi"}).status_code == 403
