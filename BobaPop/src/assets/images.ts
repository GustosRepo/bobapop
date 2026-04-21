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

  // HUD
  pauseBtn: require('../../assets/gameassets/iconsbtn 2.png'),

  // Mascot expressions
  mascotHappy:   require('../../assets/gameassets/varitaions 2.png'),
  mascotSad:     require('../../assets/gameassets/varitaions 3.png'),
  mascotExcited: require('../../assets/gameassets/varitaions 4.png'),
} as const;
