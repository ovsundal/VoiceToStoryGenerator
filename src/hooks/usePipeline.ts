import { useCallback, useEffect, useState } from 'react';
import type { PipelineProgressEvent, Scene, SegmentedScene } from '../preload/index';

export interface PipelineState {
  stage: string | null;
  progress: { current: number; total: number } | null;
  downloadPct: number | null;
  downloadModel: string | null;
  scenes: Scene[];
  segmentedScenes: SegmentedScene[] | null;
  error: string | null;
  isRunning: boolean;
}

const INITIAL_STATE: PipelineState = {
  stage: null,
  progress: null,
  downloadPct: null,
  downloadModel: null,
  scenes: [],
  segmentedScenes: null,
  error: null,
  isRunning: false,
};

export function usePipeline() {
  const [state, setState] = useState<PipelineState>(INITIAL_STATE);

  const start = useCallback(async (audioPath: string) => {
    setState({ ...INITIAL_STATE, stage: 'starting', isRunning: true });
    await window.electronAPI.startPipeline(audioPath);
  }, []);

  const cancel = useCallback(async () => {
    await window.electronAPI.cancelPipeline();
    setState((s) => ({ ...s, isRunning: false }));
  }, []);

  const segment = useCallback(async (payload: { audioPath?: string; text?: string }) => {
    setState({ ...INITIAL_STATE, stage: 'starting', isRunning: true });
    const scenes = await window.electronAPI.segmentStory(payload);
    setState((s) => ({ ...s, segmentedScenes: scenes, isRunning: false }));
    return scenes;
  }, []);

  const generateImages = useCallback(async (scenes: SegmentedScene[], outputDir: string) => {
    setState({ ...INITIAL_STATE, stage: 'starting', isRunning: true });
    await window.electronAPI.generateImages(scenes, outputDir);
  }, []);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
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
              downloadModel:
                event.stage === 'downloading_model' || event.stage === 'loading_model'
                  ? (event.model ?? s.downloadModel)
                  : s.downloadModel,
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

  return { ...state, start, cancel, segment, generateImages, reset };
}
