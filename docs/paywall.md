# BobaPop monetization

The current implementation uses voluntary rewarded ads and auto-renewing BobaPop Plus subscriptions. [The app README](../BobaPop/README.md) contains setup and release instructions. This replaces the earlier one-time purchase and interstitial proposal.

## Current behavior

A free attempt costs one Energy and starts with three lives. Energy caps at five and refills every 15 minutes. The first clear of a level returns one Energy, up to the cap. Replays do not award another refund. A rewarded Energy ad adds up to two Energy, capped at five; the displayed offer reflects the remaining capacity.

Levels 1 through 3 offer no continues. Levels 4 and 5 offer one continue. From level 6 onward, a run offers up to two continues. Every continue grants two lives, with no added countdown. Continues preserve bricks, boss damage, and score and do not spend Energy. A skipped or failed ad does not consume the offer. Perfect three-star clears require finishing without a continue.

Plus uses `bobapop_plus_monthly` and `bobapop_plus_yearly`. Prices and eligible offers are loaded from the stores. Plus provides unlimited Energy for starts and retries, including when stored Energy is zero, and ad-free continues. The same continue limits apply. Expiration returns the player to the stored free Energy balance and its normal refill rules.

Stars advance player ranks. Bobas banked from completed levels unlock profile badge styles and are never spent. Caramel unlocks at 100 bobas, Jade at 500 bobas, Taro at 30 stars, Pearl at 60 stars, and Cosmic at 120 stars. Players equip styles in their profile; these rewards do not change gameplay.

## Store and ad setup

Store products, live AdMob IDs, applicable consent messages, and published Privacy and Terms pages must be configured in the owner's accounts. Production builds reject test IDs and release-test-ad flags. Confirm asset usage rights and complete physical-device transaction and ad tests before submission. See `npm run check:release` in the app directory.
