import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { audio } from '../audio/AudioManager';
import { img, PORTRAIT_POSES, type FullBody, type Pose } from '../lib/assets';
import dialogue from '../data/bramblewick-dialogue.json';

/** 'voice' follows the loudness of the playing clip, 'fake' flaps at 8Hz. */
export type TalkMode = 'none' | 'voice' | 'fake';

const MOUTH_FLAP = dialogue.talkRules.mouthFlap as Record<string, string[]>;
const OPEN_LEVEL = 0.08;
const BLINK_MS = 120;

interface PortraitProps {
  pose: Pose;
  talk?: TalkMode;
  /** use the gesturing talk frame where the pose has one */
  hand?: boolean;
  /** rendered width in CSS pixels */
  size?: number;
  className?: string;
}

/**
 * Bramblewick's waist-up portrait. All fourteen frames are stacked in one box
 * and only the active one is shown, so he never shifts between poses.
 */
export function Portrait({ pose, talk = 'none', hand = false, size = 176, className = '' }: PortraitProps) {
  const [open, setOpen] = useState(false);
  const [bob, setBob] = useState(0);
  const [blink, setBlink] = useState(false);
  const talkRef = useRef(talk);
  talkRef.current = talk;

  // Mouth / bob, driven by the voice level or by a fake 8Hz flap.
  useEffect(() => {
    let raf = 0;
    let lastOpen = false;
    let lastBob = 0;
    const tick = (t: number) => {
      const mode = talkRef.current;
      let level = 0;
      if (mode === 'voice') level = audio.getVoiceLevel();
      else if (mode === 'fake') level = (t / 1000) * 8 % 1 < 0.5 ? 0.2 : 0;
      const nowOpen = level > OPEN_LEVEL;
      const nowBob = level > OPEN_LEVEL * 2 ? 2 : nowOpen ? 1 : 0;
      if (nowOpen !== lastOpen) setOpen((lastOpen = nowOpen));
      if (nowBob !== lastBob) setBob((lastBob = nowBob));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // A blink every 4 to 6 seconds.
  useEffect(() => {
    let timer = 0;
    let off = 0;
    const schedule = () => {
      timer = window.setTimeout(() => {
        setBlink(true);
        off = window.setTimeout(() => setBlink(false), BLINK_MS);
        schedule();
      }, 4000 + Math.random() * 2000);
    };
    schedule();
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(off);
    };
  }, []);

  const flap = MOUTH_FLAP[pose];
  let frame: string = pose;
  if (flap && open) frame = hand ? `${flap[1]}-hand` : flap[1];
  else if (blink && pose !== 'sleepy' && !open) frame = 'sleepy';

  return (
    <div className={`wizard-float ${className}`} style={{ width: size, flex: 'none' }}>
      <div
        className="relative w-full"
        style={{ aspectRatio: '351 / 346', transform: flap ? undefined : `translateY(${-bob}px)` }}
      >
        {PORTRAIT_POSES.map((p) => (
          <img
            key={p}
            src={img(`wizard/portrait/${p}`)}
            alt=""
            className="absolute inset-0 h-full w-full"
            style={{ visibility: p === frame ? 'visible' : 'hidden' }}
          />
        ))}
      </div>
    </div>
  );
}

/** A one-off full-body moment: quick scale pop, a hold, then a fade. */
export function FullBodyMoment({ name, size = 300 }: { name: FullBody; size?: number }) {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <motion.img
        src={img(`wizard/fullbody/${name}`)}
        alt=""
        style={{ width: size, maxWidth: '80vw' }}
        initial={{ scale: 0.4 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 520, damping: 16 }}
      />
    </motion.div>
  );
}

export const FULL_BODY_HOLD_MS = 1200;
