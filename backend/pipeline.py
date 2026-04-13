"""Pipeline orchestration: transcription → segmentation → image generation → caption overlay."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Ensure project root is on sys.path when running as a script
sys.path.insert(0, str(Path(__file__).parent.parent))


def emit(event: str, **data) -> None:
    print(json.dumps({"event": event, **data}), flush=True)


# Characters that appear in stories — used to give the LLM consistent descriptions.
# Update this list as needed; each entry needs "name" and "description".
PERSONAS: list[dict] = [
    {"name": "Emil", "description": "a 9-year-old boy with short blonde hair"},
    {"name": "Sigurd", "description": "a 7-year-old boy with short blonde hair, Emil's younger brother"},
    {"name": "Ove", "description": "the father, an adult man"},
    {"name": "Kristin", "description": "the mother, an adult woman"},
    {"name": "mormor", "description": "the maternal grandmother, an elderly woman"},
    {"name": "morfar", "description": "the maternal grandfather, an elderly man"},
]

# Kept for reference and backward-compat with existing tests
STUB_SCENES = [
    {"index": 0, "caption_no": "Vasker hendene", "prompt_en": "child washing hands at sink"},
    {"index": 1, "caption_no": "Tørker hendene", "prompt_en": "child drying hands with towel"},
    {"index": 2, "caption_no": "Tar på seg jakken", "prompt_en": "child putting on jacket"},
    {"index": 3, "caption_no": "Går ut døren", "prompt_en": "child walking out the door"},
]


def _run_transcription(audio_path: str) -> str:
    """Transcribe audio and return text. Emits progress events."""
    from backend.transcriber import (  # noqa: PLC0415
        DEFAULT_MODEL_DIR,
        download_model,
        is_model_cached,
        load_model,
        transcribe,
    )

    if not is_model_cached():
        emit("progress", stage="downloading_model", model="whisper", pct=0)
        download_model(
            DEFAULT_MODEL_DIR,
            on_progress=lambda pct: emit("progress", stage="downloading_model", model="whisper", pct=pct),
        )

    emit("progress", stage="loading_model", model="whisper")
    model = load_model()
    emit("progress", stage="transcribing")
    return transcribe(model, audio_path)


def _run_segmentation(text: str) -> list[dict]:
    """Segment text into scenes, downloading the model if needed. Emits progress events."""
    from backend.segmenter import (  # noqa: PLC0415
        DEFAULT_MODEL_DIR,
        download_model,
        is_model_cached,
        load_model as load_segmenter,
        segment,
    )

    if not is_model_cached():
        emit("progress", stage="downloading_model", model="llama", pct=0)
        download_model(
            DEFAULT_MODEL_DIR,
            on_progress=lambda pct: emit("progress", stage="downloading_model", model="llama", pct=pct),
        )

    emit("progress", stage="loading_model", model="llama")
    model = load_segmenter()
    emit("progress", stage="segmenting")
    return segment(model, text, personas=PERSONAS)


def run(audio_path: str | None, text: str | None, output_dir: str) -> None:
    """Full pipeline: transcribe (if audio) → segment → generate images → overlay captions."""
    if text:
        emit("progress", stage="segmenting")
    else:
        text = _run_transcription(audio_path)
        emit("progress", stage="segmenting")

    from backend.caption_renderer import render  # noqa: PLC0415
    from backend.image_generator import generate  # noqa: PLC0415

    scenes = _run_segmentation(text)

    image_pipe = _load_image_pipeline()
    output_path_base = Path(output_dir)

    done_scenes = []
    for i, scene in enumerate(scenes):
        emit("progress", stage="generating_image", index=i + 1, total=len(scenes))
        img_path = str(output_path_base / f"scene_{scene['index']}.png")
        generate(image_pipe, scene["prompt_en"], img_path)
        render(img_path, scene["caption_no"], img_path)
        emit(
            "scene",
            index=scene["index"],
            caption_no=scene["caption_no"],
            image_path=img_path,
        )
        done_scenes.append(
            {"index": scene["index"], "caption_no": scene["caption_no"], "image_path": img_path}
        )

    emit("done", scenes=done_scenes)


def run_segment_only(audio_path: str | None, text: str | None) -> None:
    """Transcribe (if audio) then segment. Emits segments_ready with scene list."""
    if text:
        emit("progress", stage="segmenting")
    else:
        text = _run_transcription(audio_path)
        emit("progress", stage="segmenting")

    scenes = _run_segmentation(text)
    emit("segments_ready", scenes=scenes)


def _load_image_pipeline():
    """Load the FLUX image pipeline, downloading the model if needed. Emits progress events."""
    from backend.image_generator import (  # noqa: PLC0415
        DEFAULT_MODEL_DIR,
        download_model,
        is_model_cached,
        load_pipeline,
    )

    if not is_model_cached():
        emit("progress", stage="downloading_model", model="flux", pct=0)
        download_model(
            DEFAULT_MODEL_DIR,
            on_progress=lambda pct: emit("progress", stage="downloading_model", model="flux", pct=pct),
        )

    emit("progress", stage="loading_model", model="flux")
    return load_pipeline()


def run_generate(scenes_file: str, output_dir: str) -> None:
    """Generate images + captions for pre-segmented scenes. Reads scenes from JSON file."""
    from backend.caption_renderer import render  # noqa: PLC0415
    from backend.image_generator import generate  # noqa: PLC0415

    with open(scenes_file) as f:
        scenes = json.load(f)

    image_pipe = _load_image_pipeline()
    output_path_base = Path(output_dir)

    done_scenes = []
    for i, scene in enumerate(scenes):
        emit("progress", stage="generating_image", index=i + 1, total=len(scenes))
        img_path = str(output_path_base / f"scene_{scene['index']}.png")
        generate(image_pipe, scene["prompt_en"], img_path)
        render(img_path, scene["caption_no"], img_path)
        emit(
            "scene",
            index=scene["index"],
            caption_no=scene["caption_no"],
            image_path=img_path,
        )
        done_scenes.append(
            {"index": scene["index"], "caption_no": scene["caption_no"], "image_path": img_path}
        )

    emit("done", scenes=done_scenes)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Story-to-Images pipeline")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--audio", help="Path to input audio file")
    group.add_argument("--text", help="Pre-transcribed text (skips transcription)")
    group.add_argument("--generate", action="store_true", help="Image-generation-only mode")
    parser.add_argument(
        "--scenes-file", help="JSON file with scene list (required with --generate)"
    )
    parser.add_argument("--output", help="Directory for output images")
    parser.add_argument("--segment-only", action="store_true", help="Segment and exit (no images)")
    parser.add_argument("--transcribe-only", action="store_true", help="Transcribe audio and exit")
    args = parser.parse_args()

    if args.transcribe_only:
        from backend.transcriber import (  # noqa: PLC0415
            DEFAULT_MODEL_DIR,
            download_model,
            is_model_cached,
            load_model,
            transcribe,
        )

        if not is_model_cached():
            emit("progress", stage="downloading_model", pct=0)
            download_model(
                DEFAULT_MODEL_DIR,
                on_progress=lambda pct: emit("progress", stage="downloading_model", pct=pct),
            )

        emit("progress", stage="loading_model")
        model = load_model()
        emit("progress", stage="transcribing")
        text = transcribe(model, args.audio)
        emit("transcript", text=text)
        sys.exit(0)

    if args.generate:
        if not args.scenes_file:
            parser.error("--scenes-file is required with --generate")
        if not args.output:
            parser.error("--output is required with --generate")
        run_generate(scenes_file=args.scenes_file, output_dir=args.output)
        sys.exit(0)

    if args.segment_only:
        run_segment_only(audio_path=args.audio, text=args.text)
        sys.exit(0)

    if not args.output:
        parser.error("--output is required unless --transcribe-only or --segment-only is set")

    run(audio_path=args.audio, text=args.text, output_dir=args.output)
