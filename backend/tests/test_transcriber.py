"""Unit tests for backend.transcriber. WhisperModel is never loaded from disk."""

from backend.transcriber import transcribe


class _FakeSegment:
    def __init__(self, text: str) -> None:
        self.text = text


class _FakeWhisper:
    def __init__(self, segments: list[str]) -> None:
        self._segments = segments

    def transcribe(self, audio_path: str, language: str):  # noqa: ANN001
        return [_FakeSegment(t) for t in self._segments], None


def test_transcribe_single_segment():
    model = _FakeWhisper([" Barnet vasker hendene."])
    result = transcribe(model, "any.wav", language="no")
    assert result == "Barnet vasker hendene."


def test_transcribe_joins_multiple_segments():
    model = _FakeWhisper([" Første del.", " Andre del."])
    result = transcribe(model, "any.webm")
    assert result == "Første del. Andre del."


def test_transcribe_strips_whitespace():
    model = _FakeWhisper(["  Vasker   ", "  hendene.  "])
    result = transcribe(model, "any.wav")
    assert result == "Vasker hendene."


def test_transcribe_empty_segments():
    model = _FakeWhisper([])
    result = transcribe(model, "any.wav")
    assert result == ""


def test_transcribe_default_language_is_norwegian():
    """Verify the default language kwarg is 'no' by checking the call."""
    called_with: dict = {}

    class _SpyWhisper:
        def transcribe(self, audio_path: str, language: str):  # noqa: ANN001
            called_with["language"] = language
            return [], None

    transcribe(_SpyWhisper(), "any.wav")  # no explicit language
    assert called_with["language"] == "no"
