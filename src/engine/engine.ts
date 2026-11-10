import createSeedEngine, { type SeedEngineModule } from './wasm/sa_engine.mjs';
import type { Edition, Place, QuestFilters, SeedDetail, SeedMatch, StageStats } from './types';

const SCRATCH_INTS = 1024;

/** A seed as the 64-bit number the game uses, from what a player would type. */
export function toSeed64(seed: string | bigint | number): bigint {
  return BigInt.asUintN(64, BigInt(seed));
}

/** The decimal string a player types: signed 64-bit, like the game shows it. */
export function seedToString(seed: bigint): string {
  return BigInt.asIntN(64, seed).toString();
}

/**
 * The seed engine: cubiomes plus the Bedrock placement rules, in WebAssembly.
 * Used from the search worker and from the tests. Not for the UI thread.
 */
export class SeedEngine {
  private buf: number;
  private edition: Edition | null = null;
  private version = -1;
  private seed: bigint | null = null;

  private constructor(private m: SeedEngineModule) {
    this.buf = m._malloc(SCRATCH_INTS * 4);
  }

  static async load(): Promise<SeedEngine> {
    return new SeedEngine(await createSeedEngine());
  }

  private ints(): Int32Array {
    return new Int32Array(this.m.HEAPU8.buffer, this.buf, SCRATCH_INTS);
  }

  /** Selects edition and version group. Returns false for an unknown version. */
  use(edition: Edition, version: number): boolean {
    if (this.edition === edition && this.version === version) return true;
    if (!this.m._sa_init(edition === 'java' ? 0 : 1, version)) return false;
    this.edition = edition;
    this.version = version;
    this.seed = null;
    return true;
  }

  setSeed(seed: string | bigint | number): void {
    const s = toSeed64(seed);
    if (this.seed === s) return;
    this.seed = s;
    this.m._sa_seed(Number(s & 0xffffffffn), Number(s >> 32n));
  }

  /** Fast path for the search loop: the two 32-bit halves of the seed. */
  setSeedParts(lo: number, hi: number): void {
    this.seed = null;
    this.m._sa_seed(lo >>> 0, hi >>> 0);
  }

  // ---- the brief's engine API ----

  generateBiomeAt(seed: string | bigint, x: number, z: number, y: number): number {
    this.setSeed(seed);
    return this.m._sa_biome_at(x, y, z);
  }

  biomeName(id: number): string {
    return this.m.UTF8ToString(this.m._sa_biome_name(id));
  }

  /** The structure generating in one region, or null if none does. */
  getStructurePos(
    type: number, seed: string | bigint, regionX: number, regionZ: number,
    edition: Edition, version: number,
  ): Place | null {
    this.use(edition, version);
    this.setSeed(seed);
    if (!this.m._sa_structure_pos(type, regionX, regionZ, this.buf)) return null;
    const a = this.ints();
    return { x: a[0], z: a[1] };
  }

  getSpawn(seed: string | bigint): Place {
    this.setSeed(seed);
    this.m._sa_spawn(this.buf);
    const a = this.ints();
    return { x: a[0], z: a[1] };
  }

  getStrongholds(seed: string | bigint, max = 12): Place[] {
    this.setSeed(seed);
    const n = this.m._sa_strongholds(this.buf, Math.min(max, 32));
    const a = this.ints();
    const out: Place[] = [];
    for (let i = 0; i < n; i++) out.push({ x: a[2 * i], z: a[2 * i + 1] });
    return out;
  }

  /** RGBA pixels of a size x size biome map centred on (cx, cz). */
  renderBiomeMap(seed: string | bigint, cx: number, cz: number, size: number, scale: 4 | 16 | 64 = 4): Uint8ClampedArray<ArrayBuffer> {
    this.setSeed(seed);
    const bytes = size * size * 4;
    const ptr = this.m._malloc(bytes);
    const out = new Uint8ClampedArray(bytes);
    if (this.m._sa_render_map(cx, cz, size, size, scale, ptr)) {
      out.set(new Uint8Array(this.m.HEAPU8.buffer, ptr, bytes));
    }
    this.m._free(ptr);
    return out;
  }

  // ---- helpers ----

  structSupported(type: number): boolean {
    return !!this.m._sa_struct_supported(type);
  }

  /** Structures of a type within radius blocks of an Overworld position. */
  structuresNear(type: number, seed: string | bigint, cx: number, cz: number, radius: number): Place[] {
    this.setSeed(seed);
    const max = SCRATCH_INTS / 2;
    const n = this.m._sa_structures(type, cx, cz, radius, this.buf, max);
    const a = this.ints();
    const out: Place[] = [];
    for (let i = 0; i < n; i++) out.push({ x: a[2 * i], z: a[2 * i + 1] });
    return out;
  }

  setFilters(f: QuestFilters): void {
    const a = this.ints();
    a[0] = f.biome;
    a[1] = f.landSea;
    a[2] = f.strongholdMax;
    a[3] = f.radius;
    a[4] = f.structs.length;
    f.structs.forEach((id, i) => (a[5 + i] = id));
    this.m._sa_set_filters(this.buf);
  }

  /** Checks the current seed (set with setSeedParts) against the filters. */
  check(seedString: string): SeedMatch | null {
    if (!this.m._sa_check(this.buf)) return null;
    const a = this.ints();
    const match: SeedMatch = {
      seed: seedString,
      score: a[7],
      spawn: { x: a[0], z: a[1] },
      spawnBiome: this.biomeName(a[2]),
      landSea: a[3],
      structs: [],
    };
    if (a[6] >= 0) match.stronghold = { x: a[4], z: a[5], dist: a[6] };
    for (let i = 0; i < a[8]; i++) {
      match.structs.push({ id: a[9 + 4 * i], x: a[10 + 4 * i], z: a[11 + 4 * i], dist: a[12 + 4 * i] });
    }
    return match;
  }

  stats(): StageStats {
    this.m._sa_stats(this.buf);
    const u = new Uint32Array(this.m.HEAPU8.buffer, this.buf, 8);
    return { reached: [u[0], u[1], u[2], u[3]], passed: [u[4], u[5], u[6], u[7]] };
  }

  /** Everything the detail screen shows for one seed. */
  describe(
    seed: string, edition: Edition, version: number, structIds: number[],
    withStrongholds: boolean, radius: number,
  ): SeedDetail {
    this.use(edition, version);
    this.setSeed(seed);
    this.m._sa_describe(this.buf);
    const a = this.ints();
    const spawn = { x: a[0], z: a[1] };
    const detail: SeedDetail = {
      seed, edition, version, spawn,
      spawnBiome: this.biomeName(a[2]),
      landSea: a[3],
      strongholds: withStrongholds ? this.getStrongholds(seed) : [],
      structs: [],
    };
    for (const id of structIds) {
      if (!this.structSupported(id)) continue;
      for (const p of this.structuresNear(id, seed, spawn.x, spawn.z, radius)) {
        detail.structs.push({ id, ...p });
      }
    }
    return detail;
  }
}
