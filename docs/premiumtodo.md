# BobaPop release status

[The app README](../BobaPop/README.md) is the current development and release guide. The source implements audio, effects, versioned progress, Energy, rewarded continues, and native Plus subscriptions.

## Implemented

- Version 10 save validation, loading protection, serialized writes, backups, and visible retry handling.
- Collision substeps and separation; level-speed preservation after losing a life; power-ups timed using gameplay time.
- Pause on app inactivity, explicit resume, guarded restart, and settings-aware haptics.
- Consent-gated rewarded ads, immediate presentation-error handling, and privacy choices in Settings.
- Store-loaded offers, guarded purchases, restore, foreground verification, cached iOS expiry handling, and unlimited Plus Energy.
- Safe-area layout, scrollable result and purchase screens, reduced-motion support, accessibility actions, and web keyboard controls.
- Expo SDK 58, browser gameplay, regression checks, dependency auditing, and CI bundle exports.

## Rewards balance

First clears return entry Energy once. Rewarded Energy ads grant up to two Energy, capped at five. Each eligible continue grants two lives with a two-continue limit from Level 6 and no added countdown. Stars and banked bobas unlock equipable profile badge styles. Plus provides unlimited starts and retries and ad-free continues with the same limits.

## Required external verification

- Configure and verify store products, live AdMob IDs, consent messages, and published policy URLs in the owner's accounts.
- Confirm source and usage rights for the assets recorded in `BobaPop/assets/licenses.json`.
- Compile new native binaries and test purchases, restores, expiration, rewarded ads, interruptions, small screens, and large text on devices.

## Future product work

Daily challenges, achievements, skins, additional worlds, iPad layouts, and online leaderboards remain separate product features. The current paywall makes no promise of future cosmetics. Use reliable completion, failure, continue, and Energy data before changing difficulty or monetization.
