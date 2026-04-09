import { useState } from 'react';
import './index.css';
import { HomeScreen } from './screens/HomeScreen';
import { ProcessingScreen } from './screens/ProcessingScreen';

type Screen = 'home' | 'processing';

export default function App() {
  const [activeScreen, setActiveScreen] = useState<Screen>('home');

  return (
    <>
      {activeScreen === 'home' && (
        <HomeScreen onStartPipeline={() => setActiveScreen('processing')} />
      )}
      {activeScreen === 'processing' && (
        <ProcessingScreen
          onCancel={() => setActiveScreen('home')}
          onDone={() => setActiveScreen('home')}
        />
      )}
    </>
  );
}
