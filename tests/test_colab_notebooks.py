"""Static checks for the Colab notebooks in colab/notebooks/.

The notebooks are not executed here (they train models and need matplotlib),
but every code cell must compile, every `from mini_networks... import ...`
must resolve against the current package, and every model / composition name
passed to run_model / run_composition must exist. This catches the drift that
made 04_compositions.ipynb call methods that no longer existed.
"""
from __future__ import annotations

import ast
import importlib
import json
from pathlib import Path

import pytest

NOTEBOOK_DIR = Path(__file__).resolve().parents[1] / "colab" / "notebooks"
NOTEBOOKS = sorted(NOTEBOOK_DIR.glob("*.ipynb"))
REPO_URL = "https://github.com/juan-garassino/mini-networks.git"


def _code_cells(path: Path) -> list[str]:
    nb = json.loads(path.read_text())
    cells = []
    for cell in nb["cells"]:
        if cell["cell_type"] != "code":
            continue
        # IPython magics / shell escapes are not Python syntax; replace them
        # with `pass` (same indent) so an `if` body stays valid.
        lines = [
            l[: len(l) - len(l.lstrip())] + "pass" if l.lstrip().startswith(("!", "%")) else l
            for l in "".join(cell["source"]).splitlines()
        ]
        cells.append("\n".join(lines))
    return cells


def _trees(path: Path) -> list[ast.AST]:
    return [ast.parse(src, filename=f"{path.name}") for src in _code_cells(path)]


def test_notebooks_exist():
    assert {p.name for p in NOTEBOOKS} >= {
        "00_sweep.ipynb", "01_vision.ipynb", "02_language.ipynb",
        "03_rl.ipynb", "04_compositions.ipynb",
    }


@pytest.mark.parametrize("path", NOTEBOOKS, ids=lambda p: p.name)
def test_code_cells_compile(path: Path):
    _trees(path)  # raises SyntaxError on a broken cell


@pytest.mark.parametrize("path", NOTEBOOKS, ids=lambda p: p.name)
def test_setup_cell_clones_this_repo(path: Path):
    setup = _code_cells(path)[0]
    assert REPO_URL in setup, f"{path.name}: first code cell must clone {REPO_URL}"
    assert "os.chdir(root)" in setup


@pytest.mark.parametrize("path", NOTEBOOKS, ids=lambda p: p.name)
def test_mini_networks_imports_resolve(path: Path):
    for tree in _trees(path):
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom) and (node.module or "").startswith("mini_networks"):
                module = importlib.import_module(node.module)
                for alias in node.names:
                    assert hasattr(module, alias.name), (
                        f"{path.name}: {node.module} has no attribute {alias.name!r}"
                    )


@pytest.mark.parametrize("path", NOTEBOOKS, ids=lambda p: p.name)
def test_runner_names_exist(path: Path):
    from mini_networks.colab.runners import COMPOSITION_RUNNERS
    from mini_networks.core.registry import MODEL_NAMES

    known = {"run_model": set(MODEL_NAMES), "run_composition": set(COMPOSITION_RUNNERS)}
    for tree in _trees(path):
        for node in ast.walk(tree):
            if (isinstance(node, ast.Call) and isinstance(node.func, ast.Name)
                    and node.func.id in known and node.args
                    and isinstance(node.args[0], ast.Constant)):
                assert node.args[0].value in known[node.func.id], (
                    f"{path.name}: {node.func.id}({node.args[0].value!r}) is not registered"
                )
