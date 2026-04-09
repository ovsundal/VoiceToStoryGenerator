from pathlib import Path

import pytest


@pytest.fixture
def sample_audio(tmp_path: Path) -> str:
    """Copy the test WAV fixture to a temp directory and return its path."""
    src = Path("tests/fixtures/sample_audio.wav")
    dst = tmp_path / "audio.wav"
    dst.write_bytes(src.read_bytes())
    return str(dst)
