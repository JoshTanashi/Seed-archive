export interface SeedEngineModule {
  HEAP32: Int32Array;
  HEAPU8: Uint8Array;
  HEAPU32: Uint32Array;
  UTF8ToString(ptr: number): string;
  _malloc(size: number): number;
  _free(ptr: number): void;
  _sa_init(edition: number, versionIdx: number): number;
  _sa_seed(lo: number, hi: number): void;
  _sa_biome_at(x: number, y: number, z: number): number;
  _sa_biome_name(id: number): number;
  _sa_spawn(out: number): void;
  _sa_strongholds(out: number, max: number): number;
  _sa_struct_supported(sid: number): number;
  _sa_structure_pos(sid: number, regX: number, regZ: number, out: number): number;
  _sa_structures(sid: number, cx: number, cz: number, radius: number, out: number, max: number): number;
  _sa_render_map(cx: number, cz: number, w: number, h: number, scale: number, rgba: number): number;
  _sa_set_filters(filters: number): void;
  _sa_stats(out: number): void;
  _sa_check(out: number): number;
  _sa_describe(out: number): void;
  _sa_version_count(): number;
}
export default function createSeedEngine(moduleArg?: Record<string, unknown>): Promise<SeedEngineModule>;
