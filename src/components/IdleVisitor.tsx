import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { audio } from '../audio/AudioManager';
import { Portrait } from './Bramblewick';
import { Bubble, useTypewriter } from './SpeechBubble';
import { textLine } from './WizardSays';
import dialogue from '../data/bramblewick-dialogue.json';
import type { Pose } from '../lib/assets';
import { useApp, withName } from '../store';

const RULES = dialogue.idleRules;
const LINES = dialogue.idle;
let popupsThisSession = 0;

/**
 * Bramblewick's idle pop-up, following idleRules in the dialogue JSON: after
 * 60s without input on one screen, at most once per session and then only on
 * a 33% roll, never during the intro, the quest or a search, and never when
 * "Let Bramblewick nap" is on. Tapping him sends him off with a "Hmph."
 */
export function IdleVisitor() {
  const screen = useApp((s) => s.screen);
  const busy = useApp((s) => s.busy);
  const nap = useApp((s) => s.settings.nap);
  const name = useApp((s) => s.playerName);
  const [line, setLine] = useState<(typeof LINES)[number] | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [voiced, setVoiced] = useState(false);
  const timers = useRef<number[]>([]);

  const blocked = busy || nap || screen === 'intro' || screen === 'edition' || screen === 'quest';

  useEffect(() => {
    if (blocked || line) return;
    let timer = 0;
    const arm = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (popupsThisSession >= RULES.maxPerSession) return;
        popupsThisSession += 1; // the one chance this session
        if (Math.random() >= RULES.chance) return;
        const pick = LINES[Math.floor(Math.random() * LINES.length)];
        setLeaving(false);
        setLine(pick);
        setVoiced(audio.playVoice(pick.file, () => setVoiced(false)));
      }, RULES.afterSecondsInactive * 1000);
    };
    arm();
    window.addEventListener('pointerdown', arm);
    window.addEventListener('keydown', arm);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointerdown', arm);
      window.removeEventListener('keydown', arm);
    };
  }, [blocked, line, screen]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const dismiss = () => {
    if (leaving) return;
    audio.stopVoice();
    setVoiced(false);
    setLeaving(true);
    timers.current.push(window.setTimeout(() => setLine(null), 1500));
  };

  // Changing screen sends him away too.
  useEffect(() => {
    if (line) dismiss();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  const hmph = textLine('idle-dismiss');
  const text = line ? (leaving ? hmph.text : withName(line.text, name)) : '';
  const { visible, done } = useTypewriter(text, `${line?.id}-${leaving}`);

  return (
    <AnimatePresence>
      {line && (
        <motion.button
          type="button"
          aria-label="Send Bramblewick away"
          className="safe absolute bottom-0 left-0 z-40 flex max-w-[540px] flex-col items-start text-left"
          initial={{ x: '-110%' }}
          animate={{ x: leaving ? ['0%', '0%', '-110%'] : '0%' }}
          exit={{ x: '-110%' }}
          transition={leaving ? { duration: 1.4, times: [0, 0.6, 1] } : { type: 'spring', stiffness: 150, damping: 20 }}
          onClick={dismiss}
        >
          <Bubble text={text} visible={visible} className="mb-4 ml-1 mr-3" />
          <Portrait
            pose={(leaving ? hmph.pose : line.pose) as Pose}
            talk={leaving ? 'none' : voiced ? 'voice' : done ? 'none' : 'fake'}
            size={168}
          />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
