# Feature: Phase 3 — Segmentation, Image Generation & Caption Review

The following plan should be complete, but validate documentation and codebase patterns before
implementing. Pay special attention to naming of existing utils, types, and models. Import from
the right files.

## Feature Description

Phase 3 wires up the remaining AI pipeline stages: LLM story segmentation (`segmenter.py`),
FLUX.1-schnell image generation (`image_generator.py`), Pillow caption overlay
(`caption_renderer.py`), a new Caption Review screen, and a minimal Viewer screen. After this
phase the full end-to-end flow works: speak or type a story → review Norwegian captions →
see generated cartoon images.

## User Story

As a caregiver
I want to record or type a story, review the auto-generated Norwegian captions, and see a
sequence of autism-optimized cartoon images
So that I can produce visual instructions for an autistic individual without cloud services

## Problem Statement

The Python pipeline is currently stubbed after transcription: segmentation and image generation
emit fixture data with artificial delays. The UI has no Caption Review screen and no Viewer
screen, so the generated image sequence is never surfaced.

## Solution Statement

1. Implement `backend/segmenter.py`, `backend/image_generator.py`, `backend/caption_renderer.py`
2. Split `backend/pipeline.py` into two callable modes: `--segment-only` and `--generate`
3. Add `pipeline:segment` and `pipeline:generate` IPC handlers to `electron/main.ts`
4. Extend `src/preload/index.ts` with new types and IPC calls
5. Add `ReviewScreen` and `ViewerScreen` React components
6. Update `App.tsx` to a 4-screen state machine: `home | processing | review | viewer`

## Feature Metadata

**Feature Type**: New Capability  
**Estimated Complexity**: High  
**Primary Systems Affected**: `backend/`, `electron/main.ts`, `src/preload/`, `src/screens/`, `src/App.tsx`  
**Dependencies**: `llama-cpp-python`, `diffusers`, `torch`, `optimum[quanto]`, `Pillow` (all new to requirements.txt)

---

## CONTEXT REFERENCES

### Relevant Codebase Files — MUST READ BEFORE IMPLEMENTING

- `backend/transcriber.py` (all) — **module structure to mirror exactly** for segmenter.py and
  image_generator.py: lazy imports inside functions, TYPE_CHECKING guard, `DEFAULT_MODEL_DIR`
  constant, pure functions taking a loaded model as first arg
- `backend/pipeline.py` (all) — current `run()` function and `--transcribe-only` mode to extend
  with `--segment-only` and `--generate` modes; `emit()` helper pattern
- `backend/tests/test_transcriber.py` (all) — fake-model class pattern to mirror in new test files
- `backend/tests/conftest.py` (all) — `sample_audio` fixture + `mock_transcriber` autouse fixture
  pattern; new fixtures go here
- `electron/main.ts` (lines 99–309) — IPC handler pattern: `ipcMain.handle`, spawn, stdout buffer,
  newline-delimited JSON, `webContents.send`; `pipeline:transcribe` handler at line 244 is the
  best template for the new two-phase handlers
- `src/preload/index.ts` (all) — `ElectronAPI` interface + `contextBridge.exposeInMainWorld` block
  to extend with new channels
- `src/hooks/usePipeline.ts` (all) — state structure to extend with `segmentedScenes` and
  `segments_ready` event handling
- `src/screens/HomeScreen.tsx` + `HomeScreen.css` — component + CSS pattern to mirror
- `src/screens/ProcessingScreen.tsx` + `ProcessingScreen.css` — reused unchanged; just ensure
  `stageLabels` covers all new stage strings
- `src/App.tsx` (all) — current two-screen state machine to expand to 4 screens
- `tests/unit/setup.ts` (all) — global `window.electronAPI` mock; **must add** new methods here
- `tests/unit/hooks/usePipeline.test.ts` (all) — hook test pattern to extend

### New Files to Create

**Python backend:**
- `backend/segmenter.py` — llama-cpp-python LLM, segment transcript → scene JSON list
- `backend/image_generator.py` — FLUX.1-schnell pipeline, generate PNG per scene
- `backend/caption_renderer.py` — Pillow, add white caption bar below image
- `backend/tests/test_segmenter.py` — unit tests, fake Llama model
- `backend/tests/test_image_generator.py` — unit tests, fake FLUX pipeline
- `backend/tests/test_caption_renderer.py` — unit tests with real Pillow (lightweight)

**Frontend:**
- `src/screens/ReviewScreen.tsx` + `src/screens/ReviewScreen.css`
- `src/screens/ViewerScreen.tsx` + `src/screens/ViewerScreen.css`
- `tests/unit/hooks/useViewer.test.ts` — if a `useViewer` hook is added (optional)

**Fixture:**
- `resources/fonts/NotoSans-Bold.ttf` — **must be downloaded before caption_renderer works**
  (Google Fonts: https://fonts.google.com/specimen/Noto+Sans — download "Bold" weight TTF)

### Relevant Documentation

- llama-cpp-python README: https://github.com/abetlen/llama-cpp-python#readme
  - Section: Basic usage — `Llama(model_path=..., n_gpu_layers=0)`, `__call__` signature
  - Why: Shows how to load GGUF and call with JSON grammar or `response_format`
- diffusers FLUX.1-schnell example: https://huggingface.co/black-forest-labs/FLUX.1-schnell
  - Section: Inference — `FluxPipeline.from_pretrained`, `guidance_scale=0.0`, 4 inference steps
  - Why: CFG=0 is unique to FLUX-schnell; negative prompts have no effect
- optimum-quanto: https://github.com/huggingface/optimum-quanto#readme
  - `quantize(pipe.transformer, weights=qfloat8)` + `freeze(...)` pattern
  - Why: Reduces VRAM from ~24GB to ~12GB so it fits in RTX 4090
- Pillow ImageDraw: https://pillow.readthedocs.io/en/stable/reference/ImageDraw.html
  - `textbbox`, `text`, `ImageFont.truetype` — needed for correct centering of Norwegian text

### Patterns to Follow

**Python module structure** (mirror `backend/transcriber.py`):
```python
from __future__ import annotations
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from <library> import <ModelClass>

DEFAULT_MODEL_DIR = str(Path(__file__).parent.parent / "resources" / "models" / "<subdir>")

def load_model(model_dir: str = DEFAULT_MODEL_DIR) -> ModelClass:
    from <library> import <ModelClass> as _M  # noqa: PLC0415
    return _M(...)

def do_work(model: ModelClass, ...) -> ...:
    ...
```

**`emit()` in pipeline.py**:
```python
def emit(event: str, **data) -> None:
    print(json.dumps({"event": event, **data}), flush=True)
```

**IPC handler in main.ts** (mirror `pipeline:transcribe` at line 244):
```typescript
ipcMain.handle('pipeline:segment', async (_, payload: {...}): Promise<SegmentedScene[]> => {
  return new Promise((resolve, reject) => {
    const proc = spawn(pythonPath, [...args], { env: {...process.env, PYTHONUNBUFFERED: '1'} });
    let buffer = '';
    proc.stdout?.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          if (event.event === 'segments_ready') {
            proc.kill(); // or let it exit naturally
            resolve(event.scenes ?? []);
          } else {
            mainWindow.webContents.send('pipeline:event', event);
          }
        } catch { console.error('Non-JSON:', line); }
      }
    });
    proc.on('close', (code) => { if (code !== 0) reject(new Error(...)); });
  });
});
```

**CSS variables available** (from `src/index.css`):
- `--bg-primary`, `--bg-secondary`, `--text-primary`, `--text-secondary`
- `--accent`, `--accent-hover`, `--border`, `--danger`

**Norwegian UI string convention**: All user-facing text is in Norwegian Bokmål.

**Biome formatting**: Line length 100 (see `biome.json`). No semicolons? Check biome config before writing TS.

**Ruff lint rules**: E, F, I, UP — line length 100, target Python 3.11.

**Pytest markers**: Add `@pytest.mark.slow` to any test that loads a real model.

---

## IMPLEMENTATION PLAN

### Phase A: Python Backend Modules

Implement the three new Python modules plus update `pipeline.py` and `requirements.txt`.
All modules follow the lazy-import / pure-function pattern from `transcriber.py`.

### Phase B: IPC & Types

Add `SegmentedScene` type, new `ElectronAPI` methods, and two new IPC handlers in `main.ts`.
Update `preload/index.ts` and `renderer.d.ts` accordingly.

### Phase C: React Screens & App State Machine

Update `usePipeline` to handle `segments_ready`, add `ReviewScreen` and `ViewerScreen`,
update `App.tsx` to the 4-screen state machine.

### Phase D: Tests & Validation

Add pytest unit tests for all three new backend modules. Update Vitest setup mock.
Update existing pipeline tests for new modes. Add Playwright E2E test for full happy path.

---

## STEP-BY-STEP TASKS

### TASK 1 — CREATE `backend/segmenter.py`

- **IMPLEMENT**: `load_model(model_path, n_gpu_layers=0) → Llama` — lazy import llama-cpp-python
- **IMPLEMENT**: `segment(model, transcript, max_scenes=5) → list[dict]` — calls LLM with the
  segmentation prompt from PRD, parses JSON response; on `json.JSONDecodeError` retries once with
  explicit "Return JSON only, no other text" prefix; on second failure falls back to naive
  sentence-split heuristic (split on `. `, wrap each in `{"prompt_en": s, "caption_no": s}`)
- **IMPLEMENT**: Returns list of dicts: `[{"index": i, "prompt_en": "...", "caption_no": "..."}]`
- **IMPLEMENT**: LLM call: `model(prompt, max_tokens=512, temperature=0.1, stop=["```"])` — use
  `response_format={"type": "json_object"}` if llama-cpp-python version supports it, else parse raw
- **DEFAULT_MODEL_DIR**: `resources/models/llama/`
- **PATTERN**: Exact module structure from `backend/transcriber.py`
- **GOTCHA**: `n_gpu_layers=0` is required (CPU only for LLM per PRD — LLM on CPU, FLUX on GPU)
- **GOTCHA**: The llama-cpp-python `Llama` class takes `model_path` (full file path to `.gguf`),
  not a directory. `DEFAULT_MODEL_DIR` is the directory; the actual file path must be located
  (e.g. `next(Path(model_dir).glob("*.gguf"))`)
- **VALIDATE**: `pytest backend/tests/test_segmenter.py -v`

**Segmentation prompt** (from PRD section 10):
```
You are helping create visual instructions for autistic people.
Break this story into {max_scenes} discrete steps. Each step describes ONE simple action or scene.
Return JSON array only — no other text:
[
  {{
    "prompt_en": "English image description for AI generation (flat cartoon, one action)",
    "caption_no": "Norsk bildetekst, maks 6 ord"
  }}
]

Story: {transcript}
```

---

### TASK 2 — CREATE `backend/image_generator.py`

- **IMPLEMENT**: `load_pipeline(model_dir) → FluxPipeline` — loads FLUX.1-schnell with float8
  transformer quantization + int8 T5 encoder; calls `pipe.enable_model_cpu_offload()`
- **IMPLEMENT**: `generate(pipe, prompt_en, output_path) → None` — runs inference, saves PNG
- **IMPLEMENT**: Positive prompt prefix + generation call (see below)
- **DEFAULT_MODEL_DIR**: `resources/models/flux/` (also used as `HF_HOME` env var)
- **PATTERN**: Lazy imports inside functions, `TYPE_CHECKING` guard for `FluxPipeline`
- **GOTCHA**: FLUX.1-schnell uses `guidance_scale=0.0` — CFG is disabled by design. Negative
  prompts have NO effect and should NOT be passed
- **GOTCHA**: `optimum.quanto` quantize+freeze must happen **after** `from_pretrained` but
  **before** moving to device. Order: load → quantize transformer → quantize T5 → freeze both
  → `enable_model_cpu_offload()`
- **GOTCHA**: `TRANSFORMERS_OFFLINE=1` env var should be set when spawning Python in production
  to prevent network calls; pipeline.py spawns with this var
- **VALIDATE**: `pytest backend/tests/test_image_generator.py -v`

**Generation call**:
```python
POSITIVE_PREFIX = (
    "flat design cartoon illustration, bold black outlines, simple geometric shapes, "
    "plain white background, no shading, no gradients, no texture, "
    "limited color palette (max 5 colors), one main action visible, "
    "children's book style, clear and unambiguous, large simple figures"
)

image = pipe(
    prompt=f"{POSITIVE_PREFIX}, {prompt_en}",
    num_inference_steps=4,
    guidance_scale=0.0,
    height=512,
    width=512,
).images[0]
image.save(output_path)
```

---

### TASK 3 — CREATE `backend/caption_renderer.py`

- **IMPLEMENT**: `render(image_path, caption_no, output_path) → None`
  1. Open image with Pillow: `Image.open(image_path).convert("RGB")`
  2. Extend canvas downward by ~18% of image height (white strip below image — do NOT cover image)
     Use `Image.new("RGB", (w, h + bar_height), "white")` + `paste(original, (0, 0))`
  3. Load `NotoSans-Bold.ttf` from `resources/fonts/NotoSans-Bold.ttf` (relative to this file:
     `Path(__file__).parent.parent / "resources" / "fonts" / "NotoSans-Bold.ttf"`)
  4. Use `ImageFont.truetype(font_path, font_size)` where font_size = `bar_height // 2`
  5. Center text in the white bar using `draw.textbbox((0,0), caption_no, font=font)` to measure
  6. Draw black text centered horizontally and vertically in the white bar
- **GOTCHA**: `draw.textbbox` requires Pillow ≥ 8.0.0. Use `textbbox`, never deprecated `textsize`
- **GOTCHA**: Font file path must be absolute or relative to the Python script, not CWD
- **VALIDATE**: `pytest backend/tests/test_caption_renderer.py -v`

---

### TASK 4 — UPDATE `backend/pipeline.py`

Add two new CLI modes while preserving the existing full-pipeline `run()` for backward compat.

**Add `--segment-only` flag to argparse**:
- When set, runs transcription (if `--audio`) or uses `--text` directly, then runs segmentation
- Emits: `progress(stage='transcribing')`, `progress(stage='loading_model')` (if model load needed),
  `progress(stage='segmenting')`, then `segments_ready(scenes=[...])`
- Exits with code 0

**Add `--generate` flag + `--scenes-file` arg to argparse**:
- `--generate`: flag to indicate image-generation-only mode
- `--scenes-file`: path to JSON file containing `[{index, prompt_en, caption_no}]`
- Reads scenes JSON, loads image generator + caption renderer, emits per-scene events
- Emits: `progress(stage='generating_image', index=i+1, total=N)`, `scene(...)`, `done(...)`

**Update `run()` function** to use real modules instead of stubs:
- Replace the stub `time.sleep` block with real calls to `segmenter.segment()`,
  `image_generator.generate()`, `caption_renderer.render()`
- Keep stub fallback for when models aren't available (guard with `try/except ImportError`)

**Update argparse** — the `--audio`/`--text` exclusive group should accommodate `--segment-only`
and `--generate` flags. New structure:
```
group = parser.add_mutually_exclusive_group(required=True)
group.add_argument('--audio', ...)
group.add_argument('--text', ...)
group.add_argument('--generate', action='store_true', ...)
parser.add_argument('--scenes-file', ...)
parser.add_argument('--output', ...)
parser.add_argument('--segment-only', action='store_true', ...)
parser.add_argument('--transcribe-only', action='store_true', ...)
```

- **VALIDATE**: `pytest backend/tests/test_pipeline.py -v`

---

### TASK 5 — UPDATE `backend/requirements.txt`

Add:
```
llama-cpp-python
diffusers
torch
optimum[quanto]
Pillow
huggingface_hub
tqdm
```

Keep existing entries. Note: `torch` with CUDA requires separate install command
(`pip install torch --index-url https://download.pytorch.org/whl/cu124`); document this in a
comment in requirements.txt.

- **VALIDATE**: `python -c "import llama_cpp; import diffusers; import PIL"` (after venv setup)

---

### TASK 6 — CREATE `backend/tests/test_segmenter.py`

**Mirror** `backend/tests/test_transcriber.py` pattern — fake model class, no real model loading.

Tests to include:
- `test_segment_returns_list_of_dicts` — fake LLM returns valid JSON; verify list length and keys
- `test_segment_retry_on_invalid_json` — first call returns garbage, second returns valid JSON;
  verify retry logic is invoked (use call count on fake model)
- `test_segment_fallback_on_double_failure` — both calls return garbage; verify fallback returns
  non-empty list
- `test_segment_respects_max_scenes` — verify max_scenes param appears in LLM prompt
- `test_segment_indices_are_sequential` — output dicts have `index` 0, 1, 2…

**Fake model pattern**:
```python
class _FakeLlama:
    def __init__(self, response_text: str) -> None:
        self._response = response_text
    def __call__(self, prompt: str, **kwargs):
        return {"choices": [{"text": self._response}]}
```

- **VALIDATE**: `pytest backend/tests/test_segmenter.py -v`

---

### TASK 7 — CREATE `backend/tests/test_image_generator.py`

Tests to include:
- `test_generate_saves_png(tmp_path)` — fake pipeline returns a real 512×512 white PIL Image;
  verify PNG file written to `output_path`
- `test_generate_includes_positive_prefix` — spy on pipe call, verify prompt starts with
  `"flat design cartoon illustration"`
- `test_generate_uses_4_steps_and_zero_guidance` — spy verifies `num_inference_steps=4`,
  `guidance_scale=0.0`

**Fake pipeline pattern**:
```python
from PIL import Image as _PIL

class _FakeFluxPipeline:
    def __call__(self, prompt, **kwargs):
        class _Result:
            images = [_PIL.new("RGB", (512, 512), "white")]
        return _Result()
```

- **VALIDATE**: `pytest backend/tests/test_image_generator.py -v`

---

### TASK 8 — CREATE `backend/tests/test_caption_renderer.py`

Tests to include:
- `test_render_creates_output_file(tmp_path)` — create a 512×512 white PNG as input; call
  `render()`; verify output file exists
- `test_render_extends_canvas_height(tmp_path)` — verify output image height > input height
- `test_render_output_is_valid_png(tmp_path)` — open output with PIL, verify no exception

**GOTCHA**: These tests require `resources/fonts/NotoSans-Bold.ttf` to exist. Either:
1. Mock `ImageFont.truetype` to return a default font, OR
2. Guard the truetype call: `try: font = ImageFont.truetype(...) except OSError: font = ImageFont.load_default()`
   — implement this guard in `caption_renderer.py` itself so tests pass without the font file

**Recommend option 2**: Add font fallback in `caption_renderer.py` so it degrades gracefully.

- **VALIDATE**: `pytest backend/tests/test_caption_renderer.py -v`

---

### TASK 9 — UPDATE `src/preload/index.ts`

Add new type `SegmentedScene` and extend `ElectronAPI` interface with new IPC methods.

```typescript
// Add after Scene interface:
export interface SegmentedScene {
  index: number;
  caption_no: string;
  prompt_en: string;
}

// Add to PipelineProgressEvent union:
// event type 'segments_ready' is NOT needed in PipelineProgressEvent since it's
// returned synchronously from the promise — no renderer-side event needed.
// The main process resolves the ipcMain.handle promise with SegmentedScene[].
```

**Add to `ElectronAPI` interface**:
```typescript
segmentStory: (payload: { audioPath?: string; text?: string }) => Promise<SegmentedScene[]>;
generateImages: (scenes: SegmentedScene[], outputDir: string) => Promise<void>;
getOutputDir: () => Promise<string>;  // main creates temp dir, returns path
```

**Add to `contextBridge.exposeInMainWorld` block**:
```typescript
segmentStory: (payload) => ipcRenderer.invoke('pipeline:segment', payload),
generateImages: (scenes, outputDir) => ipcRenderer.invoke('pipeline:generate', scenes, outputDir),
getOutputDir: () => ipcRenderer.invoke('output:create-dir'),
```

- **VALIDATE**: `npm run typecheck`

---

### TASK 10 — UPDATE `tests/unit/setup.ts`

Add new methods to the global `window.electronAPI` mock:
```typescript
segmentStory: vi.fn().mockResolvedValue([
  { index: 0, caption_no: 'Vasker hendene', prompt_en: 'child washing hands' },
  { index: 1, caption_no: 'Tørker hendene', prompt_en: 'child drying hands' },
]),
generateImages: vi.fn().mockResolvedValue(undefined),
getOutputDir: vi.fn().mockResolvedValue('/tmp/story_test'),
```

- **VALIDATE**: `npm run test:unit`

---

### TASK 11 — UPDATE `electron/main.ts`

Add three new IPC handlers. **Read the existing `pipeline:transcribe` handler (lines 244–298) as the direct template.**

**`output:create-dir`** handler:
```typescript
ipcMain.handle('output:create-dir', async (): Promise<string> => {
  const outputDir = join(app.getPath('temp'), `story_${Date.now()}`);
  await fs.mkdir(outputDir, { recursive: true });
  return outputDir;
});
```

**`pipeline:segment`** handler:
- In test mode: `await new Promise(resolve => setTimeout(resolve, 800))` then return fixture scenes
- Real mode: spawn `python pipeline.py --audio <audioPath> --segment-only` OR
  `--text <text> --segment-only`
- Read stdout, forward `progress` events to renderer via `pipeline:event`, resolve promise when
  `segments_ready` event received
- Emit `pipeline:event` for progress events so `ProcessingScreen` shows stage labels

**`pipeline:generate`** handler:
- In test mode: emit fixture events with delays (mirror `emitFixtureEvents()`)
- Real mode: write scenes JSON to a temp file, spawn
  `python pipeline.py --generate --scenes-file <path> --output <outputDir>`
- Stream `progress`, `scene`, `done`, `error` events to `pipeline:event` exactly like
  existing `pipeline:start` handler (lines 101–147)
- Set `pipelineProcess` so cancel still works

**Update `emitFixtureEvents()`** for test mode `pipeline:segment` — emit a progress event then
resolve immediately (no new fixture function needed; just return the `TEST_FIXTURE_SCENES` without
`image_path` since that comes later).

**Update `electron/main.ts` `pipelineProcess` to also cover `generateImages` process.**

- **VALIDATE**: `npm run typecheck`

---

### TASK 12 — UPDATE `src/hooks/usePipeline.ts`

Add `segmentedScenes` to state and extend with `segment()` and `generateImages()` functions.

```typescript
export interface PipelineState {
  // existing fields...
  segmentedScenes: SegmentedScene[] | null;  // populated after segment() completes
}
```

Add to initial state: `segmentedScenes: null`

Add new callbacks:
```typescript
const segment = useCallback(async (payload: { audioPath?: string; text?: string }) => {
  setState(s => ({ ...s, stage: 'starting', isRunning: true, error: null, segmentedScenes: null }));
  const scenes = await window.electronAPI.segmentStory(payload);
  setState(s => ({ ...s, segmentedScenes: scenes, isRunning: false }));
  return scenes;
}, []);

const generateImages = useCallback(async (scenes: SegmentedScene[], outputDir: string) => {
  setState(s => ({ ...s, stage: 'starting', isRunning: true, error: null, scenes: [] }));
  await window.electronAPI.generateImages(scenes, outputDir);
}, []);
```

Import `SegmentedScene` from `'../preload/index'`.

- **VALIDATE**: `npm run typecheck && npm run test:unit`

---

### TASK 13 — CREATE `src/screens/ReviewScreen.tsx` + `ReviewScreen.css`

**ReviewScreen props**:
```typescript
interface ReviewScreenProps {
  scenes: SegmentedScene[];
  onGenerate: (editedScenes: SegmentedScene[]) => void;
  onCancel: () => void;
}
```

**Implementation**:
- State: `const [captions, setCaptions] = useState<string[]>(() => scenes.map(s => s.caption_no))`
- Render a list of editable caption inputs (one per scene), labelled "Bilde 1", "Bilde 2" etc.
- "Generer bilder" button calls `onGenerate(scenes.map((s, i) => ({ ...s, caption_no: captions[i] })))`
- "Avbryt" button calls `onCancel()`
- `data-testid="review-screen"` on root div
- `data-testid="caption-input-{i}"` on each textarea/input
- `data-testid="generate-button"` on generate button

**CSS** — mirror `HomeScreen.css` structure. Use CSS variables. Layout: centered column,
max-width 600px, scrollable list.

- **VALIDATE**: `npm run typecheck`

---

### TASK 14 — CREATE `src/screens/ViewerScreen.tsx` + `ViewerScreen.css`

**ViewerScreen props**:
```typescript
interface ViewerScreenProps {
  scenes: Scene[];
  onHome: () => void;
}
```

**Implementation**:
- State: `const [currentIndex, setCurrentIndex] = useState(0)`
- Show one image at a time using `<img src={`file://${scenes[currentIndex].image_path}`} />`
- Caption below image: `scenes[currentIndex].caption_no`
- Previous / Next buttons (disabled at boundaries)
- Counter: "Bilde {currentIndex + 1} av {scenes.length}"
- Keyboard navigation: `useEffect` attaches `keydown` listener for `ArrowLeft`/`ArrowRight`
- "Ny historie" button → `onHome()`
- `data-testid="viewer-screen"` on root
- `data-testid="prev-button"`, `data-testid="next-button"`, `data-testid="home-button"`
- `data-testid="image-counter"` on the counter element
- `data-testid="scene-image"` on the `<img>` tag

**GOTCHA**: Electron loads local files via `file://` protocol. Use template literal:
`` `file://${scene.image_path}` `` — not just the raw path.

**CSS**: Full-screen centered layout. Image fills most of the screen. Caption below.
Navigation arrows on left/right sides (or below image). Use CSS variables.

- **VALIDATE**: `npm run typecheck`

---

### TASK 15 — UPDATE `src/App.tsx`

Replace two-screen state machine with four-screen machine.

```typescript
type Screen = 'home' | 'processing' | 'review' | 'viewer'
```

Add state:
```typescript
const [screen, setScreen] = useState<Screen>('home')
const [pendingScenes, setPendingScenes] = useState<SegmentedScene[]>([])
const [outputDir, setOutputDir] = useState<string>('')
const pipeline = usePipeline()
```

**Screen transitions**:
1. **Home → Processing** (segmenting):
   - `onStartSegment(audioPath | text)`: set screen `'processing'`, call `pipeline.segment(payload)`
2. **Processing → Review** (after segmentation complete):
   - Watch `pipeline.segmentedScenes !== null` in `useEffect` → store in `pendingScenes` →
     set screen `'review'`
3. **Review → Processing** (generating):
   - `onGenerate(editedScenes)`: create output dir via `window.electronAPI.getOutputDir()`,
     set `outputDir`, set screen `'processing'`, call `pipeline.generateImages(editedScenes, dir)`
4. **Processing → Viewer** (after generation complete):
   - Watch `pipeline.stage === 'done'` in `useEffect` → set screen `'viewer'`
5. **Viewer → Home**: `onHome()` — reset pipeline state, set screen `'home'`
6. **Review → Home**: `onCancel()` — set screen `'home'`
7. **Any → Home on error**: watch `pipeline.error !== null` → surface error in processing screen
   (ProcessingScreen already shows errors), add "Avbryt" → home

**Render**:
```tsx
{screen === 'home' && (
  <HomeScreen onStartSegment={handleStartSegment} />
)}
{screen === 'processing' && (
  <ProcessingScreen onCancel={handleCancel} onDone={() => {}} />
)}
{screen === 'review' && (
  <ReviewScreen scenes={pendingScenes} onGenerate={handleGenerate} onCancel={handleCancel} />
)}
{screen === 'viewer' && (
  <ViewerScreen scenes={pipeline.scenes} onHome={handleHome} />
)}
```

**Update `HomeScreen` props**: `onStartPipeline` currently takes no args. Change to
`onStartSegment: (payload: { audioPath?: string; text?: string }) => void`. Update
`HomeScreen.tsx` to call `onStartSegment({ text })` on submit and `onStartSegment({ audioPath })`
after recording — **or** keep existing `onStartPipeline` but have `HomeScreen` also call
`window.electronAPI.segmentStory` directly. **Prefer**: pass the payload up through props to
keep HomeScreen testable without knowing about IPC.

- **VALIDATE**: `npm run typecheck && npm run test:unit`

---

### TASK 16 — UPDATE `src/screens/HomeScreen.tsx`

Change `onStartPipeline: () => void` prop to `onStartSegment: (payload: {audioPath?: string; text?: string}) => void`.

- `handleSubmitText`: calls `onStartSegment({ text: text.trim() })`
- `handleRecordClick` (after stop + transcription): calls `onStartSegment({ audioPath })`
  BUT Phase 2 does transcription in the renderer and returns text. For Phase 3, since we want
  to keep transcription in the backend pipeline for the segment flow, we have two options:
  1. After recording, call `segmentStory({ audioPath })` — backend handles transcription + segment
  2. Keep existing "record → transcribe → show in textarea → user submits" flow

  **Recommendation**: Keep the existing Phase 2 flow (record → transcribe → text in textarea →
  user submits text). When user submits, call `onStartSegment({ text })`. This means transcription
  is already done by the time segmentation starts, which is fine. Only call
  `onStartSegment({ audioPath })` if there is no transcription result (fallback).

  Simplest: **always pass `{ text }` from HomeScreen**. The textarea always has the text before
  submission (either typed or filled from transcription). This keeps the HomeScreen behavior
  unchanged and segmentation always receives text.

- **VALIDATE**: `npm run typecheck`

---

### TASK 17 — ADD missing `stageLabels` in `ProcessingScreen.tsx`

Add `loading_model` label if not already present (it is), and ensure all new stage strings
from the segmentation phase are covered:
```typescript
const stageLabels: Record<string, string> = {
  starting: 'Starter…',
  downloading_model: 'Laster ned modell…',
  loading_model: 'Laster inn talemodell…',
  transcribing: 'Transkriberer tale…',
  segmenting: 'Bryter ned i scener…',
  generating_image: 'Genererer bilde',
  done: 'Ferdig!',
};
```

Check current file and add any missing entries.

- **VALIDATE**: `npm run typecheck`

---

### TASK 18 — UPDATE `tests/unit/hooks/usePipeline.test.ts`

Add tests for new hook functions:
- `test('segment calls segmentStory and sets segmentedScenes', ...)`
- `test('generateImages calls generateImages API', ...)`

Mock new API methods in the `beforeEach` block.

- **VALIDATE**: `npm run test:unit`

---

### TASK 19 — CREATE `tests/e2e/viewer.spec.ts`

Full happy-path E2E test in test mode:
```typescript
test('full flow: text input → processing → review → generating → viewer', async () => {
  const { app, page } = await launchApp();

  await page.getByTestId('story-textarea').fill('Nils vasker hendene og tar på seg jakken.');
  await page.getByTestId('submit-text-button').click();

  // processing (segmenting)
  await expect(page.getByTestId('processing-screen')).toBeVisible({ timeout: 3_000 });

  // review screen
  await expect(page.getByTestId('review-screen')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('generate-button')).toBeVisible();

  // proceed to generation
  await page.getByTestId('generate-button').click();
  await expect(page.getByTestId('processing-screen')).toBeVisible({ timeout: 3_000 });

  // viewer
  await expect(page.getByTestId('viewer-screen')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('image-counter')).toContainText('Bilde 1 av');

  // navigate to next image
  await page.getByTestId('next-button').click();
  await expect(page.getByTestId('image-counter')).toContainText('Bilde 2 av');

  // home
  await page.getByTestId('home-button').click();
  await expect(page.getByTestId('record-button')).toBeVisible({ timeout: 3_000 });

  await app.close();
});
```

Also add: `test('cancel on review screen returns to home', ...)`

**GOTCHA**: E2E tests use `--test-mode` which must be updated in `electron/main.ts` to handle
the new `pipeline:segment` and `pipeline:generate` IPC calls. Verify `emitFixtureEvents` and
the test-mode branches of new handlers return fixture data appropriately.

- **VALIDATE**: `npm run test:e2e`

---

### TASK 20 — DOWNLOAD `resources/fonts/NotoSans-Bold.ttf`

The font must be in place for `caption_renderer.py` to work and for E2E tests to pass.

```bash
# Download NotoSans Bold TTF from Google Fonts static CDN
curl -L "https://fonts.gstatic.com/s/notosans/v36/o-0IIpQlx3QUlC5A4PNr5TRA.ttf" \
  -o "resources/fonts/NotoSans-Bold.ttf"
```

Or download manually: https://fonts.google.com/specimen/Noto+Sans → Download family → extract
`NotoSans-Bold.ttf` to `resources/fonts/`.

- **VALIDATE**: `python -c "from PIL import ImageFont; ImageFont.truetype('resources/fonts/NotoSans-Bold.ttf', 24); print('OK')"`

---

## TESTING STRATEGY

### Unit Tests (pytest)

**Each new backend module gets its own test file** mirroring `test_transcriber.py`:
- Fake model/pipeline classes — no disk I/O for models
- Test the pure functions (`segment()`, `generate()`, `render()`) directly
- No `@pytest.mark.slow` needed since models are faked

**pipeline.py tests** — extend `test_pipeline.py`:
- `test_pipeline_segment_only_emits_segments_ready` — check stdout for `segments_ready` event
- `test_pipeline_generate_mode_emits_scene_events` — check stdout for `scene` and `done` events

**conftest.py** — add autouse mocks for `segmenter.load_model` and `image_generator.load_pipeline`
mirroring the existing `mock_transcriber` fixture.

### Unit Tests (Vitest)

Extend `tests/unit/hooks/usePipeline.test.ts` for new segment/generate functions.
All new `window.electronAPI` methods must be in `tests/unit/setup.ts`.

### E2E Tests (Playwright)

`tests/e2e/viewer.spec.ts` covers the full 4-screen happy path.
Existing `tests/e2e/pipeline.spec.ts` — update if existing tests break due to App.tsx screen
changes (the `pipeline.spec.ts` currently expects return to home after done; now it goes to
viewer first).

### Edge Cases

- LLM returns empty JSON array → caption_renderer never called → emit empty `done` event
- LLM parse failure after 2 retries → sentence-split fallback produces at least 1 scene
- Image generation fails mid-sequence → emit `error` event, UI shows error, cancel button works
- Norwegian characters æøå in caption → render correctly with NotoSans-Bold (test explicitly)
- Very long caption (>6 words) → font auto-sizing or text truncation (document behavior)

---

## VALIDATION COMMANDS

### Level 1: Python Lint
```bash
ruff check backend/ --fix
ruff format backend/
```

### Level 2: TypeScript
```bash
npm run typecheck
npm run lint
```

### Level 3: Python Unit Tests
```bash
pytest backend/tests/ -m "not slow" -v
```

### Level 4: JS Unit Tests
```bash
npm run test:unit
```

### Level 5: Build (must compile before E2E)
```bash
npm run build
```

### Level 6: E2E Tests
```bash
npm run test:e2e
```

### Level 7: Full Suite
```bash
npm test && npm run test:e2e
```

### Level 8: Manual Validation (after models downloaded)
1. Launch app: `npm run dev`
2. Type a Norwegian story (10–20 words) in the textarea
3. Click "Generer bilder" — verify processing screen shows segmenting stage
4. Verify caption review screen appears with 3–8 editable Norwegian captions
5. Edit one caption, click "Generer bilder"
6. Verify processing screen shows "Genererer bilde X av N…"
7. Verify viewer screen shows generated images with captions
8. Navigate with Previous/Next buttons and arrow keys
9. Click "Ny historie" — verify return to home

---

## ACCEPTANCE CRITERIA

- [ ] `backend/segmenter.py` segments a transcript into 3–8 scenes with valid JSON on first attempt
- [ ] `backend/segmenter.py` retries once on JSON parse failure, falls back to sentence-split
- [ ] `backend/image_generator.py` generates a 512×512 PNG per scene using FLUX.1-schnell
- [ ] `backend/caption_renderer.py` renders Norwegian captions with NotoSans-Bold.ttf (æøå correct)
- [ ] `pipeline.py --segment-only` emits `segments_ready` event and exits cleanly
- [ ] `pipeline.py --generate` streams `progress`, `scene`, `done` events
- [ ] Caption Review screen shows editable captions, allows editing, submits to generation
- [ ] Viewer screen displays images one at a time, navigates with buttons and arrow keys
- [ ] `App.tsx` state machine: home → processing → review → processing → viewer → home
- [ ] All `pytest backend/tests/ -m "not slow"` tests pass
- [ ] All `npm run test:unit` tests pass
- [ ] `npm run typecheck` zero errors
- [ ] `npm run lint` zero errors
- [ ] `ruff check backend/` zero errors
- [ ] `npm run test:e2e` all tests pass in test mode
- [ ] Existing `pipeline.spec.ts` tests updated and passing

---

## COMPLETION CHECKLIST

- [ ] TASK 1: `backend/segmenter.py` created and tested
- [ ] TASK 2: `backend/image_generator.py` created and tested
- [ ] TASK 3: `backend/caption_renderer.py` created and tested
- [ ] TASK 4: `backend/pipeline.py` updated (new modes, real module calls)
- [ ] TASK 5: `backend/requirements.txt` updated
- [ ] TASK 6: `backend/tests/test_segmenter.py` created
- [ ] TASK 7: `backend/tests/test_image_generator.py` created
- [ ] TASK 8: `backend/tests/test_caption_renderer.py` created
- [ ] TASK 9: `src/preload/index.ts` updated (SegmentedScene, new IPC methods)
- [ ] TASK 10: `tests/unit/setup.ts` updated (new API mocks)
- [ ] TASK 11: `electron/main.ts` updated (3 new IPC handlers)
- [ ] TASK 12: `src/hooks/usePipeline.ts` updated (segment, generateImages, segmentedScenes)
- [ ] TASK 13: `ReviewScreen.tsx` + `ReviewScreen.css` created
- [ ] TASK 14: `ViewerScreen.tsx` + `ViewerScreen.css` created
- [ ] TASK 15: `App.tsx` updated (4-screen state machine)
- [ ] TASK 16: `HomeScreen.tsx` prop updated
- [ ] TASK 17: `ProcessingScreen.tsx` stageLabels verified
- [ ] TASK 18: `usePipeline.test.ts` updated
- [ ] TASK 19: `tests/e2e/viewer.spec.ts` created
- [ ] TASK 20: `resources/fonts/NotoSans-Bold.ttf` downloaded
- [ ] All validation commands pass with zero errors

---

## NOTES

### Two-Phase Pipeline Design Rationale
The pipeline is split into `--segment-only` + `--generate` rather than a single long-running
process with stdin/stdout bidirectional comms. This keeps Python as a simple one-shot subprocess
(per PRD design decision), avoids complexity of stdin handling in Electron, and naturally supports
the caption review pause between phases.

### Test Mode for New IPC Handlers
Both `pipeline:segment` and `pipeline:generate` need `isTestMode` branches in `main.ts` that
return fixture data without spawning Python. The segment test mode should return
`TEST_FIXTURE_SCENES` (without `image_path`), and generate test mode should emit the existing
fixture events with delays (like `emitFixtureEvents` does).

### Phase 4 Readiness
Phase 3 builds a functional but minimal viewer (no keyboard shortcuts polish, no counter styling,
no full-screen mode). Phase 4 adds: Settings screen with captionReview toggle and max-images
slider, viewer polish, NSIS installer packaging. The settings `captionReview` boolean should
be threaded through `App.tsx` state now (default `true`) so Phase 4 only needs to wire it to a
settings screen rather than redesign the flow.

### Model Download Not Part of This Plan
The three AI models (~20 GB total) must be downloaded separately. `segmenter.py` and
`image_generator.py` should check if the model exists and emit a helpful error if not. The
`is_model_cached()` pattern from `transcriber.py` should be mirrored in each new module.

### FLUX.1-schnell CFG=0 Note
FLUX.1-schnell is a distilled model that does not use classifier-free guidance. `guidance_scale`
**must** be `0.0`. Passing a negative prompt is silently ignored. Do not add negative prompt
handling to `image_generator.py` — it would have no effect and would confuse future maintainers.

### Confidence Score: 8/10
High confidence because:
- All integration points are fully mapped from existing code
- IPC pattern is well-established and just being extended
- React component structure mirrors existing screens closely
- Python module structure mirrors `transcriber.py` exactly

Main risks:
- llama-cpp-python JSON parsing behavior may differ by version (mitigated by retry + fallback)
- FLUX quantization API may have changed in latest optimum-quanto (verify before Task 2)
- E2E tests need careful `--test-mode` branch implementation for the new IPC handlers

---

## POST-IMPLEMENTATION FIXES (Session 2026-04-09)

These issues were discovered and fixed after Phase 3 was implemented.

### FIX 1 — Python requirements: llama-cpp-python requires C++ compiler on Windows

**Problem:** `llama-cpp-python` builds from source and requires MSVC (nmake.exe) which is not installed.

**Fix:** `backend/requirements.txt` — use the pre-built Windows wheel directly:
```
https://github.com/abetlen/llama-cpp-python/releases/download/v0.3.19/llama_cpp_python-0.3.19-cp312-cp312-win_amd64.whl
```
This wheel is for Python 3.12 Windows x64. For other platforms, install normally (`pip install llama-cpp-python`).

Also added CUDA PyTorch index:
```
--extra-index-url https://download.pytorch.org/whl/cu128
torch
```

---

### FIX 2 — Python venv: packages installed into system Python, not .venv

**Problem:** `pip install` was run without activating the venv, so packages landed in the system Python. Electron spawns `.venv/Scripts/python.exe` which had no packages.

**Fix:** Always install via `.venv/Scripts/pip.exe` explicitly:
```
backend/.venv/Scripts/pip.exe install -r backend/requirements.txt
```

---

### FIX 3 — electron/main.ts: wrong venv path

**Problem:** All `pythonPath` references in `main.ts` used `'backend', 'venv', 'Scripts', 'python.exe'` (no dot), but the venv is at `backend/.venv/`.

**Fix:** Changed all 5 occurrences to `'backend', '.venv', 'Scripts', 'python.exe'`.

---

### FIX 4 — segmenter.py: no auto-download for Llama model

**Problem:** `load_model()` called `next(Path(model_dir).glob("*.gguf"))` which raises `StopIteration` if no model file exists. No download logic existed.

**Fix:** Added `is_model_cached()` and `download_model()` to `segmenter.py`, mirroring `transcriber.py` exactly. Uses `hf_hub_download` to fetch:
- Repo: `bartowski/Llama-3.2-3B-Instruct-GGUF`
- File: `Llama-3.2-3B-Instruct-Q4_K_M.gguf` (~2GB)
- Saved to: `resources/models/llama/`

`load_model()` now uses `Path(model_dir) / _MODEL_FILENAME` directly instead of glob.

Added `_run_segmentation(text)` helper to `pipeline.py` that checks `is_model_cached()`, downloads if needed, then loads and runs segmentation. Used in both `run()` and `run_segment_only()`.

---

### FIX 5 — image_generator.py: FLUX.1-schnell is a gated model + TRANSFORMERS_OFFLINE blocked download

**Problem:** `TRANSFORMERS_OFFLINE=1` was set in `main.ts` when spawning the generate process, preventing the initial download. Also, FLUX.1-schnell requires accepting terms at huggingface.co/black-forest-labs/FLUX.1-schnell.

**Fix:**
- Removed `TRANSFORMERS_OFFLINE: '1'` from the `pipeline:generate` spawn env in `main.ts`
- Added `is_model_cached()` and `download_model()` to `image_generator.py` (same pattern as transcriber)
- Added `_load_image_pipeline()` helper to `pipeline.py` that checks cache, downloads if needed, emits progress

**User action required:** Accept terms at huggingface.co/black-forest-labs/FLUX.1-schnell and set `HF_TOKEN` in `.env`.

---

### FIX 6 — .env file for HF_TOKEN

**Problem:** No mechanism to pass Hugging Face token to the Python subprocess.

**Fix:**
- Created `.env.sample` at project root with `HF_TOKEN=hf_your_token_here`
- Added `.env.sample` exception to `.gitignore` (`.env` stays ignored)
- Added `loadDotEnv()` function to `electron/main.ts` — reads `.env` from `app.getAppPath()` at startup, injects keys into `process.env` (only if not already set). Python subprocesses inherit `process.env` so `HF_TOKEN` is available automatically.

---

### FIX 7 — ViewerScreen: local images not rendering

**Problem:** `file://${image_path}` URLs don't work when the renderer loads from `http://localhost` (Vite dev server) due to cross-origin security.

**Fix:**
- Registered a custom `localfile://` protocol in `main.ts` using `protocol.registerSchemesAsPrivileged` + `protocol.handle`
- Handler reads the file via `fs.readFile` and returns a `Response` with `content-type: image/png`
- `ViewerScreen.tsx` uses `localfile:///${path.replace(/\/g, '/')}` instead of `file://`

```typescript
// In main.ts, before app.whenReady():
protocol.registerSchemesAsPrivileged([
  { scheme: 'localfile', privileges: { secure: true, standard: true, supportFetchAPI: true } },
]);

// In app.whenReady():
protocol.handle('localfile', async (request) => {
  const filePath = decodeURIComponent(request.url.slice('localfile:///'.length));
  const data = await fs.readFile(filePath);
  return new Response(data, { headers: { 'content-type': 'image/png' } });
});
```

---

### FIX 8 — GPU not used for image generation

**Problem:** `torch` was installed as the CPU-only build (`torch 2.11.0+cpu`). CUDA was unavailable despite the machine having an NVIDIA RTX PRO 1000 Blackwell GPU (8.5GB VRAM, CUDA 13.0 driver).

**Fix:** Reinstalled PyTorch with CUDA 12.8 support (compatible with 13.0 driver):
```
.venv/Scripts/pip.exe install torch --force-reinstall --index-url https://download.pytorch.org/whl/cu128
```

Updated `image_generator.py` `load_pipeline()` to use GPU when available:
```python
if torch.cuda.is_available():
    pipe = pipe.to("cuda")
else:
    pipe.enable_model_cpu_offload()
```

**Hardware context:** NVIDIA RTX PRO 1000 Blackwell Laptop GPU, 8.5GB VRAM, CUDA 13.0, 64GB system RAM, Python 3.12.

---

### KNOWN REMAINING ITEMS

- `torchvision` not installed — causes harmless warnings about `CLIPImageProcessor` fallback. Install with `--index-url https://download.pytorch.org/whl/cu128`.
- `accelerate` not installed — causes slow model loading warning. Install with `pip install accelerate`.
- FLUX.1-schnell download is ~33GB — first run will be slow. Progress is shown via `downloading_model` stage events.
- Plan note in TASK 14: `file://${scene.image_path}` is wrong on Windows — use `localfile:///` protocol (see FIX 7 above).
