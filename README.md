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

The `ios/` and `android/` projects are already in the repo, with icons and
splash screens generated from `/resources`.

```bash
npm run sync             # build the web app and copy it into both projects
npx cap open ios         # on a Mac with Xcode; run on an iPhone from there
npx cap open android
npm run assets           # only if /resources changes
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

### How it was checked

`tests/known-seeds.json` holds reference positions for 39 seeds (27 Bedrock,
12 Java, plus the same Bedrock seeds on older versions): spawn, strongholds and
ten structure types. Every value was read out of the Chunkbase seed map with
`scripts/harvest-chunkbase.mjs`; none comes from this engine. `npm test`
compares the engine against it, allowing 16 blocks.

They were read by script rather than by eye, and from Chunkbase rather than a
real world. Before a public release, spot-check a few in the game as well.

### What is offered per edition

`src/engine/capabilities.ts` lists which filters each edition may show. A filter
is on only if the tests show the engine finds at least 99% of the reference
structures and at most 2% of its own answers are missing from the reference.
Anything short of that stays hidden rather than showing results that might be
wrong.

| | Bedrock | Java |
|---|---|---|
| Spawn point, spawn biome, island / coast / inland | yes | yes |
| Stronghold distance | yes | yes |
| Village, Nether fortress | yes | yes |
| Ruined portal | yes | hidden |
| Ancient city, trial chamber, shipwreck, ocean monument | hidden | yes |
| Jungle temple, desert pyramid, woodland mansion | hidden | hidden |
| Dungeon | never (cannot be computed from the seed alone) | never |

The hidden Bedrock ones depend on terrain height, which the engine only
approximates. Bedrock versions 1.21.0 to 1.21.6x are not offered because the
spawn point was off by more than 16 blocks on one reference seed.

### Seed range

Java seeds are drawn from the full signed 64-bit range. Bedrock seeds are drawn
from 0 to 2,147,483,647, which every Bedrock version accepts when typed as a
plain number.

### Phase 2

`src/engine/source.ts` defines `SeedSource`. The app only talks to that
interface, so a server-backed source can replace the on-device one later.
