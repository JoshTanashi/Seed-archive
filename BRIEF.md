# The Seed Archive: Build Brief

> **For Fable:** read this whole file before writing code. Every asset already exists in this kit. **Do not generate, redraw or replace any art, audio or fonts.** Use the paths exactly as listed. If something you need is missing, stop and ask; don't invent a placeholder.

---

## 1. What we're building

**The Seed Archive** is a companion app for Minecraft that works in reverse from a normal seed map. The player describes the world they want to build in (spawn biome, island, stronghold nearby, a village and so on), and the app searches for seeds that match.

It's wrapped in a small, cosy story. **Bramblewick** is a lonely old hedge-wizard who has kept the Seed Archive for centuries. He mistakes the player for **Gerald**, his adventuring friend who "popped out for mushrooms" 300 years ago and never came back.

- **First user:** one player on **Bedrock, on iPhone**. Bedrock accuracy is the top priority.
- **Later:** a public release on iOS and Android, covering Java and Bedrock.
- **Tone:** peaceful and quiet. All the big dialogue happens once, in the intro. After that, Bramblewick only shows up now and then.

### Legal and naming (required)
- The app's name is **"The Seed Archive"**. It is never called "Minecraft ...". In store copy it's described as *"a seed finder for Minecraft"*.
- Show this line on the Settings screen and in the store listing: *"Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft."*
- Don't use any Minecraft textures, logos, fonts or mob art. All art in this kit is original.

---

## 2. Stack

| Part | Choice |
|---|---|
| App | React 18 + Vite + TypeScript |
| Mobile | Capacitor (iOS + Android) |
| Styling | Tailwind CSS, plus a small `pixel.css` for the 9-slice frames |
| State | Zustand |
| Local storage | `@capacitor/preferences` for settings and progress; IndexedDB (`idb-keyval`) for saved seeds |
| Audio | Howler.js (one shared audio manager; see §8) |
| UI animation | Framer Motion |
| Intro animation | One full-screen `<canvas>` or layered absolutely-positioned `<img>`s with transforms. **No video file.** |
| Seed engine | **cubiomes** (C, MIT) compiled to **WebAssembly** with Emscripten, run in a **Web Worker** |
| Icons and splash | `npx @capacitor/assets generate` using `/resources/icon.png` and `/resources/splash.png` |

**Global rendering rule:** every pixel-art image uses `image-rendering: pixelated;`. Never blur or smooth-scale the art.

---

## 3. Kit contents and target paths

Copy everything from this kit into `/src/assets` (art), `/public/audio` (audio), `/src/fonts` and `/src/data`. `/resources` goes at the repo root.

```
assets/
  icons/          36 icons. Names say what they are:
                  biome-*      (jungle, island, cherry, snowy, mushroom, desert, mangrove,
                                dark-forest, badlands, ocean, moss-cave, deep-dark)
                  struct-*     (stronghold-eye, village, ancient-city, fortress, ruined-portal,
                                dungeon, mansion, jungle-temple, shipwreck, trial-chamber,
                                pyramid, monument)
                  prog-*       (enchanted-book, pickaxe, diamond, netherite, emerald, dragon-egg)
                  ui-*         (search, pin, compass, favourite, share, settings)
  intro/          wizard-grandpa, magic-seed, branch-left, branch-right, ferns, fireflies,
                  firefly-single, rune-archway (centre is transparent: draw the portal glow
                  behind it in code), spellbook
  scenes/         forest-path.png  (1672x941, the intro and home background)
  wizard/
    portrait/     14 waist-up frames, ALL THE SAME SIZE AND POSITION. Stack them; never move them.
                  neutral, neutral-talk, smile, smile-talk, suspicious, dopey, startled,
                  sheepish, sad, whisper, smug, sleepy, neutral-talk-hand, smile-talk-hand
    fullbody/     startled-jump, lonely-stump, casting, celebrate   (big moments only)
  ui/             panel-wood, panel-stone, banner-scroll, button-primary-stone,
                  button-secondary-wood, card-parchment, button-close, button-back,
                  toggle-on, toggle-off, progress-empty, progress-full,
                  texture-parchment (tiling, use at low opacity)
                  nine-slice.json  (border-image slice values per frame + how-to)
  app-icon/       icon-1024/512/192/180/120
audio/
  voice/          intro-01..11.mp3, idle-01..05.mp3 (levelled to -18 LUFS)
  sfx/            ambience-forest-loop.mp3 (seamless 28s loop), tap, dialogue-blip,
                  page-flip, spell, seed-found
fonts/            Pixelify Sans (variable + static weights) + OFL licence
data/
  bramblewick-dialogue.json   every voiced line: id, audio file, portrait pose,
                              bubble text, full-body moment, talk rules, idle rules
resources/        icon.png (1024) and splash.png / splash-dark.png (2732) for @capacitor/assets
```

### Visual system
- **Font:** Pixelify Sans for headings, buttons and speech bubbles. Use a clean system font (`-apple-system, Inter, sans-serif`) for long text and seed numbers so they stay readable.
- **Palette** (taken from the art):
  - Midnight `#0F0128`
  - Deep purple `#2A0B4F`
  - Robe purple `#5B21B6`
  - Magic cyan `#3FF0FF`
  - Moss `#6BBF3A`
  - Gold `#F5B83D`
  - Parchment `#F3DDB0`
  - Ink `#2B1A10`
- **Frames:** every panel, button and card is a 9-slice using the values in `nine-slice.json`. Example: `border-image: url(panel-wood.png) 100 100 90 100 fill / 25px 25px 22px 25px stretch;`
- **Speech bubbles:** draw them in code. Cream `#FBF4E6` fill, 3px ink border with square pixel corners, a little tail pointing at Bramblewick, Pixelify Sans text. The text types itself out at about 40 characters per second; tapping once shows the full line, and tapping again moves to the next line.
- **Background:** `forest-path.png`, darkened with a 55% midnight overlay on every screen after the intro, with `fireflies.png` drifting slowly.

---

## 4. Screens

1. **Intro** (first launch only; can be replayed from Settings)
2. **Edition pick** (text bubble, straight after the intro)
3. **Archive (home):** forest background, Bramblewick's portrait in the bottom-left corner (idle, blinking), a big primary button **"Begin a Quest"**, secondary buttons **"Book of Worlds"** and the settings gear (`ui-settings`).
4. **Quest (search builder):** see §6.
5. **Results:** a list of `card-parchment` cards, one per matching seed. Each card shows the seed number, a match score, the spawn biome icon, the distance to the stronghold, the structures near spawn, and buttons to copy and save (`ui-favourite`).
6. **Seed detail:**
   - A biome map drawn by the engine onto a canvas, centred on spawn, with structure icons placed at their coordinates and a pin (`ui-pin`) at spawn.
   - A list of coordinates, each tappable to copy it.
   - Buttons to **Copy seed**, **Save to Book**, and share (`ui-share`, using the native share sheet).
7. **Book of Worlds:** saved seeds on parchment (`texture-parchment` background), each with a short personal note. Uses `page-flip` when opened.
8. **Settings:** all the switches use `toggle-on` / `toggle-off`.
   - Sound effects (on/off)
   - Forest ambience (on/off)
   - Bramblewick's voice (on/off)
   - "Let Bramblewick nap" (stops the idle pop-ups)
   - Edition and version (change them again)
   - Replay intro
   - The legal line from §1

Navigation: `button-back` in the top-left corner of every screen except home. Modals close with `button-close`.

---

## 5. Intro sequence (first launch)

The dialogue moves forward when the player taps, Clash-of-Clans style. A **Skip** text button in the top-right corner jumps straight to the edition pick. Every line's text, audio, pose and action is in `bramblewick-dialogue.json`; build the sequence from that file, don't hard-code it.

**Scene setup:** the forest is drawn as layers for a parallax effect. From back to front:
1. `forest-path.png` (slow zoom from 1.0 to 1.25 scale)
2. `rune-archway` (centred on the path, glow behind it)
3. `ferns` at the bottom corners
4. `branch-left` and `branch-right` sliding outwards past the camera
5. `fireflies` drifting

Moving forward = the layers scale up and slide apart at different speeds.

| Beat | Visual | Audio |
|---|---|---|
| 0 | Black screen, `fireflies` fade in, ambience fades in over 2s | ambience |
| 1 (`intro-01`) | The camera walks down the path. Bramblewick's portrait slides in, eyes closed (`sleepy`) | snore |
| 2 (`intro-02`) | **Full-body `startled-jump`**: he pops up, the screen shakes for 150ms, then he settles back into the `startled` portrait | GERALD?! |
| 3–5 | Portrait poses per the JSON (suspicious, sad with **full-body `lonely-stump`**, sheepish) | |
| 6 (`intro-06`) | After the line, show a name field on a `panel-wood` frame. "Skip" means the name is set to *Not-Gerald* | |
| 7 (`intro-07`) | The bubble shows the typed name: replace `{name}` in the text | |
| 8–10 | `magic-seed` rises out of the lantern light and floats beside him | |
| 11 (`intro-11`) | **Full-body `casting`**: the seed flies into `rune-archway`, the runes glow cyan, the screen flashes white, then the edition pick | `spell` sfx |

Save `introSeen = true` once it finishes or is skipped.

## 6. Edition pick and Quest (search builder)

These are **text-only bubbles**, with no voice audio. Bramblewick (portrait) asks one question per step, with the choices underneath as big icon buttons. Each step uses the `progress-*` bar.

1. **Edition** (asked after the intro, and changeable in Settings):
   - *"Tell me, Traveller, do you hail from the Java lands or the Bedrock isles?"* Choices: Java / Bedrock.
   - Then the version: a list of version groups the engine supports. Default to the latest.
2. **Spawn biome:** *"Where shall you wake each morning?"* A grid of the `biome-*` icons. Can pick one, or "Surprise me".
3. **Land or sea:** *"Do you fancy the sea about you?"* Choices: Island (`biome-island`), Coast (`biome-ocean`), Inland, Don't mind.
4. **The End:** *"And how near must the End's door be?"* (`struct-stronghold-eye`). Choices: within 500 / 1,000 / 2,000 blocks, or Don't mind.
5. **Neighbours:** *"Any neighbours you'd like nearby?"* Multi-select from the `struct-*` icons, with a radius slider (250–3,000 blocks).
6. **Cast:** Bramblewick switches to the `casting` portrait and the spell sound plays.

### Search progress
- A `progress-full` bar fills up while he dozes (`sleepy` portrait, with a "zzz" bubble now and then).
- Results stream in as they're found, and the bar shows "Worlds searched: N".
- **When the first match is found:** full-body `celebrate`, the `seed-found` sound, and the bubble *"Ha! There it is. Gerald would be green with envy."*
- **If nothing is found within the time limit:** `sheepish` portrait, *"Bah! Even I can't conjure that one. Shall we loosen the spell a little?"* Then offer to widen the most restrictive filter.

**Text-only lines for these moments live in a new `textLines` section of the dialogue JSON.** Add them there; keep the voiced `intro`/`idle` entries exactly as they are.

---

## 7. Bramblewick character system

- **Portrait component:** stack all 14 portrait PNGs absolutely in one box and show only the active pose. Because every frame shares one size and position, he never jumps around.
- **Talking:** while a voice clip plays, feed it into a Web Audio `AnalyserNode`. When the loudness (RMS) goes above roughly 0.08, show the `-talk` frame, and below it the closed frame. Only `neutral` and `smile` have talking frames. Other poses should do a 1–2px bob in time with the loudness instead.
- **Text-only lines** (with no audio): use the same talking animation with a fake 8Hz mouth flap while the text types out.
- **Always running:**
  - A float: 2px up and down, on a 3s loop.
  - A blink every 4–6s: switch to `sleepy` for 120ms, then back.
- **Full-body moments:** shown over the scene with a quick scale pop, held for about 1.2s, then they fade back to the portrait. Use them **only** where §5 and §6 say to.
- **Idle pop-ups:** follow `idleRules` in the JSON.
  - Trigger after 60s with no input on one screen.
  - At most once per session, and even then only a 33% chance.
  - Never during the intro, the quest or a search.
  - He slides in from the left with an `idle-*` line.
  - Tapping him sends him off with the `dopey` face and a "Hmph." bubble.
  - Turned off by "Let Bramblewick nap".
- **Lines with a `{name}`** get the saved player name. When there isn't one, use "Traveller".

---

## 8. Audio and settings

"Quiet but cutely there": the voice comes first, sound effects sit softly underneath, and the ambience is barely there. The files are already levelled; these are the playback volumes on top.

| Channel | Files | Volume | Setting |
|---|---|---|---|
| Voice | `voice/*` | 1.0 | Bramblewick's voice |
| SFX | `tap` (every button), `dialogue-blip` (each dialogue advance), `page-flip`, `spell`, `seed-found` | 0.6 | Sound effects |
| Ambience | `ambience-forest-loop` (looping) | 0.5, ducked to 0.2 while voice plays (300ms fade) | Forest ambience |

- One `AudioManager` (Howler), with the three channels each toggled separately. Save the toggles with `@capacitor/preferences`. All are on by default.
- **Ambience** fades in and out over 1.5s. Pause it when the app goes to the background (Capacitor `App` `pause` and `resume` events).
- **When the voice is off,** dialogue still works as text-only bubbles.
- **No audio before the first tap.** iOS needs a user gesture before audio can play, so start the intro with a "Tap to begin" screen over the dark forest with drifting fireflies.

---

## 9. Seed engine (the hard part: build it carefully)

### Facts
- Since 1.18, **Java and Bedrock generate the same biomes for the same seed.** One biome engine covers both editions.
- **Structure positions differ between editions.**
  - **Java:** cubiomes handles them accurately.
  - **Bedrock:** there's no ready-made library. The placement rules have been reverse-engineered by the community: *Bedrockified* (Earthcomputer) and *MCBEStructureFinder* (xiaohengying), which the seed-map site mcseedmap.net uses.
  - **Check the seed range before searching.** Confirm which seeds the target Bedrock version actually accepts (Bedrock's range has historically differed from Java's), and only search seeds a player can type into the game.

### Architecture
1. `engine/` holds a cubiomes WASM build (Emscripten), exposing `generateBiomeAt(seed, x, z, y)`, `getStructurePos(type, seed, regionX, regionZ, edition, version)`, `getSpawn(seed)`, `getStrongholds(seed)` and `renderBiomeMap(seed, cx, cz, size)`.
2. `engine/bedrock/` is a TypeScript (or C) module with the Bedrock placement rules for each structure type, **ported from the sources above** and checked by tests. Both editions use cubiomes for biome checks.
3. `searchWorker.ts` (a Web Worker) works through random seeds in the edition's seed range. **It runs the cheapest checks first and stops at the first failure:**
   1. The spawn biome
   2. Island or coast (sample the biomes around spawn)
   3. Stronghold distance
   4. The other structures (position, then the biome they need)

   It streams every match back to the UI with a score, and stops at 25 matches or 60 seconds, whichever comes first. It must not block the UI.
4. **Map preview:** `renderBiomeMap` draws into an ImageData canvas, with the matching `struct-*` icons drawn on top.

### Required test step (before the app is shown to anyone)
- Make a `tests/known-seeds.json` with at least 20 Bedrock and 10 Java seeds, each with structure coordinates checked by hand against Chunkbase or a real game.
- Write `vitest` tests that compare the engine's results against that file, allowing ±16 blocks.
- **Bedrock strongholds, villages and spawn have to pass** before release, because the first user plays Bedrock.
- If a Bedrock structure type can't be confirmed, the app must **hide that filter for Bedrock** rather than show results that might be wrong. Never fake or estimate positions silently.

### Phase 2 (public release; don't build now)
A server-side scanner that pre-indexes millions of seeds into a database, so searches come back instantly. Design the worker's interface so the source of results can be swapped from on-device to the server later.

---

## 10. Build order

1. Project setup: Vite + React + TS + Capacitor + Tailwind; assets copied in; the Pixelify Sans font set up; `pixel.css` with the 9-slice classes.
2. The AudioManager, the Settings screen and the stored settings.
3. The Bramblewick component (stacked frames, talking animation, blink and float, full-body moments, speech bubble with typing).
4. The intro sequence, driven by the dialogue JSON.
5. Archive home, edition pick, and the Quest builder UI (connected to mock results first).
6. The cubiomes WASM build and the Java engine, with tests.
7. The Bedrock structure module, with tests. **This blocks the release.**
8. The search worker connected to the UI, then Results, Seed detail with the map, and Book of Worlds.
9. Idle pop-ups, polish, `@capacitor/assets` icons and splash, then device testing on iPhone.

---

## 11. Done means

- The intro plays once, every line in sync with its audio, the mouth moves with the voice, and the skip button works.
- Turning sound effects, ambience or voice off works immediately and stays off after the app restarts.
- No art is blurry anywhere (it's all pixelated).
- The Bedrock test seeds pass for spawn, strongholds and villages.
- A search for *"jungle spawn + island + stronghold within 1,000 blocks"* on Bedrock returns real seeds that check out on Chunkbase.
- Searching never freezes the UI, and the app works offline.
