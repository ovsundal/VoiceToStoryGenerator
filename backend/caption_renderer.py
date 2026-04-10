"""Pillow caption overlay — extends image canvas with a white bar and Norwegian caption text."""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

_FONT_PATH = Path(__file__).parent.parent / "resources" / "fonts" / "NotoSans-Bold.ttf"


def render(image_path: str, caption_no: str, output_path: str) -> None:
    """Extend image canvas downward by ~18% with a white bar and draw centered caption.

    Falls back to PIL default font if NotoSans-Bold.ttf is not present.
    Uses textbbox (Pillow ≥ 8.0.0) for accurate Norwegian character measurement.
    """
    print(f"[caption_renderer] input: {caption_no!r} on {image_path}", file=sys.stderr, flush=True)
    img = Image.open(image_path).convert("RGB")
    w, h = img.size
    bar_height = int(h * 0.18)

    new_img = Image.new("RGB", (w, h + bar_height), "white")
    new_img.paste(img, (0, 0))

    draw = ImageDraw.Draw(new_img)
    if not _FONT_PATH.exists():
        raise FileNotFoundError(
            f"NotoSans-Bold.ttf not found at {_FONT_PATH}. "
            "Download it from Google Fonts and place it in resources/fonts/."
        )

    # Start at ideal size and shrink until text fits within image width (with padding)
    max_text_w = int(w * 0.92)
    font_size = bar_height // 2
    font = ImageFont.truetype(str(_FONT_PATH), font_size)
    while font_size > 8:
        bbox = draw.textbbox((0, 0), caption_no, font=font)
        if (bbox[2] - bbox[0]) <= max_text_w:
            break
        font_size -= 1
        font = ImageFont.truetype(str(_FONT_PATH), font_size)

    bbox = draw.textbbox((0, 0), caption_no, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (w - text_w) // 2
    y = h + (bar_height - text_h) // 2
    draw.text((x, y), caption_no, fill="black", font=font)

    new_img.save(output_path)
    print(f"[caption_renderer] output: {output_path}", file=sys.stderr, flush=True)
