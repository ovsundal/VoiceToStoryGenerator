---
name: python-pipeline
description: Patterns for the Python AI pipeline — faster-whisper transcription, llama-cpp-python LLM segmentation, FLUX.1-schnell image generation, and Pillow caption overlay. Covers model loading, streaming stdout, and pytest conventions.
---

# Python Pipeline Patterns

The backend is a single Python script (`backend/pipeline.py`) spawned by Electron as a child process. It receives input via stdin or CLI args, streams progress as JSON lines to stdout, and writes images to a temp directory.

## Project Layout

```
backend/
├── pipeline.py          # Entry point — orchestrates all steps
├── transcriber.py       # faster-whisper
├── segmenter.py         # llama-cpp-python → scene JSON
├── image_generator.py   # FLUX.1-schnell
├── caption_renderer.py  # Pillow caption overlay
├── requirements.txt
└── tests/
    ├── conftest.py
    ├── test_transcriber.py
    ├── test_segmenter.py
    └── test_image_generator.py
```

---

## Streaming Stdout Protocol

Electron reads stdout line-by-line. Every line must be valid JSON:

```python
import json, sys

def emit(event: str, **data):
    print(json.dumps({"event": event, **data}), flush=True)

# Usage
emit("progress", stage="transcribing")
emit("progress", stage="generating_image", index=1, total=5)
emit("scene", index=0, caption_no="Barnet vasker hendene", image_path="/tmp/scene_0.png")
emit("done", scenes=[...])
emit("error", message="Model not found at path X")
```

**Always `flush=True`** — stdout is line-buffered by default, Electron won't receive events otherwise.

---

## faster-whisper

```python
from faster_whisper import WhisperModel

def transcribe(audio_path: str, model_dir: str) -> str:
    model = WhisperModel(
        "large-v3",
        device="cpu",
        compute_type="int8",
        download_root=model_dir,
    )
    segments, _ = model.transcribe(audio_path, language="no")  # "no" = Norwegian
    return " ".join(segment.text for segment in segments)
```

- `language="no"` forces Norwegian; omit for auto-detect (supports both Norwegian and English)
- `compute_type="int8"` reduces memory on CPU
- Load the model once and reuse — model loading is the expensive operation

---

## llama-cpp-python

```python
from llama_cpp import Llama

SEGMENTATION_PROMPT = """You are helping create visual instructions for autistic people.
Break this story into 4-8 discrete steps. Each step describes ONE simple action or scene.
Return JSON array only — no other text:
[
  {
    "prompt_en": "English image description for AI generation (flat cartoon, one action)",
    "caption_no": "Norsk bildetekst, maks 6 ord"
  }
]

Story: {transcript}"""

def segment(transcript: str, model_path: str) -> list[dict]:
    llm = Llama(
        model_path=model_path,
        n_ctx=2048,
        n_gpu_layers=0,  # CPU only — GPU is reserved for FLUX
        verbose=False,
    )
    response = llm.create_chat_completion(
        messages=[{"role": "user", "content": SEGMENTATION_PROMPT.format(transcript=transcript)}],
        temperature=0.3,
        max_tokens=1024,
    )
    content = response["choices"][0]["message"]["content"]
    return json.loads(content)
```

- `n_gpu_layers=0` keeps LLM on CPU so GPU is free for FLUX
- `temperature=0.3` for consistent, structured JSON output
- Always validate JSON parse — retry once if it fails

---

## FLUX.1-schnell (quantized)

```python
import torch
from diffusers import FluxPipeline
from optimum.quanto import freeze, qfloat8, quantize

POSITIVE_PREFIX = (
    "flat design cartoon illustration, bold black outlines, simple geometric shapes, "
    "plain white background, no shading, no gradients, no texture, "
    "limited color palette (max 5 colors), one main action visible, "
    "children's book style, clear and unambiguous, large simple figures"
)

def load_flux(model_dir: str) -> FluxPipeline:
    pipe = FluxPipeline.from_pretrained(
        "black-forest-labs/FLUX.1-schnell",
        torch_dtype=torch.bfloat16,
        cache_dir=model_dir,
    )
    # Quantize transformer to float8 (~halves VRAM)
    quantize(pipe.transformer, weights=qfloat8)
    freeze(pipe.transformer)
    # T5 text encoder in int8
    quantize(pipe.text_encoder_2, weights=qfloat8)
    freeze(pipe.text_encoder_2)
    pipe.to("cuda")
    return pipe

def generate_image(pipe: FluxPipeline, prompt_en: str, output_path: str):
    full_prompt = f"{POSITIVE_PREFIX}, {prompt_en}"
    image = pipe(
        full_prompt,
        num_inference_steps=4,  # schnell is optimized for 4 steps
        guidance_scale=0.0,     # schnell uses guidance_scale=0
        height=1024,
        width=1024,
    ).images[0]
    image.save(output_path)
```

- Load `pipe` once, call `generate_image` per scene — never reload between scenes
- `guidance_scale=0.0` is required for FLUX.1-schnell (CFG-distilled model)
- `num_inference_steps=4` is the designed operating point for schnell

---

## Pillow Caption Overlay

```python
from PIL import Image, ImageDraw, ImageFont

def add_caption(image_path: str, caption: str, output_path: str):
    img = Image.open(image_path).convert("RGB")
    draw = ImageDraw.Draw(img)

    # Use a bundled font that supports Norwegian (æ ø å)
    font = ImageFont.truetype("resources/fonts/NotoSans-Bold.ttf", size=40)

    # White bar at bottom
    bar_height = 80
    bar_top = img.height - bar_height
    draw.rectangle([(0, bar_top), (img.width, img.height)], fill="white")

    # Centered text
    bbox = draw.textbbox((0, 0), caption, font=font)
    text_w = bbox[2] - bbox[0]
    x = (img.width - text_w) / 2
    y = bar_top + (bar_height - (bbox[3] - bbox[1])) / 2
    draw.text((x, y), caption, fill="black", font=font)

    img.save(output_path)
```

**Norwegian characters require a font that supports them.** Bundle `NotoSans-Bold.ttf` — it covers æ, ø, å. Do not rely on system fonts.

---

## pytest Conventions

```python
# backend/tests/conftest.py
import pytest
from pathlib import Path

@pytest.fixture
def sample_audio(tmp_path):
    # Copy a short test WAV from fixtures/
    src = Path("tests/fixtures/sample_no.wav")
    dst = tmp_path / "audio.wav"
    dst.write_bytes(src.read_bytes())
    return str(dst)

@pytest.fixture
def mock_llm(monkeypatch):
    """Avoid loading a real 5GB model in unit tests."""
    def fake_segment(transcript, model_path):
        return [
            {"prompt_en": "child washing hands at sink", "caption_no": "Vasker hendene"},
            {"prompt_en": "child drying hands with towel", "caption_no": "Tørker hendene"},
        ]
    monkeypatch.setattr("backend.segmenter.segment", fake_segment)

@pytest.fixture
def mock_flux(monkeypatch, tmp_path):
    """Replace FLUX generation with a solid-color placeholder image."""
    from PIL import Image
    def fake_generate(pipe, prompt_en, output_path):
        Image.new("RGB", (1024, 1024), color=(200, 200, 200)).save(output_path)
    monkeypatch.setattr("backend.image_generator.generate_image", fake_generate)
```

- **Mock all model loading in unit tests** — models are too large to load in CI
- Keep real model integration tests behind a `@pytest.mark.slow` marker
- Store short audio fixtures (< 5 seconds) in `tests/fixtures/`

```bash
# Run unit tests only (fast)
pytest backend/tests/ -m "not slow"

# Run integration tests (requires models downloaded)
pytest backend/tests/ -m slow
```
