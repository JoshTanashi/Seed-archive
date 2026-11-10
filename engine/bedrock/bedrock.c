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

/* Biomes are sampled on the 1:4 grid, high up so that cave biomes never mask
 * the surface biome. (The game samples at the terrain surface.) */
static int cellBiome(const Generator *g, int qx, int qz)
{
    return getBiomeAt(g, 4, qx, 319 >> 2, qz);
}

static int surfaceBiome(const Generator *g, int x, int z)
{
    return cellBiome(g, x >> 2, z >> 2);
}

enum { A_VILLAGE, A_DEEP_OCEAN, A_WATER, A_MANSION, A_SAME };

static int areaOk(int kind, int mc, int id, int same)
{
    switch (kind)
    {
    case A_VILLAGE:
        return id == plains || id == sunflower_plains || id == savanna ||
               id == snowy_plains || id == taiga || id == snowy_taiga ||
               id == desert || id == meadow;
    case A_DEEP_OCEAN:
        return isDeepOcean(id);
    case A_WATER:
        return isOceanic(id) || id == river || id == frozen_river;
    case A_MANSION:
        return id == dark_forest || (id == pale_garden && mc >= MC_1_21_5);
    case A_SAME:
        return id == same;
    }
    return 0;
}

/* Every 1:4 biome cell touching the square of +-r blocks around (x, z). */
static int areaAll(const Generator *g, int x, int z, int r, int kind, int same)
{
    int qx, qz;
    int x0 = (x - r) >> 2, x1 = (x + r) >> 2, z0 = (z - r) >> 2, z1 = (z + r) >> 2;
    for (qz = z0; qz <= z1; qz++)
        for (qx = x0; qx <= x1; qx++)
            if (!areaOk(kind, g->mc, cellBiome(g, qx, qz), same))
                return 0;
    return 1;
}

static int monumentViable(const Generator *g, Pos pos)
{
    return areaAll(g, pos.x, pos.z, 16, A_DEEP_OCEAN, 0) &&
           areaAll(g, pos.x, pos.z, 29, A_WATER, 0);
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
    case Village:
        /* the biome cells around the chunk's +8,+8 block */
        return areaAll(g, pos.x, pos.z, 2, A_VILLAGE, 0);
    case Ancient_City:
        /* sampled at the chunk corner, not its middle */
        id = getBiomeAt(g, 4, (pos.x - 8) >> 2, -27 >> 2, (pos.z - 8) >> 2);
        return id == deep_dark;
    case Monument:
        return monumentViable(g, pos);
    case Mansion:
        return areaAll(g, pos.x, pos.z, 32, A_MANSION, 0);
    case Shipwreck:
    {
        int cx = pos.x >> 4, cz = pos.z >> 4, rx, rz, onShore;
        id = surfaceBiome(g, pos.x, pos.z);
        onShore = id == beach || id == snowy_beach || id == stony_shore;
        if (!onShore && !isOceanic(id))
            return 0;
        /* one unbroken biome all around ... */
        if (!areaAll(g, pos.x, pos.z, onShore ? 10 : 20, A_SAME, id))
            return 0;
        /* ... and no ocean monument within five chunks */
        for (rx = floordiv(cx - 5, 32); rx <= floordiv(cx + 4, 32); rx++)
            for (rz = floordiv(cz - 5, 32); rz <= floordiv(cz + 4, 32); rz++)
            {
                Pos m;
                int mx, mz;
                if (!bedrockStructurePos(Monument, g->mc, g->seed, rx, rz, &m))
                    continue;
                mx = m.x >> 4; mz = m.z >> 4;
                if (mx >= cx - 5 && mx < cx + 5 && mz >= cz - 5 && mz < cz + 5 &&
                    monumentViable(g, m))
                    return 0;
            }
        return 1;
    }
    case Jungle_Temple:
        return surfaceBiome(g, pos.x, pos.z) == jungle;
    case Desert_Pyramid:
        return surfaceBiome(g, pos.x, pos.z) == desert;
    default:
        /* Bedrock samples the biome at the chunk's +8,+8 block */
        id = surfaceBiome(g, pos.x, pos.z);
        return isViableFeatureBiome(g->mc, structType, id);
    }
}

/* ------------------------------------------------------------------------ */
/* Strongholds                                                               */
/* ------------------------------------------------------------------------ */

/* The game's sine table: 65536 entries, indexed by angle * 10430.378. */
static float tableSin(float angle, int quarterTurn)
{
    float f = (float)(angle * 10430.378f) + (float)(quarterTurn ? 16384 : 0);
    int i = ((int)f % 65536 + 65536) % 65536;
    return (float)sin(i * 3.14159265358979323846 * 2.0 / 65536.0);
}

static int scatteredStronghold(uint64_t seed, int gx, int gz, Pos *out)
{
    /* one attempt per 200x200 chunk cell, in its middle 100x100, 25% chance.
     * The cell's RNG seed is built from the cell's centre chunk. */
    BMt r;
    int cx, cz;
    bmtSeed(&r, (uint32_t)(784295783249ull * (uint64_t)(int64_t)(gx*200 + 100)
                         + 827828252345ull * (uint64_t)(int64_t)(gz*200 + 100)
                         + seed + 97858791ull));
    cx = 200*gx + 50 + (int)bmtNextInt(&r, 100);
    cz = 200*gz + 50 + (int)bmtNextInt(&r, 100);
    if (!(bmtNextFloat(&r) < 0.25f))
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
        int cx = (int)floor((float)(radius * tableSin(angle, 1)));
        int cz = (int)floor((float)(radius * tableSin(angle, 0)));
        int rx, rz, placed = 0, bx = 0, bz = 0;
        /* The game scans the 16x16 chunks around (cx, cz), x outermost, for
         * the first village start. Each region holds one village attempt, so
         * it is enough to look at the regions the window touches. */
        for (rx = floordiv(cx - 8, 34); rx <= floordiv(cx + 7, 34); rx++)
            for (rz = floordiv(cz - 8, 34); rz <= floordiv(cz + 7, 34); rz++)
            {
                Pos p;
                int vx, vz;
                if (!bedrockStructurePos(Village, g->mc, g->seed, rx, rz, &p))
                    continue;
                vx = p.x >> 4; vz = p.z >> 4;
                if (vx < cx - 8 || vx >= cx + 8 || vz < cz - 8 || vz >= cz + 8)
                    continue;
                if (placed && !(vx < bx || (vx == bx && vz < bz)))
                    continue;
                if (!bedrockStructureViable(Village, g, p))
                    continue;
                bx = vx; bz = vz; placed = 1;
            }
        if (placed) { vill[nv].x = bx; vill[nv].z = bz; nv++; }
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
            if (n >= max) continue;
            if (scatteredStronghold(g->seed, gx, gz, &p))
                out[n++] = p;
        }
    return n;
}
