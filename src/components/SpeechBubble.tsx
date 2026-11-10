import { useCallback, useEffect, useState } from 'react';

const CHARS_PER_SECOND = 40;

/**
 * Types a line out at about 40 characters a second.
 * `finish()` shows the whole line at once (first tap); `done` says so.
 */
export function useTypewriter(text: string, lineKey: string | number) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    setShown(0);
    let n = 0;
    const timer = window.setInterval(() => {
      n += 1;
      setShown(n);
      if (n >= text.length) window.clearInterval(timer);
    }, 1000 / CHARS_PER_SECOND);
    return () => window.clearInterval(timer);
  }, [text, lineKey]);

  const finish = useCallback(() => setShown(text.length), [text]);
  const count = Math.min(shown, text.length);
  return { visible: text.slice(0, count), done: count >= text.length, finish };
}

interface BubbleProps {
  /** the full line (reserves the bubble's final size) */
  text: string;
  /** the part typed so far */
  visible: string;
  tail?: boolean;
  className?: string;
}

/** Cream bubble, 3px ink border, square corners, tail pointing at Bramblewick. */
export function Bubble({ text, visible, tail = true, className = '' }: BubbleProps) {
  return (
    <div className={`bubble px-3 py-2 font-pixel text-[17px] leading-snug ${className}`}>
      <div className="relative">
        <span className="invisible">{text}</span>
        <span className="absolute inset-0">{visible}</span>
      </div>
      {tail && <span className="bubble-tail" />}
    </div>
  );
}
