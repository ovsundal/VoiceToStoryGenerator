import { contextBridge, ipcRenderer } from 'electron';

export interface Scene {
  index: number;
  caption_no: string;
  image_path: string;
}

export interface PipelineProgressEvent {
  event: 'progress' | 'scene' | 'done' | 'error';
  stage?: string;
  index?: number;
  total?: number;
  pct?: number;
  caption_no?: string;
  image_path?: string;
  scenes?: Scene[];
  message?: string;
}

export interface ElectronAPI {
  startPipeline: (audioPath: string) => Promise<void>;
  startPipelineWithText: (text: string) => Promise<void>;
  cancelPipeline: () => Promise<void>;
  onPipelineEvent: (callback: (event: PipelineProgressEvent) => void) => () => void;
  saveRecording: (data: ArrayBuffer) => Promise<string>;
  transcribeAudio: (audioPath: string) => Promise<string>;
  cancelTranscription: () => Promise<void>;
  onTranscriptionEvent: (callback: (event: PipelineProgressEvent) => void) => () => void;
}

contextBridge.exposeInMainWorld('electronAPI', {
  startPipeline: (audioPath: string) => ipcRenderer.invoke('pipeline:start', audioPath),

  startPipelineWithText: (text: string) => ipcRenderer.invoke('pipeline:start-with-text', text),

  cancelPipeline: () => ipcRenderer.invoke('pipeline:cancel'),

  onPipelineEvent: (callback: (event: PipelineProgressEvent) => void) => {
    const handler = (_: unknown, event: PipelineProgressEvent) => callback(event);
    ipcRenderer.on('pipeline:event', handler);
    return () => ipcRenderer.removeListener('pipeline:event', handler);
  },

  saveRecording: (data: ArrayBuffer) => ipcRenderer.invoke('recording:save', data),

  transcribeAudio: (audioPath: string) => ipcRenderer.invoke('pipeline:transcribe', audioPath),

  cancelTranscription: () => ipcRenderer.invoke('pipeline:transcribe-cancel'),

  onTranscriptionEvent: (callback: (event: PipelineProgressEvent) => void) => {
    const handler = (_: unknown, event: PipelineProgressEvent) => callback(event);
    ipcRenderer.on('transcription:event', handler);
    return () => ipcRenderer.removeListener('transcription:event', handler);
  },
} satisfies ElectronAPI);
