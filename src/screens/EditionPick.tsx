import { useState } from 'react';
import { audio } from '../audio/AudioManager';
import { BackButton, Page, PixelButton, ProgressBar } from '../components/ui';
import { WizardSays } from '../components/WizardSays';
import { LATEST_VERSION, versionsFor, type Edition } from '../engine/types';
import { useApp } from '../store';

/** Text-only bubbles: edition first, then the version group. */
export function EditionPick() {
  const { edition: saved, version: savedVersion, setEdition, stack, back, replace } = useApp();
  const fromSettings = stack.length > 0;
  const [step, setStep] = useState<0 | 1>(0);
  const [edition, setEd] = useState<Edition>(saved ?? 'bedrock');
  const [version, setVersion] = useState(saved ? savedVersion : LATEST_VERSION);

  const done = () => {
    setEdition(edition, version);
    if (fromSettings) back();
    else replace('home');
  };

  return (
    <Page>
      <div className="flex h-[46px] items-center">
        {(fromSettings || step === 1) && <BackButton onClick={step === 1 ? () => setStep(0) : back} />}
      </div>
      <ProgressBar value={(step + 1) / 2} label={`${step + 1} of 2`} className="mx-6 mt-1" />
      <WizardSays line={step === 0 ? 'edition-ask' : 'version-ask'} className="mt-4" />

      {step === 0 ? (
        <div className="mt-6 flex flex-col items-stretch gap-4 px-6">
          {(['bedrock', 'java'] as Edition[]).map((e) => (
            <PixelButton
              key={e}
              kind="primary"
              big
              onClick={() => {
                audio.sfx('dialogue-blip');
                setEd(e);
                if (!versionsFor(e).some((v) => v.idx === version)) setVersion(LATEST_VERSION);
                setStep(1);
              }}
            >
              {e === 'bedrock' ? 'Bedrock' : 'Java'}
            </PixelButton>
          ))}
          <p className="text-shadow px-2 text-center text-[13px] leading-snug text-parchment/80">
            Bedrock is the edition on phones, tablets and consoles.
          </p>
        </div>
      ) : (
        <>
          <div className="scroll-y mt-3 min-h-0 flex-1 px-4">
            <div className="flex flex-col gap-2 pb-2">
              {[...versionsFor(edition)].reverse().map((v) => (
                <button
                  key={v.idx}
                  type="button"
                  aria-pressed={version === v.idx}
                  className={`flex items-baseline justify-between border-[3px] px-3 py-2 text-left ${
                    version === v.idx ? 'border-gold bg-robe/70' : 'border-ink/70 bg-midnight/60'
                  }`}
                  onClick={() => {
                    audio.sfx('tap');
                    setVersion(v.idx);
                  }}
                >
                  <span className="font-pixel text-[18px] text-parchment">
                    {edition === 'java' ? v.java : v.bedrock}
                  </span>
                  {v.idx === LATEST_VERSION && <span className="text-[12px] text-cyan">latest</span>}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-center pt-2">
            <PixelButton kind="primary" big onClick={done}>Onwards</PixelButton>
          </div>
        </>
      )}
    </Page>
  );
}
