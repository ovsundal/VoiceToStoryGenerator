import { vi } from 'vitest';

// Global mock for window.electronAPI — tests override per-test as needed
Object.defineProperty(window, 'electronAPI', {
  writable: true,
  value: {
    startPipeline: vi.fn().mockResolvedValue(undefined),
    startPipelineWithText: vi.fn().mockResolvedValue(undefined),
    cancelPipeline: vi.fn().mockResolvedValue(undefined),
    onPipelineEvent: vi.fn().mockReturnValue(() => {}),
    saveRecording: vi.fn().mockResolvedValue('/tmp/audio.webm'),
    transcribeAudio: vi.fn().mockResolvedValue('Barnet vasker hendene.'),
    cancelTranscription: vi.fn().mockResolvedValue(undefined),
    onTranscriptionEvent: vi.fn().mockReturnValue(() => {}),
  },
});
