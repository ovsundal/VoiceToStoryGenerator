import json
from pathlib import Path

from backend.pipeline import STUB_SCENES, run, run_segment_only


def test_pipeline_stub_scenes_are_valid() -> None:
    for scene in STUB_SCENES:
        assert "index" in scene
        assert "caption_no" in scene
        assert "prompt_en" in scene
        assert isinstance(scene["index"], int)
        assert len(scene["caption_no"]) > 0


def test_pipeline_emits_progress_and_scene_events(tmp_path: Path, sample_audio: str) -> None:
    # Smoke test — exercises the full run() path with all dependencies mocked by conftest
    run(audio_path=sample_audio, text=None, output_dir=str(tmp_path))


def test_pipeline_emits_correct_json_lines(tmp_path: Path, capsys, sample_audio: str) -> None:
    run(audio_path=sample_audio, text=None, output_dir=str(tmp_path))
    captured = capsys.readouterr()
    lines = [line for line in captured.out.strip().splitlines() if line.strip()]
    parsed = [json.loads(line) for line in lines]

    event_types = [e["event"] for e in parsed]
    assert "progress" in event_types
    assert "scene" in event_types
    assert event_types[-1] == "done"

    scene_events = [e for e in parsed if e["event"] == "scene"]
    assert len(scene_events) > 0
    for scene_event in scene_events:
        assert "caption_no" in scene_event
        assert "image_path" in scene_event
        assert "index" in scene_event


def test_pipeline_text_path_skips_transcription(tmp_path: Path, capsys) -> None:
    run(audio_path=None, text="Barnet vasker hendene.", output_dir=str(tmp_path))
    captured = capsys.readouterr()
    lines = [json.loads(line) for line in captured.out.strip().splitlines() if line.strip()]
    event_types = [e["event"] for e in lines]
    progress_stages = [e.get("stage") for e in lines if e["event"] == "progress"]
    assert "transcribing" not in progress_stages
    assert "segmenting" in progress_stages
    assert event_types[-1] == "done"


def test_pipeline_segment_only_emits_segments_ready(capsys) -> None:
    run_segment_only(audio_path=None, text="Barnet vasker hendene.")
    captured = capsys.readouterr()
    lines = [json.loads(line) for line in captured.out.strip().splitlines() if line.strip()]
    event_types = [e["event"] for e in lines]
    assert "segments_ready" in event_types
    segments_event = next(e for e in lines if e["event"] == "segments_ready")
    assert "scenes" in segments_event
    assert isinstance(segments_event["scenes"], list)
    assert len(segments_event["scenes"]) > 0


def test_pipeline_generate_mode_emits_scene_and_done_events(tmp_path: Path, capsys) -> None:
    """Test run_generate via pipeline CLI --generate mode."""
    scenes_file = tmp_path / "scenes.json"
    scenes = [
        {"index": 0, "prompt_en": "child washing hands", "caption_no": "Vasker hendene"},
        {"index": 1, "prompt_en": "child drying hands", "caption_no": "Tørker hendene"},
    ]
    scenes_file.write_text(json.dumps(scenes))

    from backend.pipeline import run_generate  # noqa: PLC0415

    run_generate(scenes_file=str(scenes_file), output_dir=str(tmp_path))
    captured = capsys.readouterr()
    lines = [json.loads(line) for line in captured.out.strip().splitlines() if line.strip()]
    event_types = [e["event"] for e in lines]
    assert "scene" in event_types
    assert event_types[-1] == "done"
