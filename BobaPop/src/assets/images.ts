// Centralized image registry — static require() so Metro can resolve all assets at build time

export const IMAGES = {
  // World backgrounds (index 0–3 matches WORLDS array order)
  backgrounds: [
    require('../../assets/gameassets/boba-bg-1.png'),
    require('../../assets/gameassets/boba-bg-2.png'),
    require('../../assets/gameassets/boba-bg-3.png'),
    require('../../assets/gameassets/boba-bg-4.png'),
  ] as const,

  // Paddle states
  paddle:       require('../../assets/gameassets/paddle-default.png'),
  paddleSticky: require('../../assets/gameassets/car-paddle-2.png'),
  paddleWide:   require('../../assets/gameassets/car-paddle-3.png'),
  paddleSlow:   require('../../assets/gameassets/car-paddle-1.png'),

  // Game ball
  ball: require('../../assets/gameassets/boba-ball.png'),
  ballHit: require('../../assets/gameassets/boba-ball-hit.png'),
  ballHot: require('../../assets/gameassets/boba-ball-hot.png'),
  ballMulti: require('../../assets/gameassets/boba-ball-multi.png'),

  // Bricks by HP — index 0 = 1 HP, index 3 = 4 HP
  blocks: [
    require('../../assets/gameassets/blockvar-1.png'),
    require('../../assets/gameassets/blockvar-2.png'),
    require('../../assets/gameassets/blockvar-3.png'),
    require('../../assets/gameassets/blockvar-4.png'),
  ] as const,

  // Boss
  boss: require('../../assets/gameassets/boss.png'),

  // Effects
  effectSplash: require('../../assets/gameassets/effect-splash.png'),
  effectBurst: require('../../assets/gameassets/effect-burst.png'),
  particleBoba: require('../../assets/gameassets/effect-boba.png'),

  // HUD
  settingsBtn: require('../../assets/gameassets/settings-button.png'),
  pauseBtn: require('../../assets/gameassets/pause-button.png'),
  lifeIcon: require('../../assets/gameassets/lifeboba.png'),

  // World flavor art
  worldMascots: [
    require('../../assets/gameassets/world-brown-sugar.png'),
    require('../../assets/gameassets/world-matcha.png'),
    require('../../assets/gameassets/world-taro.png'),
    require('../../assets/gameassets/world-thai-tea.png'),
  ] as const,

  // Mascot expressions
  mascotHappy:   require('../../assets/gameassets/mascot-happy.png'),
  mascotSad:     require('../../assets/gameassets/mascot-sad.png'),
  mascotExcited: require('../../assets/gameassets/mascot-excited.png'),
  mascotVictory: require('../../assets/gameassets/mascot-victory.png'),
} as const;
