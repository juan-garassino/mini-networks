"""README model/composition lists must cover the registry and catalog.

The README had drifted to ~31 of the 50 models; this keeps the bullet lists
(`- `name` …`) in sync with MODEL_NAMES and the composition catalog.
"""
from __future__ import annotations

import re
from pathlib import Path

from mini_networks.colab.catalog import COMPOSITIONS
from mini_networks.core.registry import MODEL_NAMES

README = Path(__file__).resolve().parents[1] / "README.md"


def _listed() -> set[str]:
    return set(re.findall(r"^- `([a-z0-9_]+)`", README.read_text(), re.M))


def test_readme_lists_every_model():
    missing = set(MODEL_NAMES) - _listed()
    assert not missing, f"README.md is missing models: {sorted(missing)}"


def test_readme_lists_every_composition():
    missing = set(COMPOSITIONS) - _listed()
    assert not missing, f"README.md is missing compositions: {sorted(missing)}"
