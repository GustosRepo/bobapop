const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const vm = require('vm');

const corePath = path.join(__dirname, '..', 'src', 'hooks', 'saveDataCore.ts');
const levelPath = path.join(__dirname, '..', 'src', 'game', 'levels.ts');

function loadCoreModule() {
  const source = fs.readFileSync(corePath, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
    },
  }).outputText;

  const sandbox = {
    exports: {},
    module: { exports: {} },
    require,
  };
  sandbox.exports = sandbox.module.exports;
  vm.runInNewContext(compiled, sandbox, { filename: corePath });
  return sandbox.module.exports;
}

function readLevelIds() {
  const source = fs.readFileSync(levelPath, 'utf8');
  const matches = source.matchAll(/\{ id: '([^']+)', worldIndex: \d, levelInWorld: \d,[^\n]+ \}/g);
  return Array.from(matches, (match) => match[1]);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function assertArrayEqual(actual, expected, message) {
  const actualText = JSON.stringify(actual);
  const expectedText = JSON.stringify(expected);
  if (actualText !== expectedText) {
    throw new Error(`${message}: expected ${expectedText}, got ${actualText}`);
  }
}

const {
  CURRENT_VERSION,
  ENERGY_REFILL_MS,
  MAX_ENERGY,
  migrateSaveData,
  resolveEnergy,
} = loadCoreModule();

const levelIds = readLevelIds();
assertEqual(levelIds.length, 20, 'Level IDs should parse from levels.ts');

const fixedNow = 1_700_000_000_000;

const legacyV0 = migrateSaveData({
  unlockedUpTo: 2,
  levelStars: { 0: 3, 2: 1 },
}, levelIds, fixedNow);

assertEqual(legacyV0.version, CURRENT_VERSION, 'v0 save should migrate to current version');
assertArrayEqual(legacyV0.unlockedLevelIds, levelIds.slice(0, 3), 'v0 unlockedUpTo should map to level IDs');
assertEqual(legacyV0.levelStarsById[levelIds[0]], 3, 'v0 level 1 stars should map by ID');
assertEqual(legacyV0.levelStarsById[levelIds[2]], 1, 'v0 level 3 stars should map by ID');
assertEqual(legacyV0.energyLives, MAX_ENERGY, 'v0 save should receive full Energy');
assertEqual(legacyV0.energyUpdatedAt, fixedNow, 'v0 save should receive deterministic Energy timestamp');

const legacyV7 = migrateSaveData({
  version: 7,
  unlockedUpTo: 4,
  levelStars: { 0: 3, 3: 2 },
  levelHighScores: { 0: 1200, 3: 900 },
  totalBobas: 123,
  seenWorlds: [0],
  soundEnabled: false,
  hapticsEnabled: true,
  adsRemoved: true,
  seenOnboarding: { app_intro: true },
  energyLives: 2,
  energyUpdatedAt: fixedNow - ENERGY_REFILL_MS,
}, levelIds, fixedNow);

assertArrayEqual(legacyV7.unlockedLevelIds, levelIds.slice(0, 5), 'v7 unlockedUpTo should map to level IDs');
assertEqual(legacyV7.levelStarsById[levelIds[3]], 2, 'v7 stars should map by ID');
assertEqual(legacyV7.levelHighScoresById[levelIds[0]], 1200, 'v7 high score should map by ID');
assertEqual(legacyV7.totalBobas, 123, 'v7 total boba count should be preserved');
assertEqual(legacyV7.adsRemoved, true, 'v7 Plus entitlement should be preserved');
assertEqual(legacyV7.seenOnboarding.app_intro, true, 'v7 onboarding flags should be preserved');

const currentWithInvalidIds = migrateSaveData({
  version: CURRENT_VERSION,
  unlockedUpTo: 19,
  unlockedLevelIds: ['deleted_level', levelIds[4]],
  levelStarsById: { [levelIds[4]]: 3, deleted_level: 3 },
  levelHighScoresById: { [levelIds[4]]: 555, deleted_level: 999 },
}, levelIds, fixedNow);

assertArrayEqual(currentWithInvalidIds.unlockedLevelIds, [levelIds[4]], 'invalid unlocked IDs should be filtered');
assertEqual(currentWithInvalidIds.levelStarsById[levelIds[4]], 3, 'valid ID stars should survive filtering');
assertEqual(currentWithInvalidIds.levelHighScoresById[levelIds[4]], 555, 'valid ID high scores should survive filtering');

const currentOnlyInvalidIds = migrateSaveData({
  version: CURRENT_VERSION,
  unlockedLevelIds: ['deleted_level'],
}, levelIds, fixedNow);

assertArrayEqual(currentOnlyInvalidIds.unlockedLevelIds, [levelIds[0]], 'all-invalid unlocked IDs should fall back to first level');

const notReady = resolveEnergy({
  ...legacyV7,
  energyLives: 2,
  energyUpdatedAt: fixedNow - ENERGY_REFILL_MS + 1,
}, fixedNow);

assertEqual(notReady.energyLives, 2, 'Energy should not refill before the interval elapses');

const refilled = resolveEnergy({
  ...legacyV7,
  energyLives: 2,
  energyUpdatedAt: fixedNow - ENERGY_REFILL_MS * 2,
}, fixedNow);

assertEqual(refilled.energyLives, 4, 'Energy should refill elapsed intervals');
assertEqual(refilled.energyUpdatedAt, fixedNow, 'Energy timestamp should advance by elapsed refill intervals');

const capped = resolveEnergy({
  ...legacyV7,
  energyLives: 4,
  energyUpdatedAt: fixedNow - ENERGY_REFILL_MS * 20,
}, fixedNow);

assertEqual(capped.energyLives, MAX_ENERGY, 'Energy should cap at max');
assertEqual(capped.energyUpdatedAt, fixedNow, 'Full Energy should reset timestamp to now');

console.log('Save migration check passed.');
