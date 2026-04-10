import { useEffect, useState } from 'react';
import './index.css';
import { usePipeline } from './hooks/usePipeline';
import type { SegmentedScene } from './preload/index';
import { HomeScreen } from './screens/HomeScreen';
import { ProcessingScreen } from './screens/ProcessingScreen';
import { ReviewScreen } from './screens/ReviewScreen';
import { ViewerScreen } from './screens/ViewerScreen';

type Screen = 'home' | 'processing' | 'review' | 'viewer';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [pendingScenes, setPendingScenes] = useState<SegmentedScene[]>([]);
  const [outputDir, setOutputDir] = useState<string>('');
  const [story, setStory] = useState<string>('');
  const pipeline = usePipeline();

  // Processing → Review: fires when segmentation completes
  useEffect(() => {
    if (pipeline.segmentedScenes !== null && screen === 'processing') {
      setPendingScenes(pipeline.segmentedScenes);
      setScreen('review');
    }
  }, [pipeline.segmentedScenes, screen]);

  // Processing → Viewer: fires as soon as the first image is ready
  useEffect(() => {
    if (pipeline.scenes.length > 0 && screen === 'processing') {
      setScreen('viewer');
    }
  }, [pipeline.scenes.length, screen]);

  const handleStartSegment = (payload: { audioPath?: string; text?: string }) => {
    setStory(payload.text ?? '');
    setScreen('processing');
    pipeline.segment(payload);
  };

  const handleGenerate = async (editedScenes: SegmentedScene[]) => {
    const dir = outputDir || (await window.electronAPI.getOutputDir());
    if (!outputDir) setOutputDir(dir);
    setScreen('processing');
    pipeline.generateImages(editedScenes, dir);
  };

  const handleCancel = async () => {
    await pipeline.cancel();
    pipeline.reset();
    setScreen('home');
  };

  const handleHome = () => {
    pipeline.reset();
    setOutputDir('');
    setStory('');
    setScreen('home');
  };

  return (
    <>
      {screen === 'home' && <HomeScreen onStartSegment={handleStartSegment} />}
      {screen === 'processing' && <ProcessingScreen onCancel={handleCancel} onDone={() => {}} />}
      {screen === 'review' && (
        <ReviewScreen scenes={pendingScenes} onGenerate={handleGenerate} onCancel={handleCancel} />
      )}
      {screen === 'viewer' && (
        <ViewerScreen
          scenes={pipeline.scenes}
          totalScenes={pipeline.progress?.total ?? null}
          isRunning={pipeline.isRunning}
          story={story}
          onHome={handleHome}
        />
      )}
    </>
  );
}
