# BobaPop — Monetization Game Plan

## Stack Overview
- **Rewarded Ads** (Google AdMob) — primary revenue driver
- **Remove Ads IAP** ($2.99 one-time) — required by App Store if showing ads
- **Interstitial Ads** — passive income, capped to avoid retention damage
- No life timers — too punishing for casual audience

---

## Priority Order

### Phase 1 — Rewarded Ads (do first)
- [ ] Install `react-native-google-mobile-ads`
- [ ] Add AdMob App ID to `app.json`
- [ ] Create rewarded ad unit in AdMob dashboard
- [ ] "Continue?" screen after game over — watch ad → +2 lives, resume level
- [ ] Cap: 1 rewarded ad per game over (no infinite continues)
- [ ] Preload rewarded ad when GameScreen mounts

### Phase 2 — Remove Ads IAP
- [ ] Install `expo-iap` or `react-native-purchases` (RevenueCat recommended)
- [ ] Create "Remove Ads" product in App Store Connect ($2.99)
- [ ] Persist `adsRemoved: boolean` in SaveData (add to v5 migration)
- [ ] If `adsRemoved`, skip all interstitials (rewarded ads stay — user-initiated)
- [ ] Add "Remove Ads" button to SettingsModal

### Phase 3 — Interstitial Ads
- [ ] Show after every 3 level completions (not on boss levels)
- [ ] Track `levelsSinceAd` counter in App.tsx state
- [ ] Skip entirely if `adsRemoved = true`
- [ ] Never show back-to-back with a rewarded ad

### Phase 4 — Cosmetic IAPs (future)
- [ ] Boba skin packs (ball skins, paddle skins)
- [ ] Only after player base established — low priority

---

## Ad Network
**Google AdMob** — primary choice
- SDK: `react-native-google-mobile-ads`
- Docs: https://docs.page/invertase/react-native-google-mobile-ads
- Needs: AdMob account, iOS App ID, ad unit IDs (rewarded + interstitial)

**RevenueCat** — recommended for IAP
- Handles receipt validation, restores, sandbox testing
- SDK: `react-native-purchases`
- Docs: https://www.revenuecat.com/docs/getting-started

---

## Key Rules (App Store Compliance)
- Rewarded ads must ALWAYS be voluntary — never forced
- Must offer "Remove Ads" if showing interstitials
- Ads must never cover gameplay or UI controls
- Interstitials must be skippable after 5 seconds
- No ads targeting children (COPPA) — add `tagForChildDirectedTreatment` flag

---

## Game Over "Continue" Flow (UX)
```
Game Over
    ↓
"Watch an ad to continue?" [Watch Ad] [No Thanks]
    ↓                           ↓
Skip → GameOverScreen    Rewarded ad plays
                              ↓
                         +2 lives, resume level from current state
                         (1 continue per level max)
```

---

## SaveData Changes Needed (v5)
```ts
adsRemoved: boolean   // unlocked via IAP
```
Migration: v4 → v5 adds `{ adsRemoved: false }`

---

## Revenue Estimates (rough, casual game)
| Source | CPM / conversion | Notes |
|---|---|---|
| Rewarded ads | ~$8–15 CPM | Highest paying format |
| Interstitials | ~$3–6 CPM | Volume play |
| Remove Ads IAP | ~5–10% of DAU | Power users |
