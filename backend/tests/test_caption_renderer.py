"""Unit tests for backend.caption_renderer. Uses real Pillow — no disk model needed."""

from pathlib import Path

import pytest
from PIL import Image

from backend.caption_renderer import render


@pytest.fixture
def sample_png(tmp_path: Path) -> str:
    """Create a 512×512 white PNG as test input."""
    path = str(tmp_path / "input.png")
    Image.new("RGB", (512, 512), "white").save(path)
    return path


def test_render_creates_output_file(tmp_path: Path, sample_png: str):
    output_path = str(tmp_path / "output.png")
    render(sample_png, "Vasker hendene", output_path)
    assert Path(output_path).exists()


def test_render_extends_canvas_height(tmp_path: Path, sample_png: str):
    output_path = str(tmp_path / "output.png")
    render(sample_png, "Tørker hendene", output_path)
    result = Image.open(output_path)
    assert result.height > 512


def test_render_output_is_valid_png(tmp_path: Path, sample_png: str):
    output_path = str(tmp_path / "output.png")
    render(sample_png, "Går ut døren", output_path)
    img = Image.open(output_path)
    assert img.format == "PNG"


def test_render_width_unchanged(tmp_path: Path, sample_png: str):
    output_path = str(tmp_path / "output.png")
    render(sample_png, "Tar på seg jakken", output_path)
    result = Image.open(output_path)
    assert result.width == 512


def test_render_norwegian_characters(tmp_path: Path, sample_png: str):
    """æøå must not cause an exception."""
    output_path = str(tmp_path / "output.png")
    render(sample_png, "Æble, østers, åpen dør", output_path)
    assert Path(output_path).exists()


def test_render_long_caption_fits_width(tmp_path: Path, sample_png: str):
    """A very long caption must not overflow the image width."""
    output_path = str(tmp_path / "output.png")
    long_caption = "Dette er en veldig lang norsk bildetekst med æøå som skal gå over kanten"
    render(sample_png, long_caption, output_path)
    assert Path(output_path).exists()
    result = Image.open(output_path)
    assert result.width == 512  # canvas width must not change


def test_render_bar_is_approximately_18_percent(tmp_path: Path, sample_png: str):
    output_path = str(tmp_path / "output.png")
    render(sample_png, "Vasker", output_path)
    result = Image.open(output_path)
    bar_height = result.height - 512
    # Allow ±2px tolerance
    assert abs(bar_height - int(512 * 0.18)) <= 2
