const RANK_TITLES = [
  'New Popper', 'Boba Beginner', 'Boba Novice', 'Boba Fan', 'Boba Slurper',
  'Boba Adept', 'Boba Ace', 'Boba Pro', 'Boba Expert', 'Boba Legend', 'Boba Master',
  'Caramel Champion', 'Jade Champion', 'Lunar Champion', 'Amber Champion', 'Boba Virtuoso',
  'Pearl Collector', 'Pearl Champion', 'Pearl Legend', 'Pearl Master', 'Boba Grandmaster',
];

export function calculatePlayerLevel(totalStars: number): { level: number; title: string } {
  const level = Math.min(RANK_TITLES.length - 1, Math.max(0, Math.floor(totalStars / 6)));
  return { level, title: RANK_TITLES[level] };
}
