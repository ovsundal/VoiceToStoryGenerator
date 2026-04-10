from pathlib import Path

import pytest


@pytest.fixture
def sample_audio(tmp_path: Path) -> str:
    """Copy the test WAV fixture to a temp directory and return its path."""
    src = Path("tests/fixtures/sample_audio.wav")
    dst = tmp_path / "audio.wav"
    dst.write_bytes(src.read_bytes())
    return str(dst)


@pytest.fixture(autouse=True)
def mock_transcriber(monkeypatch):
    """Prevent real faster-whisper model loading in all unit tests."""
    monkeypatch.setattr(
        "backend.transcriber.load_model",
        lambda *a, **kw: None,
    )
    monkeypatch.setattr(
        "backend.transcriber.transcribe",
        lambda model, path, **kw: "Barnet vasker hendene og tørker seg.",
    )


@pytest.fixture(autouse=True)
def mock_segmenter(monkeypatch):
    """Prevent real llama-cpp-python model loading in all unit tests."""
    monkeypatch.setattr(
        "backend.segmenter.load_model",
        lambda *a, **kw: None,
    )
    monkeypatch.setattr(
        "backend.segmenter.segment",
        lambda model, transcript, **kw: [
            {"index": 0, "prompt_en": "child washing hands at sink", "caption_no": "Vasker"},
            {"index": 1, "prompt_en": "child drying hands with towel", "caption_no": "Tørker"},
        ],
    )


@pytest.fixture(autouse=True)
def mock_image_generator(monkeypatch, tmp_path):
    """Prevent real FLUX pipeline loading. Creates a real PNG so caption_renderer can open it."""
    from PIL import Image

    def _fake_generate(pipe, prompt_en: str, output_path: str) -> None:
        Image.new("RGB", (512, 512), "white").save(output_path)

    monkeypatch.setattr("backend.image_generator.load_pipeline", lambda *a, **kw: None)
    monkeypatch.setattr("backend.image_generator.generate", _fake_generate)


@pytest.fixture(autouse=True)
def mock_caption_renderer(monkeypatch):
    """Prevent caption_renderer from opening files (image_generator mock already creates them)."""
    # Only patch render — let test_caption_renderer.py tests use the real implementation
    # by overriding this autouse fixture locally if needed.
    pass
