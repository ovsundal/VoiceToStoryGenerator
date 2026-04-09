# Product Requirements Document
## Story-to-Images: Visual Communication App for Autistic Individuals

**Version:** 2.0
**Date:** 2026-04-09
**Status:** Final (MVP)

---

## 1. Executive Summary

Story-to-Images is a Windows 11 desktop application that lets caregivers speak a story or set of instructions in Norwegian (or English), which is automatically converted into a sequence of simple, autism-optimized cartoon images with Norwegian captions. The entire AI pipeline runs locally — no internet connection required. The app is designed for caregivers, teachers, and parents who need a fast, accessible tool for visual communication with autistic individuals.

---

## 2. Mission

Enable caregivers to produce clear, evidence-based visual instruction sequences in under 2 minutes using only their voice — with zero technical knowledge required and no dependency on cloud services.

---

## 3. Target Users

| User | Description | Key Need |
|---|---|---|
| **Primary operator** | Caregiver, teacher, or parent | Fast, simple tool — no technical setup per use |
| **End viewer** | Autistic individual | Consistent, calm, unambiguous cartoon images |

### End Viewer Visual Requirements (evidence-based)
Based on PECS, Social Stories (Carol Gray), and AAC/Boardmaker standards:
- Flat cartoon style — no photorealism, no shading
- Bold black outlines, simple geometric shapes, plain white background
- Limited color palette (max 5 colors) — no neon/fluorescent
- One action or concept per image — never combined steps
- Consistent visual style across the full sequence
- Short Norwegian captions in bold sans-serif below each image
- Optimal sequence length: 3–8 images

---

## 4. MVP Scope

### In Scope
- [x] Voice recording (Norwegian and English)
- [x] Local speech-to-text transcription (faster-whisper)
- [x] LLM story segmentation into 3–8 scenes (llama-cpp-python)
- [x] Cartoon image generation per scene (FLUX.1-schnell)
- [x] Norwegian caption overlay on each image (Pillow)
- [x] Full-screen image sequence viewer with navigation
- [x] Optional caption review and edit screen before image generation
- [x] Settings screen (max images, language, caption review toggle)
- [x] Processing screen with real-time progress (streaming)
- [x] Cancel button during pipeline execution

### Explicitly Deferred (not in MVP)
- [ ] Story persistence / history — no database, no saved stories
- [ ] Print functionality — deferred to v1.1
- [ ] PDF export
- [ ] Mobile or web version
- [ ] Real-time image generation while speaking
- [ ] Cloud sync or sharing
- [ ] Multi-user accounts
- [ ] Character consistency across images (IP-Adapter / ControlNet)
- [ ] Video output
- [ ] Text input mode (type instead of speak)

---

## 5. User Stories

### Core Flow
- As a caregiver, I want to press a single button and speak, so that I don't need to type anything
- As a caregiver, I want to see progress while the app works, so that I know it hasn't frozen
- As a caregiver, I want to cancel and restart if the result isn't right, so that I'm not stuck
- As a caregiver, I want to optionally edit the Norwegian captions before images are generated, so that I can correct mistranslations
- As a caregiver, I want to navigate the image sequence easily, so that I can show it to the autistic individual at a natural pace

### End Viewer
- As an autistic individual, I want to see one simple image at a time, so that I'm not overwhelmed by information
- As an autistic individual, I want images to look consistent throughout the story, so that I'm not confused by style changes
- As an autistic individual, I want a short Norwegian caption under each image, so that the image meaning is reinforced

### Settings
- As a caregiver, I want to set the maximum number of images (3–8), so that I can match story length to the individual's attention span
- As a caregiver, I want to toggle the caption review screen, so that I can skip it once I trust the output quality

---

## 6. Architecture & Patterns

### Process Model

Two processes — Electron main and Python pipeline — communicate via child process stdout:

```
Electron Main Process (Node.js)
  ├── Spawns Python pipeline as child process
  ├── Reads streaming JSON lines from stdout
  ├── Forwards events to renderer via ipcMain
  └── Manages audio recording (Web Audio API or node-record-lpcm16)

Python Pipeline Process
  ├── faster-whisper  → Norwegian/English transcript
  ├── llama-cpp-python → scene JSON (English prompts + Norwegian captions)
  ├── FLUX.1-schnell   → one PNG per scene
  └── Pillow           → Norwegian caption overlay on each PNG

Renderer Process (React)
  └── Receives IPC events → updates UI state progressively
```

### IPC Pattern
- Renderer → Main: `ipcRenderer.invoke` for commands (start, cancel, record)
- Main → Renderer: `webContents.send` for streaming pipeline events
- Security: `contextBridge` only — no `nodeIntegration`
- Python stdout: newline-delimited JSON (one event object per line)

### Key Design Decisions
- **No FastAPI** — Python runs as a one-shot subprocess per story, not a persistent server. Simpler startup, no port conflicts, no health-check polling.
- **No Ollama** — `llama-cpp-python` loads the GGUF model directly. One Python environment handles all AI.
- **No sharp** — Pillow handles caption overlay inside the Python script. No Node.js image processing dependency.
- **Sequential pipeline** — transcription → segmentation → image generation run in order. No GPU contention: LLM runs on CPU, FLUX on GPU.
- **`PYTHONUNBUFFERED=1`** — must be set when spawning Python or streaming events are batched and delayed.

---

## 7. Tools & Features

### Home Screen
- Large centered "Hold to Record" button (primary action)
- Status text in Norwegian
- Settings gear icon

### Processing Screen
- Linear progress bar
- Stage label in Norwegian: "Transkriberer tale…", "Bryter ned i scener…", "Genererer bilde X av N…"
- Cancel button (kills Python subprocess, returns to Home)

### Caption Review Screen *(toggleable in settings)*
- Editable Norwegian caption per scene (inline text input)
- "Generer bilder" button to proceed to image generation

### Viewer Screen
- Full-screen single image display
- Large Previous / Next navigation arrows
- "Bilde X av N" counter
- Keyboard navigation (left/right arrow keys)
- "Ny historie" button → Home screen

### Settings Screen
- Max images slider: 3–8 (default: 5)
- Caption review toggle (on/off)
- Language preference: Norwegian / English captions
- Model paths (advanced — for users who downloaded models to custom locations)

---

## 8. Technology Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| Electron | Latest stable | Desktop app shell, system access |
| React | 18.x | UI framework |
| TypeScript | 5.x | Type safety |
| electron-vite | Latest | Build tooling, dev server |
| Vitest | Latest | Unit testing |
| @playwright/test | Latest | E2E testing |
| @testing-library/react | Latest | Component testing |
| Biome | Latest | Linting + formatting (replaces ESLint + Prettier) |

### Python Backend
| Technology | Version | Purpose |
|---|---|---|
| Python | 3.11 | Runtime |
| faster-whisper | Latest | Speech-to-text (CTranslate2 backend) |
| llama-cpp-python | Latest | Local LLM inference (GGUF) |
| diffusers | Latest | FLUX.1-schnell image generation |
| torch | 2.x (CUDA) | GPU acceleration for FLUX |
| optimum[quanto] | Latest | FLUX transformer + T5 quantization |
| Pillow | Latest | Caption overlay on generated images |
| pytest | Latest | Python unit testing |
| Ruff | Latest | Python linting + formatting |

### AI Models
| Model | Format | Size | License | Purpose |
|---|---|---|---|---|
| faster-whisper large-v3 | CTranslate2 | ~3 GB | MIT | Speech-to-text |
| Llama 3.1 8B Instruct | GGUF Q4_K_M | ~5 GB | Llama 3.1 Community | Story segmentation |
| FLUX.1-schnell (quantized) | bfloat16 + int8 T5 | ~12 GB | Apache 2.0 | Image generation |
| **Total** | | **~20 GB** | | |

### Packaging
| Tool | Purpose |
|---|---|
| electron-builder | Windows NSIS installer `.exe` |

---

## 9. Security & Configuration

### Electron Security
- `contextBridge` + `preload.ts` — only whitelisted functions exposed to renderer
- `nodeIntegration: false` — renderer has no direct Node.js access
- `webSecurity: true` — default, not disabled

### Model Paths
- Default: `resources/models/{whisper,llama,flux}/`
- Overridable via Settings screen → stored in `electron-store` or `app.getPath('userData')`
- Model directories are excluded from git (`.gitignore`)

### Environment Variables (Python subprocess)
```
PYTHONUNBUFFERED=1      # Required for stdout streaming
HF_HOME=resources/models/flux   # FLUX model cache location
TRANSFORMERS_OFFLINE=1  # Prevent diffusers from making network calls
```

### No Secrets
- No API keys, no auth, no telemetry
- Zero network calls during normal operation (`TRANSFORMERS_OFFLINE=1`)

---

## 10. IPC / Pipeline Protocol

The Python pipeline communicates with Electron via newline-delimited JSON on stdout. Each line is one event.

### Event Schema

```typescript
type PipelineEvent =
  | { event: 'progress'; stage: string; index?: number; total?: number }
  | { event: 'scene'; index: number; caption_no: string; image_path: string }
  | { event: 'done'; scenes: Scene[] }
  | { event: 'error'; message: string }
```

### Event Sequence (happy path)

```
{ "event": "progress", "stage": "transcribing" }
{ "event": "progress", "stage": "segmenting" }
{ "event": "progress", "stage": "generating_image", "index": 1, "total": 5 }
{ "event": "scene", "index": 0, "caption_no": "Vasker hendene", "image_path": "/tmp/scene_0.png" }
{ "event": "progress", "stage": "generating_image", "index": 2, "total": 5 }
{ "event": "scene", "index": 1, "caption_no": "Tørker hendene", "image_path": "/tmp/scene_1.png" }
... (one progress + one scene per image)
{ "event": "done", "scenes": [...] }
```

### Pipeline Entry Point

```bash
python backend/pipeline.py --audio /tmp/recording.wav --output /tmp/story_xyz/
```

### Image Prompt Template

**Positive prefix** (prepended to every scene prompt):
```
flat design cartoon illustration, bold black outlines, simple geometric shapes,
plain white background, no shading, no gradients, no texture,
limited color palette (max 5 colors), one main action visible,
children's book style, clear and unambiguous, large simple figures
```

**Negative prompt** (applied to every scene):
```
realistic, photographic, complex background, busy scene, shading, gradients,
small details, clutter, decorative elements, multiple actions, abstract
```

**LLM segmentation prompt:**
```
You are helping create visual instructions for autistic people.
Break this story into 4-8 discrete steps. Each step describes ONE simple action or scene.
Return JSON array only — no other text:
[
  {
    "prompt_en": "English image description for AI generation (flat cartoon, one action)",
    "caption_no": "Norsk bildetekst, maks 6 ord"
  }
]

Story: {transcript}
```

---

## 11. Success Criteria

### Performance
- [ ] Full pipeline (transcribe + segment + 5 images + captions) completes in under 2 minutes on target hardware
- [ ] UI updates progressively during pipeline — never appears frozen
- [ ] Cancel responds within 1 second

### Quality
- [ ] Generated images consistently match the flat cartoon style across all scenes in a story
- [ ] Norwegian captions render correctly including æ, ø, å
- [ ] LLM segmentation produces valid JSON on first attempt ≥95% of the time for typical caregiver stories

### Usability
- [ ] A non-technical caregiver can complete a full story without instructions
- [ ] App works fully offline after initial model download

### Technical
- [ ] All unit tests pass (Vitest + pytest)
- [ ] E2E Playwright tests cover all 4 screens and the full happy-path flow
- [ ] Biome and Ruff report zero errors
- [ ] TypeScript compiles with zero errors (`tsc --noEmit`)

---

## 12. Implementation Phases

### Phase 1 — Project Foundation
**Goal:** Electron app launches, Python environment is wired up, IPC is working end-to-end with a stub pipeline.

Deliverables:
- `electron-vite` project scaffold with React + TypeScript
- `preload.ts` with `contextBridge` and typed `ElectronAPI`
- `electron/main.ts` — spawns `backend/pipeline.py`, reads streaming stdout, forwards to renderer
- `backend/pipeline.py` — stub that emits fixture events with delays (no models yet)
- `usePipeline` hook in React consuming IPC events
- HomeScreen and ProcessingScreen rendering correctly from fixture data
- `--test-mode` flag working for Playwright E2E
- Vitest + pytest + Playwright configured and passing with stub tests
- Biome + Ruff configured

### Phase 2 — Audio Recording + Transcription
**Goal:** Caregiver can record voice and receive a Norwegian transcript.

Deliverables:
- Audio recording in Electron (via Web Audio API in renderer → IPC → write WAV to temp dir)
- `backend/transcriber.py` — faster-whisper large-v3, Norwegian language forced, `compute_type=int8`
- Pipeline emits `{ event: 'progress', stage: 'transcribing' }` then transcript
- pytest unit tests for transcriber with mocked model
- Manual test: record 10–15 seconds of Norwegian speech, verify transcript quality

### Phase 3 — Segmentation + Image Generation + Captions
**Goal:** Full pipeline produces a complete image sequence from a transcript.

Deliverables:
- `backend/segmenter.py` — llama-cpp-python, Llama 3.1 8B Q4_K_M, `n_gpu_layers=0`, JSON output with retry on parse failure
- `backend/image_generator.py` — FLUX.1-schnell with float8 transformer + int8 T5, loads once, generates per scene
- `backend/caption_renderer.py` — Pillow, NotoSans-Bold.ttf bundled, white bar at bottom, centered Norwegian text
- Caption review screen — optional inline editing before image generation
- pytest unit tests for each module with mocked models
- Performance test: 5 images under 2 minutes on RTX 4090

### Phase 4 — Viewer, Polish, and Packaging
**Goal:** Production-ready app installable on a fresh Windows 11 machine.

Deliverables:
- ViewerScreen — full-screen image display, previous/next navigation, keyboard arrows, image counter
- Settings screen — max images, caption review toggle, language preference
- Norwegian UI strings throughout (all labels, buttons, status messages)
- Full Playwright E2E test suite covering all screens and the happy-path flow
- `electron-builder` NSIS installer packaging
- Python venv + model download documented in installer/README
- Final performance and quality validation

---

## 13. Future Considerations (Post-MVP)

| Feature | Notes |
|---|---|
| **Story persistence** | SQLite via `better-sqlite3` — browse and re-display previous stories |
| **Print / PDF export** | Grid layout (image + caption per cell), A4, system print dialog |
| **Character consistency** | IP-Adapter or ControlNet reference image to keep same character across scenes |
| **Cartoon LoRA** | Fine-tune FLUX on pictogram/PECS-style images for even simpler output |
| **Mobile companion** | Display stories on a tablet — read-only viewer |
| **Text input mode** | Type instead of speak — same pipeline from segmentation onward |
| **Caption LoRA / fine-tuning** | Improve Norwegian caption quality by fine-tuning the LLM on AAC-style text |

---

## 14. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| FLUX generation exceeds 2-minute budget | Medium | FLUX.1-schnell at 4 steps is fast; benchmark early in Phase 3 and drop to fewer scenes or lower resolution if needed |
| LLM produces invalid JSON | Medium | Retry once with explicit JSON-only instruction; fall back to a simple sentence-split heuristic if retry fails |
| Norwegian transcription quality poor | Low | faster-whisper large-v3 has strong Norwegian support; test with actual caregiver speech in Phase 2 |
| Python environment setup complexity for end users | High | Document clearly; consider bundling a portable Python + venv in the installer for v1.1 |
| FLUX model download fails or is corrupted | Low | Validate model checksum on startup; show clear Norwegian error message with download instructions |
| `PYTHONUNBUFFERED` not set → streaming breaks | Low | Enforce in `spawnOptions.env` in main process; covered by E2E tests |
| Norwegian characters (æøå) not rendering in captions | Low | Bundle NotoSans-Bold.ttf; never rely on system fonts |
| GPU VRAM exhaustion (FLUX + other processes) | Low | FLUX quantization targets ~12 GB; RTX 4090 has 24 GB headroom |

---

## 15. Appendix

### Hardware Requirements (minimum recommended)
- NVIDIA GPU with 24 GB VRAM (e.g. RTX 4090)
- 32 GB system RAM
- 60 GB free disk space (models ~20 GB + Python env + generated images)
- Windows 11

### Model Sources
- faster-whisper large-v3: HuggingFace (`guillaumekln/faster-whisper-large-v3` or via `WhisperModel("large-v3")`)
- Llama 3.1 8B GGUF Q4_K_M: HuggingFace (`bartowski/Meta-Llama-3.1-8B-Instruct-GGUF`)
- FLUX.1-schnell: HuggingFace (`black-forest-labs/FLUX.1-schnell`)

### Project Directory Structure
```
story-to-images/
├── electron/               # Electron main process
│   └── main.ts             # App entry, IPC handlers, Python spawn
├── src/                    # React/TypeScript renderer
│   ├── screens/            # HomeScreen, ProcessingScreen, ReviewScreen, ViewerScreen, SettingsScreen
│   ├── hooks/              # usePipeline, useRecorder, useSettings
│   └── preload/            # index.ts — contextBridge + ElectronAPI types
├── backend/                # Python AI pipeline
│   ├── pipeline.py         # Entry point, orchestration, stdout streaming
│   ├── transcriber.py      # faster-whisper
│   ├── segmenter.py        # llama-cpp-python → scene JSON
│   ├── image_generator.py  # FLUX.1-schnell
│   ├── caption_renderer.py # Pillow caption overlay
│   └── tests/              # pytest unit tests
├── tests/
│   ├── e2e/                # Playwright Electron tests
│   ├── unit/               # Vitest React/TS tests
│   └── fixtures/           # sample_story.json, sample_image.png, sample_audio.wav
├── resources/
│   ├── models/             # AI model weights (gitignored)
│   └── fonts/              # NotoSans-Bold.ttf (bundled)
├── biome.json
├── pyproject.toml          # Ruff config + Python project metadata
├── playwright.config.ts
├── vitest.config.ts
└── package.json
```

### Glossary
| Term | Definition |
|---|---|
| PECS | Picture Exchange Communication System — evidence-based AAC methodology |
| AAC | Augmentative and Alternative Communication |
| GGUF | File format for quantized LLM weights (llama.cpp ecosystem) |
| Q4_K_M | 4-bit quantization with K-quant method — good quality/size tradeoff |
| FLUX.1-schnell | Fast variant of Black Forest Labs' FLUX image generation model (Apache 2.0) |
| IPC | Inter-Process Communication — how Electron main and renderer exchange data |
| contextBridge | Electron API for safely exposing main-process functions to the renderer |
| CFG | Classifier-Free Guidance — set to 0.0 for FLUX.1-schnell by design |
