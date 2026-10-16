"""Curriculum reader — lists the numbered docs/NN-*.md chapters for the Quest view.

A pure reader of docs/; serves the chapter list + raw markdown (rendered client
side). Path-sandboxed to numbered chapters directly under docs/.
"""
from __future__ import annotations

import os
import re
from pathlib import Path

_CHAPTER = re.compile(r"^\d\d-.+\.md$")


def _docs_dir() -> Path:
    """Chapter root: ``$MN_DOCS_DIR`` if set, else ``<repo>/docs``."""
    env = os.environ.get("MN_DOCS_DIR")
    return Path(env) if env else Path(__file__).resolve().parents[3] / "docs"


def _title(p: Path) -> str:
    """The file's first ``# `` heading, falling back to the file stem."""
    try:
        for line in p.read_text(errors="ignore").splitlines():
            if line.startswith("# "):
                return line[2:].strip()
    except OSError:
        pass
    return p.stem


def list_lessons() -> list[dict]:
    """``[{"id": "NN-slug", "num": "NN", "title": ...}]`` for each ``docs/NN-*.md``, sorted by name.

    Returns ``[]`` when the docs directory does not exist.
    """
    d = _docs_dir()
    if not d.exists():
        return []
    out = []
    for p in sorted(d.glob("[0-9][0-9]-*.md")):
        out.append({"id": p.stem, "num": p.name[:2], "title": _title(p)})
    return out


def read_lesson(lesson_id: str) -> str:
    """Raw markdown of chapter ``<lesson_id>.md``.

    Raises FileNotFoundError unless the resolved path sits directly in the docs
    directory, matches ``NN-*.md`` and exists — this rejects ``../`` traversal
    and non-chapter files.
    """
    d = _docs_dir()
    p = (d / f"{lesson_id}.md").resolve()
    if p.parent != d.resolve() or not _CHAPTER.match(p.name) or not p.exists():
        raise FileNotFoundError(lesson_id)
    return p.read_text(errors="ignore")
