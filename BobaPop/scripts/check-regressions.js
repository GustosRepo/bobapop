const assert = require('node:assert/strict');
const { loader, hookRunner, tick, nativeApp } = require('./test-helpers.cjs');
const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const load = loader();
const physics = load('src/game/physics.ts');
const core = load('src/hooks/saveDataCore.ts');
const ids = ['one', 'two'];
const state = () => ({
  balls: [{ id: 'ball', x: 195, y: 664, vx: 0, vy: 14, active: true, sticky: false }],
  paddle: { x: 150, width: 90, baseWidth: 90 },
  bricks: [{ id: 'distant', row: 0, col: 6, hp: 3, maxHp: 3, active: true }],
  particles: [], activePowerUps: [], score: 0, lives: 3, phase: 'playing', stickyCount: 3,
  bricksPopped: 0, ballSpeed: 14, elapsedMs: 0,
});
const memory = (initial = []) => {
  const db = new Map(initial);
  return { db, async getItem(key) { return db.get(key) ?? null; }, async setItem(key, value) { db.set(key, value); } };
};

test('paddle collision survives a slow frame at maximum ball speed', () => {
  const next = physics.physicsStep(state(), 32, ['#fff']);
  assert(next.balls[0].vy < 0);
  assert(next.balls[0].y < 680);
});

test('boss collision reflects below its surface and damages once', () => {
  let next = state();
  next.balls[0].y = 248; next.balls[0].vy = -14;
  next.boss = { hp: 12, maxHp: 12, x: 130, y: 180, width: 130, height: 52, vx: 0, baseSpeed: 0, defeated: false, enraged: false };
  for (let i = 0; i < 3; i++) next = physics.physicsStep(next, 32, ['#fff']);
  assert.equal(next.boss.hp, 11);
  assert(next.balls[0].vy > 0);
});

test('brick collision separates the ball and avoids repeated damage', () => {
  let next = state();
  next.balls[0] = { ...next.balls[0], x: 30, y: 240, vy: -14 };
  next.bricks.push({ id: 'target', row: 0, col: 0, hp: 3, maxHp: 3, active: true });
  next = physics.physicsStep(next, 32, ['#fff']);
  assert.equal(next.bricks[1].hp, 2);
  assert(next.balls[0].vy > 0);
});

test('sticky pickups restore catches and each catch consumes one', () => {
  const initial = state(); initial.stickyCount = 0;
  initial.balls[0] = { ...initial.balls[0], x: 30, y: 230, vy: -7 };
  initial.bricks.push({ id: 'boost', row: 0, col: 0, hp: 1, maxHp: 1, active: true, powerUp: 'sticky_paddle' });
  let next = physics.physicsStep(initial, 16, ['#fff']);
  assert.equal(next.stickyCount, 3);
  next.balls = [{ ...next.balls[0], x: 195, y: 664, vy: 14 }];
  next = physics.physicsStep(next, 32, ['#fff']);
  assert(next.balls[0].sticky);
  assert.equal(next.stickyCount, 2);
});

test('power-ups advance on game time and freeze while paused', () => {
  const initial = state();
  initial.activePowerUps = [{ type: 'wide_paddle', expiresAt: 1000 }];
  const next = physics.physicsStep(initial, 32, ['#fff']);
  assert.equal(next.elapsedMs, 32);
  assert.equal(next.activePowerUps.length, 1);
  const paused = { ...next, phase: 'paused' };
  assert.equal(physics.physicsStep(paused, 60000, ['#fff']), paused);
});

test('replacement balls preserve the level speed', () => {
  const initial = state(); initial.balls[0].y = 820;
  const next = physics.physicsStep(initial, 16, ['#fff']);
  assert.equal(next.lives, 2);
  assert(Math.abs(Math.hypot(next.balls[0].vx, next.balls[0].vy) - 14) < 0.001);
});

test('migration repairs invalid fields and rejects future saves', () => {
  const next = core.migrateSaveData({ version: core.CURRENT_VERSION, seenWorlds: null, seenOnboarding: null,
    energyLives: -5, levelStarsById: { one: 9 }, totalBobas: 'bad' }, ids);
  assert.equal(next.energyLives, 0); assert.equal(next.totalBobas, 0);
  assert.equal(next.levelStarsById.one, 3);
  assert.equal(JSON.stringify(next.seenWorlds), '[]');
  assert.equal(JSON.stringify(next.seenOnboarding), '{}');
  assert.throws(() => core.migrateSaveData({ version: core.CURRENT_VERSION + 1 }, ids), core.UnsupportedSaveVersionError);
});

test('save recovery restores backup without erasing a future primary', async () => {
  const { loadSavedProgress } = load('src/hooks/saveStorage.ts');
  const valid = { ...core.buildDefaultSave(ids), totalBobas: 777 };
  const storage = memory([[core.STORAGE_KEY, '{bad'], [core.BACKUP_STORAGE_KEY, JSON.stringify(valid)]]);
  assert.equal((await loadSavedProgress(storage, ids)).save.totalBobas, 777);
  const future = JSON.stringify({ version: core.CURRENT_VERSION + 1 });
  storage.db.set(core.STORAGE_KEY, future);
  await assert.rejects(loadSavedProgress(storage, ids));
  assert.equal(storage.db.get(core.STORAGE_KEY), future);
});

test('serialized save writes keep both copies current after a storage failure', async () => {
  const { createSaveWriter } = load('src/hooks/saveStorage.ts');
  const storage = memory(); let fail = true;
  const set = storage.setItem;
  storage.setItem = async (...args) => { if (fail) { fail = false; throw new Error('disk'); } await set(...args); };
  const writer = createSaveWriter(storage);
  const first = writer(core.buildDefaultSave(ids));
  const last = writer({ ...core.buildDefaultSave(ids), totalBobas: 50 });
  await assert.rejects(first); await last;
  assert.equal(JSON.parse(storage.db.get(core.STORAGE_KEY)).totalBobas, 50);
  assert.equal(storage.db.get(core.STORAGE_KEY), storage.db.get(core.BACKUP_STORAGE_KEY));
});

test('early entitlement updates merge into hydrated progress', async () => {
  const runner = hookRunner(); const app = nativeApp();
  const storage = memory([[core.STORAGE_KEY, JSON.stringify({ ...core.buildDefaultSave(ids), unlockedLevelIds: ids, totalBobas: 999 })]]);
  let release;
  const gate = new Promise((resolve) => { release = resolve; }); const get = storage.getItem;
  storage.getItem = async (key) => { await gate; return get(key); };
  const hooks = loader({ react: runner.react, 'react-native': { AppState: app }, '@react-native-async-storage/async-storage': { default: storage } });
  const { useSaveData } = hooks('src/hooks/useSaveData.ts');
  let save = runner.render(() => useSaveData(false, ids));
  save.setAdsRemovedEntitlement(true);
  assert.equal(JSON.parse(storage.db.get(core.STORAGE_KEY)).totalBobas, 999);
  release(); await tick(); await tick();
  save = runner.render(() => useSaveData(false, ids));
  assert.equal(save.totalBobas, 999); assert.equal(save.adsRemoved, true);
  assert.equal(save.unlockedLevelIds.length, 2);
  runner.cleanup();
});

async function economyFixture(overrides = {}, levelIds = ids) {
  const runner = hookRunner(); const app = nativeApp();
  const storage = memory([[core.STORAGE_KEY, JSON.stringify({ ...core.buildDefaultSave(levelIds), ...overrides })]]);
  const { useSaveData } = loader({ react: runner.react, 'react-native': { AppState: app },
    '@react-native-async-storage/async-storage': { default: storage } })('src/hooks/useSaveData.ts');
  const current = () => runner.render(() => useSaveData(false, levelIds));
  current(); await tick();
  assert(current().ready);
  return { current, storage, cleanup: () => runner.cleanup() };
}

test('first clears refund entry Energy once, while replays still cost Energy', async () => {
  const fixture = await economyFixture();
  try {
    assert(fixture.current().spendEnergy());
    assert.equal(fixture.current().energy, 4);
    const reward = fixture.current().recordLevelComplete(0, 3, 100, 14);
    assert.equal(reward.energyRefund, 1); assert.equal(reward.firstClear, true);
    assert.equal(fixture.current().energy, 5);
    assert(fixture.current().spendEnergy());
    const replay = fixture.current().recordLevelComplete(0, 3, 100, 14);
    assert.equal(replay.energyRefund, 0); assert.equal(replay.firstClear, false);
    assert.equal(fixture.current().energy, 4);
    await tick();
    assert.equal(JSON.parse(fixture.storage.db.get(core.BACKUP_STORAGE_KEY)).energyLives, 4);
  } finally { fixture.cleanup(); }
});

test('a first clear at full Energy never exceeds the cap or refunds again', async () => {
  const fixture = await economyFixture();
  try {
    assert.equal(fixture.current().recordLevelComplete(0, 2, 80, 14).energyRefund, 0);
    assert.equal(fixture.current().energy, 5);
    fixture.current().spendEnergy();
    assert.equal(fixture.current().recordLevelComplete(0, 3, 100, 14).energyRefund, 0);
    assert.equal(fixture.current().energy, 4);
  } finally { fixture.cleanup(); }
});

test('Plus starts and retries work at zero stored Energy without spending it', async () => {
  const fixture = await economyFixture({ adsRemoved: true, energyLives: 0, energyUpdatedAt: Date.now() });
  try {
    for (let attempt = 0; attempt < 8; attempt++) assert(fixture.current().spendEnergy());
    assert.equal(fixture.current().energy, 0);
    assert.equal(fixture.current().recordLevelComplete(0, 3, 100, 14).energyRefund, 0);
    fixture.current().setAdsRemovedEntitlement(false);
    assert.equal(fixture.current().spendEnergy(), false);
  } finally { fixture.cleanup(); }
});

test('expired Plus cannot bypass the normal Energy limit', async () => {
  const fixture = await economyFixture({ adsRemoved: true, plusExpiresAt: Date.now() - 1000, energyLives: 0, energyUpdatedAt: Date.now() });
  try { assert.equal(fixture.current().adsRemoved, false); assert.equal(fixture.current().spendEnergy(), false); }
  finally { fixture.cleanup(); }
});

test('Energy ad grants use the actual regenerated balance and cap at five', async () => {
  const fixture = await economyFixture({ energyLives: 1, energyUpdatedAt: Date.now() - core.ENERGY_REFILL_MS * 2 });
  try {
    const grant = fixture.current().addEnergy(2);
    assert.equal(grant.energyBefore, 3); assert.equal(grant.energyAfter, 5); assert.equal(grant.added, 2);
    assert.equal(fixture.current().addEnergy(2).added, 0);
    fixture.current().spendEnergy();
    const capped = fixture.current().addEnergy(2);
    assert.equal(capped.added, 1); assert.equal(capped.energyAfter, 5);
    assert.equal(fixture.current().addEnergy(-2).added, 0);
    assert.equal(fixture.current().addEnergy(NaN).added, 0);
  } finally { fixture.cleanup(); }
});

test('continue rewards are two lives with the same caps for free and Plus', () => {
  const { getContinueOffer, CONTINUE_POLICY } = load('src/monetization/continueSystem.ts');
  const { INITIAL_LIVES } = load('src/monetization/economy.ts');
  assert.equal(INITIAL_LIVES + CONTINUE_POLICY.maxContinues * CONTINUE_POLICY.rewardLives, 7);
  for (const plus of [false, true]) {
    assert.equal(getContinueOffer(2, 0, plus).canShow, false);
    assert.equal(getContinueOffer(3, 0, plus).rewardLives, 2);
    assert.equal(getContinueOffer(3, 1, plus).canShow, false);
    for (const level of [5, 20, 39]) {
      for (const used of [0, 1]) {
        const offer = getContinueOffer(level, used, plus);
        assert(offer.canShow); assert.equal(offer.rewardLives, 2);
        assert(offer.buttonText.includes('+2 Lives'));
        assert.equal(offer.reason, plus ? 'ads_removed' : 'available');
      }
      assert.equal(getContinueOffer(level, 2, plus).canShow, false);
    }
  }
});

test('badge milestones unlock an equipable cosmetic and persist without spending bobas', async () => {
  const fixture = await economyFixture({ totalBobas: 90 });
  try {
    assert.equal(fixture.current().selectBadge('caramel'), false);
    const reward = fixture.current().recordLevelComplete(0, 3, 100, 14);
    assert.equal(reward.badgeUnlocks.join(','), 'Caramel');
    assert(fixture.current().selectBadge('caramel'));
    assert.equal(fixture.current().selectedBadgeId, 'caramel');
    assert.equal(fixture.current().totalBobas, 104);
    assert.equal(fixture.current().selectBadge('cosmic'), false);
    await tick();
    assert.equal(JSON.parse(fixture.storage.db.get(core.STORAGE_KEY)).selectedBadgeId, 'caramel');
  } finally { fixture.cleanup(); }
  const { getBadgeStyle } = load('src/game/badgeRewards.ts');
  assert.equal(getBadgeStyle('cosmic', 119, 99999).id, 'classic');
  assert.equal(getBadgeStyle('cosmic', 120, 0).id, 'cosmic');
});

test('clear bonuses persist, unlock cosmetics, and can only be claimed once', async () => {
  const levels = ['one', 'two', 'three', 'four'];
  const fixture = await economyFixture({ totalBobas: 75 }, levels);
  let persisted;
  try {
    assert.equal(fixture.current().recordLevelComplete(0, 3, 100, 14).bonusClaimId, null);
    const reward = fixture.current().recordLevelComplete(3, 3, 100, 10);
    assert(reward.bonusClaimId); assert.equal(reward.bobasEarned, 10);
    assert.equal(fixture.current().totalBobas, 99);
    assert.equal(fixture.current().claimClearBonus('wrong').added, 0);
    await tick(); persisted = JSON.parse(fixture.storage.db.get(core.STORAGE_KEY));
    assert.equal(persisted.pendingClearBonus.id, reward.bonusClaimId);
    const bonus = fixture.current().claimClearBonus(reward.bonusClaimId);
    assert.equal(bonus.added, 10); assert.equal(bonus.badgeUnlocks.join(','), 'Caramel');
    assert.equal(fixture.current().totalBobas, 109);
    assert.equal(fixture.current().claimClearBonus(reward.bonusClaimId).added, 0);
    await tick(); assert.equal(JSON.parse(fixture.storage.db.get(core.STORAGE_KEY)).pendingClearBonus, null);
  } finally { fixture.cleanup(); }
  const restored = await economyFixture(persisted, levels);
  try {
    assert.equal(restored.current().claimClearBonus(persisted.pendingClearBonus.id).added, 10);
    assert.equal(restored.current().claimClearBonus(persisted.pendingClearBonus.id).added, 0);
  } finally { restored.cleanup(); }
});

test('new completions invalidate older bonus claims and Plus bonuses cost no Energy', async () => {
  const fixture = await economyFixture({ adsRemoved: true, energyLives: 0, energyUpdatedAt: Date.now() }, ['one', 'two', 'three', 'four']);
  try {
    const first = fixture.current().recordLevelComplete(3, 3, 100, 10);
    const second = fixture.current().recordLevelComplete(3, 3, 100, 12);
    assert.equal(fixture.current().claimClearBonus(first.bonusClaimId).added, 0);
    assert.equal(fixture.current().claimClearBonus(second.bonusClaimId).added, 12);
    assert.equal(fixture.current().energy, 0);
  } finally { fixture.cleanup(); }
  assert.equal(core.migrateSaveData({ version: 10, totalBobas: 321 }, ids).pendingClearBonus, null);
  assert.equal(core.migrateSaveData({ version: core.CURRENT_VERSION, pendingClearBonus: { id: 'bad', bobas: -1 } }, ids).pendingClearBonus, null);
});

test('reward tuning has bounded defaults and Energy offers disclose the capped amount', () => {
  const economy = (env) => loader({}, { process: { env } })('src/monetization/economy.ts');
  const standard = economy({}); assert.equal(standard.getEnergyAdReward(4, 5), 1); assert.equal(standard.getEnergyAdReward(5, 5), 0);
  assert.equal(economy({ EXPO_PUBLIC_ENERGY_AD_REWARD: '3' }).ENERGY_AD_REWARD, 3);
  for (const value of ['0', '-1', '4', 'NaN', '1.5']) assert.equal(economy({ EXPO_PUBLIC_CONTINUE_AD_LIVES: value }).CONTINUE_LIVES, 2);
});

test('placement IDs use specific live values, fallback safely, and reject placeholders', () => {
  const fallback = 'ca-app-pub-1234567890123456/1111111111'; const specific = 'ca-app-pub-1234567890123456/2222222222';
  const resolve = (env, os = 'ios', dev = false) => loader({ 'react-native': { Platform: { OS: os } } },
    { __DEV__: dev, process: { env } })('src/monetization/adPlacements.ts').resolveRewardedUnitId;
  const values = { EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID: fallback, EXPO_PUBLIC_ADMOB_ENERGY_IOS_UNIT_ID: specific };
  assert.equal(resolve(values)('energy', 'test'), specific); assert.equal(resolve(values)('continue', 'test'), fallback);
  assert.equal(resolve(values)('clear_bonus', 'test'), fallback); assert.equal(resolve(values, 'android')('energy', 'test'), null);
  assert.equal(resolve({ EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID: 'ca-app-pub-0000000000000000/0000000000' })('energy', 'test'), null);
  assert.equal(resolve(values, 'ios', true)('energy', 'test'), 'test');
});

test('analytics stays disabled without transport and sends a stable installation ID when enabled', async () => {
  const storage = memory(); const events = [];
  const analytics = loader({ 'react-native': { Platform: { OS: 'ios' } }, '@react-native-async-storage/async-storage': { default: storage } })('src/analytics/gameAnalytics.ts');
  analytics.trackGameEvent('disabled'); await tick(); assert.equal(storage.db.size, 0);
  analytics.configureAnalytics(event => { events.push(event); });
  analytics.trackGameEvent('session_start'); analytics.trackAdEvent('ad_revenue', 'energy', { value: 0.005, currency: 'USD' });
  await tick(); await analytics.flushAnalyticsQueue();
  assert.equal(events.length, 2); assert(events[0].installationId);
  assert.equal(events[0].installationId, events[1].installationId);
  assert.equal(events[1].params.placement, 'energy'); assert.equal(events[1].params.platform, 'ios');
  assert(events[1].params.reward_policy.includes('energy_2_lives_2'));
});

test('analytics preserves simultaneous events and arrivals during upload', async () => {
  const storage = memory(); const { createAnalyticsQueue } = load('src/analytics/analyticsQueue.ts');
  const queue = createAnalyticsQueue(storage);
  await Promise.all([queue.enqueue({ id: 'one' }), queue.enqueue({ id: 'two' })]);
  let release; const gate = new Promise((resolve) => { release = resolve; }); const sent = [];
  const flushing = queue.flush(async (event) => { sent.push(event.id); await gate; });
  await tick(); await queue.enqueue({ id: 'three' });
  release(); await flushing;
  assert.equal(sent.join(','), 'one,two,three');
  assert.equal(storage.db.get('@bobapop_analytics_queue_v1'), '[]');
});

test('analytics retains failed uploads for a later retry', async () => {
  const storage = memory(); const queue = load('src/analytics/analyticsQueue.ts').createAnalyticsQueue(storage);
  await queue.enqueue({ id: 'one' });
  await queue.flush(async () => { throw new Error('offline'); });
  assert.equal(JSON.parse(storage.db.get('@bobapop_analytics_queue_v1')).length, 1);
  const sent = []; await queue.flush((event) => { sent.push(event.id); });
  assert.equal(sent.join(','), 'one');
});

test('music cancellation, mute, and backgrounding stop every outgoing track', async () => {
  const players = []; const timers = new Map(); let id = 0;
  const music = loader({ 'expo-audio': { createAudioPlayer() { const p = { volume: 0, playing: false,
    play() { this.playing = true; }, pause() { this.playing = false; }, seekTo: async () => {} }; players.push(p); return p; } } },
  { setInterval(fn) { timers.set(++id, fn); return id; }, clearInterval(key) { timers.delete(key); } })('src/hooks/useMusic.ts');
  const advance = (count) => { for (let i = 0; i < count; i++) [...timers.values()].forEach((fn) => fn()); };
  await music.preloadMusic(); music.playMusic('menu'); advance(20);
  music.playMusic('game'); advance(3); music.playMusic('boss'); advance(20);
  assert.equal(players.filter((p) => p.playing).length, 1);
  music.pauseMusic(); assert(players.every((p) => !p.playing));
  music.resumeMusic(); music.setMusicEnabled(false); assert(players.every((p) => !p.playing));
});

test('backgrounding pauses gameplay and returning requires resume', () => {
  const runner = hookRunner(); const app = nativeApp(); const listeners = {};
  const hooks = loader({ react: runner.react, 'expo-haptics': {}, 'react-native': { AppState: app },
    '../constants/themes': { WORLDS: Array.from({ length: 4 }, () => ({ particleColors: ['#fff'] })) },
    './useSound': { useSound: () => ({ playSound() {} }), _hapticsEnabled: false },
    '../analytics/gameAnalytics': { trackLifeLost() {}, trackPowerUpCollected() {}, trackBossEnraged() {} } },
    { requestAnimationFrame: () => 1, cancelAnimationFrame() {} });
  const { useGameLoop } = hooks('src/hooks/useGameLoop.ts');
  let game = runner.render(() => useGameLoop(0)); game.launchBall(); app.change('background');
  game = runner.render(() => useGameLoop(0)); assert.equal(game.gameState.phase, 'paused');
  app.change('active'); game = runner.render(() => useGameLoop(0)); assert.equal(game.gameState.phase, 'paused');
  game.resumeGame(); game = runner.render(() => useGameLoop(0)); assert.equal(game.gameState.phase, 'playing');
  game.resetLevel(); game = runner.render(() => useGameLoop(0)); assert.equal(game.gameState.phase, 'idle');
  runner.cleanup();
});

test('store plans use loaded prices and calculate savings only in matching currencies', () => {
  const { buildStorePlans } = load('src/monetization/plus.ts');
  assert(buildStorePlans([]).every((plan) => !plan.available));
  const products = [{ id: 'bobapop_plus_yearly', platform: 'ios', displayPrice: '€12.00', price: 12, currency: 'EUR' },
    { id: 'bobapop_plus_monthly', platform: 'ios', displayPrice: '€2.00', price: 2, currency: 'EUR' }];
  assert.equal(buildStorePlans(products)[0].savings, 'Save 50%');
  products[0].currency = 'USD'; assert.equal(buildStorePlans(products)[0].savings, undefined);
});

test('expanded campaign preserves ranks and resolves themes from actual level metadata', () => {
  const { calculatePlayerLevel } = load('src/game/progression.ts');
  const { getWorldForLevel } = load('src/constants/themes.ts');
  assert.equal(calculatePlayerLevel(60).title, 'Boba Master');
  assert.equal(calculatePlayerLevel(66).level, 11);
  assert.equal(calculatePlayerLevel(120).title, 'Boba Grandmaster');
  assert.equal(getWorldForLevel(20).id, 'brown_sugar');
  assert.equal(getWorldForLevel(25).id, 'matcha');
  assert.equal(getWorldForLevel(30).id, 'taro');
  assert.equal(getWorldForLevel(39).id, 'thai_tea');
});

test('menu content balances side insets when there is room and preserves width when there is not', () => {
  const { balanceHorizontalInsets } = load('src/utils/safeArea.ts');
  assert.deepEqual({ ...balanceHorizontalInsets(468, { left: 0, right: 84 }, 280) }, { left: 84, right: 84 });
  assert.deepEqual({ ...balanceHorizontalInsets(360, { left: 0, right: 84 }, 260) }, { left: 16, right: 84 });
  assert.deepEqual({ ...balanceHorizontalInsets(300, { left: 84, right: 0 }, 260) }, { left: 84, right: 0 });
});

test('resizable boards preserve proportions and map touches inside asymmetric safe areas', () => {
  const { fitGameViewport, paddleXFromWindow } = load('src/game/viewport.ts');
  for (const [width, height, sidePanel] of [[320,568,false], [440,620,false], [955,674,true], [674,955,false], [568,320,true], [320,320,false]]) {
    const insets = { top: 24, right: 64, bottom: 20, left: 8 };
    const v = fitGameViewport(width, height, insets);
    assert.equal(v.hudBesideBoard, sidePanel);
    assert(v.left >= insets.left && v.top >= insets.top);
    assert(v.left + v.width <= width - insets.right + 0.001);
    assert(v.top + v.height <= height - insets.bottom + 0.001);
    assert(Math.abs(v.width / v.height - 390 / 800) < 0.001);
    for (const x of [0, 195, 390]) {
      assert(Math.abs(paddleXFromWindow(37 + v.left + x * v.scale, 37, v) - x) < 0.001);
    }
    assert.equal(paddleXFromWindow(-100, 37, v), 0);
    assert.equal(paddleXFromWindow(5000, 37, v), 390);
    if (v.hudBesideBoard) {
      assert(v.hudLeft >= insets.left);
      assert(Math.abs(v.left - v.hudLeft - v.hudWidth - 16) < 0.001);
      assert(v.hudTop > v.top && v.hudTop <= v.top + 24);
      assert(v.hudWidth <= 176);
      assert(Math.abs(v.height - (height - insets.top - insets.bottom)) < 0.001);
    } else {
      assert.equal(v.hudLeft, v.left);
      assert.equal(v.hudWidth, v.width);
    }
  }
  const wide = fitGameViewport(955, 674, { top: 24, right: 64, bottom: 20, left: 8 });
  assert(Math.abs((wide.hudLeft + wide.left + wide.width) / 2 - 955 / 2) < 0.001);
  assert.equal(paddleXFromWindow(0, 0, fitGameViewport(0, 0, {top:0,right:0,bottom:0,left:0})), 195);
});

test('fold-like resize pauses the existing run, preserves its board, and updates touch mapping', async () => {
  const React = require('react'); const { create, act } = require('react-test-renderer');
  global.IS_REACT_ACT_ENVIRONMENT = true;
  let game = { ...state(), phase: 'idle' }; let pauses = 0; let paddleX; let pan;
  let insets = { top: 24, right: 60, bottom: 20, left: 8 };
  const noop = () => {};
  const timers = [];
  const native = Object.fromEntries(['View','Text','Image','TouchableOpacity','StatusBar','Modal','ScrollView'].map(name => [name, name]));
  native.StyleSheet = { create: value => value };
  native.PanResponder = { create: config => { pan = config; return { panHandlers: {} }; } };
  native.BackHandler = { addEventListener: () => ({ remove: noop }) };
  native.Animated = { View: 'AnimatedView', Value: class { setValue() {} stopAnimation() {} } };
  const theme = { name: 'Test', accentColor:'#fff', ballColor:'#fff', background:['#222','#333','#444'] };
  const { GameScreen } = loader({ react: React, 'react-native': native,
    'react-native-safe-area-context': { useSafeAreaInsets: () => insets },
    '../hooks/useReducedMotion': { useReducedMotion: () => true },
    '../hooks/useGameKeyboard': { useGameKeyboard: noop },
    '../hooks/useGameLoop': { useGameLoop: () => ({ gameState: game, worldTheme: theme,
      movePaddle: x => { paddleX = x; }, launchBall: noop, resumeGame: noop,
      pauseGame: () => { pauses++; game = { ...game, phase: 'paused' }; } }) },
    '../components/GameCanvas': { GameCanvas: props => React.createElement('Canvas', props) },
    '../components/HUD': { HUD: props => React.createElement('HUD', props) },
  }, { setTimeout: (fn, delay) => { timers.push({fn, delay}); return timers.length; }, clearTimeout: noop })('src/screens/GameScreen.tsx');
  let renderer;
  const props = { levelIndex: 5, energy: 4, unlimitedEnergy:false, maxEnergy:5, nextEnergyInMs:0,
    seenOnboarding:{}, onMarkOnboardingSeen:noop, onBack:noop, onRestart:noop, onLevelComplete:noop, onGameOver:noop };
  await act(async () => { renderer = create(React.createElement(GameScreen, props), {
    createNodeMock: () => ({ measureInWindow: cb => cb(37, 0, 955, 674) }),
  }); });
  const layout = async (width, height) => act(async () => {
    renderer.root.findAllByType('View').find(n => n.props.onLayout).props.onLayout({ nativeEvent:{layout:{width,height}} });
  });
  await layout(390,844);
  assert.equal(pauses, 0);
  await act(async () => timers.find(timer => timer.delay === 3100).fn());
  assert.equal(pan.onStartShouldSetPanResponder(), true);
  const originalBoard = game.bricks;
  game = { ...game, phase: 'playing' };
  await layout(955,674);
  assert.equal(pauses, 1);
  assert.equal(game.bricks, originalBoard);
  await act(async () => renderer.update(React.createElement(GameScreen, props)));
  assert.equal(pan.onStartShouldSetPanResponder(), false);
  const canvas = renderer.root.findByType('Canvas');
  assert.equal(canvas.props.scaleX, canvas.props.scaleY);
  assert.equal(canvas.props.state.bricks, originalBoard);
  const pause = renderer.root.findAllByType('Modal').find(n => n.props.visible);
  assert(pause);
  assert(pause.props.supportedOrientations.includes('landscape'));
  // A changed horizontal reserved area also pauses without resetting progress.
  insets = { ...insets, left: 70, right: 0 };
  await act(async () => renderer.update(React.createElement(GameScreen, props)));
  assert.equal(pauses, 2);
  assert.equal(game.bricks, originalBoard);
  game = { ...game, phase: 'playing' };
  await act(async () => renderer.update(React.createElement(GameScreen, props)));
  const v = load('src/game/viewport.ts').fitGameViewport(955,674,insets);
  pan.onPanResponderGrant({ nativeEvent: { pageX: 37 + v.left + v.width / 2 } });
  assert(Math.abs(paddleX - 195) < 0.001);
  pan.onPanResponderMove({}, { moveX: 37 + v.left + v.width * 0.75 });
  assert(Math.abs(paddleX - 292.5) < 0.001);
  await act(async () => renderer.unmount());
});

test('reward screens disclose exact rewards and enable Plus retries at zero Energy', async () => {
  const React = require('react'); const { create, act } = require('react-test-renderer');
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const native = Object.fromEntries(['View','Text','TouchableOpacity','StatusBar','ScrollView','Image'].map(name => [name, name]));
  native.StyleSheet = { create: value => value };
  native.Animated = { Text: 'AnimatedText', Value: class { setValue() {} interpolate() { return 1; } } };
  const components = loader({ react: React, 'react-native': native,
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 20, left: 8, right: 64 }) },
    'expo-linear-gradient': { LinearGradient: 'Gradient' },
    '../hooks/useReducedMotion': { useReducedMotion: () => true } });
  const { GameOverScreen } = components('src/screens/GameOverScreen.tsx');
  const { LevelCompleteScreen } = components('src/screens/LevelCompleteScreen.tsx');
  const { getContinueOffer } = load('src/monetization/continueSystem.ts');
  const theme = { accentColor: '#A86C38', ballColor: '#FFF', background: ['#222','#333','#222'], paddleColor: '#A86C38' };
  const retry = () => {}; const watch = () => {}; let renderer;
  const props = { score: 100, levelNumber: 6, theme, adsRemoved: true,
    continueOffer: getContinueOffer(5, 0, true), adAvailable: true, adUnavailable: false, energyAdReady: true, energyAdLoading: false,
    energy: 0, maxEnergy: 5, nextEnergyInMs: 10000, onContinue() {}, onWatchEnergyAd: watch, onRetry: retry, onMenu() {}, onOpenPlus() {} };
  await act(async () => { renderer = create(React.createElement(GameOverScreen, props)); });
  assert.equal(renderer.root.findByType('ScrollView').props.contentContainerStyle[1].paddingRight, 88);
  assert.equal(renderer.root.findAllByType('TouchableOpacity').find(node => node.props.onPress === retry).props.disabled, false);
  assert(JSON.stringify(renderer.toJSON()).includes('Retry Level · Unlimited Energy'));
  await act(async () => renderer.update(React.createElement(GameOverScreen, { ...props, adsRemoved: false, continueOffer: getContinueOffer(5, 0, false) })));
  const text = JSON.stringify(renderer.toJSON());
  assert(text.includes('Watch Ad · +2 Lives')); assert(text.includes('Watch Ad · +2 Energy'));
  assert(!text.includes('Available in'));
  await act(async () => renderer.update(React.createElement(GameOverScreen, { ...props, adsRemoved: false, energy: 4,
    adAvailable: false, adUnavailable: true, continueOffer: getContinueOffer(5, 0, false) })));
  assert(JSON.stringify(renderer.toJSON()).includes('Watch Ad · +1 Energy'));
  await act(async () => renderer.update(React.createElement(LevelCompleteScreen, { score: 100, stars: 3, levelNumber: 1, theme,
    firstClear: true, energyRefund: 1, unlimitedEnergy: false, badgeUnlocks: ['Caramel'], isLast: false,
    isWorldBoss: false, chapter: 1, isChapterComplete: false, bobasEarned: 14, bonusAvailable: false, bonusAdStatus: 'ready',
    onClaimBonus() {}, energy: 5, maxEnergy: 5, energyAdReady: true, energyAdLoading: false, onWatchEnergyAd() {}, onNext() {}, onReplay() {}, onMenu() {} })));
  const completed = JSON.stringify(renderer.toJSON());
  assert(completed.includes('First clear! +1 Energy returned'));
  assert(completed.includes('Caramel'));
  await act(async () => renderer.unmount());
});

test('production config rejects absent IDs, placeholders, and release test ads', () => {
  const config = (env) => loader({}, { process: { env } })('app.config.js');
  assert.throws(() => config({ EAS_BUILD_PROFILE: 'production' }), /Missing/);
  const values = {
    EAS_BUILD_PROFILE: 'production', EAS_BUILD_PLATFORM: 'ios',
    EXPO_PUBLIC_ADMOB_IOS_APP_ID: 'ca-app-pub-1234567890123456~1234567890',
    EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID: 'ca-app-pub-1234567890123456/1234567890',
  };
  assert.equal(config(values).expo.name, 'BobaPop');
  const plugin = config(values).expo.plugins.find(entry => Array.isArray(entry) && entry[0] === 'react-native-google-mobile-ads')[1];
  assert(plugin.userTrackingUsageDescription); assert(plugin.skAdNetworkItems.includes('cstr6suwn9.skadnetwork'));
  const separate = { ...values, EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID: undefined,
    EXPO_PUBLIC_ADMOB_CONTINUE_IOS_UNIT_ID: values.EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID,
    EXPO_PUBLIC_ADMOB_ENERGY_IOS_UNIT_ID: 'ca-app-pub-1234567890123456/2222222222',
    EXPO_PUBLIC_ADMOB_CLEAR_BONUS_IOS_UNIT_ID: 'ca-app-pub-1234567890123456/3333333333' };
  assert.equal(config(separate).expo.name, 'BobaPop');
  assert.throws(() => config({ ...separate, EXPO_PUBLIC_ADMOB_ENERGY_IOS_UNIT_ID: 'ca-app-pub-9999999999999999/2222222222' }), /publisher mismatch/);
  assert.throws(() => config({ ...values, EXPO_PUBLIC_ENERGY_AD_REWARD: '4' }), /must be 1, 2, or 3/);
  assert.throws(() => config({ ...values, EXPO_PUBLIC_ALLOW_TEST_ADS_IN_RELEASE: 'true' }), /disable release test ads/);
  assert.throws(() => config({ ...values, EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID: 'ca-app-pub-0000000000000000/0000000000' }), /Missing live/);
  assert.throws(() => config({ ...values, EAS_BUILD_PLATFORM: undefined }), /Missing/);
});

function adHarness(canRequestAds = true, options = {}) {
  const runner = hookRunner(); const app = nativeApp(); const ads = []; const events = []; const timers = new Map();
  let now = 1000; let nextTimer = 0; let loads = 0; let consentCalls = 0; let consentError = false;
  const sdk = { TestIds: { REWARDED: 'test' }, AdsConsent: {
    gatherConsent: async () => { consentCalls++; if (consentError) throw new Error('network'); return { canRequestAds, privacyOptionsRequirementStatus: 'REQUIRED' }; },
    getConsentInfo: async () => { if (consentError) throw new Error('network'); return { canRequestAds, privacyOptionsRequirementStatus: 'REQUIRED' }; },
    showPrivacyOptionsForm: async () => ({ privacyOptionsRequirementStatus: 'REQUIRED' }) },
    AdsConsentPrivacyOptionsRequirementStatus: { REQUIRED: 'REQUIRED' }, default: () => ({ initialize: async () => [] }),
    RewardedAd: { createForAdRequest: (unit, requestOptions) => {
      const ad = { unit, requestOptions, listener: null, addAdEventsListener(fn) { this.listener = fn; return () => { this.listener = null; }; },
        load() { loads++; if (!options.stall) this.emit('loaded'); }, show: async () => {}, emit(type, payload) { this.listener?.({ type, payload }); } };
      ads.push(ad); return ad;
    } }, RewardedAdEventType: { LOADED: 'loaded', EARNED_REWARD: 'earned' }, AdEventType: { CLOSED: 'closed', ERROR: 'error', OPENED: 'opened', PAID: 'paid' } };
  const RealDate = Date;
  const { useRewardedAd, AD_MAX_AGE_MS } = loader({ react: runner.react, 'react-native': { AppState: app, Platform: { OS: 'ios' }, Alert: { alert() {} } },
    '../analytics/gameAnalytics': { trackAdEvent: (...args) => events.push(args), trackGameEvent() {} },
    '../monetization/adsSdk': { getAdsSdk: () => sdk } }, { __DEV__: true,
    Date: class extends RealDate { static now() { return now; } },
    setTimeout(fn, delay) { const id = ++nextTimer; timers.set(id, { fn, at: now + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
  })('src/hooks/useRewardedAd.ts');
  const advance = (ms) => {
    const end = now + ms;
    for (;;) {
      const due = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]); now = due[1].at; due[1].fn();
    }
    now = end;
  };
  return { runner, app, ads, events, advance, AD_MAX_AGE_MS,
    render: (enabled = true) => runner.render(() => useRewardedAd(enabled)), loads: () => loads,
    consentCalls: () => consentCalls, setConsentError: value => { consentError = value; } };
}

test('ads never load without consent permission and initialize consent once for all placements', async () => {
  const h = adHarness(false); h.render(); await tick();
  assert.equal(h.loads(), 0); assert.equal(h.render().statuses.continue, 'unavailable'); h.runner.cleanup();
  const allowed = adHarness(); allowed.render(); await tick();
  assert.equal(allowed.loads(), 3); assert.equal(allowed.consentCalls(), 1);
  assert(allowed.ads.every(ad => ad.requestOptions === undefined)); allowed.runner.cleanup();
});

test('ad presentation rejection settles immediately and rewards wait for close', async () => {
  const h = adHarness(); h.render(); await tick();
  let result; h.ads[0].show = async () => { throw new Error('presentation'); };
  h.render().showAd('continue', value => { result = value; }); await tick(); assert.equal(result, 'error');
  result = undefined; const current = h.ads.at(-1);
  h.render().showAd('continue', value => { result = value; }); current.emit('earned'); assert.equal(result, undefined);
  current.emit('closed'); assert.equal(result, 'watched'); assert.equal(h.render().busy, false); h.runner.cleanup();
});

test('mediation reward after close is accepted once and old callbacks cannot reward another ad', async () => {
  const h = adHarness(); h.render(); await tick();
  const results = []; const first = h.ads[0];
  h.render().showAd('continue', value => results.push(value));
  first.emit('closed'); first.emit('closed'); h.advance(500); first.emit('earned');
  assert.equal(results.join(','), 'watched');
  h.render().showAd('energy', value => results.push(value));
  h.advance(1000); first.emit('earned'); first.emit('closed');
  assert.equal(results.join(','), 'watched');
  h.ads[1].emit('closed'); h.advance(1000);
  assert.equal(results.join(','), 'watched,closed'); h.runner.cleanup();
});

test('load timeout replaces the stalled request and ignores late events', async () => {
  const h = adHarness(true, { stall: true }); h.render(); await tick(); const old = h.ads[0];
  h.advance(15000); assert.equal(h.render().statuses.continue, 'unavailable');
  h.advance(1000); assert.equal(h.loads(), 6);
  old.emit('loaded'); assert.equal(h.render().statuses.continue, 'loading');
  h.ads[3].emit('loaded'); assert.equal(h.render().statuses.continue, 'ready');
  assert(h.events.some(e => e[0] === 'ad_load_failed' && e[2].error_code === 'load_timeout')); h.runner.cleanup();
});

test('cached ads refresh before expiry and foreground does not refresh a fresh ad', async () => {
  const h = adHarness(); h.render(); await tick();
  h.app.change('background'); h.app.change('active'); assert.equal(h.loads(), 3);
  h.advance(h.AD_MAX_AGE_MS); assert.equal(h.loads(), 6);
  h.app.change('background'); h.advance(h.AD_MAX_AGE_MS); assert.equal(h.loads(), 6);
  h.app.change('active'); assert.equal(h.loads(), 9); h.runner.cleanup();
});

test('paid events preserve currency, precision, placement and context without duplicate revenue', async () => {
  const h = adHarness(); h.render(); await tick();
  h.render().showAd('energy', () => {}, { source: 'over', reward_amount: 2 });
  const paid = { value: 0.005, currency: 'USD', precision: 1 };
  h.ads[1].emit('paid', paid); h.ads[1].emit('paid', paid);
  const revenue = h.events.filter(e => e[0] === 'ad_revenue');
  assert.equal(revenue.length, 1); assert.equal(revenue[0][1], 'energy');
  assert.equal(revenue[0][2].value, 0.005); assert.equal(revenue[0][2].currency, 'USD');
  assert.equal(revenue[0][2].precision, 1); assert.equal(revenue[0][2].source, 'over'); h.runner.cleanup();
});

test('long visible ads keep their reward callback and lock until native close', async () => {
  const h = adHarness(); h.render(); await tick(); const results = [];
  h.render().showAd('energy', value => results.push(value)); h.ads[1].emit('opened');
  h.render().showAd('continue', value => results.push(value)); assert.equal(results.join(','), 'not_available');
  h.advance(120000); assert.equal(results.join(','), 'not_available'); assert(h.render().busy);
  h.ads[1].emit('earned'); h.ads[1].emit('closed'); assert.equal(h.render().busy, false);
  assert.equal(results.join(','), 'not_available,watched'); h.runner.cleanup();
});

test('a hung show request without presentation recovers and settles once', async () => {
  const h = adHarness(); h.render(); await tick(); const results = []; const old = h.ads[1];
  h.render().showAd('energy', value => results.push(value));
  h.advance(120000); assert.equal(results.join(','), 'timeout'); assert.equal(h.render().busy, false);
  assert.equal(h.render().statuses.energy, 'ready'); old.emit('earned'); old.emit('closed');
  assert.equal(results.join(','), 'timeout'); h.runner.cleanup();
});

test('consent startup failures retry and disabling ads removes pending timers', async () => {
  const h = adHarness(); h.setConsentError(true); h.render(); await tick(); assert.equal(h.loads(), 0);
  h.setConsentError(false); h.advance(1000); await tick(); assert.equal(h.loads(), 3);
  h.render(false); h.advance(h.AD_MAX_AGE_MS * 2); assert.equal(h.loads(), 3); h.runner.cleanup();
});

test('store outages preserve entitlement and foreground refresh handles expiration', async () => {
  const runner = hookRunner(); const app = nativeApp(); const updates = []; let offline = true;
  const store = { connected: true, subscriptions: [], fetchProducts: async () => {}, finishTransaction: async () => {}, requestPurchase: async () => {}, restorePurchases: async () => {} };
  const { usePlusPurchases } = loader({ react: runner.react, 'react-native': { AppState: app, Platform: { OS: 'ios' } },
    'expo-iap': { useIAP: () => store, getActiveSubscriptions: async () => { if (offline) throw new Error('offline'); return []; } } })('src/hooks/usePlusPurchases.ts');
  runner.render(() => usePlusPurchases((active) => updates.push(active))); await tick();
  assert.equal(updates.length, 0);
  offline = false; app.change('background'); app.change('active'); await tick();
  assert.equal(updates.join(','), 'false'); runner.cleanup();
});

test('App guards duplicate wins and preserves board and Energy across capped rewarded continues', async () => {
  const React = require('react');
  const { create, act } = require('react-test-renderer');
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const locks = []; let energy = 5; let mounts = 0; let completionCalls = 0; let bonusClaims = 0; let adCalls = 0; let pendingAd;
  const app = nativeApp();
  const noop = () => {};
  const asyncNoop = async () => {};
  const screen = (name) => ({ [name]: (props) => React.createElement(name, props) });
  const analytics = Object.fromEntries(['trackAdEvent', 'trackContinueAccepted', 'trackContinueOffer', 'configureAnalytics',
    'trackEnergyAdResult', 'trackGameOverExit', 'trackLevelComplete', 'trackLevelFail', 'trackLevelStart', 'trackRewardedAdResult', 'trackGameEvent'].map((key) => [key, noop]));
  analytics.flushAnalyticsQueue = asyncNoop;
  const styles = { create: (value) => value };
  const mocks = {
    react: React,
    'react-native': { View: 'View', Text: 'Text', Image: 'Image', TouchableOpacity: 'Button', StatusBar: 'StatusBar',
      StyleSheet: styles, AppState: app, Alert: { alert: noop }, Animated: { View: 'AnimatedView', Value: class { setValue() {} } } },
    'react-native-safe-area-context': { SafeAreaProvider: React.Fragment, useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    './src/hooks/useReducedMotion': { useReducedMotion: () => true },
    './src/screens/GameScreen': { GameScreen: (props) => { const [mount] = React.useState(() => ++mounts); return React.createElement('GameScreen', { ...props, mount }); } },
    './src/screens/LevelSelectScreen': screen('LevelSelectScreen'),
    './src/screens/LevelCompleteScreen': screen('LevelCompleteScreen'),
    './src/screens/GameOverScreen': screen('GameOverScreen'),
    './src/components/WorldIntroModal': screen('WorldIntroModal'),
    './src/components/OnboardingModal': screen('OnboardingModal'),
    './src/components/PlusPaywallModal': screen('PlusPaywallModal'),
    './src/constants/themes': { WORLDS: [{}, {}, {}, {}] }, './src/assets/images': { IMAGES: {} },
    './src/hooks/useSound': { preloadSounds: asyncNoop, setSoundEnabled: noop, setHapticsEnabled: noop },
    './src/hooks/useMusic': { preloadMusic: asyncNoop, playMusic: noop, setMusicEnabled: noop, pauseMusic: noop, resumeMusic: noop },
    './src/analytics/gameAnalytics': analytics, '../analytics/gameAnalytics': analytics,
    './src/hooks/useRewardedAd': { useRewardedAd: () => ({ statuses: { continue: 'ready', energy: 'ready', clear_bonus: 'ready' }, busy: false, showAd: (placement, callback) => { adCalls++; pendingAd = callback; }, privacyOptionsRequired: false, openPrivacyOptions: asyncNoop }) },
    './src/hooks/usePlusPurchases': { usePlusPurchases: () => ({ busyPlanId: null, restoring: false, connected: false, storeMessage: null, storePlans: [], purchasePlan: noop, restorePurchases: noop }) },
    './src/hooks/useSaveData': { useSaveData: () => ({ loading: false, ready: true, saveError: null, retrySave: noop,
      unlockedUpTo: 0, levelStars: {}, levelHighScores: {}, totalBobas: 0, seenWorlds: [0, 1, 2, 3], soundEnabled: false,
      hapticsEnabled: false, adsRemoved: false, seenOnboarding: { app_intro: true }, energy, maxEnergy: 5, nextEnergyInMs: 0,
      recordLevelComplete: () => { completionCalls++; return { firstClear: true, energyRefund: 0, badgeUnlocks: [], bobasEarned: 14, bonusClaimId: 'claim' }; }, claimClearBonus: () => { bonusClaims++; return { added: 14, badgeUnlocks: [] }; }, markWorldSeen: noop, markOnboardingSeen: noop, updateSettings: noop,
      setAdsRemovedEntitlement: noop, isLevelUnlocked: () => true, spendEnergy: () => { energy--; return true; }, addEnergy: () => true }) },
  };
  const App = loader(mocks, { setTimeout(fn, ms) { if (ms === 650) locks.push(fn); return 1; } })('App.tsx').default;
  let renderer;
  await act(async () => { renderer = create(React.createElement(App)); });
  await act(async () => { renderer.root.findByType('LevelSelectScreen').props.onSelectLevel(0); });
  const before = renderer.root.findByType('GameScreen').props.mount;
  assert.equal(energy, 4);
  locks.shift()();
  await act(async () => { renderer.root.findByType('GameScreen').props.onRestart(); });
  assert.notEqual(renderer.root.findByType('GameScreen').props.mount, before);
  assert.equal(energy, 3);
  await act(async () => { renderer.root.findByType('GameScreen').props.onRestart(); });
  assert.equal(energy, 3);
  const complete = renderer.root.findByType('GameScreen').props.onLevelComplete;
  await act(async () => { complete(100, 14, 3); complete(100, 14, 3); });
  assert.equal(completionCalls, 1);
  const claim = renderer.root.findByType('LevelCompleteScreen').props.onClaimBonus;
  await act(async () => { claim(); claim(); });
  assert.equal(adCalls, 1); assert.equal(bonusClaims, 0);
  await act(async () => pendingAd('closed')); assert.equal(bonusClaims, 0);
  await act(async () => renderer.root.findByType('LevelCompleteScreen').props.onClaimBonus());
  await act(async () => { pendingAd('watched'); pendingAd('watched'); });
  assert.equal(bonusClaims, 1);
  assert.equal(renderer.root.findByType('LevelCompleteScreen').props.bonusAvailable, false);
  await act(async () => renderer.root.findByType('LevelCompleteScreen').props.onMenu());
  locks.shift()();
  await act(async () => renderer.root.findByType('LevelSelectScreen').props.onSelectLevel(5));
  assert.equal(energy, 2); locks.shift()();
  const failedBoard = { ...state(), phase: 'lost', lives: 0, score: 50 };
  await act(async () => renderer.root.findByType('GameScreen').props.onGameOver(50, failedBoard));
  await act(async () => renderer.root.findByType('GameOverScreen').props.onContinue());
  await act(async () => pendingAd('closed'));
  assert.equal(renderer.root.findByType('GameOverScreen').props.continueOffer.continueNumber, 1);
  assert.equal(energy, 2);
  for (let used = 0; used < 2; used++) {
    await act(async () => renderer.root.findByType('GameOverScreen').props.onContinue());
    await act(async () => pendingAd('watched'));
    const game = renderer.root.findByType('GameScreen');
    assert.equal(game.props.initialLives, 2);
    assert.equal(game.props.resumeState, failedBoard);
    assert.equal(energy, 2); locks.shift()();
    await act(async () => game.props.onGameOver(50, failedBoard));
  }
  assert.equal(renderer.root.findByType('GameOverScreen').props.continueOffer.canShow, false);
  await act(async () => renderer.root.findByType('GameOverScreen').props.onContinue());
  assert.equal(adCalls, 5); // two bonus attempts, one skipped revive, and two successful revives
  await act(async () => renderer.unmount());
});

(async () => {
  for (const [name, fn] of tests) { await fn(); console.log(`PASS ${name}`); }
  console.log(`${tests.length} regression checks passed.`);
})().catch((error) => { console.error(error); process.exit(1); });
