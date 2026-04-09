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
