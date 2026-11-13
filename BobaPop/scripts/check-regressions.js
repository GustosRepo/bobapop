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

async function economyFixture(overrides = {}) {
  const runner = hookRunner(); const app = nativeApp();
  const storage = memory([[core.STORAGE_KEY, JSON.stringify({ ...core.buildDefaultSave(ids), ...overrides })]]);
  const { useSaveData } = loader({ react: runner.react, 'react-native': { AppState: app },
    '@react-native-async-storage/async-storage': { default: storage } })('src/hooks/useSaveData.ts');
  const current = () => runner.render(() => useSaveData(false, ids));
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

test('reward screens disclose exact rewards and enable Plus retries at zero Energy', async () => {
  const React = require('react'); const { create, act } = require('react-test-renderer');
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const native = Object.fromEntries(['View','Text','TouchableOpacity','StatusBar','ScrollView','Image'].map(name => [name, name]));
  native.StyleSheet = { create: value => value };
  native.Animated = { Text: 'AnimatedText', Value: class { setValue() {} interpolate() { return 1; } } };
  const components = loader({ react: React, 'react-native': native,
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    'expo-linear-gradient': { LinearGradient: 'Gradient' },
    '../hooks/useReducedMotion': { useReducedMotion: () => true } });
  const { GameOverScreen } = components('src/screens/GameOverScreen.tsx');
  const { LevelCompleteScreen } = components('src/screens/LevelCompleteScreen.tsx');
  const { getContinueOffer } = load('src/monetization/continueSystem.ts');
  const theme = { accentColor: '#A86C38', ballColor: '#FFF', background: ['#222','#333','#222'], paddleColor: '#A86C38' };
  const retry = () => {}; const watch = () => {}; let renderer;
  const props = { score: 100, levelNumber: 6, theme, adsRemoved: true,
    continueOffer: getContinueOffer(5, 0, true), adAvailable: true, adUnavailable: false,
    energy: 0, maxEnergy: 5, nextEnergyInMs: 10000, onContinue() {}, onWatchEnergyAd: watch, onRetry: retry, onMenu() {}, onOpenPlus() {} };
  await act(async () => { renderer = create(React.createElement(GameOverScreen, props)); });
  assert.equal(renderer.root.findAllByType('TouchableOpacity').find(node => node.props.onPress === retry).props.disabled, false);
  assert(JSON.stringify(renderer.toJSON()).includes('Retry Level · Unlimited Energy'));
  await act(async () => renderer.update(React.createElement(GameOverScreen, { ...props, adsRemoved: false, continueOffer: getContinueOffer(5, 0, false) })));
  const text = JSON.stringify(renderer.toJSON());
  assert(text.includes('Watch Ad · +2 Lives')); assert(text.includes('Watch Ad · +2 Energy'));
  assert(!text.includes('Available in'));
  await act(async () => renderer.update(React.createElement(LevelCompleteScreen, { score: 100, stars: 3, levelNumber: 1, theme,
    firstClear: true, energyRefund: 1, unlimitedEnergy: false, badgeUnlocks: ['Caramel'], isLast: false,
    isWorldBoss: false, chapter: 1, isChapterComplete: false, onNext() {}, onReplay() {}, onMenu() {} })));
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
  assert.throws(() => config({ ...values, EXPO_PUBLIC_ALLOW_TEST_ADS_IN_RELEASE: 'true' }), /disable release test ads/);
  assert.throws(() => config({ ...values, EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID: 'ca-app-pub-0000000000000000/0000000000' }), /Missing live/);
  assert.throws(() => config({ ...values, EAS_BUILD_PLATFORM: undefined }), /Missing/);
});

function adHarness(canRequestAds = true) {
  const runner = hookRunner(); const app = nativeApp(); let listener; let loads = 0;
  const ad = { addAdEventsListener(fn) { listener = fn; return () => {}; }, load() { loads++; listener({ type: 'loaded' }); }, show: async () => {} };
  const sdk = { TestIds: { REWARDED: 'test' }, AdsConsent: { gatherConsent: async () => ({ canRequestAds, privacyOptionsRequirementStatus: 'REQUIRED' }),
    getConsentInfo: async () => ({ canRequestAds, privacyOptionsRequirementStatus: 'REQUIRED' }) },
    AdsConsentPrivacyOptionsRequirementStatus: { REQUIRED: 'REQUIRED' }, default: () => ({ initialize: async () => {} }),
    RewardedAd: { createForAdRequest: () => ad }, RewardedAdEventType: { LOADED: 'loaded', EARNED_REWARD: 'earned' }, AdEventType: { CLOSED: 'closed', ERROR: 'error' } };
  const { useRewardedAd } = loader({ react: runner.react, 'react-native': { AppState: app, Platform: { OS: 'ios' }, Alert: { alert() {} } },
    '../monetization/adsSdk': { getAdsSdk: () => sdk } }, { __DEV__: true })('src/hooks/useRewardedAd.ts');
  return { runner, ad, render: () => runner.render(() => useRewardedAd()), emit: (type) => listener({ type }), loads: () => loads };
}

test('ads never load without consent permission', async () => {
  const h = adHarness(false); h.render(); await tick();
  assert.equal(h.loads(), 0); assert.equal(h.render().status, 'unavailable'); h.runner.cleanup();
});

test('ad presentation rejection settles immediately and rewards wait for close', async () => {
  const h = adHarness(); h.render(); await tick();
  let result; h.ad.show = async () => { throw new Error('presentation'); };
  h.render().showAd((value) => { result = value; }); await tick(); assert.equal(result, 'error');
  h.render(); await tick(); h.ad.show = async () => {}; result = undefined;
  h.render().showAd((value) => { result = value; }); h.emit('earned'); assert.equal(result, undefined);
  h.emit('closed'); assert.equal(result, 'watched'); h.runner.cleanup();
});

test('closing an ad without a reward settles once and never grants a late reward', async () => {
  const h = adHarness(); h.render(); await tick();
  const results = [];
  h.render().showAd((value) => results.push(value));
  h.emit('closed'); h.emit('earned'); h.emit('closed');
  assert.equal(results.join(','), 'closed');
  h.runner.cleanup();
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
  const locks = []; let energy = 5; let mounts = 0; let completionCalls = 0; let adCalls = 0; let pendingAd;
  const app = nativeApp();
  const noop = () => {};
  const asyncNoop = async () => {};
  const screen = (name) => ({ [name]: (props) => React.createElement(name, props) });
  const analytics = Object.fromEntries(['trackContinueAccepted', 'trackContinueOffer', 'configureAnalytics',
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
    './src/hooks/useRewardedAd': { useRewardedAd: () => ({ isLoaded: true, status: 'ready', showAd: (callback) => { adCalls++; pendingAd = callback; }, privacyOptionsRequired: false, openPrivacyOptions: asyncNoop }) },
    './src/hooks/usePlusPurchases': { usePlusPurchases: () => ({ busyPlanId: null, restoring: false, connected: false, storeMessage: null, storePlans: [], purchasePlan: noop, restorePurchases: noop }) },
    './src/hooks/useSaveData': { useSaveData: () => ({ loading: false, ready: true, saveError: null, retrySave: noop,
      unlockedUpTo: 0, levelStars: {}, levelHighScores: {}, totalBobas: 0, seenWorlds: [0, 1, 2, 3], soundEnabled: false,
      hapticsEnabled: false, adsRemoved: false, seenOnboarding: { app_intro: true }, energy, maxEnergy: 5, nextEnergyInMs: 0,
      recordLevelComplete: () => { completionCalls++; return { firstClear: true, energyRefund: 0, badgeUnlocks: [] }; }, markWorldSeen: noop, markOnboardingSeen: noop, updateSettings: noop,
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
  assert.equal(adCalls, 3); // one skipped ad and two successful continues
  await act(async () => renderer.unmount());
});

(async () => {
  for (const [name, fn] of tests) { await fn(); console.log(`PASS ${name}`); }
  console.log(`${tests.length} regression checks passed.`);
})().catch((error) => { console.error(error); process.exit(1); });
