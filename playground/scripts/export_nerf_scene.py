"""Export the nerf anatomy diagram's EXACT scene data (no model, no training).

There is no local nerf champion, so the diagram draws only what is exact and
cheap: the voxelised MNIST digit, ground-truth views, the camera / ray geometry
and one hot ray's true-field sigma/colour profile. This is a numpy-only
transcription of src/mini_networks/models/nerf/scene.py (build_voxels,
make_rays, _voxel_lookup, composite, render_gt) — change one side, change the
other. It reads data/MNIST/raw directly (no torch, no torchvision).

    .venv/bin/python playground/scripts/export_nerf_scene.py

Writes playground/components/lab/shared/anatomy2/data/nerf-scene.ts.
Nibble strings decode with unNib() in anatomy2/math.ts (16 levels, bin centres).
"""
from __future__ import annotations

import json
import logging
import math
from pathlib import Path

import numpy as np

log = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "MNIST" / "raw"
OUT = ROOT / "playground" / "components" / "lab" / "shared" / "anatomy2" / "data" / "nerf-scene.ts"

# NerfConfig defaults (src/mini_networks/models/nerf/config.py)
CFG = dict(elevationDeg=35.0, radius=2.5, fov=0.7, size=32, near=1.0, far=4.0, layers=8,
           sigmaScale=30.0, gtSamples=256, nAz=40, testEvery=4, peFreqs=6, hidden=128, nLayers=5)
# build_voxels(seed=42): torch.Generator().manual_seed(42); torch.randint(0, 60000, (1,)) -> 37542
# (verified by the field expert with torch; hardcoded here so this stays numpy-only).
TRAIN_INDEX = 37542
HOT = dict(az=36.0, row=17, col=16, S=200)
# side-view projections used by the diagram (art px per world unit, eye x/y on the plate)
SECTION_FULL = dict(ex=26, k=42, n=160)
SECTION_CARD = dict(ex=10, k=28, n=96)  # card side view: 2 px per voxel
FAN_ROWS = list(range(0, 32, 4))


def nib(a: np.ndarray, lo: float, hi: float) -> str:
    q = np.clip(np.floor((a - lo) / (hi - lo) * 16), 0, 15).astype(int)
    return "".join("0123456789abcdef"[v] for v in q.ravel())


def load_digit() -> tuple[np.ndarray, int]:
    img = np.frombuffer((RAW / "train-images-idx3-ubyte").read_bytes(), np.uint8, offset=16).reshape(-1, 28, 28)
    lab = np.frombuffer((RAW / "train-labels-idx1-ubyte").read_bytes(), np.uint8, offset=8)
    return img[TRAIN_INDEX].astype(np.float64) / 255.0, int(lab[TRAIN_INDEX])


def make_rays(az_deg: float) -> tuple[np.ndarray, np.ndarray]:
    az, el, r = math.radians(az_deg), math.radians(CFG["elevationDeg"]), CFG["radius"]
    eye = np.array([r * math.cos(el) * math.cos(az), r * math.cos(el) * math.sin(az), r * math.sin(el)])
    fwd = -eye / np.linalg.norm(eye)
    right = np.cross(fwd, [0.0, 0.0, 1.0])
    right /= np.linalg.norm(right)
    up = np.cross(right, fwd)
    half = math.tan(CFG["fov"] / 2)
    xs = np.linspace(-1, 1, CFG["size"]) * half
    ys = np.linspace(1, -1, CFG["size"]) * half
    gy, gx = np.meshgrid(ys, xs, indexing="ij")
    d = gx[..., None] * right + gy[..., None] * up + fwd
    d /= np.linalg.norm(d, axis=-1, keepdims=True)
    return eye, d.reshape(-1, 3)


def lookup(p: np.ndarray, occ: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    D = CFG["layers"]
    zh = D / 28.0
    ix = np.clip(((p[..., 0] + 1) / 2 * 28).astype(int), 0, 27)
    iy = np.clip(((1 - (p[..., 1] + 1) / 2) * 28).astype(int), 0, 27)
    iz = np.clip(((p[..., 2] + zh) / (2 * zh) * D).astype(int), 0, D - 1)
    inside = (np.abs(p[..., :2]) < 1).all(-1) & (np.abs(p[..., 2]) < zh)
    sigma = occ[iy, ix] * inside * CFG["sigmaScale"]
    z = np.linspace(0, 1, D)[iz]
    color = np.stack([z, z, 1 - z], -1) * inside[..., None]
    return sigma, color, np.where(sigma > 0, iz, -1)


def composite(sigma: np.ndarray, color: np.ndarray, t: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    dt = np.concatenate([t[..., 1:] - t[..., :-1], np.full(t[..., :1].shape, 1e-2)], -1)
    alpha = 1 - np.exp(-sigma * dt)
    trans = np.cumprod(np.concatenate([np.ones_like(alpha[..., :1]), 1 - alpha + 1e-10], -1), -1)[..., :-1]
    w = alpha * trans
    return (w[..., None] * color).sum(-2), w


def render_gt(az: float, occ: np.ndarray) -> np.ndarray:
    eye, d = make_rays(az)
    t = np.broadcast_to(np.linspace(CFG["near"], CFG["far"], CFG["gtSamples"]), (d.shape[0], CFG["gtSamples"]))
    p = eye + t[..., None] * d[:, None]
    s, c, _ = lookup(p, occ)
    rgb, _ = composite(s, c, t)
    return rgb


def section(eye: np.ndarray, g: np.ndarray, occ: np.ndarray, ex: int, k: int, n: int) -> str:
    out = ""
    for x in range(ex, ex + n):
        s = (x - ex + 0.5) / k
        q = eye[:2] + s * g
        if (np.abs(q) < 1).all():
            ix = min(27, int((q[0] + 1) / 2 * 28))
            iy = min(27, int((1 - (q[1] + 1) / 2) * 28))
            out += "1" if occ[iy, ix] else "0"
        else:
            out += "."
    return out


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
    ink, label = load_digit()
    occ = (ink > 0.3).astype(np.float64)
    log.info("MNIST train #%d label %d, %d ink columns", TRAIN_INDEX, label, int(occ.sum()))

    views = {}
    for az in (18, 27, 36):
        rgb = render_gt(float(az), occ)
        views[az] = nib(2 * rgb[:, 0] + rgb[:, 2] - 1, -1, 1)  # v = 2R + B - 1 (exact identity: G = R)
    gt36 = render_gt(HOT["az"], occ)
    k = HOT["row"] * CFG["size"] + HOT["col"]

    eye, d = make_rays(HOT["az"])
    dk = d[k]
    S = HOT["S"]
    edges = np.linspace(CFG["near"], CFG["far"], S + 1)
    tm = (edges[:-1] + edges[1:]) / 2  # render_rays at eval: bin midpoints
    p = eye + tm[:, None] * dk
    sig, col, layer = lookup(p, occ)
    C, w = composite(sig[None], col[None], tm[None])
    occi = np.nonzero(sig)[0]
    entry = int(occi[0])
    pe_p = p[entry]
    freqs = 2.0 ** np.arange(CFG["peFreqs"]) * math.pi
    ang = pe_p[:, None] * freqs
    pe = np.concatenate([np.sin(ang), np.cos(ang)], -1).ravel()  # model.encode: per coord sin x6 then cos x6

    g = dk[:2] / np.hypot(dk[0], dk[1])
    fan = [math.degrees(math.asin(-d[r * CFG["size"] + HOT["col"]][2])) for r in FAN_ROWS]
    log.info("hot ray entry i=%d t=%.4f C=%s gt=%s wmax=%.3f", entry, tm[entry], np.round(C[0], 3), np.round(gt36[k], 3), w.max())

    js = lambda v: json.dumps(v)  # noqa: E731
    r3 = lambda a: [round(float(v), 3) for v in a]  # noqa: E731
    lines = [
        "// GENERATED by playground/scripts/export_nerf_scene.py — do not edit by hand.",
        "// EXACT scene data for the nerf anatomy diagram (no model outputs: there is no",
        "// local nerf champion). A numpy transcription of models/nerf/scene.py:",
        "// MNIST train #37542 (seed 42), ink > .3 extruded to 28×28×8, colour (z, z, 1−z)",
        "// per layer, GT rendered with 256 samples on t ∈ [1, 4].",
        "// VIEWS: 32×32 nibbles of v = 2R + B − 1 over [−1, 1] (G = R exactly, so v is",
        "//   the whole view: −1 empty/black, 0 the blue base layer, +1 the yellow top).",
        "// HOT: training view az 36, pixel row 17 col 16, its ray at the 200 M-tier bin",
        "//   midpoints. RAY_SIGMA: 1 where the true σ = 30; RAY_LAYER: the voxel layer hit",
        "//   ('.' = empty). SECTION*: occupancy along the hot ray's ground track, one char",
        "//   per art px of the side view ('.' outside the slab). FAN_DEG: col-16 rows",
        "//   0,4,…,28 — degrees below horizontal. PE: γ(p) at the entry sample.",
        f"export const NERF_TRAIN_INDEX = {TRAIN_INDEX};",
        f"export const NERF_LABEL = {label};",
        f"export const NERF_INK = {js(nib(ink, 0, 1))};",
        f"export const NERF_OCC = {js([''.join('1' if v else '0' for v in row) for row in occ])} as const;",
        f"export const NERF_CFG = {js(CFG)} as const;",
        f"export const NERF_VIEWS: Record<18 | 27 | 36, string> = {js({str(a): v for a, v in views.items()})};",
        "export const NERF_HOT = " + js(dict(**HOT, entry=entry, tEntry=round(float(tm[entry]), 4), eye=r3(eye), dir=r3(dk),
                                              p=r3(pe_p), groundDir=r3(g))) + " as const;",
        f"export const NERF_RAY_SIGMA = {js(''.join('1' if v > 0 else '0' for v in sig))};",
        f"export const NERF_RAY_LAYER = {js(''.join('.' if v < 0 else str(int(v)) for v in layer))};",
        f"export const NERF_SECTION = {js(section(eye, g, occ, **SECTION_FULL))};",
        f"export const NERF_SECTION_CARD = {js(section(eye, g, occ, **SECTION_CARD))};",
        f"export const NERF_FAN_DEG = {js([round(a, 2) for a in fan])} as const;",
        f"export const NERF_PE = {js([round(float(v), 2) for v in pe])} as const;",
        f"export const NERF_GT_PIXEL = {js(r3(gt36[k]))} as const;",
        "// evalspec / probe numbers (field expert, 2026-10-04): untrained field (seed 0, 25 samples)",
        "// and an all-black image on the 10 held-out views; bars PROVISIONAL (no M sweep yet).",
        "export const NERF_REF = { untrainedDb: 7.43, blackDb: 6.34, barM: 20, barL: 26, params: 54788, trainRays: 30720 } as const;",
        "",
    ]
    OUT.write_text("\n".join(lines))
    log.info("wrote %s", OUT)


if __name__ == "__main__":
    main()
