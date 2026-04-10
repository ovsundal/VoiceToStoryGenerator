import { useRef, useState } from 'react';
import type { SegmentedScene } from '../preload/index';
import './ReviewScreen.css';

interface ReviewScreenProps {
  scenes: SegmentedScene[];
  onGenerate: (editedScenes: SegmentedScene[]) => void;
  onCancel: () => void;
}

export function ReviewScreen({ scenes, onGenerate, onCancel }: ReviewScreenProps) {
  const [items, setItems] = useState<SegmentedScene[]>(scenes);
  const nextIndex = useRef(Math.max(0, ...scenes.map((s) => s.index)) + 1);

  const handleCaptionChange = (index: number, value: string) => {
    setItems((prev) => prev.map((s, i) => (i === index ? { ...s, caption_no: value } : s)));
  };

  const handleRemove = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAdd = () => {
    const newScene: SegmentedScene = {
      index: nextIndex.current++,
      caption_no: '',
      prompt_en: '',
    };
    setItems((prev) => [...prev, newScene]);
  };

  const handleGenerate = () => {
    // For manually added scenes (no LLM prompt), fall back to the Norwegian caption
    const ready = items.map((s) => ({
      ...s,
      prompt_en: s.prompt_en || s.caption_no,
    }));
    onGenerate(ready);
  };

  return (
    <div className="review-screen" data-testid="review-screen">
      <h1 className="review-title">Rediger bildetekster</h1>
      <p className="review-subtitle">
        Kontroller og rediger norske bildetekster før bildene genereres.
      </p>

      <div className="review-list">
        {items.map((scene, i) => (
          <div key={scene.index} className="review-item">
            <div className="review-item-header">
              <label className="review-label" htmlFor={`caption-${scene.index}`}>
                Bilde {i + 1}
              </label>
              <button
                className="review-remove-button"
                aria-label={`Fjern bilde ${i + 1}`}
                onClick={() => handleRemove(i)}
                type="button"
              >
                ✕
              </button>
            </div>
            <input
              id={`caption-${scene.index}`}
              className="review-input"
              data-testid={`caption-input-${i}`}
              type="text"
              value={scene.caption_no}
              placeholder="Skriv inn bildetekst…"
              onChange={(e) => handleCaptionChange(i, e.target.value)}
            />
          </div>
        ))}

        <button className="review-add-button" onClick={handleAdd} type="button">
          + Legg til bilde
        </button>
      </div>

      <div className="review-actions">
        <button className="review-cancel-button" onClick={onCancel} type="button">
          Avbryt
        </button>
        <button
          className="review-generate-button"
          data-testid="generate-button"
          onClick={handleGenerate}
          disabled={items.length === 0}
          type="button"
        >
          Generer bilder
        </button>
      </div>
    </div>
  );
}
