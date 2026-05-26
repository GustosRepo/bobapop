const fs = require('fs');
const path = require('path');

const levelsPath = path.join(__dirname, '..', 'src', 'game', 'levels.ts');
const source = fs.readFileSync(levelsPath, 'utf8');

if (/Math\.random\s*\(/.test(source)) {
  throw new Error('levels.ts must not use Math.random(); level generation should be deterministic.');
}

const levelEntries = source.match(/\{ id: '[^']+', worldIndex: \d, levelInWorld: \d,[^\n]+ \}/g) ?? [];
if (levelEntries.length !== 20) {
  throw new Error(`Expected 20 level definitions, found ${levelEntries.length}.`);
}

const worlds = new Map();
const ids = new Set();
for (const entry of levelEntries) {
  const id = entry.match(/id: '([^']+)'/)?.[1];
  const worldIndex = Number(entry.match(/worldIndex: (\d)/)?.[1]);
  const levelInWorld = Number(entry.match(/levelInWorld: (\d)/)?.[1]);
  if (!id || !Number.isInteger(worldIndex) || !Number.isInteger(levelInWorld)) {
    throw new Error(`Could not parse level entry: ${entry}`);
  }
  if (ids.has(id)) {
    throw new Error(`Duplicate level id: ${id}`);
  }
  ids.add(id);
  const levels = worlds.get(worldIndex) ?? [];
  levels.push(levelInWorld);
  worlds.set(worldIndex, levels);
}

for (let worldIndex = 0; worldIndex < 4; worldIndex++) {
  const levels = [...(worlds.get(worldIndex) ?? [])].sort((a, b) => a - b);
  const expected = [1, 2, 3, 4, 5];
  if (levels.join(',') !== expected.join(',')) {
    throw new Error(`World ${worldIndex} levels are ${levels.join(',') || 'missing'}, expected ${expected.join(',')}.`);
  }
}

console.log('Level sanity check passed.');
