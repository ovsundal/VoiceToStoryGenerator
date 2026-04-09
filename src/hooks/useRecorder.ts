import { useCallback, useRef, useState } from 'react';

export type RecorderState = 'idle' | 'recording' | 'saving';

export interface UseRecorderResult {
  recorderState: RecorderState;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string>;
}

export function useRecorder(): UseRecorderResult {
  const [recorderState, setRecorderState] = useState<RecorderState>('idle');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async (): Promise<void> => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    mediaRecorderRef.current = recorder;
    recorder.start(100);
    setRecorderState('recording');
  }, []);

  const stopRecording = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder) {
        reject(new Error('No active recording'));
        return;
      }
      setRecorderState('saving');
      recorder.onstop = async () => {
        try {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
          const arrayBuffer = await blob.arrayBuffer();
          const audioPath = await window.electronAPI.saveRecording(arrayBuffer);
          for (const t of recorder.stream.getTracks()) t.stop();
          setRecorderState('idle');
          resolve(audioPath);
        } catch (err) {
          setRecorderState('idle');
          reject(err);
        }
      };
      recorder.stop();
    });
  }, []);

  return { recorderState, startRecording, stopRecording };
}
