import { useCallback, useEffect, useState } from 'react';
import type { Scene } from '../preload/index';
import './ViewerScreen.css';

interface ViewerScreenProps {
  scenes: Scene[];
  onHome: () => void;
}

export function ViewerScreen({ scenes, onHome }: ViewerScreenProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const goToPrev = useCallback(() => setCurrentIndex((i) => Math.max(0, i - 1)), []);
  const goToNext = useCallback(
    () => setCurrentIndex((i) => Math.min(scenes.length - 1, i + 1)),
    [scenes.length]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goToPrev();
      if (e.key === 'ArrowRight') goToNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToPrev, goToNext]);

  const current = scenes[currentIndex];

  if (!current) return null;

  return (
    <div className="viewer-screen" data-testid="viewer-screen">
      <div className="viewer-content">
        <img
          className="viewer-image"
          data-testid="scene-image"
          src={`localfile:///${current.image_path.replace(/\\/g, '/')}`}
          alt={current.caption_no}
        />
        <p className="viewer-caption">{current.caption_no}</p>
        <p className="viewer-counter" data-testid="image-counter">
          Bilde {currentIndex + 1} av {scenes.length}
        </p>
      </div>

      <div className="viewer-nav">
        <button
          className="viewer-nav-button"
          data-testid="prev-button"
          onClick={goToPrev}
          disabled={currentIndex === 0}
          type="button"
        >
          ← Forrige
        </button>
        <button
          className="viewer-home-button"
          data-testid="home-button"
          onClick={onHome}
          type="button"
        >
          Ny historie
        </button>
        <button
          className="viewer-nav-button"
          data-testid="next-button"
          onClick={goToNext}
          disabled={currentIndex === scenes.length - 1}
          type="button"
        >
          Neste →
        </button>
      </div>
    </div>
  );
}
