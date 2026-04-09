---
name: testing
description: Testing strategy for this project — Playwright E2E for Electron, Vitest for React components, pytest for the Python pipeline. Covers test structure, mocking the Python subprocess, and running each layer independently.
---

# Testing Strategy

Three independent test layers, each runnable separately:

| Layer | Tool | What it covers |
|---|---|---|
| E2E | Playwright (`_electron` API) | Full Electron app — UI flows, IPC, screen transitions |
| Unit (TS) | Vitest + React Testing Library | React components, hooks, utility functions |
| Unit (Python) | pytest + monkeypatch | Pipeline steps — transcription, segmentation, image gen, caption |

---

## Test Structure

```
tests/
  e2e/                    # Playwright Electron tests
    home.spec.ts
    pipeline.spec.ts
    viewer.spec.ts
  unit/                   # Vitest React/TS tests
    components/
    hooks/
  fixtures/               # Shared test assets
    sample_story.json     # Pre-recorded pipeline output
    sample_image.png      # Placeholder 1024x1024 image
    sample_audio.wav      # Short Norwegian speech sample
backend/
  tests/
    conftest.py
    test_transcriber.py
    test_segmenter.py
    test_image_generator.py
    test_caption_renderer.py
    test_pipeline.py      # Integration: full pipeline with mocked models
```

---

## E2E Testing — Playwright for Electron

Playwright's `_electron` API launches the real Electron binary and drives it like a browser. Works on Windows without a display server.

### Setup

```bash
npm install --save-dev @playwright/test
```

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  use: {
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});
```

### Launching the App in Tests

```typescript
// tests/e2e/helpers.ts
import { _electron as electron, ElectronApplication, Page } from '@playwright/test';
import path from 'path';

export async function launchApp(): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({
    args: [path.join(__dirname, '../../dist/main.js'), '--test-mode'],
  });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return { app, page };
}
```

### Example E2E Test

```typescript
// tests/e2e/pipeline.spec.ts
import { test, expect } from '@playwright/test';
import { launchApp } from './helpers';

test('completes full story pipeline from home to viewer', async () => {
  const { app, page } = await launchApp();

  // Home screen — record button visible
  await expect(page.getByTestId('record-button')).toBeVisible();

  // Simulate pipeline start (test mode uses fixture audio)
  await page.getByTestId('record-button').click();
  await page.getByTestId('record-button').click(); // stop

  // Processing screen — progress visible
  await expect(page.getByTestId('processing-screen')).toBeVisible();
  await expect(page.getByText(/Transkriberer/i)).toBeVisible();

  // Viewer screen — images loaded
  await expect(page.getByTestId('viewer-screen')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('scene-image')).toBeVisible();
  await expect(page.getByTestId('caption-text')).toBeVisible();

  // Navigation works
  await page.getByTestId('next-button').click();
  await expect(page.getByText('2 av')).toBeVisible();

  await app.close();
});
```

### `--test-mode` Flag

Add to Electron main — emits fixture data instead of spawning the real Python pipeline:

```typescript
// electron/main.ts
const isTestMode = process.argv.includes('--test-mode');

ipcMain.handle('pipeline:start', async (_, audioPath: string) => {
  if (isTestMode) {
    // Emit fixture events with realistic delays
    const fixture = require('../tests/fixtures/sample_story.json');
    setTimeout(() => mainWindow.webContents.send('pipeline:event',
      { event: 'progress', stage: 'transcribing' }), 200);
    setTimeout(() => mainWindow.webContents.send('pipeline:event',
      { event: 'progress', stage: 'segmenting' }), 600);
    fixture.scenes.forEach((scene: Scene, i: number) => {
      setTimeout(() => mainWindow.webContents.send('pipeline:event', {
        event: 'scene', ...scene
      }), 1000 + i * 500);
    });
    setTimeout(() => mainWindow.webContents.send('pipeline:event',
      { event: 'done', scenes: fixture.scenes }), 1000 + fixture.scenes.length * 500);
    return;
  }
  // ... real pipeline spawn
});
```

### `tests/fixtures/sample_story.json`

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

---

## Unit Testing — Vitest (React/TypeScript)

Use Vitest, not Jest. Vitest integrates natively with `electron-vite` — no Babel config needed, TypeScript works out of the box.

```bash
npm install --save-dev vitest @testing-library/react @testing-library/user-event jsdom
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/unit/setup.ts'],
  },
});
```

```typescript
// tests/unit/hooks/usePipeline.test.ts
import { renderHook, act } from '@testing-library/react';
import { usePipeline } from '../../../src/hooks/usePipeline';
import { vi } from 'vitest';

// Mock window.electronAPI
beforeEach(() => {
  window.electronAPI = {
    startPipeline: vi.fn().mockResolvedValue(undefined),
    cancelPipeline: vi.fn().mockResolvedValue(undefined),
    onPipelineEvent: vi.fn().mockReturnValue(() => {}),
    startRecording: vi.fn().mockResolvedValue('/tmp/audio.wav'),
    stopRecording: vi.fn().mockResolvedValue('/tmp/audio.wav'),
  };
});

test('start sets isRunning to true', async () => {
  const { result } = renderHook(() => usePipeline());
  await act(async () => { await result.current.start('/tmp/audio.wav'); });
  expect(result.current.isRunning).toBe(true);
});
```

---

## Unit Testing — pytest (Python Pipeline)

```bash
pip install pytest pytest-mock
```

Mock all model loading — never load real weights in unit tests:

```python
# backend/tests/conftest.py
import pytest
from PIL import Image
from pathlib import Path

@pytest.fixture(autouse=True)
def mock_models(monkeypatch):
    """Replace all heavy model loading with fast fakes."""
    monkeypatch.setattr("backend.transcriber.load_model", lambda *a, **kw: FakeWhisper())
    monkeypatch.setattr("backend.segmenter.load_model", lambda *a, **kw: FakeLLM())
    monkeypatch.setattr("backend.image_generator.load_pipeline", lambda *a, **kw: FakeFlux())

class FakeWhisper:
    def transcribe(self, path, **kw):
        return [type("S", (), {"text": "Barnet vasker hendene og tørker seg."})()], None

class FakeLLM:
    def create_chat_completion(self, **kw):
        return {"choices": [{"message": {"content":
            '[{"prompt_en": "child washing hands", "caption_no": "Vasker hendene"}]'
        }}]}

class FakeFlux:
    def __call__(self, prompt, **kw):
        img = Image.new("RGB", (1024, 1024), color=(200, 200, 200))
        return type("R", (), {"images": [img]})()
```

```python
# backend/tests/test_pipeline.py
def test_full_pipeline_emits_expected_json_lines(tmp_path, capsys, sample_audio):
    from backend.pipeline import run
    run(audio_path=str(sample_audio), output_dir=str(tmp_path))

    captured = capsys.readouterr()
    lines = [json.loads(l) for l in captured.out.strip().splitlines()]
    events = [l["event"] for l in lines]

    assert "progress" in events
    assert "scene" in events
    assert events[-1] == "done"
    assert all("image_path" in l for l in lines if l["event"] == "scene")
```

Mark slow integration tests (real models) separately:

```python
@pytest.mark.slow
def test_real_transcription_norwegian():
    ...  # only runs with: pytest -m slow
```

---

## npm Scripts

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:unit": "vitest run",
    "test:python": "pytest backend/tests/ -m 'not slow'",
    "test:python:slow": "pytest backend/tests/ -m slow",
    "test": "npm run test:unit && npm run test:python"
  }
}
```

E2E requires a built app — run `npm run build` first, then `npm run test:e2e`. Keep E2E as a separate CI step from unit tests.

---

## `data-testid` Convention

All interactive and key display elements must have `data-testid` attributes — Playwright locators depend on them:

| Element | `data-testid` |
|---|---|
| Record button | `record-button` |
| Processing screen | `processing-screen` |
| Viewer screen | `viewer-screen` |
| Current scene image | `scene-image` |
| Caption text | `caption-text` |
| Next button | `next-button` |
| Previous button | `prev-button` |
| New story button | `new-story-button` |
| Progress stage label | `progress-stage` |
