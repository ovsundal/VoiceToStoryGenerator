"""Speech-to-text transcription using faster-whisper."""

from __future__ import annotations

import threading
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from faster_whisper import WhisperModel

DEFAULT_MODEL_DIR = str(Path(__file__).parent.parent / "resources" / "models" / "whisper")
_MODEL_CACHE_SUBDIR = "models--Systran--faster-whisper-large-v3"


def is_model_cached(model_dir: str = DEFAULT_MODEL_DIR) -> bool:
    """Return True if the model weights are already on disk."""
    return (Path(model_dir) / _MODEL_CACHE_SUBDIR).exists()


def download_model(model_dir: str = DEFAULT_MODEL_DIR, on_progress=None) -> None:
    """Download the faster-whisper large-v3 model with byte-level progress.

    on_progress is called with an integer 0–99 during the download,
    then once with 100 when complete.
    """
    from huggingface_hub import HfApi, snapshot_download  # noqa: PLC0415
    from tqdm import tqdm as _BaseTqdm  # noqa: PLC0415

    repo_id = "Systran/faster-whisper-large-v3"
    total_bytes = 3_100_000_000  # ~3.1 GB fallback estimate

    try:
        api = HfApi()
        info = api.repo_info(repo_id, files_metadata=True)
        actual = sum(f.size or 0 for f in info.siblings)
        if actual > 0:
            total_bytes = actual
    except Exception:  # noqa: BLE001
        pass

    # Closure-based progress tracker — thread-safe, no class-level globals
    _state = {"downloaded": 0, "last_pct": -1}
    _lock = threading.Lock()

    class _ProgressTqdm(_BaseTqdm):
        def __init__(self, *args, **kwargs) -> None:
            kwargs["disable"] = True  # suppress terminal output
            super().__init__(*args, **kwargs)

        def update(self, n: int = 1) -> bool | None:
            result = super().update(n)
            if isinstance(n, (int, float)) and n > 0 and on_progress and total_bytes > 0:
                with _lock:
                    _state["downloaded"] += n
                    pct = min(99, int(100 * _state["downloaded"] / total_bytes))
                    if pct != _state["last_pct"]:
                        _state["last_pct"] = pct
                        on_progress(pct)
            return result

    snapshot_download(
        repo_id,
        cache_dir=model_dir,
        tqdm_class=_ProgressTqdm,
    )

    if on_progress:
        on_progress(100)


def load_model(model_dir: str = DEFAULT_MODEL_DIR) -> WhisperModel:
    """Load the faster-whisper large-v3 model. Download if not cached."""
    from faster_whisper import WhisperModel as _WhisperModel  # noqa: PLC0415

    return _WhisperModel(
        "large-v3",
        device="cpu",
        compute_type="int8",
        download_root=model_dir,
    )


def transcribe(model: WhisperModel, audio_path: str, language: str = "no") -> str:
    """Transcribe an audio file and return the full text.

    Args:
        model: Loaded WhisperModel instance.
        audio_path: Path to audio file (WAV, WebM, MP3, etc.).
        language: BCP-47 language code. "no" = Norwegian Bokmål.
    """
    segments, _ = model.transcribe(audio_path, language=language)
    return " ".join(segment.text.strip() for segment in segments)
