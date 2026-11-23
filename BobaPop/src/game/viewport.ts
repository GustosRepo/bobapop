import { GAME_HEIGHT, GAME_WIDTH } from '../constants/gameConfig';

export interface ViewInsets { top: number; right: number; bottom: number; left: number }

/** Keep simulation coordinates and proportions unchanged as the app window resizes. */
export function fitGameViewport(width: number, height: number, insets: ViewInsets) {
  const availableWidth = Math.max(0, width - insets.left - insets.right);
  const availableHeight = Math.max(0, height - insets.top - insets.bottom);
  const hudBesideBoard = availableWidth >= 400 && availableHeight >= 240 && availableWidth / availableHeight >= 0.85;
  const panelWidth = hudBesideBoard ? Math.min(176, availableWidth * 0.34) : 0;
  const panelGap = hudBesideBoard ? 16 : 0;
  const boardSpace = availableWidth - panelWidth - panelGap;
  const scale = Math.min(boardSpace / GAME_WIDTH, availableHeight / GAME_HEIGHT);
  const boardWidth = GAME_WIDTH * scale;
  const groupWidth = panelWidth + panelGap + boardWidth;
  const groupLeft = Math.max(insets.left, Math.min((width - groupWidth) / 2, insets.left + availableWidth - groupWidth));
  const left = groupLeft + panelWidth + panelGap;
  const top = insets.top + (availableHeight - GAME_HEIGHT * scale) / 2;
  return {
    left,
    top,
    width: boardWidth,
    height: GAME_HEIGHT * scale,
    scale,
    hudBesideBoard,
    hudLeft: groupLeft,
    hudTop: hudBesideBoard ? top + Math.min(24, availableHeight * 0.04) : top,
    hudWidth: hudBesideBoard ? panelWidth : boardWidth,
  };
}

export function paddleXFromWindow(pageX: number, windowLeft: number, viewport: ReturnType<typeof fitGameViewport>) {
  if (viewport.scale <= 0) return GAME_WIDTH / 2;
  return Math.max(0, Math.min(GAME_WIDTH, (pageX - windowLeft - viewport.left) / viewport.scale));
}
