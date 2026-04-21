import { useCallback } from 'react';
// import { Audio } from 'expo-av';  // uncomment when adding real audio

// ─── All sound events in the game ─────────────────────────────────────────────
export type SoundEvent =
  // Game loop events (fired from useGameLoop alongside haptics)
  | 'brick_hit'
  | 'brick_destroy'
  | 'paddle_hit'
  | 'boss_hit'
  | 'boss_defeat'
  | 'life_lost'
  | 'power_up_collect'
  | 'game_won'
  | 'game_lost'
  // UI events
  | 'level_tap'
  | 'level_unlock_tap'
  | 'countdown_tick'
  | 'star_earn'
  | 'world_intro';

// ─── Drop MP3 files in src/assets/sounds/ then uncomment ──────────────────────
// const SOUND_ASSETS: Record<SoundEvent, ReturnType<typeof require>> = {
//   brick_hit:         require('../assets/sounds/brick_hit.mp3'),
//   brick_destroy:     require('../assets/sounds/brick_destroy.mp3'),
//   paddle_hit:        require('../assets/sounds/paddle_hit.mp3'),
//   boss_hit:          require('../assets/sounds/boss_hit.mp3'),
//   boss_defeat:       require('../assets/sounds/boss_defeat.mp3'),
//   life_lost:         require('../assets/sounds/life_lost.mp3'),
//   power_up_collect:  require('../assets/sounds/power_up.mp3'),
//   game_won:          require('../assets/sounds/game_won.mp3'),
//   game_lost:         require('../assets/sounds/game_lost.mp3'),
//   level_tap:         require('../assets/sounds/tap.mp3'),
//   level_unlock_tap:  require('../assets/sounds/unlock.mp3'),
//   countdown_tick:    require('../assets/sounds/tick.mp3'),
//   star_earn:         require('../assets/sounds/star.mp3'),
//   world_intro:       require('../assets/sounds/world_intro.mp3'),
// };
//
// // Preload all sounds at app start for instant playback
// let _soundPool: Partial<Record<SoundEvent, Audio.Sound>> = {};
// export async function preloadSounds() {
//   await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
//   await Promise.all(
//     (Object.keys(SOUND_ASSETS) as SoundEvent[]).map(async (key) => {
//       const { sound } = await Audio.Sound.createAsync(SOUND_ASSETS[key]);
//       _soundPool[key] = sound;
//     }),
//   );
// }
// ─────────────────────────────────────────────────────────────────────────────

export function useSound() {
  const playSound = useCallback((_event: SoundEvent) => {
    if (__DEV__) console.log(`[Sound] ${_event}`);
    // When sound files are ready, swap this body:
    // const sound = _soundPool[_event];
    // if (sound) {
    //   sound.setPositionAsync(0).then(() => sound.playAsync()).catch(() => {});
    // }
  }, []);

  return { playSound };
}
