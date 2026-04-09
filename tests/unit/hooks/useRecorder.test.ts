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
