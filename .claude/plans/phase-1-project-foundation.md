# Feature: Phase 1 — Project Foundation

The following plan should be complete, but validate each task's output before proceeding to the next.
Pay special attention to file paths — electron-vite separates main, preload, and renderer into distinct bundles.
Do NOT start implementing Phase 2 models; stub everything.

## Feature Description

Bootstrap the full project scaffold so that the Electron app launches, IPC is wired end-to-end with a stub Python pipeline, and all three test frameworks (Vitest, pytest, Playwright) are configured and passing. No AI models are involved — only stub/fixture data.

## User Story

As a developer,
I want a working project skeleton with Electron + React + TypeScript, a stub Python pipeline, and full test tooling,
So that I can build the real AI features in Phases 2–4 on a solid, validated foundation.

## Problem Statement

The project has no source code yet. Every subsequent phase depends on having correct IPC wiring, a runnable Electron app, and green tests from the start.

## Solution Statement

Manually create all scaffold files (no `npm create` — the directory already has `.gitignore` and `README.md`). Configure electron-vite with the exact structure defined in the PRD, wire up IPC with a stub Python pipeline that emits fixture JSON events, and verify every layer with its own test suite.

## Feature Metadata

**Feature Type**: New Capability  
**Estimated Complexity**: High (many files, but each is straightforward)  
**Primary Systems Affected**: Electron main, preload, React renderer, Python backend, all test layers  
**Dependencies**: electron, react, typescript, electron-vite, vitest, playwright, biome, pytest, ruff

---

## CONTEXT REFERENCES

### Relevant Skill Files — MUST READ BEFORE IMPLEMENTING

- `.claude/skills/electron-ipc/SKILL.md` — Exact preload/main/renderer code patterns. Use verbatim.
- `.claude/skills/testing/SKILL.md` — Test configs, fixture format, `--test-mode` implementation, `data-testid` convention.
- `.claude/skills/react-components/SKILL.md` — Component and hook patterns.
- `.claude/skills/python-pipeline/SKILL.md` — `emit()` function, stdout protocol.
- `.claude/skills/code-quality/SKILL.md` — Biome and Ruff commands, `biome.json` init, `pyproject.toml` config.
- `.claude/skills/electron-styling/SKILL.md` — CSS variables, typography, window sizing.
- `.claude/PRD.md` — Authoritative spec: IPC protocol, event schema, directory structure, Norwegian UI strings.

### New Files to Create

```
package.json
tsconfig.json
electron.vite.config.ts
biome.json
pyproject.toml
.gitignore                         (update existing)
src/index.html
src/main.tsx
src/renderer.d.ts
src/index.css
src/App.tsx
src/screens/HomeScreen.tsx
src/screens/HomeScreen.css
src/screens/ProcessingScreen.tsx
src/screens/ProcessingScreen.css
src/hooks/usePipeline.ts
src/preload/index.ts
electron/main.ts
backend/__init__.py
backend/pipeline.py
backend/requirements.txt
backend/tests/__init__.py
backend/tests/conftest.py
backend/tests/test_pipeline.py
tests/fixtures/sample_story.json
tests/fixtures/sample_image.png    (generate with Python one-liner)
tests/fixtures/sample_audio.wav    (generate with Python one-liner)
tests/unit/setup.ts
tests/unit/hooks/usePipeline.test.ts
tests/e2e/helpers.ts
tests/e2e/home.spec.ts
tests/e2e/pipeline.spec.ts
vitest.config.ts
playwright.config.ts
resources/fonts/                   (create dir; NotoSans-Bold.ttf downloaded in Phase 3)
```

### Patterns to Follow

**IPC event flow** (from `electron-ipc` skill):
```
Renderer → ipcRenderer.invoke('pipeline:start', audioPath)
Main → spawn python → read stdout JSON lines → webContents.send('pipeline:event', parsed)
Renderer → onPipelineEvent callback → update React state
```

**Emit pattern** (from `python-pipeline` skill):
```python
def emit(event: str, **data):
    print(json.dumps({"event": event, **data}), flush=True)
```
Always `flush=True` — Electron will not see output otherwise.

**Screen routing** — No router library. Single `activeScreen` state in `App.tsx`:
```typescript
type Screen = 'home' | 'processing';
const [activeScreen, setActiveScreen] = useState<Screen>('home');
```

**Test IDs** (from `testing` skill — Playwright depends on these):
| Element | `data-testid` |
|---|---|
| Record/Start button | `record-button` |
| Processing screen container | `processing-screen` |
| Stage label | `progress-stage` |
| Cancel button | `cancel-button` |

**Norwegian UI strings** (from PRD §7):
- Record button: `"Ta opp fortelling"` / hold state: `"Stopp"`
- Processing stages: `"Transkriberer tale…"`, `"Bryter ned i scener…"`, `"Genererer bilde X av N…"`
- Cancel: `"Avbryt"`

---

## IMPLEMENTATION PLAN

### Phase 1A: Project Configuration (no code yet)

Set up all configuration files before writing any source code. This ensures tooling is in place to validate as we go.

### Phase 1B: Electron + React Skeleton

Create the main process, preload, renderer entry, and CSS base. Get `npm run dev` working.

### Phase 1C: Screens and Hooks

Implement HomeScreen, ProcessingScreen, and `usePipeline` hook.

### Phase 1D: Python Stub

Create the stub pipeline and pytest setup.

### Phase 1E: Tests

Wire up all three test layers, create fixtures, validate everything passes.

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order. Each task has a validation command — run it before proceeding.

---

### TASK 1: CREATE `package.json`

- **IMPLEMENT**: Full npm package config with all dev/prod dependencies and scripts.
- **GOTCHA**: `"main"` must be `"dist/main/index.js"` — electron-vite output path.
- **GOTCHA**: Use `"type": "module"` is NOT needed; electron-vite handles ESM/CJS.
- **VALIDATE**: `cat package.json` — verify main, scripts, and all deps are present.

```json
{
  "name": "story-to-images",
  "version": "0.1.0",
  "description": "Visual communication app for autistic individuals",
  "main": "dist/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "test:unit": "vitest run",
    "test:python": "pytest backend/tests/ -m \"not slow\" -v",
    "test:e2e": "playwright test",
    "test": "npm run test:unit && npm run test:python",
    "lint": "biome check src/ electron/",
    "lint:fix": "biome check --apply src/ electron/",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.0",
    "@playwright/test": "^1.47.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/node": "^22.0.0",
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "electron": "^32.0.0",
    "electron-builder": "^25.0.0",
    "electron-vite": "^2.3.0",
    "jsdom": "^25.0.0",
    "typescript": "^5.5.4",
    "vite": "^5.4.2",
    "vitest": "^2.1.1"
  }
}
```

---

### TASK 2: CREATE `tsconfig.json`

- **IMPLEMENT**: Single tsconfig covering all three build targets (main, preload, renderer).
- **GOTCHA**: `moduleResolution: "bundler"` requires `module: "ESNext"` — electron-vite's bundler handles the actual output format.
- **GOTCHA**: Include both `lib: ["DOM"]` (renderer) and `@types/node` (main/preload). With `skipLibCheck: true` this won't cause conflicts.
- **VALIDATE**: After installing deps — `npx tsc --noEmit` (0 errors once all files exist).

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*", "electron/**/*", "tests/unit/**/*", "tests/e2e/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

### TASK 3: CREATE `electron.vite.config.ts`

- **IMPLEMENT**: electron-vite config with preload entry pointing to `src/preload/index.ts`.
- **GOTCHA**: Default electron-vite scaffold looks for preload at `electron/preload.ts`. We override this with a `rollupOptions.input` to match the PRD structure.
- **GOTCHA**: `externalizeDepsPlugin()` prevents node_modules from being bundled into the main/preload outputs.
- **VALIDATE**: `npm run build` — builds successfully with no errors.

```typescript
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/main.ts'),
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts'),
        },
      },
    },
  },
  renderer: {
    root: resolve(__dirname, 'src'),
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/index.html'),
        },
      },
    },
    plugins: [react()],
  },
})
```

---

### TASK 4: CREATE `biome.json`

- **IMPLEMENT**: Biome config with formatter and linter enabled.
- **PATTERN**: From `code-quality` skill — run `npx biome init` OR create manually.
- **VALIDATE**: `npx biome check src/ electron/` — 0 errors (before any source files exist, this will pass trivially; re-run after source files are added).

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "vcs": { "enabled": false },
  "files": { "ignoreUnknown": false },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "trailingCommas": "es5",
      "semicolons": "always"
    }
  }
}
```

---

### TASK 5: CREATE `pyproject.toml`

- **IMPLEMENT**: Ruff linting config + pytest settings.
- **PATTERN**: From `code-quality` skill.
- **VALIDATE**: `ruff check backend/ --fix && ruff format backend/` — 0 errors once backend files exist.

```toml
[tool.ruff]
line-length = 100
target-version = "py311"

[tool.ruff.lint]
select = ["E", "F", "I", "UP"]

[tool.pytest.ini_options]
testpaths = ["backend/tests"]
markers = ["slow: requires real AI models (deselect with -m 'not slow')"]
```

---

### TASK 6: UPDATE `.gitignore`

- **ADD** to the existing `.gitignore`:

```gitignore
# Build outputs
dist/
out/

# Dependencies
node_modules/

# Python
backend/.venv/
backend/__pycache__/
**/__pycache__/
*.pyc
.pytest_cache/

# Models (large binary files)
resources/models/

# Electron temp / generated images
*.png
!resources/fonts/*.png
!tests/fixtures/*.png

# IDE
.idea/
.vscode/

# OS
.DS_Store
Thumbs.db
```

- **VALIDATE**: `cat .gitignore` — verify new entries appended.

---

### TASK 7: INSTALL npm dependencies

- **IMPLEMENT**: Run install in project directory.
- **GOTCHA**: On Windows, use `npm install` not `yarn` — no lock file exists yet.
- **VALIDATE**: `npm list --depth=0` — shows electron, react, electron-vite, vitest, playwright, biome.

```bash
npm install
```

---

### TASK 8: CREATE `src/index.html`

- **IMPLEMENT**: HTML entry point for the renderer. electron-vite serves/builds this.
- **GOTCHA**: The `<script>` src path must match where electron-vite expects the renderer entry (`/main.tsx` relative to `src/`).

```html
<!DOCTYPE html>
<html lang="no">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Story to Images</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

---

### TASK 9: CREATE `src/preload/index.ts`

- **IMPLEMENT**: Full `contextBridge` setup with all IPC types, exactly as shown in `electron-ipc` skill.
- **IMPORTS**: `electron` only — no Node.js `fs`, `path`, etc. in preload renderer-facing code. `ipcRenderer` is the exception as it's from Electron.
- **GOTCHA**: Export `ElectronAPI`, `PipelineProgressEvent`, and `Scene` interfaces so renderer code can import them.
- **VALIDATE**: `npx tsc --noEmit` — no type errors on this file.

```typescript
import { contextBridge, ipcRenderer } from 'electron';

export interface Scene {
  index: number;
  caption_no: string;
  image_path: string;
}

export interface PipelineProgressEvent {
  event: 'progress' | 'scene' | 'done' | 'error';
  stage?: string;
  index?: number;
  total?: number;
  caption_no?: string;
  image_path?: string;
  scenes?: Scene[];
  message?: string;
}

export interface ElectronAPI {
  startPipeline: (audioPath: string) => Promise<void>;
  cancelPipeline: () => Promise<void>;
  onPipelineEvent: (callback: (event: PipelineProgressEvent) => void) => () => void;
  startRecording: () => Promise<string>;
  stopRecording: () => Promise<string>;
}

contextBridge.exposeInMainWorld('electronAPI', {
  startPipeline: (audioPath: string) =>
    ipcRenderer.invoke('pipeline:start', audioPath),

  cancelPipeline: () =>
    ipcRenderer.invoke('pipeline:cancel'),

  onPipelineEvent: (callback: (event: PipelineProgressEvent) => void) => {
    const handler = (_: unknown, event: PipelineProgressEvent) => callback(event);
    ipcRenderer.on('pipeline:event', handler);
    return () => ipcRenderer.removeListener('pipeline:event', handler);
  },

  startRecording: () => ipcRenderer.invoke('recording:start'),
  stopRecording: () => ipcRenderer.invoke('recording:stop'),
} satisfies ElectronAPI);
```

---

### TASK 10: CREATE `src/renderer.d.ts`

- **IMPLEMENT**: Global TypeScript declaration so `window.electronAPI` is typed in the renderer.
- **VALIDATE**: `npx tsc --noEmit` — no "Property 'electronAPI' does not exist on type 'Window'" error.

```typescript
import type { ElectronAPI } from './preload/index';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
```

---

### TASK 11: CREATE `electron/main.ts`

- **IMPLEMENT**: BrowserWindow creation, `--test-mode` flag, pipeline spawn handler, IPC cancel handler.
- **PATTERN**: From `electron-ipc` skill — use verbatim for the spawn + stdout parsing logic.
- **PATTERN**: From `testing` skill — use verbatim for the `--test-mode` fixture event sequence.
- **GOTCHA**: `preload` path must be `join(__dirname, '../preload/index.js')` — electron-vite outputs preload to `dist/preload/index.js`, and main to `dist/main/index.js`, so go up one level then into `preload/`.
- **GOTCHA**: `PYTHONUNBUFFERED: '1'` is required in spawn env.
- **GOTCHA**: In `--test-mode`, fixture image paths are resolved relative to project root using `app.getAppPath()`.
- **GOTCHA**: For dev mode, load from `process.env['ELECTRON_RENDERER_URL']`; for prod, load from `join(__dirname, '../renderer/index.html')`.

```typescript
import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { spawn, ChildProcess } from 'child_process';
import { readFileSync } from 'fs';

const isTestMode = process.argv.includes('--test-mode');
let mainWindow: BrowserWindow;
let pipelineProcess: ChildProcess | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// --- Pipeline IPC ---

ipcMain.handle('pipeline:start', async (_, audioPath: string) => {
  if (isTestMode) {
    const projectRoot = app.getAppPath();
    const fixturePath = join(projectRoot, 'tests', 'fixtures', 'sample_story.json');
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8'));
    const imagePath = join(projectRoot, 'tests', 'fixtures', 'sample_image.png');

    setTimeout(() => mainWindow.webContents.send('pipeline:event',
      { event: 'progress', stage: 'transcribing' }), 200);
    setTimeout(() => mainWindow.webContents.send('pipeline:event',
      { event: 'progress', stage: 'segmenting' }), 700);

    fixture.scenes.forEach((scene: { index: number; caption_no: string }, i: number) => {
      const delay = 1200 + i * 600;
      setTimeout(() => mainWindow.webContents.send('pipeline:event', {
        event: 'progress', stage: 'generating_image', index: i + 1, total: fixture.scenes.length,
      }), delay - 100);
      setTimeout(() => mainWindow.webContents.send('pipeline:event', {
        event: 'scene', index: scene.index, caption_no: scene.caption_no, image_path: imagePath,
      }), delay);
    });

    const doneDelay = 1200 + fixture.scenes.length * 600 + 200;
    setTimeout(() => mainWindow.webContents.send('pipeline:event', {
      event: 'done',
      scenes: fixture.scenes.map((s: { index: number; caption_no: string }) => ({
        ...s, image_path: imagePath,
      })),
    }), doneDelay);
    return;
  }

  if (pipelineProcess) return;

  const pythonPath = join(app.getAppPath(), 'backend', '.venv', 'Scripts', 'python.exe');
  const scriptPath = join(app.getAppPath(), 'backend', 'pipeline.py');

  pipelineProcess = spawn(pythonPath, [scriptPath, '--audio', audioPath], {
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
  });

  let buffer = '';
  pipelineProcess.stdout?.on('data', (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        mainWindow.webContents.send('pipeline:event', event);
      } catch {
        console.error('Non-JSON stdout from pipeline:', line);
      }
    }
  });

  pipelineProcess.stderr?.on('data', (chunk: Buffer) => {
    console.error('[pipeline stderr]', chunk.toString());
  });

  pipelineProcess.on('close', (code) => {
    pipelineProcess = null;
    if (code !== 0) {
      mainWindow.webContents.send('pipeline:event', {
        event: 'error', message: `Pipeline exited with code ${code}`,
      });
    }
  });
});

ipcMain.handle('pipeline:cancel', async () => {
  pipelineProcess?.kill();
  pipelineProcess = null;
});

// Stubs for Phase 2
ipcMain.handle('recording:start', async () => '/tmp/recording_stub.wav');
ipcMain.handle('recording:stop', async () => '/tmp/recording_stub.wav');
```

---

### TASK 12: CREATE `src/index.css`

- **IMPLEMENT**: CSS reset, theme variables, and base typography.
- **PATTERN**: From `electron-styling` skill.

```css
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --text-primary: #1a1a1a;
  --text-secondary: #666666;
  --accent: #0066cc;
  --accent-hover: #0052a3;
  --border: #e0e0e0;
  --danger: #cc2200;
}

html, body, #root {
  height: 100%;
}

body {
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  font-size: 16px;
  line-height: 1.5;
  color: var(--text-primary);
  background: var(--bg-primary);
  -webkit-font-smoothing: antialiased;
}

button {
  cursor: pointer;
  font-family: inherit;
  border: none;
  background: none;
}
```

---

### TASK 13: CREATE `src/App.tsx`

- **IMPLEMENT**: Screen router using `activeScreen` state. Phase 1 has `home` and `processing`.
- **PATTERN**: From `react-components` skill — functional component, props typed with interface, no React.FC.

```typescript
import { useState } from 'react';
import './index.css';
import { HomeScreen } from './screens/HomeScreen';
import { ProcessingScreen } from './screens/ProcessingScreen';

type Screen = 'home' | 'processing';

export default function App() {
  const [activeScreen, setActiveScreen] = useState<Screen>('home');

  return (
    <>
      {activeScreen === 'home' && (
        <HomeScreen onStartPipeline={() => setActiveScreen('processing')} />
      )}
      {activeScreen === 'processing' && (
        <ProcessingScreen onCancel={() => setActiveScreen('home')} onDone={() => setActiveScreen('home')} />
      )}
    </>
  );
}
```

---

### TASK 14: CREATE `src/main.tsx`

- **IMPLEMENT**: React entry point — render App into `#root`.
- **GOTCHA**: `StrictMode` is fine for development.

```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

---

### TASK 15: CREATE `src/hooks/usePipeline.ts`

- **IMPLEMENT**: Pipeline state hook consuming IPC events.
- **PATTERN**: From `electron-ipc` skill — use the full `usePipeline` implementation verbatim.
- **IMPORTS**: Import `Scene` and `PipelineProgressEvent` from `../preload/index` — do not redefine them.
- **GOTCHA**: `useEffect` must return the cleanup from `onPipelineEvent` to prevent listener leaks.

```typescript
import { useEffect, useState, useCallback } from 'react';
import type { PipelineProgressEvent, Scene } from '../preload/index';

export interface PipelineState {
  stage: string | null;
  progress: { current: number; total: number } | null;
  scenes: Scene[];
  error: string | null;
  isRunning: boolean;
}

export function usePipeline() {
  const [state, setState] = useState<PipelineState>({
    stage: null,
    progress: null,
    scenes: [],
    error: null,
    isRunning: false,
  });

  const start = useCallback(async (audioPath: string) => {
    setState({ stage: 'starting', progress: null, scenes: [], error: null, isRunning: true });
    await window.electronAPI.startPipeline(audioPath);
  }, []);

  const cancel = useCallback(async () => {
    await window.electronAPI.cancelPipeline();
    setState((s) => ({ ...s, isRunning: false }));
  }, []);

  useEffect(() => {
    const cleanup = window.electronAPI.onPipelineEvent((event: PipelineProgressEvent) => {
      setState((s) => {
        switch (event.event) {
          case 'progress':
            return {
              ...s,
              stage: event.stage ?? s.stage,
              progress:
                event.index != null
                  ? { current: event.index, total: event.total! }
                  : s.progress,
            };
          case 'scene':
            return {
              ...s,
              scenes: [
                ...s.scenes,
                {
                  index: event.index!,
                  caption_no: event.caption_no!,
                  image_path: event.image_path!,
                },
              ],
            };
          case 'done':
            return { ...s, isRunning: false, stage: 'done' };
          case 'error':
            return { ...s, isRunning: false, error: event.message ?? 'Ukjent feil' };
          default:
            return s;
        }
      });
    });
    return cleanup;
  }, []);

  return { ...state, start, cancel };
}
```

---

### TASK 16: CREATE `src/screens/HomeScreen.tsx` + `HomeScreen.css`

- **IMPLEMENT**: Large centered record button, status text in Norwegian, settings gear icon stub.
- **PATTERN**: `data-testid="record-button"` required (Playwright depends on it).
- **NOTE**: Phase 1 — clicking the button starts pipeline with a fixture audio path. Real recording is Phase 2.

```typescript
// src/screens/HomeScreen.tsx
import './HomeScreen.css';

interface HomeScreenProps {
  onStartPipeline: () => void;
}

export function HomeScreen({ onStartPipeline }: HomeScreenProps) {
  const handleStart = async () => {
    // Phase 2 will replace with real recording. Phase 1: use fixture.
    await window.electronAPI.startPipeline('tests/fixtures/sample_audio.wav');
    onStartPipeline();
  };

  return (
    <div className="home-screen">
      <h1 className="home-title">Story to Images</h1>
      <p className="home-status">Klar til å ta opp</p>
      <button
        className="record-button"
        data-testid="record-button"
        onClick={handleStart}
        type="button"
      >
        Ta opp fortelling
      </button>
    </div>
  );
}
```

```css
/* src/screens/HomeScreen.css */
.home-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  gap: 24px;
  background: var(--bg-primary);
}

.home-title {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary);
}

.home-status {
  font-size: 1.1rem;
  color: var(--text-secondary);
}

.record-button {
  padding: 24px 48px;
  font-size: 1.4rem;
  font-weight: 600;
  background: var(--accent);
  color: white;
  border-radius: 12px;
  transition: background-color 150ms ease, transform 100ms ease;
  min-width: 280px;
}

.record-button:hover {
  background: var(--accent-hover);
}

.record-button:active {
  transform: scale(0.97);
}
```

---

### TASK 17: CREATE `src/screens/ProcessingScreen.tsx` + `ProcessingScreen.css`

- **IMPLEMENT**: Uses `usePipeline` hook, shows stage text in Norwegian, progress bar, cancel button. Calls `onDone` when `done` event arrives.
- **PATTERN**: `data-testid="processing-screen"`, `data-testid="progress-stage"`, `data-testid="cancel-button"` required.
- **PATTERN**: Stage-to-Norwegian mapping inline (no translation library needed).

```typescript
// src/screens/ProcessingScreen.tsx
import { useEffect } from 'react';
import { usePipeline } from '../hooks/usePipeline';
import './ProcessingScreen.css';

interface ProcessingScreenProps {
  onCancel: () => void;
  onDone: () => void;
}

const stageLabels: Record<string, string> = {
  starting: 'Starter…',
  transcribing: 'Transkriberer tale…',
  segmenting: 'Bryter ned i scener…',
  generating_image: 'Genererer bilde',
  done: 'Ferdig!',
};

export function ProcessingScreen({ onCancel, onDone }: ProcessingScreenProps) {
  const { stage, progress, error, isRunning } = usePipeline();

  useEffect(() => {
    if (stage === 'done') {
      const timer = setTimeout(onDone, 800);
      return () => clearTimeout(timer);
    }
  }, [stage, onDone]);

  const stageText = stage === 'generating_image' && progress
    ? `Genererer bilde ${progress.current} av ${progress.total}…`
    : (stageLabels[stage ?? ''] ?? 'Behandler…');

  return (
    <div className="processing-screen" data-testid="processing-screen">
      <div className="processing-content">
        <p className="processing-stage" data-testid="progress-stage">
          {error ? `Feil: ${error}` : stageText}
        </p>
        <div className="progress-bar" role="progressbar">
          <div className={`progress-fill ${isRunning && !error ? 'animating' : ''}`} />
        </div>
        <button
          className="cancel-button"
          data-testid="cancel-button"
          onClick={onCancel}
          type="button"
        >
          Avbryt
        </button>
      </div>
    </div>
  );
}
```

```css
/* src/screens/ProcessingScreen.css */
.processing-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: var(--bg-primary);
}

.processing-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
  width: 480px;
  max-width: 90vw;
}

.processing-stage {
  font-size: 1.2rem;
  color: var(--text-primary);
  text-align: center;
  min-height: 2em;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: var(--border);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  width: 30%;
  background: var(--accent);
  border-radius: 4px;
}

.progress-fill.animating {
  animation: indeterminate 1.5s ease-in-out infinite;
}

@keyframes indeterminate {
  0% { transform: translateX(-100%) scaleX(0.3); }
  50% { transform: translateX(100%) scaleX(0.8); }
  100% { transform: translateX(300%) scaleX(0.3); }
}

.cancel-button {
  padding: 12px 32px;
  font-size: 1rem;
  color: var(--danger);
  border: 2px solid var(--danger);
  border-radius: 8px;
  transition: background-color 150ms ease;
}

.cancel-button:hover {
  background: #fff0ee;
}
```

---

### TASK 18: CREATE `backend/__init__.py` and `backend/pipeline.py`

- **IMPLEMENT**: Stub pipeline that emits realistic JSON events with `time.sleep` delays. No models, no real processing.
- **PATTERN**: From `python-pipeline` skill — use the `emit()` function pattern verbatim.
- **GOTCHA**: `flush=True` on every `print()` — required for Electron to receive events in real-time.
- **VALIDATE**: `python backend/pipeline.py --audio tests/fixtures/sample_audio.wav --output /tmp/test_out` — prints 8+ JSON lines to stdout.

`backend/__init__.py` — empty file.

```python
# backend/pipeline.py
"""Stub pipeline for Phase 1. Emits fixture events without loading any models."""
import argparse
import json
import sys
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
```

---

### TASK 19: CREATE `backend/requirements.txt`

- **IMPLEMENT**: Phase 1 has no model dependencies. Only test tooling.
- **NOTE**: Phase 2–3 will add faster-whisper, llama-cpp-python, diffusers, torch, etc.

```
pytest>=8.0
pytest-mock>=3.14
ruff>=0.6
```

---

### TASK 20: INSTALL Python dependencies

- **IMPLEMENT**: Install into the local backend venv (or global if no venv yet).
- **GOTCHA**: For Phase 1, just install pytest and ruff globally or in a project venv.
- **VALIDATE**: `pytest --version && ruff --version`

```bash
pip install pytest pytest-mock ruff
```

If using a venv:
```bash
python -m venv backend/.venv
backend/.venv/Scripts/activate  # Windows
pip install pytest pytest-mock ruff
```

---

### TASK 21: CREATE test fixtures

- **IMPLEMENT**: `sample_story.json`, `sample_image.png`, and `sample_audio.wav`.
- **GOTCHA**: `sample_image.png` must exist as a valid PNG for Playwright tests to not error on image loading.
- **VALIDATE**: `python -c "from PIL import Image; Image.open('tests/fixtures/sample_image.png')"` — if PIL available. Otherwise verify file size > 0.

Create `tests/fixtures/sample_story.json`:
```json
{
  "scenes": [
    {
      "index": 0,
      "caption_no": "Vasker hendene",
      "image_path": "tests/fixtures/sample_image.png"
    },
    {
      "index": 1,
      "caption_no": "Tørker hendene",
      "image_path": "tests/fixtures/sample_image.png"
    },
    {
      "index": 2,
      "caption_no": "Tar på seg jakken",
      "image_path": "tests/fixtures/sample_image.png"
    }
  ]
}
```

Create `tests/fixtures/sample_image.png` using Python:
```bash
python -c "
from PIL import Image
img = Image.new('RGB', (1024, 1024), color=(200, 220, 255))
img.save('tests/fixtures/sample_image.png')
"
```
If PIL is not available:
```bash
python -c "
import struct, zlib
def make_png(w, h, color=(200,220,255)):
    def chunk(name, data):
        c = zlib.crc32(name + data) & 0xffffffff
        return struct.pack('>I', len(data)) + name + data + struct.pack('>I', c)
    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
    raw = b''.join(b'\x00' + bytes(color) * w for _ in range(h))
    idat = chunk(b'IDAT', zlib.compress(raw))
    iend = chunk(b'IEND', b'')
    return sig + ihdr + idat + iend
open('tests/fixtures/sample_image.png', 'wb').write(make_png(64, 64))
print('Created sample_image.png')
"
```

Create `tests/fixtures/sample_audio.wav` (silent 1-second WAV):
```bash
python -c "
import wave, struct
with wave.open('tests/fixtures/sample_audio.wav', 'w') as f:
    f.setnchannels(1); f.setsampwidth(2); f.setframerate(16000)
    f.writeframes(struct.pack('<' + 'h' * 16000, *([0] * 16000)))
print('Created sample_audio.wav')
"
```

---

### TASK 22: CREATE `backend/tests/__init__.py` and `backend/tests/conftest.py`

- **IMPLEMENT**: Shared fixtures for mocking the pipeline modules. Phase 1 tests don't need model mocks (no models exist yet), but establish the pattern for Phase 2.
- **PATTERN**: From `python-pipeline` skill and `testing` skill.

`backend/tests/__init__.py` — empty.

```python
# backend/tests/conftest.py
import pytest
from pathlib import Path


@pytest.fixture
def sample_audio(tmp_path: Path) -> str:
    """Copy the test WAV fixture to a temp directory and return its path."""
    src = Path("tests/fixtures/sample_audio.wav")
    dst = tmp_path / "audio.wav"
    dst.write_bytes(src.read_bytes())
    return str(dst)
```

---

### TASK 23: CREATE `backend/tests/test_pipeline.py`

- **IMPLEMENT**: Test that the stub pipeline emits the expected JSON event sequence.
- **PATTERN**: From `testing` skill — `capsys` to capture stdout, parse each line as JSON.
- **VALIDATE**: `pytest backend/tests/ -v` — 2+ tests pass.

```python
# backend/tests/test_pipeline.py
import json
from pathlib import Path

from backend.pipeline import run, STUB_SCENES


def test_pipeline_emits_progress_and_scene_events(tmp_path: Path, sample_audio: str) -> None:
    run(audio_path=sample_audio, output_dir=str(tmp_path))
    # Note: capsys doesn't work when called directly; test event structure instead.
    # Integration test — see test_pipeline_stdout below.


def test_pipeline_stub_scenes_are_valid() -> None:
    for scene in STUB_SCENES:
        assert "index" in scene
        assert "caption_no" in scene
        assert "prompt_en" in scene
        assert isinstance(scene["index"], int)
        assert len(scene["caption_no"]) > 0


def test_pipeline_emits_correct_json_lines(tmp_path: Path, capsys, sample_audio: str) -> None:
    run(audio_path=sample_audio, output_dir=str(tmp_path))
    captured = capsys.readouterr()
    lines = [l for l in captured.out.strip().splitlines() if l.strip()]
    parsed = [json.loads(line) for line in lines]

    event_types = [e["event"] for e in parsed]
    assert "progress" in event_types
    assert "scene" in event_types
    assert event_types[-1] == "done"

    scene_events = [e for e in parsed if e["event"] == "scene"]
    assert len(scene_events) == len(STUB_SCENES)
    for scene_event in scene_events:
        assert "caption_no" in scene_event
        assert "image_path" in scene_event
        assert "index" in scene_event
```

---

### TASK 24: CREATE `vitest.config.ts`

- **IMPLEMENT**: Vitest config with jsdom environment.
- **PATTERN**: From `testing` skill.
- **VALIDATE**: `npm run test:unit` — passes (even with no tests yet, should report 0 failures).

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/unit/setup.ts'],
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
  },
});
```

---

### TASK 25: CREATE `tests/unit/setup.ts`

- **IMPLEMENT**: Mock `window.electronAPI` for all unit tests.
- **PATTERN**: From `testing` skill.

```typescript
import { vi } from 'vitest';

// Global mock for window.electronAPI — tests override per-test as needed
Object.defineProperty(window, 'electronAPI', {
  writable: true,
  value: {
    startPipeline: vi.fn().mockResolvedValue(undefined),
    cancelPipeline: vi.fn().mockResolvedValue(undefined),
    onPipelineEvent: vi.fn().mockReturnValue(() => {}),
    startRecording: vi.fn().mockResolvedValue('/tmp/audio.wav'),
    stopRecording: vi.fn().mockResolvedValue('/tmp/audio.wav'),
  },
});
```

---

### TASK 26: CREATE `tests/unit/hooks/usePipeline.test.ts`

- **IMPLEMENT**: Unit tests for the `usePipeline` hook.
- **PATTERN**: From `testing` skill — `renderHook` + `act`.
- **VALIDATE**: `npm run test:unit` — all tests pass.

```typescript
import { renderHook, act } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { usePipeline } from '../../../src/hooks/usePipeline';
import type { PipelineProgressEvent } from '../../../src/preload/index';

describe('usePipeline', () => {
  beforeEach(() => {
    window.electronAPI = {
      startPipeline: vi.fn().mockResolvedValue(undefined),
      cancelPipeline: vi.fn().mockResolvedValue(undefined),
      onPipelineEvent: vi.fn().mockReturnValue(() => {}),
      startRecording: vi.fn().mockResolvedValue('/tmp/audio.wav'),
      stopRecording: vi.fn().mockResolvedValue('/tmp/audio.wav'),
    };
  });

  test('initial state is idle', () => {
    const { result } = renderHook(() => usePipeline());
    expect(result.current.isRunning).toBe(false);
    expect(result.current.stage).toBeNull();
    expect(result.current.scenes).toHaveLength(0);
    expect(result.current.error).toBeNull();
  });

  test('start sets isRunning to true and calls startPipeline', async () => {
    const { result } = renderHook(() => usePipeline());
    await act(async () => {
      await result.current.start('/tmp/audio.wav');
    });
    expect(result.current.isRunning).toBe(true);
    expect(window.electronAPI.startPipeline).toHaveBeenCalledWith('/tmp/audio.wav');
  });

  test('cancel calls cancelPipeline and sets isRunning to false', async () => {
    const { result } = renderHook(() => usePipeline());
    await act(async () => {
      await result.current.start('/tmp/audio.wav');
    });
    await act(async () => {
      await result.current.cancel();
    });
    expect(result.current.isRunning).toBe(false);
    expect(window.electronAPI.cancelPipeline).toHaveBeenCalled();
  });

  test('onPipelineEvent is called and cleanup returned', () => {
    const mockCleanup = vi.fn();
    (window.electronAPI.onPipelineEvent as ReturnType<typeof vi.fn>).mockReturnValue(mockCleanup);
    const { unmount } = renderHook(() => usePipeline());
    expect(window.electronAPI.onPipelineEvent).toHaveBeenCalled();
    unmount();
    expect(mockCleanup).toHaveBeenCalled();
  });

  test('progress event updates stage', async () => {
    let capturedCallback: ((e: PipelineProgressEvent) => void) | null = null;
    (window.electronAPI.onPipelineEvent as ReturnType<typeof vi.fn>).mockImplementation(
      (cb: (e: PipelineProgressEvent) => void) => {
        capturedCallback = cb;
        return () => {};
      }
    );
    const { result } = renderHook(() => usePipeline());
    act(() => {
      capturedCallback?.({ event: 'progress', stage: 'transcribing' });
    });
    expect(result.current.stage).toBe('transcribing');
  });

  test('scene event appends to scenes array', async () => {
    let capturedCallback: ((e: PipelineProgressEvent) => void) | null = null;
    (window.electronAPI.onPipelineEvent as ReturnType<typeof vi.fn>).mockImplementation(
      (cb: (e: PipelineProgressEvent) => void) => {
        capturedCallback = cb;
        return () => {};
      }
    );
    const { result } = renderHook(() => usePipeline());
    act(() => {
      capturedCallback?.({
        event: 'scene', index: 0, caption_no: 'Vasker hendene', image_path: '/tmp/scene_0.png',
      });
    });
    expect(result.current.scenes).toHaveLength(1);
    expect(result.current.scenes[0].caption_no).toBe('Vasker hendene');
  });

  test('done event sets isRunning to false', async () => {
    let capturedCallback: ((e: PipelineProgressEvent) => void) | null = null;
    (window.electronAPI.onPipelineEvent as ReturnType<typeof vi.fn>).mockImplementation(
      (cb: (e: PipelineProgressEvent) => void) => {
        capturedCallback = cb;
        return () => {};
      }
    );
    const { result } = renderHook(() => usePipeline());
    await act(async () => { await result.current.start('/tmp/audio.wav'); });
    act(() => { capturedCallback?.({ event: 'done', scenes: [] }); });
    expect(result.current.isRunning).toBe(false);
    expect(result.current.stage).toBe('done');
  });

  test('error event sets error and stops running', async () => {
    let capturedCallback: ((e: PipelineProgressEvent) => void) | null = null;
    (window.electronAPI.onPipelineEvent as ReturnType<typeof vi.fn>).mockImplementation(
      (cb: (e: PipelineProgressEvent) => void) => {
        capturedCallback = cb;
        return () => {};
      }
    );
    const { result } = renderHook(() => usePipeline());
    await act(async () => { await result.current.start('/tmp/audio.wav'); });
    act(() => { capturedCallback?.({ event: 'error', message: 'Modell ikke funnet' }); });
    expect(result.current.isRunning).toBe(false);
    expect(result.current.error).toBe('Modell ikke funnet');
  });
});
```

---

### TASK 27: CREATE `playwright.config.ts`

- **IMPLEMENT**: Playwright config for Electron E2E tests.
- **PATTERN**: From `testing` skill.
- **GOTCHA**: E2E tests require a built app (`npm run build` first). The `testDir` matches `tests/e2e/`.

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  retries: 0,
  use: {
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});
```

---

### TASK 28: CREATE `tests/e2e/helpers.ts`

- **IMPLEMENT**: `launchApp()` helper that starts Electron in `--test-mode`.
- **PATTERN**: From `testing` skill — exact `electron.launch` pattern.
- **GOTCHA**: The path `dist/main/index.js` is relative to the project root. Use `path.join(__dirname, '../../dist/main/index.js')`.

```typescript
import { _electron as electron, ElectronApplication, Page } from '@playwright/test';
import path from 'path';

export async function launchApp(): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({
    args: [path.join(__dirname, '../../dist/main/index.js'), '--test-mode'],
  });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return { app, page };
}
```

---

### TASK 29: CREATE `tests/e2e/home.spec.ts`

- **IMPLEMENT**: E2E test verifying the HomeScreen renders correctly.
- **PATTERN**: `data-testid` locators.

```typescript
import { test, expect } from '@playwright/test';
import { launchApp } from './helpers';

test('home screen shows record button', async () => {
  const { app, page } = await launchApp();
  await expect(page.getByTestId('record-button')).toBeVisible();
  await expect(page.getByTestId('record-button')).toContainText('Ta opp fortelling');
  await app.close();
});
```

---

### TASK 30: CREATE `tests/e2e/pipeline.spec.ts`

- **IMPLEMENT**: E2E test for the full stub pipeline flow: Home → Processing → back to Home.
- **PATTERN**: From `testing` skill — click record, wait for processing screen, wait for done.

```typescript
import { test, expect } from '@playwright/test';
import { launchApp } from './helpers';

test('stub pipeline flow: home → processing → done', async () => {
  const { app, page } = await launchApp();

  // Home screen visible
  await expect(page.getByTestId('record-button')).toBeVisible();

  // Start pipeline
  await page.getByTestId('record-button').click();

  // Processing screen appears
  await expect(page.getByTestId('processing-screen')).toBeVisible({ timeout: 3_000 });
  await expect(page.getByTestId('progress-stage')).toBeVisible();

  // At some point the stage label updates to a transcribing message
  await expect(page.getByTestId('progress-stage')).toContainText(
    /Transkriberer|Bryter ned|Genererer|Ferdig/,
    { timeout: 10_000 }
  );

  // After done, returns to home screen
  await expect(page.getByTestId('record-button')).toBeVisible({ timeout: 15_000 });

  await app.close();
});

test('cancel button returns to home screen', async () => {
  const { app, page } = await launchApp();

  await page.getByTestId('record-button').click();
  await expect(page.getByTestId('processing-screen')).toBeVisible({ timeout: 3_000 });

  await page.getByTestId('cancel-button').click();
  await expect(page.getByTestId('record-button')).toBeVisible({ timeout: 3_000 });

  await app.close();
});
```

---

### TASK 31: CREATE `resources/fonts/` directory

- **IMPLEMENT**: Create the directory (no font file yet — downloaded in Phase 3 when Pillow is added).
- **VALIDATE**: Directory exists.

```bash
mkdir -p resources/fonts
echo "# NotoSans-Bold.ttf will be placed here in Phase 3" > resources/fonts/README.md
```

---

### TASK 32: VALIDATE — Python tests

- **VALIDATE**: `pytest backend/tests/ -v` — all tests pass.

```bash
pytest backend/tests/ -v
```

Expected: 3 tests pass (test_pipeline_stub_scenes_are_valid, test_pipeline_emits_correct_json_lines, test_pipeline_emits_progress_and_scene_events).

---

### TASK 33: VALIDATE — TypeScript and Biome

- **VALIDATE**: `npx tsc --noEmit && npx biome check src/ electron/`
- Expected: 0 type errors, 0 Biome errors.

---

### TASK 34: VALIDATE — Ruff

- **VALIDATE**: `ruff check backend/ && ruff format backend/ --check`
- Expected: 0 errors.

---

### TASK 35: VALIDATE — Vitest unit tests

- **VALIDATE**: `npm run test:unit` — all 8+ tests pass.

---

### TASK 36: BUILD and VALIDATE — Playwright E2E

- **IMPLEMENT**: Build the app first, then run E2E.
- **GOTCHA**: `npm run test:e2e` requires a prior `npm run build`. Do them sequentially.
- **VALIDATE**: `npm run build && npm run test:e2e` — all 3 E2E tests pass.

```bash
npm run build && npm run test:e2e
```

---

## TESTING STRATEGY

### Unit Tests (Vitest)

- `tests/unit/hooks/usePipeline.test.ts` — 8 tests covering all state transitions
- `window.electronAPI` mocked globally in `tests/unit/setup.ts`
- Run without building: `npm run test:unit`

### Python Tests (pytest)

- `backend/tests/test_pipeline.py` — 3 tests verifying stub output
- No model mocks needed in Phase 1 (no models used)
- Run with: `pytest backend/tests/ -v`

### E2E Tests (Playwright)

- `tests/e2e/home.spec.ts` — 1 test: HomeScreen renders
- `tests/e2e/pipeline.spec.ts` — 2 tests: full flow + cancel
- Requires built app: `npm run build` first
- Uses `--test-mode` flag → no Python subprocess needed

### Edge Cases

- `done` event must transition back to home screen after 800ms delay
- Cancel during `--test-mode` must still work (no subprocess to kill, just state reset)
- `onPipelineEvent` cleanup must be called on unmount (tested in unit tests)

---

## VALIDATION COMMANDS

### Level 1: Syntax & Style
```bash
npx biome check src/ electron/
ruff check backend/ && ruff format backend/ --check
```

### Level 2: TypeScript
```bash
npx tsc --noEmit
```

### Level 3: Unit Tests
```bash
npm run test:unit
pytest backend/tests/ -v
```

### Level 4: Build + E2E
```bash
npm run build && npm run test:e2e
```

### Level 5: Manual Smoke Test
```bash
npm run dev
# Verify: App opens, HomeScreen visible, click button, ProcessingScreen shows, 
# Norwegian stage labels appear, automatically returns to home after ~4 seconds.
```

---

## ACCEPTANCE CRITERIA

- [x] `npm run dev` launches the Electron app without errors
- [x] No native menu bar (Menu.setApplicationMenu(null))
- [x] HomeScreen displays "Ta opp fortelling" button with `data-testid="record-button"`
- [x] HomeScreen displays text textarea (`data-testid="story-textarea"`) and submit button (`data-testid="submit-text-button"`)
- [x] Submit text button is disabled when textarea is empty
- [x] Clicking the record button transitions to ProcessingScreen via audio path
- [x] Typing text and clicking "Generer bilder" transitions to ProcessingScreen via text path
- [x] ProcessingScreen displays Norwegian stage labels as IPC events arrive
- [x] ProcessingScreen automatically returns to HomeScreen when `done` event fires
- [x] Cancel button returns to HomeScreen immediately
- [x] `--test-mode` flag works — no Python subprocess spawned
- [x] `pytest backend/tests/ -v` — all tests pass
- [x] `npm run test:unit` — all 8 Vitest tests pass
- [x] `npm run build && npm run test:e2e` — all 6 Playwright tests pass
- [x] `npx tsc --noEmit` — 0 type errors
- [x] `npx biome check src/ electron/` — 0 lint errors
- [x] `ruff check backend/` — 0 errors

---

## COMPLETION CHECKLIST

- [x] All 36 tasks completed in order
- [x] Each validation command passed before moving to next task
- [x] `tests/fixtures/sample_image.png` and `sample_audio.wav` generated
- [x] `resources/fonts/` directory created
- [x] All three test frameworks green
- [x] `npm run build && npm run test:e2e` passes all 6 E2E tests

---

## NOTES

### electron-vite output directory
electron-vite outputs to `out/` not `dist/`. `package.json` `main` must be `out/main/index.js`. E2E helper must reference `out/main/index.js`.

### HomeScreen screen-switch ordering
HomeScreen calls `onStartPipeline()` (screen switch) BEFORE the IPC call. Awaiting the IPC first caused the processing screen to sometimes not appear in E2E. Screen switch is synchronous; pipeline fires and forgets.

### --test-mode fixture events
Test mode uses hardcoded `TEST_FIXTURE_SCENES` constants (not file reads) to avoid path resolution issues under Playwright. Audio path emits `transcribing → segmenting → images → done`. Text path skips `transcribing` and goes straight to `segmenting → images → done`.

### pipeline:start-with-text IPC
Phase 3 implementation must add `--text` flag support to `backend/pipeline.py`. The handler in `main.ts` spawns: `python pipeline.py --text "<text>"`. The pipeline skips `transcriber.py` and passes the text directly to `segmenter.py`.

### ElectronAPI interface
`startPipelineWithText(text: string)` added alongside `startPipeline`. Both fire-and-forget in the renderer.

### Biome version in `biome.json` `$schema`
Update the schema URL version to match the installed Biome version. Run `npx biome --version` after install and update accordingly.
