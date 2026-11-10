import { useState } from 'react';
import { audio } from '../audio/AudioManager';
import { Frame, IconButton } from './ui';
import { LAND_SEA_NAMES, structById, type Edition, type SeedMatch } from '../engine/types';
import { img } from '../lib/assets';
import { biomeIcon, copyText, fmt, prettyBiome } from '../lib/util';
import { useApp } from '../store';

/** One matching seed on a parchment card. */
export function SeedCard({ match, edition, version }: { match: SeedMatch; edition: Edition; version: number }) {
  const { openDetail, saveSeed, removeSeed } = useApp();
  const saved = useApp((s) => s.book.some((b) => b.seed === match.seed && b.edition === edition));
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (await copyText(match.seed)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    }
  };
  const toggleSave = () => {
    if (saved) removeSeed(match.seed, edition);
    else saveSeed({ seed: match.seed, edition, version, note: '', savedAt: Date.now(), spawn: match.spawn, spawnBiome: match.spawnBiome, score: match.score });
  };

  return (
    <Frame kind="card" scale={0.3} className="w-full">
      <div
        role="button"
        tabIndex={0}
        className="flex flex-col gap-1 px-1 py-1"
        onClick={() => {
          audio.sfx('tap');
          openDetail({ seed: match.seed, edition, version, match });
        }}
      >
        <div className="flex items-center gap-2">
          <img src={img(biomeIcon(match.spawnBiome))} alt="" className="h-[42px] w-[42px] flex-none object-contain" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-body text-[19px] font-semibold tabular-nums leading-tight">{match.seed}</div>
            <div className="text-[12px] leading-tight text-ink/75">
              {prettyBiome(match.spawnBiome)}
              {match.landSea ? ` · ${LAND_SEA_NAMES[match.landSea]}` : ''} · spawn {match.spawn.x}, {match.spawn.z}
            </div>
          </div>
          <div className="flex-none text-right font-pixel leading-none">
            <div className="text-[22px] font-bold text-robe">{match.score}</div>
            <div className="text-[11px] text-ink/70">match</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink/85">
          {match.stronghold && (
            <span className="flex items-center gap-1">
              <img src={img('icons/struct-stronghold-eye')} alt="Stronghold" className="h-[20px]" />
              {fmt(match.stronghold.dist)} blocks
            </span>
          )}
          {match.structs.map((s) => (
            <span key={s.id} className="flex items-center gap-1">
              <img src={img(structById(s.id).icon)} alt={structById(s.id).name} className="h-[20px]" />
              {fmt(s.dist)}
            </span>
          ))}
          <span className="ml-auto flex items-center gap-2">
            <button
              type="button"
              className="border-2 border-ink bg-cream px-2 py-[2px] font-pixel text-[13px]"
              onClick={(e) => {
                e.stopPropagation();
                audio.sfx('tap');
                void copy();
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
            <IconButton
              icon="icons/ui-favourite"
              label={saved ? 'Remove from Book of Worlds' : 'Save to Book of Worlds'}
              size={30}
              className={saved ? '' : 'opacity-40 grayscale'}
              onClick={toggleSave}
            />
          </span>
        </div>
      </div>
    </Frame>
  );
}
