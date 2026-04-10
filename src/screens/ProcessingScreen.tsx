import { useEffect } from 'react';
import { usePipeline } from '../hooks/usePipeline';
import './ProcessingScreen.css';

interface ProcessingScreenProps {
  onCancel: () => void;
  onDone: () => void;
}

const stageLabels: Record<string, string> = {
  starting: 'Starter…',
  downloading_model: 'Laster ned modell…',
  loading_model: 'Laster inn modell…',
  transcribing: 'Transkriberer tale…',
  segmenting: 'Bryter ned i scener…',
  generating_image: 'Genererer bilde',
  done: 'Ferdig!',
};

const loadingModelLabels: Record<string, string> = {
  whisper: 'Laster inn talemodell…',
  llama: 'Laster inn tekstmodell…',
  flux: 'Laster inn bildegenereringsmodell…',
};

const downloadLabels: Record<string, { label: string; size: string }> = {
  whisper: { label: 'talemodell', size: '3 GB' },
  llama: { label: 'tekstmodell', size: '2 GB' },
  flux: { label: 'bildemodell', size: '33 GB' },
};

export function ProcessingScreen({ onCancel, onDone }: ProcessingScreenProps) {
  const { stage, progress, downloadPct, downloadModel, error, isRunning } = usePipeline();

  useEffect(() => {
    if (stage === 'done') {
      const timer = setTimeout(onDone, 800);
      return () => clearTimeout(timer);
    }
  }, [stage, onDone]);

  const stageText = (() => {
    if (stage === 'generating_image' && progress)
      return `Genererer bilde ${progress.current} av ${progress.total}…`;
    if (stage === 'loading_model' && downloadModel)
      return loadingModelLabels[downloadModel] ?? 'Laster inn modell…';
    if (stage === 'downloading_model') {
      const dl = downloadLabels[downloadModel ?? ''];
      const name = dl ? `Laster ned ${dl.label} (${dl.size}, kun første gang)` : 'Laster ned modell';
      return `${name}… ${downloadPct != null ? `${downloadPct}%` : ''}`;
    }
    return stageLabels[stage ?? ''] ?? 'Behandler…';
  })();

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
