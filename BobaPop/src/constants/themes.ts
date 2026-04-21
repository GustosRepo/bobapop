export type WorldTheme = {
  id: string;
  name: string;
  background: string[];
  bgImage: ReturnType<typeof require>;
  brickColors: string[];
  paddleColor: string;
  ballColor: string;
  accentColor: string;
  particleColors: string[];
};

export const WORLDS: WorldTheme[] = [
  {
    id: 'brown_sugar',
    name: 'Brown Sugar',
    background: ['#2A0F05', '#5A2A14', '#2A0F05'],
    bgImage: require('../../assets/gameassets/bobabg 1.png'),
    brickColors: ['#5A2A14', '#C47A2C', '#F2C078'],
    paddleColor: '#C47A2C',
    ballColor: '#F2C078',
    accentColor: '#C47A2C',
    particleColors: ['#F2C078', '#C47A2C', '#5A2A14', '#FFE4A0', '#FFFFFF'],
  },
  {
    id: 'matcha',
    name: 'Matcha',
    background: ['#0F2018', '#1E3A2F', '#0F2018'],
    bgImage: require('../../assets/gameassets/bobabg 2.png'),
    brickColors: ['#1E3A2F', '#4F8F6B', '#A6D9B5'],
    paddleColor: '#4F8F6B',
    ballColor: '#A6D9B5',
    accentColor: '#4F8F6B',
    particleColors: ['#A6D9B5', '#4F8F6B', '#1E3A2F', '#D0F0DC', '#FFFFFF'],
  },
  {
    id: 'taro',
    name: 'Taro',
    background: ['#180E24', '#2B1A3D', '#180E24'],
    bgImage: require('../../assets/gameassets/bobabg 3.png'),
    brickColors: ['#2B1A3D', '#6E4BA8', '#C6A4FF'],
    paddleColor: '#6E4BA8',
    ballColor: '#C6A4FF',
    accentColor: '#6E4BA8',
    particleColors: ['#C6A4FF', '#6E4BA8', '#2B1A3D', '#E8D5FF', '#FFFFFF'],
  },
  {
    id: 'thai_tea',
    name: 'Thai Tea',
    background: ['#1E0A02', '#3A1405', '#1E0A02'],
    bgImage: require('../../assets/gameassets/bobabg 4.png'),
    brickColors: ['#3A1405', '#D96A1C', '#FFD2A6'],
    paddleColor: '#D96A1C',
    ballColor: '#FFD2A6',
    accentColor: '#D96A1C',
    particleColors: ['#FFD2A6', '#D96A1C', '#3A1405', '#FFE8CC', '#FFFFFF'],
  },
];

export const getWorldForLevel = (levelIndex: number): WorldTheme => {
  const worldIndex = Math.floor(levelIndex / 5);
  return WORLDS[Math.min(worldIndex, WORLDS.length - 1)];
};
