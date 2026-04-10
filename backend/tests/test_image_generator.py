"""Unit tests for backend.image_generator. No real FLUX pipeline is loaded."""

from pathlib import Path

from backend.image_generator import POSITIVE_PREFIX, generate


class _FakeResult:
    def __init__(self):
        from PIL import Image

        self.images = [Image.new("RGB", (512, 512), "white")]


class _FakeFluxPipeline:
    def __init__(self) -> None:
        self.last_call_kwargs: dict = {}

    def __call__(self, prompt: str, **kwargs):
        self.last_call_kwargs = {"prompt": prompt, **kwargs}
        return _FakeResult()


def test_generate_saves_png(tmp_path: Path):
    pipe = _FakeFluxPipeline()
    output_path = str(tmp_path / "scene_0.png")
    generate(pipe, "child washing hands", output_path)
    assert Path(output_path).exists()
    assert Path(output_path).suffix == ".png"


def test_generate_includes_positive_prefix(tmp_path: Path):
    pipe = _FakeFluxPipeline()
    generate(pipe, "child drying hands", str(tmp_path / "out.png"))
    assert pipe.last_call_kwargs["prompt"].startswith("flat design cartoon illustration")


def test_generate_uses_4_steps_and_zero_guidance(tmp_path: Path):
    pipe = _FakeFluxPipeline()
    generate(pipe, "child putting on jacket", str(tmp_path / "out.png"))
    assert pipe.last_call_kwargs["num_inference_steps"] == 4
    assert pipe.last_call_kwargs["guidance_scale"] == 0.0


def test_generate_combines_prefix_and_prompt(tmp_path: Path):
    pipe = _FakeFluxPipeline()
    prompt_en = "child walking out the door"
    generate(pipe, prompt_en, str(tmp_path / "out.png"))
    assert POSITIVE_PREFIX in pipe.last_call_kwargs["prompt"]
    assert prompt_en in pipe.last_call_kwargs["prompt"]


def test_generate_output_is_512x512(tmp_path: Path):
    from PIL import Image

    pipe = _FakeFluxPipeline()
    output_path = str(tmp_path / "out.png")
    generate(pipe, "a child", output_path)
    img = Image.open(output_path)
    assert img.size == (512, 512)
