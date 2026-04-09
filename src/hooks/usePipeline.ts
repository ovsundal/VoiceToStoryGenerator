import { useCallback, useEffect, useState } from 'react';
import type { PipelineProgressEvent, Scene } from '../preload/index';

export interface PipelineState {
  stage: string | null;
  progress: { current: number; total: number } | null;
  downloadPct: number | null;
  scenes: Scene[];
  error: string | null;
  isRunning: boolean;
}

export function usePipeline() {
  const [state, setState] = useState<PipelineState>({
    stage: null,
    progress: null,
    downloadPct: null,
    scenes: [],
    error: null,
    isRunning: false,
  });

  const start = useCallback(async (audioPath: string) => {
    setState({
      stage: 'starting',
      progress: null,
      downloadPct: null,
      scenes: [],
      error: null,
      isRunning: true,
    });
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
              downloadPct:
                event.stage === 'downloading_model' ? (event.pct ?? s.downloadPct) : s.downloadPct,
              progress:
                event.index != null
                  ? { current: event.index, total: event.total ?? 0 }
                  : s.progress,
            };
          case 'scene':
            return {
              ...s,
              scenes: [
                ...s.scenes,
                {
                  index: event.index ?? 0,
                  caption_no: event.caption_no ?? '',
                  image_path: event.image_path ?? '',
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
