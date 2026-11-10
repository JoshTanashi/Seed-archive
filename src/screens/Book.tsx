import { useEffect } from 'react';
import { audio } from '../audio/AudioManager';
import { Frame, Page, TopBar } from '../components/ui';
import { WizardSays } from '../components/WizardSays';
import { VERSIONS } from '../engine/types';
import { img } from '../lib/assets';
import { biomeIcon, prettyBiome } from '../lib/util';
import { useApp } from '../store';

/** Book of Worlds: saved seeds on parchment, each with a personal note. */
export function Book() {
  const { book, openDetail, removeSeed, setNote } = useApp();

  useEffect(() => {
    audio.sfx('page-flip');
  }, []);

  return (
    <Page parchment>
      <TopBar title="Book of Worlds" />
      {book.length === 0 ? (
        <>
          <WizardSays line="book-empty" className="mt-6" />
          <p className="text-shadow mt-4 px-4 text-center text-[14px] text-parchment/85">
            Tap the star on any world you find to keep it here.
          </p>
        </>
      ) : (
        <div className="scroll-y mt-2 min-h-0 flex-1 px-1">
          <div className="flex flex-col gap-2 pb-3">
            {book.map((b) => {
              const v = VERSIONS.find((x) => x.idx === b.version);
              return (
                <Frame key={`${b.edition}:${b.seed}`} kind="card" scale={0.3} className="w-full">
                  <div className="flex flex-col gap-1 px-1 py-1">
                    <div
                      role="button"
                      tabIndex={0}
                      className="flex items-center gap-2"
                      onClick={() => {
                        audio.sfx('tap');
                        openDetail({ seed: b.seed, edition: b.edition, version: b.version });
                      }}
                    >
                      <img src={img(biomeIcon(b.spawnBiome))} alt="" className="h-[40px] w-[40px] flex-none object-contain" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-body text-[18px] font-semibold tabular-nums leading-tight">{b.seed}</div>
                        <div className="text-[12px] leading-tight text-ink/75">
                          {b.edition === 'java' ? 'Java' : 'Bedrock'} {v?.label} · {prettyBiome(b.spawnBiome)} · spawn {b.spawn.x}, {b.spawn.z}
                        </div>
                      </div>
                      <button
                        type="button"
                        aria-label="Remove from the Book"
                        className="h-[30px] w-[30px] flex-none"
                        onClick={(e) => {
                          e.stopPropagation();
                          audio.sfx('tap');
                          removeSeed(b.seed, b.edition);
                        }}
                      >
                        <img src={img('ui/button-close')} alt="" className="h-full w-full" />
                      </button>
                    </div>
                    <textarea
                      value={b.note}
                      onChange={(e) => setNote(b.seed, b.edition, e.target.value)}
                      rows={2}
                      maxLength={240}
                      placeholder="A note to yourself…"
                      aria-label={`Note for seed ${b.seed}`}
                      className="w-full resize-none border-2 border-ink/50 bg-cream/70 px-2 py-1 font-body text-[14px] text-ink outline-none placeholder:text-ink/40"
                    />
                  </div>
                </Frame>
              );
            })}
          </div>
        </div>
      )}
    </Page>
  );
}
