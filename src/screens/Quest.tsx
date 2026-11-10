import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { audio } from '../audio/AudioManager';
import { FullBodyMoment } from '../components/Bramblewick';
import { ChoiceTile, Page, PixelButton, ProgressBar, TopBar } from '../components/ui';
import { WizardSays } from '../components/WizardSays';
import { biomesOffered, hasHiddenFilters, spawnConfirmed, strongholdsOffered, structsOffered } from '../engine/capabilities';
import { LAND_SEA, structById, type QuestFilters } from '../engine/types';
import { img } from '../lib/assets';
import { fmt } from '../lib/util';
import { useApp } from '../store';

type StepId = 'biome' | 'sea' | 'end' | 'neighbours' | 'cast';
const LINE: Record<StepId, string> = {
  biome: 'quest-biome', sea: 'quest-sea', end: 'quest-end', neighbours: 'quest-neighbours', cast: 'quest-cast',
};

/** The search builder: one question per step, big icon choices underneath. */
export function Quest() {
  const { edition, version, filters, setFilters, startSearch, replace, back, go, setBusy } = useApp();
  const ed = edition ?? 'bedrock';
  const [f, setF] = useState<QuestFilters>(filters);
  const [at, setAt] = useState(0);
  const [casting, setCasting] = useState(false);

  useEffect(() => {
    setBusy(true);
    return () => setBusy(false);
  }, [setBusy]);

  const biomes = useMemo(() => biomesOffered(ed, version), [ed, version]);
  const structs = useMemo(() => structsOffered(ed, version), [ed, version]);
  const steps = useMemo(() => {
    const s: StepId[] = [];
    if (biomes.length) s.push('biome');
    if (spawnConfirmed(ed)) s.push('sea');
    if (strongholdsOffered(ed)) s.push('end');
    if (structs.length) s.push('neighbours');
    s.push('cast');
    return s;
  }, [ed, biomes, structs]);

  // Nothing can be searched until the spawn point is confirmed for this edition.
  if (!spawnConfirmed(ed)) {
    return (
      <Page>
        <TopBar title="A Quest" />
        <WizardSays line="quest-unsure" className="mt-6" />
        <p className="text-shadow mt-4 px-4 text-center text-[14px] leading-snug text-parchment/85">
          Bedrock searching unlocks once the engine's answers have been checked against real worlds.
          Java searching works today.
        </p>
        <div className="mt-6 flex justify-center">
          <PixelButton onClick={() => go('edition')}>Change edition</PixelButton>
        </div>
      </Page>
    );
  }

  const step = steps[Math.min(at, steps.length - 1)];
  const next = () => {
    audio.sfx('dialogue-blip');
    setAt((a) => Math.min(a + 1, steps.length - 1));
  };
  const pick = (patch: Partial<QuestFilters>) => {
    setF((cur) => ({ ...cur, ...patch }));
    next();
  };
  const cast = () => {
    // drop anything this edition / version no longer offers
    const clean: QuestFilters = {
      ...f,
      biome: biomes.some((b) => b.id === f.biome) ? f.biome : 0,
      strongholdMax: strongholdsOffered(ed) ? f.strongholdMax : 0,
      structs: f.structs.filter((id) => structs.some((s) => s.id === id)),
    };
    setFilters(clean);
    setCasting(true);
    audio.sfx('spell');
    window.setTimeout(() => {
      startSearch();
      replace('results');
    }, 1300);
  };

  const summary: string[] = [];
  const biome = biomes.find((b) => b.id === f.biome);
  summary.push(biome ? `Wake in: ${biome.name}` : 'Wake anywhere');
  if (f.landSea === LAND_SEA.island) summary.push('On an island');
  if (f.landSea === LAND_SEA.coast) summary.push('By the coast');
  if (f.landSea === LAND_SEA.inland) summary.push('Far inland');
  if (f.strongholdMax) summary.push(`End's door within ${fmt(f.strongholdMax)} blocks`);
  if (f.structs.length) summary.push(`${f.structs.map((id) => structById(id).name).join(', ')} within ${fmt(f.radius)} blocks`);

  return (
    <Page>
      <TopBar title="A Quest" onBack={at > 0 && !casting ? () => setAt(at - 1) : back} />
      <ProgressBar value={(at + 1) / steps.length} label={`${at + 1} of ${steps.length}`} className="mx-6 mt-1" />
      <WizardSays key={step} line={LINE[step]} className="mt-2" />

      <div className="scroll-y min-h-0 flex-1 px-1 pb-2">
        {step === 'biome' && (
          <div className="grid grid-cols-3 gap-2">
            {biomes.map((b) => (
              <ChoiceTile key={b.id} icon={b.icon} label={b.name} selected={f.biome === b.id} onClick={() => pick({ biome: b.id })} />
            ))}
            <ChoiceTile icon="icons/ui-compass" label="Surprise me" selected={f.biome === 0} onClick={() => pick({ biome: 0 })} />
          </div>
        )}

        {step === 'sea' && (
          <div className="grid grid-cols-2 gap-2">
            <ChoiceTile icon="icons/biome-island" label="Island" sub="sea all around" selected={f.landSea === 1} onClick={() => pick({ landSea: 1 })} />
            <ChoiceTile icon="icons/biome-ocean" label="Coast" sub="sea close by" selected={f.landSea === 2} onClick={() => pick({ landSea: 2 })} />
            <ChoiceTile label="Inland" sub="no sea in sight" selected={f.landSea === 3} onClick={() => pick({ landSea: 3 })} />
            <ChoiceTile label="Don't mind" selected={f.landSea === 0} onClick={() => pick({ landSea: 0 })} />
          </div>
        )}

        {step === 'end' && (
          <>
            <div className="mb-2 flex justify-center">
              <img src={img('icons/struct-stronghold-eye')} alt="" className="h-[64px]" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[500, 1000, 2000].map((d) => (
                <ChoiceTile key={d} label={`Within ${fmt(d)}`} sub="blocks of spawn" selected={f.strongholdMax === d} onClick={() => pick({ strongholdMax: d })} />
              ))}
              <ChoiceTile label="Don't mind" selected={f.strongholdMax === 0} onClick={() => pick({ strongholdMax: 0 })} />
            </div>
          </>
        )}

        {step === 'neighbours' && (
          <>
            <div className="grid grid-cols-3 gap-2">
              {structs.map((s) => {
                const on = f.structs.includes(s.id);
                return (
                  <ChoiceTile
                    key={s.id}
                    icon={s.icon}
                    label={s.name}
                    selected={on}
                    onClick={() => setF((cur) => ({ ...cur, structs: on ? cur.structs.filter((x) => x !== s.id) : [...cur.structs, s.id] }))}
                  />
                );
              })}
            </div>
            <label className="mt-3 block px-2 font-pixel text-[16px] text-parchment">
              <span className="text-shadow">Within {fmt(f.radius)} blocks of spawn</span>
              <input
                type="range"
                min={250}
                max={3000}
                step={50}
                value={f.radius}
                onChange={(e) => setF((cur) => ({ ...cur, radius: Number(e.target.value) }))}
                className="mt-2 w-full accent-[#3FF0FF]"
              />
            </label>
            {hasHiddenFilters(ed, version) && (
              <p className="text-shadow mt-2 px-2 text-[12px] leading-snug text-parchment/75">
                Some neighbours are hidden for this edition until their locations have been confirmed.
              </p>
            )}
          </>
        )}

        {step === 'cast' && (
          <ul className="mx-2 mt-1 border-[3px] border-ink/70 bg-midnight/70 px-3 py-2 text-[15px] leading-relaxed text-parchment">
            {summary.map((line) => (
              <li key={line}>• {line}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex justify-center pt-2">
        {step === 'cast' ? (
          <PixelButton kind="primary" big disabled={casting} silent onClick={cast}>Cast the spell</PixelButton>
        ) : step === 'neighbours' ? (
          <PixelButton kind="primary" onClick={next}>{f.structs.length ? 'Next' : 'No neighbours'}</PixelButton>
        ) : null}
      </div>

      <AnimatePresence>{casting && <FullBodyMoment name="casting" />}</AnimatePresence>
    </Page>
  );
}
