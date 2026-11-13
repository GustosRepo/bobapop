const assert = require('node:assert/strict');
const { loader } = require('./test-helpers.cjs');
const load = loader();
const { LEVELS, buildLevelBricks } = load('src/game/levels.ts');
const { brickRect } = load('src/game/physics.ts');
const { GAME_WIDTH, BALL_SPEED_MAX, BOSS_Y, BOSS_HEIGHT } = load('src/constants/gameConfig.ts');
assert.equal(LEVELS.length, 40);
assert.equal(new Set(LEVELS.map((level) => level.id)).size, LEVELS.length);
for (let world = 0; world < 4; world++) {
  assert.equal(LEVELS.filter((level) => level.worldIndex === world).map((level) => level.levelInWorld).sort((a, b) => a - b).join(','), '1,2,3,4,5,6,7,8,9,10');
  for (const chapter of [1, 2]) {
    const stages = LEVELS.filter((level) => level.worldIndex === world && (level.chapter ?? 1) === chapter);
    assert.equal(stages.length, 5);
    assert.equal(stages.filter((level) => level.isBoss).length, 1);
    assert(stages[4].isBoss);
  }
}
const originalIds = ['brown_sugar', 'matcha', 'taro', 'thai_tea'].flatMap((world) =>
  [1, 2, 3, 4, 'boss'].map((stage) => `${world}_${stage}`));
assert.equal(LEVELS.slice(0, 20).map((level) => level.id).join(','), originalIds.join(','), 'Original campaign IDs and order must stay stable');
assert.equal(LEVELS[20].id, 'brown_sugar_spiral');
assert.equal(new Set(LEVELS.map((level) => JSON.stringify(level.grid))).size, LEVELS.length, 'Each stage needs a distinct layout');
assert(LEVELS.slice(20).every((level) => level.chapter === 2 && level.name && level.guaranteedPowerUps?.length));
const normalized = (bricks) => JSON.stringify(bricks.map(({ id, ...brick }) => brick));
LEVELS.forEach((level, index) => {
  assert(level.ballSpeed > 0 && level.ballSpeed <= BALL_SPEED_MAX, `${level.id}: invalid speed`);
  assert(level.paddleWidth > 20 && level.paddleWidth < GAME_WIDTH, `${level.id}: invalid paddle`);
  assert(level.powerUpChance >= 0 && level.powerUpChance <= 1);
  assert(level.grid.every((row) => row.length === 7 && row.every((hp) => Number.isInteger(hp) && hp >= 0 && hp <= 3)));
  const first = buildLevelBricks(index);
  assert(first.length > 0);
  assert.equal(normalized(first), normalized(buildLevelBricks(index)), `${level.id}: non-deterministic generation`);
  for (const brick of first) {
    const rect = brickRect(brick);
    assert(rect.x >= 0 && rect.x + rect.w <= GAME_WIDTH);
    assert(rect.y + rect.h < 650, `${level.id}: brick reaches paddle area`);
    if (level.isBoss) assert(rect.y > BOSS_Y + BOSS_HEIGHT);
  }
  for (const power of level.guaranteedPowerUps ?? []) {
    assert(first.some((brick) => brick.row === power.row && brick.col === power.col && brick.powerUp === power.type));
  }
});
console.log('Level generation, bounds, progression, and power-up checks passed.');
