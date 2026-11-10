import { useEffect } from 'react';
import { audio } from '../audio/AudioManager';
import { Portrait } from '../components/Bramblewick';
import { Frame, IconButton, Page, PixelButton } from '../components/ui';
import { img } from '../lib/assets';
import { useApp } from '../store';

/** The Archive: forest, Bramblewick idling in the corner, three ways onward. */
export function Home() {
  const go = useApp((s) => s.go);
  const bookCount = useApp((s) => s.book.length);

  useEffect(() => {
    audio.startAmbience();
  }, []);

  return (
    <Page>
      <div className="flex h-[46px] items-center justify-end">
        <IconButton icon="icons/ui-settings" label="Settings" onClick={() => go('settings')} />
      </div>

      <div className="mt-[6vh] flex justify-center">
        <Frame kind="banner-scroll" scale={0.36} className="w-[92%]">
          <h1 className="py-1 text-center font-pixel whitespace-nowrap text-[26px] font-bold leading-none">The Seed Archive</h1>
        </Frame>
      </div>

      <div className="mt-[7vh] flex flex-col items-center gap-5">
        <PixelButton kind="primary" big className="w-[84%]" onClick={() => go('quest')}>
          Begin a Quest
        </PixelButton>
        <PixelButton className="w-[68%]" onClick={() => go('book')}>
          <img src={img('intro/spellbook')} alt="" className="-my-2 h-[30px] w-[26px] object-contain" />
          Book of Worlds{bookCount > 0 ? ` (${bookCount})` : ''}
        </PixelButton>
      </div>

      <div className="mt-auto">
        <Portrait pose="neutral" size={176} />
      </div>
    </Page>
  );
}
