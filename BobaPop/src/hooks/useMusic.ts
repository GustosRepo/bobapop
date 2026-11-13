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
let _backgrounded = false;
let _fadeTimer: ReturnType<typeof setInterval> | null = null;

// ─── Init ─────────────────────────────────────────────────────────────────────
export async function preloadMusic(): Promise<void> {
  if (Object.keys(_players).length > 0) return;
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
  if (enabled && !_backgrounded) {
    player.volume = MUSIC_VOLUME;
    player.play();
  } else {
    if (_fadeTimer !== null) { clearInterval(_fadeTimer); _fadeTimer = null; }
    Object.values(_players).forEach((item) => item.pause());
  }
}

// ─── Crossfade to a new track ─────────────────────────────────────────────────
export function playMusic(track: MusicTrack): void {
  if (track === _currentTrack) return;

  const prevTrack  = _currentTrack;
  const prevPlayer = prevTrack ? _players[prevTrack] : null;
  const nextPlayer = _players[track];
  if (!nextPlayer) return;

  // A canceled crossfade may have more than one audible player.
  for (const [name, player] of Object.entries(_players)) {
    if (name !== track && name !== prevTrack) { player.pause(); player.volume = 0; }
  }
  _currentTrack = track;

  // Cancel any in-progress fade
  if (_fadeTimer !== null) {
    clearInterval(_fadeTimer);
    _fadeTimer = null;
  }

  if (!_musicEnabled || _backgrounded) {
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
  _backgrounded = true;
  if (_fadeTimer !== null) { clearInterval(_fadeTimer); _fadeTimer = null; }
  Object.values(_players).forEach((player) => player.pause());
}

export function resumeMusic(): void {
  _backgrounded = false;
  if (!_musicEnabled) return;
  const player = _currentTrack ? _players[_currentTrack] : null;
  if (player) {
    player.volume = MUSIC_VOLUME;
    player.play();
  }
}
