import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { App as CapacitorApp } from '@capacitor/app';
import { audio } from './audio/AudioManager';
import { IdleVisitor } from './components/IdleVisitor';
import { Book } from './screens/Book';
import { EditionPick } from './screens/EditionPick';
import { Home } from './screens/Home';
import { Intro } from './screens/Intro';
import { Quest } from './screens/Quest';
import { Results } from './screens/Results';
import { SeedDetail } from './screens/SeedDetail';
import { Settings } from './screens/Settings';
import { useApp, type Screen } from './store';

const SCREENS: Record<Screen, () => JSX.Element | null> = {
  intro: Intro,
  edition: EditionPick,
  home: Home,
  quest: Quest,
  results: Results,
  detail: SeedDetail,
  book: Book,
  settings: Settings,
};

export function App() {
  const ready = useApp((s) => s.ready);
  const screen = useApp((s) => s.screen);
  const boot = useApp((s) => s.boot);

  useEffect(() => {
    void boot();
  }, [boot]);

  // No audio before the first tap (iOS needs a user gesture). On a returning
  // launch there is no "Tap to begin" screen, so the first touch unlocks it.
  useEffect(() => {
    const unlock = () => {
      audio.unlock();
      if (useApp.getState().screen !== 'intro') audio.startAmbience();
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  // Pause the ambience while the app is in the background.
  useEffect(() => {
    const handles = [
      CapacitorApp.addListener('pause', () => audio.setBackgrounded(true)),
      CapacitorApp.addListener('resume', () => audio.setBackgrounded(false)),
    ];
    const onVisibility = () => audio.setBackgrounded(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      handles.forEach((h) => void h.then((l) => l.remove()).catch(() => {}));
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  if (!ready) return <div className="absolute inset-0 bg-midnight" />;
  const Current = SCREENS[screen];

  return (
    <div className="absolute inset-0 overflow-hidden bg-midnight">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={screen}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <Current />
        </motion.div>
      </AnimatePresence>
      <IdleVisitor />
    </div>
  );
}
