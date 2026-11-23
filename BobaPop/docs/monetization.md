# BobaPop ad monetization

## Shipping defaults

| Placement | Where it appears | Reward | Limits |
| --- | --- | --- | --- |
| Continue | Game over, starting at Level 4 | +2 lives; keep the board and score | One continue on Levels 4–5; two from Level 6 |
| Energy | Level menu, game over, and clear screen | Up to +2 Energy, with the exact available amount shown | Energy caps at five; no offer at full Energy |
| Clear Bonus | Clear screen from Level 4 | An extra copy of the Bobas earned in that clear | One claim per clear; newer clears invalidate older claims |

All ads are optional. Next Level, Replay, and Levels remain normal navigation choices. Plus has unlimited Energy and can claim continues and clear bonuses without ads. The free first-clear Energy refund is unchanged. Additional ads and larger rewards are hypotheses to measure, not guaranteed revenue improvements.

`EXPO_PUBLIC_ENERGY_AD_REWARD` and `EXPO_PUBLIC_CONTINUE_AD_LIVES` allow integers 1–3; defaults are both two. Change one value at a time after collecting a baseline. These are build-time configuration values, not a remote or randomized A/B testing system. Do not treat before/after results as a controlled experiment.

## AdMob setup

The existing live rewarded ID remains a fallback for every placement, so iOS can use the configured unit without waiting on additional account work. Create three standard **rewarded** units per supported platform for independent AdMob reporting:

- `EXPO_PUBLIC_ADMOB_CONTINUE_IOS_UNIT_ID` and `EXPO_PUBLIC_ADMOB_CONTINUE_ANDROID_UNIT_ID`
- `EXPO_PUBLIC_ADMOB_ENERGY_IOS_UNIT_ID` and `EXPO_PUBLIC_ADMOB_ENERGY_ANDROID_UNIT_ID`
- `EXPO_PUBLIC_ADMOB_CLEAR_BONUS_IOS_UNIT_ID` and `EXPO_PUBLIC_ADMOB_CLEAR_BONUS_ANDROID_UNIT_ID`

Use the app's own publisher account. IDs must come from AdMob; iOS and Android IDs are separate. Leave both release test-ad flags false. Production rejects missing effective units, test IDs, placeholders, and publisher mismatches. Check the same public values used in EAS production:

```sh
npm run check:ads -- ios
npm run check:ads -- android
```

This checks local values, not EAS or AdMob account state. Warnings identify shared-unit reporting and an unconfigured custom analytics collector. Missing real delivery IDs fail the check. The local iOS configuration can use the existing fallback; the local Android placeholder must be replaced before Android release.

In AdMob, enable [impression-level ad revenue](https://developers.google.com/admob/ios/impression-level-ad-revenue). Configure GDPR, applicable US-state privacy messages, and the IDFA explainer/ATT message under Privacy & messaging. UMP handles the configured consent and ATT flow. The app checks `canRequestAds` before initializing/loading and lets the SDK use the stored privacy choices to choose its serving mode. `canRequestAds` is not interpreted as permission to personalize. The Expo plugin includes the ATT usage description and Google's current SKAdNetwork buyer identifiers; native binaries must be rebuilt for these settings to take effect.

The [live app-ads.txt](https://www.code-werx.com/app-ads.txt) includes the publisher from the [repository copy](../public/app-ads.txt). The non-`www` URL redirects to the live file. Use `https://www.code-werx.com/` as the developer website in the store listing, and verify the crawler status in AdMob. Preserve existing sellers and add each mediated network's required entries. [Google's setup instructions](https://support.google.com/admob/answer/9363762?hl=en)

## Mediation

Mediation is **not enabled** by this change. It requires network accounts, bidding agreements, AdMob mappings, compatible native adapters, and verified privacy propagation. No account integration was available in this workspace to do that setup. Merely adding network names to JavaScript would not create competing demand.

After baseline collection, start with one additional rewarded bidding source supported in the app's primary countries, then compare against Google-only traffic with an AdMob mediation experiment where available. Unity is a candidate, not a preselected enabled source. Follow the [library's mediation guide](https://docs.page/invertase/react-native-google-mobile-ads/mediation) and the source's current Google integration guide. This app currently pins Google Mobile Ads iOS 13.1.0 and Android 25.0.0 through react-native-google-mobile-ads 16.3.3. Newest adapter versions can require newer native SDKs: select compatible versions and implement that source's GDPR and US opt-out propagation before enabling it. Include native adapters through Expo configuration so they survive prebuild; generated ios/android changes alone are not durable.

Use Ad Inspector on registered test devices to verify each source and each rewarded unit. Do not click production ads to test them. Review fill and revenue by country and platform before changing floors. A high floor can reduce fill and total earnings.

## Measurement

AdMob is the initial source of truth for revenue. App-side custom analytics remains off unless an actual HTTPS event collector is configured in `EXPO_PUBLIC_ANALYTICS_ENDPOINT`; no collector or dashboard has been deployed by this change. The endpoint must accept an individual JSON event per POST, persist/deduplicate its `id`, and return a 2xx response after acceptance. Offline or failed uploads use a bounded local retry queue. A locally generated installation identifier is created only when custom analytics is configured; it permits retention analysis without IDFA. Update the app's published privacy disclosures to describe the configured collection.

Events include `id`, `name`, `createdAt`, `sessionId`, `installationId`, and `params`. Every event has `platform` and `reward_policy`; ad events also have `placement`, `ad_format`, and `ad_platform`. Show/revenue/result events carry the source screen and offered reward. Paid-event values from this SDK are already in currency units on both platforms: **do not divide them by one million again**. Preserve `currency` and `precision`; convert currencies before aggregating them. Test ads are not evidence of real revenue. Reward-grant events with `plus_active: true` are ad-free benefits, not ad impressions.

| Event | Meaning |
| --- | --- |
| `session_start`, `session_foreground`, `session_background` | Play-session and activity boundaries |
| `ad_offer_shown` | A screen renders an eligible, loaded rewarded offer; once per screen/offer balance |
| `ad_request`, `ad_loaded`, `ad_load_failed` | Request, successful availability, or failure with error code and retry delay |
| `ad_show_requested`, `ad_opened` | Opt-in attempt and actual SDK presentation |
| `ad_revenue` | One paid callback per shown ad, with value, currency, precision, unit, placement, and source |
| `ad_result` | Watched, closed, unavailable, timeout, or error |
| `ad_reward_granted` | The actual lives, Energy, or Bobas granted |

Offers are screen-render events, not pixel-viewability measurements: a long, scrolled screen may contain an offer below the visible region. Use SDK paid callbacks and AdMob reporting for monetized impressions.

Compare request availability, show-to-open rate, completion rate, impressions per free daily active user, revenue per daily active user, and D1/D7 retention by platform, country, source screen, and policy. Track subscription conversion and net store revenue alongside ad revenue. The optimization target is total net lifetime revenue per player. Account for ad-driven background transitions when interpreting session activity; they do not necessarily mean the player left. Store financial reports remain the source of truth for subscription revenue.

## Device verification before release

Automated tests cover timeout recovery, stale caches, foreground behavior, one-at-a-time presentation, paid-event deduplication, close/reward event ordering, skipped ads, save migration, and exactly-once bonus claims. They cannot verify account-side fill, actual payout, consent forms, or native adapters.

On fresh physical-device builds, test all three placements with registered test devices: consent accept/deny, consent refresh failure, ATT allow/deny, no fill/offline, completion, early close, repeated taps, background/foreground, and cached ads after an hour. Verify Plus opens no ads and receives the advertised benefits. Check bonus badge unlocks and save/restart behavior. Confirm navigation remains usable when ads are unavailable. Exporting JavaScript bundles does not compile or validate native ad SDKs.
