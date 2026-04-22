// Centralized image registry — static require() so Metro can resolve all assets at build time

export const IMAGES = {
  // World backgrounds (index 0–3 matches WORLDS array order)
  backgrounds: [
    require('../../assets/gameassets/bobabg 1.png'),
    require('../../assets/gameassets/bobabg 2.png'),
    require('../../assets/gameassets/bobabg 3.png'),
    require('../../assets/gameassets/bobabg 4.png'),
  ] as const,

  // Paddle states
  paddle:       require('../../assets/gameassets/varpaddke 1.png'),
  paddleSticky: require('../../assets/gameassets/carpaddle 2.png'),
  paddleWide:   require('../../assets/gameassets/carpaddle 3.png'),
  paddleSlow:   require('../../assets/gameassets/carpaddle 1.png'),

  // Game ball
  ball: require('../../assets/gameassets/bobaball 1.png'),

  // Bricks by HP — index 0 = 1 HP, index 3 = 4 HP
  blocks: [
    require('../../assets/gameassets/blockvar 1.png'),
    require('../../assets/gameassets/blockvar 2.png'),
    require('../../assets/gameassets/blockvar 3.png'),
    require('../../assets/gameassets/blockvar 4.png'),
  ] as const,

  // Boss
  boss: require('../../assets/gameassets/boss.png'),

  // Effects
  particleBoba: require('../../assets/gameassets/effects 3.png'),

  // HUD
  pauseBtn: require('../../assets/gameassets/iconsbtn 2.png'),
  lifeIcon: require('../../assets/gameassets/lifeboba.png'),

  // Mascot expressions
  mascotHappy:   require('../../assets/gameassets/newboba 2.png'),  // gentle smile
  mascotSad:     require('../../assets/gameassets/newboba 4.png'),  // sad with tear
  mascotExcited: require('../../assets/gameassets/newboba 1.png'),  // star eyes
  mascotVictory: require('../../assets/gameassets/newboba 3.png'),  // big laugh
} as const;
