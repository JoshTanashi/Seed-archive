import type { ReactNode } from 'react';
import { Frame, Page, PixelButton, Toggle, TopBar } from '../components/ui';
import { VERSIONS } from '../engine/types';
import dialogue from '../data/bramblewick-dialogue.json';
import { useApp, type Settings as SettingsState } from '../store';

export const LEGAL_LINE =
  'Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft.';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[40px] items-center justify-between gap-3">
      <span className="font-pixel text-[17px] leading-tight">{label}</span>
      {children}
    </div>
  );
}

export function Settings() {
  const { settings, setSetting, edition, version, go, replace } = useApp();
  const v = VERSIONS.find((x) => x.idx === version);
  const toggle = (key: keyof SettingsState, label: string) => (
    <Row label={label}>
      <Toggle on={settings[key]} label={label} onChange={(on) => setSetting(key, on)} />
    </Row>
  );

  return (
    <Page>
      <TopBar title="Settings" />
      <div className="scroll-y mt-2 min-h-0 flex-1">
        <Frame kind="panel-stone" scale={0.3} className="w-full">
          <div className="flex flex-col gap-1 px-1 py-1">
            {toggle('sfx', 'Sound effects')}
            {toggle('ambience', 'Forest ambience')}
            {toggle('voice', "Bramblewick's voice")}
            {toggle('nap', dialogue.idleRules.settingsToggle)}
            <Row label={`${edition === 'java' ? 'Java' : 'Bedrock'} ${edition === 'java' ? v?.java : v?.bedrock}`}>
              <PixelButton onClick={() => go('edition')}>Change</PixelButton>
            </Row>
            <Row label="The story so far">
              <PixelButton onClick={() => replace('intro')}>Replay intro</PixelButton>
            </Row>
          </div>
        </Frame>

        <p className="text-shadow mt-4 px-3 text-center text-[13px] leading-snug text-parchment">{LEGAL_LINE}</p>
        <p className="text-shadow mt-3 px-3 text-center text-[11px] leading-snug text-parchment/70">
          The Seed Archive is a seed finder for Minecraft. World generation by cubiomes (MIT, © Cubitect);
          Bedrock rules after Bedrockified (MIT, © Earthcomputer). Pixelify Sans is used under the SIL Open
          Font Licence.
        </p>
      </div>
    </Page>
  );
}
