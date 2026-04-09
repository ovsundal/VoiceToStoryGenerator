import { vi } from 'vitest';

// Global mock for window.electronAPI — tests override per-test as needed
Object.defineProperty(window, 'electronAPI', {
  writable: true,
  value: {
    startPipeline: vi.fn().mockResolvedValue(undefined),
    startPipelineWithText: vi.fn().mockResolvedValue(undefined),
    cancelPipeline: vi.fn().mockResolvedValue(undefined),
    onPipelineEvent: vi.fn().mockReturnValue(() => {}),
    startRecording: vi.fn().mockResolvedValue('/tmp/audio.wav'),
    stopRecording: vi.fn().mockResolvedValue('/tmp/audio.wav'),
  },
});
