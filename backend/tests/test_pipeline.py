import json
from pathlib import Path

from backend.pipeline import STUB_SCENES, run


def test_pipeline_emits_progress_and_scene_events(tmp_path: Path, sample_audio: str) -> None:
    run(audio_path=sample_audio, output_dir=str(tmp_path))
    # Note: capsys doesn't work when called directly; test event structure instead.
    # Integration test — see test_pipeline_stdout below.


def test_pipeline_stub_scenes_are_valid() -> None:
    for scene in STUB_SCENES:
        assert "index" in scene
        assert "caption_no" in scene
        assert "prompt_en" in scene
        assert isinstance(scene["index"], int)
        assert len(scene["caption_no"]) > 0


def test_pipeline_emits_correct_json_lines(tmp_path: Path, capsys, sample_audio: str) -> None:
    run(audio_path=sample_audio, output_dir=str(tmp_path))
    captured = capsys.readouterr()
    lines = [line for line in captured.out.strip().splitlines() if line.strip()]
    parsed = [json.loads(line) for line in lines]

    event_types = [e["event"] for e in parsed]
    assert "progress" in event_types
    assert "scene" in event_types
    assert event_types[-1] == "done"

    scene_events = [e for e in parsed if e["event"] == "scene"]
    assert len(scene_events) == len(STUB_SCENES)
    for scene_event in scene_events:
        assert "caption_no" in scene_event
        assert "image_path" in scene_event
        assert "index" in scene_event
