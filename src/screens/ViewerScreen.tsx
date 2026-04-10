import type { Scene } from '../preload/index';
import './ViewerScreen.css';

interface ViewerScreenProps {
  scenes: Scene[];
  totalScenes: number | null;
  isRunning: boolean;
  story: string;
  onHome: () => void;
}

export function ViewerScreen({ scenes, totalScenes, isRunning, story, onHome }: ViewerScreenProps) {
  const placeholderCount = totalScenes != null ? Math.max(0, totalScenes - scenes.length) : 0;

  return (
    <div className="viewer-screen" data-testid="viewer-screen">
      <div className="viewer-grid">
        {scenes.map((scene) => (
          <div key={scene.index} className="viewer-panel">
            <img
              className="viewer-image"
              data-testid="scene-image"
              src={`localfile:///${scene.image_path.replace(/\\/g, '/')}`}
              alt={scene.caption_no}
            />
          </div>
        ))}

        {Array.from({ length: placeholderCount }).map((_, i) => (
          <div key={`placeholder-${i}`} className="viewer-panel viewer-panel--loading">
            <div className="viewer-placeholder-pulse" />
          </div>
        ))}
      </div>

      {story && (
        <div className="viewer-story">
          <p className="viewer-story-text">{story}</p>
        </div>
      )}

      <div className="viewer-footer">
        {isRunning && (
          <p className="viewer-status">
            Genererer bilde {scenes.length + 1} av {totalScenes ?? '…'}…
          </p>
        )}
        <button
          className="viewer-home-button"
          data-testid="home-button"
          onClick={onHome}
          type="button"
          disabled={isRunning}
        >
          Ny historie
        </button>
      </div>
    </div>
  );
}
