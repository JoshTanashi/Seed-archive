// Builds tests/known-seeds.json from files written by harvest-chunkbase.mjs.
// usage: node scripts/make-known-seeds.mjs <versionIdx>=<harvest.json> ...
import fs from 'fs';
const KEYS = { village: 'village', ancientCity: 'ancient-city', netherFortress: 'fortress', ruinedPortalOverworld: 'ruined-portal',
  woodlandMansion: 'mansion', jungleTemple: 'jungle-temple', shipwreck: 'shipwreck', trialChamber: 'trial-chamber',
  desertTemple: 'pyramid', oceanMonument: 'monument' };
const entries = [];
for (const arg of process.argv.slice(2)) {
  const [idx, file] = arg.split('=');
  for (const r of JSON.parse(fs.readFileSync(file, 'utf8'))) {
    const structures = {};
    for (const [cb, key] of Object.entries(KEYS)) {
      if (Array.isArray(r.pois[cb])) structures[key] = r.pois[cb].map((p) => [p[0], p[1]]);
    }
    entries.push({
      edition: r.edition.toLowerCase(), version: Number(idx), chunkbaseVersion: r.version, seed: r.seed,
      radiusChunks: r.radiusChunks, spawn: [r.pois.spawn[0][2].x, r.pois.spawn[0][2].z],
      strongholds: r.pois.stronghold.map((p) => [p[0], p[1]]), structures,
    });
  }
}
const doc = {
  _about: [
    'Reference positions for the engine tests.',
    'Every value was read out of the Chunkbase seed map (chunkbase.com/apps/seed-map) with scripts/harvest-chunkbase.mjs on 2026-11-10; none comes from this engine.',
    'spawn is in blocks. strongholds and structures are chunk coordinates [chunkX, chunkZ] (Nether chunks for fortress), listed for the square of +-radiusChunks chunks around the origin.',
    'version is the engine version group (src/engine/types.ts); chunkbaseVersion is the version number Chunkbase was set to.',
    'These were read by script, not by eye. Before a public release, spot-check a handful in a real world as well.',
  ],
  toleranceBlocks: 16,
  entries,
};
fs.writeFileSync('tests/known-seeds.json', JSON.stringify(doc).replace(/\{"edition"/g, '\n{"edition"') + '\n');
console.log(entries.length, 'entries', entries.filter((e) => e.edition === 'bedrock').length, 'bedrock', entries.filter((e) => e.edition === 'java').length, 'java');
