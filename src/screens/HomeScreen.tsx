import { useEffect, useState } from 'react';
import { useRecorder } from '../hooks/useRecorder';
import './HomeScreen.css';

interface HomeScreenProps {
  onStartPipeline: () => void;
}

export function HomeScreen({ onStartPipeline }: HomeScreenProps) {
  const [text, setText] = useState('');
  const [transcribeStage, setTranscribeStage] = useState<string | null>(null);
  const [downloadPct, setDownloadPct] = useState<number | null>(null);
  const { recorderState, startRecording, stopRecording } = useRecorder();

  const isTranscribing = transcribeStage !== null;

  useEffect(() => {
    const cleanup = window.electronAPI.onTranscriptionEvent((event) => {
      if (event.event === 'progress' && event.stage) {
        setTranscribeStage(event.stage);
        setDownloadPct(event.stage === 'downloading_model' ? (event.pct ?? null) : null);
      }
    });
    return cleanup;
  }, []);

  const handleRecordClick = async () => {
    if (isTranscribing) {
      await window.electronAPI.cancelTranscription();
      return;
    }
    if (recorderState === 'idle') {
      await startRecording();
    } else if (recorderState === 'recording') {
      const audioPath = await stopRecording();
      setTranscribeStage('transcribing');
      try {
        const transcript = await window.electronAPI.transcribeAudio(audioPath);
        setText(transcript);
      } catch {
        // Cancelled or failed — leave textarea as-is
      } finally {
        setTranscribeStage(null);
        setDownloadPct(null);
      }
    }
  };

  const handleSubmitText = () => {
    if (!text.trim()) return;
    onStartPipeline();
    window.electronAPI.startPipelineWithText(text.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSubmitText();
    }
  };

  const recordButtonLabel = isTranscribing
    ? 'Avbryt'
    : recorderState === 'idle'
      ? 'Ta opp fortelling'
      : recorderState === 'recording'
        ? 'Stopp opptak'
        : 'Lagrer…';

  const statusText = isTranscribing
    ? transcribeStage === 'downloading_model'
      ? `Laster ned talemodell (3 GB, kun første gang)…${downloadPct != null ? ` ${downloadPct}%` : ''}`
      : transcribeStage === 'loading_model'
        ? 'Laster inn talemodell…'
        : 'Transkriberer tale…'
    : null;

  return (
    <div className="home-screen">
      <h1 className="home-title">Fortelling til bilder</h1>

      <button
        className={`record-button ${recorderState === 'recording' ? 'record-button--recording' : ''} ${isTranscribing ? 'record-button--cancel' : ''}`}
        data-testid="record-button"
        onClick={handleRecordClick}
        disabled={recorderState === 'saving'}
        type="button"
      >
        {recorderState === 'recording' && <span className="record-indicator" aria-hidden="true" />}
        {recordButtonLabel}
      </button>

      {statusText && (
        <p className="transcribe-status" data-testid="transcribe-status">
          {statusText}
        </p>
      )}

      <div className="divider">
        <span className="divider-text">eller skriv</span>
      </div>

      <div className="text-input-section">
        <textarea
          className="story-textarea"
          data-testid="story-textarea"
          placeholder="Skriv fortellingen her…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={5}
          disabled={isTranscribing}
        />
        <button
          className="submit-text-button"
          data-testid="submit-text-button"
          onClick={handleSubmitText}
          disabled={!text.trim() || isTranscribing}
          type="button"
        >
          Generer bilder
        </button>
      </div>
    </div>
  );
}
