"""Stub pipeline for Phase 1. Emits fixture events without loading any models."""

import argparse
import json
import time


def emit(event: str, **data) -> None:
    print(json.dumps({"event": event, **data}), flush=True)


STUB_SCENES = [
    {"index": 0, "caption_no": "Vasker hendene", "prompt_en": "child washing hands at sink"},
    {"index": 1, "caption_no": "Tørker hendene", "prompt_en": "child drying hands with towel"},
    {"index": 2, "caption_no": "Tar på seg jakken", "prompt_en": "child putting on jacket"},
    {"index": 3, "caption_no": "Går ut døren", "prompt_en": "child walking out the door"},
]


def run(audio_path: str, output_dir: str) -> None:
    emit("progress", stage="transcribing")
    time.sleep(0.4)

    emit("progress", stage="segmenting")
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
    parser.add_argument("--audio", required=True, help="Path to input audio WAV file")
    parser.add_argument("--output", required=True, help="Directory for output images")
    args = parser.parse_args()
    run(audio_path=args.audio, output_dir=args.output)
