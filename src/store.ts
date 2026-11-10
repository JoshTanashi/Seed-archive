import { create } from 'zustand';
import { audio, type Channel } from './audio/AudioManager';
import { loadBook, loadPref, saveBook, savePref } from './lib/storage';
import {
  EMPTY_FILTERS, LATEST_VERSION, type Edition, type QuestFilters, type SavedSeed, type SeedMatch,
} from './engine/types';

export type Screen =
  | 'intro' | 'edition' | 'home' | 'quest' | 'results' | 'detail' | 'book' | 'settings';

export interface Settings {
  sfx: boolean;
  ambience: boolean;
  voice: boolean;
  /** "Let Bramblewick nap": no idle pop-ups */
  nap: boolean;
}
const DEFAULT_SETTINGS: Settings = { sfx: true, ambience: true, voice: true, nap: false };

export interface SeedRef {
  seed: string;
  edition: Edition;
  version: number;
  match?: SeedMatch;
}

interface AppState {
  ready: boolean;
  screen: Screen;
  stack: Screen[];
  settings: Settings;
  introSeen: boolean;
  playerName: string;
  edition: Edition | null;
  version: number;
  filters: QuestFilters;
  /** bumped to start a fresh search on the results screen */
  searchRun: number;
  results: SeedMatch[];
  detail: SeedRef | null;
  book: SavedSeed[];
  /** true while the intro, the quest or a search is on screen */
  busy: boolean;

  boot(): Promise<void>;
  go(screen: Screen): void;
  replace(screen: Screen): void;
  back(): void;
  setSetting(key: keyof Settings, value: boolean): void;
  finishIntro(name?: string): void;
  setPlayerName(name: string): void;
  setEdition(edition: Edition, version: number): void;
  setFilters(filters: QuestFilters): void;
  startSearch(): void;
  setResults(results: SeedMatch[]): void;
  openDetail(ref: SeedRef): void;
  saveSeed(seed: SavedSeed): void;
  removeSeed(seed: string, edition: Edition): void;
  setNote(seed: string, edition: Edition, note: string): void;
  setBusy(busy: boolean): void;
}

function applyAudioSettings(s: Settings) {
  (['sfx', 'ambience', 'voice'] as Channel[]).forEach((c) => audio.setEnabled(c, s[c]));
}

export const useApp = create<AppState>((set, get) => ({
  ready: false,
  screen: 'intro',
  stack: [],
  settings: DEFAULT_SETTINGS,
  introSeen: false,
  playerName: '',
  edition: null,
  version: LATEST_VERSION,
  filters: EMPTY_FILTERS,
  searchRun: 0,
  results: [],
  detail: null,
  book: [],
  busy: false,

  async boot() {
    const [settings, introSeen, playerName, edition, version, book] = await Promise.all([
      loadPref<Settings>('settings', DEFAULT_SETTINGS),
      loadPref<boolean>('introSeen', false),
      loadPref<string>('playerName', ''),
      loadPref<Edition | null>('edition', null),
      loadPref<number>('version', LATEST_VERSION),
      loadBook(),
    ]);
    const merged = { ...DEFAULT_SETTINGS, ...settings };
    applyAudioSettings(merged);
    set({
      ready: true,
      settings: merged,
      introSeen,
      playerName,
      edition,
      version,
      book,
      screen: !introSeen ? 'intro' : edition ? 'home' : 'edition',
    });
  },

  go(screen) {
    set((s) => ({ screen, stack: [...s.stack, s.screen] }));
  },
  replace(screen) {
    set({ screen });
  },
  back() {
    set((s) => {
      const stack = s.stack.slice();
      const screen = stack.pop() ?? 'home';
      return { screen, stack };
    });
  },

  setSetting(key, value) {
    const settings = { ...get().settings, [key]: value };
    set({ settings });
    savePref('settings', settings);
    applyAudioSettings(settings);
  },

  finishIntro(name) {
    const playerName = (name ?? get().playerName).trim() || 'Not-Gerald';
    savePref('introSeen', true);
    savePref('playerName', playerName);
    set({ introSeen: true, playerName, screen: 'edition', stack: [] });
  },
  setPlayerName(name) {
    savePref('playerName', name);
    set({ playerName: name });
  },

  setEdition(edition, version) {
    savePref('edition', edition);
    savePref('version', version);
    set({ edition, version, filters: EMPTY_FILTERS });
  },

  setFilters(filters) {
    set({ filters });
  },
  startSearch() {
    set((s) => ({ searchRun: s.searchRun + 1, results: [] }));
  },
  setResults(results) {
    set({ results });
  },
  openDetail(ref) {
    set((s) => ({ detail: ref, screen: 'detail', stack: [...s.stack, s.screen] }));
  },

  saveSeed(seed) {
    const book = [seed, ...get().book.filter((b) => !(b.seed === seed.seed && b.edition === seed.edition))];
    set({ book });
    saveBook(book);
  },
  removeSeed(seed, edition) {
    const book = get().book.filter((b) => !(b.seed === seed && b.edition === edition));
    set({ book });
    saveBook(book);
  },
  setNote(seed, edition, note) {
    const book = get().book.map((b) => (b.seed === seed && b.edition === edition ? { ...b, note } : b));
    set({ book });
    saveBook(book);
  },
  setBusy(busy) {
    set({ busy });
  },
}));

/** Replaces {name} with the saved player name ("Traveller" when there is none). */
export function withName(text: string, name: string): string {
  return text.replace(/\{name\}/g, name.trim() || 'Traveller');
}
