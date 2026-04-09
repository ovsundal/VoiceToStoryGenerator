import { useState } from 'react';
import './HomeScreen.css';

interface HomeScreenProps {
  onStartPipeline: () => void;
}

export function HomeScreen({ onStartPipeline }: HomeScreenProps) {
  const [text, setText] = useState('');

  const handleRecord = () => {
    // Phase 2 will replace with real recording.
    onStartPipeline();
    window.electronAPI.startPipeline('tests/fixtures/sample_audio.wav');
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

  return (
    <div className="home-screen">
      <h1 className="home-title">Story to Images</h1>

      <button
        className="record-button"
        data-testid="record-button"
        onClick={handleRecord}
        type="button"
      >
        Ta opp fortelling
      </button>

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
        />
        <button
          className="submit-text-button"
          data-testid="submit-text-button"
          onClick={handleSubmitText}
          disabled={!text.trim()}
          type="button"
        >
          Generer bilder
        </button>
      </div>
    </div>
  );
}
