"""FLUX.1-schnell image generation with bfloat16 and sequential CPU offload."""

from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from diffusers import FluxPipeline

DEFAULT_MODEL_DIR = str(Path(__file__).parent.parent / "resources" / "models" / "flux")
_MODEL_REPO = "black-forest-labs/FLUX.1-schnell"
_MODEL_CACHE_SUBDIR = "models--black-forest-labs--FLUX.1-schnell"


def is_model_cached(model_dir: str = DEFAULT_MODEL_DIR) -> bool:
    """Return True if the FLUX model snapshot is fully downloaded (no .incomplete blobs)."""
    cache_path = Path(model_dir) / _MODEL_CACHE_SUBDIR
    if not cache_path.exists():
        return False
    blobs_dir = cache_path / "blobs"
    if not blobs_dir.exists():
        return False
    return not any(blobs_dir.glob("*.incomplete"))


def download_model(model_dir: str = DEFAULT_MODEL_DIR, on_progress=None) -> None:
    """Download FLUX.1-schnell via snapshot_download with byte-level progress.

    on_progress is called with an integer 0–99 during the download,
    then once with 100 when complete.
    """
    import threading  # noqa: PLC0415

    from huggingface_hub import HfApi, snapshot_download  # noqa: PLC0415
    from tqdm import tqdm as _BaseTqdm  # noqa: PLC0415

    total_bytes = 33_000_000_000  # ~33 GB fallback estimate
    try:
        api = HfApi()
        info = api.repo_info(_MODEL_REPO, files_metadata=True)
        actual = sum(f.size or 0 for f in info.siblings)
        if actual > 0:
            total_bytes = actual
    except Exception:  # noqa: BLE001
        pass

    _state = {"downloaded": 0, "last_pct": -1}
    _lock = threading.Lock()

    class _ProgressTqdm(_BaseTqdm):
        def __init__(self, *args, **kwargs) -> None:
            kwargs["disable"] = True
            super().__init__(*args, **kwargs)

        def update(self, n: int = 1) -> bool | None:
            result = super().update(n)
            if isinstance(n, (int, float)) and n > 0 and on_progress and total_bytes > 0:
                with _lock:
                    _state["downloaded"] += n
                    pct = min(99, int(100 * _state["downloaded"] / total_bytes))
                    if pct != _state["last_pct"]:
                        _state["last_pct"] = pct
                        on_progress(pct)
            return result

    snapshot_download(
        _MODEL_REPO,
        cache_dir=model_dir,
        tqdm_class=_ProgressTqdm,
    )

    if on_progress:
        on_progress(100)


POSITIVE_PREFIX = (
    "flat design cartoon illustration, bold black outlines, simple geometric shapes, "
    "plain white background, no shading, no gradients, no texture, "
    "limited color palette (max 5 colors), one main action visible, "
    "children's book style, clear and unambiguous, large simple figures"
)


def load_pipeline(model_dir: str = DEFAULT_MODEL_DIR) -> FluxPipeline:
    """Load FLUX.1-schnell with sequential CPU offload (no external quantization).

    optimum.quanto ops (float8 and int8) have no CUDA kernels for Blackwell and
    silently fall back to CPU. We use bfloat16 throughout — natively supported on
    all NVIDIA GPUs — with enable_sequential_cpu_offload so individual transformer
    layers are moved to GPU one at a time. Peak VRAM stays well under 8 GB.
    Requires accelerate.
    """
    import torch  # noqa: PLC0415
    from diffusers import FluxPipeline as _FluxPipeline  # noqa: PLC0415

    pipe = _FluxPipeline.from_pretrained(
        _MODEL_REPO,
        torch_dtype=torch.bfloat16,
        cache_dir=model_dir,
    )
    pipe.enable_sequential_cpu_offload()
    return pipe


def generate(pipe: FluxPipeline, prompt_en: str, output_path: str) -> None:
    """Generate a 512×512 cartoon PNG and save to output_path.

    FLUX.1-schnell uses guidance_scale=0.0 by design — CFG is disabled.
    Negative prompts have no effect and must NOT be passed.
    """
    import sys  # noqa: PLC0415

    full_prompt = f"{POSITIVE_PREFIX}, {prompt_en}"
    print(f"[image_generator] input: {prompt_en!r}", file=sys.stderr, flush=True)
    print(f"[image_generator] full prompt: {full_prompt}", file=sys.stderr, flush=True)
    image = pipe(
        prompt=full_prompt,
        num_inference_steps=2,
        guidance_scale=0.0,
        height=512,
        width=512,
    ).images[0]
    image.save(output_path)
    print(f"[image_generator] output: {output_path}", file=sys.stderr, flush=True)
