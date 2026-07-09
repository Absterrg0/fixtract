#!/usr/bin/env python3
"""Remove near-white background from a logo image and write a transparent PNG."""
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def remove_white_bg(im: Image.Image, threshold: int = 248, soft: int = 12) -> Image.Image:
    im = im.convert("RGBA")
    pixels = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            m = min(r, g, b)
            if m >= threshold:
                pixels[x, y] = (r, g, b, 0)
            elif m >= threshold - soft:
                fade = (threshold - m) / soft
                pixels[x, y] = (r, g, b, int(a * fade))
    return im


def crop_content(im: Image.Image, pad: int = 24) -> Image.Image:
    bbox = im.getbbox()
    if not bbox:
        return im
    w, h = im.size
    left = max(0, bbox[0] - pad)
    top = max(0, bbox[1] - pad)
    right = min(w, bbox[2] + pad)
    bottom = min(h, bbox[3] + pad)
    return im.crop((left, top, right, bottom))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--threshold", type=int, default=248)
    parser.add_argument("--soft", type=int, default=12)
    parser.add_argument("--pad", type=int, default=24)
    args = parser.parse_args()

    im = Image.open(args.input)
    im = remove_white_bg(im, threshold=args.threshold, soft=args.soft)
    im = crop_content(im, pad=args.pad)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    im.save(args.output, "PNG", optimize=True)
    print(f"Wrote {args.output} ({im.size[0]}x{im.size[1]}, {args.output.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
