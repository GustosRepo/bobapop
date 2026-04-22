import { useCallback } from 'react';
import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio';

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

// ─────────────────────────────────────────────────────────────────────────────
const SOUND_ASSETS: Record<SoundEvent, ReturnType<typeof require>> = {
  brick_hit:        require('../../assets/sounds/soundreality-pop-423717.mp3'),
  brick_destroy:    require('../../assets/sounds/dragon-studio-pop-402324.mp3'),
  paddle_hit:       require('../../assets/sounds/47313572-ui-pop-sound-316482.mp3'),
  boss_hit:         require('../../assets/sounds/freesound_community-brick-dropped-on-other-bricks-14722.mp3'),
  boss_defeat:      require('../../assets/sounds/freesound_community-shooting-star-2-104073.mp3'),
  life_lost:        require('../../assets/sounds/freesound_community-080205_life-lost-game-over-89697.mp3'),
  power_up_collect: require('../../assets/sounds/ribhavagrawal-power-up-type-1-230548.mp3'),
  game_won:         require('../../assets/sounds/freesound_community-shooting-star-2-104073.mp3'),
  game_lost:        require('../../assets/sounds/freesound_community-080205_life-lost-game-over-89697.mp3'),
  level_tap:        require('../../assets/sounds/lucadialessandro-tap-notification-180637.mp3'),
  level_unlock_tap: require('../../assets/sounds/ribhavagrawal-power-up-type-1-230548.mp3'),
  countdown_tick:   require('../../assets/sounds/freesound_community-countdown-beep-104007.mp3'),
  star_earn:        require('../../assets/sounds/freesound_community-shooting-star-2-104073.mp3'),
  world_intro:      require('../../assets/sounds/ribhavagrawal-power-up-type-1-230548.mp3'),
};

let _soundPool: Partial<Record<SoundEvent, AudioPlayer>> = {};
export async function preloadSounds() {
  await setAudioModeAsync({ playsInSilentMode: true });
  await Promise.all(
    (Object.keys(SOUND_ASSETS) as SoundEvent[]).map(async (key) => {
      const player = createAudioPlayer(SOUND_ASSETS[key]);
      _soundPool[key] = player;
    }),
  );
}
// ─────────────────────────────────────────────────────────────────────────────

// Global flags — set from App.tsx after settings load
export let _soundEnabled = true;
export let _hapticsEnabled = true;
export function setSoundEnabled(v: boolean) { _soundEnabled = v; }
export function setHapticsEnabled(v: boolean) { _hapticsEnabled = v; }

export function useSound() {
  const playSound = useCallback((event: SoundEvent) => {
    if (!_soundEnabled) return;
    if (__DEV__) console.log(`[Sound] ${event}`);
    const player = _soundPool[event];
    if (player) {
      player.seekTo(0);
      player.play();
    }
  }, []);

  return { playSound };
}
