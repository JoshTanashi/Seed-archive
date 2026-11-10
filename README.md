# The Seed Archive

A seed finder for Minecraft that works in reverse: describe the world you want
and Bramblewick, a lonely old hedge-wizard, searches for seeds that match.

*Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft.*

The full specification is in [BRIEF.md](BRIEF.md).

## Run it

```bash
npm install
npm run dev        # web, http://localhost:5173
npm test           # engine tests against tests/known-seeds.json
npm run build      # production build into dist/
```

### iPhone and Android (Capacitor)

```bash
npm run build
npx cap add ios          # once, on a Mac with Xcode
npx cap add android      # once
npm run assets           # icons and splash from /resources
npx cap sync
npx cap open ios
```

## Layout

| Path | What |
|---|---|
| `src/screens` | Intro, edition pick, Archive (home), Quest, Results, Seed detail, Book of Worlds, Settings |
| `src/components` | Bramblewick (stacked portrait frames, talking, blink, float, full-body moments), speech bubble, 9-slice UI |
| `src/audio/AudioManager.ts` | The one Howler audio manager: voice, sfx, ambience |
| `src/data/bramblewick-dialogue.json` | Every line. The voiced `intro` / `idle` entries are the kit's; `textLines` holds the text-only ones |
| `src/engine` | TypeScript side of the seed engine: WASM wrapper, search worker, result source, capability flags |
| `engine/` | C side: vendored cubiomes, the Bedrock placement rules, and `build.sh` (Emscripten) |
| `tests/` | `known-seeds.json` and the vitest suite |

## The seed engine

- `engine/cubiomes` is [cubiomes](https://github.com/Cubitect/cubiomes) (MIT), vendored untouched at commit `e61f905`.
- `engine/patches` extends it to the 1.21.5 and 26.x biome trees (from [SeedForge](https://github.com/fwsoapy/seedforge), MIT).
- `engine/bedrock` holds the Bedrock rules: region structures, strongholds and world spawn.
- `engine/src/sa_engine.c` is the API compiled to WebAssembly: `generateBiomeAt`, `getStructurePos`, `getSpawn`, `getStrongholds`, `renderBiomeMap`, and the search check.

The compiled engine (`src/engine/wasm`) is committed, so the app builds without
Emscripten. To rebuild it after changing anything in `engine/`:

```bash
source /path/to/emsdk/emsdk_env.sh
npm run engine
```

### What is offered per edition

`src/engine/capabilities.ts` lists which filters each edition may show. A filter
is only switched on once its answers pass the tests against hand-checked seeds
in `tests/known-seeds.json`; anything unconfirmed stays hidden rather than
showing results that might be wrong.

### Phase 2

`src/engine/source.ts` defines `SeedSource`. The app only talks to that
interface, so a server-backed source can replace the on-device one later.
