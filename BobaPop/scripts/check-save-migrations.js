const { loader } = require('./test-helpers.cjs');
const load = loader();
const loadCoreModule = () => load('src/hooks/saveDataCore.ts');

function readLevelIds() {
  return load('src/game/levels.ts').LEVELS.map((level) => level.id);
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
assertEqual(levelIds.length, 40, 'Campaign should contain 40 level IDs');

const fixedNow = 1_700_000_000_000;

const legacyV0 = migrateSaveData({
  unlockedUpTo: 2,
  levelStars: { 0: 3, 2: 1 },
}, levelIds, fixedNow);

assertEqual(legacyV0.version, CURRENT_VERSION, 'v0 save should migrate to current version');
assertArrayEqual(legacyV0.unlockedLevelIds, levelIds.slice(0, 4), 'v0 completion stars should unlock the following level');
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

assertArrayEqual(currentWithInvalidIds.unlockedLevelIds, [levelIds[4], levelIds[5]], 'invalid unlocked IDs should be filtered and completed successors unlocked');
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

const chapterOneIds = levelIds.slice(0, 20);
const completedCampaign = migrateSaveData({
  version: CURRENT_VERSION,
  unlockedLevelIds: chapterOneIds,
  levelStarsById: Object.fromEntries(chapterOneIds.map((id) => [id, 3])),
  levelHighScoresById: { [chapterOneIds[19]]: 4321 },
  totalBobas: 999,
}, levelIds, fixedNow);
assertArrayEqual(completedCampaign.unlockedLevelIds, levelIds.slice(0, 21), 'Existing finishers should unlock level 21 automatically');
assertEqual(completedCampaign.levelHighScoresById[chapterOneIds[19]], 4321, 'Expansion must keep final boss high score');
assertEqual(completedCampaign.totalBobas, 999, 'Expansion must preserve lifetime bobas');
assertEqual(Object.values(completedCampaign.levelStarsById).reduce((total, stars) => total + stars, 0), 60, 'Expansion must preserve all earned stars');
const unfinishedCampaign = migrateSaveData({
  version: CURRENT_VERSION,
  unlockedLevelIds: chapterOneIds,
  levelStarsById: { [chapterOneIds[18]]: 3 },
}, levelIds, fixedNow);
assert(!unfinishedCampaign.unlockedLevelIds.includes(levelIds[20]), 'Level 21 must stay locked until the chapter 1 boss is completed');
console.log('Campaign expansion migration checks passed.');

const oldBadgeSave = migrateSaveData({ version: 9, unlockedLevelIds: chapterOneIds, levelStarsById: completedCampaign.levelStarsById, totalBobas: 999 }, levelIds, fixedNow);
assertEqual(oldBadgeSave.selectedBadgeId, 'classic', 'Existing saves should receive the classic badge without losing progress');
const selectedBadgeSave = migrateSaveData({ version: CURRENT_VERSION, selectedBadgeId: 'pearl', levelStarsById: completedCampaign.levelStarsById }, levelIds, fixedNow);
assertEqual(selectedBadgeSave.selectedBadgeId, 'pearl', 'Current saves should retain selected badge styles');
assertEqual(migrateSaveData({ version: CURRENT_VERSION, selectedBadgeId: 'unknown' }, levelIds, fixedNow).selectedBadgeId, 'classic', 'Unknown badge styles should fall back safely');
console.log('Badge save migration checks passed.');
