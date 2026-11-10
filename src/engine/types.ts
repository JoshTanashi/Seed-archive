export type Edition = 'java' | 'bedrock';

/** Version groups the engine supports. `idx` matches g_versions in sa_engine.c. */
export interface VersionGroup {
  idx: number;
  label: string;
  java: string;
  bedrock: string;
}
export const VERSIONS: VersionGroup[] = [
  { idx: 0, label: '1.18', java: '1.18 – 1.18.2', bedrock: '1.18' },
  { idx: 1, label: '1.19', java: '1.19 – 1.19.4', bedrock: '1.19' },
  { idx: 2, label: '1.20', java: '1.20 – 1.20.6', bedrock: '1.20' },
  { idx: 3, label: '1.21', java: '1.21 – 1.21.3', bedrock: '1.21.0 – 1.21.4x' },
  { idx: 4, label: '1.21.4', java: '1.21.4', bedrock: '1.21.50 – 1.21.6x' },
  { idx: 5, label: '1.21.5 – 26.1', java: '1.21.5 – 26.1', bedrock: '1.21.70 – 26.1x' },
  { idx: 6, label: '26.2', java: '26.2', bedrock: '26.2x' },
  { idx: 7, label: '26.3', java: '26.3', bedrock: '26.3x' },
];
export const LATEST_VERSION = VERSIONS[VERSIONS.length - 1].idx;

/** Structure ids match the S_* enum in sa_engine.c. */
export interface StructDef {
  id: number;
  key: string;
  name: string;
  icon: string;
  minVersion: number;
  nether?: boolean;
}
export const STRUCTS: StructDef[] = [
  { id: 0, key: 'village', name: 'Village', icon: 'icons/struct-village', minVersion: 0 },
  { id: 1, key: 'ancient-city', name: 'Ancient City', icon: 'icons/struct-ancient-city', minVersion: 1 },
  { id: 2, key: 'fortress', name: 'Nether Fortress', icon: 'icons/struct-fortress', minVersion: 0, nether: true },
  { id: 3, key: 'ruined-portal', name: 'Ruined Portal', icon: 'icons/struct-ruined-portal', minVersion: 0 },
  { id: 4, key: 'mansion', name: 'Woodland Mansion', icon: 'icons/struct-mansion', minVersion: 0 },
  { id: 5, key: 'jungle-temple', name: 'Jungle Temple', icon: 'icons/struct-jungle-temple', minVersion: 0 },
  { id: 6, key: 'shipwreck', name: 'Shipwreck', icon: 'icons/struct-shipwreck', minVersion: 0 },
  { id: 7, key: 'trial-chamber', name: 'Trial Chamber', icon: 'icons/struct-trial-chamber', minVersion: 3 },
  { id: 8, key: 'pyramid', name: 'Desert Pyramid', icon: 'icons/struct-pyramid', minVersion: 0 },
  { id: 9, key: 'monument', name: 'Ocean Monument', icon: 'icons/struct-monument', minVersion: 0 },
];
export const structById = (id: number): StructDef => STRUCTS.find((s) => s.id === id)!;

/** Spawn biome choices. Ids match the B_* enum in sa_engine.c (0 = any). */
export interface BiomeGroup {
  id: number;
  key: string;
  name: string;
  icon: string;
  minVersion: number;
}
export const BIOME_GROUPS: BiomeGroup[] = [
  { id: 1, key: 'jungle', name: 'Jungle', icon: 'icons/biome-jungle', minVersion: 0 },
  { id: 2, key: 'cherry', name: 'Cherry Grove', icon: 'icons/biome-cherry', minVersion: 2 },
  { id: 3, key: 'snowy', name: 'Snowy', icon: 'icons/biome-snowy', minVersion: 0 },
  { id: 4, key: 'mushroom', name: 'Mushroom', icon: 'icons/biome-mushroom', minVersion: 0 },
  { id: 5, key: 'desert', name: 'Desert', icon: 'icons/biome-desert', minVersion: 0 },
  { id: 6, key: 'mangrove', name: 'Mangrove', icon: 'icons/biome-mangrove', minVersion: 1 },
  { id: 7, key: 'dark-forest', name: 'Dark Forest', icon: 'icons/biome-dark-forest', minVersion: 0 },
  { id: 8, key: 'badlands', name: 'Badlands', icon: 'icons/biome-badlands', minVersion: 0 },
  { id: 9, key: 'moss-cave', name: 'Lush Caves', icon: 'icons/biome-moss-cave', minVersion: 0 },
  { id: 10, key: 'deep-dark', name: 'Deep Dark', icon: 'icons/biome-deep-dark', minVersion: 1 },
];

export const LAND_SEA = { any: 0, island: 1, coast: 2, inland: 3 } as const;
export const LAND_SEA_NAMES = ['', 'Island', 'Coast', 'Inland'];

export interface QuestFilters {
  /** BiomeGroup id, 0 = surprise me */
  biome: number;
  /** LAND_SEA value */
  landSea: number;
  /** blocks, 0 = don't mind */
  strongholdMax: number;
  /** StructDef ids */
  structs: number[];
  /** blocks, 250..3000 */
  radius: number;
}
export const EMPTY_FILTERS: QuestFilters = { biome: 0, landSea: 0, strongholdMax: 0, structs: [], radius: 1000 };

export interface SearchParams {
  edition: Edition;
  version: number;
  filters: QuestFilters;
}

export interface Place {
  x: number;
  z: number;
}
export interface FoundStruct extends Place {
  id: number;
  dist: number;
}

export interface SeedMatch {
  /** decimal string, exactly what the player types into the game */
  seed: string;
  score: number;
  spawn: Place;
  spawnBiome: string;
  landSea: number;
  stronghold?: Place & { dist: number };
  structs: FoundStruct[];
}

export interface SeedDetail {
  seed: string;
  edition: Edition;
  version: number;
  spawn: Place;
  spawnBiome: string;
  landSea: number;
  strongholds: Place[];
  /** Nether structures are in Nether coordinates. */
  structs: (Place & { id: number })[];
}

export interface SavedSeed {
  seed: string;
  edition: Edition;
  version: number;
  note: string;
  savedAt: number;
  spawn: Place;
  spawnBiome: string;
  score?: number;
}

/** How many seeds reached / passed each stage of the search, in check order. */
export interface StageStats {
  reached: [number, number, number, number];
  passed: [number, number, number, number];
}
export const STAGES = ['spawn', 'landSea', 'stronghold', 'structs'] as const;
export type Stage = (typeof STAGES)[number];
