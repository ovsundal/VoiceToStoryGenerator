# Feature: Phase 2 — Audio Recording, Transcription, Norwegian UI & App Icon

**STATUS: COMPLETE** — All tasks implemented and validated. See deviations section below.

The following plan should be complete, but validate documentation and codebase patterns before implementing.
Pay special attention to the IPC API changes — `startRecording`/`stopRecording` stubs are replaced by `saveRecording`.
Do NOT start implementing Phase 3 features (segmentation, image generation).

---

## DEVIATIONS FROM ORIGINAL PLAN (implemented post-plan)

### 1. Venv path fix
`backend/.venv/` → `backend/venv/` in `electron/main.ts` (user created venv without the dot).

### 2. `sys.path` fix in `backend/pipeline.py`
When run as a script, Python doesn't include the project root on `sys.path`. Added:
```python
sys.path.insert(0, str(Path(__file__).parent.parent))
```

### 3. Model download progress bar
Added byte-level download progress to the UI. New pipeline stages:
- `downloading_model` — emitted with `pct: 0–100` during first-run model download
- `loading_model` — emitted when model is cached but not yet loaded into memory

`backend/transcriber.py` uses a closure-based `_ProgressTqdm` subclass (inside `download_model()`) that intercepts tqdm byte-level updates and emits JSON events. `ProcessingScreen` shows a determinate progress bar fill when `downloadPct` is set.

`backend/transcriber.py` lazy-imports `tqdm` and `faster_whisper` inside functions so the module loads cleanly in the test environment without those packages installed.

### 4. Transcript-review UX flow (major change)
The original plan had recording → transcription → ProcessingScreen. The actual flow is:

**Record → Transcribe (on HomeScreen) → Transcript appears in textarea → User clicks "Generer bilder" → ProcessingScreen**

This required:

**New `--transcribe-only` flag in `backend/pipeline.py`:**
- Transcribes audio and emits `{"event": "transcript", "text": "..."}` then exits
- `--output` is no longer required when this flag is set

**New IPC handlers in `electron/main.ts`:**
- `pipeline:transcribe` — spawns Python with `--transcribe-only`, forwards `progress` events to `transcription:event` channel, resolves with transcript text
- `pipeline:transcribe-cancel` — kills the transcription subprocess

**New preload API additions (`src/preload/index.ts`):**
```typescript
transcribeAudio: (audioPath: string) => Promise<string>
cancelTranscription: () => Promise<void>
onTranscriptionEvent: (callback) => () => void
```

**`HomeScreen.tsx` recording flow:**
1. "Ta opp fortelling" → starts microphone
2. "Stopp opptak" → saves audio, begins transcription (stays on HomeScreen)
3. Button shows grey **"Avbryt"** — clicking kills the Python process
4. Stage text below button: "Laster ned talemodell… X%" / "Laster inn talemodell…" / "Transkriberer tale…"
5. On success: transcript populates textarea
6. User reviews/edits, clicks "Generer bilder" → navigates to ProcessingScreen

---

## Feature Description

Three deliverables bundled together:
1. **Norwegian headline** — change the English "Story to Images" heading and HTML title to Norwegian.
2. **App icon** — add a taskbar/window icon appropriate for a visual communication app.
3. **Phase 2 core** — real audio recording via Web Audio API in the renderer, audio blob transfer to the main process via IPC, and `backend/transcriber.py` using faster-whisper. The pipeline stubs for segmentation and image generation remain; only transcription becomes real.

## User Story

As a caregiver,
I want to press a button, speak my story in Norwegian, and watch the app transcribe it automatically,
So that I do not need to type anything and the pipeline starts with real speech input.

## Problem Statement

Phase 1 used a hardcoded fixture WAV file and had no real recording or transcription. Phase 2 closes that gap: the record button must start/stop the microphone, save the audio to a temp file, and hand it to `backend/pipeline.py`, which must call faster-whisper to produce a real transcript.

## Solution Statement

- Use the Web Audio API (`navigator.mediaDevices.getUserMedia` + `MediaRecorder`) in the renderer — no native recording packages required.
- On stop, send the recorded audio `ArrayBuffer` to the main process via a new `recording:save` IPC call; main writes it to a temp `.webm` file.
- `backend/transcriber.py` wraps faster-whisper with `language="no"`, `compute_type="int8"` on CPU.
- `backend/pipeline.py` is updated to accept either `--audio` or `--text`; the `--audio` path calls the real transcriber; the `--text` path skips transcription (existing text-input feature).
- Unit tests mock the WhisperModel so no real model download is needed in CI.

## Feature Metadata

**Feature Type**: Enhancement + New Capability  
**Estimated Complexity**: Medium  
**Primary Systems Affected**: HomeScreen, `useRecorder` hook, `electron/main.ts`, `src/preload/index.ts`, `backend/pipeline.py`, new `backend/transcriber.py`  
**Dependencies**: `faster-whisper` (Python, already in PRD), `@resvg/resvg-js` (devDep, SVG→PNG for icon)

---

## CONTEXT REFERENCES

### Relevant Codebase Files — MUST READ BEFORE IMPLEMENTING

- `src/screens/HomeScreen.tsx` (lines 1-68) — current record button; Phase 2 adds recording state machine here
- `src/screens/HomeScreen.css` — add `.recording` pulse animation and button state styles
- `src/index.html` — title tag to update to Norwegian
- `tests/e2e/home.spec.ts` (line 25) — title assertion must be updated to match new Norwegian title
- `electron/main.ts` (lines 98-142, 232-239) — `pipeline:start` handler (fix empty `--audio` arg and missing `--output`); replace `recording:start`/`recording:stop` stubs with real `recording:save`
- `src/preload/index.ts` — `ElectronAPI` interface; replace `startRecording`/`stopRecording` with `saveRecording(data: ArrayBuffer): Promise<string>`
- `src/hooks/usePipeline.ts` — reference for hook patterns; `useRecorder` mirrors this structure
- `tests/unit/setup.ts` — global `window.electronAPI` mock; must add `saveRecording`, remove `startRecording`/`stopRecording`
- `tests/unit/hooks/usePipeline.test.ts` — reference for Vitest hook test patterns with `renderHook` + `act`
- `backend/pipeline.py` — stub pipeline to update; add `--text` arg to Python argparse, call real transcriber for `--audio`
- `backend/tests/conftest.py` — add `mock_transcriber` autouse fixture
- `backend/tests/test_pipeline.py` — existing tests call `run(audio_path=..., output_dir=...)`; new signature is `run(audio_path, text, output_dir)`, update call sites
- `backend/requirements.txt` — add `faster-whisper`
- `pyproject.toml` — Ruff config reference (line-length=100, target-version=py311)

### New Files to Create

- `src/hooks/useRecorder.ts` — MediaRecorder hook with `idle | recording | saving` states
- `backend/transcriber.py` — faster-whisper wrapper with `load_model()` and `transcribe()` functions
- `backend/tests/test_transcriber.py` — pytest unit tests for transcriber (mocked model)
- `tests/unit/hooks/useRecorder.test.ts` — Vitest tests for the recorder hook
- `resources/icons/icon.svg` — app icon SVG source
- `resources/icons/icon.png` — rasterized PNG (1024×1024) generated from SVG
- `scripts/build-icon.mjs` — one-time script that converts icon.svg → icon.png using `@resvg/resvg-js`

### Relevant Documentation — READ BEFORE IMPLEMENTING

- faster-whisper API: https://github.com/SYSTRAN/faster-whisper — `WhisperModel(model_size, device, compute_type, download_root)` and `model.transcribe(audio_path, language=)`
- MediaRecorder API: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder — `ondataavailable`, `onstop`, `mimeType`
- Electron `app.getPath('temp')`: https://www.electronjs.org/docs/latest/api/app#appgetpathname — temp dir for audio file storage

### Patterns to Follow

**IPC invoke/handle pattern** (from `electron/main.ts:98-142` and `src/preload/index.ts:29-44`):
```typescript
// preload: expose via contextBridge
saveRecording: (data: ArrayBuffer) => ipcRenderer.invoke('recording:save', data),

// main: handle with ipcMain
ipcMain.handle('recording:save', async (_, data: ArrayBuffer): Promise<string> => {
  const audioPath = join(app.getPath('temp'), `recording_${Date.now()}.webm`);
  await fs.writeFile(audioPath, Buffer.from(data));
  return audioPath;
});
```

**Hook state pattern** (mirror `usePipeline.ts`):
```typescript
const [state, setState] = useState<RecorderState>('idle');
const someRef = useRef<SomeType | null>(null);
const action = useCallback(async () => { ... }, []);
return { state, start, stop };
```

**pytest mock pattern** (from `SKILL.md` + existing `conftest.py`):
```python
@pytest.fixture(autouse=True)
def mock_transcriber(monkeypatch):
    monkeypatch.setattr("backend.transcriber.load_model", lambda *a, **kw: _FakeWhisper())
    monkeypatch.setattr("backend.transcriber.transcribe",
                        lambda model, path, **kw: "Barnet vasker hendene og tørker seg.")
```

**emit() pattern** (from `backend/pipeline.py:8-9`):
```python
def emit(event: str, **data) -> None:
    print(json.dumps({"event": event, **data}), flush=True)
```

**Naming conventions:**
- Python: `snake_case` for functions/vars, `UPPER_CASE` for module-level constants
- TypeScript: `camelCase` for functions/variables, `PascalCase` for types/interfaces
- CSS classes: `kebab-case`
- `data-testid`: `kebab-case`

---

## IMPLEMENTATION PLAN

### Phase A: Quick UI Changes (Norwegian + Icon)

Foundational changes with no logic impact. Do these first so they don't conflict with the recording work.

### Phase B: IPC Layer Changes

Update the contract between renderer and main process: new `saveRecording` replaces old recording stubs, and the `pipeline:start` handler is fixed to pass real args to Python.

### Phase C: Renderer — Recording Hook + HomeScreen

Implement `useRecorder`, update HomeScreen to use it, update test mocks.

### Phase D: Python Backend — Transcriber

Create `backend/transcriber.py`, update `pipeline.py`, update tests.

---

## STEP-BY-STEP TASKS

### Task 1: UPDATE `src/index.html` — Norwegian page title

- **CHANGE**: `<title>Story to Images</title>` → `<title>Fortelling til bilder</title>`
- **VALIDATE**: `grep -n "Fortelling til bilder" src/index.html`

---

### Task 2: UPDATE `src/screens/HomeScreen.tsx` — Norwegian headline

- **CHANGE**: `<h1 className="home-title">Story to Images</h1>` → `<h1 className="home-title">Fortelling til bilder</h1>`
- **VALIDATE**: `grep -n "Fortelling til bilder" src/screens/HomeScreen.tsx`

---

### Task 3: UPDATE `tests/e2e/home.spec.ts` — fix title assertion

- **CHANGE** line 25: `expect(title).toBe('Story to Images')` → `expect(title).toBe('Fortelling til bilder')`
- **VALIDATE**: `grep -n "Fortelling til bilder" tests/e2e/home.spec.ts`

---

### Task 4: CREATE `resources/icons/icon.svg` — app icon source

- **IMPLEMENT**: Write an SVG icon (512×512 viewBox) depicting a microphone on the left with an arrow pointing right toward a 2×2 grid of small image frames. Use the app's accent blue `#0066cc` as the primary color, white fill for image frames, black outlines. Keep shapes bold and simple (no fine detail). This icon represents "voice → images" at a glance.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <!-- Background -->
  <rect width="512" height="512" rx="96" fill="#0066cc"/>
  <!-- Microphone body -->
  <rect x="180" y="100" width="72" height="140" rx="36" fill="white"/>
  <!-- Microphone arc -->
  <path d="M148 230 Q148 310 216 310 Q284 310 284 230" fill="none" stroke="white" stroke-width="16" stroke-linecap="round"/>
  <!-- Microphone stand -->
  <line x1="216" y1="310" x2="216" y2="350" stroke="white" stroke-width="16" stroke-linecap="round"/>
  <line x1="180" y1="350" x2="252" y2="350" stroke="white" stroke-width="16" stroke-linecap="round"/>
  <!-- Arrow -->
  <path d="M296 256 L336 256 M320 236 L340 256 L320 276" fill="none" stroke="white" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- Image grid: 4 frames -->
  <rect x="352" y="140" width="76" height="76" rx="10" fill="white" opacity="0.9"/>
  <rect x="440" y="140" width="76" height="76" rx="10" fill="white" opacity="0.9"/>
  <rect x="352" y="228" width="76" height="76" rx="10" fill="white" opacity="0.9"/>
  <rect x="440" y="228" width="76" height="76" rx="10" fill="white" opacity="0.9"/>
  <!-- Mountain pictogram inside each frame (simple) -->
  <path d="M362 202 L390 165 L418 202 Z" fill="#0066cc" opacity="0.4"/>
  <path d="M450 202 L478 165 L506 202 Z" fill="#0066cc" opacity="0.4"/>
  <path d="M362 290 L390 253 L418 290 Z" fill="#0066cc" opacity="0.4"/>
  <path d="M450 290 L478 253 L506 290 Z" fill="#0066cc" opacity="0.4"/>
</svg>
```

- **VALIDATE**: File exists at `resources/icons/icon.svg`

---

### Task 5: INSTALL `@resvg/resvg-js` devDependency

- **RUN**: `npm install --save-dev @resvg/resvg-js`
- **VALIDATE**: `node -e "require('@resvg/resvg-js')" && echo OK`

---

### Task 6: CREATE `scripts/build-icon.mjs` — SVG→PNG conversion script

- **IMPLEMENT**: Node script that reads `resources/icons/icon.svg`, renders to PNG at 1024×1024, writes `resources/icons/icon.png`

```javascript
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = join(__dirname, '../resources/icons/icon.svg');
const outPath = join(__dirname, '../resources/icons/icon.png');

mkdirSync(dirname(outPath), { recursive: true });
const svg = readFileSync(svgPath, 'utf-8');
const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1024 } });
const pngData = resvg.render();
writeFileSync(outPath, pngData.asPng());
console.log('Icon written to', outPath);
```

- **RUN**: `node scripts/build-icon.mjs`
- **VALIDATE**: `ls resources/icons/icon.png`

---

### Task 7: UPDATE `electron/main.ts` — wire icon + fix pipeline args + real recording:save

This is the largest main-process change. Make all three changes in one edit to avoid partial states.

**7a — Add `icon` to BrowserWindow:**
```typescript
import { promises as fs } from 'node:fs';  // add at top with other imports

mainWindow = new BrowserWindow({
  width: 1280,
  height: 800,
  minWidth: 800,
  minHeight: 600,
  icon: join(app.getAppPath(), 'resources', 'icons', 'icon.png'),  // ADD THIS LINE
  webPreferences: {
    preload: join(__dirname, '../preload/index.js'),
    nodeIntegration: false,
    contextIsolation: true,
  },
});
```

**7b — Fix `pipeline:start` to pass real `audioPath` and `--output`:**

Replace the real (non-test-mode) spawn block:
```typescript
ipcMain.handle('pipeline:start', async (_, audioPath: string) => {
  if (isTestMode) {
    emitFixtureEvents();
    return;
  }

  if (pipelineProcess) return;

  const pythonPath = join(app.getAppPath(), 'backend', '.venv', 'Scripts', 'python.exe');
  const scriptPath = join(app.getAppPath(), 'backend', 'pipeline.py');
  const outputDir = join(app.getPath('temp'), `story_${Date.now()}`);
  await fs.mkdir(outputDir, { recursive: true });

  pipelineProcess = spawn(pythonPath, [scriptPath, '--audio', audioPath, '--output', outputDir], {
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
  });
  // ... rest of stdout/stderr/close handlers unchanged
```

**7c — Fix `pipeline:start-with-text` to add `--output`:**

In the real (non-test-mode) branch:
```typescript
  const outputDir = join(app.getPath('temp'), `story_${Date.now()}`);
  await fs.mkdir(outputDir, { recursive: true });

  pipelineProcess = spawn(pythonPath, [scriptPath, '--text', _text, '--output', outputDir], {
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
  });
```

**7d — Replace recording stubs with real `recording:save`:**

Remove:
```typescript
// Stubs for Phase 2
ipcMain.handle('recording:start', async () => '/tmp/recording_stub.wav');
ipcMain.handle('recording:stop', async () => '/tmp/recording_stub.wav');
```

Add:
```typescript
ipcMain.handle('recording:save', async (_, data: ArrayBuffer): Promise<string> => {
  const audioPath = join(app.getPath('temp'), `recording_${Date.now()}.webm`);
  await fs.writeFile(audioPath, Buffer.from(data));
  return audioPath;
});
```

- **VALIDATE**: `npm run typecheck`

---

### Task 8: UPDATE `src/preload/index.ts` — replace recording stubs with saveRecording

**CHANGE** the `ElectronAPI` interface:
- Remove `startRecording: () => Promise<string>;`
- Remove `stopRecording: () => Promise<string>;`
- Add `saveRecording: (data: ArrayBuffer) => Promise<string>;`

**CHANGE** the `contextBridge.exposeInMainWorld` object:
- Remove `startRecording: () => ipcRenderer.invoke('recording:start'),`
- Remove `stopRecording: () => ipcRenderer.invoke('recording:stop'),`
- Add `saveRecording: (data: ArrayBuffer) => ipcRenderer.invoke('recording:save', data),`

- **VALIDATE**: `npm run typecheck`

---

### Task 9: UPDATE `tests/unit/setup.ts` — update global electronAPI mock

**CHANGE**: Replace `startRecording` and `stopRecording` mocks with `saveRecording`:
```typescript
Object.defineProperty(window, 'electronAPI', {
  writable: true,
  value: {
    startPipeline: vi.fn().mockResolvedValue(undefined),
    startPipelineWithText: vi.fn().mockResolvedValue(undefined),
    cancelPipeline: vi.fn().mockResolvedValue(undefined),
    onPipelineEvent: vi.fn().mockReturnValue(() => {}),
    saveRecording: vi.fn().mockResolvedValue('/tmp/audio.webm'),
  },
});
```

- **VALIDATE**: `npm run test:unit`

---

### Task 10: UPDATE `tests/unit/hooks/usePipeline.test.ts` — fix beforeEach mock

The `beforeEach` block in this file has its own local `window.electronAPI` assignment (lines 8-16) that overrides the global setup. Update it to match the new interface:

**CHANGE** `beforeEach`:
```typescript
beforeEach(() => {
  window.electronAPI = {
    startPipeline: vi.fn().mockResolvedValue(undefined),
    startPipelineWithText: vi.fn().mockResolvedValue(undefined),
    cancelPipeline: vi.fn().mockResolvedValue(undefined),
    onPipelineEvent: vi.fn().mockReturnValue(() => {}),
    saveRecording: vi.fn().mockResolvedValue('/tmp/audio.webm'),
  };
});
```

- **VALIDATE**: `npm run test:unit`

---

### Task 11: CREATE `src/hooks/useRecorder.ts` — MediaRecorder hook

```typescript
import { useCallback, useRef, useState } from 'react';

export type RecorderState = 'idle' | 'recording' | 'saving';

export interface UseRecorderResult {
  recorderState: RecorderState;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string>;
}

export function useRecorder(): UseRecorderResult {
  const [recorderState, setRecorderState] = useState<RecorderState>('idle');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async (): Promise<void> => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    mediaRecorderRef.current = recorder;
    recorder.start(100);
    setRecorderState('recording');
  }, []);

  const stopRecording = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder) {
        reject(new Error('No active recording'));
        return;
      }
      setRecorderState('saving');
      recorder.onstop = async () => {
        try {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
          const arrayBuffer = await blob.arrayBuffer();
          const audioPath = await window.electronAPI.saveRecording(arrayBuffer);
          recorder.stream.getTracks().forEach((t) => t.stop());
          setRecorderState('idle');
          resolve(audioPath);
        } catch (err) {
          setRecorderState('idle');
          reject(err);
        }
      };
      recorder.stop();
    });
  }, []);

  return { recorderState, startRecording, stopRecording };
}
```

- **VALIDATE**: `npm run typecheck`

---

### Task 12: UPDATE `src/screens/HomeScreen.tsx` — real recording state machine

The component needs three button states and uses `useRecorder`.

```tsx
import { useState } from 'react';
import { useRecorder } from '../hooks/useRecorder';
import './HomeScreen.css';

interface HomeScreenProps {
  onStartPipeline: () => void;
}

export function HomeScreen({ onStartPipeline }: HomeScreenProps) {
  const [text, setText] = useState('');
  const { recorderState, startRecording, stopRecording } = useRecorder();

  const handleRecordClick = async () => {
    if (recorderState === 'idle') {
      await startRecording();
    } else if (recorderState === 'recording') {
      const audioPath = await stopRecording();
      onStartPipeline();
      window.electronAPI.startPipeline(audioPath);
    }
  };

  const handleSubmitText = () => {
    if (!text.trim()) return;
    onStartPipeline();
    window.electronAPI.startPipelineWithText(text.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSubmitText();
    }
  };

  const recordButtonLabel =
    recorderState === 'idle'
      ? 'Ta opp fortelling'
      : recorderState === 'recording'
        ? 'Stopp opptak'
        : 'Lagrer…';

  return (
    <div className="home-screen">
      <h1 className="home-title">Fortelling til bilder</h1>

      <button
        className={`record-button ${recorderState === 'recording' ? 'record-button--recording' : ''}`}
        data-testid="record-button"
        onClick={handleRecordClick}
        disabled={recorderState === 'saving'}
        type="button"
      >
        {recorderState === 'recording' && <span className="record-indicator" aria-hidden="true" />}
        {recordButtonLabel}
      </button>

      <div className="divider">
        <span className="divider-text">eller skriv</span>
      </div>

      <div className="text-input-section">
        <textarea
          className="story-textarea"
          data-testid="story-textarea"
          placeholder="Skriv fortellingen her…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={5}
        />
        <button
          className="submit-text-button"
          data-testid="submit-text-button"
          onClick={handleSubmitText}
          disabled={!text.trim()}
          type="button"
        >
          Generer bilder
        </button>
      </div>
    </div>
  );
}
```

- **VALIDATE**: `npm run typecheck`

---

### Task 13: UPDATE `src/screens/HomeScreen.css` — recording pulse animation

Add below the existing `.record-button:active` rule:

```css
.record-button--recording {
  background: var(--danger);
  display: flex;
  align-items: center;
  gap: 12px;
}

.record-button--recording:hover {
  background: #a31c00;
}

.record-indicator {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: white;
  animation: pulse 1s ease-in-out infinite;
  flex-shrink: 0;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.85); }
}
```

- **VALIDATE**: `npm run lint`

---

### Task 14: CREATE `tests/unit/hooks/useRecorder.test.ts`

```typescript
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { useRecorder } from '../../../src/hooks/useRecorder';

// Minimal MediaRecorder mock
function makeFakeMediaRecorder(mimeType = 'audio/webm') {
  return {
    start: vi.fn(),
    stop: vi.fn(function (this: typeof fakeRecorder) {
      // Simulate onstop firing asynchronously
      setTimeout(() => this.onstop?.(), 0);
    }),
    ondataavailable: null as ((e: { data: { size: number } }) => void) | null,
    onstop: null as (() => void) | null,
    mimeType,
    stream: { getTracks: () => [{ stop: vi.fn() }] },
  };
}

let fakeRecorder: ReturnType<typeof makeFakeMediaRecorder>;

beforeEach(() => {
  fakeRecorder = makeFakeMediaRecorder();

  Object.defineProperty(global.navigator, 'mediaDevices', {
    writable: true,
    value: {
      getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }),
    },
  });

  global.MediaRecorder = vi.fn().mockImplementation(() => fakeRecorder) as unknown as typeof MediaRecorder;

  global.Blob = vi.fn().mockImplementation(() => ({
    arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
  })) as unknown as typeof Blob;

  window.electronAPI.saveRecording = vi.fn().mockResolvedValue('/tmp/recording_123.webm');
});

describe('useRecorder', () => {
  test('initial state is idle', () => {
    const { result } = renderHook(() => useRecorder());
    expect(result.current.recorderState).toBe('idle');
  });

  test('startRecording sets state to recording', async () => {
    const { result } = renderHook(() => useRecorder());
    await act(async () => {
      await result.current.startRecording();
    });
    expect(result.current.recorderState).toBe('recording');
    expect(fakeRecorder.start).toHaveBeenCalledWith(100);
  });

  test('stopRecording transitions to saving then idle and returns path', async () => {
    const { result } = renderHook(() => useRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    let audioPath: string | undefined;
    await act(async () => {
      audioPath = await result.current.stopRecording();
    });

    await waitFor(() => expect(result.current.recorderState).toBe('idle'));
    expect(audioPath).toBe('/tmp/recording_123.webm');
    expect(window.electronAPI.saveRecording).toHaveBeenCalled();
  });
});
```

- **VALIDATE**: `npm run test:unit`

---

### Task 15: CREATE `backend/transcriber.py`

```python
"""Speech-to-text transcription using faster-whisper."""

from pathlib import Path

from faster_whisper import WhisperModel

DEFAULT_MODEL_DIR = str(Path(__file__).parent.parent / "resources" / "models" / "whisper")


def load_model(model_dir: str = DEFAULT_MODEL_DIR) -> WhisperModel:
    """Load the faster-whisper large-v3 model. Download if not cached."""
    return WhisperModel(
        "large-v3",
        device="cpu",
        compute_type="int8",
        download_root=model_dir,
    )


def transcribe(model: WhisperModel, audio_path: str, language: str = "no") -> str:
    """Transcribe an audio file and return the full text.

    Args:
        model: Loaded WhisperModel instance.
        audio_path: Path to audio file (WAV, WebM, MP3, etc.).
        language: BCP-47 language code. "no" = Norwegian Bokmål.
    """
    segments, _ = model.transcribe(audio_path, language=language)
    return " ".join(segment.text.strip() for segment in segments)
```

- **VALIDATE**: `python -c "import backend.transcriber; print('OK')"`

---

### Task 16: UPDATE `backend/pipeline.py` — add --text support + real transcription

Replace the entire file:

```python
"""Pipeline orchestration. Phase 2: real transcription; Phase 3 stubs for segmentation/images."""

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


def run(audio_path: str | None, text: str | None, output_dir: str) -> None:
    if text:
        # Text-input path: skip transcription
        emit("progress", stage="segmenting")
    else:
        # Audio path: run real transcription
        emit("progress", stage="transcribing")
        from backend.transcriber import load_model, transcribe  # noqa: PLC0415

        model = load_model()
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
    parser.add_argument("--output", required=True, help="Directory for output images")
    args = parser.parse_args()
    run(audio_path=args.audio, text=args.text, output_dir=args.output)
```

- **GOTCHA**: The `noqa: PLC0415` comment suppresses Ruff's "import not at top of file" warning for the deferred import (intentional to avoid loading the model when running with `--text`).
- **VALIDATE**: `python -m pytest backend/tests/ -m "not slow" -v`

---

### Task 17: UPDATE `backend/requirements.txt` — add faster-whisper

```
faster-whisper
pytest>=8.0
pytest-mock>=3.14
ruff>=0.6
```

- **VALIDATE**: File updated with `faster-whisper` on its own line

---

### Task 18: UPDATE `backend/tests/conftest.py` — add mock_transcriber autouse fixture

```python
from pathlib import Path

import pytest


@pytest.fixture
def sample_audio(tmp_path: Path) -> str:
    """Copy the test WAV fixture to a temp directory and return its path."""
    src = Path("tests/fixtures/sample_audio.wav")
    dst = tmp_path / "audio.wav"
    dst.write_bytes(src.read_bytes())
    return str(dst)


@pytest.fixture(autouse=True)
def mock_transcriber(monkeypatch):
    """Prevent real faster-whisper model loading in all unit tests."""
    monkeypatch.setattr(
        "backend.transcriber.load_model",
        lambda *a, **kw: None,
    )
    monkeypatch.setattr(
        "backend.transcriber.transcribe",
        lambda model, path, **kw: "Barnet vasker hendene og tørker seg.",
    )
```

- **VALIDATE**: `python -m pytest backend/tests/ -m "not slow" -v`

---

### Task 19: UPDATE `backend/tests/test_pipeline.py` — update run() call signatures

The `run()` function now has three parameters: `audio_path`, `text`, `output_dir`. Update all three call sites:

```python
# test_pipeline_emits_progress_and_scene_events
run(audio_path=sample_audio, text=None, output_dir=str(tmp_path))

# test_pipeline_stub_scenes_are_valid — no run() call, unchanged

# test_pipeline_emits_correct_json_lines
run(audio_path=sample_audio, text=None, output_dir=str(tmp_path))
```

Also add a test for the `--text` path:
```python
def test_pipeline_text_path_skips_transcription(tmp_path: Path, capsys) -> None:
    run(audio_path=None, text="Barnet vasker hendene.", output_dir=str(tmp_path))
    captured = capsys.readouterr()
    lines = [json.loads(line) for line in captured.out.strip().splitlines() if line.strip()]
    event_types = [e["event"] for e in lines]
    # 'transcribing' stage must NOT appear when text is provided
    progress_stages = [e.get("stage") for e in lines if e["event"] == "progress"]
    assert "transcribing" not in progress_stages
    assert "segmenting" in progress_stages
    assert event_types[-1] == "done"
```

- **VALIDATE**: `python -m pytest backend/tests/ -m "not slow" -v`

---

### Task 20: CREATE `backend/tests/test_transcriber.py`

```python
"""Unit tests for backend.transcriber. WhisperModel is never loaded from disk."""

import pytest
from backend.transcriber import transcribe


class _FakeSegment:
    def __init__(self, text: str) -> None:
        self.text = text


class _FakeWhisper:
    def __init__(self, segments: list[str]) -> None:
        self._segments = segments

    def transcribe(self, audio_path: str, language: str):  # noqa: ANN001
        return [_FakeSegment(t) for t in self._segments], None


def test_transcribe_single_segment():
    model = _FakeWhisper([" Barnet vasker hendene."])
    result = transcribe(model, "any.wav", language="no")
    assert result == "Barnet vasker hendene."


def test_transcribe_joins_multiple_segments():
    model = _FakeWhisper([" Første del.", " Andre del."])
    result = transcribe(model, "any.webm")
    assert result == "Første del. Andre del."


def test_transcribe_strips_whitespace():
    model = _FakeWhisper(["  Vasker   ", "  hendene.  "])
    result = transcribe(model, "any.wav")
    assert result == "Vasker hendene."


def test_transcribe_empty_segments():
    model = _FakeWhisper([])
    result = transcribe(model, "any.wav")
    assert result == ""


def test_transcribe_default_language_is_norwegian():
    """Verify the default language kwarg is 'no' by checking the call."""
    called_with: dict = {}

    class _SpyWhisper:
        def transcribe(self, audio_path: str, language: str):  # noqa: ANN001
            called_with["language"] = language
            return [], None

    transcribe(_SpyWhisper(), "any.wav")  # no explicit language
    assert called_with["language"] == "no"
```

- **VALIDATE**: `python -m pytest backend/tests/test_transcriber.py -v`

---

## TESTING STRATEGY

### Unit Tests (Python)

- `test_transcriber.py` — tests `transcribe()` in isolation with fake model instances; covers single segment, multi-segment, whitespace stripping, empty output, and default language.
- `test_pipeline.py` — tests full pipeline JSON output; `mock_transcriber` autouse fixture prevents any real model loading.

### Unit Tests (TypeScript)

- `useRecorder.test.ts` — mocks `navigator.mediaDevices`, `MediaRecorder`, `Blob`, and `window.electronAPI.saveRecording`; covers idle state, start/stop transitions, and path return value.
- `usePipeline.test.ts` — existing tests continue to pass after mock update.

### E2E Tests (Playwright)

Existing E2E tests use `--test-mode` which bypasses Python entirely. No new E2E tests are required for Phase 2 — the recording flow is not exercised in `--test-mode` (MediaRecorder is not available in the test environment).

### Edge Cases

- `stopRecording()` called without `startRecording()` first → rejects with `'No active recording'`
- `saveRecording` IPC fails → `stopRecording` Promise rejects, state returns to `'idle'`
- `transcribe()` with empty audio file → faster-whisper returns empty segments → `run()` passes empty string to segmenter (Phase 3 handles gracefully)

---

## VALIDATION COMMANDS

### Level 1: Lint & Format

```bash
npm run lint
ruff check backend/
```

### Level 2: TypeScript

```bash
npm run typecheck
```

### Level 3: Unit Tests

```bash
npm run test:unit
python -m pytest backend/tests/ -m "not slow" -v
```

### Level 4: Integration (no models needed)

```bash
npm run build
npm run test:e2e
```

### Level 5: Manual recording test (requires microphone)

1. `npm run dev`
2. Click "Ta opp fortelling" → button turns red with pulse dot and label "Stopp opptak"
3. Speak 5–10 seconds of Norwegian
4. Click "Stopp opptak" → label shows "Lagrer…" briefly → transitions to ProcessingScreen
5. ProcessingScreen shows "Transkriberer tale…" (real model) or runs stub without crashing
6. App returns to HomeScreen after pipeline completes

---

## ACCEPTANCE CRITERIA

- [ ] `<h1>` on HomeScreen reads "Fortelling til bilder"
- [ ] `<title>` in `index.html` reads "Fortelling til bilder"
- [ ] E2E title assertion passes with updated text
- [ ] `resources/icons/icon.png` exists and is referenced in BrowserWindow
- [ ] Electron window shows the icon in the taskbar and window title bar
- [ ] "Ta opp fortelling" → starts microphone recording, button turns red with pulse
- [ ] "Stopp opptak" → saves audio blob to temp `.webm` file, transitions to ProcessingScreen
- [ ] `pipeline:start` receives the real audio file path (not empty string)
- [ ] `pipeline:start` passes `--output` dir to Python subprocess
- [ ] `backend/transcriber.py` `transcribe()` joins segments and strips whitespace
- [ ] All Python unit tests pass with `pytest -m "not slow"`
- [ ] All TypeScript unit tests pass with `vitest run`
- [ ] `npm run typecheck` exits 0
- [ ] `npm run lint` and `ruff check backend/` exit 0

---

## COMPLETION CHECKLIST

- [x] Tasks 1–3 complete (Norwegian UI)
- [x] Tasks 4–6 complete (icon files)
- [x] Task 7 complete (main.ts: icon + pipeline args + recording:save)
- [x] Tasks 8–10 complete (preload + test mocks updated)
- [x] Tasks 11–13 complete (useRecorder hook + CSS + tests)
- [x] Task 14 complete (useRecorder.test.ts passes)
- [x] Tasks 15–17 complete (transcriber.py + pipeline.py + requirements)
- [x] Tasks 18–20 complete (conftest + test_pipeline + test_transcriber pass)
- [x] All validation commands pass
- [x] Manual recording test verified
- [x] Model download progress bar (deviation)
- [x] Transcript-review UX flow (deviation)
- [x] Cancel transcription (deviation)

---

## NOTES

**Why WebM instead of WAV?** `MediaRecorder` in Chromium defaults to `audio/webm`. faster-whisper uses ffmpeg internally and accepts webm, mp3, ogg, and WAV natively — no conversion step needed.

**Why `ArrayBuffer` over `number[]` for IPC?** Electron's structured clone algorithm transfers `ArrayBuffer` efficiently without copying element by element. A 30-second recording at typical quality is ~1–3 MB; this matters.

**Why deferred import of transcriber in pipeline.py?** `from backend.transcriber import ...` triggers `import faster_whisper` which is slow (~1s). Deferring it to when `--audio` is actually used keeps the `--text` path fast and keeps tests clean (the autouse mock patches before any import occurs in the `--audio` branch).

**Icon for Phase 4 packaging:** `electron-builder` requires `.ico` format for the Windows NSIS installer. Add a `build:icon-ico` script using `png-to-ico` npm package in Phase 4. The current `.png` is sufficient for development window icons.

**Test-mode behavior unchanged:** `--test-mode` in main.ts still emits hardcoded fixture events. The `useRecorder` hook is not exercised in E2E tests — MediaRecorder is unavailable in Playwright's Electron context without mocking. Phase 4 can add a dedicated E2E test for the recording UI if needed.
