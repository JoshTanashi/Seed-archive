import { beforeAll, describe, expect, it } from 'vitest';
import known from './known-seeds.json';
import { CONFIRMED } from '../src/engine/capabilities';
import { SeedEngine } from '../src/engine/engine';
import { STRUCTS, type Edition } from '../src/engine/types';

/*
 * Compares the engine with tests/known-seeds.json (positions read from
 * Chunkbase), allowing +-16 blocks.
 *
 * A filter may only be switched on in src/engine/capabilities.ts when:
 *   - the engine finds at least 99% of the reference structures, and
 *   - at most 2% of what the engine reports is missing from the reference.
 * Spawn and strongholds must match on every seed.
 */
const TOLERANCE = known.toleranceBlocks;
const MIN_FOUND = 0.99;
const MAX_EXTRA = 0.02;

interface Entry {
  edition: string;
  version: number;
  seed: string;
  radiusChunks: number;
  spawn: number[];
  strongholds: number[][];
  structures: Record<string, number[][]>;
}
const entries = known.entries as Entry[];
const centre = (chunk: number) => chunk * 16 + 8;
const near = (ax: number, az: number, bx: number, bz: number) =>
  Math.abs(ax - bx) <= TOLERANCE && Math.abs(az - bz) <= TOLERANCE;

let engine: SeedEngine;
beforeAll(async () => {
  engine = await SeedEngine.load();
});

describe('known-seeds.json', () => {
  it('holds at least 20 Bedrock and 10 Java seeds', () => {
    const count = (ed: Edition) => new Set(entries.filter((e) => e.edition === ed).map((e) => e.seed)).size;
    expect(count('bedrock')).toBeGreaterThanOrEqual(20);
    expect(count('java')).toBeGreaterThanOrEqual(10);
  });
});

for (const edition of ['bedrock', 'java'] as Edition[]) {
  const mine = entries.filter((e) => e.edition === edition);

  describe(`${edition}: spawn`, () => {
    it('is within 16 blocks on every seed', () => {
      for (const e of mine) {
        engine.use(edition, e.version);
        const sp = engine.getSpawn(e.seed);
        expect(near(sp.x, sp.z, e.spawn[0], e.spawn[1]), `seed ${e.seed} v${e.version}: engine ${sp.x},${sp.z} vs ${e.spawn}`).toBe(true);
      }
    });
  });

  describe(`${edition}: strongholds`, () => {
    it('match on every seed, with none missing and none extra', () => {
      for (const e of mine) {
        engine.use(edition, e.version);
        const limit = e.radiusChunks * 16;
        const got = engine.getStrongholds(e.seed);
        for (const [cx, cz] of e.strongholds) {
          expect(got.some((g) => near(g.x, g.z, centre(cx), centre(cz))), `seed ${e.seed}: stronghold at chunk ${cx},${cz} not found`).toBe(true);
        }
        // every engine stronghold well inside the reference area must be in the reference
        for (const g of got) {
          if (Math.abs(g.x) > limit - 32 || Math.abs(g.z) > limit - 32) continue;
          expect(e.strongholds.some(([cx, cz]) => near(g.x, g.z, centre(cx), centre(cz))), `seed ${e.seed}: engine stronghold ${g.x},${g.z} is not in the reference`).toBe(true);
        }
      }
    });
  });

  describe(`${edition}: structures`, () => {
    for (const def of STRUCTS) {
      const confirmed = CONFIRMED[edition].structs[def.key];
      it(`${def.name} ${confirmed ? 'meets the bar to be offered' : 'is hidden (reported only)'}`, () => {
        let reference = 0;
        let found = 0;
        let reported = 0;
        let extra = 0;
        for (const e of mine) {
          const ref = e.structures[def.key];
          engine.use(edition, e.version);
          if (!ref || !engine.structSupported(def.id)) continue;
          const limit = e.radiusChunks * 16;
          const scale = def.nether ? 8 : 1;
          const got = engine.structuresNear(def.id, e.seed, 0, 0, limit * 1.5 * scale);
          reference += ref.length;
          for (const [cx, cz] of ref) {
            if (got.some((g) => near(g.x, g.z, centre(cx), centre(cz)))) found++;
          }
          for (const g of got) {
            if (Math.abs(g.x) > limit - 32 || Math.abs(g.z) > limit - 32) continue;
            reported++;
            if (!ref.some(([cx, cz]) => near(g.x, g.z, centre(cx), centre(cz)))) extra++;
          }
        }
        const foundRate = reference ? found / reference : 0;
        const extraRate = reported ? extra / reported : 0;
        console.log(`${edition} ${def.key}: found ${found}/${reference}, extra ${extra}/${reported}`);
        if (confirmed) {
          expect(reference, 'enough reference structures to judge').toBeGreaterThanOrEqual(20);
          expect(foundRate).toBeGreaterThanOrEqual(MIN_FOUND);
          expect(extraRate).toBeLessThanOrEqual(MAX_EXTRA);
        }
      });
    }
  });
}

describe('release gate', () => {
  it('Bedrock spawn, strongholds and villages are confirmed', () => {
    expect(CONFIRMED.bedrock.spawn).toBe(true);
    expect(CONFIRMED.bedrock.strongholds).toBe(true);
    expect(CONFIRMED.bedrock.structs.village).toBe(true);
  });
});
