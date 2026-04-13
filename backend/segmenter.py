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

# Norwegian words that have misleading direct English translations.
# Add entries here whenever a word is mistranslated in prompt_en.
_VOCAB_HINTS = (
    " Norwegian vocabulary — use EXACT English descriptions below, never the literal translation:"
    " 'perle'/'perler' = child doing bead pegging (placing small plastic beads on a pegboard), NOT pearls or oysters;"
    " 'sykkeltur' = child riding a bicycle outdoors, NOT skiing or snow;"
    " 'vi' (we) = the whole family together: Emil, Sigurd, their mother and their father — always show ALL FOUR in prompt_en unless the sentence names specific people;"
    " 'mormor' = elderly grandmother; 'morfar' = elderly grandfather — when both appear, show both;"
)

_PERSONA_SUFFIX = (
    " Characters: {personas}. "
    "CRITICAL — when writing prompt_en: replace each character name with their physical description. "
    "Use the EXACT gender from the description — a character described as 'boy' must appear as 'boy' "
    "in prompt_en, NEVER as 'girl'. Never change a character's gender. "
    "Multiple characters of the same gender: write 'two boys', not 'boy and boy'."
)

_DESCRIBE_TEMPLATE = """\
Describe this action as a single cartoon image for autistic individuals.

Return exactly this JSON structure (one object in an array):
[{{"prompt_en": "...", "caption_no": "..."}}]

- prompt_en: who is doing what AND the key setting or object (e.g. "school building", "swimming pool"). Max 15 words. No invented details.
- caption_no: copy the action text in Norwegian as-is.

Example:
Action: "Emil skal på skolen"
Output:
[{{"prompt_en": "boy walking toward a school building", "caption_no": "Emil skal på skolen"}}]

Action: {transcript}"""

_SEGMENT_TEMPLATE = """\
Split the story into scenes — one scene per distinct action that is explicitly stated.

STRICT RULES:
- Only include actions that appear in the text. Never add implied or inferred steps.
- Each scene must describe exactly ONE action. Never combine two actions into one scene.
- Within-sentence connectors like "og til slutt", "og etterpå", "og deretter", "og så" each introduce a NEW separate scene — always split on them.
- Count every distinct action in the story. If there are N actions, produce exactly N scenes (up to {max_scenes}).
- prompt_en: describe who is doing what AND the key setting or object visible (e.g. "school building", "swimming pool", "dinner table", "PlayStation controller"). Max 15 words. No invented details.
- caption_no: copy the relevant words from the story text as-is.

Example:
Story: "Emil skal på skolen. Etterpå skal han på skolefritidsordning. Ja, så skal han spille playstation, og til slutt skal han legge seg."
Output:
[
  {{"prompt_en": "boy walking toward a school building", "caption_no": "Emil skal på skolen"}},
  {{"prompt_en": "boy arriving at afterschool care building", "caption_no": "Etterpå skal han på skolefritidsordning"}},
  {{"prompt_en": "boy sitting on a couch playing PlayStation", "caption_no": "så skal han spille playstation"}},
  {{"prompt_en": "boy lying down in bed", "caption_no": "til slutt skal han legge seg"}}
]

Story: {transcript}"""

_POLISH_TEMPLATE = """\
Rewrite each Norwegian caption. Apply ALL rules to EVERY caption:
1. Remove leading time words: Idag, Etterpå, Senere, Så, Deretter, Først, Etter det
2. Replace pronouns (han, hun, de, dem) with the character's name — use the other captions as context
3. Convert future tense to present tense:
   - "skal [verb]" → conjugate THAT verb, do not substitute a different verb
     e.g. "skal spise" → "spiser"  (NOT "har")
     e.g. "skal svømme" → "svømmer"
     e.g. "skal spille" → "spiller"
   - "skal på [place]" → "er på [place]"  (add "er" when there is no explicit verb)
     e.g. "skal på skolefritidsordning" → "er på skolefritidsordning"
     e.g. "skal på skolen" → "går på skolen"  (skolen is a destination, use "går på")
4. Max 5 words per caption

Input captions (JSON array):
{captions_json}

Return a JSON array of rewritten strings, same order, same length. Nothing else."""


def load_model(model_dir: str = DEFAULT_MODEL_DIR, n_gpu_layers: int = 0) -> Llama:
    """Load the GGUF model. n_gpu_layers=0 means CPU-only (required per PRD).

    n_ctx=4096 — llama.cpp defaults to 512 if not set, which is far too small
    for our prompts (templates + story + JSON output easily exceed 1k tokens).
    """
    from llama_cpp import Llama as _Llama  # noqa: PLC0415

    model_path = Path(model_dir) / _MODEL_FILENAME
    return _Llama(model_path=str(model_path), n_gpu_layers=n_gpu_layers, n_ctx=4096, verbose=False)


def segment(model: Llama, transcript: str, max_scenes: int = 5, personas: list[dict] | None = None) -> list[dict]:
    """Segment a transcript into a list of scene dicts.

    Returns: [{"index": int, "prompt_en": str, "caption_no": str}, ...]

    Retries once on JSON parse failure, then falls back to sentence-split heuristic.
    """
    print(f"[segmenter] input: {transcript!r}", file=sys.stderr, flush=True)
    estimated = _estimate_scenes(transcript, max_scenes)
    print(f"[segmenter] estimated scenes: {estimated}", file=sys.stderr, flush=True)
    raw = _call_model(model, transcript, estimated, personas=personas)
    print(f"[segmenter] raw LLM output: {raw!r}", file=sys.stderr, flush=True)
    scenes = _try_parse_json(raw)
    if scenes is None:
        raw = _call_model(model, transcript, max_scenes, retry=True, personas=personas)
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
    result = _polish_captions(model, result, personas=personas)
    result = _fix_prompt_genders(result, personas)
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
        r"|\s+etter\s+det\s*|\s+til\s+slutt\s*|\s+bagetter\s*|\s+senere\s*",
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


def _call_model(
    model: Llama,
    transcript: str,
    max_scenes: int,
    retry: bool = False,
    personas: list[dict] | None = None,
) -> str:
    system = _SYSTEM_PROMPT + _VOCAB_HINTS
    if personas:
        descriptions = "; ".join(
            f"{p['name']} is {p['description']}" for p in personas
        )
        system += _PERSONA_SUFFIX.format(personas=descriptions)
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
        max_tokens=1024,
        temperature=0.1,
    )
    return result["choices"][0]["message"]["content"]


def _polish_captions(
    model: Llama,
    scenes: list[dict],
    personas: list[dict] | None = None,
) -> list[dict]:
    """Rewrite caption_no fields: present tense, pronoun resolution, strip connectors.

    Makes one focused LLM call with all captions bundled. Falls back to the
    original captions if the model returns an unusable response.
    """
    captions = [s["caption_no"] for s in scenes]
    captions_json = json.dumps(captions, ensure_ascii=False)

    system = (
        "You rewrite Norwegian captions for visual instruction cards. "
        "Return ONLY a valid JSON array of strings. No prose, no code fences."
    )
    if personas:
        descriptions = "; ".join(f"{p['name']} is {p['description']}" for p in personas)
        system += f" Characters: {descriptions}."

    user = _POLISH_TEMPLATE.format(captions_json=captions_json)

    result = model.create_chat_completion(
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        max_tokens=256,
        temperature=0.1,
    )
    raw = result["choices"][0]["message"]["content"]
    print(f"[segmenter] polish raw output: {raw!r}", file=sys.stderr, flush=True)

    try:
        rewritten = json.loads(raw.strip())
        if isinstance(rewritten, list) and len(rewritten) == len(scenes):
            return [
                {**scene, "caption_no": str(rewritten[i])}
                for i, scene in enumerate(scenes)
            ]
    except (json.JSONDecodeError, IndexError):
        pass

    # Try extracting a [...] block if the model added surrounding text
    match = re.search(r"\[.*?\]", raw, re.DOTALL)
    if match:
        try:
            rewritten = json.loads(match.group())
            if isinstance(rewritten, list) and len(rewritten) == len(scenes):
                return [
                    {**scene, "caption_no": str(rewritten[i])}
                    for i, scene in enumerate(scenes)
                ]
        except (json.JSONDecodeError, IndexError):
            pass

    print("[segmenter] caption polish failed, keeping originals", file=sys.stderr, flush=True)
    return scenes


def _fix_prompt_genders(scenes: list[dict], personas: list[dict] | None) -> list[dict]:
    """Safety net: correct misgendered characters in prompt_en.

    Logic: if the caption_no mentions only male personas (and no female ones from
    the known persona list), any 'girl'/'girls' in prompt_en is wrong — replace with
    'boy'/'boys'.  Symmetrically for female-only scenes.

    This catches the common LLM failure of misgendering a known character even when
    the correct gender was in the system prompt.
    """
    if not personas:
        return scenes

    male_names = {
        p["name"].lower()
        for p in personas
        if "boy" in p["description"].lower() or " man" in p["description"].lower()
    }
    female_names = {
        p["name"].lower()
        for p in personas
        if "girl" in p["description"].lower() or "woman" in p["description"].lower()
    }

    for scene in scenes:
        caption_lower = scene["caption_no"].lower()
        has_male_persona = any(n in caption_lower for n in male_names)
        has_female_persona = any(n in caption_lower for n in female_names)

        prompt = scene["prompt_en"]

        if has_male_persona and not has_female_persona:
            # Only male personas in this scene — any "girl" is wrong
            fixed = re.sub(r"\bgirl\b", "boy", prompt, flags=re.IGNORECASE)
            fixed = re.sub(r"\bgirls\b", "boys", fixed, flags=re.IGNORECASE)
        elif has_female_persona and not has_male_persona:
            # Only female personas in this scene — any "boy" is wrong
            fixed = re.sub(r"\bboy\b", "girl", prompt, flags=re.IGNORECASE)
            fixed = re.sub(r"\bboys\b", "girls", fixed, flags=re.IGNORECASE)
        else:
            fixed = prompt

        if fixed != prompt:
            print(
                f"[segmenter] gender fix: {prompt!r} → {fixed!r}",
                file=sys.stderr,
                flush=True,
            )
            scene["prompt_en"] = fixed

    return scenes


def _fallback_split(transcript: str) -> list[dict]:
    sentences = [s.strip() for s in transcript.split(". ") if s.strip()]
    if not sentences:
        sentences = [transcript]
    return [{"prompt_en": s, "caption_no": s} for s in sentences]
