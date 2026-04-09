"""Pipeline orchestration. Phase 2: real transcription; Phase 3 stubs for segmentation/images."""

import argparse
import json
import sys
import time
from pathlib import Path

# Ensure project root is on sys.path when running as a script
sys.path.insert(0, str(Path(__file__).parent.parent))


def emit(event: str, **data) -> None:
    print(json.dumps({"event": event, **data}), flush=True)


STUB_SCENES = [
    {"index": 0, "caption_no": "Vasker hendene", "prompt_en": "child washing hands at sink"},
    {"index": 1, "caption_no": "Tørker hendene", "prompt_en": "child drying hands with towel"},
    {"index": 2, "caption_no": "Tar på seg jakken", "prompt_en": "child putting on jacket"},
    {"index": 3, "caption_no": "Går ut døren", "prompt_en": "child walking out the door"},
]


def run(audio_path: str | None, text: str | None, output_dir: str) -> None:
    if text:
        # Text-input path: skip transcription
        emit("progress", stage="segmenting")
    else:
        # Audio path: run real transcription
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
        text = transcribe(model, audio_path)
        emit("progress", stage="segmenting")

    # Phase 3 stub: segmentation and image generation
    time.sleep(0.5)

    stub_image = "tests/fixtures/sample_image.png"
    for i, scene in enumerate(STUB_SCENES):
        emit("progress", stage="generating_image", index=i + 1, total=len(STUB_SCENES))
        time.sleep(0.4)
        emit(
            "scene",
            index=scene["index"],
            caption_no=scene["caption_no"],
            image_path=stub_image,
        )

    emit(
        "done",
        scenes=[
            {"index": s["index"], "caption_no": s["caption_no"], "image_path": stub_image}
            for s in STUB_SCENES
        ],
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Story-to-Images pipeline")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--audio", help="Path to input audio file")
    group.add_argument("--text", help="Pre-transcribed text (skips transcription)")
    parser.add_argument("--output", help="Directory for output images")
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

    if not args.output:
        parser.error("--output is required unless --transcribe-only is set")

    run(audio_path=args.audio, text=args.text, output_dir=args.output)
