import type { CSSProperties, ReactNode } from 'react';
import { audio } from '../audio/AudioManager';
import { img } from '../lib/assets';
import { useApp } from '../store';

const px = (value: number) => ({ '--px': value }) as CSSProperties;

// ---------------------------------------------------------------- backdrop --

const FLIES = [
  { left: '8%', top: '62%', w: 54, anim: 'drift-a 13s linear infinite', delay: '0s' },
  { left: '70%', top: '70%', w: 64, anim: 'drift-b 17s linear infinite', delay: '-6s' },
  { left: '38%', top: '40%', w: 44, anim: 'drift-a 19s linear infinite', delay: '-11s' },
  { left: '82%', top: '30%', w: 48, anim: 'drift-b 15s linear infinite', delay: '-3s' },
  { left: '20%', top: '22%', w: 40, anim: 'drift-b 21s linear infinite', delay: '-14s' },
];
const SPARKS = [
  { left: '50%', top: '55%', anim: 'drift-a 11s linear infinite', delay: '-2s' },
  { left: '14%', top: '80%', anim: 'drift-b 14s linear infinite', delay: '-8s' },
  { left: '88%', top: '52%', anim: 'drift-a 16s linear infinite', delay: '-5s' },
];

/** Slowly drifting fireflies (fireflies.png clusters and single sparks). */
export function Fireflies() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {FLIES.map((f, i) => (
        <img
          key={i}
          src={img('intro/fireflies')}
          alt=""
          className="absolute"
          style={{ left: f.left, top: f.top, width: f.w, animation: f.anim, animationDelay: f.delay }}
        />
      ))}
      {SPARKS.map((f, i) => (
        <img
          key={`s${i}`}
          src={img('intro/firefly-single')}
          alt=""
          className="absolute"
          style={{ left: f.left, top: f.top, width: 22, animation: f.anim, animationDelay: f.delay }}
        />
      ))}
    </div>
  );
}

/** forest-path.png under a 55% midnight overlay, with fireflies. */
export function Backdrop({ parchment = false }: { parchment?: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-midnight">
      <img src={img('scenes/forest-path')} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: '56% 50%' }} />
      <div className="absolute inset-0" style={{ background: 'rgba(15, 1, 40, 0.55)' }} />
      {parchment && (
        <div
          className="pixelated absolute inset-0"
          style={{ backgroundImage: `url(${img('ui/texture-parchment')})`, backgroundSize: '256px 256px', opacity: 0.2 }}
        />
      )}
      <Fireflies />
    </div>
  );
}

// ------------------------------------------------------------------ frames --

type FrameKind = 'panel-wood' | 'panel-stone' | 'banner-scroll' | 'card';

export function Frame({ kind, scale = 0.25, className = '', children }: {
  kind: FrameKind; scale?: number; className?: string; children: ReactNode;
}) {
  return (
    <div className={`frame frame-${kind} text-ink ${className}`} style={px(scale)}>
      <div className="frame-in">{children}</div>
    </div>
  );
}

// ----------------------------------------------------------------- buttons --

interface PixelButtonProps {
  kind?: 'primary' | 'secondary';
  big?: boolean;
  disabled?: boolean;
  silent?: boolean;
  className?: string;
  onClick: () => void;
  children: ReactNode;
}

export function PixelButton({ kind = 'secondary', big = false, disabled, silent, className = '', onClick, children }: PixelButtonProps) {
  const scale = big ? 0.42 : 0.3;
  return (
    <button
      type="button"
      disabled={disabled}
      className={`frame frame-button-${kind} font-pixel font-semibold transition-transform active:scale-95 disabled:opacity-40 ${
        kind === 'primary' ? 'text-cream' : 'text-parchment'
      } ${big ? 'text-[26px]' : 'text-[18px]'} ${className}`}
      style={px(scale)}
      onClick={() => {
        if (!silent) audio.sfx('tap');
        onClick();
      }}
    >
      <span className="frame-in text-shadow flex items-center justify-center gap-2 whitespace-nowrap leading-none" style={{ minHeight: big ? 30 : 22 }}>
        {children}
      </span>
    </button>
  );
}

export function IconButton({ icon, label, size = 46, className = '', onClick }: {
  icon: string; label: string; size?: number; className?: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`flex-none transition-transform active:scale-90 ${className}`}
      style={{ width: size, height: size }}
      onClick={(e) => {
        e.stopPropagation();
        audio.sfx('tap');
        onClick();
      }}
    >
      <img src={img(icon)} alt="" className="h-full w-full object-contain" />
    </button>
  );
}

/** button-back in the top-left corner; goes back unless told otherwise. */
export function BackButton({ onClick }: { onClick?: () => void }) {
  const back = useApp((s) => s.back);
  return <IconButton icon="ui/button-back" label="Back" onClick={onClick ?? back} />;
}

export function TopBar({ title, onBack, right }: { title?: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <div className="relative z-10 flex h-[46px] flex-none items-center gap-2">
      <BackButton onClick={onBack} />
      <h1 className="text-shadow min-w-0 flex-1 truncate text-center font-pixel text-[24px] font-bold text-parchment">{title}</h1>
      <div className="flex w-[46px] flex-none justify-end">{right}</div>
    </div>
  );
}

export function Toggle({ on, label, onChange }: { on: boolean; label: string; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className="flex-none transition-transform active:scale-95"
      onClick={() => {
        audio.sfx('tap');
        onChange(!on);
      }}
    >
      <img src={img(on ? 'ui/toggle-on' : 'ui/toggle-off')} alt="" style={{ width: 68, height: 34 }} />
    </button>
  );
}

// ---------------------------------------------------------------- progress --

/** progress-empty with progress-full revealed from the left. value is 0..1. */
export function ProgressBar({ value, label, className = '' }: { value: number; label?: string; className?: string }) {
  const v = Math.max(0, Math.min(1, value));
  // the crystal caps take about 15% of each end; keep them out of the sweep
  const reveal = 14 + v * 72;
  return (
    <div className={`relative ${className}`}>
      <div className="frame frame-progress-empty h-[30px] w-full" style={px(0.27)} />
      <div
        className="frame frame-progress-full absolute inset-0 h-[30px] w-full"
        style={{ ...px(0.27), clipPath: `inset(0 ${100 - reveal}% 0 0)`, transition: 'clip-path 300ms linear', opacity: v > 0 ? 1 : 0 }}
      />
      {label && (
        <div className="text-shadow absolute inset-0 flex items-center justify-center font-pixel text-[13px] text-cream">{label}</div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------- tiles --

/** A big icon choice for the quest. */
export function ChoiceTile({ icon, label, selected, sub, onClick }: {
  icon?: string; label: string; selected?: boolean; sub?: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`flex flex-col items-center justify-start gap-1 rounded-none border-[3px] px-1 py-2 transition-transform active:scale-95 ${
        selected ? 'border-gold bg-robe/70' : 'border-ink/70 bg-midnight/60'
      }`}
      onClick={() => {
        audio.sfx('tap');
        onClick();
      }}
    >
      {icon && <img src={img(icon)} alt="" className="h-[56px] w-[64px] object-contain" />}
      <span className="font-pixel text-[14px] leading-tight text-parchment">{label}</span>
      {sub && <span className="text-[11px] leading-tight text-parchment/70">{sub}</span>}
    </button>
  );
}

/** Page shell: backdrop plus a centred column that respects the safe areas. */
export function Page({ children, parchment, className = '' }: { children: ReactNode; parchment?: boolean; className?: string }) {
  return (
    <div className="absolute inset-0">
      <Backdrop parchment={parchment} />
      <div className={`safe relative mx-auto flex h-full w-full max-w-[540px] flex-col ${className}`}>{children}</div>
    </div>
  );
}
