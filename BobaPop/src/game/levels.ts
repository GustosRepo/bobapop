import { Brick, PowerUpType } from '../game/types';
import {
  BRICK_COLS,
  BOSS_HEIGHT,
  BRICK_PADDING,
} from '../constants/gameConfig';

// Extra vertical gap pushed below the boss brick on boss levels (boss height + small gap)
const BOSS_ROW_OFFSET = BOSS_HEIGHT + BRICK_PADDING * 2;

// Grid is represented as a flat array of rows×cols.
// 0 = empty, 1 = 1hp, 2 = 2hp, 3 = 3hp
type Grid = number[][];

function buildBricks(grid: Grid, powerUpChance: number, rowOffset = 0): Omit<Brick, 'id'>[] {
  const bricks: Omit<Brick, 'id'>[] = [];
  grid.forEach((row, rIdx) => {
    row.forEach((cell, cIdx) => {
      if (cell === 0) return;
      const hasPowerUp = Math.random() < powerUpChance;
      const powerUps: PowerUpType[] = ['multi_ball', 'wide_paddle', 'sticky_paddle', 'slow_motion'];
      bricks.push({
        col: cIdx,
        row: rIdx,
        hp: cell,
        maxHp: cell,
        active: true,
        powerUp: hasPowerUp ? powerUps[Math.floor(Math.random() * powerUps.length)] : undefined,
        rowOffset,
      });
    });
  });
  return bricks;
}

export interface LevelDef {
  worldIndex: number; // 0-3
  levelInWorld: number; // 1-5
  grid: Grid;
  ballSpeed: number;
  paddleWidth: number;
  powerUpChance: number;
  isBoss: boolean;
  bossHp: number;    // 0 for non-boss levels
  bossSpeed: number; // 0 for non-boss levels
}

const _ = 0;

/* ─────────── WORLD 0: Brown Sugar ─────────── */
const bs1: Grid = [
  [1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1],
  [_,_,_,_,_,_,_],
];

const bs2: Grid = [
  [_,1,1,1,1,1,_],
  [1,1,1,1,1,1,1],
  [1,1,_,1,_,1,1],
  [_,1,1,1,1,1,_],
];

const bs3: Grid = [
  [1,_,1,_,1,_,1],
  [1,1,1,1,1,1,1],
  [2,1,2,1,2,1,2],
  [1,1,1,1,1,1,1],
];

const bs4: Grid = [
  [2,2,2,2,2,2,2],
  [1,2,1,2,1,2,1],
  [1,1,2,1,2,1,1],
  [_,1,1,2,1,1,_],
];

const bs5: Grid = [
  [3,2,1,2,1,2,3],
  [2,2,2,2,2,2,2],
  [1,2,1,2,1,2,1],
  [2,1,2,1,2,1,2],
  [1,_,1,_,1,_,1],
];

/* ─────────── WORLD 1: Matcha ─────────── */
const ma1: Grid = [
  [_,_,1,1,1,_,_],
  [_,1,1,1,1,1,_],
  [1,1,1,1,1,1,1],
  [_,1,1,1,1,1,_],
];

const ma2: Grid = [
  [1,1,_,_,_,1,1],
  [1,1,1,_,1,1,1],
  [1,1,1,1,1,1,1],
  [_,1,1,1,1,1,_],
  [_,_,1,1,1,_,_],
];

const ma3: Grid = [
  [2,_,2,_,2,_,2],
  [_,2,_,2,_,2,_],
  [2,_,2,_,2,_,2],
  [1,1,1,1,1,1,1],
];

const ma4: Grid = [
  [1,2,3,2,3,2,1],
  [2,3,2,3,2,3,2],
  [3,2,3,2,3,2,3],
  [2,1,2,1,2,1,2],
];

const ma5: Grid = [
  [3,3,3,3,3,3,3],
  [3,2,2,2,2,2,3],
  [3,2,1,_,1,2,3],
  [3,2,_,1,_,2,3],
  [3,2,1,_,1,2,3],
  [3,2,2,2,2,2,3],
];

/* ─────────── WORLD 2: Taro ─────────── */
const ta1: Grid = [
  [_,1,_,1,_,1,_],
  [1,_,1,_,1,_,1],
  [_,1,_,1,_,1,_],
  [1,1,1,1,1,1,1],
];

const ta2: Grid = [
  [_,_,1,1,1,_,_],
  [_,2,2,2,2,2,_],
  [1,2,1,2,1,2,1],
  [_,2,2,2,2,2,_],
  [_,_,1,1,1,_,_],
];

const ta3: Grid = [
  [2,2,2,_,2,2,2],
  [2,_,2,2,2,_,2],
  [2,2,_,2,_,2,2],
  [_,2,2,2,2,2,_],
  [_,_,2,2,2,_,_],
];

const ta4: Grid = [
  [3,1,3,1,3,1,3],
  [1,3,1,3,1,3,1],
  [3,1,3,1,3,1,3],
  [2,2,2,2,2,2,2],
  [1,1,1,1,1,1,1],
];

const ta5: Grid = [
  [_,3,3,3,3,3,_],
  [3,3,2,2,2,3,3],
  [3,2,3,1,3,2,3],
  [3,2,1,3,1,2,3],
  [3,2,3,1,3,2,3],
  [3,3,2,2,2,3,3],
];

/* ─────────── WORLD 3: Thai Tea ─────────── */
const tt1: Grid = [
  [1,_,1,_,1,_,1],
  [1,1,1,1,1,1,1],
  [2,1,2,1,2,1,2],
  [_,2,_,2,_,2,_],
];

const tt2: Grid = [
  [2,2,2,2,2,2,2],
  [2,1,_,1,_,1,2],
  [2,_,2,_,2,_,2],
  [2,1,_,1,_,1,2],
  [2,2,2,2,2,2,2],
];

const tt3: Grid = [
  [3,_,3,_,3,_,3],
  [_,3,_,3,_,3,_],
  [3,_,3,_,3,_,3],
  [2,2,2,2,2,2,2],
  [1,2,1,2,1,2,1],
];

const tt4: Grid = [
  [3,3,3,3,3,3,3],
  [3,2,3,2,3,2,3],
  [3,3,2,3,2,3,3],
  [2,3,3,2,3,3,2],
  [1,2,2,3,2,2,1],
  [_,1,2,2,2,1,_],
];

const tt5: Grid = [
  [3,3,3,3,3,3,3],
  [3,3,2,3,2,3,3],
  [3,2,3,2,3,2,3],
  [3,3,2,3,2,3,3],
  [2,3,3,3,3,3,2],
  [1,2,3,3,3,2,1],
  [_,1,2,2,2,1,_],
];

export const LEVELS: LevelDef[] = [
  // World 0 – Brown Sugar (easy: slow ball, wide paddle, generous power-ups)
  { worldIndex: 0, levelInWorld: 1, grid: bs1, ballSpeed: 6,    paddleWidth: 95, powerUpChance: 0.24, isBoss: false, bossHp: 0,  bossSpeed: 0   },
  { worldIndex: 0, levelInWorld: 2, grid: bs2, ballSpeed: 6.5,  paddleWidth: 93, powerUpChance: 0.23, isBoss: false, bossHp: 0,  bossSpeed: 0   },
  { worldIndex: 0, levelInWorld: 3, grid: bs3, ballSpeed: 7,    paddleWidth: 90, powerUpChance: 0.22, isBoss: false, bossHp: 0,  bossSpeed: 0   },
  { worldIndex: 0, levelInWorld: 4, grid: bs4, ballSpeed: 7.5,  paddleWidth: 88, powerUpChance: 0.21, isBoss: false, bossHp: 0,  bossSpeed: 0   },
  { worldIndex: 0, levelInWorld: 5, grid: bs5, ballSpeed: 8,    paddleWidth: 86, powerUpChance: 0.20, isBoss: true,  bossHp: 12, bossSpeed: 1.5 },
  // World 1 – Matcha (medium)
  { worldIndex: 1, levelInWorld: 1, grid: ma1, ballSpeed: 8.5,  paddleWidth: 84, powerUpChance: 0.19, isBoss: false, bossHp: 0,  bossSpeed: 0   },
  { worldIndex: 1, levelInWorld: 2, grid: ma2, ballSpeed: 9,    paddleWidth: 82, powerUpChance: 0.18, isBoss: false, bossHp: 0,  bossSpeed: 0   },
  { worldIndex: 1, levelInWorld: 3, grid: ma3, ballSpeed: 9.5,  paddleWidth: 80, powerUpChance: 0.18, isBoss: false, bossHp: 0,  bossSpeed: 0   },
  { worldIndex: 1, levelInWorld: 4, grid: ma4, ballSpeed: 10,   paddleWidth: 78, powerUpChance: 0.17, isBoss: false, bossHp: 0,  bossSpeed: 0   },
  { worldIndex: 1, levelInWorld: 5, grid: ma5, ballSpeed: 10.5, paddleWidth: 76, powerUpChance: 0.16, isBoss: true,  bossHp: 16, bossSpeed: 2.0 },
  // World 2 – Taro (hard)
  { worldIndex: 2, levelInWorld: 1, grid: ta1, ballSpeed: 11,   paddleWidth: 74, powerUpChance: 0.16, isBoss: false, bossHp: 0,  bossSpeed: 0   },
  { worldIndex: 2, levelInWorld: 2, grid: ta2, ballSpeed: 11.5, paddleWidth: 72, powerUpChance: 0.15, isBoss: false, bossHp: 0,  bossSpeed: 0   },
  { worldIndex: 2, levelInWorld: 3, grid: ta3, ballSpeed: 12,   paddleWidth: 70, powerUpChance: 0.15, isBoss: false, bossHp: 0,  bossSpeed: 0   },
  { worldIndex: 2, levelInWorld: 4, grid: ta4, ballSpeed: 12.5, paddleWidth: 68, powerUpChance: 0.14, isBoss: false, bossHp: 0,  bossSpeed: 0   },
  { worldIndex: 2, levelInWorld: 5, grid: ta5, ballSpeed: 13,   paddleWidth: 66, powerUpChance: 0.13, isBoss: true,  bossHp: 20, bossSpeed: 2.5 },
  // World 3 – Thai Tea (expert)
  { worldIndex: 3, levelInWorld: 1, grid: tt1, ballSpeed: 13,   paddleWidth: 64, powerUpChance: 0.13, isBoss: false, bossHp: 0,  bossSpeed: 0   },
  { worldIndex: 3, levelInWorld: 2, grid: tt2, ballSpeed: 13.5, paddleWidth: 62, powerUpChance: 0.12, isBoss: false, bossHp: 0,  bossSpeed: 0   },
  { worldIndex: 3, levelInWorld: 3, grid: tt3, ballSpeed: 14,   paddleWidth: 60, powerUpChance: 0.12, isBoss: false, bossHp: 0,  bossSpeed: 0   },
  { worldIndex: 3, levelInWorld: 4, grid: tt4, ballSpeed: 14,   paddleWidth: 58, powerUpChance: 0.11, isBoss: false, bossHp: 0,  bossSpeed: 0   },
  { worldIndex: 3, levelInWorld: 5, grid: tt5, ballSpeed: 14,   paddleWidth: 56, powerUpChance: 0.10, isBoss: true,  bossHp: 24, bossSpeed: 3.0 },
];

let _brickIdCounter = 0;
export function buildLevelBricks(levelIndex: number): Brick[] {
  const level = LEVELS[levelIndex];
  if (!level) return [];
  const rowOffset = level.isBoss ? BOSS_ROW_OFFSET : 0;
  return buildBricks(level.grid, level.powerUpChance, rowOffset).map((b) => ({
    ...b,
    id: `brick_${++_brickIdCounter}_${b.col}_${b.row}`,
  }));
}
