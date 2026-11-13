# BobaPop

BobaPop is a React Native and Expo brick breaker with 40 levels across four worlds and two chapters. The mobile app supports rewarded ads and monthly or yearly BobaPop Plus subscriptions. The browser build supports gameplay and local progress; billing and ads are available in the native apps.

## Development

Use Node 22.20 or newer and npm. This project uses Expo SDK 58, React 19.3, and React Native 0.88. Native dependencies require a fresh development build after an SDK upgrade.

```sh
npm ci
cp .env.example .env
npm start
npm run web
```

For native development use `npm run ios` with full Xcode, or `npm run android` with the Android SDK. Expo Go does not provide this project's native purchase and advertising modules. EAS development builds are another option. Generated `ios` and `android` projects are ignored by Git; `app.config.js` is the source of native configuration.

Controls: tap and drag to move the paddle and launch. On web, use the arrow keys to move, Space to launch, and Escape to pause. Accessible paddle actions support moving left, moving right, and launching. Gameplay pauses when the app becomes inactive and requires an explicit resume. Power-up duration advances only while playing.

## Verification

```sh
npm run preflight
npx expo-doctor
npx expo export --platform all
```

Preflight includes TypeScript, level generation, save migrations, gameplay and integration regressions, and the dependency security audit. CI also exports iOS, Android, and web bundles. Bundle export validates JavaScript and assets; native compilation and store transactions require their respective development environments.

The `@expo/fingerprint` override selects patched `minimatch` 11.0.1 or newer. Keep the override scoped to fingerprint and recheck its necessity when upgrading Expo.

## Purchases and advertising

Create `bobapop_plus_monthly` and `bobapop_plus_yearly` subscriptions in the stores. Prices come from the current store offer; unavailable products cannot be purchased. Plus provides unlimited Energy for starts and retries, plus ad-free continues. A free attempt costs one Energy and starts with three lives. The first clear of each level returns one Energy, capped at five; replays do not earn another refund. A rewarded Energy ad grants up to two Energy, capped at five.

Set live AdMob application and rewarded unit IDs in the EAS production environment. Disable both release-test-ad flags. Development uses test ads automatically; preview builds can explicitly opt into them. Production configuration rejects missing, placeholder, or Google test IDs. Android IDs must come from the owner's AdMob account; they cannot be inferred from the iOS IDs.

Configure applicable privacy messages in AdMob Privacy & messaging. The app delays ad measurement, gathers consent before requesting ads, and exposes required privacy choices in Settings. Verify the configured forms and audience settings on physical devices, including consent denial and consent-update failures. Privacy and Terms links must resolve to the owner's published policies.

An optional HTTPS `EXPO_PUBLIC_ANALYTICS_ENDPOINT` receives individual events with unique IDs. Deduplicate IDs server-side because failed uploads can be retried. Without an endpoint, analytics is disabled. The error boundary reports render failures through the same transport when configured; native crash collection requires a separate service.

## Release

```sh
npm run check:release -- ios
npm run check:release -- android
```

These commands read local environment values; they do not fetch EAS account settings. Supply the same public values as the EAS production environment when checking locally. The release check also requires the asset-rights records in `assets/licenses.json`. Record the original source or ownership evidence, usage terms, and owner confirmation for each matching SHA-256 asset. Source filenames alone are not proof of a license.

Before submitting a release, build fresh native binaries and verify purchase, cancellation, restore, expiration, ad reward, ad dismissal, background/resume, small screens, and large text on devices. Native projects were regenerated for SDK 58; full Xcode is required to compile iOS. SDK 58 targets iOS 16.4 and newer. Do not reuse an SDK 55 binary with this source.

## Campaign

Chapter 1 keeps the original 20 levels and their IDs. Chapter 2 adds levels 21–40: 16 new layouts and four boss rematches, with named stages and guaranteed power-ups. Each world has a five-level row for each chapter. Finish level 20 to start Chapter 2; saves that already completed it unlock level 21 automatically. There are 120 stars to collect, with player ranks extending to Boba Grandmaster.

## Rewards

Continues preserve the current board and score. Levels 1–3 have no continues, levels 4–5 allow one, and levels 6–40 allow two per run. Each continue grants two lives with no added countdown. Free players opt into an ad; Plus players continue without ads. A skipped or failed ad does not consume a continue. Three lives plus two continues give at most seven lives per run. Perfect three-star clears still require finishing without a continue.

Stars advance player ranks. Bobas are banked when a level is cleared and are never spent. Profile badge styles unlock at 100 bobas (Caramel), 500 bobas (Jade), 30 stars (Taro), 60 stars (Pearl), and 120 stars (Cosmic). Equip an unlocked style in the player statistics panel. These styles change appearance only.

## Progress storage

Save version 10 preserves the original storage key and migrates older progress. Writes are serialized and maintain a recent backup. Entitlement updates arriving during loading merge into the loaded save. Badge selection migrates from older saves to Classic; existing stars and bobas immediately qualify for their earned styles. Invalid fields are repaired; a future-version save or unreadable primary with no valid backup is kept intact and offers Retry. Never clear user storage as an upgrade step.
