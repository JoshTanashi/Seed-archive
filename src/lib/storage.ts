import { Preferences } from '@capacitor/preferences';
import { get, set } from 'idb-keyval';
import type { SavedSeed } from '../engine/types';

// Settings and progress live in Capacitor Preferences (UserDefaults /
// SharedPreferences on device, localStorage on the web).
export async function loadPref<T>(key: string, fallback: T): Promise<T> {
  try {
    const { value } = await Preferences.get({ key });
    return value == null ? fallback : (JSON.parse(value) as T);
  } catch {
    return fallback;
  }
}

export function savePref(key: string, value: unknown): void {
  void Preferences.set({ key, value: JSON.stringify(value) }).catch(() => {});
}

// Saved seeds live in IndexedDB.
const BOOK_KEY = 'book-of-worlds';

export async function loadBook(): Promise<SavedSeed[]> {
  try {
    return (await get<SavedSeed[]>(BOOK_KEY)) ?? [];
  } catch {
    return [];
  }
}

export function saveBook(book: SavedSeed[]): void {
  void set(BOOK_KEY, book).catch(() => {});
}
