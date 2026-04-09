import { renderHook, act } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { usePipeline } from '../../../src/hooks/usePipeline';
import type { PipelineProgressEvent } from '../../../src/preload/index';

describe('usePipeline', () => {
  beforeEach(() => {
    window.electronAPI = {
      startPipeline: vi.fn().mockResolvedValue(undefined),
      startPipelineWithText: vi.fn().mockResolvedValue(undefined),
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
        event: 'scene',
        index: 0,
        caption_no: 'Vasker hendene',
        image_path: '/tmp/scene_0.png',
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
    await act(async () => {
      await result.current.start('/tmp/audio.wav');
    });
    act(() => {
      capturedCallback?.({ event: 'done', scenes: [] });
    });
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
    await act(async () => {
      await result.current.start('/tmp/audio.wav');
    });
    act(() => {
      capturedCallback?.({ event: 'error', message: 'Modell ikke funnet' });
    });
    expect(result.current.isRunning).toBe(false);
    expect(result.current.error).toBe('Modell ikke funnet');
  });
});
