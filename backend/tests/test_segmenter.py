"""Unit tests for backend.segmenter. No real LLM is loaded."""

import json

import pytest

from backend.segmenter import _fallback_split, segment


class _FakeLlama:
    def __init__(self, response_text: str) -> None:
        self._response = response_text
        self.call_count = 0

    def __call__(self, prompt: str, **kwargs):
        self.call_count += 1
        return {"choices": [{"text": self._response}]}


class _AlternatingLlama:
    """Returns garbage on first call, valid JSON on second."""

    def __init__(self, valid_json: str) -> None:
        self._valid_json = valid_json
        self.call_count = 0

    def __call__(self, prompt: str, **kwargs):
        self.call_count += 1
        if self.call_count == 1:
            return {"choices": [{"text": "not valid json }{"}]}
        return {"choices": [{"text": self._valid_json}]}


class _AlwaysInvalidLlama:
    def __init__(self) -> None:
        self.call_count = 0

    def __call__(self, prompt: str, **kwargs):
        self.call_count += 1
        return {"choices": [{"text": "garbage }{ not json"}]}


def test_segment_returns_list_of_dicts():
    payload = json.dumps([
        {"prompt_en": "child washing hands", "caption_no": "Vasker hendene"},
        {"prompt_en": "child drying hands", "caption_no": "Tørker hendene"},
    ])
    model = _FakeLlama(payload)
    result = segment(model, "Barnet vasker hendene.")
    assert isinstance(result, list)
    assert len(result) == 2
    for item in result:
        assert "index" in item
        assert "prompt_en" in item
        assert "caption_no" in item


def test_segment_retry_on_invalid_json():
    valid_json = json.dumps([{"prompt_en": "child at sink", "caption_no": "Vasker"}])
    model = _AlternatingLlama(valid_json)
    result = segment(model, "Barnet vasker hendene.")
    assert model.call_count == 2
    assert len(result) == 1
    assert result[0]["caption_no"] == "Vasker"


def test_segment_fallback_on_double_failure():
    model = _AlwaysInvalidLlama()
    result = segment(model, "Barnet vasker. Barnet tørker.")
    assert model.call_count == 2
    assert len(result) >= 1
    for item in result:
        assert "prompt_en" in item
        assert "caption_no" in item


def test_segment_respects_max_scenes():
    """max_scenes value should appear in the prompt sent to the model."""
    captured_prompts: list[str] = []

    class _CapturingLlama:
        def __call__(self, prompt: str, **kwargs):
            captured_prompts.append(prompt)
            return {"choices": [{"text": json.dumps([
                {"prompt_en": "scene", "caption_no": "Scene"},
            ])}]}

    model = _CapturingLlama()
    segment(model, "Story text.", max_scenes=7)
    assert len(captured_prompts) >= 1
    assert "7" in captured_prompts[0]


def test_segment_indices_are_sequential():
    payload = json.dumps([
        {"prompt_en": "action a", "caption_no": "A"},
        {"prompt_en": "action b", "caption_no": "B"},
        {"prompt_en": "action c", "caption_no": "C"},
    ])
    model = _FakeLlama(payload)
    result = segment(model, "Story.")
    assert [s["index"] for s in result] == [0, 1, 2]


def test_fallback_split_single_sentence():
    result = _fallback_split("Barnet vasker hendene.")
    assert len(result) == 1
    assert result[0]["prompt_en"] == "Barnet vasker hendene."


def test_fallback_split_multiple_sentences():
    result = _fallback_split("Barnet vasker. Barnet tørker.")
    assert len(result) == 2


def test_fallback_split_empty_string():
    result = _fallback_split("")
    assert len(result) >= 1


@pytest.mark.usefixtures("mock_segmenter")
def test_segment_autouse_mock_does_not_interfere():
    """Verify that the autouse mock doesn't break direct calls to segment() with a fake model."""
    payload = json.dumps([{"prompt_en": "test", "caption_no": "Test"}])
    model = _FakeLlama(payload)
    # Call the real segment() directly — autouse mock patches backend.segmenter.segment
    # but we're calling it directly here by importing it at the top of this file.
    result = segment(model, "Test story.")
    assert len(result) == 1
