import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { audio } from '../audio/AudioManager';
import { FullBodyMoment, FULL_BODY_HOLD_MS, Portrait } from '../components/Bramblewick';
import { Bubble, useTypewriter } from '../components/SpeechBubble';
import { Fireflies, Frame, PixelButton } from '../components/ui';
import dialogue from '../data/bramblewick-dialogue.json';
import { img, type FullBody, type Pose } from '../lib/assets';
import { useApp, withName } from '../store';

interface Line {
  id: string;
  file: string;
  pose: string;
  text: string;
  fullBody?: string;
  action?: string;
}
// The whole sequence comes from the dialogue JSON; nothing is hard-coded here.
const LINES = dialogue.intro as Line[];
const LAST = LINES.length - 1;
const SEED_FROM = LINES.findIndex((l) => l.id === 'intro-08');

type Phase = 'tap' | 'wake' | 'talk' | 'name' | 'outro';

export function Intro() {
  const finishIntro = useApp((s) => s.finishIntro);
  const storedName = useApp((s) => s.playerName);
  const setBusy = useApp((s) => s.setBusy);

  const [phase, setPhase] = useState<Phase>('tap');
  const [idx, setIdx] = useState(0);
  const [name, setName] = useState('');
  const [typed, setTyped] = useState('');
  const [voiced, setVoiced] = useState(false);
  const [fullBody, setFullBody] = useState<FullBody | null>(null);
  const [shake, setShake] = useState(false);
  const timers = useRef<number[]>([]);
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));

  const line = LINES[idx];
  const text = withName(line.text, name || storedName);
  const { visible, done, finish } = useTypewriter(phase === 'talk' || phase === 'outro' ? text : '', idx);

  useEffect(() => {
    setBusy(true);
    return () => {
      setBusy(false);
      timers.current.forEach((t) => window.clearTimeout(t));
      audio.stopVoice();
    };
  }, [setBusy]);

  const nameRef = useRef('');
  nameRef.current = name;
  const outroStarted = useRef(false);
  const outro = useCallback(() => {
    if (outroStarted.current) return;
    outroStarted.current = true;
    audio.stopVoice();
    audio.sfx('spell');
    setFullBody('casting');
    setPhase('outro');
    later(() => setFullBody(null), 1500);
    later(() => finishIntro(nameRef.current || undefined), 2300);
  }, [finishIntro]);

  // Start a line: voice clip, full-body moment, screen shake.
  const startLine = useCallback((i: number) => {
    const l = LINES[i];
    setIdx(i);
    setPhase('talk');
    setVoiced(audio.playVoice(l.file, () => {
      setVoiced(false);
      // the last line casts the spell as soon as he has finished speaking
      if (i === LAST) later(outro, 500);
    }));
    if (l.fullBody) {
      setFullBody(l.fullBody as FullBody);
      later(() => { if (!outroStarted.current) setFullBody(null); }, FULL_BODY_HOLD_MS);
      if (l.fullBody === 'startled-jump') {
        setShake(true);
        later(() => setShake(false), 160);
      }
    }
  }, [outro]);

  const begin = () => {
    audio.unlock();
    audio.sfx('tap');
    audio.startAmbience(2000);
    setPhase('wake');
    later(() => startLine(0), 1600);
  };

  const advance = () => {
    if (phase !== 'talk') return;
    if (!done) {
      finish();
      return;
    }
    audio.sfx('dialogue-blip');
    audio.stopVoice();
    setVoiced(false);
    if (line.action === 'show-name-input') setPhase('name');
    else if (idx >= LAST) outro();
    else startLine(idx + 1);
  };

  const submitName = (value: string) => {
    const clean = value.trim().slice(0, 16) || 'Not-Gerald';
    setName(clean);
    startLine(idx + 1);
  };

  const skip = () => {
    audio.unlock();
    audio.stopVoice();
    audio.startAmbience();
    finishIntro(name || undefined);
  };

  // How far down the path the camera has walked, 0..1.
  const walk = phase === 'tap' ? 0 : phase === 'outro' ? 1 : phase === 'wake' ? 0.08 : 0.08 + (0.8 * idx) / LAST;
  const camera = { duration: 1.6, ease: 'easeInOut' as const };
  const talkMode = phase !== 'talk' ? 'none' : voiced ? 'voice' : done ? 'none' : 'fake';
  const seedOut = phase !== 'tap' && phase !== 'wake' && idx >= SEED_FROM;
  const showWizard = phase !== 'tap' && phase !== 'wake';

  return (
    <div className={`absolute inset-0 overflow-hidden bg-black ${shake ? 'shake' : ''}`} onClick={advance}>
      {/* The stage covers the screen at the painting's aspect ratio, so layers
          placed in % line up with the painted path whatever the screen shape. */}
      <div
        className="absolute left-1/2 top-1/2"
        style={{ width: 'max(100vw, 177.7vh)', height: 'max(100vh, 56.3vw)', transform: 'translate(-56%, -50%)' }}
      >
        {/* 1. forest: slow zoom 1.0 -> 1.25 */}
        <motion.img
          src={img('scenes/forest-path')}
          alt=""
          className="absolute inset-0 h-full w-full"
          style={{ transformOrigin: '56% 46%' }}
          animate={{ scale: 1 + 0.25 * walk }}
          transition={camera}
        />
        {/* 2. rune archway on the path, portal glow drawn behind it */}
        <motion.div
          className="absolute"
          style={{ left: '56.3%', top: '43%', width: '16%', x: '-50%', y: '-50%' }}
          animate={{ scale: 1 + 1.5 * walk }}
          transition={camera}
        >
          <motion.div
            className="absolute rounded-[50%]"
            style={{ left: '27%', right: '27%', top: '24%', bottom: '14%', background: 'radial-gradient(closest-side, #ffffff 0%, #3ff0ff 45%, rgba(63,240,255,0) 100%)' }}
            animate={{ opacity: phase === 'outro' ? 1 : 0.55, scale: phase === 'outro' ? 2.4 : 1 }}
            transition={{ duration: phase === 'outro' ? 1.2 : 2.4, repeat: phase === 'outro' ? 0 : Infinity, repeatType: 'reverse' }}
          />
          <motion.img
            src={img('intro/rune-archway')}
            alt=""
            className="relative w-full"
            animate={{ filter: phase === 'outro' ? 'drop-shadow(0 0 14px #3ff0ff) brightness(1.5)' : 'drop-shadow(0 0 0px #3ff0ff) brightness(1)' }}
            transition={{ duration: 0.8 }}
          />
        </motion.div>
      </div>

      {/* 3. ferns in the bottom corners */}
      <motion.img
        src={img('intro/ferns')} alt="" className="absolute bottom-0 left-0 w-[42vmin] max-w-[260px]"
        style={{ transformOrigin: 'bottom left' }}
        animate={{ x: `${-8 - 62 * walk}%`, y: `${12 + 40 * walk}%`, scale: 1 + 0.7 * walk }}
        transition={camera}
      />
      <motion.img
        src={img('intro/ferns')} alt="" className="absolute bottom-0 right-0 w-[42vmin] max-w-[260px]"
        style={{ transformOrigin: 'bottom right', scaleX: -1 }}
        animate={{ x: `${8 + 62 * walk}%`, y: `${12 + 40 * walk}%`, scale: 1 + 0.7 * walk }}
        transition={camera}
      />
      {/* 4. branches sliding outwards past the camera */}
      <motion.img
        src={img('intro/branch-left')} alt="" className="absolute left-0 top-0 w-[58vmin] max-w-[360px]"
        animate={{ x: `${-10 - 95 * walk}%`, y: `${-6 - 30 * walk}%`, scale: 1 + 0.5 * walk }}
        transition={camera}
      />
      <motion.img
        src={img('intro/branch-right')} alt="" className="absolute right-0 top-0 w-[62vmin] max-w-[390px]"
        animate={{ x: `${10 + 95 * walk}%`, y: `${-6 - 30 * walk}%`, scale: 1 + 0.5 * walk }}
        transition={camera}
      />

      {/* darkness that lifts as the walk begins */}
      <motion.div
        className="pointer-events-none absolute inset-0 bg-black"
        animate={{ opacity: phase === 'tap' ? 0.82 : phase === 'wake' ? 0.45 : 0.18 }}
        transition={{ duration: 2 }}
      />
      {/* 5. fireflies */}
      <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 2 }}>
        <Fireflies />
      </motion.div>

      {phase === 'tap' && (
        <button type="button" className="absolute inset-0 flex flex-col items-center justify-center gap-3" onClick={(e) => { e.stopPropagation(); begin(); }}>
          <span className="text-shadow font-pixel text-[38px] font-bold leading-none text-parchment">The Seed Archive</span>
          <motion.span
            className="text-shadow font-pixel text-[20px] text-cyan"
            animate={{ opacity: [1, 0.35, 1] }}
            transition={{ duration: 2.2, repeat: Infinity }}
          >
            Tap to begin
          </motion.span>
        </button>
      )}

      {/* magic seed: rises out of the lantern light, floats beside him, then
          flies into the archway */}
      <AnimatePresence>
        {seedOut && (
          <motion.div
            className="pointer-events-none absolute z-20"
            style={{ width: 84 }}
            initial={{ left: '30%', bottom: '4%', opacity: 0, scale: 0.3 }}
            animate={
              phase === 'outro'
                ? { left: '50%', bottom: '52%', opacity: [1, 1, 0], scale: 0.18, x: '-50%' }
                : { left: '58%', bottom: '5%', opacity: 1, scale: 1, x: '0%' }
            }
            transition={{ duration: phase === 'outro' ? 1.1 : 1.4, ease: 'easeInOut' }}
          >
            <img src={img('intro/magic-seed')} alt="" className="w-full" style={{ animation: 'seed-bob 2.6s ease-in-out infinite' }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bramblewick and his bubble */}
      <div className="safe pointer-events-none absolute inset-x-0 bottom-0 mx-auto flex max-w-[540px] flex-col items-start">
        {phase === 'talk' && !fullBody && (
          <Bubble text={text} visible={visible} className="mb-4 ml-1 mr-2 self-stretch" />
        )}
        <motion.div
          initial={{ x: '-120%' }}
          animate={{ x: showWizard ? '0%' : '-120%', opacity: fullBody ? 0 : 1 }}
          transition={{ x: { type: 'spring', stiffness: 160, damping: 20 }, opacity: { duration: 0.15 } }}
        >
          <Portrait pose={line.pose as Pose} talk={talkMode} size={188} />
        </motion.div>
      </div>

      <AnimatePresence>{fullBody && <FullBodyMoment key={fullBody} name={fullBody} />}</AnimatePresence>

      {/* name field */}
      {phase === 'name' && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-midnight/50 px-5" onClick={(e) => e.stopPropagation()}>
          <Frame kind="panel-wood" scale={0.3} className="w-full max-w-[380px]">
            <form
              className="flex flex-col items-stretch gap-3 px-2 py-2"
              onSubmit={(e) => { e.preventDefault(); audio.sfx('tap'); submitName(typed); }}
            >
              <label htmlFor="traveller-name" className="text-center font-pixel text-[20px] font-semibold">And you are…?</label>
              <input
                id="traveller-name"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                maxLength={16}
                autoComplete="off"
                autoCapitalize="words"
                placeholder="Your name"
                className="border-[3px] border-ink bg-cream px-3 py-2 text-center font-pixel text-[20px] text-ink outline-none placeholder:text-ink/40"
              />
              <div className="flex justify-center gap-2">
                <PixelButton onClick={() => submitName('')}>Skip</PixelButton>
                <PixelButton kind="primary" onClick={() => submitName(typed)}>That's me</PixelButton>
              </div>
            </form>
          </Frame>
        </div>
      )}

      {/* white flash at the very end */}
      <motion.div
        className="pointer-events-none absolute inset-0 z-50 bg-white"
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === 'outro' ? [0, 0, 1] : 0 }}
        transition={{ duration: 2.2, times: [0, 0.6, 1] }}
      />

      {phase !== 'outro' && (
        <button
          type="button"
          className="text-shadow safe absolute right-0 top-0 z-50 font-pixel text-[18px] text-parchment/90"
          onClick={(e) => { e.stopPropagation(); skip(); }}
        >
          Skip
        </button>
      )}
    </div>
  );
}
