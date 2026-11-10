import { Clipboard } from '@capacitor/clipboard';
import { Share } from '@capacitor/share';
import type { QuestFilters, StageStats } from '../engine/types';

export async function copyText(text: string): Promise<boolean> {
  try {
    await Clipboard.write({ string: text });
    return true;
  } catch {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
}

/** Native share sheet; falls back to copying where there is none. */
export async function shareText(title: string, text: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    const { value } = await Share.canShare();
    if (value) {
      await Share.share({ title, text, dialogTitle: title });
      return 'shared';
    }
  } catch {
    /* cancelled, or no share sheet: fall through */
  }
  return (await copyText(text)) ? 'copied' : 'failed';
}

/** "dark_forest" -> "Dark Forest" */
export function prettyBiome(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** The kit icon that best stands for a biome name from the engine. */
export function biomeIcon(name: string): string {
  if (name.includes('jungle')) return 'icons/biome-jungle';
  if (name.includes('cherry')) return 'icons/biome-cherry';
  if (name.includes('mushroom')) return 'icons/biome-mushroom';
  if (name.includes('mangrove')) return 'icons/biome-mangrove';
  if (name.includes('dark_forest')) return 'icons/biome-dark-forest';
  if (name.includes('badlands')) return 'icons/biome-badlands';
  if (name.includes('desert')) return 'icons/biome-desert';
  if (name.includes('ocean')) return 'icons/biome-ocean';
  if (/snow|frozen|ice|grove|jagged/.test(name) && !name.includes('cherry')) return 'icons/biome-snowy';
  return 'icons/ui-compass';
}

export const fmt = (n: number) => n.toLocaleString('en-US');

const STRONGHOLD_STEPS = [500, 1000, 2000, 0];

/**
 * Widens the most restrictive filter: the stage that let the smallest share
 * of seeds through during the last search. Returns null if nothing is left to
 * loosen.
 */
export function loosen(f: QuestFilters, stats: StageStats): { filters: QuestFilters; what: string } | null {
  const active = [f.biome !== 0, f.landSea !== 0, f.strongholdMax !== 0, f.structs.length > 0];
  let worst = -1;
  let worstRate = 2;
  for (let i = 0; i < 4; i++) {
    if (!active[i]) continue;
    // a stage nothing reached is as tight as the one before it; skip it
    const rate = stats.reached[i] > 0 ? stats.passed[i] / stats.reached[i] : 1.5;
    if (rate < worstRate) {
      worstRate = rate;
      worst = i;
    }
  }
  if (worst < 0) return null;
  if (worst === 0) return { filters: { ...f, biome: 0 }, what: 'any waking place' };
  if (worst === 1) return { filters: { ...f, landSea: 0 }, what: 'any shore' };
  if (worst === 2) {
    const next = STRONGHOLD_STEPS[STRONGHOLD_STEPS.indexOf(f.strongholdMax) + 1] ?? 0;
    return { filters: { ...f, strongholdMax: next }, what: next ? `the End's door within ${fmt(next)}` : "any distance to the End's door" };
  }
  if (f.radius < 3000) {
    const radius = Math.min(3000, f.radius * 2);
    return { filters: { ...f, radius }, what: `neighbours within ${fmt(radius)}` };
  }
  return { filters: { ...f, structs: f.structs.slice(0, -1) }, what: 'one neighbour fewer' };
}
