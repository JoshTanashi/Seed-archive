/*
 * Bedrock Edition placement rules for The Seed Archive.
 *
 * Biomes are shared with Java from 1.18 onwards, so cubiomes answers every
 * biome question for both editions. What differs on Bedrock is WHERE the game
 * tries to put structures, the world spawn, and the strongholds.
 *
 * Sources for the rules (constants are Mojang's, the code here is our own):
 *   - Earthcomputer/bedrockified (MIT): strongholds, spawn point, +8 biome
 *     sample, Bedrock's Mersenne Twister based Random.
 *   - bedrock-dev/MCBEStructureFinder and the published region formula
 *     (salt / spacing / separation tables, linear vs triangular spread).
 */
#ifndef SA_BEDROCK_H_
#define SA_BEDROCK_H_

#include "../cubiomes/finders.h"

#ifdef __cplusplus
extern "C" {
#endif

/* ---- Bedrock's Random: MT19937 seeded with a 32-bit value ---- */
typedef struct { uint32_t mt[624]; int idx; } BMt;
void     bmtSeed(BMt *r, uint32_t seed);
uint32_t bmtNext(BMt *r);                 /* genrand_int32 */
uint32_t bmtNextInt(BMt *r, uint32_t n);  /* [0, n) */
float    bmtNextFloat(BMt *r);            /* [0, 1) */

/* Region grid of a structure type on Bedrock. Returns 0 if Bedrock does not
 * place this type with a region grid in the given version. */
int bedrockRegionSize(int structType, int mc);

/* The single generation attempt of a region (block coords, chunk corner +8).
 * Returns 0 if the region holds no attempt of this type. Dimension is implied
 * by the type (Fortress/Bastion are Nether coordinates). */
int bedrockStructurePos(int structType, int mc, uint64_t seed,
                        int regX, int regZ, Pos *pos);

/* Biome check for an attempt returned by bedrockStructurePos().
 * g must be seeded for the Overworld (Nether types need no biome check). */
int bedrockStructureViable(int structType, const Generator *g, Pos pos);

/* World spawn (Bedrockified's findSpawnPosition, on the 1:4 biome grid). */
Pos bedrockSpawn(const Generator *g);

/* Strongholds: the three "village strongholds" first, then the scattered grid
 * strongholds whose cell lies within gridRadius cells of the origin cell.
 * Returns the number written (at most max). Block coords (chunk + 8). */
int bedrockStrongholds(const Generator *g, Pos *out, int max, int gridRadius);

#ifdef __cplusplus
}
#endif

#endif
