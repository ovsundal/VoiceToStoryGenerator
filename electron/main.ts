import { type ChildProcess, spawn } from 'node:child_process';
import { join } from 'node:path';
import { BrowserWindow, Menu, app, ipcMain } from 'electron';

const isTestMode = process.argv.includes('--test-mode');
let mainWindow: BrowserWindow;
let pipelineProcess: ChildProcess | null = null;

// Hardcoded fixture for test mode — avoids file-read failures in CI/E2E
const TEST_FIXTURE_SCENES = [
  { index: 0, caption_no: 'Vasker hendene' },
  { index: 1, caption_no: 'Tørker hendene' },
  { index: 2, caption_no: 'Tar på seg jakken' },
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

ipcMain.handle('pipeline:start', async () => {
  if (isTestMode) {
    emitFixtureEvents();
    return;
  }

  if (pipelineProcess) return;

  const pythonPath = join(app.getAppPath(), 'backend', '.venv', 'Scripts', 'python.exe');
  const scriptPath = join(app.getAppPath(), 'backend', 'pipeline.py');

  pipelineProcess = spawn(pythonPath, [scriptPath, '--audio', ''], {
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
        event: 'error',
        message: `Pipeline exited with code ${code}`,
      });
    }
  });
});

ipcMain.handle('pipeline:start-with-text', async (_, _text: string) => {
  if (isTestMode) {
    // In test mode, skip the transcription stage and go straight to segmenting.
    // Real implementation (Phase 3) will pass text directly to the LLM segmenter.
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

  pipelineProcess = spawn(pythonPath, [scriptPath, '--text', _text], {
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

// Stubs for Phase 2
ipcMain.handle('recording:start', async () => '/tmp/recording_stub.wav');
ipcMain.handle('recording:stop', async () => '/tmp/recording_stub.wav');
