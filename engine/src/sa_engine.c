/*
 * The Seed Archive engine: a thin layer over cubiomes (biomes, Java
 * structures) and engine/bedrock (Bedrock placement), compiled to WebAssembly.
 *
 * Everything works on one "current seed" set with sa_seed(). 64-bit seeds are
 * passed as two 32-bit halves so no BigInt support is needed in the host.
 */
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include "../cubiomes/generator.h"
#include "../cubiomes/finders.h"
#include "../cubiomes/util.h"
#include "../bedrock/bedrock.h"

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#define API EMSCRIPTEN_KEEPALIVE
#else
#define API
#endif

enum { ED_JAVA = 0, ED_BEDROCK = 1 };

/* Structure ids shared with the TypeScript side (src/engine/types.ts). */
enum {
    S_VILLAGE, S_ANCIENT_CITY, S_FORTRESS, S_RUINED_PORTAL, S_MANSION,
    S_JUNGLE_TEMPLE, S_SHIPWRECK, S_TRIAL_CHAMBER, S_PYRAMID, S_MONUMENT,
    S_COUNT
};
static const int g_stype[S_COUNT] = {
    Village, Ancient_City, Fortress, Ruined_Portal, Mansion,
    Jungle_Temple, Shipwreck, Trial_Chambers, Desert_Pyramid, Monument
};

/* Version groups shared with the TypeScript side. */
static const int g_versions[] = {
    MC_1_18, MC_1_19, MC_1_20, MC_1_21_3, MC_1_21_4, MC_26_1, MC_26_2, MC_26_3
};
#define N_VERSIONS ((int)(sizeof(g_versions)/sizeof(g_versions[0])))

static Generator g_ow, g_ne;
static int g_edition = ED_BEDROCK, g_mc = MC_NEWEST;
static uint64_t g_seed;
static int g_neReady;
static unsigned char g_colors[256][3];
static int g_colorsReady;

API int sa_init(int edition, int versionIdx)
{
    if (versionIdx < 0 || versionIdx >= N_VERSIONS) return 0;
    g_edition = edition == ED_JAVA ? ED_JAVA : ED_BEDROCK;
    g_mc = g_versions[versionIdx];
    setupGenerator(&g_ow, g_mc, 0);
    setupGenerator(&g_ne, g_mc, 0);
    g_neReady = 0;
    return 1;
}

API void sa_seed(uint32_t lo, uint32_t hi)
{
    g_seed = ((uint64_t)hi << 32) | lo;
    applySeed(&g_ow, DIM_OVERWORLD, g_seed);
    g_neReady = 0;
}

static Generator *nether(void)
{
    if (!g_neReady) { applySeed(&g_ne, DIM_NETHER, g_seed); g_neReady = 1; }
    return &g_ne;
}

static int surfaceAt(int x, int z)
{
    return getBiomeAt(&g_ow, 4, x >> 2, 319 >> 2, z >> 2);
}

/* generateBiomeAt(seed, x, z, y): biome id at a block position */
API int sa_biome_at(int x, int y, int z)
{
    return getBiomeAt(&g_ow, 4, x >> 2, y >> 2, z >> 2);
}

API const char *sa_biome_name(int id)
{
    const char *s = biome2str(g_mc, id);
    return s ? s : "unknown";
}

/* ------------------------------------------------------------------------ */
/* Spawn and strongholds                                                     */
/* ------------------------------------------------------------------------ */

static Pos spawnPos(void)
{
    /* 1.18+: both editions pick the spawn the same way */
    return getSpawn(&g_ow);
}

API void sa_spawn(int32_t *out)
{
    Pos p = spawnPos();
    out[0] = p.x; out[1] = p.z;
}

static int strongholds(Pos *out, int max)
{
    if (g_edition == ED_BEDROCK)
        return bedrockStrongholds(&g_ow, out, max, 1);
    else
    {
        StrongholdIter sh;
        int n = 0;
        initFirstStronghold(&sh, g_mc, g_seed);
        while (n < max && nextStronghold(&sh, &g_ow) > 0)
            out[n++] = sh.pos;
        if (n < max && n > 0 && 0) out[n] = sh.pos;
        return n;
    }
}

/* getStrongholds(seed): up to max positions, 2 ints each. Java returns the
 * first ring nearest-first by generation order; Bedrock the three village
 * strongholds followed by nearby scattered ones. */
API int sa_strongholds(int32_t *out, int max)
{
    Pos p[32];
    int i, n;
    if (max > 32) max = 32;
    n = strongholds(p, max);
    for (i = 0; i < n; i++) { out[2*i] = p[i].x; out[2*i+1] = p[i].z; }
    return n;
}

/* ------------------------------------------------------------------------ */
/* Structures                                                                */
/* ------------------------------------------------------------------------ */

static int isNetherType(int sid) { return sid == S_FORTRESS; }

/* Whether the engine knows how to place this structure for the current
 * edition and version at all (confirmation status lives in the app). */
API int sa_struct_supported(int sid)
{
    StructureConfig sc;
    if (sid < 0 || sid >= S_COUNT) return 0;
    if (g_edition == ED_BEDROCK)
        return bedrockRegionSize(g_stype[sid], g_mc) > 0;
    return getStructureConfig(g_stype[sid], g_mc, &sc) != 0;
}

/* getStructurePos(type, seed, regionX, regionZ, edition, version):
 * the generation attempt of one region. Returns 1 and writes x,z if the
 * structure really generates there (position and biome both pass). */
API int sa_structure_pos(int sid, int regX, int regZ, int32_t *out)
{
    int type;
    Pos p;
    if (sid < 0 || sid >= S_COUNT) return 0;
    type = g_stype[sid];
    if (g_edition == ED_BEDROCK)
    {
        if (!bedrockStructurePos(type, g_mc, g_seed, regX, regZ, &p)) return 0;
        if (!bedrockStructureViable(type, &g_ow, p)) return 0;
    }
    else
    {
        Generator *g = isNetherType(sid) ? nether() : &g_ow;
        if (!getStructurePos(type, g_mc, g_seed, regX, regZ, &p)) return 0;
        if (!isViableStructurePos(type, g, p.x, p.z, 0)) return 0;
        if (!isNetherType(sid) && !isViableStructureTerrain(type, g, p.x, p.z)) return 0;
    }
    out[0] = p.x; out[1] = p.z;
    return 1;
}

static int regionBlocks(int sid)
{
    StructureConfig sc;
    if (g_edition == ED_BEDROCK)
        return bedrockRegionSize(g_stype[sid], g_mc) * 16;
    return getStructureConfig(g_stype[sid], g_mc, &sc) ? sc.regionSize * 16 : 0;
}

/* All structures of a type within `radius` blocks of (cx, cz), which are
 * Overworld block coordinates. Nether types are searched around (cx/8, cz/8)
 * within radius/8 and reported in Nether coordinates.
 * out: 2 ints per hit. Returns the number of hits (at most max). */
API int sa_structures(int sid, int cx, int cz, int radius, int32_t *out, int max)
{
    int rb, rx, rz, rx0, rx1, rz0, rz1, n = 0;
    if (sid < 0 || sid >= S_COUNT || !(rb = regionBlocks(sid))) return 0;
    if (isNetherType(sid)) { cx = cx >> 3; cz = cz >> 3; radius = radius >> 3; }
    rx0 = floordiv(cx - radius, rb); rx1 = floordiv(cx + radius, rb);
    rz0 = floordiv(cz - radius, rb); rz1 = floordiv(cz + radius, rb);
    for (rz = rz0; rz <= rz1 && n < max; rz++)
        for (rx = rx0; rx <= rx1 && n < max; rx++)
        {
            int32_t p[2];
            double dx, dz;
            if (!sa_structure_pos(sid, rx, rz, p)) continue;
            dx = p[0] - cx; dz = p[1] - cz;
            if (dx*dx + dz*dz > (double)radius * radius) continue;
            out[2*n] = p[0]; out[2*n+1] = p[1];
            n++;
        }
    return n;
}

/* ------------------------------------------------------------------------ */
/* Map                                                                       */
/* ------------------------------------------------------------------------ */

/* renderBiomeMap(seed, cx, cz, size): w x h cells of `scale` blocks each,
 * centred on (cx, cz), written as RGBA. scale must be 4, 16 or 64. */
API int sa_render_map(int cx, int cz, int w, int h, int scale, uint8_t *rgba)
{
    Range r;
    int *ids, i;
    if (!g_colorsReady) { initBiomeColors(g_colors); g_colorsReady = 1; }
    r.scale = scale;
    r.x = floordiv(cx, scale) - w/2; r.z = floordiv(cz, scale) - h/2;
    r.sx = w; r.sz = h;
    r.y = 319 >> 2; r.sy = 1;
    ids = allocCache(&g_ow, r);
    if (!ids) return 0;
    if (genBiomes(&g_ow, ids, r) != 0) { free(ids); return 0; }
    for (i = 0; i < w*h; i++)
    {
        int id = ids[i] & 255;
        rgba[4*i+0] = g_colors[id][0];
        rgba[4*i+1] = g_colors[id][1];
        rgba[4*i+2] = g_colors[id][2];
        rgba[4*i+3] = 255;
    }
    free(ids);
    return 1;
}

/* ------------------------------------------------------------------------ */
/* Search                                                                    */
/* ------------------------------------------------------------------------ */

enum { B_ANY, B_JUNGLE, B_CHERRY, B_SNOWY, B_MUSHROOM, B_DESERT, B_MANGROVE,
       B_DARK_FOREST, B_BADLANDS, B_LUSH_CAVES, B_DEEP_DARK };
enum { LS_ANY, LS_ISLAND, LS_COAST, LS_INLAND };
enum { ST_SPAWN, ST_LANDSEA, ST_STRONGHOLD, ST_STRUCT, ST_N };

#define MAX_WANT 10
static struct {
    int biome, landSea, shMax, radius, nWant, want[MAX_WANT];
} F;
static uint32_t g_reached[ST_N], g_passed[ST_N];

/* filters: [biomeGroup, landSea, strongholdMax(0=any), structRadius, n, ids…] */
API void sa_set_filters(const int32_t *f)
{
    int i;
    F.biome = f[0]; F.landSea = f[1]; F.shMax = f[2]; F.radius = f[3];
    F.nWant = f[4] > MAX_WANT ? MAX_WANT : f[4];
    for (i = 0; i < F.nWant; i++) F.want[i] = f[5+i];
    memset(g_reached, 0, sizeof g_reached);
    memset(g_passed, 0, sizeof g_passed);
}

/* out: reached[4], passed[4] for the stages spawn / land-sea / stronghold /
 * structures, counted since sa_set_filters(). */
API void sa_stats(uint32_t *out)
{
    memcpy(out, g_reached, sizeof g_reached);
    memcpy(out + ST_N, g_passed, sizeof g_passed);
}

static int inGroup(int grp, int id)
{
    switch (grp)
    {
    case B_JUNGLE:      return id == jungle || id == sparse_jungle || id == bamboo_jungle;
    case B_CHERRY:      return id == cherry_grove;
    case B_SNOWY:       return id == snowy_plains || id == ice_spikes || id == snowy_taiga ||
                               id == snowy_slopes || id == grove || id == frozen_peaks ||
                               id == jagged_peaks || id == snowy_beach;
    case B_MUSHROOM:    return id == mushroom_fields;
    case B_DESERT:      return id == desert;
    case B_MANGROVE:    return id == mangrove_swamp;
    case B_DARK_FOREST: return id == dark_forest;
    case B_BADLANDS:    return id == badlands || id == eroded_badlands || id == wooded_badlands;
    case B_LUSH_CAVES:  return id == lush_caves;
    case B_DEEP_DARK:   return id == deep_dark;
    }
    return 0;
}

static const double g_cos16[16] = {
    1, .9239, .7071, .3827, 0, -.3827, -.7071, -.9239,
    -1, -.9239, -.7071, -.3827, 0, .3827, .7071, .9239 };
static const double g_sin16[16] = {
    0, .3827, .7071, .9239, 1, .9239, .7071, .3827,
    0, -.3827, -.7071, -.9239, -1, -.9239, -.7071, -.3827 };

/* 0 = no match, 1 = near spawn, 2 = right at the spawn point */
static int spawnBiomeMatch(Pos sp, int surfaceId)
{
    int i, n = 0;
    if (F.biome == B_ANY) return 1;
    if (F.biome == B_LUSH_CAVES || F.biome == B_DEEP_DARK)
    {   /* cave biomes: look underneath the spawn area */
        int y = F.biome == B_DEEP_DARK ? -40 : 8;
        if (inGroup(F.biome, getBiomeAt(&g_ow, 4, sp.x >> 2, y >> 2, sp.z >> 2)))
            return 2;
        for (i = 0; i < 16; i += 2)
            if (inGroup(F.biome, getBiomeAt(&g_ow, 4,
                    (sp.x + (int)(48*g_cos16[i])) >> 2, y >> 2,
                    (sp.z + (int)(48*g_sin16[i])) >> 2)))
                n++;
        return n >= 2;
    }
    if (inGroup(F.biome, surfaceId)) return 2;
    for (i = 0; i < 16; i += 2)
        if (inGroup(F.biome, surfaceAt(sp.x + (int)(48*g_cos16[i]),
                                       sp.z + (int)(48*g_sin16[i]))))
            n++;
    return n >= 3;
}

static int oceanRing(Pos c, int r, int step)
{
    int i, n = 0;
    for (i = 0; i < 16; i += step)
        if (isOceanic(surfaceAt(c.x + (int)(r*g_cos16[i]), c.z + (int)(r*g_sin16[i]))))
            n++;
    return n;
}

/* Island: land at spawn, sea nearly all the way round further out.
 * Coast: sea close by. Inland: no sea within about 300 blocks. */
static int landSeaClass(Pos sp, int surfaceId)
{
    int near, r3, r4;
    if (isOceanic(surfaceId)) return LS_ANY;
    near = oceanRing(sp, 96, 2) + oceanRing(sp, 192, 1);
    r3 = oceanRing(sp, 304, 1);
    if (near == 0 && r3 == 0) return LS_INLAND;
    if (r3 >= 14)
    {
        r4 = oceanRing(sp, 416, 1);
        if (r4 >= 13) return LS_ISLAND;
    }
    return near >= 2 ? LS_COAST : LS_ANY;
}

static double dist(int ax, int az, int bx, int bz)
{
    double dx = (double)ax - bx, dz = (double)az - bz;
    return sqrt(dx*dx + dz*dz);
}

/*
 * Checks the current seed against the filters, cheapest test first, stopping
 * at the first failure. Returns 1 on a match and fills out:
 *   [0] spawnX [1] spawnZ [2] spawn biome id [3] land/sea class
 *   [4] strongholdX [5] strongholdZ [6] stronghold distance (-1 = not asked)
 *   [7] score 0..100 [8] n structures, then n x {id, x, z, distance}
 */
API int sa_check(int32_t *out)
{
    Pos sp, sh[12];
    int id, bm, ls = LS_ANY, i, k, n, nsh = -1;
    double parts = 0, sum = 0;

    /* 0. Quick screens around the origin. Working out the spawn point is by
     * far the most expensive step, and the spawn is almost always within a
     * few hundred blocks of the origin, so seeds that plainly cannot match
     * are dropped first. A screen only ever skips a seed; everything that
     * gets through is still checked exactly below, in the usual order. */
    if (F.biome != B_ANY || F.landSea != LS_ANY)
    {
        int nb = 0, no = 0, gx, gz;
        int cave = F.biome == B_LUSH_CAVES || F.biome == B_DEEP_DARK;
        int cy = F.biome == B_DEEP_DARK ? -40 : 8;
        for (gz = -384; gz <= 384; gz += 128)
            for (gx = -384; gx <= 384; gx += 128)
            {
                int b = surfaceAt(gx, gz);
                if (isOceanic(b)) no++;
                if (F.biome != B_ANY &&
                    inGroup(F.biome, cave ? getBiomeAt(&g_ow, 4, gx >> 2, cy >> 2, gz >> 2) : b))
                    nb++;
            }
        if (F.biome != B_ANY && nb == 0) { g_reached[ST_SPAWN]++; return 0; }
        if ((F.landSea == LS_ISLAND && no < 20) ||
            (F.landSea == LS_COAST && (no < 2 || no > 47)) ||
            (F.landSea == LS_INLAND && no > 30))
        {
            g_reached[ST_SPAWN]++; g_passed[ST_SPAWN]++; g_reached[ST_LANDSEA]++;
            return 0;
        }
    }
    if (F.shMax > 0 && g_edition == ED_BEDROCK)
    {   /* Bedrock strongholds do not depend on the spawn point */
        double best = 1e18;
        nsh = strongholds(sh, 12);
        for (i = 0; i < nsh; i++)
        {
            double d = dist(sh[i].x, sh[i].z, 0, 0);
            if (d < best) best = d;
        }
        if (best > F.shMax + 640)
        {
            g_reached[ST_SPAWN]++; g_passed[ST_SPAWN]++;
            g_reached[ST_LANDSEA]++; g_passed[ST_LANDSEA]++;
            g_reached[ST_STRONGHOLD]++;
            return 0;
        }
    }

    /* 1. spawn biome */
    g_reached[ST_SPAWN]++;
    sp = spawnPos();
    id = surfaceAt(sp.x, sp.z);
    bm = spawnBiomeMatch(sp, id);
    if (!bm) return 0;
    g_passed[ST_SPAWN]++;
    if (F.biome != B_ANY) { sum += bm == 2 ? 1.0 : 0.7; parts++; }

    /* 2. island / coast / inland */
    g_reached[ST_LANDSEA]++;
    if (F.landSea != LS_ANY)
    {
        ls = landSeaClass(sp, id);
        if (ls != F.landSea) return 0;
    }
    g_passed[ST_LANDSEA]++;

    out[0] = sp.x; out[1] = sp.z; out[2] = id; out[3] = ls;
    out[4] = out[5] = 0; out[6] = -1;

    /* 3. stronghold distance */
    g_reached[ST_STRONGHOLD]++;
    if (F.shMax > 0)
    {
        double best = 1e18;
        n = nsh >= 0 ? nsh : strongholds(sh, g_edition == ED_BEDROCK ? 12 : 3);
        for (i = 0; i < n; i++)
        {
            double d = dist(sh[i].x, sh[i].z, sp.x, sp.z);
            if (d < best) { best = d; out[4] = sh[i].x; out[5] = sh[i].z; }
        }
        if (best > F.shMax) return 0;
        out[6] = (int)best;
        sum += 1.0 - 0.5 * best / F.shMax; parts++;
    }
    g_passed[ST_STRONGHOLD]++;

    /* 4. the other structures */
    g_reached[ST_STRUCT]++;
    for (k = 0; k < F.nWant; k++)
    {
        static int32_t buf[2*64];
        int sid = F.want[k], scale = isNetherType(sid) ? 8 : 1;
        double best = 1e18;
        int bx = 0, bz = 0;
        n = sa_structures(sid, sp.x, sp.z, F.radius, buf, 64);
        for (i = 0; i < n; i++)
        {
            double d = dist(buf[2*i]*scale, buf[2*i+1]*scale, sp.x, sp.z);
            if (d < best) { best = d; bx = buf[2*i]; bz = buf[2*i+1]; }
        }
        if (!n) return 0;
        out[9+4*k] = sid; out[10+4*k] = bx; out[11+4*k] = bz; out[12+4*k] = (int)best;
        sum += 1.0 - 0.5 * best / F.radius; parts++;
    }
    g_passed[ST_STRUCT]++;
    out[8] = F.nWant;
    out[7] = parts > 0 ? (int)(100.0 * sum / parts + 0.5) : 100;
    return 1;
}

/* Land/sea class and surface biome of the current seed's spawn, for the
 * detail screen: out = [spawnX, spawnZ, biome, class]. */
API void sa_describe(int32_t *out)
{
    Pos sp = spawnPos();
    int id = surfaceAt(sp.x, sp.z);
    out[0] = sp.x; out[1] = sp.z; out[2] = id; out[3] = landSeaClass(sp, id);
}

API int sa_version_count(void) { return N_VERSIONS; }
