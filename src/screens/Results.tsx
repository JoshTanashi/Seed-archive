import { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { audio } from '../audio/AudioManager';
import { FullBodyMoment, FULL_BODY_HOLD_MS } from '../components/Bramblewick';
import { SeedCard } from '../components/SeedCard';
import { Page, PixelButton, ProgressBar, TopBar } from '../components/ui';
import { WizardSays } from '../components/WizardSays';
import { MAX_MATCHES, seedSource, TIME_LIMIT_MS, type DoneReason } from '../engine/source';
import type { SeedMatch, StageStats } from '../engine/types';
import { fmt, loosen } from '../lib/util';
import { useApp } from '../store';

const NO_STATS: StageStats = { reached: [0, 0, 0, 0], passed: [0, 0, 0, 0] };

/** Search progress and the streaming list of matching seeds. */
export function Results() {
  const { edition, version, filters, searchRun, results, setResults, setFilters, startSearch, back, setBusy } = useApp();
  const ed = edition ?? 'bedrock';
  const [searched, setSearched] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState<DoneReason | null>(results.length ? 'limit' : null);
  const [celebrate, setCelebrate] = useState(false);
  const [zzz, setZzz] = useState(false);
  const [loosened, setLoosened] = useState('');
  const stats = useRef<StageStats>(NO_STATS);
  const ranFor = useRef(results.length ? searchRun : -1);

  // Run the search (once per searchRun; coming back from a seed keeps the list).
  useEffect(() => {
    if (ranFor.current === searchRun) return;
    ranFor.current = searchRun;
    const found: SeedMatch[] = [];
    setSearched(0);
    setElapsed(0);
    setDone(null);
    setBusy(true);
    stats.current = NO_STATS;
    const cancel = seedSource.search({ edition: ed, version, filters }, {
      onMatch(match) {
        found.push(match);
        found.sort((a, b) => b.score - a.score);
        setResults(found.slice());
        if (found.length === 1) {
          audio.sfx('seed-found');
          setCelebrate(true);
          window.setTimeout(() => setCelebrate(false), FULL_BODY_HOLD_MS);
        }
      },
      onProgress(n, s, ms) {
        stats.current = s;
        setSearched(n);
        setElapsed(ms);
      },
      onDone(reason) {
        setDone(reason);
        setBusy(false);
      },
    });
    return () => {
      cancel();
      setBusy(false);
      ranFor.current = -1;
    };
    // filters / edition are read once per run on purpose
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchRun]);

  // "zzz" now and then while he dozes.
  const searching = done === null;
  useEffect(() => {
    if (!searching) return;
    const timer = window.setInterval(() => {
      setZzz(true);
      window.setTimeout(() => setZzz(false), 2200);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [searching]);

  const widen = () => {
    const wider = loosen(filters, stats.current);
    if (!wider) return;
    setLoosened(wider.what);
    setFilters(wider.filters);
    startSearch();
  };

  const none = !searching && results.length === 0;
  const progress = searching ? Math.max(elapsed / TIME_LIMIT_MS, results.length / MAX_MATCHES) : 1;
  const line = none ? 'search-none' : results.length > 0 ? (searching ? 'search-found' : 'search-done') : zzz ? 'search-zzz' : null;

  return (
    <Page>
      <TopBar title={searching ? 'Searching…' : 'Worlds Found'} />
      <ProgressBar value={progress} label={`Worlds searched: ${fmt(searched)}`} className="mx-4 mt-1" />

      <div className="mt-1 min-h-[104px]">
        {line ? (
          <WizardSays key={line} line={line} portraitSize={104} />
        ) : (
          <WizardSays key="doze" line="search-zzz" portraitSize={104} className="[&_.bubble]:invisible" />
        )}
      </div>

      {none && (
        <div className="mt-3 flex flex-col items-center gap-3">
          {loosen(filters, stats.current) && (
            <PixelButton kind="primary" onClick={widen}>Loosen the spell</PixelButton>
          )}
          <PixelButton onClick={back}>Change the quest</PixelButton>
        </div>
      )}

      {loosened && results.length > 0 && (
        <p className="text-shadow px-3 text-center text-[12px] text-parchment/80">Spell loosened to {loosened}.</p>
      )}

      <div className="scroll-y mt-2 min-h-0 flex-1 px-1">
        <div className="flex flex-col gap-2 pb-3">
          {results.map((m) => (
            <SeedCard key={m.seed} match={m} edition={ed} version={version} />
          ))}
        </div>
      </div>

      <AnimatePresence>{celebrate && <FullBodyMoment name="celebrate" />}</AnimatePresence>
    </Page>
  );
}
