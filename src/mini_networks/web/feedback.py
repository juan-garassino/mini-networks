"""Lab feedback inbox: the owner's notes and pictures from /lab pages, on disk.

Each note is a folder ``<MN_FEEDBACK_DIR>/<id>/`` with ``note.json``, the
decoded images, and an optional ``status.json`` ({status, reply}) that the
orchestrating agent writes when it relays or addresses the note — the lab UI
shows that status back to the owner. Local only: the public showcase refuses
writes (MN_DISABLE_TRAIN=1).
"""
from __future__ import annotations

import base64
import binascii
import json
import logging
import os
import re
from datetime import datetime, timezone
from pathlib import Path

from mini_networks.api.schemas.web import FeedbackIn, FeedbackNote

log = logging.getLogger(__name__)

_REPO = Path(__file__).resolve().parents[3]
_DATA_URL = re.compile(r"^data:image/(png|jpeg|webp|gif);base64,(.+)$", re.S)
_EXT = {"png": "png", "jpeg": "jpg", "webp": "webp", "gif": "gif"}
MAX_IMAGES = 8
MAX_IMAGE_BYTES = 12 * 1024 * 1024


def feedback_dir() -> Path:
    """Inbox root: ``$MN_FEEDBACK_DIR`` if set, else ``<repo>/playground/.lab-shots/feedback``."""
    return Path(os.environ.get("MN_FEEDBACK_DIR", _REPO / "playground" / ".lab-shots" / "feedback"))


def _slug(text: str) -> str:
    """Lowercase ``[a-z0-9-]`` slug of ``text`` (≤24 chars, ``"note"`` if empty) for folder ids."""
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:24] or "note"


def save_note(payload: FeedbackIn) -> FeedbackNote:
    """Persist a note; raises ValueError on an empty note or a non-image payload.

    Validates everything before touching disk: at most ``MAX_IMAGES`` pictures,
    each a png/jpeg/webp/gif base64 data URL of at most ``MAX_IMAGE_BYTES``.
    Writes ``<feedback_dir()>/<UTC YYYYmmdd-HHMMSS>-<skin slug>[-n]/`` with
    ``img-N.<ext>`` files and ``note.json``, and returns the stored note
    (status ``"new"``). The ValueError message is user-facing (the router
    returns it as the 400 detail).
    """
    if not payload.text.strip() and not payload.images:
        raise ValueError("empty note: write something or attach a picture")
    if len(payload.images) > MAX_IMAGES:
        raise ValueError(f"at most {MAX_IMAGES} pictures per note")
    decoded: list[tuple[str, bytes]] = []
    for i, url in enumerate(payload.images):
        m = _DATA_URL.match(url)
        if not m:
            raise ValueError(f"picture {i + 1} is not a png/jpeg/webp/gif data URL")
        try:
            raw = base64.b64decode(m.group(2), validate=False)
        except (binascii.Error, ValueError) as e:
            raise ValueError(f"picture {i + 1} is not valid base64") from e
        if len(raw) > MAX_IMAGE_BYTES:
            raise ValueError(f"picture {i + 1} is larger than 12 MB")
        decoded.append((f"img-{i + 1}.{_EXT[m.group(1)]}", raw))

    now = datetime.now(timezone.utc)
    note_id = f"{now.strftime('%Y%m%d-%H%M%S')}-{_slug(payload.skin)}"
    folder = feedback_dir() / note_id
    n = 1
    while folder.exists():  # two notes in the same second
        n += 1
        folder = feedback_dir() / f"{note_id}-{n}"
    folder.mkdir(parents=True)
    for name, raw in decoded:
        (folder / name).write_bytes(raw)
    note = FeedbackNote(
        id=folder.name, created_at=now.isoformat(), skin=payload.skin, url=payload.url,
        text=payload.text.strip(), viewport=payload.viewport, images=[name for name, _ in decoded],
    )
    (folder / "note.json").write_text(note.model_dump_json(indent=2))
    log.info("lab feedback %s (%d pictures)", note.id, len(decoded))
    return note


def list_notes() -> list[FeedbackNote]:
    """Every readable note, newest first (folder names sort by timestamp).

    ``status`` / ``reply`` are overlaid from the note's ``status.json`` when the
    agent has written one. Unreadable notes are logged and skipped; a missing
    inbox yields ``[]``.
    """
    root = feedback_dir()
    if not root.exists():
        return []
    notes: list[FeedbackNote] = []
    for folder in sorted(root.iterdir(), reverse=True):
        path = folder / "note.json"
        if not path.is_file():
            continue
        try:
            note = FeedbackNote.model_validate_json(path.read_text())
            status_path = folder / "status.json"
            if status_path.is_file():
                status = json.loads(status_path.read_text())
                note.status = status.get("status", note.status)
                note.reply = status.get("reply", note.reply)
            notes.append(note)
        except (OSError, ValueError):
            log.exception("unreadable feedback note %s", folder.name)
    return notes
