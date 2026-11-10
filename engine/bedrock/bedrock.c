#include "bedrock.h"
#include <math.h>
#include <string.h>

/* ------------------------------------------------------------------------ */
/* MT19937, written to the published specification.                          */
/* ------------------------------------------------------------------------ */

void bmtSeed(BMt *r, uint32_t seed)
{
    int i;
    r->mt[0] = seed;
    for (i = 1; i < 624; i++)
        r->mt[i] = 1812433253u * (r->mt[i-1] ^ (r->mt[i-1] >> 30)) + (uint32_t)i;
    r->idx = 624;
}

static void bmtTwist(BMt *r)
{
    int i;
    for (i = 0; i < 624; i++)
    {
        uint32_t y = (r->mt[i] & 0x80000000u) | (r->mt[(i+1) % 624] & 0x7fffffffu);
        uint32_t v = r->mt[(i + 397) % 624] ^ (y >> 1);
        if (y & 1) v ^= 0x9908b0dfu;
        r->mt[i] = v;
    }
    r->idx = 0;
}

uint32_t bmtNext(BMt *r)
{
    uint32_t y;
    if (r->idx >= 624) bmtTwist(r);
    y = r->mt[r->idx++];
    y ^= y >> 11;
    y ^= (y << 7) & 0x9d2c5680u;
    y ^= (y << 15) & 0xefc60000u;
    y ^= y >> 18;
    return y;
}

uint32_t bmtNextInt(BMt *r, uint32_t n) { return n ? bmtNext(r) % n : 0; }
float bmtNextFloat(BMt *r) { return (float)(bmtNext(r) * 2.3283064365386963e-10); }

/* ------------------------------------------------------------------------ */
/* Region-grid structures                                                    */
/* ------------------------------------------------------------------------ */

enum { SPREAD_LINEAR, SPREAD_TRIANGULAR, SPREAD_JAVA };
enum { PICK_ANY, PICK_FORTRESS, PICK_BASTION };

typedef struct {
    int type; uint32_t salt; int spacing; int range; int spread; int pick; int minMc;
} BConf;

/* range = spacing - separation: the width of the area the attempt may fall in */
static const BConf g_conf[] = {
    { Village,        10387312,  34, 26, SPREAD_TRIANGULAR, PICK_ANY,      MC_1_18 },
    { Mansion,        10387319,  80, 60, SPREAD_TRIANGULAR, PICK_ANY,      MC_1_18 },
    { Monument,       10387313,  32, 27, SPREAD_TRIANGULAR, PICK_ANY,      MC_1_18 },
    { Ancient_City,   20083232,  24, 16, SPREAD_TRIANGULAR, PICK_ANY,      MC_1_19_2 },
    { Outpost,       165745296,  80, 56, SPREAD_TRIANGULAR, PICK_ANY,      MC_1_18 },
    { Shipwreck,     165745295,  24, 20, SPREAD_LINEAR,     PICK_ANY,      MC_1_18 },
    { Desert_Pyramid, 14357617,  32, 24, SPREAD_LINEAR,     PICK_ANY,      MC_1_18 },
    { Jungle_Temple,  14357617,  32, 24, SPREAD_LINEAR,     PICK_ANY,      MC_1_18 },
    { Swamp_Hut,      14357617,  32, 24, SPREAD_LINEAR,     PICK_ANY,      MC_1_18 },
    { Igloo,          14357617,  32, 24, SPREAD_LINEAR,     PICK_ANY,      MC_1_18 },
    { Ruined_Portal,  40552231,  40, 25, SPREAD_LINEAR,     PICK_ANY,      MC_1_18 },
    { Fortress,       30084232,  30, 26, SPREAD_LINEAR,     PICK_FORTRESS, MC_1_18 },
    { Bastion,        30084232,  30, 26, SPREAD_LINEAR,     PICK_BASTION,  MC_1_18 },
    /* Placed exactly like Java (Java's LCG on the world seed). */
    { Trial_Chambers,        0,   0,  0, SPREAD_JAVA,       PICK_ANY,      MC_1_21_1 },
};

static const BConf *findConf(int type, int mc)
{
    size_t i;
    for (i = 0; i < sizeof(g_conf)/sizeof(g_conf[0]); i++)
        if (g_conf[i].type == type)
            return mc >= g_conf[i].minMc ? &g_conf[i] : NULL;
    return NULL;
}

int bedrockRegionSize(int structType, int mc)
{
    const BConf *c = findConf(structType, mc);
    StructureConfig sc;
    if (!c) return 0;
    if (c->spread != SPREAD_JAVA) return c->spacing;
    return getStructureConfig(structType, mc, &sc) ? sc.regionSize : 0;
}

int bedrockStructurePos(int structType, int mc, uint64_t seed,
                        int regX, int regZ, Pos *pos)
{
    const BConf *c = findConf(structType, mc);
    BMt r;
    uint32_t ox, oz, n;
    if (!c) return 0;
    if (c->spread == SPREAD_JAVA)
        return getStructurePos(structType, mc, seed, regX, regZ, pos);

    /* Java's region formula evaluated in 32-bit arithmetic:
     * 341873128712 and 132897987541 reduced mod 2^32. Only the low 32 bits of
     * the world seed take part. */
    bmtSeed(&r, (uint32_t)regX * 2570712328u + (uint32_t)regZ * 4048968661u
              + (uint32_t)seed + c->salt);
    n = (uint32_t)c->range;
    if (c->spread == SPREAD_TRIANGULAR)
    {
        uint32_t a = bmtNext(&r) % n, b = bmtNext(&r) % n;
        uint32_t d = bmtNext(&r) % n, e = bmtNext(&r) % n;
        ox = (a + b) / 2;
        oz = (d + e) / 2;
    }
    else
    {
        ox = bmtNext(&r) % n;
        oz = bmtNext(&r) % n;
    }
    if (c->pick != PICK_ANY)
    {   /* fortress and bastion share one grid; the next draw picks which */
        int bastion = (bmtNext(&r) % 6) >= 2;
        if (bastion != (c->pick == PICK_BASTION))
            return 0;
    }
    pos->x = (regX * c->spacing + (int)ox) * 16 + 8;
    pos->z = (regZ * c->spacing + (int)oz) * 16 + 8;
    return 1;
}

static int surfaceBiome(const Generator *g, int x, int z)
{   /* sampled high up so cave biomes never mask the surface biome */
    return getBiomeAt(g, 4, x >> 2, 319 >> 2, z >> 2);
}

int bedrockStructureViable(int structType, const Generator *g, Pos pos)
{
    int id;
    switch (structType)
    {
    case Fortress:
    case Bastion:
        return 1;
    case Trial_Chambers:
        return isViableStructurePos(structType, (Generator*)g, pos.x, pos.z, 0);
    case Ancient_City:
        id = getBiomeAt(g, 4, pos.x >> 2, -27 >> 2, pos.z >> 2);
        return id == deep_dark;
    case Monument:
        /* needs deep ocean at the centre and ocean/river all around */
        return isViableStructurePos(Monument, (Generator*)g, pos.x, pos.z, 0);
    case Mansion:
    {
        int dx, dz;
        for (dx = -1; dx <= 1; dx++)
            for (dz = -1; dz <= 1; dz++)
            {
                id = surfaceBiome(g, pos.x + dx*32, pos.z + dz*32);
                if (!isViableFeatureBiome(g->mc, Mansion, id))
                    return 0;
            }
        return 1;
    }
    default:
        /* Bedrock samples the biome at the chunk's +8,+8 block */
        id = surfaceBiome(g, pos.x, pos.z);
        return isViableFeatureBiome(g->mc, structType, id);
    }
}

/* ------------------------------------------------------------------------ */
/* World spawn                                                               */
/* ------------------------------------------------------------------------ */

static int isSpawnBiome(int id)
{
    switch (id)
    {
    case forest: case plains: case taiga: case taiga_hills:
    case wooded_hills: case jungle: case jungle_hills:
        return 1;
    default:
        return 0;
    }
}

Pos bedrockSpawn(const Generator *g)
{
    enum { N = 10 };
    int ids[N*N];
    int x, i, dx, dz;
    Pos p = { 0, 0 };

    /* Walks east in 40 block steps until a 10x10 patch of 1:4 biome cells has
     * a spawn biome cell whose four neighbours are spawn biomes too. The
     * neighbour lookups index the flat array, so the west neighbour of the
     * first column is the last cell of the row above (as the game does). */
    for (x = 0; x < 40 * 4096; x += 40)
    {
        for (i = 0; i < N*N; i++)
            ids[i] = getBiomeAt(g, 4, x/4 + i % N, 319 >> 2, i / N);
        for (dz = 1; dz < N-1; dz++)
            for (dx = 0; dx < N; dx++)
            {
                i = dz*N + dx;
                if (isSpawnBiome(ids[i]) && isSpawnBiome(ids[i-1]) &&
                    isSpawnBiome(ids[i+1]) && isSpawnBiome(ids[i-N]) &&
                    isSpawnBiome(ids[i+N]))
                {
                    p.x = 4*dx + x;
                    p.z = 4*dz;
                    return p;
                }
            }
    }
    return p;
}

/* ------------------------------------------------------------------------ */
/* Strongholds                                                               */
/* ------------------------------------------------------------------------ */

static int villageStartsAt(const Generator *g, int cx, int cz)
{
    const int spacing = 34;
    Pos p;
    int rx = floordiv(cx, spacing), rz = floordiv(cz, spacing);
    if (!bedrockStructurePos(Village, g->mc, g->seed, rx, rz, &p))
        return 0;
    if ((p.x >> 4) != cx || (p.z >> 4) != cz)
        return 0;
    return bedrockStructureViable(Village, g, p);
}

static int scatteredStronghold(uint64_t seed, int gx, int gz, Pos *out)
{
    /* one attempt per 200x200 chunk cell, in its middle 100x100, 25% chance */
    BMt r;
    int minX = 200*gx + 50, minZ = 200*gz + 50, cx, cz;
    bmtSeed(&r, (uint32_t)(784295783249ull * (uint64_t)(int64_t)gx
                         + 827828252345ull * (uint64_t)(int64_t)gz
                         + seed + 97858791ull));
    cx = minX + (int)bmtNextInt(&r, 100);
    cz = minZ + (int)bmtNextInt(&r, 100);
    if (!(bmtNextFloat(&r) < 0.25f))
        return 0;
    if (cx*cx + cz*cz < 10*10)
        return 0;
    out->x = cx * 16 + 8;
    out->z = cz * 16 + 8;
    return 1;
}

int bedrockStrongholds(const Generator *g, Pos *out, int max, int gridRadius)
{
    BMt r;
    float angle;
    int radius, n = 0, nv = 0, tries, gx, gz, i;
    Pos vill[3];

    bmtSeed(&r, (uint32_t)g->seed);
    angle = bmtNextFloat(&r) * 3.14159265358979323846f * 2.0f;
    radius = (int)bmtNextInt(&r, 16) + 40;

    for (tries = 0; nv < 3 && tries < 256; tries++)
    {
        int cx = (int)floor(radius * cos(angle));
        int cz = (int)floor(radius * sin(angle));
        int ox, oz, placed = 0;
        for (ox = cx - 8; ox < cx + 8 && !placed; ox++)
            for (oz = cz - 8; oz < cz + 8 && !placed; oz++)
                if (villageStartsAt(g, ox, oz))
                {
                    vill[nv].x = ox; vill[nv].z = oz;
                    nv++;
                    placed = 1;
                }
        if (placed) { angle += 0.6f * 3.14159265358979323846f; radius += 8; }
        else        { angle += 0.25f * 3.14159265358979323846f; radius += 4; }
    }
    for (i = 0; i < nv && n < max; i++, n++)
    {
        out[n].x = vill[i].x * 16 + 8;
        out[n].z = vill[i].z * 16 + 8;
    }
    for (gx = -gridRadius - 1; gx <= gridRadius; gx++)
        for (gz = -gridRadius - 1; gz <= gridRadius; gz++)
        {
            Pos p;
            int taken = 0;
            /* a cell that already holds a village stronghold has no other */
            for (i = 0; i < nv; i++)
                if (floordiv(vill[i].x, 200) == gx && floordiv(vill[i].z, 200) == gz)
                    taken = 1;
            if (taken || n >= max) continue;
            if (scatteredStronghold(g->seed, gx, gz, &p))
                out[n++] = p;
        }
    return n;
}
