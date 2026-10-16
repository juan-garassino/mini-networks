"""Convert a true pixel-art map (1 image px = 1 art px, few colours) into the
JSON the /lab/painted skin paints itself from — the map becomes data we own.

    uv run python playground/scripts/pixelmap_to_json.py \
        playground/public/local/pixel-map-true.png playground/public/local/pixel-map.json

Output format ("rle36-v2"):

    {
      "format": "rle36-v2",
      "source": "pixel-map-true.png",
      "w": 768, "h": 512,
      "palette": ["#rrggbb", ...],          # every distinct colour, most common first
      "rows": ["<run><run>...", ...]         # one string per image row, top to bottom
    }

Each row is a string of 2-character tokens, each token 2 base-36 digits
(value 0..1295), no separators:

    value <  1000  → one pixel of palette[value]
    value >= 1000  → repeat the previous pixel (value - 999) more times (1..296)

So a run of one colour costs one token, a run of L > 1 costs one token plus
ceil((L - 1) / 296) repeat tokens. (Plain run/length pairs cost 4 characters
per run, and this art averages ~1.5 px per run — the repeat token keeps
single pixels at 2 characters.) Every row decodes to exactly `w` pixels.

The script refuses images with 1000 or more colours (indices must stay below
the repeat range) and images with any transparency (the map is opaque by
design). Inputs and outputs live in the
gitignored playground/public/local/ — images and their derivatives stay local.
"""
from __future__ import annotations

import argparse
import json
import logging
from collections import Counter
from pathlib import Path

import numpy as np
from PIL import Image

log = logging.getLogger(__name__)

FORMAT = "rle36-v2"
MAX_FIELD = 36 * 36 - 1  # 1295: the largest value two base-36 digits hold
REPEAT = 1000            # tokens >= REPEAT repeat the previous pixel (token - 999) times
MAX_REPEAT = MAX_FIELD - REPEAT + 1  # 296
DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz"


def b36(n: int) -> str:
    """Two-digit, zero-padded base-36."""
    if not 0 <= n <= MAX_FIELD:
        raise ValueError(f"{n} does not fit in two base-36 digits")
    return DIGITS[n // 36] + DIGITS[n % 36]


def encode(img: Image.Image, source: str) -> dict:
    rgba = np.asarray(img.convert("RGBA"))
    if (rgba[..., 3] != 255).any():
        raise ValueError("image has transparent pixels; the map must be opaque")
    rgb = rgba[..., :3].astype(np.uint32)
    h, w = rgb.shape[:2]
    packed = (rgb[..., 0] << 16) | (rgb[..., 1] << 8) | rgb[..., 2]
    counts = Counter(packed.ravel().tolist())
    if len(counts) >= REPEAT:
        raise ValueError(f"{len(counts)} colours; at most {REPEAT - 1} fit below the repeat range")
    order = [c for c, _ in counts.most_common()]
    index = {c: i for i, c in enumerate(order)}
    lut = np.vectorize(index.__getitem__, otypes=[np.int32])
    idx = lut(packed)

    rows: list[str] = []
    for y in range(h):
        row = idx[y]
        # run boundaries: where the index changes
        cuts = np.flatnonzero(np.diff(row)) + 1
        starts = np.concatenate(([0], cuts))
        ends = np.concatenate((cuts, [w]))
        toks: list[str] = []
        for s, e in zip(starts, ends):
            toks.append(b36(int(row[s])))
            left = int(e - s) - 1
            while left > 0:
                n = min(left, MAX_REPEAT)
                toks.append(b36(REPEAT + n - 1))
                left -= n
        rows.append("".join(toks))

    return {
        "format": FORMAT,
        "source": source,
        "w": int(w),
        "h": int(h),
        "palette": [f"#{c:06x}" for c in order],
        "rows": rows,
    }


def decode(doc: dict) -> np.ndarray:
    """Inverse of encode (used by --verify): returns an (h, w, 3) uint8 array."""
    pal = np.array([[int(p[1:3], 16), int(p[3:5], 16), int(p[5:7], 16)] for p in doc["palette"]], dtype=np.uint8)
    out = np.zeros((doc["h"], doc["w"]), dtype=np.int32)
    for y, s in enumerate(doc["rows"]):
        x = 0
        for i in range(0, len(s), 2):
            v = int(s[i : i + 2], 36)
            if v < REPEAT:
                out[y, x] = v
                x += 1
            else:
                n = v - REPEAT + 1
                out[y, x : x + n] = out[y, x - 1]
                x += n
        if x != doc["w"]:
            raise ValueError(f"row {y} decodes to {x} px, expected {doc['w']}")
    return pal[out]


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("src", type=Path, help="true pixel-art PNG (1 px = 1 art px)")
    ap.add_argument("dst", type=Path, help="output JSON path")
    ap.add_argument("--no-verify", action="store_true", help="skip the decode round-trip check")
    args = ap.parse_args()

    img = Image.open(args.src)
    doc = encode(img, args.src.name)
    if not args.no_verify:
        back = decode(doc)
        if not np.array_equal(back, np.asarray(img.convert("RGB"))):
            raise SystemExit("round-trip mismatch: decoded pixels differ from the source")
    args.dst.write_text(json.dumps(doc, separators=(",", ":")))
    toks = sum(len(r) // 2 for r in doc["rows"])
    log.info("%s: %dx%d, %d colours, %d tokens -> %s (%.0f KB)", args.src.name, doc["w"], doc["h"],
             len(doc["palette"]), toks, args.dst, args.dst.stat().st_size / 1024)


if __name__ == "__main__":
    main()
