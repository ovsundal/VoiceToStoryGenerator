"""LLM story segmentation using llama-cpp-python."""

from __future__ import annotations

import json
import re
import sys  # used for debug logging
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from llama_cpp import Llama

DEFAULT_MODEL_DIR = str(Path(__file__).parent.parent / "resources" / "models" / "llama")
_MODEL_REPO = "bartowski/Meta-Llama-3.1-8B-Instruct-GGUF"
_MODEL_FILENAME = "Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf"
_MODEL_SIZE_BYTES = 4_920_000_000  # ~4.9 GB estimate


def is_model_cached(model_dir: str = DEFAULT_MODEL_DIR) -> bool:
    """Return True if the GGUF model file is already on disk."""
    return (Path(model_dir) / _MODEL_FILENAME).exists()


def download_model(model_dir: str = DEFAULT_MODEL_DIR, on_progress=None) -> None:
    """Download the Llama 3.2 3B GGUF model with byte-level progress.

    on_progress is called with an integer 0–99 during the download,
    then once with 100 when complete.
    """
    import threading  # noqa: PLC0415

    from huggingface_hub import hf_hub_download  # noqa: PLC0415
    from tqdm import tqdm as _BaseTqdm  # noqa: PLC0415

    Path(model_dir).mkdir(parents=True, exist_ok=True)

    _state = {"downloaded": 0, "last_pct": -1}
    _lock = threading.Lock()

    class _ProgressTqdm(_BaseTqdm):
        def __init__(self, *args, **kwargs) -> None:
            kwargs["disable"] = True
            super().__init__(*args, **kwargs)

        def update(self, n: int = 1) -> bool | None:
            result = super().update(n)
            if isinstance(n, (int, float)) and n > 0 and on_progress and _MODEL_SIZE_BYTES > 0:
                with _lock:
                    _state["downloaded"] += n
                    pct = min(99, int(100 * _state["downloaded"] / _MODEL_SIZE_BYTES))
                    if pct != _state["last_pct"]:
                        _state["last_pct"] = pct
                        on_progress(pct)
            return result

    hf_hub_download(
        repo_id=_MODEL_REPO,
        filename=_MODEL_FILENAME,
        local_dir=model_dir,
        tqdm_class=_ProgressTqdm,
    )

    if on_progress:
        on_progress(100)


_SYSTEM_PROMPT = (
    "You are creating visual instructions for autistic people. "
    "Return ONLY a valid JSON array. No prose, no code fences, no extra text."
)

_DESCRIBE_TEMPLATE = """\
Describe this action as a single cartoon image for autistic individuals.
Return exactly one JSON object in an array:
[{{"prompt_en": "English image description of the action", "caption_no": "Norsk tekst som beskriver handlingen"}}]

Action: {transcript}"""

_SEGMENT_TEMPLATE = """\
Split the story into scenes — one scene per distinct action that is explicitly stated.

STRICT RULES:
- Only include actions that appear in the text. Never add implied or inferred steps.
- Each scene must describe exactly ONE action. Never combine two actions into one scene.
- The Norwegian caption must describe only what happens in that specific scene.
- Produce exactly one scene per explicit action mentioned, up to {max_scenes} scenes total.

Example:
Story: "Lena vasker hendene. Etterpå tørker hun hendene."
Correct output:
[
  {{"prompt_en": "Lena washing her hands at a sink", "caption_no": "Lena vasker hendene"}},
  {{"prompt_en": "Lena drying her hands with a towel", "caption_no": "Lena tørker hendene"}}
]

Now split this story:
Story: {transcript}"""


def load_model(model_dir: str = DEFAULT_MODEL_DIR, n_gpu_layers: int = 0) -> Llama:
    """Load the GGUF model. n_gpu_layers=0 means CPU-only (required per PRD)."""
    from llama_cpp import Llama as _Llama  # noqa: PLC0415

    model_path = Path(model_dir) / _MODEL_FILENAME
    return _Llama(model_path=str(model_path), n_gpu_layers=n_gpu_layers, verbose=False)


def segment(model: Llama, transcript: str, max_scenes: int = 5) -> list[dict]:
    """Segment a transcript into a list of scene dicts.

    Returns: [{"index": int, "prompt_en": str, "caption_no": str}, ...]

    Retries once on JSON parse failure, then falls back to sentence-split heuristic.
    """
    print(f"[segmenter] input: {transcript!r}", file=sys.stderr, flush=True)
    estimated = _estimate_scenes(transcript, max_scenes)
    print(f"[segmenter] estimated scenes: {estimated}", file=sys.stderr, flush=True)
    raw = _call_model(model, transcript, estimated)
    print(f"[segmenter] raw LLM output: {raw!r}", file=sys.stderr, flush=True)
    scenes = _try_parse_json(raw)
    if scenes is None:
        raw = _call_model(model, transcript, max_scenes, retry=True)
        print(f"[segmenter] retry LLM output: {raw!r}", file=sys.stderr, flush=True)
        scenes = _try_parse_json(raw)
    if scenes is None:
        print("[segmenter] JSON parse failed twice, using fallback", file=sys.stderr, flush=True)
        scenes = _fallback_split(transcript)
    scenes = scenes[:estimated]
    result = [
        {
            "index": i,
            "prompt_en": s["prompt_en"],
            "caption_no": s["caption_no"],
        }
        for i, s in enumerate(scenes)
    ]
    for scene in result:
        print(
            f"[segmenter] scene {scene['index']}: prompt_en={scene['prompt_en']!r}"
            f"  caption_no={scene['caption_no']!r}",
            file=sys.stderr,
            flush=True,
        )
    return result


def _estimate_scenes(transcript: str, hard_max: int) -> int:
    """Estimate the appropriate number of scenes from the transcript.

    Splits on sentence boundaries and conjunctions (og/and/then) as a proxy
    for the number of distinct actions. Capped between 1 and hard_max.
    """
    clauses = re.split(
        r"[.!?]"
        r"|\s+og\s+|\s+and\s+|\s+then\s+"
        r"|\s+etterpå\s*|\s+deretter\s*|\s+så\s+|\s+først\s+"
        r"|\s+etter\s+det\s*|\s+til\s+slutt\s*|\s+bagetter\s*",
        transcript.strip(),
        flags=re.IGNORECASE,
    )
    count = len([c for c in clauses if c.strip()])
    return max(1, min(hard_max, count))



def _try_parse_json(text: str) -> list | None:
    """Extract scene dicts from LLM output.

    Handles: clean array, markdown code fences, leading prose, and the common
    failure mode where the model outputs one separate [...] array per scene.
    """
    text = text.strip()
    # Direct parse — ideal case
    try:
        result = json.loads(text)
        if isinstance(result, list):
            return result
    except json.JSONDecodeError:
        pass
    # Collect items from every [...] block — merges one-array-per-scene output
    all_items: list = []
    for match in re.finditer(r"\[.*?\]", text, re.DOTALL):
        try:
            items = json.loads(match.group())
            if isinstance(items, list):
                all_items.extend(items)
        except json.JSONDecodeError:
            pass
    return all_items if all_items else None


def _call_model(model: Llama, transcript: str, max_scenes: int, retry: bool = False) -> str:
    system = _SYSTEM_PROMPT
    if retry:
        system += " You must return ONLY the JSON array, starting with [ and ending with ]."
    if max_scenes == 1:
        user = _DESCRIBE_TEMPLATE.format(transcript=transcript)
    else:
        user = _SEGMENT_TEMPLATE.format(transcript=transcript, max_scenes=max_scenes)
    result = model.create_chat_completion(
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        max_tokens=512,
        temperature=0.1,
    )
    return result["choices"][0]["message"]["content"]


def _fallback_split(transcript: str) -> list[dict]:
    sentences = [s.strip() for s in transcript.split(". ") if s.strip()]
    if not sentences:
        sentences = [transcript]
    return [{"prompt_en": s, "caption_no": s} for s in sentences]
