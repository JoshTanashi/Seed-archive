import { useEffect, useMemo, useRef, useState } from 'react';
import { audio } from '../audio/AudioManager';
import { Frame, IconButton, Page, PixelButton, TopBar } from '../components/ui';
import { strongholdsOffered, structsOffered } from '../engine/capabilities';
import { seedSource } from '../engine/source';
import { LAND_SEA_NAMES, structById, VERSIONS, type SeedDetail as Detail } from '../engine/types';
import { img } from '../lib/assets';
import { copyText, fmt, prettyBiome, shareText } from '../lib/util';
import { useApp } from '../store';

const MAP_CELLS = 256;
type Scale = 4 | 16;

interface Row {
  key: string;
  icon: string;
  label: string;
  x: number;
  z: number;
  dist: number;
  nether?: boolean;
}

/** One seed: biome map centred on spawn, structure icons, coordinates. */
export function SeedDetail() {
  const { detail: ref, saveSeed, removeSeed } = useApp();
  const saved = useApp((s) => !!ref && s.book.some((b) => b.seed === ref.seed && b.edition === ref.edition));
  const canvas = useRef<HTMLCanvasElement>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [scale, setScale] = useState<Scale>(4);
  const [toast, setToast] = useState('');
  const [mapReady, setMapReady] = useState(false);

  const flash = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(''), 1500);
  };

  // Structures and strongholds (in the worker).
  useEffect(() => {
    if (!ref) return;
    let alive = true;
    const ids = structsOffered(ref.edition, ref.version).map((s) => s.id);
    seedSource
      .detail(ref.seed, ref.edition, ref.version, ids, strongholdsOffered(ref.edition), 2048)
      .then((d) => alive && setDetail(d))
      .catch(() => alive && flash('The map would not open'));
    return () => {
      alive = false;
    };
  }, [ref]);

  // Biome map, drawn by the engine into ImageData.
  useEffect(() => {
    if (!ref || !detail) return;
    let alive = true;
    setMapReady(false);
    seedSource
      .map(ref.seed, ref.edition, ref.version, detail.spawn.x, detail.spawn.z, MAP_CELLS, scale)
      .then((image) => {
        if (!alive || !canvas.current) return;
        canvas.current.getContext('2d')?.putImageData(image, 0, 0);
        setMapReady(true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [ref, detail, scale]);

  const rows = useMemo<Row[]>(() => {
    if (!detail) return [];
    const sp = detail.spawn;
    const far = (x: number, z: number) => Math.round(Math.hypot(x - sp.x, z - sp.z));
    const out: Row[] = [];
    detail.strongholds.forEach((s, i) =>
      out.push({ key: `sh${i}`, icon: 'icons/struct-stronghold-eye', label: 'Stronghold', x: s.x, z: s.z, dist: far(s.x, s.z) }));
    detail.structs.forEach((s, i) => {
      const def = structById(s.id);
      const k = def.nether ? 8 : 1;
      out.push({ key: `st${i}`, icon: def.icon, label: def.name, x: s.x, z: s.z, dist: far(s.x * k, s.z * k), nether: def.nether });
    });
    return out.sort((a, b) => a.dist - b.dist);
  }, [detail]);

  if (!ref) return null;
  const span = MAP_CELLS * scale;
  const half = span / 2;
  const onMap = (x: number, z: number) => detail && Math.abs(x - detail.spawn.x) < half && Math.abs(z - detail.spawn.z) < half;
  const pct = (v: number, c: number) => `${((v - c + half) / span) * 100}%`;
  const version = VERSIONS.find((v) => v.idx === ref.version);

  const copyCoords = async (label: string, x: number, z: number) => {
    audio.sfx('tap');
    if (await copyText(`${x} ~ ${z}`)) flash(`${label} copied`);
  };
  const toggleSave = () => {
    if (saved) {
      removeSeed(ref.seed, ref.edition);
      flash('Removed from the Book');
    } else if (detail) {
      saveSeed({ seed: ref.seed, edition: ref.edition, version: ref.version, note: '', savedAt: Date.now(), spawn: detail.spawn, spawnBiome: detail.spawnBiome, score: ref.match?.score });
      audio.sfx('page-flip');
      flash('Saved to the Book');
    }
  };
  const share = async () => {
    const where = detail ? ` Spawn ${detail.spawn.x}, ${detail.spawn.z} (${prettyBiome(detail.spawnBiome)}).` : '';
    const result = await shareText('A world from The Seed Archive',
      `Seed ${ref.seed} for ${ref.edition === 'java' ? 'Java' : 'Bedrock'} ${version?.label ?? ''}.${where}`);
    if (result === 'copied') flash('Copied to share');
  };

  return (
    <Page>
      <TopBar title="World" right={<IconButton icon="icons/ui-share" label="Share" onClick={() => void share()} />} />

      <div className="scroll-y min-h-0 flex-1 px-1 pb-2">
        <Frame kind="card" scale={0.3} className="w-full">
          <div className="px-1">
            <button type="button" className="block w-full text-center" onClick={async () => { audio.sfx('tap'); if (await copyText(ref.seed)) flash('Seed copied'); }}>
              <div className="font-body text-[22px] font-semibold tabular-nums leading-tight">{ref.seed}</div>
            </button>
            <div className="text-center text-[12px] text-ink/75">
              {ref.edition === 'java' ? 'Java' : 'Bedrock'} {ref.edition === 'java' ? version?.java : version?.bedrock}
              {detail && ` · ${prettyBiome(detail.spawnBiome)}${detail.landSea ? ` · ${LAND_SEA_NAMES[detail.landSea]}` : ''}`}
            </div>
          </div>
        </Frame>

        <div className="relative mt-2 aspect-square w-full overflow-hidden border-[3px] border-ink bg-midnight">
          <canvas ref={canvas} width={MAP_CELLS} height={MAP_CELLS} className="absolute inset-0 h-full w-full" style={{ opacity: mapReady ? 1 : 0.35 }} />
          {!mapReady && <div className="absolute inset-0 flex items-center justify-center font-pixel text-parchment">Unrolling the map…</div>}
          {detail && mapReady && (
            <>
              {rows.filter((r) => onMap(r.nether ? r.x * 8 : r.x, r.nether ? r.z * 8 : r.z)).map((r) => (
                <img
                  key={r.key}
                  src={img(r.icon)}
                  alt={r.label}
                  className="absolute h-[26px] w-[26px] -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-[0_1px_0_#0F0128]"
                  style={{ left: pct(r.nether ? r.x * 8 : r.x, detail.spawn.x), top: pct(r.nether ? r.z * 8 : r.z, detail.spawn.z) }}
                />
              ))}
              <img src={img('icons/ui-pin')} alt="Spawn" className="absolute h-[34px] w-[30px] -translate-x-1/2 -translate-y-full object-contain" style={{ left: '50%', top: '50%' }} />
            </>
          )}
          <button
            type="button"
            className="absolute bottom-1 right-1 border-2 border-ink bg-cream px-2 py-[2px] font-pixel text-[13px] text-ink"
            onClick={() => { audio.sfx('tap'); setScale(scale === 4 ? 16 : 4); }}
          >
            {scale === 4 ? 'Zoom out' : 'Zoom in'} · {fmt(span)} blocks wide
          </button>
        </div>

        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <PixelButton kind="primary" onClick={async () => { if (await copyText(ref.seed)) flash('Seed copied'); }}>Copy seed</PixelButton>
          <PixelButton onClick={toggleSave} silent>
            <img src={img('icons/ui-favourite')} alt="" className={`-my-1 h-[22px] w-[22px] object-contain ${saved ? '' : 'opacity-60 grayscale'}`} />
            {saved ? 'Saved' : 'Save to Book'}
          </PixelButton>
        </div>

        {detail && (
          <ul className="mt-2 flex flex-col gap-1">
            <CoordRow icon="icons/ui-pin" label="Spawn" x={detail.spawn.x} z={detail.spawn.z} onCopy={copyCoords} />
            {rows.slice(0, 28).map((r) => (
              <CoordRow key={r.key} icon={r.icon} label={r.nether ? `${r.label} (Nether)` : r.label} x={r.x} z={r.z} dist={r.dist} onCopy={copyCoords} />
            ))}
          </ul>
        )}
        <p className="text-shadow mt-2 px-2 text-center text-[12px] text-parchment/70">Tap a place to copy its coordinates.</p>
      </div>

      {toast && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[10%] z-40 flex justify-center">
          <div className="bubble px-3 py-1 font-pixel text-[16px]">{toast}</div>
        </div>
      )}
    </Page>
  );
}

function CoordRow({ icon, label, x, z, dist, onCopy }: {
  icon: string; label: string; x: number; z: number; dist?: number; onCopy: (label: string, x: number, z: number) => void;
}) {
  return (
    <li>
      <button
        type="button"
        className="flex w-full items-center gap-2 border-[3px] border-ink/70 bg-midnight/70 px-2 py-1 text-left"
        onClick={() => onCopy(label, x, z)}
      >
        <img src={img(icon)} alt="" className="h-[26px] w-[26px] flex-none object-contain" />
        <span className="min-w-0 flex-1 truncate font-pixel text-[15px] text-parchment">{label}</span>
        <span className="font-body text-[14px] tabular-nums text-cream">{x}, {z}</span>
        {dist !== undefined && <span className="w-[62px] text-right text-[11px] text-parchment/70">{fmt(dist)} away</span>}
      </button>
    </li>
  );
}
