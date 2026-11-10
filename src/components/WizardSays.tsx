import { Portrait } from './Bramblewick';
import { Bubble, useTypewriter } from './SpeechBubble';
import dialogue from '../data/bramblewick-dialogue.json';
import type { Pose } from '../lib/assets';
import { useApp, withName } from '../store';

type TextLine = { pose: string; text: string };
const TEXT_LINES = dialogue.textLines as unknown as Record<string, TextLine>;

export function textLine(id: string): TextLine {
  const line = TEXT_LINES[id];
  if (!line) throw new Error(`Missing text line: ${id}`);
  return line;
}

interface Props {
  /** id in the dialogue JSON's textLines section */
  line: string;
  pose?: Pose;
  portraitSize?: number;
  className?: string;
}

/**
 * Bramblewick saying a text-only line: portrait on the left, bubble beside
 * him, mouth flapping at 8Hz while the text types out. Tap to finish typing.
 */
export function WizardSays({ line, pose, portraitSize = 120, className = '' }: Props) {
  const name = useApp((s) => s.playerName);
  const def = textLine(line);
  const text = withName(def.text, name);
  const { visible, done, finish } = useTypewriter(text, line);
  return (
    <div className={`flex items-end gap-1 ${className}`} onClick={finish}>
      <Portrait pose={pose ?? (def.pose as Pose)} talk={done ? 'none' : 'fake'} hand size={portraitSize} />
      <Bubble text={text} visible={visible} tail={false} className="mb-6 min-w-0 flex-1" />
    </div>
  );
}
