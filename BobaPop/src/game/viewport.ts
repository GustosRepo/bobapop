import { GAME_HEIGHT, GAME_WIDTH } from '../constants/gameConfig';

export interface ViewInsets { top: number; right: number; bottom: number; left: number }

/** Keep simulation coordinates and proportions unchanged as the app window resizes. */
export function fitGameViewport(width: number, height: number, insets: ViewInsets) {
  const availableWidth = Math.max(0, width - insets.left - insets.right);
  const availableHeight = Math.max(0, height - insets.top - insets.bottom);
  // Give controls their own column when a wide window would make the board too short.
  const hudBesideBoard = availableWidth >= 300 && availableWidth / Math.max(1, availableHeight) >= 0.85;
  const controlWidth = hudBesideBoard ? Math.min(240, availableWidth * 0.38) : 0;
  const boardSpace = availableWidth - controlWidth;
  const scale = Math.min(boardSpace / GAME_WIDTH, availableHeight / GAME_HEIGHT);
  const left = insets.left + controlWidth + (boardSpace - GAME_WIDTH * scale) / 2;
  const top = insets.top + (availableHeight - GAME_HEIGHT * scale) / 2;
  return {
    left,
    top,
    width: GAME_WIDTH * scale,
    height: GAME_HEIGHT * scale,
    scale,
    hudBesideBoard,
    hudLeft: hudBesideBoard ? insets.left : left,
    hudTop: hudBesideBoard ? insets.top + 16 : top,
    hudWidth: hudBesideBoard ? controlWidth : GAME_WIDTH * scale,
  };
}

export function paddleXFromWindow(pageX: number, windowLeft: number, viewport: ReturnType<typeof fitGameViewport>) {
  if (viewport.scale <= 0) return GAME_WIDTH / 2;
  return Math.max(0, Math.min(GAME_WIDTH, (pageX - windowLeft - viewport.left) / viewport.scale));
}
