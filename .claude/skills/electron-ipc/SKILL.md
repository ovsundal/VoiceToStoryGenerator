---
name: electron-ipc
description: Electron main↔renderer IPC patterns for this project — contextBridge setup, typed ElectronAPI, spawning the Python pipeline as a child process, and forwarding streaming stdout events to the renderer.
---

# Electron IPC Patterns

This app uses the standard Electron security model: a preload script exposes a typed `window.electronAPI` to the renderer via `contextBridge`. The main process handles all Node.js operations including spawning the Python pipeline.

## Architecture

```
Renderer (React)
  └── window.electronAPI.startPipeline(audioPath)
        ↓ ipcRenderer.invoke
Preload (contextBridge)
        ↓
Main Process
  └── spawn('python', ['backend/pipeline.py', '--audio', audioPath])
        ↓ stdout JSON lines
  └── ipcMain → mainWindow.webContents.send('pipeline:progress', event)
        ↓ ipcRenderer.on
Renderer (React)
  └── onProgress callback → update UI state
```

---

## Preload Script

```typescript
// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';

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

export interface Scene {
  index: number;
  caption_no: string;
  image_path: string;
}

export interface ElectronAPI {
  startPipeline: (audioPath: string) => Promise<void>;
  cancelPipeline: () => Promise<void>;
  onPipelineEvent: (callback: (event: PipelineProgressEvent) => void) => () => void;
  startRecording: () => Promise<string>;  // returns temp audio file path
  stopRecording: () => Promise<string>;   // returns final audio file path
}

contextBridge.exposeInMainWorld('electronAPI', {
  startPipeline: (audioPath: string) =>
    ipcRenderer.invoke('pipeline:start', audioPath),

  cancelPipeline: () =>
    ipcRenderer.invoke('pipeline:cancel'),

  onPipelineEvent: (callback: (event: PipelineProgressEvent) => void) => {
    const handler = (_: unknown, event: PipelineProgressEvent) => callback(event);
    ipcRenderer.on('pipeline:event', handler);
    // Return cleanup function
    return () => ipcRenderer.removeListener('pipeline:event', handler);
  },

  startRecording: () => ipcRenderer.invoke('recording:start'),
  stopRecording: () => ipcRenderer.invoke('recording:stop'),
} satisfies ElectronAPI);
```

---

## Main Process — Spawning the Python Pipeline

```typescript
// electron/main.ts
import { app, BrowserWindow, ipcMain } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

let mainWindow: BrowserWindow;
let pipelineProcess: ChildProcess | null = null;

ipcMain.handle('pipeline:start', async (_, audioPath: string) => {
  if (pipelineProcess) return; // already running

  const pythonPath = path.join(app.getAppPath(), 'backend', '.venv', 'Scripts', 'python.exe');
  const scriptPath = path.join(app.getAppPath(), 'backend', 'pipeline.py');

  pipelineProcess = spawn(pythonPath, [scriptPath, '--audio', audioPath], {
    env: {
      ...process.env,
      PYTHONUNBUFFERED: '1',  // critical — ensures stdout is not buffered
    },
  });

  // Each line of stdout is a JSON event
  let buffer = '';
  pipelineProcess.stdout?.on('data', (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? ''; // keep incomplete last line

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
        event: 'error',
        message: `Pipeline exited with code ${code}`,
      });
    }
  });
});

ipcMain.handle('pipeline:cancel', async () => {
  pipelineProcess?.kill();
  pipelineProcess = null;
});
```

**`PYTHONUNBUFFERED: '1'`** is required — without it, Python buffers stdout and Electron receives events in batches rather than as they're emitted.

---

## Renderer — Consuming IPC Events

```typescript
// src/hooks/usePipeline.ts
import { useEffect, useState, useCallback } from 'react';
import type { PipelineProgressEvent, Scene } from '../preload/index';

interface PipelineState {
  stage: string | null;
  progress: { current: number; total: number } | null;
  scenes: Scene[];
  error: string | null;
  isRunning: boolean;
}

export function usePipeline() {
  const [state, setState] = useState<PipelineState>({
    stage: null, progress: null, scenes: [], error: null, isRunning: false,
  });

  const start = useCallback(async (audioPath: string) => {
    setState({ stage: 'starting', progress: null, scenes: [], error: null, isRunning: true });
    await window.electronAPI.startPipeline(audioPath);
  }, []);

  const cancel = useCallback(async () => {
    await window.electronAPI.cancelPipeline();
    setState(s => ({ ...s, isRunning: false }));
  }, []);

  useEffect(() => {
    const cleanup = window.electronAPI.onPipelineEvent((event: PipelineProgressEvent) => {
      setState(s => {
        switch (event.event) {
          case 'progress':
            return { ...s, stage: event.stage ?? s.stage,
              progress: event.index != null ? { current: event.index, total: event.total! } : s.progress };
          case 'scene':
            return { ...s, scenes: [...s.scenes, {
              index: event.index!, caption_no: event.caption_no!, image_path: event.image_path!
            }]};
          case 'done':
            return { ...s, isRunning: false, stage: 'done' };
          case 'error':
            return { ...s, isRunning: false, error: event.message ?? 'Unknown error' };
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

## TypeScript Global Declaration

Add to `src/renderer.d.ts` so TypeScript knows about `window.electronAPI`:

```typescript
import type { ElectronAPI } from './preload/index';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
```

---

## Key Rules

- **Never import Node.js modules in the renderer** (`fs`, `path`, `child_process`, etc.)
- **All Node.js operations go through ipcMain handlers** in the main process
- **contextBridge is the only bridge** — no `nodeIntegration: true`
- **Always return a cleanup function** from `onPipelineEvent` to prevent listener leaks
- **`PYTHONUNBUFFERED=1`** must be set when spawning Python or streaming won't work
