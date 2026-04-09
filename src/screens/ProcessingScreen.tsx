import { useEffect } from 'react';
import { usePipeline } from '../hooks/usePipeline';
import './ProcessingScreen.css';

interface ProcessingScreenProps {
  onCancel: () => void;
  onDone: () => void;
}

const stageLabels: Record<string, string> = {
  starting: 'Starter…',
  transcribing: 'Transkriberer tale…',
  segmenting: 'Bryter ned i scener…',
  generating_image: 'Genererer bilde',
  done: 'Ferdig!',
};

export function ProcessingScreen({ onCancel, onDone }: ProcessingScreenProps) {
  const { stage, progress, error, isRunning } = usePipeline();

  useEffect(() => {
    if (stage === 'done') {
      const timer = setTimeout(onDone, 800);
      return () => clearTimeout(timer);
    }
  }, [stage, onDone]);

  const stageText =
    stage === 'generating_image' && progress
      ? `Genererer bilde ${progress.current} av ${progress.total}…`
      : (stageLabels[stage ?? ''] ?? 'Behandler…');

  return (
    <div className="processing-screen" data-testid="processing-screen">
      <div className="processing-content">
        <p className="processing-stage" data-testid="progress-stage">
          {error ? `Feil: ${error}` : stageText}
        </p>
        <div
          className="progress-bar"
          role="progressbar"
          aria-valuenow={progress?.current ?? 0}
          aria-valuemin={0}
          aria-valuemax={progress?.total ?? 100}
          tabIndex={-1}
        >
          <div className={`progress-fill ${isRunning && !error ? 'animating' : ''}`} />
        </div>
        <button
          className="cancel-button"
          data-testid="cancel-button"
          onClick={onCancel}
          type="button"
        >
          Avbryt
        </button>
      </div>
    </div>
  );
}
