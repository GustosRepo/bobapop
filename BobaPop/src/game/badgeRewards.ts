export type BadgeStyleId = 'classic' | 'caramel' | 'jade' | 'taro' | 'pearl' | 'cosmic';

export interface BadgeStyle {
  id: BadgeStyleId;
  name: string;
  colors: [string, string];
  foreground: string;
  stars: number;
  bobas: number;
}

export const BADGE_STYLES: BadgeStyle[] = [
  { id: 'classic', name: 'Classic', colors: ['#FFD700', '#FF8C00'], foreground: '#54280C', stars: 0, bobas: 0 },
  { id: 'caramel', name: 'Caramel', colors: ['#B16B2B', '#64320F'], foreground: '#FFF4D6', stars: 0, bobas: 100 },
  { id: 'jade', name: 'Jade', colors: ['#3F8E65', '#153F30'], foreground: '#F0FFF5', stars: 0, bobas: 500 },
  { id: 'taro', name: 'Taro', colors: ['#8652B7', '#3D205D'], foreground: '#FFF0FF', stars: 30, bobas: 0 },
  { id: 'pearl', name: 'Pearl', colors: ['#FFF4DE', '#C8A66A'], foreground: '#54280C', stars: 60, bobas: 0 },
  { id: 'cosmic', name: 'Cosmic', colors: ['#455CB1', '#24174F'], foreground: '#FFF4FF', stars: 120, bobas: 0 },
];

export function isBadgeUnlocked(badge: BadgeStyle, stars: number, bobas: number): boolean {
  return stars >= badge.stars && bobas >= badge.bobas;
}

export function getBadgeStyle(id: string, stars: number, bobas: number): BadgeStyle {
  return BADGE_STYLES.find((badge) => badge.id === id && isBadgeUnlocked(badge, stars, bobas)) ?? BADGE_STYLES[0];
}
