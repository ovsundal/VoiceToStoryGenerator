# Feature: Phase 4 — Settings Screen, Test Suite, & Packaging

The following plan should be complete, but validate codebase patterns and task sanity before implementing.
Pay special attention to naming of existing utils, types, and models. Import from the right files.

## Feature Description

Phase 4 completes the MVP. It adds a user-facing settings screen, fixes the E2E test suite to match
the current grid viewer, adds unit tests for ReviewScreen, wires `maxImages` end-to-end into the
Python pipeline, and produces a Windows NSIS installer via `electron-builder`.

## User Story

As a caregiver  
I want to configure how many images are produced and whether I review captions  
So that I can tailor the app to each autistic individual's needs and skip unnecessary steps

## Problem Statement

1. Users have no way to change `maxImages` (hardcoded at 5) or skip the caption review screen.
2. The Playwright E2E viewer tests reference `image-counter`, `next-button`, `prev-button` — DOM
   elements that no longer exist since the grid viewer replaced the slideshow in Phase 3. All three
   viewer tests fail.
3. `ReviewScreen` has no Vitest unit tests.
4. No `electron-builder` packaging config — the app can't be installed on a fresh machine.

## Solution Statement

- Add `useSettings` hook (localStorage, no new deps) + `SettingsScreen` component.
- Thread `maxImages` through `ElectronAPI → IPC → Python --max-scenes`.
- Honour `captionReview` flag in `App.tsx` to optionally skip `ReviewScreen`.
- Rewrite `viewer.spec.ts` for the grid viewer; add `ReviewScreen.test.tsx`.
- Add `electron-builder` NSIS config to `package.json`.

## Feature Metadata

**Feature Type**: Enhancement + polish  
**Estimated Complexity**: Medium  
**Primary Systems Affected**: App.tsx, HomeScreen, SettingsScreen (new), preload/index.ts, electron/main.ts, backend/pipeline.py, tests  
**Dependencies**: None new — `electron-builder` already in devDependencies

---

## CONTEXT REFERENCES

### Relevant Codebase Files — MUST READ BEFORE IMPLEMENTING

- `src/App.tsx` (full file) — screen routing, segmentedScenes + scenes useEffects to update
- `src/preload/index.ts` (full file) — `ElectronAPI` interface and contextBridge wiring to update
- `src/hooks/usePipeline.ts` (full file) — pattern to mirror for `useSettings`
- `src/screens/HomeScreen.tsx` (full file) — add gear icon + `onSettings` prop
- `src/screens/HomeScreen.css` (full file) — extend for gear icon button
- `src/screens/ReviewScreen.tsx` (full file) — existing component to write tests against
- `src/screens/ViewerScreen.tsx` + `.css` — grid layout (4-col, `data-testid="viewer-screen"`, `data-testid="scene-image"`, `data-testid="home-button"`)
- `src/screens/ProcessingScreen.tsx` (full file) — stageLabels pattern
- `src/index.css` (full file) — CSS variables: `--accent`, `--border`, `--text-primary`, etc.
- `electron/main.ts` (full file) — `pipeline:segment` IPC handler to update with `--max-scenes`
- `backend/pipeline.py` (full file) — argparse + `_run_segmentation()` to thread `max_scenes`
- `backend/segmenter.py:162` — `segment(model, transcript, max_scenes=5, personas=...)` already accepts the param
- `tests/e2e/viewer.spec.ts` (full file) — must be fully rewritten
- `tests/e2e/helpers.ts` (full file) — `launchApp()` pattern
- `tests/unit/hooks/usePipeline.test.ts` (full file) — Vitest test pattern to mirror
- `tests/unit/setup.ts` (full file) — global `window.electronAPI` mock to update
- `package.json` (full file) — add `build` config + `package` script
- `playwright.config.ts` (full file) — test timeout config

### New Files to Create

- `src/hooks/useSettings.ts` — localStorage-backed settings hook
- `src/screens/SettingsScreen.tsx` — settings UI (full screen, matches other screens)
- `src/screens/SettingsScreen.css` — styles mirroring existing screen CSS patterns
- `tests/unit/screens/ReviewScreen.test.tsx` — Vitest component tests for ReviewScreen

### Files to Update

- `src/App.tsx` — settings screen routing; honour `captionReview`; pass `maxImages` to segment
- `src/screens/HomeScreen.tsx` — add gear icon button + `onSettings` prop
- `src/screens/HomeScreen.css` — gear icon button styles
- `src/preload/index.ts` — add `maxImages?: number` to `segmentStory` payload type
- `electron/main.ts` — pass `--max-scenes` to Python; translate error messages to Norwegian
- `backend/pipeline.py` — add `--max-scenes` CLI arg; thread through `_run_segmentation()` + `run_segment_only()`
- `tests/e2e/viewer.spec.ts` — rewrite all three tests for grid viewer
- `tests/unit/setup.ts` — update `segmentStory` mock signature if needed
- `package.json` — add `electron-builder` config block + `"package"` script

### Relevant Documentation

- electron-builder NSIS target options: https://www.electron.build/configuration/nsis
  - Why: NSIS installer config (oneClick, directory choice, language)
- electron-builder file patterns: https://www.electron.build/configuration/contents
  - Why: Controls which files land in the installer (must include `backend/`, `resources/`)

### Patterns to Follow

**Hook pattern** (`src/hooks/usePipeline.ts`):
```typescript
// Reads initial state lazily, exposes typed state + actions
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => { /* read localStorage */ });
  const update = useCallback((partial: Partial<Settings>) => { /* write + setState */ }, []);
  return { settings, update };
}
```

**Screen CSS pattern** (all existing screens):
```css
.settings-screen {
  display: flex; flex-direction: column; align-items: center;
  min-height: 100vh; padding: 40px 32px;
  background: var(--bg-primary); gap: 24px;
}
```
CSS variables available: `--bg-primary`, `--bg-secondary`, `--text-primary`, `--text-secondary`,
`--accent`, `--accent-hover`, `--border`, `--danger`

**Screen prop pattern** (`src/App.tsx`):
All screens receive handler callbacks as props. Settings screen receives `onBack: () => void` and
`settings + onUpdate` from the shared `useSettings` call in App.

**IPC payload extension pattern** (`src/preload/index.ts`):
```typescript
// Extend existing payload shape, all additions optional
segmentStory: (payload: { audioPath?: string; text?: string; maxImages?: number }) => Promise<SegmentedScene[]>
```

**Python argparse pattern** (`backend/pipeline.py`):
```python
parser.add_argument('--max-scenes', type=int, default=5, help='Maximum number of scenes (3–8)')
```

**Vitest component test pattern** (`tests/unit/hooks/usePipeline.test.ts`):
```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, vi } from 'vitest';
```

**data-testid conventions** (existing):
- Screens: `data-testid="<screen>-screen"` (e.g. `"settings-screen"`)
- Primary actions: `data-testid="<action>-button"` (e.g. `"back-button"`)
- Form inputs: `data-testid="<name>-input"` or `data-testid="<name>-toggle"`

---

## IMPLEMENTATION PLAN

### Phase A: Settings Foundation

Build `useSettings` hook + `SettingsScreen`, then wire them into `App.tsx` and `HomeScreen`.
Nothing in the pipeline changes yet — this phase is renderer-only.

### Phase B: maxImages end-to-end

Thread `maxImages` from settings through `ElectronAPI → IPC → Python --max-scenes`.
`segmenter.py` already accepts the param; only the plumbing needs adding.

### Phase C: Test Suite

Fix the broken E2E viewer tests; add ReviewScreen unit tests.

### Phase D: Packaging

Add `electron-builder` config to `package.json`.

---

## STEP-BY-STEP TASKS

### CREATE `src/hooks/useSettings.ts`

- **IMPLEMENT**: `Settings` interface with `maxImages: number` (default 5, range 3–8) and `captionReview: boolean` (default true)
- **IMPLEMENT**: `STORAGE_KEY = 'story-to-images:settings'` constant
- **IMPLEMENT**: `DEFAULTS: Settings = { maxImages: 5, captionReview: true }`
- **IMPLEMENT**: `useSettings()` hook — lazy `useState` init reads `localStorage.getItem(STORAGE_KEY)`, merges over defaults with `try/catch` (malformed JSON → use defaults)
- **IMPLEMENT**: `update(partial: Partial<Settings>)` via `useCallback` — merges partial, writes `localStorage.setItem(STORAGE_KEY, JSON.stringify(next))`, calls `setState`
- **PATTERN**: Mirror `src/hooks/usePipeline.ts` for hook structure
- **GOTCHA**: `localStorage` is not available in Vitest's jsdom without the import. Add `try/catch` around both read and write for safety.
- **VALIDATE**: `npm run typecheck`

### CREATE `src/screens/SettingsScreen.tsx`

- **IMPLEMENT**: Props: `settings: Settings`, `onUpdate: (partial: Partial<Settings>) => void`, `onBack: () => void`
- **IMPLEMENT**: Root div: `className="settings-screen"` `data-testid="settings-screen"`
- **IMPLEMENT**: `<h1 className="settings-title">Innstillinger</h1>`
- **IMPLEMENT**: Section for "Antall bilder" — `<input type="range" min={3} max={8} value={settings.maxImages} onChange={…}/>` with displayed value label. `data-testid="max-images-input"`
- **IMPLEMENT**: Section for "Vis bildetekstgjennomgang" — `<input type="checkbox" checked={settings.captionReview} onChange={…}/>` with Norwegian label. `data-testid="caption-review-toggle"`
- **IMPLEMENT**: Back button: `<button className="settings-back-button" data-testid="back-button" onClick={onBack}>Tilbake</button>`
- **GOTCHA**: Do NOT call `useSettings()` inside SettingsScreen — receive settings as props from App.tsx to avoid double-state and stale-closure issues.
- **VALIDATE**: `npm run typecheck`

### CREATE `src/screens/SettingsScreen.css`

- **IMPLEMENT**: `.settings-screen` — `display: flex; flex-direction: column; align-items: center; min-height: 100vh; padding: 40px 32px; background: var(--bg-primary); gap: 32px;`
- **IMPLEMENT**: `.settings-title` — mirror `.review-title` (font-size: 1.8rem, font-weight: 700)
- **IMPLEMENT**: `.settings-section` — `width: 100%; max-width: 480px; display: flex; flex-direction: column; gap: 12px;`
- **IMPLEMENT**: `.settings-section-label` — `font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em;`
- **IMPLEMENT**: `.settings-row` — `display: flex; align-items: center; justify-content: space-between; gap: 16px;`
- **IMPLEMENT**: `.settings-range` — `flex: 1; accent-color: var(--accent);`
- **IMPLEMENT**: `.settings-value` — `font-size: 1.1rem; font-weight: 700; color: var(--text-primary); min-width: 2ch; text-align: right;`
- **IMPLEMENT**: `.settings-back-button` — mirror `.review-cancel-button`: `padding: 12px 28px; font-size: 1rem; color: var(--text-secondary); border: 1.5px solid var(--border); border-radius: 8px; transition: background-color 150ms ease;`
- **VALIDATE**: Visual check only — no automated CSS validation needed

### UPDATE `src/screens/HomeScreen.tsx`

- **ADD**: `onSettings: () => void` to `HomeScreenProps` interface
- **ADD**: Gear icon button in JSX (top-right corner, positioned absolutely): 
  ```tsx
  <button className="settings-icon-button" data-testid="settings-button" onClick={onSettings} type="button" aria-label="Innstillinger">⚙</button>
  ```
- **GOTCHA**: Use `aria-label` not visible text — the ⚙ Unicode char is the button content
- **VALIDATE**: `npm run typecheck`

### UPDATE `src/screens/HomeScreen.css`

- **ADD**: `.settings-icon-button` — absolute positioning top-right: `position: absolute; top: 20px; right: 24px; font-size: 1.4rem; color: var(--text-secondary); padding: 6px; border-radius: 6px; transition: color 150ms ease, background-color 150ms ease; line-height: 1;`
- **ADD**: `.settings-icon-button:hover` — `color: var(--text-primary); background: var(--bg-secondary);`
- **ADD** to `.home-screen`: `position: relative;` (required for absolute child positioning)
- **VALIDATE**: Dev server visual check

### UPDATE `src/App.tsx`

- **ADD**: `import { useSettings } from './hooks/useSettings';`
- **ADD**: `import { SettingsScreen } from './screens/SettingsScreen';`
- **ADD**: `'settings'` to the `Screen` union type
- **ADD**: `const { settings, update: updateSettings } = useSettings();` at the top of `App()`
- **UPDATE** `handleStartSegment`: pass `maxImages: settings.maxImages` in the call to `pipeline.segment(payload)`. The `segment` function signature needs updating too — see below.
- **UPDATE** `useEffect` for `pipeline.segmentedScenes`:
  ```typescript
  useEffect(() => {
    if (pipeline.segmentedScenes !== null && screen === 'processing') {
      if (settings.captionReview) {
        setPendingScenes(pipeline.segmentedScenes);
        setScreen('review');
      } else {
        // Skip review — go straight to image generation
        handleGenerate(pipeline.segmentedScenes);
      }
    }
  }, [pipeline.segmentedScenes, screen, settings.captionReview]);
  ```
- **GOTCHA**: `handleGenerate` must be defined before this `useEffect` or wrapped in `useCallback`. Currently it's a plain function — wrap it in `useCallback` to satisfy the deps array.
- **ADD**: `handleGoToSettings = () => setScreen('settings');`
- **UPDATE**: `<HomeScreen onStartSegment={handleStartSegment} onSettings={handleGoToSettings} />`
- **ADD**: `{screen === 'settings' && <SettingsScreen settings={settings} onUpdate={updateSettings} onBack={() => setScreen('home')} />}`
- **GOTCHA**: The `handleGenerate` dependency in the captionReview useEffect creates a risk of stale closure. Use the `useCallback` pattern and add it to deps, or read `settings.captionReview` directly in the effect and call `pipeline.generateImages` + `window.electronAPI.getOutputDir()` directly instead of delegating to `handleGenerate`.
- **VALIDATE**: `npm run typecheck`

### UPDATE `src/hooks/usePipeline.ts`

- **UPDATE** `segment` callback signature:
  ```typescript
  const segment = useCallback(async (payload: { audioPath?: string; text?: string; maxImages?: number }) => {
    setState({ ...INITIAL_STATE, stage: 'starting', isRunning: true });
    const scenes = await window.electronAPI.segmentStory(payload);
    setState((s) => ({ ...s, segmentedScenes: scenes, isRunning: false }));
    return scenes;
  }, []);
  ```
- **PATTERN**: Mirror existing segment in `src/hooks/usePipeline.ts:39`
- **VALIDATE**: `npm run typecheck`

### UPDATE `src/preload/index.ts`

- **UPDATE** `ElectronAPI.segmentStory` type:
  ```typescript
  segmentStory: (payload: { audioPath?: string; text?: string; maxImages?: number }) => Promise<SegmentedScene[]>;
  ```
- **UPDATE** contextBridge implementation of `segmentStory` — already passes payload through, no change needed in the actual implementation
- **VALIDATE**: `npm run typecheck`

### UPDATE `electron/main.ts` — `pipeline:segment` handler

- **UPDATE** the `payload` type annotation:
  ```typescript
  async (_, payload: { audioPath?: string; text?: string; maxImages?: number })
  ```
- **UPDATE** the `args` array for the real (non-test-mode) subprocess spawn:
  ```typescript
  const maxScenes = payload.maxImages ?? 5;
  const args = payload.text
    ? [scriptPath, '--text', payload.text, '--segment-only', '--max-scenes', String(maxScenes)]
    : [scriptPath, '--audio', payload.audioPath ?? '', '--segment-only', '--max-scenes', String(maxScenes)];
  ```
- **UPDATE** Norwegian error strings — currently English user-facing errors go through `pipeline:event` with `message` field. Change in the `pipeline:start`, `pipeline:start-with-text`, and `pipeline:generate` close handlers:
  ```typescript
  // Before:
  message: `Pipeline exited with code ${code}`
  // After:
  message: `Rørledningen avsluttet uventet (kode ${code})`
  ```
  And for generate:
  ```typescript
  message: `Bildegenerering avsluttet uventet (kode ${code})`
  ```
- **VALIDATE**: `npm run typecheck`

### UPDATE `backend/pipeline.py` — thread max_scenes

- **ADD** to argparse section (near existing `--segment-only`):
  ```python
  parser.add_argument('--max-scenes', type=int, default=5,
                      help='Maximum number of scenes to generate (3–8)')
  ```
- **UPDATE** `_run_segmentation()` signature:
  ```python
  def _run_segmentation(text: str, max_scenes: int = 5) -> list[dict]:
  ```
  Inside the function, change the `segment()` call:
  ```python
  return segment(model, text, max_scenes=max_scenes, personas=PERSONAS)
  ```
- **UPDATE** `run()` function signature and internal call:
  ```python
  def run(audio_path: str | None, text: str | None, output_dir: str, max_scenes: int = 5) -> None:
      # ...
      scenes = _run_segmentation(text, max_scenes=max_scenes)
  ```
- **UPDATE** `run_segment_only()` function:
  ```python
  def run_segment_only(audio_path: str | None, text: str | None, max_scenes: int = 5) -> None:
      # ...
      scenes = _run_segmentation(text, max_scenes=max_scenes)
  ```
- **UPDATE** `__main__` block dispatch:
  ```python
  if args.segment_only:
      run_segment_only(audio_path=args.audio, text=args.text, max_scenes=args.max_scenes)
      sys.exit(0)
  run(audio_path=args.audio, text=args.text, output_dir=args.output, max_scenes=args.max_scenes)
  ```
- **GOTCHA**: `segmenter.segment()` already accepts `max_scenes` at line 162 — no changes to `segmenter.py` needed
- **VALIDATE**: `python -m pytest backend/tests/ -m "not slow" -v`

### REWRITE `tests/e2e/viewer.spec.ts`

Remove all references to `image-counter`, `next-button`, `prev-button` — these were from the old
slideshow design. The current ViewerScreen is a grid (4 columns) with `data-testid="scene-image"`
on each `<img>` and `data-testid="home-button"` on the return button.

**New test content:**
```typescript
import { test, expect } from '@playwright/test';
import { launchApp } from './helpers';

test('full flow: text input → processing → review → generating → viewer grid', async () => {
  const { app, page } = await launchApp();

  await page.getByTestId('story-textarea').fill('Nils vasker hendene og tar på seg jakken.');
  await page.getByTestId('submit-text-button').click();
  await expect(page.getByTestId('processing-screen')).toBeVisible({ timeout: 3_000 });
  await expect(page.getByTestId('review-screen')).toBeVisible({ timeout: 10_000 });
  await page.getByTestId('generate-button').click();
  await expect(page.getByTestId('processing-screen')).toBeVisible({ timeout: 3_000 });

  // Viewer screen appears with at least one image in the grid
  await expect(page.getByTestId('viewer-screen')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('scene-image').first()).toBeVisible({ timeout: 5_000 });

  // Return to home
  await page.getByTestId('home-button').click();
  await expect(page.getByTestId('record-button')).toBeVisible({ timeout: 3_000 });

  await app.close();
});

test('cancel on review screen returns to home', async () => {
  const { app, page } = await launchApp();

  await page.getByTestId('story-textarea').fill('Barnet vasker hendene.');
  await page.getByTestId('submit-text-button').click();
  await expect(page.getByTestId('review-screen')).toBeVisible({ timeout: 10_000 });

  await page.getByRole('button', { name: 'Avbryt' }).click();
  await expect(page.getByTestId('record-button')).toBeVisible({ timeout: 3_000 });

  await app.close();
});

test('home-button is enabled after generation completes', async () => {
  const { app, page } = await launchApp();

  await page.getByTestId('story-textarea').fill('Barnet vasker hendene.');
  await page.getByTestId('submit-text-button').click();
  await expect(page.getByTestId('review-screen')).toBeVisible({ timeout: 10_000 });
  await page.getByTestId('generate-button').click();
  await expect(page.getByTestId('viewer-screen')).toBeVisible({ timeout: 15_000 });

  // After done event, home-button must be enabled
  await expect(page.getByTestId('home-button')).toBeEnabled({ timeout: 10_000 });

  await app.close();
});
```

- **VALIDATE**: `npx playwright test tests/e2e/viewer.spec.ts` (requires `npm run build` first — E2E loads `out/main/index.js`)

### CREATE `tests/unit/screens/ReviewScreen.test.tsx`

- **IMPLEMENT**: Mirror test structure from `tests/unit/hooks/usePipeline.test.ts`
- **IMPLEMENT**: Use `@testing-library/react` `render` + `screen` + `fireEvent` / `userEvent`
- **IMPLEMENT**: MOCK_SCENES fixture with 2 items (same shape as existing test mocks)
- **IMPLEMENT**: Tests:
  1. `renders correct number of caption inputs` — `screen.getAllByTestId(/caption-input-/)` has length 2
  2. `editing a caption updates the input value` — `userEvent.clear` + `userEvent.type` on `caption-input-0`, assert new value
  3. `remove button reduces scene count` — click first `aria-label="Fjern bilde 1"` button, assert only 1 input remains
  4. `add scene button appends a blank scene` — click `+ Legg til bilde`, assert 3 inputs
  5. `generate button is disabled when all scenes removed` — remove all scenes, assert `generate-button` is disabled
  6. `generate button calls onGenerate with current captions` — provide `onGenerate` spy, click generate, assert called with edited data
  7. `cancel button calls onCancel` — provide `onCancel` spy, click `Avbryt`, assert called
- **GOTCHA**: `window.electronAPI` is already mocked in `tests/unit/setup.ts` — no per-test setup needed for ReviewScreen
- **PATTERN**: `tests/unit/hooks/useRecorder.test.ts` for `userEvent` usage pattern
- **VALIDATE**: `npm run test:unit`

### UPDATE `package.json` — electron-builder packaging config

Add a top-level `"build"` key after `"devDependencies"` and a `"package"` script:

```json
"scripts": {
  ...existing scripts...,
  "package": "electron-builder --win"
},
"build": {
  "appId": "no.storyimages.app",
  "productName": "Fortelling til bilder",
  "copyright": "Copyright © 2026",
  "directories": { "output": "dist" },
  "files": [
    "out/**/*",
    "resources/fonts/**/*",
    "resources/icons/**/*",
    "backend/**/*",
    "!backend/.venv/**/*",
    "!backend/__pycache__/**/*",
    "!backend/tests/**/*"
  ],
  "extraResources": [
    { "from": "resources/models", "to": "models", "filter": ["**/*"] }
  ],
  "win": {
    "target": [{ "target": "nsis", "arch": ["x64"] }],
    "icon": "resources/icons/icon.png"
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "installerLanguages": ["English"],
    "createDesktopShortcut": true
  }
}
```

- **GOTCHA**: `extraResources` for `resources/models` uses `filter: ["**/*"]` — models are gitignored but need to ship. Document in README that `resources/models/` must be populated before running `npm run package`.
- **GOTCHA**: Exclude `backend/.venv` from `files` — Python venv is per-machine and must be set up by the user post-install. Document in README.
- **VALIDATE**: `npm run build && npm run package` — verify `dist/` contains a `.exe` installer

---

## TESTING STRATEGY

### Unit Tests (Vitest)

**New:** `tests/unit/screens/ReviewScreen.test.tsx`
- 7 focused tests covering render, edit, add, remove, generate callback, cancel callback
- No mocking beyond the global `window.electronAPI` already in `tests/unit/setup.ts`

**Existing tests should continue to pass without modification:**
- `tests/unit/hooks/usePipeline.test.ts` — the `segment` call now accepts `maxImages` but existing tests pass `{ text: '...' }` which still works (optional param)
- `tests/unit/hooks/useRecorder.test.ts` — no changes

### E2E Tests (Playwright)

**Rewritten:** `tests/e2e/viewer.spec.ts` — 3 tests matching the actual grid viewer DOM
**Unchanged:** `tests/e2e/home.spec.ts`, `tests/e2e/pipeline.spec.ts` — no DOM changes in those screens

### Edge Cases to Verify

- `captionReview=false`: App skips ReviewScreen, goes directly from segmentation to image generation and then to Viewer
- `maxImages=3`: Python produces exactly 3 scenes (passed as `--max-scenes 3`)
- `maxImages=8`: Python produces up to 8 scenes
- Settings persist across page reloads (write to localStorage, refresh, read back)
- SettingsScreen back button returns to HomeScreen without losing text textarea content (settings is a sibling screen, not replacing Home state)

---

## VALIDATION COMMANDS

### Level 1: TypeScript + Lint

```bash
npm run typecheck
npm run lint
```

Expected: zero errors

### Level 2: Unit Tests

```bash
npm run test:unit
```

Expected: all existing tests pass + 7 new ReviewScreen tests pass

### Level 3: Python Tests

```bash
npm run test:python
```

Expected: all backend tests pass (no changes to segmenter.py model logic)

### Level 4: E2E Tests

```bash
npm run build
npx playwright test
```

Expected: all 3 viewer tests + home tests + pipeline tests pass

### Level 5: Manual Smoke Tests

1. Launch app (`npm run dev`), click gear icon → SettingsScreen appears
2. Move `maxImages` slider to 3, close settings, record/type a story → only 3 scenes segmented
3. Toggle `captionReview=false`, run a story → ReviewScreen is skipped, viewer appears directly
4. Toggle `captionReview=true` → ReviewScreen appears again
5. Settings survive app restart (check localStorage in DevTools)

---

## ACCEPTANCE CRITERIA

- [ ] SettingsScreen accessible from HomeScreen via gear icon (`data-testid="settings-button"`)
- [ ] `maxImages` slider 3–8, default 5; persists across restarts
- [ ] `captionReview` toggle; when off, ReviewScreen is skipped
- [ ] `maxImages` value reaches `segmenter.segment()` as `max_scenes` arg
- [ ] All Playwright E2E tests pass (no references to defunct `image-counter`, `next-button`, `prev-button`)
- [ ] 7 new Vitest tests for ReviewScreen pass
- [ ] `npm run typecheck` — zero errors
- [ ] `npm run lint` — zero errors
- [ ] `npm run test` (unit + python) — all pass
- [ ] `npm run package` produces `dist/*.exe`
- [ ] Norwegian strings used for all user-facing error messages in `electron/main.ts`

---

## COMPLETION CHECKLIST

- [ ] `src/hooks/useSettings.ts` created
- [ ] `src/screens/SettingsScreen.tsx` + `SettingsScreen.css` created
- [ ] `src/screens/HomeScreen.tsx` updated with gear icon + `onSettings` prop
- [ ] `src/App.tsx` updated (settings screen, captionReview flow, maxImages threading)
- [ ] `src/hooks/usePipeline.ts` updated (maxImages in segment payload)
- [ ] `src/preload/index.ts` updated (maxImages in type)
- [ ] `electron/main.ts` updated (`--max-scenes` arg, Norwegian error strings)
- [ ] `backend/pipeline.py` updated (`--max-scenes` CLI + `_run_segmentation` + `run_segment_only`)
- [ ] `tests/e2e/viewer.spec.ts` rewritten for grid viewer
- [ ] `tests/unit/screens/ReviewScreen.test.tsx` created
- [ ] `package.json` updated with `electron-builder` config + `package` script
- [ ] All validation commands pass

---

## NOTES

### Why localStorage (not electron-store)

`electron-store` is not in `package.json`. `localStorage` is available in Electron's renderer
process and is sufficient for 2 settings values. Adding a new dependency for this is unnecessary
overhead. Settings are renderer-managed, no main-process access needed.

### Why settings in App.tsx (not SettingsScreen)

`useSettings()` is called once in `App.tsx` and passed down as props. This avoids two separate
`useSettings()` instances (App + SettingsScreen) reading/writing independently and getting out of
sync. React state flows downward; write happens in one place.

### Why captionReview flow uses segmentedScenes useEffect

The existing architecture already uses `useEffect` on `segmentedScenes` to navigate to ReviewScreen.
Inserting the `captionReview` check into that same `useEffect` is the minimal diff — no new state
machine needed.

### handleGenerate + useCallback note

When `captionReview=false`, the `segmentedScenes` useEffect must call `handleGenerate`. To avoid
stale closure issues, either:
a) Wrap `handleGenerate` in `useCallback` and add it to deps, or
b) Inline the generate logic in the effect (call `window.electronAPI.getOutputDir()` + `pipeline.generateImages()` directly)

Option (b) is simpler and avoids the useCallback boilerplate.

### NotoSans-Bold.ttf status

The font appears in the tracked file list (`resources/fonts/NotoSans-Bold.ttf`) — it IS committed
to git. The Phase 3 handover note predates the commit. No action needed.

### electron-builder and Python venv

The NSIS installer cannot bundle a Python venv (too large, machine-specific). The `files` config
excludes `backend/.venv`. Post-install setup steps (create venv, `pip install -r requirements.txt`)
must be documented in README. This is acceptable for the MVP — "Python environment setup complexity
for end users" is listed as a High risk in the PRD, deferred to v1.1 bundled installer.

### Confidence Score: 8/10

The main risk is the `captionReview=false` useEffect — it calls an async function (`handleGenerate`)
from inside an effect, which requires care around the `useCallback` dependency. The inline option
(b) above eliminates this risk. Everything else is straightforward plumbing.
