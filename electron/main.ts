import { type ChildProcess, spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { BrowserWindow, Menu, app, ipcMain, protocol } from 'electron';

function loadDotEnv(): void {
  const envPath = join(app.getAppPath(), '.env');
  try {
    const content = require('node:fs').readFileSync(envPath, 'utf8') as string;
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (key && !(key in process.env)) process.env[key] = value;
    }
  } catch {
    // No .env file — that's fine
  }
}

loadDotEnv();

// Must be called before app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'localfile', privileges: { secure: true, standard: true, supportFetchAPI: true } },
]);

const isTestMode = process.argv.includes('--test-mode');
let mainWindow: BrowserWindow;
let pipelineProcess: ChildProcess | null = null;
let transcriptionProcess: ChildProcess | null = null;

// Hardcoded fixture for test mode — avoids file-read failures in CI/E2E
const TEST_FIXTURE_SCENES = [
  { index: 0, caption_no: 'Vasker hendene', prompt_en: 'child washing hands at sink' },
  { index: 1, caption_no: 'Tørker hendene', prompt_en: 'child drying hands with towel' },
  { index: 2, caption_no: 'Tar på seg jakken', prompt_en: 'child putting on jacket' },
];

function emitFixtureEvents(): void {
  const imagePath = join(app.getAppPath(), 'tests', 'fixtures', 'sample_image.png');

  setTimeout(
    () =>
      mainWindow.webContents.send('pipeline:event', { event: 'progress', stage: 'transcribing' }),
    200
  );
  setTimeout(
    () => mainWindow.webContents.send('pipeline:event', { event: 'progress', stage: 'segmenting' }),
    700
  );

  TEST_FIXTURE_SCENES.forEach((scene, i) => {
    const delay = 1200 + i * 600;
    setTimeout(
      () =>
        mainWindow.webContents.send('pipeline:event', {
          event: 'progress',
          stage: 'generating_image',
          index: i + 1,
          total: TEST_FIXTURE_SCENES.length,
        }),
      delay - 100
    );
    setTimeout(
      () =>
        mainWindow.webContents.send('pipeline:event', {
          event: 'scene',
          index: scene.index,
          caption_no: scene.caption_no,
          image_path: imagePath,
        }),
      delay
    );
  });

  const doneDelay = 1200 + TEST_FIXTURE_SCENES.length * 600 + 200;
  setTimeout(
    () =>
      mainWindow.webContents.send('pipeline:event', {
        event: 'done',
        scenes: TEST_FIXTURE_SCENES.map((s) => ({ ...s, image_path: imagePath })),
      }),
    doneDelay
  );
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: join(app.getAppPath(), 'resources', 'icons', 'icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  protocol.handle('localfile', async (request) => {
    const filePath = decodeURIComponent(request.url.slice('localfile:///'.length));
    const data = await fs.readFile(filePath);
    return new Response(data, { headers: { 'content-type': 'image/png' } });
  });

  Menu.setApplicationMenu(null);
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
    emitFixtureEvents();
    return;
  }

  if (pipelineProcess) return;

  const pythonPath = join(app.getAppPath(), 'backend', '.venv', 'Scripts', 'python.exe');
  const scriptPath = join(app.getAppPath(), 'backend', 'pipeline.py');
  const outputDir = join(app.getPath('temp'), `story_${Date.now()}`);
  await fs.mkdir(outputDir, { recursive: true });

  pipelineProcess = spawn(pythonPath, [scriptPath, '--audio', audioPath, '--output', outputDir], {
    env: { ...process.env, PYTHONUNBUFFERED: '1', PYTHONUTF8: '1' },
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
        event: 'error',
        message: `Pipeline exited with code ${code}`,
      });
    }
  });
});

ipcMain.handle('pipeline:start-with-text', async (_, _text: string) => {
  if (isTestMode) {
    const imagePath = join(app.getAppPath(), 'tests', 'fixtures', 'sample_image.png');

    setTimeout(
      () =>
        mainWindow.webContents.send('pipeline:event', { event: 'progress', stage: 'segmenting' }),
      200
    );

    TEST_FIXTURE_SCENES.forEach((scene, i) => {
      const delay = 700 + i * 600;
      setTimeout(
        () =>
          mainWindow.webContents.send('pipeline:event', {
            event: 'progress',
            stage: 'generating_image',
            index: i + 1,
            total: TEST_FIXTURE_SCENES.length,
          }),
        delay - 100
      );
      setTimeout(
        () =>
          mainWindow.webContents.send('pipeline:event', {
            event: 'scene',
            index: scene.index,
            caption_no: scene.caption_no,
            image_path: imagePath,
          }),
        delay
      );
    });

    const doneDelay = 700 + TEST_FIXTURE_SCENES.length * 600 + 200;
    setTimeout(
      () =>
        mainWindow.webContents.send('pipeline:event', {
          event: 'done',
          scenes: TEST_FIXTURE_SCENES.map((s) => ({ ...s, image_path: imagePath })),
        }),
      doneDelay
    );
    return;
  }

  if (pipelineProcess) return;

  const pythonPath = join(app.getAppPath(), 'backend', '.venv', 'Scripts', 'python.exe');
  const scriptPath = join(app.getAppPath(), 'backend', 'pipeline.py');
  const outputDir = join(app.getPath('temp'), `story_${Date.now()}`);
  await fs.mkdir(outputDir, { recursive: true });

  pipelineProcess = spawn(pythonPath, [scriptPath, '--text', _text, '--output', outputDir], {
    env: { ...process.env, PYTHONUNBUFFERED: '1', PYTHONUTF8: '1' },
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

ipcMain.handle('pipeline:transcribe', async (_, audioPath: string): Promise<string> => {
  if (isTestMode) {
    setTimeout(
      () =>
        mainWindow.webContents.send('transcription:event', {
          event: 'progress',
          stage: 'transcribing',
        }),
      200
    );
    await new Promise((resolve) => setTimeout(resolve, 600));
    return 'Barnet vasker hendene og tørker seg.';
  }

  return new Promise((resolve, reject) => {
    const pythonPath = join(app.getAppPath(), 'backend', '.venv', 'Scripts', 'python.exe');
    const scriptPath = join(app.getAppPath(), 'backend', 'pipeline.py');

    transcriptionProcess = spawn(
      pythonPath,
      [scriptPath, '--audio', audioPath, '--transcribe-only'],
      { env: { ...process.env, PYTHONUNBUFFERED: '1', PYTHONUTF8: '1' } }
    );

    let buffer = '';
    transcriptionProcess.stdout?.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          if (event.event === 'transcript') {
            transcriptionProcess = null;
            resolve(event.text ?? '');
          } else {
            mainWindow.webContents.send('transcription:event', event);
          }
        } catch {
          console.error('Non-JSON stdout from transcription:', line);
        }
      }
    });

    transcriptionProcess.stderr?.on('data', (chunk: Buffer) => {
      console.error('[transcription stderr]', chunk.toString());
    });

    transcriptionProcess.on('close', (code) => {
      transcriptionProcess = null;
      if (code !== 0) reject(new Error(`Transcription exited with code ${code}`));
    });
  });
});

ipcMain.handle('pipeline:transcribe-cancel', async () => {
  transcriptionProcess?.kill();
  transcriptionProcess = null;
});

ipcMain.handle('recording:save', async (_, data: ArrayBuffer): Promise<string> => {
  const audioPath = join(app.getPath('temp'), `recording_${Date.now()}.webm`);
  await fs.writeFile(audioPath, Buffer.from(data));
  return audioPath;
});

// --- Phase 3: Segment + Generate IPC ---

ipcMain.handle('output:create-dir', async (): Promise<string> => {
  const outputDir = join(app.getPath('temp'), `story_${Date.now()}`);
  await fs.mkdir(outputDir, { recursive: true });
  return outputDir;
});

ipcMain.handle(
  'pipeline:segment',
  async (
    _,
    payload: { audioPath?: string; text?: string }
  ): Promise<typeof TEST_FIXTURE_SCENES> => {
    if (isTestMode) {
      setTimeout(
        () =>
          mainWindow.webContents.send('pipeline:event', {
            event: 'progress',
            stage: 'segmenting',
          }),
        200
      );
      await new Promise((resolve) => setTimeout(resolve, 800));
      return TEST_FIXTURE_SCENES;
    }

    return new Promise((resolve, reject) => {
      const pythonPath = join(app.getAppPath(), 'backend', '.venv', 'Scripts', 'python.exe');
      const scriptPath = join(app.getAppPath(), 'backend', 'pipeline.py');
      const args = payload.text
        ? [scriptPath, '--text', payload.text, '--segment-only']
        : [scriptPath, '--audio', payload.audioPath ?? '', '--segment-only'];

      const proc = spawn(pythonPath, args, {
        env: { ...process.env, PYTHONUNBUFFERED: '1', PYTHONUTF8: '1' },
      });

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
              resolve(event.scenes ?? []);
            } else {
              mainWindow.webContents.send('pipeline:event', event);
            }
          } catch {
            console.error('Non-JSON stdout from segment:', line);
          }
        }
      });

      proc.stderr?.on('data', (chunk: Buffer) => {
        console.error('[segment stderr]', chunk.toString());
      });

      proc.on('close', (code) => {
        if (code !== 0) reject(new Error(`Segment process exited with code ${code}`));
      });
    });
  }
);

ipcMain.handle(
  'pipeline:generate',
  async (_, scenes: typeof TEST_FIXTURE_SCENES, outputDir: string) => {
    if (isTestMode) {
      const imagePath = join(app.getAppPath(), 'tests', 'fixtures', 'sample_image.png');

      scenes.forEach((scene, i) => {
        const delay = 400 + i * 600;
        setTimeout(
          () =>
            mainWindow.webContents.send('pipeline:event', {
              event: 'progress',
              stage: 'generating_image',
              index: i + 1,
              total: scenes.length,
            }),
          delay - 100
        );
        setTimeout(
          () =>
            mainWindow.webContents.send('pipeline:event', {
              event: 'scene',
              index: scene.index,
              caption_no: scene.caption_no,
              image_path: imagePath,
            }),
          delay
        );
      });

      const doneDelay = 400 + scenes.length * 600 + 200;
      setTimeout(
        () =>
          mainWindow.webContents.send('pipeline:event', {
            event: 'done',
            scenes: scenes.map((s) => ({ ...s, image_path: imagePath })),
          }),
        doneDelay
      );
      return;
    }

    if (pipelineProcess) return;

    const pythonPath = join(app.getAppPath(), 'backend', '.venv', 'Scripts', 'python.exe');
    const scriptPath = join(app.getAppPath(), 'backend', 'pipeline.py');
    const scenesFile = join(app.getPath('temp'), `scenes_${Date.now()}.json`);
    await fs.writeFile(scenesFile, JSON.stringify(scenes));

    pipelineProcess = spawn(
      pythonPath,
      [scriptPath, '--generate', '--scenes-file', scenesFile, '--output', outputDir],
      { env: { ...process.env, PYTHONUNBUFFERED: '1', PYTHONUTF8: '1' } }
    );

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
          console.error('Non-JSON stdout from generate:', line);
        }
      }
    });

    pipelineProcess.stderr?.on('data', (chunk: Buffer) => {
      console.error('[generate stderr]', chunk.toString());
    });

    pipelineProcess.on('close', (code) => {
      pipelineProcess = null;
      if (code !== 0) {
        mainWindow.webContents.send('pipeline:event', {
          event: 'error',
          message: `Image generation exited with code ${code}`,
        });
      }
    });
  }
);
