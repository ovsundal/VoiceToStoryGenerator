import { useEffect } from 'react';
import { usePipeline } from '../hooks/usePipeline';
import './ProcessingScreen.css';

interface ProcessingScreenProps {
  onCancel: () => void;
  onDone: () => void;
}

const stageLabels: Record<string, string> = {
  starting: 'Starter…',
  loading_model: 'Laster inn talemodell…',
  transcribing: 'Transkriberer tale…',
  segmenting: 'Bryter ned i scener…',
  generating_image: 'Genererer bilde',
  done: 'Ferdig!',
};

export function ProcessingScreen({ onCancel, onDone }: ProcessingScreenProps) {
  const { stage, progress, downloadPct, error, isRunning } = usePipeline();

  useEffect(() => {
    if (stage === 'done') {
      const timer = setTimeout(onDone, 800);
      return () => clearTimeout(timer);
    }
  }, [stage, onDone]);

  const stageText =
    stage === 'generating_image' && progress
      ? `Genererer bilde ${progress.current} av ${progress.total}…`
      : stage === 'downloading_model'
        ? `Laster ned talemodell (3 GB, kun første gang)… ${downloadPct != null ? `${downloadPct}%` : ''}`
        : (stageLabels[stage ?? ''] ?? 'Behandler…');

  const isDeterminate = downloadPct != null;

  return (
    <div className="processing-screen" data-testid="processing-screen">
      <div className="processing-content">
        <p className="processing-stage" data-testid="progress-stage">
          {error ? `Feil: ${error}` : stageText}
        </p>
        <div
          className="progress-bar"
          role="progressbar"
          aria-valuenow={isDeterminate ? downloadPct : (progress?.current ?? 0)}
          aria-valuemin={0}
          aria-valuemax={isDeterminate ? 100 : (progress?.total ?? 100)}
          tabIndex={-1}
        >
          <div
            className={`progress-fill ${!isDeterminate && isRunning && !error ? 'animating' : ''}`}
            style={
              isDeterminate
                ? { width: `${downloadPct}%`, transition: 'width 400ms ease' }
                : undefined
            }
          />
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
