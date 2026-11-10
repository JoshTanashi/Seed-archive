import { BIOME_GROUPS, STRUCTS, type BiomeGroup, type Edition, type StructDef } from './types';

/*
 * What the app is allowed to offer, per edition.
 *
 * The rule from the brief: a filter is shown only if the engine's answers for
 * it have been confirmed against real worlds (tests/known-seeds.json, checked
 * with `npm test`). Anything unconfirmed is hidden rather than shown with
 * results that might be wrong. Flip a flag to true only once its test passes
 * on hand-checked seeds.
 *
 * Structures that are not listed at all (dungeons, for example) cannot be
 * computed from the seed alone by this engine, so they are never offered.
 */
export interface Confirmed {
  /** World spawn position (every search is measured from it). */
  spawn: boolean;
  strongholds: boolean;
  /** by StructDef.key */
  structs: Record<string, boolean>;
}

export const CONFIRMED: Record<Edition, Confirmed> = {
  java: {
    spawn: true,
    strongholds: true,
    structs: {
      village: true, 'ancient-city': true, fortress: true, 'ruined-portal': true, mansion: true,
      'jungle-temple': true, shipwreck: true, 'trial-chamber': true, pyramid: true, monument: true,
    },
  },
  bedrock: {
    spawn: false,
    strongholds: false,
    structs: {
      village: false, 'ancient-city': false, fortress: false, 'ruined-portal': false, mansion: false,
      'jungle-temple': false, shipwreck: false, 'trial-chamber': false, pyramid: false, monument: false,
    },
  },
};

export function spawnConfirmed(edition: Edition): boolean {
  return CONFIRMED[edition].spawn;
}

export function strongholdsOffered(edition: Edition): boolean {
  return CONFIRMED[edition].spawn && CONFIRMED[edition].strongholds;
}

export function structsOffered(edition: Edition, version: number): StructDef[] {
  if (!CONFIRMED[edition].spawn) return [];
  return STRUCTS.filter((s) => version >= s.minVersion && CONFIRMED[edition].structs[s.key]);
}

export function biomesOffered(edition: Edition, version: number): BiomeGroup[] {
  if (!CONFIRMED[edition].spawn) return [];
  return BIOME_GROUPS.filter((b) => version >= b.minVersion);
}

/** True when some filter is hidden for this edition, so the UI can say so. */
export function hasHiddenFilters(edition: Edition, version: number): boolean {
  const c = CONFIRMED[edition];
  return !c.spawn || !c.strongholds ||
    STRUCTS.some((s) => version >= s.minVersion && !c.structs[s.key]);
}
