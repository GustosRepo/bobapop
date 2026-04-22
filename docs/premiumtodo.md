# BobaPop — Premium Polish TODO

Priority order based on impact vs effort.

---

## 🔴 Priority 1 — Feel & Juice ✅ DONE

- [x] **Haptic feedback** — all 8 events, de-duped per frame
- [x] **Screen shake on boss hit** — 4px/2 oscillations on hit, 10px/5 on defeat
- [x] **Ball trail** — 4-frame ring buffer, opacity 45%→11%, scale 90%→45%
- [x] **Brick crack animation** — white 65% overlay 120ms on HP drop
- [x] **Power-up brick pulse/glow** — sine scale + gold `#F5C542` border/shadow

---

## 🟠 Priority 2 — Progression & Retention ✅ DONE

- [x] **Persistent high scores per level** — save data v3, shown on LevelCard below stars
- [x] **Total boba counter** — accumulated in save data, shown in LevelSelect header
- [x] **World intro splash** — first-time animated modal per world, tracked in `seenWorlds`

---

## 🟡 Priority 3 — Audio ⏳ PENDING (needs sound files)

> Infrastructure is fully wired. All 14 events are typed in `useSound.ts`, `SOUND_ASSETS` map is ready to uncomment, and `useGameLoop.ts` already calls `playSound()` alongside every haptic event.
>
> **To activate:** drop MP3s into `src/assets/sounds/` then uncomment the 3 blocks in `useSound.ts`.

- [ ] **Brick hit sound** (`brick_hit.mp3`) — different pitch per HP remaining
- [ ] **Brick destroy sound** (`brick_destroy.mp3`)
- [ ] **Ball bounce sounds** — `paddle_hit.mp3`
- [ ] **Power-up collect chime** (`power_up.mp3`)
- [ ] **Boss hit sound** (`boss_hit.mp3`)
- [ ] **Boss defeat fanfare** (`boss_defeat.mp3`)
- [ ] **Life lost sound** (`life_lost.mp3`)
- [ ] **Win / lose stings** (`game_won.mp3`, `game_lost.mp3`)
- [ ] **UI sounds** — `tap.mp3`, `unlock.mp3`, `tick.mp3`, `star.mp3`, `world_intro.mp3`
- [ ] **Background music loop** — one per world (4 tracks total, wire separately)

---

## 🟢 Priority 4 — Polish & Professionalism ✅ DONE

- [x] **Loading splash screen** — mascot + "BobaPop" + "by CODEWERX LLC" on cold start
- [x] **Screen transition animations** — 180ms fade out → swap → 220ms fade in
- [x] **Countdown before level starts** — 3 → 2 → 1 → GO! overlay, blocks input during count
- [x] **Boss enrage visual effect** — 500ms red flash on enrage + continuous sine red tint
- [x] **Star earn animation on level complete** — staggered spring pop-in, gold vs dim

---

## 💡 Future / Stretch

- [ ] ~~Online leaderboard~~ — skipped (out of scope)
- [ ] Daily challenge level
- [ ] Unlockable paddle skins
- [ ] Achievement system ("Pop 100 boba", "First boss defeated", etc.)
- [ ] iPad / landscape layout support

---

## 🚀 Before Shipping

- [ ] Set `DEV_UNLOCK_ALL = false` in `App.tsx`
- [ ] Drop sound files + uncomment audio in `useSound.ts`


## later

Very hard / changes core game model (30-60+ hours):

Shop system (buying power-ups, lives, cosmetics)
Energy system (hearts/stamina limiting play sessions)
Skins (unlockable paddle/ball variants with preview)
Events (daily challenges, time-limited modes)
Ranking/Leaderboards (requires backend)
Currency system (coins, gems, multiple currencies)
Bottom nav with 5 tabs (would need to build 4+ new full screens)
Daily missions (quest system with rewards)
Friends/Social (requires accounts + backend )