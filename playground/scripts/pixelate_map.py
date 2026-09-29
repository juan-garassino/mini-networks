"""Grid-pixelate an owner-supplied painted map into true pixel art.

Each CELL×CELL block becomes one pixel (the block's mean colour — the centre
sample alone picks up noise), then colours snap to a K-colour palette fitted by
k-means (a limited palette is what makes it read as pixel art). The output is
upscaled back with nearest-neighbour so every art pixel is a visible block.

    uv run python playground/scripts/pixelate_map.py IN.png OUT.png [--cell 4] [--colors 40]

Inputs/outputs live in the gitignored playground/public/local/ — never commit them.
"""
from __future__ import annotations

import argparse

import numpy as np
from PIL import Image
from sklearn.cluster import KMeans


def pixelate(img: np.ndarray, cell: int, colors: int) -> np.ndarray:
    h, w, _ = img.shape
    gh, gw = h // cell, w // cell
    blocks = img[: gh * cell, : gw * cell].reshape(gh, cell, gw, cell, 3)
    small = blocks.mean(axis=(1, 3))
    px = small.reshape(-1, 3)
    km = KMeans(n_clusters=colors, n_init=2, random_state=0).fit(px[:: max(1, len(px) // 20000)])
    return km.cluster_centers_[km.predict(px)].reshape(small.shape)


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("src")
    p.add_argument("out")
    p.add_argument("--cell", type=int, default=4)
    p.add_argument("--colors", type=int, default=40)
    a = p.parse_args()
    img = np.asarray(Image.open(a.src).convert("RGB")).astype(np.float32)
    small = pixelate(img, a.cell, a.colors)
    im = Image.fromarray(np.clip(small, 0, 255).astype(np.uint8))
    im.resize((im.width * a.cell, im.height * a.cell), Image.NEAREST).save(a.out)


if __name__ == "__main__":
    main()
