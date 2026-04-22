import { createAudioPlayer, AudioPlayer } from 'expo-audio';

// ─── Music tracks ─────────────────────────────────────────────────────────────
export type MusicTrack = 'menu' | 'game' | 'boss' | 'gameover';

const MUSIC_ASSETS: Record<MusicTrack, ReturnType<typeof require>> = {
  menu:     require('../../assets/sounds/djartmusic-so-happy-with-my-8-bit-game-301275.mp3'),
  game:     require('../../assets/sounds/moodmode-game-8-bit-on-278083.mp3'),
  boss:     require('../../assets/sounds/inono777-game-8-bit-399898.mp3'),
  gameover: require('../../assets/sounds/djartmusic-i-love-my-8-bit-game-console-301272.mp3'),
};

const LOOPING_TRACKS = new Set<MusicTrack>(['menu', 'game', 'boss']);
const MUSIC_VOLUME = 0.35;
const FADE_STEPS  = 20;
const FADE_MS     = 600; // total crossfade duration

// ─── Module-level state ───────────────────────────────────────────────────────
let _players: Partial<Record<MusicTrack, AudioPlayer>> = {};
let _currentTrack: MusicTrack | null = null;
let _musicEnabled = true;
let _fadeTimer: ReturnType<typeof setInterval> | null = null;

// ─── Init ─────────────────────────────────────────────────────────────────────
export async function preloadMusic(): Promise<void> {
  await Promise.all(
    (Object.keys(MUSIC_ASSETS) as MusicTrack[]).map((track) => {
      const player = createAudioPlayer(MUSIC_ASSETS[track]);
      player.loop = LOOPING_TRACKS.has(track);
      player.volume = 0;
      _players[track] = player;
    }),
  );
}

// ─── Enable / disable (mirrors the sound toggle) ─────────────────────────────
export function setMusicEnabled(enabled: boolean): void {
  _musicEnabled = enabled;
  const player = _currentTrack ? _players[_currentTrack] : null;
  if (!player) return;
  if (enabled) {
    player.volume = MUSIC_VOLUME;
    player.play();
  } else {
    player.pause();
  }
}

// ─── Crossfade to a new track ─────────────────────────────────────────────────
export function playMusic(track: MusicTrack): void {
  if (track === _currentTrack) return;

  const prevTrack  = _currentTrack;
  const prevPlayer = prevTrack ? _players[prevTrack] : null;
  const nextPlayer = _players[track];
  if (!nextPlayer) return;

  _currentTrack = track;

  // Cancel any in-progress fade
  if (_fadeTimer !== null) {
    clearInterval(_fadeTimer);
    _fadeTimer = null;
  }

  if (!_musicEnabled) {
    // Just swap silently so state is correct for when music re-enables
    if (prevPlayer) prevPlayer.pause();
    nextPlayer.seekTo(0);
    return;
  }

  // Start new track silently at position 0
  nextPlayer.seekTo(0);
  nextPlayer.volume = 0;
  nextPlayer.play();

  let step = 0;
  const stepMs = FADE_MS / FADE_STEPS;

  _fadeTimer = setInterval(() => {
    step++;
    const t = step / FADE_STEPS;

    if (prevPlayer) {
      prevPlayer.volume = Math.max(0, MUSIC_VOLUME * (1 - t));
      if (step >= FADE_STEPS) prevPlayer.pause();
    }

    nextPlayer.volume = Math.min(MUSIC_VOLUME, MUSIC_VOLUME * t);

    if (step >= FADE_STEPS) {
      clearInterval(_fadeTimer!);
      _fadeTimer = null;
      nextPlayer.volume = MUSIC_VOLUME;
    }
  }, stepMs);
}

// ─── Pause / resume (for app backgrounding) ───────────────────────────────────
export function pauseMusic(): void {
  const player = _currentTrack ? _players[_currentTrack] : null;
  player?.pause();
}

export function resumeMusic(): void {
  if (!_musicEnabled) return;
  const player = _currentTrack ? _players[_currentTrack] : null;
  if (player) {
    player.volume = MUSIC_VOLUME;
    player.play();
  }
}
