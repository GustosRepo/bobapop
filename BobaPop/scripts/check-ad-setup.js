process.env.NODE_ENV ||= 'production';
require('@expo/env').load(process.cwd());
const platform = process.argv[2];
if (platform && !['ios', 'android'].includes(platform)) throw new Error('Use check:ads -- ios or android.');
const failures = [];
const notes = [];
const live = (id, separator) => new RegExp(`^ca-app-pub-\\d+${separator}\\d+$`).test(id || '')
  && !/3940256099942544|0000000000000000/.test(id);
for (const target of platform ? [platform] : ['ios', 'android']) {
  const suffix = target.toUpperCase();
  const app = process.env[`EXPO_PUBLIC_ADMOB_${suffix}_APP_ID`];
  if (!live(app, '~')) failures.push(`${target}: set a live EXPO_PUBLIC_ADMOB_${suffix}_APP_ID.`);
  const units = ['CONTINUE', 'ENERGY', 'CLEAR_BONUS'].map((placement) => {
    const specific = process.env[`EXPO_PUBLIC_ADMOB_${placement}_${suffix}_UNIT_ID`];
    const unit = specific || process.env[`EXPO_PUBLIC_ADMOB_REWARDED_${suffix}_UNIT_ID`];
    if (!live(unit, '/')) failures.push(`${target} ${placement}: set a live rewarded-unit ID.`);
    else if (app && unit.split('/')[0] !== app.split('~')[0]) failures.push(`${target} ${placement}: publisher must match the app ID.`);
    if (!specific) notes.push(`${target} ${placement}: using the shared rewarded unit; set a separate unit for placement reporting in AdMob.`);
    return unit;
  });
  if (new Set(units.filter(Boolean)).size < 3) notes.push(`${target}: AdMob reports combine placements until three distinct rewarded units are configured.`);
}
if (process.env.EXPO_PUBLIC_ALLOW_TEST_ADS_IN_RELEASE === 'true' || process.env.EXPO_PUBLIC_ADMOB_USE_TEST_ADS === 'true') failures.push('Disable both release test-ad flags.');
const endpoint = process.env.EXPO_PUBLIC_ANALYTICS_ENDPOINT;
if (!endpoint) notes.push('Custom analytics is off. AdMob reporting still works; configure an HTTPS event collector for in-app funnels and retention.');
else {
  try { if (new URL(endpoint).protocol !== 'https:') throw new Error(); }
  catch { failures.push('EXPO_PUBLIC_ANALYTICS_ENDPOINT must be a valid HTTPS URL.'); }
}
for (const name of ['EXPO_PUBLIC_ENERGY_AD_REWARD', 'EXPO_PUBLIC_CONTINUE_AD_LIVES']) {
  if (process.env[name] && !/^[1-3]$/.test(process.env[name])) failures.push(`${name} must be 1, 2, or 3.`);
}
notes.push('Account checks: enable impression-level revenue, configure UMP/IDFA messages, verify app-ads.txt and physical-device ads. Mediation requires network accounts, compatible native adapters, and privacy-signal verification.');
notes.forEach(note => console.log(`NOTE ${note}`));
failures.forEach(failure => console.error(`FAIL ${failure}`));
if (failures.length) process.exitCode = 1;
else console.log('Ad delivery configuration passed. Account-side settings still require verification.');
