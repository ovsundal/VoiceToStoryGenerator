---
description: Initialize and verify project setup
---

# Init Project: Setup and Verification

## Steps

### 1. Install Node Dependencies

```bash
npm install
```

Verify no errors in output.

### 2. Set Up Python Environment

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

`requirements.txt` must include:
- `faster-whisper`
- `llama-cpp-python` (with CUDA build if GPU available: `CMAKE_ARGS="-DLLAMA_CUDA=on"`)
- `diffusers`
- `torch` (with CUDA: install from pytorch.org for the correct CUDA version)
- `transformers`
- `Pillow`
- `optimum[quanto]` (for FLUX quantization)

### 3. Download AI Models

Models are large — download once and store in `resources/models/`.

#### faster-whisper large-v3 (~3 GB)
```python
from faster_whisper import WhisperModel
WhisperModel("large-v3")  # downloads to HuggingFace cache on first run
```

Or pre-download to a specific path:
```bash
python -c "from faster_whisper import WhisperModel; WhisperModel('large-v3', download_root='../resources/models/whisper')"
```

#### Llama 3.1 8B GGUF Q4_K_M (~5 GB)
Download from HuggingFace — search `Meta-Llama-3.1-8B-Instruct-GGUF` and download the `Q4_K_M` variant. Place at:
```
resources/models/llama/llama-3.1-8b-instruct-q4_k_m.gguf
```

#### FLUX.1-schnell quantized (~12 GB)
```python
# T5 encoder in int8, transformer in GGUF Q4 — see backend/image_generator.py for loading pattern
```
FLUX weights download automatically via diffusers on first run. Set `HF_HOME` env var to point to `resources/models/flux`.

### 4. Verify Model Paths

Expected structure:
```
resources/
└── models/
    ├── whisper/        # faster-whisper large-v3
    ├── llama/          # llama-3.1-8b-instruct-q4_k_m.gguf
    └── flux/           # FLUX.1-schnell weights
```

### 5. Start Development Server

```bash
npm run dev
```

Expected on startup:
- Electron window opens
- Home screen visible with record button
- No console errors in DevTools (`Ctrl+Shift+I`)

### 6. Verify Core Functionality

- [ ] Electron window opens at correct dimensions
- [ ] Record button visible and clickable
- [ ] Python pipeline spawns without error (check main process console)
- [ ] Streaming progress events reach the renderer (check DevTools)

### 7. Production Build

```bash
npm run build     # Compile TypeScript and bundle
npm run package   # Package into Windows NSIS installer (output: dist/)
```

Python environment and models must be bundled or installer must guide user through setup.

## Project Structure

| Directory | Purpose |
|-----------|---------|
| `electron/` | Electron main process — spawns Python, manages IPC |
| `src/` | React/TypeScript renderer UI |
| `src/preload/` | contextBridge — typed ElectronAPI bridge |
| `backend/` | Python pipeline (transcription, LLM, image generation) |
| `resources/models/` | AI model weights (not committed to git) |
| `dist/` | Build output and installer |
| `tests/` | Playwright E2E tests |
| `backend/tests/` | pytest unit and integration tests |

## Stop Development

Close the window or press `Ctrl+C` in the terminal.
